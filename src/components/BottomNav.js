import { View, Text, Pressable, StyleSheet } from "react-native";
import Icon from "./Icon";
import { colors, spacing, radii } from "../theme";

export default function BottomNav({ tabs, activeId, onSelect }) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const isHome = tab.id === "home";
        return (
          <Pressable key={tab.id} onPress={() => onSelect(tab.id)} style={styles.item}>
            <View
              style={[
                styles.iconWrap,
                isHome && styles.iconWrapHome,
                isHome && active && styles.iconWrapHomeActive,
              ]}
            >
              <Icon
                name={tab.icon}
                size={isHome ? 26 : 20}
                color={active ? (isHome ? colors.accentText : colors.accent) : colors.textDim}
              />
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
    alignItems: "flex-end",
    borderTopWidth: 3,
    borderTopColor: colors.accent,
    backgroundColor: colors.panel,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapHome: {
    width: 56,
    height: 56,
    marginTop: -18,
    backgroundColor: colors.panelAlt,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  iconWrapHomeActive: {
    backgroundColor: colors.accent,
  },
  label: { fontSize: 10, fontWeight: "700", color: colors.textDim, letterSpacing: 0.3 },
  labelActive: { color: colors.accent, fontWeight: "800" },
});
