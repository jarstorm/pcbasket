import { resolvePyramid, findDivisionOf, simulateBackgroundRound } from "../pyramid";
import { generateSchedule } from "../schedule";

function team(id, wins, overrides = {}) {
  return {
    id,
    name: id,
    stadium: { level: 1 },
    staff: {},
    roster: [],
    lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
    record: { wins, losses: 10 - wins, pointsFor: 0, pointsAgainst: 0 },
    ...overrides,
  };
}

function division(teams) {
  return {
    name: "test",
    teams,
    schedule: generateSchedule(teams.map((t) => t.id), true),
    round: 0,
    results: [],
    lastRoundResults: [],
  };
}

describe("resolvePyramid", () => {
  it("relegates the bottom team of a higher tier and promotes the top team of the tier below", () => {
    const divisions = {
      acb: division([team("acb1", 8), team("acb2", 1)]), // acb2 is last
      primerafeb: division([team("pf1", 9), team("pf2", 2)]), // pf1 is first
      segundafeb: division([team("sf1", 3), team("sf2", 0)]),
    };
    const resolved = resolvePyramid(divisions);
    expect(resolved.acb.teams.map((t) => t.id)).toContain("pf1");
    expect(resolved.acb.teams.map((t) => t.id)).not.toContain("acb2");
    expect(resolved.primerafeb.teams.map((t) => t.id)).toContain("acb2");
  });

  it("resets records and generates a fresh schedule for every division", () => {
    const divisions = {
      acb: division([team("acb1", 8), team("acb2", 1)]),
      primerafeb: division([team("pf1", 9), team("pf2", 2)]),
      segundafeb: division([team("sf1", 3), team("sf2", 0)]),
    };
    const resolved = resolvePyramid(divisions);
    for (const div of Object.values(resolved)) {
      expect(div.round).toBe(0);
      for (const t of div.teams) {
        expect(t.record.wins).toBe(0);
      }
    }
  });
});

describe("findDivisionOf", () => {
  it("finds which division currently holds a team id", () => {
    const divisions = {
      acb: division([team("acb1", 0)]),
      primerafeb: division([team("pf1", 0)]),
      segundafeb: division([team("sf1", 0)]),
    };
    expect(findDivisionOf(divisions, "pf1")).toBe("primerafeb");
    expect(findDivisionOf(divisions, "missing")).toBeNull();
  });
});

describe("simulateBackgroundRound", () => {
  it("advances the round and updates records without touching playersById", () => {
    const div = division([team("a", 0), team("b", 0)]);
    const next = simulateBackgroundRound(div, {});
    expect(next.round).toBe(1);
    const totalGames = next.teams.reduce((s, t) => s + t.record.wins + t.record.losses, 0);
    expect(totalGames).toBeGreaterThan(0);
  });

  it("is a no-op once that division's own season is already finished", () => {
    const div = { ...division([team("a", 0), team("b", 0)]), round: 999 };
    const next = simulateBackgroundRound(div, {});
    expect(next).toBe(div);
  });
});
