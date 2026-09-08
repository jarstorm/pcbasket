import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import RatingBar from "../components/RatingBar";
import Plaque from "../components/Plaque";
import Button from "../components/Button";
import SectionHeader from "../components/SectionHeader";
import { POSITION_LABEL, POSITION_ABBR } from "../data/positions";
import { isForeign } from "../engine/rules";
import { colors, spacing, radii } from "../theme";

const POSITION_HUE = { PG: 205, SG: 165, SF: 130, PF: 35, C: 5 };

export default function PlayerDetailScreen({ player }) {
  const { state, dispatch } = useGame();

  if (!player) {
    return (
      <Card>
        <Text style={styles.dim}>Jugador no encontrado.</Text>
      </Card>
    );
  }

  const annualWage = player.wage * state.schedule.length;
  const form = player.form ?? 99;

  return (
    <View>
      <Card>
        <View style={styles.headerRow}>
          <View style={[styles.avatar, { backgroundColor: `hsl(${POSITION_HUE[player.position]}, 45%, 26%)` }]}>
            <Text style={styles.avatarText}>{POSITION_ABBR[player.position] || player.position}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{player.name}</Text>
            <View style={styles.plaqueRow}>
              <Plaque>{player.age} AÑOS</Plaque>
              <Plaque>{POSITION_LABEL[player.position]?.toUpperCase()}</Plaque>
              {isForeign(player) && <Plaque>EXTRACOMUNITARIO</Plaque>}
              {player.injured && <Plaque>LESIONADO</Plaque>}
              {player.listed && <Plaque>EN VENTA</Plaque>}
            </View>
          </View>
          <View style={styles.ovrBox}>
            <Text style={[styles.ovrValue, { color: player.overall >= 78 ? colors.win : player.overall >= 62 ? colors.accent : colors.textDim }]}>
              {player.overall}
            </Text>
            <Text style={styles.ovrLabel}>OVR</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader>HABILIDADES</SectionHeader>
        <RatingBar label="TIRO" value={player.ratings.shooting} />
        <RatingBar label="DEF" value={player.ratings.defense} />
        <RatingBar label="PASE" value={player.ratings.passing} />
        <RatingBar label="REB" value={player.ratings.rebounding} />
        <RatingBar label="FÍSICO" value={player.ratings.physical} />
      </Card>

      <Card>
        <SectionHeader>CONTRATO</SectionHeader>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>FORMA</Text>
          <Text style={styles.infoValue}>{form}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>CLÁUSULA</Text>
          <Text style={styles.infoValue}>€{player.value.toLocaleString()}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>SALARIO/AÑO</Text>
          <Text style={styles.infoValue}>€{annualWage.toLocaleString()}</Text>
        </View>
      </Card>

      <Button
        onPress={() => dispatch({ type: "LIST_PLAYER", playerId: player.id, listed: !player.listed })}
        style={{ marginBottom: spacing.md }}
      >
        {player.listed ? "Quitar de venta" : "Poner en venta"}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim, fontSize: 13 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: colors.text, fontWeight: "800", fontSize: 15 },
  name: { color: colors.text, fontSize: 18, fontWeight: "800" },
  plaqueRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  ovrBox: {
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlt,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  ovrValue: { fontSize: 22, fontWeight: "800" },
  ovrLabel: { fontSize: 8, fontWeight: "700", color: colors.textDim, letterSpacing: 1, marginTop: 2 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { color: colors.textDim, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
});
