import { View, Text, Pressable, Image, Alert, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import Pill from "../components/Pill";
import Select from "../components/Select";
import Icon from "../components/Icon";
import { POSITION_ORDER, POSITION_ABBR } from "../data/positions";
import { FOREIGN_PLAYER_QUOTA, isForeign } from "../engine/rules";
import { positionMismatchFactor } from "../engine/simulate";
import Plaque from "../components/Plaque";
import { colors, spacing, radii } from "../theme";
import SectionHeader from "../components/SectionHeader";

const POSITION_HUE = { PG: 205, SG: 165, SF: 130, PF: 35, C: 5 };
// Half-court position spread (hoop at the bottom) — base up top near
// half-court, escolta/alero on the wings, ala-pivot/pívot down low by the
// basket, matching the classic position diagram — not real tactics.
const COURT_SPOT = { PG: [50, 16], SG: [22, 46], SF: [78, 46], PF: [32, 80], C: [68, 80] };
const PLANK_COUNT = 9;

export default function RosterScreen({ onOpenPlayer }) {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const roster = team.roster.map((id) => state.playersById[id]).sort((a, b) => b.overall - a.overall);

  const starterIds = new Set(Object.values(team.lineup).filter(Boolean));
  const bench = roster.filter((p) => !starterIds.has(p.id));

  const foreignStarterCount = [...starterIds].filter((id) => isForeign(state.playersById[id])).length;

  const lineupSlots = POSITION_ORDER.map((pos) => {
    const starterId = team.lineup[pos];
    const starter = starterId ? state.playersById[starterId] : null;
    // Every other starter is already committed to their own slot — only the
    // bench (plus the current occupant, so it still shows as selected) is
    // offered here. The foreign-quota cap on the pick itself is enforced by
    // SET_LINEUP, not filtered out of the list — the bench is always shown
    // in full regardless of which slot is being changed.
    const eligible = bench.filter((p) => !p.injured);
    const label = (p) => {
      const penalized = p.position !== pos ? Math.round(p.overall * positionMismatchFactor(pos, p.position)) : null;
      const ovrLabel = penalized !== null ? `${p.overall}→${penalized}` : `${p.overall}`;
      return `${p.name} (${POSITION_ABBR[p.position] || p.position}, ${ovrLabel})${isForeign(p) ? " •" : ""}`;
    };
    const options = [
      ...(starter ? [{ label: `${label(starter)} (actual)`, value: starter.id }] : []),
      ...eligible.map((p) => ({ label: label(p), value: p.id })),
    ];
    const outOfPosition = starter && starter.position !== pos;
    const effectiveOverall = starter
      ? Math.round(starter.overall * positionMismatchFactor(pos, starter.position))
      : null;

    const selectPlayer = (playerId) => {
      if (playerId) {
        const candidate = state.playersById[playerId];
        const foreignElsewhere = foreignStarterCount - (isForeign(starter) ? 1 : 0);
        const foreignAfter = foreignElsewhere + (isForeign(candidate) ? 1 : 0);
        if (foreignAfter > FOREIGN_PLAYER_QUOTA && foreignAfter > foreignStarterCount) {
          Alert.alert(
            "Cupo de extranjeros lleno",
            `Ya tienes ${FOREIGN_PLAYER_QUOTA} extranjeros en el quinteto. Saca a uno antes de meter a ${candidate.name}.`
          );
          return;
        }
      }
      dispatch({ type: "SET_LINEUP", teamId: team.id, position: pos, playerId: playerId || null });
    };

    return { pos, starter, starterId, options, outOfPosition, effectiveOverall, selectPlayer };
  });

  const filledSlots = lineupSlots.filter((s) => s.starter);
  const lineupAverage = filledSlots.length
    ? Math.round(
        filledSlots.reduce((sum, s) => sum + (s.outOfPosition ? s.effectiveOverall : s.starter.overall), 0) /
          filledSlots.length
      )
    : null;

  const warnings = filledSlots.filter((s) => s.starter.injured);

  return (
    <View>
      <Card>
        <SectionHeader>QUINTETO INICIAL</SectionHeader>
        <View style={styles.summaryRow}>
          <Text style={styles.dim}>
            Media: <Text style={styles.summaryValueBig}>{lineupAverage !== null ? lineupAverage : "-"}</Text> ({filledSlots.length}/5)
          </Text>
          <Text style={styles.dim}>
            EXT: <Text style={styles.summaryValue}>{foreignStarterCount}/{FOREIGN_PLAYER_QUOTA}</Text>
          </Text>
        </View>

        <View style={styles.court}>
          {Array.from({ length: PLANK_COUNT }, (_, i) => (
            <View
              key={i}
              style={[
                styles.plank,
                i % 2 === 1 && styles.plankAlt,
                { left: `${(i * 100) / PLANK_COUNT}%`, width: `${100 / PLANK_COUNT}%` },
              ]}
            />
          ))}
          <Image source={require("../../assets/court-texture.png")} style={styles.courtTexture} resizeMode="repeat" />
          <View style={styles.courtBorder} />
          <View style={styles.threePointArc} />
          <View style={styles.key} />
          <View style={styles.freeThrowCircle} />
          <View style={styles.hoop} />
          <View style={styles.backboard} />
          {lineupSlots.map((slot) => {
            const [x, y] = COURT_SPOT[slot.pos];
            return (
              <View key={slot.pos} style={[styles.dotWrap, { left: `${x}%`, top: `${y}%` }]}>
                <Select
                  value={slot.starterId || ""}
                  options={slot.options}
                  onChange={slot.selectPlayer}
                  renderTrigger={() => (
                    <View style={styles.dot}>
                      <View
                        style={[
                          styles.dotAvatar,
                          { backgroundColor: `hsl(${POSITION_HUE[slot.pos]}, 45%, 26%)` },
                          slot.starter?.injured && styles.dotAvatarInjured,
                        ]}
                      >
                        <Text style={styles.dotAvatarText}>{POSITION_ABBR[slot.pos]}</Text>
                        {slot.starter && (
                          <View style={[styles.dotOvr, slot.outOfPosition && styles.dotOvrBad]}>
                            <Text style={[styles.dotOvrText, slot.outOfPosition && styles.dotOvrTextBad]}>
                              {slot.outOfPosition ? slot.effectiveOverall : slot.starter.overall}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.dotLabel} numberOfLines={1}>
                        {slot.starter ? slot.starter.name.split(" ").slice(-1)[0] : "VACÍO"}
                      </Text>
                      {slot.starter?.injured && <Icon name="healing" size={13} color={colors.loss} />}
                    </View>
                  )}
                />
              </View>
            );
          })}
          <Text style={styles.courtHint}>TOCA PARA CAMBIAR</Text>
        </View>

        {warnings.length > 0 && (
          <View style={{ marginTop: spacing.sm, gap: 6 }}>
            {warnings.map((s) => (
              <View key={s.pos} style={styles.warningRow}>
                <Icon name="healing" size={15} color={colors.loss} />
                <Text style={styles.warningText}>{s.starter.name} está lesionado en el quinteto</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionHeader>SUPLENTES ({bench.length})</SectionHeader>
        {bench.length === 0 && <Text style={styles.dim}>No hay suplentes en la plantilla.</Text>}
        {bench.map((p, i) => (
          <PlayerRow key={p.id} player={p} odd={i % 2 === 1} onPress={() => onOpenPlayer(p.id)} />
        ))}
      </Card>
    </View>
  );
}

function formColor(form) {
  if (form >= 85) return colors.win;
  if (form >= 65) return colors.accent;
  return colors.loss;
}

function PlayerRow({ player, odd, onPress }) {
  const form = player.form ?? 99;
  return (
    <Pressable onPress={onPress} style={[styles.playerRow, odd && styles.playerRowOdd]}>
      <View style={styles.playerMain}>
        <View style={styles.playerLeft}>
          <Pill>{POSITION_ABBR[player.position] || player.position}</Pill>
          <View style={{ marginLeft: 8, flexShrink: 1 }}>
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <View style={styles.plaqueRow}>
              <Plaque>{player.age} años</Plaque>
              {player.nationality && <Plaque>{player.nationality}</Plaque>}
              <Text style={[styles.formaText, { color: formColor(form) }]}>Forma {form}</Text>
            </View>
          </View>
        </View>
        <View style={styles.playerRight}>
          <OvrBadge value={player.overall} />
          {isForeign(player) && <View style={styles.foreignDot} />}
          {player.injured && <Text style={styles.injured}>LESIONADO</Text>}
          {player.listed && <Text style={styles.listed}>EN VENTA</Text>}
        </View>
        <Icon name="chevron-right" size={18} color={colors.border} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  summaryValue: { color: colors.text, fontWeight: "800" },
  summaryValueBig: { color: colors.text, fontWeight: "800", fontSize: 18 },
  summaryRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.sm },
  court: {
    height: 300,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "#b97a3d",
    overflow: "hidden",
  },
  plank: { position: "absolute", top: 0, bottom: 0, backgroundColor: "#c68d54" },
  plankAlt: { backgroundColor: "#b97a3d" },
  courtTexture: { ...StyleSheet.absoluteFillObject, opacity: 0.12 },
  courtBorder: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 8,
    bottom: 8,
    borderWidth: 2,
    borderColor: "rgba(255,250,240,0.75)",
    borderRadius: 2,
  },
  // The three-point arc is a big circle centered below the baseline, mostly
  // clipped by the court's overflow:hidden — only its top edge peeks in.
  threePointArc: {
    position: "absolute",
    left: "50%",
    bottom: -210,
    width: 420,
    height: 420,
    marginLeft: -210,
    borderRadius: 210,
    borderWidth: 2,
    borderColor: "rgba(255,250,240,0.6)",
  },
  key: {
    position: "absolute",
    left: "50%",
    bottom: 8,
    width: 100,
    height: 150,
    marginLeft: -50,
    borderWidth: 2,
    borderColor: "rgba(255,250,240,0.65)",
    borderBottomWidth: 0,
  },
  freeThrowCircle: {
    position: "absolute",
    left: "50%",
    bottom: 8 + 150 - 30,
    width: 60,
    height: 60,
    marginLeft: -30,
    borderWidth: 2,
    borderColor: "rgba(255,250,240,0.65)",
    borderRadius: 30,
  },
  hoop: {
    position: "absolute",
    left: "50%",
    bottom: 14,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  backboard: {
    position: "absolute",
    left: "50%",
    bottom: 8,
    width: 40,
    height: 3,
    marginLeft: -20,
    backgroundColor: "rgba(255,250,240,0.75)",
  },
  dotWrap: { position: "absolute", transform: [{ translateX: -37 }, { translateY: -30 }], width: 74 },
  dot: { alignItems: "center", gap: 3 },
  dotAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotAvatarInjured: { borderColor: colors.loss },
  dotAvatarText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  dotOvr: {
    position: "absolute",
    bottom: -8,
    right: -9,
    minWidth: 26,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: colors.panelAlt,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOvrText: { color: colors.accent, fontWeight: "800", fontSize: 13 },
  dotOvrBad: { borderColor: colors.loss },
  dotOvrTextBad: { color: colors.loss },
  dotLabel: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(10,14,31,0.75)",
    color: colors.text,
    fontWeight: "700",
    fontSize: 11,
    maxWidth: 78,
  },
  courtHint: {
    position: "absolute",
    top: 8,
    right: 12,
    color: "rgba(255,250,240,0.7)",
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  warningRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  warningText: { flex: 1, color: colors.loss, fontSize: 11, fontWeight: "700" },
  playerRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerRowOdd: { backgroundColor: "rgba(255,255,255,0.03)" },
  playerMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  playerLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1, flex: 1 },
  playerName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  plaqueRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4, marginBottom: 2 },
  formaText: { fontSize: 10, fontWeight: "800", alignSelf: "center" },
  playerRight: { alignItems: "flex-end" },
  injured: { color: colors.loss, fontSize: 9, fontWeight: "800", marginTop: 2 },
  foreignDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.loss, marginTop: 4 },
  listed: { color: colors.accent, fontSize: 9, fontWeight: "800", marginTop: 2 },
});
