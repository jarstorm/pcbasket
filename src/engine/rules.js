// Mirrors FEB's Reglamento General Art. 20.2.a: only players who are neither
// Spanish nor nationals of an EU/EEA state count against the "extranjeros"
// quota (max 2 non-EU/EEA starters) — an EU/EEA player moves as freely as a
// Spanish one and isn't a foreigner for this rule, even though their
// nationality field obviously isn't "España".
export const FOREIGN_PLAYER_QUOTA = 2;

function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// The real player data's nationality strings are messy (accents dropped or
// doubled, alternate spellings) — normalized here so e.g. "Bélgica" and
// "Belgica" both match. Includes the EU's 27 members plus Norway, Iceland
// and Liechtenstein (the rest of the EEA) — the UK is deliberately absent
// post-Brexit.
const EU_EEA_NATIONALITIES = new Set(
  [
    "Alemania", "Austria", "Bélgica", "Belgica", "Bulgaria", "Chipre", "Croacia", "Dinamarca",
    "Eslovaquia", "Eslovenia", "España", "Estonia", "Finlandia", "Francia", "Grecia",
    "Hungría", "Hungria", "Irlanda", "Italia", "Letonia", "Lituania", "Luxemburgo", "Malta",
    "Países Bajos", "Paises Bajos", "Polonia", "Portugal", "Rumanía", "Rumania", "Suecia",
    "Chequia", "R. Checa", "República Checa", "Republica Checa",
    "Noruega", "Islandia", "Liechtenstein",
  ].map(normalize)
);

export function isForeign(player) {
  if (!player?.nationality) return false;
  return !EU_EEA_NATIONALITIES.has(normalize(player.nationality));
}
