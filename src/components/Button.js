import { Pressable, Text, ActivityIndicator, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";

export default function Button({ children, onPress, disabled, loading, primary, style }) {
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={[
        styles.button,
        primary && styles.primary,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.accentText : colors.text} />
      ) : (
        <Text style={[styles.text, primary && styles.primaryText]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    borderRadius: radii.sm + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  primaryText: {
    color: colors.accentText,
  },
});
