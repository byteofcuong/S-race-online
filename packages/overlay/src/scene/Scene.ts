import { Application, Container } from 'pixi.js';
import type { FxEvent, ProvincesFile, Snapshot, TeamSnapshot } from '@srace/engine';
import { Vehicle } from './Vehicle.ts';
import { Effects } from './Effects.ts';
import { Track } from './Track.ts';
import { VnMap } from './Map.ts';
import { H, W } from '../layout.ts';
import { assets } from '../assets.ts';

/** Cảnh PixiJS: bản đồ thật + đường đua + phương tiện + hiệu ứng. Chỉ render, không chứa luật chơi. */
export class Scene {
  readonly app = new Application();
  private world = new Container();
  private vehicleLayer = new Container();
  private track?: Track;
  private map?: VnMap;
  private fx = new Effects();
  private vehicles = new Map<string, Vehicle>();
  private laneCounter = 0;
  private provinces?: ProvincesFile;
  private maxCars = 8;
  private snapshot?: Snapshot;
  private lastSnapAt = 0;
  private lastLikeFx = new Map<string, number>();
  private coloredTeams = new Set<string>();

  async init(host: HTMLElement) {
    await this.app.init({ width: W, height: H, backgroundAlpha: 0, antialias: true, resolution: 1, preference: 'webgl' });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    // elapsedMS không bị ticker cắt ở 100ms → hiệu ứng đúng thời lượng cả khi máy chậm
    this.app.ticker.add((t) => this.update(Math.min(0.25, t.elapsedMS / 1000)));
  }

  /** Gọi khi có dữ liệu tỉnh (hello) – dựng bản đồ, đường, nạp sprite. */
  async setProvinces(p: ProvincesFile, maxCars: number) {
    this.provinces = p;
    this.maxCars = maxCars;
    if (this.map) return;
    await assets.loadManifest();
    this.map = new VnMap(p);
    this.track = new Track();
    this.world.addChild(this.map.view, this.track.view, this.vehicleLayer, this.track.signs, this.fx.view);
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
    const { url, facing } = assets.vehicle(this.provinces, id);
    void assets.texture(url).then((t) => t && v.setTexture(t, facing));
  }

  private province(id: string) {
    return this.provinces?.provinces.find((p) => p.id === id);
  }

  private colorOf(id: string): number {
    const c = this.province(id)?.color ?? '#ffffff';
    return parseInt(c.slice(1), 16);
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
        v = new Vehicle(p, this.laneCounter++);
        v.display = t.progress;
        v.appear = 0.5;
        this.vehicles.set(t.id, v);
        this.vehicleLayer.addChild(v.view);
        this.applyTexture(t.id, v);
        const pt = this.track.at(t.progress);
        this.fx.burst(pt.x, pt.y, this.colorOf(t.id), 8, 140);
      }
      this.syncVehicle(v, t);
    }
    for (const [id, v] of this.vehicles) {
      if (!ids.has(id)) {
        v.view.destroy({ children: true });
        this.vehicles.delete(id);
      }
    }
    // tỉnh có đội → sáng màu đội trên bản đồ
    const teamIds = new Set(s.teams.map((t) => t.id));
    for (const id of teamIds) {
      if (!this.coloredTeams.has(id)) {
        this.map.setTeam(id, this.province(id)?.color);
        this.coloredTeams.add(id);
      }
    }
    for (const id of [...this.coloredTeams]) {
      if (!teamIds.has(id)) {
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
    const pt = this.track.at(v.display);
    return { x: v.view.x, y: v.view.y, angle: pt.angle, v };
  }

  handleFx(f: FxEvent, now: number) {
    if (!this.track || !this.map) return;
    switch (f.kind) {
      case 'join':
        this.map.flash(f.teamId, now);
        if (!this.coloredTeams.has(f.teamId)) {
          this.map.setTeam(f.teamId, this.province(f.teamId)?.color);
          this.coloredTeams.add(f.teamId);
        }
        break;
      case 'nitro': {
        const p = this.posOf(f.teamId);
        if (!p) return;
        const big = f.tier === 'large' || f.tier === 'super';
        this.fx.burst(p.x, p.y, big ? 0xffb703 : 0xff9f1c, big ? 40 : 14, big ? 380 : 220);
        if (big) this.fx.sprite('rocket', p.x, p.y - 40, { size: 70, to: 1.5, life: 1, vy: -90 });
        p.v.showFloat(`${f.nickname} +${f.diamonds}💎${f.golden ? ' ×2' : ''}`, f.golden ? 0xffd166 : 0xffffff);
        if (big) this.fx.kick(6);
        break;
      }
      case 'sabotage': {
        const p = this.posOf(f.toTeamId);
        if (!p) return;
        this.fx.pothole(p.x + Math.cos(p.angle) * 18, p.y + 6, 4, now);
        this.fx.collision(p.x, p.y);
        break;
      }
      case 'storm':
        this.fx.storm(3, now);
        for (const id of f.hitTeamIds) {
          const p = this.posOf(id);
          if (p) this.fx.burst(p.x, p.y, 0xb5179e, 18, 260);
        }
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
        const last = this.lastLikeFx.get(f.teamId) ?? 0;
        if (now - last < 700) return;
        this.lastLikeFx.set(f.teamId, now);
        this.fx.hearts(p.x, p.y - 30, 1, !!f.relief);
        break;
      }
      case 'finish': {
        const p = this.posOf(f.teamId) ?? { x: this.track.at(1).x, y: this.track.at(1).y };
        this.fx.confetti(p.x, p.y);
        this.fx.kick(8);
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
    const lobby = this.snapshot?.phase === 'lobby';
    for (const v of this.vehicles.values()) {
      // ngoại suy từ snapshot (10Hz) rồi làm mượt; lúc chờ thì xếp hàng ở vạch xuất phát
      const elapsed = racing ? Math.min(0.3, (Date.now() - this.lastSnapAt) / 1000) : 0;
      const target = lobby ? Math.max(0, v.rank - 1) * 0.012 : Math.min(1, v.target + v.speed * elapsed);
      const diff = target - v.display;
      v.display += Math.abs(diff) > 0.05 ? diff * Math.min(1, dt * 12) : diff * Math.min(1, dt * 6);
      const pt = this.track.at(v.display);
      const nx = -Math.sin(pt.angle), ny = Math.cos(pt.angle);
      v.view.position.set(pt.x + nx * v.lane, pt.y + ny * v.lane);
      v.update(dt, now, pt.angle);
      if (v.nitroUntil > now && racing) this.fx.flame(v.view.x - v.dir * 30, v.view.y - 10, v.dir, v.comboUntil > now ? 1.6 : 1);
      if (v.slowUntil > now && racing && Math.random() < 0.5) this.fx.smoke(v.view.x, v.view.y);
    }
    // xe đi trước vẽ sau để xe dẫn đầu luôn nổi lên trên
    const order = [...this.vehicles.values()].sort((a, b) => a.display - b.display);
    order.forEach((c, i) => this.vehicleLayer.setChildIndex(c.view, i));
    this.map.update(dt, now);
    const sh = this.fx.update(dt, now);
    this.world.position.set(sh.dx, sh.dy);
  }
}
