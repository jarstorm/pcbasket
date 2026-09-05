import { Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import Table from "../components/Table";
import Button from "../components/Button";
import { POSITION_ABBR } from "../data/positions";
import { colors, spacing } from "../theme";
import SectionHeader from "../components/SectionHeader";

export default function AcademyScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const prospects = team.academy.map((id) => state.playersById[id]);

  return (
    <Card>
      <SectionHeader>Cantera</SectionHeader>
      <Text style={styles.dim}>
        Jóvenes promesas del club. Promociónalos al primer equipo cuando tengas hueco en la plantilla
        (máx. 15 jugadores).
      </Text>
      {!team.staff?.scout && (
        <Text style={styles.warning}>
          ⚠ Sin Ojeador y Cantera contratado no aparecen nuevos prospectos — contrátalo en Personal.
        </Text>
      )}
      {team.staff?.scout && team.scoutCooldown != null && team.scoutSearchTotal != null && (
        <Text style={styles.dim}>
          Ojeador buscando desde hace {Math.max(0, team.scoutSearchTotal - team.scoutCooldown)} jornada(s)
          (de unas {team.scoutSearchTotal}).
        </Text>
      )}
      {prospects.length === 0 && <Text style={styles.dim}>No hay prospectos disponibles.</Text>}
      <Table
        columns={[
          { key: "name", label: "Nombre", width: 150 },
          { key: "position", label: "Pos", width: 60, render: (p) => <Text style={styles.cellText}>{POSITION_ABBR[p.position] || p.position}</Text> },
          { key: "age", label: "Edad", width: 60 },
          { key: "overall", label: "OVR actual", width: 90, render: (p) => <OvrBadge value={p.overall} /> },
          { key: "potential", label: "Potencial", width: 90, render: (p) => <OvrBadge value={p.potential} /> },
          {
            key: "promote",
            label: "",
            width: 110,
            render: (p) => (
              <Button
                primary
                disabled={team.roster.length >= 15}
                onPress={() => dispatch({ type: "PROMOTE_YOUTH", teamId: team.id, prospectId: p.id })}
              >
                Promocionar
              </Button>
            ),
          },
        ]}
        data={prospects}
        rowKey={(p) => p.id}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 },
  dim: { color: colors.textDim, fontSize: 13, marginBottom: spacing.sm },
  warning: { color: colors.accent, fontSize: 12, fontWeight: "700", marginBottom: spacing.sm },
  cellText: { color: colors.text, fontSize: 13 },
});
