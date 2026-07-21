import type {
  CapacityRule,
  Coord,
  Facts,
  ScheduleLine,
  ScheduleTeam,
  ShiftContext,
  WorkItemType,
} from "@montaj/rules";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Average road speed (km/h) used to turn distances into minutes. */
export const AVG_KMH = 55;
/** How many weeks ahead the planner lays out working days. */
export const HORIZON_WEEKS = 16;

export interface Calendar {
  /** ISO weekday numbers the teams install on (1 = Mon … 7 = Sun). */
  workingWeekdays: number[];
  bufferDays: number;
}

export interface PlanningContext {
  typeMap: Map<string, WorkItemType>;
  rules: CapacityRule[];
  shift: ShiftContext;
  teams: ScheduleTeam[];
  calendar: Calendar;
  siteCoords: Record<string, Coord>;
  avgSpeedKmh: number;
  /** Shared resource pools by kind → available asset ids (e.g. manlifts). */
  resources: Record<string, string[]>;
  /** Overpack tolerance (0.10 = a day may pack up to 110%). */
  dayFillTolerance: number;
}

export async function buildPlanningContext(supabase: Supabase): Promise<PlanningContext> {
  const [{ data: types }, { data: rulesRows }, { data: setting }, { data: teamRows }, { data: leave }, { data: siteRows }] =
    await Promise.all([
      supabase.from("work_item_type").select("*"),
      supabase.from("capacity_rule").select("*").eq("enabled", true),
      supabase
        .from("tenant_setting")
        .select("normal_shift_hours, overtime_shift_hours, working_days, production_buffer_days")
        .maybeSingle(),
      // Only columns guaranteed since 0001 — daily_cap (0008) and coords (0009)
      // are fetched separately/tolerantly below, so a lagging migration can't
      // break scheduling or team editing.
      supabase
        .from("team")
        .select(
          "id, name, is_subcontractor, preference_weight, base_location_id, team_member(person_id), team_capability(work_item_type_id)",
        ),
      supabase.from("availability").select("person_id, date_from, date_to"),
      supabase.from("site").select("id, lat, lon"),
    ]);

  // Optional columns from later migrations — ignore the error if absent.
  const { data: capRows } = await supabase
    .from("team_capability")
    .select("team_id, work_item_type_id, daily_cap");
  const capByTeam: Record<string, Record<string, number>> = {};
  for (const c of (capRows ?? []) as Array<{ team_id: string; work_item_type_id: string; daily_cap: number | null }>) {
    if (c.daily_cap != null) (capByTeam[c.team_id] ??= {})[c.work_item_type_id] = c.daily_cap;
  }
  // Overpack tolerance (0012) — fetched tolerantly so a lagging migration falls
  // back to strict 100% days rather than breaking the whole context load.
  const { data: tolRow } = await supabase
    .from("tenant_setting")
    .select("day_fill_tolerance")
    .maybeSingle();
  const dayFillTolerance = Number((tolRow as { day_fill_tolerance?: number } | null)?.day_fill_tolerance ?? 0);

  const { data: locRows } = await supabase.from("location").select("id, lat, lon");
  const locCoords: Record<string, Coord> = {};
  for (const l of (locRows ?? []) as Array<{ id: string; lat: number | null; lon: number | null }>) {
    if (l.lat != null && l.lon != null) locCoords[l.id] = { lat: l.lat, lon: l.lon };
  }

  // Fleet (0011): assets carry a team_id (the team's vehicle) and/or a
  // resource_kind (a shared pool member like a manlift). Tolerant of a lagging
  // migration — absent columns just leave the fleet unconfigured.
  const { data: assetRows } = await supabase
    .from("asset")
    .select("id, team_id, resource_kind");
  const { data: assetCapRows } = await supabase
    .from("asset_capacity")
    .select("asset_id, work_item_type_id, max_units");

  const assetTeam: Record<string, string> = {};
  const vehicleIdsByTeam: Record<string, string[]> = {};
  const resources: Record<string, string[]> = {};
  for (const a of (assetRows ?? []) as Array<{ id: string; team_id: string | null; resource_kind: string | null }>) {
    if (a.team_id) {
      assetTeam[a.id] = a.team_id;
      (vehicleIdsByTeam[a.team_id] ??= []).push(a.id);
    }
    if (a.resource_kind) (resources[a.resource_kind] ??= []).push(a.id);
  }
  // carryCapByType[team][type] = Σ over the team's vehicles of max_units for the
  // type (how many units/day the truck(s) can carry).
  const carryCapByTeam: Record<string, Record<string, number>> = {};
  for (const c of (assetCapRows ?? []) as Array<{ asset_id: string; work_item_type_id: string; max_units: number | null }>) {
    const teamId = assetTeam[c.asset_id];
    if (!teamId || c.max_units == null) continue;
    const byType = (carryCapByTeam[teamId] ??= {});
    byType[c.work_item_type_id] = (byType[c.work_item_type_id] ?? 0) + c.max_units;
  }

  const siteCoords: Record<string, Coord> = {};
  for (const s of (siteRows ?? []) as Array<{ id: string; lat: number | null; lon: number | null }>) {
    if (s.lat != null && s.lon != null) siteCoords[s.id] = { lat: s.lat, lon: s.lon };
  }

  const typeMap = new Map<string, WorkItemType>();
  for (const row of types ?? []) {
    typeMap.set(row.id, {
      id: row.id,
      code: row.code,
      capacityModel: row.capacity_model,
      baseCapacity: row.base_capacity ?? undefined,
      effort: row.effort ?? undefined,
      requiredResource: row.required_resource ?? undefined,
      crewBaseline: row.crew_baseline ?? undefined,
      perPersonBonus: row.per_person_bonus ?? undefined,
    });
  }

  const rules: CapacityRule[] = (rulesRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    priority: r.priority,
    condition: r.condition ?? undefined,
    effect: r.effect,
  }));

  const shift: ShiftContext = {
    overtime: false,
    normalShiftHours: Number(setting?.normal_shift_hours ?? 9),
    overtimeShiftHours: Number(setting?.overtime_shift_hours ?? 12),
  };

  const calendar: Calendar = {
    workingWeekdays: (setting?.working_days as number[] | null) ?? [1, 2, 3, 4, 5],
    bufferDays: Number(setting?.production_buffer_days ?? 2),
  };

  // person -> the teams they belong to (a person can be on several teams).
  const personTeams = new Map<string, string[]>();
  for (const t of teamRows ?? []) {
    for (const m of (t.team_member ?? []) as Array<{ person_id: string }>) {
      const list = personTeams.get(m.person_id) ?? [];
      list.push(t.id);
      personTeams.set(m.person_id, list);
    }
  }
  // team -> date -> number of members on leave that day.
  const unavailable: Record<string, Record<string, number>> = {};
  for (const av of (leave ?? []) as Array<{ person_id: string; date_from: string; date_to: string }>) {
    const teamsWith = personTeams.get(av.person_id);
    if (!teamsWith) continue;
    for (const date of datesBetween(av.date_from, av.date_to)) {
      for (const teamId of teamsWith) {
        (unavailable[teamId] ??= {})[date] = ((unavailable[teamId] ??= {})[date] ?? 0) + 1;
      }
    }
  }

  const teams: ScheduleTeam[] = (teamRows ?? []).map((t) => {
    const baseCoord = t.base_location_id ? locCoords[t.base_location_id] : undefined;
    return {
      id: t.id,
      name: t.name,
      headcount: (t.team_member ?? []).length,
      isSubcontractor: t.is_subcontractor,
      preferenceWeight: Number(t.preference_weight ?? 100),
      capableTypeIds: (t.team_capability ?? []).map(
        (c: { work_item_type_id: string }) => c.work_item_type_id,
      ),
      travelMinutesToSite: {},
      baseCoord,
      unavailableByDate: unavailable[t.id] ?? {},
      dailyCapOverride: capByTeam[t.id] ?? {},
      carryCapByType: carryCapByTeam[t.id] ?? {},
      vehicleIds: vehicleIdsByTeam[t.id] ?? [],
    };
  });

  return {
    typeMap, rules, shift, teams, calendar, siteCoords,
    avgSpeedKmh: AVG_KMH, resources, dayFillTolerance,
  };
}

