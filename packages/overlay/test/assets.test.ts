import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import type { ProvincesFile } from '@srace/engine';

const provinces = JSON.parse(readFileSync(new URL('../../../config/provinces.json', import.meta.url), 'utf8')) as ProvincesFile;
const map = JSON.parse(readFileSync(new URL('../src/assets/vietnam.json', import.meta.url), 'utf8')) as {
  width: number;
  height: number;
  provinces: Record<string, { paths: string[] }>;
  old: Record<string, { newId: string; cx: number; cy: number }>;
};
const iconDir = new URL('../src/assets/icons/', import.meta.url);

describe('vietnam.json', () => {
  it('có đúng 34 tỉnh mới, id khớp config/provinces.json', () => {
    const ids = new Set(provinces.provinces.map((p) => p.id));
    expect(Object.keys(map.provinces)).toHaveLength(34);
    for (const id of Object.keys(map.provinces)) expect(ids.has(id), id).toBe(true);
    for (const id of ids) expect(map.provinces[id], id).toBeTruthy();
  });
  it('gồm 65 path cũ (63 tỉnh + Hoàng Sa + Trường Sa), toạ độ tuyệt đối', () => {
    expect(Object.keys(map.old)).toHaveLength(65);
    expect(map.old.hoangsa.newId).toBe('da-nang');
    expect(map.old.truongsa.newId).toBe('khanh-hoa');
    for (const p of Object.values(map.provinces)) for (const d of p.paths) expect(d).toMatch(/^M[\d. ]+( [MLCZ][\d. ]*)*$/);
  });
});

describe('xe và icon', () => {
  it('có xe vẽ sẵn top-down thang xám (fallback khi chưa nhập bộ xe)', () => {
    const svg = readFileSync(new URL('../src/assets/vehicles/car-topdown.svg', import.meta.url), 'utf8');
    expect(svg).toContain('viewBox="0 0 72 132"');
    // chỉ dùng màu xám để tint ra đúng màu đội (bỏ qua màu đèn pha vàng nhạt)
    const colors = [...svg.matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()).filter((c) => c !== 'fffbe6');
    // gần trung tính (lệch kênh ≤ 24) hoặc đủ tối (kính, lốp) – tint không làm chúng đổi màu rõ
    for (const c of colors) {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
      const neutral = Math.max(r, g, b) - Math.min(r, g, b) <= 24;
      const dark = 0.3 * r + 0.59 * g + 0.11 * b < 80;
      expect(neutral || dark, c).toBe(true);
    }
  });
  it('manifest mặc định hợp lệ, chưa gắn bộ xe ngoài', () => {
    const m = JSON.parse(readFileSync(new URL('../public/assets/manifest.json', import.meta.url), 'utf8'));
    expect(m.vehiclePack ?? null).toBeNull();
  });
  it('icon HUD cần thiết có mặt', () => {
    for (const n of ['fire', 'collision', 'shield', 'tornado', 'crown', 'gem-stone', 'trophy', 'chequered-flag', 'red-heart', 'party-popper', 'speech-balloon', 'rocket', 'bomb', 'high-voltage', 'rose', 'eyes', 'busts-in-silhouette']) {
      expect(existsSync(new URL(`${n}.svg`, iconDir)), n).toBe(true);
    }
  });
});
