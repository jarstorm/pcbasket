import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import PlayerMarketCard from "../components/PlayerMarketCard";
import Select from "../components/Select";
import { POSITION_ORDER, POSITION_LABEL } from "../data/positions";
import { seededShuffle } from "../engine/random";
import { colors, spacing } from "../theme";
import SectionHeader from "../components/SectionHeader";

const MARKET_POOL_SIZE = 40;

const POSITION_OPTIONS = [
  { label: "Todas las posiciones", value: "ALL" },
  ...POSITION_ORDER.map((p) => ({ label: POSITION_LABEL[p], value: p })),
];

const SORT_OPTIONS = [
  { label: "Ordenar por valoración", value: "overall" },
  { label: "Ordenar por precio", value: "value" },
];

export default function TransferMarket() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("overall");

  const teamNameById = useMemo(
    () => Object.fromEntries(state.teams.map((t) => [t.id, t.name])),
    [state.teams]
  );

  // A rotating random pool of listed players (seeded by jornada) instead of
  // literally every player in the league always being for sale. Restricted
  // to the active division — background divisions' teams aren't in
  // state.teams, so buying from them would silently fail.
  const marketPlayers = useMemo(() => {
    const divisionTeamIds = new Set(state.teams.map((t) => t.id));
    const eligible = Object.values(state.playersById).filter(
      (p) => p.teamId !== team.id && divisionTeamIds.has(p.teamId) && !p.isProspect && !p.retired
    );
    const pool = seededShuffle(eligible, state.round).slice(0, MARKET_POOL_SIZE);
    return pool
      .filter((p) => posFilter === "ALL" || p.position === posFilter)
      .sort((a, b) => (sortBy === "overall" ? b.overall - a.overall : a.value - b.value));
  }, [state.playersById, state.teams, state.round, team.id, posFilter, sortBy]);

  // Released or rejected-renewal players with no club — free to sign, no fee.
  const freeAgents = useMemo(() => {
    const pool = Object.values(state.playersById).filter(
      (p) => p.teamId === null && !p.isProspect && !p.retired
    );
    return pool
      .filter((p) => posFilter === "ALL" || p.position === posFilter)
      .sort((a, b) => (sortBy === "overall" ? b.overall - a.overall : a.value - b.value));
  }, [state.playersById, posFilter, sortBy]);

  const annualWage = (p) => p.wage * state.schedule.length;

  return (
    <View>
      <Card>
        <SectionHeader>Mercado de fichajes</SectionHeader>
        <Text style={styles.dim}>
          Presupuesto disponible: <Text style={[styles.bold, { color: colors.accent }]}>${team.budget.toLocaleString()}</Text>{" "}
          · Plantilla: {team.roster.length}/15
        </Text>

        <View style={styles.filters}>
          <Select value={posFilter} options={POSITION_OPTIONS} onChange={setPosFilter} />
          <Select value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} />
        </View>

        {marketPlayers.map((p) => (
          <PlayerMarketCard
            key={p.id}
            player={p}
            teamName={teamNameById[p.teamId]}
            feeLabel="CLÁUSULA"
            feeValue={p.value}
            wageValue={annualWage(p)}
            disabled={team.budget < p.value || team.roster.length >= 15}
            buyLabel="Fichar"
            onBuy={() => dispatch({ type: "BUY_PLAYER", buyerTeamId: team.id, playerId: p.id })}
          />
        ))}
      </Card>

      <Card>
        <SectionHeader>Agentes libres</SectionHeader>
        <Text style={styles.dim}>Sin equipo — se fichan gratis, solo pagas su salario.</Text>
        {freeAgents.length === 0 ? (
          <Text style={styles.dim}>No hay agentes libres disponibles ahora mismo.</Text>
        ) : (
          freeAgents.map((p) => (
            <PlayerMarketCard
              key={p.id}
              player={p}
              wageValue={annualWage(p)}
              disabled={team.roster.length >= 15}
              buyLabel="Fichar"
              onBuy={() => dispatch({ type: "SIGN_FREE_AGENT", teamId: team.id, playerId: p.id })}
            />
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim, fontSize: 13, marginBottom: spacing.sm },
  bold: { fontWeight: "700" },
  filters: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
});
