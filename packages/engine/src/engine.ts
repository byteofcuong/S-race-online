import type { Balance } from './balance.ts';
import type { ProvinceIndex } from './provinces.ts';
import type {
  FxEvent,
  GameEvent,
  GiftTier,
  Phase,
  RaceState,
  Snapshot,
  Team,
  TeamSnapshot,
  UserRec,
} from './types.ts';

const STREAK_TIMEOUT_MS = 30_000;

export class RaceEngine {
  state: RaceState;

  constructor(
    public readonly provinces: ProvinceIndex,
    public balance: Balance,
    now = 0,
  ) {
    this.state = {
      round: 1,
      phase: 'lobby',
      phaseStartedAt: now,
      phaseEndsAt: now + balance.round.lobbySec * 1000,
      now,
      teams: new Map(),
      users: new Map(),
      streaks: new Map(),
      viewers: 0,
      totalLikes: 0,
      totalDiamonds: 0,
      reliefLikes: 0,
      paused: false,
    };
  }

  // ───────────────────────── helpers ─────────────────────────

  get isRacing(): boolean {
    return this.state.phase === 'racing' || this.state.phase === 'golden';
  }

  /** Tất cả đội, xếp theo quãng đường giảm dần. */
  ranked(): Team[] {
    return [...this.state.teams.values()].sort((a, b) => b.progress - a.progress || b.diamondsRound - a.diamondsRound);
  }

  /** Các đội đang hiện trên đường (top N). */
  displayed(): Team[] {
    return this.ranked().slice(0, this.balance.display.maxCars);
  }

  private getUser(userId: string, nickname: string): UserRec {
    let u = this.state.users.get(userId);
    if (!u) {
      u = { nickname, switchesThisRound: 0, diamondsRound: 0, diamondsTotal: 0 };
      this.state.users.set(userId, u);
    } else if (nickname) {
      u.nickname = nickname;
    }
    return u;
  }

  private ensureTeam(id: string): Team {
    let t = this.state.teams.get(id);
    if (t) return t;
    this.provinces.get(id); // validate
    let progress = 0;
    if (this.balance.team.newTeamJoinAtLast && this.isRacing && this.state.teams.size > 0) {
      progress = Math.min(...[...this.state.teams.values()].map((x) => x.progress));
    }
    t = {
      id,
      progress,
      members: 0,
      likes: 0,
      likeAcc: 0,
      diamondsRound: 0,
      diamondsTotal: 0,
      giftsRound: 0,
      boosts: [],
      slowUntil: 0,
      shields: 0,
      shieldMeter: 0,
      comboTimes: [],
      comboUntil: 0,
      nitroUntil: 0,
      wins: 0,
      winStreak: 0,
      rank: this.state.teams.size + 1,
      speed: 0,
    };
    this.state.teams.set(id, t);
    return t;
  }

  /** Đội ít người nhất trong top hiển thị (để tự xếp người chưa chọn tỉnh). */
  private fewestMembersTeam(): Team | undefined {
    const d = this.displayed();
    if (d.length === 0) return undefined;
    return d.reduce((a, b) => (b.members < a.members ? b : a));
  }

  private lastDisplayedTeam(): Team | undefined {
    const d = this.displayed();
    return d[d.length - 1];
  }

  private assign(u: UserRec, teamId: string, fx: FxEvent[], opts: { viaOldName?: string; auto?: boolean; nickname: string }) {
    const switched = !!u.teamId;
    if (switched) {
      const old = this.state.teams.get(u.teamId!);
      if (old) old.members = Math.max(0, old.members - 1);
      u.switchesThisRound++;
    }
    const t = this.ensureTeam(teamId);
    t.members++;
    u.teamId = teamId;
    fx.push({ kind: 'join', teamId, nickname: opts.nickname, viaOldName: opts.viaOldName, auto: opts.auto, switched });
  }

  /** Lấy đội của user; nếu chưa có thì tự xếp (khi được phép). */
  private teamFor(u: UserRec, nickname: string, fx: FxEvent[]): Team | undefined {
    if (u.teamId) return this.state.teams.get(u.teamId);
    if (!this.balance.team.autoAssignUnmatched) return undefined;
    const t = this.fewestMembersTeam();
    if (!t) return undefined;
    this.assign(u, t.id, fx, { auto: true, nickname });
    return t;
  }

