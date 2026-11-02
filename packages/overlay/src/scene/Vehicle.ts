import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Province } from '@srace/engine';
import { assets } from '../assets.ts';

const FONT = 'Be Vietnam Pro, sans-serif';
const SIZE = 64; // chiều cao sprite

/** Phương tiện của một tỉnh: sprite theo vùng, lật theo hướng chạy, vòng màu đội + huy hiệu. */
export class Vehicle {
  readonly view = new Container();
  private shadow = new Graphics();
  private ring = new Graphics();
  private sprite = new Sprite();
  private flame = new Sprite();
  private shieldIcon = new Sprite();
  private shieldRing = new Graphics();
  private badge = new Container();
  private crown = new Sprite();
  private combo = new Text({ text: 'COMBO', style: { fontFamily: FONT, fontSize: 14, fontWeight: '900', fill: 0xffd166, stroke: { color: 0x3a2e2a, width: 3 } } });
  private float?: { t: Text; life: number; max: number };
  private facing: 'left' | 'right' = 'left';
  private color: number;

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
  dir = 1; // 1 chạy sang phải, -1 sang trái
  appear = 0;
  private pulse = Math.random() * 6;
  private bob = Math.random() * 6;

  constructor(
    readonly province: Province,
    laneIndex: number,
  ) {
    const lanes = [0, -20, 20, -40, 40, -60, 60, -10, 10];
    this.lane = lanes[laneIndex % lanes.length];
    this.color = parseInt(province.color.slice(1), 16);

    this.shadow.ellipse(0, 4, 30, 10).fill({ color: 0x000000, alpha: 0.28 });
    this.ring.ellipse(0, 4, 38, 14).stroke({ width: 4, color: this.color, alpha: 0.95 });
    this.ring.ellipse(0, 4, 38, 14).fill({ color: this.color, alpha: 0.18 });

    this.sprite.anchor.set(0.5, 0.86);
    this.flame.anchor.set(0.5, 0.5);
    this.flame.visible = false;
    this.shieldIcon.anchor.set(0.5, 0.5);
    this.shieldIcon.visible = false;
    this.shieldRing.visible = false;
    this.crown.anchor.set(0.5, 1);
    this.crown.visible = false;
    this.combo.anchor.set(0.5, 1);
    this.combo.position.set(0, -92);
    this.combo.visible = false;

    this.drawBadge(province);
    this.view.addChild(this.shadow, this.ring, this.flame, this.shieldRing, this.sprite, this.shieldIcon, this.badge, this.crown, this.combo);

    void assets.icon('fire').then((t) => t && (this.flame.texture = t, this.flame.height = 44, this.flame.scale.x = this.flame.scale.y));
    void assets.icon('shield').then((t) => t && (this.shieldIcon.texture = t, this.shieldIcon.height = 30, this.shieldIcon.scale.x = this.shieldIcon.scale.y));
    void assets.icon('crown').then((t) => t && (this.crown.texture = t, this.crown.height = 26, this.crown.scale.x = this.crown.scale.y));
  }

  private baseScale = 1;

  setTexture(tex: Texture, facing: 'left' | 'right') {
    this.sprite.texture = tex;
    this.facing = facing;
    let k = SIZE / tex.height;
    if (tex.width * k > 92) k = 92 / tex.width;
    this.baseScale = k;
    this.sprite.scale.set(k);
  }

  private drawBadge(p: Province) {
    const txt = new Text({ text: p.code, style: { fontFamily: FONT, fontSize: 17, fontWeight: '900', fill: 0xffffff } });
    txt.anchor.set(0.5);
    const w = Math.max(42, txt.width + 16);
    const bg = new Graphics().roundRect(-w / 2, -13, w, 26, 8).fill({ color: this.color, alpha: 1 });
    bg.roundRect(-w / 2, -13, w, 26, 8).stroke({ width: 2.5, color: 0xffffff, alpha: 0.95 });
    this.badge.addChild(bg, txt);
    this.badge.position.set(0, -70);
    this.crown.position.set(w / 2 + 6, -72);
  }

