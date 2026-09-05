import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import { getSponsorOffers } from "../engine/finance";
import { leaguePosition } from "../engine/standings";
import { colors, spacing, radii } from "../theme";

export default function SponsorScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const position = leaguePosition(team, state.teams);
  const offers = getSponsorOffers(team, state.teams);

  return (
    <View>
      <Card>
        <Text style={styles.h2}>PUBLICIDAD</Text>
        <Text style={styles.dim}>
          Posición actual en la liga: #{position}. Los mejores patrocinadores solo firman con
          equipos arriba en la clasificación.
        </Text>
      </Card>

      <Card>
        <Text style={styles.h2}>OFERTAS DISPONIBLES</Text>
        {offers.map((offer) => {
          const isCurrent = team.sponsor?.id === offer.id;
          return (
            <Pressable
              key={offer.id}
              onPress={() => dispatch({ type: "SELECT_SPONSOR", teamId: team.id, sponsorId: offer.id })}
              style={[styles.offerRow, isCurrent && styles.offerRowSelected]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.offerLabel}>{offer.label}</Text>
                {isCurrent && <Text style={styles.offerCurrent}>Patrocinador actual</Text>}
              </View>
              <Text style={styles.offerIncome}>+${offer.incomePerRound.toLocaleString()}/jornada</Text>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 8, letterSpacing: 0.6 },
  dim: { color: colors.textDim, fontSize: 12 },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  offerRowSelected: { borderColor: colors.accent, backgroundColor: colors.panelAlt },
  offerLabel: { color: colors.text, fontWeight: "700", fontSize: 13 },
  offerCurrent: { color: colors.accent, fontSize: 11, fontWeight: "700", marginTop: 2 },
  offerIncome: { color: colors.win, fontWeight: "800", fontSize: 13 },
});
