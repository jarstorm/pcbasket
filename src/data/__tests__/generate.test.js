import { generateRealLeague, generateAcbDivision, generateSegundaFebDivision, generateTerceraFebDivision } from "../generate";

function teamsOf({ groups }) {
  return groups.flatMap((g) => g.teams);
}

describe("generateAcbDivision", () => {
  it("produces 18 teams with full rosters and a bigger budget than lower tiers", () => {
    const { teams, players } = generateAcbDivision();
    expect(teams.length).toBe(18);
    expect(players.length).toBeGreaterThan(0);
    for (const t of teams) {
      expect(t.roster.length).toBeGreaterThanOrEqual(5);
      expect(t.budget).toBeGreaterThan(900000); // above Primera FEB's max
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
