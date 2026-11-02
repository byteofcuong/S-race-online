import { Container, Graphics } from 'pixi.js';
import { TRACK_BOTTOM, TRACK_TOP, W } from '../layout.ts';

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

/** Hạt (lửa, khói, tia, confetti), mưa bão, rung màn hình – vẽ thuần Graphics, không filter. */
export class Effects {
  readonly view = new Container();
  private particles: Particle[] = [];
  private pool: Graphics[] = [];
  private rain = new Graphics();
  private dark = new Graphics();
  private rainUntil = 0;
  private shake = 0;
  private potholes: { g: Graphics; until: number }[] = [];

  constructor() {
    this.dark.rect(0, 0, W, 1920).fill({ color: 0x120020, alpha: 0.45 });
    this.dark.visible = false;
    this.rain.visible = false;
    this.view.addChild(this.dark, this.rain);
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

  /** lửa nitro phía sau xe */
  flame(x: number, y: number, angle: number, intensity = 1) {
    const back = angle + Math.PI;
    const n = Math.ceil(2 * intensity);
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 0.9;
      const sp = 120 + Math.random() * 140 * intensity;
      const colors = [0xfff3b0, 0xffb703, 0xfb5607, 0xff006e];
      this.spawn(
        x + (Math.random() - 0.5) * 8,
        y + (Math.random() - 0.5) * 8,
        colors[Math.floor(Math.random() * colors.length)],
        5 + Math.random() * 6 * intensity,
        Math.cos(back + spread) * sp,
        Math.sin(back + spread) * sp,
        0.3 + Math.random() * 0.3,
        -8,
        0,
        true,
      );
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

  hearts(x: number, y: number, color: number, count = 5) {
    for (let i = 0; i < count; i++) {
      this.spawn(x + (Math.random() - 0.5) * 30, y, color, 3 + Math.random() * 3, (Math.random() - 0.5) * 50, -80 - Math.random() * 80, 0.9 + Math.random() * 0.5, 0, -40, true);
    }
  }

  confetti(x: number, y: number) {
    const colors = [0xffd166, 0x06d6a0, 0x4cc9f0, 0xff4d6d, 0xffffff];
    for (let i = 0; i < 90; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 300 + Math.random() * 400;
      this.spawn(x, y, colors[i % colors.length], 4 + Math.random() * 4, Math.cos(a) * sp, Math.sin(a) * sp, 1.5 + Math.random(), 0, 500);
    }
  }

  pothole(x: number, y: number, sec: number, now: number) {
    const g = new Graphics();
    g.ellipse(0, 0, 26, 16).fill({ color: 0x000000, alpha: 0.7 });
    g.ellipse(0, 0, 26, 16).stroke({ width: 3, color: 0x7a4b1e, alpha: 0.9 });
    g.position.set(x, y);
    this.view.addChildAt(g, 2);
    this.potholes.push({ g, until: now + sec * 1000 });
  }

  storm(sec: number, now: number) {
    this.rainUntil = now + sec * 1000;
    this.dark.visible = true;
    this.rain.visible = true;
    this.shake = Math.max(this.shake, 18);
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
      for (let i = 0; i < 70; i++) {
        const x = ((i * 137 + t * 900) % (W + 100)) - 50;
        const y = TRACK_TOP + ((i * 311 + t * 1400) % (TRACK_BOTTOM - TRACK_TOP + 80)) - 40;
        this.rain.moveTo(x, y).lineTo(x - 10, y + 34);
      }
      this.rain.stroke({ width: 3, color: 0xbde0fe, alpha: 0.6 });
      this.dark.alpha = 0.6 + Math.sin(t * 20) * 0.1;
    } else if (this.rain.visible) {
      this.rain.visible = false;
      this.dark.visible = false;
    }
    if (this.shake > 0.3) {
      this.shake *= Math.pow(0.02, dt);
      return { dx: (Math.random() - 0.5) * this.shake, dy: (Math.random() - 0.5) * this.shake };
    }
    this.shake = 0;
    return { dx: 0, dy: 0 };
  }
}
