import { describe, expect, it } from "vitest";
import { schedule, type ScheduleOrder, type ScheduleTeam, type WorkItemType } from "../src/index";
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

  it("lets different crews share a site (fire vs industrial run in parallel)", () => {
    // SIP-1002: 1 industrial + 3 fire at one site. Kazım does both; Erkan only
    // fire. Industrial can only go to Kazım; fire prefers the idle fire crew
    // (Erkan) — so both crews work the site at once instead of Kazım doing all.
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
    const indTeams = new Set(assignments.filter((a) => a.orderLineId === "ind").map((a) => a.teamId));
    const fireTeams = new Set(assignments.filter((a) => a.orderLineId === "fire").map((a) => a.teamId));
    expect(indTeams).toEqual(new Set(["kazim"])); // only Kazım can do industrial
    expect(fireTeams).toEqual(new Set(["erkan"])); // fire goes to the idle fire crew
  });

  it("lets two industrial crews share a site in parallel without deadline pressure", () => {
    // 6 industrial doors at one site, comfortable deadline, two industrial crews.
    // Industrial allows parallel teams → both crews work the site concurrently,
    // finishing sooner instead of one crew doing all six over more days.
    const a = team({ id: "A", capableTypeIds: [industrialDoor.id] });
    const b = team({ id: "B", capableTypeIds: [industrialDoor.id] });
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [a, b],
      orders: [
        order({
          orderCode: "SIP-IND",
          lines: [{ orderLineId: "l1", type: industrialDoor, quantity: 6, facts: { "line.area_m2": 25 } }],
        }),
      ],
    });
    expect(new Set(assignments.map((x) => x.teamId))).toEqual(new Set(["A", "B"]));
    expect(assignments.reduce((s, x) => s + x.units, 0)).toBe(6);
  });

  it("does NOT put two of the same crew on one site unless under deadline pressure", () => {
    // 8 fire doors, comfortable deadline, two fire crews. One crew alone fits
    // (7/day×many days), so the site stays single-crew — no needless second team.
    const a = team({ id: "A", capableTypeIds: [fullFrameSingleFire.id] });
    const b = team({ id: "B", capableTypeIds: [fullFrameSingleFire.id] });
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [a, b],
      orders: [order({ lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 8, facts: {} }] })],
    });
    expect(new Set(assignments.map((x) => x.teamId)).size).toBe(1);
  });

  it("starts with the site nearest the base when deadlines tie", () => {
    // Two orders share the same window; NEAR is next to the base, FAR is ~80 km
    // out. Even though FAR sorts first by code, NEAR (closer) is scheduled first
    // and gets the earlier day.
    const base = { lat: 39.95, lon: 32.85 };
    const near = { lat: 39.96, lon: 32.86 };
    const far = { lat: 39.4, lon: 32.2 };
    const days = HORIZON.slice(0, 2);
    const { assignments } = schedule({
      workingDays: days,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team({ baseCoord: base })],
      siteCoords: { NEAR: near, FAR: far },
      orders: [
        order({ orderId: "far", orderCode: "AAA", siteId: "FAR", earliestDate: days[0]!, deliveryDate: days[1]!,
          lines: [{ orderLineId: "f", type: fullFrameSingleFire, quantity: 3, facts: {} }] }),
        order({ orderId: "near", orderCode: "ZZZ", siteId: "NEAR", earliestDate: days[0]!, deliveryDate: days[1]!,
          lines: [{ orderLineId: "n", type: fullFrameSingleFire, quantity: 6, facts: {} }] }),
      ],
    });
    const first = (id: string) =>
      Math.min(...assignments.filter((a) => a.orderId === id).map((a) => days.indexOf(a.date)));
    // NEAR (6 doors) fills day 0; FAR's long round trip won't fit alongside it,
    // so FAR moves to day 1 — proving the closer order was scheduled first.
    expect(first("near")).toBeLessThan(first("far"));
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

  it("places deadline overflow on later days instead of dropping it", () => {
    // 60 fire doors due in week 1 for ONE team (7/day×5 = 35 < 60). The overflow
    // now lands in week 2 (past the deadline) rather than going unplaced.
    const week1End = HORIZON[4]!;
    const { assignments, unplaced } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team()],
      orders: [
        order({
          lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 60, facts: {} }],
          earliestDate: HORIZON[0]!,
          deliveryDate: week1End,
        }),
      ],
    });
    // one team over two weeks = 7×10 = 70 ≥ 60 → everything placed, nothing dropped
    expect(assignments.reduce((s, a) => s + a.units, 0)).toBe(60);
    expect(unplaced).toHaveLength(0);
    // and some of it is necessarily after the deadline
    expect(assignments.some((a) => a.date > week1End)).toBe(true);
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

  it("charges intra-day travel between two sites (not two full round-trips)", () => {
    // One team, one day, two nearby sites. The day's travel should be the tour
    // base→A→B→base, so a second small order at B costs far less than a fresh
    // base round-trip — proving intra-day site-to-site travel.
    const base = { lat: 39.95, lon: 32.85 };
    const A = { lat: 39.96, lon: 32.86 };
    const B = { lat: 39.961, lon: 32.861 }; // right next to A
    const single = HORIZON.slice(0, 1); // just day 1
    const { assignments } = schedule({
      workingDays: single,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team({ baseCoord: base })],
      siteCoords: { A, B },
      avgSpeedKmh: 55,
      orders: [
        order({ orderCode: "SIP-A", siteId: "A", earliestDate: single[0]!, deliveryDate: single[0]!,
          lines: [{ orderLineId: "la", type: fullFrameSingleFire, quantity: 1, facts: {} }] }),
        order({ orderCode: "SIP-B", siteId: "B", earliestDate: single[0]!, deliveryDate: single[0]!,
          lines: [{ orderLineId: "lb", type: fullFrameSingleFire, quantity: 1, facts: {} }] }),
      ],
    });
    const costA = assignments.find((a) => a.orderCode === "SIP-A")!.estimatedCost;
    const costB = assignments.find((a) => a.orderCode === "SIP-B")!.estimatedCost;
    // Both installed the same day; B (adjacent to A) adds only a tiny detour.
    expect(assignments.every((a) => a.date === single[0])).toBe(true);
    expect(costB).toBeLessThan(costA); // B's incremental travel << A's base trip
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

describe("fleet enforcement", () => {
  it("caps a type's units/day to what the team's truck carries", () => {
    // Engine rate is 7/day, but the truck only carries 4 fire doors/day.
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team({ carryCapByType: { [fullFrameSingleFire.id]: 4 } })],
      orders: [order({ lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 12, facts: {} }] })],
    });
    // No single day exceeds the truck's 4-door limit.
    const perDay = new Map<string, number>();
    for (const a of assignments) perDay.set(a.date, (perDay.get(a.date) ?? 0) + a.units);
    expect([...perDay.values()].every((n) => n <= 4)).toBe(true);
    // Still finishes all 12 (over more days).
    expect(assignments.reduce((s, a) => s + a.units, 0)).toBe(12);
  });

  it("limits how many teams install a manlift type in parallel to the pool size", () => {
    // Industrial needs a manlift; only ONE manlift exists → at most one team can
    // install industrial on any given day, even with two capable teams.
    const industrialManlift: WorkItemType = { ...industrialDoor, requiredResource: "manlift" };
    const A = team({ id: "A", capableTypeIds: [industrialManlift.id] });
    const B = team({ id: "B", capableTypeIds: [industrialManlift.id] });
    const week1 = HORIZON.slice(0, 5);
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [A, B],
      resources: { manlift: ["manlift-1"] },
      orders: [
        order({ orderId: "o1", orderCode: "SIP-A", siteId: "sA",
          lines: [{ orderLineId: "a", type: industrialManlift, quantity: 3, facts: { "line.area_m2": 25 } }],
          earliestDate: week1[0]!, deliveryDate: week1[week1.length - 1]! }),
        order({ orderId: "o2", orderCode: "SIP-B", siteId: "sB",
          lines: [{ orderLineId: "b", type: industrialManlift, quantity: 3, facts: { "line.area_m2": 25 } }],
          earliestDate: week1[0]!, deliveryDate: week1[week1.length - 1]! }),
      ],
    });
    // Each day, at most one team runs industrial (one manlift to share).
    const teamsPerDay = new Map<string, Set<string>>();
    for (const a of assignments) {
      const s = teamsPerDay.get(a.date) ?? new Set();
      s.add(a.teamId);
      teamsPerDay.set(a.date, s);
    }
    expect([...teamsPerDay.values()].every((s) => s.size <= 1)).toBe(true);
    // The single manlift is committed on every industrial assignment.
    expect(assignments.every((a) => a.assetIds.includes("manlift-1"))).toBe(true);
  });

  it("commits the team's vehicles (and a reserved resource) on each assignment", () => {
    const industrialManlift: WorkItemType = { ...industrialDoor, requiredResource: "manlift" };
    const { assignments } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team({ id: "kazim", capableTypeIds: [industrialManlift.id], vehicleIds: ["truck-1"] })],
      resources: { manlift: ["manlift-1", "manlift-2"] },
      orders: [
        order({ orderCode: "SIP-IND",
          lines: [{ orderLineId: "l1", type: industrialManlift, quantity: 1, facts: { "line.area_m2": 25 } }] }),
      ],
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.assetIds).toEqual(["truck-1", "manlift-1"]);
  });

  it("lets an overpack tolerance fit one more unit per day", () => {
    // 7/day fire door, single site with a base→site round trip. Without
    // tolerance, travel pushes the 7th door to the next day (6/day). A 10%
    // tolerance lets the day pack to 110%, so all 7 fit in one day.
    const base = { lat: 39.95, lon: 32.85 };
    const S = { lat: 39.99, lon: 32.9 }; // a few km out → a real round trip
    const oneDay = HORIZON.slice(0, 1);
    const mk = (tol: number) =>
      schedule({
        workingDays: oneDay,
        shift: dimakShift,
        rules: dimakRules,
        teams: [team({ baseCoord: base })],
        siteCoords: { S },
        dayFillTolerance: tol,
        orders: [
          order({ siteId: "S", earliestDate: oneDay[0]!, deliveryDate: oneDay[0]!,
            lines: [{ orderLineId: "l1", type: fullFrameSingleFire, quantity: 7, facts: {} }] }),
        ],
      });
    const without = mk(0).assignments.reduce((s, a) => s + a.units, 0);
    const withTol = mk(0.1).assignments.reduce((s, a) => s + a.units, 0);
    expect(without).toBeLessThan(7); // travel bumps the last door to a later day
    expect(withTol).toBe(7); // the tolerance absorbs travel + the 7th door
  });

  it("does not enforce a required resource when no pool is configured", () => {
    // requiredResource set but caller passed no resources → pre-fleet behavior.
    const industrialManlift: WorkItemType = { ...industrialDoor, requiredResource: "manlift" };
    const { assignments, unplaced } = schedule({
      workingDays: HORIZON,
      shift: dimakShift,
      rules: dimakRules,
      teams: [team({ id: "kazim", capableTypeIds: [industrialManlift.id] })],
      orders: [
        order({ orderCode: "SIP-IND",
          lines: [{ orderLineId: "l1", type: industrialManlift, quantity: 1, facts: { "line.area_m2": 25 } }] }),
      ],
    });
    expect(unplaced).toHaveLength(0);
    expect(assignments.reduce((s, a) => s + a.units, 0)).toBe(1);
  });
});
