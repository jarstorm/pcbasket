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
  return Math.round(stadium.capacity * midAttendance * stadium.ticketPrice * 0.5);
}

const SPONSOR_TIERS = [
  { id: "local", label: "Patrocinador Local", incomePerRound: 3000, maxPosition: null },
  { id: "regional", label: "Patrocinador Regional", incomePerRound: 8000, maxPosition: 12 },
  { id: "nacional", label: "Patrocinador Nacional", incomePerRound: 18000, maxPosition: 4 },
];

// Offers available right now: better-paying sponsors want a team that's
// actually doing well in the league.
export function getSponsorOffers(team, teams) {
  const position = leaguePosition(team, teams);
  return SPONSOR_TIERS.filter((t) => t.maxPosition === null || position <= t.maxPosition);
}
