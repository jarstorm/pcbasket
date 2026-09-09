import { randomName } from "./names";
import { seededRandom } from "../engine/random";
import febData from "./feb_league_data.json";
import segundaFebData from "./segunda_feb_league_data.json";
import terceraFebData from "./tercera_feb_league_data.json";
import acbData from "./acb_league_data.json";
import { FOREIGN_PLAYER_QUOTA, isForeign } from "../engine/rules";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

// Real Madrid and Barça run budgets far above the rest of ACB (multi-sport
// clubs with their own sponsorship/broadcast scale) — everyone else in the
// division sits in a much narrower band.
const BIG_BUDGET_ACB_TEAMS = new Set(["acb9", "acb2"]);

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

// `scale` mirrors wageOf's below — without it a player's transfer value
// stayed flat across divisions while their wage collapsed with wageScale,
// so a Tercera FEB player earning next to nothing still carried a Primera
// FEB-sized buyout price, wildly out of step with what they're paid.
//
// Real transfer clauses run roughly 10x-20x a player's annual wage, not
// their per-round one — approximated here with a single reference season
// length (actual seasons run 24-34 rounds depending on division/group
// size, close enough that a fixed figure doesn't skew any one division).
export const ROUNDS_PER_SEASON_APPROX = 30;

export function valueOf(overall, age, potential, scale = 1) {
  const ageFactor = age <= 24 ? 1.15 : age <= 29 ? 1.0 : age <= 33 ? 0.7 : 0.4;
  const potentialBonus = potential ? (potential - overall) * 4000 * scale : 0;
  const raw = Math.round((overall ** 2.1) * 40 * ageFactor * scale + potentialBonus);
  const annualWage = wageOf(overall, age, scale) * ROUNDS_PER_SEASON_APPROX;
  return Math.min(Math.max(raw, annualWage * 10), annualWage * 20);
}

// Recurring per-round salary — modest relative to transfer value (valueOf).
// `scale` brings this down for divisions whose income (tickets/sponsors/TV,
// all far smaller than Primera FEB's) can't support an ACB/Primera-sized
// wage bill — without it, a full Segunda/Tercera FEB roster's wages alone
// dwarf that division's entire weekly income, no matter how well the club
// is run. 1 = the original Primera FEB-scale figure.
export function wageOf(overall, age, scale = 1) {
  const ageFactor = age <= 24 ? 1.1 : age <= 29 ? 1.0 : age <= 33 ? 0.85 : 0.65;
  return Math.max(Math.round(400 * scale), Math.round(overall ** 1.7 * 0.6 * ageFactor * scale));
}

export function makePlayer({ age, base, spread, isProspect = false, teamId = null, wageScale = 1 } = {}) {
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
    value: valueOf(overall, playerAge, isProspect ? potential : null, wageScale),
    wage: wageOf(overall, playerAge, wageScale),
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

// Builds a game-model player from a scraped/transformed real player record
// (rp): shared by every real-data division (Primera/Segunda/Tercera FEB).
function buildRealPlayer(rp, wageScale = 1) {
  const overall = rp.overall;
  const potential = rp.potential;
  return {
    id: rp.id,
    name: rp.name,
    position: rp.position,
    age: rp.age,
    nationality: rp.nationality,
    heightCm: rp.heightCm,
    ratings: rp.ratings,
    overall,
    potential,
    value: valueOf(overall, rp.age, potential, wageScale),
    wage: wageOf(overall, rp.age, wageScale),
    contractYears: randInt(1, 4),
    seasonMinutes: 0,
    listed: false,
    morale: randInt(60, 95),
    form: 99,
    injured: false,
    teamId: rp.teamId,
    isProspect: false,
  };
}

// Builds a game-model player from a real identity (name/position/age/
// nationality/height, e.g. ACB) that has no accessible performance stats to
// derive a rating from — the rating itself is procedurally generated, same
// as makePlayer(), just attached to a real person instead of an invented
// one.
function buildRealIdentityRatedPlayer(rp, { base, spread }, wageScale = 1) {
  const ratings = makeRatings(base, spread);
  const overall = overallOf(ratings);
  return {
    id: rp.id,
    name: rp.name,
    position: rp.position,
    age: rp.age,
    nationality: rp.nationality,
    heightCm: rp.heightCm,
    ratings,
    overall,
    potential: overall,
    value: valueOf(overall, rp.age, null, wageScale),
    wage: wageOf(overall, rp.age, wageScale),
    contractYears: randInt(1, 4),
    seasonMinutes: 0,
    listed: false,
    morale: randInt(60, 95),
    form: 99,
    injured: false,
    teamId: rp.teamId,
    isProspect: false,
  };
}

// A stable integer seed from a string (team id) — no real financial data
// exists for most of these clubs (semi-pro leagues, nothing public), so a
// budget still has to be picked within a plausible range, but it must be
// the *same* pick every time a new game starts, not a fresh roll each
// time. Deterministic in the id, not in Math.random.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h;
}

