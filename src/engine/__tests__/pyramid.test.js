import { resolvePyramid, findGroupOf, simulateBackgroundRound } from "../pyramid";
import { generateSchedule } from "../schedule";

function team(id, wins, losses) {
  return {
    id,
    name: id,
    stadium: { level: 1 },
    staff: {},
    roster: [],
    lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
    record: { wins, losses, pointsFor: 0, pointsAgainst: 0 },
  };
}

function group(id, teams) {
  return {
    id,
    teams,
    schedule: generateSchedule(teams.map((t) => t.id), true),
    round: 0,
    results: [],
    lastRoundResults: [],
  };
}

function division(name, groups) {
  return { name, groups };
}

// acb1..acb6, ranked by wins descending (acb1 best, acb6 worst).
function acbFixture() {
  return division("ACB", [group("main", [6, 5, 4, 3, 2, 1].map((w, i) => team(`acb${i + 1}`, w, 10 - w)))]);
}

// pf1..pf12, ranked by wins descending. Promotion needs pos1 (direct) +
// pos2-9 (8-team pool); relegation needs the bottom 3 (pos10-12) — 12 teams
// keeps those two zones non-overlapping.
function primeraFixture() {
  return division("Primera FEB", [group("main", Array.from({ length: 12 }, (_, i) => team(`pf${i + 1}`, 12 - i, i)))]);
}

// 2 groups (este/oeste) of 10 each. Promotion needs pos1 (direct) + pos2-5
// (pool) per group; relegation needs the bottom 3 per group — 10 keeps
// pos6-7 as an untouched buffer between the two zones.
function segundaFixture() {
  const makeGroup = (id, prefix) => group(id, Array.from({ length: 10 }, (_, i) => team(`${prefix}${i + 1}`, 10 - i, i)));
  return division("Segunda FEB", [makeGroup("este", "se"), makeGroup("oeste", "oe")]);
}

// 10 groups of 3. Only each group's champion (pos1) matters for promotion
// (top-2 direct, next 8 knockout to 4 survivors); Tercera FEB has no
// relegation. Champion win% is set strictly decreasing by group number
// (20-g wins out of 20) so crossGroupRank order across groups is
// unambiguous; teammates' records don't matter.
function terceraFixture() {
  const groups = [];
  for (let g = 1; g <= 10; g++) {
    const champion = team(`g${g}champ`, 20 - g, g);
    const mates = [team(`g${g}b`, 0, 1), team(`g${g}c`, 0, 1)];
    groups.push(group(`g${g}`, [champion, ...mates]));
  }
  return division("Tercera FEB", groups);
}

function fullPyramid() {
  return {
    acb: acbFixture(),
    primerafeb: primeraFixture(),
    segundafeb: segundaFixture(),
    tercerafeb: terceraFixture(),
  };
}

function teamIds(division) {
  return division.groups.flatMap((g) => g.teams.map((t) => t.id));
}

describe("resolvePyramid", () => {
  let randomSpy;

  afterEach(() => {
    if (randomSpy) randomSpy.mockRestore();
  });

  it("resolves every boundary and conserves each division's total team count", () => {
    // Math.random() always below every favoriteEdge threshold (0.65) so
    // singleGameWinner always returns its first ("better seed") argument —
    // makes every knockout deterministic.
    randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.1);

    const divisions = fullPyramid();
    const before = Object.fromEntries(Object.entries(divisions).map(([id, d]) => [id, teamIds(d).length]));
    const resolved = resolvePyramid(divisions);

    for (const id of Object.keys(divisions)) {
      expect(teamIds(resolved[id])).toHaveLength(before[id]);
    }

    // ACB: relegates bottom 2, receives Primera FEB's 2 promoted.
    const acbIds = teamIds(resolved.acb);
    expect(acbIds).not.toContain("acb5");
    expect(acbIds).not.toContain("acb6");
    expect(acbIds).toContain("pf1"); // direct
    expect(acbIds).toContain("pf2"); // best remaining seed always wins the 2-9 pool under this mock

    // Primera FEB: relegates bottom 3, receives ACB's 2 relegated + Segunda
    // FEB's 3 promoted.
    const primeraIds = teamIds(resolved.primerafeb);
    expect(primeraIds).not.toContain("pf1");
    expect(primeraIds).not.toContain("pf2");
    expect(primeraIds).not.toContain("pf10");
    expect(primeraIds).not.toContain("pf11");
    expect(primeraIds).not.toContain("pf12");
    expect(primeraIds).toContain("acb5");
    expect(primeraIds).toContain("acb6");
    expect(primeraIds).toContain("se1"); // each group's champion promotes direct
    expect(primeraIds).toContain("oe1");
    expect(primeraIds).toContain("se2"); // best remaining pos2-5 seed wins the 3rd-spot playoff

    // Segunda FEB: relegates bottom 3 of each group, receives Primera FEB's
    // 3 relegated + Tercera FEB's 6 promoted.
    const segundaIds = teamIds(resolved.segundafeb);
    expect(segundaIds).not.toContain("se1");
    expect(segundaIds).not.toContain("oe1");
    for (const id of ["se8", "se9", "se10", "oe8", "oe9", "oe10"]) expect(segundaIds).not.toContain(id);
    for (const id of ["pf10", "pf11", "pf12"]) expect(segundaIds).toContain(id);
    for (const id of ["g1champ", "g2champ", "g3champ", "g4champ", "g5champ", "g6champ"]) {
      expect(segundaIds).toContain(id);
    }
    for (const id of ["g7champ", "g8champ", "g9champ", "g10champ"]) expect(segundaIds).not.toContain(id);

    // Tercera FEB: no relegation, receives Segunda FEB's 6 relegated.
    const terceraIds = teamIds(resolved.tercerafeb);
    for (const id of ["se8", "se9", "se10", "oe8", "oe9", "oe10"]) expect(terceraIds).toContain(id);
  });

  it("resets records and generates a fresh schedule for every group", () => {
    const resolved = resolvePyramid(fullPyramid());
    for (const div of Object.values(resolved)) {
      for (const g of div.groups) {
        expect(g.round).toBe(0);
        expect(g.results).toEqual([]);
        for (const t of g.teams) expect(t.record.wins).toBe(0);
      }
    }
  });
});

describe("findGroupOf", () => {
  it("finds which division and group currently hold a team id", () => {
    const divisions = { acb: acbFixture(), primerafeb: primeraFixture(), segundafeb: segundaFixture() };
    expect(findGroupOf(divisions, "pf1")).toEqual({ divisionId: "primerafeb", groupId: "main" });
    expect(findGroupOf(divisions, "oe3")).toEqual({ divisionId: "segundafeb", groupId: "oeste" });
    expect(findGroupOf(divisions, "missing")).toBeNull();
  });
});

describe("simulateBackgroundRound", () => {
  it("advances the round and updates records without touching playersById", () => {
    const g = group("main", [team("a", 0, 0), team("b", 0, 0)]);
    const next = simulateBackgroundRound(g, {});
    expect(next.round).toBe(1);
    const totalGames = next.teams.reduce((s, t) => s + t.record.wins + t.record.losses, 0);
    expect(totalGames).toBeGreaterThan(0);
  });

  it("is a no-op once that group's own season is already finished", () => {
    const g = { ...group("main", [team("a", 0, 0), team("b", 0, 0)]), round: 999 };
    const next = simulateBackgroundRound(g, {});
    expect(next).toBe(g);
  });
});
