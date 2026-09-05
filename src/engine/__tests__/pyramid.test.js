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

// 6 teams, ranked by wins 6..1 so sortStandings order is predictable:
// t1 (champion, auto-promotes) > t2..t5 (playoff pool) > t6 (safe).
function rankedTeams(prefix) {
  return [6, 5, 4, 3, 2, 1].map((wins, i) => team(`${prefix}${i + 1}`, wins));
}

describe("resolvePyramid", () => {
  let randomSpy;

  afterEach(() => {
    if (randomSpy) randomSpy.mockRestore();
  });

  it("promotes the champion directly and the 2nd spot via a 2-5 playoff, relegates the bottom 2", () => {
    // Math.random() always below every favoriteEdge threshold used
    // (0.65 and 0.5) so every playoff game is won by the first/"higher
    // seed" argument — makes the whole bracket deterministic: seed2 beats
    // seed5, seed3 beats seed4, then seed2 beats seed3 in the final.
    randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.1);

    const divisions = {
      acb: division(rankedTeams("acb")),
      primerafeb: division(rankedTeams("pf")),
      segundafeb: division(rankedTeams("sf")),
    };
    const resolved = resolvePyramid(divisions);

    const acbIds = resolved.acb.teams.map((t) => t.id);
    // pf1 = champion (direct), pf2 = winner of the 2-5 playoff under this mock
    expect(acbIds).toContain("pf1");
    expect(acbIds).toContain("pf2");
    // bottom 2 of ACB (acb5, acb6) relegated out
    expect(acbIds).not.toContain("acb5");
    expect(acbIds).not.toContain("acb6");
    expect(resolved.acb.teams).toHaveLength(6);

    const primeraIds = resolved.primerafeb.teams.map((t) => t.id);
    expect(primeraIds).toContain("acb5");
    expect(primeraIds).toContain("acb6");
    expect(primeraIds).toContain("sf1");
    expect(primeraIds).toContain("sf2");
    expect(primeraIds).not.toContain("pf1");
    expect(primeraIds).not.toContain("pf2");
    expect(primeraIds).not.toContain("pf5");
    expect(primeraIds).not.toContain("pf6");
    expect(resolved.primerafeb.teams).toHaveLength(6);

    const segundaIds = resolved.segundafeb.teams.map((t) => t.id);
    expect(segundaIds).toContain("pf5");
    expect(segundaIds).toContain("pf6");
    expect(segundaIds).not.toContain("sf1");
    expect(segundaIds).not.toContain("sf2");
    expect(resolved.segundafeb.teams).toHaveLength(6);
  });

  it("the promotion playoff can go the other way for an underdog seed", () => {
    // Math.random() always above every threshold so the second argument
    // ("lower seed") wins every game instead.
    randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.9);

    const divisions = {
      acb: division(rankedTeams("acb")),
      primerafeb: division(rankedTeams("pf")),
      segundafeb: division(rankedTeams("sf")),
    };
    const resolved = resolvePyramid(divisions);
    const acbIds = resolved.acb.teams.map((t) => t.id);
    expect(acbIds).toContain("pf1"); // champion always promotes directly
    expect(acbIds).toContain("pf4"); // seed5 beats seed2, seed4 beats seed3, seed4 beats seed5
  });

  it("resets records and generates a fresh schedule for every division", () => {
    const divisions = {
      acb: division(rankedTeams("acb")),
      primerafeb: division(rankedTeams("pf")),
      segundafeb: division(rankedTeams("sf")),
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
