import { evaluate } from "./condition";
import type {
  CapacityRule,
  DayItem,
  DayLoad,
  Facts,
  ShiftContext,
  WorkItemType,
} from "./types";

/** Working hours available on a given day. */
export function shiftHours(shift: ShiftContext): number {
  return shift.overtime ? shift.overtimeShiftHours : shift.normalShiftHours;
}

function applicableRules(rules: CapacityRule[], facts: Facts): CapacityRule[] {
  return rules
    .filter((r) => r.enabled && evaluate(r.condition, facts))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Effective units-per-day for a COUNT-model type, after modifiers.
 *
 * rate = baseRate * Π(multiply_capacity factors) + Σ(add_units)
 *
 * Example (Dimak): full-frame single-leaf fire door = 7/day normal.
 *   oversize (-20%)   -> 7 * 0.8            = 5.6
 *   demolition (-50%) -> 7 * 0.5            = 3.5
 *   3-person team     -> 7 + 1.5            = 8.5
 */
export function effectiveRate(
  type: WorkItemType,
  shift: ShiftContext,
  rules: CapacityRule[],
  facts: Facts,
): number {
  if (type.capacityModel !== "count" || !type.baseCapacity) {
    throw new Error(`effectiveRate requires a count-model type with baseCapacity: ${type.code}`);
  }
  const base = shift.overtime ? type.baseCapacity.overtime : type.baseCapacity.normal;

  let factor = 1;
  let add = 0;
  for (const rule of applicableRules(rules, facts)) {
    if (rule.effect.op === "multiply_capacity") factor *= rule.effect.factor;
    else if (rule.effect.op === "add_units") add += rule.effect.n;
  }
  return Math.max(0, base * factor + add);
}

/** Effort hours to install one unit of an EFFORT-model type, after modifiers. */
export function effectiveEffortHours(
  type: WorkItemType,
  rules: CapacityRule[],
  facts: Facts,
): number {
  if (type.capacityModel !== "effort" || !type.effort) {
    throw new Error(`effectiveEffortHours requires an effort-model type with effort: ${type.code}`);
  }
  let hours = type.effort.hoursPerUnit;
  for (const rule of applicableRules(rules, facts)) {
    if (rule.effect.op === "multiply_effort") hours *= rule.effect.factor;
  }
  return Math.max(0, hours);
}

/**
 * Fraction of a team-day consumed by installing ONE unit of `type`.
 * Count model: 1 / effectiveRate. Effort model: hours / shiftHours.
 */
export function unitCostDays(
  type: WorkItemType,
  shift: ShiftContext,
  rules: CapacityRule[],
  facts: Facts,
): number {
  if (type.capacityModel === "count") {
    const rate = effectiveRate(type, shift, rules, facts);
    return rate > 0 ? 1 / rate : Number.POSITIVE_INFINITY;
  }
  return effectiveEffortHours(type, rules, facts) / shiftHours(shift);
}

/**
 * How many whole units of `type` fit in a full day with no travel — the number
 * that appears in a capacity table. For count model this equals effectiveRate.
 */
export function dailyCapacity(
  type: WorkItemType,
  shift: ShiftContext,
  rules: CapacityRule[],
  facts: Facts = {},
): number {
  const cost = unitCostDays(type, shift, rules, facts);
  return Number.isFinite(cost) && cost > 0 ? 1 / cost : 0;
}

/**
 * Total fraction of the day a planned load consumes, including travel and
 * per-site access overhead. Feasible when this is <= 1.
 */
export function dayUsage(day: DayLoad, rules: CapacityRule[]): number {
  const hours = shiftHours(day.shift);
  let usage = day.travelHours / hours + day.accessOverheadMinutes / 60 / hours;
  for (const item of day.items) {
    usage += item.quantity * unitCostDays(item.type, day.shift, rules, item.facts);
  }
  return usage;
}

const EPSILON = 1e-9;

/** Whether a day's planned load fits within the shift budget. */
export function isDayFeasible(day: DayLoad, rules: CapacityRule[]): boolean {
  return dayUsage(day, rules) <= 1 + EPSILON;
}

/**
 * Given fixed overhead (travel + access) and a single item type, how many units
 * of that type still fit in the day. Useful for "this site is 90 min away, how
 * many can we install?" answers.
 */
export function unitsThatFit(
  type: WorkItemType,
  shift: ShiftContext,
  rules: CapacityRule[],
  facts: Facts,
  overhead: { travelHours: number; accessOverheadMinutes: number },
): number {
  const hours = shiftHours(shift);
  const overheadFraction =
    overhead.travelHours / hours + overhead.accessOverheadMinutes / 60 / hours;
  const remaining = 1 - overheadFraction;
  if (remaining <= 0) return 0;
  const cost = unitCostDays(type, shift, rules, facts);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  return Math.floor((remaining + EPSILON) / cost);
}

export type { DayItem };
