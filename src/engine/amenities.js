// Stadium amenities: progressive, 5 levels each, no recurring wage (upkeep
// is already folded into stadiumMaintenance's capacity/level base). Every
// level nudges both attendance and how much ticket price fans will
// tolerate — there's no separate "fan experience" stat, per design: any
// improvement should draw more people and let them be charged more.
const MAX_LEVEL = 5;
const COST_MULT = [1, 1.8, 3, 4.5, 6.5];
const EFFECT_MULT = [1, 1.8, 2.6, 3.4, 4.2];

export const AMENITIES = [
  {
    id: "shops",
    label: "Tiendas",
    costFactor: 0.25,
    attendanceBonus: 0.02,
    priceTolerance: 4,
    tierNames: ["Puesto pequeño", "Tienda", "Tienda oficial", "Flagship store", "Megastore del club"],
  },
  {
    id: "restaurants",
    label: "Restaurantes",
    costFactor: 0.4,
    attendanceBonus: 0.03,
    priceTolerance: 8,
    tierNames: ["Bocadillos", "Perritos calientes", "Pizzas", "Restaurante gourmet", "Zona VIP gastronómica"],
  },
  {
    id: "bars",
    label: "Bares",
    costFactor: 0.25,
    attendanceBonus: 0.02,
    priceTolerance: 4,
    tierNames: ["Barra básica", "Barra amplia", "Coctelería", "Barra premium", "Sky bar"],
  },
  {
    id: "stands",
    label: "Gradas",
    costFactor: 0.5,
    attendanceBonus: 0.04,
    priceTolerance: 8,
    tierNames: ["Gradas básicas", "Asientos numerados", "Asientos acolchados", "Zona VIP", "Palcos de lujo"],
  },
  {
    id: "cheerleaders",
    label: "Animadoras",
    costFactor: 0.2,
    attendanceBonus: 0.03,
    priceTolerance: 3,
    tierNames: ["Animadoras amateur", "Cuerpo de baile", "Coreografías", "Producción profesional", "Show de nivel NBA"],
  },
  {
    id: "shows",
    label: "Espectáculos",
    costFactor: 0.35,
    attendanceBonus: 0.03,
    priceTolerance: 5,
    tierNames: ["DJ local", "Luces y sonido", "Pantalla gigante", "Show pre-partido", "Producción de entretenimiento total"],
  },
  {
    id: "lighting",
    label: "Iluminación",
    costFactor: 0.3,
    attendanceBonus: 0.02,
    priceTolerance: 6,
    tierNames: ["Iluminación básica", "Focos mejorados", "LED", "Iluminación para TV", "Iluminación de retransmisión internacional"],
  },
  {
    id: "lockerRoom",
    label: "Vestuarios",
    costFactor: 0.3,
    attendanceBonus: 0.02,
    priceTolerance: 4,
    tierNames: ["Vestuario básico", "Vestuario renovado", "Vestuario amplio", "Vestuario con spa", "Vestuario de élite"],
  },
  {
    id: "design",
    label: "Diseño",
    costFactor: 0.35,
    attendanceBonus: 0.02,
    priceTolerance: 6,
    tierNames: ["Pintura nueva", "Fachada renovada", "Diseño moderno", "Identidad visual completa", "Diseño icónico"],
  },
  {
    id: "bathrooms",
    label: "Baños",
    costFactor: 0.2,
    attendanceBonus: 0.02,
    priceTolerance: 3,
    tierNames: ["Baños básicos", "Más aseos", "Aseos renovados", "Aseos premium", "Aseos de lujo"],
  },
  {
    id: "entrances",
    label: "Entradas",
    costFactor: 0.25,
    attendanceBonus: 0.02,
    priceTolerance: 4,
    tierNames: ["Accesos básicos", "Torniquetes", "Accesos rápidos", "Entrada VIP", "Accesos de última generación"],
  },
  {
    id: "parking",
    label: "Aparcamiento",
    costFactor: 0.3,
    attendanceBonus: 0.03,
    priceTolerance: 5,
    tierNames: ["Parking básico", "Más plazas", "Parking cubierto", "Parking VIP", "Parking valet"],
  },
  {
    id: "vipBox",
    label: "Palco VIP",
    costFactor: 0.45,
    attendanceBonus: 0.02,
    priceTolerance: 10,
    tierNames: ["Palco básico", "Palco reservado", "Palco con catering", "Palco VIP", "Palco presidencial"],
  },
  {
    id: "scoreboard",
    label: "Videomarcador",
    costFactor: 0.4,
    attendanceBonus: 0.03,
    priceTolerance: 5,
    tierNames: [
      "Marcador electrónico",
      "Videomarcador HD",
      "Videomarcador 4K",
      "Videomarcador de última generación",
      "Videomarcador tipo NBA",
    ],
  },
];

function levelOf(stadium, amenityId) {
  return stadium?.amenities?.[amenityId] || 0;
}

// Cost scales with stadium level (like getUpgradeTiers in stadium.js) and
// with how many levels of this amenity are already built.
export function getAmenityOptions(stadium) {
  const base = 150000 * stadium.level;
  return AMENITIES.map((a) => {
    const level = levelOf(stadium, a.id);
    const maxed = level >= MAX_LEVEL;
    return {
      id: a.id,
      label: a.label,
      level,
      maxed,
      currentTierName: level > 0 ? a.tierNames[level - 1] : null,
      nextTierName: maxed ? null : a.tierNames[level],
      cost: maxed ? null : Math.round(base * a.costFactor * COST_MULT[level]),
    };
  });
}

export function amenityAttendanceBonus(stadium) {
  return AMENITIES.reduce((sum, a) => {
    const level = levelOf(stadium, a.id);
    return sum + (level > 0 ? a.attendanceBonus * EFFECT_MULT[level - 1] : 0);
  }, 0);
}

export function amenityPriceTolerance(stadium) {
  return AMENITIES.reduce((sum, a) => {
    const level = levelOf(stadium, a.id);
    return sum + (level > 0 ? a.priceTolerance * EFFECT_MULT[level - 1] : 0);
  }, 0);
}