  tierOf(diamonds: number): GiftTier {
    const t = this.balance.gift.tiers;
    if (diamonds >= t.super.min) return 'super';
    if (diamonds >= t.large.min) return 'large';
    if (diamonds >= t.medium.min) return 'medium';
    return 'small';
  }

  /** Quãng đường cộng thêm cho một lượng kim cương (chưa nhân giờ vàng / combo). */
  giftProgress(diamonds: number): number {
    const g = this.balance.gift;
    const amount = diamonds <= 100 ? diamonds * g.perDiamond : 100 * g.perDiamond + (diamonds - 100) * g.perDiamondAbove100;
    return Math.min(g.capPerGift, amount);
  }

  private addBoost(team: Team, amount: number, durationSec: number, now: number): { golden: boolean; combo: boolean } {
    const golden = this.state.phase === 'golden';
    const combo = team.comboUntil > now;
    let a = amount;
    if (golden) a *= this.balance.gift.goldenMultiplier;
    if (combo) a *= 1 + this.balance.gift.combo.bonus;
    const rate = a / durationSec;
    if (this.isRacing) {
      const until = now + durationSec * 1000;
      team.boosts.push({ rate, until });
      team.nitroUntil = Math.max(team.nitroUntil, until);
    } else {
      team.boosts.push({ rate, until: 0, pendingSec: durationSec });
    }
    return { golden, combo };
  }

  // ───────────────────────── events ─────────────────────────

  applyEvent(ev: GameEvent, now: number): FxEvent[] {
    const fx: FxEvent[] = [];
    this.state.now = Math.max(this.state.now, now);
    switch (ev.type) {
      case 'viewers':
        this.state.viewers = ev.count;
        break;
      case 'join':
        this.getUser(ev.userId, ev.nickname);
        break;
      case 'comment':
        this.onComment(ev, now, fx);
        break;
      case 'like':
        this.onLike(ev, now, fx);
        break;
      case 'gift':
        this.onGift(ev, now, fx);
        break;
      case 'follow':
      case 'share':
        this.onSocial(ev, now, fx);
        break;
    }
    return fx;
  }

  private onComment(ev: Extract<GameEvent, { type: 'comment' }>, _now: number, fx: FxEvent[]) {
    const u = this.getUser(ev.userId, ev.nickname);
    const m = this.provinces.parse(ev.text);
    if (m) {
      if (u.teamId === m.provinceId) return;
      if (u.teamId && u.switchesThisRound >= this.balance.team.switchesPerRound) return;
      this.assign(u, m.provinceId, fx, { viaOldName: m.viaOldName, nickname: ev.nickname });
      return;
    }
    if (!u.teamId) this.teamFor(u, ev.nickname, fx);
  }

  private onLike(ev: Extract<GameEvent, { type: 'like' }>, _now: number, fx: FxEvent[]) {
    const u = this.getUser(ev.userId, ev.nickname);
    const count = Math.max(0, Math.floor(ev.count));
    if (count === 0) return;
    this.state.totalLikes += count;
    let team: Team | undefined;
    let relief = false;
    if (u.teamId) team = this.state.teams.get(u.teamId);
    else if (this.balance.like.unassignedToLast) {
      team = this.lastDisplayedTeam();
      relief = true;
      this.state.reliefLikes += count;
    }
    if (!team) return;
    team.likes += count;
    team.likeAcc += count;
    const n = Math.floor(team.likeAcc / this.balance.like.perLikes);
    if (n <= 0) return;
    team.likeAcc -= n * this.balance.like.perLikes;
    if (this.isRacing) team.progress += n * this.balance.like.boost;
    fx.push({ kind: 'likeBurst', teamId: team.id, count, relief });
  }

