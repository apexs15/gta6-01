// Neon Harbor — tuning + world constants (fresh code for round 3).
export const WORLD = 2400; // world is WORLD x WORLD px
export const ROAD_STEP = 200; // distance between road centre lines
export const ROAD_WIDTH = 56;
export const BLOCK = ROAD_STEP - ROAD_WIDTH; // building block size

export const PLAYER = {
  walkSpeed: 150,
  radius: 11,
  health: 100,
  magSize: 12,
  reloadMs: 1100,
  regenDelayMs: 8000,
  regenPerSec: 4,
};

export const CAR = {
  accel: 340,
  brake: 520,
  reverseMax: 150,
  maxSpeed: 430,
  turnRate: 2.6,
  radius: 15,
  health: 100,
};

export const POLICE = {
  maxCars: 3,
  carSpeed: 400,
  arrestRadius: 26,
  arrestHoldMs: 1200,
  ramDamage: 6,
};

export const WANTED = {
  decayIdleMs: 20000,
  decayStepMs: 12000,
  stealCar: 1,
  killPed: 1,
  killCop: 1,
  missionHeat: 2,
};

export const COLORS = {
  ground: '#0b0e1a',
  road: '#1b2138',
  roadLine: '#3d4a6e',
  sidewalk: '#141a2e',
  water: '#062a44',
  dock: '#232a3d',
  building: '#232c4a',
  buildingTop: '#2d3a5e',
  neonPink: '#ff2e88',
  neonCyan: '#22e6ff',
  neonYellow: '#ffd319',
  neonGreen: '#39ff88',
  player: '#ffd319',
  playerCar: '#ff2e88',
  police: '#2e7bff',
  ped: '#c8d2e8',
  bullet: '#ffe66d',
};

// Neon district blocks (centre of the city) — buildings here get neon trim.
export const NEON_DISTRICT = { x0: 900, y0: 700, x1: 1500, y1: 1300 };
// Dockyard strip along the south edge; water below it.
export const DOCKS = { y0: 2250, waterY: 2360 };

export const MISSION_REWARDS = [150, 200, 250, 400, 600];
export const START_CASH = 120;
export const FINE_RATE = 0.2; // 20% cash lost on BUSTED / WASTED
export const SAVE_KEY = 'neon-harbor-save-v1';
