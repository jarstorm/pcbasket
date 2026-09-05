import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import {
  playerWageTotal,
  staffWageTotal,
  stadiumMaintenance,
  sponsorIncome,
  estimatedTicketIncomePerRound,
} from "../engine/finance";
import { colors, spacing, radii } from "../theme";

export default function FinanceScreen() {
  const { state } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);

  const wages = playerWageTotal(team, state.playersById);
  const staffWages = staffWageTotal(team.staff);
  const maintenance = stadiumMaintenance(team.stadium, team.staff);
  const sponsor = sponsorIncome(team.sponsor);
  const avgTicket = estimatedTicketIncomePerRound(team.stadium);

  const expenses = wages + staffWages + maintenance;
  const avgIncome = sponsor + avgTicket;
  const avgNet = avgIncome - expenses;

  const roundsOfRunway = avgNet >= 0 ? Infinity : team.budget / Math.abs(avgNet);
  const verdict =
    avgNet >= 0
      ? { label: "SOSTENIBLE", color: colors.win, desc: "Tus ingresos medios cubren los gastos fijos." }
      : roundsOfRunway >= 15
      ? { label: "AJUSTADO", color: colors.accent, desc: "Pierdes dinero de media, pero el presupuesto aguanta bastantes jornadas." }
      : { label: "EN NÚMEROS ROJOS", color: colors.loss, desc: `Al ritmo actual, el presupuesto se agota en unas ${Math.max(1, Math.round(roundsOfRunway))} jornadas.` };

  return (
    <View>
      <Card style={{ borderColor: verdict.color }}>
        <Text style={styles.h2}>SALUD ECONÓMICA</Text>
        <Text style={[styles.verdict, { color: verdict.color }]}>{verdict.label}</Text>
        <Text style={styles.dim}>{verdict.desc}</Text>
      </Card>

      <Card>
        <Text style={styles.h3}>INGRESOS MEDIOS POR JORNADA</Text>
        <Row label="Patrocinador" value={sponsor} positive />
        <Row label="Taquilla (estimada)" value={avgTicket} positive />
        <View style={styles.divider} />
        <Row label="Total ingresos" value={avgIncome} bold positive />
        <Text style={styles.small}>
          Último partido en casa: {team.lastTicketRevenue ? `+$${team.lastTicketRevenue.toLocaleString()}` : "aún no jugado / fue fuera"}
        </Text>
      </Card>

      <Card>
        <Text style={styles.h3}>GASTOS FIJOS POR JORNADA</Text>
        <Row label="Sueldos de jugadores" value={-wages} />
        <Row label="Sueldos de personal" value={-staffWages} />
        <Row label="Mantenimiento de estadio" value={-maintenance} />
        <View style={styles.divider} />
        <Row label="Total gastos" value={-expenses} bold />
      </Card>

      <Card>
        <Text style={styles.h3}>BALANCE MEDIO POR JORNADA</Text>
        <Text style={[styles.netValue, { color: avgNet >= 0 ? colors.win : colors.loss }]}>
          {avgNet >= 0 ? "+" : ""}
          ${avgNet.toLocaleString()}
        </Text>
        <Text style={styles.dim}>Presupuesto actual: ${team.budget.toLocaleString()}</Text>
      </Card>
    </View>
  );
}

function Row({ label, value, positive, bold }) {
  const color = value === 0 ? colors.textDim : value > 0 || positive ? colors.win : colors.loss;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, { color }, bold && styles.bold]}>
        {value > 0 ? "+" : ""}
        ${value.toLocaleString()}
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
});
