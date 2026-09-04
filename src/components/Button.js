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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs + 2,
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
  },
  primaryText: {
    color: colors.accentText,
    fontWeight: "600",
  },
});
