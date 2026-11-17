// Solara Bay — synthesized sound effects. No audio files: every sound is
// built from oscillators and filtered noise at run time.

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let engineFilter = null;
let sirenTimer = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol || 0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseHit(dur, vol, filterFreq) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.05);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq || 1800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol || 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export function playGunshot() {
  noiseHit(0.16, 0.55, 3200);
  blip(160, 0.1, 'square', 0.18, 55);
}

export function playPickup() {
  blip(660, 0.09, 'sine', 0.25);
  setTimeout(() => blip(990, 0.14, 'sine', 0.25), 90);
}

export function playMissionDone() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.28), i * 110));
}

export function playHonk() {
  blip(370, 0.28, 'sawtooth', 0.16, 340);
  blip(466, 0.28, 'sawtooth', 0.12, 430);
}

export function playBusted() {
  [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.2), i * 160));
}

export function playClick() {
  blip(880, 0.05, 'square', 0.12);
}

export function startEngine() {
  if (!ctx || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0.0;
  engineOsc.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
}

export function setEngine(running, speedNorm) {
  if (!engineOsc || !engineGain) return;
  const t = ctx.currentTime;
  engineGain.gain.setTargetAtTime(running ? 0.05 + speedNorm * 0.07 : 0.0, t, 0.1);
  engineOsc.frequency.setTargetAtTime(55 + speedNorm * 95, t, 0.1);
}

export function stopEngine() {
  if (!engineOsc) return;
  try { engineOsc.stop(); } catch { /* already stopped */ }
  engineOsc = null;
  engineGain = null;
  engineFilter = null;
}

export function startSiren() {
  if (!ctx || sirenTimer) return;
  let high = true;
  sirenTimer = setInterval(() => {
    if (!ctx) return;
    blip(high ? 720 : 540, 0.32, 'sine', 0.07);
    high = !high;
  }, 340);
}

export function stopSiren() {
  if (sirenTimer) {
    clearInterval(sirenTimer);
    sirenTimer = null;
  }
}
