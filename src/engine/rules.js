// Approximation of the ACB's "extracomunitarios" rule (max 2 non-Spanish
// starters) applied here to Primera FEB too — no confirmed source exists
// for this specific division's own quota.
export const FOREIGN_PLAYER_QUOTA = 2;

export function isForeign(player) {
  return Boolean(player && player.nationality && player.nationality !== "España");
}
