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
    const eligible = roster.filter(
      (p) => p.id !== starterId && !p.injured && (!isForeign(p) || quotaLeft > 0)
    );
    const label = (p) =>
      `${p.name} (${POSITION_ABBR[p.position] || p.position}, ${p.overall})${isForeign(p) ? " · EXT" : ""}`;
    const options = [
      { label: "-- vacío --", value: "" },
      ...(starter ? [{ label: `${label(starter)} (actual)`, value: starter.id }] : []),
      ...eligible.map((p) => ({ label: label(p), value: p.id })),
    ];
    return { pos, starter, starterId, options };
  });

  return (
    <View>
      <Card>
        <Text style={styles.h2}>QUINTETO INICIAL</Text>
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
                        <OvrBadge value={slot.starter.overall} />
                        {isForeign(slot.starter) && <Text style={styles.foreign}>EXT</Text>}
                        {slot.starter.injured && <Text style={styles.injured}>LESIONADO</Text>}
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

function PlayerRow({ player, expanded, onToggle, onToggleListed }) {
  return (
    <Pressable onPress={onToggle} style={styles.playerRow}>
      <View style={styles.playerMain}>
        <View style={styles.playerLeft}>
          <Pill>{POSITION_ABBR[player.position] || player.position}</Pill>
          <View style={{ marginLeft: 8, flexShrink: 1 }}>
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <Text style={styles.playerSub}>
              {player.age} años{player.nationality ? ` · ${player.nationality}` : ""}
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
