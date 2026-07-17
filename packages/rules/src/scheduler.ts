/**
 * Pure scheduling heuristic — delivery-date driven, chronological, order-level.
 *
 * Key rules (from customer feedback):
 * - Each order is scheduled ONCE, on working days inside its delivery window
 *   [earliestDate .. deliveryDate]. The caller passes a full multi-week horizon,
 *   so orders land in their correct week — not all dumped into one week.
 * - ONE team per order/site. Spill to a second team only when a single team
 *   cannot finish the order by its delivery date (deadline pressure).
 * - Pre-committed team-day loads (from already-started assignments) are honored
 *   so re-planning never double-books or duplicates work.
 *
 * Pure: data in -> assignments out. Unit-tested; swappable for an OR-Tools
 * solver behind the same shape.
 */
import { shiftHours, unitCostDays } from "./capacity";
import { haversineKm, kmToMinutes, nearestNeighborTourKm, type Coord } from "./geo";
import type { CapacityRule, Facts, ShiftContext, WorkItemType } from "./types";

export interface ScheduleTeam {
  id: string;
  name: string;
  /** Base member count (before leave). */
  headcount: number;
  isSubcontractor: boolean;
  preferenceWeight: number;
  capableTypeIds: string[];
  /**
   * Round-trip travel minutes base→site (fallback used only when the team's
   * base coordinate or the site coordinate is missing).
   */
  travelMinutesToSite: Record<string, number>;
  /** Team's base location, for coordinate-based (intra-day tour) travel. */
  baseCoord?: Coord;
  /** Members on leave per date — subtracted from headcount that day. */
  unavailableByDate?: Record<string, number>;
  /** Per-type units/day override for this team (e.g. subcontractor "2/day"). */
  dailyCapOverride?: Record<string, number>;
}

export interface ScheduleLine {
  orderLineId: string;
  type: WorkItemType;
  quantity: number;
  /** line.* + order.* facts; team.headcount + day.overtime added internally. */
  facts: Facts;
}

export interface ScheduleOrder {
  orderId: string;
  orderCode: string;
  siteId: string;
  accessOverheadMinutes: number;
  lines: ScheduleLine[];
  /** Earliest install date (production-due). Can't start before this. */
  earliestDate: string;
  /** Deadline — installation must finish by this date (null = no deadline). */
  deliveryDate: string | null;
}

/** Team-day budget already consumed by started/kept assignments. */
export interface CommittedLoad {
  teamId: string;
  date: string;
  cost: number;
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
  reason: "no_team" | "not_ready" | "past_deadline" | "no_capacity";
}

export interface ScheduleInput {
  /** All working days in the planning horizon, chronological (ISO dates). */
  workingDays: string[];
  shift: ShiftContext;
  rules: CapacityRule[];
  teams: ScheduleTeam[];
  orders: ScheduleOrder[];
  /** Budgets already consumed by started/completed assignments. */
  committed?: CommittedLoad[];
  /** Site coordinates by site id, for intra-day site-to-site travel. */
  siteCoords?: Record<string, Coord>;
  /** Average road speed (km/h) for distance→time. Default 55. */
  avgSpeedKmh?: number;
}

export interface ScheduleOutput {
  assignments: PlannedAssignment[];
  unplaced: UnplacedItem[];
}

const EPS = 1e-9;
const FAR_FUTURE = "9999-12-31";

interface DayState {
  /** Sites already visited (travel/access charged) this day. */
  sites: Set<string>;
  /** Coordinates of those sites, for the nearest-neighbor day tour. */
  coords: Coord[];
  /** Current whole-day driving time (minutes) for the tour so far. */
  tourMin: number;
}

