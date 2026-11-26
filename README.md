# Skyline Courier

![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)
![rank](https://make.fun/badge/best-flight-game-20261126-0057/reonakisaragi4-bot/best-flight-game-20261126-0057/rank.svg)
![reward](https://make.fun/badge/best-flight-game-20261126-0057/reonakisaragi4-bot/best-flight-game-20261126-0057/reward.svg)

A 3D flight game built for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

You fly the mail plane over a mountain valley: thread six glowing rings in order, watch your fuel, and bring her home to the runway in one piece. Landing on the runway refuels and repairs the plane; hitting the ground anywhere else ends the sortie.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and play in a desktop browser. No network request is needed once the page loads — three.js is vendored under `game/vendor/`.

- **W / S** (or Shift / Ctrl) — throttle up / down
- **← → / A D** — bank left / right
- **↑ ↓ / I K** — climb / dive
- **Mouse** — steer like a stick
- **C** — chase / cockpit camera
- **P** — pause, **R** — restart, **M** — mute

The HUD shows altitude, speed and heading, fuel and damage, the next ring's distance and bearing, a live artificial horizon, a compass strip and a throttle gauge. The cockpit view adds a lit dashboard frame.

## Layout

- `game/index.html` — the page, HUD and overlays
- `game/src/config.js` — tuning numbers and colours
- `game/src/random.js` — seeded random helpers
- `game/src/terrain.js` — valley heightfield, river, runway, town, trees, clouds, rings
- `game/src/plane.js` — the aircraft mesh and arcade flight model
- `game/src/input.js` — keyboard and mouse
- `game/src/hud.js` — HUD, artificial horizon, compass
- `game/src/world.js` — mission state, fuel, damage, landings, scoring
- `game/src/shots.js` — screenshot staging (`?shot=start|play|cockpit|end`)
- `game/src/main.js` — boot and the fixed-step loop
- `game/vendor/three.min.js` — vendored three.js r149
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — real renders of the game running in headless Chrome

## License

MIT — see [LICENSE](LICENSE).
