// Solara Bay — tuning, palette and city layout. One place for every magic number so
// the rest of the game reads as intent, not arithmetic.
export const CITY = {
  // Roads run on a grid: 7 avenues (x) and 7 streets (z), 60 units apart.
  roads: [-180, -120, -60, 0, 60, 120, 180],
  roadHalf: 6,
  sidewalk: 4,
  bound: 210,
  // West of the city is the beach and the bay.
  beachX: -210,
  waterX: -260,
};

export const PALETTE = {
  sky: 0xffb36b,
  skyTop: 0x2e6fb0,
  sun: 0xffd9a0,
  asphalt: 0x2b2f36,
  sidewalk: 0x9aa0a3,
  sand: 0xe8cf9a,
  water: 0x1e6f8e,
  grass: 0x5d8a4a,
  // Building facade base colours, sun-soaked pastel + concrete.
  facades: [0xe8d8c0, 0xd9b48f, 0xb7c4ce, 0xe6a57e, 0xc9a0b4, 0x9fb8a4, 0xd8c98a, 0x8fa3b8],
  glass: 0x2a4a5e,
  police: 0x1d4ed8,
  taxi: 0xf5c518,
};

export const PLAYER = {
  walkSpeed: 6.5,
  sprintSpeed: 11,
  radius: 0.7,
  health: 100,
  turnSpeed: 10,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 42,
  maxReverse: 12,
  steerMax: 0.55,
  grip: 6.5,
  handbrakeGrip: 2.2,
};

export const WANTED = {
  maxStars: 5,
  // Stars fall away after this many seconds with no crime and no cop close by.
  decaySeconds: 26,
  // Police cars on the hunt, by wanted level.
  copCars: [0, 2, 3, 4, 5, 6],
  // Officers on foot, by wanted level.
  copsOnFoot: [0, 0, 2, 3, 4, 5],
};

export const MISSIONS = [
  { id: 'fare', title: 'First Fare', reward: 150 },
  { id: 'package', title: 'The Package', reward: 250 },
  { id: 'wheels', title: 'Hot Wheels', reward: 400 },
  { id: 'heat', title: 'Heat', reward: 500 },
  { id: 'score', title: 'The Big Score', reward: 1500 },
];

// Named places on the map (x, z). All hand-placed, none borrowed.
export const PLACES = {
  cafe: { x: -42, z: -42, label: "Rosa's Cafe" },
  marina: { x: 168, z: 168, label: 'Marina' },
  docks: { x: -186, z: 150, label: 'Docks' },
  bar: { x: 42, z: -138, label: "Vera's Bar" },
  dealership: { x: 138, z: -42, label: 'Comet Motors' },
  garage: { x: -138, z: 42, label: "Eddie's Garage" },
  bank: { x: -42, z: 138, label: 'Solara Bank' },
  hideout: { x: 168, z: -168, label: 'Hideout' },
  clinic: { x: 42, z: 42, label: 'Clinic' },
  precinct: { x: -138, z: -138, label: 'Precinct' },
};