function fixedBudget(id, budgetRange) {
  const rand = seededRandom(hashSeed(id));
  return budgetRange[0] + Math.round(rand() * (budgetRange[1] - budgetRange[0]));
}

// Builds the shared team-object shape (budget/stadium/roster/lineup/staff/
// ...) used by every division — real or fictional. seasonTicketPrice is
// always 9x the base ticket price — must match SEASON_TICKET_MULTIPLIER in
// state/GameContext.js (can't import it directly: that module imports from
// here, so the reverse would be circular).
function buildBaseTeam(id, name, { budgetRange, stadiumCapacity, ticketPrice, stadiumName, wageScale = 1 }) {
  return {
    id,
    name,
    city: name,
    budget: fixedBudget(id, budgetRange),
    wageScale,
    stadium: {
      name: stadiumName || `Pabellón ${name}`,
      level: 1,
      capacity: stadiumCapacity,
      ticketPrice,
      amenities: {},
      seasonTicketPrice: ticketPrice * 9,
      seasonTicketHolders: 0,
    },
    roster: [],
    academy: [],
    record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
    lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
    staff: {},
    sponsors: { jersey: null, stadium: null },
    financeHistory: [],
    tactics: { offense: "balanced", defense: "man" },
    scoutCooldown: null,
    scoutSearchTotal: null,
    loan: null,
  };
}

// Mirrors the FOREIGN_PLAYER_QUOTA rule enforced later in RosterScreen/
// SET_LINEUP, so auto-generated lineups don't start already in violation of
// their own quota (a foreign candidate is only picked once room is left).
function pickStartingLineup(team, rosterPlayers) {
  const posOrder = ["PG", "SG", "SF", "PF", "C"];
  const used = new Set();
  let foreignCount = 0;
  for (const pos of posOrder) {
    const eligible = (p) => !used.has(p.id) && (!isForeign(p) || foreignCount < FOREIGN_PLAYER_QUOTA);
    const candidates = rosterPlayers
      .filter((p) => p.position === pos && eligible(p))
      .sort((a, b) => b.overall - a.overall);
    const pick = candidates[0] || rosterPlayers
      .filter(eligible)
      .sort((a, b) => b.overall - a.overall)[0];
    if (pick) {
      team.lineup[pos] = pick.id;
      used.add(pick.id);
      if (isForeign(pick)) foreignCount++;
    }
  }
}

// Primera FEB (second tier). Real per-venue capacities weren't scraped
// (no reliable public source covering every club), so this uses the
// fallback capacity tier for this level instead of a made-up real figure.
export function generateRealLeague() {
  idCounter = 1;
  const teams = [];
  const players = [];

  for (const t of febData.teams) {
    teams.push(buildBaseTeam(t.id, t.name, { budgetRange: [250000, 1200000], stadiumCapacity: 3000, ticketPrice: 25 }));
  }

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  for (const rp of febData.players) {
    const player = buildRealPlayer(rp);
    players.push(player);
    const team = teamById[rp.teamId];
    if (team) team.roster.push(player.id);
  }

  for (const team of teams) {
    const rosterPlayers = players.filter((p) => p.teamId === team.id);
    pickStartingLineup(team, rosterPlayers);
  }

  return { teams, players };
}

