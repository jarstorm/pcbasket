import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import { colors, spacing, radii } from "../theme";

const YEAR_OPTIONS = [1, 2, 3, 4];

export default function ContractsScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const pendingPlayers = state.pendingContracts
    .map((id) => state.playersById[id])
    .filter(Boolean);

  if (pendingPlayers.length === 0) {
    return (
      <Card>
        <Text style={styles.h2}>CONTRATOS</Text>
        <Text style={styles.dim}>No hay renovaciones pendientes ahora mismo.</Text>
      </Card>
    );
  }

  return (
    <View>
      <Card>
        <Text style={styles.h2}>RENOVACIONES PENDIENTES</Text>
        <Text style={styles.dim}>
          A estos jugadores se les acaba el contrato. Ofrece años y sueldo — pueden aceptar, pedir
          más, o rechazar y marcharse (si se retiran, rechazan igualmente).
        </Text>
      </Card>
      {pendingPlayers.map((player) => (
        <ContractOffer
          key={player.id}
          player={player}
          team={team}
          dispatch={dispatch}
          roundsPerSeason={state.schedule.length}
        />
      ))}
    </View>
  );
}

function ContractOffer({ player, team, dispatch, roundsPerSeason }) {
  const [years, setYears] = useState(2);
  const [wage, setWage] = useState(player.wage);

  return (
    <Card>
      <Text style={styles.name}>{player.name}</Text>
      <Text style={styles.dim}>
        {player.age} años · OVR {player.overall} · sueldo actual ${player.wage.toLocaleString()}/jornada ($
        {(player.wage * roundsPerSeason).toLocaleString()}/año)
      </Text>

      <Text style={styles.label}>AÑOS</Text>
      <View style={styles.optionRow}>
        {YEAR_OPTIONS.map((y) => (
          <Pressable
            key={y}
            onPress={() => setYears(y)}
            style={[styles.optionBtn, years === y && styles.optionBtnSelected]}
          >
            <Text style={[styles.optionText, years === y && styles.optionTextSelected]}>{y}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>SUELDO POR JORNADA</Text>
      <View style={styles.stepperRow}>
        <Pressable style={styles.stepBtn} onPress={() => setWage(Math.max(200, wage - 200))}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.wageValue}>${wage.toLocaleString()}</Text>
        <Pressable style={styles.stepBtn} onPress={() => setWage(wage + 200)}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.dim}>${(wage * roundsPerSeason).toLocaleString()}/año</Text>

      <Button
        primary
        onPress={() =>
          dispatch({
            type: "RESOLVE_CONTRACT",
            teamId: team.id,
            playerId: player.id,
            offeredYears: years,
            offeredWage: wage,
          })
        }
        style={{ marginTop: spacing.sm }}
      >
        Ofrecer contrato
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 6, letterSpacing: 0.6 },
  dim: { color: colors.textDim, fontSize: 12 },
  name: { color: colors.text, fontWeight: "800", fontSize: 14, marginBottom: 2 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginTop: spacing.sm, marginBottom: 4 },
  optionRow: { flexDirection: "row", gap: spacing.sm },
  optionBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBtnSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  optionText: { color: colors.text, fontWeight: "700" },
  optionTextSelected: { color: colors.accentText },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.accent, fontWeight: "800", fontSize: 18 },
  wageValue: { color: colors.text, fontWeight: "800", fontSize: 16, minWidth: 90, textAlign: "center" },
});
