import { Application, Container, Graphics } from 'pixi.js';
import type { FxEvent, ProvincesFile, Snapshot, TeamSnapshot } from '@srace/engine';
import { Car } from './Car.ts';
import { Effects } from './Effects.ts';
import { Track } from './Track.ts';
import { H, TRACK_BOTTOM, TRACK_TOP, W } from '../layout.ts';

/** Cảnh PixiJS: bản đồ + xe + hiệu ứng. Chỉ render, không chứa luật chơi. */
export class Scene {
  readonly app = new Application();
  private world = new Container();
  private carLayer = new Container();
  private track = new Track();
  private fx = new Effects();
  private cars = new Map<string, Car>();
  private laneCounter = 0;
  private provinces?: ProvincesFile;
  private maxCars = 8;
  private snapshot?: Snapshot;
  private lastSnapAt = 0;
  private lastLikeFx = new Map<string, number>();

  async init(host: HTMLElement) {
    await this.app.init({ width: W, height: H, backgroundAlpha: 0, antialias: true, resolution: 1, preference: 'webgl' });
    host.appendChild(this.app.canvas);
    // viền mờ vùng đường đua để tách khỏi HUD
    const glow = new Graphics().roundRect(30, TRACK_TOP - 16, W - 60, TRACK_BOTTOM - TRACK_TOP + 32, 40).fill({ color: 0xffffff, alpha: 0.03 });
    this.world.addChild(glow, this.track.view, this.carLayer, this.fx.view);
    this.app.stage.addChild(this.world);
    this.app.ticker.add((t) => this.update(t.deltaMS / 1000));
  }

  setProvinces(p: ProvincesFile, maxCars: number) {
    this.provinces = p;
    this.maxCars = maxCars;
  }

  private province(id: string) {
    return this.provinces?.provinces.find((p) => p.id === id);
  }

  private colorOf(id: string): number {
    const c = this.province(id)?.color ?? '#ffffff';
    return parseInt(c.slice(1), 16);
  }

  carOf(id: string): Car | undefined {
    return this.cars.get(id);
  }

  applySnapshot(s: Snapshot, now: number) {
    this.snapshot = s;
    this.lastSnapAt = now;
    const shown = s.teams.slice(0, this.maxCars);
    const ids = new Set(shown.map((t) => t.id));
    for (const t of shown) {
      let car = this.cars.get(t.id);
      if (!car) {
        const p = this.province(t.id);
        if (!p) continue;
        car = new Car(p, this.laneCounter++);
        car.display = t.progress;
        car.appear = 0.5;
        this.cars.set(t.id, car);
        this.carLayer.addChild(car.view);
        const pt = this.track.at(t.progress);
        this.fx.burst(pt.x, pt.y, this.colorOf(t.id), 8, 140);
      }
      this.syncCar(car, t);
    }
    for (const [id, car] of this.cars) {
      if (!ids.has(id)) {
        car.view.destroy({ children: true });
        this.cars.delete(id);
      }
    }
  }

  private syncCar(car: Car, t: TeamSnapshot) {
    car.target = t.progress;
    car.speed = t.speed;
    car.nitroUntil = t.nitroUntil;
    car.slowUntil = t.slowUntil;
    car.comboUntil = t.comboUntil;
    car.shields = t.shields;
    car.winStreak = t.winStreak;
    car.rank = t.rank;
  }

