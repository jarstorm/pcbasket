import { randomName, CITIES, TEAM_NICKNAMES } from "./names";
import febData from "./feb_league_data.json";
import segundaFebData from "./segunda_feb_league_data.json";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

let idCounter = 1;
function nextId(prefix) {
  return `${prefix}${idCounter++}`;
}

function clamp(n, min = 30, max = 99) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeRatings(base, spread) {
  return {
    shooting: clamp(base + (Math.random() - 0.5) * spread),
    defense: clamp(base + (Math.random() - 0.5) * spread),
    passing: clamp(base + (Math.random() - 0.5) * spread),
    rebounding: clamp(base + (Math.random() - 0.5) * spread),
    physical: clamp(base + (Math.random() - 0.5) * spread),
  };
}

function overallOf(ratings) {
  const { shooting, defense, passing, rebounding, physical } = ratings;
  return Math.round(
    shooting * 0.28 + defense * 0.22 + passing * 0.18 + rebounding * 0.17 + physical * 0.15
  );
}

function valueOf(overall, age, potential) {
  const ageFactor = age <= 24 ? 1.15 : age <= 29 ? 1.0 : age <= 33 ? 0.7 : 0.4;
  const potentialBonus = potential ? (potential - overall) * 4000 : 0;
  return Math.max(20000, Math.round((overall ** 2.1) * 40 * ageFactor + potentialBonus));
}

// Recurring per-round salary — modest relative to transfer value (valueOf),
// scaled for a second-tier Spanish league budget (no reliable public salary
// figure was found for Primera FEB specifically, so this is a reasonable
// in-game approximation, not a sourced real-world number).
function wageOf(overall, age) {
  const ageFactor = age <= 24 ? 1.1 : age <= 29 ? 1.0 : age <= 33 ? 0.85 : 0.65;
  return Math.max(400, Math.round(overall ** 1.7 * 0.6 * ageFactor));
}

export function makePlayer({ age, base, spread, isProspect = false, teamId = null } = {}) {
  const ratings = makeRatings(base ?? randInt(45, 80), spread ?? 30);
  const overall = overallOf(ratings);
  const playerAge = age ?? randInt(19, 34);
  const potential = isProspect ? clamp(overall + randInt(5, 25)) : overall;
  return {
    id: nextId("p"),
    name: randomName(),
    position: POSITIONS[randInt(0, 4)],
    age: playerAge,
    ratings,
    overall,
    potential,
    value: valueOf(overall, playerAge, isProspect ? potential : null),
    wage: wageOf(overall, playerAge),
    contractYears: randInt(1, 4),
    seasonMinutes: 0,
    listed: false,
    morale: randInt(60, 95),
    form: 99,
    injured: false,
    teamId,
    isProspect,
  };
}

function pickStartingLineup(team, rosterPlayers) {
  const posOrder = ["PG", "SG", "SF", "PF", "C"];
  const used = new Set();
  for (const pos of posOrder) {
    const candidates = rosterPlayers
      .filter((p) => p.position === pos && !used.has(p.id))
      .sort((a, b) => b.overall - a.overall);
    const pick = candidates[0] || rosterPlayers
      .filter((p) => !used.has(p.id))
      .sort((a, b) => b.overall - a.overall)[0];
    if (pick) {
      team.lineup[pos] = pick.id;
      used.add(pick.id);
    }
  }
}

function addAcademyProspects(team, players) {
  const academySize = randInt(2, 3);
  for (let k = 0; k < academySize; k++) {
    const prospect = makePlayer({
      age: randInt(16, 19),
      base: randInt(35, 55),
      spread: 20,
      isProspect: true,
      teamId: team.id,
    });
    players.push(prospect);
    team.academy.push(prospect.id);
  }
}

export function generateRealLeague() {
  idCounter = 1;
  const teams = [];
  const players = [];

  for (const t of febData.teams) {
    const team = {
      id: t.id,
      name: t.name,
      city: t.name,
      budget: randInt(300000, 900000),
      stadium: {
        name: `Pabellón ${t.name}`,
        level: 1,
        capacity: 8000,
        ticketPrice: 25,
      },
      roster: [],
      academy: [],
      record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
      lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
      staff: {},
      sponsor: null,
    };
    teams.push(team);
  }

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  for (const rp of febData.players) {
    const overall = rp.overall;
    const potential = rp.potential;
    const player = {
      id: rp.id,
      name: rp.name,
      position: rp.position,
      age: rp.age,
      nationality: rp.nationality,
      heightCm: rp.heightCm,
      ratings: rp.ratings,
      overall,
      potential,
      value: valueOf(overall, rp.age, potential),
      wage: wageOf(overall, rp.age),
      contractYears: randInt(1, 4),
      seasonMinutes: 0,
      listed: false,
      morale: randInt(60, 95),
      form: 99,
      injured: false,
      teamId: rp.teamId,
      isProspect: false,
    };
    players.push(player);
    const team = teamById[rp.teamId];
    if (team) team.roster.push(player.id);
  }

  for (const team of teams) {
    const rosterPlayers = players.filter((p) => p.teamId === team.id);
    pickStartingLineup(team, rosterPlayers);
    addAcademyProspects(team, players);
  }

  return { teams, players };
}

