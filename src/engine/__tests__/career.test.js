import { seasonAgeStep, shouldRetire, evaluateContractOffer } from "../career";

describe("seasonAgeStep", () => {
  it("develops a young player who played real minutes", () => {
    const player = { age: 22, overall: 60, contractYears: 2 };
    const next = seasonAgeStep(player, 800);
    expect(next.age).toBe(23);
    expect(next.overall).toBeGreaterThan(60);
    expect(next.contractYears).toBe(1);
    expect(next.seasonMinutes).toBe(0);
  });

  it("does not develop a young player who never played", () => {
    const player = { age: 22, overall: 60, contractYears: 2 };
    const next = seasonAgeStep(player, 0);
    expect(next.overall).toBe(60);
  });

  it("declines a veteran regardless of minutes played", () => {
    const player = { age: 35, overall: 70, contractYears: 1 };
    const next = seasonAgeStep(player, 0);
    expect(next.age).toBe(36);
    expect(next.overall).toBeLessThan(70);
  });
});

describe("shouldRetire", () => {
  it("never retires under 35", () => {
    expect(shouldRetire({ age: 34 })).toBe(false);
  });

  it("always retires at 40 or older", () => {
    expect(shouldRetire({ age: 40 })).toBe(true);
    expect(shouldRetire({ age: 41 })).toBe(true);
  });
});

describe("evaluateContractOffer", () => {
  it("accepts a generous offer", () => {
    const player = { age: 27, wage: 1000 };
    expect(evaluateContractOffer(player, 2, 2000).result).toBe("accept");
  });

  it("rejects a lowball offer", () => {
    const player = { age: 27, wage: 1000 };
    expect(evaluateContractOffer(player, 2, 200).result).toBe("reject");
  });

  it("a retiring player always rejects, however generous the offer", () => {
    const player = { age: 40, wage: 1000 };
    expect(evaluateContractOffer(player, 2, 10000).result).toBe("retiring");
  });
});
