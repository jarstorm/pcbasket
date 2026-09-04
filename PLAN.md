# PC Basket Manager — Plan

## Estado actual (2026-09-04)

- **Proyecto único** (`pcbasket/`, Expo/React Native): app móvil funcional. 17
  equipos reales de **Primera FEB 2025/26** con jugadores reales (nombre, posición,
  edad, nacionalidad, altura) y ratings de habilidad **inventados** a partir de sus
  estadísticas reales (ver `scripts/transform_ratings.py`). Liga a doble vuelta (34
  jornadas), alineaciones, mercado de fichajes, cantera (ficticia), mejora de
  estadio, guardado con `AsyncStorage`. Antes existía también una versión web
  (React + Vite) usada como prototipo — se fusionó en este proyecto y se eliminó;
  toda la lógica (`data/`, `engine/`, `state/GameContext`) vive ahora solo aquí.
  Probar con Expo Go en el móvil del usuario (decisión ya tomada: no se instala
  Android Studio/emulador en esta máquina).
- **Scripts de scraping** en `scripts/`:
  - `feb_scraper.py` — descarga equipos + plantillas + stats reales de temporada desde
    `baloncestoenvivo.feb.es` (sin API oficial, HTML parseado con BeautifulSoup).
    Parámetros de competición: `GROUP`, `SEASON`, `NAME_SLUG` al principio del fichero.
  - `transform_ratings.py` — convierte stats reales (puntos, %tiro, rebotes,
    asistencias, la "valoración" oficial VA, etc.) en ratings 0-100 por percentiles
    dentro de la liga. Produce `feb_league_data.json`, que consume
    `src/data/generate.js` → `generateRealLeague()`.
  - `feb_primerafeb_2025_26_raw.json` — cache de los datos crudos scrapeados (para no
    tener que re-scrapear si se toca solo el transform).

**Aviso legal:** datos de equipos/jugadores son públicos (`baloncestoenvivo.feb.es`,
sin `robots.txt` restrictivo), pero el aviso legal de FEB reserva derechos sobre su
contenido. Uso actual: proyecto personal, no comercial, no publicado. Si algún día se
publica en una tienda de apps, revisar si hace falta permiso o quitar nombres reales.

---

## Objetivo: pirámide completa + ascensos/descensos

### 1. Categorías a integrar

Baloncesto masculino español:

| Nivel | Categoría | Equipos aprox. | Fuente | Notas |
|---|---|---|---|---|
| 1 | ACB | 18 | `acb.com` (¡sitio distinto, no FEB!) | Requiere scraper nuevo, estructura HTML propia. |
| 2 | Primera FEB | 17 | `baloncestoenvivo.feb.es` | ✅ Ya integrado. |
| 3 | Segunda FEB | ~18 | `baloncestoenvivo.feb.es` | Mismo scraper, cambiar `g=`/`nm=`. |
| 4 | Tercera FEB | ~150-200 | `baloncestoenvivo.feb.es` | **Regionalizada** en 10+ grupos autonómicos en paralelo — multiplica el trabajo x10. |

**Alcance recomendado:** ACB + Primera FEB + Segunda FEB (3 niveles, ~50 equipos,
~600 jugadores). Dejar Tercera FEB fuera — demasiado fragmentada para el valor que
aporta al juego.

Para encontrar `g=` (id de grupo) y `nm=` (slug) de Segunda FEB: repetir la
inspección que se hizo para Primera FEB en
`https://www.feb.es/Pasarela/clasificacion.aspx` → seguir a
`competiciones.feb.es/estadisticas` → buscar el link "Segunda FEB" → extraer
`g=`/`t=`/`nm=` de su URL de `calendario.aspx`.

### 2. Modelo de datos (romper el supuesto de "una sola liga")

Actualmente `GameContext` tiene un único `schedule`/`round`/`teams` plano. Cambiar a:

```
state.divisions = [
  {
    id: "acb" | "primerafeb" | "segundafeb",
    tier: 1 | 2 | 3,
    name: "ACB",
    teamIds: [...],
    schedule: [...],   // igual que ahora, generado por generateSchedule()
    round: 0,
    promotionSlots: 2,   // cuántos suben a la división de arriba
    relegationSlots: 2,  // cuántos bajan a la de abajo
  },
  ...
]
```

- `team.divisionId` en vez de vivir "suelto".
- Los jugadores no cambian (siguen siendo globales, indexados por `teamId`).
- `generateRealLeague()` pasa a `generateRealPyramid()`: carga los 3 JSON de datos
  (uno por división) y arma las 3 estructuras de división.

### 3. Simular "todo a la vez"

Un único botón "Simular jornada" avanza el `round` de **todas** las divisiones a la
vez. Problema: si tienen distinto nº de equipos, tienen distinto nº de jornadas
totales (division con menos equipos termina antes). Solución: jornada lógica común
`1..N` (N = la más larga); una división que ya terminó su calendario simplemente no
simula nada ese slot hasta que las demás lleguen a fin de temporada.

### 4. Ascensos y descensos

Al terminar **todas** las divisiones la misma temporada:

- v1 (simple): últimos `relegationSlots` de división N bajan a división N+1, primeros
  `promotionSlots` de división N+1 suben a división N. Reconstruir el `schedule` de
  cada división con la nueva composición de equipos antes de arrancar la siguiente
  temporada.
- v2 (más realista): ACB/Primera FEB/Segunda FEB usan playoffs de ascenso reales (no
  descenso/ascenso directo por posición) — añadir una fase de eliminatorias post-liga
  regular antes de resolver el cambio de división.
- Si el equipo del usuario asciende o desciende, mostrar aviso in-game y cambiarlo de
  división automáticamente para la temporada siguiente.

### 5. UI nueva

- Selector de división (tabs o dropdown) en vez de una sola tabla de liga.
- Clasificación por división.
- Resumen de fin de temporada: ascendidos/descendidos destacados, con animación o
  aviso simple.

### 6. Mercado de fichajes entre divisiones (opcional, v2)

Permitir fichar jugadores de cualquier división: los de división inferior deberían
ser más baratos y fáciles de convencer; los de división superior, caros y reacios a
bajar de categoría salvo oferta salarial alta. Añade profundidad pero no es
necesario para la v1 de la pirámide.

---

## Fases sugeridas (orden de implementación)

1. **Segunda FEB**: scrapear con el mismo pipeline, sumar como segunda división.
   Validar el modelo multi-división (esquema de `state.divisions`, simular ambas a la
   vez) sin pagar aún el coste de scrapear ACB.
2. **Ascenso/descenso v1** (swap directo por posición) entre Primera FEB y Segunda
   FEB.
3. **ACB**: scraper nuevo para `acb.com` (estructura HTML distinta, investigar desde
   cero — no reutiliza `feb_scraper.py` tal cual).
4. **Playoffs de ascenso reales** (v2), sustituyendo el swap directo.
