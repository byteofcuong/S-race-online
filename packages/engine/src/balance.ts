export interface TierRule {
  min: number;
  max?: number;
  boostSec: number;
  sabotageSec?: number;
  stormSec?: number;
  pushBack?: number;
}

export interface Balance {
  round: { lobbySec: number; raceSec: number; goldenSec: number; podiumSec: number };
  speed: { base: number; rubberBand: number[]; rubberBandMinTeams: number; rubberBandInGolden: boolean };
  display: { maxCars: number };
  like: { perLikes: number; boost: number; unassignedToLast: boolean };
  gift: {
    perDiamond: number;
    perDiamondAbove100: number;
    capPerGift: number;
    goldenMultiplier: number;
    tiers: { small: TierRule; medium: TierRule; large: TierRule; super: TierRule };
    combo: { windowSec: number; minGifts: number; bonus: number; activeSec: number };
  };
  slow: { baseFactor: number; boostFactor: number };
  shield: { followPct: number; sharePct: number; maxShields: number };
  team: { switchesPerRound: number; autoAssignUnmatched: boolean; newTeamJoinAtLast: boolean; finishEndsRound: boolean };
}

export const DEFAULT_BALANCE: Balance = {
  round: { lobbySec: 15, raceSec: 180, goldenSec: 45, podiumSec: 10 },
  speed: { base: 0.003, rubberBand: [0.15, 0.1, 0.05], rubberBandMinTeams: 3, rubberBandInGolden: false },
  display: { maxCars: 8 },
  like: { perLikes: 10, boost: 0.002, unassignedToLast: true },
  gift: {
    perDiamond: 0.0008,
    perDiamondAbove100: 0.0002,
    capPerGift: 0.3,
    goldenMultiplier: 2,
    tiers: {
      small: { min: 1, max: 9, boostSec: 3 },
      medium: { min: 10, max: 99, boostSec: 4 },
      large: { min: 100, max: 999, boostSec: 4, sabotageSec: 4, pushBack: 0.02 },
      super: { min: 1000, boostSec: 6, stormSec: 3, pushBack: 0.02 },
    },
    combo: { windowSec: 10, minGifts: 3, bonus: 0.25, activeSec: 10 },
  },
  slow: { baseFactor: 0, boostFactor: 0.5 },
  shield: { followPct: 100, sharePct: 25, maxShields: 1 },
  team: { switchesPerRound: 1, autoAssignUnmatched: true, newTeamJoinAtLast: true, finishEndsRound: true },
};

/** Gộp cấu hình đọc từ file với mặc định (file có thể thiếu trường). */
export function mergeBalance(partial: unknown): Balance {
  const p = (partial ?? {}) as Record<string, unknown>;
  const out: Balance = JSON.parse(JSON.stringify(DEFAULT_BALANCE));
  const deep = (dst: Record<string, unknown>, src: Record<string, unknown>) => {
    for (const k of Object.keys(src)) {
      if (k.startsWith('_')) continue;
      const sv = src[k];
      const dv = dst[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv) && dv && typeof dv === 'object' && !Array.isArray(dv)) {
        deep(dv as Record<string, unknown>, sv as Record<string, unknown>);
      } else if (sv !== undefined) {
        dst[k] = sv;
      }
    }
  };
  deep(out as unknown as Record<string, unknown>, p);
  return out;
}
