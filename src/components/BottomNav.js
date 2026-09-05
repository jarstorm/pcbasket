import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";

export default function BottomNav({ tabs, activeId, onSelect }) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <Pressable key={tab.id} onPress={() => onSelect(tab.id)} style={styles.item}>
            <View style={styles.indicator}>{active && <View style={styles.indicatorDot} />}</View>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 3,
    borderTopColor: colors.accent,
    backgroundColor: colors.panel,
    paddingBottom: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: 2,
  },
  indicator: { height: 3, width: 24, alignItems: "center", justifyContent: "center" },
  indicatorDot: { width: 24, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  iconWrapActive: {
    backgroundColor: "rgba(255, 149, 0, 0.28)",
    borderColor: colors.accent,
  },
  icon: { fontSize: 18, opacity: 0.55 },
  iconActive: { opacity: 1 },
  label: { fontSize: 10, fontWeight: "700", color: colors.textDim, letterSpacing: 0.3 },
  labelActive: { color: colors.accent, fontWeight: "800" },
});
