/**
 * Âm thanh tổng hợp bằng WebAudio – không cần file, không vướng bản quyền.
 * Trong OBS / LIVE Studio âm thanh tự phát; trình duyệt thường cần một cú click để mở.
 */
export class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  muted = false;
  volume = 0.8;
  private lastJoin = 0;

  private ensure(): AudioContext | undefined {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
      } catch {
        return undefined;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.master!.gain.value = this.muted ? 0 : this.volume;
    return this.ctx;
  }

  /** gọi khi có tương tác người dùng để mở AudioContext */
  unlock() {
    this.ensure();
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.25, sweepTo?: number, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, gain = 0.3, cutoffFrom = 4000, cutoffTo = 200, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoffFrom, t0);
    f.frequency.exponentialRampToValueAtTime(cutoffTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0);
  }

  nitro(big = false) {
    this.tone(180, big ? 0.9 : 0.45, 'sawtooth', 0.18, big ? 1400 : 900);
    this.noise(big ? 0.9 : 0.4, 0.12, 6000, 800);
  }
  crash() {
    this.noise(0.45, 0.4, 3000, 120);
    this.tone(120, 0.35, 'square', 0.15, 50);
  }
  shieldGain() {
    this.tone(660, 0.18, 'sine', 0.2, 1320);
    this.tone(990, 0.25, 'sine', 0.18, 1980, 0.12);
  }
  shieldBreak() {
    this.tone(1400, 0.25, 'triangle', 0.22, 300);
    this.noise(0.3, 0.2, 5000, 500);
  }
  storm() {
    this.noise(1.6, 0.45, 600, 80);
    this.tone(55, 1.4, 'sawtooth', 0.2, 35);
  }
  golden() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.2, undefined, i * 0.11));
  }
  countdown(last = false) {
    this.tone(last ? 1320 : 880, last ? 0.5 : 0.12, 'square', 0.12);
  }
  finish() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.22, undefined, i * 0.13));
    this.noise(1.2, 0.15, 8000, 1000, 0.5);
  }
  combo() {
    [880, 1100, 1320].forEach((f, i) => this.tone(f, 0.1, 'square', 0.12, undefined, i * 0.08));
  }
  overtake() {
    this.tone(440, 0.15, 'triangle', 0.16, 880);
  }
  join() {
    const n = performance.now();
    if (n - this.lastJoin < 400) return;
    this.lastJoin = n;
    this.tone(700, 0.08, 'sine', 0.08, 1000);
  }
  start() {
    this.tone(440, 0.15, 'square', 0.15);
    this.tone(440, 0.15, 'square', 0.15, undefined, 0.3);
    this.tone(880, 0.5, 'square', 0.18, undefined, 0.6);
  }
}
