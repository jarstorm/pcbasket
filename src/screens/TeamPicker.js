import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import TeamLogo from "../components/TeamLogo";
import { colors, spacing, radii } from "../theme";
import { DIVISION_ORDER, DIVISION_META, assembleActiveDivision, formatGroupLabel } from "../engine/pyramid";

export default function TeamPicker() {
  const { state, dispatch } = useGame();
  const [divisionId, setDivisionId] = useState(state.activeDivisionId);

  const activeDivision = assembleActiveDivision(state);
  const divisionsById = { ...state.otherDivisions, [state.activeDivisionId]: activeDivision };
  const division = divisionsById[divisionId];
  const [groupId, setGroupId] = useState(division.groups[0].id);
  const group = division.groups.find((g) => g.id === groupId) ?? division.groups[0];

  function selectDivision(id) {
    setDivisionId(id);
    setGroupId(divisionsById[id].groups[0].id);
  }

  return (
    <ScrollView style={styles.shell} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>PC Basket Manager</Text>
      <Text style={styles.subtitle}>Elige tu equipo</Text>
      <Text style={styles.desc}>
        Elige liga y equipo para empezar a manejar plantilla, fichajes, cantera y estadio.
      </Text>

      <View style={styles.chipRow}>
        {DIVISION_ORDER.map((id) => (
          <Pressable
            key={id}
            style={[styles.chip, id === divisionId && styles.chipActive]}
            onPress={() => selectDivision(id)}
          >
            <Text style={[styles.chipText, id === divisionId && styles.chipTextActive]}>
              {DIVISION_META[id].name}
            </Text>
          </Pressable>
        ))}
      </View>

      {division.groups.length > 1 && (
        <View style={styles.chipRow}>
          {division.groups.map((g) => (
            <Pressable
              key={g.id}
              style={[styles.chip, g.id === groupId && styles.chipActive]}
              onPress={() => setGroupId(g.id)}
            >
              <Text style={[styles.chipText, g.id === groupId && styles.chipTextActive]}>
                {formatGroupLabel(g.id)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.grid}>
        {group.teams.map((t) => (
          <Pressable
            key={t.id}
            style={styles.teamCard}
            onPress={() => dispatch({ type: "CHOOSE_TEAM", teamId: t.id })}
          >
            <View style={styles.teamRow}>
              <TeamLogo team={t} size={36} />
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.teamName}>{t.name}</Text>
                <Text style={styles.teamBudget}>Presupuesto: €{t.budget.toLocaleString()}</Text>
              </View>
            </View>
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.bg },
  grid: { gap: spacing.sm },
  teamCard: {
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  teamName: { fontWeight: "700", color: colors.text, fontSize: 14 },
  teamBudget: { fontSize: 12, color: colors.textDim, marginTop: 4 },
});
