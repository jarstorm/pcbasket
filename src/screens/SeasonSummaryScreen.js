import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import SectionHeader from "../components/SectionHeader";
import TeamLogo from "../components/TeamLogo";
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

      {summary.playerChanges?.length > 0 && (
        <Card>
          <SectionHeader>Evolución de la plantilla</SectionHeader>
          {summary.playerChanges.map((c) => (
            <Row
              key={c.playerId}
              label={c.name}
              value={`${c.before} → ${c.after}`}
              color={c.after > c.before ? colors.win : colors.loss}
            />
          ))}
        </Card>
      )}

      {summary.divisions.map((div) => (
        <Card key={div.id}>
          <SectionHeader>{div.name}</SectionHeader>
          <TeamRow label="🏆 Campeón" teams={div.champions} highlight />
          <TeamRow label="⬆ Ascienden" teams={div.promoted} color={colors.win} />
          <TeamRow label="⬇ Descienden" teams={div.relegated} color={colors.loss} />
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

function TeamRow({ label, teams, color, highlight }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {teams.length ? (
        <View style={styles.teamChipsRow}>
          {teams.map((t) => (
            <View key={t.id} style={styles.teamChip}>
              <TeamLogo team={t} size={18} />
              <Text
                style={[styles.rowValue, highlight && styles.rowValueHighlight, color && { color }]}
                numberOfLines={1}
              >
                {t.name}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.rowValue}>—</Text>
      )}
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
  teamChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  teamChip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 160 },
  continueBtn: { marginTop: spacing.sm, marginBottom: spacing.md, paddingVertical: spacing.md },
});
