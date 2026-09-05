import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Table from "../components/Table";
import TeamLogo from "../components/TeamLogo";
import { sortStandings } from "../engine/standings";
import { DIVISION_META, DIVISION_ORDER } from "../engine/pyramid";
import { colors, spacing, radii } from "../theme";

export default function PyramidScreen() {
  const { state } = useGame();

  const divisionsById = {
    [state.activeDivisionId]: { name: DIVISION_META[state.activeDivisionId].name, teams: state.teams },
    ...state.otherDivisions,
  };

  const [tab, setTab] = useState(state.activeDivisionId);
  const division = divisionsById[tab] || divisionsById[state.activeDivisionId];

  const standings = sortStandings(division.teams);
  const rows = standings.map((t, i) => ({
    ...t,
    pos: i + 1,
    pj: t.record.wins + t.record.losses,
    diff: t.record.pointsFor - t.record.pointsAgainst,
  }));

  return (
    <View>
      <Card>
        <Text style={styles.h2}>PIRÁMIDE DE LIGAS</Text>
        <Text style={styles.dim}>
          Tu equipo juega en {DIVISION_META[state.activeDivisionId].name}. Al final de cada
          temporada sube el primero de cada categoría y baja el último de la de arriba.
        </Text>
        <View style={styles.tabRow}>
          {DIVISION_ORDER.map((id) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
                {DIVISION_META[id].name}
                {id === state.activeDivisionId ? " (tú)" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.h2}>{division.name.toUpperCase()}</Text>
        <Table
          columns={[
            { key: "pos", label: "#", width: 40 },
            {
              key: "name",
              label: "Equipo",
              width: 170,
              render: (t) => (
                <View style={styles.teamCell}>
                  <TeamLogo team={t} size={22} />
                  <Text style={styles.cellText} numberOfLines={1}>{t.name}</Text>
                </View>
              ),
            },
            { key: "pj", label: "PJ", width: 50 },
            { key: "wins", label: "V", width: 40, render: (t) => <Text style={styles.cellText}>{t.record.wins}</Text> },
            { key: "losses", label: "D", width: 40, render: (t) => <Text style={styles.cellText}>{t.record.losses}</Text> },
            {
              key: "diff",
              label: "Dif",
              width: 60,
              render: (t) => <Text style={styles.cellText}>{t.diff > 0 ? `+${t.diff}` : t.diff}</Text>,
            },
          ]}
          data={rows}
          rowKey={(t) => t.id}
          rowStyle={(t) => (t.id === state.userTeamId ? styles.meRow : null)}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 6, letterSpacing: 0.6 },
  dim: { color: colors.textDim, fontSize: 12, marginBottom: spacing.sm },
  cellText: { color: colors.text, fontSize: 13 },
  teamCell: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  meRow: { backgroundColor: "rgba(255, 122, 41, 0.08)" },
  tabRow: { flexDirection: "row", gap: spacing.sm },
  tabBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  tabBtnActive: { borderColor: colors.accent, backgroundColor: colors.panelAlt },
  tabText: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: colors.accent },
});
