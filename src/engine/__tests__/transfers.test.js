import { evaluateTransferOffer, canRealisticallySign, averageRosterOverall } from "../transfers";

describe("evaluateTransferOffer", () => {
  it("accepts an offer at or near the player's value", () => {
    expect(evaluateTransferOffer({ value: 100000 }, 95000)).toEqual({ result: "accept" });
    expect(evaluateTransferOffer({ value: 100000 }, 100000)).toEqual({ result: "accept" });
  });

  it("counters an offer in the middle range with 80% of the player's value", () => {
    const outcome = evaluateTransferOffer({ value: 100000 }, 70000);
    expect(outcome.result).toBe("counter");
    expect(outcome.counterAmount).toBe(80000);
  });

  it("flatly rejects a lowball offer", () => {
    expect(evaluateTransferOffer({ value: 100000 }, 40000)).toEqual({ result: "reject" });
  });
});

describe("canRealisticallySign", () => {
  const playersById = {
    p1: { overall: 55 },
    p2: { overall: 60 },
    p3: { overall: 65 },
  };
  const team = { roster: ["p1", "p2", "p3"] }; // average overall 60

  it("allows a player within the margin above the squad's average level", () => {
    expect(canRealisticallySign(team, { overall: 68 }, playersById)).toBe(true);
  });

  it("blocks a player far above the squad's average level (e.g. a top ACB player eyeing Tercera FEB)", () => {
    expect(canRealisticallySign(team, { overall: 90 }, playersById)).toBe(false);
  });

  it("always allows signing a weaker player", () => {
    expect(canRealisticallySign(team, { overall: 30 }, playersById)).toBe(true);
  });

  it("doesn't block anything for a team with no roster yet", () => {
    expect(canRealisticallySign({ roster: [] }, { overall: 95 }, playersById)).toBe(true);
  });
});

describe("averageRosterOverall", () => {
  it("averages the overall of every rostered player found in playersById", () => {
    const playersById = { p1: { overall: 50 }, p2: { overall: 70 } };
    expect(averageRosterOverall({ roster: ["p1", "p2"] }, playersById)).toBe(60);
  });

  it("returns 0 for an empty roster", () => {
    expect(averageRosterOverall({ roster: [] }, {})).toBe(0);
  });
});
