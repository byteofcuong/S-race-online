import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { H, TRACK_BOTTOM, TRACK_TOP, W } from '../layout.ts';
import { assets } from '../assets.ts';

interface Particle {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  gravity: number;
}

interface FxSprite {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  from: number;
  to: number;
  spin: number;
  fadeIn: boolean;
}

/** Hạt (lửa, khói, confetti), sprite hiệu ứng (va chạm, lốc, tim), mưa bão, chớp, rung màn hình. */
export class Effects {
  readonly view = new Container();
  private particles: Particle[] = [];
  private pool: Graphics[] = [];
  private sprites: FxSprite[] = [];
  private rain = new Graphics();
  private dark = new Graphics();
  private flash = new Graphics();
  private rainUntil = 0;
  private flashAlpha = 0;
  private shake = 0;
  private potholes: { g: Graphics; until: number }[] = [];
  private tex = new Map<string, Texture>();

  constructor() {
    this.dark.rect(0, 0, W, H).fill({ color: 0x120020, alpha: 0.45 });
    this.dark.visible = false;
    this.rain.visible = false;
    this.flash.rect(0, 0, W, H).fill({ color: 0xffffff, alpha: 1 });
    this.flash.alpha = 0;
    this.view.addChild(this.dark, this.rain, this.flash);
    for (const n of ['collision', 'tornado', 'cloud-with-lightning-and-rain', 'red-heart', 'party-popper', 'sparkles', 'shield', 'high-voltage']) {
      void assets.icon(n).then((t) => t && this.tex.set(n, t));
    }
  }

  private spawn(x: number, y: number, color: number, size: number, vx: number, vy: number, life: number, grow = 0, gravity = 0, add = false) {
    const g = this.pool.pop() ?? new Graphics();
    g.clear();
    g.circle(0, 0, 1).fill(color);
    g.blendMode = add ? 'add' : 'normal';
    g.position.set(x, y);
    g.scale.set(size);
    g.alpha = 1;
    this.view.addChild(g);
    this.particles.push({ g, x, y, vx, vy, life: 0, max: life, size, grow, gravity });
  }

  /** sprite icon bay/nở ra rồi mờ dần */
  sprite(name: string, x: number, y: number, opts: Partial<{ size: number; to: number; life: number; vx: number; vy: number; spin: number; fadeIn: boolean }> = {}) {
    const t = this.tex.get(name);
    if (!t) return;
    const s = new Sprite(t);
    s.anchor.set(0.5);
    const size = opts.size ?? 60;
    s.height = size;
    s.scale.x = s.scale.y;
    s.position.set(x, y);
    this.view.addChild(s);
    const base = s.scale.y;
    this.sprites.push({ s, vx: opts.vx ?? 0, vy: opts.vy ?? 0, life: 0, max: opts.life ?? 0.8, from: base * 0.4, to: base * (opts.to ?? 1.3), spin: opts.spin ?? 0, fadeIn: opts.fadeIn ?? false });
  }

