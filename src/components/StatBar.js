import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

function defaultColor(value) {
  if (value >= 75) return colors.win;
  if (value >= 50) return colors.accent;
  return colors.loss;
}

export default function StatBar({ label, value, color }) {
  const pct = Math.max(0, Math.min(100, value));
  const barColor = color || defaultColor(value);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  label: { width: 32, color: colors.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3 },
  value: { width: 20, textAlign: "right", color: colors.text, fontSize: 9, fontWeight: "800" },
});
