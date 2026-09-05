import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import TeamLogo from "../components/TeamLogo";
import { leaguePosition } from "../engine/standings";
import { colors, spacing, radii } from "../theme";

export default function Dashboard({ quadrants, onNavigate }) {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const nextRound = state.schedule[state.round];
  const myNextGame = nextRound?.find(([h, a]) => h === team.id || a === team.id);
  const totalRounds = state.schedule.length;

  const position = leaguePosition(team, state.teams);

  const lastResult = state.lastRoundResults.find(
    (r) => r.homeId === team.id || r.awayId === team.id
  );

  return (
    <View>
      <Card>
        <Text style={styles.dim}>
          JORNADA {state.round} / {totalRounds} · POSICIÓN #{position} DE {state.teams.length}
        </Text>
        <Text style={styles.p}>
          Récord: <Text style={styles.bold}>{team.record.wins}V - {team.record.losses}D</Text> · Presupuesto:{" "}
          <Text style={[styles.bold, { color: colors.accent }]}>${team.budget.toLocaleString()}</Text>
        </Text>

        {myNextGame ? (
          <View style={[styles.nextGameRow, { marginBottom: spacing.sm }]}>
            <Text style={styles.small}>Próximo partido:</Text>
            <TeamLogo team={state.teams.find((t) => t.id === myNextGame[0])} size={18} />
            <Text style={[styles.small, styles.bold]} numberOfLines={1}>
              {state.teams.find((t) => t.id === myNextGame[0]).name} vs{" "}
              {state.teams.find((t) => t.id === myNextGame[1]).name}
            </Text>
            <TeamLogo team={state.teams.find((t) => t.id === myNextGame[1])} size={18} />
          </View>
        ) : (
          <Text style={[styles.small, styles.dim, { marginBottom: spacing.sm }]}>Temporada finalizada.</Text>
        )}
      </Card>

      {state.pendingContracts.length > 0 && (
        <Pressable onPress={() => onNavigate("contracts")}>
          <Card style={styles.warningCard}>
            <Text style={styles.warningText}>
              ⚠ {state.pendingContracts.length} renovación(es) de contrato pendiente(s) — toca para
              resolverlas
            </Text>
          </Card>
        </Pressable>
      )}

      <Pressable disabled={!lastResult} onPress={() => onNavigate("result")}>
        <Card style={!lastResult && { opacity: 0.6 }}>
          <Text style={styles.h3}>ÚLTIMO RESULTADO</Text>
          {lastResult ? (
            <MatchSummary result={lastResult} teams={state.teams} />
          ) : (
            <Text style={styles.dim}>Aún no hay partidos jugados.</Text>
          )}
        </Card>
      </Pressable>

      <View style={styles.grid}>
        {quadrants.map((q) => (
          <View key={q.header} style={styles.quadrant}>
            <Text style={styles.quadrantHeader}>{q.header.toUpperCase()}</Text>
            {q.items.map((item) => (
              <Button key={item.id} onPress={() => onNavigate(item.id)} style={styles.quadrantBtn}>
                {item.label}
              </Button>
            ))}
          </View>
        ))}
      </View>

      <Button
        primary
        disabled={state.round >= totalRounds}
        onPress={() => {
          dispatch({ type: "SIM_ROUND" });
          onNavigate("result");
        }}
        style={styles.playBtn}
      >
        Jugar jornada
      </Button>

      <Card>
        <Text style={styles.h3}>NOTICIAS</Text>
        <View>
          {state.log.length === 0 && <Text style={styles.logItem}>Sin novedades.</Text>}
          {state.log.map((l, i) => (
            <Text key={i} style={styles.logItem}>{l}</Text>
          ))}
        </View>
      </Card>
    </View>
  );
}

function MatchSummary({ result, teams }) {
  const home = teams.find((t) => t.id === result.homeId);
  const away = teams.find((t) => t.id === result.awayId);
  const topHome = [...result.boxscore.home].sort((a, b) => b.points - a.points)[0];
  const topAway = [...result.boxscore.away].sort((a, b) => b.points - a.points)[0];
  return (
    <View>
      <View style={styles.nextGameRow}>
        <TeamLogo team={home} size={18} />
        <Text style={styles.matchScore} numberOfLines={1}>
          {home.name} {result.homeScore} - {result.awayScore} {away.name}
        </Text>
        <TeamLogo team={away} size={18} />
      </View>
      <Text style={[styles.small, styles.dim]}>
        Top local: {topHome?.name} ({topHome?.points} pts) · Top visitante: {topAway?.name} ({topAway?.points} pts)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h3: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 6, letterSpacing: 0.6 },
  p: { color: colors.text, fontSize: 14, marginVertical: 2 },
  small: { fontSize: 13, color: colors.text, marginVertical: 2 },
  dim: { color: colors.textDim, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  bold: { fontWeight: "700" },
  matchScore: { fontSize: 16, fontWeight: "700", color: colors.text, flexShrink: 1 },
  nextGameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  logItem: {
    fontSize: 12,
    color: colors.textDim,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quadrant: {
    flexBasis: "48%",
    flexGrow: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  quadrantHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.8,
    marginBottom: 4,
    textAlign: "center",
  },
  quadrantBtn: { marginBottom: 0 },
  warningCard: { borderColor: colors.accent, backgroundColor: colors.panelAlt },
  warningText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  playBtn: { marginTop: spacing.sm, marginBottom: spacing.md, paddingVertical: spacing.md },
});
