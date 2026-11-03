// Chiptune sound effects and a looping tarantella, synthesized with WebAudio.

const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// 8 bars of 6/8 in A minor, one entry per eighth note (-1 = rest).
const MELODY = [
  69, 72, 76, 72, 76, 81,
  76, 74, 72, 71, 72, 69,
  68, 71, 74, 71, 74, 76,
  77, 76, 74, 72, 71, 68,
  69, 72, 76, 72, 76, 81,
  77, 76, 74, 74, 77, 81,
  80, 81, 80, 76, 74, 71,
  69, -1, 64, 69, -1, -1,
];
// Two bass notes per bar, on the dotted-quarter beats.
const BASS = [45, 52, 45, 52, 40, 47, 40, 47, 45, 52, 38, 45, 40, 47, 45, 40];
// Chord tones per bar for the arpeggio layer: Am Am E E Am Dm E Am.
const CHORDS = [[69, 72, 76], [69, 72, 76], [68, 71, 76], [68, 71, 76], [69, 72, 76], [69, 74, 77], [68, 71, 76], [69, 72, 76]];

const MASTER_VOLUME = 0.7;

export class Sound {
  constructor(muted = false) {
    this.muted = muted;
    this.ctx = null;
    this.timer = 0;
    this.wantMusic = false;
    this.eighth = 0.165;
    this.level = 0;
  }

  // Browsers only allow audio after a user gesture, so this runs on the first tap/key.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(ctx.destination);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.6;
      this.sfx.connect(this.master);
      // Music runs through a low-pass so menus can muffle it.
      this.musFilter = ctx.createBiquadFilter();
      this.musFilter.type = 'lowpass';
      this.musFilter.frequency.value = 18000;
      this.musFilter.connect(this.master);
      this.mus = ctx.createGain();
      this.mus.gain.value = 0.32;
      this.mus.connect(this.musFilter);

