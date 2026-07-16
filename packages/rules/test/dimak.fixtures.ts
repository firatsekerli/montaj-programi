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

export const halfBlockSingleFire: WorkItemType = {
  id: "wit_half_single",
  code: "YARIM_BLOK_TEK_KANAT_YANGIN",
  capacityModel: "count",
  baseCapacity: { normal: 9, overtime: 12 },
};

export const fullFrameSingleFire: WorkItemType = {
  id: "wit_full_single",
  code: "TAM_KASA_TEK_KANAT_YANGIN",
  capacityModel: "count",
  baseCapacity: { normal: 7, overtime: 10 },
};

export const halfBlockDoubleFire: WorkItemType = {
  id: "wit_half_double",
  code: "YARIM_BLOK_CIFT_KANAT_YANGIN",
  capacityModel: "count",
  baseCapacity: { normal: 6, overtime: 9 },
};

export const fullFrameDoubleFire: WorkItemType = {
  id: "wit_full_double",
  code: "TAM_KASA_CIFT_KANAT_YANGIN",
  capacityModel: "count",
  baseCapacity: { normal: 5, overtime: 8 },
};

/**
 * Industrial door: effort-model. The spec gives "5x5 m = 1 day" as an anchor,
 * so a full-size unit costs a whole normal day (9 h). Smaller doors cost less
 * via a multiply_effort rule (see below).
 */
export const industrialDoor: WorkItemType = {
  id: "wit_industrial",
  code: "ENDUSTRIYEL",
  capacityModel: "effort",
  effort: { hoursPerUnit: 9 },
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

/** 3-person team installs ~1–2 more; encoded as +1.5 (tunable per tenant). */
export const teamOfThreeRule: CapacityRule = {
  id: "rule_team_of_three",
  name: "3 kişilik ekip (+1.5 adet)",
  enabled: true,
  priority: 30,
  condition: { all: [{ var: "team.headcount", op: ">=", value: 3 }] },
  effect: { op: "add_units", n: 1.5 },
};

/** Smaller industrial door (e.g. 3x3 m): ~3 in 2 days -> hours * 0.667. */
export const smallIndustrialRule: CapacityRule = {
  id: "rule_small_industrial",
  name: "Küçük endüstriyel kapı",
  enabled: true,
  priority: 10,
  condition: {
    all: [{ var: "line.area_m2", op: "<=", value: 9 }], // 3x3 m
  },
  effect: { op: "multiply_effort", factor: 2 / 3 },
};

export const dimakRules: CapacityRule[] = [
  oversizeRule,
  demolitionRule,
  teamOfThreeRule,
  smallIndustrialRule,
];
