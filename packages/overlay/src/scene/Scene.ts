import { Application, Container } from 'pixi.js';
import type { FxEvent, ProvincesFile, Snapshot, TeamSnapshot } from '@srace/engine';
import { CAR_LEN, Vehicle } from './Vehicle.ts';
import { Effects } from './Effects.ts';
import { Track } from './Track.ts';
import { VnMap } from './Map.ts';
import { H, W } from '../layout.ts';
import { assets } from '../assets.ts';

/** Khoảng cách tối thiểu giữa 2 xe liền nhau (theo chiều dài xe); 2 xe liền nhau đi 2 làn khác nhau. */
const MIN_GAP_CARS = 0.62;
const LANE = 12;
/** Tim bay: tối đa 1 lần mỗi khoảng này trên toàn màn hình. */
const HEART_EVERY_MS = 700;

/** Cảnh PixiJS: bản đồ thật + đường đua + xe + hiệu ứng. Chỉ render, không chứa luật chơi. */
export class Scene {
  readonly app = new Application();
  private world = new Container();
  private vehicleLayer = new Container();
  private track?: Track;
  private map?: VnMap;
  private fx = new Effects();
  private vehicles = new Map<string, Vehicle>();
  private provinces?: ProvincesFile;
  private maxCars = 8;
  private snapshot?: Snapshot;
  private lastSnapAt = 0;
  private lastHeartAt = 0;
  private coloredTeams = new Set<string>();

  async init(host: HTMLElement) {
    await this.app.init({ width: W, height: H, backgroundAlpha: 0, antialias: true, resolution: 1, preference: 'webgl' });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    // elapsedMS không bị ticker cắt ở 100ms → hiệu ứng đúng thời lượng cả khi máy chậm
    this.app.ticker.add((t) => this.update(Math.min(0.25, t.elapsedMS / 1000)));
  }

  /** Gọi khi có dữ liệu tỉnh (hello) – dựng bản đồ, đường, nạp ảnh xe. */
  async setProvinces(p: ProvincesFile, maxCars: number) {
    this.provinces = p;
    this.maxCars = maxCars;
    if (this.map) return;
    await assets.loadManifest();
    this.map = new VnMap(p);
    this.track = new Track();
    this.world.addChild(this.map.view, this.track.view, this.fx.ground, this.vehicleLayer, this.track.signs, this.fx.view);
    await assets.preload(p, ['fire', 'shield', 'crown']);
    for (const [id, v] of this.vehicles) this.applyTexture(id, v);
  }

  /** Nạp lại manifest (ảnh người dùng) không cần tải lại trang. */
  async reloadAssets() {
    if (!this.provinces) return;
    await assets.loadManifest();
    await assets.preload(this.provinces, ['fire', 'shield', 'crown']);
    for (const [id, v] of this.vehicles) this.applyTexture(id, v);
  }

  private applyTexture(id: string, v: Vehicle) {
    if (!this.provinces) return;
    void assets.vehicleTexture(this.provinces, id).then((r) => r && v.setTexture(r.tex, r.nose));
  }

  private province(id: string) {
    return this.provinces?.provinces.find((p) => p.id === id);
  }

  applySnapshot(s: Snapshot, now: number) {
    this.snapshot = s;
    this.lastSnapAt = now;
    if (!this.track || !this.map) return;
    const shown = s.teams.slice(0, this.maxCars);
    const ids = new Set(shown.map((t) => t.id));
    for (const t of shown) {
      let v = this.vehicles.get(t.id);
      if (!v) {
        const p = this.province(t.id);
        if (!p) continue;
        v = new Vehicle(p);
        v.display = t.progress;
        v.appear = 0.4;
        this.vehicles.set(t.id, v);
        this.vehicleLayer.addChild(v.view);
        this.applyTexture(t.id, v);
      }
      this.syncVehicle(v, t);
    }
    for (const [id, v] of this.vehicles) {
      if (!ids.has(id)) {
        v.view.destroy({ children: true });
        this.vehicles.delete(id);
      }
    }
    // chỉ tỉnh của các đội đang hiện trên đường được tô màu
    for (const id of ids) {
      if (!this.coloredTeams.has(id)) {
        this.map.setTeam(id, this.province(id)?.color);
        this.coloredTeams.add(id);
      }
    }
    for (const id of [...this.coloredTeams]) {
      if (!ids.has(id)) {
        this.map.setTeam(id, undefined);
        this.coloredTeams.delete(id);
      }
    }
    const racing = s.phase === 'racing' || s.phase === 'golden';
    this.map.setLeader(racing && s.teams.length > 1 ? s.teams[0].id : undefined);
  }

  private syncVehicle(v: Vehicle, t: TeamSnapshot) {
    v.target = t.progress;
    v.speed = t.speed;
    v.nitroUntil = t.nitroUntil;
    v.slowUntil = t.slowUntil;
    v.comboUntil = t.comboUntil;
    v.shields = t.shields;
    v.winStreak = t.winStreak;
    v.rank = t.rank;
  }

  private posOf(id: string) {
    const v = this.vehicles.get(id);
    if (!v || !this.track) return undefined;
    return { x: v.view.x, y: v.view.y, v };
  }

