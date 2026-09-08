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
