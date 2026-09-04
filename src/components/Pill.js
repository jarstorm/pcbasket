import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../theme";

export default function Pill({ children, color }) {
  return (
    <View style={styles.pill}>
      <Text style={[styles.text, color && { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingVertical: 1,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
  },
});
