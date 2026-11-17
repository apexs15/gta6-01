// Solara Bay — the game itself: bootstrap, screens, camera, the loop, and every
// interaction (enter/steal/drive a car, shoot, missions, busted/wasted, saving).
import * as THREE from 'three';
import { CITY, PLACES, PLAYER } from './config.js';
import { makeRng, clamp, angleLerp, dist2D } from './random.js';
import { City } from './city.js';
import { Traffic, makeCarMesh, driveCar } from './vehicles.js';
import { People, Player } from './people.js';
import { Police } from './police.js';
import { Combat, Guards } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const FAKE_AUTO = {
  move: () => ({ fwd: 1, strafe: 0 }),
  down: () => false,
  consumeClick: () => false,
  consumeDrag: () => ({ x: 0, y: 0 }),
  consumeWheel: () => 0,
};

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 30, 60);

    this.input = new Input(this.renderer.domElement);
    this.sound = new SoundBank();
    this.city = new City(this.scene, 7);
    this.traffic = new Traffic(this.scene, this.city, 11);
    this.people = new People(this.scene, this.city, 21);
    this.player = new Player(this.scene);
    this.police = new Police(this.scene, this.city, 31);
    this.combat = new Combat(this.scene);
    this.guards = new Guards(this.scene, 41);
    this.missions = new Missions(this.scene);
    this.hud = new HUD(this.city);

    this.screen = 'title'; // title | play | pause | phone | end
    this.cash = 120;
    this.playerCar = null;
    this.targetCar = null; // the red Comet GT for the Hot Wheels job
    this.cameraYaw = 0;
    this.cameraPitch = 0.42;
    this.cameraDistance = 11;
    this.cameraPos = new THREE.Vector3(0, 20, 40);
    this.clockMinutes = 17 * 60 + 30;
    this.lastDamageAt = -99;
    this.time = 0;
    this.freezeWorld = false;
    this.shotMode = null;
    this.lastEnterAt = -99;
    this.guardsSpawned = false;
    this.endReason = null;

    this.missions.onEvent = (type, payload) => this.onMissionEvent(type, payload);
    this.spawnTargetCar();
    this.placePlayer(PLACES.cafe.x - 6, PLACES.cafe.z + 4, 0.6);
    this.wireMenus();
    window.addEventListener('resize', () => this.onResize());

    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      this.shotMode = shot;
      this.sound.setMuted(true);
      this.startFreeRoam();
      const staged = stageShot(shot, this);
      if (staged) {
        this.renderOnce();
        window.setTimeout(() => { window.__shotReady = true; }, 600);
      } else {
        window.__shotReady = true;
      }
    } else {
      this.hud.showStart(!!loadSave());
    }
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  spawnTargetCar() {
    // The red Comet GT the Hot Wheels job wants, parked at Comet Motors.
    this.targetCar = this.traffic.addParked(PLACES.dealership.x + 4, PLACES.dealership.z - 4, Math.PI / 2, 0xc0392b);
    this.targetCar.isTarget = true;
  }

  placePlayer(x, z, heading) {
    this.player.mesh.position.set(x, 0, z);
    this.player.heading = heading;
    this.player.mesh.rotation.y = heading;
    this.cameraYaw = heading;
  }

  warpPlayerOnFoot(x, z, heading) {
    this.exitCar(true);
    this.placePlayer(x, z, heading);
  }

  warpPlayerToCar(x, z, heading, speed) {
    this.exitCar(true);
    const car = this.traffic.addParked(x, z, heading, 0x2980b9);
    car.parked = false;
    car.speed = speed;
    car.heading = heading;
    this.enterCar(car, false);
  }

  // --- menus ---------------------------------------------------------------
  wireMenus() {
    const click = (id, fn) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => { this.sound.ensure(); this.sound.click(); fn(); });
    };
    click('new-btn', () => this.newGame());
    click('continue-btn', () => this.continueGame());
    click('howto-btn', () => this.hud.showHowTo());
    click('howto-close', () => this.hud.hideHowTo());
    click('resume-btn', () => this.resume());
    click('save-btn', () => { this.saveGame(); this.hud.showMessage('Game saved.'); });
    click('restart-btn', () => { this.hud.hidePause(); this.hud.showStart(!!loadSave()); this.screen = 'title'; });
    click('mute-btn', () => {
      this.sound.setMuted(!this.sound.muted);
      document.getElementById('mute-btn').textContent = this.sound.muted ? 'Sound: OFF' : 'Sound: ON';
    });
    click('phone-close', () => this.closePhone());
    click('end-continue', () => {
      this.hud.hideEndCard();
      this.respawn();
      this.screen = 'play';
    });
    document.getElementById('phone-list').addEventListener('click', (e) => {
      const row = e.target.closest('.phone-row');
      if (!row || row.disabled) return;
      const index = Number(row.dataset.index);
      this.startMission(index);
      this.closePhone();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.screen === 'play') this.pause();
        else if (this.screen === 'pause') this.resume();
        else if (this.screen === 'phone') this.closePhone();
      }
      if (e.code === 'KeyM' && (this.screen === 'play' || this.screen === 'phone')) {
        if (this.screen === 'play') this.openPhone();
        else this.closePhone();
      }
      if (e.code === 'KeyP' && this.screen === 'play') {
        this.sound.setMuted(!this.sound.muted);
      }
    });
  }

  newGame() {
    clearSave();
    this.cash = 120;
    this.missions.completed.clear();
    this.missions.abort();
    this.police.clear();
    this.player.health = PLAYER.health;
    this.exitCar(true);
    this.placePlayer(PLACES.cafe.x - 6, PLACES.cafe.z + 4, 0.6);
    this.clockMinutes = 17 * 60 + 30;
    this.startFreeRoam();
    this.hud.showSubtitle('Dario Cruz, new in Solara Bay. Make a name — and some cash.', 6);
    this.hud.showMessage('Press M for missions. WASD to move, E to enter a car.');
  }

  continueGame() {
    const save = loadSave();
    if (!save) return this.newGame();
    this.cash = save.cash ?? 120;
    this.missions.completed = new Set(save.completed ?? []);
    this.player.health = save.health ?? PLAYER.health;
    this.placePlayer(save.x ?? PLACES.cafe.x, save.z ?? PLACES.cafe.z, save.heading ?? 0);
    this.clockMinutes = save.clock ?? 17 * 60 + 30;
    this.startFreeRoam();
    this.hud.showMessage('Welcome back to Solara Bay.');
  }

  startFreeRoam() {
    this.hud.hideStart();
    this.hud.hidePause();
    this.screen = 'play';
    this.sound.ensure();
    this.refreshHUD();
  }

  pause() {
    this.screen = 'pause';
    this.hud.showPause();
  }

  resume() {
    this.hud.hidePause();
    this.screen = 'play';
  }

  openPhone() {
    this.screen = 'phone';
    this.hud.showPhone(this.missions.missionList());
  }

  closePhone() {
    this.hud.hidePhone();
    this.screen = 'play';
  }

  startMission(index) {
    const mission = this.missions.start(index);
    if (!mission) return;
    this.hud.showSubtitle(mission.intro, 7);
    this.hud.setObjective(this.missions.objectiveText());
    this.sound.pickup();
    if (index === 3) {
      this.police.setStars(3);
      this.sound.sirenBurst();
      this.hud.showMessage('The whole precinct is after you!');
    }
    this.guardsSpawned = false;
  }

  onMissionEvent(type, payload) {
    if (type === 'step') {
      this.hud.showSubtitle(payload.text, 5);
      this.sound.pickup();
      // The vault grab starts the chase.
      if (this.missions.current && this.missions.current.title === 'The Big Score' && this.missions.step === 2) {
        this.police.setStars(4);
        this.sound.sirenBurst();
        this.hud.showMessage('4 stars! Lose them and reach the Hideout.');
      }
    }
    if (type === 'complete') {
      this.cash += payload.reward;
      this.sound.missionDone();
      this.hud.showMessage(`Mission complete! +$${payload.reward}`);
      this.hud.showSubtitle(payload.outro, 6);
      this.hud.setObjective(this.missions.objectiveText());
      this.saveGame();
      if (this.missions.completed.size >= 5) {
        this.hud.showEndCard('STORY COMPLETE', 'All five jobs done. Solara Bay is yours — free roam, keep the cash coming.');
      }
    }
  }

  saveGame() {
    const p = this.player.mesh.position;
    writeSave({
      cash: this.cash,
      completed: [...this.missions.completed],
      health: Math.round(this.player.health),
      x: Math.round(p.x * 10) / 10,
      z: Math.round(p.z * 10) / 10,
      heading: this.player.heading,
      clock: Math.round(this.clockMinutes),
    });
  }

  // --- entering / stealing / exiting cars -----------------------------------
  nearestCar(maxDist) {
    const p = this.player.mesh.position;
    let best = null;
    let bestD = maxDist;
    for (const car of this.traffic.cars) {
      if (car === this.playerCar) continue;
      const d = dist2D(p.x, p.z, car.mesh.position.x, car.mesh.position.z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  enterCar(car, stolen) {
    this.playerCar = car;
    car.parked = false;
    car.driven = true;
    car.speed = car.speed || 0;
    car.heading = car.mesh.rotation.y;
    this.player.mesh.visible = false;
    this.cameraDistance = 13;
  }

  exitCar(silent = false) {
    if (!this.playerCar) return;
    const car = this.playerCar;
    car.driven = false;
    car.parked = true;
    car.speed = 0;
    const side = car.mesh.rotation.y + Math.PI / 2;
    const px = car.mesh.position.x + Math.sin(side) * 2.6;
    const pz = car.mesh.position.z + Math.cos(side) * 2.6;
    const [cx, cz] = this.city.collideCircle(px, pz, 0.8);
    this.player.mesh.position.set(cx, 0, cz);
    this.player.mesh.visible = true;
    this.player.heading = car.heading;
    this.playerCar = null;
    this.cameraDistance = 10;
    if (!silent) this.sound.click();
  }

  tryEnterCar() {
    if (this.time - this.lastEnterAt < 0.4) return;
    this.lastEnterAt = this.time;
    if (this.playerCar) {
      this.exitCar();
      return;
    }
    const car = this.nearestCar(4.5);
    if (!car) return;
    const isTarget = car === this.targetCar;
    const wasTraffic = !car.parked;
    this.enterCar(car, wasTraffic);
    if (isTarget) {
      const ev = this.missions.completeStealStep();
      if (ev) {
        this.police.setStars(2);
        this.sound.sirenBurst();
        this.hud.showMessage('Comet GT stolen! 2 stars — get it to the garage.');
      } else {
        this.hud.showMessage('You took the Comet GT.');
      }
    } else if (wasTraffic) {
      // Stealing a car off the street: the driver bails, the cops notice.
      this.people.addPed(car.mesh.position.x + 2, car.mesh.position.z + 2);
      if (this.police.addStars(1)) this.sound.sirenBurst();
      this.hud.showMessage('Car stolen! The driver ran — and someone called it in.');
    } else {
      this.hud.showMessage('You got in the car.');
    }
    this.sound.click();
  }

  // --- busted / wasted ------------------------------------------------------
  onBusted() {
    if (this.screen !== 'play') return;
    this.endReason = 'busted';
    this.finishArrest();
  }

  onWasted() {
    if (this.screen !== 'play') return;
    this.endReason = 'wasted';
    this.finishArrest();
  }

  finishArrest() {
    const lost = Math.floor(this.cash * 0.2);
    this.cash -= lost;
    this.sound.busted();
    this.police.clear();
    this.guards.clear();
    this.missions.abort();
    this.hud.showEndCard(
      this.endReason === 'busted' ? 'BUSTED' : 'WASTED',
      `The clinic patched you up. You lost $${lost}. The city is still out there.`,
    );
    this.screen = 'end';
  }

  respawn() {
    this.exitCar(true);
    this.player.health = PLAYER.health;
    this.placePlayer(PLACES.clinic.x, PLACES.clinic.z + 6, 0);
    this.saveGame();
  }

  // --- the frame ------------------------------------------------------------
  frame() {
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.screen === 'play' && !this.freezeWorld) {
      this.time += dt;
      this.stepWorld(dt, null);
    } else if (this.screen === 'title' || this.screen === 'end') {
      this.city.update(dt);
    }
    this.updateCamera(dt);
    this.hud.update(dt, this.minimapState());
    this.renderer.render(this.scene, this.camera);
  }

  renderOnce() {
    this.updateCamera(0.016);
    this.renderer.render(this.scene, this.camera);
  }

  stepWorld(dt, autopilot) {
    const input = autopilot ? FAKE_AUTO : this.input;
    let inCar = !!this.playerCar;
    const p = this.player.mesh.position;

    // Camera orbit from the mouse drag (live play only).
    if (!autopilot) {
      const drag = this.input.consumeDrag();
      if (drag.x !== 0 || drag.y !== 0) this.lastDragAt = this.time;
      this.cameraYaw -= drag.x * 0.005;
      this.cameraPitch = clamp(this.cameraPitch + drag.y * 0.003, 0.12, 0.9);
      this.cameraDistance = clamp(this.cameraDistance + this.input.consumeWheel() * 0.01, 7, 18);
      const eDown = this.input.down('KeyE');
      if (eDown && !this.eWasDown) this.tryEnterCar();
      this.eWasDown = eDown;
      if (this.input.down('KeyH') && inCar) this.sound.horn();
    }
    // E may have entered or exited a car this frame: refresh before the player
    // section, or driveCar would run on a car that is no longer there.
    inCar = !!this.playerCar;

    // --- player -------------------------------------------------------------
    if (inCar) {
      const car = this.playerCar;
      const res = driveCar(car, input, dt, this.city, this.traffic.cars);
      this.sound.setEngine(res.speed01, true);
      // Running a pedestrian over is a crime.
      for (const ped of this.people.peds) {
        if (!ped.alive) continue;
        const d = dist2D(car.mesh.position.x, car.mesh.position.z, ped.mesh.position.x, ped.mesh.position.z);
        if (d < 2.4 && Math.abs(car.speed) > 8) {
          ped.alive = false;
          ped.mesh.rotation.x = Math.PI / 2;
          ped.mesh.position.y = 0.3;
          this.combat.particles.burst(ped.mesh.position.x, 1, ped.mesh.position.z, 12, 0xcc3333, 4);
          if (this.police.addStars(1)) this.sound.sirenBurst();
          this.hud.showMessage('Pedestrian down! Someone saw that.');
        }
      }
      this.player.mesh.position.copy(car.mesh.position);
      this.player.heading = car.heading;
    } else {
      this.player.update(dt, input, this.cameraYaw, this.city, this.traffic.cars);
      this.sound.setEngine(0, false);
      // Shooting (mouse click, on foot).
      if (!autopilot && this.input.consumeClick() && this.screen === 'play') {
        this.sound.ensure();
        const origin = this.camera.position.clone();
        const targets = [];
        for (const ped of this.people.peds) if (ped.alive) targets.push(ped.mesh);
        for (const g of this.guards.guards) if (g.alive) targets.push(g.mesh);
        for (const o of this.police.officers) targets.push(o.mesh);
        const hit = this.combat.shoot(this.camera, origin, targets);
        this.sound.gunshot();
        if (this.police.stars === 0) this.police.addStars(1);
        if (hit) this.applyHit(hit);
      }
    }

    // --- world --------------------------------------------------------------
    this.city.update(dt);
    this.traffic.update(dt, this.playerCar, null);
    const danger = this.playerCar ? this.playerCar.mesh.position : p;
    this.people.update(dt, p, this.playerCar ? { x: danger.x, z: danger.z } : null);
    this.combat.update(dt);
    this.police.update(dt, this.player, this.playerCar, !inCar, () => this.onBusted());
    this.guards.update(dt, p, (dmg, from) => this.damagePlayer(dmg, from));

    // --- missions -----------------------------------------------------------
    if (this.missions.current) {
      const step = this.missions.currentStep;
      if (step && step.type === 'wait' && !this.guardsSpawned && this.missions.current.title === 'The Big Score') {
        const place = PLACES.bank;
        if (dist2D(p.x, p.z, place.x, place.z) < 12) {
          this.guards.spawn(place.x + 6, place.z - 6, 3);
          this.guardsSpawned = true;
          this.hud.showMessage('Guards! They are shooting!');
        }
      }
      const ev = this.missions.update(dt, this.player, inCar, this.police.stars);
      if (ev === 'complete') this.hud.setObjective(this.missions.objectiveText());
      else if (ev === 'step') this.hud.setObjective(this.missions.objectiveText());
      else this.hud.setObjective(this.missions.objectiveText());
    } else {
      this.hud.setObjective(this.missions.objectiveText());
    }

    // --- health, clock, HUD --------------------------------------------------
    if (this.time - this.lastDamageAt > 5 && this.player.health < PLAYER.health) {
      this.player.health = Math.min(PLAYER.health, this.player.health + 6 * dt);
    }
    if (this.player.health <= 0) {
      this.onWasted();
      return;
    }
    this.clockMinutes += dt * 2;
    this.refreshHUD();
  }

  applyHit(hit) {
    const target = this.findHitTarget(hit.object);
    if (!target) return;
    if (target.kind === 'ped') {
      target.ref.alive = false;
      target.ref.mesh.rotation.x = Math.PI / 2;
      target.ref.mesh.position.y = 0.3;
      if (this.police.addStars(1)) this.sound.sirenBurst();
      this.hud.showMessage('You shot a pedestrian! The cops are coming.');
    } else if (target.kind === 'guard') {
      target.ref.health -= 34;
      this.combat.particles.burst(hit.point.x, hit.point.y, hit.point.z, 8, 0xff5533, 4);
      if (target.ref.health <= 0) {
        target.ref.alive = false;
        target.ref.mesh.rotation.x = Math.PI / 2;
        target.ref.mesh.position.y = 0.3;
        this.hud.showMessage('Guard down.');
      }
    } else if (target.kind === 'officer') {
      target.ref.mesh.rotation.x = Math.PI / 2;
      target.ref.mesh.position.y = 0.3;
      this.police.officers = this.police.officers.filter((o) => o !== target.ref);
      if (this.police.addStars(1)) this.sound.sirenBurst();
      this.hud.showMessage('You shot an officer! That will cost you.');
    }
  }

  findHitTarget(object) {
    let o = object;
    while (o) {
      for (const ped of this.people.peds) if (ped.mesh === o) return { kind: 'ped', ref: ped };
      for (const g of this.guards.guards) if (g.mesh === o) return { kind: 'guard', ref: g };
      for (const off of this.police.officers) if (off.mesh === o) return { kind: 'officer', ref: off };
      o = o.parent;
    }
    return null;
  }

  damagePlayer(dmg, from) {
    this.player.health -= dmg;
    this.lastDamageAt = this.time;
    this.hud.flashDamage();
    if (from) this.combat.particles.burst(this.player.mesh.position.x, 1.4, this.player.mesh.position.z, 6, 0xff3333, 3);
  }

  refreshHUD() {
    this.hud.setStars(this.police.stars);
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health);
    this.hud.setAmmo(this.combat.ammo, this.combat.reloadTimer > 0);
    const kmh = this.playerCar ? Math.abs(this.playerCar.speed) * 3.6 : 0;
    this.hud.setSpeed(kmh, !!this.playerCar);
    this.hud.setClock(this.clockMinutes);
  }

  minimapState() {
    const p = this.player.mesh.position;
    return {
      playerX: p.x,
      playerZ: p.z,
      heading: this.playerCar ? this.playerCar.heading : this.player.heading,
      traffic: this.traffic.cars.filter((c) => !c.parked && c !== this.playerCar),
      cops: this.police.copCars,
      guards: this.guards.guards.filter((g) => g.alive),
      marker: this.missions.marker,
    };
  }

  updateCamera(dt) {
    const focus = this.playerCar ? this.playerCar.mesh.position : this.player.mesh.position;
    // When driving and the player has not dragged the camera lately, settle
    // behind the car so driving feels natural.
    if (this.playerCar && !this.shotMode && this.time - (this.lastDragAt || 0) > 2.5) {
      this.cameraYaw = angleLerp(this.cameraYaw, this.playerCar.heading, Math.min(1, dt * 1.4));
    }
    const dist = this.cameraDistance;
    const height = 3.2 + dist * Math.sin(this.cameraPitch);
    const back = dist * Math.cos(this.cameraPitch);
    const tx = focus.x - Math.sin(this.cameraYaw) * back;
    const tz = focus.z - Math.cos(this.cameraYaw) * back;
    const k = this.shotMode ? 1 : Math.min(1, dt * 6);
    this.cameraPos.x += (tx - this.cameraPos.x) * k;
    this.cameraPos.y += (height - this.cameraPos.y) * k;
    this.cameraPos.z += (tz - this.cameraPos.z) * k;
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(focus.x, focus.y + 1.6, focus.z);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__game = new Game();
});
