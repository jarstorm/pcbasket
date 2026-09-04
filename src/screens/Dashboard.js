import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import { colors, spacing } from "../theme";

export default function Dashboard() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const nextRound = state.schedule[state.round];
  const myNextGame = nextRound?.find(([h, a]) => h === team.id || a === team.id);
  const totalRounds = state.schedule.length;

  const standings = [...state.teams].sort((a, b) => {
    if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
    const diffA = a.record.pointsFor - a.record.pointsAgainst;
    const diffB = b.record.pointsFor - b.record.pointsAgainst;
    return diffB - diffA;
  });
  const position = standings.findIndex((t) => t.id === team.id) + 1;

  const lastResult = state.lastRoundResults.find(
    (r) => r.homeId === team.id || r.awayId === team.id
  );

  return (
    <View>
      <Card>
        <Text style={styles.h2}>{team.name}</Text>
        <Text style={styles.dim}>
          Jornada {state.round} / {totalRounds} · Posición #{position} de {state.teams.length}
        </Text>
        <Text style={styles.p}>
          Récord: <Text style={styles.bold}>{team.record.wins}V - {team.record.losses}D</Text> · Presupuesto:{" "}
          <Text style={[styles.bold, { color: colors.accent }]}>${team.budget.toLocaleString()}</Text>
        </Text>
        <Text style={styles.small}>
          Estadio: {team.stadium.name} (nivel {team.stadium.level}, {team.stadium.capacity.toLocaleString()} asientos)
        </Text>

        {myNextGame ? (
          <Text style={[styles.small, { marginBottom: spacing.sm }]}>
            Próximo partido:{" "}
            <Text style={styles.bold}>
              {state.teams.find((t) => t.id === myNextGame[0]).name} vs{" "}
              {state.teams.find((t) => t.id === myNextGame[1]).name}
            </Text>
          </Text>
        ) : (
          <Text style={[styles.small, styles.dim, { marginBottom: spacing.sm }]}>Temporada finalizada.</Text>
        )}

        <Button primary disabled={state.round >= totalRounds} onPress={() => dispatch({ type: "SIM_ROUND" })}>
          Simular jornada
        </Button>
      </Card>

      <Card>
        <Text style={styles.h3}>Último resultado</Text>
        {lastResult ? (
          <MatchSummary result={lastResult} teams={state.teams} />
        ) : (
          <Text style={styles.dim}>Aún no hay partidos jugados.</Text>
        )}
        <Text style={[styles.h3, { marginTop: spacing.md }]}>Noticias</Text>
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
      <Text style={styles.matchScore}>
        {home.name} {result.homeScore} - {result.awayScore} {away.name}
      </Text>
      <Text style={[styles.small, styles.dim]}>
        Top local: {topHome?.name} ({topHome?.points} pts) · Top visitante: {topAway?.name} ({topAway?.points} pts)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 },
  h3: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 4 },
  p: { color: colors.text, fontSize: 14, marginVertical: 2 },
  small: { fontSize: 13, color: colors.text, marginVertical: 2 },
  dim: { color: colors.textDim },
  bold: { fontWeight: "700" },
  matchScore: { fontSize: 16, fontWeight: "700", color: colors.text },
  logItem: {
    fontSize: 12,
    color: colors.textDim,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
