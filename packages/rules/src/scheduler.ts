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
  /** Max units/day of a type the team's vehicle(s) can carry (absent = no cap). */
  carryCapByType?: Record<string, number>;
  /** The team's committed vehicle asset ids (recorded on each assignment). */
  vehicleIds?: string[];
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
  /** Committed vehicles + reserved shared resources (e.g. a manlift). */
  assetIds: string[];
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
  /**
   * Shared resource pools by kind → the available asset ids, e.g.
   * { manlift: ["id1","id2"] }. A team-day installing a type that requires that
   * resource reserves one; when the pool for a day is exhausted, no more teams
   * can install that type that day.
   */
  resources?: Record<string, string[]>;
  /**
   * Overpack tolerance: how much a single team-day may exceed a nominal full
   * day, as a fraction (0.10 = allow up to 110%). Lets a day absorb travel plus
   * one more unit that would otherwise spill to the next day. Default 0.
   */
  dayFillTolerance?: number;
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

/**
 * Fleet bookkeeping shared across the whole schedule pass:
 * - `resources`: available shared-resource asset ids by kind (e.g. manlifts).
 * - `reservations`: kind → date → (teamId → reserved assetId). One unit per
 *   team-day; the pool size caps how many teams install that kind in parallel.
 * - `placedByType`: teamId → date → typeId → units already placed, to enforce
 *   each team's per-type carrying capacity within the day.
 */
interface FleetCtx {
  resources: Record<string, string[]>;
  reservations: Map<string, Map<string, Map<string, string>>>;
  placedByType: Map<string, Map<string, Map<string, number>>>;
}

/**
 * Reserve one shared resource of `kind` for `teamId` on `date`.
 * - No pool configured for the kind => requirement is not enforced (`ok`, no
 *   asset), preserving pre-fleet behavior until the company adds resources.
 * - Team already holds one that day => reuse it (one manlift covers all its work).
 * - Pool exhausted for the day => `ok: false` (this type can't run for this team
 *   that day).
 */
function reserveResource(
  fleet: FleetCtx,
  kind: string,
  date: string,
  teamId: string,
): { ok: boolean; assetId?: string } {
  const pool = fleet.resources[kind];
  if (!pool || pool.length === 0) return { ok: true };
  let byDate = fleet.reservations.get(kind);
  if (!byDate) {
    byDate = new Map();
    fleet.reservations.set(kind, byDate);
  }
  let byTeam = byDate.get(date);
  if (!byTeam) {
    byTeam = new Map();
    byDate.set(date, byTeam);
  }
  const existing = byTeam.get(teamId);
  if (existing) return { ok: true, assetId: existing };
  if (byTeam.size >= pool.length) return { ok: false };
  const assetId = pool[byTeam.size]!;
  byTeam.set(teamId, assetId);
  return { ok: true, assetId };
}

/** teamId → date → typeId → units placed so far (created lazily). */
function placedMap(fleet: FleetCtx, teamId: string, date: string): Map<string, number> {
  let byDate = fleet.placedByType.get(teamId);
  if (!byDate) {
    byDate = new Map();
    fleet.placedByType.set(teamId, byDate);
  }
  let byType = byDate.get(date);
  if (!byType) {
    byType = new Map();
    byDate.set(date, byType);
  }
  return byType;
}

