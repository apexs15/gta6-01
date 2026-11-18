// Neon Harbor — top-down 2D open-world crime game (fresh code for round 3).
// Mara Voss, getaway driver. Walk, steal cars, dodge the law, run 5 jobs.
import { WORLD, ROAD_STEP, ROAD_WIDTH, PLAYER, CAR, WANTED, COLORS, MISSION_REWARDS, START_CASH, FINE_RATE, SAVE_KEY } from './config.js';
import { keys, mouse, pressed, consume, initInput, endFrame } from './input.js';
import { drawCity, collideCircle, onRoad, inWater, nearestRoadPoint, hasLineOfSight } from './city.js';
import { TrafficCar, Pedestrian, spawnTrafficCarNear, spawnPedNear } from './traffic.js';
import { Bullet, Wanted, shootSound } from './combat.js';
import { MissionRunner, MISSIONS } from './missions.js';
import { drawHUD, drawMinimap } from './hud.js';
import { initAudio, sfx, setEngine, setSiren } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let vw = 1280, vh = 720;
function resize() {
  vw = window.innerWidth; vh = window.innerHeight;
  canvas.width = vw; canvas.height = vh;
}
window.addEventListener('resize', resize);
resize();
initInput(canvas);

const CLINIC = { x: 1200, y: 2100 };
const GARAGE = { x: 300, y: 300 };

const player = {
  x: 1200, y: 1300, angle: -Math.PI / 2,
  health: PLAYER.health, cash: START_CASH,
  ammo: PLAYER.magSize, mag: PLAYER.magSize,
  reloading: 0, lastDamageMs: 0, lastShotMs: 0,
  inCar: false, car: null, speed: 0,
};

const cam = { x: player.x, y: player.y };
const wanted = new Wanted();
const bullets = [];
const enemies = [];
let traffic = [];
let peds = [];
let state = 'title'; // title | playing | busted | wasted | story
let stateT = 0;
let toast = '', toastT = 0, toastColor = COLORS.neonYellow;
let phoneOpen = false;
let time = 0;
let saveTimer = 0;
let targetCar = null; // traffic car marked for mission 2
let storyShown = false;

const runner = new MissionRunner((type, data) => {
  if (type === 'start') {
    showToast(`JOB: ${data.mission.title}`, COLORS.neonCyan);
    sfx.blip();
    if (data.mission.id === 2) markTargetCar();
    if (data.mission.id === 3 || data.mission.id === 5) spawnAttackersPending = true;
  } else if (type === 'objective') {
    showToast('Objective updated', COLORS.neonCyan);
    sfx.blip();
  } else if (type === 'done') {
    player.cash += data.reward;
    showToast(`JOB DONE — +$${data.reward}`, COLORS.neonGreen);
    sfx.missionDone();
    saveGame();
  } else if (type === 'failed') {
    showToast(`JOB FAILED — ${data.reason}`, '#ff2e4a');
    sfx.busted();
  } else if (type === 'story') {
    state = 'story';
    stateT = 0;
  }
});
let spawnAttackersPending = false;
let lastCrashMs = 0;

function showToast(text, color) {
  toast = text; toastT = 3.2; toastColor = color || COLORS.neonYellow;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash,
      done: runner.done,
      storyDone: runner.storyDone,
      x: player.x, y: player.y,
      health: player.health,
    }));
  } catch (_e) { /* storage may be unavailable */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_e) { return null; }
}

function startGame(fromSave) {
  initAudio();
  const save = fromSave ? loadSave() : null;
  if (save) {
    player.cash = save.cash || START_CASH;
    runner.done = save.done || [false, false, false, false, false];
    runner.storyDone = !!save.storyDone;
    player.x = save.x || 1200; player.y = save.y || 1300;
    player.health = save.health || PLAYER.health;
  } else {
    player.cash = START_CASH;
    player.health = PLAYER.health;
    player.x = 1200; player.y = 1300;
  }
  player.inCar = false; player.car = null;
  player.ammo = PLAYER.magSize;
  wanted.clear();
  bullets.length = 0;
  enemies.length = 0;
  cam.x = player.x; cam.y = player.y;
  state = 'playing';
  showToast('Welcome to Neon Harbor', COLORS.neonYellow);
}

