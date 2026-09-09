import { View, Text, Alert, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import { colors, spacing } from "../theme";
import SectionHeader from "../components/SectionHeader";

export default function MainMenu({ onDone }) {
  const { dispatch, saveSnapshot, loadSnapshot, exportToFile, importFromFile } = useGame();

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

  const handleExport = async () => {
    try {
      await exportToFile();
    } catch (e) {
      Alert.alert("No se pudo exportar", "Inténtalo de nuevo.");
    }
  };

  const confirmImport = () => {
    Alert.alert(
      "Cargar partida desde fichero",
      "Se sustituirá el progreso actual por el fichero que elijas. ¿Seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Elegir fichero",
          style: "destructive",
          onPress: async () => {
            const result = await importFromFile();
            if (result.ok) onDone();
            else if (result.reason === "invalid") {
              Alert.alert("Fichero no válido", "Ese fichero no es una partida de PC Basket Manager.");
            }
          },
        },
      ]
    );
  };

  return (
    <View>
      <Card>
        <SectionHeader>Menú</SectionHeader>
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

      <Card>
        <SectionHeader>Fichero de partida</SectionHeader>
        <Text style={styles.dim}>Guarda una copia en tu móvil o carga una partida desde un fichero.</Text>
        <Button onPress={handleExport} style={{ marginTop: spacing.sm }}>
          Exportar a fichero
        </Button>
        <Button onPress={confirmImport} style={{ marginTop: spacing.sm }}>
          Cargar desde fichero
        </Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 },
  dim: { color: colors.textDim, fontSize: 13, marginBottom: spacing.sm },
});
