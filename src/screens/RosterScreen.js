import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import Pill from "../components/Pill";
import Table from "../components/Table";
import Select from "../components/Select";
import { colors } from "../theme";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

export default function RosterScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const roster = team.roster.map((id) => state.playersById[id]).sort((a, b) => b.overall - a.overall);

  const lineupRows = POSITIONS.map((pos) => {
    const starterId = team.lineup[pos];
    const starter = starterId ? state.playersById[starterId] : null;
    const eligible = roster.filter((p) => p.id !== starterId && !p.injured);
    const options = [
      { label: "-- vacío --", value: "" },
      ...(starter ? [{ label: `${starter.name} (actual)`, value: starter.id }] : []),
      ...eligible.map((p) => ({ label: `${p.name} (${p.position}, ${p.overall})`, value: p.id })),
    ];
    return { pos, starter, starterId, options };
  });

  return (
    <View>
      <Card>
        <Text style={styles.h2}>Alineación titular</Text>
        {lineupRows.map((row) => (
          <View key={row.pos} style={styles.lineupRow}>
            <View style={styles.lineupPos}>
              <Pill>{row.pos}</Pill>
            </View>
            <View style={styles.lineupInfo}>
              <Text style={styles.cellText}>
                {row.starter ? row.starter.name : <Text style={styles.dim}>vacío</Text>}
              </Text>
              {row.starter && <OvrBadge value={row.starter.overall} />}
            </View>
            <Select
              value={row.starterId || ""}
              options={row.options}
              onChange={(playerId) =>
                dispatch({
                  type: "SET_LINEUP",
                  teamId: team.id,
                  position: row.pos,
                  playerId: playerId || null,
                })
              }
            />
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.h2}>Plantilla completa ({roster.length}/15)</Text>
        <Table
          columns={[
            {
              key: "name",
              label: "Nombre",
              width: 150,
              render: (p) => {
                const isStarter = Object.values(team.lineup).includes(p.id);
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.cellText}>{p.name}</Text>
                    {isStarter && <Pill>Titular</Pill>}
                  </View>
                );
              },
            },
            { key: "position", label: "Pos", width: 50 },
            { key: "age", label: "Edad", width: 50 },
            { key: "nationality", label: "Nac.", width: 70 },
            { key: "overall", label: "OVR", width: 60, render: (p) => <OvrBadge value={p.overall} /> },
            { key: "shooting", label: "Tiro", width: 60, render: (p) => <Text style={styles.cellText}>{p.ratings.shooting}</Text> },
            { key: "defense", label: "Def", width: 60, render: (p) => <Text style={styles.cellText}>{p.ratings.defense}</Text> },
            { key: "passing", label: "Pase", width: 60, render: (p) => <Text style={styles.cellText}>{p.ratings.passing}</Text> },
            { key: "rebounding", label: "Reb", width: 60, render: (p) => <Text style={styles.cellText}>{p.ratings.rebounding}</Text> },
            { key: "physical", label: "Físico", width: 60, render: (p) => <Text style={styles.cellText}>{p.ratings.physical}</Text> },
            {
              key: "status",
              label: "Estado",
              width: 90,
              render: (p) => (
                <Text style={[styles.cellText, p.injured && { color: colors.loss }]}>
                  {p.injured ? "Lesionado" : "OK"}
                </Text>
              ),
            },
            { key: "value", label: "Valor", width: 90, render: (p) => <Text style={styles.cellText}>${p.value.toLocaleString()}</Text> },
          ]}
          data={roster}
          rowKey={(p) => p.id}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 8 },
  lineupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineupPos: { width: 40 },
  lineupInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  cellText: { color: colors.text, fontSize: 13 },
  dim: { color: colors.textDim },
});
