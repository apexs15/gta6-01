// Solara Bay — game bootstrap: renderer, player, driving, camera, the loop,
// save/load, BUSTED / WASTED / story-complete, and the start screen.

import * as THREE from 'three';
import { WORLD, LANDMARKS, PLAYER, CAR, WEAPON, WANTED, MISSIONS } from './config.js';
import { buildCity } from './city.js';
import { TrafficManager } from './traffic.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import {
  ensureAudio, startEngine, setEngine, stopEngine, playClick, playBusted,
  startSiren, stopSiren,
} from './audio.js';

const SAVE_KEY = 'solara-bay-save-v1';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function resolveCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = clamp(pos.x, c.minX, c.maxX);
    const cz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 0.0001) {
        pos.x = c.maxX + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      }
    }
  }
}

// Entry parameter t (0..1) where the segment (px,pz) + t*(dx,dz) first
// enters the 2D box, or null if it never does. Slab method.
function segmentBoxT(px, pz, dx, dz, box) {
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (px < box.minX || px > box.maxX) return null;
  } else {
    let t1 = (box.minX - px) / dx;
    let t2 = (box.maxX - px) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dz) < 1e-9) {
    if (pz < box.minZ || pz > box.maxZ) return null;
  } else {
    let t1 = (box.minZ - pz) / dz;
    let t2 = (box.maxZ - pz) / dz;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

function makePlayerMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 0.36), new THREE.MeshLambertMaterial({ color: 0x2a6a4a }));
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
  head.position.y = 1.78;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  cap.position.y = 1.98;
  g.add(cap);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.55), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.32, 1.25, 0.3);
  gun.name = 'gun';
  g.add(gun);
  return g;
}

