# PC Basket Manager

App móvil (Expo/React Native) de gestión de baloncesto. Liga real de **Primera FEB
2025/26** (17 equipos, jugadores reales), con simulación de partidos, mercado de
fichajes, cantera y mejora de estadio. Ratings de habilidad, economía y simulación
son ficticios. Proyecto no oficial, sin ánimo de lucro.

Ver `PLAN.md` para el roadmap (pirámide de divisiones ACB/Primera FEB/Segunda FEB
con ascensos y descensos).

## Arrancar

```
npm install
npm start
```

Abre la app con Expo Go escaneando el QR (`npm run android` / `npm run ios` / `npm run web` para plataformas concretas).

## Estructura

- `src/state/GameContext.js` — estado global del juego (reducer + persistencia con `AsyncStorage`).
- `src/engine/` — simulación de partidos y generación de calendario.
- `src/data/` — generación de la liga a partir de `feb_league_data.json`.
- `src/screens/` — las 6 pantallas del juego (Resumen, Plantilla, Liga, Mercado, Cantera, Estadio).
- `src/components/` — piezas de UI reutilizables (Card, Table, Select, Button, etc.).
- `scripts/` — scrapers en Python para regenerar `feb_league_data.json` desde `baloncestoenvivo.feb.es`.
