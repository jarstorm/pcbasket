import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import Pill from "../components/Pill";
import Select from "../components/Select";
import RatingBar from "../components/RatingBar";
import Button from "../components/Button";
import { POSITION_ORDER, POSITION_ABBR } from "../data/positions";
import { FOREIGN_PLAYER_QUOTA, isForeign } from "../engine/rules";
import { positionMismatchFactor, OFFENSE_TACTICS, DEFENSE_TACTICS } from "../engine/simulate";
import StatBar from "../components/StatBar";
import Plaque from "../components/Plaque";
import { colors, spacing, radii } from "../theme";
import SectionHeader from "../components/SectionHeader";

const POSITION_HUE = { PG: 205, SG: 165, SF: 130, PF: 35, C: 5 };

export default function RosterScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const roster = team.roster.map((id) => state.playersById[id]).sort((a, b) => b.overall - a.overall);
  const [expandedId, setExpandedId] = useState(null);

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

  return (
    <View>
      <Card>
        <SectionHeader>QUINTETO INICIAL</SectionHeader>
        <Text style={styles.dim}>
          Media del quinteto: {lineupAverage !== null ? lineupAverage : "-"} ({filledSlots.length}/5)
        </Text>
        <Text style={styles.dim}>
          Extracomunitarios en el quinteto: {foreignStarterCount}/{FOREIGN_PLAYER_QUOTA}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {lineupSlots.map((slot) => (
            <Select
              key={slot.pos}
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
                <View style={styles.lineupRow}>
                  <View style={[styles.avatar, { backgroundColor: `hsl(${POSITION_HUE[slot.pos]}, 45%, 26%)` }]}>
                    <Text style={styles.avatarText}>{POSITION_ABBR[slot.pos]}</Text>
                  </View>
                  {slot.starter ? (
                    <View style={{ flex: 1 }}>
                      <View style={styles.lineupTopRow}>
                        <Text style={styles.lineupName} numberOfLines={1}>{slot.starter.name}</Text>
                        <OvrBadge value={slot.outOfPosition ? slot.effectiveOverall : slot.starter.overall} />
                      </View>
                      <View style={styles.plaqueRow}>
                        <Plaque>{slot.starter.age} años</Plaque>
                        {isForeign(slot.starter) && <Plaque>EXT</Plaque>}
                        {slot.starter.injured && <Plaque>LESIONADO</Plaque>}
                        {slot.outOfPosition && (
                          <Plaque>FUERA DE POSICIÓN {slot.starter.overall}→{slot.effectiveOverall}</Plaque>
                        )}
                      </View>
                      <View style={{ marginTop: 6 }}>
                        <StatBar label="TIRO" value={slot.starter.ratings.shooting} />
                        <StatBar label="DEF" value={slot.starter.ratings.defense} />
                        <StatBar label="PASE" value={slot.starter.ratings.passing} />
                        <StatBar label="REB" value={slot.starter.ratings.rebounding} />
                        <StatBar label="FÍS." value={slot.starter.ratings.physical} />
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.lineupEmpty}>VACÍO — toca para asignar</Text>
                  )}
                </View>
              )}
            />
          ))}
        </View>
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
          <PlayerRow
            key={p.id}
            player={p}
            odd={i % 2 === 1}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
            onToggleListed={() => dispatch({ type: "LIST_PLAYER", playerId: p.id, listed: !p.listed })}
          />
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

function PlayerRow({ player, odd, expanded, onToggle, onToggleListed }) {
  const form = player.form ?? 99;
  return (
    <Pressable onPress={onToggle} style={[styles.playerRow, odd && styles.playerRowOdd]}>
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
          {isForeign(player) && <Text style={styles.foreign}>EXT</Text>}
          {player.injured && <Text style={styles.injured}>LESIONADO</Text>}
          {player.listed && <Text style={styles.listed}>EN VENTA</Text>}
        </View>
      </View>
      {expanded && (
        <View style={styles.ratings}>
          <RatingBar label="TIRO" value={player.ratings.shooting} />
          <RatingBar label="DEF" value={player.ratings.defense} />
          <RatingBar label="PASE" value={player.ratings.passing} />
          <RatingBar label="REB" value={player.ratings.rebounding} />
          <RatingBar label="FÍSICO" value={player.ratings.physical} />
          <Text style={styles.value}>Valor: ${player.value.toLocaleString()}</Text>
          <Button onPress={onToggleListed} style={{ marginTop: spacing.sm }}>
            {player.listed ? "Quitar de venta" : "Poner en venta"}
          </Button>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim, fontSize: 13 },
  lineupRow: {
    flexDirection: "row",
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlt,
    padding: spacing.sm,
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  lineupTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  lineupName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800" },
  plaqueRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4, marginBottom: 2 },
  lineupEmpty: { flex: 1, color: colors.textDim, fontSize: 12, fontWeight: "700" },
  playerRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerRowOdd: { backgroundColor: "rgba(255,255,255,0.03)" },
  playerMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  playerLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1, flex: 1 },
  playerName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  formaText: { fontSize: 10, fontWeight: "800", alignSelf: "center" },
  playerRight: { alignItems: "flex-end", marginLeft: 8 },
  injured: { color: colors.loss, fontSize: 9, fontWeight: "800", marginTop: 2 },
  tacticRow: { flexDirection: "row", gap: spacing.md },
  tacticLabel: { color: colors.textDim, fontSize: 11, fontWeight: "700", marginBottom: 4, letterSpacing: 0.4 },
  tacticDesc: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  foreign: { color: colors.textDim, fontSize: 9, fontWeight: "800", marginTop: 2 },
  listed: { color: colors.accent, fontSize: 9, fontWeight: "800", marginTop: 2 },
  ratings: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  value: { color: colors.textDim, fontSize: 11, marginTop: 2 },
});
