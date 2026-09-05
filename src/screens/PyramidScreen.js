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
  const viewingOwn = tab === state.activeDivisionId;

  const standings = sortStandings(division.teams);
  const rows = standings.map((t, i) => ({
    ...t,
    pos: i + 1,
    pj: t.record.wins + t.record.losses,
    diff: t.record.pointsFor - t.record.pointsAgainst,
  }));

  // Matches resolvePyramid: 1st promotes directly, 2nd-5th contest the
  // second promotion spot in a playoff, and the bottom 2 relegate directly.
  const divisionIndex = DIVISION_ORDER.indexOf(tab);
  const canPromote = divisionIndex > 0;
  const canRelegate = divisionIndex < DIVISION_ORDER.length - 1;

  const rowStyle = (t) => {
    const s = [];
    if (canPromote && t.pos === 1) s.push(styles.promotionRow);
    else if (canPromote && t.pos >= 2 && t.pos <= 5) s.push(styles.playoffRow);
    if (canRelegate && t.pos > rows.length - 2) s.push(styles.relegationRow);
    if (t.id === state.userTeamId) s.push(styles.meRow);
    return s;
  };

  return (
    <View>
      <Card>
        <Text style={styles.h2}>OTRAS LIGAS</Text>
        <Text style={styles.dim}>
          Tu equipo juega en {DIVISION_META[state.activeDivisionId].name}. Al final de cada
          temporada suben 2 equipos por categoría (1º directo + 1 por playoff entre el 2º-5º) y
          bajan los 2 últimos de la de arriba.
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
        {viewingOwn && (
          <Text style={styles.dim}>
            Jornada {state.round} de {state.schedule.length}
          </Text>
        )}
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
            { key: "pointsFor", label: "PF", width: 60, render: (t) => <Text style={styles.cellText}>{t.record.pointsFor}</Text> },
            { key: "pointsAgainst", label: "PC", width: 60, render: (t) => <Text style={styles.cellText}>{t.record.pointsAgainst}</Text> },
            {
              key: "diff",
              label: "Dif",
              width: 60,
              render: (t) => <Text style={styles.cellText}>{t.diff > 0 ? `+${t.diff}` : t.diff}</Text>,
            },
          ]}
          data={rows}
          rowKey={(t) => t.id}
          rowStyle={rowStyle}
        />
        <View style={styles.legendRow}>
          {canPromote && (
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.win }]} />
              <Text style={styles.legendText}>Asciende directo</Text>
            </View>
          )}
          {canPromote && (
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: "rgba(62, 207, 126, 0.45)" }]} />
              <Text style={styles.legendText}>Playoff ascenso</Text>
            </View>
          )}
          {canRelegate && (
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.loss }]} />
              <Text style={styles.legendText}>Desciende directo</Text>
            </View>
          )}
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>Tu equipo</Text>
          </View>
        </View>
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
  promotionRow: { borderLeftWidth: 4, borderLeftColor: colors.win },
  playoffRow: { borderLeftWidth: 4, borderLeftColor: "rgba(62, 207, 126, 0.45)" },
  relegationRow: { borderLeftWidth: 4, borderLeftColor: colors.loss },
  legendRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
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