export function schedule(input: ScheduleInput): ScheduleOutput {
  const { workingDays, shift, rules, teams, orders } = input;
  const assignments: PlannedAssignment[] = [];
  const unplaced: UnplacedItem[] = [];
  const hoursPerDay = shiftHours(shift);
  const siteCoords = input.siteCoords ?? {};
  const speed = input.avgSpeedKmh ?? 55;

  // Per (team, date): remaining budget (1.0) and the day's travel state.
  const budget = new Map<string, Map<string, number>>();
  const state = new Map<string, Map<string, DayState>>();
  for (const t of teams) {
    const b = new Map<string, number>();
    const s = new Map<string, DayState>();
    for (const d of workingDays) {
      b.set(d, 1);
      s.set(d, { sites: new Set(), coords: [], tourMin: 0 });
    }
    budget.set(t.id, b);
    state.set(t.id, s);
  }
  for (const c of input.committed ?? []) {
    const b = budget.get(c.teamId);
    if (b && b.has(c.date)) b.set(c.date, (b.get(c.date) ?? 1) - c.cost);
  }

  const baseToSiteMin = (team: ScheduleTeam, siteId: string): number => {
    const coord = siteCoords[siteId];
    if (team.baseCoord && coord) return kmToMinutes(haversineKm(team.baseCoord, coord), speed);
    return team.travelMinutesToSite[siteId] ?? 0;
  };

  const loadInWindow = (teamId: string, windowDays: string[]): number => {
    const b = budget.get(teamId)!;
    let load = 0;
    for (const d of windowDays) load += 1 - (b.get(d) ?? 1);
    return load;
  };

  // Most-urgent deadline first, then earliest start, then code for stability.
  const sorted = [...orders].sort(
    (a, b) =>
      (a.deliveryDate ?? FAR_FUTURE).localeCompare(b.deliveryDate ?? FAR_FUTURE) ||
      a.earliestDate.localeCompare(b.earliestDate) ||
      a.orderCode.localeCompare(b.orderCode),
  );

  const firstDay = workingDays[0];
  const lastDay = workingDays[workingDays.length - 1];

  for (const order of sorted) {
    const window = workingDays.filter(
      (d) => d >= order.earliestDate && (!order.deliveryDate || d <= order.deliveryDate),
    );
    const remaining = new Map(order.lines.map((l) => [l.orderLineId, l.quantity] as const));

    if (window.length === 0) {
      const pastDeadline =
        order.deliveryDate != null && firstDay != null && order.deliveryDate < firstDay;
      const reason = pastDeadline ? "past_deadline" : "not_ready";
      for (const l of order.lines) unplaced.push(u(order, l.orderLineId, l.quantity, reason));
      continue;
    }

    // Teams that can do EVERY line of the order (so one team owns the site).
    const capableAll = teams.filter((t) =>
      order.lines.every((l) => t.capableTypeIds.includes(l.type.id)),
    );
    // Fallback: if no single team can do all line types, use any team capable of
    // at least one line (a genuine multi-skill split, not a choice).
    const pool =
      capableAll.length > 0
        ? capableAll
        : teams.filter((t) => order.lines.some((l) => t.capableTypeIds.includes(l.type.id)));

    if (pool.length === 0) {
      for (const l of order.lines) unplaced.push(u(order, l.orderLineId, l.quantity, "no_team"));
      continue;
    }

    // In-house first, then least-loaded in the window, then nearest. Fill the
    // primary team; spill to the next only when the order can't finish in time.
    const ordered = [...pool].sort(
      (a, b) =>
        a.preferenceWeight - b.preferenceWeight ||
        loadInWindow(a.id, window) - loadInWindow(b.id, window) ||
        baseToSiteMin(a, order.siteId) - baseToSiteMin(b, order.siteId),
    );

    for (const team of ordered) {
      if ([...remaining.values()].every((r) => r <= 0)) break;
      placeOrderOnTeam(
        order, team, window, remaining, shift, rules, hoursPerDay, budget,
        state.get(team.id)!, siteCoords, speed, assignments,
      );
    }

    for (const l of order.lines) {
      const rem = remaining.get(l.orderLineId) ?? 0;
      if (rem > 0) unplaced.push(u(order, l.orderLineId, rem, "no_capacity"));
    }
  }

  // `lastDay` is captured for symmetry with firstDay; keep referenced.
  void lastDay;
  return { assignments, unplaced };
}

