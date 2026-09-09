import { totalStaffWage, maintenanceReduction } from "./staff";
import { leaguePosition } from "./standings";
import { averageRosterOverall } from "./transfers";

export function playerWageTotal(team, playersById) {
  return team.roster.reduce((sum, id) => sum + (playersById[id]?.wage || 0), 0);
}

export function staffWageTotal(staff, wageScale = 1) {
  return totalStaffWage(staff, wageScale);
}

// Proportional to capacity rather than a flat per-level fee — a flat fee
// calibrated for an ACB-sized venue used to swallow a small Segunda/Tercera
// FEB club's entire income on its own, regardless of how well it was run.
export function stadiumMaintenance(stadium, staff) {
  const levelMultiplier = 1 + (stadium.level - 1) * 0.4;
  const base = Math.round(stadium.capacity * 0.4 * levelMultiplier);
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
  { id: "jersey_local", label: "Marca Local", incomePerRound: 3000, maxRank: null },
  { id: "jersey_regional", label: "Marca Regional", incomePerRound: 8000, maxRank: 12 },
  { id: "jersey_nacional", label: "Marca Nacional", incomePerRound: 18000, maxRank: 4 },
];

const STADIUM_SPONSOR_TIERS = [
  { id: "stadium_local", label: "Naming Rights Local", incomePerRound: 2500, maxRank: null },
  { id: "stadium_regional", label: "Naming Rights Regional", incomePerRound: 6500, maxRank: 12 },
  { id: "stadium_nacional", label: "Naming Rights Nacional", incomePerRound: 14000, maxRank: 4 },
];

// Sponsorship deals scale with the division too — a Tercera FEB shirt deal
// and an ACB one aren't remotely the same money. Tiers above are the base
// (sub-ACB) list prices; this scales them per division, same relative shape
// as DIVISION_TV_BASE below. ACB's own multiplier is well above 1 — a real
// top-flight shirt/naming-rights deal runs into the millions per season for
// a club near the top of the table, nothing like the honest-but-modest FEB
// figures the base tiers were tuned for.
const DIVISION_SPONSOR_SCALE = { acb: 5, primerafeb: 0.3, segundafeb: 0.1, tercerafeb: 0.03 };

function scaleSponsorTiers(tiers, divisionId) {
  const scale = DIVISION_SPONSOR_SCALE[divisionId] ?? DIVISION_SPONSOR_SCALE.segundafeb;
  return tiers.map((t) => ({ ...t, incomePerRound: Math.max(200, Math.round(t.incomePerRound * scale)) }));
}

// Ranked by squad quality (average roster overall) rather than league
// position — early in a season the standings are mostly noise (a couple of
// results either way), while a team's actual talent level is known from
// day one and doesn't swing with a single upset.
function overallRank(team, teams, playersById) {
  const ranked = [...teams].sort(
    (a, b) => averageRosterOverall(b, playersById) - averageRosterOverall(a, playersById)
  );
  return ranked.findIndex((t) => t.id === team.id) + 1;
}

// Offers available right now: better-paying sponsors want a genuinely
// strong squad, scaled to what a club at this level can actually command.
export function getJerseySponsorOffers(team, teams, divisionId, playersById) {
  const rank = overallRank(team, teams, playersById);
  return scaleSponsorTiers(JERSEY_SPONSOR_TIERS, divisionId).filter(
    (t) => t.maxRank === null || rank <= t.maxRank
  );
}

export function getStadiumSponsorOffers(team, teams, divisionId, playersById) {
  const rank = overallRank(team, teams, playersById);
  return scaleSponsorTiers(STADIUM_SPONSOR_TIERS, divisionId).filter(
    (t) => t.maxRank === null || rank <= t.maxRank
  );
}

// TV rights: automatic, not a deal you pick — higher divisions and a better
// league position both draw more broadcast money, same shape as ticket
// attendance's position factor. FEB divisions' real TV money is minimal to
// nonexistent below ACB, so these stay a token amount rather than a real
// income stream.
const DIVISION_TV_BASE = { acb: 15000, primerafeb: 1500, segundafeb: 400, tercerafeb: 100 };

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
    staffWageTotal(team.staff || {}, team.wageScale ?? 1) +
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
