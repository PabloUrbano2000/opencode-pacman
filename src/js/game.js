// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Liberacion escalonada del pen en frames (a 60fps).
const RELEASE_FRAMES = { blinky: 0, pinky: 48, inky: 240, clyde: 420 };
// Tabla clasica de fases scatter/chase del arcade (acaba en chase infinito).
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
// Esquinas objetivo de cada fantasma durante las fases scatter.
const GHOST_SCATTER_TARGETS = {
  blinky: { x: 26, y: 0 },
  pinky:  { x: 1,  y: 0 },
  inky:   { x: 26, y: 30 },
  clyde:  { x: 1,  y: 30 },
};

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    frame: 0,
    phase: 'scatter',
    phaseIndex: 0,
    phaseTimer: PHASE_TABLE[ 0 ].frames,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseAt: RELEASE_FRAMES[ g.kind ],
      mode: 'waiting',
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objetivo de persecucion en fase chase segun el kind (personalidades clasicas).
function chaseTarget( game, ghost ) {
  const pacman = game.pacman;
  const pacmanX = Math.round( pacman.x );
  const pacmanY = Math.round( pacman.y );
  const pacmanDir = DIRS[ pacman.dir ] || { x: 0, y: 0 };

  switch ( ghost.kind ) {
    case 'blinky':
      // Perseguidor: la celda actual de Pac-Man.
      return { x: pacmanX, y: pacmanY };
    case 'pinky':
      // 4 celdas delante de Pac-Man segun su direccion.
      return { x: pacmanX + pacmanDir.x * 4, y: pacmanY + pacmanDir.y * 4 };
    case 'inky': {
      // Punto 2 delante de Pac-Man; vector desde ahi hasta Blinky doblado.
      const aheadTwo = { x: pacmanX + pacmanDir.x * 2, y: pacmanY + pacmanDir.y * 2 };
      const blinky = game.ghosts.find( ( otherGhost ) => otherGhost.kind === 'blinky' );
      const blinkyX = Math.round( blinky.x );
      const blinkyY = Math.round( blinky.y );
      return {
        x: blinkyX + ( blinkyX - aheadTwo.x ),
        y: blinkyY + ( blinkyY - aheadTwo.y ),
      };
    }
    case 'clyde':
      // Persigue si esta lejos (> 8 celdas); si no, va a su esquina.
      if ( Math.abs( ghost.x - pacmanX ) + Math.abs( ghost.y - pacmanY ) > 8 ) {
        return { x: pacmanX, y: pacmanY };
      }
      return GHOST_SCATTER_TARGETS.clyde;
    default:
      return GHOST_SCATTER_TARGETS[ ghost.kind ];
  }
}

function decideGhost( game, ghost ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ ghost.dir ] && canMove( grid, ghost.x, ghost.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ ghost.dir ] ];

  const target =
    game.phase === 'scatter' ? GHOST_SCATTER_TARGETS[ ghost.kind ] : chaseTarget( game, ghost );

  let best = choices[ 0 ];
  let bestDistance = Infinity;
  for ( const dir of choices ) {
    const delta = DIRS[ dir ];
    const nextX = ghost.x + delta.x;
    const nextY = ghost.y + delta.y;
    const distance = Math.abs( nextX - target.x ) + Math.abs( nextY - target.y );
    if ( distance < bestDistance ) {
      bestDistance = distance;
      best = dir;
    }
  }
  ghost.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

// Rebotado vertical de los fantasmas en espera dentro del pen (filas 13-15).
// Ignora canMove a proposito: la puerta (fila 12) es transitable para
// fantasmas, y el rebote acotado impide que escapen antes de tiempo.
function bounceGhost( game, ghost ) {
  if ( ghost.dir === 'up' && ghost.y <= 13 ) ghost.dir = 'down';
  else if ( ghost.dir === 'down' && ghost.y >= 15 ) ghost.dir = 'up';
  ghost.y += DIRS[ ghost.dir ].y * ghost.speed;
  // El clamp absorbe la deriva de coma flotante y garantiza el rango 13-15.
  ghost.y = Math.max( 13, Math.min( 15, ghost.y ) );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( ghost, i ) => {
    ghost.x = GHOST_STARTS[ i ].x;
    ghost.y = GHOST_STARTS[ i ].y;
    ghost.dir = 'up';
    ghost.mode = 'waiting';
  } );
  // Reinicia el reloj global, las fases y las liberaciones del pen.
  game.frame = 0;
  game.phase = 'scatter';
  game.phaseIndex = 0;
  game.phaseTimer = PHASE_TABLE[ 0 ].frames;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );

  // Reloj global de la partida y avance de la tabla de fases scatter/chase.
  game.frame++;
  game.phaseTimer--;
  if ( game.phaseTimer <= 0 && game.phaseIndex < PHASE_TABLE.length - 1 ) {
    game.phaseIndex++;
    game.phase = PHASE_TABLE[ game.phaseIndex ].phase;
    game.phaseTimer = PHASE_TABLE[ game.phaseIndex ].frames;
  }

  game.ghosts.forEach( ( ghost ) => {
    if ( ghost.mode === 'waiting' && game.frame >= ghost.releaseAt ) ghost.mode = 'active';
    if ( ghost.mode === 'active' ) moveGhost( game, ghost );
    else bounceGhost( game, ghost );
  } );

  for ( const ghost of game.ghosts ) {
    if ( collides( game.pacman, ghost ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
