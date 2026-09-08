import { totalStaffWage, maintenanceReduction } from "./staff";
import { leaguePosition } from "./standings";

export function playerWageTotal(team, playersById) {
  return team.roster.reduce((sum, id) => sum + (playersById[id]?.wage || 0), 0);
}

export function staffWageTotal(staff) {
  return totalStaffWage(staff);
}

export function stadiumMaintenance(stadium, staff) {
  const base = Math.round(stadium.capacity * 0.4 + stadium.level * 2000);
  return Math.round(base * (1 - maintenanceReduction(staff)));
}

export function sponsorIncome(sponsor) {
  return sponsor?.incomePerRound || 0;
}

// Rough average ticket income per jornada: attendance swings round to round
// and only home games earn anything, so this uses a mid-range attendance
// figure halved for the ~50% of rounds played away — good enough to judge
// whether a team's finances are sustainable, not an exact prediction.
export function estimatedTicketIncomePerRound(stadium) {
  const midAttendance = 0.55;
  const walkUpCapacity = Math.max(0, stadium.capacity - (stadium.seasonTicketHolders || 0));
  return Math.round(walkUpCapacity * midAttendance * stadium.ticketPrice * 0.5);
}

// Season tickets are paid as one lump sum at season start — spread evenly
// across the season's rounds here just so the monthly finance view can show
// a steady figure instead of one huge spike.
export function amortizedSeasonTicketIncomePerRound(stadium, roundsInSeason) {
  if (!roundsInSeason) return 0;
  return Math.round(((stadium.seasonTicketHolders || 0) * (stadium.seasonTicketPrice || 0)) / roundsInSeason);
}

const JERSEY_SPONSOR_TIERS = [
  { id: "jersey_local", label: "Marca Local", incomePerRound: 3000, maxPosition: null },
  { id: "jersey_regional", label: "Marca Regional", incomePerRound: 8000, maxPosition: 12 },
  { id: "jersey_nacional", label: "Marca Nacional", incomePerRound: 18000, maxPosition: 4 },
];

const STADIUM_SPONSOR_TIERS = [
  { id: "stadium_local", label: "Naming Rights Local", incomePerRound: 2500, maxPosition: null },
  { id: "stadium_regional", label: "Naming Rights Regional", incomePerRound: 6500, maxPosition: 12 },
  { id: "stadium_nacional", label: "Naming Rights Nacional", incomePerRound: 14000, maxPosition: 4 },
];

// Offers available right now: better-paying sponsors want a team that's
// actually doing well in the league.
export function getJerseySponsorOffers(team, teams) {
  const position = leaguePosition(team, teams);
  return JERSEY_SPONSOR_TIERS.filter((t) => t.maxPosition === null || position <= t.maxPosition);
}

export function getStadiumSponsorOffers(team, teams) {
  const position = leaguePosition(team, teams);
  return STADIUM_SPONSOR_TIERS.filter((t) => t.maxPosition === null || position <= t.maxPosition);
}

// TV rights: automatic, not a deal you pick — higher divisions and a better
// league position both draw more broadcast money, same shape as ticket
// attendance's position factor.
const DIVISION_TV_BASE = { acb: 15000, primerafeb: 6000, segundafeb: 2000, tercerafeb: 800 };

export function tvRightsIncome(divisionId, team, teams) {
  const base = DIVISION_TV_BASE[divisionId] ?? DIVISION_TV_BASE.segundafeb;
  const position = leaguePosition(team, teams);
  const positionFactor = teams.length > 1 ? 1 - (position - 1) / (teams.length - 1) : 1;
  return Math.round(base * (0.4 + positionFactor * 0.6));
}

// A loan is a flat amount of interest on top of the principal, repaid in
// equal weekly installments over a fixed term — no compounding, no early
// payoff option. Only one loan can be outstanding at a time (enforced by
// the reducer). Ticked down weekly by advanceLoan below.
export const LOAN_TERM_WEEKS = 20;
export const LOAN_INTEREST_RATE = 0.08;

// How much a team can borrow, scaled to its own size instead of a flat cap —
// roughly one loan term's worth of its actual fixed costs (wages + staff +
// maintenance), so a small Tercera FEB team and a big ACB team each get a
// sane ceiling relative to what they could plausibly repay.
export function maxLoanAmount(team, playersById) {
  const weeklyFixedCosts =
    playerWageTotal(team, playersById) +
    staffWageTotal(team.staff || {}) +
    stadiumMaintenance(team.stadium, team.staff || {});
  return Math.max(20000, Math.round(weeklyFixedCosts * LOAN_TERM_WEEKS));
}

export function previewLoanTerms(principal) {
  const remaining = Math.round(principal * (1 + LOAN_INTEREST_RATE));
  const weeklyPayment = Math.ceil(remaining / LOAN_TERM_WEEKS);
  return { remaining, weeklyPayment };
}

export function advanceLoan(team) {
  if (!team.loan) return team;
  const payment = Math.min(team.loan.weeklyPayment, team.loan.remaining);
  const remaining = team.loan.remaining - payment;
  const weeksLeft = team.loan.weeksLeft - 1;
  const loan = remaining > 0 && weeksLeft > 0 ? { ...team.loan, remaining, weeksLeft } : null;
  return { ...team, budget: team.budget - payment, loan };
}
