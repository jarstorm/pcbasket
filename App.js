import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Animated, Easing, ImageBackground, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { GameProvider, useGame, findTeamAnywhere } from "./src/state/GameContext";
import { MusicProvider, useMusic } from "./src/state/MusicContext";
import TeamPicker from "./src/screens/TeamPicker";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import Dashboard from "./src/screens/Dashboard";
import RosterScreen from "./src/screens/RosterScreen";
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
import SeasonSummaryScreen from "./src/screens/SeasonSummaryScreen";
import PlayerDetailScreen from "./src/screens/PlayerDetailScreen";
import TeamRosterScreen from "./src/screens/TeamRosterScreen";
import TeamLogo from "./src/components/TeamLogo";
import BottomNav from "./src/components/BottomNav";
import Icon from "./src/components/Icon";
import { colors, spacing, radii } from "./src/theme";

// Bottom nav groups related screens under one tab; a tab with more than one
// screen shows its own pill sub-nav under the topbar (see HubTabs below).
const HUBS = {
  standings: {
    label: "Clasificación",
    icon: "emoji-events",
    screens: [{ id: "pyramid", label: "Liga" }],
  },
  roster: {
    label: "Plantilla",
    icon: "groups",
    screens: [
      { id: "roster", label: "Plantilla" },
      { id: "academy", label: "Cantera" },
      { id: "contracts", label: "Contratos" },
    ],
  },
  management: {
    label: "Gestiones",
    icon: "build",
    screens: [
      { id: "market", label: "Mercado" },
      { id: "stadium", label: "Estadio" },
      { id: "staff", label: "Personal" },
    ],
  },
  finance: {
    label: "Finanzas",
    icon: "payments",
    screens: [
      { id: "finance", label: "Finanzas" },
      { id: "sponsor", label: "Publicidad" },
    ],
  },
};

const BOTTOM_TABS = [
  { id: "standings", label: HUBS.standings.label, icon: HUBS.standings.icon },
  { id: "roster", label: HUBS.roster.label, icon: HUBS.roster.icon },
  { id: "home", label: "Home", icon: "home" },
  { id: "management", label: HUBS.management.label, icon: HUBS.management.icon },
  { id: "finance", label: HUBS.finance.label, icon: HUBS.finance.icon },
];

const LEAF_TO_HUB = Object.fromEntries(
  Object.entries(HUBS).flatMap(([hubId, hub]) => hub.screens.map((s) => [s.id, hubId]))
);

const SCREEN_COMPONENTS = {
  market: TransferMarket,
  academy: AcademyScreen,
  stadium: StadiumScreen,
  staff: StaffScreen,
  finance: FinanceScreen,
  sponsor: SponsorScreen,
  contracts: ContractsScreen,
};

function MusicToggle() {
  const music = useMusic();
  if (!music) return null;
  return (
    <Pressable style={styles.menuBtn} onPress={music.toggleMute}>
      <Icon name={music.muted ? "volume-off" : "volume-up"} size={18} color={colors.text} />
    </Pressable>
  );
}

