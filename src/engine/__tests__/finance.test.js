import {
  playerWageTotal,
  staffWageTotal,
  stadiumMaintenance,
  sponsorIncome,
  getJerseySponsorOffers,
  getStadiumSponsorOffers,
  tvRightsIncome,
  estimatedTicketIncomePerRound,
  maxLoanAmount,
  previewLoanTerms,
  advanceLoan,
  LOAN_TERM_WEEKS,
} from "../finance";

function team(id, wins, losses, roster) {
  return { id, roster, record: { wins, losses, pointsFor: 0, pointsAgainst: 0 } };
}

describe("finance", () => {
  it("sums player wages for a team's roster", () => {
    const t = team("a", 0, 0, ["p1", "p2"]);
    const playersById = { p1: { wage: 1000 }, p2: { wage: 500 } };
    expect(playerWageTotal(t, playersById)).toBe(1500);
  });

  it("returns 0 staff wage with no one hired", () => {
    expect(staffWageTotal({})).toBe(0);
  });

  it("scales stadium maintenance with capacity and level", () => {
    const small = stadiumMaintenance({ capacity: 4000, level: 1 }, {});
    const big = stadiumMaintenance({ capacity: 12000, level: 3 }, {});
    expect(big).toBeGreaterThan(small);
  });

  it("returns 0 sponsor income with no sponsor signed", () => {
    expect(sponsorIncome(null)).toBe(0);
  });

  it("only offers the top sponsor tier to a team with a genuinely strong squad (by average overall, not record)", () => {
    // 16 teams, each with one player, ranked purely by overall — win/loss
    // record is identical (0-0) for all of them so the tiers can only be
    // reflecting squad quality, not the standings.
    const teams = Array.from({ length: 16 }, (_, i) => team(`t${i}`, 0, 0, [`p${i}`]));
    const playersById = Object.fromEntries(
      teams.map((t, i) => [`p${i}`, { overall: 90 - i * 3 }]) // t0 strongest, t15 weakest
    );
    const topJersey = getJerseySponsorOffers(teams[0], teams, undefined, playersById).map((o) => o.id);
    const bottomJersey = getJerseySponsorOffers(teams[15], teams, undefined, playersById).map((o) => o.id);
    expect(topJersey).toContain("jersey_nacional");
    expect(bottomJersey).not.toContain("jersey_nacional");
    expect(bottomJersey).toContain("jersey_local");

    const topStadium = getStadiumSponsorOffers(teams[0], teams, undefined, playersById).map((o) => o.id);
    expect(topStadium).toContain("stadium_nacional");
  });

  it("estimates more ticket income for a bigger, pricier stadium", () => {
    const small = estimatedTicketIncomePerRound({ capacity: 4000, ticketPrice: 15 });
    const big = estimatedTicketIncomePerRound({ capacity: 12000, ticketPrice: 35 });
    expect(big).toBeGreaterThan(small);
  });

  it("pays more TV rights for a higher division and a better position", () => {
    const teams = Array.from({ length: 16 }, (_, i) => team(`t${i}`, 15 - i, i, []));
    const topPrimera = tvRightsIncome("primerafeb", teams[0], teams);
    const bottomPrimera = tvRightsIncome("primerafeb", teams[15], teams);
    expect(topPrimera).toBeGreaterThan(bottomPrimera);

    const topAcb = tvRightsIncome("acb", teams[0], teams);
    expect(topAcb).toBeGreaterThan(topPrimera);
  });

  it("scales the loan cap with a team's actual fixed costs", () => {
    const cheapTeam = { roster: ["p1"], staff: {}, stadium: { capacity: 1500, level: 1 } };
    const bigTeam = { roster: ["p1"], staff: {}, stadium: { capacity: 10000, level: 2 } };
    const playersById = { p1: { wage: 500 } };
    expect(maxLoanAmount(bigTeam, playersById)).toBeGreaterThan(maxLoanAmount(cheapTeam, playersById));
  });

  it("charges flat interest on a loan, repaid in equal weekly installments", () => {
    const { remaining, weeklyPayment } = previewLoanTerms(100000);
    expect(remaining).toBeGreaterThan(100000);
    expect(weeklyPayment * LOAN_TERM_WEEKS).toBeGreaterThanOrEqual(remaining);
  });

  it("advanceLoan deducts one weekly payment and clears the loan once fully repaid", () => {
    const team = {
      budget: 10000,
      loan: { principal: 1000, remaining: 1000, weeklyPayment: 600, weeksLeft: 2 },
    };
    const afterOne = advanceLoan(team);
    expect(afterOne.budget).toBe(9400);
    expect(afterOne.loan).toMatchObject({ remaining: 400, weeksLeft: 1 });

    const afterTwo = advanceLoan(afterOne);
    expect(afterTwo.budget).toBe(9000);
    expect(afterTwo.loan).toBeNull();
  });

  it("advanceLoan is a no-op for a team with no loan", () => {
    const team = { budget: 5000, loan: null };
    expect(advanceLoan(team)).toBe(team);
  });
});
