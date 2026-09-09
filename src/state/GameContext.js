import { createContext, useContext, useReducer, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import {
  generateRealLeague,
  generateAcbDivision,
  generateSegundaFebDivision,
  generateTerceraFebDivision,
  makePlayer,
} from "../data/generate";
import {
  simulateBackgroundDivision,
  resolvePyramid,
  findGroupOf,
  makeGroup,
  makeDivision,
  assembleActiveDivision,
  DIVISION_META,
  DIVISION_ORDER,
} from "../engine/pyramid";
import { simulateMatch, OFFENSE_TACTICS, DEFENSE_TACTICS } from "../engine/simulate";
import { getUpgradeTiers } from "../engine/stadium";
import {
  generateStaffCandidates,
  currentRoleTier,
  formRecoveryBonus,
  injuryRecoveryChance,
  moraleBonus,
  scoutTierIndex,
} from "../engine/staff";
import { leaguePosition, sortStandings } from "../engine/standings";
import {
  playerWageTotal,
  staffWageTotal,
  stadiumMaintenance,
  sponsorIncome,
  getJerseySponsorOffers,
  getStadiumSponsorOffers,
  tvRightsIncome,
  maxLoanAmount,
  previewLoanTerms,
  advanceLoan,
  LOAN_TERM_WEEKS,
} from "../engine/finance";
import { seasonAgeStep, shouldRetire, evaluateContractOffer } from "../engine/career";
import { FOREIGN_PLAYER_QUOTA, isForeign } from "../engine/rules";
import { getAmenityOptions, amenityAttendanceBonus, amenityPriceTolerance } from "../engine/amenities";
import { evaluateTransferOffer, canRealisticallySign } from "../engine/transfers";

const SAVE_KEY = "pcbasket-save-v1";
const SNAPSHOT_KEY = "pcbasket-snapshot-v1";
const BASE_TICKET_PRICE = 25; // starting price in generate.js, reference for "reasonable"
const MAX_TICKET_PRICE = 100;
// Season ticket = this many single-game tickets, paid upfront as one lump
// sum before a ball is bounced — was 15x, which combined with a generous
// holder rate could hand out a lump bigger than a team's whole starting
// budget in one shot.
const SEASON_TICKET_MULTIPLIER = 9;
const MAX_ACADEMY_SIZE = 5;
// The league proper (state.schedule) doesn't kick off until September — this
// many fictional weeks of preseason come first so there's time to use the
// market, staff and stadium screens before round 0 is playable.
const PRESEASON_WEEKS = 6;
const FIRST_SEASON_YEAR = 2025;
const LOG_RETENTION_DAYS = 30;
// A club can't stay insolvent forever: this many consecutive jornadas with
// a negative budget triggers a forced fire-sale (see applyRedNumbersConsequence).
const RED_STREAK_LIMIT = 4;

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

// Moves one player from seller to buyer at the given price — shared by
// BUY_PLAYER (instant, at asking value) and the negotiated-offer paths
// (MAKE_OFFER, RESOLVE_OFFER), which settle at whatever amount was agreed.
function transferPlayer(teams, playerId, sellerId, buyerId, price) {
  return teams.map((t) => {
    if (t.id === sellerId) {
      return {
        ...t,
        budget: t.budget + price,
        roster: t.roster.filter((id) => id !== playerId),
        lineup: Object.fromEntries(
          Object.entries(t.lineup).map(([pos, id]) => [pos, id === playerId ? null : id])
        ),
      };
    }
    if (t.id === buyerId) {
      return { ...t, budget: t.budget - price, roster: [...t.roster, playerId] };
    }
    return t;
  });
}

// Players from every division share one pool (see generate.js), but only
// the active division's teams live in state.teams — the rest sit nested in
// state.otherDivisions[divisionId].groups[].teams. These two helpers find
// and patch a team wherever it actually lives, so the transfer market can
// let the user sign a player from a division they aren't currently playing
// in (see BUY_PLAYER/MAKE_OFFER below).
export function findTeamAnywhere(state, teamId) {
  const active = state.teams.find((t) => t.id === teamId);
  if (active) return active;
  for (const division of Object.values(state.otherDivisions)) {
    for (const group of division.groups || []) {
      const found = group.teams.find((t) => t.id === teamId);
      if (found) return found;
    }
  }
  return null;
}

// Same shape as transferPlayer above, but resolves the seller wherever it
// lives (active division or nested in otherDivisions) instead of assuming
// it's in `teams`. The buyer is always the active division's own team.
function transferPlayerAnywhere(state, playerId, sellerId, buyerId, price) {
  if (state.teams.some((t) => t.id === sellerId)) {
    return { teams: transferPlayer(state.teams, playerId, sellerId, buyerId, price), otherDivisions: state.otherDivisions };
  }
  const teams = state.teams.map((t) =>
    t.id === buyerId ? { ...t, budget: t.budget - price, roster: [...t.roster, playerId] } : t
  );
  const otherDivisions = { ...state.otherDivisions };
  for (const [divId, division] of Object.entries(otherDivisions)) {
    const groups = division.groups || [];
    const groupIdx = groups.findIndex((g) => g.teams.some((t) => t.id === sellerId));
    if (groupIdx === -1) continue;
    const newGroups = groups.map((g, i) =>
      i !== groupIdx
        ? g
        : {
            ...g,
            teams: g.teams.map((t) =>
              t.id === sellerId
                ? {
                    ...t,
                    budget: t.budget + price,
                    roster: t.roster.filter((id) => id !== playerId),
                    lineup: Object.fromEntries(
                      Object.entries(t.lineup || {}).map(([pos, id]) => [pos, id === playerId ? null : id])
                    ),
                  }
                : t
            ),
          }
    );
    otherDivisions[divId] = { ...division, groups: newGroups };
    break;
  }
  return { teams, otherDivisions };
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Each capacity-tier expansion (stadium.level) makes the venue harder to
// fill as a fraction of seats — a bigger bowl doesn't sell itself just
// because it exists. Amenities counter this by making the atmosphere worth
// the extra seats, so subtract their attendance bonus from the penalty.
function fillDifficultyFactor(stadium) {
  const tiersBuilt = Math.max(0, stadium.level - 1);
  const penalty = Math.max(0, tiersBuilt * 0.07 - amenityAttendanceBonus(stadium));
  return clamp(1 - penalty, 0.55, 1);
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
  const base = 0.05 + positionFactor * 0.1 + priceFactor * 0.05 + amenityAttendanceBonus(team.stadium);
  return clamp(
    (base + (Math.random() - 0.5) * 0.06) * fillDifficultyFactor(team.stadium),
    0.03,
    0.45
  );
}

// Season ticket holders lock in a chunk of capacity at the start of the
// season (paid upfront, in ADVANCE_PRESEASON below) — no position factor,
// since standings just reset and can't judge demand yet, only amenities and
// how the season ticket price compares to a normal ticket's own reference.
// Capacity-tier upgrades and amenity builds are paid upfront (on purchase)
// but take real weeks before the crowd/price actually changes — ticked down
// once per week by advanceStadiumProject below (called from both SIM_ROUND
// and every ADVANCE_PRESEASON tick, since both represent a week passing).
const STADIUM_TIER_BUILD_WEEKS = { small: 2, medium: 3, large: 5 };
const AMENITY_BUILD_WEEKS = 2;

function advanceStadiumProject(stadium) {
  const project = stadium.pendingProject;
  if (!project) return { stadium, completedLabel: null };
  const weeksLeft = project.weeksLeft - 1;
  if (weeksLeft > 0) {
    return { stadium: { ...stadium, pendingProject: { ...project, weeksLeft } }, completedLabel: null };
  }
  const next = { ...stadium, pendingProject: null };
  if (project.kind === "tier") {
    next.level = stadium.level + 1;
    next.capacity = stadium.capacity + project.capacityGain;
  } else {
    next.amenities = { ...(stadium.amenities || {}), [project.amenityId]: project.level };
  }
  return { stadium: next, completedLabel: project.label };
}

function seasonTicketRate(stadium) {
  const priceReference = (BASE_TICKET_PRICE + amenityPriceTolerance(stadium)) * SEASON_TICKET_MULTIPLIER;
  const priceFactor = clamp(
    1 - (Math.max(0, (stadium.seasonTicketPrice || 0) - priceReference) / priceReference) * 0.6,
    0.2,
    1
  );
  const base = 0.18 + amenityAttendanceBonus(stadium) * 2;
  return clamp(base * priceFactor * fillDifficultyFactor(stadium), 0.05, 0.4);
}

// Only tracked/enforced for the user's own team — AI teams' budgets aren't
// surfaced to the player and don't need this. Mutates playersById in place
// (already a fresh per-round copy) and pushes a news entry to roundLog when
// it fires; returns the (possibly patched) teams array.
function applyRedNumbersConsequence(teams, playersById, userTeamId, roundLog) {
  const team = teams.find((t) => t.id === userTeamId);
  if (!team) return teams;
  const redStreak = team.budget < 0 ? (team.redStreak || 0) + 1 : 0;
  if (redStreak < RED_STREAK_LIMIT) {
    return redStreak === (team.redStreak || 0)
      ? teams
      : teams.map((t) => (t.id === userTeamId ? { ...t, redStreak } : t));
  }
  const starterIds = new Set(Object.values(team.lineup).filter(Boolean));
  const sellable = team.roster
    .filter((id) => !starterIds.has(id))
    .map((id) => playersById[id])
    .filter(Boolean)
    .sort((a, b) => a.value - b.value);
  const sold = sellable[0];
  if (!sold) {
    // No bench player to sell off (down to the starting five) — nothing more
    // to force; keep counting so a message could fire again once there is.
    return teams.map((t) => (t.id === userTeamId ? { ...t, redStreak } : t));
  }
  const price = Math.round(sold.value * 0.7);
  playersById[sold.id] = { ...sold, teamId: null };
  roundLog.push(
    `Intervención por números rojos: la liga obligó a vender a ${sold.name} de urgencia por €${price.toLocaleString()}.`
  );
  return teams.map((t) =>
    t.id === userTeamId
      ? { ...t, budget: t.budget + price, roster: t.roster.filter((id) => id !== sold.id), redStreak: 0 }
      : t
  );
}

const BACKGROUND_GENERATORS = {
  acb: { generate: generateAcbDivision, singleGroup: true },
  primerafeb: { generate: generateRealLeague, singleGroup: true },
  segundafeb: { generate: generateSegundaFebDivision, singleGroup: false },
  tercerafeb: { generate: generateTerceraFebDivision, singleGroup: false },
};

// Migrates one background division to the current {name, groups: [...]}
// shape. A division already in that shape is left untouched. Anything else
// (missing entirely, or the old single-group-per-division shape from
// before Segunda FEB/Tercera FEB grew real geographic groups) has no
// meaningful history to reconstruct — the AI-only background tiers just
// start fresh. If this division happens to be the one the save's user is
// CURRENTLY playing in, the live top-level state (teams/schedule/round)
// already covers one of its groups, so the freshly generated first group
// is dropped (kept teams' players filtered accordingly) rather than
// duplicating/colliding with it — everything else becomes its siblings.
function migrateBackgroundDivision(divisionId, existing, activeDivisionId) {
  if (existing?.groups) return { division: existing, extraPlayers: [] };

  const { generate, singleGroup } = BACKGROUND_GENERATORS[divisionId];
  const fresh = generate();
  const isActive = divisionId === activeDivisionId;

  if (singleGroup) {
    if (isActive) return { division: null, extraPlayers: [] };
    return {
      division: makeDivision(DIVISION_META[divisionId].name, [{ id: "main", teams: fresh.teams }]),
      extraPlayers: fresh.players,
    };
  }

  const groupSpecs = isActive ? fresh.groups.slice(1) : fresh.groups;
  const keptTeamIds = new Set(groupSpecs.flatMap((g) => g.teams.map((t) => t.id)));
  return {
    division: groupSpecs.length ? makeDivision(DIVISION_META[divisionId].name, groupSpecs) : null,
    extraPlayers: fresh.players.filter((p) => keptTeamIds.has(p.teamId)),
  };
}

// Backfills fields added after a save/snapshot was written, so old saves
// (missing team.staff or player.form) don't crash newer game logic.
function normalizeState(loaded) {
  if (!loaded) return loaded;

  const activeDivisionId = loaded.activeDivisionId ?? "primerafeb";
  const otherDivisions = {};
  let extraPlayers = [];
  for (const divisionId of DIVISION_ORDER) {
    const migrated = migrateBackgroundDivision(divisionId, loaded.otherDivisions?.[divisionId], activeDivisionId);
    if (migrated.division) otherDivisions[divisionId] = migrated.division;
    extraPlayers.push(...migrated.extraPlayers);
  }

  const playersById = Object.fromEntries(
    Object.entries(loaded.playersById).map(([id, p]) => [
      id,
      {
        ...p,
        form: Math.round(p.form ?? 99),
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
        seasonTicketPrice: t.stadium.seasonTicketPrice ?? t.stadium.ticketPrice * SEASON_TICKET_MULTIPLIER,
        seasonTicketHolders: t.stadium.seasonTicketHolders ?? 0,
      },
      financeHistory: t.financeHistory ?? [],
      tactics: t.tactics ?? { offense: "balanced", defense: "man" },
      scoutCooldown: t.scoutCooldown ?? null,
      scoutSearchTotal: t.scoutSearchTotal ?? null,
      loan: t.loan ?? null,
    })),
    playersById,
    pendingContracts: loaded.pendingContracts ?? [],
    pendingOffers: loaded.pendingOffers ?? [],
    activeDivisionId,
    // No save from before groups existed could have had the user resident
    // in anything but a division's sole/first group.
    activeGroupId: loaded.activeGroupId ?? "main",
    otherDivisions,
    log,
    seasonYear: loaded.seasonYear ?? FIRST_SEASON_YEAR,
    currentDate,
    preseasonWeeksLeft: loaded.preseasonWeeksLeft ?? 0,
    lastSeasonSummary: loaded.lastSeasonSummary ?? null,
  };
}

function freshGame() {
  const primera = generateRealLeague();
  const acb = generateAcbDivision();
  const segunda = generateSegundaFebDivision();
  const tercera = generateTerceraFebDivision();

  // One shared player pool across all four divisions (ids are guaranteed
  // unique per division prefix) — a team moving between divisions on
  // promotion/relegation just needs its team object moved, its roster ids
  // already resolve against this same map either way.
  const playersById = Object.fromEntries(
    [...primera.players, ...acb.players, ...segunda.players, ...tercera.players].map((p) => [p.id, p])
  );

  const primeraGroup = makeGroup("main", primera.teams);

  return {
    teams: primera.teams,
    playersById,
    schedule: primeraGroup.schedule,
    round: 0,
    userTeamId: null,
    teamChosen: false,
    results: [], // flat list of played matches
    lastRoundResults: [],
    pendingContracts: [],
    pendingOffers: [],
    log: [],
    seasonYear: FIRST_SEASON_YEAR,
    currentDate: `${FIRST_SEASON_YEAR}-07-01`,
    preseasonWeeksLeft: PRESEASON_WEEKS,
    lastSeasonSummary: null,
    activeDivisionId: "primerafeb",
    activeGroupId: "main",
    otherDivisions: {
      acb: makeDivision("ACB", [{ id: "main", teams: acb.teams }]),
      segundafeb: makeDivision("Segunda FEB", segunda.groups),
      tercerafeb: makeDivision("Tercera FEB", tercera.groups),
    },
  };
}

const GameContext = createContext(null);

export function reducer(state, action) {
  switch (action.type) {
    case "NEW_GAME":
      return freshGame();

    case "CHOOSE_TEAM": {
      // The user can pick a team from any division at the pyramid, not just
      // the default active one (Primera FEB) — if the pick lives elsewhere,
      // swap that division's live group into the top-level state (mirroring
      // the same active-division swap the season-rollover promotion/
      // relegation logic does), sending the old active division wholesale
      // into otherDivisions.
      const activeDivision = assembleActiveDivision(state);
      const divisions = { ...state.otherDivisions, [state.activeDivisionId]: activeDivision };
      const found = findGroupOf(divisions, action.teamId);
      if (!found) return state;
      if (found.divisionId === state.activeDivisionId) {
        return { ...state, userTeamId: action.teamId, teamChosen: true };
      }

      const newActiveDivision = divisions[found.divisionId];
      const newActive = newActiveDivision.groups.find((g) => g.id === found.groupId);
      const siblingGroups = newActiveDivision.groups.filter((g) => g.id !== found.groupId);

      const newOtherDivisions = { ...state.otherDivisions };
      delete newOtherDivisions[found.divisionId];
      newOtherDivisions[state.activeDivisionId] = activeDivision;
      if (siblingGroups.length) {
        newOtherDivisions[found.divisionId] = { name: newActiveDivision.name, groups: siblingGroups };
      }

      return {
        ...state,
        teams: newActive.teams,
        schedule: newActive.schedule,
        round: newActive.round,
        results: newActive.results,
        lastRoundResults: newActive.lastRoundResults,
        activeDivisionId: found.divisionId,
        activeGroupId: found.groupId,
        otherDivisions: newOtherDivisions,
        userTeamId: action.teamId,
        teamChosen: true,
      };
    }

    case "LOAD":
      return action.state;

    case "ADVANCE_PRESEASON": {
      if ((state.preseasonWeeksLeft || 0) <= 0) return state;
      const preseasonWeeksLeft = state.preseasonWeeksLeft - 1;
      const currentDate = addDays(state.currentDate, 7);

      // Every preseason week also counts toward any in-progress stadium
      // project (ampliación/instalación) and any outstanding loan payment,
      // same as a regular season week.
      let log = state.log;
      const advancedTeams = state.teams.map((t) => {
        const { stadium, completedLabel } = advanceStadiumProject(t.stadium);
        if (completedLabel && t.id === state.userTeamId) {
          log = pushLog(currentDate, log, `Obra terminada: ${completedLabel}.`);
        }
        const withStadium = stadium === t.stadium ? t : { ...t, stadium };
        const withLoan = advanceLoan(withStadium);
        if (withStadium.loan && !withLoan.loan && t.id === state.userTeamId) {
          log = pushLog(currentDate, log, "Crédito saldado.");
        }
        return withLoan;
      });

      // Last tick before the league kicks off: lock in this season's season
      // ticket holders (paid upfront, one lump sum) for every team in the
      // active division — after this the remaining "walk-up" capacity is
      // what SIM_ROUND sells game by game.
      if (preseasonWeeksLeft > 0) {
        return { ...state, preseasonWeeksLeft, currentDate, teams: advancedTeams, log };
      }

      const teams = advancedTeams.map((t) => {
        const holders = Math.round(t.stadium.capacity * seasonTicketRate(t.stadium));
        const lumpSum = holders * t.stadium.seasonTicketPrice;
        if (t.id === state.userTeamId) {
          log = pushLog(
            currentDate,
            log,
            `Abonos vendidos: ${holders.toLocaleString()} (+€${lumpSum.toLocaleString()})`
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
      const seller = findTeamAnywhere(state, player.teamId);
      const buyer = state.teams.find((t) => t.id === buyerTeamId);
      if (!buyer || !seller || buyer.id === seller.id) return state;
      // Listed AI players sell at a discount off their value so the user can
      // build a squad cheaply and climb divisions faster.
      const price = Math.round(player.value * 0.85);
      if (buyer.budget < price) return state;
      if (buyer.roster.length >= 15) return state;
      if (!canRealisticallySign(buyer, player, state.playersById)) return state;

      const { teams, otherDivisions } = transferPlayerAnywhere(state, playerId, seller.id, buyer.id, price);
      const playersById = {
        ...state.playersById,
        [playerId]: { ...player, teamId: buyer.id, listed: false },
      };

      return {
        ...state,
        teams,
        otherDivisions,
        playersById,
        log: pushLog(state.currentDate, state.log, `${player.name} fichado por ${buyer.name} por €${price.toLocaleString()}`),
      };
    }

    case "MAKE_OFFER": {
      const { buyerTeamId, playerId, amount } = action;
      const player = state.playersById[playerId];
      if (!player) return state;
      const seller = findTeamAnywhere(state, player.teamId);
      const buyer = state.teams.find((t) => t.id === buyerTeamId);
      if (!buyer || !seller || buyer.id === seller.id) return state;
      const price = clamp(Math.round(amount), 1, player.value);
      if (buyer.budget < price) return state;
      if (buyer.roster.length >= 15) return state;
      if (!canRealisticallySign(buyer, player, state.playersById)) return state;

      const outcome = evaluateTransferOffer(player, price);

      if (outcome.result === "accept") {
        const { teams, otherDivisions } = transferPlayerAnywhere(state, playerId, seller.id, buyer.id, price);
        const playersById = {
          ...state.playersById,
          [playerId]: { ...player, teamId: buyer.id, listed: false },
        };
        return {
          ...state,
          teams,
          otherDivisions,
          playersById,
          log: pushLog(
            state.currentDate,
            state.log,
            `${seller.name} aceptó €${price.toLocaleString()} de ${buyer.name} por ${player.name}`
          ),
        };
      }

      if (outcome.result === "counter") {
        return {
          ...state,
          log: pushLog(
            state.currentDate,
            state.log,
            `${seller.name} pide al menos €${outcome.counterAmount.toLocaleString()} por ${player.name}`
          ),
        };
      }

      return {
        ...state,
        log: pushLog(state.currentDate, state.log, `${seller.name} rechazó la oferta por ${player.name}`),
      };
    }

    case "RESOLVE_OFFER": {
      const { offerId, accept } = action;
      const offer = state.pendingOffers.find((o) => o.id === offerId);
      if (!offer) return state;
      const pendingOffers = state.pendingOffers.filter((o) => o.id !== offerId);
      const player = state.playersById[offer.playerId];
      const seller = state.teams.find((t) => t.id === state.userTeamId);
      const buyer = state.teams.find((t) => t.id === offer.fromTeamId);

      if (!accept || !player || !seller || !buyer || buyer.budget < offer.amount || buyer.roster.length >= 15) {
        return {
          ...state,
          pendingOffers,
          log: accept
            ? state.log
            : pushLog(
                state.currentDate,
                state.log,
                `Rechazaste la oferta de €${offer.amount.toLocaleString()} por ${player?.name || "un jugador"}`
              ),
        };
      }

      const teams = transferPlayer(state.teams, offer.playerId, seller.id, buyer.id, offer.amount);
      const playersById = {
        ...state.playersById,
        [offer.playerId]: { ...player, teamId: buyer.id, listed: false },
      };
      return {
        ...state,
        teams,
        playersById,
        pendingOffers,
        log: pushLog(
          state.currentDate,
          state.log,
          `Aceptaste €${offer.amount.toLocaleString()} de ${buyer.name} por ${player.name}`
        ),
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
            `${player.name} renovó ${offeredYears} año(s) por €${offeredWage.toLocaleString()}/jornada`
          ),
        };
      }

      if (outcome.result === "counter") {
        return {
          ...state,
          log: pushLog(
            state.currentDate,
            state.log,
            `${player.name} pide al menos €${outcome.counterWage.toLocaleString()}/jornada`
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
      if (team.stadium.pendingProject) return state;
      const tier = getUpgradeTiers(team.stadium).find((t) => t.id === tierId);
      if (!tier) return state;
      if (team.budget < tier.cost) return state;
      const weeksLeft = STADIUM_TIER_BUILD_WEEKS[tier.id] ?? 3;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - tier.cost,
              stadium: {
                ...t.stadium,
                pendingProject: {
                  kind: "tier",
                  label: tier.label,
                  capacityGain: tier.capacityGain,
                  weeksLeft,
                  weeksTotal: weeksLeft,
                },
              },
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(
          state.currentDate,
          state.log,
          `${team.name} inicia obra: ${tier.label} (${weeksLeft} semanas)`
        ),
      };
    }

    case "BUILD_AMENITY": {
      const { teamId, amenityId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      if (team.stadium.pendingProject) return state;
      const option = getAmenityOptions(team.stadium).find((a) => a.id === amenityId);
      if (!option || option.maxed) return state;
      if (team.budget < option.cost) return state;
      const weeksLeft = AMENITY_BUILD_WEEKS;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - option.cost,
              stadium: {
                ...t.stadium,
                pendingProject: {
                  kind: "amenity",
                  label: `${option.label} → ${option.nextTierName}`,
                  amenityId,
                  level: option.level + 1,
                  weeksLeft,
                  weeksTotal: weeksLeft,
                },
              },
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(
          state.currentDate,
          state.log,
          `${team.name} inicia obra: ${option.label} (${weeksLeft} semanas)`
        ),
      };
    }

    case "HIRE_STAFF_ROLE": {
      const { teamId, roleId, candidateId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const candidate = generateStaffCandidates(team.staff, roleId, state.round, team.wageScale ?? 1).find(
        (c) => c.candidateId === candidateId
      );
      if (!candidate) return state;
      if (team.budget < candidate.hireCost) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - candidate.hireCost,
              staff: {
                ...t.staff,
                [roleId]: {
                  tierId: candidate.id,
                  wage: candidate.wage,
                  hireCost: candidate.hireCost,
                  name: candidate.name,
                },
              },
              // A newly hired scout starts a fresh search cycle.
              scoutCooldown: roleId === "scout" ? null : t.scoutCooldown,
              scoutSearchTotal: roleId === "scout" ? null : t.scoutSearchTotal,
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(
          state.currentDate,
          state.log,
          `${team.name} contrató a ${candidate.name} (${candidate.label})`
        ),
      };
    }

    case "FIRE_STAFF_ROLE": {
      const { teamId, roleId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const tier = currentRoleTier(team.staff, roleId, team.wageScale ?? 1);
      if (!tier) return state;
      const severance = tier.wage * state.schedule.length;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - severance,
              staff: { ...t.staff, [roleId]: null },
              scoutCooldown: roleId === "scout" ? null : t.scoutCooldown,
              scoutSearchTotal: roleId === "scout" ? null : t.scoutSearchTotal,
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(
          state.currentDate,
          state.log,
          `${team.name} despidió a ${tier.name ? `${tier.name} (${tier.label})` : tier.label} (indemnización €${severance.toLocaleString()})`
        ),
      };
    }

    case "SELECT_SPONSOR": {
      const { teamId, slot, sponsorId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      // A signed deal runs for the rest of the season — no swapping to a
      // better offer mid-contract, only once the slot is empty again.
      if (team.sponsors?.[slot]) return state;
      const offers =
        slot === "stadium"
          ? getStadiumSponsorOffers(team, state.teams, state.activeDivisionId, state.playersById)
          : getJerseySponsorOffers(team, state.teams, state.activeDivisionId, state.playersById);
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
      const ticketPrice = clamp(Math.round(price), 5, MAX_TICKET_PRICE);
      const teams = state.teams.map((t) =>
        t.id === teamId ? { ...t, stadium: { ...t.stadium, ticketPrice } } : t
      );
      return { ...state, teams };
    }

    case "SET_SEASON_TICKET_PRICE": {
      const { teamId, price } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const seasonTicketPrice = clamp(Math.round(price), 30, MAX_TICKET_PRICE * SEASON_TICKET_MULTIPLIER);
      const teams = state.teams.map((t) =>
        t.id === teamId ? { ...t, stadium: { ...t.stadium, seasonTicketPrice } } : t
      );
      return { ...state, teams };
    }

    case "REQUEST_LOAN": {
      const { teamId, amount } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      if (team.loan) return state;
      const cap = maxLoanAmount(team, state.playersById);
      const principal = clamp(Math.round(amount), 1000, cap);
      const { remaining, weeklyPayment } = previewLoanTerms(principal);
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget + principal,
              loan: { principal, remaining, weeklyPayment, weeksLeft: LOAN_TERM_WEEKS },
            }
          : t
      );
      return {
        ...state,
        teams,
        log: pushLog(
          state.currentDate,
          state.log,
          `${team.name} pidió un crédito de €${principal.toLocaleString()} (a devolver €${remaining.toLocaleString()} en ${LOAN_TERM_WEEKS} semanas)`
        ),
      };
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

      // Almost every round an AI team tries to poach one of the user's
      // players with an unsolicited (overpaying) bid — unlike the
      // listed-player sales above, this can't auto-resolve: it goes into
      // pendingOffers for the user to accept or reject from the transfer
      // market screen.
      const newOffers = [];
      if (state.userTeamId && Math.random() < 0.9) {
        const userTeamNow = teamsById[state.userTeamId];
        const offeredIds = new Set(state.pendingOffers.map((o) => o.playerId));
        const candidateIds = (userTeamNow?.roster || []).filter((id) => !offeredIds.has(id));
        if (candidateIds.length > 0) {
          const targetId = candidateIds[randInt(0, candidateIds.length - 1)];
          const target = playersById[targetId];
          // Richest-first so the overpay offer actually lands even in a
          // division whose typical team budget sits well under transfer
          // value (values don't scale down by division the way wages do) —
          // picking a random bidder here meant the affordability check
          // below silently dropped the offer most rounds in Segunda/Tercera
          // FEB, leaving the user with none.
          const bidders = Object.values(teamsById)
            .filter((t) => t.id !== state.userTeamId && t.roster.length < 15)
            .sort((a, b) => b.budget - a.budget);
          if (target && bidders.length > 0) {
            const desired = Math.round(target.value * (0.95 + Math.random() * 0.35));
            const bidder = bidders[0];
            // AI bidders overpay for the user's players so selling is
            // consistently profitable — the flip side of the buy-cheap
            // discount above. Clamp to what the richest bidder can actually
            // pay rather than dropping the offer outright; only skip if
            // even that falls short of a fair price.
            const amount = Math.min(desired, bidder.budget);
            if (amount >= Math.round(target.value * 0.7)) {
              newOffers.push({
                id: `offer_${state.round}_${targetId}_${bidder.id}`,
                playerId: targetId,
                fromTeamId: bidder.id,
                amount,
              });
              roundLog.push(`${bidder.name} ofrece €${amount.toLocaleString()} por ${target.name}`);
            }
          }
        }
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
        const scoutSearchTotals = { home: null, away: null };
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
                form: clamp(Math.round((next.form ?? 99) - loss), 40, 99),
                seasonMinutes: (next.seasonMinutes || 0) + played.minutes,
              };
            } else {
              next = { ...next, form: clamp(Math.round((next.form ?? 99) + 3 + recovery), 40, 99) };
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
            scoutSearchTotals[teamRef] = null;
          } else {
            let cooldown = team.scoutCooldown == null ? randInt(13, 26) : team.scoutCooldown - 1;
            let total = team.scoutCooldown == null ? cooldown : team.scoutSearchTotal || cooldown + 1;
            if (cooldown <= 0) {
              if (team.academy.length < MAX_ACADEMY_SIZE) {
                const range = SCOUT_TIER_RANGES[tierIndex];
                const prospect = makePlayer({
                  age: randInt(16, 22),
                  base: randInt(range.base[0], range.base[1]),
                  spread: range.spread,
                  isProspect: true,
                  teamId: team.id,
                  wageScale: team.wageScale ?? 1,
                });
                playersById[prospect.id] = prospect;
                newProspects[teamRef] = prospect.id;
                cooldown = randInt(13, 26);
                total = cooldown;
                if (team.id === state.userTeamId) {
                  roundLog.push(`El ojeador encontró un nuevo prospecto de cantera: ${prospect.name}.`);
                }
              } else {
                cooldown = 1; // academy full — retry as soon as there's room
                total = 1;
              }
            }
            scoutCooldowns[teamRef] = cooldown;
            scoutSearchTotals[teamRef] = total;
          }
        }

        const sponsorAndTvIncome = (t) =>
          sponsorIncome(t.sponsors?.jersey) +
          sponsorIncome(t.sponsors?.stadium) +
          tvRightsIncome(state.activeDivisionId, t, state.teams);

        const homeWage = playerWageTotal(home, playersById) + staffWageTotal(home.staff || {}, home.wageScale ?? 1);
        const homeMaintenance = stadiumMaintenance(home.stadium, home.staff || {});
        const homeIncome = ticketRevenue + sponsorAndTvIncome(home);
        const homeExpenses = homeWage + homeMaintenance;

        const awayWage = playerWageTotal(away, playersById) + staffWageTotal(away.staff || {}, away.wageScale ?? 1);
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
          scoutSearchTotal: scoutSearchTotals.home,
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
          scoutSearchTotal: scoutSearchTotals.away,
        };
      }

      let teams = Object.values(teamsById).map((t) => {
        const { stadium, completedLabel } = advanceStadiumProject(t.stadium);
        if (completedLabel && t.id === state.userTeamId) {
          roundLog.push(`Obra terminada: ${completedLabel}.`);
        }
        const upd = teamUpdates[t.id];
        const withFinance = !upd
          ? stadium === t.stadium
            ? t
            : { ...t, stadium }
          : (() => {
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
                stadium,
                financeHistory,
                scoutCooldown: upd.scoutCooldown,
                scoutSearchTotal: upd.scoutSearchTotal,
                lastTicketRevenue: upd.ticketRevenue || 0,
                academy: upd.newProspectId ? [...t.academy, upd.newProspectId] : t.academy,
                record: {
                  wins: t.record.wins + upd.wins,
                  losses: t.record.losses + upd.losses,
                  pointsFor: t.record.pointsFor + upd.pf,
                  pointsAgainst: t.record.pointsAgainst + upd.pa,
                },
              };
            })();

        const withLoan = advanceLoan(withFinance);
        if (withFinance.loan && !withLoan.loan && t.id === state.userTeamId) {
          roundLog.push("Crédito saldado.");
        }
        return withLoan;
      });

      teams = applyRedNumbersConsequence(teams, playersById, state.userTeamId, roundLog);

      // Background divisions (the tiers/groups the user isn't currently
      // playing in) advance one round in lockstep, using the same match
      // engine but tracking only wins/losses/points — no boxscore, finance
      // or injury bookkeeping for teams the user doesn't manage.
      const otherDivisions = Object.fromEntries(
        Object.entries(state.otherDivisions).map(([id, div]) => [
          id,
          simulateBackgroundDivision(div, playersById),
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
          pendingOffers: newOffers.length ? [...state.pendingOffers, ...newOffers] : state.pendingOffers,
          currentDate: roundDate,
          log: roundLog.length ? pushLog(roundDate, state.log, roundLog) : state.log,
        };
      }

      // Season finished: age everyone, resolve retirements, flag contract
      // renewals for the user's team (AI teams auto-renew quietly), and
      // start a fresh season with a new schedule.
      let finalPlayersById = { ...playersById };
      const retiredByTeam = {};
      const userPlayerChanges = [];

      for (const team of teams) {
        for (const pid of team.roster) {
          const p = finalPlayersById[pid];
          if (!p) continue;
          const aged = seasonAgeStep(p, p.seasonMinutes || 0, team.wageScale ?? 1);
          const next = { ...p, ...aged };
          finalPlayersById[pid] = next;
          if (team.id === state.userTeamId && next.overall !== p.overall) {
            userPlayerChanges.push({
              playerId: pid,
              name: p.name,
              before: p.overall,
              after: next.overall,
            });
          }
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
        let roster = retiredSet ? t.roster.filter((id) => !retiredSet.has(id)) : t.roster;
        let lineup = retiredSet
          ? Object.fromEntries(Object.entries(t.lineup).map(([pos, id]) => [pos, retiredSet.has(id) ? null : id]))
          : t.lineup;

        if (t.id === state.userTeamId) {
          for (const pid of roster) {
            const p = finalPlayersById[pid];
            if (p && p.contractYears <= 0) pendingContracts.push(pid);
          }
        } else {
          // AI clubs don't quietly re-sign everyone whose contract lapses —
          // some walk into free agency instead, same as a user's rejected
          // renewal, so the free-agent pool actually refills each season.
          // Foreign players (harder for a club to keep long-term, per the
          // ACB-style quota) walk far more often, so the pool skews foreign.
          const releasedIds = [];
          for (const pid of roster) {
            const p = finalPlayersById[pid];
            if (!p || p.contractYears > 0) continue;
            const releaseChance = isForeign(p) ? 0.35 : 0.12;
            if (roster.length - releasedIds.length > 8 && Math.random() < releaseChance) {
              releasedIds.push(pid);
              finalPlayersById[pid] = { ...p, teamId: null, listed: false };
            } else {
              finalPlayersById[pid] = { ...p, contractYears: randInt(1, 3) };
            }
          }
          if (releasedIds.length) {
            const releasedSet = new Set(releasedIds);
            roster = roster.filter((id) => !releasedSet.has(id));
            lineup = Object.fromEntries(
              Object.entries(lineup).map(([pos, id]) => [pos, releasedSet.has(id) ? null : id])
            );
          }
        }

        // Record is left as-is (this season's real result) so promotion/
        // relegation can judge it — resolvePyramid resets it for everyone
        // once the whole pyramid's standings have been read.
        // Sponsorship deals run for the season they were signed in, not
        // beyond it — a fresh season means a fresh round of offers.
        return { ...t, roster, lineup, sponsors: { jersey: null, stadium: null } };
      });

      const retiredNames = Object.values(retiredByTeam)
        .flat()
        .map((id) => finalPlayersById[id]?.name)
        .filter(Boolean);

      // Resolve promotion/relegation across the whole pyramid from this
      // season's final standings (using the pre-reset records captured in
      // finalTeams/otherDivisions), then start every division fresh. The
      // active division's live group (finalTeams) is reassembled alongside
      // its stored sibling groups, if it has any (multi-group tier).
      const activeSiblingGroups = otherDivisions[state.activeDivisionId]?.groups || [];
      const preDivisions = {
        ...otherDivisions,
        [state.activeDivisionId]: {
          name: DIVISION_META[state.activeDivisionId].name,
          groups: [
            {
              id: state.activeGroupId,
              teams: finalTeams,
              schedule: state.schedule,
              round: state.round,
              results: state.results,
              lastRoundResults: state.lastRoundResults,
            },
            ...activeSiblingGroups,
          ],
        },
      };
      const resolved = resolvePyramid(preDivisions);
      const foundGroup = findGroupOf(resolved, state.userTeamId);
      const newActiveDivisionId = foundGroup?.divisionId || state.activeDivisionId;
      const newActiveGroupId = foundGroup?.groupId || state.activeGroupId;
      const newActiveDivision = resolved[newActiveDivisionId];
      const newActive = newActiveDivision.groups.find((g) => g.id === newActiveGroupId);

      // Champions come straight from this season's final (pre-reset)
      // standings; who moved is read off the id-set difference between the
      // pre- and post-resolvePyramid rosters — no need to re-run (and
      // duplicate the randomness of) the promotion playoff here.
      // Which division each team came FROM, so a team appearing in a new
      // division after resolvePyramid can be classified as promoted
      // (moved to a lower tier number) or relegated (higher tier number) —
      // a per-division id-set diff alone can't tell direction apart from
      // "some other team just relegated in".
      const divisionOfId = {};
      for (const divId of DIVISION_ORDER) {
        for (const g of preDivisions[divId].groups) {
          for (const t of g.teams) divisionOfId[t.id] = divId;
        }
      }
      const moves = [];
      for (const divId of DIVISION_ORDER) {
        for (const g of resolved[divId].groups) {
          for (const t of g.teams) {
            const from = divisionOfId[t.id];
            if (from && from !== divId) moves.push({ id: t.id, name: t.name, logoUrl: t.logoUrl, from, to: divId });
          }
        }
      }

      const seasonSummary = {
        seasonYear: state.seasonYear || FIRST_SEASON_YEAR,
        retiredNames,
        playerChanges: userPlayerChanges,
        userMoved: null,
        divisions: DIVISION_ORDER.map((divId) => {
          const pre = preDivisions[divId];
          const champions = pre.groups
            .map((g) => sortStandings(g.teams)[0])
            .filter(Boolean)
            .map((t) => ({ id: t.id, name: t.name, logoUrl: t.logoUrl }));
          const tier = DIVISION_META[divId].tier;
          const outgoing = moves.filter((m) => m.from === divId);
          return {
            id: divId,
            name: DIVISION_META[divId].name,
            champions,
            promoted: outgoing.filter((m) => DIVISION_META[m.to].tier < tier),
            relegated: outgoing.filter((m) => DIVISION_META[m.to].tier > tier),
          };
        }),
      };

      // Every division goes into otherDivisions wholesale, except the new
      // active one — only ITS non-active sibling groups do (its active
      // group is what the top-level state mirrors from here on).
      const newOtherDivisions = {};
      for (const divId of DIVISION_ORDER) {
        if (divId === newActiveDivisionId) {
          const siblings = resolved[divId].groups.filter((g) => g.id !== newActiveGroupId);
          if (siblings.length) newOtherDivisions[divId] = { name: resolved[divId].name, groups: siblings };
        } else {
          newOtherDivisions[divId] = resolved[divId];
        }
      }

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
        const divisionName = newActiveDivision.name || newActiveDivisionId;
        messages.unshift(`¡Tu equipo cambia de categoría! Ahora juegas en ${divisionName}.`);
        seasonSummary.userMoved = {
          from: DIVISION_META[state.activeDivisionId].name,
          to: DIVISION_META[newActiveDivisionId].name,
        };
      }

      return {
        ...state,
        teams: newActive.teams,
        playersById: finalPlayersById,
        schedule: newActive.schedule,
        round: 0,
        results: [],
        // Not last season's final result — this is a brand-new season with
        // no games played yet, so the dashboard's "last result" card must
        // show its empty state instead of stale data from the old season.
        lastRoundResults: [],
        pendingContracts,
        pendingOffers: [...state.pendingOffers, ...newOffers].filter((o) => finalPlayersById[o.playerId]),
        activeDivisionId: newActiveDivisionId,
        activeGroupId: newActiveGroupId,
        otherDivisions: newOtherDivisions,
        log: pushLog(nextSeasonDate, state.log, messages),
        seasonYear: nextSeasonYear,
        currentDate: nextSeasonDate,
        preseasonWeeksLeft: PRESEASON_WEEKS,
        lastSeasonSummary: seasonSummary,
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

  // Writes the current save to a real file and hands it to the OS share
  // sheet — lets the user actually keep a copy on their phone (Files app,
  // Drive, send to themselves...) instead of it only living inside the
  // app's own storage.
  async function exportToFile() {
    const teamName = state.teams.find((t) => t.id === state.userTeamId)?.name || "partida";
    const safeName = teamName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const fileName = `pcbasket-${safeName}-${state.currentDate || "save"}.json`;
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(state));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Guardar partida" });
    }
    return file.uri;
  }

  // Lets the user pick any file (their own exported save) and loads it in
  // place of the current game.
  async function importFromFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
    if (result.canceled || !result.assets?.[0]) return { ok: false, reason: "canceled" };
    try {
      const picked = new File(result.assets[0].uri);
      const parsed = JSON.parse(await picked.text());
      if (!parsed || typeof parsed !== "object" || !parsed.playersById || !parsed.teams) {
        return { ok: false, reason: "invalid" };
      }
      dispatch({ type: "LOAD", state: normalizeState(parsed) });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: "invalid" };
    }
  }

  return (
    <GameContext.Provider
      value={{ state, dispatch, saveSnapshot, loadSnapshot, exportToFile, importFromFile }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
