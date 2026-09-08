import { reducer } from "../GameContext";

function baseState() {
  const teamA = {
    id: "a",
    name: "Team A",
    budget: 500000,
    roster: ["p1", "p2", "p3"],
    academy: [],
    stadium: { name: "Arena A", level: 1, capacity: 8000, ticketPrice: 25, seasonTicketPrice: 375, seasonTicketHolders: 0 },
    staff: {},
    sponsors: { jersey: null, stadium: null },
    financeHistory: [],
    tactics: { offense: "balanced", defense: "man" },
    record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
    lineup: { PG: "p1", SG: null, SF: null, PF: null, C: null },
  };
  const teamB = {
    id: "b",
    name: "Team B",
    budget: 500000,
    roster: ["p4"],
    academy: [],
    stadium: { name: "Arena B", level: 1, capacity: 8000, ticketPrice: 25, seasonTicketPrice: 375, seasonTicketHolders: 0 },
    staff: {},
    sponsors: { jersey: null, stadium: null },
    financeHistory: [],
    tactics: { offense: "balanced", defense: "man" },
    record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
    lineup: { PG: "p4", SG: null, SF: null, PF: null, C: null },
  };
  const player = (id, overrides = {}) => ({
    id,
    name: id,
    position: "PG",
    nationality: "España",
    age: 25,
    ratings: { shooting: 60, defense: 60, passing: 60, rebounding: 60, physical: 60 },
    overall: 60,
    potential: 60,
    value: 100000,
    wage: 1000,
    contractYears: 2,
    seasonMinutes: 0,
    listed: false,
    morale: 80,
    form: 99,
    injured: false,
    teamId: id === "p4" ? "b" : "a",
    isProspect: false,
    ...overrides,
  });
  return {
    teams: [teamA, teamB],
    playersById: {
      p1: player("p1"),
      p2: player("p2"),
      p3: player("p3"),
      p4: player("p4"),
    },
    schedule: [[["a", "b"]], [["b", "a"]]],
    round: 0,
    userTeamId: "a",
    teamChosen: true,
    results: [],
    lastRoundResults: [],
    pendingContracts: [],
    pendingOffers: [],
    log: [],
    seasonYear: 2025,
    currentDate: "2025-09-01",
    preseasonWeeksLeft: 0,
    activeDivisionId: "primerafeb",
    activeGroupId: "main",
    otherDivisions: {
      acb: {
        name: "ACB",
        groups: [
          {
            id: "main",
            teams: [
              { id: "acb1", name: "acb1", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
              { id: "acb2", name: "acb2", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
            ],
            schedule: [[["acb1", "acb2"]], [["acb2", "acb1"]]],
            round: 0,
            results: [],
            lastRoundResults: [],
          },
        ],
      },
      segundafeb: {
        name: "Segunda FEB",
        groups: ["este", "oeste"].map((gid) => ({
          id: gid,
          teams: [
            { id: `sf-${gid}`, name: `sf-${gid}`, stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
          ],
          schedule: [],
          round: 0,
          results: [],
          lastRoundResults: [],
        })),
      },
      tercerafeb: {
        name: "Tercera FEB",
        groups: Array.from({ length: 10 }, (_, i) => ({
          id: `g${i + 1}`,
          teams: [
            { id: `tf-g${i + 1}`, name: `tf-g${i + 1}`, stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
          ],
          schedule: [],
          round: 0,
          results: [],
          lastRoundResults: [],
        })),
      },
    },
  };
}

function dummyTeam(id) {
  return {
    id,
    name: id,
    stadium: { level: 1 },
    staff: {},
    roster: [],
    lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
    record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
  };
}

// resolvePyramid's promotion pools/relegation zones need real minimums to
// not degenerate (Primera FEB: 1 direct + 8-team pool + 3 relegated = 12;
// each Segunda FEB group: 1 direct + 4-team pool + 3 relegated = 8, padded
// to 10) — pad every division so those zones don't overlap or run short.
// Tercera FEB's groups are left at 1 team each: only each group's champion
// (its sole team) matters for its promotion, and it has no relegation zone.
function withPlayoffSizedDivisions(state) {
  const primeraFillerIds = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);
  const segundaFillerIds = Array.from({ length: 9 }, (_, i) => `f${i + 1}`);
  return {
    ...state,
    teams: [...state.teams, ...primeraFillerIds.map(dummyTeam)],
    otherDivisions: {
      ...state.otherDivisions,
      segundafeb: {
        ...state.otherDivisions.segundafeb,
        groups: state.otherDivisions.segundafeb.groups.map((g) => ({
          ...g,
          teams: [...g.teams, ...segundaFillerIds.map((s) => dummyTeam(`${g.id}${s}`))],
        })),
      },
    },
  };
}

describe("reducer", () => {
  it("SIM_ROUND never finds an academy prospect without a scout hired", () => {
    const state = baseState();
    const next = reducer(state, { type: "SIM_ROUND" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.academy).toEqual([]);
    expect(team.scoutCooldown).toBeNull();
  });

  it("a scout on cooldown 1 finds a 16-22yo prospect this round and resets the cooldown", () => {
    const state = baseState();
    state.teams = state.teams.map((t) =>
      t.id === "a" ? { ...t, staff: { scout: { tierId: "scout_2" } }, scoutCooldown: 1 } : t
    );
    const next = reducer(state, { type: "SIM_ROUND" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.academy).toHaveLength(1);
    const prospect = next.playersById[team.academy[0]];
    expect(prospect.age).toBeGreaterThanOrEqual(16);
    expect(prospect.age).toBeLessThanOrEqual(22);
    expect(team.scoutCooldown).toBeGreaterThanOrEqual(13);
    expect(team.scoutCooldown).toBeLessThanOrEqual(26);
    expect(team.scoutSearchTotal).toBe(team.scoutCooldown);
  });

  it("a scout with cooldown left just ticks down without finding anyone, keeping the same search total", () => {
    const state = baseState();
    state.teams = state.teams.map((t) =>
      t.id === "a" ? { ...t, staff: { scout: { tierId: "scout_0" } }, scoutCooldown: 10, scoutSearchTotal: 20 } : t
    );
    const next = reducer(state, { type: "SIM_ROUND" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.academy).toEqual([]);
    expect(team.scoutCooldown).toBe(9);
    expect(team.scoutSearchTotal).toBe(20);
  });

  it("firing the scout resets the cooldown so a new hire starts a fresh search", () => {
    const state = baseState();
    state.teams = state.teams.map((t) =>
      t.id === "a" ? { ...t, staff: { scout: { tierId: "scout_0" } }, scoutCooldown: 5 } : t
    );
    const next = reducer(state, { type: "FIRE_STAFF_ROLE", teamId: "a", roleId: "scout" });
    expect(next.teams.find((t) => t.id === "a").scoutCooldown).toBeNull();
  });

  it("SET_TACTIC updates the given kind and rejects an unknown value", () => {
    const state = baseState();
    const next = reducer(state, { type: "SET_TACTIC", teamId: "a", kind: "offense", value: "exterior" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.tactics.offense).toBe("exterior");
    expect(team.tactics.defense).toBe("man");

    const rejected = reducer(state, { type: "SET_TACTIC", teamId: "a", kind: "offense", value: "nope" });
    expect(rejected).toBe(state);
  });

  it("SET_LINEUP clears the player's previous slot so nobody starts twice", () => {
    const state = baseState();
    const next = reducer(state, { type: "SET_LINEUP", teamId: "a", position: "SG", playerId: "p1" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.lineup.SG).toBe("p1");
    expect(team.lineup.PG).toBeNull();
  });

  it("SET_LINEUP rejects a lineup with more foreign starters than the quota allows", () => {
    const state = baseState();
    state.playersById.p1.nationality = "Estados Unidos";
    state.playersById.p2.nationality = "Estados Unidos";
    state.playersById.p3.nationality = "Estados Unidos";
    let next = reducer(state, { type: "SET_LINEUP", teamId: "a", position: "SG", playerId: "p2" });
    // two foreigners (p1 at PG, p2 at SG) is within the quota of 2
    expect(next.teams.find((t) => t.id === "a").lineup.SG).toBe("p2");
    // a third foreigner at PF should be rejected (no-op)
    next = reducer(next, { type: "SET_LINEUP", teamId: "a", position: "PF", playerId: "p3" });
    expect(next.teams.find((t) => t.id === "a").lineup.PF).toBeNull();
  });

  it("BUY_PLAYER moves the player and money between teams", () => {
    const state = baseState();
    const next = reducer(state, { type: "BUY_PLAYER", buyerTeamId: "a", playerId: "p4" });
    const buyer = next.teams.find((t) => t.id === "a");
    const seller = next.teams.find((t) => t.id === "b");
    expect(buyer.roster).toContain("p4");
    expect(seller.roster).not.toContain("p4");
    expect(buyer.budget).toBe(500000 - next.playersById.p4.value);
    expect(seller.budget).toBe(500000 + next.playersById.p4.value);
  });

  it("BUY_PLAYER is a no-op if the buyer can't afford the player", () => {
    const state = baseState();
    state.teams[0].budget = 0;
    const next = reducer(state, { type: "BUY_PLAYER", buyerTeamId: "a", playerId: "p4" });
    expect(next).toBe(state);
  });

  it("BUY_PLAYER can sign a player from a background division, patching that team inside otherDivisions", () => {
    const state = baseState();
    const acbTeam = state.otherDivisions.acb.groups[0].teams[0]; // acb1
    state.playersById.p5 = {
      id: "p5",
      name: "p5",
      position: "PG",
      nationality: "España",
      age: 25,
      ratings: { shooting: 60, defense: 60, passing: 60, rebounding: 60, physical: 60 },
      overall: 60,
      potential: 60,
      value: 90000,
      wage: 900,
      contractYears: 2,
      seasonMinutes: 0,
      listed: false,
      morale: 80,
      form: 99,
      injured: false,
      teamId: acbTeam.id,
      isProspect: false,
    };
    acbTeam.roster.push("p5");
    acbTeam.lineup = { PG: "p5" };
    acbTeam.budget = 0;

    const next = reducer(state, { type: "BUY_PLAYER", buyerTeamId: "a", playerId: "p5" });
    const buyer = next.teams.find((t) => t.id === "a");
    const seller = next.otherDivisions.acb.groups[0].teams.find((t) => t.id === acbTeam.id);
    expect(buyer.roster).toContain("p5");
    expect(seller.roster).not.toContain("p5");
    expect(seller.lineup.PG).toBeNull();
    expect(seller.budget).toBe(90000);
    expect(next.playersById.p5.teamId).toBe("a");
  });

  it("BUY_PLAYER refuses a cross-division signing far above the buyer's actual level", () => {
    const state = baseState();
    const acbTeam = state.otherDivisions.acb.groups[0].teams[0];
    state.playersById.p5 = {
      id: "p5",
      name: "Star Player",
      position: "PG",
      nationality: "España",
      age: 25,
      ratings: { shooting: 90, defense: 90, passing: 90, rebounding: 90, physical: 90 },
      overall: 90,
      potential: 90,
      value: 900000,
      wage: 9000,
      contractYears: 2,
      seasonMinutes: 0,
      listed: false,
      morale: 80,
      form: 99,
      injured: false,
      teamId: acbTeam.id,
      isProspect: false,
    };
    acbTeam.roster.push("p5");
    state.teams[0].budget = 5000000; // affordability isn't the blocker here

    const next = reducer(state, { type: "BUY_PLAYER", buyerTeamId: "a", playerId: "p5" });
    expect(next).toBe(state);
  });

  it("MAKE_OFFER near the player's value gets accepted and moves the player", () => {
    const state = baseState();
    const next = reducer(state, { type: "MAKE_OFFER", buyerTeamId: "a", playerId: "p4", amount: 95000 });
    const teamA = next.teams.find((t) => t.id === "a");
    const teamB = next.teams.find((t) => t.id === "b");
    expect(teamA.roster).toContain("p4");
    expect(teamB.roster).not.toContain("p4");
    expect(teamA.budget).toBe(500000 - 95000);
    expect(teamB.budget).toBe(500000 + 95000);
    expect(next.playersById.p4.teamId).toBe("a");
  });

  it("MAKE_OFFER in the middle range gets countered instead of accepted or moving the player", () => {
    const state = baseState();
    const next = reducer(state, { type: "MAKE_OFFER", buyerTeamId: "a", playerId: "p4", amount: 70000 });
    expect(next.teams.find((t) => t.id === "b").roster).toContain("p4");
    expect(next.log[0].text).toContain("€90,000");
  });

  it("MAKE_OFFER far below value gets flatly rejected", () => {
    const state = baseState();
    const next = reducer(state, { type: "MAKE_OFFER", buyerTeamId: "a", playerId: "p4", amount: 20000 });
    expect(next.teams.find((t) => t.id === "b").roster).toContain("p4");
    expect(next.log[0].text).toContain("rechazó");
  });

  it("RESOLVE_OFFER accept moves the player and money, and clears the offer", () => {
    const state = baseState();
    state.pendingOffers = [{ id: "o1", playerId: "p1", fromTeamId: "b", amount: 90000 }];
    const next = reducer(state, { type: "RESOLVE_OFFER", offerId: "o1", accept: true });
    const teamA = next.teams.find((t) => t.id === "a");
    const teamB = next.teams.find((t) => t.id === "b");
    expect(teamA.roster).not.toContain("p1");
    expect(teamB.roster).toContain("p1");
    expect(teamA.budget).toBe(500000 + 90000);
    expect(teamB.budget).toBe(500000 - 90000);
    expect(next.pendingOffers).toHaveLength(0);
  });

  it("RESOLVE_OFFER reject leaves the roster untouched and clears the offer", () => {
    const state = baseState();
    state.pendingOffers = [{ id: "o1", playerId: "p1", fromTeamId: "b", amount: 90000 }];
    const next = reducer(state, { type: "RESOLVE_OFFER", offerId: "o1", accept: false });
    expect(next.teams.find((t) => t.id === "a").roster).toContain("p1");
    expect(next.pendingOffers).toHaveLength(0);
  });

  it("UPGRADE_STADIUM charges the tier cost immediately but starts a multi-week build", () => {
    const state = baseState();
    const next = reducer(state, { type: "UPGRADE_STADIUM", teamId: "a", tierId: "medium" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.budget).toBeLessThan(500000);
    // Capacity/level don't apply until the build finishes.
    expect(team.stadium.level).toBe(1);
    expect(team.stadium.capacity).toBe(8000);
    expect(team.stadium.pendingProject).toMatchObject({ kind: "tier", weeksLeft: 3, weeksTotal: 3 });
  });

  it("UPGRADE_STADIUM refuses to start a second build while one is in progress", () => {
    const state = baseState();
    state.teams[0].stadium.pendingProject = { kind: "tier", label: "x", capacityGain: 1, weeksLeft: 1, weeksTotal: 3 };
    const next = reducer(state, { type: "UPGRADE_STADIUM", teamId: "a", tierId: "small" });
    expect(next).toBe(state);
  });

  it("a stadium build applies capacity/level once weeksLeft counts down to zero, leaving ticket price to the player", () => {
    const state = baseState();
    const ticketPriceBefore = state.teams[0].stadium.ticketPrice;
    state.teams[0].stadium.pendingProject = {
      kind: "tier",
      label: "Ampliación media",
      capacityGain: 2500,
      weeksLeft: 1,
      weeksTotal: 3,
    };
    const next = reducer(state, { type: "SIM_ROUND" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.stadium.pendingProject).toBeNull();
    expect(team.stadium.level).toBe(2);
    expect(team.stadium.capacity).toBe(10500);
    expect(team.stadium.ticketPrice).toBe(ticketPriceBefore);
  });

  it("SET_TICKET_PRICE clamps to a sane range", () => {
    const state = baseState();
    const next = reducer(state, { type: "SET_TICKET_PRICE", teamId: "a", price: 9999 });
    expect(next.teams.find((t) => t.id === "a").stadium.ticketPrice).toBe(100);
  });

  it("HIRE_STAFF_ROLE fills the role and charges the hire cost", () => {
    const state = baseState();
    const next = reducer(state, { type: "HIRE_STAFF_ROLE", teamId: "a", roleId: "headCoach", tierId: "head_0" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.staff.headCoach).toEqual({ tierId: "head_0" });
    expect(team.budget).toBeLessThan(500000);
  });

  it("HIRE_STAFF_ROLE refuses to fill an already-occupied role", () => {
    const state = baseState();
    state.teams[0].staff = { headCoach: { tierId: "head_0" } };
    const next = reducer(state, { type: "HIRE_STAFF_ROLE", teamId: "a", roleId: "headCoach", tierId: "head_1" });
    expect(next).toBe(state);
  });

  it("FIRE_STAFF_ROLE charges a full season of wages as severance and frees the role", () => {
    const state = baseState();
    state.teams[0].staff = { headCoach: { tierId: "head_0" } };
    const next = reducer(state, { type: "FIRE_STAFF_ROLE", teamId: "a", roleId: "headCoach" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.staff.headCoach).toBeNull();
    expect(team.budget).toBeLessThan(500000);
  });

  it("SELECT_SPONSOR signs one of the available offers into the given slot", () => {
    const state = baseState();
    const next = reducer(state, {
      type: "SELECT_SPONSOR",
      teamId: "a",
      slot: "jersey",
      sponsorId: "jersey_local",
    });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.sponsors.jersey.id).toBe("jersey_local");
    expect(team.sponsors.stadium).toBeNull();
  });

  it("SIM_ROUND advances the round and records a result", () => {
    const state = baseState();
    const next = reducer(state, { type: "SIM_ROUND" });
    expect(next.round).toBe(1);
    expect(next.lastRoundResults).toHaveLength(1);
    expect(next.results).toHaveLength(1);
  });

  it("SIM_ROUND records a financeHistory entry only for the user's own team", () => {
    const state = baseState();
    const next = reducer(state, { type: "SIM_ROUND" });
    const userTeam = next.teams.find((t) => t.id === "a");
    const aiTeam = next.teams.find((t) => t.id === "b");
    expect(userTeam.financeHistory).toHaveLength(1);
    expect(userTeam.financeHistory[0]).toMatchObject({ round: 0, seasonYear: 2025 });
    expect(userTeam.financeHistory[0].net).toBe(userTeam.financeHistory[0].income - userTeam.financeHistory[0].expenses);
    expect(aiTeam.financeHistory).toEqual([]);
  });

  it("SIM_ROUND deducts player wages and stadium maintenance from the budget", () => {
    const state = baseState();
    // huge wage/upkeep vs tiny ticket revenue for the away team makes the
    // net effect unambiguous regardless of that round's random attendance
    state.playersById.p4.wage = 400000;
    const next = reducer(state, { type: "SIM_ROUND" });
    const away = next.teams.find((t) => t.id === "b");
    expect(away.budget).toBeLessThan(500000);
  });

  it("SIM_ROUND tracks a red-numbers streak but leaves the roster alone under the limit", () => {
    const state = baseState();
    state.teams[0].budget = -1000000;
    state.teams[0].redStreak = 1;
    const next = reducer(state, { type: "SIM_ROUND" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.redStreak).toBe(2);
    expect(team.roster).toEqual(["p1", "p2", "p3"]);
  });

  it("SIM_ROUND forces a fire-sale of a bench player once the red-numbers streak hits the limit", () => {
    const state = baseState();
    state.teams[0].budget = -1000000;
    state.teams[0].redStreak = 3;
    const next = reducer(state, { type: "SIM_ROUND" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.redStreak).toBe(0);
    // p1 is the lineup starter and can't be the one sold off.
    expect(team.roster).toContain("p1");
    expect(team.roster.length).toBe(2);
    const soldId = ["p2", "p3"].find((id) => !team.roster.includes(id));
    expect(next.playersById[soldId].teamId).toBeNull();
    expect(team.budget).toBeGreaterThan(-1000000);
    expect(next.log.some((e) => e.text.includes("Intervención por números rojos"))).toBe(true);
  });

  it("SIM_ROUND is a no-op past the last scheduled round", () => {
    const state = { ...baseState(), round: 2 };
    const next = reducer(state, { type: "SIM_ROUND" });
    expect(next).toBe(state);
  });

  it("SIM_ROUND starts a new season after the last round: ages players and resets records", () => {
    const state = { ...withPlayoffSizedDivisions(baseState()), round: 1 };
    const next = reducer(state, { type: "SIM_ROUND" });
    expect(next.round).toBe(0);
    expect(next.schedule.length).toBeGreaterThan(0);
    expect(next.playersById.p1.age).toBe(26);
    expect(next.playersById.p1.contractYears).toBe(1);
    const team = next.teams.find((t) => t.id === "a");
    expect(team.record.wins).toBe(0);
    expect(team.record.losses).toBe(0);
  });

  it("SIM_ROUND resolves promotion/relegation at season end, keeping the pyramid's team count constant", () => {
    const state = { ...withPlayoffSizedDivisions(baseState()), round: 1 };
    const countTeams = (s) =>
      s.teams.length +
      Object.values(s.otherDivisions).reduce(
        (sum, d) => sum + d.groups.reduce((s2, g) => s2 + g.teams.length, 0),
        0
      );
    const before = countTeams(state);
    const next = reducer(state, { type: "SIM_ROUND" });
    expect(countTeams(next)).toBe(before);
    expect(["acb", "primerafeb", "segundafeb", "tercerafeb"]).toContain(next.activeDivisionId);
    // every division not currently active is fully present in otherDivisions
    for (const id of ["acb", "primerafeb", "segundafeb", "tercerafeb"]) {
      if (id === next.activeDivisionId) continue;
      expect(next.otherDivisions[id]).toBeTruthy();
    }
    // wherever the user's team ended up, it must be findable in state.teams
    expect(next.teams.some((t) => t.id === "a")).toBe(true);
    // every group starts its new season at round 0 with reset records
    for (const div of Object.values(next.otherDivisions)) {
      for (const g of div.groups) {
        expect(g.round).toBe(0);
        for (const t of g.teams) expect(t.record.wins).toBe(0);
      }
    }

    // season summary: one entry per division, each with at least one
    // champion (Segunda/Tercera FEB crown one per group)
    expect(next.lastSeasonSummary.seasonYear).toBe(2025);
    expect(next.lastSeasonSummary.divisions).toHaveLength(4);
    for (const div of next.lastSeasonSummary.divisions) {
      expect(div.champions.length).toBeGreaterThan(0);
    }
    const acbSummary = next.lastSeasonSummary.divisions.find((d) => d.id === "acb");
    expect(acbSummary.relegated).toHaveLength(2);
    const segundaSummary = next.lastSeasonSummary.divisions.find((d) => d.id === "segundafeb");
    expect(segundaSummary.promoted).toHaveLength(3);
  });

  it("SIM_ROUND flags the user's team's expired contracts for renewal, but auto-renews AI teams", () => {
    const state = { ...withPlayoffSizedDivisions(baseState()), round: 1 };
    state.playersById.p1.contractYears = 1; // hits 0 after this season's aging step
    state.playersById.p4.contractYears = 1;
    const next = reducer(state, { type: "SIM_ROUND" });
    expect(next.pendingContracts).toContain("p1");
    expect(next.playersById.p4.contractYears).toBeGreaterThan(0);
  });

  it("RESOLVE_CONTRACT accepts a generous offer and clears the pending flag", () => {
    const state = baseState();
    state.pendingContracts = ["p1"];
    const next = reducer(state, {
      type: "RESOLVE_CONTRACT",
      teamId: "a",
      playerId: "p1",
      offeredYears: 2,
      offeredWage: 5000,
    });
    expect(next.pendingContracts).not.toContain("p1");
    expect(next.playersById.p1.wage).toBe(5000);
  });

  it("RESOLVE_CONTRACT drops the player from the roster on a lowball rejected offer", () => {
    const state = baseState();
    state.pendingContracts = ["p1"];
    const next = reducer(state, {
      type: "RESOLVE_CONTRACT",
      teamId: "a",
      playerId: "p1",
      offeredYears: 1,
      offeredWage: 100,
    });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.roster).not.toContain("p1");
    expect(next.playersById.p1.teamId).toBeNull();
  });

  it("SIGN_FREE_AGENT adds a teamId-less player to the roster for free", () => {
    const state = baseState();
    state.playersById.p1 = { ...state.playersById.p1, teamId: null };
    state.teams = state.teams.map((t) =>
      t.id === "a" ? { ...t, roster: t.roster.filter((id) => id !== "p1") } : t
    );
    const budgetBefore = state.teams.find((t) => t.id === "a").budget;

    const next = reducer(state, { type: "SIGN_FREE_AGENT", teamId: "a", playerId: "p1" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.roster).toContain("p1");
    expect(team.budget).toBe(budgetBefore);
    expect(next.playersById.p1.teamId).toBe("a");
  });

  it("SIGN_FREE_AGENT is a no-op for a player who still has a team", () => {
    const state = baseState();
    const next = reducer(state, { type: "SIGN_FREE_AGENT", teamId: "b", playerId: "p1" });
    expect(next).toBe(state);
  });

  it("LIST_PLAYER toggles the listed flag", () => {
    const state = baseState();
    const next = reducer(state, { type: "LIST_PLAYER", playerId: "p2", listed: true });
    expect(next.playersById.p2.listed).toBe(true);
  });

  it("SIM_ROUND is a no-op during preseason, ADVANCE_PRESEASON ticks the calendar instead", () => {
    const state = { ...baseState(), preseasonWeeksLeft: 2, currentDate: "2025-07-01" };
    const blocked = reducer(state, { type: "SIM_ROUND" });
    expect(blocked).toBe(state);

    const advanced = reducer(state, { type: "ADVANCE_PRESEASON" });
    expect(advanced.preseasonWeeksLeft).toBe(1);
    expect(advanced.currentDate).toBe("2025-07-08");

    const done = reducer(advanced, { type: "ADVANCE_PRESEASON" });
    expect(done.preseasonWeeksLeft).toBe(0);
    const noopAfterDone = reducer(done, { type: "ADVANCE_PRESEASON" });
    expect(noopAfterDone).toBe(done);
  });

  it("SIM_ROUND advances the fictional date by a week once preseason is over", () => {
    const state = baseState();
    const next = reducer(state, { type: "SIM_ROUND" });
    expect(next.currentDate).toBe("2025-09-08");
  });

  it("the last ADVANCE_PRESEASON tick locks in season ticket holders and pays the lump sum upfront", () => {
    const state = { ...baseState(), preseasonWeeksLeft: 1 };
    const budgetBefore = state.teams.find((t) => t.id === "a").budget;

    const next = reducer(state, { type: "ADVANCE_PRESEASON" });
    const team = next.teams.find((t) => t.id === "a");
    expect(next.preseasonWeeksLeft).toBe(0);
    expect(team.stadium.seasonTicketHolders).toBeGreaterThan(0);
    expect(team.budget).toBeGreaterThan(budgetBefore);
    expect(next.log[0].text).toMatch(/Abonos vendidos/);
    expect(next.log[0].date).toBe(next.currentDate);
  });

  it("SET_SEASON_TICKET_PRICE updates and clamps the season ticket price", () => {
    const state = baseState();
    const next = reducer(state, { type: "SET_SEASON_TICKET_PRICE", teamId: "a", price: 500 });
    expect(next.teams.find((t) => t.id === "a").stadium.seasonTicketPrice).toBe(500);

    const clamped = reducer(state, { type: "SET_SEASON_TICKET_PRICE", teamId: "a", price: 10 });
    expect(clamped.teams.find((t) => t.id === "a").stadium.seasonTicketPrice).toBe(30);
  });

  it("REQUEST_LOAN adds the principal to the budget and clamps to the team's cap", () => {
    const state = baseState();
    const next = reducer(state, { type: "REQUEST_LOAN", teamId: "a", amount: 5000 });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.budget).toBe(505000);
    expect(team.loan).toMatchObject({ principal: 5000, weeksLeft: 20 });
    expect(team.loan.remaining).toBeGreaterThan(5000);

    // Way beyond this team's cap (its wage/maintenance bill is tiny) gets
    // clamped down instead of handing out an unbounded loan.
    const state2 = baseState();
    const huge = reducer(state2, { type: "REQUEST_LOAN", teamId: "a", amount: 50000000 });
    const team2 = huge.teams.find((t) => t.id === "a");
    expect(team2.budget - 500000).toBeLessThan(50000000);
  });

  it("REQUEST_LOAN refuses a second loan while one is outstanding", () => {
    const state = baseState();
    state.teams[0].loan = { principal: 1000, remaining: 1000, weeklyPayment: 100, weeksLeft: 10 };
    const next = reducer(state, { type: "REQUEST_LOAN", teamId: "a", amount: 5000 });
    expect(next).toBe(state);
  });

  it("a loan's weekly payment is deducted from the budget by SIM_ROUND, clearing once repaid", () => {
    const state = baseState();
    state.teams[0].loan = { principal: 1000, remaining: 500, weeklyPayment: 500, weeksLeft: 1 };
    const next = reducer(state, { type: "SIM_ROUND" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.loan).toBeNull();
    expect(next.log.some((e) => e.text === "Crédito saldado.")).toBe(true);
  });

  it("BUILD_AMENITY charges the cost immediately but starts a multi-week build", () => {
    const state = baseState();
    const next = reducer(state, { type: "BUILD_AMENITY", teamId: "a", amenityId: "shops" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.budget).toBeLessThan(500000);
    expect(team.stadium.amenities?.shops).toBeUndefined();
    expect(team.stadium.pendingProject).toMatchObject({
      kind: "amenity",
      amenityId: "shops",
      level: 1,
      weeksLeft: 2,
      weeksTotal: 2,
    });
  });

  it("BUILD_AMENITY refuses to start a second build while one is in progress", () => {
    const state = baseState();
    state.teams[0].stadium.pendingProject = { kind: "amenity", label: "x", amenityId: "shops", level: 1, weeksLeft: 1, weeksTotal: 2 };
    const next = reducer(state, { type: "BUILD_AMENITY", teamId: "a", amenityId: "scoreboard" });
    expect(next).toBe(state);
  });

  it("an amenity build applies its level once weeksLeft counts down to zero, one level at a time", () => {
    const state = baseState();
    state.teams[0].stadium.pendingProject = {
      kind: "amenity",
      label: "Tienda oficial",
      amenityId: "shops",
      level: 1,
      weeksLeft: 1,
      weeksTotal: 2,
    };
    const level1 = reducer(state, { type: "SIM_ROUND" });
    const team1 = level1.teams.find((t) => t.id === "a");
    expect(team1.stadium.pendingProject).toBeNull();
    expect(team1.stadium.amenities.shops).toBe(1);

    const withNextBuild = reducer(level1, { type: "BUILD_AMENITY", teamId: "a", amenityId: "shops" });
    const team1b = withNextBuild.teams.find((t) => t.id === "a");
    expect(team1b.stadium.pendingProject).toMatchObject({ amenityId: "shops", level: 2 });
    expect(team1.budget - team1b.budget).toBeGreaterThan(0);
  });

  it("pushLog keeps entries within the retention window and drops older ones", () => {
    let state = baseState();
    state = { ...state, log: [{ text: "old news", date: "2025-01-01" }] };
    const next = reducer(state, { type: "BUY_PLAYER", buyerTeamId: "a", playerId: "p4" });
    expect(next.log.some((e) => e.text === "old news")).toBe(false);
    expect(next.log[0].date).toBe(state.currentDate);
  });
});
