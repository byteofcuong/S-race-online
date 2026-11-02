import { Container, Graphics, Text } from 'pixi.js';
import { LANDMARKS, geo } from '../layout.ts';

export interface TrackPoint {
  x: number;
  y: number;
  /** góc tiếp tuyến (rad), 0 = hướng +x */
  angle: number;
}

/** Đường chữ S: spline Catmull-Rom qua các mốc, tham số hoá theo độ dài. */
export class Track {
  readonly view = new Container();
  private samples: { x: number; y: number; len: number }[] = [];
  private total = 0;

  constructor() {
    const pts = LANDMARKS.map((l) => geo(l.lon, l.lat));
    this.sample(pts, 40);
    this.draw(pts);
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
  at(progress: number): TrackPoint {
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

  private draw(pts: { x: number; y: number }[]) {
    const path = (g: Graphics) => {
      g.moveTo(this.samples[0].x, this.samples[0].y);
      for (const s of this.samples) g.lineTo(s.x, s.y);
      return g;
    };
    // đất liền mềm quanh đường
    const land2 = path(new Graphics()).stroke({ width: 230, color: 0x1f7a5a, alpha: 0.16, cap: 'round', join: 'round' });
    const land = path(new Graphics()).stroke({ width: 150, color: 0x2fae7a, alpha: 0.2, cap: 'round', join: 'round' });
    // viền đường sáng
    const edge = path(new Graphics()).stroke({ width: 58, color: 0xdfe6ff, alpha: 0.35, cap: 'round', join: 'round' });
    const road = path(new Graphics()).stroke({ width: 46, color: 0x262a45, alpha: 1, cap: 'round', join: 'round' });
    // vạch giữa đứt đoạn
    const dash = new Graphics();
    let on = true;
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1], b = this.samples[i];
      if (on) dash.moveTo(a.x, a.y).lineTo(b.x, b.y);
      if (i % 3 === 0) on = !on;
    }
    dash.stroke({ width: 4, color: 0xffe066, alpha: 0.75, cap: 'round' });
    this.view.addChild(land2, land, edge, road, dash);

    // mốc + nhãn
    LANDMARKS.forEach((l, i) => {
      const p = pts[i];
      const dot = new Graphics().circle(p.x, p.y, l.finish || l.start ? 11 : 7).fill({ color: 0xffffff, alpha: 0.95 });
      dot.circle(p.x, p.y, l.finish || l.start ? 16 : 11).stroke({ width: 3, color: l.finish ? 0xffd166 : 0xffffff, alpha: 0.5 });
      this.view.addChild(dot);
      const label = new Text({
        text: l.finish ? `🏁 ${l.name}` : l.start ? `🚦 ${l.name}` : l.name,
        style: { fontFamily: 'Be Vietnam Pro, sans-serif', fontSize: l.finish || l.start ? 26 : 21, fontWeight: l.finish || l.start ? '900' : '700', fill: 0xffffff, dropShadow: { alpha: 0.6, blur: 4, distance: 2 } },
      });
      label.alpha = l.finish || l.start ? 1 : 0.85;
      label.anchor.set(l.side === 'left' ? 1 : 0, 0.5);
      label.position.set(p.x + (l.side === 'left' ? -36 : 36), p.y);
      this.view.addChild(label);
    });

    // vạch đích
    const fin = pts[pts.length - 1];
    const ang = this.at(1).angle + Math.PI / 2;
    const flag = new Graphics();
    for (let k = -3; k < 3; k++) {
      const c = k % 2 === 0 ? 0xffffff : 0x111111;
      flag.rect(k * 9, -6, 9, 12).fill({ color: c, alpha: 0.9 });
    }
    flag.position.set(fin.x, fin.y);
    flag.rotation = ang;
    this.view.addChild(flag);
  }
}
