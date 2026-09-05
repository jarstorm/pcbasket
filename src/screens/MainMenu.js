import { View, Text, Alert, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import { colors, spacing } from "../theme";

export default function MainMenu({ onDone }) {
  const { dispatch, saveSnapshot, loadSnapshot } = useGame();

  const confirmNewGame = () => {
    Alert.alert(
      "Nueva partida",
      "Se generará una liga nueva y perderás el progreso actual. ¿Seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Nueva partida",
          style: "destructive",
          onPress: () => {
            dispatch({ type: "NEW_GAME" });
            onDone();
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    await saveSnapshot();
    Alert.alert("Partida guardada", "Se ha guardado un snapshot de la partida actual.");
  };

  const confirmLoad = () => {
    Alert.alert(
      "Cargar partida",
      "Se sustituirá el progreso actual por la última partida guardada. ¿Seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cargar",
          style: "destructive",
          onPress: async () => {
            const found = await loadSnapshot();
            if (found) onDone();
            else Alert.alert("Sin partida guardada", "Todavía no has guardado ninguna partida.");
          },
        },
      ]
    );
  };

  return (
    <View>
      <Card>
        <Text style={styles.h2}>Menú</Text>
        <Text style={styles.dim}>Gestiona tu partida.</Text>
        <Button primary onPress={handleSave} style={{ marginTop: spacing.sm }}>
          Guardar partida
        </Button>
        <Button onPress={confirmLoad} style={{ marginTop: spacing.sm }}>
          Cargar partida
        </Button>
        <Button onPress={confirmNewGame} style={{ marginTop: spacing.sm }}>
          Nueva partida
        </Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 },
  dim: { color: colors.textDim, fontSize: 13, marginBottom: spacing.sm },
});
