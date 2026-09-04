import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import Table from "../components/Table";
import Select from "../components/Select";
import Button from "../components/Button";
import { colors, spacing } from "../theme";

const POSITION_OPTIONS = [
  { label: "Todas las posiciones", value: "ALL" },
  ...["PG", "SG", "SF", "PF", "C"].map((p) => ({ label: p, value: p })),
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

  const marketPlayers = useMemo(() => {
    return Object.values(state.playersById)
      .filter((p) => p.teamId !== team.id && !p.isProspect)
      .filter((p) => posFilter === "ALL" || p.position === posFilter)
      .sort((a, b) => (sortBy === "overall" ? b.overall - a.overall : a.value - b.value))
      .slice(0, 60);
  }, [state.playersById, team.id, posFilter, sortBy]);

  return (
    <Card>
      <Text style={styles.h2}>Mercado de fichajes</Text>
      <Text style={styles.dim}>
        Presupuesto disponible: <Text style={[styles.bold, { color: colors.accent }]}>${team.budget.toLocaleString()}</Text>{" "}
        · Plantilla: {team.roster.length}/15
      </Text>

      <View style={styles.filters}>
        <Select value={posFilter} options={POSITION_OPTIONS} onChange={setPosFilter} />
        <Select value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} />
      </View>

      <Table
        columns={[
          { key: "name", label: "Nombre", width: 140 },
          { key: "team", label: "Equipo", width: 100, render: (p) => <Text style={styles.cellText}>{teamNameById[p.teamId]}</Text> },
          { key: "position", label: "Pos", width: 50 },
          { key: "age", label: "Edad", width: 50 },
          { key: "overall", label: "OVR", width: 60, render: (p) => <OvrBadge value={p.overall} /> },
          { key: "value", label: "Precio", width: 90, render: (p) => <Text style={styles.cellText}>${p.value.toLocaleString()}</Text> },
          {
            key: "buy",
            label: "",
            width: 90,
            render: (p) => (
              <Button
                primary
                disabled={team.budget < p.value || team.roster.length >= 15}
                onPress={() => dispatch({ type: "BUY_PLAYER", buyerTeamId: team.id, playerId: p.id })}
              >
                Fichar
              </Button>
            ),
          },
        ]}
        data={marketPlayers}
        rowKey={(p) => p.id}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 },
  dim: { color: colors.textDim, fontSize: 13, marginBottom: spacing.sm },
  bold: { fontWeight: "700" },
  cellText: { color: colors.text, fontSize: 13 },
  filters: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
});