  private onGift(ev: Extract<GameEvent, { type: 'gift' }>, now: number, fx: FxEvent[]) {
    const u = this.getUser(ev.userId, ev.nickname);
    const team = this.teamFor(u, ev.nickname, fx);
    const key = `${ev.userId}:${ev.giftId}`;
    let s = this.state.streaks.get(key);
    if (!s) {
      s = { counted: 0, diamonds: ev.diamonds, nickname: ev.nickname, lastSeen: now };
      this.state.streaks.set(key, s);
    }
    const repeat = Math.max(1, Math.floor(ev.repeatCount || 1));
    const delta = Math.max(0, repeat - s.counted);
    s.counted = Math.max(s.counted, repeat);
    s.lastSeen = now;
    const diamondsDelta = delta * ev.diamonds;

    if (diamondsDelta > 0) {
      this.state.totalDiamonds += diamondsDelta;
      u.diamondsRound += diamondsDelta;
      u.diamondsTotal += diamondsDelta;
      if (team) {
        team.diamondsRound += diamondsDelta;
        team.diamondsTotal += diamondsDelta;
        if (!team.topGifter || u.diamondsRound > team.topGifter.diamonds) {
          team.topGifter = { nickname: ev.nickname, diamonds: u.diamondsRound };
        }
        const tier = this.tierOf(diamondsDelta);
        this.addBoost(team, this.giftProgress(diamondsDelta), this.balance.gift.tiers[tier].boostSec, now);
      }
    }

    if (ev.repeatEnd) {
      this.state.streaks.delete(key);
      if (team) this.finalizeGift(team, u, ev.nickname, s.counted * ev.diamonds, now, fx);
    }
  }

  /** Kết thúc một lượt quà: hiệu ứng theo bậc (nitro / phá / bão) + combo. */
  private finalizeGift(team: Team, _u: UserRec, nickname: string, totalDiamonds: number, now: number, fx: FxEvent[]) {
    if (totalDiamonds <= 0) return;
    team.giftsRound++;
    const g = this.balance.gift;
    const tier = this.tierOf(totalDiamonds);
    const golden = this.state.phase === 'golden';
    const combo = team.comboUntil > now;
    fx.push({ kind: 'nitro', teamId: team.id, nickname, tier, diamonds: totalDiamonds, golden, combo });

    // combo: nhiều quà cùng đội trong cửa sổ ngắn
    team.comboTimes = team.comboTimes.filter((t) => now - t <= g.combo.windowSec * 1000);
    team.comboTimes.push(now);
    if (team.comboTimes.length >= g.combo.minGifts && team.comboUntil <= now) {
      team.comboUntil = now + g.combo.activeSec * 1000;
      team.comboTimes = [];
      fx.push({ kind: 'combo', teamId: team.id });
    }

    if (!this.isRacing) return;

    if (tier === 'large') {
      const rule = g.tiers.large;
      const target = this.ranked().find((t) => t.id !== team.id);
      if (target) this.hit(target, team, nickname, rule.sabotageSec ?? 4, rule.pushBack ?? 0, now, fx, 'sabotage');
    } else if (tier === 'super') {
      const rule = g.tiers.super;
      const hitIds: string[] = [];
      for (const other of this.state.teams.values()) {
        if (other.id === team.id) continue;
        if (this.hit(other, team, nickname, rule.stormSec ?? 3, rule.pushBack ?? 0, now, fx, 'storm')) hitIds.push(other.id);
      }
      fx.push({ kind: 'storm', teamId: team.id, nickname, hitTeamIds: hitIds });
    }
  }

  /** Phá một đội; trả về true nếu trúng (không bị khiên đỡ). */
  private hit(
    target: Team,
    attacker: Team,
    nickname: string,
    slowSec: number,
    pushBack: number,
    now: number,
    fx: FxEvent[],
    mode: 'sabotage' | 'storm',
  ): boolean {
    if (target.shields > 0) {
      target.shields--;
      fx.push({ kind: 'shieldBreak', teamId: target.id, attackerTeamId: attacker.id });
      return false;
    }
    target.slowUntil = Math.max(target.slowUntil, now + slowSec * 1000);
    target.progress = Math.max(0, target.progress - pushBack);
    if (mode === 'sabotage') {
      fx.push({ kind: 'sabotage', fromTeamId: attacker.id, toTeamId: target.id, nickname });
      this.state.lastSabotage = { fromTeamId: attacker.id, toTeamId: target.id, at: now };
    }
    return true;
  }

  private onSocial(ev: Extract<GameEvent, { type: 'follow' | 'share' }>, _now: number, fx: FxEvent[]) {
    const u = this.getUser(ev.userId, ev.nickname);
    const team = this.teamFor(u, ev.nickname, fx);
    if (!team) return;
    const sh = this.balance.shield;
    if (team.shields >= sh.maxShields) return;
    team.shieldMeter += ev.type === 'follow' ? sh.followPct : sh.sharePct;
    while (team.shieldMeter >= 100 && team.shields < sh.maxShields) {
      team.shieldMeter -= 100;
      team.shields++;
      fx.push({ kind: 'shieldGain', teamId: team.id, nickname: ev.nickname, source: ev.type });
    }
    if (team.shields >= sh.maxShields) team.shieldMeter = 0;
  }

