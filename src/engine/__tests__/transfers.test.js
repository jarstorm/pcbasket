import { evaluateTransferOffer } from "../transfers";

describe("evaluateTransferOffer", () => {
  it("accepts an offer at or near the player's value", () => {
    expect(evaluateTransferOffer({ value: 100000 }, 95000)).toEqual({ result: "accept" });
    expect(evaluateTransferOffer({ value: 100000 }, 100000)).toEqual({ result: "accept" });
  });

  it("counters an offer in the middle range with 90% of the player's value", () => {
    const outcome = evaluateTransferOffer({ value: 100000 }, 70000);
    expect(outcome.result).toBe("counter");
    expect(outcome.counterAmount).toBe(90000);
  });

  it("flatly rejects a lowball offer", () => {
    expect(evaluateTransferOffer({ value: 100000 }, 20000)).toEqual({ result: "reject" });
  });
});
