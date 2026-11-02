import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ProvinceIndex, normalize } from '../src/provinces.ts';
import type { ProvincesFile } from '../src/types.ts';

const file = JSON.parse(readFileSync(new URL('../../../config/provinces.json', import.meta.url), 'utf8')) as ProvincesFile;
const idx = new ProvinceIndex(file);

describe('normalize', () => {
  it('bỏ dấu, hạ chữ thường, bỏ ký tự lạ', () => {
    expect(normalize('  Hà Nội!!! ')).toBe('ha noi');
    expect(normalize('Đà Nẵng')).toBe('da nang');
    expect(normalize('TP.HCM')).toBe('tp hcm');
  });
});

describe('dữ liệu tỉnh', () => {
  it('có đúng 34 tỉnh thành, id và mã không trùng', () => {
    expect(file.provinces).toHaveLength(34);
    const ids = new Set(file.provinces.map((p) => p.id));
    expect(ids.size).toBe(34);
    const codes = new Set(file.provinces.map((p) => normalize(p.code)));
    expect(codes.size).toBe(34);
  });
  it('mọi tỉnh có màu hex và vùng hợp lệ', () => {
    for (const p of file.provinces) {
      expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(file.regions[p.region]).toBeTruthy();
    }
  });
  it('mọi vùng có tên', () => {
    for (const r of Object.values(file.regions)) expect(r.name).toBeTruthy();
  });
  it('34 màu tỉnh khác nhau', () => {
    expect(new Set(file.provinces.map((p) => p.color.toLowerCase())).size).toBe(34);
  });
});

describe('parse tên tỉnh', () => {
  const cases: [string, string | null][] = [
    ['HN', 'ha-noi'],
    ['hn', 'ha-noi'],
    ['Hà Nội', 'ha-noi'],
    ['ha noi', 'ha-noi'],
    ['hanoi vô địch', 'ha-noi'],
    ['tôi ở hà nội nè', 'ha-noi'],
    ['SG', 'ho-chi-minh'],
    ['sài gòn', 'ho-chi-minh'],
    ['tp hcm cố lên', 'ho-chi-minh'],
    ['TP.HCM', 'ho-chi-minh'],
    ['Bình Dương', 'ho-chi-minh'],
    ['Nghệ An', 'nghe-an'],
    ['nghệ an ơi', 'nghe-an'],
    ['Hải Dương', 'hai-phong'],
    ['ĐN', 'da-nang'],
    ['dn', 'da-nang'],
    ['Đồng Nai', 'dong-nai'],
    ['Quảng Nam', 'da-nang'],
    ['Hà Giang', 'tuyen-quang'],
    ['43', 'da-nang'],
    ['29', 'ha-noi'],
    ['Cần Thơ', 'can-tho'],
    ['ct', 'can-tho'],
    ['Huế', 'hue'],
    ['Đắk Lắk', 'dak-lak'],
    ['daklak', 'dak-lak'],
    ['Bắc Kạn', 'thai-nguyen'],
    ['nha trang', 'khanh-hoa'],
    ['đà lạt', 'lam-dong'],
    ['Cà Mau', 'ca-mau'],
    ['xin chào mọi người', null],
    ['hay quá', null],
    ['đó là ai vậy', null],
    ['thật vinh dự', null],
    ['vinh ơi', 'nghe-an'],
    ['', null],
    ['😍😍😍', null],
    ['1234', null],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      expect(idx.parse(input)?.provinceId ?? null).toBe(expected);
    });
  }

  it('báo tên tỉnh cũ khi gõ tỉnh đã sáp nhập', () => {
    expect(idx.parse('Hải Dương')?.viaOldName).toBe('Hải Dương');
    expect(idx.parse('hai duong')?.viaOldName).toBe('Hải Dương');
    expect(idx.parse('Hà Nội')?.viaOldName).toBeUndefined();
  });

  it('mã ngắn chỉ khớp khi là cả câu hoặc từ đầu', () => {
    expect(idx.parse('hn ơi cố lên')?.provinceId).toBe('ha-noi');
    expect(idx.parse('chào hn')).toBeNull();
  });
});
