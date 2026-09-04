import { Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import { colors, spacing } from "../theme";

export default function StadiumScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const upgradeCost = 150000 * team.stadium.level;

  return (
    <Card>
      <Text style={styles.h2}>{team.stadium.name}</Text>
      <Text style={styles.p}>Nivel actual: <Text style={styles.bold}>{team.stadium.level}</Text></Text>
      <Text style={styles.p}>Capacidad: <Text style={styles.bold}>{team.stadium.capacity.toLocaleString()}</Text> asientos</Text>
      <Text style={styles.p}>Precio de entrada: <Text style={styles.bold}>${team.stadium.ticketPrice}</Text></Text>
      <Text style={styles.dim}>
        Cada partido en casa genera ingresos por taquilla proporcionales a capacidad y precio.
        Mejorar el estadio aumenta capacidad, precio de entrada y da una pequeña ventaja de local.
      </Text>
      <Text style={styles.p}>
        Coste de mejora al nivel {team.stadium.level + 1}:{" "}
        <Text style={[styles.bold, { color: colors.accent }]}>${upgradeCost.toLocaleString()}</Text>
      </Text>
      <Button primary disabled={team.budget < upgradeCost} onPress={() => dispatch({ type: "UPGRADE_STADIUM", teamId: team.id })}>
        Mejorar estadio
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 },
  p: { color: colors.text, fontSize: 14, marginVertical: 2 },
  dim: { color: colors.textDim, fontSize: 13, marginVertical: spacing.xs },
  bold: { fontWeight: "700" },
});
