import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import {
  playerWageTotal,
  staffWageTotal,
  stadiumMaintenance,
  sponsorIncome,
  estimatedTicketIncomePerRound,
  amortizedSeasonTicketIncomePerRound,
  tvRightsIncome,
  maxLoanAmount,
  previewLoanTerms,
  LOAN_TERM_WEEKS,
} from "../engine/finance";
import { colors, spacing, radii } from "../theme";
import SectionHeader from "../components/SectionHeader";

// Rounds happen weekly (see currentDate/ADVANCE_PRESEASON in GameContext),
// so a ~30-day month is roughly this many rounds — used only to convert the
// underlying per-round figures for display, the economy itself still ticks
// per round in SIM_ROUND.
const ROUNDS_PER_MONTH = 30 / 7;

export default function FinanceScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const history = team.financeHistory || [];
  const [browseIndex, setBrowseIndex] = useState(null);
  const shownIndex = browseIndex === null ? history.length - 1 : browseIndex;
  const shownEntry = history[shownIndex];

  const seasons = [];
  for (const entry of history) {
    let season = seasons.find((s) => s.seasonYear === entry.seasonYear);
    if (!season) {
      season = { seasonYear: entry.seasonYear, income: 0, expenses: 0, net: 0, rounds: 0 };
      seasons.push(season);
    }
    season.income += entry.income;
    season.expenses += entry.expenses;
    season.net += entry.net;
    season.rounds += 1;
  }
  seasons.reverse();

  const wages = Math.round(playerWageTotal(team, state.playersById) * ROUNDS_PER_MONTH);
  const staffWages = Math.round(staffWageTotal(team.staff) * ROUNDS_PER_MONTH);
  const maintenance = Math.round(stadiumMaintenance(team.stadium, team.staff) * ROUNDS_PER_MONTH);
  const jerseySponsor = Math.round(sponsorIncome(team.sponsors?.jersey) * ROUNDS_PER_MONTH);
  const stadiumSponsor = Math.round(sponsorIncome(team.sponsors?.stadium) * ROUNDS_PER_MONTH);
  const tv = Math.round(tvRightsIncome(state.activeDivisionId, team, state.teams) * ROUNDS_PER_MONTH);
  const avgTicket = Math.round(estimatedTicketIncomePerRound(team.stadium) * ROUNDS_PER_MONTH);
  const seasonTickets = Math.round(
    amortizedSeasonTicketIncomePerRound(team.stadium, state.schedule.length) * ROUNDS_PER_MONTH
  );

  const expenses = wages + staffWages + maintenance;
  const avgIncome = jerseySponsor + stadiumSponsor + tv + avgTicket + seasonTickets;
  const avgNet = avgIncome - expenses;

  const monthsOfRunway = avgNet >= 0 ? Infinity : team.budget / Math.abs(avgNet);
  const verdict =
    avgNet >= 0
      ? { label: "SOSTENIBLE", color: colors.win, desc: "Tus ingresos medios cubren los gastos fijos." }
      : monthsOfRunway >= 3
      ? { label: "AJUSTADO", color: colors.accent, desc: "Pierdes dinero de media, pero el presupuesto aguanta varios meses." }
      : { label: "EN NÚMEROS ROJOS", color: colors.loss, desc: `Al ritmo actual, el presupuesto se agota en unos ${Math.max(1, Math.round(monthsOfRunway))} mes(es).` };

  return (
    <View>
      <Card style={{ borderColor: verdict.color }}>
        <SectionHeader>SALUD ECONÓMICA</SectionHeader>
        <Text style={[styles.verdict, { color: verdict.color }]}>{verdict.label}</Text>
        <Text style={styles.dim}>{verdict.desc}</Text>
      </Card>

      <Card>
        <SectionHeader>INGRESOS MEDIOS POR MES</SectionHeader>
        <Row label="Patrocinador de camiseta" value={jerseySponsor} positive />
        <Row label="Patrocinador de estadio" value={stadiumSponsor} positive />
        <Row label="Derechos de TV" value={tv} positive />
        <Row label="Abonos (prorrateados)" value={seasonTickets} positive />
        <Row label="Taquilla (estimada)" value={avgTicket} positive />
        <View style={styles.divider} />
        <Row label="Total ingresos" value={avgIncome} bold positive />
        <Text style={styles.small}>
          Último partido en casa: {team.lastTicketRevenue ? `+€${team.lastTicketRevenue.toLocaleString()}` : "aún no jugado / fue fuera"}
        </Text>
      </Card>

      <Card>
        <SectionHeader>GASTOS FIJOS POR MES</SectionHeader>
        <Row label="Sueldos de jugadores" value={-wages} />
        <Row label="Sueldos de personal" value={-staffWages} />
        <Row label="Mantenimiento de estadio" value={-maintenance} />
        <View style={styles.divider} />
        <Row label="Total gastos" value={-expenses} bold />
      </Card>

      <Card>
        <SectionHeader>BALANCE MEDIO POR MES</SectionHeader>
        <Text style={[styles.netValue, { color: avgNet >= 0 ? colors.win : colors.loss }]}>
          {avgNet >= 0 ? "+" : ""}
          €{Math.round(avgNet).toLocaleString()}
        </Text>
        <Text style={styles.dim}>Presupuesto actual: €{team.budget.toLocaleString()}</Text>
      </Card>

      <LoanCard team={team} playersById={state.playersById} dispatch={dispatch} />

      <Card>
        <SectionHeader>HISTORIAL POR JORNADA</SectionHeader>
        {!shownEntry ? (
          <Text style={styles.dim}>Aún no hay jornadas jugadas.</Text>
        ) : (
          <>
            <View style={styles.browseRow}>
              <Pressable
                style={styles.browseBtn}
                disabled={shownIndex <= 0}
                onPress={() => setBrowseIndex(shownIndex - 1)}
              >
                <Text style={[styles.browseBtnText, shownIndex <= 0 && styles.browseBtnDisabled]}>‹</Text>
              </Pressable>
              <Text style={styles.browseLabel}>
                Jornada {shownEntry.round + 1} · {shownEntry.seasonYear}/{shownEntry.seasonYear + 1}
              </Text>
              <Pressable
                style={styles.browseBtn}
                disabled={shownIndex >= history.length - 1}
                onPress={() => setBrowseIndex(shownIndex + 1)}
              >
                <Text style={[styles.browseBtnText, shownIndex >= history.length - 1 && styles.browseBtnDisabled]}>
                  ›
                </Text>
              </Pressable>
            </View>
            <Row label="Ingresos" value={shownEntry.income} positive />
            <Row label="Gastos" value={-shownEntry.expenses} />
            <View style={styles.divider} />
            <Row label="Balance" value={shownEntry.net} bold />
            <Text style={styles.small}>Presupuesto tras esa jornada: €{shownEntry.budget.toLocaleString()}</Text>
          </>
        )}
      </Card>

      <Card>
        <SectionHeader>POR TEMPORADA</SectionHeader>
        {seasons.length === 0 ? (
          <Text style={styles.dim}>Aún no hay temporadas completas registradas.</Text>
        ) : (
          seasons.map((s) => (
            <View key={s.seasonYear} style={styles.seasonBlock}>
              <Text style={styles.seasonLabel}>
                {s.seasonYear}/{s.seasonYear + 1} ({s.rounds} jornada(s))
              </Text>
              <Row label="Ingresos" value={s.income} positive />
              <Row label="Gastos" value={-s.expenses} />
              <Row label="Balance" value={s.net} bold />
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

function LoanCard({ team, playersById, dispatch }) {
  const loan = team.loan;
  if (loan) {
    return (
      <Card>
        <SectionHeader>CRÉDITO</SectionHeader>
        <Row label="Pendiente de devolver" value={-loan.remaining} />
        <Row label="Cuota semanal" value={-loan.weeklyPayment} />
        <Text style={styles.dim}>Quedan {loan.weeksLeft} semanas de pago.</Text>
      </Card>
    );
  }

  const cap = maxLoanAmount(team, playersById);
  const { remaining, weeklyPayment } = previewLoanTerms(cap);
  return (
    <Card>
      <SectionHeader>CRÉDITO</SectionHeader>
      <Text style={styles.dim}>
        Puedes pedir hasta €{cap.toLocaleString()}, a devolver €{remaining.toLocaleString()} en{" "}
        {LOAN_TERM_WEEKS} semanas (€{weeklyPayment.toLocaleString()}/semana). El importe queda
        descontado semana a semana aunque el presupuesto entre en números rojos.
      </Text>
      <Button
        primary
        onPress={() => dispatch({ type: "REQUEST_LOAN", teamId: team.id, amount: cap })}
        style={{ marginTop: spacing.sm }}
      >
        Pedir crédito de €{cap.toLocaleString()}
      </Button>
    </Card>
  );
}

function Row({ label, value, positive, bold }) {
  const color = value === 0 ? colors.textDim : value > 0 || positive ? colors.win : colors.loss;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, { color }, bold && styles.bold]}>
        {value > 0 ? "+" : ""}
        €{value.toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 6, letterSpacing: 0.6 },
  h3: { fontSize: 12, fontWeight: "800", color: colors.text, marginBottom: 8, letterSpacing: 0.6 },
  dim: { color: colors.textDim, fontSize: 12 },
  small: { color: colors.textDim, fontSize: 11, marginTop: spacing.xs },
  bold: { fontWeight: "800" },
  verdict: { fontSize: 20, fontWeight: "800", marginBottom: 4, letterSpacing: 0.5 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  rowLabel: { color: colors.text, fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  netValue: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  browseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  browseBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  browseBtnText: { color: colors.accent, fontSize: 18, fontWeight: "800" },
  browseBtnDisabled: { color: colors.textDim },
  browseLabel: { color: colors.text, fontWeight: "700", fontSize: 13 },
  seasonBlock: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  seasonLabel: { color: colors.accent, fontWeight: "800", fontSize: 12, marginBottom: 4 },
});