function HubTabs({ hub, activeId, onSelect }) {
  if (hub.screens.length < 2) return null;
  return (
    <View style={styles.hubTabRow}>
      {hub.screens.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onSelect(s.id)}
          style={[styles.hubTabBtn, s.id === activeId && styles.hubTabBtnActive]}
        >
          <Text style={[styles.hubTabText, s.id === activeId && styles.hubTabTextActive]}>
            {s.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function GameShell() {
  const { state } = useGame();
  const [screen, setScreen] = useState("home");
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const openPlayer = (playerId) => {
    setSelectedPlayerId(playerId);
    setScreen("player");
  };
  const openTeam = (teamId) => {
    setSelectedTeamId(teamId);
    setScreen("teamRoster");
  };

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [screen, fade]);

  if (!state.teamChosen) {
    return showPicker ? <TeamPicker /> : <WelcomeScreen onNewGame={() => setShowPicker(true)} />;
  }

  const team = state.teams.find((t) => t.id === state.userTeamId);
  const ActiveScreen = SCREEN_COMPONENTS[screen];
  const goHome = () => setScreen("home");

  const hubId = LEAF_TO_HUB[screen];
  const hub = hubId ? HUBS[hubId] : null;
  const showBack =
    screen === "menu" ||
    screen === "result" ||
    screen === "seasonSummary" ||
    screen === "player" ||
    screen === "teamRoster";
  const activeTab = hubId || (screen === "home" ? "home" : null);
  const selectedPlayer = screen === "player" ? state.playersById[selectedPlayerId] : null;
  const selectedTeam = screen === "teamRoster" ? findTeamAnywhere(state, selectedTeamId) : null;

  const title =
    screen === "menu"
      ? "MENÚ"
      : screen === "result"
      ? "RESULTADO"
      : screen === "seasonSummary"
      ? "TEMPORADA"
      : screen === "teamRoster"
      ? selectedTeam?.name.toUpperCase() || "PLANTILLA"
      : screen === "player"
      ? selectedPlayer?.name.toUpperCase() || "FICHA"
      : hub
      ? hub.label.toUpperCase()
      : null;

  return (
    <View style={styles.shell}>
      <View style={styles.topbar}>
        {screen === "home" ? (
          <View style={styles.titleRow}>
            <TeamLogo team={team} size={22} />
            <Text style={styles.title} numberOfLines={1}>
              {team.name.toUpperCase()}
            </Text>
          </View>
        ) : showBack ? (
          <Pressable onPress={goHome} style={styles.backBtn}>
            <Text style={styles.backText}>‹ VOLVER</Text>
          </Pressable>
        ) : (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        )}
        <View style={styles.topbarRight}>
          <Text style={styles.budget}>€{team.budget.toLocaleString()}</Text>
          <MusicToggle />
          {screen !== "menu" && (
            <Pressable style={styles.menuBtn} onPress={() => setScreen("menu")}>
              <Icon name="menu" size={18} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>
      <LinearGradient
        colors={[colors.accentDim, colors.accent, colors.accentDim]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />
      {hub && <HubTabs hub={hub} activeId={screen} onSelect={setScreen} />}
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}>
          {screen === "home" && <Dashboard onNavigate={setScreen} />}
          {screen === "menu" && <MainMenu onDone={goHome} />}
          {screen === "result" && <MatchResult onContinue={goHome} />}
          {screen === "seasonSummary" && <SeasonSummaryScreen onContinue={goHome} />}
          {screen === "roster" && <RosterScreen onOpenPlayer={openPlayer} />}
          {screen === "player" && <PlayerDetailScreen player={selectedPlayer} />}
          {screen === "pyramid" && <PyramidScreen onOpenTeam={openTeam} />}
          {screen === "teamRoster" && <TeamRosterScreen team={selectedTeam} onOpenPlayer={openPlayer} />}
          {ActiveScreen && <ActiveScreen />}
          {screen === "home" && (
            <Text style={styles.footer}>
              Nombres de equipos y jugadores: Primera FEB 2025/26 (datos públicos de baloncestoenvivo.feb.es).
              Ratings de habilidad, economía y simulación son ficticios. Proyecto no oficial, sin ánimo de lucro.
              Música: Geomancer, jkjkke e isaiah658 (CC0, opengameart.org).
            </Text>
          )}
        </ScrollView>
      </Animated.View>
      <BottomNav
        tabs={BOTTOM_TABS}
        activeId={activeTab}
        onSelect={(id) => setScreen(id === "home" ? "home" : HUBS[id].screens[0].id)}
      />
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
        <ImageBackground
          source={require("./assets/court-texture.png")}
          resizeMode="repeat"
          style={styles.safe}
        >
          <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            <GameProvider loadingFallback={<Loading />}>
              <MusicProvider>
                <GameShell />
              </MusicProvider>
            </GameProvider>
          </SafeAreaView>
        </ImageBackground>
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
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  accentLine: { height: 3, backgroundColor: colors.accent },
  hubTabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  hubTabBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs + 2,
    alignItems: "center",
  },
  hubTabBtnActive: { borderColor: colors.accent, backgroundColor: colors.panelAlt },
  hubTabText: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
  hubTabTextActive: { color: colors.accent },
  footer: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
