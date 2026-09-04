import { useState } from "react";
import { View, Text, Pressable, ScrollView, SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GameProvider, useGame } from "./src/state/GameContext";
import TeamPicker from "./src/screens/TeamPicker";
import Dashboard from "./src/screens/Dashboard";
import RosterScreen from "./src/screens/RosterScreen";
import LeagueScreen from "./src/screens/LeagueScreen";
import TransferMarket from "./src/screens/TransferMarket";
import AcademyScreen from "./src/screens/AcademyScreen";
import StadiumScreen from "./src/screens/StadiumScreen";
import { colors, spacing } from "./src/theme";

const TABS = [
  { id: "dashboard", label: "Resumen", Component: Dashboard },
  { id: "roster", label: "Plantilla", Component: RosterScreen },
  { id: "league", label: "Liga", Component: LeagueScreen },
  { id: "market", label: "Mercado", Component: TransferMarket },
  { id: "academy", label: "Cantera", Component: AcademyScreen },
  { id: "stadium", label: "Estadio", Component: StadiumScreen },
];

function GameShell() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState("dashboard");

  if (!state.teamChosen) return <TeamPicker />;

  const team = state.teams.find((t) => t.id === state.userTeamId);
  const ActiveComponent = TABS.find((t) => t.id === tab).Component;

  return (
    <View style={styles.shell}>
      <View style={styles.topbar}>
        <Text style={styles.title} numberOfLines={1}>
          PC Basket — {team.name}
        </Text>
        <View style={styles.topbarRight}>
          <Text style={styles.budget}>${team.budget.toLocaleString()}</Text>
          <Pressable style={styles.newGameBtn} onPress={() => dispatch({ type: "NEW_GAME" })}>
            <Text style={styles.newGameText}>Nueva</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ gap: 4 }}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}>
        <ActiveComponent />
        <Text style={styles.footer}>
          Nombres de equipos y jugadores: Primera FEB 2025/26 (datos públicos de baloncestoenvivo.feb.es).
          Ratings de habilidad, economía y simulación son ficticios. Proyecto no oficial, sin ánimo de lucro.
        </Text>
      </ScrollView>
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Cargando…</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <GameProvider loadingFallback={<Loading />}>
        <GameShell />
      </GameProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  loadingText: { color: colors.textDim, fontSize: 14 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, flexShrink: 1, marginRight: spacing.sm },
  topbarRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  budget: { fontSize: 13, color: colors.accent, fontWeight: "600" },
  newGameBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  newGameText: { color: colors.text, fontSize: 11 },
  tabs: {
    flexGrow: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabBtnActive: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.border,
  },
  tabText: { color: colors.text, fontSize: 13 },
  tabTextActive: { color: colors.accent },
  footer: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
