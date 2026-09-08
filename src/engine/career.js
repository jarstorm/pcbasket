import { valueOf, wageOf } from "../data/generate";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function bumpRatings(ratings, delta) {
  if (!ratings) return ratings;
  return Object.fromEntries(Object.entries(ratings).map(([k, v]) => [k, clamp(v + delta, 30, 99)]));
}

// End-of-season aging: young players who logged real minutes develop,
// veterans decline. `seasonMinutes` is the total minutes played this
// season. The per-skill ratings breakdown, transfer value and wage all move
// with `overall` — without this a grown/declined player's card still shows
// its old skill numbers and still costs what it did the day it was signed.
export function seasonAgeStep(player, seasonMinutes, wageScale = 1) {
  const age = player.age + 1;
  let overall = player.overall;
  let ratings = player.ratings;
  if (age <= 24 && seasonMinutes > 0) {
    const gain = seasonMinutes > 600 ? 3 : seasonMinutes > 200 ? 2 : 1;
    overall = clamp(overall + gain, 30, 99);
    ratings = bumpRatings(player.ratings, gain);
  } else if (age >= 35) {
    const loss = randInt(1, 3);
    overall = clamp(overall - loss, 30, 99);
    ratings = bumpRatings(player.ratings, -loss);
  }
  return {
    age,
    overall,
    ratings,
    value: valueOf(overall, age, player.isProspect ? player.potential : null, wageScale),
    wage: wageOf(overall, age, wageScale),
    contractYears: player.contractYears - 1,
    seasonMinutes: 0,
    // Preseason conditioning varies by player instead of everyone landing
    // on a flat 99 — the in-season recovery bias (GameContext's SIM_ROUND)
    // already pulls rested players back toward full form on its own, so
    // this only matters for how the fresh season actually opens.
    form: randInt(85, 99),
  };
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
