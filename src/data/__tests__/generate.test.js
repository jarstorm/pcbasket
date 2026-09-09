import {
  generateRealLeague,
  generateAcbDivision,
  generateSegundaFebDivision,
  generateTerceraFebDivision,
  valueOf,
  wageOf,
  ROUNDS_PER_SEASON_APPROX,
} from "../generate";

function teamsOf({ groups }) {
  return groups.flatMap((g) => g.teams);
}

function annualWage(overall, age, scale = 1) {
  return wageOf(overall, age, scale) * ROUNDS_PER_SEASON_APPROX;
}

describe("valueOf", () => {
  it("always lands between 10x and 20x the player's annual wage", () => {
    for (let overall = 30; overall <= 99; overall += 3) {
      for (const age of [19, 25, 30, 34, 39]) {
        const value = valueOf(overall, age, null);
        const annual = annualWage(overall, age);
        expect(value).toBeGreaterThanOrEqual(annual * 10);
        expect(value).toBeLessThanOrEqual(annual * 20);
      }
    }
  });

  it("stays within the 10x-20x annual-wage band even with a big potential bonus (young prospect)", () => {
    const overall = 60;
    const age = 19;
    const value = valueOf(overall, age, /* potential */ 99);
    const annual = annualWage(overall, age);
    expect(value).toBeGreaterThanOrEqual(annual * 10);
    expect(value).toBeLessThanOrEqual(annual * 20);
  });

  it("scales with the division's wage scale, keeping the same band", () => {
    const full = valueOf(80, 27, null, 1);
    const scaled = valueOf(80, 27, null, 0.2);
    const fullAnnual = annualWage(80, 27, 1);
    const scaledAnnual = annualWage(80, 27, 0.2);
    expect(full).toBeGreaterThanOrEqual(fullAnnual * 10);
    expect(full).toBeLessThanOrEqual(fullAnnual * 20);
    expect(scaled).toBeGreaterThanOrEqual(scaledAnnual * 10);
    expect(scaled).toBeLessThanOrEqual(scaledAnnual * 20);
    expect(scaled).toBeLessThan(full);
  });
});

describe("team budgets", () => {
  it("are fixed per team across separate game starts, not re-rolled each time", () => {
    const first = generateAcbDivision().teams;
    const second = generateAcbDivision().teams;
    const budgetById = (teams) => Object.fromEntries(teams.map((t) => [t.id, t.budget]));
    expect(budgetById(first)).toEqual(budgetById(second));
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

  it("pays real professional wages — average well above Primera FEB, top earners into 6-7 figures a year", () => {
    const { players: acbPlayers } = generateAcbDivision();
    const { players: primeraPlayers } = generateRealLeague();
    const avgAnnualWage = (list) =>
      list.reduce((s, p) => s + p.wage * ROUNDS_PER_SEASON_APPROX, 0) / list.length;
    expect(avgAnnualWage(acbPlayers)).toBeGreaterThan(avgAnnualWage(primeraPlayers) * 5);

    const topEarner = Math.max(...acbPlayers.map((p) => p.wage * ROUNDS_PER_SEASON_APPROX));
    expect(topEarner).toBeGreaterThan(400000);
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
