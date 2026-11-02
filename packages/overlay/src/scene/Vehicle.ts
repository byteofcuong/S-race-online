import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Province } from '@srace/engine';
import { assets, noseOffset, type Nose } from '../assets.ts';
import { darken, hexToNum, textOn } from '../color.ts';

const FONT = 'Be Vietnam Pro, sans-serif';
/** chiều dài xe trên màn hình (px) */
export const CAR_LEN = 50;

/**
 * Xe top-down của một tỉnh: xoay theo đường, thân nhuộm màu đội (tint).
 * Phần "body" xoay; huy hiệu, vương miện, chữ nổi luôn đứng thẳng.
 */
export class Vehicle {
  readonly view = new Container();
  private body = new Container();
  private shadow = new Graphics();
  private sprite = new Sprite();
  private flame = new Sprite();
  private shieldRing = new Graphics();
  private shieldIcon = new Sprite();
  private badge = new Container();
  private crown = new Sprite();
  private combo = new Text({
    text: 'COMBO',
    style: { fontFamily: FONT, fontSize: 13, fontWeight: '900', fill: 0xffd166, stroke: { color: 0x1b1d24, width: 3 } },
  });
  private float?: { t: Text; life: number; max: number };
  private nose = 0;
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
  /** làn đang hiển thị (lerp tới wantLane) */
  lane = 0;
  wantLane = 0;
  appear = 0;
  private pulse = Math.random() * 6;

  constructor(readonly province: Province) {
    this.color = hexToNum(province.color);

    this.sprite.anchor.set(0.5);
    this.sprite.tint = this.color;
    this.flame.anchor.set(0.5, 0.15);
    this.flame.visible = false;
    this.body.addChild(this.shadow, this.flame, this.sprite);

    this.shieldRing.visible = false;
    this.shieldIcon.anchor.set(0.5);
    this.shieldIcon.visible = false;
    this.crown.anchor.set(0.5, 1);
    this.crown.visible = false;
    this.combo.anchor.set(0.5, 1);
    this.combo.position.set(0, -60);
    this.combo.visible = false;

    this.drawBadge(province);
    this.view.addChild(this.shieldRing, this.body, this.shieldIcon, this.badge, this.crown, this.combo);

    void assets.icon('fire').then((t) => t && (this.flame.texture = t));
    void assets.icon('shield').then((t) => t && (this.shieldIcon.texture = t));
    void assets.icon('crown').then((t) => t && (this.crown.texture = t));
  }

  /** texture thang xám (assets.tintable) + hướng mũi xe trong ảnh gốc */
  setTexture(tex: Texture, nose: Nose) {
    this.sprite.texture = tex;
    this.nose = noseOffset(nose);
    // sau khi xoay về mũi hướng lên, chiều dài = cạnh dọc
    const len = nose === 'left' || nose === 'right' ? tex.width : tex.height;
    const k = CAR_LEN / len;
    this.sprite.scale.set(k);
    this.sprite.rotation = this.nose;
    const w = (nose === 'left' || nose === 'right' ? tex.height : tex.width) * k;
    this.shadow.clear();
    this.shadow.roundRect(-w / 2 + 2, -CAR_LEN / 2 + 4, w, CAR_LEN, w * 0.35).fill({ color: 0x000000, alpha: 0.28 });
  }

  private drawBadge(p: Province) {
    const txt = new Text({ text: p.code, style: { fontFamily: FONT, fontSize: 14, fontWeight: '900', fill: textOn(p.color) } });
    txt.anchor.set(0.5);
    const w = Math.max(34, txt.width + 12);
    const bg = new Graphics().roundRect(-w / 2, -11, w, 22, 7).fill({ color: this.color });
    bg.roundRect(-w / 2, -11, w, 22, 7).stroke({ width: 2, color: 0xffffff, alpha: 0.95 });
    this.badge.addChild(bg, txt);
    this.badge.position.set(0, -38);
    this.crown.position.set(w / 2 + 2, -42);
  }

  /** ẩn huy hiệu khi bị huy hiệu của xe hạng cao hơn che (xe chạy sát nhau) */
  setLabelVisible(on: boolean) {
    this.badge.visible = on;
    this.labelOn = on;
  }
  private labelOn = true;

  showFloat(text: string, color = 0xffffff) {
    this.float?.t.destroy();
    const t = new Text({
      text,
      style: { fontFamily: FONT, fontSize: 20, fontWeight: '900', fill: color, stroke: { color: 0x1b1d24, width: 4 } },
    });
    t.anchor.set(0.5, 1);
    t.position.set(0, -54);
    this.view.addChild(t);
    this.float = { t, life: 0, max: 2.6 };
  }

  /** angle = góc tiếp tuyến đường (rad, 0 = +x). */
  update(dt: number, now: number, angle: number) {
    this.pulse += dt * 4;
    const slowed = this.slowUntil > now;
    const nitro = this.nitroUntil > now;

    // mũi xe (hướng lên trong hệ body) → hướng đi
    this.body.rotation = angle + Math.PI / 2 + (slowed ? Math.sin(this.pulse * 6) * 0.22 : 0);
    this.body.scale.set(nitro ? 1.1 : 1);
    this.sprite.tint = slowed ? darken(this.color, 0.55) : this.color;

    this.flame.visible = nitro && this.flame.texture !== Texture.EMPTY;
    if (this.flame.visible) {
      const h = 26 * (this.comboUntil > now ? 1.35 : 1) * (1 + Math.sin(this.pulse * 6) * 0.12);
      this.flame.scale.set(h / this.flame.texture.height);
      this.flame.rotation = Math.PI; // ngọn lửa hướng ra sau đuôi
      this.flame.position.set(0, CAR_LEN / 2 - 2);
    }

    const sh = this.shields > 0;
    this.shieldRing.visible = sh;
    this.shieldIcon.visible = sh && this.shieldIcon.texture !== Texture.EMPTY;
    if (sh) {
      const r = 30 + Math.sin(this.pulse) * 2;
      this.shieldRing.clear();
      this.shieldRing.circle(0, 0, r).fill({ color: 0x4cc9f0, alpha: 0.1 });
      this.shieldRing.circle(0, 0, r).stroke({ width: 2.5, color: 0xbdefff, alpha: 0.9 });
      this.shieldIcon.scale.set(20 / Math.max(1, this.shieldIcon.texture.height));
      this.shieldIcon.position.set(-24, -24);
    }

    this.crown.visible = this.labelOn && this.winStreak > 0 && this.crown.texture !== Texture.EMPTY;
    if (this.crown.visible) this.crown.scale.set(18 / Math.max(1, this.crown.texture.height));
    this.combo.visible = this.labelOn && this.comboUntil > now;

    if (this.appear > 0) {
      this.appear = Math.max(0, this.appear - dt);
      this.view.scale.set(1 + this.appear * 0.8);
      this.view.alpha = 1 - this.appear;
    } else {
      this.view.scale.set(1);
      this.view.alpha = 1;
    }

    if (this.float) {
      this.float.life += dt;
      const k = this.float.life / this.float.max;
      this.float.t.position.y = -54 - k * 30;
      this.float.t.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      if (k >= 1) {
        this.float.t.destroy();
        this.float = undefined;
      }
    }
  }
}
