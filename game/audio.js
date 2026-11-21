// audio.js — every sound the vault makes, synthesised live with WebAudio.
// One clear job: sound. No samples, no files, no network — just oscillators
// and filtered noise, so the game stays a handful of static files.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastStepAt = 0;
    this.stepLeft = false;
  }

  // Browsers only let sound start after a gesture; call from the first
  // click or keypress and everything after it just works.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // A short tone that slides from one pitch to another.
  tone(freqFrom, freqTo, seconds, type = 'sine', volume = 0.2, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  // A burst of filtered noise — footsteps, pebble clinks, door slides.
  noise(seconds, filterFreq, volume = 0.15, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
  }

  // The thief's step: soft, alternating left/right, quieter when sneaking.
  // Throttled so it never fires faster than a real stride.
  footstep(sneaking) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    const gap = sneaking ? 420 : 300;
    if (now - this.lastStepAt < gap) return;
    this.lastStepAt = now;
    this.stepLeft = !this.stepLeft;
    this.noise(0.07, sneaking ? 500 : 900, sneaking ? 0.05 : 0.11);
    this.tone(this.stepLeft ? 95 : 85, 60, 0.06, 'sine', 0.05);
  }

  // A guard's boot on stone, heard through the dark. Louder the closer
  // the guard is, so footsteps tell you where a guard is.
  guardStep(distance) {
    if (!this.ctx || this.muted) return;
    if (distance > 320) return;
    const volume = 0.16 * (1 - distance / 320);
    this.noise(0.09, 700, volume);
  }

  // The moment a guard's suspicion fills: two rising notes, then a low
  // alarm hum that says "run or hide".
  spotted() {
    this.tone(320, 520, 0.16, 'square', 0.14);
    this.tone(520, 780, 0.22, 'square', 0.14, 0.14);
    this.tone(110, 110, 0.5, 'sawtooth', 0.07, 0.3);
  }

  // A single shard lifts off its plinth: a bright little chime.
  pickup() {
    this.tone(660, 660, 0.1, 'sine', 0.18);
    this.tone(880, 880, 0.12, 'sine', 0.18, 0.09);
    this.tone(1320, 1320, 0.2, 'sine', 0.14, 0.18);
  }

  // A pebble skitters across the floor and draws a guard's eyes.
  pebbleClink() {
    this.noise(0.05, 2400, 0.2);
    this.tone(1900, 1400, 0.08, 'triangle', 0.12, 0.04);
  }

  // The vault door swings open once the last shard is pocketed.
  doorOpens() {
    this.noise(0.7, 300, 0.16);
    this.tone(70, 140, 0.7, 'sine', 0.12);
  }

  // The escape: a short rising run, then a warm held chord.
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, 'triangle', 0.18, i * 0.11));
    this.tone(1047, 1047, 0.9, 'sine', 0.1, 0.5);
    this.tone(1319, 1319, 0.9, 'sine', 0.08, 0.5);
  }

  // Caught: a low falling drone.
  lose() {
    this.tone(220, 55, 0.9, 'sawtooth', 0.16);
    this.tone(165, 50, 0.9, 'triangle', 0.12, 0.1);
  }
}
