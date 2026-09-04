import { Text, StyleSheet } from "react-native";
import { colors } from "../theme";

export default function OvrBadge({ value }) {
  const tier = value >= 78 ? "high" : value >= 62 ? "mid" : "low";
  return <Text style={[styles.ovr, styles[tier]]}>{value}</Text>;
}

const styles = StyleSheet.create({
  ovr: { fontWeight: "700" },
  high: { color: colors.win },
  mid: { color: colors.accent },
  low: { color: colors.textDim },
});
