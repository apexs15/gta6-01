// Solara Bay — traffic and pedestrians. Cars loop the block grid on the
// right-hand lane; pedestrians stroll the sidewalks and run from gunfire.

import * as THREE from 'three';
import { WORLD, TRAFFIC } from './config.js';
import { playHonk } from './audio.js';

const CAR_COLORS = [0xc04030, 0x3040a0, 0xd8c040, 0x40a060, 0xd8d8d8, 0x303030, 0xa060c0, 0xe08030];
const PED_COLORS = [0xd8a080, 0x80a0d8, 0xa0d880, 0xd88080, 0xc0c0c0, 0x806040];

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x181818 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xf0f0f0 : 0x222831 })
  );
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.55, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.45), new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0x881111 }));
    red.position.set(-0.3, 1.68, -0.2);
    red.name = 'lightRed';
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.45), new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x111188 }));
    blue.position.set(0.3, 1.68, -0.2);
    blue.name = 'lightBlue';
    g.add(blue);
  }
  return g;
}

function makePedMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.32), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
  head.position.y = 1.75;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), legMat);
    leg.position.set(lx, 0.28, 0);
    leg.name = 'leg' + (lx < 0 ? 'L' : 'R');
    g.add(leg);
  }
  return g;
}

// A rectangular loop around one block: waypoints at the four corners,
// driven on the right-hand lane (offset 2.5 from the road centre).
function blockLoop(bx, bz) {
  const half = 25;
  const off = 2.5;
  return [
    { x: bx - half + off, z: bz - half + off },
    { x: bx + half - off, z: bz - half + off },
    { x: bx + half - off, z: bz + half - off },
    { x: bx - half + off, z: bz + half - off },
  ];
}

export class TrafficManager {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.cars = [];
    this.peds = [];
    this.honkCooldown = 0;
    this.centres = [-125, -75, -25, 25, 75, 125];
    for (let i = 0; i < TRAFFIC.CARS; i++) this.spawnCar();
    for (let i = 0; i < TRAFFIC.PEDS; i++) this.spawnPed();
  }

  spawnCar() {
    const bx = this.centres[Math.floor(Math.random() * this.centres.length)];
    const bz = this.centres[Math.floor(Math.random() * this.centres.length)];
    const mesh = makeCarMesh(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], false);
    mesh.userData.kind = 'car';
    const loop = blockLoop(bx, bz);
    const start = loop[Math.floor(Math.random() * loop.length)];
    mesh.position.set(start.x, 0, start.z);
    this.scene.add(mesh);
    const car = {
      mesh,
      loop,
      wp: 1,
      speed: rand(TRAFFIC.CAR_SPEED_MIN, TRAFFIC.CAR_SPEED_MAX),
      heading: 0,
      stopped: false,
      stopTimer: 0,
      isPlayer: false,
      isPolice: false,
      hp: 3,
      dead: false,
    };
    this.cars.push(car);
    return car;
  }

  spawnPed() {
    const mesh = makePedMesh(PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)]);
    mesh.userData.kind = 'ped';
    const x = rand(-155, 155);
    const z = rand(-155, 155);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      mesh,
      target: this.randomWalkTarget(x, z),
      speed: TRAFFIC.PED_SPEED,
      flee: 0,
      fleeX: 0,
      fleeZ: 0,
      dead: false,
      walkPhase: Math.random() * 6,
    };
    this.peds.push(ped);
    return ped;
  }

  randomWalkTarget(x, z) {
    return { x: Math.max(-155, Math.min(155, x + rand(-40, 40))), z: Math.max(-155, Math.min(155, z + rand(-40, 40))) };
  }

  // Gunfire nearby: every pedestrian within range runs away from the shot.
  scarePeds(x, z, range) {
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < range) {
        p.flee = 3;
        const a = Math.atan2(p.mesh.position.x - x, p.mesh.position.z - z);
        p.fleeX = Math.sin(a);
        p.fleeZ = Math.cos(a);
      }
    }
  }

  carAhead(car) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const other of this.cars) {
      if (other === car || other.dead) continue;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 9 && side < 2.2) return other;
    }
    return null;
  }

  update(dt, playerPos, playerInCar) {
    this.honkCooldown = Math.max(0, this.honkCooldown - dt);
    for (const car of this.cars) {
      if (car.dead || car.isPlayer) continue;
      const target = car.loop[car.wp];
      const dx = target.x - car.mesh.position.x;
      const dz = target.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        car.wp = (car.wp + 1) % car.loop.length;
        continue;
      }
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      const blocker = this.carAhead(car);
      let blockedByPlayer = false;
      if (playerPos && !playerInCar) {
        const pdx = playerPos.x - car.mesh.position.x;
        const pdz = playerPos.z - car.mesh.position.z;
        const along = pdx * Math.sin(car.heading) + pdz * Math.cos(car.heading);
        const side = Math.abs(pdx * Math.cos(car.heading) - pdz * Math.sin(car.heading));
        blockedByPlayer = along > 0 && along < 8 && side < 2.2;
      }
      if (blocker || blockedByPlayer) {
        car.stopped = true;
        car.stopTimer += dt;
        if (car.stopTimer > 2.5 && this.honkCooldown <= 0) {
          playHonk();
          this.honkCooldown = 4;
          car.stopTimer = 0;
        }
        continue;
      }
      car.stopped = false;
      car.stopTimer = 0;
      car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
      car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
    }
    for (const p of this.peds) {
      if (p.dead) continue;
      p.walkPhase += dt * 6;
      const legL = p.mesh.getObjectByName('legL');
      const legR = p.mesh.getObjectByName('legR');
      if (legL) legL.rotation.x = Math.sin(p.walkPhase) * 0.5;
      if (legR) legR.rotation.x = -Math.sin(p.walkPhase) * 0.5;
      let tx, tz, sp;
      if (p.flee > 0) {
        p.flee -= dt;
        tx = p.mesh.position.x + p.fleeX * 10;
        tz = p.mesh.position.z + p.fleeZ * 10;
        sp = TRAFFIC.PED_FLEE_SPEED;
      } else {
        tx = p.target.x;
        tz = p.target.z;
        sp = p.speed;
        if (Math.hypot(tx - p.mesh.position.x, tz - p.mesh.position.z) < 2) {
          p.target = this.randomWalkTarget(p.mesh.position.x, p.mesh.position.z);
          continue;
        }
      }
      const dx = tx - p.mesh.position.x;
      const dz = tz - p.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        p.mesh.position.x += (dx / d) * sp * dt;
        p.mesh.position.z += (dz / d) * sp * dt;
        p.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
  }
}
