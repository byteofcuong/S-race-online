import { Container, Graphics, Text } from 'pixi.js';
import type { Province } from '@srace/engine';

const FONT = 'Be Vietnam Pro, sans-serif';

/** Xe của một tỉnh: thân xe xoay theo đường, nhãn mã tỉnh luôn thẳng. */
export class Car {
  readonly view = new Container();
  readonly body = new Container();
  private badge = new Container();
  private shield = new Graphics();
  private crown = new Text({ text: '👑', style: { fontSize: 22 } });
  private combo = new Text({ text: 'COMBO', style: { fontFamily: FONT, fontSize: 14, fontWeight: '900', fill: 0xffd166 } });
  private float?: { t: Text; life: number; max: number };
  display = 0; // progress đang hiện
  target = 0;
  speed = 0;
  nitroUntil = 0;
  slowUntil = 0;
  comboUntil = 0;
  shields = 0;
  winStreak = 0;
  rank = 0;
  lane: number;
  wobble = 0;
  appear = 0;
  private pulse = Math.random() * 6;

  constructor(
    readonly province: Province,
    laneIndex: number,
  ) {
    const lanes = [0, -22, 22, -44, 44, -66, 66, -11, 11];
    this.lane = lanes[laneIndex % lanes.length];
    this.drawBody(province.color);
    this.drawBadge(province);
    this.shield.visible = false;
    this.crown.anchor.set(0.5, 1);
    this.crown.position.set(26, -36);
    this.crown.visible = false;
    this.combo.anchor.set(0.5, 1);
    this.combo.position.set(0, -58);
    this.combo.visible = false;
    this.view.addChild(this.shield, this.body, this.badge, this.crown, this.combo);
  }

  private drawBody(color: string) {
    const g = new Graphics();
    // bóng
    g.roundRect(-28, -14, 56, 30, 9).fill({ color: 0x000000, alpha: 0.35 });
    // bánh xe
    for (const [x, y] of [[-17, -17], [13, -17], [-17, 11], [13, 11]]) g.roundRect(x, y, 10, 6, 2).fill(0x111111);
    // thân
    g.roundRect(-26, -13, 52, 26, 8).fill(color);
    g.roundRect(-26, -13, 52, 26, 8).stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
    // mui + kính
    g.roundRect(-10, -9, 24, 18, 5).fill({ color: 0xffffff, alpha: 0.28 });
    g.roundRect(6, -8, 7, 16, 2).fill({ color: 0x0b1026, alpha: 0.75 });
    g.roundRect(-10, -8, 5, 16, 2).fill({ color: 0x0b1026, alpha: 0.55 });
    // đèn pha
    g.circle(25, -8, 3).fill(0xfff4c2);
    g.circle(25, 8, 3).fill(0xfff4c2);
    this.body.addChild(g);
  }

  private drawBadge(p: Province) {
    const txt = new Text({ text: p.code, style: { fontFamily: FONT, fontSize: 18, fontWeight: '900', fill: 0xffffff } });
    txt.anchor.set(0.5);
    const w = Math.max(44, txt.width + 18);
    const bg = new Graphics().roundRect(-w / 2, -14, w, 28, 8).fill({ color: p.color, alpha: 0.95 });
    bg.roundRect(-w / 2, -14, w, 28, 8).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    this.badge.addChild(bg, txt);
    this.badge.position.set(0, -36);
  }

  showFloat(text: string, color = 0xffffff) {
    this.float?.t.destroy();
    const t = new Text({
      text,
      style: { fontFamily: FONT, fontSize: 24, fontWeight: '900', fill: color, dropShadow: { alpha: 0.7, blur: 4, distance: 2 } },
    });
    t.anchor.set(0.5, 1);
    t.position.set(0, -62);
    this.view.addChild(t);
    this.float = { t, life: 0, max: 3.2 };
  }

  /** Cập nhật hình ảnh mỗi khung hình. */
  update(dt: number, now: number) {
    this.pulse += dt * 4;
    const slowed = this.slowUntil > now;
    const nitro = this.nitroUntil > now;
    this.shield.visible = this.shields > 0;
    if (this.shield.visible) {
      this.shield.clear();
      const r = 42 + Math.sin(this.pulse) * 3;
      this.shield.circle(0, 0, r).fill({ color: 0x4cc9f0, alpha: 0.14 });
      this.shield.circle(0, 0, r).stroke({ width: 3, color: 0x9ae8ff, alpha: 0.85 });
    }
    this.crown.visible = this.winStreak > 0;
    this.combo.visible = this.comboUntil > now;
    if (this.combo.visible) this.combo.scale.set(1 + Math.sin(this.pulse * 2) * 0.12);
    if (slowed) {
      this.wobble = Math.sin(this.pulse * 5) * 0.18;
      this.body.alpha = 0.75;
    } else {
      this.wobble *= 0.8;
      this.body.alpha = 1;
    }
    this.body.scale.set(nitro ? 1.12 : 1);
    const base = 0.9;
    if (this.appear > 0) {
      this.appear = Math.max(0, this.appear - dt);
      this.view.scale.set(base + this.appear * 1.2);
      this.view.alpha = 1 - this.appear;
    } else {
      this.view.scale.set(base);
      this.view.alpha = 1;
    }
    if (this.float) {
      this.float.life += dt;
      const k = this.float.life / this.float.max;
      this.float.t.position.y = -62 - k * 40;
      this.float.t.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      if (k >= 1) {
        this.float.t.destroy();
        this.float = undefined;
      }
    }
  }
}
