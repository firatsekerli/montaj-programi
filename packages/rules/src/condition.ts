import type { Comparator, Condition, Facts } from "./types";

/**
 * Evaluate a serializable Condition against a flat Facts bag.
 *
 * Kept deliberately tiny and dependency-free. A missing variable evaluates to
 * `undefined`, which fails every comparison except `!=` — so rules never throw
 * on absent facts; they simply don't match.
 */
export function evaluate(condition: Condition | undefined, facts: Facts): boolean {
  if (!condition) return true; // no condition => always applies

  if ("all" in condition) return condition.all.every((c) => evaluate(c, facts));
  if ("any" in condition) return condition.any.some((c) => evaluate(c, facts));
  if ("not" in condition) return !evaluate(condition.not, facts);

  const actual = facts[condition.var];

  if (condition.op === "in") {
    return condition.value.some((v) => looseEquals(actual, v));
  }
  return compare(actual, condition.op, condition.value);
}

function compare(actual: unknown, op: Comparator, expected: unknown): boolean {
  switch (op) {
    case "==":
      return looseEquals(actual, expected);
    case "!=":
      return !looseEquals(actual, expected);
    case ">":
    case ">=":
    case "<":
    case "<=": {
      if (typeof actual !== "number" || typeof expected !== "number") return false;
      if (op === ">") return actual > expected;
      if (op === ">=") return actual >= expected;
      if (op === "<") return actual < expected;
      return actual <= expected;
    }
  }
}

function looseEquals(a: unknown, b: unknown): boolean {
  // Treat number/string/boolean by value; everything else by reference.
  return a === b;
}
