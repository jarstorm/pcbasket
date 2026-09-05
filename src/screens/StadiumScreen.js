import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import { getUpgradeTiers } from "../engine/stadium";
import { colors, spacing, radii } from "../theme";

export default function StadiumScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const tiers = getUpgradeTiers(team.stadium);
  const [selectedId, setSelectedId] = useState(tiers[1]?.id ?? tiers[0]?.id);
  const selected = tiers.find((t) => t.id === selectedId);

  return (
    <View>
      <Card>
        <Text style={styles.h2}>{team.stadium.name.toUpperCase()}</Text>
        <View style={styles.statsBox}>
          <StatRow label="NIVEL" value={String(team.stadium.level)} />
          <StatRow label="CAPACIDAD" value={`${team.stadium.capacity.toLocaleString()} asientos`} />
          <StatRow label="PRECIO ENTRADA" value={`$${team.stadium.ticketPrice}`} />
        </View>
        <Text style={styles.dim}>
          Cada partido en casa genera ingresos por taquilla proporcionales a capacidad y precio. Un
          precio demasiado alto ahuyenta afición. Ampliar el estadio da también una pequeña ventaja
          de local.
        </Text>
      </Card>

      <Card>
        <Text style={styles.h2}>PRECIO DE ENTRADA</Text>
        <View style={styles.priceRow}>
          <Pressable
            style={styles.priceBtn}
            onPress={() =>
              dispatch({ type: "SET_TICKET_PRICE", teamId: team.id, price: team.stadium.ticketPrice - 5 })
            }
          >
            <Text style={styles.priceBtnText}>−</Text>
          </Pressable>
          <Text style={styles.priceValue}>${team.stadium.ticketPrice}</Text>
          <Pressable
            style={styles.priceBtn}
            onPress={() =>
              dispatch({ type: "SET_TICKET_PRICE", teamId: team.id, price: team.stadium.ticketPrice + 5 })
            }
          >
            <Text style={styles.priceBtnText}>+</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={styles.h2}>REMODELACIÓN</Text>
        {tiers.map((tier) => {
          const isSelected = tier.id === selectedId;
          const affordable = team.budget >= tier.cost;
          return (
            <Pressable
              key={tier.id}
              onPress={() => setSelectedId(tier.id)}
              style={[styles.tierRow, isSelected && styles.tierRowSelected]}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierLabel}>{tier.label}</Text>
                <Text style={styles.tierDesc}>
                  +{tier.capacityGain.toLocaleString()} asientos · +${tier.priceGain} entrada
                </Text>
              </View>
              <Text style={[styles.tierCost, !affordable && styles.tierCostBad]}>
                ${tier.cost.toLocaleString()}
              </Text>
            </Pressable>
          );
        })}

        <Button
          primary
          disabled={!selected || team.budget < selected.cost}
          onPress={() => dispatch({ type: "UPGRADE_STADIUM", teamId: team.id, tierId: selectedId })}
          style={{ marginTop: spacing.sm }}
        >
          Mejorar estadio
        </Button>
      </Card>
    </View>
  );
}

function StatRow({ label, value }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 8, letterSpacing: 0.6 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  priceBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  priceBtnText: { color: colors.accent, fontSize: 20, fontWeight: "800" },
  priceValue: { color: colors.text, fontSize: 22, fontWeight: "800", minWidth: 70, textAlign: "center" },
  dim: { color: colors.textDim, fontSize: 12, marginTop: spacing.sm },
  statsBox: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.panelAlt,
  },
  statLabel: { color: colors.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  statValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  tierRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.panelAlt,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkboxMark: { color: colors.accentText, fontWeight: "800", fontSize: 13 },
  tierLabel: { color: colors.text, fontWeight: "700", fontSize: 13 },
  tierDesc: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  tierCost: { color: colors.accent, fontWeight: "800", fontSize: 13 },
  tierCostBad: { color: colors.loss },
});
