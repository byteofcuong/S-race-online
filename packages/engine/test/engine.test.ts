import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ProvinceIndex } from '../src/provinces.ts';
import { RaceEngine } from '../src/engine.ts';
import { DEFAULT_BALANCE, mergeBalance, type Balance } from '../src/balance.ts';
import type { FxEvent, ProvincesFile } from '../src/types.ts';

const file = JSON.parse(readFileSync(new URL('../../../config/provinces.json', import.meta.url), 'utf8')) as ProvincesFile;
const idx = new ProvinceIndex(file);
const balanceFile = JSON.parse(readFileSync(new URL('../../../config/balance.json', import.meta.url), 'utf8'));

let eng: RaceEngine;
let now: number;
const sec = (n: number) => n * 1000;
const BASE = DEFAULT_BALANCE.speed.base;

function fresh(b: Balance = DEFAULT_BALANCE) {
  now = 0;
  eng = new RaceEngine(idx, JSON.parse(JSON.stringify(b)), now);
}
/** Tua thời gian từng bước 100ms để tick hoạt động giống server. */
function advance(ms: number): FxEvent[] {
  const out: FxEvent[] = [];
  const end = now + ms;
  while (now < end) {
    now = Math.min(end, now + 100);
    out.push(...eng.tick(now));
  }
  return out;
}
function startRacing() {
  advance(sec(DEFAULT_BALANCE.round.lobbySec) + 1);
  expect(eng.state.phase).toBe('racing');
}
const comment = (userId: string, text: string) => eng.applyEvent({ type: 'comment', userId, nickname: userId, text }, now);
const like = (userId: string, count: number) => eng.applyEvent({ type: 'like', userId, nickname: userId, count }, now);
const gift = (userId: string, diamonds: number, opts: Partial<{ repeatCount: number; repeatEnd: boolean; giftId: string }> = {}) =>
  eng.applyEvent(
    {
      type: 'gift',
      userId,
      nickname: userId,
      giftId: opts.giftId ?? 'g1',
      giftName: 'Test',
      diamonds,
      repeatCount: opts.repeatCount ?? 1,
      repeatEnd: opts.repeatEnd ?? true,
    },
    now,
  );
const team = (id: string) => eng.state.teams.get(id)!;

describe('balance.json', () => {
  it('đọc được và gộp với mặc định', () => {
    const b = mergeBalance(balanceFile);
    expect(b.round.raceSec).toBe(180);
    expect(b.gift.tiers.super.min).toBe(1000);
    expect((b as unknown as Record<string, unknown>)._note).toBeUndefined();
  });
});

describe('vòng đời ván', () => {
  beforeEach(() => fresh());

  it('lobby → racing → golden → podium → lobby (ván +1)', () => {
    expect(eng.state.phase).toBe('lobby');
    const fx1 = advance(sec(15) + 1);
    expect(eng.state.phase).toBe('racing');
    expect(fx1.some((f) => f.kind === 'phase' && f.phase === 'racing')).toBe(true);
    advance(sec(180));
    expect(eng.state.phase).toBe('golden');
    advance(sec(45));
    expect(eng.state.phase).toBe('podium');
    advance(sec(10));
    expect(eng.state.phase).toBe('lobby');
    expect(eng.state.round).toBe(2);
  });

  it('tạm dừng thì đồng hồ không chạy', () => {
    eng.setPaused(true);
    advance(sec(60));
    expect(eng.state.phase).toBe('lobby');
    eng.setPaused(false);
    advance(sec(16));
    expect(eng.state.phase).toBe('racing');
  });

  it('skipPhase nhảy pha ngay', () => {
    eng.skipPhase(now);
    expect(eng.state.phase).toBe('racing');
  });
});

