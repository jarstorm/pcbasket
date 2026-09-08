// Mirrors evaluateContractOffer's shape (career.js): a lowball bid gets
// flatly refused, a bid in the middle gets a counter (the minimum the
// selling team would actually take), and a near-value bid is accepted.
export function evaluateTransferOffer(player, amount) {
  const ratio = amount / player.value;
  if (ratio >= 0.9) return { result: "accept" };
  if (ratio >= 0.6) {
    return { result: "counter", counterAmount: Math.round(player.value * 0.9) };
  }
  return { result: "reject" };
}

// A player clearly above a club's actual level won't join it — mainly
// matters when the market spans multiple divisions (an ACB starter has no
// real reason to sign for a Tercera FEB side). Buyer strength is the
// average overall across its whole roster, not just the starting five, so
// a deep bench still counts toward what the club can plausibly offer.
const CROSS_LEAGUE_OVERALL_MARGIN = 10;

export function averageRosterOverall(team, playersById) {
  const overalls = team.roster.map((id) => playersById[id]?.overall).filter((v) => typeof v === "number");
  if (!overalls.length) return 0;
  return overalls.reduce((sum, v) => sum + v, 0) / overalls.length;
}

export function canRealisticallySign(buyerTeam, candidate, playersById) {
  const buyerLevel = averageRosterOverall(buyerTeam, playersById);
  if (buyerLevel === 0) return true;
  return candidate.overall <= buyerLevel + CROSS_LEAGUE_OVERALL_MARGIN;
}
