import { View, Text, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Select from "../components/Select";
import { OFFENSE_TACTICS, DEFENSE_TACTICS, offenseTacticBonus, defenseTacticBonus } from "../engine/simulate";
import { offenseCoachTierIndex, defenseCoachTierIndex } from "../engine/staff";
import { colors, spacing } from "../theme";
import SectionHeader from "../components/SectionHeader";

// Ranks the candidate tactics for this exact starting five, using the same
// bonus formula the match simulation applies — the hint is never a guess,
// it's just how much of it the coach's tier lets through to the user.
function rankTactics(candidates, team, playersById, scoreFn) {
  return candidates
    .map((t) => ({ id: t.id, label: t.label, score: scoreFn(team, playersById, t.id) }))
    .sort((a, b) => b.score - a.score);
}

// Mirrors renewalInsight's tiered reveal in ContractsScreen: Élite names the
// exact best pick, Avanzado narrows it down by ruling out the two worst,
// Básico only rules out the single worst one.
function coachHint(tierIndex, ranked) {
  if (tierIndex === null) return null;
  if (tierIndex === 2) return `Con este quinteto rinde mejor: ${ranked[0].label}.`;
  if (tierIndex === 1) return `Con este quinteto no van bien: ${ranked[1].label} y ${ranked[2].label}.`;
  return `Con este quinteto no va bien: ${ranked[2].label}.`;
}

function TacticCard({ title, roleLabel, value, options, ranked, tierIndex, onChange, desc }) {
  const hint = coachHint(tierIndex, ranked);
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      <Select value={value} options={options} onChange={onChange} />
      <Text style={styles.tacticDesc}>{desc}</Text>
      {hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : (
        <Text style={styles.hintMissing}>Contrata un {roleLabel} en Personal para saber qué táctica rinde mejor con tu quinteto.</Text>
      )}
    </Card>
  );
}

export default function TacticsScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);

  const offenseTierIndex = offenseCoachTierIndex(team.staff);
  const defenseTierIndex = defenseCoachTierIndex(team.staff);

  const offenseRanked = rankTactics(Object.values(OFFENSE_TACTICS), team, state.playersById, offenseTacticBonus);
  const defenseRanked = rankTactics(Object.values(DEFENSE_TACTICS), team, state.playersById, defenseTacticBonus);

  return (
    <View>
      <TacticCard
        title="TÁCTICA DE ATAQUE"
        roleLabel="Entrenador de Ataque"
        value={team.tactics?.offense || "balanced"}
        options={Object.values(OFFENSE_TACTICS).map((t) => ({ label: t.label, value: t.id }))}
        ranked={offenseRanked}
        tierIndex={offenseTierIndex}
        onChange={(value) => dispatch({ type: "SET_TACTIC", teamId: team.id, kind: "offense", value })}
        desc={OFFENSE_TACTICS[team.tactics?.offense || "balanced"].desc}
      />
      <TacticCard
        title="TÁCTICA DE DEFENSA"
        roleLabel="Entrenador de Defensa"
        value={team.tactics?.defense || "man"}
        options={Object.values(DEFENSE_TACTICS).map((t) => ({ label: t.label, value: t.id }))}
        ranked={defenseRanked}
        tierIndex={defenseTierIndex}
        onChange={(value) => dispatch({ type: "SET_TACTIC", teamId: team.id, kind: "defense", value })}
        desc={DEFENSE_TACTICS[team.tactics?.defense || "man"].desc}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tacticDesc: { color: colors.textDim, fontSize: 11, marginTop: spacing.sm },
  hint: { color: colors.accent, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  hintMissing: { color: colors.textDim, fontSize: 11, marginTop: spacing.sm, fontStyle: "italic" },
});
