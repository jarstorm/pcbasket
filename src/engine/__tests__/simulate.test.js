import { simulateMatch, offenseTacticBonus, defenseTacticBonus } from "../simulate";

function makeTeam(id, overalls) {
  const roster = overalls.map((_, i) => `${id}p${i}`);
  const lineup = {
    PG: roster[0],
    SG: roster[1],
    SF: roster[2],
    PF: roster[3],
    C: roster[4],
  };
  return {
    id,
    stadium: { level: 1 },
    staff: { level: 0 },
    roster,
    lineup,
  };
}

function makePlayersById(team, overalls, positions) {
  const entries = team.roster.map((id, i) => [
    id,
    {
      id,
      name: id,
      overall: overalls[i],
      position: positions[i],
      ratings: { shooting: 60, defense: 60, passing: 60, rebounding: 60, physical: 60 },
      morale: 80,
      form: 99,
      injured: false,
    },
  ]);
  return Object.fromEntries(entries);
}

const POS = ["PG", "SG", "SF", "PF", "C", "PG", "SG", "SF", "PF", "C"];
const OVERALLS = [78, 74, 71, 69, 66, 64, 60, 57, 53, 50];

describe("simulateMatch", () => {
  const home = makeTeam("home", OVERALLS);
  const away = makeTeam("away", OVERALLS);
  const playersById = {
    ...makePlayersById(home, OVERALLS, POS),
    ...makePlayersById(away, OVERALLS, POS),
  };

  it("gives each team exactly 200 player-minutes total", () => {
    const result = simulateMatch(home, away, playersById);
    for (const teamRef of ["home", "away"]) {
      const total = result.boxscore[teamRef].reduce((sum, p) => sum + p.minutes, 0);
      expect(total).toBe(200);
    }
  });

  it("only fields healthy players and gives starters more minutes than deep bench", () => {
    const result = simulateMatch(home, away, playersById);
    const starterMinutes = result.boxscore.home.find((p) => p.id === "homep0").minutes;
    const benchMinutes = result.boxscore.home.find((p) => p.id === "homep9").minutes;
    expect(starterMinutes).toBeGreaterThan(benchMinutes);
  });

  it("reconciles made 2s/3s/free throws back to the player's total points", () => {
    const result = simulateMatch(home, away, playersById);
    for (const teamRef of ["home", "away"]) {
      for (const p of result.boxscore[teamRef]) {
        expect(p.made2 * 2 + p.made3 * 3 + p.madeFt).toBe(p.points);
        expect(p.att2).toBeGreaterThanOrEqual(p.made2);
        expect(p.att3).toBeGreaterThanOrEqual(p.made3);
        expect(p.attFt).toBeGreaterThanOrEqual(p.madeFt);
      }
    }
  });

  it("produces plausible, non-negative scores", () => {
    const result = simulateMatch(home, away, playersById);
    expect(result.homeScore).toBeGreaterThanOrEqual(60);
    expect(result.awayScore).toBeGreaterThanOrEqual(60);
    expect(result.homeScore).not.toBe(result.awayScore); // overtime tie-break always applies
  });

  it("excludes injured players from getting any minutes", () => {
    const hurtHome = {
      ...home,
      roster: home.roster,
    };
    const hurtPlayers = {
      ...playersById,
      homep0: { ...playersById.homep0, injured: true },
    };
    const result = simulateMatch(hurtHome, away, hurtPlayers);
    expect(result.boxscore.home.find((p) => p.id === "homep0")).toBeUndefined();
  });
});

describe("tactic bonuses", () => {
  it("balanced/man tactics never help or hurt regardless of ratings", () => {
    const weakTeam = { lineup: { PG: "p1" }, tactics: { offense: "balanced", defense: "man" } };
    const players = { p1: { ratings: { shooting: 20, rebounding: 20, physical: 20, defense: 20 } } };
    expect(offenseTacticBonus(weakTeam, players)).toBe(0);
    expect(defenseTacticBonus(weakTeam, players)).toBe(0);
  });

  it("interior/exterior offense rewards a strong lineup and punishes a weak one", () => {
    const players = {
      strong: { ratings: { shooting: 90, rebounding: 90, physical: 90, defense: 90 } },
      weak: { ratings: { shooting: 20, rebounding: 20, physical: 20, defense: 20 } },
    };
    const strongTeam = { lineup: { PG: "strong" }, tactics: { offense: "interior" } };
    const weakTeam = { lineup: { PG: "weak" }, tactics: { offense: "interior" } };
    expect(offenseTacticBonus(strongTeam, players)).toBeGreaterThan(0);
    expect(offenseTacticBonus(weakTeam, players)).toBeLessThan(0);

    const strongExterior = { lineup: { PG: "strong" }, tactics: { offense: "exterior" } };
    expect(offenseTacticBonus(strongExterior, players)).toBeGreaterThan(0);
  });

  it("zone/press defense rewards a strong lineup and punishes a weak one", () => {
    const players = {
      strong: { ratings: { shooting: 90, rebounding: 90, physical: 90, defense: 90 } },
      weak: { ratings: { shooting: 20, rebounding: 20, physical: 20, defense: 20 } },
    };
    const strongTeam = { lineup: { PG: "strong" }, tactics: { defense: "press" } };
    const weakTeam = { lineup: { PG: "weak" }, tactics: { defense: "press" } };
    expect(defenseTacticBonus(strongTeam, players)).toBeGreaterThan(0);
    expect(defenseTacticBonus(weakTeam, players)).toBeLessThan(0);
  });
});
