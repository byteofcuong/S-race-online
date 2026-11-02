import { Container, Graphics, Sprite, Text } from 'pixi.js';
import vn from '../assets/vietnam.json';
import { TRACK_POINTS, mapToScreen } from '../layout.ts';
import { assets } from '../assets.ts';

const FONT = 'Be Vietnam Pro, sans-serif';

export interface TrackPos {
  x: number;
  y: number;
  /** góc tiếp tuyến (rad), 0 = hướng +x */
  angle: number;
}

/** Đường đua chạy dọc bản đồ thật: spline Catmull-Rom qua tâm các tỉnh, tham số hoá theo độ dài. */
export class Track {
  readonly view = new Container();
  readonly signs = new Container();
  private samples: { x: number; y: number; len: number }[] = [];
  private total = 0;
  readonly points: { x: number; y: number }[];

  constructor() {
    const old = vn.old as Record<string, { cx: number; cy: number }>;
    this.points = TRACK_POINTS.map((p) => mapToScreen(old[p.old].cx + (p.dx ?? 0), old[p.old].cy + (p.dy ?? 0)));
    this.sample(this.points, 40);
    this.draw();
    this.view.addChild(this.signs);
  }

  private sample(pts: { x: number; y: number }[], perSeg: number) {
    const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
    let len = 0;
    let prev: { x: number; y: number } | undefined;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < perSeg; k++) {
        const t = k / perSeg, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        if (prev) len += Math.hypot(x - prev.x, y - prev.y);
        this.samples.push({ x, y, len });
        prev = { x, y };
      }
    }
    const last = pts[pts.length - 1];
    len += Math.hypot(last.x - prev!.x, last.y - prev!.y);
    this.samples.push({ x: last.x, y: last.y, len });
    this.total = len;
  }

  /** Vị trí trên đường theo progress 0..1 */
  at(progress: number): TrackPos {
    const p = Math.max(0, Math.min(1, progress));
    const target = p * this.total;
    let lo = 0, hi = this.samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.samples[mid].len < target) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const a = this.samples[i - 1], b = this.samples[i];
    const span = b.len - a.len || 1;
    const t = Math.max(0, Math.min(1, (target - a.len) / span));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  private draw() {
    const path = (g: Graphics) => {
      g.moveTo(this.samples[0].x, this.samples[0].y);
      for (const s of this.samples) g.lineTo(s.x, s.y);
      return g;
    };
    const outline = path(new Graphics()).stroke({ width: 32, color: 0x2a2233, alpha: 0.95, cap: 'round', join: 'round' });
    const road = path(new Graphics()).stroke({ width: 24, color: 0x4f5566, alpha: 1, cap: 'round', join: 'round' });
    const sheen = path(new Graphics()).stroke({ width: 8, color: 0xffffff, alpha: 0.1, cap: 'round', join: 'round' });
    const dash = new Graphics();
    let on = true;
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1], b = this.samples[i];
      if (on) dash.moveTo(a.x, a.y).lineTo(b.x, b.y);
      if (i % 3 === 0) on = !on;
    }
    dash.stroke({ width: 3, color: 0xffe066, alpha: 0.9, cap: 'round' });
    this.view.addChild(outline, road, sheen, dash);

    // mốc + nhãn kiểu biển báo
    TRACK_POINTS.forEach((lm, i) => {
      const p = this.points[i];
      const big = lm.finish || lm.start;
      const dot = new Graphics();
      dot.circle(p.x, p.y, big ? 10 : 7).fill(0xffffff);
      dot.circle(p.x, p.y, big ? 10 : 7).stroke({ width: 3, color: lm.finish ? 0xffd166 : lm.start ? 0x06d6a0 : 0x3a2e2a, alpha: 0.9 });
      this.view.addChild(dot);
      const label = new Text({
        text: lm.name,
        style: {
          fontFamily: FONT,
          fontSize: big ? 24 : 19,
          fontWeight: big ? '900' : '700',
          fill: 0xffffff,
          stroke: { color: 0x1b2a4a, width: 4 },
          dropShadow: { alpha: 0.5, blur: 3, distance: 2 },
        },
      });
      label.anchor.set(lm.side === 'left' ? 1 : 0, 0.5);
      label.position.set(p.x + (lm.side === 'left' ? -22 : 22), p.y);
      this.view.addChild(label);
      if (lm.start || lm.finish) {
        void assets.icon(lm.finish ? 'chequered-flag' : 'vertical-traffic-light').then((tex) => {
          if (!tex) return;
          const s = new Sprite(tex);
          s.anchor.set(0.5, 1);
          s.height = lm.finish ? 54 : 46;
          s.scale.x = s.scale.y;
          s.position.set(p.x + (lm.finish ? -26 : 26), p.y - 6);
          this.signs.addChild(s);
        });
      }
    });
  }
}
