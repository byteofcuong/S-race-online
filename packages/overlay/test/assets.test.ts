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

describe('icon phương tiện', () => {
  it('mọi vùng và tỉnh ghi đè đều có file SVG', () => {
    const names = new Set(Object.values(provinces.regions).map((r) => r.vehicle));
    for (const p of provinces.provinces) if (p.vehicle) names.add(p.vehicle);
    for (const n of names) expect(existsSync(new URL(`${n}.svg`, iconDir)), n).toBe(true);
  });
  it('icon HUD cần thiết có mặt', () => {
    for (const n of ['fire', 'collision', 'shield', 'tornado', 'crown', 'gem-stone', 'trophy', 'chequered-flag', 'red-heart', 'party-popper', 'speech-balloon', 'rocket', 'bomb', 'high-voltage', 'rose', 'eyes', 'busts-in-silhouette']) {
      expect(existsSync(new URL(`${n}.svg`, iconDir)), n).toBe(true);
    }
  });
});
