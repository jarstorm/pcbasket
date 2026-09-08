import { useState } from "react";
import { View, Text, Pressable, Alert, Modal, ScrollView, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import TeamLogo from "../components/TeamLogo";
import Icon from "../components/Icon";
import { leaguePosition } from "../engine/standings";
import { colors, spacing, radii } from "../theme";
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

const DAY_ABBR = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
function dayAbbr(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_ABBR[new Date(y, m - 1, d).getDay()];
}

function formatCompact(n) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}K`;
  return `${sign}${abs}`;
}

function StatTile({ icon, value, caption, valueColor }) {
  return (
    <View style={styles.statTile}>
      <Icon name={icon} size={15} color={colors.accent} />
      <Text style={[styles.statValue, valueColor && { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

export default function Dashboard({ onNavigate }) {
  const { state, dispatch } = useGame();
  const [showAllNews, setShowAllNews] = useState(false);
  const [advancingPreseason, setAdvancingPreseason] = useState(false);
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
        `Tu presupuesto está en negativo (${team.budget.toLocaleString()}€). Los sueldos y gastos de esta jornada lo empeorarán.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Jugar de todas formas", onPress: play },
        ]
      );
      return;
    }
    play();
  };

  const handleAdvancePreseason = () => {
    setAdvancingPreseason(true);
    // A deliberate delay so the loading spinner is actually visible — the
    // dispatch itself is instant, and without this the button just flickers.
    setTimeout(() => {
      dispatch({ type: "ADVANCE_PRESEASON" });
      setAdvancingPreseason(false);
    }, 500);
  };

  return (
    <View>
      {isPreseason ? (
        <Button
          primary
          loading={advancingPreseason}
          onPress={handleAdvancePreseason}
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
        <Text style={styles.dim}>{formatFictionalDate(state.currentDate)}</Text>

        {isPreseason ? (
          <>
            <Text style={styles.p}>
              Récord: <Text style={styles.bold}>{team.record.wins}V - {team.record.losses}D</Text> · Presupuesto:{" "}
              <Text style={[styles.bold, { color: inRedNumbers ? colors.loss : colors.accent }]}>
                €{team.budget.toLocaleString()}
              </Text>
            </Text>
            <Text style={[styles.small, styles.dim, { marginBottom: spacing.sm }]}>
              Pretemporada — faltan {state.preseasonWeeksLeft} semana(s) para el inicio de la liga.
              Aprovecha para fichar, contratar personal y mejorar el estadio.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.dim, { marginBottom: spacing.sm }]}>
              JORNADA {state.round} / {totalRounds}
            </Text>
            <View style={styles.statRow}>
              <StatTile icon="emoji-events" value={`${position}º`} caption={`DE ${state.teams.length}`} />
              <StatTile
                icon="event-note"
                value={`${team.record.wins}-${team.record.losses}`}
                caption="V - D"
              />
              <StatTile
                icon="account-balance-wallet"
                value={formatCompact(team.budget)}
                caption="SALDO"
                valueColor={inRedNumbers ? colors.loss : colors.accent}
              />
            </View>
            {myNextGame ? (
              (() => {
                const homeTeamObj = state.teams.find((t) => t.id === myNextGame[0]);
                const awayTeamObj = state.teams.find((t) => t.id === myNextGame[1]);
                const isHome = myNextGame[0] === team.id;
                return (
                  <View style={styles.matchCard}>
                    <View style={styles.matchHeaderBar}>
                      <Text style={styles.matchHeaderText}>PRÓXIMO PARTIDO</Text>
                      <Text style={styles.matchHeaderMeta}>
                        {dayAbbr(state.currentDate)} · {isHome ? "CASA" : "FUERA"}
                      </Text>
                    </View>
                    <View style={styles.matchTeamsRow}>
                      <View style={styles.matchTeamCol}>
                        <TeamLogo team={homeTeamObj} size={44} />
                        <Text style={styles.matchTeamName} numberOfLines={2}>{homeTeamObj.name}</Text>
                      </View>
                      <Text style={styles.matchVs}>VS</Text>
                      <View style={styles.matchTeamCol}>
                        <TeamLogo team={awayTeamObj} size={44} />
                        <Text style={styles.matchTeamName} numberOfLines={2}>{awayTeamObj.name}</Text>
                      </View>
                    </View>
                  </View>
                );
              })()
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

      {(state.pendingOffers || []).length > 0 && (
        <Pressable onPress={() => onNavigate("market")}>
          <Card style={styles.warningCard}>
            <View style={styles.alertRow}>
              <Icon name="attach-money" size={18} color={colors.accent} />
              <Text style={styles.warningText}>
                {state.pendingOffers.length} oferta(s) de fichaje pendiente(s) — toca para resolverlas
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
                Presupuesto en números rojos (${team.budget.toLocaleString()}){" "}
                {team.redStreak > 0
                  ? `— ${team.redStreak} jornada(s) seguida(s). A la 4ª la liga te obligará a vender un jugador.`
                  : "— toca para revisar finanzas"}
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
              <MatchSummary result={lastResult} teams={state.teams} userTeamId={team.id} />
            ) : (
              <Text style={styles.dim}>Aún no hay partidos jugados.</Text>
            )}
          </Card>
        </Pressable>
      )}

      <Card>
        <SectionHeader
          right={
            state.log.length > 5 && (
              <Pressable onPress={() => setShowAllNews(true)}>
                <Text style={styles.newsLink}>Ver todas ({state.log.length})</Text>
              </Pressable>
            )
          }
        >
          NOTICIAS
        </SectionHeader>
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
            <SectionHeader
              style={{ flex: 1, marginBottom: 0 }}
              right={
                <Pressable onPress={() => setShowAllNews(false)}>
                  <Text style={styles.newsLink}>Cerrar</Text>
                </Pressable>
              }
            >
              TODAS LAS NOTICIAS
            </SectionHeader>
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

function MatchSummary({ result, teams, userTeamId }) {
  const home = teams.find((t) => t.id === result.homeId);
  const away = teams.find((t) => t.id === result.awayId);
  const topHome = [...result.boxscore.home].sort((a, b) => b.points - a.points)[0];
  const topAway = [...result.boxscore.away].sort((a, b) => b.points - a.points)[0];
  const userWon =
    (result.homeId === userTeamId && result.homeScore > result.awayScore) ||
    (result.awayId === userTeamId && result.awayScore > result.homeScore);
  const resultColor = userWon ? colors.win : colors.loss;
  return (
    <View style={[styles.lastResultCard, { borderColor: resultColor }]}>
      <View style={styles.matchTeamsRow}>
        <View style={styles.matchTeamCol}>
          <TeamLogo team={home} size={36} />
          <Text style={styles.matchTeamName} numberOfLines={2}>{home.name}</Text>
          <Text style={styles.matchTopScorer} numberOfLines={2}>{topHome?.name} · {topHome?.points} pts</Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={[styles.lastResultScore, { color: resultColor }]}>
            {result.homeScore} - {result.awayScore}
          </Text>
          <Text style={[styles.lastResultBadge, { color: resultColor }]}>
            {userWon ? "VICTORIA" : "DERROTA"}
          </Text>
        </View>
        <View style={styles.matchTeamCol}>
          <TeamLogo team={away} size={36} />
          <Text style={styles.matchTeamName} numberOfLines={2}>{away.name}</Text>
          <Text style={styles.matchTopScorer} numberOfLines={2}>{topAway?.name} · {topAway?.points} pts</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h3: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 6, letterSpacing: 0.6 },
  statRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  statTile: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlt,
    paddingVertical: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "800" },
  statCaption: { color: colors.textDim, fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
  matchCard: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.sm,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  matchHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  matchHeaderText: { color: colors.accentText, fontWeight: "800", fontSize: 11, letterSpacing: 0.8 },
  matchHeaderMeta: { color: colors.accentText, fontWeight: "700", fontSize: 11 },
  matchTeamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  matchTeamCol: { alignItems: "center", gap: 6, flex: 1 },
  matchTeamName: { color: colors.text, fontSize: 12, fontWeight: "700", textAlign: "center" },
  matchVs: { color: colors.textDim, fontSize: 14, fontWeight: "800", marginHorizontal: spacing.sm },
  p: { color: colors.text, fontSize: 14, marginVertical: 2 },
  small: { fontSize: 13, color: colors.text, marginVertical: 2 },
  dim: { color: colors.textDim, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  bold: { fontWeight: "700" },
  lastResultCard: {
    borderWidth: 2,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  scoreCol: { alignItems: "center", gap: 2, paddingHorizontal: spacing.sm },
  lastResultScore: { fontSize: 22, fontWeight: "800" },
  lastResultBadge: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  matchTopScorer: { color: colors.textDim, fontSize: 10, fontWeight: "600", textAlign: "center", marginTop: 2 },
  logItem: {
    fontSize: 12,
    color: colors.textDim,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logDate: { color: colors.accent, fontWeight: "700" },
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