class Game {
  constructor() {
    this.started = false;
    this.over = null;
    this.overTimer = 0;
    this.health = PLAYER.HEALTH;
    this.cash = PLAYER.START_CASH;
    this.heading = 0;
    this.pos = new THREE.Vector3(LANDMARKS.plaza.x, 0, LANDMARKS.plaza.z);
    this.car = null;
    this.carSpeed = 0;
    this.carHeading = 0;
    // Camera yaw: its own state. Arrow keys nudge it; it follows the
    // player's heading slowly while moving. Movement is relative to it,
    // never to the heading directly — otherwise walking backwards spins
    // the player forever, because the camera would swing with the turn.
    this.camYaw = 0;
    this.lastDamageAt = 0;
    this.time = 0;
    this.shootCooldown = 0;
    this.crimeCooldown = 0;
    this.saveTimer = 0;
    this.camPos = new THREE.Vector3();
    this.camInit = false;

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d9);
    this.scene.fog = new THREE.Fog(0x87b5d9, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
    sun.position.set(120, 180, 60);
    this.scene.add(sun);

    const { colliders } = buildCity(this.scene);
    this.colliders = colliders;
    this.traffic = new TrafficManager(this.scene, colliders);
    this.combat = new Combat(this.scene, this.traffic, () => ({ x: this.pos.x, y: 0, z: this.pos.z }));
    this.missions = new MissionManager(this.scene);
    this.hud = new Hud();
    this.input = new Input(canvas);
    this.playerMesh = makePlayerMesh();
    this.scene.add(this.playerMesh);

    this.missions.onReward = (amount, mission) => {
      this.cash += amount;
      this.hud.toast(`Job done: ${mission.name} — +$${amount}`);
      this.save();
    };
    this.missions.onStoryComplete = () => {
      this.showOverlay('story');
    };
    this.missions.onStep = (mission, step) => {
      if (mission && step) this.hud.toast(`${mission.name}: ${step.label}`);
    };
    this.missions.onHeat = () => {
      this.combat.setWanted(2);
      this.hud.toast('The heat is on — 2 stars!');
    };
    this.hud.onPickJob = (i) => this.tryStartMission(i);

    this.input.onKey = (code) => {
      if (!this.started || this.over) return;
      if (code === 'KeyP') {
        const open = !this.hud.isPhoneOpen();
        this.hud.setPhoneOpen(open);
        playClick();
      }
      if (code === 'KeyE') this.tryInteract();
      if (code === 'KeyR') this.combat.reload();
      if (code === 'KeyF') this.tryShoot();
      if (code >= 'Digit1' && code <= 'Digit5') {
        this.tryStartMission(Number(code.slice(5)) - 1);
      }
    };
    this.input.onShoot = () => {
      if (this.started && !this.over) this.tryShoot();
    };

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.wireStartScreen();
    this.exposeDebug();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  wireStartScreen() {
    const startBtn = document.getElementById('btn-start');
    const contBtn = document.getElementById('btn-continue');
    const hasSave = !!localStorage.getItem(SAVE_KEY);
    if (contBtn) contBtn.style.display = hasSave ? 'block' : 'none';
    if (startBtn) startBtn.addEventListener('click', () => this.begin(false));
    if (contBtn) contBtn.addEventListener('click', () => this.begin(true));
    const params = new URLSearchParams(location.search);
    if (params.has('autostart')) this.begin(hasSave);
  }

  begin(loadSave) {
    ensureAudio();
    if (loadSave) this.load();
    document.getElementById('start-screen').classList.add('hidden');
    this.started = true;
    this.hud.toast(loadSave ? 'Welcome back to Solara Bay' : 'Welcome to Solara Bay — press P for jobs');
  }

  exposeDebug() {
    window.__solara = {
      state: () => ({
        health: this.health,
        cash: this.cash,
        wanted: this.combat.wanted,
        ammo: this.combat.ammo,
        mission: this.missions.active ? this.missions.active.id : null,
        missionStep: this.missions.stepIndex,
        done: [...this.missions.done],
        inCar: !!this.car,
        speedKmh: Math.abs(this.carSpeed) * 3.6,
        px: this.pos.x,
        pz: this.pos.z,
        heading: this.heading,
        started: this.started,
        over: this.over,
      }),
      teleport: (x, z) => {
        this.pos.x = x;
        this.pos.z = z;
        if (this.car) {
          this.car.mesh.position.x = x;
          this.car.mesh.position.z = z;
        }
        this.camInit = false;
      },
      cars: () => this.traffic.cars.filter((c) => !c.dead).map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z, heading: c.heading, player: c.isPlayer })),
      cam: () => ({ x: this.camPos.x, y: this.camPos.y, z: this.camPos.z, yaw: this.camYaw }),
      peds: () => this.traffic.peds.filter((p) => !p.dead).map((p) => ({ x: p.mesh.position.x, z: p.mesh.position.z })),
      police: () => this.combat.police.filter((c) => !c.dead).map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
      setWanted: (n) => this.combat.setWanted(n),
      damage: (n) => this.hurt(n),
      startMission: (i) => this.tryStartMission(i),
      save: () => this.save(),
    };
  }

  tryStartMission(i) {
    if (!this.started || this.over) return false;
    if (this.missions.active) {
      this.hud.toast('Finish your current job first');
      return false;
    }
    if (this.missions.done.has(MISSIONS[i].id)) {
      this.hud.toast('Job already done');
      return false;
    }
    const ok = this.missions.start(i);
    if (ok) {
      this.hud.setPhoneOpen(false);
      this.hud.markJobsDone(this.missions.done, this.missions.activeIndex);
    }
    return ok;
  }

  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.traffic.cars) {
      if (car.dead || car.isPlayer) continue;
      const d = Math.hypot(car.mesh.position.x - this.pos.x, car.mesh.position.z - this.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  tryInteract() {
    if (!this.started || this.over) return;
    if (this.car) {
      if (Math.abs(this.carSpeed) < 2) this.exitCar();
      return;
    }
    const car = this.nearestCar(4.5);
    if (car) {
      this.enterCar(car);
      return;
    }
  }

  enterCar(car) {
    car.isPlayer = true;
    car.stopped = false;
    this.car = car;
    this.carSpeed = 0;
    this.carHeading = car.heading;
    this.playerMesh.visible = false;
    this.combat.addWanted(WANTED.STEAL_CAR);
    this.hud.toast('Car stolen — the cops noticed!');
    startEngine();
  }

  exitCar() {
    const car = this.car;
    if (!car) return;
    car.isPlayer = false;
    this.car = null;
    this.carSpeed = 0;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.pos.x = car.mesh.position.x + side.x * 2.2;
    this.pos.z = car.mesh.position.z + side.z * 2.2;
    this.heading = car.heading;
    this.camYaw = car.heading;
    this.playerMesh.visible = true;
    stopEngine();
  }

  tryShoot() {
    if (this.car || this.shootCooldown > 0) return;
    this.shootCooldown = 0.22;
    const result = this.combat.shoot(this.camera, () => {
      this.hud.toast('Pedestrian down — the cops are coming');
    });
    if (result === 'empty') {
      this.combat.reload();
      return;
    }
    if (this.crimeCooldown <= 0) {
      this.combat.addWanted(WANTED.SHOOT);
      this.crimeCooldown = 6;
    }
    this.traffic.scarePeds(this.pos.x, this.pos.z, 35);
  }

  hurt(amount) {
    if (this.over) return;
    if (this.time - this.lastDamageAt < 0.9 && amount < 50) return;
    this.lastDamageAt = this.time;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.die('wasted');
    }
  }

  die(kind) {
    if (this.over) return;
    this.over = kind;
    this.overTimer = 0;
    playBusted();
    stopSiren();
    if (this.car) this.exitCar();
    this.showOverlay(kind);
  }

  busted() {
    this.die('busted');
  }

  showOverlay(kind) {
    const el = document.getElementById(kind === 'busted' ? 'busted' : kind === 'wasted' ? 'wasted' : 'story');
    if (el) el.classList.remove('hidden');
  }

  hideOverlays() {
    for (const id of ['busted', 'wasted', 'story']) {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    }
  }

  respawn() {
    const fine = Math.floor(this.cash * WANTED.BUSTED_FINE);
    this.cash -= fine;
    this.health = PLAYER.HEALTH;
    this.combat.setWanted(0);
    this.combat.ammo = WEAPON.MAG;
    this.pos.set(LANDMARKS.clinic.x + 14, 0, LANDMARKS.clinic.z);
    this.heading = 0;
    this.camInit = false;
    this.over = null;
    this.hideOverlays();
    this.hud.toast(`You paid a $${fine} fine at Bay Clinic`);
    this.save();
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        mission: this.missions.activeIndex,
        done: [...this.missions.done],
        x: this.pos.x,
        z: this.pos.z,
        health: this.health,
      }));
    } catch { /* storage unavailable */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.cash = s.cash ?? PLAYER.START_CASH;
      this.health = s.health ?? PLAYER.HEALTH;
      this.pos.set(s.x ?? LANDMARKS.plaza.x, 0, s.z ?? LANDMARKS.plaza.z);
      if (Array.isArray(s.done)) this.missions.done = new Set(s.done);
      if (typeof s.mission === 'number' && s.mission >= 0) this.missions.start(s.mission);
      this.hud.markJobsDone(this.missions.done, this.missions.activeIndex);
    } catch { /* bad save */ }
  }

  updatePlayer(dt) {
    const mv = this.input.moveVector();
    const camYaw = this.camYaw;
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let mx = fx * -mv.z + rx * mv.x;
    let mz = fz * -mv.z + rz * mv.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const speed = this.input.run ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
      const wantHeading = Math.atan2(mx, mz);
      let diff = wantHeading - this.heading;
      // Normalize to (-PI, PI]: the >= on the upper bound matters — with a
      // plain > the sign flips every frame when the target is exactly
      // behind the player, and the turn oscillates instead of completing.
      while (diff >= Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += clamp(diff, -PLAYER.TURN_SPEED * dt * 3, PLAYER.TURN_SPEED * dt * 3);
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      // The camera follows the new heading slowly, but only while the
      // player moves forwards. While backing up or strafing it stays put —
      // otherwise the movement basis would rotate with the turn and the
      // player would keep spinning instead of stopping facing the camera.
      if (mv.z < -0.1) {
        let follow = this.heading - this.camYaw;
        while (follow >= Math.PI) follow -= Math.PI * 2;
        while (follow < -Math.PI) follow += Math.PI * 2;
        this.camYaw += clamp(follow, -0.9 * dt, 0.9 * dt);
      }
    }
    this.pos.x = clamp(this.pos.x, -170, 176.5);
    this.pos.z = clamp(this.pos.z, -170, 170);
    resolveCircle(this.pos, PLAYER.RADIUS, this.colliders);
    this.playerMesh.position.copy(this.pos);
    this.playerMesh.rotation.y = this.heading;
    // Walk bob.
    const bob = len > 0.01 ? Math.sin(this.time * 11) * 0.05 : 0;
    this.playerMesh.position.y = bob;
  }

  updateCar(dt) {
    const car = this.car;
    if (!car) return;
    const fwd = this.input.down('KeyW') || this.input.down('ArrowUp');
    const back = this.input.down('KeyS') || this.input.down('ArrowDown');
    const left = this.input.down('KeyA');
    const right = this.input.down('KeyD');
    if (fwd) this.carSpeed += CAR.ACCEL * dt;
    if (back) {
      this.carSpeed -= this.carSpeed > 0.5 ? CAR.BRAKE * dt : CAR.ACCEL * 0.6 * dt;
    }
    if (!fwd && !back) {
      this.carSpeed -= this.carSpeed * Math.min(1, dt * 1.4);
      if (Math.abs(this.carSpeed) < 0.2) this.carSpeed = 0;
    }
    this.carSpeed = clamp(this.carSpeed, -CAR.MAX_REVERSE, CAR.MAX_SPEED);
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const steerAuthority = clamp(Math.abs(this.carSpeed) / 8, 0, 1);
    this.carHeading += steerInput * CAR.STEER * steerAuthority * dt * Math.sign(this.carSpeed || 1);
    car.heading = this.carHeading;
    car.mesh.position.x += Math.sin(this.carHeading) * this.carSpeed * dt;
    car.mesh.position.z += Math.cos(this.carHeading) * this.carSpeed * dt;
    car.mesh.rotation.y = this.carHeading;
    car.mesh.position.x = clamp(car.mesh.position.x, -170, 176.5);
    car.mesh.position.z = clamp(car.mesh.position.z, -170, 170);
    resolveCircle(car.mesh.position, 1.6, this.colliders);
    this.pos.copy(car.mesh.position);
    this.heading = this.carHeading;
    // The camera follows the car's heading while driving.
    let follow = this.carHeading - this.camYaw;
    while (follow >= Math.PI) follow -= Math.PI * 2;
    while (follow < -Math.PI) follow += Math.PI * 2;
    this.camYaw += clamp(follow, -1.5 * dt, 1.5 * dt);
    // Bump into other traffic.
    for (const other of this.traffic.cars) {
      if (other === car || other.dead || other.isPlayer) continue;
      const dx = car.mesh.position.x - other.mesh.position.x;
      const dz = car.mesh.position.z - other.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        car.mesh.position.x += (dx / d) * push;
        car.mesh.position.z += (dz / d) * push;
        this.carSpeed *= 0.82;
      }
    }
    setEngine(true, Math.abs(this.carSpeed) / CAR.MAX_SPEED);
  }

  updateCamera(dt) {
    const target = this.car ? this.car.mesh.position : this.pos;
    const heading = this.car ? this.carHeading : this.heading;
    const dist = this.car ? 13 : 8.5;
    const height = this.car ? 6 : 4.2;
    const camDir = this.camYaw + Math.PI;
    const want = new THREE.Vector3(
      target.x + Math.sin(camDir) * dist,
      height,
      target.z + Math.cos(camDir) * dist
    );
    // Camera collision: never let the camera end up inside a building.
    // Shorten the player->camera segment at the first collider it crosses,
    // so walking up to a wall pulls the camera in instead of clipping in.
    const segX = want.x - target.x;
    const segZ = want.z - target.z;
    let bestT = 1;
    for (const c of this.colliders) {
      const t = segmentBoxT(target.x, target.z, segX, segZ, c);
      if (t !== null && t < bestT) bestT = t;
    }
    if (bestT < 1) {
      const k = Math.max(0.15, bestT - 0.05);
      want.x = target.x + segX * k;
      want.z = target.z + segZ * k;
    }
    if (!this.camInit || this.camPos.distanceTo(want) > 40) {
      this.camPos.copy(want);
      this.camInit = true;
    } else {
      this.camPos.lerp(want, Math.min(1, dt * 6));
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target.x + Math.sin(heading) * 3, 1.6, target.z + Math.cos(heading) * 3);
  }

  frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, this.time ? now - this.time : 0.016);
    this.time = now;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);

    if (this.started && !this.over) {
      // Arrow-key camera nudges apply to the camera yaw directly.
      this.camYaw += this.input.takeOrbit();
      if (this.car) this.updateCar(dt);
      else this.updatePlayer(dt);
      this.traffic.update(dt, this.pos, !!this.car);
      this.combat.update(dt, this.pos, !!this.car,
        () => this.busted(),
        () => this.die('wasted'),
        (dmg) => this.hurt(dmg));
      // Mission progress.
      const ev = this.missions.update(dt, this.pos.x, this.pos.z, !!this.car, this.input.interactHeld);
      if (ev === 'failed') this.hud.toast('Mission failed — check the phone for the next job');
      if (ev === 'holding') {
        const step = this.missions.step;
        if (step) this.hud.toast(`Cracking the vault… ${Math.ceil(this.missions.holdMs / 100) / 10}s`, 0.4);
      }
      if (ev) this.hud.markJobsDone(this.missions.done, this.missions.activeIndex);
      // Slow health regen while the heat is off.
      if (this.combat.wanted === 0 && this.health < PLAYER.HEALTH) {
        this.health = Math.min(PLAYER.HEALTH, this.health + 1.5 * dt);
      }
      this.saveTimer += dt;
      if (this.saveTimer > 12) {
        this.saveTimer = 0;
        this.save();
      }
      this.updateCamera(dt);
    }

    if (this.over) {
      this.overTimer += dt;
      if (this.overTimer > 3) this.respawn();
    }

    // Beacon pulse.
    if (this.missions.beacon && this.missions.beacon.visible) {
      const s = 1 + Math.sin(this.time * 4) * 0.12;
      this.missions.beacon.scale.set(s, 1, s);
    }

    // HUD state.
    const step = this.missions.step;
    const marker = step ? this.missions.stepPos(step) : null;
    this.hud.update(dt, {
      health: this.health,
      cash: this.cash,
      wanted: this.combat.wanted,
      ammo: this.combat.ammo,
      reloading: this.combat.reloading,
      speedKmh: Math.abs(this.carSpeed) * 3.6,
      inCar: !!this.car,
      missionName: this.missions.active ? `${this.missions.active.name} — ${this.missions.active.giver}` : '',
      objective: step ? step.label : (this.missions.active ? '' : ''),
      timerLeft: this.missions.timerLeft,
      interactHint: this.interactHintText(),
      marker,
      trafficDots: this.traffic.cars.filter((c) => !c.dead && !c.isPlayer).map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
      policeDots: this.combat.police.filter((c) => !c.dead).map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
      px: this.pos.x,
      pz: this.pos.z,
      heading: this.heading,
    });

    this.renderer.render(this.scene, this.camera);
  }

  interactHintText() {
    if (!this.started || this.over) return '';
    if (this.car) {
      return Math.abs(this.carSpeed) < 2 ? 'E — Get out of the car' : '';
    }
    const step = this.missions.step;
    if (step && (step.type === 'interact' || step.type === 'hold')) {
      const pos = this.missions.stepPos(step);
      if (pos && Math.hypot(this.pos.x - pos.x, this.pos.z - pos.z) <= (step.radius || 6)) {
        return step.type === 'hold' ? 'Hold E — Crack the vault' : 'E — ' + step.label;
      }
    }
    const car = this.nearestCar(4.5);
    if (car) return 'E — Steal the car';
    return '';
  }
}

new Game();
