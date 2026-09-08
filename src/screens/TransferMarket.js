import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import PlayerMarketCard from "../components/PlayerMarketCard";
import Select from "../components/Select";
import { POSITION_ORDER, POSITION_LABEL } from "../data/positions";
import { seededShuffle } from "../engine/random";
import { colors, spacing, radii } from "../theme";
import SectionHeader from "../components/SectionHeader";

const MARKET_POOL_SIZE = 40;

const POSITION_OPTIONS = [
  { label: "Todas las posiciones", value: "ALL" },
  ...POSITION_ORDER.map((p) => ({ label: POSITION_LABEL[p], value: p })),
];

const SORT_OPTIONS = [
  { label: "Ordenar por valoración", value: "overall" },
  { label: "Ordenar por precio", value: "value" },
];

export default function TransferMarket() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("overall");

  const teamNameById = useMemo(
    () => Object.fromEntries(state.teams.map((t) => [t.id, t.name])),
    [state.teams]
  );

  // A rotating random pool of listed players (seeded by jornada) instead of
  // literally every player in the league always being for sale. Restricted
  // to the active division — background divisions' teams aren't in
  // state.teams, so buying from them would silently fail.
  const marketPlayers = useMemo(() => {
    const divisionTeamIds = new Set(state.teams.map((t) => t.id));
    const eligible = Object.values(state.playersById).filter(
      (p) => p.teamId !== team.id && divisionTeamIds.has(p.teamId) && !p.isProspect && !p.retired
    );
    const pool = seededShuffle(eligible, state.round).slice(0, MARKET_POOL_SIZE);
    return pool
      .filter((p) => posFilter === "ALL" || p.position === posFilter)
      .sort((a, b) => (sortBy === "overall" ? b.overall - a.overall : a.value - b.value));
  }, [state.playersById, state.teams, state.round, team.id, posFilter, sortBy]);

  // Released or rejected-renewal players with no club — free to sign, no fee.
  const freeAgents = useMemo(() => {
    const pool = Object.values(state.playersById).filter(
      (p) => p.teamId === null && !p.isProspect && !p.retired
    );
    return pool
      .filter((p) => posFilter === "ALL" || p.position === posFilter)
      .sort((a, b) => (sortBy === "overall" ? b.overall - a.overall : a.value - b.value));
  }, [state.playersById, posFilter, sortBy]);

  const annualWage = (p) => p.wage * state.schedule.length;
  const pendingOffers = state.pendingOffers || [];

  return (
    <View>
      {pendingOffers.length > 0 && (
        <Card style={{ borderColor: colors.accent }}>
          <SectionHeader>OFERTAS RECIBIDAS</SectionHeader>
          {pendingOffers.map((offer) => {
            const player = state.playersById[offer.playerId];
            if (!player) return null;
            return (
              <View key={offer.id} style={styles.offerReceivedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerReceivedName}>{player.name}</Text>
                  <Text style={styles.dim}>
                    {teamNameById[offer.fromTeamId] || "Un equipo"} ofrece $
                    {offer.amount.toLocaleString()}
                  </Text>
                </View>
                <Button
                  primary
                  style={styles.offerBtn}
                  onPress={() => dispatch({ type: "RESOLVE_OFFER", offerId: offer.id, accept: true })}
                >
                  Aceptar
                </Button>
                <Button
                  style={[styles.offerBtn, styles.offerBtnReject]}
                  onPress={() => dispatch({ type: "RESOLVE_OFFER", offerId: offer.id, accept: false })}
                >
                  Rechazar
                </Button>
              </View>
            );
          })}
        </Card>
      )}

      <Card>
        <SectionHeader>Mercado de fichajes</SectionHeader>
        <Text style={styles.dim}>
          Presupuesto disponible: <Text style={[styles.bold, { color: colors.accent }]}>${team.budget.toLocaleString()}</Text>{" "}
          · Plantilla: {team.roster.length}/15
        </Text>

        <View style={styles.filters}>
          <Select value={posFilter} options={POSITION_OPTIONS} onChange={setPosFilter} />
          <Select value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} />
        </View>

        {marketPlayers.map((p) => (
          <MarketPlayerRow
            key={p.id}
            player={p}
            teamName={teamNameById[p.teamId]}
            team={team}
            dispatch={dispatch}
            annualWage={annualWage(p)}
          />
        ))}
      </Card>

      <Card>
        <SectionHeader>Agentes libres</SectionHeader>
        <Text style={styles.dim}>Sin equipo — se fichan gratis, solo pagas su salario.</Text>
        {freeAgents.length === 0 ? (
          <Text style={styles.dim}>No hay agentes libres disponibles ahora mismo.</Text>
        ) : (
          freeAgents.map((p) => (
            <PlayerMarketCard
              key={p.id}
              player={p}
              wageValue={annualWage(p)}
              disabled={team.roster.length >= 15}
              buyLabel="Fichar"
              onBuy={() => dispatch({ type: "SIGN_FREE_AGENT", teamId: team.id, playerId: p.id })}
            />
          ))
        )}
      </Card>
    </View>
  );
}

const OFFER_STEP = 5000;

function MarketPlayerRow({ player, teamName, team, dispatch, annualWage }) {
  const [offering, setOffering] = useState(false);
  const [amount, setAmount] = useState(Math.round(player.value * 0.8));

  return (
    <View style={{ marginBottom: spacing.sm + 1 }}>
      <PlayerMarketCard
        player={player}
        teamName={teamName}
        feeLabel="CLÁUSULA"
        feeValue={player.value}
        wageValue={annualWage}
        disabled={team.budget < player.value || team.roster.length >= 15}
        buyLabel="Fichar"
        onBuy={() => dispatch({ type: "BUY_PLAYER", buyerTeamId: team.id, playerId: player.id })}
      />
      {!offering ? (
        <Pressable onPress={() => setOffering(true)}>
          <Text style={styles.offerToggle}>Ofrecer menos de la cláusula</Text>
        </Pressable>
      ) : (
        <View style={styles.offerPanel}>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setAmount(Math.max(OFFER_STEP, amount - OFFER_STEP))}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.offerAmount}>${amount.toLocaleString()}</Text>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setAmount(Math.min(player.value, amount + OFFER_STEP))}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
          <Button
            primary
            disabled={team.budget < amount || team.roster.length >= 15}
            onPress={() => {
              dispatch({ type: "MAKE_OFFER", buyerTeamId: team.id, playerId: player.id, amount });
              setOffering(false);
            }}
          >
            Enviar oferta
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim, fontSize: 13, marginBottom: spacing.sm },
  bold: { fontWeight: "700" },
  filters: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  offerReceivedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  offerReceivedName: { color: colors.text, fontWeight: "700", fontSize: 13 },
  offerBtn: { paddingHorizontal: spacing.sm, marginBottom: 0 },
  offerBtnReject: { borderColor: colors.loss },
  offerToggle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  offerPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.accent, fontSize: 16, fontWeight: "800" },
  offerAmount: { color: colors.text, fontWeight: "800", fontSize: 14, minWidth: 80, textAlign: "center" },
});
