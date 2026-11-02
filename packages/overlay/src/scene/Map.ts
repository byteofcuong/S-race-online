import { Container, Graphics, Text } from 'pixi.js';
import type { ProvincesFile } from '@srace/engine';
import vn from '../assets/vietnam.json';
import { ISLAND_LABELS, MAP_SCALE, TRACK_BOTTOM, TRACK_TOP, W, mapToScreen } from '../layout.ts';

const FONT = 'Be Vietnam Pro, sans-serif';

/** Vẽ path đã chuẩn hoá (chỉ M L C Z, toạ độ viewBox) lên Graphics, có scale/offset. */
function drawPath(g: Graphics, d: string, ox = 0, oy = 0) {
  const re = /([MLCZ])([^MLCZ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const n = m[2].trim() ? m[2].trim().split(/\s+/).map(Number) : [];
    const P = (i: number) => mapToScreen(n[i] + ox, n[i + 1] + oy);
    switch (m[1]) {
      case 'M': {
        const p = P(0);
        g.moveTo(p.x, p.y);
        break;
      }
      case 'L': {
        const p = P(0);
        g.lineTo(p.x, p.y);
        break;
      }
      case 'C': {
        const a = P(0), b = P(2), c = P(4);
        g.bezierCurveTo(a.x, a.y, b.x, b.y, c.x, c.y);
        break;
      }
      case 'Z':
        g.closePath();
        break;
    }
  }
}

function hex(c: string): number {
  return parseInt(c.replace('#', ''), 16);
}

/** Bản đồ Việt Nam thật: 34 tỉnh tô màu theo vùng, sáng màu đội khi có người chơi. */
export class VnMap {
  readonly view = new Container();
  private sea = new Graphics();
  private clouds = new Container();
  private shadow = new Graphics();
  private land = new Container();
  private overlays = new Container();
  private shapes = new Map<string, Graphics>();
  private baseColor = new Map<string, number>();
  private teamColor = new Map<string, number>();
  private flashes = new Map<string, { g: Graphics; until: number }>();
  private leaderGlow = new Graphics();
  private leaderId?: string;
  private waveT = 0;
  private cloudData: { c: Container; vx: number }[] = [];

  constructor(private provinces: ProvincesFile) {
    this.view.addChild(this.sea, this.shadow, this.land, this.overlays, this.leaderGlow, this.clouds);
    // bóng đổ toàn bộ đất liền
    for (const [, p] of Object.entries(vn.provinces)) for (const d of p.paths) drawPath(this.shadow, d, 4, 6);
    this.shadow.fill({ color: 0x0b2a4a, alpha: 0.28 });

    for (const p of provinces.provinces) {
      const region = provinces.regions[p.region];
      const base = hex(region?.color ?? '#cfd8dc');
      this.baseColor.set(p.id, base);
      const g = new Graphics();
      this.shapes.set(p.id, g);
      this.land.addChild(g);
      this.redraw(p.id);
    }
    this.drawIslandLabels();
    this.buildClouds();
    this.drawSea(0);
  }

  private redraw(id: string) {
    const g = this.shapes.get(id);
    const paths = (vn.provinces as Record<string, { paths: string[] }>)[id]?.paths ?? [];
    if (!g) return;
    g.clear();
    const team = this.teamColor.get(id);
    for (const d of paths) drawPath(g, d);
    if (team !== undefined) {
      g.fill({ color: team, alpha: 0.92 });
      for (const d of paths) drawPath(g, d);
      g.stroke({ width: 2, color: 0xffffff, alpha: 0.95 });
    } else {
      g.fill({ color: this.baseColor.get(id) ?? 0xcccccc, alpha: 0.9 });
      for (const d of paths) drawPath(g, d);
      g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.75 });
    }
  }

  /** Tô tỉnh theo màu đội (null → về màu vùng). */
  setTeam(id: string, color?: string) {
    const next = color ? hex(color) : undefined;
    if (this.teamColor.get(id) === next) return;
    if (next === undefined) this.teamColor.delete(id);
    else this.teamColor.set(id, next);
    this.redraw(id);
  }

  /** Nháy trắng khi có người vào đội. */
  flash(id: string, now: number) {
    const paths = (vn.provinces as Record<string, { paths: string[] }>)[id]?.paths;
    if (!paths) return;
    let f = this.flashes.get(id);
    if (!f) {
      const g = new Graphics();
      for (const d of paths) drawPath(g, d);
      g.fill({ color: 0xffffff, alpha: 1 });
      this.overlays.addChild(g);
      f = { g, until: 0 };
      this.flashes.set(id, f);
    }
    f.until = now + 450;
    f.g.alpha = 0.85;
  }

  setLeader(id?: string) {
    if (id === this.leaderId) return;
    this.leaderId = id;
    this.leaderGlow.clear();
    if (!id) return;
    const paths = (vn.provinces as Record<string, { paths: string[] }>)[id]?.paths ?? [];
    for (const d of paths) drawPath(this.leaderGlow, d);
    this.leaderGlow.stroke({ width: 5, color: 0xffd166, alpha: 0.95 });
  }

  private drawIslandLabels() {
    for (const l of ISLAND_LABELS) {
      const p = mapToScreen(l.x, l.y);
      const t = new Text({
        text: l.name,
        style: { fontFamily: FONT, fontSize: 17, fontWeight: '700', fill: 0xffffff, dropShadow: { alpha: 0.7, blur: 3, distance: 1 } },
      });
      t.anchor.set(0.5);
      t.position.set(p.x, p.y);
      this.overlays.addChild(t);
    }
    const sea = new Text({
      text: 'BIỂN ĐÔNG',
      style: { fontFamily: FONT, fontSize: 22, fontWeight: '900', fill: 0xffffff, letterSpacing: 6 },
    });
    sea.alpha = 0.35;
    sea.anchor.set(0.5);
    const sp = mapToScreen(520, 560);
    sea.position.set(sp.x, sp.y);
    sea.rotation = -0.3;
    this.overlays.addChild(sea);
  }

  private buildClouds() {
    const spots = [
      { x: 120, y: TRACK_TOP + 60, s: 1 },
      { x: 980, y: TRACK_TOP + 150, s: 0.8 },
      { x: 150, y: TRACK_BOTTOM - 120, s: 0.9 },
    ];
    for (const sp of spots) {
      const c = new Container();
      const g = new Graphics();
      g.ellipse(0, 0, 46, 22).fill({ color: 0xffffff, alpha: 0.9 });
      g.ellipse(-28, 6, 30, 16).fill({ color: 0xffffff, alpha: 0.9 });
      g.ellipse(30, 6, 34, 18).fill({ color: 0xffffff, alpha: 0.9 });
      g.ellipse(4, -14, 30, 18).fill({ color: 0xffffff, alpha: 0.9 });
      c.addChild(g);
      c.position.set(sp.x, sp.y);
      c.scale.set(sp.s);
      c.alpha = 0.55;
      this.clouds.addChild(c);
      this.cloudData.push({ c, vx: 6 + Math.random() * 6 });
    }
  }

  private drawSea(t: number) {
    const g = this.sea;
    g.clear();
    // gợn sóng mảnh trên nền biển (nền màu do CSS #stage)
    for (let row = 0; row < 14; row++) {
      const y = TRACK_TOP + 20 + row * 42 + Math.sin(t * 0.7 + row) * 3;
      const phase = t * 30 + row * 60;
      for (let x = -40; x < W + 40; x += 120) {
        const sx = x + (phase % 120);
        g.moveTo(sx, y).quadraticCurveTo(sx + 15, y - 6, sx + 30, y).quadraticCurveTo(sx + 45, y + 6, sx + 60, y);
      }
    }
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
  }

  update(dt: number, now: number) {
    this.waveT += dt;
    if (Math.floor(this.waveT * 10) !== Math.floor((this.waveT - dt) * 10)) this.drawSea(this.waveT);
    for (const [id, f] of this.flashes) {
      const left = f.until - now;
      if (left <= 0) {
        f.g.destroy();
        this.flashes.delete(id);
      } else f.g.alpha = Math.min(0.85, left / 450);
    }
    this.leaderGlow.alpha = 0.65 + Math.sin(now / 180) * 0.35;
    for (const cd of this.cloudData) {
      cd.c.x += cd.vx * dt;
      if (cd.c.x > W + 80) cd.c.x = -80;
    }
  }

  /** chiều cao đất liền trên màn hình, để debug */
  static get scale() {
    return MAP_SCALE;
  }
}
