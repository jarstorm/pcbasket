import { Pressable, Text, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";

export default function Button({ children, onPress, disabled, primary, style }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[
        styles.button,
        primary && styles.primary,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, primary && styles.primaryText]}>{children}</Text>
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