  showFloat(text: string, color = 0xffffff) {
    this.float?.t.destroy();
    const t = new Text({
      text,
      style: { fontFamily: FONT, fontSize: 22, fontWeight: '900', fill: color, stroke: { color: 0x1b2a4a, width: 4 }, dropShadow: { alpha: 0.6, blur: 3, distance: 2 } },
    });
    t.anchor.set(0.5, 1);
    t.position.set(0, -96);
    this.view.addChild(t);
    this.float = { t, life: 0, max: 3.2 };
  }

  /** Cập nhật hình ảnh mỗi khung hình. angle = góc tiếp tuyến đường tại vị trí xe. */
  update(dt: number, now: number, angle: number) {
    this.pulse += dt * 4;
    const slowed = this.slowUntil > now;
    const nitro = this.nitroUntil > now;
    const moving = this.speed > 0.0005 || nitro;

    // hướng chạy: lật sprite để mặt xe quay theo chiều đi
    const dx = Math.cos(angle);
    if (Math.abs(dx) > 0.15) this.dir = dx > 0 ? 1 : -1;
    const faceRight = this.dir === 1;
    const flip = (this.facing === 'right') !== faceRight;

    // nhún theo tốc độ (tính từ scale gốc, không cộng dồn)
    this.bob += dt * (moving ? 14 : 4);
    const bobAmt = moving ? (nitro ? 0.07 : 0.035) : 0.012;
    const base = this.baseScale * (nitro ? 1.12 : 1);
    this.sprite.scale.set((flip ? -1 : 1) * base, base * (1 + Math.sin(this.bob) * bobAmt));
    this.sprite.position.y = Math.sin(this.bob) * (moving ? 2 : 0.5);

    // bị phá: lắc + xám
    if (slowed) {
      this.sprite.rotation = Math.sin(this.pulse * 6) * 0.14;
      this.sprite.tint = 0x9a9a9a;
    } else {
      this.sprite.rotation *= 0.7;
      this.sprite.tint = 0xffffff;
    }

    // lửa nitro phía sau
    this.flame.visible = nitro && !!this.flame.texture;
    if (this.flame.visible) {
      this.flame.position.set(-this.dir * 36, -14);
      this.flame.rotation = this.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
      const k = (this.comboUntil > now ? 1.35 : 1) * (1 + Math.sin(this.pulse * 5) * 0.15);
      const h = 44 * k;
      this.flame.height = h;
      this.flame.scale.x = this.flame.scale.y;
    }

    // khiên
    const sh = this.shields > 0;
    this.shieldIcon.visible = sh && !!this.shieldIcon.texture;
    this.shieldRing.visible = sh;
    if (sh) {
      this.shieldIcon.position.set(-30, -58);
      if (this.shieldIcon.texture) {
        const k = (30 / this.shieldIcon.texture.height) * (1 + Math.sin(this.pulse) * 0.06);
        this.shieldIcon.scale.set(k);
      }
      this.shieldRing.clear();
      const r = 46 + Math.sin(this.pulse) * 3;
      this.shieldRing.ellipse(0, -24, r, r * 0.9).fill({ color: 0x4cc9f0, alpha: 0.12 });
      this.shieldRing.ellipse(0, -24, r, r * 0.9).stroke({ width: 3, color: 0x9ae8ff, alpha: 0.85 });
    }

    this.crown.visible = this.winStreak > 0 && !!this.crown.texture;
    this.combo.visible = this.comboUntil > now;
    if (this.combo.visible) this.combo.scale.set(1 + Math.sin(this.pulse * 2) * 0.12);

    const scale = 0.95;
    if (this.appear > 0) {
      this.appear = Math.max(0, this.appear - dt);
      this.view.scale.set(scale + this.appear * 1.2);
      this.view.alpha = 1 - this.appear;
    } else {
      this.view.scale.set(scale);
      this.view.alpha = 1;
    }

    if (this.float) {
      this.float.life += dt;
      const k = this.float.life / this.float.max;
      this.float.t.position.y = -96 - k * 40;
      this.float.t.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      if (k >= 1) {
        this.float.t.destroy();
        this.float = undefined;
      }
    }
  }
}
