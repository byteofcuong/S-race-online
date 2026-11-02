/** Kiểu dữ liệu dùng chung cho engine, server và overlay. */

export type Phase = 'lobby' | 'racing' | 'golden' | 'podium';

export type GiftTier = 'small' | 'medium' | 'large' | 'super';

export interface Province {
  id: string;
  name: string;
  short: string;
  code: string;
  region: string;
  color: string;
  lat: number;
  aliases: string[];
  plates: string[];
  merged: string[];
}

export interface Region {
  name: string;
}

export interface ProvincesFile {
  regions: Record<string, Region>;
  provinces: Province[];
}

/** Sự kiện chuẩn hoá từ TikTok hoặc simulator. */
export type GameEvent =
  | { type: 'comment'; userId: string; nickname: string; text: string }
  | { type: 'like'; userId: string; nickname: string; count: number }
  | {
      type: 'gift';
      userId: string;
      nickname: string;
      giftId: string;
      giftName: string;
      /** kim cương (coin) cho MỘT đơn vị quà */
      diamonds: number;
      /** số lần lặp trong streak (>=1) */
      repeatCount: number;
      /** true khi streak kết thúc (hoặc quà không streak) */
      repeatEnd: boolean;
    }
  | { type: 'follow'; userId: string; nickname: string }
  | { type: 'share'; userId: string; nickname: string }
  | { type: 'join'; userId: string; nickname: string }
  | { type: 'viewers'; count: number };

/** Hiệu ứng tức thời engine phát ra cho overlay. */
export type FxEvent =
  | { kind: 'phase'; phase: Phase; round: number }
  | { kind: 'join'; teamId: string; nickname: string; viaOldName?: string; auto?: boolean; switched?: boolean }
  | { kind: 'nitro'; teamId: string; nickname: string; tier: GiftTier; diamonds: number; golden: boolean; combo: boolean }
  | { kind: 'sabotage'; fromTeamId: string; toTeamId: string; nickname: string }
  | { kind: 'storm'; teamId: string; nickname: string; hitTeamIds: string[] }
  | { kind: 'shieldGain'; teamId: string; nickname: string; source: 'follow' | 'share' }
  | { kind: 'shieldBreak'; teamId: string; attackerTeamId: string }
  | { kind: 'combo'; teamId: string }
  | { kind: 'likeBurst'; teamId: string; count: number; relief?: boolean }
  | { kind: 'finish'; teamId: string }
  | { kind: 'overtake'; teamId: string; rank: number };

export interface BoostEffect {
  /** progress/giây */
  rate: number;
  until: number;
  /** quà tặng ngoài lúc đua: giữ lại, áp dụng khi ván mới xuất phát */
  pendingSec?: number;
}

export interface Team {
  id: string; // province id
  progress: number;
  members: number;
  likes: number;
  likeAcc: number;
  diamondsRound: number;
  diamondsTotal: number;
  giftsRound: number;
  boosts: BoostEffect[];
  slowUntil: number;
  shields: number;
  shieldMeter: number; // 0..100
  comboTimes: number[];
  comboUntil: number;
  nitroUntil: number;
  wins: number;
  winStreak: number;
  /** thứ hạng ở lần tính gần nhất (1-based) */
  rank: number;
  /** tốc độ hiện tại (progress/giây) để overlay nội suy */
  speed: number;
  topGifter?: { nickname: string; diamonds: number };
}

export interface UserRec {
  teamId?: string;
  nickname: string;
  switchesThisRound: number;
  diamondsRound: number;
  diamondsTotal: number;
}

export interface RoundResult {
  round: number;
  winnerTeamId: string;
  podium: { teamId: string; progress: number }[];
  mvp?: { nickname: string; teamId: string; diamonds: number };
  finishedEarly: boolean;
}

export interface RaceState {
  round: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  now: number;
  teams: Map<string, Team>;
  users: Map<string, UserRec>;
  /** streak quà đang chạy: key `${userId}:${giftId}` → repeatCount đã tính */
  streaks: Map<string, { counted: number; diamonds: number; nickname: string; lastSeen: number }>;
  lastResult?: RoundResult;
  viewers: number;
  totalLikes: number;
  totalDiamonds: number;
  reliefLikes: number;
  paused: boolean;
  leaderId?: string;
  lastSabotage?: { fromTeamId: string; toTeamId: string; at: number };
}

/** Bản chụp gửi overlay (JSON-friendly). */
export interface TeamSnapshot {
  id: string;
  rank: number;
  progress: number;
  speed: number;
  members: number;
  diamondsRound: number;
  shields: number;
  shieldMeter: number;
  nitroUntil: number;
  slowUntil: number;
  comboUntil: number;
  winStreak: number;
  topGifter?: { nickname: string; diamonds: number };
}

export interface Snapshot {
  t: number;
  round: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  paused: boolean;
  teams: TeamSnapshot[];
  teamCount: number;
  viewers: number;
  totalLikes: number;
  totalDiamonds: number;
  lastResult?: RoundResult;
  lastSabotage?: { fromTeamId: string; toTeamId: string; at: number };
}
