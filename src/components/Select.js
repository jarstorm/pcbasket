import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList, StyleSheet, Dimensions } from "react-native";
import { colors, radii, spacing } from "../theme";

// A percentage maxHeight on the sheet isn't enough on its own to bound the
// FlatList inside it (Yoga still lets a non-flexed child grow to its full
// content height, which then overflows the sheet's box silently since
// Views default to overflow:"visible") — the list itself needs an explicit
// pixel cap so it actually has a fixed viewport to scroll within.
const SHEET_MAX_HEIGHT = Math.round(Dimensions.get("window").height * 0.6);

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
              style={styles.list}
              data={options}
              showsVerticalScrollIndicator
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
    maxHeight: SHEET_MAX_HEIGHT,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  list: {
    maxHeight: SHEET_MAX_HEIGHT,
    flexGrow: 0,
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