function doBusted() {
  if (state !== 'playing') return;
  state = 'busted'; stateT = 0;
  const fine = Math.floor(player.cash * FINE_RATE);
  player.cash -= fine;
  sfx.busted();
  setSiren(false);
  setEngine(false, 0);
  saveGame();
}

function doWasted() {
  if (state !== 'playing') return;
  state = 'wasted'; stateT = 0;
  const fine = Math.floor(player.cash * FINE_RATE);
  player.cash -= fine;
  sfx.wasted();
  setSiren(false);
  setEngine(false, 0);
  saveGame();
}

function respawn() {
  player.x = CLINIC.x; player.y = CLINIC.y;
  player.health = PLAYER.health;
  player.inCar = false; player.car = null;
  player.ammo = PLAYER.magSize;
  wanted.clear();
  bullets.length = 0;
  enemies.length = 0;
  cam.x = player.x; cam.y = player.y;
  state = 'playing';
  showToast('Patched up at the clinic', COLORS.neonGreen);
}

function markTargetCar() {
  // park a marked coupe near the casino for mission 2
  const c = new TrafficCar(1300, 900, 0, 0);
  c.color = COLORS.neonYellow;
  traffic.push(c);
  targetCar = c;
}

// Pick a spawn point for an attacker: on a road, 170-310px from the player,
// with a clear line of sight so the player can actually shoot back.
function pickAttackerSpawn() {
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * Math.PI * 2;
    const x = Math.max(60, Math.min(WORLD - 60, player.x + Math.cos(a) * (170 + Math.random() * 140)));
    const y = Math.max(60, Math.min(WORLD - 60, player.y + Math.sin(a) * (170 + Math.random() * 140)));
    const snap = nearestRoadPoint(x, y);
    if (hasLineOfSight(player.x, player.y, snap.x, snap.y)) return snap;
  }
  // fallback: nearest road point straight north of the player
  return nearestRoadPoint(player.x, player.y - 200);
}

function spawnAttackers(n) {
  for (let i = 0; i < n; i++) {
    const snap = pickAttackerSpawn();
    enemies.push({ x: snap.x, y: snap.y, hp: 3, shootCd: 0.8 + Math.random() * 0.8, angle: 0, px: snap.x, py: snap.y, stuckT: 0 });
  }
}

