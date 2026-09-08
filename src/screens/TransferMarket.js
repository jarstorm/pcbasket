import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import PlayerMarketCard from "../components/PlayerMarketCard";
import Select from "../components/Select";
import { POSITION_ORDER, POSITION_LABEL } from "../data/positions";
import { seededShuffle } from "../engine/random";
import { canRealisticallySign } from "../engine/transfers";
import { DIVISION_META } from "../engine/pyramid";
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

// Only tags the team name with its division when it differs from the one
// the user is currently playing in — a cross-league signing, so it's clear
// at a glance why that player is on the market at all.
function marketTeamLabel(player, teamNameById, teamDivisionById, activeDivisionId) {
  const name = teamNameById[player.teamId] || "";
  const divisionId = teamDivisionById[player.teamId];
  if (!divisionId || divisionId === activeDivisionId) return name;
  const divisionName = DIVISION_META[divisionId]?.name || divisionId;
  return `${name} · ${divisionName}`;
}

export default function TransferMarket() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("overall");

  // Every team across every division, active or simulated in the
  // background — needed so the market can offer (and label) players from
  // leagues the user isn't currently playing in.
  const { teamNameById, teamDivisionById } = useMemo(() => {
    const names = {};
    const divisions = {};
    for (const t of state.teams) {
      names[t.id] = t.name;
      divisions[t.id] = state.activeDivisionId;
    }
    for (const [divisionId, division] of Object.entries(state.otherDivisions)) {
      for (const group of division.groups || []) {
        for (const t of group.teams) {
          names[t.id] = t.name;
          divisions[t.id] = divisionId;
        }
      }
    }
    return { teamNameById: names, teamDivisionById: divisions };
  }, [state.teams, state.otherDivisions, state.activeDivisionId]);

  // A rotating random pool of listed players (seeded by jornada) instead of
  // literally every player in the league always being for sale — spans
  // every division, but gated to players who'd realistically consider
  // joining a club at this team's level (see canRealisticallySign).
  const marketPlayers = useMemo(() => {
    const eligible = Object.values(state.playersById).filter(
      (p) =>
        p.teamId &&
        p.teamId !== team.id &&
        !p.isProspect &&
        !p.retired &&
        canRealisticallySign(team, p, state.playersById)
    );
    // Divisions vary wildly in size (Tercera FEB alone dwarfs the other
    // three combined), so a flat random sample of the pool ends up almost
    // entirely same-division players once the user's team plays in the
    // biggest one. Shuffle each division separately and round-robin across
    // them instead, so every division with an eligible player gets a fair
    // shot at a market slot.
    const byDivision = {};
    for (const p of eligible) {
      const divId = teamDivisionById[p.teamId] || "unknown";
      (byDivision[divId] ??= []).push(p);
    }
    const divisionIds = Object.keys(byDivision);
    const shuffledByDivision = Object.fromEntries(
      divisionIds.map((id, i) => [id, seededShuffle(byDivision[id], state.round + i)])
    );
    const pool = [];
    for (let cursor = 0; pool.length < MARKET_POOL_SIZE; cursor++) {
      const before = pool.length;
      for (const id of divisionIds) {
        if (pool.length >= MARKET_POOL_SIZE) break;
        const p = shuffledByDivision[id][cursor];
        if (p) pool.push(p);
      }
      if (pool.length === before) break; // every division's shuffled list is exhausted
    }
    return pool
      .filter((p) => posFilter === "ALL" || p.position === posFilter)
      .sort((a, b) => (sortBy === "overall" ? b.overall - a.overall : a.value - b.value));
  }, [state.playersById, state.round, team, posFilter, sortBy, teamDivisionById]);

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
                    {teamNameById[offer.fromTeamId] || "Un equipo"} ofrece €
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
          Presupuesto disponible: <Text style={[styles.bold, { color: colors.accent }]}>€{team.budget.toLocaleString()}</Text>{" "}
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
            teamName={marketTeamLabel(p, teamNameById, teamDivisionById, state.activeDivisionId)}
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
        disabled={team.roster.length >= 15}
        buyLabel="Fichar"
        onBuy={() => setOffering(true)}
      />
      {offering && (
        <View style={styles.offerPanel}>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setAmount(Math.max(OFFER_STEP, amount - OFFER_STEP))}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.offerAmount}>€{amount.toLocaleString()}</Text>
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
