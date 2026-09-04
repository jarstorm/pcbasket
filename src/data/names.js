export const FIRST_NAMES = [
  "Marcus", "Jalen", "Devon", "Tyrell", "Isaiah", "Xavier", "Malik", "Andre",
  "DeShawn", "Cody", "Trey", "Jordan", "Kobe", "Lamar", "Reggie", "Darius",
  "Elijah", "Terrence", "Kevin", "Chris", "Antonio", "Bryce", "Julian", "Dwayne",
  "Marco", "Luka", "Nikola", "Dario", "Goran", "Ivan", "Mateo", "Rafael",
  "Diego", "Santiago", "Bruno", "Gael", "Yusuf", "Amir", "Kai", "Ryo",
];

export const LAST_NAMES = [
  "Carter", "Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore",
  "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
  "Robinson", "Clark", "Rodriguez", "Lewis", "Walker", "Hall", "Allen", "Young",
  "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
  "Adams", "Nelson", "Baker", "Rivera", "Campbell", "Mitchell", "Roberts", "Turner",
];

export const CITIES = [
  "Riverdale", "Oakport", "Sunfield", "Ironvale", "Westbrook", "Crestwood",
  "Highgate", "Millbrook", "Stoneridge", "Fairhaven", "Redwood", "Bayshore",
];

export const TEAM_NICKNAMES = [
  "Hawks", "Wolves", "Comets", "Titans", "Vipers", "Blazers",
  "Falcons", "Bears", "Sharks", "Storm", "Knights", "Rhinos",
];

export function randomName(rng = Math.random) {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${first} ${last}`;
}
