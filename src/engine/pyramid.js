import { sortStandings } from "./standings";
import { generateSchedule } from "./schedule";
import { simulateMatch } from "./simulate";

export const DIVISION_META = {
  acb: { name: "ACB", tier: 1 },
  primerafeb: { name: "Primera FEB", tier: 2 },
  segundafeb: { name: "Segunda FEB", tier: 3 },
};

export const DIVISION_ORDER = ["acb", "primerafeb", "segundafeb"];

// Simulates one round for a background (non-active) division — team
// records only, no boxscore/finance/injury bookkeeping (the user never
// manages these teams directly).
export function simulateBackgroundRound(division, playersById) {
  if (division.round >= division.schedule.length) return division;
  const round = division.schedule[division.round];
  const teamsById = Object.fromEntries(division.teams.map((t) => [t.id, t]));
  const teamUpdates = {};

  for (const [homeId, awayId] of round) {
    const home = teamsById[homeId];
    const away = teamsById[awayId];
    const result = simulateMatch(home, away, playersById);
    teamUpdates[homeId] = {
      wins: result.homeScore > result.awayScore ? 1 : 0,
      losses: result.homeScore < result.awayScore ? 1 : 0,
      pf: result.homeScore,
      pa: result.awayScore,
    };
    teamUpdates[awayId] = {
      wins: result.awayScore > result.homeScore ? 1 : 0,
      losses: result.awayScore < result.homeScore ? 1 : 0,
      pf: result.awayScore,
      pa: result.homeScore,
    };
  }

  const teams = division.teams.map((t) => {
    const upd = teamUpdates[t.id];
    if (!upd) return t;
    return {
      ...t,
      record: {
        wins: t.record.wins + upd.wins,
        losses: t.record.losses + upd.losses,
        pointsFor: t.record.pointsFor + upd.pf,
        pointsAgainst: t.record.pointsAgainst + upd.pa,
      },
    };
  });

  return { ...division, teams, round: division.round + 1 };
}

function rebuildSeason(division) {
  return {
    ...division,
    teams: division.teams.map((t) => ({
      ...t,
      record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
    })),
    schedule: generateSchedule(division.teams.map((t) => t.id), true),
    round: 0,
    results: [],
    lastRoundResults: [],
  };
}

// Matches the real FEB rules: 2 promotion spots out of Primera FEB/Segunda
// FEB (1st place goes up directly, the 2nd spot is a playoff among the next
// 4 best), and 2 direct relegation spots into ACB/Primera FEB (no playout —
// that only applies to Segunda FEB's own relegation to Tercera FEB, a tier
// this game doesn't model).
const RELEGATION_COUNT = 2;

// A single win-or-go-home game, not a coin flip — the better-seeded team is
// still favored, just not guaranteed.
function singleGameWinner(a, b, favoriteEdge = 0.65) {
  return Math.random() < favoriteEdge ? a : b;
}

// standings[0] auto-promotes; standings[1..4] (positions 2-5) contest the
// second spot in a 4-team single-elimination bracket seeded 2v5 / 3v4.
function resolvePromotionPlayoff(standings) {
  const [, seed2, seed3, seed4, seed5] = standings;
  const finalistA = singleGameWinner(seed2, seed5);
  const finalistB = singleGameWinner(seed3, seed4);
  return singleGameWinner(finalistA, finalistB, 0.5);
}

function promotedPair(standings) {
  return [standings[0], resolvePromotionPlayoff(standings)];
}

// Resolves promotion/relegation at both tier boundaries (ACB/Primera FEB,
// Primera FEB/Segunda FEB) from each division's current standings — both
// boundaries computed off the ORIGINAL standings at once (not chained), so
// a team can't be promoted and immediately relegated again in the same
// transition — then starts every division on a fresh season (reset
// records, new schedule).
export function resolvePyramid(divisions) {
  const { acb, primerafeb, segundafeb } = divisions;
  const acbStandings = sortStandings(acb.teams);
  const primeraStandings = sortStandings(primerafeb.teams);
  const segundaStandings = sortStandings(segundafeb.teams);

  const acbRelegated = acbStandings.slice(-RELEGATION_COUNT);
  const primeraPromoted = promotedPair(primeraStandings);
  const primeraRelegated = primeraStandings.slice(-RELEGATION_COUNT);
  const segundaPromoted = promotedPair(segundaStandings);

  const acbRelegatedIds = new Set(acbRelegated.map((t) => t.id));
  const primeraPromotedIds = new Set(primeraPromoted.map((t) => t.id));
  const primeraRelegatedIds = new Set(primeraRelegated.map((t) => t.id));
  const segundaPromotedIds = new Set(segundaPromoted.map((t) => t.id));

  const newAcbTeams = [...acb.teams.filter((t) => !acbRelegatedIds.has(t.id)), ...primeraPromoted];
  const newPrimeraTeams = [
    ...primerafeb.teams.filter((t) => !primeraPromotedIds.has(t.id) && !primeraRelegatedIds.has(t.id)),
    ...acbRelegated,
    ...segundaPromoted,
  ];
  const newSegundaTeams = [
    ...segundafeb.teams.filter((t) => !segundaPromotedIds.has(t.id)),
    ...primeraRelegated,
  ];

  return {
    acb: rebuildSeason({ ...acb, teams: newAcbTeams }),
    primerafeb: rebuildSeason({ ...primerafeb, teams: newPrimeraTeams }),
    segundafeb: rebuildSeason({ ...segundafeb, teams: newSegundaTeams }),
  };
}

export function findDivisionOf(divisions, teamId) {
  return Object.keys(divisions).find((id) => divisions[id].teams.some((t) => t.id === teamId)) || null;
}