export function lineFacts(
  attributes: Record<string, unknown> | null | undefined,
  order: { requires_demolition: boolean },
): Facts {
  const f: Facts = { "order.requires_demolition": order.requires_demolition };
  for (const [k, v] of Object.entries(attributes ?? {})) f[`line.${k}`] = v;
  return f;
}

// ---- Working-day calendar math ---------------------------------------------

function isoWeekday(d: Date): number {
  return ((d.getUTCDay() + 6) % 7) + 1; // 1 = Mon … 7 = Sun
}

function isWorking(d: Date, workingWeekdays: number[]): boolean {
  return workingWeekdays.includes(isoWeekday(d));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** All working days for HORIZON_WEEKS starting at (and including) weekStart. */
export function horizonWorkingDays(
  startISO: string,
  workingWeekdays: number[],
  weeks = HORIZON_WEEKS,
): string[] {
  const days: string[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    if (isWorking(d, workingWeekdays)) days.push(iso(d));
  }
  return days;
}

/** Inclusive list of ISO dates from..to (capped so a bad range can't blow up). */
export function datesBetween(fromISO: string, toISO: string, maxDays = 400): string[] {
  const out: string[] = [];
  const d = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);
  let guard = 0;
  while (d <= end && guard < maxDays) {
    out.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
    guard++;
  }
  return out;
}

