# SPEC 01 — Cuatro fantasmas con personalidades clásicas

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-08-11
> **Objetivo:** Sustituir los 2 fantasmas actuales por 4 con las personalidades clásicas del arcade (Blinky, Pinky, Inky, Clyde), incluyendo fases scatter/chase y salida escalonada del pen.

## Alcance

**Incluido:**

- 4 fantasmas con `kind` clásico: `blinky`, `pinky`, `inky`, `clyde`, reemplazando a los actuales `hunter` y `random`.
- Lógica de persecución propia de cada uno, según el arcade.
- Fases globales `scatter`/`chase` con la tabla clásica de tiempos.
- Salida escalonada del pen con los tiempos clásicos.
- Rebotado vertical de los fantasmas en espera dentro del pen.
- Color por tipo (rojo, rosa, cian, naranja) en lugar de por índice.

**Fuera de alcance (futuras specs):**

- Power pellets y modo `frightened` (fantasmas azules y comibles).
- Diferencias de velocidad entre fantasmas.
- Sonidos.
- Indicador visual de la fase scatter/chase en el HUD.

## Modelo de datos

No hay archivos nuevos. Cambios en los existentes:

```js
// maze.js — GHOST_STARTS pasa de 2 a 4 entradas
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky' }, // fuera del pen, encima de la puerta
  { x: 14, y: 14, kind: 'pinky' },  // dentro del pen
  { x: 13, y: 13, kind: 'inky' },   // dentro del pen
  { x: 14, y: 13, kind: 'clyde' },  // dentro del pen
];

// game.js — nuevas constantes
const GHOST_SPEED = 0.1; // se mantiene, todos iguales
const RELEASE_FRAMES = { blinky: 0, pinky: 48, inky: 240, clyde: 420 }; // a 60fps
const PHASE_TABLE = [
  { phase: 'scatter', frames: 420 },  // 7s
  { phase: 'chase',   frames: 1200 }, // 20s
  { phase: 'scatter', frames: 420 },
  { phase: 'chase',   frames: 1200 },
  { phase: 'scatter', frames: 300 },  // 5s
  { phase: 'chase',   frames: 1200 },
  { phase: 'scatter', frames: 300 },
  { phase: 'chase',   frames: Infinity },
];
const GHOST_SCATTER_TARGETS = {
  blinky: { x: 26, y: 0 },
  pinky:  { x: 1,  y: 0 },
  inky:   { x: 26, y: 30 },
  clyde:  { x: 1,  y: 30 },
};

// game.js — ghost individual
{ x, y, dir, speed, kind, releaseAt, mode } // mode: 'waiting' | 'active'

// game.js — game, campos nuevos
{ ..., frame: 0, phase: 'scatter', phaseIndex: 0, phaseTimer: 420 }
```

Convenciones: coordenadas celda (x,y), origen arriba-izquierda; timers en frames a 60fps (consistente con el movimiento frame-based actual).

## Plan de implementación

1. `maze.js`: sustituir `GHOST_STARTS` por las 4 entradas con sus `kind`. El juego sigue funcionando (los 3 no-`hunter` caen en la rama random actual).
2. `game.js`: añadir `RELEASE_FRAMES`, `PHASE_TABLE`, `GHOST_SCATTER_TARGETS` y los campos `releaseAt`, `mode`, `frame`, `phase`, `phaseIndex`, `phaseTimer` en `createGame()`.
3. `game.js`: reescribir `decideGhost()` para elegir el objetivo según `kind` y fase:
   - `blinky`: celda actual de Pac-Man.
   - `pinky`: punto 4 celdas delante de Pac-Man según su dirección.
   - `inky`: punto 2 delante de Pac-Man; vector desde ahí hasta Blinky doblado (usa la posición de Blinky).
   - `clyde`: persigue si distancia > 8 celdas; si no, su esquina.
   - La selección de dirección sigue minimizando distancia Manhattan al objetivo, con esquinas del pen sin parar.
4. `game.js`: en `update()` incrementar `frame`, avanzar la tabla de fases, y para cada fantasma: si `frame >= releaseAt` → movimiento normal; si no → rebotado vertical entre `y=13` y `y=15` (ignorando `canMove`, para que la puerta no los deje escapar).
5. `game.js`: ajustar `resetPositions()` y `createGame()` para reiniciar `frame`, fases y liberaciones.
6. `render.js`: `GHOST_COLORS` pasa a objeto por `kind` (`blinky` rojo, `pinky` rosa, `inky` cian, `clyde` naranja) y `draw()` usa el color del tipo.

## Criterios de aceptación

- [ ] Al arrancar se ven 4 fantasmas con los colores clásicos (rojo, rosa, cian, naranja).
- [ ] Blinky está fuera del pen y persigue desde el inicio.
- [ ] Pinky sale a los 48 frames, Inky a los 240 y Clyde a los 420.
- [ ] Los fantasmas en espera rebotan arriba/abajo dentro del pen sin escapar antes de tiempo.
- [ ] En la fase scatter (primeros 7s) cada fantasma se dirige a su esquina.
- [ ] En chase, Blinky minimiza la distancia a la celda actual de Pac-Man.
- [ ] En chase, Pinky apunta a la celda 4 delante de Pac-Man.
- [ ] En chase, Inky usa la posición de Blinky y el punto 2 delante de Pac-Man.
- [ ] En chase, Clyde persigue a distancia > 8 y huye a su esquina si está más cerca.
- [ ] La tabla de fases termina en chase permanente.
- [ ] El choque con cualquier fantasma quita una vida; reiniciar partida resetea posiciones, liberaciones y fases.
- [ ] No hay errores en consola y la partida se puede ganar y perder.

## Decisiones

- **Sí:** kinds clásicos `blinky`/`pinky`/`inky`/`clyde`. Reemplazan a `hunter`/`random`; son la forma canónica de que cada uno actúe distinto.
- **Sí:** color por tipo y no por índice. Evita que el orden rompa la identidad del fantasma.
- **Sí:** tabla de fases completa del arcade (acaba en chase ∞). Más fiel que un ciclo simple.
- **Sí:** salida escalonada (0/48/240/420 frames) y rebotado en el pen. Blinky en el pen viola su rol de "perseguidor agresivo".
- **Sí:** velocidad común fija. La variación de velocidad merece su propia spec.
- **No:** "peculiaridad del up" de Pinky/Inky (el bug del arcade que desvía el objetivo al mirar hacia arriba). Aquí el objetivo es siempre en línea recta.
- **No:** archivo nuevo; la lógica queda en `game.js`, coherente con la arquitectura actual.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Un fantasma en espera escapa por la puerta (el 3 es transitable para fantasmas) | El rebotado se acota a filas 13–15 y no usa `canMove`. |
| Timers en frames se desvían si el refresco ≠ 60fps | Aceptado: consistente con el movimiento frame-based actual. |
| Inky depende de Blinky | Blinky libera en el frame 0; el objetivo usa su posición actual. |

## Lo que **no** está en esta spec

- Power pellets y modo `frightened`.
- Velocidades distintas por fantasma.
- Sonidos.
- Indicador de fase en el HUD.

Cada una de esas, si llega, va en su propia spec.
