type Wave = OscillatorType;

const PROGRESSION = [
  [220, 261.63, 329.63, 392],
  [174.61, 220, 261.63, 329.63],
  [130.81, 196, 246.94, 329.63],
  [196, 246.94, 293.66, 369.99],
];
const FINALE_PROGRESSION = [
  [261.63, 329.63, 392, 493.88],
  [220, 277.18, 329.63, 440],
  [174.61, 220, 261.63, 349.23],
  [196, 246.94, 293.66, 392],
];

class Sound {
  ctx?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private sfx?: GainNode;
  private echo?: DelayNode;
  muted = false;
  private chordIdx = 0;
  private padTimer = 0;
  private arpTimer = 0;
  private finale = false;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.16;
    this.music.connect(this.master);

    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.27;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(wet).connect(this.master);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: Wave = 'sine', vol = 0.2, delay = 0, slideTo?: number, bus?: GainNode) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus ?? this.sfx);
    if (this.echo && !bus) g.connect(this.echo);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, from: number, to: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 1.2;
    const t = ctx.currentTime;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start();
  }

  click() { this.tone(820, 0.07, 'triangle', 0.1); }
  hover() { this.tone(1400, 0.03, 'sine', 0.025); }
  pop() { this.tone(420, 0.12, 'sine', 0.22, 0, 980); }
  boing() { this.tone(160, 0.35, 'sine', 0.25, 0, 520); this.tone(320, 0.2, 'triangle', 0.06, 0.05, 640); }
  squeak() { this.tone(1100, 0.1, 'sine', 0.14, 0, 1900); this.tone(1500, 0.12, 'sine', 0.1, 0.11, 2300); }
  error() { this.tone(180, 0.22, 'square', 0.06); this.tone(130, 0.3, 'square', 0.06, 0.13); }
  lock() { this.tone(240, 0.05, 'square', 0.08); this.tone(200, 0.06, 'square', 0.06, 0.07); }
  tick() { this.tone(2200, 0.03, 'square', 0.03); }
  whoosh() { this.noise(0.6, 0.25, 300, 3000); }
  rumble() { this.noise(1.6, 0.4, 900, 60, 'lowpass'); this.tone(55, 1.4, 'sawtooth', 0.05, 0, 40); }
  powerDown() { this.tone(520, 0.9, 'sawtooth', 0.05, 0, 40); this.noise(0.4, 0.1, 2000, 200); }
  powerUp() { this.tone(80, 0.8, 'sawtooth', 0.04, 0, 600); this.tone(600, 0.25, 'triangle', 0.08, 0.6, 1200); }
  steam() { this.noise(0.9, 0.12, 4000, 1500, 'highpass'); }

  chime() {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.1, i * 0.06));
  }
  letter() {
    [784, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.09, i * 0.05));
  }
  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.12, i * 0.09));
    this.tone(1046.5, 1.2, 'sine', 0.08, 0.36);
  }
  fanfare() {
    const n = [523.25, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
    const d = [0, 0.12, 0.24, 0.36, 0.6, 0.72, 0.9];
    n.forEach((f, i) => this.tone(f, i === n.length - 1 ? 1.4 : 0.22, 'square', 0.06, d[i]));
    n.forEach((f, i) => this.tone(f / 2, 0.3, 'triangle', 0.08, d[i]));
  }
  rollTick(i: number) { this.tone(600 + i * 40, 0.04, 'square', 0.03); }
  legendary() {
    [523.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.09, i * 0.08));
    this.noise(1.2, 0.08, 6000, 12000, 'highpass');
  }

  // ---------------------------------------------------------------- house
  coin() { this.tone(1320, 0.08, 'square', 0.05); this.tone(1760, 0.18, 'square', 0.05, 0.07); }
  levelUp() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.1, i * 0.07));
    this.tone(2093, 1.0, 'sine', 0.06, 0.4);
  }
  unlock() { this.tone(300, 0.06, 'square', 0.08); this.tone(900, 0.12, 'triangle', 0.12, 0.08); this.tone(1400, 0.3, 'sine', 0.08, 0.16); }
  creak() { this.tone(110, 1.1, 'sawtooth', 0.03, 0, 160); this.noise(1.0, 0.05, 600, 300); }
  splash() { this.noise(0.8, 0.22, 2500, 600); }
  sizzle() { this.noise(1.4, 0.12, 6000, 3000, 'highpass'); }
  ring() { for (let i = 0; i < 6; i++) this.tone(i % 2 ? 1760 : 1568, 0.07, 'square', 0.05, i * 0.08); }
  /** Four record-player notes (the melody puzzle). */
  note(i: number) { const f = [392, 493.88, 587.33, 739.99][i % 4]; this.tone(f, 0.45, 'triangle', 0.14); this.tone(f * 2, 0.3, 'sine', 0.04); }

  // ---------------------------------------------------------------- the Shadow
  footstep(vol = 0.3) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx) return;
    this.tone(70, 0.18, 'sine', vol * 0.9, 0, 40);
    this.noise(0.12, vol * 0.25, 400, 120, 'lowpass');
  }
  heartbeat(vol = 0.3) {
    this.tone(55, 0.14, 'sine', vol, 0, 40);
    this.tone(50, 0.16, 'sine', vol * 0.8, 0.2, 38);
  }
  whisper() { this.noise(1.6, 0.06, 3000, 1200); this.tone(180, 1.4, 'sawtooth', 0.012, 0, 120); }
  scream() {
    this.noise(1.1, 0.5, 4000, 300);
    this.tone(880, 0.9, 'sawtooth', 0.12, 0, 220);
    this.tone(1244, 0.8, 'square', 0.06, 0.02, 300);
    this.tone(60, 1.2, 'sawtooth', 0.12, 0, 30);
  }
  /** 0 = calm, 1 = the Shadow is right here. Darkens the music. */
  setDread(k: number) {
    if (!this.ctx || !this.music) return;
    this.music.gain.setTargetAtTime(0.16 * (1 - k * 0.8), this.ctx.currentTime, 0.4);
    if (k > 0.3 && !this.drone) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 46;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 180;
      g.gain.value = 0;
      o.connect(f).connect(g).connect(this.master!);
      o.start();
      this.drone = { o, g };
    }
    if (this.drone) this.drone.g.gain.setTargetAtTime(k * 0.07, this.ctx.currentTime, 0.5);
  }
  private drone?: { o: OscillatorNode; g: GainNode };

  startMusic() {
    if (!this.ctx || this.padTimer) return;
    const play = () => this.playChord();
    play();
    this.padTimer = window.setInterval(play, 7000);
  }

  setFinale(on: boolean) {
    this.finale = on;
    if (on && !this.arpTimer && this.ctx) {
      let i = 0;
      this.arpTimer = window.setInterval(() => {
        const chord = FINALE_PROGRESSION[this.chordIdx % FINALE_PROGRESSION.length];
        const f = chord[[0, 1, 2, 3, 2, 1][i % 6]] * 2;
        this.tone(f, 0.35, 'triangle', 0.05, 0, undefined, this.music);
        i++;
      }, 220);
    }
  }

  private playChord() {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    const prog = this.finale ? FINALE_PROGRESSION : PROGRESSION;
    const chord = prog[this.chordIdx++ % prog.length];
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.finale ? 1800 : 900;
    filter.connect(this.music);
    for (const f of chord) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 2.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 8.5);
        o.connect(g).connect(filter);
        o.start(t);
        o.stop(t + 8.6);
      }
    }
  }
}

export const sound = new Sound();
