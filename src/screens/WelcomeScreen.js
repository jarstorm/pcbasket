import { View, Text, Alert, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Button from "../components/Button";
import { colors, spacing } from "../theme";

// Shown before any team is picked — first launch, or right after "Nueva
// partida" from the menu. Offers a clean start or loading a save file the
// user already has on their phone, instead of jumping straight into team
// selection every time.
export default function WelcomeScreen({ onNewGame }) {
  const { importFromFile } = useGame();

  const handleLoad = async () => {
    const result = await importFromFile();
    if (!result.ok && result.reason === "invalid") {
      Alert.alert("Fichero no válido", "Ese fichero no es una partida de PC Basket Manager.");
    }
    // On success the loaded state's own teamChosen flag decides what shows
    // next — nothing else to do here.
  };

  return (
    <View style={styles.shell}>
      <Text style={styles.title}>PC Basket Manager</Text>
      <Text style={styles.subtitle}>Gestiona tu club de baloncesto desde Tercera FEB hasta la ACB.</Text>
      <Button primary onPress={onNewGame} style={{ marginTop: spacing.xl }}>
        Comenzar partida
      </Button>
      <Button onPress={handleLoad} style={{ marginTop: spacing.sm }}>
        Cargar partida desde fichero
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, textAlign: "center" },
  subtitle: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
