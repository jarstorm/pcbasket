import { createContext, useContext, useReducer, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateRealLeague, generateAcbDivision, generateSegundaFebDivision, makePlayer } from "../data/generate";
import { generateSchedule } from "../engine/schedule";
import { simulateBackgroundRound, resolvePyramid, findDivisionOf } from "../engine/pyramid";
import { simulateMatch, OFFENSE_TACTICS, DEFENSE_TACTICS } from "../engine/simulate";
import { getUpgradeTiers } from "../engine/stadium";
import {
  getRoleTiers,
  currentRoleTier,
  formRecoveryBonus,
  injuryRecoveryChance,
  moraleBonus,
  scoutTierIndex,
} from "../engine/staff";
import { leaguePosition } from "../engine/standings";
import {
  playerWageTotal,
  staffWageTotal,
  stadiumMaintenance,
  sponsorIncome,
  getJerseySponsorOffers,
  getStadiumSponsorOffers,
  tvRightsIncome,
} from "../engine/finance";
import { seasonAgeStep, shouldRetire, evaluateContractOffer } from "../engine/career";
import { FOREIGN_PLAYER_QUOTA, isForeign } from "../engine/rules";
import { getAmenityOptions, amenityAttendanceBonus, amenityPriceTolerance } from "../engine/amenities";

const SAVE_KEY = "pcbasket-save-v1";
const SNAPSHOT_KEY = "pcbasket-snapshot-v1";
const BASE_TICKET_PRICE = 25; // starting price in generate.js, reference for "reasonable"
const MAX_ACADEMY_SIZE = 5;
// The league proper (state.schedule) doesn't kick off until September — this
// many fictional weeks of preseason come first so there's time to use the
// market, staff and stadium screens before round 0 is playable.
const PRESEASON_WEEKS = 6;
const FIRST_SEASON_YEAR = 2025;
const LOG_RETENTION_DAYS = 30;

// Every log entry is dated so Dashboard can show only the last 5 and purge
// anything older than a month — entries are matches against `currentDate`
// (lexical comparison works fine on "YYYY-MM-DD" strings).
function pushLog(currentDate, existingLog, messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  const dated = list.map((text) => ({ text, date: currentDate }));
  const cutoff = addDays(currentDate, -LOG_RETENTION_DAYS);
  const kept = existingLog.filter((entry) => entry.date >= cutoff);
  return [...dated, ...kept].slice(0, 200);
}
// Prospect quality by scout tier index (0=Básico, 1=Avanzado, 2=Élite) — a
// better scout doesn't just find prospects faster, they find better ones.
const SCOUT_TIER_RANGES = [
  { base: [35, 55], spread: 20 },
  { base: [45, 65], spread: 22 },
  { base: [55, 78], spread: 25 },
];

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Better league position and a reasonable ticket price fill more seats.
function attendanceRate(team, teams) {
  const position = leaguePosition(team, teams);
  const positionFactor = teams.length > 1 ? 1 - (position - 1) / (teams.length - 1) : 1;
  // Amenities raise the ticket price fans tolerate before staying home.
  const priceReference = BASE_TICKET_PRICE + amenityPriceTolerance(team.stadium);
  const priceFactor = clamp(
    1 - (Math.max(0, team.stadium.ticketPrice - priceReference) / priceReference) * 0.5,
    0.25,
    1
  );
  const base = 0.35 + positionFactor * 0.35 + priceFactor * 0.2 + amenityAttendanceBonus(team.stadium);
  return clamp(base + (Math.random() - 0.5) * 0.15, 0.15, 0.98);
}

// Season ticket holders lock in a chunk of capacity at the start of the
// season (paid upfront, in ADVANCE_PRESEASON below) — no position factor,
// since standings just reset and can't judge demand yet, only amenities and
// how the season ticket price compares to a normal ticket's own reference.
function seasonTicketRate(stadium) {
  const priceReference = (BASE_TICKET_PRICE + amenityPriceTolerance(stadium)) * 15;
  const priceFactor = clamp(
    1 - (Math.max(0, (stadium.seasonTicketPrice || 0) - priceReference) / priceReference) * 0.6,
    0.2,
    1
  );
  const base = 0.35 + amenityAttendanceBonus(stadium) * 2;
  return clamp(base * priceFactor, 0.1, 0.75);
}

