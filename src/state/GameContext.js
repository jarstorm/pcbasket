import { createContext, useContext, useReducer, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateRealLeague } from "../data/generate";
import { generateSchedule } from "../engine/schedule";
import { simulateMatch } from "../engine/simulate";

const SAVE_KEY = "pcbasket-save-v1";

function freshGame() {
  const { teams, players } = generateRealLeague();
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const schedule = generateSchedule(teams.map((t) => t.id), true);
  return {
    teams,
    playersById,
    schedule,
    round: 0,
    userTeamId: null,
    teamChosen: false,
    results: [], // flat list of played matches
    lastRoundResults: [],
    log: [],
  };
}

const GameContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "NEW_GAME":
      return freshGame();

    case "CHOOSE_TEAM":
      return { ...state, userTeamId: action.teamId, teamChosen: true };

    case "LOAD":
      return action.state;

    case "SET_LINEUP": {
      const { teamId, position, playerId } = action;
      const teams = state.teams.map((t) =>
        t.id === teamId ? { ...t, lineup: { ...t.lineup, [position]: playerId } } : t
      );
      return { ...state, teams };
    }

    case "BUY_PLAYER": {
      const { buyerTeamId, playerId } = action;
      const player = state.playersById[playerId];
      if (!player) return state;
      const seller = state.teams.find((t) => t.id === player.teamId);
      const buyer = state.teams.find((t) => t.id === buyerTeamId);
      if (!buyer || !seller || buyer.id === seller.id) return state;
      const price = player.value;
      if (buyer.budget < price) return state;
      if (buyer.roster.length >= 15) return state;

      const teams = state.teams.map((t) => {
        if (t.id === seller.id) {
          return {
            ...t,
            budget: t.budget + price,
            roster: t.roster.filter((id) => id !== playerId),
            lineup: Object.fromEntries(
              Object.entries(t.lineup).map(([pos, id]) => [pos, id === playerId ? null : id])
            ),
          };
        }
        if (t.id === buyer.id) {
          return { ...t, budget: t.budget - price, roster: [...t.roster, playerId] };
        }
        return t;
      });

      const playersById = {
        ...state.playersById,
        [playerId]: { ...player, teamId: buyer.id },
      };

      return {
        ...state,
        teams,
        playersById,
        log: [`${player.name} fichado por ${buyer.name} por $${price.toLocaleString()}`, ...state.log].slice(0, 30),
      };
    }

    case "PROMOTE_YOUTH": {
      const { teamId, prospectId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team || !team.academy.includes(prospectId)) return state;
      if (team.roster.length >= 15) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              roster: [...t.roster, prospectId],
              academy: t.academy.filter((id) => id !== prospectId),
            }
          : t
      );
      const playersById = {
        ...state.playersById,
        [prospectId]: { ...state.playersById[prospectId], isProspect: false },
      };
      return {
        ...state,
        teams,
        playersById,
        log: [`${state.playersById[prospectId].name} promovido al primer equipo`, ...state.log].slice(0, 30),
      };
    }

    case "UPGRADE_STADIUM": {
      const { teamId } = action;
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return state;
      const cost = 150000 * team.stadium.level;
      if (team.budget < cost) return state;
      const teams = state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              budget: t.budget - cost,
              stadium: {
                ...t.stadium,
                level: t.stadium.level + 1,
                capacity: t.stadium.capacity + 2500,
                ticketPrice: t.stadium.ticketPrice + 5,
              },
            }
          : t
      );
      return {
        ...state,
        teams,
        log: [`${team.name} mejoró su estadio a nivel ${team.stadium.level + 1}`, ...state.log].slice(0, 30),
      };
    }

    case "SIM_ROUND": {
      if (state.round >= state.schedule.length) return state;
      const round = state.schedule[state.round];
      const teamsById = Object.fromEntries(state.teams.map((t) => [t.id, t]));
      const roundResults = [];
      let playersById = { ...state.playersById };
      const teamUpdates = {};

      for (const [homeId, awayId] of round) {
        const home = teamsById[homeId];
        const away = teamsById[awayId];
        const result = simulateMatch(home, away, playersById);
        roundResults.push(result);

        const ticketRevenue = Math.round(
          home.stadium.capacity * (0.5 + Math.random() * 0.4) * home.stadium.ticketPrice
        );

        teamUpdates[homeId] = {
          wins: (teamUpdates[homeId]?.wins || 0) + (result.homeScore > result.awayScore ? 1 : 0),
          losses: (teamUpdates[homeId]?.losses || 0) + (result.homeScore < result.awayScore ? 1 : 0),
          pf: (teamUpdates[homeId]?.pf || 0) + result.homeScore,
          pa: (teamUpdates[homeId]?.pa || 0) + result.awayScore,
          revenue: ticketRevenue,
        };
        teamUpdates[awayId] = {
          wins: (teamUpdates[awayId]?.wins || 0) + (result.awayScore > result.homeScore ? 1 : 0),
          losses: (teamUpdates[awayId]?.losses || 0) + (result.awayScore < result.homeScore ? 1 : 0),
          pf: (teamUpdates[awayId]?.pf || 0) + result.awayScore,
          pa: (teamUpdates[awayId]?.pa || 0) + result.homeScore,
          revenue: 0,
        };

        for (const ev of result.injuryEvents) {
          playersById[ev.playerId] = { ...playersById[ev.playerId], injured: true };
        }
      }

      const teams = state.teams.map((t) => {
        const upd = teamUpdates[t.id];
        if (!upd) return t;
        return {
          ...t,
          budget: t.budget + (upd.revenue || 0),
          record: {
            wins: t.record.wins + upd.wins,
            losses: t.record.losses + upd.losses,
            pointsFor: t.record.pointsFor + upd.pf,
            pointsAgainst: t.record.pointsAgainst + upd.pa,
          },
        };
      });

      return {
        ...state,
        teams,
        playersById,
        round: state.round + 1,
        results: [...state.results, ...roundResults],
        lastRoundResults: roundResults,
      };
    }

    default:
      return state;
  }
}

export function GameProvider({ children, loadingFallback = null }) {
  const [ready, setReady] = useState(false);
  const [state, dispatch] = useReducer(reducer, null, freshGame);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVE_KEY);
        if (raw && !cancelled) dispatch({ type: "LOAD", state: JSON.parse(raw) });
      } catch (e) {
        // ignore corrupt save
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(SAVE_KEY, JSON.stringify(state)).catch(() => {
      // storage full or unavailable, ignore
    });
  }, [ready, state]);

  if (!ready) return loadingFallback;

  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
