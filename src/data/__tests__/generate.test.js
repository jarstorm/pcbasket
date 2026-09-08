import {
  generateRealLeague,
  generateAcbDivision,
  generateSegundaFebDivision,
  generateTerceraFebDivision,
  valueOf,
  wageOf,
} from "../generate";

function teamsOf({ groups }) {
  return groups.flatMap((g) => g.teams);
}

describe("valueOf", () => {
  it("never exceeds 10x the player's wage", () => {
    for (let overall = 30; overall <= 99; overall += 3) {
      for (const age of [19, 25, 30, 34, 39]) {
        const value = valueOf(overall, age, null);
        const wage = wageOf(overall, age);
        expect(value).toBeLessThanOrEqual(wage * 10);
      }
    }
  });

  it("stays capped at 10x wage even with a big potential bonus (young prospect)", () => {
    const overall = 60;
    const age = 19;
    const value = valueOf(overall, age, /* potential */ 99);
    const wage = wageOf(overall, age);
    expect(value).toBeLessThanOrEqual(wage * 10);
  });

  it("scales with the division's wage scale, keeping the same ratio", () => {
    const full = valueOf(80, 27, null, 1);
    const scaled = valueOf(80, 27, null, 0.2);
    const fullWage = wageOf(80, 27, 1);
    const scaledWage = wageOf(80, 27, 0.2);
    expect(full).toBeLessThanOrEqual(fullWage * 10);
    expect(scaled).toBeLessThanOrEqual(scaledWage * 10);
    expect(scaled).toBeLessThan(full);
  });
});

describe("generateAcbDivision", () => {
  it("produces 18 teams with full rosters and a bigger budget than lower tiers", () => {
    const { teams, players } = generateAcbDivision();
    expect(teams.length).toBe(18);
    expect(players.length).toBeGreaterThan(0);
    for (const t of teams) {
      expect(t.roster.length).toBeGreaterThanOrEqual(5);
      expect(t.budget).toBeGreaterThan(1200000); // above Primera FEB's max
    }
  });

  it("skews ratings higher than a lower division (top tier, bigger average)", () => {
    const { teams: acbTeams, players: acbPlayers } = generateAcbDivision();
    const { players: sfebPlayers } = generateSegundaFebDivision();
    const avg = (list) => list.reduce((s, p) => s + p.overall, 0) / list.length;
    expect(avg(acbPlayers)).toBeGreaterThan(avg(sfebPlayers));
    expect(acbTeams.length).toBeGreaterThan(0);
  });
});

describe("generateSegundaFebDivision", () => {
  it("loads real scraped teams split into its 2 real groups, skipping any with an empty roster", () => {
    const { groups } = generateSegundaFebDivision();
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.id).sort()).toEqual(["este", "oeste"]);
    const teams = teamsOf({ groups });
    expect(teams.length).toBeGreaterThan(20); // ~28 total (14/group), minus any empty rosters
    for (const t of teams) {
      expect(t.roster.length).toBeGreaterThan(0);
    }
  });
});

describe("generateTerceraFebDivision", () => {
  it("loads real scraped teams split into its 10 real groups, skipping any with an empty roster", () => {
    const { groups } = generateTerceraFebDivision();
    expect(groups).toHaveLength(10);
    const teams = teamsOf({ groups });
    expect(teams.length).toBeGreaterThan(120); // ~139 total, minus any empty rosters
    for (const t of teams) {
      expect(t.roster.length).toBeGreaterThan(0);
    }
  });
});

describe("division ids never collide", () => {
  it("Primera FEB, Segunda FEB, Tercera FEB and ACB player/team ids are all unique together", () => {
    const primera = generateRealLeague();
    const segunda = generateSegundaFebDivision();
    const tercera = generateTerceraFebDivision();
    const acb = generateAcbDivision();
    const allPlayerIds = [...primera.players, ...segunda.players, ...tercera.players, ...acb.players].map((p) => p.id);
    expect(new Set(allPlayerIds).size).toBe(allPlayerIds.length);
    const allTeamIds = [...primera.teams, ...teamsOf(segunda), ...teamsOf(tercera), ...acb.teams].map((t) => t.id);
    expect(new Set(allTeamIds).size).toBe(allTeamIds.length);
  });
});