describe('vào đội', () => {
  beforeEach(() => fresh());

  it('bình luận tên tỉnh tạo đội và cộng thành viên', () => {
    const fx = comment('u1', 'Hà Nội');
    expect(team('ha-noi').members).toBe(1);
    expect(fx[0]).toMatchObject({ kind: 'join', teamId: 'ha-noi' });
  });

  it('tỉnh cũ báo viaOldName', () => {
    const fx = comment('u1', 'Hải Dương');
    expect(fx[0]).toMatchObject({ kind: 'join', teamId: 'hai-phong', viaOldName: 'Hải Dương' });
  });

  it('chỉ đổi đội 1 lần mỗi ván, sang ván mới được đổi lại', () => {
    comment('u1', 'HN');
    comment('u1', 'SG');
    expect(eng.state.users.get('u1')!.teamId).toBe('ho-chi-minh');
    comment('u1', 'ĐN');
    expect(eng.state.users.get('u1')!.teamId).toBe('ho-chi-minh');
    expect(team('ha-noi').members).toBe(0);
    expect(team('ho-chi-minh').members).toBe(1);
    // qua ván mới
    eng.restartRound(now);
    comment('u1', 'ĐN');
    expect(eng.state.users.get('u1')!.teamId).toBe('da-nang');
  });

  it('bình luận không khớp → tự xếp vào đội ít người nhất', () => {
    comment('u1', 'HN');
    comment('u2', 'HN');
    comment('u3', 'SG');
    const fx = comment('u4', 'chào mọi người');
    expect(fx[0]).toMatchObject({ kind: 'join', teamId: 'ho-chi-minh', auto: true });
  });

  it('không có đội nào thì bình luận lạ không làm gì', () => {
    expect(comment('u1', 'hello')).toEqual([]);
    expect(eng.state.teams.size).toBe(0);
  });

  it('đội mới giữa ván xuất phát ở vị trí đội chót', () => {
    comment('u1', 'HN');
    startRacing();
    advance(sec(30));
    const hn = team('ha-noi').progress;
    expect(hn).toBeGreaterThan(0);
    comment('u2', 'SG');
    expect(team('ho-chi-minh').progress).toBeCloseTo(hn, 6);
  });
});

describe('tim', () => {
  beforeEach(() => {
    fresh();
    comment('u1', 'HN');
    comment('u2', 'SG');
    startRacing();
  });

  it('mỗi 10 tim của đội cộng 0.002 quãng đường', () => {
    const before = team('ha-noi').progress;
    const fx = like('u1', 25);
    expect(team('ha-noi').progress - before).toBeCloseTo(0.004, 9);
    expect(team('ha-noi').likeAcc).toBe(5);
    expect(fx[0]).toMatchObject({ kind: 'likeBurst', teamId: 'ha-noi', relief: false });
  });

  it('tim của người chưa có đội dồn cho đội chót', () => {
    advance(sec(5));
    team('ha-noi').progress = 0.5; // HN dẫn đầu
    eng.tick(now);
    const before = team('ho-chi-minh').progress;
    const fx = like('stranger', 10);
    expect(team('ho-chi-minh').progress - before).toBeCloseTo(0.002, 9);
    expect(fx[0]).toMatchObject({ kind: 'likeBurst', teamId: 'ho-chi-minh', relief: true });
    expect(eng.state.users.get('stranger')!.teamId).toBeUndefined();
  });
});