  // ───────────────────────── tick / phases ─────────────────────────

  tick(now: number): FxEvent[] {
    const fx: FxEvent[] = [];
    const dt = Math.min(0.5, Math.max(0, (now - this.state.now) / 1000));
    this.state.now = now;
    if (this.state.paused) {
      // giữ nguyên đồng hồ pha khi tạm dừng
      this.state.phaseEndsAt += dt * 1000;
      return fx;
    }

    // streak quà bị bỏ lửng (mất kết nối) → chốt luôn
    for (const [key, s] of this.state.streaks) {
      if (now - s.lastSeen > STREAK_TIMEOUT_MS) {
        this.state.streaks.delete(key);
        const [userId] = key.split(':');
        const u = this.state.users.get(userId);
        const team = u?.teamId ? this.state.teams.get(u.teamId) : undefined;
        if (team && u) this.finalizeGift(team, u, s.nickname, s.counted * s.diamonds, now, fx);
      }
    }

    let guard = 0;
    while (now >= this.state.phaseEndsAt && guard++ < 4) this.advancePhase(now, fx);

    if (this.isRacing && dt > 0) this.move(dt, now, fx);
    this.updateRanks(fx);
    return fx;
  }

  private move(dt: number, now: number, fx: FxEvent[]) {
    const b = this.balance;
    const displayed = this.displayed();
    const rbActive =
      (this.state.phase === 'racing' || b.speed.rubberBandInGolden) && displayed.length >= b.speed.rubberBandMinTeams;
    let finisher: Team | undefined;
    for (const team of this.state.teams.values()) {
      const slowed = team.slowUntil > now;
      let v = b.speed.base * (slowed ? b.slow.baseFactor : 1);
      if (rbActive) {
        const idx = displayed.indexOf(team);
        if (idx > 0) {
          // không bao giờ cộng cho đội đang dẫn đầu
          const fromLast = displayed.length - 1 - idx;
          if (fromLast < b.speed.rubberBand.length) v += b.speed.base * b.speed.rubberBand[fromLast];
        }
      }
      team.boosts = team.boosts.filter((e) => e.pendingSec !== undefined || e.until > now);
      for (const e of team.boosts) {
        if (e.pendingSec !== undefined) continue;
        v += e.rate * (slowed ? b.slow.boostFactor : 1);
      }
      team.speed = v;
      team.progress += v * dt;
      if (team.progress >= 1) {
        team.progress = 1;
        if (b.team.finishEndsRound && !finisher) finisher = team;
      }
    }
    if (finisher) {
      fx.push({ kind: 'finish', teamId: finisher.id });
      this.endRace(now, fx, true);
    }
  }

  private updateRanks(fx: FxEvent[]) {
    const ranked = this.ranked();
    ranked.forEach((t, i) => (t.rank = i + 1));
    const leader = ranked[0];
    if (leader && this.isRacing && this.state.leaderId && this.state.leaderId !== leader.id) {
      fx.push({ kind: 'overtake', teamId: leader.id, rank: 1 });
    }
    this.state.leaderId = leader?.id;
  }

  private setPhase(phase: Phase, now: number, durationSec: number, fx: FxEvent[]) {
    this.state.phase = phase;
    this.state.phaseStartedAt = now;
    this.state.phaseEndsAt = now + durationSec * 1000;
    fx.push({ kind: 'phase', phase, round: this.state.round });
  }

  private advancePhase(now: number, fx: FxEvent[]) {
    const r = this.balance.round;
    switch (this.state.phase) {
      case 'lobby':
        this.startRace(now, fx);
        break;
      case 'racing':
        this.setPhase('golden', now, r.goldenSec, fx);
        break;
      case 'golden':
        this.endRace(now, fx, false);
        break;
      case 'podium':
        this.newRound(now, fx);
        break;
    }
  }

  private startRace(now: number, fx: FxEvent[]) {
    for (const t of this.state.teams.values()) {
      for (const e of t.boosts) {
        if (e.pendingSec !== undefined) {
          e.until = now + e.pendingSec * 1000;
          t.nitroUntil = Math.max(t.nitroUntil, e.until);
          delete e.pendingSec;
        }
      }
    }
    this.state.leaderId = undefined;
    this.setPhase('racing', now, this.balance.round.raceSec, fx);
  }

