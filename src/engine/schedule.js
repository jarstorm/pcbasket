// Circle-method round robin. Returns array of rounds, each round an array of [homeId, awayId].
export function generateSchedule(teamIds, doubleRound = true) {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push(null); // bye
  const n = ids.length;
  const rounds = [];
  const fixed = ids[0];
  let rest = ids.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const round = [];
    const arr = [fixed, ...rest];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) {
        const home = r % 2 === 0 ? a : b;
        const away = r % 2 === 0 ? b : a;
        round.push([home, away]);
      }
    }
    rounds.push(round);
    rest.unshift(rest.pop());
  }

  if (doubleRound) {
    const secondLeg = rounds.map((round) => round.map(([h, a]) => [a, h]));
    return [...rounds, ...secondLeg];
  }
  return rounds;
}