// Backfills fields added after a save/snapshot was written, so old saves
// (missing team.staff or player.form) don't crash newer game logic.
function normalizeState(loaded) {
  if (!loaded) return loaded;

  // Old saves (from before the league pyramid existed) get freshly
  // generated background divisions — there's no historical data to
  // reconstruct — and those divisions' players must join the shared pool.
  let otherDivisions = loaded.otherDivisions;
  let extraPlayers = [];
  if (!otherDivisions) {
    const acb = generateAcbDivision();
    const segunda = generateSegundaFebDivision();
    extraPlayers = [...acb.players, ...segunda.players];
    otherDivisions = {
      acb: {
        name: "ACB",
        teams: acb.teams,
        schedule: generateSchedule(acb.teams.map((t) => t.id), true),
        round: 0,
        results: [],
        lastRoundResults: [],
      },
      segundafeb: {
        name: "Segunda FEB",
        teams: segunda.teams,
        schedule: generateSchedule(segunda.teams.map((t) => t.id), true),
        round: 0,
        results: [],
        lastRoundResults: [],
      },
    };
  }

  const playersById = Object.fromEntries(
    Object.entries(loaded.playersById).map(([id, p]) => [
      id,
      {
        ...p,
        form: p.form ?? 99,
        wage: p.wage ?? Math.round((p.overall || 60) ** 1.7 * 0.6),
        contractYears: p.contractYears ?? randInt(1, 4),
        seasonMinutes: p.seasonMinutes ?? 0,
        listed: p.listed ?? false,
      },
    ])
  );
  for (const p of extraPlayers) playersById[p.id] = p;

  // Older saves predate the preseason/calendar system — treat them as
  // already past preseason so they don't suddenly get gated on load.
  const currentDate = loaded.currentDate ?? addDays(`${FIRST_SEASON_YEAR}-09-01`, loaded.round * 7);
  // Even older saves stored log entries as plain strings with no date —
  // stamp them with the save's current date rather than dropping them.
  const log = (loaded.log ?? []).map((entry) =>
    typeof entry === "string" ? { text: entry, date: currentDate } : entry
  );

  return {
    ...loaded,
    teams: loaded.teams.map((t) => ({
      ...t,
      staff: t.staff && typeof t.staff.level === "undefined" ? t.staff : {},
      // Older saves had one generic sponsor slot — carry it forward as the
      // jersey deal, the closest match, and start the stadium slot empty.
      sponsors: t.sponsors ?? { jersey: t.sponsor ?? null, stadium: null },
      stadium: {
        ...t.stadium,
        // Older saves stored amenities as a list of built ids (each one
        // level 1); the current shape is a level (0-5) per amenity id.
        amenities: Array.isArray(t.stadium.amenities)
          ? Object.fromEntries(t.stadium.amenities.map((id) => [id, 1]))
          : t.stadium.amenities ?? {},
        seasonTicketPrice: t.stadium.seasonTicketPrice ?? t.stadium.ticketPrice * 15,
        seasonTicketHolders: t.stadium.seasonTicketHolders ?? 0,
      },
      financeHistory: t.financeHistory ?? [],
      tactics: t.tactics ?? { offense: "balanced", defense: "man" },
      scoutCooldown: t.scoutCooldown ?? null,
    })),
    playersById,
    pendingContracts: loaded.pendingContracts ?? [],
    activeDivisionId: loaded.activeDivisionId ?? "primerafeb",
    otherDivisions,
    log,
    seasonYear: loaded.seasonYear ?? FIRST_SEASON_YEAR,
    currentDate,
    preseasonWeeksLeft: loaded.preseasonWeeksLeft ?? 0,
  };
}

function freshGame() {
  const primera = generateRealLeague();
  const acb = generateAcbDivision();
  const segunda = generateSegundaFebDivision();

  // One shared player pool across all three divisions (ids are guaranteed
  // unique per division prefix) — a team moving between divisions on
  // promotion/relegation just needs its team object moved, its roster ids
  // already resolve against this same map either way.
  const playersById = Object.fromEntries(
    [...primera.players, ...acb.players, ...segunda.players].map((p) => [p.id, p])
  );

  return {
    teams: primera.teams,
    playersById,
    schedule: generateSchedule(primera.teams.map((t) => t.id), true),
    round: 0,
    userTeamId: null,
    teamChosen: false,
    results: [], // flat list of played matches
    lastRoundResults: [],
    pendingContracts: [],
    log: [],
    seasonYear: FIRST_SEASON_YEAR,
    currentDate: `${FIRST_SEASON_YEAR}-07-01`,
    preseasonWeeksLeft: PRESEASON_WEEKS,
    activeDivisionId: "primerafeb",
    otherDivisions: {
      acb: {
        name: "ACB",
        teams: acb.teams,
        schedule: generateSchedule(acb.teams.map((t) => t.id), true),
        round: 0,
        results: [],
        lastRoundResults: [],
      },
      segundafeb: {
        name: "Segunda FEB",
        teams: segunda.teams,
        schedule: generateSchedule(segunda.teams.map((t) => t.id), true),
        round: 0,
        results: [],
        lastRoundResults: [],
      },
    },
  };
}

