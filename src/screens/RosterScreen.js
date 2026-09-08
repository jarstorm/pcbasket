import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import Pill from "../components/Pill";
import Select from "../components/Select";
import Icon from "../components/Icon";
import { POSITION_ORDER, POSITION_ABBR } from "../data/positions";
import { FOREIGN_PLAYER_QUOTA, isForeign } from "../engine/rules";
import { positionMismatchFactor, OFFENSE_TACTICS, DEFENSE_TACTICS } from "../engine/simulate";
import Plaque from "../components/Plaque";
import { colors, spacing, radii } from "../theme";
import SectionHeader from "../components/SectionHeader";

const POSITION_HUE = { PG: 205, SG: 165, SF: 130, PF: 35, C: 5 };
// Rough "1-3-1" spread across the full-court diagram (left hoop / right
// hoop), matched to the design mockup — not real tactical positioning.
const COURT_SPOT = { PG: [22, 76], SG: [20, 24], SF: [48, 56], PF: [70, 22], C: [72, 76] };

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
    // Foreign starters elsewhere in the lineup (not this slot) already
    // committed against the quota — a foreign candidate here can only be
    // picked if there's still room for one more.
    const foreignElsewhere = foreignStarterCount - (isForeign(starter) ? 1 : 0);
    const quotaLeft = FOREIGN_PLAYER_QUOTA - foreignElsewhere;
    // A foreign candidate is always offered when there's quota room, and
    // also when the current starter here is foreign too (swapping one
    // foreigner for another doesn't make an already-over-quota lineup worse
    // — see the matching "no worse than before" check in SET_LINEUP).
    const eligible = roster.filter(
      (p) => p.id !== starterId && !p.injured && (!isForeign(p) || quotaLeft > 0 || isForeign(starter))
    );
    const label = (p) => {
      const penalized = p.position !== pos ? Math.round(p.overall * positionMismatchFactor(pos, p.position)) : null;
      const ovrLabel = penalized !== null ? `${p.overall}→${penalized}` : `${p.overall}`;
      return `${p.name} (${POSITION_ABBR[p.position] || p.position}, ${ovrLabel})${isForeign(p) ? " · EXT" : ""}${penalized !== null ? " ⚠" : ""}`;
    };
    const options = [
      { label: "-- vacío --", value: "" },
      ...(starter ? [{ label: `${label(starter)} (actual)`, value: starter.id }] : []),
      ...eligible.map((p) => ({ label: label(p), value: p.id })),
    ];
    const outOfPosition = starter && starter.position !== pos;
    const effectiveOverall = starter
      ? Math.round(starter.overall * positionMismatchFactor(pos, starter.position))
      : null;

    return { pos, starter, starterId, options, outOfPosition, effectiveOverall };
  });

  const filledSlots = lineupSlots.filter((s) => s.starter);
  const lineupAverage = filledSlots.length
    ? Math.round(
        filledSlots.reduce((sum, s) => sum + (s.outOfPosition ? s.effectiveOverall : s.starter.overall), 0) /
          filledSlots.length
      )
    : null;

  const warnings = filledSlots.filter((s) => s.starter.injured || s.outOfPosition);

  return (
    <View>
      <Card>
        <SectionHeader>QUINTETO INICIAL</SectionHeader>
        <View style={styles.summaryRow}>
          <Text style={styles.dim}>
            Media: <Text style={styles.summaryValue}>{lineupAverage !== null ? lineupAverage : "-"}</Text> ({filledSlots.length}/5)
          </Text>
          <Text style={styles.dim}>
            EXT: <Text style={styles.summaryValue}>{foreignStarterCount}/{FOREIGN_PLAYER_QUOTA}</Text>
          </Text>
        </View>

        <View style={styles.court}>
          <Image source={require("../../assets/court-texture.png")} style={styles.courtTexture} resizeMode="repeat" />
          <View style={styles.courtBorder} />
          <View style={styles.centerLine} />
          <View style={styles.centerCircle} />
          <View style={[styles.paint, styles.paintLeft]} />
          <View style={[styles.paint, styles.paintRight]} />
          {lineupSlots.map((slot) => {
            const [x, y] = COURT_SPOT[slot.pos];
            return (
              <View key={slot.pos} style={[styles.dotWrap, { left: `${x}%`, top: `${y}%` }]}>
                <Select
                  value={slot.starterId || ""}
                  options={slot.options}
                  onChange={(playerId) =>
                    dispatch({
                      type: "SET_LINEUP",
                      teamId: team.id,
                      position: slot.pos,
                      playerId: playerId || null,
                    })
                  }
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
                          <View style={styles.dotOvr}>
                            <Text style={styles.dotOvrText}>
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
                <Icon name={s.starter.injured ? "healing" : "warning"} size={15} color={colors.loss} />
                <Text style={styles.warningText}>
                  {s.starter.name}
                  {s.starter.injured ? " está lesionado en el quinteto" : ` fuera de posición (${s.starter.overall}→${s.effectiveOverall})`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionHeader>TÁCTICA</SectionHeader>
        <View style={styles.tacticRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tacticLabel}>Ataque</Text>
            <Select
              value={team.tactics?.offense || "balanced"}
              options={Object.values(OFFENSE_TACTICS).map((t) => ({ label: t.label, value: t.id }))}
              onChange={(value) => dispatch({ type: "SET_TACTIC", teamId: team.id, kind: "offense", value })}
            />
            <Text style={styles.tacticDesc}>
              {OFFENSE_TACTICS[team.tactics?.offense || "balanced"].desc}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tacticLabel}>Defensa</Text>
            <Select
              value={team.tactics?.defense || "man"}
              options={Object.values(DEFENSE_TACTICS).map((t) => ({ label: t.label, value: t.id }))}
              onChange={(value) => dispatch({ type: "SET_TACTIC", teamId: team.id, kind: "defense", value })}
            />
            <Text style={styles.tacticDesc}>
              {DEFENSE_TACTICS[team.tactics?.defense || "man"].desc}
            </Text>
          </View>
        </View>
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
  summaryRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.sm },
  court: {
    height: 210,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    overflow: "hidden",
  },
  courtTexture: { ...StyleSheet.absoluteFillObject, opacity: 0.5 },
  courtBorder: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 8,
    bottom: 8,
    borderWidth: 2,
    borderColor: "rgba(147,163,201,0.3)",
    borderRadius: 2,
  },
  centerLine: {
    position: "absolute",
    left: "50%",
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: "rgba(147,163,201,0.16)",
  },
  centerCircle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    borderWidth: 2,
    borderColor: "rgba(147,163,201,0.22)",
    borderRadius: 24,
  },
  paint: {
    position: "absolute",
    top: "50%",
    width: 78,
    height: 128,
    marginTop: -64,
    borderWidth: 2,
    borderColor: "rgba(147,163,201,0.22)",
  },
  paintLeft: { left: 10, borderLeftWidth: 0, borderTopRightRadius: 99, borderBottomRightRadius: 99 },
  paintRight: { right: 10, borderRightWidth: 0, borderTopLeftRadius: 99, borderBottomLeftRadius: 99 },
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
    bottom: -5,
    right: -6,
    minWidth: 19,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 4,
    backgroundColor: colors.panelAlt,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOvrText: { color: colors.accent, fontWeight: "800", fontSize: 9 },
  dotLabel: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(10,14,31,0.75)",
    color: colors.text,
    fontWeight: "700",
    fontSize: 9,
    maxWidth: 74,
  },
  courtHint: {
    position: "absolute",
    top: 8,
    right: 12,
    color: "rgba(147,163,201,0.5)",
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
  tacticRow: { flexDirection: "row", gap: spacing.md },
  tacticLabel: { color: colors.textDim, fontSize: 11, fontWeight: "700", marginBottom: 4, letterSpacing: 0.4 },
  tacticDesc: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  foreignDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.loss, marginTop: 4 },
  listed: { color: colors.accent, fontSize: 9, fontWeight: "800", marginTop: 2 },
});
