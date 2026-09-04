import { View, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";

export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md + 2,
    marginBottom: spacing.md + 2,
  },
});
