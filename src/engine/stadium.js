// Capacity gains only — a bigger stadium does not sell itself. Filling it
// gets harder as capacity grows (see fillDifficultyFactor in GameContext),
// and ticket price stays under the player's own control (SET_TICKET_PRICE).
const TIERS = [
  { id: "small", label: "Ampliación pequeña", capacityGain: 1500, costFactor: 0.6 },
  { id: "medium", label: "Ampliación media", capacityGain: 2500, costFactor: 1 },
  { id: "large", label: "Ampliación grande", capacityGain: 5000, costFactor: 1.8 },
];

export function getUpgradeTiers(stadium) {
  const base = 150000 * stadium.level;
  return TIERS.map((t) => ({ ...t, cost: Math.round(base * t.costFactor) }));
}
