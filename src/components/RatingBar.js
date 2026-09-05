import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

export default function RatingBar({ label, value }) {
  const tier = value >= 78 ? colors.win : value >= 62 ? colors.accent : colors.textDim;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: tier }]} />
      </View>
      <Text style={[styles.value, { color: tier }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  label: { width: 46, fontSize: 10, fontWeight: "700", color: colors.textDim, letterSpacing: 0.4 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginHorizontal: 6,
  },
  fill: { height: "100%" },
  value: { width: 24, fontSize: 11, fontWeight: "800", textAlign: "right" },
});
