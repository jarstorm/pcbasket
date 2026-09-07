import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import SectionHeader from "../components/SectionHeader";
import { colors, spacing } from "../theme";

export default function SeasonSummaryScreen({ onContinue }) {
  const { state } = useGame();
  const summary = state.lastSeasonSummary;

  if (!summary) {
    return (
      <Card>
        <SectionHeader>TEMPORADA FINALIZADA</SectionHeader>
        <Text style={styles.dim}>Sin datos de la temporada anterior.</Text>
        {onContinue && (
          <Button primary onPress={onContinue} style={{ marginTop: spacing.md }}>
            Continuar
          </Button>
        )}
      </Card>
    );
  }

  return (
    <View>
      <Card style={{ borderColor: colors.accent }}>
        <SectionHeader>
          TEMPORADA {summary.seasonYear}/{summary.seasonYear + 1} FINALIZADA
        </SectionHeader>
        {summary.userMoved ? (
          <Text style={styles.moveText}>
            ¡Tu equipo cambia de categoría! {summary.userMoved.from} → {summary.userMoved.to}
          </Text>
        ) : (
          <Text style={styles.dim}>Tu equipo sigue en la misma categoría.</Text>
        )}
        {summary.retiredNames.length > 0 && (
          <Text style={styles.dim}>Se retiran: {summary.retiredNames.join(", ")}.</Text>
        )}
      </Card>

      {summary.divisions.map((div) => (
        <Card key={div.id}>
          <SectionHeader>{div.name}</SectionHeader>
          <Row label="🏆 Campeón" value={div.champions.length ? div.champions.join(", ") : "—"} highlight />
          <Row label="⬆ Ascienden" value={div.promoted.length ? div.promoted.join(", ") : "—"} color={colors.win} />
          <Row label="⬇ Descienden" value={div.relegated.length ? div.relegated.join(", ") : "—"} color={colors.loss} />
        </Card>
      ))}

      {onContinue && (
        <Button primary onPress={onContinue} style={styles.continueBtn}>
          Continuar
        </Button>
      )}
    </View>
  );
}

function Row({ label, value, color, highlight }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, color && { color }, highlight && styles.rowValueHighlight]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim, fontSize: 12, marginTop: spacing.xs },
  moveText: { color: colors.accent, fontWeight: "700", fontSize: 13, marginBottom: 4 },
  row: { marginBottom: spacing.sm },
  rowLabel: { color: colors.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 0.4, marginBottom: 2 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  rowValueHighlight: { color: colors.accent, fontSize: 15, fontWeight: "800" },
  continueBtn: { marginTop: spacing.sm, marginBottom: spacing.md, paddingVertical: spacing.md },
});
