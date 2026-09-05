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
    log: [],
    seasonYear: 2025,
    currentDate: "2025-09-01",
    preseasonWeeksLeft: 0,
    activeDivisionId: "primerafeb",
    otherDivisions: {
      acb: {
        name: "ACB",
        teams: [
          { id: "acb1", name: "acb1", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
          { id: "acb2", name: "acb2", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
        ],
        schedule: [[["acb1", "acb2"]], [["acb2", "acb1"]]],
        round: 0,
        results: [],
        lastRoundResults: [],
      },
      segundafeb: {
        name: "Segunda FEB",
        teams: [
          { id: "sf1", name: "sf1", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
          { id: "sf2", name: "sf2", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
        ],
        schedule: [[["sf1", "sf2"]], [["sf2", "sf1"]]],
        round: 0,
        results: [],
        lastRoundResults: [],
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

// resolvePyramid's promotion playoff pool is positions 2-5 and relegation is
// the bottom 2 — pad every division up to 10 teams (real divisions are
// 14-18) so those two zones never overlap the way they would in a tiny
// fixture, which would relegate and promote the same filler team.
function withPlayoffSizedDivisions(state) {
  const fillerIds = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
  return {
    ...state,
    teams: [...state.teams, ...fillerIds.map(dummyTeam)],
    otherDivisions: Object.fromEntries(
      Object.entries(state.otherDivisions).map(([id, div]) => [
        id,
        { ...div, teams: [...div.teams, ...fillerIds.map((s) => dummyTeam(`${id}${s}`))] },
      ])
    ),
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

  it("UPGRADE_STADIUM charges the tier cost and bumps capacity/level", () => {
    const state = baseState();
    const next = reducer(state, { type: "UPGRADE_STADIUM", teamId: "a", tierId: "medium" });
    const team = next.teams.find((t) => t.id === "a");
    expect(team.stadium.level).toBe(2);
    expect(team.stadium.capacity).toBeGreaterThan(8000);
    expect(team.budget).toBeLessThan(500000);
  });

  it("SET_TICKET_PRICE clamps to a sane range", () => {
    const state = baseState();
    const next = reducer(state, { type: "SET_TICKET_PRICE", teamId: "a", price: 9999 });
    expect(next.teams.find((t) => t.id === "a").stadium.ticketPrice).toBe(200);
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
      s.teams.length + Object.values(s.otherDivisions).reduce((sum, d) => sum + d.teams.length, 0);
    const before = countTeams(state);
    const next = reducer(state, { type: "SIM_ROUND" });
    expect(countTeams(next)).toBe(before);
    expect(["acb", "primerafeb", "segundafeb"]).toContain(next.activeDivisionId);
    expect(Object.keys(next.otherDivisions).sort()).toEqual(
      ["acb", "primerafeb", "segundafeb"].filter((id) => id !== next.activeDivisionId).sort()
    );
    // wherever the user's team ended up, it must be findable in state.teams
    expect(next.teams.some((t) => t.id === "a")).toBe(true);
    // every division starts its new season at round 0 with reset records
    for (const div of Object.values(next.otherDivisions)) {
      expect(div.round).toBe(0);
      for (const t of div.teams) expect(t.record.wins).toBe(0);
    }

    // season summary: one entry per division, each with a champion and
    // exactly 2 promoted/relegated names (this fixture's playoff sizing)
    expect(next.lastSeasonSummary.seasonYear).toBe(2025);
    expect(next.lastSeasonSummary.divisions).toHaveLength(3);
    for (const div of next.lastSeasonSummary.divisions) {
      expect(typeof div.championName).toBe("string");
    }
    const acbSummary = next.lastSeasonSummary.divisions.find((d) => d.id === "acb");
    expect(acbSummary.relegated).toHaveLength(2);
    const segundaSummary = next.lastSeasonSummary.divisions.find((d) => d.id === "segundafeb");
    expect(segundaSummary.promoted).toHaveLength(2);
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
    expect(clamped.teams.find((t) => t.id === "a").stadium.seasonTicketPrice).toBe(50);
  });

  it("BUILD_AMENITY upgrades one level at a time, each one pricier than the last", () => {
    const state = baseState();
    const level1 = reducer(state, { type: "BUILD_AMENITY", teamId: "a", amenityId: "shops" });
    const team1 = level1.teams.find((t) => t.id === "a");
    expect(team1.stadium.amenities.shops).toBe(1);

    const level2 = reducer(level1, { type: "BUILD_AMENITY", teamId: "a", amenityId: "shops" });
    const team2 = level2.teams.find((t) => t.id === "a");
    expect(team2.stadium.amenities.shops).toBe(2);
    expect(team1.budget - team2.budget).toBeGreaterThan(500000 - team1.budget);
  });

  it("pushLog keeps entries within the retention window and drops older ones", () => {
    let state = baseState();
    state = { ...state, log: [{ text: "old news", date: "2025-01-01" }] };
    const next = reducer(state, { type: "BUY_PLAYER", buyerTeamId: "a", playerId: "p4" });
    expect(next.log.some((e) => e.text === "old news")).toBe(false);
    expect(next.log[0].date).toBe(state.currentDate);
  });
});
