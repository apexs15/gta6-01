// Screenshot scenes behind ?shot=cover|foot|drive|mission. Each one stages a real
// game state (real rules, real HUD) from a fixed seed, then steps the world a
// few seconds forward with a simple autopilot, so the frame is what the game
// really looks like and the same seed always gives the same frame.
import { PLACES } from './config.js';

// Staging is a callback the game runs once at boot: it receives the game and
// returns { ready: true } when the scene is set, or null for normal play.
export function stageShot(name, game) {
  const seed = Number(new URLSearchParams(window.location.search).get('seed') || '1');
  if (name === 'cover') return stageCover(game, seed);
  if (name === 'foot') return stageFoot(game, seed);
  if (name === 'drive') return stageDrive(game, seed);
  if (name === 'mission') return stageMission(game, seed);
  return null;
}

function settle(game, seconds) {
  // Step the world forward in fixed steps with the autopilot driving.
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) game.stepWorld(step, true);
}

function stageCover(game, seed) {
  // A police chase: the player is driving east on 5th Avenue, two cop cars
  // right behind, 3 wanted stars, and the Big Score escape objective live.
  // The camera sits AHEAD of the player's car looking back at it, so the
  // pursuing cops are in frame beyond the car; the chase lane is cleared of
  // traffic and pedestrians so nothing blocks the shot.
  game.startFreeRoam();
  game.missions.start(4);
  game.missions.step = 2; // escape to the hideout
  game.missions.updateMarker();
  for (const car of [...game.traffic.cars]) {
    const m = car.mesh.position;
    if (Math.abs(m.z) < 9 && m.x > 30 && m.x < 140) game.traffic.remove(car);
  }
  for (const ped of [...game.people.peds]) {
    const m = ped.mesh.position;
    if (Math.abs(m.z) < 9 && m.x > 30 && m.x < 140) game.people.remove(ped);
  }
  game.warpPlayerToCar(60, 0, Math.PI / 2, 26);
  game.police.setStars(3);
  const cop1 = game.police.spawnCopCar({ x: 50, z: 0 });
  cop1.mesh.position.set(50, 0, 3.4);
  const cop2 = game.police.spawnCopCar({ x: 42, z: 0 });
  cop2.mesh.position.set(42, 0, -3.4);
  // Camera ahead of the car (east), looking back west at it.
  game.cameraYaw = -Math.PI / 2 + 0.35;
  game.cameraPitch = 0.3;
  game.cameraDistance = 13;
  settle(game, 0.9);
  game.freezeWorld = true;
  return { ready: true };
}

function stageFoot(game, seed) {
  // On foot on a busy sidewalk: traffic passing on the avenue beside the
  // player, pedestrians around, 0 stars.
  game.startFreeRoam();
  game.warpPlayerOnFoot(-70, -60, 0);
  game.people.addPed(-70, -48);
  game.people.addPed(-70, -72);
  game.people.addPed(-66, -40);
  game.cameraYaw = 0;
  game.cameraPitch = 0.35;
  game.cameraDistance = 9;
  settle(game, 2.5);
  game.freezeWorld = true;
  return { ready: true };
}

function stageDrive(game, seed) {
  // Driving east along 5th Avenue through a downtown intersection, traffic on
  // both streets.
  game.startFreeRoam();
  game.warpPlayerToCar(-120, 60, Math.PI / 2, 22);
  game.cameraYaw = Math.PI / 2;
  game.cameraPitch = 0.35;
  game.cameraDistance = 12;
  settle(game, 2.0);
  game.freezeWorld = true;
  return { ready: true };
}

function stageMission(game, seed) {
  // The Package in progress: Dario on foot at the Docks, the gold beacon and
  // the pickup ring ahead, 1 star from a bumped pedestrian.
  game.startFreeRoam();
  game.missions.start(1);
  game.warpPlayerOnFoot(-186, 138, -0.4);
  game.police.setStars(1);
  game.cameraYaw = -0.5;
  game.cameraDistance = 10;
  settle(game, 1.6);
  game.freezeWorld = true;
  return { ready: true };
}