const GameContext = createContext(null);

export function reducer(state, action) {
  switch (action.type) {
    case "NEW_GAME":
      return freshGame();

    case "CHOOSE_TEAM":
      return { ...state, userTeamId: action.teamId, teamChosen: true };

    case "LOAD":
      return action.state;

    case "ADVANCE_PRESEASON": {
      if ((state.preseasonWeeksLeft || 0) <= 0) return state;
      const preseasonWeeksLeft = state.preseasonWeeksLeft - 1;
      const currentDate = addDays(state.currentDate, 7);

      // Last tick before the league kicks off: lock in this season's season
      // ticket holders (paid upfront, one lump sum) for every team in the
      // active division — after this the remaining "walk-up" capacity is
      // what SIM_ROUND sells game by game.
      if (preseasonWeeksLeft > 0) {
        return { ...state, preseasonWeeksLeft, currentDate };
      }

      let log = state.log;
      const teams = state.teams.map((t) => {
        const holders = Math.round(t.stadium.capacity * seasonTicketRate(t.stadium));
        const lumpSum = holders * t.stadium.seasonTicketPrice;
        if (t.id === state.userTeamId) {
          log = pushLog(
            currentDate,
            log,
            `Abonos vendidos: ${holders.toLocaleString()} (+$${lumpSum.toLocaleString()})`
          );
        }
        return {
          ...t,
          budget: t.budget + lumpSum,
          stadium: { ...t.stadium, seasonTicketHolders: holders },
        };
      });

      return { ...state, preseasonWeeksLeft, currentDate, teams, log };
    }

    case "SET_TACTIC": {
      const { teamId, kind, value } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      if (kind !== "offense" && kind !== "defense") return state;
      const validValues = kind === "offense" ? OFFENSE_TACTICS : DEFENSE_TACTICS;
      if (!validValues[value]) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId ? { ...t, tactics: { ...t.tactics, [kind]: value } } : t
      );
      return { ...state, teams };
    }

    case "SET_LINEUP": {
      const { teamId, position, playerId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;

      // A player can only start in one slot: clear any other slot they hold.
      const nextLineup = Object.fromEntries(
        Object.entries(team.lineup).map(([pos, id]) => [
          pos,
          playerId && id === playerId && pos !== position ? null : id,
        ])
      );
      nextLineup[position] = playerId;

      const countForeign = (lineup) =>
        Object.values(lineup).filter((id) => isForeign(id && state.playersById[id])).length;
      const foreignBefore = countForeign(team.lineup);
      const foreignAfter = countForeign(nextLineup);
      // Block moves that make the quota worse, but always allow fixing an
      // already-over-quota lineup (e.g. one inherited from auto-generation)
      // one substitution at a time.
      if (foreignAfter > FOREIGN_PLAYER_QUOTA && foreignAfter > foreignBefore) return state;

      const teams = state.teams.map((t) => (t.id === teamId ? { ...t, lineup: nextLineup } : t));
      return { ...state, teams };
    }

    case "BUY_PLAYER": {
      const { buyerTeamId, playerId } = action;
      const player = state.playersById[playerId];
      if (!player) return state;
      const seller = state.teams.find((t) => t.id === player.teamId);
      const buyer = state.teams.find((t) => t.id === buyerTeamId);
      if (!buyer || !seller || buyer.id === seller.id) return state;
      const price = player.value;
      if (buyer.budget < price) return state;
      if (buyer.roster.length >= 15) return state;

      const teams = state.teams.map((t) => {
        if (t.id === seller.id) {
          return {
            ...t,
            budget: t.budget + price,
            roster: t.roster.filter((id) => id !== playerId),
            lineup: Object.fromEntries(
              Object.entries(t.lineup).map(([pos, id]) => [pos, id === playerId ? null : id])
            ),
          };
        }
        if (t.id === buyer.id) {
          return { ...t, budget: t.budget - price, roster: [...t.roster, playerId] };
        }
        return t;
      });

      const playersById = {
        ...state.playersById,
        [playerId]: { ...player, teamId: buyer.id, listed: false },
      };

      return {
        ...state,
        teams,
        playersById,
        log: pushLog(state.currentDate, state.log, `${player.name} fichado por ${buyer.name} por $${price.toLocaleString()}`),
      };
    }

    case "SIGN_FREE_AGENT": {
      const { teamId, playerId } = action;
      const player = state.playersById[playerId];
      const team = state.teams.find((t) => t.id === teamId);
      if (!player || !team || player.teamId !== null || player.retired) return state;
      if (team.roster.length >= 15) return state;

      const teams = state.teams.map((t) =>
        t.id === teamId ? { ...t, roster: [...t.roster, playerId] } : t
      );
      const playersById = {
        ...state.playersById,
        [playerId]: { ...player, teamId, contractYears: player.contractYears || 2 },
      };
      return {
        ...state,
        teams,
        playersById,
        log: pushLog(state.currentDate, state.log, `${player.name} fichado como agente libre por ${team.name}`),
      };
    }

    case "LIST_PLAYER": {
      const { playerId, listed } = action;
      const player = state.playersById[playerId];
      if (!player) return state;
      return {
        ...state,
        playersById: { ...state.playersById, [playerId]: { ...player, listed } },
      };
    }

    case "RESOLVE_CONTRACT": {
      const { teamId, playerId, offeredYears, offeredWage } = action;
      const team = state.teams.find((t) => t.id === teamId);
      const player = state.playersById[playerId];
      if (!team || !player) return state;
      const outcome = evaluateContractOffer(player, offeredYears, offeredWage);

      if (outcome.result === "accept") {
        const playersById = {
          ...state.playersById,
          [playerId]: { ...player, contractYears: offeredYears, wage: offeredWage },
        };
        return {
          ...state,
          playersById,
          pendingContracts: state.pendingContracts.filter((id) => id !== playerId),
          log: pushLog(
            state.currentDate,
            state.log,
            `${player.name} renovó ${offeredYears} año(s) por $${offeredWage.toLocaleString()}/jornada`
          ),
        };
      }

      if (outcome.result === "counter") {
        return {
          ...state,
          log: pushLog(
            state.currentDate,
            state.log,
            `${player.name} pide al menos $${outcome.counterWage.toLocaleString()}/jornada`
          ),
        };
      }

      // "reject": the player leaves the roster and becomes a free agent,
      // signable by anyone from the market. "retiring": leaves for good.
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              roster: t.roster.filter((id) => id !== playerId),
              lineup: Object.fromEntries(
                Object.entries(t.lineup).map(([pos, id]) => [pos, id === playerId ? null : id])
              ),
            }
          : t
      );
      const playersById = {
        ...state.playersById,
        [playerId]:
          outcome.result === "retiring"
            ? { ...player, teamId: null, retired: true }
            : { ...player, teamId: null, listed: false },
      };
      return {
        ...state,
        teams,
        playersById,
        pendingContracts: state.pendingContracts.filter((id) => id !== playerId),
        log: pushLog(
          state.currentDate,
          state.log,
          `${player.name} ${outcome.result === "retiring" ? "se retiró" : "rechazó la renovación y quedó libre"}`
        ),
      };
    }

    case "PROMOTE_YOUTH": {
      const { teamId, prospectId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team || !team.academy.includes(prospectId)) return state;
      if (team.roster.length >= 15) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              roster: [...t.roster, prospectId],
              academy: t.academy.filter((id) => id !== prospectId),
            }
          : t
      );
      const playersById = {
        ...state.playersById,
        [prospectId]: { ...state.playersById[prospectId], isProspect: false },
      };
      return {
        ...state,
        teams,
        playersById,
        log: pushLog(state.currentDate, state.log, `${state.playersById[prospectId].name} promovido al primer equipo`),
      };
    }

    case "UPGRADE_STADIUM": {
      const { teamId, tierId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const tier = getUpgradeTiers(team.stadium).find((t) => t.id === tierId);
      if (!tier) return state;
      if (team.budget < tier.cost) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - tier.cost,
              stadium: {
                ...t.stadium,
                level: t.stadium.level + 1,
                capacity: t.stadium.capacity + tier.capacityGain,
                ticketPrice: t.stadium.ticketPrice + tier.priceGain,
              },
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(state.currentDate, state.log, `${team.name} amplió su estadio: ${tier.label}`),
      };
    }

    case "BUILD_AMENITY": {
      const { teamId, amenityId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const option = getAmenityOptions(team.stadium).find((a) => a.id === amenityId);
      if (!option || option.maxed) return state;
      if (team.budget < option.cost) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - option.cost,
              stadium: {
                ...t.stadium,
                amenities: { ...(t.stadium.amenities || {}), [amenityId]: option.level + 1 },
              },
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(state.currentDate, state.log, `${team.name}: ${option.label} → ${option.nextTierName}`),
      };
    }

    case "HIRE_STAFF_ROLE": {
      const { teamId, roleId, tierId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const tier = getRoleTiers(team.staff, roleId).find((t) => t.id === tierId);
      if (!tier) return state;
      if (team.budget < tier.hireCost) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - tier.hireCost,
              staff: { ...t.staff, [roleId]: { tierId } },
              // A newly hired scout starts a fresh search cycle.
              scoutCooldown: roleId === "scout" ? null : t.scoutCooldown,
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(state.currentDate, state.log, `${team.name} contrató: ${tier.label}`),
      };
    }

    case "FIRE_STAFF_ROLE": {
      const { teamId, roleId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const tier = currentRoleTier(team.staff, roleId);
      if (!tier) return state;
      const severance = tier.wage * state.schedule.length;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - severance,
              staff: { ...t.staff, [roleId]: null },
              scoutCooldown: roleId === "scout" ? null : t.scoutCooldown,
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(
          state.currentDate,
          state.log,
          `${team.name} despidió a: ${tier.label} (indemnización $${severance.toLocaleString()})`
        ),
      };
    }

    case "SELECT_SPONSOR": {
      const { teamId, slot, sponsorId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const offers = slot === "stadium" ? getStadiumSponsorOffers(team, state.teams) : getJerseySponsorOffers(team, state.teams);
      const offer = offers.find((s) => s.id === sponsorId);
      if (!offer) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId ? { ...t, sponsors: { ...t.sponsors, [slot]: offer } } : t
      );
      return {
        ...state,
        teams,
        log: pushLog(state.currentDate, state.log, `${team.name} firmó con ${offer.label}`),
      };
    }

    case "SET_TICKET_PRICE": {
      const { teamId, price } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const ticketPrice = clamp(Math.round(price), 5, 200);
      const teams = state.teams.map((t) =>
        t.id === teamId ? { ...t, stadium: { ...t.stadium, ticketPrice } } : t
      );
      return { ...state, teams };
    }

    case "SET_SEASON_TICKET_PRICE": {
      const { teamId, price } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const seasonTicketPrice = clamp(Math.round(price), 50, 3000);
      const teams = state.teams.map((t) =>
        t.id === teamId ? { ...t, stadium: { ...t.stadium, seasonTicketPrice } } : t
      );
      return { ...state, teams };
    }

    case "SIM_ROUND": {
      if (state.round >= state.schedule.length) return state;
      if ((state.preseasonWeeksLeft || 0) > 0) return state;
      const round = state.schedule[state.round];
      let teamsById = Object.fromEntries(state.teams.map((t) => [t.id, t]));
      const roundResults = [];
      let playersById = { ...state.playersById };
      const teamUpdates = {};
      // Staff only "speak up" in the news feed for discrete events on the
      // user's own team (recurring passive bonuses stay silent — a message
      // every round for every hired role would drown out everything else).
      const roundLog = [];

      // Players listed for sale have a decent chance each round of being
      // bought by another team (so listing one reliably sells within a few
      // rounds, not sits forever), resolved before this round's matches.
      for (const player of Object.values(playersById)) {
        if (!player.listed) continue;
        if (Math.random() >= 0.25) continue;
        const seller = teamsById[player.teamId];
        if (!seller) continue;
        const candidates = Object.values(teamsById).filter(
          (t) => t.id !== player.teamId && t.budget >= player.value && t.roster.length < 15
        );
        if (candidates.length === 0) continue;
        const buyer = candidates[randInt(0, candidates.length - 1)];
        teamsById = {
          ...teamsById,
          [seller.id]: {
            ...seller,
            budget: seller.budget + player.value,
            roster: seller.roster.filter((id) => id !== player.id),
            lineup: Object.fromEntries(
              Object.entries(seller.lineup).map(([pos, id]) => [pos, id === player.id ? null : id])
            ),
          },
          [buyer.id]: {
            ...buyer,
            budget: buyer.budget - player.value,
            roster: [...buyer.roster, player.id],
          },
        };
        playersById[player.id] = { ...player, teamId: buyer.id, listed: false };
      }

      for (const [homeId, awayId] of round) {
        const home = teamsById[homeId];
        const away = teamsById[awayId];
        const result = simulateMatch(home, away, playersById);
        roundResults.push(result);

        // Season ticket holders already paid upfront (see ADVANCE_PRESEASON)
        // and always show up — only the remaining walk-up capacity is sold
        // game by game, subject to the usual attendance swings.
        const walkUpCapacity = Math.max(0, home.stadium.capacity - (home.stadium.seasonTicketHolders || 0));
        const ticketRevenue = Math.round(
          walkUpCapacity * attendanceRate(home, state.teams) * home.stadium.ticketPrice
        );

        for (const ev of result.injuryEvents) {
          playersById[ev.playerId] = { ...playersById[ev.playerId], injured: true };
        }

        const newProspects = { home: null, away: null };
        const scoutCooldowns = { home: null, away: null };
        for (const teamRef of ["home", "away"]) {
          const team = teamRef === "home" ? home : away;
          const staff = team.staff || {};
          const recovery = formRecoveryBonus(staff);
          const recoverChance = injuryRecoveryChance(staff);
          const moraleBump = moraleBonus(staff);
          const playedById = Object.fromEntries(result.boxscore[teamRef].map((e) => [e.id, e]));

          for (const pid of team.roster) {
            const p = playersById[pid];
            if (!p) continue;
            let next = p;
            const played = playedById[pid];
            if (played) {
              const loss = Math.max(0, Math.round(played.minutes * 0.15) - recovery);
              next = {
                ...next,
                form: clamp((next.form ?? 99) - loss, 40, 99),
                seasonMinutes: (next.seasonMinutes || 0) + played.minutes,
              };
            } else {
              next = { ...next, form: clamp((next.form ?? 99) + 3 + recovery, 40, 99) };
              if (next.injured && Math.random() < recoverChance) {
                next = { ...next, injured: false };
                if (team.id === state.userTeamId) {
                  roundLog.push(`El fisioterapeuta recuperó a ${next.name} de su lesión.`);
                }
              }
            }
            if (moraleBump > 0) {
              next = { ...next, morale: clamp((next.morale ?? 80) + moraleBump, 0, 99) };
            }
            playersById[pid] = next;
          }

          // A scout takes a real search cycle (3-6 months, i.e. ~13-26 weekly
          // rounds) to dig up one prospect — not a per-round lottery. Better
          // tiers find better raw talent, but nobody scouts a 15-year-old or
          // a 23-year-old "prospect".
          const tierIndex = scoutTierIndex(staff);
          if (tierIndex === null) {
            scoutCooldowns[teamRef] = null;
          } else {
            let cooldown = team.scoutCooldown == null ? randInt(13, 26) : team.scoutCooldown - 1;
            if (cooldown <= 0) {
              if (team.academy.length < MAX_ACADEMY_SIZE) {
                const range = SCOUT_TIER_RANGES[tierIndex];
                const prospect = makePlayer({
                  age: randInt(16, 22),
                  base: randInt(range.base[0], range.base[1]),
                  spread: range.spread,
                  isProspect: true,
                  teamId: team.id,
                });
                playersById[prospect.id] = prospect;
                newProspects[teamRef] = prospect.id;
                cooldown = randInt(13, 26);
                if (team.id === state.userTeamId) {
                  roundLog.push(`El ojeador encontró un nuevo prospecto de cantera: ${prospect.name}.`);
                }
              } else {
                cooldown = 1; // academy full — retry as soon as there's room
              }
            }
            scoutCooldowns[teamRef] = cooldown;
          }
        }

        const sponsorAndTvIncome = (t) =>
          sponsorIncome(t.sponsors?.jersey) +
          sponsorIncome(t.sponsors?.stadium) +
          tvRightsIncome(state.activeDivisionId, t, state.teams);

        const homeWage = playerWageTotal(home, playersById) + staffWageTotal(home.staff || {});
        const homeMaintenance = stadiumMaintenance(home.stadium, home.staff || {});
        const homeIncome = ticketRevenue + sponsorAndTvIncome(home);
        const homeExpenses = homeWage + homeMaintenance;

        const awayWage = playerWageTotal(away, playersById) + staffWageTotal(away.staff || {});
        const awayMaintenance = stadiumMaintenance(away.stadium, away.staff || {});
        const awayIncome = sponsorAndTvIncome(away);
        const awayExpenses = awayWage + awayMaintenance;

        teamUpdates[homeId] = {
          wins: (teamUpdates[homeId]?.wins || 0) + (result.homeScore > result.awayScore ? 1 : 0),
          losses: (teamUpdates[homeId]?.losses || 0) + (result.homeScore < result.awayScore ? 1 : 0),
          pf: (teamUpdates[homeId]?.pf || 0) + result.homeScore,
          pa: (teamUpdates[homeId]?.pa || 0) + result.awayScore,
          netIncome: homeIncome - homeExpenses,
          income: homeIncome,
          expenses: homeExpenses,
          ticketRevenue,
          newProspectId: newProspects.home,
          scoutCooldown: scoutCooldowns.home,
        };
        teamUpdates[awayId] = {
          wins: (teamUpdates[awayId]?.wins || 0) + (result.awayScore > result.homeScore ? 1 : 0),
          losses: (teamUpdates[awayId]?.losses || 0) + (result.awayScore < result.homeScore ? 1 : 0),
          pf: (teamUpdates[awayId]?.pf || 0) + result.awayScore,
          pa: (teamUpdates[awayId]?.pa || 0) + result.homeScore,
          netIncome: awayIncome - awayExpenses,
          income: awayIncome,
          expenses: awayExpenses,
          ticketRevenue: 0,
          newProspectId: newProspects.away,
          scoutCooldown: scoutCooldowns.away,
        };
      }

      const teams = Object.values(teamsById).map((t) => {
        const upd = teamUpdates[t.id];
        if (!upd) return t;
        const nextBudget = t.budget + (upd.netIncome || 0);
        const financeHistory =
          t.id === state.userTeamId
            ? [
                ...(t.financeHistory || []),
                {
                  round: state.round,
                  seasonYear: state.seasonYear || FIRST_SEASON_YEAR,
                  income: upd.income,
                  expenses: upd.expenses,
                  net: upd.netIncome,
                  budget: nextBudget,
                },
              ].slice(-120)
            : t.financeHistory;
        return {
          ...t,
          budget: nextBudget,
          financeHistory,
          scoutCooldown: upd.scoutCooldown,
          lastTicketRevenue: upd.ticketRevenue || 0,
          academy: upd.newProspectId ? [...t.academy, upd.newProspectId] : t.academy,
          record: {
            wins: t.record.wins + upd.wins,
            losses: t.record.losses + upd.losses,
            pointsFor: t.record.pointsFor + upd.pf,
            pointsAgainst: t.record.pointsAgainst + upd.pa,
          },
        };
      });

      // Background divisions (the tiers the user isn't currently playing
      // in) advance one round in lockstep, using the same match engine but
      // tracking only wins/losses/points — no boxscore, finance or injury
      // bookkeeping for teams the user doesn't manage.
      const otherDivisions = Object.fromEntries(
        Object.entries(state.otherDivisions).map(([id, div]) => [
          id,
          simulateBackgroundRound(div, playersById),
        ])
      );

      const nextRound = state.round + 1;
      if (nextRound < state.schedule.length) {
        const roundDate = addDays(state.currentDate, 7);
        return {
          ...state,
          teams,
          playersById,
          otherDivisions,
          round: nextRound,
          results: [...state.results, ...roundResults],
          lastRoundResults: roundResults,
          currentDate: roundDate,
          log: roundLog.length ? pushLog(roundDate, state.log, roundLog) : state.log,
        };
      }

      // Season finished: age everyone, resolve retirements, flag contract
      // renewals for the user's team (AI teams auto-renew quietly), and
      // start a fresh season with a new schedule.
      let finalPlayersById = { ...playersById };
      const retiredByTeam = {};

      for (const team of teams) {
        for (const pid of team.roster) {
          const p = finalPlayersById[pid];
          if (!p) continue;
          const aged = seasonAgeStep(p, p.seasonMinutes || 0);
          const next = { ...p, ...aged };
          finalPlayersById[pid] = next;
          if (shouldRetire(next)) {
            if (!retiredByTeam[team.id]) retiredByTeam[team.id] = [];
            retiredByTeam[team.id].push(pid);
          }
        }
      }
      for (const ids of Object.values(retiredByTeam)) {
        for (const id of ids) {
          finalPlayersById[id] = { ...finalPlayersById[id], retired: true };
        }
      }

      const pendingContracts = [];
      let finalTeams = teams.map((t) => {
        const retiredIds = retiredByTeam[t.id];
        const retiredSet = retiredIds ? new Set(retiredIds) : null;
        const roster = retiredSet ? t.roster.filter((id) => !retiredSet.has(id)) : t.roster;
        const lineup = retiredSet
          ? Object.fromEntries(Object.entries(t.lineup).map(([pos, id]) => [pos, retiredSet.has(id) ? null : id]))
          : t.lineup;

        if (t.id === state.userTeamId) {
          for (const pid of roster) {
            const p = finalPlayersById[pid];
            if (p && p.contractYears <= 0) pendingContracts.push(pid);
          }
        } else {
          for (const pid of roster) {
            const p = finalPlayersById[pid];
            if (p && p.contractYears <= 0) {
              finalPlayersById[pid] = { ...p, contractYears: randInt(1, 3) };
            }
          }
        }

        // Record is left as-is (this season's real result) so promotion/
        // relegation can judge it — resolvePyramid resets it for everyone
        // once the whole pyramid's standings have been read.
        return { ...t, roster, lineup };
      });

      const retiredNames = Object.values(retiredByTeam)
        .flat()
        .map((id) => finalPlayersById[id]?.name)
        .filter(Boolean);

      // Resolve promotion/relegation across the whole pyramid from this
      // season's final standings (using the pre-reset records captured in
      // finalTeams/otherDivisions), then start every division fresh.
      const resolved = resolvePyramid({
        ...otherDivisions,
        [state.activeDivisionId]: { ...otherDivisions[state.activeDivisionId], teams: finalTeams },
      });
      const newActiveDivisionId = findDivisionOf(resolved, state.userTeamId) || state.activeDivisionId;
      const newActive = resolved[newActiveDivisionId];
      const newOtherDivisions = Object.fromEntries(
        Object.entries(resolved).filter(([id]) => id !== newActiveDivisionId)
      );

      const movedDivision = newActiveDivisionId !== state.activeDivisionId;
      const nextSeasonYear = (state.seasonYear || FIRST_SEASON_YEAR) + 1;
      const nextSeasonDate = `${nextSeasonYear}-07-01`;

      const messages = [
        ...roundLog,
        retiredNames.length
          ? `Nueva temporada. Se retiran: ${retiredNames.join(", ")}.`
          : "Nueva temporada.",
      ];
      if (movedDivision) {
        const divisionName = newActive.name || newActiveDivisionId;
        messages.unshift(`¡Tu equipo cambia de categoría! Ahora juegas en ${divisionName}.`);
      }

      return {
        ...state,
        teams: newActive.teams,
        playersById: finalPlayersById,
        schedule: newActive.schedule,
        round: 0,
        results: [],
        lastRoundResults: roundResults,
        pendingContracts,
        activeDivisionId: newActiveDivisionId,
        otherDivisions: newOtherDivisions,
        log: pushLog(nextSeasonDate, state.log, messages),
        seasonYear: nextSeasonYear,
        currentDate: nextSeasonDate,
        preseasonWeeksLeft: PRESEASON_WEEKS,
      };
    }

    default:
      return state;
  }
}

export function GameProvider({ children, loadingFallback = null }) {
  const [ready, setReady] = useState(false);
  const [state, dispatch] = useReducer(reducer, null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = null;
      try {
        const raw = await AsyncStorage.getItem(SAVE_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (e) {
        // ignore corrupt save
      }
      if (cancelled) return;
      dispatch(saved ? { type: "LOAD", state: normalizeState(saved) } : { type: "NEW_GAME" });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(SAVE_KEY, JSON.stringify(state)).catch(() => {
      // storage full or unavailable, ignore
    });
  }, [ready, state]);

  if (!ready) return loadingFallback;

  async function saveSnapshot() {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(state));
  }

  async function loadSnapshot() {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return false;
    dispatch({ type: "LOAD", state: normalizeState(JSON.parse(raw)) });
    return true;
  }

  return (
    <GameContext.Provider value={{ state, dispatch, saveSnapshot, loadSnapshot }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
