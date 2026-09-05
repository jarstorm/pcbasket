import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Table from "../components/Table";
import Button from "../components/Button";
import { colors, spacing, radii } from "../theme";

function buildRows(team, boxscoreArr, playersById) {
  const statsById = Object.fromEntries(boxscoreArr.map((p) => [p.id, p]));
  return team.roster
    .map((id) => {
      const player = playersById[id];
      const s = statsById[id];
      return {
        id,
        name: player?.name || "?",
        made2: s?.made2 ?? 0,
        att2: s?.att2 ?? 0,
        made3: s?.made3 ?? 0,
        att3: s?.att3 ?? 0,
        madeFt: s?.madeFt ?? 0,
        attFt: s?.attFt ?? 0,
        rebounds: s?.rebounds ?? 0,
        assists: s?.assists ?? 0,
        blocks: s?.blocks ?? 0,
        fouls: s?.fouls ?? 0,
        points: s?.points ?? 0,
        minutes: s?.minutes ?? 0,
        played: !!s,
      };
    })
    .sort((a, b) => Number(b.played) - Number(a.played) || b.points - a.points);
}

const COLUMNS = [
  {
    key: "name",
    label: "Jugador",
    width: 130,
    render: (p) => (
      <View style={styles.nameCell}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.cellText, !p.played && styles.dimText]} numberOfLines={1}>
          {p.name}
        </Text>
      </View>
    ),
  },
  { key: "t2", label: "T2", width: 55, render: (p) => <Text style={styles.cellText}>{p.made2}/{p.att2}</Text> },
  { key: "t3", label: "T3", width: 55, render: (p) => <Text style={styles.cellText}>{p.made3}/{p.att3}</Text> },
  { key: "tl", label: "TL", width: 55, render: (p) => <Text style={styles.cellText}>{p.madeFt}/{p.attFt}</Text> },
  { key: "reb", label: "REB", width: 45, render: (p) => <Text style={styles.cellText}>{p.rebounds}</Text> },
  { key: "ast", label: "AST", width: 45, render: (p) => <Text style={styles.cellText}>{p.assists}</Text> },
  { key: "tap", label: "TAP", width: 45, render: (p) => <Text style={styles.cellText}>{p.blocks}</Text> },
  { key: "per", label: "PER", width: 45, render: (p) => <Text style={styles.cellText}>{p.fouls}</Text> },
  { key: "pts", label: "PTS", width: 50, render: (p) => <Text style={[styles.cellText, styles.bold]}>{p.points}</Text> },
  { key: "min", label: "MIN", width: 45, render: (p) => <Text style={styles.cellText}>{p.minutes}</Text> },
];

function TeamBox({ team, result, side }) {
  const { state } = useGame();
  const rows = buildRows(team, result.boxscore[side], state.playersById);

  return (
    <Card>
      <Text style={styles.teamName}>{team.name.toUpperCase()}</Text>
      <Table columns={COLUMNS} data={rows} rowKey={(r) => r.id} />
    </Card>
  );
}

function topPerformers(team, boxscoreArr) {
  const topScorer = [...boxscoreArr].sort((a, b) => b.points - a.points)[0];
  const topRebounder = [...boxscoreArr].sort((a, b) => b.rebounds - a.rebounds)[0];
  return { topScorer, topRebounder };
}

export default function MatchResult({ onContinue }) {
  const { state } = useGame();
  const [expanded, setExpanded] = useState(false);
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const result = state.lastRoundResults.find(
    (r) => r.homeId === team.id || r.awayId === team.id
  );

  if (!result) {
    return (
      <Card>
        <Text style={styles.dimText}>Aún no hay partidos jugados.</Text>
      </Card>
    );
  }

  const home = state.teams.find((t) => t.id === result.homeId);
  const away = state.teams.find((t) => t.id === result.awayId);
  const homeTop = topPerformers(home, result.boxscore.home);
  const awayTop = topPerformers(away, result.boxscore.away);

  return (
    <View>
      {onContinue && (
        <Button primary onPress={onContinue} style={styles.continueBtn}>
          Continuar
        </Button>
      )}

      <Card>
        <View style={styles.headerBar}>
          <Text style={styles.headerText}>FINAL DE PARTIDO</Text>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreName} numberOfLines={1}>{home.name}</Text>
            <Text style={styles.scoreNumber}>{result.homeScore}</Text>
          </View>
          <Text style={styles.scoreDash}>-</Text>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreName} numberOfLines={1}>{away.name}</Text>
            <Text style={styles.scoreNumber}>{result.awayScore}</Text>
          </View>
        </View>

        <View style={styles.topRow}>
          <Text style={styles.topText} numberOfLines={1}>
            {homeTop.topScorer ? `${homeTop.topScorer.name} ${homeTop.topScorer.points} pts` : "-"}
          </Text>
          <Text style={styles.topText} numberOfLines={1}>
            {awayTop.topScorer ? `${awayTop.topScorer.name} ${awayTop.topScorer.points} pts` : "-"}
          </Text>
        </View>

        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
          <Text style={styles.expandText}>
            {expanded ? "▲ Ocultar estadísticas completas" : "▼ Ver estadísticas completas"}
          </Text>
        </Pressable>
      </Card>

      {expanded && (
        <>
          <TeamBox team={home} result={result} side="home" />
          <TeamBox team={away} result={result} side="away" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  continueBtn: { marginBottom: spacing.md, paddingVertical: spacing.md },
  headerBar: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 6,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  headerText: {
    color: colors.accentText,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  scoreSide: { flex: 1, alignItems: "center" },
  scoreName: { color: colors.text, fontWeight: "700", fontSize: 12, marginBottom: 2, textAlign: "center" },
  scoreNumber: { color: colors.accent, fontWeight: "800", fontSize: 30 },
  scoreDash: { color: colors.textDim, fontSize: 20, fontWeight: "700" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  topText: { flex: 1, color: colors.textDim, fontSize: 11, textAlign: "center" },
  expandBtn: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  expandText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  teamName: { color: colors.text, fontWeight: "800", fontSize: 14, letterSpacing: 0.6, marginBottom: 8 },
  nameCell: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.textDim, fontSize: 10, fontWeight: "700" },
  cellText: { color: colors.text, fontSize: 12 },
  dimText: { color: colors.textDim },
  bold: { fontWeight: "800", color: colors.accent },
});