export function schedule(input: ScheduleInput): ScheduleOutput {
  const { workingDays, shift, rules, teams, orders } = input;
  const assignments: PlannedAssignment[] = [];
  const unplaced: UnplacedItem[] = [];
  const hoursPerDay = shiftHours(shift);
  const siteCoords = input.siteCoords ?? {};
  const speed = input.avgSpeedKmh ?? 55;
  // A full day is 1.0; tolerance lets a day pack a little over (e.g. 1.10) so
  // travel + one more unit fits instead of spilling to the next day.
  const dayBudget = 1 + Math.max(0, input.dayFillTolerance ?? 0);

  // Per (team, date): remaining budget (dayBudget) and the day's travel state.
  const budget = new Map<string, Map<string, number>>();
  const state = new Map<string, Map<string, DayState>>();
  for (const t of teams) {
    const b = new Map<string, number>();
    const s = new Map<string, DayState>();
    for (const d of workingDays) {
      b.set(d, dayBudget);
      s.set(d, { sites: new Set(), coords: [], tourMin: 0 });
    }
    budget.set(t.id, b);
    state.set(t.id, s);
  }
  for (const c of input.committed ?? []) {
    const b = budget.get(c.teamId);
    if (b && b.has(c.date)) b.set(c.date, (b.get(c.date) ?? dayBudget) - c.cost);
  }

  const fleet: FleetCtx = {
    resources: input.resources ?? {},
    reservations: new Map(),
    placedByType: new Map(),
  };

  const baseToSiteMin = (team: ScheduleTeam, siteId: string): number => {
    const coord = siteCoords[siteId];
    if (team.baseCoord && coord) return kmToMinutes(haversineKm(team.baseCoord, coord), speed);
    return team.travelMinutesToSite[siteId] ?? 0;
  };

  const loadInWindow = (teamId: string, windowDays: string[]): number => {
    const b = budget.get(teamId)!;
    let load = 0;
    for (const d of windowDays) load += dayBudget - (b.get(d) ?? dayBudget);
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

    if (window.length === 0) {
      const pastDeadline =
        order.deliveryDate != null && firstDay != null && order.deliveryDate < firstDay;
      const reason = pastDeadline ? "past_deadline" : "not_ready";
      for (const l of order.lines) unplaced.push(u(order, l.orderLineId, l.quantity, reason));
      continue;
    }

    // Split the order's lines by the SET of teams that can install them. Lines
    // handled by the same crews stay together — one team owns them at the site,
    // spilling to a second only under deadline pressure. Lines needing DIFFERENT
    // crews (e.g. fire vs industrial) form separate groups that can run at the
    // same site in parallel: two teams share a site only when they're doing
    // different kinds of work, never two of the same crew (except under pressure).
    const groups = new Map<string, ScheduleLine[]>();
    for (const l of order.lines) {
      const key = teams
        .filter((t) => t.capableTypeIds.includes(l.type.id))
        .map((t) => t.id)
        .sort()
        .join(",");
      const arr = groups.get(key);
      if (arr) arr.push(l);
      else groups.set(key, [l]);
    }

    for (const groupLines of groups.values()) {
      const pool = teams.filter((t) => groupLines.every((l) => t.capableTypeIds.includes(l.type.id)));
      if (pool.length === 0) {
        for (const l of groupLines) unplaced.push(u(order, l.orderLineId, l.quantity, "no_team"));
        continue;
      }
      const remaining = new Map(groupLines.map((l) => [l.orderLineId, l.quantity] as const));
      const subOrder: ScheduleOrder = { ...order, lines: groupLines };
      const done = () => [...remaining.values()].every((r) => r <= 0);
      // Types like industrial/sectional let several teams share the site in
      // parallel; fire keeps one team unless the deadline forces a spill.
      const parallel = groupLines.every((l) => l.type.allowParallelTeams === true);

      // Fill this crew group: in-house first, then least-loaded, then nearest.
      const fill = (win: string[]) => {
        const ordered = [...pool].sort(
          (a, b) =>
            a.preferenceWeight - b.preferenceWeight ||
            loadInWindow(a.id, win) - loadInWindow(b.id, win) ||
            baseToSiteMin(a, order.siteId) - baseToSiteMin(b, order.siteId),
        );
        if (parallel) {
          // Work the teams concurrently, day by day, so the site finishes as
          // early as possible — two teams may share it without deadline pressure.
          for (const day of win) {
            for (const team of ordered) {
              if (done()) return;
              placeOrderOnTeam(
                subOrder, team, [day], remaining, shift, rules, hoursPerDay, budget,
                state.get(team.id)!, siteCoords, speed, fleet, dayBudget, assignments,
              );
            }
          }
        } else {
          // One team owns the site; spill to the next only under deadline pressure.
          for (const team of ordered) {
            if (done()) break;
            placeOrderOnTeam(
              subOrder, team, win, remaining, shift, rules, hoursPerDay, budget,
              state.get(team.id)!, siteCoords, speed, fleet, dayBudget, assignments,
            );
          }
        }
      };

      fill(window);
      // Deadline pressure overflow: place the remainder on LATER days (past the
      // deadline) instead of dropping it. These land after order.deliveryDate and
      // are flagged "late" on the board — better a late plan than a missing job.
      if (order.deliveryDate && [...remaining.values()].some((r) => r > 0)) {
        fill(workingDays.filter((d) => d >= order.earliestDate));
      }

      // Anything still remaining means the whole horizon is full for this group.
      for (const l of groupLines) {
        const rem = remaining.get(l.orderLineId) ?? 0;
        if (rem > 0) unplaced.push(u(order, l.orderLineId, rem, "no_capacity"));
      }
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
  fleet: FleetCtx,
  dayBudget: number,
  out: PlannedAssignment[],
): void {
  const b = budget.get(team.id)!;
  const siteCoord = siteCoords[order.siteId];
  const vehicleIds = team.vehicleIds ?? [];

  for (const date of window) {
    if (order.lines.every((l) => (remaining.get(l.orderLineId) ?? 0) <= 0)) break;

    // Headcount varies by day: subtract anyone on leave. Whole team off => skip.
    const headcount = team.headcount - (team.unavailableByDate?.[date] ?? 0);
    if (headcount <= 0) continue;

    const placed = placedMap(fleet, team.id, date);
    const st = teamState.get(date)!;
    let rem = b.get(date) ?? dayBudget;
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

      const maxByBudget = Math.floor((available + EPS) / unit);
      if (maxByBudget <= 0) {
        if (!overheadCharged) break; // can't even fit overhead + one unit today
        continue;
      }

      // Vehicle carrying capacity: cap this type's units/day to what the team's
      // truck can carry. Already-placed units of the type this day count.
      let maxUnits = maxByBudget;
      const cap = team.carryCapByType?.[line.type.id];
      const placedOfType = placed.get(line.type.id) ?? 0;
      if (cap !== undefined) maxUnits = Math.min(maxUnits, Math.max(0, cap - placedOfType));
      if (maxUnits <= 0) continue; // truck full for this type today; try other lines

      // Shared resource (e.g. a manlift for industrial doors): reserve one for
      // the team-day. If the pool is exhausted for the day, this type can't run.
      let reservedAsset: string | undefined;
      if (line.type.requiredResource) {
        const res = reserveResource(fleet, line.type.requiredResource, date, team.id);
        if (!res.ok) continue;
        reservedAsset = res.assetId;
      }

      const place = Math.min(r, maxUnits);
      const cost = place * unit + overhead;
      const assetIds = reservedAsset ? [...vehicleIds, reservedAsset] : [...vehicleIds];
      out.push({
        orderLineId: line.orderLineId,
        orderId: order.orderId,
        orderCode: order.orderCode,
        teamId: team.id,
        date,
        units: place,
        estimatedCost: cost,
        typeId: line.type.id,
        assetIds,
      });
      placed.set(line.type.id, placedOfType + place);
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
