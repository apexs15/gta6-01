// Solara Bay — HUD: health, cash, wanted stars, ammo, speed, mission text,
// the minimap (with its N compass), the phone menu and toast messages.

import { MISSIONS, PHONE_TITLE, WORLD } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      health: document.getElementById('health-fill'),
      cash: document.getElementById('cash'),
      stars: document.getElementById('stars'),
      ammo: document.getElementById('ammo'),
      speed: document.getElementById('speed'),
      mission: document.getElementById('mission-label'),
      objective: document.getElementById('objective-label'),
      timer: document.getElementById('timer-label'),
      toast: document.getElementById('toast'),
      phone: document.getElementById('phone'),
      phoneList: document.getElementById('phone-list'),
      crosshair: document.getElementById('crosshair'),
      interact: document.getElementById('interact-hint'),
    };
    this.minimap = document.getElementById('minimap');
    this.mm = this.minimap ? this.minimap.getContext('2d') : null;
    this.toastTimer = 0;
    this.buildPhone();
  }

  buildPhone() {
    if (!this.el.phoneList) return;
    this.el.phoneList.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = 'phone-job';
      row.dataset.index = String(i);
      row.innerHTML = `<b>${i + 1}. ${m.name}</b><span>$${m.reward} — ${m.giver}</span><em>${m.brief}</em>`;
      row.addEventListener('click', () => {
        if (this.onPickJob) this.onPickJob(i);
      });
      this.el.phoneList.appendChild(row);
    });
  }

  markJobsDone(doneSet, activeIndex) {
    if (!this.el.phoneList) return;
    const rows = this.el.phoneList.querySelectorAll('.phone-job');
    rows.forEach((row, i) => {
      row.classList.toggle('done', doneSet.has(MISSIONS[i].id));
      row.classList.toggle('active', i === activeIndex);
    });
  }

  setPhoneOpen(open) {
    if (this.el.phone) this.el.phone.classList.toggle('open', open);
  }

  isPhoneOpen() {
    return !!(this.el.phone && this.el.phone.classList.contains('open'));
  }

  toast(msg, seconds) {
    if (!this.el.toast) return;
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('show');
    this.toastTimer = seconds || 3;
  }

  update(dt, s) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.el.toast) this.el.toast.classList.remove('show');
    }
    if (this.el.health) this.el.health.style.width = Math.max(0, s.health) + '%';
    if (this.el.cash) this.el.cash.textContent = '$' + Math.floor(s.cash);
    if (this.el.stars) {
      this.el.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(Math.max(0, 5 - s.wanted));
      this.el.stars.classList.toggle('hot', s.wanted > 0);
    }
    if (this.el.ammo) this.el.ammo.textContent = s.reloading ? 'RELOADING…' : `AMMO ${s.ammo}/12`;
    if (this.el.speed) this.el.speed.textContent = s.inCar ? Math.round(Math.abs(s.speedKmh)) + ' km/h' : '';
    if (this.el.mission) this.el.mission.textContent = s.missionName || 'No job — open the phone (P)';
    if (this.el.objective) this.el.objective.textContent = s.objective || '';
    if (this.el.timer) {
      this.el.timer.textContent = s.timerLeft > 0 ? Math.ceil(s.timerLeft) + 's' : '';
    }
    if (this.el.crosshair) this.el.crosshair.style.display = s.inCar ? 'none' : 'block';
    if (this.el.interact) {
      this.el.interact.style.display = s.interactHint ? 'block' : 'none';
      if (s.interactHint) this.el.interact.textContent = s.interactHint;
    }
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    if (!this.mm) return;
    const ctx = this.mm;
    const W = this.minimap.width;
    const H = this.minimap.height;
    const span = 380;
    const toX = (x) => ((x + span / 2) / span) * W;
    const toY = (z) => ((z + span / 2) / span) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1d2b1a';
    ctx.fillRect(0, 0, W, H);
    // Sea on the east edge.
    ctx.fillStyle = '#2a6a9a';
    ctx.fillRect(toX(WORLD.WATER_X), 0, W - toX(WORLD.WATER_X), H);
    // Roads.
    ctx.strokeStyle = '#555a60';
    ctx.lineWidth = 3;
    for (const c of WORLD.ROADS) {
      ctx.beginPath();
      ctx.moveTo(toX(c), 0);
      ctx.lineTo(toX(c), H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toY(c));
      ctx.lineTo(W, toY(c));
      ctx.stroke();
    }
    // Mission marker.
    if (s.marker) {
      ctx.fillStyle = '#ffd23e';
      ctx.save();
      ctx.translate(toX(s.marker.x), toY(s.marker.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    // Traffic dots.
    ctx.fillStyle = '#bbbbbb';
    for (const c of s.trafficDots || []) {
      ctx.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3);
    }
    // Police dots.
    ctx.fillStyle = '#ff4040';
    for (const c of s.policeDots || []) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toY(c.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, rotated by heading. The arrow is drawn pointing up,
    // and the map's down axis is world +z, so the angle is PI - heading.
    ctx.save();
    ctx.translate(toX(s.px), toY(s.pz));
    ctx.rotate(Math.PI - s.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Compass: N sits at the top of the minimap.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', W / 2, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(W / 2, 18);
    ctx.lineTo(W / 2, 28);
    ctx.stroke();
  }
}
