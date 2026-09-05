import { generateSchedule } from "../schedule";

describe("generateSchedule", () => {
  it("never schedules a team against itself", () => {
    const teamIds = ["a", "b", "c", "d", "e", "f"];
    const rounds = generateSchedule(teamIds, true);
    for (const round of rounds) {
      for (const [home, away] of round) {
        expect(home).not.toBe(away);
      }
    }
  });

  it("has every team play every round (even team count)", () => {
    const teamIds = ["a", "b", "c", "d"];
    const rounds = generateSchedule(teamIds, false);
    for (const round of rounds) {
      const playing = new Set(round.flat());
      expect(playing.size).toBe(teamIds.length);
    }
  });

  it("doubles the rounds and flips home/away for a double round-robin", () => {
    const teamIds = ["a", "b", "c", "d"];
    const single = generateSchedule(teamIds, false);
    const double = generateSchedule(teamIds, true);
    expect(double.length).toBe(single.length * 2);

    const secondLeg = double[single.length];
    const firstRound = single[0];
    const flipped = secondLeg.map(([h, a]) => [a, h]);
    expect(flipped.sort()).toEqual(firstRound.sort());
  });

  it("gives every pair of teams exactly two meetings (home and away) in a double round-robin", () => {
    const teamIds = ["a", "b", "c", "d", "e"]; // odd count exercises the bye
    const rounds = generateSchedule(teamIds, true);
    const meetings = {};
    for (const round of rounds) {
      for (const [home, away] of round) {
        const key = [home, away].sort().join("-");
        meetings[key] = (meetings[key] || 0) + 1;
      }
    }
    const pairs = Object.values(meetings);
    expect(pairs.every((count) => count === 2)).toBe(true);
  });
});