function nearestCar(maxDist) {
  let best = null, bd = maxDist;
  for (const c of traffic) {
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function stealCar(c) {
  traffic.splice(traffic.indexOf(c), 1);
  player.inCar = true;
  player.car = { x: c.x, y: c.y, angle: c.angle, speed: 0, health: CAR.health };
  player.x = c.x; player.y = c.y;
  wanted.add(WANTED.stealCar, 'steal');
  sfx.carSteal();
  showToast('Car stolen — the law is coming', '#ff2e4a');
  // the driver bails out as a fleeing pedestrian
  const p = new Pedestrian(c.x + 24, c.y);
  p.flee = 3;
  peds.push(p);
  if (targetCar === c) {
    targetCar = null;
    if (runner.active && runner.active.def.id === 2 && runner.active.step === 0) runner.advance();
  }
}

function exitCar() {
  const c = player.car;
  player.inCar = false;
  player.car = null;
  player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 26;
  player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 26;
  const fixed = collideCircle(player.x, player.y, PLAYER.radius, 0, 0);
  player.x = fixed.x; player.y = fixed.y;
  traffic.push(new TrafficCar(c.x, c.y, c.angle, 0));
}

function fireBullet() {
  if (player.reloading > 0) return;
  if (player.ammo <= 0) {
    startReload();
    return;
  }
  const now = performance.now();
  if (now - player.lastShotMs < 170) return;
  player.lastShotMs = now;
  player.ammo--;
  const a = player.angle + (Math.random() - 0.5) * 0.05;
  bullets.push(new Bullet(
    player.x + Math.cos(player.angle) * 16,
    player.y + Math.sin(player.angle) * 16,
    a, true,
  ));
  sfx.shot();
  // nearby pedestrians flee the gunfire
  for (const p of peds) {
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d < 260) { p.flee = 2.5; p.angle = Math.atan2(p.y - player.y, p.x - player.x); }
  }
}

function startReload() {
  if (player.reloading > 0 || player.ammo === player.mag) return;
  player.reloading = PLAYER.reloadMs / 1000;
  sfx.reload();
}

function hurtPlayer(dmg) {
  if (state !== 'playing') return;
  player.health -= dmg;
  player.lastDamageMs = performance.now();
  if (player.health <= 0) {
    player.health = 0;
    doWasted();
  }
}

function update(dt) {
  time += dt;
  if (toastT > 0) toastT -= dt;
  if (state === 'busted' || state === 'wasted') {
    stateT += dt;
    if (stateT > 2.6) respawn();
    return;
  }
  if (state === 'story') {
    stateT += dt;
    if (consume('confirm')) { state = 'playing'; storyShown = true; }
    return;
  }
  if (state !== 'playing') return;

  // phone menu
  if (consume('phone')) phoneOpen = !phoneOpen;
  if (phoneOpen) {
    if (consume('close')) phoneOpen = false;
    for (let i = 1; i <= 5; i++) {
      if (consume('digit' + i)) {
        if (runner.start(i)) phoneOpen = false;
      }
    }
    endFrame();
    return;
  }

  // aim follows the mouse
  const mwx = cam.x - vw / 2 + mouse.x;
  const mwy = cam.y - vh / 2 + mouse.y;
  if (!player.inCar) player.angle = Math.atan2(mwy - player.y, mwx - player.x);

  // enter / exit car
  if (consume('enter')) {
    if (player.inCar) exitCar();
    else {
      const c = nearestCar(52);
      if (c) stealCar(c);
    }
  }
  if (consume('reload') && !player.inCar) startReload();
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) { player.ammo = player.mag; player.reloading = 0; }
  }

  // shooting (on foot only) — the consume('shoot') edge makes a quick click
  // fire even if the button is released before the next frame
  if (!player.inCar && (keys.shoot || mouse.down || consume('shoot'))) fireBullet();

  // movement
  if (player.inCar) {
    const c = player.car;
    if (keys.up) c.speed += CAR.accel * dt;
    else if (keys.down) c.speed -= CAR.brake * dt;
    else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 240 * dt);
    c.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, c.speed));
    const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    if (Math.abs(c.speed) > 12) {
      c.angle += steer * CAR.turnRate * dt * Math.sign(c.speed) * Math.min(1, Math.abs(c.speed) / 120);
    }
    const ox = c.x, oy = c.y;
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const fixed = collideCircle(c.x, c.y, CAR.radius, nx - c.x, ny - c.y);
    const moved = Math.hypot(fixed.x - ox, fixed.y - oy);
    if (moved < Math.abs(c.speed) * dt * 0.4 && Math.abs(c.speed) > 90) {
      // hard hit on a wall: bounce back, damage throttled so a scrape
      // against a corner doesn't shred the car in a second
      c.speed *= -0.15;
      if (performance.now() - lastCrashMs > 450) {
        lastCrashMs = performance.now();
        c.health -= 3;
        sfx.crash();
      }
    }
    c.x = fixed.x; c.y = fixed.y;
    player.x = c.x; player.y = c.y;
    player.angle = c.angle;
    player.speed = c.speed;
    if (c.health <= 0) {
      // wreck: bail out on foot
      player.inCar = false;
      player.car = null;
      showToast('Your ride is wrecked', '#ff2e4a');
      hurtPlayer(10);
    }
  } else {
    const mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      const vx = (mx / len) * PLAYER.walkSpeed * dt;
      const vy = (my / len) * PLAYER.walkSpeed * dt;
      const fixed = collideCircle(player.x, player.y, PLAYER.radius, vx, vy);
      player.x = fixed.x; player.y = fixed.y;
    }
    player.speed = len > 0 ? PLAYER.walkSpeed : 0;
  }

  // health regen after a quiet stretch
  if (performance.now() - player.lastDamageMs > PLAYER.regenDelayMs && player.health > 0 && player.health < PLAYER.health) {
    player.health = Math.min(PLAYER.health, player.health + PLAYER.regenPerSec * dt);
  }

  // traffic + peds population near the player
  if (traffic.length < 14) {
    const c = spawnTrafficCarNear(player.x, player.y);
    if (c) traffic.push(c);
  }
  if (peds.length < 24) peds.push(spawnPedNear(player.x, player.y));
  traffic = traffic.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) < 950 || c === targetCar);
  peds = peds.filter((p) => Math.hypot(p.x - player.x, p.y - player.y) < 800);
  for (const c of traffic) c.update(dt, player, traffic);
  const danger = bullets.length ? { x: bullets[bullets.length - 1].x, y: bullets[bullets.length - 1].y } : null;
  for (const p of peds) p.update(dt, danger);

  // running over pedestrians while driving
  if (player.inCar && Math.abs(player.speed) > 60) {
    for (let i = peds.length - 1; i >= 0; i--) {
      if (Math.hypot(peds[i].x - player.x, peds[i].y - player.y) < 22) {
        peds.splice(i, 1);
        wanted.add(WANTED.killPed, 'runover');
        showToast('Pedestrian down — wanted up', '#ff2e4a');
      }
    }
  }

  // bullets
  for (const b of bullets) b.update(dt);
  for (const b of bullets) {
    if (b.dead) continue;
    if (b.friendly) {
      for (let i = peds.length - 1; i >= 0; i--) {
        if (Math.hypot(peds[i].x - b.x, peds[i].y - b.y) < 12) {
          peds.splice(i, 1);
          wanted.add(WANTED.killPed, 'shot');
          b.dead = true;
          break;
        }
      }
      if (b.dead) continue;
      for (let i = enemies.length - 1; i >= 0; i--) {
        if (Math.hypot(enemies[i].x - b.x, enemies[i].y - b.y) < 14) {
          enemies[i].hp -= 1;
          b.dead = true;
          if (enemies[i].hp <= 0) {
            enemies.splice(i, 1);
            wanted.add(WANTED.killCop, 'enemy');
            if (runner.active) {
              runner.active.kills++;
              const obj = runner.currentObjective();
              if (obj && obj.type === 'kill' && runner.active.kills >= obj.count) runner.advance();
            }
          }
          break;
        }
      }
      if (b.dead) continue;
      for (const cop of wanted.footCops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 12) {
          wanted.footCops.splice(wanted.footCops.indexOf(cop), 1);
          wanted.add(WANTED.killCop, 'cop');
          b.dead = true;
          break;
        }
      }
    } else {
      if (Math.hypot(player.x - b.x, player.y - b.y) < (player.inCar ? 16 : 12)) {
        hurtPlayer(8);
        b.dead = true;
      }
    }
  }
  for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].dead) bullets.splice(i, 1);

  // enemies (mission attackers)
  for (const e of enemies) {
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    e.angle = Math.atan2(player.y - e.y, player.x - e.x);
    if (d > 130) {
      const nx = e.x + Math.cos(e.angle) * 62 * dt;
      const ny = e.y + Math.sin(e.angle) * 62 * dt;
      const fixed = collideCircle(e.x, e.y, 9, nx - e.x, ny - e.y);
      e.x = fixed.x; e.y = fixed.y;
    }
    // unstick: if an attacker barely moved for over a second (pinned in a
    // building corner), hop it to a fresh spawn with a clear line of sight
    const moved = Math.hypot(e.x - (e.px ?? e.x), e.y - (e.py ?? e.y));
    if (moved < 4) e.stuckT = (e.stuckT || 0) + dt;
    else e.stuckT = 0;
    e.px = e.x; e.py = e.y;
    if (e.stuckT > 1.2) {
      const snap = pickAttackerSpawn();
      e.x = snap.x; e.y = snap.y;
      e.px = e.x; e.py = e.y;
      e.stuckT = 0;
    }
    e.shootCd -= dt;
    if (e.shootCd <= 0 && d < 420) {
      e.shootCd = 1.5 + Math.random() * 0.5;
      bullets.push(new Bullet(e.x, e.y, e.angle + (Math.random() - 0.5) * 0.14, false, 380));
      sfx.enemyShot();
    }
  }

  // wanted + police
  wanted.update(dt, player.x, player.y, player.inCar);
  const ram = wanted.ramDamage(player.x, player.y, player.inCar);
  if (ram > 0) {
    hurtPlayer(ram * dt * 4);
    if (player.inCar && player.car) player.car.health -= ram * dt * 6;
  }
  if (!player.inCar && wanted.checkArrest()) doBusted();

  // missions
  runner.update(dt);
  if (spawnAttackersPending) {
    spawnAttackersPending = false;
    const obj = runner.currentObjective();
    if (obj && obj.type === 'kill') spawnAttackers(obj.count);
  }
  const obj = runner.currentObjective();
  if (obj && runner.active) {
    const a = runner.active;
    if (obj.type === 'goto') {
      const d = Math.hypot(player.x - obj.x, player.y - obj.y);
      if (d < obj.r) runner.advance();
    } else if (obj.type === 'cooldown') {
      if (wanted.stars === 0) runner.advance();
    } else if (obj.type === 'grab') {
      const d = Math.hypot(player.x - obj.x, player.y - obj.y);
      if (!player.inCar && d < obj.r) {
        a.grabHold += dt;
        if (a.grabHold >= 3) {
          wanted.add(MISSIONS[3].heatOnGrab || 2, 'heist');
          runner.advance();
        }
      } else a.grabHold = 0;
    } else if (obj.type === 'kill' && a.attackers.length === 0 && !spawnAttackersPending) {
      // attackers all dead but objective not advanced (safety net)
      if (a.kills >= obj.count) runner.advance();
      else if (enemies.length === 0 && a.kills < obj.count) spawnAttackers(obj.count - a.kills);
    }
  }

  // camera
  cam.x += (player.x - cam.x) * Math.min(1, dt * 6);
  cam.y += (player.y - cam.y) * Math.min(1, dt * 6);
  cam.x = Math.max(vw / 2 - 80, Math.min(WORLD - vw / 2 + 80, cam.x));
  cam.y = Math.max(vh / 2 - 80, Math.min(WORLD - vh / 2 + 80, cam.y));

  // engine hum + police siren follow the action
  setEngine(player.inCar, Math.abs(player.speed || 0) / CAR.maxSpeed);
  setSiren(wanted.stars > 0);

  // autosave
  saveTimer += dt;
  if (saveTimer > 15) { saveTimer = 0; saveGame(); }
  endFrame();
}

