// Neon Harbor — city generation + collision (fresh code for round 3).
// The city is a grid of roads; blocks hold buildings, the south strip is the
// docks, and the centre blocks are the neon district.
import { WORLD, ROAD_STEP, ROAD_WIDTH, BLOCK, NEON_DISTRICT, DOCKS, COLORS } from './config.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const roadCenters = [];
for (let c = 100; c <= WORLD - 100; c += ROAD_STEP) roadCenters.push(c);

export function onRoad(x, y, margin = 0) {
  const hw = ROAD_WIDTH / 2 + margin;
  for (const c of roadCenters) {
    if (Math.abs(x - c) < hw || Math.abs(y - c) < hw) return true;
  }
  return false;
}

export function inWater(x, y) {
  return y > DOCKS.waterY;
}

export function inDocks(x, y) {
  return y >= DOCKS.y0 && y <= DOCKS.waterY;
}

export function inNeon(x, y) {
  return x >= NEON_DISTRICT.x0 && x <= NEON_DISTRICT.x1 && y >= NEON_DISTRICT.y0 && y <= NEON_DISTRICT.y1;
}

// Buildings: one per block, inset from the roads, with a neon trim colour in
// the neon district and a couple of container stacks on the docks.
export const buildings = [];
export const obstacles = []; // {x, y, w, h} solid rects (buildings + containers)

function buildCity() {
  const rnd = mulberry(20261118);
  const neonPalette = [COLORS.neonPink, COLORS.neonCyan, COLORS.neonYellow, COLORS.neonGreen];
  for (let bx = 100; bx < WORLD - 100; bx += ROAD_STEP) {
    for (let by = 100; by < WORLD - 100; by += ROAD_STEP) {
      if (by >= DOCKS.y0) continue; // docks handled below
      const x = bx + ROAD_WIDTH / 2 + 8;
      const y = by + ROAD_WIDTH / 2 + 8;
      const w = BLOCK - 16;
      const h = BLOCK - 16;
      const cx = x + w / 2, cy = y + h / 2;
      const neon = inNeon(cx, cy) ? neonPalette[Math.floor(rnd() * neonPalette.length)] : null;
      const b = { x, y, w, h, neon, shade: 0.85 + rnd() * 0.3, roof: rnd() };
      buildings.push(b);
      obstacles.push({ x, y, w, h });
    }
  }
  // Dock containers: solid stacks the player must drive around.
  for (let i = 0; i < 10; i++) {
    const x = 160 + i * 210 + (i % 2) * 40;
    const y = DOCKS.y0 + 30 + (i % 3) * 26;
    obstacles.push({ x, y, w: 120, h: 34 });
  }
}
buildCity();

// Circle vs solid rects. Returns corrected position (slides along walls).
export function collideCircle(x, y, r, vx, vy) {
  let nx = x + vx;
  let ny = y + vy;
  nx = Math.max(r, Math.min(WORLD - r, nx));
  ny = Math.max(r, Math.min(WORLD - r, ny));
  if (inWater(nx, ny)) { nx = x; ny = y; }
  for (const o of obstacles) {
    const cx = Math.max(o.x, Math.min(nx, o.x + o.w));
    const cy = Math.max(o.y, Math.min(ny, o.y + o.h));
    const dx = nx - cx, dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      } else {
        // centre inside the rect: push out along the smallest axis
        const left = nx - o.x, right = o.x + o.w - nx;
        const top = ny - o.y, bottom = o.y + o.h - ny;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = o.x - r;
        else if (m === right) nx = o.x + o.w + r;
        else if (m === top) ny = o.y - r;
        else ny = o.y + o.h + r;
      }
    }
  }
  return { x: nx, y: ny };
}

export function nearestRoadPoint(x, y) {
  let bx = roadCenters[0], by = roadCenters[0];
  for (const c of roadCenters) {
    if (Math.abs(c - x) < Math.abs(bx - x)) bx = c;
    if (Math.abs(c - y) < Math.abs(by - y)) by = c;
  }
  // snap to whichever axis road is closer
  if (Math.abs(bx - x) < Math.abs(by - y)) return { x: bx, y };
  return { x, y: by };
}

// True when the straight segment between two points crosses no solid rect
// (sampled every ~14px). Used to spawn shooters where the player can see them.
export function hasLineOfSight(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 14));
  for (let i = 1; i < steps; i++) {
    const px = x1 + (dx * i) / steps;
    const py = y1 + (dy * i) / steps;
    for (const o of obstacles) {
      if (px > o.x - 2 && px < o.x + o.w + 2 && py > o.y - 2 && py < o.y + o.h + 2) return false;
    }
  }
  return true;
}

export function drawCity(ctx, cam, vw, vh) {
  const x0 = cam.x - vw / 2 - 60, x1 = cam.x + vw / 2 + 60;
  const y0 = cam.y - vh / 2 - 60, y1 = cam.y + vh / 2 + 60;
  // ground
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // docks concrete + water
  ctx.fillStyle = COLORS.dock;
  ctx.fillRect(x0, DOCKS.y0, x1 - x0, DOCKS.waterY - DOCKS.y0);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x0, DOCKS.waterY, x1 - x0, y1 - DOCKS.waterY);
  ctx.strokeStyle = '#1b6ea8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, DOCKS.waterY); ctx.lineTo(x1, DOCKS.waterY); ctx.stroke();
  // roads
  ctx.fillStyle = COLORS.road;
  for (const c of roadCenters) {
    if (c > y0 - 40 && c < y1 + 40) ctx.fillRect(x0, c - ROAD_WIDTH / 2, x1 - x0, ROAD_WIDTH);
    if (c > x0 - 40 && c < x1 + 40) ctx.fillRect(c - ROAD_WIDTH / 2, y0, ROAD_WIDTH, y1 - y0);
  }
  // lane dashes
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const c of roadCenters) {
    if (c > y0 - 40 && c < y1 + 40) { ctx.moveTo(x0, c); ctx.lineTo(x1, c); }
    if (c > x0 - 40 && c < x1 + 40) { ctx.moveTo(c, y0); ctx.lineTo(c, y1); }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // buildings
  for (const b of buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = b.neon ? '#1a2140' : COLORS.building;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = `rgba(255,255,255,${0.04 * b.shade})`;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    if (b.neon) {
      ctx.strokeStyle = b.neon;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 12;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = '#313d63';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    }
  }
  // dock containers
  for (const o of obstacles) {
    if (o.y < DOCKS.y0) continue;
    if (o.x > x1 || o.x + o.w < x0 || o.y > y1 || o.y + o.h < y0) continue;
    ctx.fillStyle = '#3a5a78';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#56779a';
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
    ctx.beginPath();
    for (let k = 1; k < 5; k++) { ctx.moveTo(o.x + (o.w / 5) * k, o.y); ctx.lineTo(o.x + (o.w / 5) * k, o.y + o.h); }
    ctx.stroke();
  }
  // harbour lighthouse marker at the far south-west pier
  ctx.fillStyle = COLORS.neonYellow;
  ctx.beginPath(); ctx.arc(150, DOCKS.waterY - 8, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b0e1a';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LIGHTHOUSE', 150, DOCKS.waterY - 18);
}