      // 25% pulse wave, the classic NES lead.
      const n = 32;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
      this.pulse = ctx.createPeriodicWave(real, imag);

      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      // A looping band of noise whose volume follows the wind.
      const wind = ctx.createBufferSource();
      wind.buffer = this.noiseBuf;
      wind.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 500;
      this.windFilter.Q.value = 0.8;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      wind.connect(this.windFilter).connect(this.windGain).connect(this.sfx);
      wind.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.wantMusic) this.music(true);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
  }

  pause(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend();
    else this.ctx.resume();
  }

  // Muffles the music while a menu (blessing pick, pause) is open.
  setMuffled(on) {
    if (this.musFilter) this.musFilter.frequency.setTargetAtTime(on ? 650 : 18000, this.ctx.currentTime, 0.08);
  }

  // amount 0..1
  setWind(amount) {
    if (!this.windGain) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(amount * 0.35, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(350 + amount * 900, t, 0.15);
  }

  tone(freq, dur, { wave = 'square', vol = 0.2, to = 0, delay = 0, when, bus = this.sfx } = {}) {
    if (!this.ctx) return;
    const t = when ?? this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    if (wave === 'pulse') o.setPeriodicWave(this.pulse);
    else o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, type = 'lowpass', freq = 1000, delay = 0, when, bus = this.sfx } = {}) {
    if (!this.ctx) return;
    const t = when ?? this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  arpeggio(notes, step, opts) {
    notes.forEach((m, i) => this.tone(midi(m), step * 1.6, { wave: 'pulse', vol: 0.2, ...opts, delay: i * step }));
  }

  // --- effects -------------------------------------------------------------

  start() {
    this.arpeggio([60, 64, 67, 72], 0.06);
  }

  click() {
    this.tone(660, 0.05, { wave: 'pulse', vol: 0.12 });
  }

  drop() {
    this.tone(520, 0.12, { to: 240, vol: 0.12 });
  }

  land(kind) {
    this.noise(0.14, { freq: 500, vol: 0.5 });
    this.tone(120, 0.12, { wave: 'triangle', to: 50, vol: 0.5 });
    if (kind === 'good') this.tone(midi(79), 0.08, { wave: 'pulse', vol: 0.12, delay: 0.03 });
  }

  perfect(combo) {
    this.land('perfect');
    const root = 72 + Math.min(combo - 1, 12);
    this.arpeggio([root, root + 4, root + 7, root + 12], 0.05);
    this.noise(0.25, { type: 'highpass', freq: 6000, vol: 0.12, delay: 0.1 });
  }

  coin() {
    this.arpeggio([84, 88, 91, 96, 100], 0.045, { vol: 0.14 });
    this.noise(0.3, { type: 'highpass', freq: 8000, vol: 0.1, delay: 0.05 });
  }

  miss() {
    this.tone(320, 0.5, { wave: 'sawtooth', to: 60, vol: 0.18 });
    this.noise(0.3, { freq: 300, vol: 0.4, delay: 0.25 });
  }

  warn() {
    this.tone(220, 0.08, { vol: 0.15 });
    this.tone(196, 0.1, { vol: 0.15, delay: 0.12 });
  }

  gust() {
    this.noise(0.9, { type: 'bandpass', freq: 900, vol: 0.25 });
  }

  milestone() {
    this.arpeggio([72, 76, 79, 84, 79, 84], 0.07, { vol: 0.16 });
  }

  record() {
    this.arpeggio([67, 72, 76, 79, 84, 88, 91], 0.06, { vol: 0.18 });
    this.noise(0.5, { type: 'highpass', freq: 7000, vol: 0.12, delay: 0.3 });
  }

  cardsIn() {
    this.noise(0.35, { type: 'highpass', freq: 2500, vol: 0.15 });
    this.arpeggio([64, 67, 71], 0.08, { vol: 0.1, wave: 'triangle' });
  }

  cardFocus() {
    this.tone(midi(84), 0.05, { wave: 'pulse', vol: 0.1 });
  }

  cardTake() {
    this.arpeggio([72, 79, 84, 88], 0.06, { vol: 0.18 });
    this.noise(0.3, { type: 'highpass', freq: 6000, vol: 0.12, delay: 0.15 });
  }

  flap() {
    for (let i = 0; i < 4; i++) this.noise(0.04, { type: 'bandpass', freq: 1400, vol: 0.18, delay: i * 0.07 });
  }

  // Nonna "talking": a few quick blips, one per couple of letters.
  babble(letters) {
    const n = Math.min(7, Math.max(2, Math.ceil(letters / 2)));
    for (let i = 0; i < n; i++) {
      const f = 520 + Math.random() * 420;
      this.tone(f, 0.05, { wave: 'pulse', vol: 0.07, to: f * 0.9, delay: i * 0.06 });
    }
  }

  topple() {
    this.noise(1.4, { freq: 380, vol: 0.8 });
    this.tone(90, 1.2, { wave: 'sawtooth', to: 30, vol: 0.25 });
    for (let i = 0; i < 5; i++) this.noise(0.15, { freq: 900, vol: 0.4, delay: 0.25 + i * 0.17 });
  }

  gameOver() {
    [67, 63, 60, 55].forEach((m, i) => this.tone(midi(m), 0.3, { wave: 'pulse', vol: 0.18, delay: 0.2 + i * 0.2 }));
  }

  // --- music ---------------------------------------------------------------

  music(on) {
    this.wantMusic = on;
    if (!this.ctx) return;
    if (on && !this.timer) {
      this.step = 0;
      this.next = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.pump(), 25);
    } else if (!on && this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  // The tune speeds up a little and gains layers as the tower climbs.
  setLevel(level) {
    this.level = level;
    this.eighth = 0.165 / (1 + Math.min(level, 12) * 0.025);
  }

  pump() {
    const now = this.ctx.currentTime;
    if (this.next < now - 0.1) this.next = now + 0.05; // resumed after a suspend
    while (this.next < now + 0.15) {
      this.playStep(this.step, this.next);
      this.next += this.eighth;
      this.step = (this.step + 1) % MELODY.length;
    }
  }

  playStep(s, when) {
    const bus = this.mus;
    const beat = s % 3 === 0;
    const m = MELODY[s];
    if (m >= 0) this.tone(midi(m), this.eighth * 0.85, { wave: 'pulse', vol: 0.2, when, bus });
    if (beat) this.tone(midi(BASS[s / 3]), this.eighth * 2.6, { wave: 'triangle', vol: 0.45, when, bus });
    if (s % 6 === 0 || (this.level >= 3 && beat)) this.tone(150, 0.09, { wave: 'sine', to: 45, vol: 0.5, when, bus });
    if (this.level >= 1) this.noise(0.03, { type: 'highpass', freq: 7000, vol: beat ? 0.1 : 0.05, when, bus });
    if (this.level >= 2 && !beat) {
      const chord = CHORDS[Math.floor(s / 6)];
      this.tone(midi(chord[s % 3] + 12), this.eighth * 0.7, { wave: 'triangle', vol: 0.12, when, bus });
    }
    if (this.level >= 4 && s % 6 === 3) this.noise(0.08, { type: 'bandpass', freq: 1800, vol: 0.18, when, bus });
  }
}