function drawMarker(ctx, x, y, r, label) {
  // called inside the world-space translated context: draw at raw world coords
  if (x < cam.x - vw / 2 - 80 || x > cam.x + vw / 2 + 80 || y < cam.y - vh / 2 - 80 || y > cam.y + vh / 2 + 80) return;
  const pulse = 1 + Math.sin(time * 4) * 0.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = COLORS.neonYellow;
  ctx.shadowColor = COLORS.neonYellow;
  ctx.shadowBlur = 16;
  ctx.fillRect(-10 * pulse, -10 * pulse, 20 * pulse, 20 * pulse);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,211,25,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  if (label) {
    ctx.fillStyle = COLORS.neonYellow;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - r - 8);
    ctx.textAlign = 'left';
  }
}

function render() {
  ctx.clearRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(vw / 2 - cam.x, vh / 2 - cam.y);
  drawCity(ctx, cam, vw, vh);
  // mission marker (world space, drawn before translate reset — so draw in world coords here)
  const obj = runner.currentObjective();
  if (obj && (obj.type === 'goto' || obj.type === 'grab')) drawMarker(ctx, obj.x, obj.y, obj.r, obj.text);
  if (targetCar) drawMarker(ctx, targetCar.x, targetCar.y, 26, 'TARGET');
  // entities
  for (const p of peds) p.draw(ctx, cam);
  for (const c of traffic) c.draw(ctx, cam);
  wanted.draw(ctx, cam);
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = '#ff2e4a';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff2e4a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(e.angle) * 16, Math.sin(e.angle) * 16); ctx.stroke();
    ctx.restore();
  }
  // player car / player
  if (player.inCar && player.car) {
    const c = player.car;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = COLORS.playerCar;
    ctx.shadowColor = COLORS.playerCar;
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(-17, -10, 34, 20, 6); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(180,220,255,0.9)';
    ctx.fillRect(-4, -8, 11, 16);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(15, -8, 3, 5); ctx.fillRect(15, 3, 3, 5);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = COLORS.player;
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b0e1a';
    ctx.beginPath(); ctx.arc(6, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0b0e1a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, 0); ctx.stroke();
    ctx.restore();
  }
  for (const b of bullets) b.draw(ctx, cam);
  ctx.restore();

  // HUD + minimap (screen space)
  const marker = obj && (obj.type === 'goto' || obj.type === 'grab') ? { x: obj.x, y: obj.y } : (targetCar ? { x: targetCar.x, y: targetCar.y } : null);
  const objDist = obj && (obj.type === 'goto' || obj.type === 'grab')
    ? ` — ${Math.round(Math.hypot(player.x - obj.x, player.y - obj.y))}m` : '';
  drawHUD(ctx, vw, vh, {
    cash: player.cash,
    health: player.health,
    ammo: player.ammo,
    mag: player.mag,
    wanted: wanted.stars,
    inCar: player.inCar,
    missionTitle: runner.active ? `JOB ${runner.active.def.id}: ${runner.active.def.title}` : null,
    missionText: obj ? obj.text + objDist : (runner.storyDone ? 'Story complete — free roam' : 'Press Q for jobs'),
    missionTimer: runner.active ? runner.active.timer : 0,
    toast, toastT, toastColor,
    phoneOpen,
    missionList: runner.available().map((m) => ({ ...m, reward: MISSION_REWARDS[m.id - 1] })),
  });
  drawMinimap(ctx, vw, {
    px: player.x, py: player.y, angle: player.angle,
    marker, police: wanted.policeCars,
    camX: cam.x, camY: cam.y, vw, vh, time,
  });

  // overlays
  if (state === 'title') {
    ctx.fillStyle = 'rgba(4,6,14,0.88)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.neonPink;
    ctx.shadowColor = COLORS.neonPink;
    ctx.shadowBlur = 24;
    ctx.font = 'bold 64px monospace';
    ctx.fillText('NEON HARBOR', vw / 2, vh / 2 - 90);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.neonCyan;
    ctx.font = '20px monospace';
    ctx.fillText('Mara Voss — getaway driver · a top-down harbor heist', vw / 2, vh / 2 - 50);
    ctx.fillStyle = '#e8ecf8';
    ctx.font = '15px monospace';
    ctx.fillText('WASD move / drive · Mouse aim · Click / Space shoot · R reload', vw / 2, vh / 2 + 10);
    ctx.fillText('E steal / exit car · Q jobs (phone) · 5 jobs, then the story ends', vw / 2, vh / 2 + 36);
    const hasSave = !!loadSave();
    ctx.fillStyle = COLORS.neonYellow;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(hasSave ? 'ENTER — Start new game · C — Continue saved game' : 'ENTER — Start', vw / 2, vh / 2 + 90);
    ctx.textAlign = 'left';
  } else if (state === 'busted') {
    ctx.fillStyle = 'rgba(10,10,40,0.7)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2e7bff';
    ctx.font = 'bold 56px monospace';
    ctx.fillText('BUSTED', vw / 2, vh / 2);
    ctx.fillStyle = '#e8ecf8';
    ctx.font = '18px monospace';
    ctx.fillText('The Harbor PD took 20% of your cash', vw / 2, vh / 2 + 40);
    ctx.textAlign = 'left';
  } else if (state === 'wasted') {
    ctx.fillStyle = 'rgba(40,6,10,0.7)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2e4a';
    ctx.font = 'bold 56px monospace';
    ctx.fillText('WASTED', vw / 2, vh / 2);
    ctx.fillStyle = '#e8ecf8';
    ctx.font = '18px monospace';
    ctx.fillText('The clinic patched you up — minus 20% cash', vw / 2, vh / 2 + 40);
    ctx.textAlign = 'left';
  } else if (state === 'story') {
    ctx.fillStyle = 'rgba(4,6,14,0.9)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.neonGreen;
    ctx.font = 'bold 44px monospace';
    ctx.fillText('THE HARBOR IS YOURS', vw / 2, vh / 2 - 40);
    ctx.fillStyle = '#e8ecf8';
    ctx.font = '17px monospace';
    ctx.fillText('All five jobs done. Leo is safe, the crew that set you up is gone,', vw / 2, vh / 2 + 6);
    ctx.fillText('and Mara Voss owns the neon harbor. Free roam continues.', vw / 2, vh / 2 + 32);
    ctx.fillStyle = COLORS.neonYellow;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Press ENTER to keep driving', vw / 2, vh / 2 + 80);
    ctx.textAlign = 'left';
  }
}

