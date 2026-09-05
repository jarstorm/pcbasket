const TIERS = [
  { id: "small", label: "Ampliación pequeña", capacityGain: 1500, priceGain: 3, costFactor: 0.6 },
  { id: "medium", label: "Ampliación media", capacityGain: 2500, priceGain: 5, costFactor: 1 },
  { id: "large", label: "Ampliación grande", capacityGain: 5000, priceGain: 9, costFactor: 1.8 },
];

export function getUpgradeTiers(stadium) {
  const base = 150000 * stadium.level;
  return TIERS.map((t) => ({ ...t, cost: Math.round(base * t.costFactor) }));
}
