import type { Province, ProvincesFile } from './types.ts';

/** Bỏ dấu tiếng Việt, hạ chữ thường, bỏ ký tự lạ, gộp khoảng trắng. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type KeyKind = 'name' | 'alias' | 'code' | 'plate';

interface IndexEntry {
  key: string;
  provinceId: string;
  kind: KeyKind;
  /** tên tỉnh cũ (nếu alias là tên tỉnh đã sáp nhập) */
  viaOldName?: string;
  /** chỉ khớp khi là cả bình luận hoặc từ đầu tiên */
  tokenOnly: boolean;
}

export interface ProvinceMatch {
  provinceId: string;
  matched: string;
  viaOldName?: string;
}

export class ProvinceIndex {
  readonly byId = new Map<string, Province>();
  readonly list: Province[];
  private phrases: IndexEntry[] = []; // khớp bất kỳ đâu (whole-word)
  private tokens = new Map<string, IndexEntry>(); // khớp cả câu / từ đầu
  private plates = new Map<string, IndexEntry>(); // khớp cả câu

  constructor(file: ProvincesFile) {
    this.list = file.provinces;
    for (const p of file.provinces) {
      this.byId.set(p.id, p);
      const oldNames = p.merged.map((m) => normalize(m));
      const add = (raw: string, kind: KeyKind) => {
        const key = normalize(raw);
        if (!key) return;
        const viaOldName = oldNames.includes(key) ? p.merged[oldNames.indexOf(key)] : undefined;
        // alias là tên cũ nhưng không có dấu, ví dụ "hai duong" → tìm theo chuỗi normalize
        const via = viaOldName ?? this.findOldName(p, key);
        const tokenOnly = kind === 'code' || (!key.includes(' ') && key.length <= 4);
        const entry: IndexEntry = { key, provinceId: p.id, kind, viaOldName: via, tokenOnly };
        if (kind === 'plate') this.plates.set(key, entry);
        else if (tokenOnly) {
          if (!this.tokens.has(key)) this.tokens.set(key, entry);
        } else this.phrases.push(entry);
      };
      add(p.name, 'name');
      add(p.short, 'name');
      add(p.code, 'code');
      for (const a of p.aliases) add(a, 'alias');
      for (const pl of p.plates) add(pl, 'plate');
    }
    // cụm dài ưu tiên trước để "ho chi minh" thắng "chi minh"
    this.phrases.sort((a, b) => b.key.length - a.key.length);
  }

  private findOldName(p: Province, key: string): string | undefined {
    for (const m of p.merged) {
      const nm = normalize(m);
      if (nm === key) return m;
      // alias viết tắt của tỉnh cũ: không suy ra được, bỏ qua
    }
    return undefined;
  }

  /** Nhận diện tỉnh trong một bình luận. Trả null nếu không khớp. */
  parse(text: string): ProvinceMatch | null {
    const norm = normalize(text);
    if (!norm) return null;
    const words = norm.split(' ');

    // 1. Biển số: chỉ khi cả bình luận là con số
    const plate = this.plates.get(norm);
    if (plate) return { provinceId: plate.provinceId, matched: norm, viaOldName: plate.viaOldName };

    // 2. Cụm tên (≥5 ký tự hoặc nhiều từ): khớp whole-word ở bất kỳ đâu
    const padded = ` ${norm} `;
    for (const e of this.phrases) {
      if (padded.includes(` ${e.key} `)) {
        return { provinceId: e.provinceId, matched: e.key, viaOldName: e.viaOldName };
      }
    }

    // 3. Mã / alias ngắn: cả bình luận hoặc từ đầu tiên
    const first = words[0];
    const tok = this.tokens.get(norm) ?? this.tokens.get(first);
    if (tok) return { provinceId: tok.provinceId, matched: tok.key, viaOldName: tok.viaOldName };

    return null;
  }

  get(id: string): Province {
    const p = this.byId.get(id);
    if (!p) throw new Error(`Unknown province ${id}`);
    return p;
  }
}
