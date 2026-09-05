import {
  STAFF_ROLES,
  getRoleTiers,
  currentRoleTier,
  totalStaffWage,
  headCoachBonus,
  offenseBonus,
  defenseBonus,
  formRecoveryBonus,
  injuryRecoveryChance,
  injuryRiskReduction,
  moraleBonus,
  scoutProspectChance,
  maintenanceReduction,
} from "../staff";

describe("staff roles", () => {
  it("has no bonus and no current tier before hiring anything", () => {
    expect(headCoachBonus({})).toBe(0);
    expect(offenseBonus({})).toBe(0);
    expect(totalStaffWage({})).toBe(0);
    expect(currentRoleTier({}, "headCoach")).toBeNull();
  });

  it("offers every tier for an empty role, and none once it's filled", () => {
    const empty = getRoleTiers({}, "headCoach");
    expect(empty.length).toBe(STAFF_ROLES.headCoach.tiers.length);

    const filled = getRoleTiers({ headCoach: { tierId: empty[0].id } }, "headCoach");
    expect(filled).toEqual([]);
  });

  it("accumulates bonuses across independently hired roles", () => {
    const headTier = STAFF_ROLES.headCoach.tiers[0];
    const offTier = STAFF_ROLES.offenseCoach.tiers[1];
    const staff = {
      headCoach: { tierId: headTier.id },
      offenseCoach: { tierId: offTier.id },
    };
    expect(headCoachBonus(staff)).toBe(headTier.strengthBonus);
    expect(offenseBonus(staff)).toBe(offTier.strengthBonus ?? offTier.offenseBonus);
    expect(totalStaffWage(staff)).toBe(headTier.wage + offTier.wage);
  });

  it("every role effect accessor returns 0/baseline with nothing hired", () => {
    expect(defenseBonus({})).toBe(0);
    expect(formRecoveryBonus({})).toBe(0);
    expect(injuryRiskReduction({})).toBe(0);
    expect(moraleBonus({})).toBe(0);
    expect(scoutProspectChance({})).toBe(0);
    expect(maintenanceReduction({})).toBe(0);
    expect(injuryRecoveryChance({})).toBeCloseTo(0.1); // baseline recovery chance
  });

  it("higher tiers cost and pay more than lower ones for the same role", () => {
    const tiers = STAFF_ROLES.physio.tiers;
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].hireCost).toBeGreaterThan(tiers[i - 1].hireCost);
      expect(tiers[i].wage).toBeGreaterThan(tiers[i - 1].wage);
    }
  });
});
