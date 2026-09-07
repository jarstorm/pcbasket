import { sortStandings } from "./standings";
import { generateSchedule } from "./schedule";
import { simulateMatch } from "./simulate";

export const DIVISION_META = {
  acb: { name: "ACB", tier: 1 },
  primerafeb: { name: "Primera FEB", tier: 2 },
  segundafeb: { name: "Segunda FEB", tier: 3 },
  tercerafeb: { name: "Tercera FEB", tier: 4 },
};

export const DIVISION_ORDER = ["acb", "primerafeb", "segundafeb", "tercerafeb"];

// Real FEB promotion structure per boundary, keyed by the LOWER (worse)
// division of that boundary. "single"/"dual"/"deca" describe how many
// groups that lower division has (1, 2, 10) — see resolvePromotion below.
// ACB has no entry: it's fictional, nothing promotes into it from above.
const PROMOTION = {
  // Primera FEB -> ACB: 1st direct, 2nd-9th (8 teams) knockout for the 2nd spot.
  primerafeb: { kind: "single", directCount: 1, poolSize: 8, totalSlots: 2 },
  // Segunda FEB -> Primera FEB: both group champions direct, 3rd spot from
  // an 8-team pool (positions 2-5 of each of the 2 groups).
  segundafeb: { kind: "dual", directPerGroup: 1, poolPerGroup: 4, totalSlots: 3 },
  // Tercera FEB -> Segunda FEB: top-2 (by cross-group rank) of the 10 group
  // champions promote direct, the other 8 champions knock out to 4 survivors.
  tercerafeb: { kind: "deca", directCount: 2, totalSlots: 6 },
};

// How many of a division's own bottom teams relegate into the tier below,
// keyed by that division's own id. Tercera FEB has no entry — it's the
// floor of the modeled pyramid, nothing relegates out of it.
const RELEGATION = {
  acb: { kind: "flat", count: 2 },
  primerafeb: { kind: "flat", count: 3 },
  segundafeb: { kind: "perGroup", countPerGroup: 3 },
};

// Human-readable label for a group id, for UI chips — group ids are already
// the lowercased form of their real name ("este", "a-a"), so this just
// reverses that. "main" (the single group of a 1-group division) has no
// label — callers should hide the chip row entirely in that case.
export function formatGroupLabel(groupId) {
  return groupId === "main" ? null : groupId.toUpperCase();
}

