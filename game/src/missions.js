// Missions and the story: five jobs for Dario Cruz, a driver-for-hire new to
// Solara Bay. Each mission is a list of steps with a place, a radius and a line
// of dialogue; the game advances steps as the player reaches them.
import * as THREE from 'three';
import { PLACES, MISSIONS } from './config.js';
import { dist2D } from './random.js';

// Step types: goto (reach a place), pickup (stand in the ring), wait (stand in
// the ring for N seconds), deliver (reach a place in a car), survive (stay alive
// with wanted >= 3 for N seconds), escape (reach a place with wanted >= 1).
const STORY = [
  {
    title: 'First Fare',
    intro: 'Dario: new in town, no cash, one borrowed jacket. Lena needs a ride to the Marina. Get in a car first, then pick her up.',
    steps: [
      { type: 'goto', place: 'cafe', radius: 6, text: "Go to Rosa's Cafe and pick up Lena." },
      { type: 'deliver', place: 'marina', radius: 8, text: 'Drive Lena to the Marina. She pays on arrival.' },
    ],
    outro: 'Lena: "You drive like you mean it. There is more work if you want it."',
  },
  {
    title: 'The Package',
    intro: 'Vera needs a package from the Docks. No questions, no opening it. Grab it on foot and bring it to her bar.',
    steps: [
      { type: 'pickup', place: 'docks', radius: 5, text: 'Pick up the package at the Docks.' },
      { type: 'goto', place: 'bar', radius: 6, text: "Deliver the package to Vera's Bar." },
    ],
    outro: 'Vera: "Sealed, on time. The crew notices that sort of thing."',
  },
  {
    title: 'Hot Wheels',
    intro: "Eddie wants a Comet GT from the dealership floor. It is not yours. Take it, and do not let the cops see you do it.",
    steps: [
      { type: 'steal', place: 'dealership', radius: 8, text: 'Steal the red Comet GT at Comet Motors.' },
      { type: 'deliver', place: 'garage', radius: 8, text: "Deliver the Comet GT to Eddie's Garage." },
    ],
    outro: 'Eddie: "Clean plates by morning. You are earning a name, Dario."',
  },
  {
    title: 'Heat',
    intro: 'Someone tipped the precinct. The whole city is looking for you now. Stay alive with the heat on you for 45 seconds — then it dies down.',
    steps: [
      { type: 'survive', seconds: 45, text: 'Survive 45 seconds with 3 stars on you.' },
    ],
    outro: 'Marcus (phone): "They lost you. That is the whole trick, kid. Stay gone."',
  },
  {
    title: 'The Big Score',
    intro: 'The crew is hitting Solara Bank at dusk. Get inside, hold the vault for the crew, then run for the Hideout. The guards will not wave you through.',
    steps: [
      { type: 'goto', place: 'bank', radius: 7, text: 'Get to Solara Bank.' },
      { type: 'wait', place: 'bank', radius: 5, seconds: 6, text: 'Hold the vault open: 6 seconds.' },
      { type: 'escape', place: 'hideout', radius: 9, text: 'Escape to the Hideout with the cash!' },
    ],
    outro: 'Dario: "Solara Bay is ours now. At least until the next score."',
  },
];

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = -1; // -1: no mission active
    this.step = 0;
    this.stepTimer = 0;
    this.done = false;
    this.completed = new Set();
    // The waypoint beacon: a gold pillar of light + a floating ring.
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
    this.beacon.position.y = 30;
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 24), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.12;
    this.ring.visible = false;
    scene.add(this.ring);
    this.marker = null; // { x, z, label } for the HUD + minimap
    this.onEvent = null; // (type, payload) — the game wires sound + messages here
  }

  get current() {
    return this.index >= 0 && this.index < STORY.length ? STORY[this.index] : null;
  }

  get currentStep() {
    const m = this.current;
    return m ? m.steps[this.step] : null;
  }

  get currentPlace() {
    const s = this.currentStep;
    return s && s.place ? PLACES[s.place] : null;
  }

  get reward() {
    return this.index >= 0 ? MISSIONS[this.index].reward : 0;
  }

  start(index) {
    if (index < 0 || index >= STORY.length) return null;
    this.index = index;
    this.step = 0;
    this.stepTimer = 0;
    this.done = false;
    this.updateMarker();
    return STORY[index];
  }

  startNext() {
    const next = this.completed.size === 0 ? 0 : Math.max(...this.completed) + 1;
    if (next >= STORY.length) return null;
    return this.start(next);
  }

  updateMarker() {
    const place = this.currentPlace;
    if (place) {
      this.marker = { x: place.x, z: place.z, label: place.label };
      this.beacon.position.set(place.x, 30, place.z);
      this.beacon.visible = true;
      this.ring.position.set(place.x, 0.12, place.z);
      this.ring.visible = true;
    } else {
      this.marker = null;
      this.beacon.visible = false;
      this.ring.visible = false;
    }
  }

  // Called every frame with the player's state. Returns a mission event string
  // ('step', 'complete', 'failed') or null.
  update(dt, player, inCar, wanted) {
    const step = this.currentStep;
    if (!step) return null;
    const pos = player.mesh.position;
    if (step.type === 'goto' || step.type === 'pickup' || step.type === 'deliver' || step.type === 'escape') {
      const place = PLACES[step.place];
      const d = dist2D(pos.x, pos.z, place.x, place.z);
      if (step.type === 'deliver' && !inCar) return null;
      if (step.type === 'escape' && wanted < 1) return null;
      if (d <= step.radius) return this.advance();
      return null;
    }
    if (step.type === 'wait') {
      const place = PLACES[step.place];
      const d = dist2D(pos.x, pos.z, place.x, place.z);
      if (d <= step.radius) {
        this.stepTimer += dt;
        if (this.stepTimer >= step.seconds) return this.advance();
      } else {
        this.stepTimer = Math.max(0, this.stepTimer - dt * 2);
      }
      return null;
    }
    if (step.type === 'survive') {
      if (wanted >= 3) {
        this.stepTimer += dt;
        if (this.stepTimer >= step.seconds) return this.advance();
      }
      return null;
    }
    if (step.type === 'steal') {
      // The steal step completes when the player is driving the target car.
      // The game sets this flag via completeStealStep() when the car is taken.
      return null;
    }
    return null;
  }

  completeStealStep() {
    const step = this.currentStep;
    if (step && step.type === 'steal') return this.advance();
    return null;
  }

  advance() {
    this.step += 1;
    this.stepTimer = 0;
    const m = this.current;
    if (this.step >= m.steps.length) {
      this.completed.add(this.index);
      this.done = true;
      const reward = this.reward;
      this.index = -1;
      this.beacon.visible = false;
      this.ring.visible = false;
      this.marker = null;
      if (this.onEvent) this.onEvent('complete', { reward, outro: m.outro });
      return 'complete';
    }
    this.updateMarker();
    if (this.onEvent) this.onEvent('step', { text: m.steps[this.step].text });
    return 'step';
  }

  abort() {
    this.index = -1;
    this.step = 0;
    this.stepTimer = 0;
    this.beacon.visible = false;
    this.ring.visible = false;
    this.marker = null;
  }

  objectiveText() {
    const m = this.current;
    if (!m) return this.completed.size >= STORY.length
      ? 'Story complete — free roam Solara Bay.'
      : 'No mission active. Press M to open the phone.';
    const step = m.steps[this.step];
    let text = `${m.title}: ${step.text}`;
    if (step.type === 'wait' || step.type === 'survive') {
      text += ` (${Math.ceil(step.seconds - this.stepTimer)}s)`;
    }
    return text;
  }

  missionList() {
    return STORY.map((m, i) => ({
      index: i,
      title: m.title,
      reward: MISSIONS[i].reward,
      done: this.completed.has(i),
      active: this.index === i,
      available: i === 0 || this.completed.has(i - 1),
    }));
  }
}
