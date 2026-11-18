// Neon Harbor — WebAudio synth SFX (fresh code for round 3).
// Everything is synthesized; no audio files. Safe to call before init.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let sirenTimer = null;
let sirenOn = false;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_e) { ctx = null; }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (_e) { /* audio is best-effort */ }
}

function noiseBurst(dur, vol, lowpass) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  } catch (_e) { /* best-effort */ }
}

export const sfx = {
  shot() { noiseBurst(0.09, 0.25, 2400); tone(180, 0.08, 'sawtooth', 0.06, 60); },
  enemyShot() { noiseBurst(0.07, 0.12, 1600); },
  reload() { tone(520, 0.07, 'square', 0.05); setTimeout(() => tone(760, 0.07, 'square', 0.05), 90); },
  blip() { tone(880, 0.09, 'sine', 0.07, 1320); },
  pickup() { tone(660, 0.08, 'sine', 0.08); setTimeout(() => tone(990, 0.12, 'sine', 0.08), 80); },
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.09), i * 110)); },
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.07), i * 160)); },
  wasted() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.07), i * 170)); },
  carSteal() { tone(300, 0.12, 'square', 0.06, 520); },
  crash() { noiseBurst(0.16, 0.18, 900); },
};

export function setEngine(on, speedRatio) {
  if (!ctx) return;
  try {
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain.gain.value = 0.015;
      engineOsc.connect(engineGain).connect(ctx.destination);
      engineOsc.start();
    } else if (!on && engineOsc) {
      engineOsc.stop();
      engineOsc = null;
      engineGain = null;
    }
    if (engineOsc) {
      engineOsc.frequency.value = 55 + 90 * (speedRatio || 0);
      engineGain.gain.value = 0.012 + 0.02 * (speedRatio || 0);
    }
  } catch (_e) { /* best-effort */ }
}

export function setSiren(on) {
  if (!ctx || on === sirenOn) return;
  sirenOn = on;
  if (on) {
    let hi = true;
    sirenTimer = setInterval(() => { tone(hi ? 960 : 720, 0.32, 'sine', 0.035); hi = !hi; }, 320);
  } else if (sirenTimer) {
    clearInterval(sirenTimer);
    sirenTimer = null;
  }
}
