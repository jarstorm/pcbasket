import { useState } from "react";
import { View, Text, Pressable, Alert, Modal, ScrollView, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import TeamLogo from "../components/TeamLogo";
import Icon from "../components/Icon";
import { leaguePosition } from "../engine/standings";
import { colors, spacing } from "../theme";
import SectionHeader from "../components/SectionHeader";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFictionalDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export default function Dashboard({ onNavigate }) {
  const { state, dispatch } = useGame();
  const [showAllNews, setShowAllNews] = useState(false);
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const nextRound = state.schedule[state.round];
  const myNextGame = nextRound?.find(([h, a]) => h === team.id || a === team.id);
  const totalRounds = state.schedule.length;
  const isPreseason = (state.preseasonWeeksLeft || 0) > 0;

  const position = leaguePosition(team, state.teams);

  const lastResult = state.lastRoundResults.find(
    (r) => r.homeId === team.id || r.awayId === team.id
  );

  const injuredStarter = Object.values(team.lineup)
    .filter(Boolean)
    .map((id) => state.playersById[id])
    .find((p) => p?.injured);
  const inRedNumbers = team.budget < 0;

  const handlePlayRound = () => {
    if (injuredStarter) {
      Alert.alert(
        "Jugador lesionado en el quinteto",
        `${injuredStarter.name} está lesionado y no puede jugar. Cámbialo en Plantilla antes de jugar la jornada.`
      );
      return;
    }
    const play = () => {
      const isSeasonEnd = state.round >= totalRounds - 1;
      dispatch({ type: "SIM_ROUND" });
      onNavigate(isSeasonEnd ? "seasonSummary" : "result");
    };
    if (inRedNumbers) {
      Alert.alert(
        "Números rojos",
        `Tu presupuesto está en negativo (${team.budget.toLocaleString()}$). Los sueldos y gastos de esta jornada lo empeorarán.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Jugar de todas formas", onPress: play },
        ]
      );
      return;
    }
    play();
  };

  return (
    <View>
      <Card>
        <Text style={styles.dim}>{formatFictionalDate(state.currentDate)}</Text>
        <Text style={styles.p}>
          Récord: <Text style={styles.bold}>{team.record.wins}V - {team.record.losses}D</Text> · Presupuesto:{" "}
          <Text style={[styles.bold, { color: inRedNumbers ? colors.loss : colors.accent }]}>
            ${team.budget.toLocaleString()}
          </Text>
        </Text>

        {isPreseason ? (
          <Text style={[styles.small, styles.dim, { marginBottom: spacing.sm }]}>
            Pretemporada — faltan {state.preseasonWeeksLeft} semana(s) para el inicio de la liga.
            Aprovecha para fichar, contratar personal y mejorar el estadio.
          </Text>
        ) : (
          <>
            <Text style={styles.dim}>
              JORNADA {state.round} / {totalRounds} · POSICIÓN #{position} DE {state.teams.length}
            </Text>
            {myNextGame ? (
              <View style={[styles.nextGameRow, { marginBottom: spacing.sm }]}>
                <Text style={styles.small}>Próximo partido:</Text>
                <TeamLogo team={state.teams.find((t) => t.id === myNextGame[0])} size={28} />
                <Text style={[styles.small, styles.bold]} numberOfLines={1}>
                  {state.teams.find((t) => t.id === myNextGame[0]).name} vs{" "}
                  {state.teams.find((t) => t.id === myNextGame[1]).name}
                </Text>
                <TeamLogo team={state.teams.find((t) => t.id === myNextGame[1])} size={28} />
              </View>
            ) : (
              <Text style={[styles.small, styles.dim, { marginBottom: spacing.sm }]}>Temporada finalizada.</Text>
            )}
          </>
        )}
      </Card>

      {state.pendingContracts.length > 0 && (
        <Pressable onPress={() => onNavigate("contracts")}>
          <Card style={styles.warningCard}>
            <View style={styles.alertRow}>
              <Icon name="gavel" size={18} color={colors.accent} />
              <Text style={styles.warningText}>
                {state.pendingContracts.length} renovación(es) de contrato pendiente(s) — toca para
                resolverlas
              </Text>
              <Icon name="chevron-right" size={16} color={colors.accent} />
            </View>
          </Card>
        </Pressable>
      )}

      {!isPreseason && injuredStarter && (
        <Pressable onPress={() => onNavigate("roster")}>
          <Card style={styles.dangerCard}>
            <View style={styles.alertRow}>
              <Icon name="healing" size={18} color={colors.loss} />
              <Text style={styles.dangerText}>
                {injuredStarter.name} está lesionado en el quinteto inicial — toca para cambiarlo
              </Text>
              <Icon name="chevron-right" size={16} color={colors.loss} />
            </View>
          </Card>
        </Pressable>
      )}

      {inRedNumbers && (
        <Pressable onPress={() => onNavigate("finance")}>
          <Card style={styles.dangerCard}>
            <View style={styles.alertRow}>
              <Icon name="warning" size={18} color={colors.loss} />
              <Text style={styles.dangerText}>
                Presupuesto en números rojos (${team.budget.toLocaleString()}) — toca para revisar finanzas
              </Text>
              <Icon name="chevron-right" size={16} color={colors.loss} />
            </View>
          </Card>
        </Pressable>
      )}

      {!isPreseason && (
        <Pressable disabled={!lastResult} onPress={() => onNavigate("result")}>
          <Card style={!lastResult && { opacity: 0.6 }}>
            <SectionHeader>ÚLTIMO RESULTADO</SectionHeader>
            {lastResult ? (
              <MatchSummary result={lastResult} teams={state.teams} />
            ) : (
              <Text style={styles.dim}>Aún no hay partidos jugados.</Text>
            )}
          </Card>
        </Pressable>
      )}

      {isPreseason ? (
        <Button
          primary
          onPress={() => dispatch({ type: "ADVANCE_PRESEASON" })}
          style={styles.playBtn}
        >
          Avanzar semana
        </Button>
      ) : (
        <Button
          primary
          disabled={state.round >= totalRounds}
          onPress={handlePlayRound}
          style={styles.playBtn}
        >
          Jugar jornada
        </Button>
      )}

      <Card>
        <View style={styles.newsHeader}>
          <SectionHeader>NOTICIAS</SectionHeader>
          {state.log.length > 5 && (
            <Pressable onPress={() => setShowAllNews(true)}>
              <Text style={styles.newsLink}>Ver todas ({state.log.length})</Text>
            </Pressable>
          )}
        </View>
        <View>
          {state.log.length === 0 && <Text style={styles.logItem}>Sin novedades.</Text>}
          {state.log.slice(0, 5).map((entry, i) => (
            <Text key={i} style={styles.logItem}>
              <Text style={styles.logDate}>{formatFictionalDate(entry.date)} · </Text>
              {entry.text}
            </Text>
          ))}
        </View>
      </Card>

      <Modal visible={showAllNews} animationType="slide" onRequestClose={() => setShowAllNews(false)}>
        <View style={styles.modalShell}>
          <View style={styles.modalHeader}>
            <SectionHeader>TODAS LAS NOTICIAS</SectionHeader>
            <Pressable onPress={() => setShowAllNews(false)}>
              <Text style={styles.newsLink}>Cerrar</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {state.log.map((entry, i) => (
              <Text key={i} style={styles.logItem}>
                <Text style={styles.logDate}>{formatFictionalDate(entry.date)} · </Text>
                {entry.text}
              </Text>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  logDate: { color: colors.accent, fontWeight: "700" },
  newsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  newsLink: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  modalShell: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  warningCard: { borderColor: colors.accent, backgroundColor: colors.panelAlt },
  warningText: { flex: 1, color: colors.accent, fontWeight: "700", fontSize: 13 },
  dangerCard: { borderColor: colors.loss, backgroundColor: colors.panelAlt },
  dangerText: { flex: 1, color: colors.loss, fontWeight: "700", fontSize: 13 },
  playBtn: { marginTop: spacing.sm, marginBottom: spacing.md, paddingVertical: spacing.md },
});
