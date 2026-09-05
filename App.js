import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Animated, Easing, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { GameProvider, useGame } from "./src/state/GameContext";
import TeamPicker from "./src/screens/TeamPicker";
import Dashboard from "./src/screens/Dashboard";
import RosterScreen from "./src/screens/RosterScreen";
import LeagueScreen from "./src/screens/LeagueScreen";
import TransferMarket from "./src/screens/TransferMarket";
import AcademyScreen from "./src/screens/AcademyScreen";
import StadiumScreen from "./src/screens/StadiumScreen";
import StaffScreen from "./src/screens/StaffScreen";
import FinanceScreen from "./src/screens/FinanceScreen";
import SponsorScreen from "./src/screens/SponsorScreen";
import ContractsScreen from "./src/screens/ContractsScreen";
import PyramidScreen from "./src/screens/PyramidScreen";
import MainMenu from "./src/screens/MainMenu";
import MatchResult from "./src/screens/MatchResult";
import TeamLogo from "./src/components/TeamLogo";
import { colors, spacing } from "./src/theme";

const QUADRANTS = [
  {
    header: "Clasificación",
    items: [
      { id: "league", label: "Liga" },
      { id: "pyramid", label: "Pirámide" },
    ],
  },
  {
    header: "Plantilla",
    items: [
      { id: "roster", label: "Plantilla" },
      { id: "academy", label: "Cantera" },
      { id: "contracts", label: "Contratos" },
    ],
  },
  { header: "Mercado", items: [{ id: "market", label: "Mercado" }] },
  {
    header: "Club",
    items: [
      { id: "stadium", label: "Estadio" },
      { id: "staff", label: "Personal" },
    ],
  },
  {
    header: "Finanzas",
    items: [
      { id: "finance", label: "Finanzas" },
      { id: "sponsor", label: "Publicidad" },
    ],
  },
];

const SCREEN_COMPONENTS = {
  roster: RosterScreen,
  league: LeagueScreen,
  market: TransferMarket,
  academy: AcademyScreen,
  stadium: StadiumScreen,
  staff: StaffScreen,
  finance: FinanceScreen,
  sponsor: SponsorScreen,
  contracts: ContractsScreen,
  pyramid: PyramidScreen,
};

function GameShell() {
  const { state } = useGame();
  const [screen, setScreen] = useState("home");
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [screen, fade]);

  if (!state.teamChosen) return <TeamPicker />;

  const team = state.teams.find((t) => t.id === state.userTeamId);
  const ActiveScreen = SCREEN_COMPONENTS[screen];
  const goHome = () => setScreen("home");

  return (
    <View style={styles.shell}>
      <View style={styles.topbar}>
        {screen === "home" ? (
          <View style={styles.titleRow}>
            <TeamLogo team={team} size={22} />
            <Text style={styles.title} numberOfLines={1}>
              PC BASKET — {team.name.toUpperCase()}
            </Text>
          </View>
        ) : (
          <Pressable onPress={goHome} style={styles.backBtn}>
            <Text style={styles.backText}>‹ VOLVER</Text>
          </Pressable>
        )}
        <View style={styles.topbarRight}>
          <Text style={styles.budget}>${team.budget.toLocaleString()}</Text>
          {screen === "home" && (
            <Pressable style={styles.menuBtn} onPress={() => setScreen("menu")}>
              <Text style={styles.menuText}>MENÚ</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={styles.accentLine} />
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}>
          {screen === "home" && <Dashboard quadrants={QUADRANTS} onNavigate={setScreen} />}
          {screen === "menu" && <MainMenu onDone={goHome} />}
          {screen === "result" && <MatchResult onContinue={goHome} />}
          {ActiveScreen && <ActiveScreen />}
          {screen === "home" && (
            <Text style={styles.footer}>
              Nombres de equipos y jugadores: Primera FEB 2025/26 (datos públicos de baloncestoenvivo.feb.es).
              Ratings de habilidad, economía y simulación son ficticios. Proyecto no oficial, sin ánimo de lucro.
            </Text>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Loading() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.loading}>
      <Animated.Image
        source={require("./assets/splash-icon.png")}
        style={[styles.loadingBall, { transform: [{ rotate }] }]}
      />
      <Text style={styles.loadingText}>CARGANDO…</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LinearGradient
        colors={[colors.bgGradientTop, colors.bgGradientBottom]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <StatusBar style="light" />
          <GameProvider loadingFallback={<Loading />}>
            <GameShell />
          </GameProvider>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  shell: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingBall: { width: 72, height: 72, marginBottom: spacing.lg },
  loadingText: { color: colors.textDim, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1, marginRight: spacing.sm },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    flexShrink: 1,
    letterSpacing: 0.5,
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  backText: { fontSize: 15, color: colors.accent, fontWeight: "700", letterSpacing: 0.5 },
  topbarRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  budget: { fontSize: 13, color: colors.accent, fontWeight: "700" },
  menuBtn: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  menuText: { color: colors.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  accentLine: { height: 3, backgroundColor: colors.accent },
  footer: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
