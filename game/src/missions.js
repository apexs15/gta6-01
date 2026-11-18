// Neon Harbor — 5-mission story arc (fresh code for round 3).
// Mara Voss, getaway driver, works her way up the harbor crew.
// Each mission is a list of objectives; completing all 5 ends the story.
import { MISSION_REWARDS } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'Harbor Run',
    giver: 'Deke — fixer at the docks',
    brief: 'Pick up the crate at Pier 4, then deliver it to the neon district. 90 seconds, no questions.',
    objectives: [
      { type: 'goto', x: 500, y: 2300, r: 60, text: 'Pick up the crate at Pier 4 (south docks)' },
      { type: 'goto', x: 1200, y: 1000, r: 60, text: 'Deliver the crate to the neon district' },
    ],
    timeLimit: 90,
  },
  {
    id: 2,
    title: 'Clean Getaway',
    giver: 'Deke',
    brief: 'A rival crew left a tuned coupe by the casino. Take it, lose the heat, park it in the garage.',
    objectives: [
      { type: 'steal', x: 1300, y: 900, r: 70, text: 'Steal the marked coupe near the casino' },
      { type: 'cooldown', x: 0, y: 0, r: 0, text: 'Lose the cops — get wanted down to 0 stars' },
      { type: 'goto', x: 300, y: 300, r: 60, text: 'Park the coupe in the north-west garage' },
    ],
    timeLimit: 0,
  },
  {
    id: 3,
    title: 'Dockside Deal',
    giver: 'Rosa — runs the cafe on 5th',
    brief: 'Meet the buyer at the container yard. His friends will object. Deal with them, take the package.',
    objectives: [
      { type: 'goto', x: 700, y: 2300, r: 60, text: 'Meet the buyer at the west container yard' },
      { type: 'kill', count: 4, text: 'Ambush! Take out 4 attackers' },
      { type: 'goto', x: 1100, y: 1100, r: 60, text: 'Bring the package back to Rosa' },
    ],
    timeLimit: 0,
  },
  {
    id: 4,
    title: 'Neon Heist',
    giver: 'Deke',
    brief: 'The casino cage is light tonight. Grab the cash on foot, then run — the whole precinct will be on you.',
    objectives: [
      { type: 'goto', x: 1400, y: 900, r: 55, text: 'Reach the casino cage (on foot)' },
      { type: 'grab', x: 1400, y: 900, r: 55, text: 'Grab the cash — hold the spot 3 seconds' },
      { type: 'goto', x: 300, y: 2100, r: 70, text: 'Escape to the south-west safehouse' },
    ],
    timeLimit: 0,
    heatOnGrab: 3,
  },
  {
    id: 5,
    title: 'The Last Job',
    giver: 'Mara — for her brother',
    brief: 'Pick up Leo at the docks, cross the bridge, and end the crew that set you up. Then the lighthouse — and out.',
    objectives: [
      { type: 'goto', x: 1900, y: 2300, r: 60, text: 'Pick up Leo at the east docks' },
      { type: 'goto', x: 1200, y: 1300, r: 60, text: 'Cross the bridge into the old town' },
      { type: 'kill', count: 6, text: 'Final shootout — take out 6 crew' },
      { type: 'goto', x: 150, y: 2320, r: 70, text: 'Reach the lighthouse. Go home.' },
    ],
    timeLimit: 0,
  },
];

export class MissionRunner {
  constructor(onEvent) {
    this.onEvent = onEvent; // (type, data) — 'objective' | 'done' | 'failed' | 'story'
    this.active = null; // {def, step, timer, kills, grabHold, attackers}
    this.done = [false, false, false, false, false];
    this.storyDone = false;
  }
  available() {
    return MISSIONS.map((m, i) => ({
      ...m,
      locked: i > 0 && !this.done[i - 1],
      done: this.done[i],
    }));
  }
  start(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return false;
    const idx = def.id - 1;
    if (idx > 0 && !this.done[idx - 1]) return false;
    if (this.active) return false;
    this.active = { def, step: 0, timer: def.timeLimit, kills: 0, grabHold: 0, attackers: [] };
    this.onEvent('start', { mission: def });
    return true;
  }
  currentObjective() {
    if (!this.active) return null;
    return this.active.def.objectives[this.active.step] || null;
  }
  advance() {
    if (!this.active) return;
    const a = this.active;
    a.step++;
    if (a.step >= a.def.objectives.length) {
      const reward = MISSION_REWARDS[a.def.id - 1];
      this.done[a.def.id - 1] = true;
      this.onEvent('done', { mission: a.def, reward });
      const allDone = this.done.every(Boolean);
      this.active = null;
      if (allDone) {
        this.storyDone = true;
        this.onEvent('story', {});
      }
    } else {
      this.onEvent('objective', { mission: a.def, step: a.step });
    }
  }
  fail(reason) {
    if (!this.active) return;
    const m = this.active.def;
    this.active = null;
    this.onEvent('failed', { mission: m, reason });
  }
  update(dt) {
    if (!this.active) return;
    const a = this.active;
    if (a.timer > 0) {
      a.timer -= dt;
      if (a.timer <= 0) this.fail('Time ran out');
    }
  }
}