  handleFx(f: FxEvent, now: number) {
    switch (f.kind) {
      case 'nitro': {
        const car = this.cars.get(f.teamId);
        if (!car) return;
        const pt = this.track.at(car.display);
        const big = f.tier === 'large' || f.tier === 'super';
        this.fx.burst(pt.x, pt.y, big ? 0xffb703 : 0xff9f1c, big ? 40 : 14, big ? 380 : 220);
        car.showFloat(`${f.nickname} +${f.diamonds}💎${f.golden ? ' ×2' : ''}`, f.golden ? 0xffd166 : 0xffffff);
        if (big) this.fx.kick(6);
        break;
      }
      case 'sabotage': {
        const car = this.cars.get(f.toTeamId);
        if (!car) return;
        const pt = this.track.at(car.display);
        this.fx.pothole(pt.x + Math.cos(pt.angle) * 20, pt.y + Math.sin(pt.angle) * 20, 4, now);
        for (let i = 0; i < 6; i++) this.fx.smoke(pt.x, pt.y);
        this.fx.burst(pt.x, pt.y, 0xff4d6d, 20, 240);
        this.fx.kick(10);
        break;
      }
      case 'storm':
        this.fx.storm(3, now);
        for (const id of f.hitTeamIds) {
          const car = this.cars.get(id);
          if (!car) continue;
          const pt = this.track.at(car.display);
          this.fx.burst(pt.x, pt.y, 0xb5179e, 18, 260);
        }
        break;
      case 'shieldGain': {
        const car = this.cars.get(f.teamId);
        if (!car) return;
        const pt = this.track.at(car.display);
        this.fx.burst(pt.x, pt.y, 0x4cc9f0, 22, 200);
        break;
      }
      case 'shieldBreak': {
        const car = this.cars.get(f.teamId);
        if (!car) return;
        const pt = this.track.at(car.display);
        this.fx.burst(pt.x, pt.y, 0x9ae8ff, 40, 330);
        this.fx.kick(5);
        break;
      }
      case 'likeBurst': {
        const car = this.cars.get(f.teamId);
        if (!car) return;
        const last = this.lastLikeFx.get(f.teamId) ?? 0;
        if (now - last < 250) return;
        this.lastLikeFx.set(f.teamId, now);
        const pt = this.track.at(car.display);
        this.fx.hearts(pt.x, pt.y - 10, f.relief ? 0xffffff : 0xff4d6d, 4);
        break;
      }
      case 'finish': {
        const car = this.cars.get(f.teamId);
        const pt = this.track.at(car?.display ?? 1);
        this.fx.confetti(pt.x, pt.y);
        this.fx.kick(8);
        break;
      }
      case 'phase':
        if (f.phase === 'podium' && this.snapshot?.lastResult) {
          const pt = this.track.at(this.cars.get(this.snapshot.lastResult.winnerTeamId)?.display ?? 0.5);
          this.fx.confetti(pt.x, pt.y);
        }
        break;
    }
  }

  private update(dt: number) {
    const now = Date.now() + (this.snapshot ? this.snapshot.t - this.lastSnapAt : 0);
    const racing = this.snapshot?.phase === 'racing' || this.snapshot?.phase === 'golden';
    const lobby = this.snapshot?.phase === 'lobby';
    for (const car of this.cars.values()) {
      // ngoại suy từ snapshot (10Hz) rồi làm mượt; lúc chờ thì xếp hàng ở vạch xuất phát
      const elapsed = racing ? Math.min(0.3, (Date.now() - this.lastSnapAt) / 1000) : 0;
      const target = lobby ? Math.max(0, car.rank - 1) * 0.012 : Math.min(1, car.target + car.speed * elapsed);
      const diff = target - car.display;
      car.display += Math.abs(diff) > 0.05 ? diff * Math.min(1, dt * 12) : diff * Math.min(1, dt * 6);
      const pt = this.track.at(car.display);
      const nx = -Math.sin(pt.angle), ny = Math.cos(pt.angle);
      car.view.position.set(pt.x + nx * car.lane, pt.y + ny * car.lane);
      car.body.rotation = pt.angle + car.wobble;
      car.update(dt, now);
      if (car.nitroUntil > now && racing) this.fx.flame(pt.x + nx * car.lane - Math.cos(pt.angle) * 26, pt.y + ny * car.lane - Math.sin(pt.angle) * 26, pt.angle, car.comboUntil > now ? 1.6 : 1);
      if (car.slowUntil > now && racing && Math.random() < 0.5) this.fx.smoke(pt.x + nx * car.lane, pt.y + ny * car.lane);
    }
    // xe đi trước vẽ sau để xe dẫn đầu luôn nổi lên trên
    const order = [...this.cars.values()].sort((a, b) => a.display - b.display);
    order.forEach((c, i) => this.carLayer.setChildIndex(c.view, i));
    const sh = this.fx.update(dt, now);
    this.world.position.set(sh.dx, sh.dy);
  }
}
