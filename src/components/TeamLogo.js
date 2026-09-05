import { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors } from "../theme";

// Real teams (Primera FEB / Segunda FEB) keep the FEB numeric id embedded in
// their generated id ("feb979989" / "sfeb979989" — see scripts/transform_*.py),
// which doubles as the team's escudo id on FEB's image host. ACB is a
// fictional division with no such id, so it always falls back to the badge.
function realLogoUrl(teamId) {
  const match = /^(s?feb)(\d+)$/.exec(teamId);
  if (!match) return null;
  return `https://imagenes.feb.es/Imagen.aspx?i=${match[2]}&ti=1`;
}

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(name) {
  const words = name.split(" ").filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function TeamLogo({ team, size = 32 }) {
  const [failed, setFailed] = useState(false);
  const url = realLogoUrl(team.id);
  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.image, dim]}
        onError={() => setFailed(true)}
      />
    );
  }

  const hue = hashHue(team.id);
  return (
    <View style={[styles.badge, dim, { backgroundColor: `hsl(${hue}, 55%, 28%)` }]}>
      <Text style={[styles.badgeText, { fontSize: size * 0.38 }]}>{initials(team.name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.panelAlt },
  badge: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  badgeText: { color: colors.text, fontWeight: "800" },
});