/** Fill an order's remaining line-units onto one team across the window days. */
function placeOrderOnTeam(
  order: ScheduleOrder,
  team: ScheduleTeam,
  window: string[],
  remaining: Map<string, number>,
  shift: ShiftContext,
  rules: CapacityRule[],
  hoursPerDay: number,
  budget: Map<string, Map<string, number>>,
  teamState: Map<string, DayState>,
  siteCoords: Record<string, Coord>,
  speed: number,
  out: PlannedAssignment[],
): void {
  const b = budget.get(team.id)!;
  const siteCoord = siteCoords[order.siteId];

  for (const date of window) {
    if (order.lines.every((l) => (remaining.get(l.orderLineId) ?? 0) <= 0)) break;

    // Headcount varies by day: subtract anyone on leave. Whole team off => skip.
    const headcount = team.headcount - (team.unavailableByDate?.[date] ?? 0);
    if (headcount <= 0) continue;

    const st = teamState.get(date)!;
    let rem = b.get(date) ?? 1;
    let overheadCharged = st.sites.has(order.siteId);

    // Overhead for adding this site to the day = the extra driving it adds to
    // the team's nearest-neighbor tour (base → sites → base) + its site access.
    let pendingTourMin = st.tourMin;
    let pendingOverhead = 0;
    if (!overheadCharged) {
      const newCoords = siteCoord ? [...st.coords, siteCoord] : st.coords;
      pendingTourMin = kmToMinutes(nearestNeighborTourKm(team.baseCoord, newCoords), speed);
      const deltaTravel = Math.max(0, pendingTourMin - st.tourMin);
      pendingOverhead = (deltaTravel + order.accessOverheadMinutes) / 60 / hoursPerDay;
    }

    for (const line of order.lines) {
      let r = remaining.get(line.orderLineId) ?? 0;
      if (r <= 0) continue;
      if (!team.capableTypeIds.includes(line.type.id)) continue;

      // Per-team units/day override (e.g. subcontractor's fixed rate) wins;
      // otherwise the capacity engine computes cost with this day's headcount.
      const override = team.dailyCapOverride?.[line.type.id];
      const unit =
        override && override > 0
          ? 1 / override
          : unitCostDays(line.type, shift, rules, {
              ...line.facts,
              "team.headcount": headcount,
              "day.overtime": shift.overtime,
            });
      if (!Number.isFinite(unit) || unit <= 0) continue;

      const overhead = overheadCharged ? 0 : pendingOverhead;
      const available = rem - overhead;
      if (available <= EPS) break; // no room left on this day

      const maxUnits = Math.floor((available + EPS) / unit);
      if (maxUnits <= 0) {
        if (!overheadCharged) break; // can't even fit overhead + one unit today
        continue;
      }

      const place = Math.min(r, maxUnits);
      const cost = place * unit + overhead;
      out.push({
        orderLineId: line.orderLineId,
        orderId: order.orderId,
        orderCode: order.orderCode,
        teamId: team.id,
        date,
        units: place,
        estimatedCost: cost,
        typeId: line.type.id,
      });
      rem -= cost;
      remaining.set(line.orderLineId, r - place);
      if (!overheadCharged) {
        overheadCharged = true;
        st.sites.add(order.siteId);
        if (siteCoord) st.coords.push(siteCoord);
        st.tourMin = pendingTourMin;
      }
    }
    b.set(date, rem);
  }
}

function u(
  order: ScheduleOrder,
  orderLineId: string,
  remaining: number,
  reason: UnplacedItem["reason"],
): UnplacedItem {
  return { orderLineId, orderCode: order.orderCode, remaining, reason };
}
