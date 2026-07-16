import type {
  CapacityRule,
  Facts,
  ScheduleTeam,
  ShiftContext,
  WorkItemType,
} from "@montaj/rules";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Average road speed (km/h) used to turn straight-line meters into minutes. */
const AVG_KMH = 55;

export interface PlanningContext {
  typeMap: Map<string, WorkItemType>;
  rules: CapacityRule[];
  shift: ShiftContext;
  teams: ScheduleTeam[];
}

/**
 * Loads everything the scheduler needs from the tenant's data (RLS-scoped by
 * the caller's session): work-item types, capacity rules, shift, and teams with
 * headcount, capabilities and round-trip travel minutes to each site.
 */
export async function buildPlanningContext(supabase: Supabase): Promise<PlanningContext> {
  const [{ data: types }, { data: rulesRows }, { data: setting }, { data: teamRows }, travel] =
    await Promise.all([
      supabase.from("work_item_type").select("*"),
      supabase.from("capacity_rule").select("*").eq("enabled", true),
      supabase.from("tenant_setting").select("normal_shift_hours, overtime_shift_hours").maybeSingle(),
      supabase
        .from("team")
        .select(
          "id, name, is_subcontractor, preference_weight, team_member(person_id), team_capability(work_item_type_id)",
        ),
      supabase.rpc("travel_estimates"),
    ]);

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

  // team -> site -> round-trip minutes
  const travelMap: Record<string, Record<string, number>> = {};
  for (const row of (travel.data ?? []) as Array<{ team_id: string; site_id: string; meters: number }>) {
    const minutes = (row.meters / 1000 / AVG_KMH) * 60 * 2; // round trip
    (travelMap[row.team_id] ??= {})[row.site_id] = minutes;
  }

  const teams: ScheduleTeam[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    headcount: (t.team_member ?? []).length,
    isSubcontractor: t.is_subcontractor,
    preferenceWeight: Number(t.preference_weight ?? 100),
    capableTypeIds: (t.team_capability ?? []).map(
      (c: { work_item_type_id: string }) => c.work_item_type_id,
    ),
    travelMinutesToSite: travelMap[t.id] ?? {},
  }));

  return { typeMap, rules, shift, teams };
}

/** Build the fact bag for one order line (line.* + order.*). */
export function lineFacts(
  attributes: Record<string, unknown> | null | undefined,
  order: { requires_demolition: boolean },
): Facts {
  const f: Facts = { "order.requires_demolition": order.requires_demolition };
  for (const [k, v] of Object.entries(attributes ?? {})) f[`line.${k}`] = v;
  return f;
}

/** N consecutive working days (default Mon–Fri = 5) from an ISO date. */
export function weekDaysFrom(weekStart: string, n = 5): string[] {
  const days: string[] = [];
  const base = new Date(`${weekStart}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** Monday (UTC) of the week containing the given date. */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
