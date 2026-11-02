import { Container, Graphics, Text } from 'pixi.js';
import type { ProvincesFile } from '@srace/engine';
import vn from '../assets/vietnam.json';
import { ISLAND_LABELS, mapToScreen } from '../layout.ts';
import { hexToNum } from '../color.ts';

const FONT = 'Be Vietnam Pro, sans-serif';
const LAND = 0xf3e7cd; // một tông cát ấm cho toàn bộ đất liền
const BORDER = 0x8a7a5c;

type VnData = { provinces: Record<string, { paths: string[] }> };
const DATA = vn as unknown as VnData;

/** Vẽ path đã chuẩn hoá (chỉ M L C Z, toạ độ viewBox) lên Graphics, có offset. */
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

function paths(id: string): string[] {
  return DATA.provinces[id]?.paths ?? [];
}

/**
 * Bản đồ Việt Nam một tông: đất liền màu cát, viền tỉnh mờ.
 * Chỉ tỉnh của các đội đang hiện trên đường đua được tô màu đội.
 */
export class VnMap {
  readonly view = new Container();
  private land = new Graphics();
  private teams = new Container();
  private flashes = new Container();
  private leaderGlow = new Graphics();
  private shapes = new Map<string, Graphics>();
  private flashing = new Map<string, { g: Graphics; until: number }>();
  private leaderId?: string;

  constructor(_provinces: ProvincesFile) {
    // bóng đổ mềm một lớp
    const shadow = new Graphics();
    for (const p of Object.values(DATA.provinces)) for (const d of p.paths) drawPath(shadow, d, 3, 5);
    shadow.fill({ color: 0x0b3a66, alpha: 0.22 });

    // toàn bộ đất liền một màu, viền tỉnh rất mờ
    for (const p of Object.values(DATA.provinces)) for (const d of p.paths) drawPath(this.land, d);
    this.land.fill({ color: LAND });
    for (const p of Object.values(DATA.provinces)) for (const d of p.paths) drawPath(this.land, d);
    this.land.stroke({ width: 1, color: BORDER, alpha: 0.28 });

    this.view.addChild(shadow, this.land, this.teams, this.flashes, this.leaderGlow);
    this.drawIslandLabels();
  }

  /** Tô tỉnh theo màu đội; color undefined → trả về màu cát. */
  setTeam(id: string, color?: string) {
    const existing = this.shapes.get(id);
    if (!color) {
      existing?.destroy();
      this.shapes.delete(id);
      return;
    }
    const g = existing ?? new Graphics();
    g.clear();
    for (const d of paths(id)) drawPath(g, d);
    g.fill({ color: hexToNum(color), alpha: 0.55 });
    for (const d of paths(id)) drawPath(g, d);
    g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
    if (!existing) {
      this.shapes.set(id, g);
      this.teams.addChild(g);
    }
  }

  /** Nháy trắng nhẹ khi có người vào đội. */
  flash(id: string, now: number) {
    let f = this.flashing.get(id);
    if (!f) {
      const g = new Graphics();
      for (const d of paths(id)) drawPath(g, d);
      g.fill({ color: 0xffffff });
      this.flashes.addChild(g);
      f = { g, until: 0 };
      this.flashing.set(id, f);
    }
    f.until = now + 300;
  }

  setLeader(id?: string) {
    if (id === this.leaderId) return;
    this.leaderId = id;
    this.leaderGlow.clear();
    if (!id) return;
    for (const d of paths(id)) drawPath(this.leaderGlow, d);
    this.leaderGlow.stroke({ width: 3, color: 0xffd166, alpha: 1 });
  }

  private drawIslandLabels() {
    for (const l of ISLAND_LABELS) {
      const p = mapToScreen(l.x, l.y);
      const t = new Text({
        text: l.name,
        style: { fontFamily: FONT, fontSize: 16, fontWeight: '700', fill: 0xffffff, stroke: { color: 0x1f5f9e, width: 3 } },
      });
      t.alpha = 0.9;
      t.anchor.set(0.5);
      t.position.set(p.x, p.y);
      this.view.addChild(t);
    }
  }

  update(_dt: number, now: number) {
    for (const [id, f] of this.flashing) {
      const left = f.until - now;
      if (left <= 0) {
        f.g.destroy();
        this.flashing.delete(id);
      } else f.g.alpha = Math.min(0.7, left / 300);
    }
    this.leaderGlow.alpha = 0.7 + Math.sin(now / 200) * 0.3;
  }
}
