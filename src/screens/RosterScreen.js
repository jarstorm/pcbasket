import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
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
import { colors, spacing, radii } from "../theme";

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
        <Text style={styles.h2}>QUINTETO INICIAL</Text>
        <Text style={styles.dim}>
          Media del quinteto: {lineupAverage !== null ? lineupAverage : "-"} ({filledSlots.length}/5)
        </Text>
        <Text style={styles.dim}>
          Extracomunitarios en el quinteto: {foreignStarterCount}/{FOREIGN_PLAYER_QUOTA}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
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
                  <View style={styles.lineupCard}>
                    <Text style={styles.lineupPos}>{POSITION_ABBR[slot.pos]}</Text>
                    {slot.starter ? (
                      <>
                        <Text style={styles.lineupName} numberOfLines={2}>{slot.starter.name}</Text>
                        <OvrBadge value={slot.outOfPosition ? slot.effectiveOverall : slot.starter.overall} />
                        {isForeign(slot.starter) && <Text style={styles.foreign}>EXT</Text>}
                        {slot.starter.injured && <Text style={styles.injured}>LESIONADO</Text>}
                        {slot.outOfPosition && (
                          <Text style={styles.outOfPosition}>
                            FUERA DE POSICIÓN ({slot.starter.overall}→{slot.effectiveOverall})
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.lineupEmpty}>VACÍO</Text>
                    )}
                  </View>
                )}
              />
            ))}
          </View>
        </ScrollView>
      </Card>

      <Card>
        <Text style={styles.h2}>TÁCTICA</Text>
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
        <Text style={styles.h2}>SUPLENTES ({bench.length})</Text>
        {bench.length === 0 && <Text style={styles.dim}>No hay suplentes en la plantilla.</Text>}
        {bench.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
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

function PlayerRow({ player, expanded, onToggle, onToggleListed }) {
  const form = player.form ?? 99;
  return (
    <Pressable onPress={onToggle} style={styles.playerRow}>
      <View style={styles.playerMain}>
        <View style={styles.playerLeft}>
          <Pill>{POSITION_ABBR[player.position] || player.position}</Pill>
          <View style={{ marginLeft: 8, flexShrink: 1 }}>
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <Text style={styles.playerSub}>
              {player.age} años{player.nationality ? ` · ${player.nationality}` : ""} ·{" "}
              <Text style={{ color: formColor(form), fontWeight: "700" }}>Forma {form}</Text>
            </Text>
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
  h2: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 8, letterSpacing: 0.6 },
  dim: { color: colors.textDim, fontSize: 13 },
  lineupCard: {
    width: 92,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlt,
    padding: spacing.sm,
    alignItems: "center",
    gap: 4,
  },
  lineupPos: { color: colors.accent, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  lineupName: { color: colors.text, fontSize: 12, fontWeight: "700", textAlign: "center", minHeight: 30 },
  lineupEmpty: { color: colors.textDim, fontSize: 11, fontWeight: "700", marginTop: 8 },
  playerRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  playerLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1, flex: 1 },
  playerName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  playerSub: { color: colors.textDim, fontSize: 11, marginTop: 1 },
  playerRight: { alignItems: "flex-end", marginLeft: 8 },
  injured: { color: colors.loss, fontSize: 9, fontWeight: "800", marginTop: 2 },
  outOfPosition: { color: colors.loss, fontSize: 8, fontWeight: "800", marginTop: 2, textAlign: "center" },
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
