# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man clone. No build step, no package.json, no tests, no linter. The project's purpose is learning spec-driven development. Codebase and comments are in Spanish.

Test

## Run

Open `src/index.html` in a browser. No server, bundler, or install needed (plain `<script>` tags, no ES modules, no fetch).

## Architecture

Four JS files loaded in order as plain scripts in `src/index.html:19-22`; files share state through `window.*` globals, not imports:

1. `src/js/maze.js` — pristine maze data + constants (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`). **Never mutated**; each game copies it.
2. `src/js/game.js` — `createGame()` / `update(game)`, movement, collisions, win/lose.
3. `src/js/render.js` — `draw(ctx, game, frame)` canvas rendering.
4. `src/js/main.js` — game loop, keyboard, start/win/lose overlays.

Gotchas:
- `MAZE` is defined as 31 readable strings in `maze.js` and parsed to a numeric grid. Encoding: `#` = wall (1), `.` = dot (2), ` ` = empty (0), `-` = door (3). Keep rows at exactly 28 chars and symmetric.
- `game.grid` is a working copy of `MAZE`; dots are eaten there, never in `MAZE`.
- TILE is 20px (`render.js:4`); canvas is 560x620 (28x31 cells). HUD draws into the top of the same canvas.
- Any new `.js` file must be added to `index.html` as a `<script>` tag **before** `main.js`.

## Spec-driven development (mandatory workflow)

- Features are written as specs in `specs/` (currently does not exist) before coding.
- `/spec` (skill in `.agents/skills/spec/`) authors a spec; it is saved as `specs/NN-slug.md` in `Draft` state. The agent writes no code here.
- `/spec-impl NN-slug` (skill in `.agents/skills/spec-impl/`) implements it: only proceeds if state means "Approved" (any language), then creates/switches to branch `spec-NN-slug` and implements the plan step-by-step, pausing after each step for diff review. Never commits automatically.
- Branch auto-creation is controlled by `AutoCreateBranch` in `specs/.spec-config.yml` (defaults to `true`).

## Style

- Code uses spaces inside parens: `foo( x )`, single quotes, semicolons. Match it.
- Comments, HUD strings, and README are in Spanish; keep new user-facing text and comments in Spanish.
