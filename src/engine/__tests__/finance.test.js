import {
  playerWageTotal,
  staffWageTotal,
  stadiumMaintenance,
  sponsorIncome,
  getJerseySponsorOffers,
  getStadiumSponsorOffers,
  tvRightsIncome,
  estimatedTicketIncomePerRound,
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

  it("only offers the top sponsor tier to a team near the top of the table", () => {
    // 16 teams so the bottom-placed team actually falls outside the
    // "nacional"/"regional" position thresholds.
    const teams = Array.from({ length: 16 }, (_, i) => team(`t${i}`, 15 - i, i, []));
    const topJersey = getJerseySponsorOffers(teams[0], teams).map((o) => o.id);
    const bottomJersey = getJerseySponsorOffers(teams[15], teams).map((o) => o.id);
    expect(topJersey).toContain("jersey_nacional");
    expect(bottomJersey).not.toContain("jersey_nacional");
    expect(bottomJersey).toContain("jersey_local");

    const topStadium = getStadiumSponsorOffers(teams[0], teams).map((o) => o.id);
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
});
