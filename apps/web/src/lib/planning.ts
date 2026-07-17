import type {
  CapacityRule,
  Coord,
  Facts,
  ScheduleLine,
  ScheduleTeam,
  ShiftContext,
  WorkItemType,
} from "@montaj/rules";
import { one } from "@/lib/rel";
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
      supabase
        .from("team")
        .select(
          "id, name, is_subcontractor, preference_weight, team_member(person_id), team_capability(work_item_type_id, daily_cap), base_location:base_location_id(lat, lon)",
        ),
      supabase.from("availability").select("person_id, date_from, date_to"),
      supabase.from("site").select("id, lat, lon"),
    ]);

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
    const dailyCapOverride: Record<string, number> = {};
    for (const c of (t.team_capability ?? []) as Array<{
      work_item_type_id: string;
      daily_cap: number | null;
    }>) {
      if (c.daily_cap != null) dailyCapOverride[c.work_item_type_id] = c.daily_cap;
    }
    const base = one<{ lat: number | null; lon: number | null }>(t.base_location);
    const baseCoord =
      base && base.lat != null && base.lon != null
        ? { lat: base.lat, lon: base.lon }
        : undefined;
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
      dailyCapOverride,
    };
  });

  return { typeMap, rules, shift, teams, calendar, siteCoords, avgSpeedKmh: AVG_KMH };
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
