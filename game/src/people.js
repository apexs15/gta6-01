// People: the player on foot, pedestrians strolling the sidewalks, and police
// officers on foot. All low-poly originals built from boxes and spheres.
import * as THREE from 'three';
import { CITY, PLAYER } from './config.js';
import { makeRng, pick, range, clamp, angleLerp, dist2D } from './random.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x37474f];

function makePersonMesh(shirt, pants, skin = 0xd9a066) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x2b2118 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
  hair.position.y = 1.76;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pantsMat);
  legL.position.set(-0.17, 0.36, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirtMat);
  armL.position.set(-0.42, 1.12, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export class People {
  constructor(scene, city, seed = 21) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed);
    this.peds = [];
    this.spawn();
  }

  spawn() {
    for (let i = 0; i < 22; i += 1) this.addPed();
  }

  addPed(x, z) {
    const rng = this.rng;
    const p = x === undefined ? this.city.randomRoadPoint(rng) : { x, z };
    const mesh = makePersonMesh(pick(rng, SHIRTS), pick(rng, PANTS));
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    const ped = {
      mesh,
      heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.1, 2.0),
      target: this.randomSidewalkPoint(rng),
      walkPhase: range(rng, 0, Math.PI * 2),
      fleeing: 0,
      alive: true,
    };
    this.peds.push(ped);
    return ped;
  }

  randomSidewalkPoint(rng) {
    const road = pick(rng, CITY.roads);
    const along = range(rng, -190, 190);
    const side = rng() < 0.5 ? -10 : 10;
    if (rng() < 0.5) return { x: along, z: road + side };
    return { x: road + side, z: along };
  }

  update(dt, playerPos, dangerPos) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      const pos = ped.mesh.position;
      // Flee from a nearby car or gunshot.
      if (dangerPos && dist2D(pos.x, pos.z, dangerPos.x, dangerPos.z) < 14) ped.fleeing = 2.5;
      if (ped.fleeing > 0) {
        ped.fleeing -= dt;
        const away = Math.atan2(pos.x - dangerPos.x, pos.z - dangerPos.z);
        ped.heading = angleLerp(ped.heading, away, Math.min(1, dt * 6));
        const sp = 5.5;
        pos.x += Math.sin(ped.heading) * sp * dt;
        pos.z += Math.cos(ped.heading) * sp * dt;
      } else {
        if (dist2D(pos.x, pos.z, ped.target.x, ped.target.z) < 2) {
          ped.target = this.randomSidewalkPoint(this.rng);
        }
        const want = Math.atan2(ped.target.x - pos.x, ped.target.z - pos.z);
        ped.heading = angleLerp(ped.heading, want, Math.min(1, dt * 3));
        pos.x += Math.sin(ped.heading) * ped.speed * dt;
        pos.z += Math.cos(ped.heading) * ped.speed * dt;
      }
      pos.x = clamp(pos.x, -CITY.bound, CITY.bound);
      pos.z = clamp(pos.z, -CITY.bound, CITY.bound);
      const [cx, cz] = this.city.collideCircle(pos.x, pos.z, 0.5);
      pos.x = cx;
      pos.z = cz;
      // Walk cycle: legs and arms swing.
      ped.walkPhase += dt * (ped.fleeing > 0 ? 11 : 6);
      const swing = Math.sin(ped.walkPhase) * 0.55;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.8;
      ped.mesh.userData.armR.rotation.x = swing * 0.8;
      ped.mesh.rotation.y = ped.heading;
    }
  }

  remove(ped) {
    this.scene.remove(ped.mesh);
    this.peds = this.peds.filter((p) => p !== ped);
  }
}

// The player character on foot.
export class Player {
  constructor(scene) {
    this.mesh = makePersonMesh(0x2ecc71, 0x2c3e50, 0xc98d5f);
    // A green jacket + cap so the player reads at a glance.
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x1d5c2e }),
    );
    cap.position.y = 1.92;
    this.mesh.add(cap);
    scene.add(this.mesh);
    this.heading = 0;
    this.speed = 0;
    this.walkPhase = 0;
    this.health = PLAYER.health;
  }

  update(dt, input, cameraYaw, city, cars) {
    const move = input.move();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const targetSpeed = (move.fwd !== 0 || move.strafe !== 0)
      ? (sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed)
      : 0;
    this.speed += clamp(targetSpeed - this.speed, -40 * dt, 22 * dt);
    if (this.speed > 0.1) {
      // Movement is relative to the camera yaw.
      const fwdX = Math.sin(cameraYaw);
      const fwdZ = Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);
      const len = Math.hypot(move.fwd, move.strafe) || 1;
      const mx = (fwdX * move.fwd + rightX * move.strafe) / len;
      const mz = (fwdZ * move.fwd + rightZ * move.strafe) / len;
      const wantHeading = Math.atan2(mx, mz);
      this.heading = angleLerp(this.heading, wantHeading, Math.min(1, dt * PLAYER.turnSpeed));
      const nx = this.mesh.position.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.mesh.position.z + Math.cos(this.heading) * this.speed * dt;
      const [cx, cz] = city.collideCircle(nx, nz, PLAYER.radius);
      this.mesh.position.x = clamp(cx, -CITY.bound, CITY.bound);
      this.mesh.position.z = clamp(cz, -CITY.bound, CITY.bound);
      // Soft push from cars (a car nudges the player, it does not pass through).
      for (const car of cars) {
        const dx = this.mesh.position.x - car.mesh.position.x;
        const dz = this.mesh.position.z - car.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.2 && d > 0.01) {
          this.mesh.position.x += (dx / d) * (2.2 - d);
          this.mesh.position.z += (dz / d) * (2.2 - d);
        }
      }
      this.walkPhase += dt * this.speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.6;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
      this.mesh.userData.armL.rotation.x = -swing * 0.7;
      this.mesh.userData.armR.rotation.x = swing * 0.7;
    } else {
      this.mesh.userData.legL.rotation.x *= 0.8;
      this.mesh.userData.legR.rotation.x *= 0.8;
      this.mesh.userData.armL.rotation.x *= 0.8;
      this.mesh.userData.armR.rotation.x *= 0.8;
    }
    this.mesh.rotation.y = this.heading;
  }
}
