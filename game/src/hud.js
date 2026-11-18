// Neon Harbor — HUD + minimap with N compass (fresh code for round 3).
import { WORLD, COLORS } from './config.js';
import { buildings } from './city.js';

export function drawHUD(ctx, vw, vh, s) {
  // Top-left panel: cash, health, ammo, wanted stars
  ctx.fillStyle = 'rgba(8,10,20,0.72)';
  ctx.beginPath(); ctx.roundRect(12, 12, 250, 116, 10); ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.neonGreen;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`$ ${s.cash}`, 26, 40);
  ctx.fillStyle = '#e8ecf8';
  ctx.font = '13px monospace';
  ctx.fillText(`HEALTH ${Math.max(0, Math.ceil(s.health))}`, 26, 62);
  ctx.fillStyle = '#3a2a3a';
  ctx.fillRect(110, 52, 130, 10);
  ctx.fillStyle = s.health > 30 ? COLORS.neonGreen : '#ff2e4a';
  ctx.fillRect(110, 52, 130 * Math.max(0, s.health / 100), 10);
  ctx.fillStyle = '#e8ecf8';
  ctx.fillText(`AMMO ${s.inCar ? '—' : s.ammo + ' / ' + s.mag}`, 26, 84);
  // wanted stars
  const stars = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
  ctx.fillStyle = s.wanted > 0 ? '#ff2e4a' : '#5a6a8a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(stars, 26, 96 + 0);
  ctx.font = '13px monospace';
  ctx.fillStyle = '#8a94b8';
  ctx.fillText(s.inCar ? 'DRIVING — E to exit' : 'ON FOOT — E near a car to steal', 26, 118 - 14 + 14);
  // Mission tracker (bottom-left)
  if (s.missionText) {
    ctx.fillStyle = 'rgba(8,10,20,0.72)';
    const w = Math.min(vw - 24, 460);
    ctx.beginPath(); ctx.roundRect(12, vh - 62, w, 50, 10); ctx.fill();
    ctx.fillStyle = COLORS.neonYellow;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(s.missionTitle || 'MISSION', 26, vh - 40);
    ctx.fillStyle = '#e8ecf8';
    ctx.font = '13px monospace';
    ctx.fillText(s.missionText, 26, vh - 22);
    if (s.missionTimer > 0) {
      ctx.fillStyle = s.missionTimer < 15 ? '#ff2e4a' : COLORS.neonCyan;
      ctx.fillText(`${Math.ceil(s.missionTimer)}s`, w - 40, vh - 40);
    }
  }
  // Centre toast
  if (s.toast && s.toastT > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = s.toastColor || COLORS.neonYellow;
    ctx.shadowColor = s.toastColor || COLORS.neonYellow;
    ctx.shadowBlur = 14;
    ctx.fillText(s.toast, vw / 2, 120);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }
  // Phone menu
  if (s.phoneOpen) {
    ctx.fillStyle = 'rgba(4,6,14,0.85)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#101830';
    ctx.beginPath(); ctx.roundRect(vw / 2 - 260, 90, 520, 380, 14); ctx.fill();
    ctx.strokeStyle = COLORS.neonPink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.neonPink;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MARA — JOBS', vw / 2, 130);
    ctx.textAlign = 'left';
    ctx.font = '14px monospace';
    let y = 170;
    for (const m of s.missionList) {
      const col = m.done ? '#39ff88' : m.locked ? '#5a6a8a' : '#e8ecf8';
      ctx.fillStyle = col;
      ctx.fillText(`${m.done ? 'DONE' : m.locked ? 'LOCKED' : m.id + '.'} ${m.title} — $${m.reward}`, vw / 2 - 230, y);
      ctx.fillStyle = '#8a94b8';
      ctx.font = '12px monospace';
      ctx.fillText(`   ${m.giver}: ${m.brief.slice(0, 62)}`, vw / 2 - 230, y + 18);
      ctx.font = '14px monospace';
      y += 56;
    }
    ctx.fillStyle = '#8a94b8';
    ctx.font = '13px monospace';
    ctx.fillText('Press 1-5 to take a job · Q / Esc to close', vw / 2 - 230, 440);
  }
}

export function drawMinimap(ctx, vw, s) {
  const size = 170;
  const x0 = vw - size - 14;
  const y0 = 26;
  const scale = size / WORLD;
  ctx.fillStyle = 'rgba(8,10,20,0.78)';
  ctx.beginPath(); ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 10); ctx.fill();
  // N compass (above the map, clear of the canvas edge)
  ctx.fillStyle = COLORS.neonYellow;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + size / 2, y0 - 9);
  ctx.textAlign = 'left';
  // water + docks
  ctx.fillStyle = '#0a3a5c';
  ctx.fillRect(x0, y0 + (2360 * scale), size, size - 2360 * scale);
  // buildings (sparse dots)
  ctx.fillStyle = '#3a4a7a';
  for (const b of buildings) {
    if ((b.x + b.y) % 3 !== 0) continue;
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  // mission marker
  if (s.marker) {
    const pulse = 4 + Math.sin(s.time * 5) * 2;
    ctx.fillStyle = COLORS.neonYellow;
    ctx.beginPath();
    ctx.arc(x0 + s.marker.x * scale, y0 + s.marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // police
  ctx.fillStyle = '#2e7bff';
  for (const p of s.police) {
    ctx.beginPath(); ctx.arc(x0 + p.x * scale, y0 + p.y * scale, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // player arrow
  ctx.save();
  ctx.translate(x0 + s.px * scale, y0 + s.py * scale);
  ctx.rotate(s.angle);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // viewport rect
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + (s.camX - s.vw / 2) * scale, y0 + (s.camY - s.vh / 2) * scale, s.vw * scale, s.vh * scale);
}
