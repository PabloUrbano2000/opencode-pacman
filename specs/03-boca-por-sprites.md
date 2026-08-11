# SPEC 03 — Boca de Pac-Man por sprites

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-08-11
> **Objetivo:** Corregir la boca de Pac-Man para que solo se anime cuando él se mueve (y quede cerrada al parar o chocar contra una pared), usando 4 sprites discretos en lugar de la animación continua actual.

## Alcance

**Incluido:**

- La boca solo se anima mientras Pac-Man avanza por el mapa.
- Al detenerse (soltar tecla o topar con pared) la boca queda cerrada.
- 4 sprites discretos de boca (cerrada, 1/4, media, abierta) dibujados con el trazado de arcos actual; se elimina la interpolación continua por seno.
- Ciclo de animación de 4 frames de movimiento por sprite (16 frames el ciclo completo a 60fps).
- Flag `moving` y contador `mouthTick` en `game.js`; el render solo lee.

**Fuera de alcance (futuras specs):**

- Assets de imagen / sprite-sheet de Pac-Man.
- Animación de la boca en menús o pantallas de inicio/victoria.
- Cambios en fantasmas, power pellets o mecánicas de SPEC 01/02.
- Diferentes ciclos de animación por velocidad o nivel.

## Modelo de datos

Cambios en `game.js` y `render.js`. Sin archivos nuevos.

```js
// game.js — campos nuevos en game.pacman
{ ..., moving: false, mouthTick: 0 }
// moving: true solo en los frames en que Pac-Man avanza de posición.
// mouthTick: frames acumulados de movimiento; el render deriva el sprite.

// render.js — constantes nuevas
const MOUTH_CYCLE_FRAMES = 4;                    // avanza un sprite cada 4 frames de movimiento
const MOUTH_FRAMES = [ 0.02, 0.11, 0.20, 0.30 ]; // ángulo (fracción de π) por sprite: cerrada, 1/4, media, abierta
```

Convenciones: mismas de SPEC 01/02 (celdas, frames a 60fps, estilo con espacios dentro de paréntesis).

## Plan de implementación

1. `game.js`: añadir `moving: false` y `mouthTick: 0` al objeto `pacman` en `createGame()`; en `movePacman()` poner `p.moving = false` al entrar y `p.moving = true; p.mouthTick++` justo después del avance (`p.x += ...; p.y += ...; wrapTunnel(...)`); en `resetPositions()` resetear ambos. El juego sigue idéntico en pantalla; no hay errores en consola.
2. `render.js`: en `drawPacman()` sustituir el seno por `const open = p.moving ? MOUTH_FRAMES[ Math.floor( p.mouthTick / MOUTH_CYCLE_FRAMES ) % MOUTH_FRAMES.length ] : MOUTH_FRAMES[ 0 ];` y añadir las constantes. Comprobar a mano: mover → chomp discreto; parar o tocar pared → boca cerrada.

## Criterios de aceptación

- [ ] En la pantalla de inicio Pac-Man se ve con la boca cerrada y no se anima.
- [ ] Mientras se mueve, la boca alterna entre 4 estados discretos (cerrada → 1/4 → media → abierta), sin interpolación continua.
- [ ] Al soltar la tecla, la boca se detiene y queda cerrada.
- [ ] Al chocar contra una pared, la boca se detiene y queda cerrada.
- [ ] Al reanudar el movimiento, el ciclo continúa desde donde se pausó (sin saltos).
- [ ] Al perder una vida y reaparecer, la boca arranca cerrada.
- [ ] La boca sigue orientándose según la dirección (arriba/abajo/izquierda/derecha).
- [ ] No hay errores en consola y la partida se puede ganar y perder.

## Decisiones

- **Sí:** 4 sprites discretos con el trazado de arcos actual. "Sprite" = estados discretos; sin assets nuevos.
- **Sí:** `moving` + `mouthTick` en `game.js`. El render solo lee; fuente única de verdad y verificable.
- **Sí:** en reposo la boca queda cerrada (mínima abertura 0.02 para que el arco se dibuje), como el arcade.
- **Sí:** `mouthTick` se pausa con el movimiento; al reanudar continúa el ciclo. Evita saltos de fase.
- **Sí:** ciclo de 4 frames de movimiento por sprite (16 frames a 60fps), cerca del ritmo del arcade.
- **No:** sprite-sheet de imágenes. El arte actual es vectorial y no hay assets.
- **No:** reiniciar la boca a cerrada en cada tecla. Pausar/reanudar el ciclo se ve más natural.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| El arco con ángulo 0 no dibuja nada (boca "cerrada" invisible) | El sprite 0 usa 0.02, la mínima abertura del límite actual. |
| `moving` true por error al girar en el sitio | La rotación ocurre en el bloque aligned sin movimiento; `moving` solo se pone true al avanzar coordenadas. |
| `mouthTick` sin resetear al reaparecer | `resetPositions()` lo pone a 0 junto con `moving`. |

## Lo que **no** está en esta spec

- Sprite-sheet de imágenes de Pac-Man.
- Animación de boca en menús o pantallas de ganar/perder.
- Cambios a fantasmas, power pellets o movimiento (SPEC 01/02).

Cada una de esas, si llega, va en su propia spec.