  private endRace(now: number, fx: FxEvent[], finishedEarly: boolean) {
    const ranked = this.ranked();
    const winner = ranked[0];
    let mvp: { nickname: string; teamId: string; diamonds: number } | undefined;
    for (const u of this.state.users.values()) {
      if (u.teamId && u.diamondsRound > 0 && (!mvp || u.diamondsRound > mvp.diamonds)) {
        mvp = { nickname: u.nickname, teamId: u.teamId, diamonds: u.diamondsRound };
      }
    }
    if (winner) {
      for (const t of this.state.teams.values()) {
        if (t.id === winner.id) {
          t.wins++;
          t.winStreak++;
        } else t.winStreak = 0;
      }
    }
    this.state.lastResult = {
      round: this.state.round,
      winnerTeamId: winner?.id ?? '',
      podium: ranked.slice(0, 3).map((t) => ({ teamId: t.id, progress: t.progress })),
      mvp,
      finishedEarly,
    };
    this.setPhase('podium', now, this.balance.round.podiumSec, fx);
  }

  private newRound(now: number, fx: FxEvent[]) {
    this.state.round++;
    for (const t of this.state.teams.values()) {
      t.progress = 0;
      t.boosts = t.boosts.filter((e) => e.pendingSec !== undefined);
      t.slowUntil = 0;
      t.likeAcc = 0;
      t.diamondsRound = 0;
      t.giftsRound = 0;
      t.comboTimes = [];
      t.comboUntil = 0;
      t.nitroUntil = 0;
      t.speed = 0;
      t.topGifter = undefined;
    }
    for (const u of this.state.users.values()) {
      u.switchesThisRound = 0;
      u.diamondsRound = 0;
    }
    this.state.lastSabotage = undefined;
    this.state.leaderId = undefined;
    this.setPhase('lobby', now, this.balance.round.lobbySec, fx);
  }

  // ───────────────────────── admin ─────────────────────────

  /** Nhảy sang pha kế tiếp ngay. */
  skipPhase(now: number): FxEvent[] {
    const fx: FxEvent[] = [];
    this.state.now = now;
    this.advancePhase(now, fx);
    this.updateRanks(fx);
    return fx;
  }

  /** Huỷ ván hiện tại, về lobby của ván mới. */
  restartRound(now: number): FxEvent[] {
    const fx: FxEvent[] = [];
    this.state.now = now;
    this.newRound(now, fx);
    return fx;
  }

  setPaused(paused: boolean) {
    this.state.paused = paused;
  }

  /** Xoá hết đội/người (bắt đầu buổi live mới). */
  resetAll(now: number): FxEvent[] {
    this.state.teams.clear();
    this.state.users.clear();
    this.state.streaks.clear();
    this.state.round = 0;
    this.state.totalLikes = 0;
    this.state.totalDiamonds = 0;
    this.state.reliefLikes = 0;
    this.state.lastResult = undefined;
    return this.restartRound(now);
  }

  setBalance(b: Balance) {
    this.balance = b;
  }

  // ───────────────────────── snapshot ─────────────────────────

  snapshot(): Snapshot {
    const s = this.state;
    const teams: TeamSnapshot[] = this.ranked().map((t, i) => ({
      id: t.id,
      rank: i + 1,
      progress: t.progress,
      speed: t.speed,
      members: t.members,
      diamondsRound: t.diamondsRound,
      shields: t.shields,
      shieldMeter: t.shieldMeter,
      nitroUntil: t.nitroUntil,
      slowUntil: t.slowUntil,
      comboUntil: t.comboUntil,
      winStreak: t.winStreak,
      topGifter: t.topGifter,
    }));
    return {
      t: s.now,
      round: s.round,
      phase: s.phase,
      phaseStartedAt: s.phaseStartedAt,
      phaseEndsAt: s.phaseEndsAt,
      paused: s.paused,
      teams,
      teamCount: s.teams.size,
      viewers: s.viewers,
      totalLikes: s.totalLikes,
      totalDiamonds: s.totalDiamonds,
      lastResult: s.lastResult,
      lastSabotage: s.lastSabotage,
    };
  }
}
