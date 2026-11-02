import type { GameEvent, ProvincesFile } from '@srace/engine';
import type { EventHandler, EventSource, SourceStatus } from './types.ts';

export interface CrowdOptions {
  enabled: boolean;
  /** số người xem giả */
  users: number;
  /** 0.2 = yên, 1 = sôi động, 3 = bão quà */
  intensity: number;
}

interface FakeUser {
  id: string;
  nickname: string;
  province: string;
  joined: boolean;
  /** xác suất tặng quà mỗi giây (người "đại gia" cao hơn) */
  whale: number;
}

const NICKS = ['Minh', 'Lan', 'Hùng', 'Trang', 'Tuấn', 'Hương', 'Đức', 'Linh', 'Nam', 'Mai', 'Quang', 'Thảo', 'Long', 'Ngọc', 'Phúc', 'Vy', 'Khoa', 'Hà', 'Bảo', 'Nhi'];
const CHATTER = ['hay quá', 'cố lên', 'đua đi', 'ủng hộ', 'vô địch', 'ai đang dẫn vậy', '😂😂', 'phá nó đi', 'nhanh lên', 'yêu tỉnh mình'];
const GIFTS: { id: string; name: string; diamonds: number; streak: boolean; w: number }[] = [
  { id: '5655', name: 'Hoa hồng', diamonds: 1, streak: true, w: 60 },
  { id: '5827', name: 'Kem', diamonds: 1, streak: true, w: 10 },
  { id: '6064', name: 'Trái tim', diamonds: 5, streak: true, w: 10 },
  { id: '5269', name: 'Hoa hướng dương', diamonds: 10, streak: true, w: 8 },
  { id: '6247', name: 'Vương miện', diamonds: 29, streak: true, w: 5 },
  { id: '5487', name: 'Rượu', diamonds: 99, streak: false, w: 3 },
  { id: '5333', name: 'Tàu ngầm', diamonds: 199, streak: false, w: 2 },
  { id: '8978', name: 'Pháo hoa', diamonds: 499, streak: false, w: 1.2 },
  { id: '6089', name: 'Thiên hà', diamonds: 1000, streak: false, w: 0.5 },
  { id: '7934', name: 'Sư tử', diamonds: 2999, streak: false, w: 0.15 },
];

function pick<T extends { w: number }>(arr: T[]): T {
  const total = arr.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of arr) {
    r -= x.w;
    if (r <= 0) return x;
  }
  return arr[arr.length - 1];
}

/**
 * Nguồn giả lập: nhận sự kiện từ HTTP (control panel) và chế độ "đám đông" tự sinh.
 */
export class SimulatorSource implements EventSource {
  readonly name = 'simulator';
  private crowd: CrowdOptions = { enabled: false, users: 200, intensity: 1 };
  private users: FakeUser[] = [];
  private timer?: NodeJS.Timeout;
  private streaks = new Map<string, { gift: (typeof GIFTS)[number]; count: number; target: number }>();
  private provinceWeights: { id: string; w: number }[];

  constructor(
    provinces: ProvincesFile,
    private onEvent: EventHandler,
  ) {
    // tỉnh lớn đông người hơn, giống thực tế
    const big: Record<string, number> = { 'ha-noi': 12, 'ho-chi-minh': 14, 'nghe-an': 5, 'thanh-hoa': 4, 'hai-phong': 3, 'da-nang': 3, 'can-tho': 2, 'dong-nai': 2 };
    this.provinceWeights = provinces.provinces.map((p) => ({ id: p.id, w: big[p.id] ?? 1 }));
  }

  status(): SourceStatus {
    return {
      name: this.name,
      connected: true,
      detail: this.crowd.enabled ? `đám đông ${this.crowd.users} người, cường độ ${this.crowd.intensity}` : 'chờ lệnh từ control',
    };
  }

  async start() {
    this.timer = setInterval(() => this.step(), 250);
  }

  async stop() {
    clearInterval(this.timer);
  }

  /** Bắn một sự kiện tuỳ ý (từ control panel). */
  emit(ev: GameEvent) {
    this.onEvent(ev, this.name);
  }

  getCrowd() {
    return { ...this.crowd };
  }

  setCrowd(opts: Partial<CrowdOptions>) {
    this.crowd = { ...this.crowd, ...opts };
    this.crowd.users = Math.max(1, Math.min(5000, Math.floor(this.crowd.users)));
    this.crowd.intensity = Math.max(0, Math.min(10, this.crowd.intensity));
    while (this.users.length < this.crowd.users) {
      const i = this.users.length;
      this.users.push({
        id: `sim${i}`,
        nickname: `${NICKS[i % NICKS.length]}${i}`,
        province: pick(this.provinceWeights).id,
        joined: false,
        whale: Math.random() < 0.03 ? 0.08 : 0.004,
      });
    }
    this.users.length = this.crowd.users;
    if (this.crowd.enabled) this.onEvent({ type: 'viewers', count: this.crowd.users }, this.name);
  }

  private rand(): FakeUser {
    return this.users[Math.floor(Math.random() * this.users.length)];
  }

