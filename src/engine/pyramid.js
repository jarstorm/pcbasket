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

  const acbRelegated = acbStandings[acbStandings.length - 1];
  const primeraPromoted = primeraStandings[0];
  const primeraRelegated = primeraStandings[primeraStandings.length - 1];
  const segundaPromoted = segundaStandings[0];

  const newAcbTeams = acbRelegated
    ? acb.teams.map((t) => (t.id === acbRelegated.id ? primeraPromoted : t))
    : acb.teams;
  const newPrimeraTeams = primerafeb.teams.map((t) => {
    if (primeraPromoted && t.id === primeraPromoted.id) return acbRelegated || t;
    if (primeraRelegated && t.id === primeraRelegated.id) return segundaPromoted || t;
    return t;
  });
  const newSegundaTeams = segundaPromoted
    ? segundafeb.teams.map((t) => (t.id === segundaPromoted.id ? primeraRelegated : t))
    : segundafeb.teams;

  return {
    acb: rebuildSeason({ ...acb, teams: newAcbTeams }),
    primerafeb: rebuildSeason({ ...primerafeb, teams: newPrimeraTeams }),
    segundafeb: rebuildSeason({ ...segundafeb, teams: newSegundaTeams }),
  };
}

export function findDivisionOf(divisions, teamId) {
  return Object.keys(divisions).find((id) => divisions[id].teams.some((t) => t.id === teamId)) || null;
}