// Simulates one round for a background (non-active) GROUP — team records
// only, no boxscore/finance/injury bookkeeping (the user never manages
// these teams directly).
export function simulateBackgroundRound(group, playersById) {
  if (group.round >= group.schedule.length) return group;
  const round = group.schedule[group.round];
  const teamsById = Object.fromEntries(group.teams.map((t) => [t.id, t]));
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

  const teams = group.teams.map((t) => {
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

  return { ...group, teams, round: group.round + 1 };
}

// Maps simulateBackgroundRound over every group of a division.
export function simulateBackgroundDivision(division, playersById) {
  return {
    ...division,
    groups: division.groups.map((g) => simulateBackgroundRound(g, playersById)),
  };
}

function rebuildSeason(group) {
  return {
    ...group,
    teams: group.teams.map((t) => ({
      ...t,
      record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
    })),
    schedule: generateSchedule(group.teams.map((t) => t.id), true),
    round: 0,
    results: [],
    lastRoundResults: [],
  };
}

// A single win-or-go-home game, not a coin flip — the better-seeded team is
// still favored, just not guaranteed.
function singleGameWinner(a, b, favoriteEdge = 0.65) {
  return Math.random() < favoriteEdge ? a : b;
}

// One knockout round, mirror-seeded (best vs worst, 2nd vs 2nd-worst, ...)
// so top seeds only meet deep in the bracket. Repeated until `pool` shrinks
// to `targetSurvivors` — with `pool.length` a power-of-2 multiple of that
// target, this always lands exactly on it (8->1 in 3 rounds, 8->4 in 1).
function runKnockoutRounds(pool, targetSurvivors) {
  let current = pool;
  while (current.length > targetSurvivors) {
    const winners = [];
    for (let i = 0; i < current.length / 2; i++) {
      winners.push(singleGameWinner(current[i], current[current.length - 1 - i]));
    }
    current = winners;
  }
  return current;
}

// Ranks teams from different groups against each other — win% (not raw
// wins: groups can have different team/game counts, e.g. Tercera FEB's one
// 13-team group), then point differential.
function crossGroupRank(teams) {
  return [...teams].sort((a, b) => {
    const gamesA = a.record.wins + a.record.losses;
    const gamesB = b.record.wins + b.record.losses;
    const winPctA = gamesA ? a.record.wins / gamesA : 0;
    const winPctB = gamesB ? b.record.wins / gamesB : 0;
    if (winPctB !== winPctA) return winPctB - winPctA;
    const diffA = a.record.pointsFor - a.record.pointsAgainst;
    const diffB = b.record.pointsFor - b.record.pointsAgainst;
    return diffB - diffA;
  });
}

function resolvePromotion(groups, config) {
  if (config.kind === "single") {
    const standings = sortStandings(groups[0].teams);
    const direct = standings.slice(0, config.directCount);
    const pool = standings.slice(config.directCount, config.directCount + config.poolSize);
    const survivors = runKnockoutRounds(pool, config.totalSlots - config.directCount);
    return [...direct, ...survivors];
  }
  if (config.kind === "dual") {
    const direct = groups.map((g) => sortStandings(g.teams)[0]);
    const pool = crossGroupRank(
      groups.flatMap((g) => sortStandings(g.teams).slice(config.directPerGroup, config.directPerGroup + config.poolPerGroup))
    );
    const survivors = runKnockoutRounds(pool, config.totalSlots - direct.length);
    return [...direct, ...survivors];
  }
  if (config.kind === "deca") {
    const champions = crossGroupRank(groups.map((g) => sortStandings(g.teams)[0]));
    const direct = champions.slice(0, config.directCount);
    const pool = champions.slice(config.directCount);
    const survivors = runKnockoutRounds(pool, config.totalSlots - config.directCount);
    return [...direct, ...survivors];
  }
  throw new Error(`unknown promotion kind: ${config.kind}`);
}

function relegateFromGroups(groups, config) {
  if (config.kind === "flat") {
    return sortStandings(groups[0].teams).slice(-config.count);
  }
  if (config.kind === "perGroup") {
    return groups.flatMap((g) => sortStandings(g.teams).slice(-config.countPerGroup));
  }
  throw new Error(`unknown relegation kind: ${config.kind}`);
}

// Distributes incoming teams one at a time into whichever group currently
// has the fewest teams — keeps a multi-group division's groups balanced
// over time even though promotion/relegation don't draw evenly from each.
export function assignToSmallestGroup(groups, incomingTeams) {
  const next = groups.map((g) => ({ ...g, teams: [...g.teams] }));
  for (const team of incomingTeams) {
    const target = next.reduce((min, g) => (g.teams.length < min.teams.length ? g : min), next[0]);
    target.teams.push(team);
  }
  return next;
}

// Resolves promotion/relegation at every tier boundary (ACB/Primera FEB,
// Primera FEB/Segunda FEB, Segunda FEB/Tercera FEB) from each division's
// CURRENT standings, all computed up front off the original groups (not
// chained — a team can't be promoted and immediately relegated again in
// the same transition) — then starts every group on a fresh season.
export function resolvePyramid(divisions) {
  const removed = Object.fromEntries(DIVISION_ORDER.map((id) => [id, new Set()]));
  const incoming = Object.fromEntries(DIVISION_ORDER.map((id) => [id, []]));

  for (let i = 0; i < DIVISION_ORDER.length - 1; i++) {
    const upperId = DIVISION_ORDER[i];
    const lowerId = DIVISION_ORDER[i + 1];

    const promoted = resolvePromotion(divisions[lowerId].groups, PROMOTION[lowerId]);
    for (const t of promoted) removed[lowerId].add(t.id);
    incoming[upperId].push(...promoted);

    const relegConfig = RELEGATION[upperId];
    if (relegConfig) {
      const relegated = relegateFromGroups(divisions[upperId].groups, relegConfig);
      for (const t of relegated) removed[upperId].add(t.id);
      incoming[lowerId].push(...relegated);
    }
  }

  const result = {};
  for (const id of DIVISION_ORDER) {
    const remainingGroups = divisions[id].groups.map((g) => ({
      ...g,
      teams: g.teams.filter((t) => !removed[id].has(t.id)),
    }));
    const withIncoming = assignToSmallestGroup(remainingGroups, incoming[id]);
    result[id] = {
      name: divisions[id].name,
      groups: withIncoming.map(rebuildSeason),
    };
  }
  return result;
}

export function findGroupOf(divisions, teamId) {
  for (const divisionId of Object.keys(divisions)) {
    for (const group of divisions[divisionId].groups) {
      if (group.teams.some((t) => t.id === teamId)) {
        return { divisionId, groupId: group.id };
      }
    }
  }
  return null;
}

// Reassembles the FULL active division (the live mirrored group at the top
// of GameContext's state + its stored sibling groups, if the active
// division has more than one) — used by both GameContext (season-end
// pyramid resolution) and PyramidScreen (standings display) so the merge
// only lives in one place.
export function assembleActiveDivision(state) {
  const liveGroup = {
    id: state.activeGroupId,
    teams: state.teams,
    schedule: state.schedule,
    round: state.round,
    results: state.results,
    lastRoundResults: state.lastRoundResults,
  };
  const siblings = state.otherDivisions[state.activeDivisionId]?.groups || [];
  return {
    name: DIVISION_META[state.activeDivisionId].name,
    groups: [liveGroup, ...siblings],
  };
}

// Non-random preview of who's currently in promotion contention (for UI
// highlighting) — same position math as resolvePromotion, just without
// running the knockout. For a multi-group division the "pool" spans every
// group (cross-group ranked where relevant), not just one group's table.
export function previewPromotionZones(groups, divisionId) {
  const config = PROMOTION[divisionId];
  if (!config) return { direct: new Set(), pool: new Set() };
  if (config.kind === "single") {
    const standings = sortStandings(groups[0].teams);
    return {
      direct: new Set(standings.slice(0, config.directCount).map((t) => t.id)),
      pool: new Set(standings.slice(config.directCount, config.directCount + config.poolSize).map((t) => t.id)),
    };
  }
  if (config.kind === "dual") {
    return {
      direct: new Set(groups.map((g) => sortStandings(g.teams)[0].id)),
      pool: new Set(
        groups
          .flatMap((g) => sortStandings(g.teams).slice(config.directPerGroup, config.directPerGroup + config.poolPerGroup))
          .map((t) => t.id)
      ),
    };
  }
  // "deca"
  const champions = crossGroupRank(groups.map((g) => sortStandings(g.teams)[0]));
  return {
    direct: new Set(champions.slice(0, config.directCount).map((t) => t.id)),
    pool: new Set(champions.slice(config.directCount).map((t) => t.id)),
  };
}

// Non-random preview of who's currently in the relegation zone, for the
// same UI-highlighting purpose as previewPromotionZones. Empty for a
// division with no relegation (Tercera FEB, the pyramid's floor).
export function previewRelegationZones(groups, divisionId) {
  const config = RELEGATION[divisionId];
  if (!config) return new Set();
  return new Set(relegateFromGroups(groups, config).map((t) => t.id));
}

export function makeGroup(id, teams) {
  return {
    id,
    teams,
    schedule: generateSchedule(teams.map((t) => t.id), true),
    round: 0,
    results: [],
    lastRoundResults: [],
  };
}

export function makeDivision(name, groupSpecs) {
  return { name, groups: groupSpecs.map((g) => makeGroup(g.id, g.teams)) };
}
