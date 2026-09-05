import { Text, StyleSheet } from "react-native";
import { colors, radii } from "../theme";

export default function Plaque({ children }) {
  return <Text style={styles.plaque}>{children}</Text>;
}

const styles = StyleSheet.create({
  plaque: {
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm - 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
});