  /** lửa nitro (hạt) phía sau xe */
  flame(x: number, y: number, dir: number, intensity = 1) {
    const n = Math.ceil(2 * intensity);
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 0.8;
      const sp = 120 + Math.random() * 140 * intensity;
      const colors = [0xfff3b0, 0xffb703, 0xfb5607, 0xff006e];
      this.spawn(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, colors[Math.floor(Math.random() * colors.length)], 4 + Math.random() * 5 * intensity, -dir * Math.cos(spread) * sp, Math.sin(spread) * sp * 0.5, 0.3 + Math.random() * 0.3, -8, 0, true);
    }
  }

  smoke(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      this.spawn(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 0x777777, 6 + Math.random() * 8, (Math.random() - 0.5) * 40, -30 - Math.random() * 40, 0.8 + Math.random() * 0.6, 10, 0);
    }
  }

  burst(x: number, y: number, color: number, count = 24, speed = 260) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, color, 3 + Math.random() * 4, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.5, -3, 300, true);
    }
  }

  hearts(x: number, y: number, count = 1, white = false) {
    for (let i = 0; i < count; i++) {
      this.sprite('red-heart', x + (Math.random() - 0.5) * 36, y, { size: 14 + Math.random() * 8, to: 1.1, life: 0.9 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 40, vy: -70 - Math.random() * 60 });
      if (white) this.spawn(x, y, 0xffffff, 3, (Math.random() - 0.5) * 50, -80, 0.8, 0, 0, true);
    }
  }

  confetti(x: number, y: number) {
    const colors = [0xffd166, 0x06d6a0, 0x4cc9f0, 0xff4d6d, 0xffffff];
    for (let i = 0; i < 90; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 300 + Math.random() * 400;
      this.spawn(x, y, colors[i % colors.length], 4 + Math.random() * 4, Math.cos(a) * sp, Math.sin(a) * sp, 1.5 + Math.random(), 0, 500);
    }
    this.sprite('party-popper', x - 70, y - 30, { size: 90, to: 1.4, life: 1.6, spin: -0.3 });
    this.sprite('party-popper', x + 70, y - 30, { size: 90, to: 1.4, life: 1.6, spin: 0.3 });
  }

  collision(x: number, y: number) {
    this.sprite('collision', x, y - 30, { size: 110, to: 1.5, life: 0.9 });
    for (let i = 0; i < 6; i++) this.smoke(x, y);
    this.burst(x, y, 0xff4d6d, 16, 240);
    this.kick(10);
  }

  shieldBreak(x: number, y: number) {
    this.sprite('shield', x, y - 30, { size: 80, to: 2, life: 0.7 });
    this.burst(x, y - 20, 0x9ae8ff, 40, 330);
    this.kick(5);
  }

  shieldGain(x: number, y: number) {
    this.sprite('sparkles', x, y - 40, { size: 70, to: 1.6, life: 0.9, spin: 0.5 });
    this.burst(x, y - 20, 0x4cc9f0, 18, 200);
  }

  pothole(x: number, y: number, sec: number, now: number) {
    const g = new Graphics();
    g.ellipse(0, 0, 24, 14).fill({ color: 0x2b1d14, alpha: 0.85 });
    g.ellipse(-4, -3, 12, 6).fill({ color: 0x000000, alpha: 0.5 });
    g.ellipse(0, 0, 24, 14).stroke({ width: 3, color: 0x8a5a2b, alpha: 0.9 });
    g.position.set(x, y);
    this.view.addChildAt(g, 3);
    this.potholes.push({ g, until: now + sec * 1000 });
  }

  storm(sec: number, now: number) {
    this.rainUntil = now + sec * 1000;
    this.dark.visible = true;
    this.rain.visible = true;
    this.flashAlpha = 0.9;
    this.shake = Math.max(this.shake, 18);
    const y = TRACK_TOP + (TRACK_BOTTOM - TRACK_TOP) * 0.45;
    this.sprite('tornado', -80, y, { size: 200, to: 1, life: sec, vx: (W + 200) / sec, spin: 0, fadeIn: true });
    this.sprite('cloud-with-lightning-and-rain', 220, TRACK_TOP + 40, { size: 120, to: 1.1, life: sec, vx: 40, fadeIn: true });
    this.sprite('cloud-with-lightning-and-rain', 800, TRACK_TOP + 90, { size: 140, to: 1.1, life: sec, vx: -30, fadeIn: true });
    this.sprite('high-voltage', W / 2, TRACK_TOP + 120, { size: 160, to: 1.6, life: 0.6 });
  }

  kick(amount = 8) {
    this.shake = Math.max(this.shake, amount);
  }

  /** trả về độ lệch rung để áp lên container thế giới */
  update(dt: number, now: number): { dx: number; dy: number } {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.view.removeChild(p.g);
        this.pool.push(p.g);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size = Math.max(0.5, p.size + p.grow * dt);
      const k = p.life / p.max;
      p.g.position.set(p.x, p.y);
      p.g.scale.set(p.size);
      p.g.alpha = 1 - k * k;
    }
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const f = this.sprites[i];
      f.life += dt;
      const k = f.life / f.max;
      if (k >= 1) {
        f.s.destroy();
        this.sprites.splice(i, 1);
        continue;
      }
      f.s.x += f.vx * dt;
      f.s.y += f.vy * dt;
      f.s.rotation += f.spin * dt;
      const e = 1 - Math.pow(1 - Math.min(1, k * 2), 3);
      const sc = f.from + (f.to - f.from) * e;
      f.s.scale.set(sc);
      f.s.alpha = f.fadeIn ? Math.min(1, k * 4) * (k > 0.8 ? (1 - k) / 0.2 : 1) : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    }
    for (let i = this.potholes.length - 1; i >= 0; i--) {
      const h = this.potholes[i];
      if (now > h.until) {
        h.g.destroy();
        this.potholes.splice(i, 1);
      } else h.g.alpha = Math.min(1, (h.until - now) / 600);
    }
    if (this.rainUntil > now) {
      this.rain.clear();
      const t = now / 1000;
      for (let i = 0; i < 80; i++) {
        const x = ((i * 137 + t * 900) % (W + 100)) - 50;
        const y = TRACK_TOP - 60 + ((i * 311 + t * 1400) % (TRACK_BOTTOM - TRACK_TOP + 120));
        this.rain.moveTo(x, y).lineTo(x - 10, y + 34);
      }
      this.rain.stroke({ width: 3, color: 0xbde0fe, alpha: 0.65 });
      this.dark.alpha = 0.6 + Math.sin(t * 20) * 0.1;
      if (Math.random() < dt * 1.2) this.flashAlpha = 0.6;
    } else if (this.rain.visible) {
      this.rain.visible = false;
      this.dark.visible = false;
    }
    if (this.flashAlpha > 0.01) {
      this.flashAlpha *= Math.pow(0.001, dt);
      this.flash.alpha = this.flashAlpha;
    } else this.flash.alpha = 0;
    if (this.shake > 0.3) {
      this.shake *= Math.pow(0.02, dt);
      return { dx: (Math.random() - 0.5) * this.shake, dy: (Math.random() - 0.5) * this.shake };
    }
    this.shake = 0;
    return { dx: 0, dy: 0 };
  }
}
