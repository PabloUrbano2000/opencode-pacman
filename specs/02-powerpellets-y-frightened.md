# SPEC 02 — Power pellets y modo frightened

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-11
> **Objetivo:** Añadir los 4 power pellets clásicos y el modo frightened: fantasmas azules comibles con temporizador, ojos que vuelven al pen y combo de puntos.

## Alcance

**Incluido:**

- 4 power pellets en las esquinas clásicas: (1,3), (26,3), (1,23), (26,23), reemplazando a esos 4 dots.
- Power pellet vale 50 puntos y cuenta en el total de comestibles (se necesita para ganar).
- Modo `frightened` de 6s (360 frames) que se reinicia al comer otra pellet; en el último segundo los fantasmas parpadean azul/blanco.
- Fantasmas comibles: cuerpo azul clásico (#2121de), ojos blancos sin pupilas y boca fruncida.
- Durante `frightened` los fantasmas van más lentos (~50% de Pac-Man) y eligen dirección aleatoria sin reversa.
- El reloj de fases scatter/chase se pausa mientras dura el poder.
- Comer un fantasma comible: 200/400/800/1600 puntos en combo; se reinicia a 200 con pellet nueva o al perder una vida.
- Fantasmas comidos → ojos que vuelven al pen, se regeneran y se liberan de nuevo.
- Chocar con un fantasma normal sigue quitando una vida; perder resetea posiciones y el estado del poder.

**Fuera de alcance (futuras specs):**

- Sonidos (tanto del poder como de comer fantasma).
- Temporizador visual del poder en el HUD.
- Puntos flotantes en pantalla al comer un fantasma.
- Duración del `frightened` variable por nivel (aquí fija a 6s).
- Pausa del juego y menús nuevos.

## Modelo de datos

Cambios en `maze.js`, `game.js` y `render.js`. Sin archivos nuevos.

```js
// maze.js — nuevo tile 4 = power pellet. En MAZE_STR, 4 chars pasan de '.' a '*'.
// fila 3:  '#.####.#####.##.#####.####.#'  ->  '#*####.#####.##.#####.####*#'
// fila 23: '#...##................##...#'  ->  '#*..##................##..*#'
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === '*' ) return 4;
  return 0;
}

// game.js — constantes nuevas
const PELLET_POINTS = 50;
const FRIGHTENED_FRAMES = 360;  // 6s a 60fps
const FLASH_FRAMES = 60;        // 1s de parpadeo antes de volver a normal
const FRIGHTENED_SPEED = 0.0625; // 50% de PACMAN_SPEED
const EYE_SPEED = 0.2;          // 2x GHOST_SPEED (ojos rápidos, como el arcade)
const GHOST_EAT_VALUES = [ 200, 400, 800, 1600 ];

// game.js — campos nuevos en el estado
{ ..., frightened: 0, ghostCombo: 0 }
// frightened: frames restantes (0 = inactivo). ghostCombo: puntos del próximo
// fantasma comido (se inicializa a 200 al comer una pellet).

// game.js — ghost individual: mode gana un tercer valor
{ x, y, dir, speed, kind, releaseAt, mode } // mode: 'waiting' | 'active' | 'eyes'
```

Convenciones: las mismas de SPEC 01 (celdas, frames a 60fps, recuento de comestibles en `dotsRemaining` ahora cuenta valores 2 y 4).

## Plan de implementación

1. `game.js`: añadir constantes y campos `frightened`/`ghostCombo` en `createGame()`; en `movePacman()` comer el valor 4 (+50 puntos, `frightened = FRIGHTENED_FRAMES`, `ghostCombo = 200`, decrementar `dotsRemaining`); el recuento inicial cuenta 2 y 4. Juego funcional: las pellets son comibles aunque aún invisibles.
2. `render.js`: dibujar las celdas con valor 4 como un círculo grande pulsante (radio ~7px, oscilando con `frame`). Las pellets ya se ven.
3. `game.js`: decrementar `game.frightened` cada frame y pausar `phaseTimer` mientras `frightened > 0`; en `decideGhost()` cuando `frightened > 0` elegir dirección aleatoria válida sin reversa; en `moveGhost()` usar `FRIGHTENED_SPEED` durante el poder. Fantasmas lentos y erráticos.
4. `game.js`: reescribir la colisión pacman-fantasma: si `mode === 'active'` y `frightened > 0` → comer (sumar `GHOST_EAT_VALUES[índice de combo]`, doblar el índice con tope 1600, `mode = 'eyes'`); si `mode === 'eyes'` → sin efecto; si no → perder vida. Los ojos persiguen el pen (objetivo (13,14) con `EYE_SPEED`); al entrar en filas 13–15 se regeneran a `'waiting'` con `releaseAt = frame + RELEASE_FRAMES[kind]`. `resetPositions()` resetea `frightened` y el combo. Juego jugable con la mecánica completa salvo el dibujo.
5. `render.js`: dibujar el modo `frightened` (cuerpo `#2121de`, ojos blancos sin pupilas, boca fruncida; en los últimos `FLASH_FRAMES` alternar azul/blanco cada ~8 frames) y los ojos (dos círculos blancos sin cuerpo) cuando `mode === 'eyes'`.

## Criterios de aceptación

- [ ] Al arrancar se ven 4 power pellets grandes en (1,3), (26,3), (1,23), (26,23), donde antes había dots.
- [ ] Comer una power pellet suma 50 puntos y la quita del grid.
- [ ] Al comer una pellet, todos los fantasmas (activos y en espera) se vuelven azules con ojos blancos y boca fruncida.
- [ ] El modo `frightened` dura 6s; en el último segundo los fantasmas parpadean azul/blanco.
- [ ] Comer otra pellet reinicia el temporizador a 6s (y a cuerpo azul sólido si estaba parpadeando).
- [ ] Durante el poder los fantasmas van más lentos y eligen dirección aleatoria en cada intersección.
- [ ] La tabla scatter/chase queda congelada mientras dura el poder y se reanuda al terminar.
- [ ] Comer un fantasma comible suma 200, luego 400, 800 y 1600 en el mismo poder; una pellet nueva o perder una vida reinician el combo a 200.
- [ ] El fantasma comido se convierte en ojos, vuelve al pen, se regenera y se libera de nuevo.
- [ ] Chocar con un fantasma normal quita una vida y resetea posiciones, temporizador y combo.
- [ ] Las 4 pellets cuentan para ganar: comerse todo termina en victoria.
- [ ] No hay errores en consola.

## Decisiones

- **Sí:** tile `4` en el grid para la pellet (char `*` en `MAZE_STR`). Reutiliza parse/working-copy; las 4 posiciones salen del propio laberinto, sin estructura aparte.
- **Sí:** las 4 esquinas clásicas. Son las celdas simétricas que hoy son dots.
- **Sí:** 6s + 1s de parpadeo, duración clásica del nivel 1; comer otra pellet reinicia sin acumular.
- **Sí:** velocidad `0.0625` (~50% de Pac-Man) y dirección aleatoria sin reversa. Fiel al arcade y hace el poder cazable.
- **Sí:** combo 200→1600, reinicia con pellet nueva y al morir. Comportamiento clásico.
- **Sí:** pausa de `phaseTimer` durante el poder. Evita transiciones scatter/chase a mitad del `frightened`.
- **Sí:** ojos con velocidad 2x y regeneración reutilizando `RELEASE_FRAMES`. Las fases no se ven afectadas.
- **No:** HUD con temporizador del poder. Se ve con el parpadeo; merece su propia spec junto al indicador de fase.
- **No:** puntos flotantes al comer fantasma. Decorativo, fuera de alcance.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Un ojo se queda orbitando la puerta sin entrar al pen | Objetivo fijo (13,14); al tocar filas 13–15 se regenera a `'waiting'` de inmediato. |
| Comer una pellet justo en el instante del parpadeo final | El parpadeo solo aplica a los últimos 60 frames del temporizador actual; una pellet nueva lo reinicia y vuelve el azul sólido. |
| El combo persiste tras terminar el poder | Se reinicia al comer una pellet nueva o al morir; el índice solo avanza comiendo fantasmas en el mismo poder. |
| Fases desincronizadas si `frightened` interrumpe la tabla | `phaseTimer` se pausa mientras `frightened > 0`; `frame` global sigue corriendo para las liberaciones. |

## Lo que **no** está en esta spec

- Sonidos del poder y de comer fantasma.
- Temporizador visual del poder en el HUD.
- Puntos flotantes al comer un fantasma.
- Duración de `frightened` por nivel.

Cada una de esas, si llega, va en su propia spec.
