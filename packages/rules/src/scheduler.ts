/**
 * Pure scheduling heuristic. Turns a backlog of order-line items into a set of
 * (team, day, units) assignments, respecting team skills, per-day capacity
 * (via the capacity engine), production-readiness, travel time and site access.
 *
 * Kept pure (data in -> assignments out) so it is unit-testable and can later be
 * swapped for an OR-Tools solver behind the same shape.
 */
import { shiftHours, unitCostDays } from "./capacity";
import type { CapacityRule, Facts, ShiftContext, WorkItemType } from "./types";

export interface ScheduleTeam {
  id: string;
  name: string;
  headcount: number;
  isSubcontractor: boolean;
  preferenceWeight: number;
  capableTypeIds: string[];
  /** Round-trip travel minutes from the team's base to a given site id. */
  travelMinutesToSite: Record<string, number>;
}

export interface ScheduleItem {
  orderLineId: string;
  orderId: string;
  orderCode: string;
  siteId: string;
  accessOverheadMinutes: number;
  type: WorkItemType;
  quantity: number;
  /** line.* and order.* facts; team.headcount + day.overtime are added here. */
  facts: Facts;
  /** ISO date; the item cannot be installed before production is ready. */
  productionReadyDate: string | null;
  /** If production is confirmed done, the readiness date no longer gates it. */
  productionConfirmed?: boolean;
  /** Lower = higher priority (typically the order date as a sortable string). */
  priority: number;
}

export interface PlannedAssignment {
  orderLineId: string;
  orderId: string;
  orderCode: string;
  teamId: string;
  date: string;
  units: number;
  estimatedCost: number;
  typeId: string;
}

export interface UnplacedItem {
  orderLineId: string;
  orderCode: string;
  remaining: number;
  reason: "no_team" | "not_ready" | "no_capacity";
}

export interface ScheduleInput {
  weekDays: string[];
  shift: ShiftContext;
  rules: CapacityRule[];
  teams: ScheduleTeam[];
  items: ScheduleItem[];
}

export interface ScheduleOutput {
  assignments: PlannedAssignment[];
  unplaced: UnplacedItem[];
}

const EPS = 1e-9;

export function schedule(input: ScheduleInput): ScheduleOutput {
  const { weekDays, shift, rules, teams, items } = input;
  const assignments: PlannedAssignment[] = [];
  const unplaced: UnplacedItem[] = [];
  const hoursPerDay = shiftHours(shift);

  // Per (team, date): remaining day budget (1.0) and sites already charged
  // travel/access this day (so a second line at the same site is free travel).
  const budget = new Map<string, Map<string, number>>();
  const visited = new Map<string, Map<string, Set<string>>>();
  for (const t of teams) {
    const b = new Map<string, number>();
    const v = new Map<string, Set<string>>();
    for (const d of weekDays) {
      b.set(d, 1);
      v.set(d, new Set());
    }
    budget.set(t.id, b);
    visited.set(t.id, v);
  }

  // Current committed load for a team across the week (0 = fully free).
  const teamLoad = (teamId: string): number => {
    const b = budget.get(teamId)!;
    let load = 0;
    for (const d of weekDays) load += 1 - b.get(d)!;
    return load;
  };

  const sorted = [...items].sort(
    (a, b) => a.priority - b.priority || a.orderCode.localeCompare(b.orderCode),
  );

  for (const item of sorted) {
    const eligible = teams.filter((t) => t.capableTypeIds.includes(item.type.id));
    if (eligible.length === 0) {
      unplaced.push(unplacedOf(item, item.quantity, "no_team"));
      continue;
    }

    const readyDays = weekDays.filter(
      (d) => item.productionConfirmed || !item.productionReadyDate || d >= item.productionReadyDate,
    );
    if (readyDays.length === 0) {
      unplaced.push(unplacedOf(item, item.quantity, "not_ready"));
      continue;
    }

    // Distribute across capable teams: in-house before subcontractor
    // (preferenceWeight), then the least-loaded team first, then nearest.
    // Spill to the next team when one runs out of capacity — so idle teams get
    // work instead of the item going unplaced.
    const ordered = [...eligible].sort(
      (a, b) =>
        a.preferenceWeight - b.preferenceWeight ||
        teamLoad(a.id) - teamLoad(b.id) ||
        (a.travelMinutesToSite[item.siteId] ?? 0) - (b.travelMinutesToSite[item.siteId] ?? 0),
    );

    let remaining = item.quantity;
    for (const team of ordered) {
      if (remaining <= 0) break;

      const facts: Facts = {
        ...item.facts,
        "team.headcount": team.headcount,
        "day.overtime": shift.overtime,
      };
      const unit = unitCostDays(item.type, shift, rules, facts);
      if (!Number.isFinite(unit) || unit <= 0) continue;

      const b = budget.get(team.id)!;
      const v = visited.get(team.id)!;
      const roundTrip = team.travelMinutesToSite[item.siteId] ?? 0;

      for (const date of readyDays) {
        if (remaining <= 0) break;

        const rem = b.get(date)!;
        const siteVisited = v.get(date)!.has(item.siteId);
        const overhead = siteVisited
          ? 0
          : (roundTrip + item.accessOverheadMinutes) / 60 / hoursPerDay;
        const available = rem - overhead;
        if (available <= EPS) continue;

        const maxUnits = Math.floor((available + EPS) / unit);
        if (maxUnits <= 0) continue;

        const place = Math.min(remaining, maxUnits);
        const cost = place * unit + overhead;
        assignments.push({
          orderLineId: item.orderLineId,
          orderId: item.orderId,
          orderCode: item.orderCode,
          teamId: team.id,
          date,
          units: place,
          estimatedCost: cost,
          typeId: item.type.id,
        });
        b.set(date, rem - cost);
        if (!siteVisited) v.get(date)!.add(item.siteId);
        remaining -= place;
      }
    }

    if (remaining > 0) {
      unplaced.push(unplacedOf(item, remaining, "no_capacity"));
    }
  }

  return { assignments, unplaced };
}

function unplacedOf(item: ScheduleItem, remaining: number, reason: UnplacedItem["reason"]): UnplacedItem {
  return { orderLineId: item.orderLineId, orderCode: item.orderCode, remaining, reason };
}
