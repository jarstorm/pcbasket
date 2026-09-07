import { View, Text, StyleSheet } from "react-native";
import OvrBadge from "./OvrBadge";
import Button from "./Button";
import Plaque from "./Plaque";
import StatBar from "./StatBar";
import { POSITION_ABBR } from "../data/positions";
import { isForeign } from "../engine/rules";
import { colors, spacing, radii } from "../theme";

const POSITION_HUE = { PG: 205, SG: 165, SF: 130, PF: 35, C: 5 };

export default function PlayerMarketCard({ player, teamName, feeLabel, feeValue, wageValue, disabled, onBuy, buyLabel }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.avatar, { backgroundColor: `hsl(${POSITION_HUE[player.position]}, 45%, 26%)` }]}>
          <Text style={styles.avatarText}>{POSITION_ABBR[player.position] || player.position}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{player.name}</Text>
            {isForeign(player) && <Plaque>EXT</Plaque>}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {teamName ? `${teamName} · ` : ""}{player.age} años · {POSITION_ABBR[player.position] || player.position}
          </Text>
        </View>
        <OvrBadge value={player.overall} />
      </View>

      <View style={styles.barsRow}>
        <View style={{ flex: 1 }}>
          <StatBar label="TIR" value={player.ratings.shooting} />
        </View>
        <View style={{ flex: 1 }}>
          <StatBar label="DEF" value={player.ratings.defense} />
        </View>
        <View style={{ flex: 1 }}>
          <StatBar label="PAS" value={player.ratings.passing} />
        </View>
        <View style={{ flex: 1 }}>
          <StatBar label="REB" value={player.ratings.rebounding} />
        </View>
        <View style={{ flex: 1 }}>
          <StatBar label="FÍS" value={player.ratings.physical} />
        </View>
      </View>

      <View style={styles.footer}>
        {feeLabel && (
          <View style={styles.footerCell}>
            <Text style={styles.footerLabel}>{feeLabel}</Text>
            <Text style={styles.footerValue}>${feeValue.toLocaleString()}</Text>
          </View>
        )}
        <View style={[styles.footerCell, feeLabel && styles.footerCellBorder]}>
          <Text style={styles.footerLabel}>SALARIO/AÑO</Text>
          <Text style={styles.footerValue}>${wageValue.toLocaleString()}</Text>
        </View>
        <Button primary disabled={disabled} onPress={onBuy} style={styles.buyBtn}>
          {buyLabel}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    overflow: "hidden",
    marginBottom: spacing.sm + 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 1,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: colors.text, fontWeight: "800", fontSize: 11 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { color: colors.text, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  meta: { color: colors.textDim, fontSize: 10, fontWeight: "600", marginTop: 3 },
  barsRow: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  footer: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerCell: { flex: 1, padding: spacing.sm + 1 },
  footerCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  footerLabel: { color: colors.textDim, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  footerValue: { color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 2 },
  buyBtn: { flex: 0, width: 96, borderRadius: 0, borderWidth: 0, borderLeftWidth: 1, borderLeftColor: colors.border },
});
