// All sound is synthesized with WebAudio: no audio files, no network. Engine hum,
// two-tone sirens, gunshots, pickups and a small bass-driven music loop.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngine();
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // --- engine ---------------------------------------------------------------
  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.now();
    const target = on ? 0.05 + speed01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, t, 0.1);
  }

  // --- one-shots ------------------------------------------------------------
  blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.now() + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  gunshot() {
    this.noiseBurst(0.12, 0.5, 1800);
    this.blip(140, 0.08, 'square', 0.25);
  }

  sirenBurst() {
    // Two-tone whoop, used when a chase starts.
    this.blip(660, 0.28, 'sine', 0.16);
    this.blip(880, 0.28, 'sine', 0.16, 0.3);
    this.blip(660, 0.28, 'sine', 0.16, 0.6);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.22);
    this.blip(880, 0.09, 'sine', 0.22, 0.09);
    this.blip(1320, 0.16, 'sine', 0.22, 0.18);
  }

  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.25, i * 0.11));
  }

  busted() {
    [392, 330, 262, 196].forEach((f, i) => this.blip(f, 0.3, 'triangle', 0.22, i * 0.16));
  }

  click() {
    this.blip(1200, 0.04, 'square', 0.12);
  }

  horn() {
    this.blip(370, 0.18, 'square', 0.12);
    this.blip(466, 0.18, 'square', 0.1);
  }

  // --- music: a slow synthwave bassline + hat, scheduled in 8th notes ---------
  startMusic() {
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 65.4, 58.3, 55];
    const stepDur = 0.24;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep % 16;
      const note = bass[step];
      if (note > 0) {
        const t = this.now();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + stepDur);
      }
      if (step % 2 === 0) this.noiseBurst(0.03, 0.03, 6000);
      this.musicStep += 1;
    }, stepDur * 1000);
  }
}
