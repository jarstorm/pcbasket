import { Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import OvrBadge from "../components/OvrBadge";
import Table from "../components/Table";
import Button from "../components/Button";
import { colors, spacing } from "../theme";

export default function AcademyScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const prospects = team.academy.map((id) => state.playersById[id]);

  return (
    <Card>
      <Text style={styles.h2}>Cantera</Text>
      <Text style={styles.dim}>
        Jóvenes promesas del club. Promociónalos al primer equipo cuando tengas hueco en la plantilla
        (máx. 15 jugadores).
      </Text>
      {prospects.length === 0 && <Text style={styles.dim}>No hay prospectos disponibles.</Text>}
      <Table
        columns={[
          { key: "name", label: "Nombre", width: 150 },
          { key: "position", label: "Pos", width: 60 },
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
});
