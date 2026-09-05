import {
  playerWageTotal,
  staffWageTotal,
  stadiumMaintenance,
  sponsorIncome,
  getSponsorOffers,
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
    const topOffers = getSponsorOffers(teams[0], teams).map((o) => o.id);
    const bottomOffers = getSponsorOffers(teams[15], teams).map((o) => o.id);
    expect(topOffers).toContain("nacional");
    expect(bottomOffers).not.toContain("nacional");
    expect(bottomOffers).toContain("local");
  });

  it("estimates more ticket income for a bigger, pricier stadium", () => {
    const small = estimatedTicketIncomePerRound({ capacity: 4000, ticketPrice: 15 });
    const big = estimatedTicketIncomePerRound({ capacity: 12000, ticketPrice: 35 });
    expect(big).toBeGreaterThan(small);
  });
});
