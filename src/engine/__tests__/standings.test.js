import { sortStandings, leaguePosition } from "../standings";

function team(id, wins, losses, pointsFor, pointsAgainst) {
  return { id, record: { wins, losses, pointsFor, pointsAgainst } };
}

describe("standings", () => {
  it("ranks by wins first", () => {
    const teams = [team("a", 5, 3, 100, 90), team("b", 8, 0, 100, 90)];
    const sorted = sortStandings(teams);
    expect(sorted[0].id).toBe("b");
  });

  it("breaks ties by point differential", () => {
    const teams = [
      team("a", 5, 5, 100, 100), // diff 0
      team("b", 5, 5, 120, 90), // diff +30
    ];
    const sorted = sortStandings(teams);
    expect(sorted[0].id).toBe("b");
  });

  it("reports a team's 1-indexed league position", () => {
    const teams = [team("a", 2, 2, 0, 0), team("b", 10, 0, 0, 0), team("c", 1, 3, 0, 0)];
    expect(leaguePosition(team("b", 10, 0, 0, 0), teams)).toBe(1);
    expect(leaguePosition(team("c", 1, 3, 0, 0), teams)).toBe(3);
  });
});