  /** Một bước 250ms của đám đông. */
  private step() {
    if (!this.crowd.enabled || this.users.length === 0) return;
    const k = this.crowd.intensity * 0.25; // tỉ lệ cho 250ms
    const n = this.users.length;

    // tim: ~ 8% người/giây thả 1–15 tim
    const likers = Math.round(n * 0.08 * k);
    for (let i = 0; i < likers; i++) {
      const u = this.rand();
      this.onEvent({ type: 'like', userId: u.id, nickname: u.nickname, count: 1 + Math.floor(Math.random() * 15) }, this.name);
    }

    // bình luận: ~1.5% người/giây; người mới thì gõ tên tỉnh, còn lại tán gẫu
    const chatters = Math.round(n * 0.015 * k) + (Math.random() < 0.3 * k ? 1 : 0);
    for (let i = 0; i < chatters; i++) {
      const u = this.rand();
      let text: string;
      if (!u.joined || Math.random() < 0.3) {
        u.joined = true;
        text = this.provinceName(u.province);
      } else text = CHATTER[Math.floor(Math.random() * CHATTER.length)];
      this.onEvent({ type: 'comment', userId: u.id, nickname: u.nickname, text }, this.name);
    }

    // follow / share
    if (Math.random() < 0.05 * k) {
      const u = this.rand();
      this.onEvent({ type: Math.random() < 0.4 ? 'follow' : 'share', userId: u.id, nickname: u.nickname }, this.name);
    }

    // quà: tiếp tục streak đang chạy
    for (const [key, s] of this.streaks) {
      const [userId] = key.split(':');
      const u = this.users.find((x) => x.id === userId)!;
      s.count = Math.min(s.target, s.count + 1 + Math.floor(Math.random() * 3));
      const end = s.count >= s.target;
      this.onEvent(
        { type: 'gift', userId: u.id, nickname: u.nickname, giftId: s.gift.id, giftName: s.gift.name, diamonds: s.gift.diamonds, repeatCount: s.count, repeatEnd: end },
        this.name,
      );
      if (end) this.streaks.delete(key);
    }
    // quà mới
    const tries = Math.max(1, Math.round(n * 0.02 * k));
    for (let i = 0; i < tries; i++) {
      const u = this.rand();
      if (Math.random() > u.whale * k) continue;
      const g = pick(GIFTS);
      if (g.streak) {
        const key = `${u.id}:${g.id}`;
        if (this.streaks.has(key)) continue;
        this.streaks.set(key, { gift: g, count: 0, target: 1 + Math.floor(Math.random() * (u.whale > 0.01 ? 99 : 20)) });
      } else {
        this.onEvent(
          { type: 'gift', userId: u.id, nickname: u.nickname, giftId: g.id, giftName: g.name, diamonds: g.diamonds, repeatCount: 1, repeatEnd: true },
          this.name,
        );
      }
    }
  }

  private provinceName(id: string): string {
    const p = this.provinceWeights.find((x) => x.id === id);
    return p ? id.replace(/-/g, ' ') : 'HN';
  }

  /** Kịch bản dựng sẵn để test hiệu ứng. */
  scenario(name: string): string {
    const ev = (e: GameEvent) => this.onEvent(e, this.name);
    switch (name) {
      case 'two-teams':
        ev({ type: 'comment', userId: 's-a', nickname: 'Fan Hà Nội', text: 'Hà Nội' });
        ev({ type: 'comment', userId: 's-b', nickname: 'Fan Sài Gòn', text: 'Sài Gòn' });
        ev({ type: 'comment', userId: 's-c', nickname: 'Fan Đà Nẵng', text: 'Đà Nẵng' });
        return 'Đã tạo 3 đội HN, SG, ĐN';
      case 'shield-vs-sabotage':
        ev({ type: 'comment', userId: 's-a', nickname: 'Fan Hà Nội', text: 'Hà Nội' });
        ev({ type: 'comment', userId: 's-b', nickname: 'Fan Sài Gòn', text: 'Sài Gòn' });
        ev({ type: 'follow', userId: 's-a', nickname: 'Fan Hà Nội' });
        ev({ type: 'gift', userId: 's-a', nickname: 'Fan Hà Nội', giftId: 'x', giftName: 'Pháo hoa', diamonds: 499, repeatCount: 1, repeatEnd: true });
        setTimeout(() => ev({ type: 'gift', userId: 's-b', nickname: 'Fan Sài Gòn', giftId: 'y', giftName: 'Tàu ngầm', diamonds: 199, repeatCount: 1, repeatEnd: true }), 2500);
        return 'HN có khiên, SG phá sau 2.5s → khiên vỡ';
      case 'storm':
        ev({ type: 'comment', userId: 's-a', nickname: 'Đại gia HN', text: 'HN' });
        ev({ type: 'comment', userId: 's-b', nickname: 'Fan SG', text: 'SG' });
        ev({ type: 'comment', userId: 's-c', nickname: 'Fan ĐN', text: 'ĐN' });
        ev({ type: 'gift', userId: 's-a', nickname: 'Đại gia HN', giftId: 'lion', giftName: 'Sư tử', diamonds: 2999, repeatCount: 1, repeatEnd: true });
        return 'Bão từ HN';
      case 'rose-streak': {
        ev({ type: 'comment', userId: 's-r', nickname: 'Mưa hoa', text: 'Nghệ An' });
        let c = 0;
        const t = setInterval(() => {
          c += 5;
          ev({ type: 'gift', userId: 's-r', nickname: 'Mưa hoa', giftId: '5655', giftName: 'Hoa hồng', diamonds: 1, repeatCount: c, repeatEnd: c >= 120 });
          if (c >= 120) clearInterval(t);
        }, 300);
        return 'Streak 120 hoa hồng cho Nghệ An';
      }
      default:
        return `Không có kịch bản "${name}"`;
    }
  }
}
