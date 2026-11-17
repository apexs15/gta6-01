// Combat: hitscan pistol with tracers and muzzle flash, enemy shooters for the
// bank job, damage numbers, and a tiny particle system for impacts.
import * as THREE from 'three';
import { makeRng, range } from './random.js';

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.points = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    this.mat = new THREE.PointsMaterial({ color: 0xffcc66, size: 0.35, transparent: true, opacity: 0.95 });
    this.cloud = new THREE.Points(geo, this.mat);
    this.cloud.frustumCulled = false;
    scene.add(this.cloud);
    this.vel = new Float32Array(600 * 3);
    this.life = new Float32Array(600);
    this.cursor = 0;
  }

  burst(x, y, z, count, color, speed = 4) {
    this.mat.color.setHex(color);
    for (let i = 0; i < count; i += 1) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % 600;
      const pos = this.cloud.geometry.attributes.position.array;
      pos[idx * 3] = x;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[idx * 3] = Math.cos(a) * Math.cos(b) * s;
      this.vel[idx * 3 + 1] = Math.sin(b) * s + 2;
      this.vel[idx * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
      this.life[idx] = 0.5 + Math.random() * 0.4;
    }
    this.cloud.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    const pos = this.cloud.geometry.attributes.position.array;
    for (let i = 0; i < 600; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      pos[i * 3] += this.vel[i * 3] * dt;
      pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 9 * dt;
      if (this.life[i] <= 0 || pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = -100;
        this.life[i] = 0;
      }
    }
    this.cloud.geometry.attributes.position.needsUpdate = true;
  }
}

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.particles = new Particles(scene);
    this.tracers = [];
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    this.flash = new THREE.PointLight(0xffc860, 0, 9);
    this.flash.position.set(0, -10, 0);
    scene.add(this.flash);
    this.flashTimer = 0;
    this.cooldown = 0;
    this.ammo = 12;
    this.reloadTimer = 0;
    this.raycaster = new THREE.Raycaster();
  }

  // Shoot from the camera through the crosshair. Returns what was hit, if anything.
  shoot(camera, origin, targets) {
    if (this.cooldown > 0 || this.reloadTimer > 0) return null;
    if (this.ammo <= 0) {
      this.reload();
      return null;
    }
    this.cooldown = 0.22;
    this.ammo -= 1;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    this.raycaster.far = 120;
    const hits = this.raycaster.intersectObjects(targets, true);
    const from = origin.clone();
    let end;
    let hit = null;
    if (hits.length > 0) {
      end = hits[0].point;
      hit = hits[0];
      this.particles.burst(end.x, end.y, end.z, 10, 0xff5533, 5);
    } else {
      end = origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(90));
    }
    this.spawnTracer(from, end);
    this.flash.position.copy(from);
    this.flash.intensity = 14;
    this.flashTimer = 0.06;
    return hit;
  }

  spawnTracer(from, to) {
    const len = from.distanceTo(to);
    const geo = new THREE.BoxGeometry(0.03, 0.03, len);
    const mesh = new THREE.Mesh(geo, this.tracerMat);
    mesh.position.copy(from).lerp(to, 0.5);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.09 });
  }

  reload() {
    if (this.reloadTimer > 0 || this.ammo === 12) return;
    this.reloadTimer = 1.0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = 12;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
    for (const t of this.tracers) t.life -= dt;
    for (const t of this.tracers.filter((t) => t.life <= 0)) this.scene.remove(t.mesh);
    this.tracers = this.tracers.filter((t) => t.life > 0);
    this.particles.update(dt);
  }
}

// Rival guards for the bank job: they stand, take cover badly, and shoot back.
export class Guards {
  constructor(scene, seed = 41) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.guards = [];
  }

  spawn(x, z, count = 3) {
    for (let i = 0; i < count; i += 1) {
      const group = new THREE.Group();
      const dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
      const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), dark);
      torso.position.y = 1.12;
      torso.castShadow = true;
      group.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
      head.position.y = 1.72;
      group.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.3, 1.25, 0.3);
      group.add(gun);
      for (const sx of [-0.17, 0.17]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), dark);
        leg.position.set(sx, 0.36, 0);
        group.add(leg);
      }
      group.position.set(x + range(this.rng, -8, 8), 0, z + range(this.rng, -8, 8));
      this.scene.add(group);
      this.guards.push({ mesh: group, health: 60, shootTimer: range(this.rng, 0.5, 2), alive: true });
    }
  }

  clear() {
    for (const g of this.guards) this.scene.remove(g.mesh);
    this.guards = [];
  }

  update(dt, playerPos, damagePlayer) {
    for (const g of this.guards) {
      if (!g.alive) continue;
      const m = g.mesh.position;
      const dx = playerPos.x - m.x;
      const dz = playerPos.z - m.z;
      const d = Math.hypot(dx, dz);
      g.mesh.rotation.y = Math.atan2(dx, dz);
      g.shootTimer -= dt;
      if (d < 55 && g.shootTimer <= 0) {
        g.shootTimer = range(this.rng, 1.1, 2.2);
        // Wild shots: roughly one in three connects.
        if (this.rng() < 0.34) damagePlayer(6 + this.rng() * 6, m);
      }
    }
  }
}
