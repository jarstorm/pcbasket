# PC Basket Manager — Plan

## Estado actual (2026-09-05)

- **Proyecto único** (`pcbasket/`, Expo/React Native): app móvil funcional.
  **Pirámide completa de 3 divisiones** con ascensos y descensos (ver sección
  siguiente): ACB (ficticia), Primera FEB (17 equipos reales) y Segunda FEB (14
  equipos reales). Liga a doble vuelta, alineaciones (con cupo de extranjeros y
  penalización por jugar fuera de posición), mercado de fichajes (pool rotativo
  por jornada + poner tus jugadores en venta), cantera, personal técnico por
  roles (9 puestos, cada uno opcional con coste + sueldo), finanzas (sueldos,
  mantenimiento, patrocinio), forma física/lesiones (con recuperación), progresión
  de temporada (envejecimiento, retiro 35-40, renovación de contratos
  negociable), mejora de estadio, guardado con `AsyncStorage`, tests con Jest
  (`npm test`). Antes existía también una versión web (React + Vite) usada como
  prototipo — se fusionó en este proyecto y se eliminó; toda la lógica (`data/`,
  `engine/`, `state/GameContext`) vive ahora solo aquí. Probar con Expo Go en el
  móvil del usuario (decisión ya tomada: no se instala Android Studio/emulador en
  esta máquina).
- **Scripts de scraping** en `scripts/`:
  - `feb_scraper.py` / `segunda_feb_scraper.py` — descargan equipos + plantillas +
    stats reales de temporada desde `baloncestoenvivo.feb.es` (sin API oficial,
    HTML parseado con BeautifulSoup). Parámetros de competición: `GROUP`,
    `SEASON`, `NAME_SLUG` al principio de cada fichero (Primera FEB: `g=1`;
    Segunda FEB: `g=2`, hallado inspeccionando
    `competiciones.feb.es/estadisticas`).
  - `transform_ratings.py` / `transform_segunda_feb.py` — convierten stats reales
    en ratings 0-100 por percentiles dentro de cada división. Producen
    `feb_league_data.json` / `segunda_feb_league_data.json`, que consume
    `src/data/generate.js` (`generateRealLeague()` / `generateSegundaFebDivision()`).
  - `feb_primerafeb_2025_26_raw.json` / `segunda_feb_2025_26_raw.json` — cache de
    los datos crudos scrapeados (para no tener que re-scrapear si se toca solo el
    transform).
  - **ACB pendiente de scraper real**: `acb.com` es una app Next.js renderizada
    por cliente (sin tablas HTML ni API JSON accesible con peticiones simples),
    a diferencia de las páginas clásicas de `baloncestoenvivo.feb.es`. Por eso
    ACB usa plantillas **generadas** (`generateAcbDivision()` en
    `src/data/generate.js`) con ratings más altos que las divisiones inferiores,
    no datos reales. Si se quiere ACB real, hace falta un scraper con navegador
    headless (Playwright/Puppeteer) — no viable con las herramientas usadas para
    FEB.

**Aviso legal:** datos de equipos/jugadores son públicos (`baloncestoenvivo.feb.es`,
sin `robots.txt` restrictivo), pero el aviso legal de FEB reserva derechos sobre su
contenido. Uso actual: proyecto personal, no comercial, no publicado. Si algún día se
publica en una tienda de apps, revisar si hace falta permiso o quitar nombres reales.

---

## Pirámide de ligas — cómo quedó implementada

Arquitectura elegida (más simple que el `state.divisions[]` planteado
originalmente más abajo, para no reescribir toda la app): `state.teams` /
`state.playersById` / `state.schedule` / `state.round` siguen siendo **la
división activa** (la que gestiona el usuario) exactamente como antes — cero
cambios en pantallas existentes. Se añade `state.activeDivisionId` y
`state.otherDivisions` (las dos divisiones de fondo), todas con la misma forma
completa (equipos + jugadores + calendario), simuladas con el mismo motor
(`simulateMatch`) pero sin boxscore/finanzas/lesiones detalladas para los
equipos de fondo (`src/engine/pyramid.js` → `simulateBackgroundRound`).

Al terminar la temporada de la división activa: `resolvePyramid()` calcula
ascenso/descenso en **ambos** límites (ACB↔Primera FEB, Primera FEB↔Segunda
FEB) a la vez a partir de la clasificación original de las 3 (no en cascada,
para que un equipo no pueda subir y bajar en la misma transición), sube 1 y
baja 1 por límite, y arranca las 3 con calendario nuevo y récord a cero. Si el
equipo del usuario asciende o desciende, `state.activeDivisionId` cambia solo
y el aviso sale en el log. Pantalla `PyramidScreen.js` con pestañas ACB/Primera
FEB/Segunda FEB.

**Simplificado respecto al fútbol/baloncesto real:** 1 ascenso + 1 descenso por
límite (no 2), sin playoffs de ascenso — swap directo por posición en la tabla.
