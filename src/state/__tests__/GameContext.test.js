import { reducer } from "../GameContext";

function baseState() {
  const teamA = {
    id: "a",
    name: "Team A",
    budget: 500000,
    roster: ["p1", "p2", "p3"],
    academy: [],
    stadium: { name: "Arena A", level: 1, capacity: 8000, ticketPrice: 25 },
    staff: {},
    sponsor: null,
    record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
    lineup: { PG: "p1", SG: null, SF: null, PF: null, C: null },
  };
  const teamB = {
    id: "b",
    name: "Team B",
    budget: 500000,
    roster: ["p4"],
    academy: [],
    stadium: { name: "Arena B", level: 1, capacity: 8000, ticketPrice: 25 },
    staff: {},
    sponsor: null,
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
    activeDivisionId: "primerafeb",
    otherDivisions: {
      acb: {
        name: "ACB",
        teams: [
          { id: "acb1", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
          { id: "acb2", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
        ],
        schedule: [[["acb1", "acb2"]], [["acb2", "acb1"]]],
        round: 0,
        results: [],
        lastRoundResults: [],
      },
      segundafeb: {
        name: "Segunda FEB",
        teams: [
          { id: "sf1", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
          { id: "sf2", stadium: { level: 1 }, staff: {}, roster: [], lineup: {}, record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } },
        ],
        schedule: [[["sf1", "sf2"]], [["sf2", "sf1"]]],
        round: 0,
        results: [],
        lastRoundResults: [],
      },
    },
  };
}

describe("reducer", () => {
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

  it("SELECT_SPONSOR signs one of the available offers", () => {
    const state = baseState();
    const next = reducer(state, { type: "SELECT_SPONSOR", teamId: "a", sponsorId: "local" });
    expect(next.teams.find((t) => t.id === "a").sponsor.id).toBe("local");
  });

  it("SIM_ROUND advances the round and records a result", () => {
    const state = baseState();
    const next = reducer(state, { type: "SIM_ROUND" });
    expect(next.round).toBe(1);
    expect(next.lastRoundResults).toHaveLength(1);
    expect(next.results).toHaveLength(1);
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
    const state = { ...baseState(), round: 1 };
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
    const state = { ...baseState(), round: 1 };
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
  });

  it("SIM_ROUND flags the user's team's expired contracts for renewal, but auto-renews AI teams", () => {
    const state = { ...baseState(), round: 1 };
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
  });

  it("LIST_PLAYER toggles the listed flag", () => {
    const state = baseState();
    const next = reducer(state, { type: "LIST_PLAYER", playerId: "p2", listed: true });
    expect(next.playersById.p2.listed).toBe(true);
  });
});
