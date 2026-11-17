# Solara Bay — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/apexs15/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/apexs15/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

You are **Dario Cruz**, a driver-for-hire new to **Solara Bay** — a sun-soaked
coastal city of traffic, palms and trouble. Explore the city on foot and by car,
steal cars, lose the cops, run five story jobs for the crew, and make a name for
yourself.

## What is in the game

- A 3D grid city with a beach and bay: roads, sidewalks, parks, a bank, a marina,
  docks, a dealership and a garage — all original, built from procedural geometry.
- On foot and by car: third-person controls, arcade driving with handbrake,
  traffic AI that follows the road grid, pedestrians on the sidewalks.
- Steal any car: traffic cars (the driver bails) and the red Comet GT.
- A wanted system: 0–5 stars, police cars that chase and ram, officers on foot
  who try to arrest you. Lay low and the heat fades; get busted or wasted and
  you lose 20% of your cash at the clinic.
- Five story missions with dialogue: First Fare, The Package, Hot Wheels, Heat,
  The Big Score — plus free roam after the story.
- Combat: a hitscan pistol, rival guards in the bank job, health and reload.
- HUD with a live minimap (roads, traffic, police, mission marker), wanted stars,
  health, cash, ammo, clock and speed.
- Start screen, pause menu, mission phone, save/load in localStorage.
- Synthesized sound: engine, sirens, gunshots, pickups and a bassline loop —
  no audio files, no network.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome. No build step, no network request: three.js is vendored minified under
`game/vendor/`.

```
WASD move / drive · Shift sprint · Mouse drag orbit · Wheel zoom
E enter / exit / steal car · Click shoot · R reload · Space handbrake
M phone (missions) · P mute · Esc pause
```

## Files

- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output`
  and writes `/output/dossier.json` with the vendored make.fun library.
- `game/` — the game: `index.html` plus `src/` modules (one job each) and
  vendored three.js under `game/vendor/`.
- `screenshots/` — four real renders of the game's own code.

Everything in the game is original: the city, characters, vehicles, names, story,
art and sound. Nothing from Rockstar Games' Grand Theft Auto series or any other
commercial game.
