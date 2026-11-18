// Neon Harbor — traffic cars + pedestrians (fresh code for round 3).
import { WORLD, ROAD_STEP, ROAD_WIDTH, CAR, COLORS } from './config.js';
import { roadCenters, onRoad, collideCircle, nearestRoadPoint } from './city.js';

const CAR_COLORS = ['#c94f5e', '#4f8fc9', '#c9a44f', '#7a4fc9', '#4fc98a', '#c9c9c9', '#e86a2a'];

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export class TrafficCar {
  constructor(x, y, angle, speed) {
    this.x = x; this.y = y;
    this.angle = angle; // direction of travel
    this.speed = speed;
    this.color = pick(CAR_COLORS);
    this.stopped = 0;
    this.turnAt = null;
  }
  update(dt, player, others) {
    if (this.stopped > 0) { this.stopped -= dt; return; }
    const AXIS = Math.PI / 2;
    const onV = roadCenters.some((c) => Math.abs(this.x - c) < ROAD_WIDTH / 2 - 6);
    const onH = roadCenters.some((c) => Math.abs(this.y - c) < ROAD_WIDTH / 2 - 6);
    if (onV || onH) {
      // axis-locked: traffic drives straight along its road, so cars never
      // drift diagonally into building corners
      this.angle = Math.round(this.angle / AXIS) * AXIS;
      if (onV && onH && Math.random() < dt * 0.3) {
        this.angle += (Math.random() < 0.5 ? 1 : -1) * AXIS;
      }
    } else {
      // off-road (shouldn't happen): steer back toward the nearest road axis
      const snapped = nearestRoadPoint(this.x, this.y);
      const targetAngle = Math.abs(snapped.x - this.x) < Math.abs(snapped.y - this.y)
        ? (this.y < snapped.y ? Math.PI / 2 : -Math.PI / 2)
        : (this.x < snapped.x ? 0 : Math.PI);
      let diff = targetAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    }
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    const fixed = collideCircle(this.x, this.y, CAR.radius, nx - this.x, ny - this.y);
    const moved = Math.hypot(fixed.x - this.x, fixed.y - this.y);
    this.x = fixed.x; this.y = fixed.y;
    if (moved < this.speed * dt * 0.3) {
      // blocked (wall / car): turn 90° and pause briefly
      this.angle += Math.PI / 2;
      this.stopped = rand(0.3, 0.9);
    }
    // don't rear-end the player car: simple slow-down
    if (player.inCar && player.car) {
      const d = Math.hypot(player.car.x - this.x, player.car.y - this.y);
      if (d < 70) this.stopped = Math.max(this.stopped, 0.4);
    }
    void others;
  }
  draw(ctx, cam) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.roundRect(-16, -9, 32, 18, 5); ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(-4, -7, 10, 14);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(14, -7, 3, 4); ctx.fillRect(14, 3, 3, 4);
    ctx.restore();
  }
}

export class Pedestrian {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = rand(0, Math.PI * 2);
    this.speed = rand(28, 52);
    this.flee = 0;
    this.color = pick(['#e8c8a0', '#a0c8e8', '#e8a0c8', '#c8e8a0', '#d8d8d8']);
  }
  update(dt, danger) {
    if (danger) {
      const d = Math.hypot(this.x - danger.x, this.y - danger.y);
      if (d < 260) {
        this.flee = 2.5;
        this.angle = Math.atan2(this.y - danger.y, this.x - danger.x);
      }
    }
    if (this.flee > 0) {
      this.flee -= dt;
      this.speed = 130;
    } else {
      this.speed = 40;
      if (Math.random() < dt * 0.15) this.angle = rand(0, Math.PI * 2);
    }
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    const fixed = collideCircle(this.x, this.y, 8, nx - this.x, ny - this.y);
    this.x = fixed.x; this.y = fixed.y;
  }
  draw(ctx, cam) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b0e1a';
    ctx.beginPath(); ctx.arc(Math.cos(this.angle) * 3, Math.sin(this.angle) * 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export function spawnTrafficCarNear(x, y, minDist = 260) {
  for (let tries = 0; tries < 20; tries++) {
    const cx = Math.max(60, Math.min(WORLD - 60, x + rand(-520, 520)));
    const cy = Math.max(60, Math.min(WORLD - 60, y + rand(-520, 520)));
    if (Math.hypot(cx - x, cy - y) < minDist) continue;
    const snap = nearestRoadPoint(cx, cy);
    const angle = Math.abs(snap.x - cx) < 1 ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
    return new TrafficCar(snap.x, snap.y, angle, rand(70, 120));
  }
  return null;
}

export function spawnPedNear(x, y) {
  const px = Math.max(60, Math.min(WORLD - 60, x + rand(-320, 320)));
  const py = Math.max(60, Math.min(WORLD - 60, y + rand(-320, 320)));
  return new Pedestrian(px, py);
}
