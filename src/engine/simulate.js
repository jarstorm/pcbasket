function teamStrength(team, playersById) {
  const starters = Object.values(team.lineup)
    .filter(Boolean)
    .map((id) => playersById[id])
    .filter(Boolean);
  if (starters.length === 0) return 40;
  const avgOverall =
    starters.reduce((sum, p) => sum + p.overall * (p.injured ? 0.4 : 1) * (p.morale / 100), 0) /
    starters.length;
  return avgOverall;
}

function randNormal() {
  // Box-Muller, roughly N(0,1)
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function simulateMatch(homeTeam, awayTeam, playersById) {
  const homeStr = teamStrength(homeTeam, playersById) + (homeTeam.stadium.level - 1) * 1.5 + 3; // home court edge
  const awayStr = teamStrength(awayTeam, playersById);

  const base = 95;
  let homeScore = Math.max(60, Math.round(base + (homeStr - 65) * 0.9 + randNormal() * 8));
  let awayScore = Math.max(60, Math.round(base + (awayStr - 65) * 0.9 + randNormal() * 8));
  if (homeScore === awayScore) {
    // overtime point, slight edge to the stronger team
    if (homeStr >= awayStr) homeScore += randInt(1, 4);
    else awayScore += randInt(1, 4);
  }

  const boxscore = {};
  for (const [teamRef, team, score] of [
    ["home", homeTeam, homeScore],
    ["away", awayTeam, awayScore],
  ]) {
    const starters = Object.values(team.lineup).filter(Boolean).map((id) => playersById[id]).filter(Boolean);
    const weightTotal = starters.reduce((s, p) => s + p.overall, 0) || 1;
    boxscore[teamRef] = starters.map((p) => {
      const share = p.overall / weightTotal;
      const points = Math.max(0, Math.round(score * share * (0.7 + Math.random() * 0.6)));
      const rebounds = Math.round((p.ratings.rebounding / 100) * randInt(2, 12));
      const assists = Math.round((p.ratings.passing / 100) * randInt(1, 10));
      return { id: p.id, name: p.name, points, rebounds, assists };
    });
  }

  // random minor injury chance per game (very low)
  const injuryEvents = [];
  for (const team of [homeTeam, awayTeam]) {
    const starters = Object.values(team.lineup).filter(Boolean);
    for (const pid of starters) {
      if (Math.random() < 0.008) {
        injuryEvents.push({ teamId: team.id, playerId: pid });
      }
    }
  }

  return {
    homeId: homeTeam.id,
    awayId: awayTeam.id,
    homeScore,
    awayScore,
    boxscore,
    injuryEvents,
  };
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
