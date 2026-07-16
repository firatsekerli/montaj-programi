import { describe, expect, it } from "vitest";
import { schedule, type ScheduleItem, type ScheduleTeam } from "../src/index";
import { dimakRules, dimakShift, fullFrameSingleFire } from "./dimak.fixtures";

const WEEK = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]; // Mon–Fri

function team(overrides: Partial<ScheduleTeam> = {}): ScheduleTeam {
  return {
    id: "team-1",
    name: "Team 1",
    headcount: 2, // avoid the 3-person +1.5 rule so the rate stays 7
    isSubcontractor: false,
    preferenceWeight: 10,
    capableTypeIds: [fullFrameSingleFire.id],
    travelMinutesToSite: {},
    ...overrides,
  };
}

function item(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    orderLineId: "line-1",
    orderId: "order-1",
    orderCode: "SIP-1001",
    siteId: "site-1",
    accessOverheadMinutes: 0,
    type: fullFrameSingleFire,
    quantity: 12,
    facts: {},
    productionReadyDate: null,
    priority: 1,
    ...overrides,
  };
}

describe("scheduler", () => {
  it("splits a 12-door line across days at 7/day (7 then 5)", () => {
    const { assignments, unplaced } = schedule({
      weekDays: WEEK,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team()],
      items: [item()],
    });
    expect(unplaced).toHaveLength(0);
    expect(assignments).toHaveLength(2);
    expect(assignments[0]).toMatchObject({ date: WEEK[0], units: 7 });
    expect(assignments[1]).toMatchObject({ date: WEEK[1], units: 5 });
    expect(assignments.reduce((s, a) => s + a.units, 0)).toBe(12);
  });

  it("travel time reduces how many fit on the first day", () => {
    // 90 min round trip on a 9h day => 0.1667 overhead; 7 doors, unit=1/7.
    // day1 fits floor((1-0.1667)/0.1429)=5, day2 the remaining 2.
    const { assignments } = schedule({
      weekDays: WEEK,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team({ travelMinutesToSite: { "site-1": 90 } })],
      items: [item({ quantity: 7 })],
    });
    expect(assignments[0]).toMatchObject({ date: WEEK[0], units: 5 });
    expect(assignments[1]).toMatchObject({ date: WEEK[1], units: 2 });
  });

  it("marks items unplaced when no team has the capability", () => {
    const { assignments, unplaced } = schedule({
      weekDays: WEEK,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team({ capableTypeIds: ["some-other-type"] })],
      items: [item({ quantity: 3 })],
    });
    expect(assignments).toHaveLength(0);
    expect(unplaced[0]).toMatchObject({ reason: "no_team", remaining: 3 });
  });

  it("does not schedule before production is ready", () => {
    const { assignments, unplaced } = schedule({
      weekDays: WEEK,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team()],
      items: [item({ quantity: 5, productionReadyDate: "2026-02-01" })],
    });
    expect(assignments).toHaveLength(0);
    expect(unplaced[0]).toMatchObject({ reason: "not_ready" });
  });

  it("prefers in-house (lower weight) over subcontractor", () => {
    const inhouse = team({ id: "in", preferenceWeight: 10 });
    const sub = team({ id: "sub", preferenceWeight: 100, isSubcontractor: true });
    const { assignments } = schedule({
      weekDays: WEEK,
      shift: dimakShift,
      rules: dimakRules,
      teams: [sub, inhouse],
      items: [item({ quantity: 3 })],
    });
    expect(assignments.every((a) => a.teamId === "in")).toBe(true);
  });
});
