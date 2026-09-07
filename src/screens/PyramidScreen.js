import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Table from "../components/Table";
import TeamLogo from "../components/TeamLogo";
import { sortStandings } from "../engine/standings";
import {
  DIVISION_META,
  DIVISION_ORDER,
  assembleActiveDivision,
  previewPromotionZones,
  previewRelegationZones,
  formatGroupLabel,
} from "../engine/pyramid";
import { colors, spacing, radii } from "../theme";
import SectionHeader from "../components/SectionHeader";

// Plain-language promotion/relegation rule per division, shown above its
// standings table — matches the exact mechanics resolvePyramid runs.
const DIVISION_BLURB = {
  acb: "Bajan los 2 últimos a Primera FEB.",
  primerafeb: "1º asciende directo a ACB. 2º-9º juegan playoff (cuartos, semis y final) por la 2ª plaza. Bajan los 3 últimos a Segunda FEB.",
  segundafeb: "El campeón de cada grupo asciende directo a Primera FEB (2 plazas). La 3ª plaza sale de un playoff entre el 2º-5º de cada grupo. Bajan los 3 últimos de cada grupo a Tercera FEB.",
  tercerafeb: "Los 2 mejores campeones de grupo ascienden directos a Segunda FEB. Los otros 8 campeones juegan un playoff por las 4 plazas restantes. No desciende nadie.",
};

export default function PyramidScreen() {
  const { state } = useGame();

  const divisionsById = {
    ...state.otherDivisions,
    [state.activeDivisionId]: assembleActiveDivision(state),
  };

  const [tab, setTab] = useState(state.activeDivisionId);
  const [groupTab, setGroupTab] = useState(null);
  const selectTab = (id) => {
    setTab(id);
    setGroupTab(null);
  };

  const division = divisionsById[tab] || divisionsById[state.activeDivisionId];
  const viewingOwn = tab === state.activeDivisionId;
  const defaultGroupId = viewingOwn ? state.activeGroupId : division.groups[0].id;
  const group = division.groups.find((g) => g.id === (groupTab ?? defaultGroupId)) || division.groups[0];

  const standings = sortStandings(group.teams);
  const rows = standings.map((t, i) => ({
    ...t,
    pos: i + 1,
    pj: t.record.wins + t.record.losses,
    diff: t.record.pointsFor - t.record.pointsAgainst,
  }));

  const { direct: promoteDirect, pool: promotePool } = previewPromotionZones(division.groups, tab);
  const relegateZone = previewRelegationZones(division.groups, tab);
  const canPromote = promoteDirect.size + promotePool.size > 0;
  const canRelegate = relegateZone.size > 0;

  const rowStyle = (t) => {
    const s = [];
    if (promoteDirect.has(t.id)) s.push(styles.promotionRow);
    else if (promotePool.has(t.id)) s.push(styles.playoffRow);
    if (relegateZone.has(t.id)) s.push(styles.relegationRow);
    if (t.id === state.userTeamId) s.push(styles.meRow);
    return s;
  };

  return (
    <View>
      <Card>
        <SectionHeader>OTRAS LIGAS</SectionHeader>
        <Text style={styles.dim}>
          Tu equipo juega en {DIVISION_META[state.activeDivisionId].name}. {DIVISION_BLURB[state.activeDivisionId]}
        </Text>
        <View style={styles.tabRow}>
          {DIVISION_ORDER.map((id) => (
            <Pressable key={id} onPress={() => selectTab(id)} style={styles.tabBtn}>
              {tab === id && (
                <LinearGradient
                  colors={["#ffb14d", colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
                {DIVISION_META[id].name}
                {id === state.activeDivisionId ? " (tú)" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
        {division.groups.length > 1 && (
          <View style={styles.groupRow}>
            {division.groups.map((g) => (
              <Pressable key={g.id} onPress={() => setGroupTab(g.id)} style={[styles.groupChip, g.id === group.id && styles.groupChipActive]}>
                <Text style={[styles.groupChipText, g.id === group.id && styles.groupChipTextActive]}>
                  {formatGroupLabel(g.id)}
                  {viewingOwn && g.id === state.activeGroupId ? " (tú)" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionHeader>{division.name.toUpperCase()}{division.groups.length > 1 ? ` — ${formatGroupLabel(group.id)}` : ""}</SectionHeader>
        {viewingOwn && group.id === state.activeGroupId && (
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
                  <TeamLogo team={t} size={28} />
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
    overflow: "hidden",
  },
  tabText: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: colors.accentText },
  groupRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  groupChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  groupChipActive: { borderColor: colors.accent, backgroundColor: "rgba(255,149,0,0.14)" },
  groupChipText: { color: colors.textDim, fontSize: 10.5, fontWeight: "700" },
  groupChipTextActive: { color: colors.accent },
});
