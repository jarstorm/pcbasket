import { headCoachBonus, offenseBonus, defenseBonus, injuryRiskReduction } from "./staff";
import { POSITION_ORDER } from "../data/positions";

const GAME_MINUTES = 40;
const TOTAL_PLAYER_MINUTES = GAME_MINUTES * 5; // 5 players on court at all times
const INJURY_FORM_THRESHOLD = Number(process.env.EXPO_PUBLIC_INJURY_FORM_THRESHOLD ?? 55);

// A player fielded out of position performs worse the further the slot is
// from their real position (PG in at C is much worse than PG at SG).
function positionMismatchFactor(slotPos, playerPos) {
  const a = POSITION_ORDER.indexOf(slotPos);
  const b = POSITION_ORDER.indexOf(playerPos);
  if (a < 0 || b < 0) return 1;
  const distance = Math.abs(a - b);
  return Math.max(0.4, 1 - distance * 0.15);
}

function teamStrength(team, playersById) {
  const starterEntries = Object.entries(team.lineup)
    .filter(([, id]) => id)
    .map(([slotPos, id]) => ({ slotPos, player: playersById[id] }))
    .filter((e) => e.player);
  if (starterEntries.length === 0) return 40;
  const avgOverall =
    starterEntries.reduce((sum, { slotPos, player: p }) => {
      const effective =
        p.overall *
        (p.injured ? 0.4 : 1) *
        (p.morale / 100) *
        ((p.form ?? 99) / 100) *
        positionMismatchFactor(slotPos, p.position);
      return sum + effective;
    }, 0) / starterEntries.length;

  const starterIds = new Set(starterEntries.map((e) => e.player.id));
  const bench = (team.roster || [])
    .map((id) => playersById[id])
    .filter((p) => p && !starterIds.has(p.id) && !p.injured)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 3);
  const benchAvg = bench.length
    ? bench.reduce((sum, p) => sum + p.overall, 0) / bench.length
    : avgOverall * 0.7;

  return avgOverall * 0.85 + benchAvg * 0.15 + headCoachBonus(team.staff || {});
}

// Splits 200 player-minutes per team across the healthy roster, weighted by
// rating (starters get a boost since they open the game), so titulares play
// meaningfully more than suplentes but nobody plays the full 40 alone.
function distributeMinutes(team, playersById) {
  const starterIds = new Set(Object.values(team.lineup).filter(Boolean));
  const healthy = (team.roster || [])
    .map((id) => playersById[id])
    .filter((p) => p && !p.injured);
  if (healthy.length === 0) return [];

  const weights = healthy.map((p) => p.overall * (starterIds.has(p.id) ? 2.2 : 1));
  const weightTotal = weights.reduce((a, b) => a + b, 0) || 1;
  const minutes = weights.map((w) => Math.max(0, Math.round((w / weightTotal) * TOTAL_PLAYER_MINUTES)));

  let diff = TOTAL_PLAYER_MINUTES - minutes.reduce((a, b) => a + b, 0);
  const order = healthy.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);
  let guard = 0;
  while (diff !== 0 && guard < 1000) {
    const i = order[guard % order.length];
    if (diff > 0) {
      minutes[i]++;
      diff--;
    } else if (minutes[i] > 0) {
      minutes[i]--;
      diff++;
    }
    guard++;
  }

  return healthy.map((p, i) => ({ player: p, minutes: minutes[i] })).filter((x) => x.minutes > 0);
}

function randNormal() {
  // Box-Muller, roughly N(0,1)
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Splits a player's total points into made 2s/3s/FTs so they add up exactly.
function splitPoints(points, shootingRating) {
  let remaining = points;
  const threeRatio = 0.15 + (shootingRating / 100) * 0.25;
  let made3 = 0;
  while (remaining >= 3 && Math.random() < threeRatio) {
    made3++;
    remaining -= 3;
  }
  let madeFt = 0;
  while (remaining % 2 === 1 && remaining > 0) {
    madeFt++;
    remaining -= 1;
  }
  const made2 = remaining / 2;
  return { made2, made3, madeFt };
}

export function simulateMatch(homeTeam, awayTeam, playersById) {
  const homeStr = teamStrength(homeTeam, playersById) + (homeTeam.stadium.level - 1) * 1.5 + 3; // home court edge
  const awayStr = teamStrength(awayTeam, playersById);

  const base = 95;
  const homeOffense = offenseBonus(homeTeam.staff || {});
  const awayOffense = offenseBonus(awayTeam.staff || {});
  const homeDefense = defenseBonus(homeTeam.staff || {});
  const awayDefense = defenseBonus(awayTeam.staff || {});
  let homeScore = Math.max(
    60,
    Math.round(base + (homeStr - 65) * 0.9 + homeOffense - awayDefense + randNormal() * 8)
  );
  let awayScore = Math.max(
    60,
    Math.round(base + (awayStr - 65) * 0.9 + awayOffense - homeDefense + randNormal() * 8)
  );
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
    const onCourt = distributeMinutes(team, playersById);
    const weightTotal = onCourt.reduce((s, x) => s + x.minutes * x.player.overall, 0) || 1;
    boxscore[teamRef] = onCourt.map(({ player: p, minutes }) => {
      const share = (minutes * p.overall) / weightTotal;
      const points = Math.max(0, Math.round(score * share * (0.7 + Math.random() * 0.6)));
      const rebounds = Math.round((p.ratings.rebounding / 100) * (minutes / 40) * randInt(2, 14));
      const assists = Math.round((p.ratings.passing / 100) * (minutes / 40) * randInt(1, 12));
      const { made2, made3, madeFt } = splitPoints(points, p.ratings.shooting);
      const att2 = made2 + randInt(0, 3);
      const att3 = made3 + randInt(0, 3);
      const attFt = madeFt + randInt(0, 2);
      const blocks = Math.round((p.ratings.defense / 100) * (minutes / 40) * randInt(0, 4));
      const fouls = randInt(0, 5);
      return {
        id: p.id,
        name: p.name,
        points,
        rebounds,
        assists,
        made2,
        att2,
        made3,
        att3,
        madeFt,
        attFt,
        blocks,
        fouls,
        minutes,
      };
    });
  }

  // Injury chance per game: a small base risk for anyone who played, plus
  // extra risk for players whose form dropped below the fatigue threshold.
  const injuryEvents = [];
  for (const teamRef of ["home", "away"]) {
    const team = teamRef === "home" ? homeTeam : awayTeam;
    const riskReduction = injuryRiskReduction(team.staff || {});
    for (const entry of boxscore[teamRef]) {
      const form = playersById[entry.id]?.form ?? 99;
      const fatigueRisk =
        form < INJURY_FORM_THRESHOLD
          ? ((INJURY_FORM_THRESHOLD - form) / INJURY_FORM_THRESHOLD) * 0.05
          : 0;
      if (Math.random() < (0.006 + fatigueRisk) * (1 - riskReduction)) {
        injuryEvents.push({ teamId: team.id, playerId: entry.id });
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