describe('quà', () => {
  beforeEach(() => {
    fresh();
    comment('u1', 'HN');
    comment('u2', 'SG');
    comment('u3', 'ĐN');
    startRacing();
  });

  it('phân bậc theo kim cương', () => {
    expect(eng.tierOf(1)).toBe('small');
    expect(eng.tierOf(9)).toBe('small');
    expect(eng.tierOf(10)).toBe('medium');
    expect(eng.tierOf(99)).toBe('medium');
    expect(eng.tierOf(100)).toBe('large');
    expect(eng.tierOf(999)).toBe('large');
    expect(eng.tierOf(1000)).toBe('super');
  });

  it('quãng đường theo kim cương: tuyến tính tới 100, giảm dần sau đó, có trần', () => {
    expect(eng.giftProgress(1)).toBeCloseTo(0.0008, 9);
    expect(eng.giftProgress(100)).toBeCloseTo(0.08, 9);
    expect(eng.giftProgress(1000)).toBeCloseTo(0.26, 9);
    expect(eng.giftProgress(100000)).toBe(0.3);
  });

  it('quà nhỏ tạo nitro, cộng quãng đường dần trong vài giây', () => {
    const before = team('ha-noi').progress;
    const fx = gift('u1', 5);
    expect(fx.find((f) => f.kind === 'nitro')).toMatchObject({ teamId: 'ha-noi', tier: 'small', diamonds: 5 });
    advance(sec(3) + 100);
    const gained = team('ha-noi').progress - before;
    // base*3.1s + quà 0.004
    expect(gained).toBeGreaterThan(BASE * 3.1 + 0.004 - 0.0005);
    expect(gained).toBeLessThan(BASE * 3.1 + 0.004 + 0.0015);
  });

  it('streak: chỉ tính phần chênh repeatCount, chốt bậc theo tổng khi repeatEnd', () => {
    gift('u1', 1, { repeatCount: 3, repeatEnd: false, giftId: 'rose' });
    gift('u1', 1, { repeatCount: 7, repeatEnd: false, giftId: 'rose' });
    expect(team('ha-noi').diamondsRound).toBe(7);
    // lặp lại cùng repeatCount không đếm trùng
    gift('u1', 1, { repeatCount: 7, repeatEnd: false, giftId: 'rose' });
    expect(team('ha-noi').diamondsRound).toBe(7);
    const fx = gift('u1', 1, { repeatCount: 120, repeatEnd: true, giftId: 'rose' });
    expect(team('ha-noi').diamondsRound).toBe(120);
    expect(fx.find((f) => f.kind === 'nitro')).toMatchObject({ tier: 'large', diamonds: 120 });
    expect(fx.find((f) => f.kind === 'sabotage')).toBeTruthy();
    expect(eng.state.streaks.size).toBe(0);
  });

  it('quà lớn phá đội cao nhất không phải đội mình, bị đẩy lùi và chậm lại', () => {
    team('ho-chi-minh').progress = 0.5;
    team('ha-noi').progress = 0.4;
    eng.tick(now);
    const fx = gift('u3', 150); // Đà Nẵng tặng
    const sab = fx.find((f) => f.kind === 'sabotage');
    expect(sab).toMatchObject({ fromTeamId: 'da-nang', toTeamId: 'ho-chi-minh' });
    expect(team('ho-chi-minh').progress).toBeCloseTo(0.48, 9);
    expect(team('ho-chi-minh').slowUntil).toBe(now + 4000);
    const before = team('ho-chi-minh').progress;
    advance(sec(2));
    expect(team('ho-chi-minh').progress).toBeCloseTo(before, 9); // đứng im khi bị phá
    advance(sec(3));
    expect(team('ho-chi-minh').progress).toBeGreaterThan(before);
  });

  it('đội dẫn đầu tặng quà lớn thì phá đội nhì chứ không phá chính mình', () => {
    team('ha-noi').progress = 0.6;
    team('ho-chi-minh').progress = 0.5;
    eng.tick(now);
    const fx = gift('u1', 200);
    expect(fx.find((f) => f.kind === 'sabotage')).toMatchObject({ fromTeamId: 'ha-noi', toTeamId: 'ho-chi-minh' });
  });

  it('khiên đỡ một lần phá rồi vỡ', () => {
    eng.applyEvent({ type: 'follow', userId: 'u2', nickname: 'u2' }, now);
    expect(team('ho-chi-minh').shields).toBe(1);
    team('ho-chi-minh').progress = 0.5;
    eng.tick(now);
    const fx = gift('u1', 150);
    expect(fx.find((f) => f.kind === 'shieldBreak')).toMatchObject({ teamId: 'ho-chi-minh' });
    expect(fx.find((f) => f.kind === 'sabotage')).toBeUndefined();
    expect(team('ho-chi-minh').progress).toBe(0.5);
    expect(team('ho-chi-minh').shields).toBe(0);
  });

  it('share tích 25% khiên, 4 share = 1 khiên, không quá 1 khiên', () => {
    for (let i = 0; i < 3; i++) eng.applyEvent({ type: 'share', userId: 'u2', nickname: 'u2' }, now);
    expect(team('ho-chi-minh').shields).toBe(0);
    expect(team('ho-chi-minh').shieldMeter).toBe(75);
    const fx = eng.applyEvent({ type: 'share', userId: 'u2', nickname: 'u2' }, now);
    expect(fx.find((f) => f.kind === 'shieldGain')).toBeTruthy();
    expect(team('ho-chi-minh').shields).toBe(1);
    eng.applyEvent({ type: 'follow', userId: 'u2', nickname: 'u2' }, now);
    expect(team('ho-chi-minh').shields).toBe(1);
  });

  it('quà siêu: bão phá tất cả đội khác', () => {
    const fx = gift('u1', 1000);
    const storm = fx.find((f) => f.kind === 'storm');
    expect(storm).toMatchObject({ teamId: 'ha-noi' });
    expect((storm as Extract<FxEvent, { kind: 'storm' }>).hitTeamIds.sort()).toEqual(['da-nang', 'ho-chi-minh']);
    expect(team('ho-chi-minh').slowUntil).toBe(now + 3000);
  });

  it('giờ vàng nhân đôi quà, không nhân tim', () => {
    advance(sec(180));
    expect(eng.state.phase).toBe('golden');
    const t = team('ha-noi');
    gift('u1', 10); // 0.008 → ×2 = 0.016 trong 4s
    const rate = t.boosts[0].rate;
    expect(rate * 4).toBeCloseTo(0.016, 9);
    const before = t.progress;
    like('u1', 10);
    expect(t.progress - before).toBeCloseTo(0.002, 9);
  });

  it('combo: 3 quà trong 10 giây → quà sau được +25%', () => {
    gift('u1', 1, { giftId: 'a' });
    gift('u1', 1, { giftId: 'b' });
    const fx = gift('u1', 1, { giftId: 'c' });
    expect(fx.find((f) => f.kind === 'combo')).toMatchObject({ teamId: 'ha-noi' });
    const t = team('ha-noi');
    gift('u1', 10, { giftId: 'd' });
    const last = t.boosts[t.boosts.length - 1];
    expect(last.rate * 4).toBeCloseTo(0.008 * 1.25, 9);
  });

  it('MVP ván và người tặng nhiều nhất của đội', () => {
    gift('u1', 50);
    gift('u2', 20);
    expect(team('ha-noi').topGifter).toEqual({ nickname: 'u1', diamonds: 50 });
    eng.skipPhase(now); // → golden
    eng.skipPhase(now); // → podium
    expect(eng.state.lastResult?.mvp).toEqual({ nickname: 'u1', teamId: 'ha-noi', diamonds: 50 });
  });

  it('quà tặng lúc podium được giữ lại và áp dụng khi ván mới xuất phát', () => {
    eng.skipPhase(now);
    eng.skipPhase(now);
    expect(eng.state.phase).toBe('podium');
    gift('u1', 10);
    expect(team('ha-noi').boosts[0].pendingSec).toBe(4);
    advance(sec(10) + 100); // → lobby
    expect(eng.state.phase).toBe('lobby');
    expect(team('ha-noi').boosts).toHaveLength(1);
    advance(sec(15) + 100); // → racing
    expect(team('ha-noi').boosts[0].pendingSec).toBeUndefined();
    advance(sec(4));
    expect(team('ha-noi').progress).toBeGreaterThan(BASE * 4);
  });
});

