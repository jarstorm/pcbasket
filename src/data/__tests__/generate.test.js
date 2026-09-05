import { generateRealLeague, generateAcbDivision, generateSegundaFebDivision } from "../generate";

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
  it("loads real scraped teams, skipping any with an empty roster", () => {
    const { teams } = generateSegundaFebDivision();
    expect(teams.length).toBeGreaterThan(0);
    for (const t of teams) {
      expect(t.roster.length).toBeGreaterThan(0);
    }
  });
});

describe("division ids never collide", () => {
  it("Primera FEB, Segunda FEB and ACB player/team ids are all unique together", () => {
    const primera = generateRealLeague();
    const segunda = generateSegundaFebDivision();
    const acb = generateAcbDivision();
    const allPlayerIds = [...primera.players, ...segunda.players, ...acb.players].map((p) => p.id);
    expect(new Set(allPlayerIds).size).toBe(allPlayerIds.length);
    const allTeamIds = [...primera.teams, ...segunda.teams, ...acb.teams].map((t) => t.id);
    expect(new Set(allTeamIds).size).toBe(allTeamIds.length);
  });
});
