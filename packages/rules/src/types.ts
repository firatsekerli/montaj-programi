/**
 * Core types for the capacity rules engine.
 *
 * This package is intentionally PURE: data in -> numbers out. It knows nothing
 * about doors, databases, HTTP, or tenants. Every domain specific fact (a
 * "fire door", the "-20% oversize" rule, the "9h vs 12h" shift) is passed in as
 * data. That is what makes the app universal — a new company is just different
 * data fed to the same engine.
 */

/** How a work-item type's capacity is expressed. */
export type CapacityModel =
  /** A flat "units per day" rate (e.g. 7 fire doors/day). */
  | "count"
  /** Install time scales with the item (e.g. an industrial door sized by m²). */
  | "effort";

export interface WorkItemType {
  id: string;
  code: string;
  capacityModel: CapacityModel;
  /** Required when capacityModel === "count": units installable in a full day. */
  baseCapacity?: { normal: number; overtime: number };
  /**
   * Required when capacityModel === "effort": hours to install one unit.
   * `perAttr` scales hours linearly with an attribute (continuous sizing), e.g.
   * industrial door hours = hoursPerUnit + coefficient × area_m2.
   */
  effort?: {
    hoursPerUnit: number;
    perAttr?: { attr: string; coefficient: number };
  };
}

export interface ShiftContext {
  /** Whether this is an overtime day. */
  overtime: boolean;
  /** Length of a normal working day, in hours (Dimak: 9). */
  normalShiftHours: number;
  /** Length of an overtime working day, in hours (Dimak: 12). */
  overtimeShiftHours: number;
}

/**
 * A flat bag of facts a rule condition can test. Keys are namespaced strings,
 * e.g. "line.leaf_width", "order.requires_demolition", "team.headcount",
 * "day.overtime". Values are whatever the caller merged in from the entities.
 */
export type Facts = Record<string, unknown>;

export type Comparator = "==" | "!=" | ">" | ">=" | "<" | "<=";

/** A small, serializable condition language (stored as JSONB in the DB). */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { var: string; op: Comparator; value: unknown }
  | { var: string; op: "in"; value: unknown[] };

/** What a rule does to capacity when its condition matches. */
export type RuleEffect =
  /** Multiply the count-model rate (e.g. 0.8 = -20%). */
  | { op: "multiply_capacity"; factor: number }
  /** Add to the count-model rate (e.g. +1.5 doors for a 3-person team). */
  | { op: "add_units"; n: number }
  /** Multiply the effort-model hours-per-unit (e.g. 0.667 for a smaller door). */
  | { op: "multiply_effort"; factor: number };

export interface CapacityRule {
  id: string;
  name: string;
  enabled: boolean;
  /** Lower numbers evaluate first; only affects deterministic ordering. */
  priority: number;
  /** Omit for a rule that always applies. */
  condition?: Condition;
  effect: RuleEffect;
}

/** One line of work planned for a team on a day. */
export interface DayItem {
  type: WorkItemType;
  quantity: number;
  /** Facts describing this item/order/team, used to evaluate rules. */
  facts: Facts;
}

/** Everything a team is asked to do on a single day. */
export interface DayLoad {
  shift: ShiftContext;
  items: DayItem[];
  /** Total driving time for the day, in hours (base -> sites -> back). */
  travelHours: number;
  /** Sum of per-site access overhead for the day, in minutes (e.g. security). */
  accessOverheadMinutes: number;
}
