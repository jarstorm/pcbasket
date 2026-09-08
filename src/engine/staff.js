import { seededRandom } from "./random";
import { randomName } from "../data/names";

const TIER_LABELS = ["Básico", "Avanzado", "Élite"];
// Wide gap on purpose: a Básico hire should be a trivial expense, an Élite
// one a real commitment — not a smooth 1x/2x/4x ramp. hireCost/wage below
// are further scaled by the team's wageScale (see scaleTier) the same way
// player wages are, so Élite is genuinely out of reach for a Tercera FEB
// budget while Básico stays affordable even there.
const COST_MULT = [0.15, 2, 10];
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
  lawyer: {
    label: "Abogado",
    desc: "Revela el rango de sueldo que aceptaría un jugador al renovar contrato.",
    tiers: makeTiers({
      prefix: "law",
      roleLabel: "Abogado",
      hireCost: 55000,
      wage: 2200,
      effectKey: "insightLevel",
      effect: 1,
    }),
  },
};

const ROLE_IDS = Object.keys(STAFF_ROLES);

// hireCost/wage on STAFF_ROLES tiers are Primera FEB-scale reference
// figures (wageScale = 1) — scaled here per-team the same way player wages
// are, so the same "Élite" tier costs real money in ACB but stays out of
// reach in Tercera FEB rather than being a rounding error either way.
function scaleTier(tier, wageScale) {
  if (!tier) return tier;
  return { ...tier, hireCost: Math.round(tier.hireCost * wageScale), wage: Math.round(tier.wage * wageScale) };
}

function rawTier(staff, roleId) {
  const hired = staff?.[roleId];
  if (!hired) return null;
  return STAFF_ROLES[roleId].tiers.find((t) => t.id === hired.tierId) || null;
}

// The static STAFF_ROLES tier only supplies the label/effect for the hired
// level — the actual wage/hireCost/name a person was hired at is random
// (see generateStaffCandidates) and stored on the hire itself. Older saves
// (or tests that build a `{ tierId }` record directly) have no stored
// wage/hireCost, so those fall back to the plain scaled tier figure.
function currentTier(staff, roleId, wageScale = 1) {
  const hired = staff?.[roleId];
  const base = rawTier(staff, roleId);
  if (!base) return null;
  return {
    ...base,
    wage: hired.wage ?? Math.round(base.wage * wageScale),
    hireCost: hired.hireCost ?? Math.round(base.hireCost * wageScale),
    name: hired.name || null,
  };
}

// A role can only be hired when empty — replacing someone means firing them
// first (severance applies), no direct in-place upgrade.
export function getRoleTiers(staff, roleId, wageScale = 1) {
  if (staff?.[roleId]) return [];
  return STAFF_ROLES[roleId].tiers.map((t) => scaleTier(t, wageScale));
}

// hireCost baseline for a role's Élite candidate (before wageScale) — every
// other tier/role uses its STAFF_ROLES formula, but a real elite head coach
// commands a real, unpredictable transfer fee, not a smooth multiplier of
// the base rate.
const HEAD_COACH_ELITE_HIRE_COST_RANGE = [1_000_000, 3_000_000];

// A rotating, per-jornada hiring pool: 1-3 named candidates for the role,
// each landing on a random tier (so an Élite candidate isn't guaranteed
// every week, or ever, for a given role) with a wage that varies ±30% from
// that tier's baseline — no two candidates cost exactly the tier sticker
// price. Deterministic per (round, role) so the list doesn't reshuffle on
// every re-render, only when the jornada actually changes.
export function generateStaffCandidates(staff, roleId, round, wageScale = 1) {
  if (staff?.[roleId]) return [];
  const role = STAFF_ROLES[roleId];
  const roleIndex = ROLE_IDS.indexOf(roleId);
  const rand = seededRandom(round * 977 + roleIndex * 131 + 7919);
  const count = 1 + Math.floor(rand() * 3);

  const candidates = [];
  for (let i = 0; i < count; i++) {
    const tierIdx = Math.floor(rand() * TIER_LABELS.length);
    const baseTier = role.tiers[tierIdx];
    const wageVariance = 0.7 + rand() * 0.6;
    const hireCost =
      roleId === "headCoach" && tierIdx === 2
        ? Math.round(
            HEAD_COACH_ELITE_HIRE_COST_RANGE[0] +
              rand() * (HEAD_COACH_ELITE_HIRE_COST_RANGE[1] - HEAD_COACH_ELITE_HIRE_COST_RANGE[0])
          )
        : baseTier.hireCost;
    const scaled = scaleTier({ ...baseTier, hireCost, wage: Math.round(baseTier.wage * wageVariance) }, wageScale);
    candidates.push({ ...scaled, candidateId: `${roleId}_${round}_${i}`, name: randomName(rand) });
  }
  return candidates;
}

export function currentRoleTier(staff, roleId, wageScale = 1) {
  return currentTier(staff, roleId, wageScale);
}

export function totalStaffWage(staff, wageScale = 1) {
  return ROLE_IDS.reduce((sum, roleId) => sum + (currentTier(staff, roleId, wageScale)?.wage || 0), 0);
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

// A role's tier index (0/1/2 = Básico/Avanzado/Élite), parsed straight from
// the tier id ("scout_0"/"law_1"/...) rather than a separate field, since
// TIER_LABELS/EFFECT_MULT already encode the same order everywhere else.
function tierIndexOf(staff, roleId) {
  const tier = currentTier(staff, roleId);
  if (!tier) return null;
  return Number(tier.id.split("_")[1]);
}
export function scoutTierIndex(staff) {
  return tierIndexOf(staff, "scout");
}
export function lawyerTierIndex(staff) {
  return tierIndexOf(staff, "lawyer");
}
export function maintenanceReduction(staff) {
  return Math.min(0.8, effectSum(staff, "maintenanceReduction"));
}
