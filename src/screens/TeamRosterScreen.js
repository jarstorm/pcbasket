import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import Pill from "../components/Pill";
import Plaque from "../components/Plaque";
import Icon from "../components/Icon";
import TeamLogo from "../components/TeamLogo";
import { POSITION_ABBR } from "../data/positions";
import { isForeign } from "../engine/rules";
import { colors, spacing, radii } from "../theme";
import SectionHeader from "../components/SectionHeader";

// Read-only view of another club's roster — opened from the standings
// table. Unlike RosterScreen (the user's own team), there's no lineup
// editing or tactics here, just a look at who plays where.
export default function TeamRosterScreen({ team, onOpenPlayer }) {
  const { state } = useGame();
  if (!team) return null;
  const roster = team.roster
    .map((id) => state.playersById[id])
    .filter(Boolean)
    .sort((a, b) => b.overall - a.overall);

  return (
    <View>
      <Card>
        <View style={styles.headerRow}>
          <TeamLogo team={team} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.dim}>
              {team.record.wins}V-{team.record.losses}D · {roster.length} jugadores
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader>PLANTILLA</SectionHeader>
        {roster.length === 0 && <Text style={styles.dim}>Sin jugadores registrados.</Text>}
        {roster.map((p, i) => (
          <PlayerRow key={p.id} player={p} odd={i % 2 === 1} onPress={() => onOpenPlayer(p.id)} />
        ))}
      </Card>
    </View>
  );
}

function PlayerRow({ player, odd, onPress }) {
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
            </View>
          </View>
        </View>
        <View style={styles.playerRight}>
          <OvrBadge value={player.overall} />
          {isForeign(player) && <View style={styles.foreignDot} />}
          {player.injured && <Text style={styles.injured}>LESIONADO</Text>}
        </View>
        <Icon name="chevron-right" size={18} color={colors.border} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  teamName: { color: colors.text, fontSize: 16, fontWeight: "800" },
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
  playerRight: { alignItems: "flex-end" },
  foreignDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.loss, marginTop: 4 },
  injured: { color: colors.loss, fontSize: 9, fontWeight: "800", marginTop: 2 },
});