let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (state === 'title') {
    if (consume('confirm')) startGame(false);
    else if (consume('continue') && loadSave()) startGame(true);
  }
  update(dt);
  render();
  endFrame();
  if (!window.__nhReady) window.__nhReady = true;
  requestAnimationFrame(loop);
}

// ---- photo mode + debug hooks (used by the in-session screenshot tool) ----
function applyPhotoMode() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  startGame(false);
  if (shot === 'chase') {
    player.inCar = true;
    player.car = { x: 1100, y: 1100, angle: 0, speed: 260, health: CAR.health };
    player.x = 1100; player.y = 1100;
    wanted.stars = 3;
    wanted.update(0.01, player.x, player.y, true);
    for (const c of wanted.policeCars) { c.x = player.x - 260 - Math.random() * 120; c.y = player.y + (Math.random() - 0.5) * 140; c.angle = 0; }
  } else if (shot === 'street') {
    player.inCar = true;
    player.car = { x: 1100, y: 900, angle: Math.PI / 2, speed: 120, health: CAR.health };
    player.x = 1100; player.y = 900;
  } else if (shot === 'drive') {
    player.inCar = true;
    player.car = { x: 600, y: 1100, angle: 0, speed: 380, health: CAR.health };
    player.x = 600; player.y = 1100;
  } else if (shot === 'mission') {
    runner.start(1);
    player.inCar = true;
    player.car = { x: 500, y: 2200, angle: Math.PI / 2, speed: 140, health: CAR.health };
    player.x = 500; player.y = 2200;
  }
  cam.x = player.x; cam.y = player.y;
}

window.__nh = {
  get state() { return state; },
  get player() { return player; },
  get cam() { return cam; },
  get wanted() { return wanted.stars; },
  get runner() { return runner; },
  get traffic() { return traffic; },
  get peds() { return peds; },
  get enemies() { return enemies; },
  start: (fromSave) => startGame(fromSave),
  mission: (n) => runner.start(n),
  tp: (x, y) => {
    player.x = x; player.y = y;
    if (player.inCar && player.car) { player.car.x = x; player.car.y = y; }
    cam.x = x; cam.y = y;
  },
  setWanted: (n) => { wanted.stars = n; wanted.idleMs = 0; },
  hurt: (n) => hurtPlayer(n),
  busted: () => doBusted(),
  wasted: () => doWasted(),
  respawn: () => respawn(),
};

applyPhotoMode();
requestAnimationFrame(loop);
