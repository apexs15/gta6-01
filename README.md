# Solara Bay — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/apexs15/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/apexs15/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game in the spirit of GTA 6, built with three.js. Play it at [make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01).

## The game

You are **Dario Cruz**, new in Solara Bay and already in debt. **Marcus** has five jobs for you — pick them up on the phone (P) and finish them all to complete the story.

- **A city to explore** — 6×6 blocks of streets, buildings, a beach and the sea, on foot or by car.
- **Traffic and pedestrians** — cars loop the block grid on their lanes and honk when you block them; pedestrians stroll the sidewalks and run from gunfire.
- **Cars to steal and drive** — walk up to any car and press E. The cops will notice.
- **A wanted level and police who respond** — 0 to 5 stars, police cars chase you down, and getting caught means BUSTED. Lose all your health and you're WASTED. Either way you pay 20% and wake up at Bay Clinic.
- **Missions and a story** — five jobs from Marcus, from a simple package run at Rosa's Cafe to the Big Score at Solara Bank.
- **Combat** — click or press F to shoot (12-round magazine, R reloads), raycast hits, wanted stars for every crime.
- **HUD with a minimap** — health, cash, wanted stars, ammo, speed, mission objective, and a live minimap with a north compass.
- **Start screen and saves** — progress is saved to localStorage; Continue picks up where you left off.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Run |
| E | Enter or steal a car / interact / get out |
| Click or F | Shoot |
| R | Reload |
| P | Phone — Marcus's jobs |
| 1–5 | Take a job from the phone |
| ← → | Orbit the camera |

## Play it

Serve `game/` with any static server and open `index.html`, or run `node serve.ts` if present. The game runs entirely from its own files — the only library is three.js, vendored under `game/vendor/`.

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `buildDossier`.