  handleFx(f: FxEvent, now: number) {
    if (!this.track || !this.map) return;
    switch (f.kind) {
      case 'join':
        this.map.flash(f.teamId, now);
        break;
      case 'nitro': {
        const p = this.posOf(f.teamId);
        if (!p) return;
        const big = f.tier === 'large' || f.tier === 'super';
        if (big) {
          this.fx.burst(p.x, p.y, 0xffb703, 16, 260);
          this.fx.kick(4);
        }
        if (f.tier !== 'small') p.v.showFloat(`${f.nickname} +${f.diamonds}${f.golden ? ' ×2' : ''}`, f.golden ? 0xffd166 : 0xffffff);
        break;
      }
      case 'sabotage': {
        const p = this.posOf(f.toTeamId);
        if (!p) return;
        this.fx.pothole(p.x, p.y + 4, 4, now);
        this.fx.collision(p.x, p.y);
        break;
      }
      case 'storm':
        this.fx.storm(3, now);
        break;
      case 'shieldGain': {
        const p = this.posOf(f.teamId);
        if (p) this.fx.shieldGain(p.x, p.y);
        break;
      }
      case 'shieldBreak': {
        const p = this.posOf(f.teamId);
        if (p) this.fx.shieldBreak(p.x, p.y);
        break;
      }
      case 'likeBurst': {
        const p = this.posOf(f.teamId);
        if (!p) return;
        if (now - this.lastHeartAt < HEART_EVERY_MS) return;
        this.lastHeartAt = now;
        this.fx.hearts(p.x, p.y - 20, 1);
        break;
      }
      case 'finish': {
        const p = this.posOf(f.teamId) ?? { x: this.track.at(1).x, y: this.track.at(1).y };
        this.fx.confetti(p.x, p.y);
        this.fx.kick(6);
        break;
      }
      case 'phase':
        if (f.phase === 'podium' && this.snapshot?.lastResult) {
          const p = this.posOf(this.snapshot.lastResult.winnerTeamId) ?? { x: W / 2, y: 700 };
          this.fx.confetti(p.x, p.y);
        }
        break;
    }
  }

  private update(dt: number) {
    const now = Date.now() + (this.snapshot ? this.snapshot.t - this.lastSnapAt : 0);
    if (!this.track || !this.map) return;
    const racing = this.snapshot?.phase === 'racing' || this.snapshot?.phase === 'golden';
    // Giãn cách: giữ đúng thứ tự thật, xe sát phía sau lùi lại tối thiểu MIN_GAP và đi làn xen kẽ
    // → không bao giờ thành một đống xe chồng lên nhau, kể cả lúc xuất phát.
    const elapsed = racing ? Math.min(0.3, (Date.now() - this.lastSnapAt) / 1000) : 0;
    const gap = (CAR_LEN * MIN_GAP_CARS) / this.track.length;
    const list = [...this.vehicles.values()].map((v) => ({ v, p: Math.min(1, v.target + v.speed * elapsed) }));
    list.sort((a, b) => b.p - a.p || a.v.rank - b.v.rank);
    for (let i = 1; i < list.length; i++) list[i].p = Math.min(list[i].p, list[i - 1].p - gap);
    const minP = list.length ? list[list.length - 1].p : 0;
    if (minP < 0) for (const e of list) e.p = Math.min(1, e.p - minP);
    list.forEach((e, i) => {
      e.v.wantLane = list.length === 1 ? 0 : i % 2 === 0 ? -LANE : LANE;
    });
    for (const { v, p: target } of list) {
      const diff = target - v.display;
      v.display += Math.abs(diff) > 0.05 ? diff * Math.min(1, dt * 10) : diff * Math.min(1, dt * 6);
      v.lane += (v.wantLane - v.lane) * Math.min(1, dt * 4);
      const pt = this.track.at(v.display);
      const nx = -Math.sin(pt.angle), ny = Math.cos(pt.angle);
      v.view.position.set(pt.x + nx * v.lane, pt.y + ny * v.lane);
      v.update(dt, now, pt.angle);
      if (v.nitroUntil > now && racing) {
        const bx = v.view.x - Math.cos(pt.angle) * (CAR_LEN / 2 + 6);
        const by = v.view.y - Math.sin(pt.angle) * (CAR_LEN / 2 + 6);
        this.fx.flame(bx, by, pt.angle, v.comboUntil > now ? 1.5 : 1);
      }
      if (v.slowUntil > now && racing && Math.random() < 0.25) this.fx.smoke(v.view.x, v.view.y);
    }
    // xe đi trước vẽ sau để xe dẫn đầu luôn nổi lên trên
    const order = [...this.vehicles.values()].sort((a, b) => a.display - b.display);
    order.forEach((c, i) => this.vehicleLayer.setChildIndex(c.view, i));
    // huy hiệu: xe hạng cao giữ nhãn, xe sát phía sau bị che thì ẩn nhãn (màu xe vẫn nhận ra được)
    const placed: { x: number; y: number }[] = [];
    for (const v of [...this.vehicles.values()].sort((a, b) => a.rank - b.rank)) {
      const bx = v.view.x, by = v.view.y;
      const overlap = placed.some((p) => Math.abs(p.x - bx) < 44 && Math.abs(p.y - by) < 30);
      v.setLabelVisible(!overlap);
      if (!overlap) placed.push({ x: bx, y: by });
    }
    this.map.update(dt, now);
    const sh = this.fx.update(dt, now);
    this.world.position.set(sh.dx, sh.dy);
  }
}
