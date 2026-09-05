const TIER_LABELS = ["Básico", "Avanzado", "Élite"];
const COST_MULT = [1, 2.2, 4];
const EFFECT_MULT = [1, 2, 3.3];

function makeTiers({ prefix, roleLabel, hireCost, wage, effectKey, effect, round }) {
  return TIER_LABELS.map((tierLabel, i) => ({
    id: `${prefix}_${i}`,
    label: `${roleLabel} (${tierLabel})`,
    hireCost: Math.round(hireCost * COST_MULT[i]),
    wage: Math.round(wage * COST_MULT[i]),
    [effectKey]: round ? round(effect * EFFECT_MULT[i]) : Math.round(effect * EFFECT_MULT[i] * 100) / 100,
  }));
}

export const STAFF_ROLES = {
  headCoach: {
    label: "Primer Entrenador",
    desc: "Sube la fuerza general del equipo en cada partido.",
    tiers: makeTiers({
      prefix: "head",
      roleLabel: "Primer Entrenador",
      hireCost: 80000,
      wage: 3000,
      effectKey: "strengthBonus",
      effect: 1.5,
    }),
  },
  offenseCoach: {
    label: "Entrenador de Ataque",
    desc: "Suma puntos al marcador propio.",
    tiers: makeTiers({
      prefix: "off",
      roleLabel: "Entrenador de Ataque",
      hireCost: 60000,
      wage: 2500,
      effectKey: "offenseBonus",
      effect: 2,
    }),
  },
  defenseCoach: {
    label: "Entrenador de Defensa",
    desc: "Resta puntos al marcador rival.",
    tiers: makeTiers({
      prefix: "def",
      roleLabel: "Entrenador de Defensa",
      hireCost: 60000,
      wage: 2500,
      effectKey: "defenseBonus",
      effect: 2,
    }),
  },
  fitnessCoach: {
    label: "Preparador Físico",
    desc: "Los jugadores recuperan forma física más rápido.",
    tiers: makeTiers({
      prefix: "fit",
      roleLabel: "Preparador Físico",
      hireCost: 50000,
      wage: 2000,
      effectKey: "recoveryBonus",
      effect: 1,
    }),
  },
  physio: {
    label: "Fisioterapeuta",
    desc: "Los jugadores lesionados se recuperan antes.",
    tiers: makeTiers({
      prefix: "phys",
      roleLabel: "Fisioterapeuta",
      hireCost: 50000,
      wage: 2000,
      effectKey: "injuryRecoveryChance",
      effect: 0.15,
    }),
  },
  doctor: {
    label: "Médico",
    desc: "Baja el riesgo de lesión en cada partido.",
    tiers: makeTiers({
      prefix: "doc",
      roleLabel: "Médico",
      hireCost: 50000,
      wage: 2000,
      effectKey: "injuryRiskReduction",
      effect: 0.2,
    }),
  },
  psychologist: {
    label: "Psicólogo",
    desc: "Sube la moral de la plantilla cada jornada.",
    tiers: makeTiers({
      prefix: "psy",
      roleLabel: "Psicólogo",
      hireCost: 45000,
      wage: 1800,
      effectKey: "moraleBonus",
      effect: 1,
    }),
  },
  scout: {
    label: "Ojeador y Cantera",
    desc: "Probabilidad de encontrar un nuevo prospecto de cantera cada jornada.",
    tiers: makeTiers({
      prefix: "scout",
      roleLabel: "Ojeador y Cantera",
      hireCost: 45000,
      wage: 1800,
      effectKey: "prospectChance",
      effect: 0.03,
    }),
  },
  groundskeeper: {
    label: "Cuidador de Estadio",
    desc: "Baja el coste de mantenimiento del estadio.",
    tiers: makeTiers({
      prefix: "ground",
      roleLabel: "Cuidador de Estadio",
      hireCost: 40000,
      wage: 1500,
      effectKey: "maintenanceReduction",
      effect: 0.15,
    }),
  },
};

const ROLE_IDS = Object.keys(STAFF_ROLES);

function currentTier(staff, roleId) {
  const hired = staff?.[roleId];
  if (!hired) return null;
  return STAFF_ROLES[roleId].tiers.find((t) => t.id === hired.tierId) || null;
}

// A role can only be hired when empty — replacing someone means firing them
// first (severance applies), no direct in-place upgrade.
export function getRoleTiers(staff, roleId) {
  if (staff?.[roleId]) return [];
  return STAFF_ROLES[roleId].tiers;
}

export function currentRoleTier(staff, roleId) {
  return currentTier(staff, roleId);
}

export function totalStaffWage(staff) {
  return ROLE_IDS.reduce((sum, roleId) => sum + (currentTier(staff, roleId)?.wage || 0), 0);
}

function effectSum(staff, effectKey) {
  return ROLE_IDS.reduce((sum, roleId) => sum + (currentTier(staff, roleId)?.[effectKey] || 0), 0);
}

export function headCoachBonus(staff) {
  return effectSum(staff, "strengthBonus");
}
export function offenseBonus(staff) {
  return effectSum(staff, "offenseBonus");
}
export function defenseBonus(staff) {
  return effectSum(staff, "defenseBonus");
}
export function formRecoveryBonus(staff) {
  return effectSum(staff, "recoveryBonus");
}
export function injuryRecoveryChance(staff) {
  return Math.min(0.9, 0.1 + effectSum(staff, "injuryRecoveryChance"));
}
export function injuryRiskReduction(staff) {
  return Math.min(0.85, effectSum(staff, "injuryRiskReduction"));
}
export function moraleBonus(staff) {
  return effectSum(staff, "moraleBonus");
}
export function scoutProspectChance(staff) {
  return effectSum(staff, "prospectChance");
}
export function maintenanceReduction(staff) {
  return Math.min(0.8, effectSum(staff, "maintenanceReduction"));
}
