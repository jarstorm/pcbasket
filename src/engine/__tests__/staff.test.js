import {
  STAFF_ROLES,
  getRoleTiers,
  generateStaffCandidates,
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
  scoutTierIndex,
  lawyerTierIndex,
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

  it("scoutTierIndex reads the hired tier's rank, null with no scout", () => {
    expect(scoutTierIndex({})).toBeNull();
    const eliteTier = STAFF_ROLES.scout.tiers[2];
    expect(scoutTierIndex({ scout: { tierId: eliteTier.id } })).toBe(2);
    const basicTier = STAFF_ROLES.scout.tiers[0];
    expect(scoutTierIndex({ scout: { tierId: basicTier.id } })).toBe(0);
  });

  it("lawyerTierIndex reads the hired tier's rank, null with no lawyer", () => {
    expect(lawyerTierIndex({})).toBeNull();
    const eliteTier = STAFF_ROLES.lawyer.tiers[2];
    expect(lawyerTierIndex({ lawyer: { tierId: eliteTier.id } })).toBe(2);
  });

  it("higher tiers cost and pay more than lower ones for the same role", () => {
    const tiers = STAFF_ROLES.physio.tiers;
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].hireCost).toBeGreaterThan(tiers[i - 1].hireCost);
      expect(tiers[i].wage).toBeGreaterThan(tiers[i - 1].wage);
    }
  });
});

describe("generateStaffCandidates", () => {
  it("returns 1-3 named candidates for an open role, and none once it's filled", () => {
    for (let round = 0; round < 30; round++) {
      const candidates = generateStaffCandidates({}, "physio", round, 1);
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates.length).toBeLessThanOrEqual(3);
      for (const c of candidates) {
        expect(typeof c.name).toBe("string");
        expect(c.name.length).toBeGreaterThan(0);
      }
    }
    const filled = generateStaffCandidates({ physio: { tierId: "phys_0" } }, "physio", 0, 1);
    expect(filled).toEqual([]);
  });

  it("is deterministic for a given (role, round) so the list doesn't reshuffle on re-render", () => {
    const a = generateStaffCandidates({}, "scout", 12, 1);
    const b = generateStaffCandidates({}, "scout", 12, 1);
    expect(a).toEqual(b);
  });

  it("each candidate's wage is within ±30% of its tier's baseline wage", () => {
    for (let round = 0; round < 30; round++) {
      for (const c of generateStaffCandidates({}, "doctor", round, 1)) {
        const baseTier = STAFF_ROLES.doctor.tiers.find((t) => t.id === c.id);
        expect(c.wage).toBeGreaterThanOrEqual(Math.round(baseTier.wage * 0.7));
        expect(c.wage).toBeLessThanOrEqual(Math.round(baseTier.wage * 1.3));
      }
    }
  });

  it("an Élite headCoach candidate's hireCost lands between 1M and 3M, unlike the flat tier formula", () => {
    let sawElite = false;
    for (let round = 0; round < 60; round++) {
      for (const c of generateStaffCandidates({}, "headCoach", round, 1)) {
        if (c.id !== "head_2") continue;
        sawElite = true;
        expect(c.hireCost).toBeGreaterThanOrEqual(1_000_000);
        expect(c.hireCost).toBeLessThanOrEqual(3_000_000);
      }
    }
    expect(sawElite).toBe(true); // otherwise this test isn't exercising anything
  });

  it("scales candidate wage/hireCost by wageScale, same as getRoleTiers", () => {
    // wageScale only touches the final $ figures, not the random draws that
    // pick who/which tier — same seed means the same candidate at index 0.
    const full = generateStaffCandidates({}, "physio", 5, 1)[0];
    const scaled = generateStaffCandidates({}, "physio", 5, 0.2)[0];
    expect(scaled.id).toBe(full.id);
    expect(scaled.name).toBe(full.name);
    expect(scaled.hireCost).toBeLessThan(full.hireCost);
    expect(scaled.wage).toBeLessThan(full.wage);
  });
});
