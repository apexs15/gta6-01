# Neon Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/apexs15/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/apexs15/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Harbor** is a top-down 2D open-world crime game (GTA 1/2 style) set in a
neon port city at night. You are **Mara Voss**, getaway driver, working five
jobs for the harbor crew — and then the story ends at the lighthouse.

## How to play

- **WASD** — walk / drive · **Mouse** — aim · **Click / Space** — shoot
- **R** — reload (12-round mag) · **E** — steal a car / exit your car
- **Q** — phone (jobs menu), press **1–5** to take a job
- Wanted stars 0–5: the law chases you. Foot cops arrest you (**BUSTED**),
  losing 20% of your cash; dying (**WASTED**) costs the same and respawns
  you at the clinic. Lay low and the heat fades.

## The five jobs

1. **Harbor Run** — crate from Pier 4 to the neon district, 90 seconds.
2. **Clean Getaway** — steal the marked coupe, lose the cops, park it.
3. **Dockside Deal** — meet the buyer, survive the ambush, bring the package back.
4. **Neon Heist** — grab the casino cash on foot and outrun the whole precinct.
5. **The Last Job** — pick up Leo, cross the bridge, end the crew, reach the lighthouse.

## Features

- 2400×2400 night city: grid streets, docks, neon district, lighthouse
- Traffic AI + pedestrians who flee gunfire
- Police cars and foot cops, wanted decay, BUSTED / WASTED fines
- HUD (cash, health, ammo, wanted stars, mission tracker) + minimap with N compass
- Start screen, localStorage save + Continue, WebAudio synth SFX (engine, sirens, gunfire)

Built for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01).
Run with Node 22: `node main.ts` (writes the dossier to `/output`).
