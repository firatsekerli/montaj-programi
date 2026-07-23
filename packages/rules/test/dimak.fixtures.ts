/**
 * The Dimak specification, encoded entirely as DATA for the generic engine.
 *
 * Nothing here is special-cased in the engine — these are exactly the rows an
 * admin would create in the app for the Dimak tenant. The tests assert the
 * engine reproduces the numbers written in the original requirements PDF.
 */
import type { CapacityRule, ShiftContext, WorkItemType } from "../src/index";

export const dimakShift: ShiftContext = {
  overtime: false,
  normalShiftHours: 9,
  overtimeShiftHours: 12,
};

export const overtimeShift: ShiftContext = { ...dimakShift, overtime: true };

// ---- Work-item types (the capacity table in the spec) ----
// Base counts assume a 2-person crew; each extra person adds `perPersonBonus`
// units/day (fire doors +2, industrial +1 — from the spec).

export const halfBlockSingleFire: WorkItemType = {
  id: "wit_half_single",
  code: "YARIM_BLOK_TEK_KANAT_YANGIN",
  capacityModel: "count",
  baseCapacity: { normal: 9, overtime: 12 },
  crewBaseline: 2,
  perPersonBonus: 2,
};

export const fullFrameSingleFire: WorkItemType = {
  id: "wit_full_single",
  code: "TAM_KASA_TEK_KANAT_YANGIN",
  capacityModel: "count",
  baseCapacity: { normal: 7, overtime: 10 },
  crewBaseline: 2,
  perPersonBonus: 2,
};

export const halfBlockDoubleFire: WorkItemType = {
  id: "wit_half_double",
  code: "YARIM_BLOK_CIFT_KANAT_YANGIN",
  capacityModel: "count",
  baseCapacity: { normal: 6, overtime: 9 },
  crewBaseline: 2,
  perPersonBonus: 2,
};

export const fullFrameDoubleFire: WorkItemType = {
  id: "wit_full_double",
  code: "TAM_KASA_CIFT_KANAT_YANGIN",
  capacityModel: "count",
  baseCapacity: { normal: 5, overtime: 8 },
  crewBaseline: 2,
  perPersonBonus: 2,
};

/**
 * Industrial door: effort-model with CONTINUOUS sizing. The spec gives two
 * anchors — 5x5 m (25 m²) = 1 day (9 h), and 3x3 m (9 m²) = 3 in 2 days (6 h).
 * A line through those points is hours = 4.3125 + 0.1875 × area_m2, so time
 * scales smoothly with size instead of in buckets. A 3rd person adds +1/day.
 */
export const industrialDoor: WorkItemType = {
  id: "wit_industrial",
  code: "ENDUSTRIYEL",
  capacityModel: "effort",
  effort: { hoursPerUnit: 4.3125, perAttr: { attr: "line.area_m2", coefficient: 0.1875 } },
  crewBaseline: 2,
  perPersonBonus: 1,
  allowParallelTeams: true,
};

// ---- Capacity modifier rules (the "±%" bullet points in the spec) ----

/** Oversize: leaf width > 1150 mm AND height > 2400 mm -> -20%. */
export const oversizeRule: CapacityRule = {
  id: "rule_oversize",
  name: "Büyük kanat (-%20)",
  enabled: true,
  priority: 10,
  condition: {
    all: [
      { var: "line.leaf_width", op: ">", value: 1150 },
      { var: "line.height", op: ">", value: 2400 },
    ],
  },
  effect: { op: "multiply_capacity", factor: 0.8 },
};

/** Door removal + wall demolition -> -50%. */
export const demolitionRule: CapacityRule = {
  id: "rule_demolition",
  name: "Kapı sökme / duvar kırma (-%50)",
  enabled: true,
  priority: 20,
  condition: { all: [{ var: "order.requires_demolition", op: "==", value: true }] },
  effect: { op: "multiply_capacity", factor: 0.5 },
};

// Crew scaling is now a per-type property (crewBaseline + perPersonBonus), so
// the old global "3-person team +1.5" rule is gone — each type scales by its own
// per-person bonus (fire +2, industrial +1). Industrial sizing stays continuous
// (industrialDoor.effort.perAttr).

export const dimakRules: CapacityRule[] = [oversizeRule, demolitionRule];
