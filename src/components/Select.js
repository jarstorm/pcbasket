import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";

export default function Select({ value, options, onChange, placeholder = "-- elegir --", renderTrigger }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View>
      <Pressable onPress={() => setOpen(true)}>
        {renderTrigger ? (
          renderTrigger(current)
        ) : (
          <View style={styles.trigger}>
            <Text style={styles.triggerText} numberOfLines={1}>
              {current ? current.label : placeholder}
            </Text>
          </View>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(o, i) => String(o.value ?? i)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    minWidth: 120,
  },
  triggerText: {
    color: colors.text,
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    maxHeight: "60%",
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: "600",
  },
});
