import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import { getJerseySponsorOffers, getStadiumSponsorOffers, tvRightsIncome } from "../engine/finance";
import { leaguePosition } from "../engine/standings";
import { DIVISION_META } from "../engine/pyramid";
import { colors, spacing, radii } from "../theme";
import SectionHeader from "../components/SectionHeader";

function OfferList({ title, offers, current, onSelect }) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {offers.map((offer) => {
        const isCurrent = current?.id === offer.id;
        return (
          <Pressable
            key={offer.id}
            onPress={() => onSelect(offer.id)}
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
  );
}

export default function SponsorScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const position = leaguePosition(team, state.teams);
  const jerseyOffers = getJerseySponsorOffers(team, state.teams);
  const stadiumOffers = getStadiumSponsorOffers(team, state.teams);
  const tvIncome = tvRightsIncome(state.activeDivisionId, team, state.teams);
  const divisionName = DIVISION_META[state.activeDivisionId]?.name || state.activeDivisionId;

  return (
    <View>
      <Card>
        <SectionHeader>PUBLICIDAD E INGRESOS DE MEDIA</SectionHeader>
        <Text style={styles.dim}>
          Posición actual en la liga: #{position}. Los mejores patrocinadores solo firman con
          equipos arriba en la clasificación.
        </Text>
      </Card>

      <Card>
        <SectionHeader>DERECHOS DE TV</SectionHeader>
        <Text style={styles.dim}>
          Automáticos, según división ({divisionName}) y posición — no se eligen, suben si mejoras
          en la tabla o asciendes de categoría.
        </Text>
        <Text style={styles.tvIncome}>+${tvIncome.toLocaleString()}/jornada</Text>
      </Card>

      <OfferList
        title="PATROCINADOR DE CAMISETA"
        offers={jerseyOffers}
        current={team.sponsors?.jersey}
        onSelect={(sponsorId) => dispatch({ type: "SELECT_SPONSOR", teamId: team.id, slot: "jersey", sponsorId })}
      />

      <OfferList
        title="PATROCINADOR DE ESTADIO"
        offers={stadiumOffers}
        current={team.sponsors?.stadium}
        onSelect={(sponsorId) => dispatch({ type: "SELECT_SPONSOR", teamId: team.id, slot: "stadium", sponsorId })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 8, letterSpacing: 0.6 },
  dim: { color: colors.textDim, fontSize: 12 },
  tvIncome: { color: colors.win, fontWeight: "800", fontSize: 18, marginTop: spacing.sm },
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