describe('bám đuổi & kết ván', () => {
  it('với 3 đội: đội dẫn đầu không được bám đuổi', () => {
    fresh();
    comment('a', 'HN');
    comment('b', 'SG');
    comment('c', 'ĐN');
    startRacing();
    team('ha-noi').progress = 0.5;
    team('ho-chi-minh').progress = 0.4;
    eng.tick(now);
    advance(100);
    expect(team('ha-noi').speed).toBeCloseTo(BASE, 9);
    expect(team('ho-chi-minh').speed).toBeCloseTo(BASE * 1.1, 9);
    expect(team('da-nang').speed).toBeCloseTo(BASE * 1.15, 9);
  });

  it('3 đội cuối trong top 8 được +15/10/5%, tắt trong giờ vàng', () => {
    fresh();
    const ids = ['HN', 'SG', 'ĐN', 'HP', 'CT', 'Huế', 'Nghệ An', 'Cà Mau'];
    ids.forEach((c, i) => comment(`u${i}`, c));
    startRacing();
    const ranked = eng.ranked();
    ranked.forEach((t, i) => (t.progress = 0.3 - i * 0.03));
    eng.tick(now);
    advance(100);
    const r = eng.ranked();
    expect(r[7].speed).toBeCloseTo(BASE * 1.15, 9);
    expect(r[6].speed).toBeCloseTo(BASE * 1.1, 9);
    expect(r[5].speed).toBeCloseTo(BASE * 1.05, 9);
    expect(r[0].speed).toBeCloseTo(BASE, 9);
    advance(sec(180));
    expect(eng.state.phase).toBe('golden');
    advance(100);
    expect(eng.ranked()[7].speed).toBeCloseTo(BASE, 9);
  });

  it('đội về đích (progress = 1) kết thúc ván ngay', () => {
    fresh();
    comment('u1', 'HN');
    comment('u2', 'SG');
    startRacing();
    team('ha-noi').progress = 0.999;
    const fx = advance(sec(2));
    expect(fx.find((f) => f.kind === 'finish')).toMatchObject({ teamId: 'ha-noi' });
    expect(eng.state.phase).toBe('podium');
    expect(eng.state.lastResult).toMatchObject({ winnerTeamId: 'ha-noi', finishedEarly: true });
  });

  it('thắng liên tiếp tăng winStreak, thua về 0', () => {
    fresh();
    comment('u1', 'HN');
    comment('u2', 'SG');
    startRacing();
    team('ha-noi').progress = 0.5;
    eng.skipPhase(now);
    eng.skipPhase(now);
    expect(team('ha-noi').winStreak).toBe(1);
    advance(sec(10) + 100);
    advance(sec(15) + 100);
    team('ho-chi-minh').progress = 0.5;
    eng.skipPhase(now);
    eng.skipPhase(now);
    expect(team('ho-chi-minh').winStreak).toBe(1);
    expect(team('ha-noi').winStreak).toBe(0);
    expect(team('ha-noi').wins).toBe(1);
  });

  it('snapshot có đủ đội theo thứ hạng', () => {
    fresh();
    comment('u1', 'HN');
    comment('u2', 'SG');
    team('ho-chi-minh').progress = 0.3;
    eng.tick(now);
    const s = eng.snapshot();
    expect(s.teams[0]).toMatchObject({ id: 'ho-chi-minh', rank: 1 });
    expect(s.teamCount).toBe(2);
    expect(JSON.parse(JSON.stringify(s))).toBeTruthy();
  });
});
