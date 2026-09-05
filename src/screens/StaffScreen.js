import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useGame } from "../state/GameContext";
import Card from "../components/Card";
import Button from "../components/Button";
import { STAFF_ROLES, getRoleTiers, currentRoleTier, totalStaffWage } from "../engine/staff";
import { seededShuffle } from "../engine/random";
import { colors, spacing, radii } from "../theme";

// The three coaching roles decide the on-court simulation, so they're
// always hireable — only the support staff (physio, scout, etc.) rotates
// through a random subset each jornada, like the transfer market pool.
const COACHING_ROLE_IDS = ["headCoach", "offenseCoach", "defenseCoach"];
const ALL_ROLE_IDS = Object.keys(STAFF_ROLES);
const ROTATING_ROLE_IDS = ALL_ROLE_IDS.filter((id) => !COACHING_ROLE_IDS.includes(id));
const VISIBLE_ROTATING_COUNT = 3;

export default function StaffScreen() {
  const { state, dispatch } = useGame();
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const [openRole, setOpenRole] = useState(null);
  const [selectedTierByRole, setSelectedTierByRole] = useState({});

  // A role you've already hired never disappears just because it missed
  // this jornada's rotation draw, so you can still see/fire them.
  const available = new Set(seededShuffle(ROTATING_ROLE_IDS, state.round).slice(0, VISIBLE_ROTATING_COUNT));
  const ROLE_IDS = [
    ...COACHING_ROLE_IDS,
    ...ROTATING_ROLE_IDS.filter((id) => available.has(id) || team.staff[id]),
  ];

  return (
    <View>
      <Card>
        <Text style={styles.h2}>PERSONAL TÉCNICO</Text>
        <Text style={styles.dim}>
          Cada puesto es opcional — un equipo pequeño puede competir sin contratar nada. Cada
          contratación tiene un coste de fichaje y un sueldo por jornada. Para cambiar a alguien de
          puesto hay que despedirlo antes (indemnización: sueldo × jornadas de la temporada). No
          siempre hay candidatos disponibles para todos los puestos — varía cada jornada.
        </Text>
        <Text style={[styles.dim, { marginTop: spacing.xs }]}>
          Sueldo total de personal por jornada:{" "}
          <Text style={styles.bold}>${totalStaffWage(team.staff).toLocaleString()}</Text>
        </Text>
      </Card>

      {ROLE_IDS.map((roleId) => {
        const role = STAFF_ROLES[roleId];
        const current = currentRoleTier(team.staff, roleId);
        const availableTiers = getRoleTiers(team.staff, roleId);
        const isOpen = openRole === roleId;
        const selectedId = selectedTierByRole[roleId] ?? availableTiers[0]?.id;
        const selectedTier = availableTiers.find((t) => t.id === selectedId);

        return (
          <Card key={roleId}>
            <Pressable
              onPress={() => setOpenRole(isOpen ? null : roleId)}
              style={styles.roleHeader}
              disabled={!current && availableTiers.length === 0}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.roleLabel}>{role.label.toUpperCase()}</Text>
                <Text style={styles.roleDesc}>{role.desc}</Text>
                <Text style={styles.roleStatus}>
                  {current ? `${current.label} · $${current.wage.toLocaleString()}/jornada` : "Sin contratar"}
                </Text>
              </View>
            </Pressable>

            {current ? (
              <Button
                onPress={() => dispatch({ type: "FIRE_STAFF_ROLE", teamId: team.id, roleId })}
                style={{ marginTop: spacing.sm }}
              >
                Despedir (indemnización ${(current.wage * state.schedule.length).toLocaleString()})
              </Button>
            ) : (
              isOpen && (
                <View style={{ marginTop: spacing.sm }}>
                  {availableTiers.map((tier) => {
                    const isSelected = tier.id === selectedId;
                    const affordable = team.budget >= tier.hireCost;
                    return (
                      <Pressable
                        key={tier.id}
                        onPress={() => setSelectedTierByRole({ ...selectedTierByRole, [roleId]: tier.id })}
                        style={[styles.tierRow, isSelected && styles.tierRowSelected]}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tierLabel}>{tier.label}</Text>
                          <Text style={styles.tierDesc}>${tier.wage.toLocaleString()}/jornada</Text>
                        </View>
                        <Text style={[styles.tierCost, !affordable && styles.tierCostBad]}>
                          ${tier.hireCost.toLocaleString()}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Button
                    primary
                    disabled={!selectedTier || team.budget < selectedTier.hireCost}
                    onPress={() =>
                      dispatch({ type: "HIRE_STAFF_ROLE", teamId: team.id, roleId, tierId: selectedId })
                    }
                  >
                    Contratar
                  </Button>
                </View>
              )
            )}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 8, letterSpacing: 0.6 },
  dim: { color: colors.textDim, fontSize: 12 },
  bold: { fontWeight: "800", color: colors.text },
  roleHeader: { flexDirection: "row" },
  roleLabel: { fontSize: 13, fontWeight: "800", color: colors.text, letterSpacing: 0.5 },
  roleDesc: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  roleStatus: { fontSize: 12, color: colors.accent, fontWeight: "700", marginTop: 4 },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  tierRowSelected: { borderColor: colors.accent, backgroundColor: colors.panelAlt },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkboxMark: { color: colors.accentText, fontWeight: "800", fontSize: 13 },
  tierLabel: { color: colors.text, fontWeight: "700", fontSize: 13 },
  tierDesc: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  tierCost: { color: colors.accent, fontWeight: "800", fontSize: 13 },
  tierCostBad: { color: colors.loss },
});