// Loads the real, scraped Segunda FEB division (third tier). Same shape as
// generateRealLeague(), just a different data file and a lower budget range
// (a lower category should have a smaller budget than Primera FEB).
export function generateSegundaFebDivision() {
  const teams = [];
  const players = [];

  for (const t of segundaFebData.teams) {
    const team = {
      id: t.id,
      name: t.name,
      city: t.name,
      budget: randInt(150000, 450000),
      stadium: { name: `Pabellón ${t.name}`, level: 1, capacity: 4000, ticketPrice: 15 },
      roster: [],
      academy: [],
      record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
      lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
      staff: {},
      sponsor: null,
    };
    teams.push(team);
  }

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  for (const rp of segundaFebData.players) {
    const overall = rp.overall;
    const potential = rp.potential;
    const player = {
      id: rp.id,
      name: rp.name,
      position: rp.position,
      age: rp.age,
      nationality: rp.nationality,
      heightCm: rp.heightCm,
      ratings: rp.ratings,
      overall,
      potential,
      value: valueOf(overall, rp.age, potential),
      wage: wageOf(overall, rp.age),
      contractYears: randInt(1, 4),
      seasonMinutes: 0,
      listed: false,
      morale: randInt(60, 95),
      form: 99,
      injured: false,
      teamId: rp.teamId,
      isProspect: false,
    };
    players.push(player);
    const team = teamById[rp.teamId];
    if (team) team.roster.push(player.id);
  }

  const nonEmptyTeams = teams.filter((t) => t.roster.length >= 5);
  for (const team of nonEmptyTeams) {
    const rosterPlayers = players.filter((p) => p.teamId === team.id);
    pickStartingLineup(team, rosterPlayers);
    addAcademyProspects(team, players);
  }

  return { teams: nonEmptyTeams, players };
}

// Fictional top-tier division (ACB) — no real scraper exists for acb.com yet
// (it's a client-rendered site, unlike FEB's classic server-rendered pages),
// so this uses generated rosters with a higher rating base, matching a top
// category's higher average and bigger budget.
export function generateAcbDivision(numTeams = 18, rosterSize = 12) {
  const shuffledCities = [...CITIES, ...CITIES].sort(() => Math.random() - 0.5);
  const shuffledNicks = [...TEAM_NICKNAMES, ...TEAM_NICKNAMES].sort(() => Math.random() - 0.5);

  const teams = [];
  const players = [];

  for (let i = 0; i < numTeams; i++) {
    const teamId = `acb${i + 1}`;
    const city = shuffledCities[i];
    const nick = shuffledNicks[i];
    const team = {
      id: teamId,
      name: `${city} ${nick}`,
      city,
      budget: randInt(1500000, 4000000),
      stadium: { name: `${city} Arena`, level: 2, capacity: 10000, ticketPrice: 35 },
      roster: [],
      academy: [],
      record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
      lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
      staff: {},
      sponsor: null,
    };

    for (let j = 0; j < rosterSize; j++) {
      const player = makePlayer({ base: randInt(65, 90), spread: 20, teamId });
      players.push(player);
      team.roster.push(player.id);
    }

    const rosterPlayers = players.filter((p) => p.teamId === teamId);
    pickStartingLineup(team, rosterPlayers);
    addAcademyProspects(team, players);

    teams.push(team);
  }

  return { teams, players };
}

export function generateLeague(numTeams = 20, rosterSize = 12) {
  idCounter = 1;
  const shuffledCities = [...CITIES, ...CITIES, ...CITIES].sort(() => Math.random() - 0.5);
  const shuffledNicks = [...TEAM_NICKNAMES, ...TEAM_NICKNAMES, ...TEAM_NICKNAMES].sort(
    () => Math.random() - 0.5
  );

  const teams = [];
  const players = [];

  for (let i = 0; i < numTeams; i++) {
    const teamId = `t${i + 1}`;
    const city = shuffledCities[i];
    const nick = shuffledNicks[i];
    const team = {
      id: teamId,
      name: `${city} ${nick}`,
      city,
      budget: randInt(300000, 900000),
      stadium: {
        name: `${city} Arena`,
        level: 1,
        capacity: 8000,
        ticketPrice: 25,
      },
      roster: [],
      academy: [],
      record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
      lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
      staff: {},
      sponsor: null,
    };

    for (let j = 0; j < rosterSize; j++) {
      const overallBase = randInt(50, 82);
      const player = makePlayer({ base: overallBase, spread: 24, teamId });
      players.push(player);
      team.roster.push(player.id);
    }

    const rosterPlayers = players.filter((p) => p.teamId === teamId);
    pickStartingLineup(team, rosterPlayers);
    addAcademyProspects(team, players);

    teams.push(team);
  }

  return { teams, players };
}
