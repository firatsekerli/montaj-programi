import { describe, expect, it } from "vitest";
import { schedule, type ScheduleOrder, type ScheduleTeam } from "../src/index";
import { dimakRules, dimakShift, fullFrameSingleFire, industrialDoor } from "./dimak.fixtures";

// Two weeks of Mon–Fri working days.
const HORIZON = [
  "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
  "2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16",
];

function team(overrides: Partial<ScheduleTeam> = {}): ScheduleTeam {
  return {
    id: "team-1",
    name: "Team 1",
    headcount: 2,
    isSubcontractor: false,
    preferenceWeight: 10,
    capableTypeIds: [fullFrameSingleFire.id],
    travelMinutesToSite: {},
    ...overrides,
  };
}

function order(overrides: Partial<ScheduleOrder> = {}): ScheduleOrder {
  return {
    orderId: "o1",
    orderCode: "SIP-1001",
    siteId: "site-1",
    accessOverheadMinutes: 0,
    lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 12, facts: {} }],
    earliestDate: "2026-01-05",
    deliveryDate: "2026-01-16",
    ...overrides,
  };
}

describe("delivery-driven scheduler", () => {
  it("schedules an order within its delivery window (7/day → 12 = 2 days)", () => {
    const { assignments, unplaced } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team()],
      orders: [order()],
    });
    expect(unplaced).toHaveLength(0);
    expect(assignments.reduce((s, a) => s + a.units, 0)).toBe(12);
    // stays on one team
    expect(new Set(assignments.map((a) => a.teamId)).size).toBe(1);
    // all inside the window
    expect(assignments.every((a) => a.date >= "2026-01-05" && a.date <= "2026-01-16")).toBe(true);
  });

  it("keeps one team per site when a single team is capable of all lines", () => {
    // SIP-1002: industrial + fire, Kazım can do both; Erkan only fire.
    const kazim = team({
      id: "kazim",
      capableTypeIds: [industrialDoor.id, fullFrameSingleFire.id],
    });
    const erkan = team({ id: "erkan", capableTypeIds: [fullFrameSingleFire.id] });
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [erkan, kazim],
      orders: [
        order({
          orderCode: "SIP-1002",
          lines: [
            { orderLineId: "ind", type: industrialDoor, quantity: 1, facts: { "line.area_m2": 25 } },
            { orderLineId: "fire", type: fullFrameSingleFire, quantity: 3, facts: {} },
          ],
        }),
      ],
    });
    // whole order handled by the one team capable of both types
    expect(new Set(assignments.map((a) => a.teamId))).toEqual(new Set(["kazim"]));
  });

  it("does NOT plan before the earliest (production-due) date", () => {
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team()],
      orders: [order({ earliestDate: "2026-01-12" })],
    });
    expect(assignments.every((a) => a.date >= "2026-01-12")).toBe(true);
  });

  it("spills to a second team only under deadline pressure", () => {
    // 60 fire doors due in one week: one team (7/day×5=35) can't finish → 2nd team.
    const a = team({ id: "A" });
    const b = team({ id: "B" });
    const week1 = HORIZON.slice(0, 5);
    const { assignments, unplaced } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [a, b],
      orders: [
        order({
          lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 60, facts: {} }],
          earliestDate: week1[0]!,
          deliveryDate: week1[week1.length - 1]!,
        }),
      ],
    });
    expect(new Set(assignments.map((x) => x.teamId))).toEqual(new Set(["A", "B"]));
    // 2 teams × 35/week = 70 capacity ≥ 60 → nothing unplaced
    expect(unplaced).toHaveLength(0);
  });

  it("flags orders that can't finish by their deadline", () => {
    // 100 doors due in one week; even 1 team over 5 days = 35 → rest unplaced.
    const week1 = HORIZON.slice(0, 5);
    const { unplaced } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team()],
      orders: [
        order({
          lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 100, facts: {} }],
          earliestDate: week1[0]!,
          deliveryDate: week1[week1.length - 1]!,
        }),
      ],
    });
    expect(unplaced.some((x) => x.reason === "no_capacity")).toBe(true);
  });

  it("skips a day when the whole team is on leave", () => {
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team({ unavailableByDate: { "2026-01-05": 2 } })], // both members off day 1
      orders: [order({ lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 7, facts: {} }] })],
    });
    expect(assignments.every((a) => a.date >= "2026-01-06")).toBe(true);
  });

  it("honors a per-team daily-cap override (subcontractor 2/day)", () => {
    // Industrial normally ~1/day for a 5x5; Faruk's override fits 2 in a day.
    const faruk = team({
      id: "faruk",
      capableTypeIds: [industrialDoor.id],
      dailyCapOverride: { [industrialDoor.id]: 2 },
    });
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [faruk],
      orders: [
        order({
          orderCode: "SIP-IND",
          lines: [{ orderLineId: "l1", type: industrialDoor, quantity: 2, facts: { "line.area_m2": 25 } }],
        }),
      ],
    });
    const day1 = assignments.filter((a) => a.date === "2026-01-05");
    expect(day1.reduce((s, a) => s + a.units, 0)).toBe(2); // both fit on one day
  });

  it("respects committed load from started jobs (no double-booking)", () => {
    // team fully committed on day 1 → order starts day 2.
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team()],
      orders: [order({ lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 7, facts: {} }] })],
      committed: [{ teamId: "team-1", date: "2026-01-05", cost: 1 }],
    });
    expect(assignments.every((a) => a.date >= "2026-01-06")).toBe(true);
  });
});
