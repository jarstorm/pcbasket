export function sortStandings(teams) {
  return [...teams].sort((a, b) => {
    if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
    const diffA = a.record.pointsFor - a.record.pointsAgainst;
    const diffB = b.record.pointsFor - b.record.pointsAgainst;
    return diffB - diffA;
  });
}

export function leaguePosition(team, teams) {
  return sortStandings(teams).findIndex((t) => t.id === team.id) + 1;
}
