// The HUD: DOM overlays (stars, cash, health, objective, speed), a 2D canvas
// minimap, and the start / pause / phone menus. The game owns state; the HUD
// only renders it.
import { CITY } from './config.js';

function el(id) {
  return document.getElementById(id);
}

export class HUD {
  constructor(city) {
    this.city = city;
    this.minimap = el('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.messageTimer = 0;
    this.subtitleTimer = 0;
    this.damageTimer = 0;
    this.mapScale = this.minimap.width / (CITY.bound * 2 + 120);
  }

  toMap(x, z) {
    const s = this.mapScale;
    const cx = this.minimap.width / 2;
    const cy = this.minimap.height / 2;
    return [cx + x * s, cy + z * s];
  }

  setObjective(text) {
    el('objective').textContent = text;
  }

  showMessage(text, seconds = 4) {
    const m = el('message');
    m.textContent = text;
    m.style.opacity = '1';
    this.messageTimer = seconds;
  }

  showSubtitle(text, seconds = 5) {
    const s = el('subtitle');
    s.textContent = text;
    s.style.opacity = '1';
    this.subtitleTimer = seconds;
  }

  flashDamage() {
    this.damageTimer = 0.35;
    el('damage').style.opacity = '0.45';
  }

  setStars(n) {
    const stars = el('stars');
    stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    stars.classList.toggle('hot', n >= 3);
  }

  setCash(cash) {
    el('cash').textContent = `$${Math.floor(cash).toLocaleString('en-US')}`;
  }

  setHealth(hp) {
    const bar = el('health-fill');
    bar.style.width = `${Math.max(0, Math.min(100, hp))}%`;
    bar.classList.toggle('low', hp < 30);
  }

  setAmmo(ammo, reloading) {
    el('ammo').textContent = reloading ? 'RELOADING…' : `AMMO ${ammo}/12`;
  }

  setSpeed(kmh, inCar) {
    const s = el('speed');
    s.style.display = inCar ? 'block' : 'none';
    if (inCar) s.textContent = `${Math.round(kmh)} km/h`;
  }

  setClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    el('clock').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const W = this.minimap.width;
    const H = this.minimap.height;
    ctx.clearRect(0, 0, W, H);
    // Water west, land, roads.
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3d5a3a';
    const [lx] = this.toMap(-CITY.bound, 0);
    ctx.fillRect(lx, 0, W - lx, H);
    ctx.fillStyle = '#e8cf9a';
    const [bx] = this.toMap(-CITY.beachX, 0);
    ctx.fillRect(bx, 0, lx - bx, H);
    // Buildings.
    ctx.fillStyle = '#2c3440';
    for (const b of this.city.buildings) {
      const [x1, z1] = this.toMap(b.x - b.w / 2, b.z - b.d / 2);
      const [x2, z2] = this.toMap(b.x + b.w / 2, b.z + b.d / 2);
      ctx.fillRect(x1, z1, x2 - x1, z2 - z1);
    }
    // Roads.
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = Math.max(2, 12 * this.mapScale);
    for (const c of CITY.roads) {
      const [x1, z1] = this.toMap(c, -CITY.bound);
      const [x2, z2] = this.toMap(c, CITY.bound);
      ctx.beginPath();
      ctx.moveTo(x1, z1);
      ctx.lineTo(x2, z2);
      ctx.stroke();
      const [x3, z3] = this.toMap(-CITY.bound, c);
      const [x4, z4] = this.toMap(CITY.bound, c);
      ctx.beginPath();
      ctx.moveTo(x3, z3);
      ctx.lineTo(x4, z4);
      ctx.stroke();
    }
    // Mission marker: gold star.
    if (state.marker) {
      const [mx, my] = this.toMap(state.marker.x, state.marker.z);
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Traffic: yellow dots. Police: flashing blue/red.
    for (const car of state.traffic) {
      const [x, z] = this.toMap(car.mesh.position.x, car.mesh.position.z);
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    for (const cop of state.cops) {
      const [x, z] = this.toMap(cop.mesh.position.x, cop.mesh.position.z);
      ctx.fillStyle = flash ? '#ff2222' : '#2266ff';
      ctx.beginPath();
      ctx.arc(x, z, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const g of state.guards) {
      const [x, z] = this.toMap(g.mesh.position.x, g.mesh.position.z);
      ctx.fillStyle = '#ff5533';
      ctx.fillRect(x - 2, z - 2, 4, 4);
    }
    // Player: white arrow. Map +x is right and +z is down, so a heading h
    // (forward = sin h, cos h) needs a rotation of PI - h from "up".
    const [px, py] = this.toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - state.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  update(dt, state) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) el('message').style.opacity = '0';
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) el('subtitle').style.opacity = '0';
    }
    if (this.damageTimer > 0) {
      this.damageTimer -= dt;
      if (this.damageTimer <= 0) el('damage').style.opacity = '0';
    }
    this.drawMinimap(state);
  }

  // --- menus ---------------------------------------------------------------
  showStart(saveExists) {
    el('start-screen').style.display = 'flex';
    el('hud').style.display = 'none';
    el('continue-btn').style.display = saveExists ? 'block' : 'none';
  }

  hideStart() {
    el('start-screen').style.display = 'none';
    el('hud').style.display = 'block';
  }

  showPause() {
    el('pause-menu').style.display = 'flex';
  }

  hidePause() {
    el('pause-menu').style.display = 'none';
  }

  showPhone(list) {
    const menu = el('phone-menu');
    const body = el('phone-list');
    body.innerHTML = '';
    for (const m of list) {
      const row = document.createElement('button');
      row.className = 'phone-row';
      row.disabled = !m.available || m.done;
      row.textContent = `${m.done ? '✓ ' : ''}${m.title} — $${m.reward}${m.active ? ' (ACTIVE)' : ''}`;
      row.dataset.index = m.index;
      body.appendChild(row);
    }
    menu.style.display = 'flex';
  }

  hidePhone() {
    el('phone-menu').style.display = 'none';
  }

  showHowTo() {
    el('howto').style.display = 'flex';
  }

  hideHowTo() {
    el('howto').style.display = 'none';
  }

  showEndCard(title, text) {
    el('end-title').textContent = title;
    el('end-text').textContent = text;
    el('end-card').style.display = 'flex';
  }

  hideEndCard() {
    el('end-card').style.display = 'none';
  }
}
