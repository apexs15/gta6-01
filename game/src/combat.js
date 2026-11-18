// Neon Harbor — shooting, bullets, police pursuit, wanted level (fresh code).
import { WORLD, CAR, POLICE, WANTED, COLORS } from './config.js';
import { collideCircle, nearestRoadPoint } from './city.js';
import { sfx } from './audio.js';

export class Bullet {
  constructor(x, y, angle, friendly, speed = 620) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.friendly = friendly;
    this.life = 0.9;
    this.dead = false;
  }
  update(dt) {
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < 0 || this.y < 0 || this.x > WORLD || this.y > WORLD) this.dead = true;
    const fixed = collideCircle(this.x, this.y, 2, 0, 0);
    if (fixed.x !== this.x || fixed.y !== this.y) this.dead = true;
  }
  draw(ctx, cam) {
    ctx.strokeStyle = COLORS.bullet;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.x - Math.cos(this.angle) * 10, this.y - Math.sin(this.angle) * 10);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

export class PoliceCar {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = 0;
    this.speed = 0;
    this.siren = Math.random() * 10;
  }
  update(dt, tx, ty) {
    const want = Math.atan2(ty - this.y, tx - this.x);
    let diff = want - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    this.speed = Math.min(POLICE.carSpeed, this.speed + 420 * dt);
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    const fixed = collideCircle(this.x, this.y, CAR.radius, nx - this.x, ny - this.y);
    this.x = fixed.x; this.y = fixed.y;
    this.siren += dt;
  }
  draw(ctx, cam) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#dfe6f2';
    ctx.beginPath(); ctx.roundRect(-16, -9, 32, 18, 5); ctx.fill();
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(-4, -7, 10, 14);
    const blink = Math.floor(this.siren * 3) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2e4a' : '#2e7bff';
    ctx.fillRect(-2, -8, 6, 5);
    ctx.fillStyle = blink ? '#2e7bff' : '#ff2e4a';
    ctx.fillRect(-2, 3, 6, 5);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(14, -7, 3, 4); ctx.fillRect(14, 3, 3, 4);
    ctx.restore();
  }
}

export class FootCop {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.speed = 132;
    this.hold = 0;
  }
  update(dt, tx, ty) {
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d > POLICE.arrestRadius) {
      const a = Math.atan2(ty - this.y, tx - this.x);
      const nx = this.x + Math.cos(a) * this.speed * dt;
      const ny = this.y + Math.sin(a) * this.speed * dt;
      const fixed = collideCircle(this.x, this.y, 9, nx - this.x, ny - this.y);
      this.x = fixed.x; this.y = fixed.y;
      this.hold = Math.max(0, this.hold - dt * 2);
    } else {
      this.hold += dt;
    }
  }
  draw(ctx, cam) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = '#2e5bbf';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd319';
    ctx.beginPath(); ctx.arc(0, -3, 3, 0, Math.PI * 2); ctx.fill();
    if (this.hold > 0.2) {
      ctx.strokeStyle = '#ff2e4a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 12 + this.hold * 6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

// Wanted manager: stars, decay, police spawning, crime accounting.
export class Wanted {
  constructor() {
    this.stars = 0;
    this.idleMs = 0;
    this.policeCars = [];
    this.footCops = [];
  }
  add(n, reason) {
    this.stars = Math.min(5, this.stars + n);
    this.idleMs = 0;
    void reason;
  }
  clear() { this.stars = 0; this.policeCars = []; this.footCops = []; }
  update(dt, px, py, inCar) {
    if (this.stars > 0) this.idleMs += dt * 1000;
    if (this.idleMs > WANTED.decayIdleMs) {
      this.idleMs = WANTED.decayIdleMs - WANTED.decayStepMs;
      this.stars = Math.max(0, this.stars - 1);
    }
    const wantCars = this.stars >= 3 ? 3 : this.stars >= 2 ? 2 : this.stars >= 1 ? 1 : 0;
    while (this.policeCars.length < wantCars) {
      const a = Math.random() * Math.PI * 2;
      const sx = px + Math.cos(a) * 520;
      const sy = py + Math.sin(a) * 520;
      const snap = nearestRoadPoint(Math.max(60, Math.min(WORLD - 60, sx)), Math.max(60, Math.min(WORLD - 60, sy)));
      this.policeCars.push(new PoliceCar(snap.x, snap.y));
    }
    while (this.policeCars.length > wantCars) this.policeCars.pop();
    const wantCops = this.stars >= 3 && !inCar ? 2 : this.stars >= 2 && !inCar ? 1 : 0;
    while (this.footCops.length < wantCops) {
      const a = Math.random() * Math.PI * 2;
      this.footCops.push(new FootCop(px + Math.cos(a) * 320, py + Math.sin(a) * 320));
    }
    while (this.footCops.length > wantCops) this.footCops.pop();
    for (const c of this.policeCars) c.update(dt, px, py);
    for (const c of this.footCops) c.update(dt, px, py);
  }
  // returns 'busted' when a foot cop holds the player long enough
  checkArrest() {
    for (const c of this.footCops) {
      if (c.hold >= POLICE.arrestHoldMs / 1000) return true;
    }
    return false;
  }
  // police car ramming the player: returns damage this frame
  ramDamage(px, py, inCar) {
    let dmg = 0;
    for (const c of this.policeCars) {
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < CAR.radius + 14) {
        dmg += POLICE.ramDamage;
        // shove the police car back so it doesn't stick
        const a = Math.atan2(c.y - py, c.x - px);
        c.x += Math.cos(a) * 26;
        c.y += Math.sin(a) * 26;
      }
    }
    void inCar;
    return dmg;
  }
  draw(ctx, cam) {
    for (const c of this.policeCars) c.draw(ctx, cam);
    for (const c of this.footCops) c.draw(ctx, cam);
  }
}

export function shootSound() { sfx.shot(); }
