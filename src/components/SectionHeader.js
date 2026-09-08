import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, radii } from "../theme";

export default function SectionHeader({ children, right, style }) {
  return (
    <LinearGradient
      colors={[colors.headerGradTop, colors.headerGradBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.bar, style]}
    >
      <View style={styles.ball} />
      <Text style={styles.label}>{children}</Text>
      {right}
      <View style={styles.stripe} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accentDim,
    borderRadius: radii.sm + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  ball: {
    width: 16,
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.3)",
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  stripe: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: -2,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
});
