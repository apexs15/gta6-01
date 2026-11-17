// Solara Bay — missions: five jobs from Marcus, each a chain of objectives,
// ending in a story-complete screen.

import * as THREE from 'three';
import { MISSIONS, LANDMARKS } from './config.js';
import { playPickup, playMissionDone } from './audio.js';

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.done = new Set();
    this.holdMs = 0;
    this.timerLeft = 0;
    this.marker = null;
    this.beacon = null;
    this.onReward = null;
    this.onStoryComplete = null;
    this.onStep = null;
    this.buildBeacon();
  }

  buildBeacon() {
    const geo = new THREE.CylinderGeometry(0.35, 0.35, 60, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.4, 3.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    this.marker = new THREE.Mesh(ringGeo, ringMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.15;
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  get active() {
    return this.activeIndex >= 0 ? MISSIONS[this.activeIndex] : null;
  }

  get step() {
    const m = this.active;
    return m ? m.steps[this.stepIndex] : null;
  }

  stepPos(step) {
    if (!step || !step.at) return null;
    const lm = LANDMARKS[step.at];
    return lm ? { x: lm.x, z: lm.z } : null;
  }

  start(index) {
    if (index < 0 || index >= MISSIONS.length) return false;
    if (this.done.has(MISSIONS[index].id)) return false;
    this.activeIndex = index;
    this.stepIndex = 0;
    this.holdMs = 0;
    this.timerLeft = 0;
    const step = this.step;
    if (step && step.type === 'timed') this.timerLeft = step.seconds;
    if (step && step.type === 'collect') {
      // Heat Wave: the heat is on from the first pickup.
      if (this.onHeat) this.onHeat();
    }
    this.placeMarker();
    if (this.onStep) this.onStep(this.active, this.step, this.stepIndex);
    return true;
  }

  placeMarker() {
    const step = this.step;
    const pos = this.stepPos(step);
    if (!pos) {
      this.beacon.visible = false;
      this.marker.visible = false;
      return;
    }
    this.beacon.position.set(pos.x, 30, pos.z);
    this.beacon.visible = true;
    this.marker.position.set(pos.x, 0.15, pos.z);
    this.marker.visible = true;
  }

  advance() {
    const m = this.active;
    if (!m) return;
    this.stepIndex++;
    this.holdMs = 0;
    if (this.stepIndex >= m.steps.length) {
      this.complete(m);
      return;
    }
    const step = this.step;
    if (step.type === 'timed') this.timerLeft = step.seconds;
    if (step.type === 'collect' && this.onHeat) this.onHeat();
    this.placeMarker();
    if (this.onStep) this.onStep(m, step, this.stepIndex);
  }

  complete(mission) {
    this.done.add(mission.id);
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.beacon.visible = false;
    this.marker.visible = false;
    playMissionDone();
    if (this.onReward) this.onReward(mission.reward, mission);
    if (this.done.size >= MISSIONS.length && this.onStoryComplete) {
      this.onStoryComplete();
    }
  }

  fail(reason) {
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.beacon.visible = false;
    this.marker.visible = false;
    if (this.onStep) this.onStep(null, null, -1, reason);
  }

  // Called every frame with the player's position, whether in a car, and
  // whether E is held. Returns a short event string for the HUD, or null.
  update(dt, px, pz, inCar, eHeld) {
    if (!this.active) return null;
    const step = this.step;
    if (!step) return null;
    if (step.type === 'timed') {
      this.timerLeft -= dt;
      if (this.timerLeft <= 0) {
        this.fail('Too slow — the drop went cold.');
        return 'failed';
      }
    }
    if (step.type === 'steal') {
      if (inCar) {
        this.advance();
        playPickup();
        return 'stolen';
      }
      return null;
    }
    const pos = this.stepPos(step);
    if (!pos) return null;
    const d = Math.hypot(px - pos.x, pz - pos.z);
    const radius = step.radius || 6;
    if (step.type === 'goto' || step.type === 'collect') {
      if (step.inCar && !inCar) return null;
      if (d <= radius) {
        this.advance();
        playPickup();
        return 'reached';
      }
      return null;
    }
    if (step.type === 'interact') {
      if (d <= radius && eHeld) {
        this.advance();
        playPickup();
        return 'picked';
      }
      return null;
    }
    if (step.type === 'hold') {
      if (d <= radius && eHeld) {
        this.holdMs += dt * 1000;
        if (this.holdMs >= (step.holdMs || 3000)) {
          this.advance();
          playPickup();
          return 'cracked';
        }
        return 'holding';
      }
      this.holdMs = 0;
      return null;
    }
    return null;
  }
}