// Builds a multi-group real division (Segunda FEB, Tercera FEB) from a
// transformed league-data file whose teams each carry a `group` field —
// shared by generateSegundaFebDivision/generateTerceraFebDivision below.
function buildRealGroupedDivision(data, { budgetRange, stadiumCapacity, ticketPrice, wageScale = 1 }) {
  const teams = [];
  const players = [];

  for (const t of data.teams) {
    teams.push(buildBaseTeam(t.id, t.name, { budgetRange, stadiumCapacity, ticketPrice, wageScale }));
  }

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  for (const rp of data.players) {
    const player = buildRealPlayer(rp, wageScale);
    players.push(player);
    const team = teamById[rp.teamId];
    if (team) team.roster.push(player.id);
  }

  const nonEmptyTeams = teams.filter((t) => t.roster.length >= 5);
  for (const team of nonEmptyTeams) {
    const rosterPlayers = players.filter((p) => p.teamId === team.id);
    pickStartingLineup(team, rosterPlayers);
  }

  const groupIdByTeamId = Object.fromEntries(data.teams.map((t) => [t.id, t.group]));
  const groupIds = [...new Set(data.teams.map((t) => t.group))].sort();
  const groups = groupIds.map((id) => ({
    id,
    teams: nonEmptyTeams.filter((t) => groupIdByTeamId[t.id] === id),
  }));

  return { groups, players };
}

// Loads the real, scraped Segunda FEB division (third tier): 2 geographic
// groups (Este/Oeste), 14 teams each. Lower budget/capacity than Primera
// FEB — a lower category should have a smaller budget than the one above.
// Real per-venue capacities weren't scraped (semi-amateur regional clubs,
// no reliable public source for hundreds of them), so this uses the
// fallback tier the user asked for when real data isn't available.
export function generateSegundaFebDivision() {
  return buildRealGroupedDivision(segundaFebData, {
    budgetRange: [80000, 350000],
    stadiumCapacity: 2000,
    ticketPrice: 15,
    wageScale: 0.7,
  });
}

// Loads the real, scraped Tercera FEB division (fourth tier, the floor of
// the modeled pyramid): 10 real regional groups (~14 teams each). Budget/
// capacity scaled down again from Segunda FEB. Same fallback-capacity
// caveat as generateSegundaFebDivision above.
export function generateTerceraFebDivision() {
  return buildRealGroupedDivision(terceraFebData, {
    budgetRange: [20000, 80000],
    stadiumCapacity: 1000,
    ticketPrice: 8,
    wageScale: 0.22,
  });
}

// ACB is the top of the pyramid — its best players are genuine
// professionals earning real money (six figures and up, low-to-mid
// millions for the actual stars), nothing like Primera FEB's semi-pro
// scale. 1 = that Primera FEB reference figure.
const ACB_WAGE_SCALE = 22;

// Top-tier division (ACB / Liga Endesa). Real clubs and current rosters,
// scraped from acb.com (see scripts/acb_scraper.py) — team names, and each
// player's real name/position/age/nationality/height. acb.com has no
// accessible performance stats for any season though (confirmed directly
// against the raw responses — genuinely client-fetched, not just missing
// from a summary), so skill ratings are still procedurally generated, with
// a higher base than the divisions below it, matching a top category's
// bigger average and budget.
export function generateAcbDivision() {
  const teams = [];
  const players = [];

  // Real arena names/capacities (see scripts/acb_league_data.json), scraped
  // from public sources — not procedurally generated like the divisions
  // below it.
  for (const t of acbData.teams) {
    const team = buildBaseTeam(t.id, t.name, {
      budgetRange: BIG_BUDGET_ACB_TEAMS.has(t.id) ? [12000000, 35000000] : [3000000, 9000000],
      stadiumCapacity: t.capacity || 10000,
      stadiumName: t.arena || null,
      ticketPrice: 35,
      wageScale: ACB_WAGE_SCALE,
    });
    team.stadium.level = 2;
    team.logoUrl = t.logo || null;
    teams.push(team);
  }

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  for (const rp of acbData.players) {
    const player = buildRealIdentityRatedPlayer(rp, { base: randInt(70, 85), spread: 20 }, ACB_WAGE_SCALE);
    players.push(player);
    const team = teamById[rp.teamId];
    if (team) team.roster.push(player.id);
  }

  for (const team of teams) {
    const rosterPlayers = players.filter((p) => p.teamId === team.id);
    pickStartingLineup(team, rosterPlayers);
  }

  return { teams, players };
}
