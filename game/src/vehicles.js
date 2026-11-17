// Cars: box-built low-poly originals (body, cabin, wheels, lights), traffic AI that
// follows the road grid, and arcade driving physics for the player's car.
import * as THREE from 'three';
import { CITY, CAR } from './config.js';
import { makeRng, pick, range, clamp, angleLerp, angleDiff } from './random.js';

const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0xd35400, 0x16a085];
const TAXI_COLOR = 0xf5c518;
const POLICE_COLOR = 0x1d4ed8;

export function makeCarMesh(color, isPolice = false, isTaxi = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.0), bodyMat);
  hood.position.set(0, 0.9, 1.7);
  group.add(hood);

  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.45, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.36), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.56, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.36), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.32, 1.56, -0.2);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  if (isTaxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.5, -0.2);
    group.add(sign);
  }

  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), headMat);
    h.position.set(sx, 0.62, 2.22);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    t.position.set(sx, 0.62, -2.22);
    group.add(t);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  group.userData.wheels = [];
  group.userData.frontWheels = [];
  for (const [wx, wz, front] of [[-0.95, 1.45, true], [0.95, 1.45, true], [-0.95, -1.45, false], [0.95, -1.45, false]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    group.userData.wheels.push(wheel);
    if (front) group.userData.frontWheels.push(wheel);
  }
  return group;
}

export class Traffic {
  constructor(scene, city, seed = 11) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed);
    this.cars = [];
    this.spawn();
  }

  spawn() {
    for (let i = 0; i < 14; i += 1) this.addCar(false);
  }

  addCar(isTaxi) {
    const rng = this.rng;
    const point = this.city.randomRoadPoint(rng);
    const road = this.city.nearestRoad(point.x, point.z);
    const dir = rng() < 0.5 ? 1 : -1;
    const color = isTaxi ? TAXI_COLOR : pick(rng, CAR_COLORS);
    const mesh = makeCarMesh(color, false, isTaxi);
    mesh.position.set(point.x, 0, point.z);
    this.scene.add(mesh);
    const car = {
      mesh,
      axis: road.axis,
      coord: road.coord,
      along: road.axis === 'x' ? point.x : point.z,
      dir,
      speed: range(rng, 7, 12),
      cruise: range(rng, 7, 12),
      color,
      isTaxi,
      driver: null, // a pedestrian id when someone is driving it
      parked: false,
    };
    this.syncMesh(car);
    this.cars.push(car);
    return car;
  }

  addParked(x, z, heading, color) {
    const mesh = makeCarMesh(color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = { mesh, axis: 'x', coord: z, along: x, dir: 1, speed: 0, cruise: 0, color, isTaxi: false, driver: null, parked: true, heading };
    this.cars.push(car);
    return car;
  }

  syncMesh(car) {
    if (car.axis === 'x') {
      car.mesh.position.set(car.along, 0, car.coord + (car.dir > 0 ? 3.2 : -3.2));
      car.mesh.rotation.y = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.mesh.position.set(car.coord + (car.dir > 0 ? -3.2 : 3.2), 0, car.along);
      car.mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
    }
    car.heading = car.mesh.rotation.y;
  }

  update(dt, playerCar, others) {
    for (const car of this.cars) {
      if (car.parked || car.driven) continue;
      // Slow down for the car ahead on the same lane.
      let target = car.cruise;
      for (const other of this.cars) {
        if (other === car || other.axis !== car.axis || other.coord !== car.coord || other.dir !== car.dir) continue;
        const gap = (other.along - car.along) * car.dir;
        if (gap > 0 && gap < 13) target = Math.min(target, Math.max(0, (gap - 6) * 0.8));
      }
      if (playerCar && playerCar !== car) {
        const px = playerCar.mesh.position.x;
        const pz = playerCar.mesh.position.z;
        const cx = car.mesh.position.x;
        const cz = car.mesh.position.z;
        const dx = px - cx;
        const dz = pz - cz;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 10 && ((car.axis === 'x' && Math.abs(dz) < 5) || (car.axis === 'z' && Math.abs(dx) < 5))) target = 0;
      }
      car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
      car.along += car.dir * car.speed * dt;
      // At an intersection, sometimes turn onto the cross street.
      const near = CITY.roads.some((r) => Math.abs(car.along - r) < 0.6 && Math.abs(car.along - r) > 0);
      if (near && this.rng() < dt * 0.35) {
        const cross = Math.round(car.along / 60) * 60;
        const newAxis = car.axis === 'x' ? 'z' : 'x';
        if (CITY.roads.includes(cross)) {
          // The car turns at the intersection: its new along-coordinate is the
          // old road's fixed coordinate, its new fixed coordinate is the cross road.
          const oldCoord = car.coord;
          car.axis = newAxis;
          car.coord = cross;
          car.along = oldCoord;
          car.dir = this.rng() < 0.5 ? 1 : -1;
        }
      }
      if (car.along > 195 || car.along < -195) {
        car.along = car.dir > 0 ? -195 : 195;
      }
      this.syncMesh(car);
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 1.4;
    }
  }

  remove(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
  }
}

// Arcade driving for the player's car: speed + heading, building collision,
// car-to-car bumps. Returns a small event object for sound and damage.
export function driveCar(car, input, dt, city, trafficCars) {
  const fwd = input.move().fwd;
  const steer = input.move().strafe;
  const handbrake = input.down('Space');
  const heading = car.heading;
  const forward = { x: Math.sin(heading), z: Math.cos(heading) };
  // Note: mesh faces +Z when rotation.y = 0, so forward is (sin, cos) with heading.
  if (fwd > 0) car.speed += CAR.accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  const steerAmount = steer * CAR.steerMax * clamp(Math.abs(car.speed) / 10, 0, 1) * (car.speed >= 0 ? 1 : -1);
  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  car.heading += steerAmount * grip * dt * clamp(Math.abs(car.speed) / 12, 0.15, 1) * (car.speed >= 0 ? 1 : -1) * 0.9;
  const nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
  const [cx, cz] = city.collideCircle(nx, nz, 1.6);
  const hitWall = cx !== nx || cz !== nz;
  if (hitWall) car.speed *= 0.55;
  car.mesh.position.x = clamp(cx, -CITY.bound, CITY.bound);
  car.mesh.position.z = clamp(cz, -CITY.bound, CITY.bound);
  car.mesh.rotation.y = car.heading;
  // Wheels spin + front wheels steer.
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 1.4;
  const steerVis = steer * 0.4;
  for (const w of car.mesh.userData.frontWheels) w.rotation.y = steerVis;
  // Bump into traffic cars; parked cars are solid obstacles.
  let bump = false;
  for (const other of trafficCars) {
    if (other === car) continue;
    const dx = other.mesh.position.x - car.mesh.position.x;
    const dz = other.mesh.position.z - car.mesh.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 3.6 && d > 0.01) {
      if (other.parked || other.driven) {
        const push = 3.6 - d;
        car.mesh.position.x -= (dx / d) * push;
        car.mesh.position.z -= (dz / d) * push;
        car.speed *= 0.6;
      } else {
        const push = (3.6 - d) * 0.5;
        other.mesh.position.x += (dx / d) * push;
        other.mesh.position.z += (dz / d) * push;
        car.speed *= 0.86;
      }
      bump = true;
    }
  }
  return { hitWall, bump, speed01: Math.abs(car.speed) / CAR.maxSpeed };
}
