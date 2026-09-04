import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import { colors, spacing, radii } from "../theme";

export default function TeamPicker() {
  const { state, dispatch } = useGame();

  return (
    <ScrollView style={styles.shell} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>PC Basket Manager</Text>
      <Text style={styles.subtitle}>Elige tu equipo</Text>
      <Text style={styles.desc}>
        20 equipos, temporada de ida y vuelta. Elige el tuyo para empezar a manejar plantilla,
        fichajes, cantera y estadio.
      </Text>
      <View style={styles.grid}>
        {state.teams.map((t) => (
          <Pressable
            key={t.id}
            style={styles.teamCard}
            onPress={() => dispatch({ type: "CHOOSE_TEAM", teamId: t.id })}
          >
            <Text style={styles.teamName}>{t.name}</Text>
            <Text style={styles.teamBudget}>Presupuesto: ${t.budget.toLocaleString()}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  subtitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  desc: { color: colors.textDim, fontSize: 13, marginBottom: spacing.lg },
  grid: { gap: spacing.sm },
  teamCard: {
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  teamName: { fontWeight: "700", color: colors.text, fontSize: 14 },
  teamBudget: { fontSize: 12, color: colors.textDim, marginTop: 4 },
});
