import { getUpgradeTiers } from "../stadium";

describe("getUpgradeTiers", () => {
  it("scales cost with the stadium's current level", () => {
    const level1 = getUpgradeTiers({ level: 1 });
    const level2 = getUpgradeTiers({ level: 2 });
    level1.forEach((tier, i) => {
      expect(level2[i].cost).toBeGreaterThan(tier.cost);
    });
  });

  it("orders tiers so a bigger expansion costs and gains more", () => {
    const tiers = getUpgradeTiers({ level: 1 });
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].cost).toBeGreaterThan(tiers[i - 1].cost);
      expect(tiers[i].capacityGain).toBeGreaterThan(tiers[i - 1].capacityGain);
    }
  });
});
