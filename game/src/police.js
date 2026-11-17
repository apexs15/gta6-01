// The wanted system: stars rise with crimes, police cars and officers hunt the
// player, and getting caught or killed costs cash and a trip to the clinic.
import * as THREE from 'three';
import { WANTED, CITY, PLACES } from './config.js';
import { makeCarMesh } from './vehicles.js';
import { makeRng, clamp, angleLerp, dist2D } from './random.js';

export class Police {
  constructor(scene, city, seed = 31) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed);
    this.stars = 0;
    this.decayTimer = 0;
    this.copCars = [];
    this.officers = [];
    this.flashPhase = 0;
    this.bustedTimer = 0;
  }

  addStars(n, silent = false) {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, WANTED.maxStars);
    this.decayTimer = 0;
    if (this.stars > before && !silent) return true; // caller plays the siren
    return false;
  }

  setStars(n) {
    this.stars = clamp(n, 0, WANTED.maxStars);
    this.decayTimer = 0;
  }

  clear() {
    this.stars = 0;
    this.decayTimer = 0;
    this.bustedTimer = 0;
    for (const c of this.copCars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.copCars = [];
    this.officers = [];
  }

  spawnCopCar(near) {
    const rng = this.rng;
    const road = this.city.nearestRoad(near.x, near.z);
    const along = (road.axis === 'x' ? near.x : near.z) + (rng() < 0.5 ? -45 : 45);
    const mesh = makeCarMesh(0x1d4ed8, true);
    this.scene.add(mesh);
    const car = {
      mesh,
      axis: road.axis,
      coord: road.coord,
      along: clamp(along, -190, 190),
      dir: 1,
      speed: 0,
      heading: 0,
      isCop: true,
    };
    // Face along the road toward the player.
    car.dir = (road.axis === 'x' ? near.x - car.along : near.z - car.along) >= 0 ? 1 : -1;
    this.syncCop(car);
    this.copCars.push(car);
    return car;
  }

  syncCop(car) {
    if (car.axis === 'x') {
      car.mesh.position.set(car.along, 0, car.coord + (car.dir > 0 ? 3.2 : -3.2));
      car.mesh.rotation.y = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.mesh.position.set(car.coord + (car.dir > 0 ? -3.2 : 3.2), 0, car.along);
      car.mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
    }
    car.heading = car.mesh.rotation.y;
  }

  spawnOfficer(near) {
    const mesh = this.makeOfficerMesh();
    mesh.position.set(near.x + (this.rng() < 0.5 ? -6 : 6), 0, near.z + (this.rng() < 0.5 ? -6 : 6));
    this.scene.add(mesh);
    const officer = { mesh, speed: 4.6, heading: 0, catchTimer: 0 };
    this.officers.push(officer);
    return officer;
  }

  makeOfficerMesh() {
    const group = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1d2f4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), navy);
    torso.position.y = 1.12;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.72;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x101c2e }));
    cap.position.y = 1.9;
    group.add(cap);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    badge.position.set(0.18, 1.3, 0.18);
    group.add(badge);
    for (const sx of [-0.17, 0.17]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), navy);
      leg.position.set(sx, 0.36, 0);
      group.add(leg);
    }
    return group;
  }

  update(dt, player, playerCar, playerOnFoot, onBusted) {
    this.flashPhase += dt * 6;
    const target = playerCar ? playerCar.mesh.position : player.mesh.position;
    const px = target.x;
    const pz = target.z;

    // Wanted decays when the player stays clean and out of sight.
    if (this.stars > 0) {
      let nearestCop = Infinity;
      for (const c of this.copCars) nearestCop = Math.min(nearestCop, dist2D(c.mesh.position.x, c.mesh.position.z, px, pz));
      for (const o of this.officers) nearestCop = Math.min(nearestCop, dist2D(o.mesh.position.x, o.mesh.position.z, px, pz));
      if (nearestCop > 55) {
        this.decayTimer += dt;
        if (this.decayTimer >= WANTED.decaySeconds) {
          this.stars -= 1;
          this.decayTimer = 0;
        }
      } else {
        this.decayTimer = 0;
      }
    }

    // Keep the right number of hunters on the street.
    const wantCars = WANTED.copCars[this.stars];
    while (this.copCars.length < wantCars) this.spawnCopCar({ x: px, z: pz });
    while (this.copCars.length > wantCars) {
      const c = this.copCars.pop();
      this.scene.remove(c.mesh);
    }
    const wantOfficers = playerOnFoot ? WANTED.copsOnFoot[this.stars] : 0;
    while (this.officers.length < wantOfficers) this.spawnOfficer({ x: px, z: pz });
    while (this.officers.length > wantOfficers) {
      const o = this.officers.pop();
      this.scene.remove(o.mesh);
    }

    // Cop cars chase: steer toward the player's position, ram on contact.
    for (const car of this.copCars) {
      const m = car.mesh.position;
      const wantHeading = Math.atan2(px - m.x, pz - m.z);
      car.heading = angleLerp(car.heading, wantHeading, Math.min(1, dt * 2.2));
      const speed = 15 + this.stars * 2.2;
      m.x += Math.sin(car.heading) * speed * dt;
      m.z += Math.cos(car.heading) * speed * dt;
      const [cx, cz] = this.city.collideCircle(m.x, m.z, 1.6);
      m.x = cx;
      m.z = cz;
      m.x = clamp(m.x, -CITY.bound, CITY.bound);
      m.z = clamp(m.z, -CITY.bound, CITY.bound);
      car.mesh.rotation.y = car.heading;
      // Flashing light bar.
      const on = Math.sin(this.flashPhase) > 0;
      car.mesh.userData.lightRed.material.color.setHex(on ? 0xff2222 : 0x550000);
      car.mesh.userData.lightBlue.material.color.setHex(on ? 0x1133aa : 0x2266ff);
      for (const w of car.mesh.userData.wheels) w.rotation.x += speed * dt * 1.4;
      // Ram the player's car, or the player on foot.
      const d = dist2D(m.x, m.z, px, pz);
      if (d < 3.4) {
        if (playerCar) {
          playerCar.speed *= 0.82;
          const push = (3.4 - d) * 0.6;
          playerCar.mesh.position.x -= Math.sin(car.heading) * push * 0.4;
          playerCar.mesh.position.z -= Math.cos(car.heading) * push * 0.4;
        } else if (playerOnFoot) {
          player.health -= 18 * dt;
        }
      }
    }

    // Officers chase on foot and try to make the arrest.
    for (const o of this.officers) {
      const m = o.mesh.position;
      const wantHeading = Math.atan2(px - m.x, pz - m.z);
      o.heading = angleLerp(o.heading, wantHeading, Math.min(1, dt * 4));
      const d = dist2D(m.x, m.z, px, pz);
      if (d > 1.6) {
        m.x += Math.sin(o.heading) * o.speed * dt;
        m.z += Math.cos(o.heading) * o.speed * dt;
        const [cx, cz] = this.city.collideCircle(m.x, m.z, 0.5);
        m.x = cx;
        m.z = cz;
        o.catchTimer = 0;
      } else {
        o.catchTimer += dt;
        if (o.catchTimer > 1.2) {
          onBusted();
          return;
        }
      }
      o.mesh.rotation.y = o.heading;
    }
  }
}
