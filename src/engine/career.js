function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// End-of-season aging: young players who logged real minutes develop,
// veterans decline. `seasonMinutes` is the total minutes played this season.
export function seasonAgeStep(player, seasonMinutes) {
  const age = player.age + 1;
  let overall = player.overall;
  if (age <= 24 && seasonMinutes > 0) {
    const gain = seasonMinutes > 600 ? 3 : seasonMinutes > 200 ? 2 : 1;
    overall = clamp(overall + gain, 30, 99);
  } else if (age >= 35) {
    overall = clamp(overall - randInt(1, 3), 30, 99);
  }
  return { age, overall, contractYears: player.contractYears - 1, seasonMinutes: 0 };
}

// Only players 35-40 can retire; the chance climbs with age and hits 100%
// at 40 (nobody plays past 40 in this league).
export function shouldRetire(player) {
  if (player.age < 35) return false;
  if (player.age >= 40) return true;
  return Math.random() < (player.age - 34) * 0.15;
}

// A contract offer's outcome: an in-range offer is accepted, a low one is
// rejected outright, and a middling one triggers a counter-offer.
export function evaluateContractOffer(player, offeredYears, offeredWage) {
  if (shouldRetire(player)) return { result: "retiring" };
  const expectedWage = player.wage;
  const ratio = offeredWage / expectedWage;
  if (ratio >= 1.15) return { result: "accept" };
  if (ratio >= 0.9) {
    return Math.random() < 0.7
      ? { result: "accept" }
      : { result: "counter", counterWage: Math.round(expectedWage * 1.2) };
  }
  if (ratio >= 0.6) return { result: "counter", counterWage: Math.round(expectedWage * 1.15) };
  return { result: "reject" };
}
