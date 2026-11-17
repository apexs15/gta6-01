// Solara Bay — combat and the wanted system: shooting, police pursuit,
// arrests (BUSTED) and death (WASTED).

import * as THREE from 'three';
import { WEAPON, WANTED, CAR } from './config.js';
import { playGunshot, startSiren, stopSiren } from './audio.js';
import { randomRoadPoint } from './city.js';

export function makePoliceCarMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 4.4), new THREE.MeshLambertMaterial({ color: 0x181818 }));
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  bar.position.set(0, 1.55, -0.2);
  g.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.45), new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0x991111 }));
  red.position.set(-0.3, 1.68, -0.2);
  red.name = 'lightRed';
  g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.45), new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x111199 }));
  blue.position.set(0.3, 1.68, -0.2);
  blue.name = 'lightBlue';
  g.add(blue);
  return g;
}

export class Combat {
  constructor(scene, traffic, getPlayer) {
    this.scene = scene;
    this.traffic = traffic;
    this.getPlayer = getPlayer;
    this.ammo = WEAPON.MAG;
    this.reloading = false;
    this.reloadTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = WEAPON.RANGE;
    this.police = [];
    this.wanted = 0;
    this.decayTimer = 0;
    this.arrestTimer = 0;
    this.flash = new THREE.PointLight(0xffcc66, 0, 12);
    this.scene.add(this.flash);
    this.muzzleTimer = 0;
  }

  addWanted(n) {
    const before = this.wanted;
    this.wanted = Math.max(0, Math.min(WANTED.MAX, this.wanted + n));
    if (this.wanted > 0 && before === 0) startSiren();
    if (this.wanted === 0) stopSiren();
    this.decayTimer = 0;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(WANTED.MAX, n));
    if (this.wanted > 0) startSiren();
    else stopSiren();
  }

  shoot(camera, onHitPed, onHitPolice) {
    if (this.reloading || this.ammo <= 0) return 'empty';
    this.ammo--;
    playGunshot();
    this.muzzleTimer = 0.06;
    const p = this.getPlayer();
    if (p) this.flash.position.set(p.x, p.y + 1.6, p.z);
    this.flash.intensity = 6;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const targets = [];
    for (const ped of this.traffic.peds) {
      if (!ped.dead) targets.push(ped.mesh);
    }
    for (const car of this.traffic.cars) {
      if (!car.dead && !car.isPlayer) targets.push(car.mesh);
    }
    for (const cop of this.police) {
      if (!cop.dead) targets.push(cop.mesh);
    }
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.kind) obj = obj.parent;
      const kind = obj ? obj.userData.kind : null;
      if (kind === 'ped') {
        const ped = this.traffic.peds.find((x) => x.mesh === obj);
        if (ped && !ped.dead) {
          ped.dead = true;
          ped.mesh.rotation.x = -Math.PI / 2;
          ped.mesh.position.y = 0.3;
          this.addWanted(WANTED.KILL_PED);
          if (onHitPed) onHitPed(ped);
          return 'ped';
        }
      }
      if (kind === 'car') {
        const car = this.traffic.cars.find((x) => x.mesh === obj);
        if (car && !car.dead) {
          car.hp -= 1;
          if (car.hp <= 0) {
            car.dead = true;
            car.mesh.rotation.z = 0.25;
          }
          return 'car';
        }
      }
      if (kind === 'police') {
        const cop = this.police.find((x) => x.mesh === obj);
        if (cop && !cop.dead) {
          cop.hp -= 1;
          if (cop.hp <= 0) {
            cop.dead = true;
            cop.mesh.rotation.z = 0.3;
            this.addWanted(WANTED.KILL_COP);
            if (onHitPolice) onHitPolice(cop);
            return 'police-down';
          }
          return 'police-hit';
        }
      }
      return 'hit';
    }
    return 'miss';
  }

  reload() {
    if (this.reloading || this.ammo === WEAPON.MAG) return;
    this.reloading = true;
    this.reloadTimer = WEAPON.RELOAD_MS / 1000;
  }

  spawnPoliceNear(x, z) {
    const spot = randomRoadPoint(55, x, z);
    const mesh = makePoliceCarMesh();
    mesh.position.set(spot.x, 0, spot.z);
    mesh.userData.kind = 'police';
    this.scene.add(mesh);
    const cop = {
      mesh,
      heading: 0,
      speed: 0,
      hp: 3,
      dead: false,
      ramCooldown: 0,
      flashPhase: Math.random() * 2,
    };
    this.police.push(cop);
    return cop;
  }

  update(dt, player, playerInCar, onBusted, onWasted, onRam) {
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) this.flash.intensity = 0;
    }
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = WEAPON.MAG;
      }
    }
    // Wanted decay: no crime and no cop close by for a while.
    if (this.wanted > 0) {
      const nearCop = this.police.some((c) => !c.dead && Math.hypot(c.mesh.position.x - player.x, c.mesh.position.z - player.z) < 45);
      if (!nearCop) {
        this.decayTimer += dt;
        if (this.decayTimer >= WANTED.DECAY_SECONDS) {
          this.decayTimer = 0;
          this.addWanted(-1);
        }
      } else {
        this.decayTimer = 0;
      }
    }
    // Keep the right number of police cars on the street.
    const wantCops = Math.min(this.wanted, WANTED.MAX);
    const liveCops = this.police.filter((c) => !c.dead).length;
    if (liveCops < wantCops) this.spawnPoliceNear(player.x, player.z);
    if (this.wanted === 0) {
      for (const cop of this.police) {
        if (!cop.dead && Math.hypot(cop.mesh.position.x - player.x, cop.mesh.position.z - player.z) > 160) {
          cop.dead = true;
          this.scene.remove(cop.mesh);
        }
      }
      this.police = this.police.filter((c) => !c.dead || c.mesh.parent);
    }
    // Police pursuit.
    let arresting = false;
    for (const cop of this.police) {
      if (cop.dead) continue;
      cop.flashPhase += dt * 6;
      const red = cop.mesh.getObjectByName('lightRed');
      const blue = cop.mesh.getObjectByName('lightBlue');
      if (red) red.material.emissive.setHex(Math.sin(cop.flashPhase) > 0 ? 0xff0000 : 0x220000);
      if (blue) blue.material.emissive.setHex(Math.sin(cop.flashPhase) > 0 ? 0x000022 : 0x0000ff);
      const dx = player.x - cop.mesh.position.x;
      const dz = player.z - cop.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - cop.heading;
      while (diff >= Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Close in: slow down as the gap closes and turn harder, so the car
      // can actually reach the player instead of orbiting at full speed.
      const turnRate = dist < 18 ? 4.0 : 2.2;
      cop.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
      const targetSpeed = dist > 30 ? Math.min(30 + this.wanted * 1.5, 38) : Math.max(4, dist * 1.1);
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 0.8);
      cop.mesh.position.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.mesh.position.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.mesh.rotation.y = cop.heading;
      cop.ramCooldown = Math.max(0, cop.ramCooldown - dt);
      if (dist < 3.2) {
        if (playerInCar) {
          if (cop.ramCooldown <= 0) {
            cop.ramCooldown = 1.2;
            if (onRam) onRam(10);
          }
          cop.speed *= 0.4;
        } else {
          arresting = true;
        }
      }
    }
    if (arresting) {
      this.arrestTimer += dt;
      if (this.arrestTimer >= 1.2) {
        this.arrestTimer = 0;
        if (onBusted) onBusted();
      }
    } else {
      this.arrestTimer = 0;
    }
  }
}
