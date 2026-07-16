import { describe, expect, it } from "vitest";
import {
  dailyCapacity,
  dayUsage,
  isDayFeasible,
  unitsThatFit,
  type DayLoad,
} from "../src/index";
import {
  demolitionRule,
  dimakRules,
  dimakShift,
  fullFrameDoubleFire,
  fullFrameSingleFire,
  halfBlockDoubleFire,
  halfBlockSingleFire,
  industrialDoor,
  overtimeShift,
  teamOfThreeRule,
} from "./dimak.fixtures";

describe("Dimak capacity table (from the spec)", () => {
  const cases: Array<[string, typeof fullFrameSingleFire, number, number]> = [
    // [name, type, normalPerDay, overtimePerDay]
    ["Yarım/Blok Tek Kanat", halfBlockSingleFire, 9, 12],
    ["Tam Kasa Tek Kanat", fullFrameSingleFire, 7, 10],
    ["Yarım/Blok Çift Kanat", halfBlockDoubleFire, 6, 9],
    ["Tam Kasa Çift Kanat", fullFrameDoubleFire, 5, 8],
  ];

  for (const [name, type, normal, overtime] of cases) {
    it(`${name}: ${normal}/day normal, ${overtime}/day overtime`, () => {
      expect(dailyCapacity(type, dimakShift, dimakRules)).toBe(normal);
      expect(dailyCapacity(type, overtimeShift, dimakRules)).toBe(overtime);
    });
  }
});

describe("Modifier rules", () => {
  it("oversize (-20%) requires BOTH width>1150 AND height>2400", () => {
    // both exceeded -> 7 * 0.8 = 5.6
    expect(
      dailyCapacity(fullFrameSingleFire, dimakShift, dimakRules, {
        "line.leaf_width": 1200,
        "line.height": 2500,
      }),
    ).toBeCloseTo(5.6, 10);

    // only width exceeded -> no reduction, still 7
    expect(
      dailyCapacity(fullFrameSingleFire, dimakShift, dimakRules, {
        "line.leaf_width": 1200,
        "line.height": 2000,
      }),
    ).toBe(7);
  });

  it("demolition (-50%) halves the rate", () => {
    expect(
      dailyCapacity(fullFrameSingleFire, dimakShift, dimakRules, {
        "order.requires_demolition": true,
      }),
    ).toBeCloseTo(3.5, 10);
  });

  it("3-person team adds ~1.5 units", () => {
    expect(
      dailyCapacity(fullFrameSingleFire, dimakShift, dimakRules, {
        "team.headcount": 3,
      }),
    ).toBeCloseTo(8.5, 10);
  });

  it("modifiers stack: demolition then team-of-3 = 7*0.5 + 1.5 = 5", () => {
    expect(
      dailyCapacity(fullFrameSingleFire, dimakShift, [demolitionRule, teamOfThreeRule], {
        "order.requires_demolition": true,
        "team.headcount": 3,
      }),
    ).toBeCloseTo(5, 10);
  });
});

describe("Industrial door (effort model)", () => {
  it("full-size (5x5 m) consumes a whole normal day -> 1/day", () => {
    expect(dailyCapacity(industrialDoor, dimakShift, dimakRules, { "line.area_m2": 25 })).toBeCloseTo(
      1,
      10,
    );
  });

  it("small (3x3 m) is faster -> 1.5/day (matches '3 in 2 days')", () => {
    expect(dailyCapacity(industrialDoor, dimakShift, dimakRules, { "line.area_m2": 9 })).toBeCloseTo(
      1.5,
      10,
    );
  });
});

describe("Travel & site access reduce what fits in a day", () => {
  it("full single-leaf, no travel: 7 fit, 8 do not", () => {
    const base = (qty: number): DayLoad => ({
      shift: dimakShift,
      items: [{ type: fullFrameSingleFire, quantity: qty, facts: {} }],
      travelHours: 0,
      accessOverheadMinutes: 0,
    });
    expect(isDayFeasible(base(7), dimakRules)).toBe(true);
    expect(isDayFeasible(base(8), dimakRules)).toBe(false);
  });

  it("90 min travel eats into the day", () => {
    const withTravel = (qty: number): DayLoad => ({
      shift: dimakShift,
      items: [{ type: fullFrameSingleFire, quantity: qty, facts: {} }],
      travelHours: 1.5,
      accessOverheadMinutes: 0,
    });
    // 6 doors: 6/7 + 1.5/9 = 0.857 + 0.167 = 1.024 -> infeasible
    expect(isDayFeasible(withTravel(6), dimakRules)).toBe(false);
    // 5 doors: 5/7 + 0.167 = 0.881 -> feasible
    expect(isDayFeasible(withTravel(5), dimakRules)).toBe(true);
    expect(dayUsage(withTravel(6), dimakRules)).toBeCloseTo(6 / 7 + 1.5 / 9, 10);
  });

  it("unitsThatFit accounts for a 2h security entry (Roketsan/Aselsan)", () => {
    // Normal 9h day, 2h access overhead + 1h travel -> 6h left.
    // full single-leaf costs 1/7 day; 6h/9h = 0.667 of a day -> floor(0.667*7) = 4
    const n = unitsThatFit(fullFrameSingleFire, dimakShift, dimakRules, {}, {
      travelHours: 1,
      accessOverheadMinutes: 120,
    });
    expect(n).toBe(4);
  });
});
