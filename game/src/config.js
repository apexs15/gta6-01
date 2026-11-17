// Solara Bay — shared constants, tuning and mission data.
// Every number here is picked for how the game feels, not for realism.

export const WORLD = {
  // Road centre lines, one every 50 units: 7 roads each way, 6x6 blocks.
  ROADS: [-150, -100, -50, 0, 50, 100, 150],
  ROAD_WIDTH: 10,
  BLOCK: 40,
  // City edge; the beach and the sea sit east of this.
  EDGE: 165,
  WATER_X: 178,
};

export const LANDMARKS = {
  cafe: { x: -75, z: -75, name: "Rosa's Cafe" },
  docks: { x: 172, z: 25, name: 'The Docks' },
  clinic: { x: 75, z: -75, name: 'Bay Clinic' },
  bank: { x: -25, z: 25, name: 'Solara Bank' },
  safehouse: { x: 125, z: 125, name: 'Safehouse' },
  plaza: { x: 0, z: 75, name: 'Marina Plaza' },
};

export const PLAYER = {
  WALK_SPEED: 6,
  RUN_SPEED: 10.5,
  TURN_SPEED: 2.6,
  HEALTH: 100,
  START_CASH: 120,
  RADIUS: 0.55,
};

export const CAR = {
  ACCEL: 16,
  BRAKE: 30,
  MAX_SPEED: 34,
  MAX_REVERSE: 11,
  STEER: 0.55,
  LENGTH: 4.4,
  WIDTH: 2.0,
};

export const WEAPON = {
  MAG: 12,
  RANGE: 70,
  RELOAD_MS: 1200,
  DAMAGE: 34,
};

export const WANTED = {
  MAX: 5,
  STEAL_CAR: 1,
  SHOOT: 1,
  KILL_PED: 1,
  KILL_COP: 2,
  DECAY_SECONDS: 22,
  BUSTED_FINE: 0.2,
  WASTED_FINE: 0.2,
};

export const TRAFFIC = {
  CARS: 14,
  PEDS: 18,
  CAR_SPEED_MIN: 7,
  CAR_SPEED_MAX: 12,
  PED_SPEED: 1.6,
  PED_FLEE_SPEED: 4.2,
};

// Missions. Each step is one objective; the player finishes a step by
// reaching its marker (goto) or pressing E inside it (interact / hold).
//
// Objective radii clear the landmark buildings: a building's collision box
// pushes the player out to about 11-13 m from a landmark's centre, so a
// small radius at a landmark could never be reached. Open spots (docks,
// plaza) keep tight radii.
export const MISSIONS = [
  {
    id: 'm1',
    name: "Rosa's Run",
    giver: 'MARCUS',
    brief: 'Pick up the package at Rosa\'s Cafe and run it to the Docks. No cops, no problems.',
    reward: 150,
    steps: [
      { type: 'goto', at: 'cafe', label: "Go to Rosa's Cafe", radius: 14 },
      { type: 'interact', at: 'cafe', label: 'Pick up the package (E)', radius: 14 },
      { type: 'goto', at: 'docks', label: 'Deliver to the Docks', radius: 8 },
    ],
  },
  {
    id: 'm2',
    name: 'Borrowed Wheels',
    giver: 'MARCUS',
    brief: 'Marcus needs wheels. Borrow a car — any car — and bring it to the Safehouse.',
    reward: 200,
    steps: [
      { type: 'steal', label: 'Steal a car (E near any car)', radius: 0 },
      { type: 'goto', at: 'safehouse', label: 'Drive to the Safehouse', radius: 12, inCar: true },
    ],
  },
  {
    id: 'm3',
    name: 'The Drop',
    giver: 'MARCUS',
    brief: 'Bank pickup, clinic drop-off. Ninety seconds. The clock is already running.',
    reward: 300,
    steps: [
      { type: 'goto', at: 'bank', label: 'Pick up at Solara Bank', radius: 14 },
      { type: 'interact', at: 'bank', label: 'Grab the bag (E)', radius: 14 },
      { type: 'timed', at: 'clinic', label: 'Deliver to Bay Clinic — fast!', radius: 14, seconds: 90 },
    ],
  },
  {
    id: 'm4',
    name: 'Heat Wave',
    giver: 'MARCUS',
    brief: 'Three stashes, one hot afternoon. The cops will be all over you — collect them all.',
    reward: 400,
    steps: [
      { type: 'collect', at: 'plaza', label: 'Collect stash 1/3 — Marina Plaza', radius: 8 },
      { type: 'collect', at: 'cafe', label: 'Collect stash 2/3 — Rosa\'s Cafe', radius: 14 },
      { type: 'collect', at: 'docks', label: 'Collect stash 3/3 — The Docks', radius: 8 },
    ],
  },
  {
    id: 'm5',
    name: 'The Big Score',
    giver: 'MARCUS',
    brief: 'The Bank vault. Hold E, take everything, and vanish to the Safehouse. This is the one.',
    reward: 1000,
    steps: [
      { type: 'goto', at: 'bank', label: 'Reach Solara Bank', radius: 14 },
      { type: 'hold', at: 'bank', label: 'Crack the vault (hold E)', radius: 14, holdMs: 3000 },
      { type: 'goto', at: 'safehouse', label: 'Escape to the Safehouse', radius: 12 },
    ],
  },
];

export const PHONE_TITLE = 'MARCUS — JOBS';