/** The working day that is `n` working days before `dateISO` (n ≥ 0). */
export function subtractWorkingDays(dateISO: string, n: number, workingWeekdays: number[]): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  while (!isWorking(d, workingWeekdays)) d.setUTCDate(d.getUTCDate() - 1);
  let count = n;
  while (count > 0) {
    do {
      d.setUTCDate(d.getUTCDate() - 1);
    } while (!isWorking(d, workingWeekdays));
    count--;
  }
  return iso(d);
}

/** Rough install duration (working days) for a set of lines, ignoring travel. */
export function estimateInstallDays(
  lines: Array<{ type: WorkItemType; quantity: number }>,
  shift: ShiftContext,
): number {
  let dayCost = 0;
  for (const l of lines) {
    if (l.type.capacityModel === "count" && l.type.baseCapacity) {
      dayCost += l.quantity / Math.max(1, l.type.baseCapacity.normal);
    } else if (l.type.effort) {
      dayCost += (l.quantity * l.type.effort.hoursPerUnit) / shift.normalShiftHours;
    }
  }
  return Math.max(1, Math.ceil(dayCost));
}

/**
 * Production-due date (= latest day production must be complete / install can
 * start) working backward from the delivery date, leaving install duration and
 * a safety buffer of working days.
 */
export function productionDueDate(
  deliveryDate: string,
  installDays: number,
  bufferDays: number,
  workingWeekdays: number[],
): string {
  return subtractWorkingDays(deliveryDate, installDays - 1 + bufferDays, workingWeekdays);
}

export type { ScheduleLine };

/** N consecutive calendar days from an ISO date (board columns, default 5). */
export function weekDaysFrom(startISO: string, n = 5): string[] {
  const days: string[] = [];
  const base = new Date(`${startISO}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    days.push(iso(d));
  }
  return days;
}

/** Monday (UTC) of the week containing the given date. */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return iso(d);
}

/** First day (UTC) of the month containing `date`, as ISO. */
export function firstOfMonth(date: Date): string {
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

/** Shift a YYYY-MM-01 ISO date by `delta` months. */
export function addMonths(monthISO: string, delta: number): string {
  const d = new Date(`${monthISO}T00:00:00Z`);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1)));
}

/**
 * All dates of the Monday-start grid that fully covers the month of `monthISO`
 * (leading/trailing days from adjacent months included), so a calendar renders
 * as whole weeks.
 */
export function monthGrid(monthISO: string): string[] {
  const first = new Date(`${monthISO}T00:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7; // days from Monday
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - lead);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const trail = 6 - ((last.getUTCDay() + 6) % 7);
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + trail);
  const days: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(iso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}
