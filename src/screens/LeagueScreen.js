import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Table from "../components/Table";
import { sortStandings } from "../engine/standings";
import { colors } from "../theme";

export default function LeagueScreen() {
  const { state } = useGame();

  const standings = sortStandings(state.teams);

  const rows = standings.map((t, i) => ({
    ...t,
    pos: i + 1,
    pj: t.record.wins + t.record.losses,
    diff: t.record.pointsFor - t.record.pointsAgainst,
  }));

  return (
    <Card>
      <Text style={styles.h2}>Clasificación</Text>
      <Text style={styles.dim}>
        Jornada {state.round} de {state.schedule.length}
      </Text>
      <Table
        columns={[
          { key: "pos", label: "#", width: 40 },
          { key: "name", label: "Equipo", width: 150 },
          { key: "pj", label: "PJ", width: 50 },
          { key: "wins", label: "V", width: 40, render: (t) => <Text style={styles.cellText}>{t.record.wins}</Text> },
          { key: "losses", label: "D", width: 40, render: (t) => <Text style={styles.cellText}>{t.record.losses}</Text> },
          { key: "pointsFor", label: "PF", width: 60, render: (t) => <Text style={styles.cellText}>{t.record.pointsFor}</Text> },
          { key: "pointsAgainst", label: "PC", width: 60, render: (t) => <Text style={styles.cellText}>{t.record.pointsAgainst}</Text> },
          {
            key: "diff",
            label: "Dif",
            width: 60,
            render: (t) => <Text style={styles.cellText}>{t.diff > 0 ? `+${t.diff}` : t.diff}</Text>,
          },
        ]}
        data={rows}
        rowKey={(t) => t.id}
        rowStyle={(t) => (t.id === state.userTeamId ? styles.meRow : null)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 4 },
  dim: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  cellText: { color: colors.text, fontSize: 13 },
  meRow: { backgroundColor: "rgba(255, 122, 41, 0.08)" },
});
