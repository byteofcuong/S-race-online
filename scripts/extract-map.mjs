/**
 * Trích bản đồ Việt Nam từ @svg-maps/vietnam (CC BY 4.0) → packages/overlay/src/assets/vietnam.json
 * - Gộp 63 tỉnh cũ (+ Hoàng Sa, Trường Sa) thành 34 tỉnh mới
 * - Chuẩn hoá path về toạ độ tuyệt đối, chỉ còn lệnh M L C Z (overlay tự parse, không phụ thuộc parser SVG)
 * - Tính bbox + tâm từng tỉnh cũ (để đặt đường đua, nhãn)
 * Chạy: node scripts/extract-map.mjs
 */
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/overlay/src/assets/vietnam.json');
const PKG = '@svg-maps/vietnam@2.0.0';

/** tỉnh cũ (id trong gói) → tỉnh mới (id trong config/provinces.json) */
const OLD_TO_NEW = {
  hagiang: 'tuyen-quang', tuyenquang: 'tuyen-quang',
  caobang: 'cao-bang', laichau: 'lai-chau', dienbien: 'dien-bien', sonla: 'son-la',
  laocai: 'lao-cai', yenbai: 'lao-cai',
  thainguyen: 'thai-nguyen', backan: 'thai-nguyen',
  langson: 'lang-son', quangninh: 'quang-ninh',
  bacninh: 'bac-ninh', bacgiang: 'bac-ninh',
  phutho: 'phu-tho', vinhphuc: 'phu-tho', hoabinh: 'phu-tho',
  hanoi: 'ha-noi',
  haiphong: 'hai-phong', haiduong: 'hai-phong',
  hungyen: 'hung-yen', thaibinh: 'hung-yen',
  ninhbinh: 'ninh-binh', hanam: 'ninh-binh', namdinh: 'ninh-binh',
  thanhhoa: 'thanh-hoa', nghean: 'nghe-an', hatinh: 'ha-tinh',
  quangbinh: 'quang-tri', quangtri: 'quang-tri',
  tthue: 'hue',
  danang: 'da-nang', quangnam: 'da-nang', hoangsa: 'da-nang',
  quangngai: 'quang-ngai', kontum: 'quang-ngai',
  gialai: 'gia-lai', binhdinh: 'gia-lai',
  daklak: 'dak-lak', phuyen: 'dak-lak',
  khanhhoa: 'khanh-hoa', ninhthuan: 'khanh-hoa', truongsa: 'khanh-hoa',
  lamdong: 'lam-dong', daknong: 'lam-dong', binhthuan: 'lam-dong',
  dongnai: 'dong-nai', binhphuoc: 'dong-nai',
  tayninh: 'tay-ninh', longan: 'tay-ninh',
  hcm: 'ho-chi-minh', binhduong: 'ho-chi-minh', baria: 'ho-chi-minh',
  dongthap: 'dong-thap', tiengiang: 'dong-thap',
  vinhlong: 'vinh-long', bentre: 'vinh-long', travinh: 'vinh-long',
  cantho: 'can-tho', haugiang: 'can-tho', soctrang: 'can-tho',
  angiang: 'an-giang', kiengiang: 'an-giang',
  camau: 'ca-mau', baclieu: 'ca-mau',
};

const tmp = mkdtempSync(path.join(os.tmpdir(), 'svg-maps-vietnam-'));
console.log('Tải', PKG, '→', tmp);
execSync(`npm pack ${PKG} --silent`, { cwd: tmp, stdio: 'inherit' });
const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
execSync(`tar -xzf "${tgz}"`, { cwd: tmp, stdio: 'inherit' });
const mod = await import(pathToFileURL(path.join(tmp, 'package/index.js')).href);
const map = mod.default ?? mod;

const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const r1 = (v) => Math.round(v * 10) / 10;

/** Chuẩn hoá path: trả { d: 'M x y L x y C ... Z', bbox } */
function normalize(d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  let i = 0;
  let cmd = '';
  let x = 0, y = 0, sx = 0, sy = 0;
  const out = [];
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const track = (px, py) => {
    if (px < minx) minx = px;
    if (px > maxx) maxx = px;
    if (py < miny) miny = py;
    if (py > maxy) maxy = py;
  };
  const next = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
      if (cmd === 'z' || cmd === 'Z') {
        out.push('Z');
        x = sx;
        y = sy;
        continue;
      }
    }
    switch (cmd) {
      case 'M': x = next(); y = next(); sx = x; sy = y; out.push(`M${r1(x)} ${r1(y)}`); track(x, y); cmd = 'L'; break;
      case 'm': x += next(); y += next(); sx = x; sy = y; out.push(`M${r1(x)} ${r1(y)}`); track(x, y); cmd = 'l'; break;
      case 'L': x = next(); y = next(); out.push(`L${r1(x)} ${r1(y)}`); track(x, y); break;
      case 'l': x += next(); y += next(); out.push(`L${r1(x)} ${r1(y)}`); track(x, y); break;
      case 'H': x = next(); out.push(`L${r1(x)} ${r1(y)}`); track(x, y); break;
      case 'h': x += next(); out.push(`L${r1(x)} ${r1(y)}`); track(x, y); break;
      case 'V': y = next(); out.push(`L${r1(x)} ${r1(y)}`); track(x, y); break;
      case 'v': y += next(); out.push(`L${r1(x)} ${r1(y)}`); track(x, y); break;
      case 'C': {
        const x1 = next(), y1 = next(), x2 = next(), y2 = next(), ex = next(), ey = next();
        out.push(`C${r1(x1)} ${r1(y1)} ${r1(x2)} ${r1(y2)} ${r1(ex)} ${r1(ey)}`);
        x = ex; y = ey; track(x, y); break;
      }
      case 'c': {
        const x1 = x + next(), y1 = y + next(), x2 = x + next(), y2 = y + next(), ex = x + next(), ey = y + next();
        out.push(`C${r1(x1)} ${r1(y1)} ${r1(x2)} ${r1(y2)} ${r1(ex)} ${r1(ey)}`);
        x = ex; y = ey; track(x, y); break;
      }
      default:
        throw new Error(`Lệnh SVG chưa hỗ trợ: ${cmd}`);
    }
  }
  return { d: out.join(' '), bbox: [r1(minx), r1(miny), r1(maxx), r1(maxy)] };
}

const provinces = {};
const old = {};
let count = 0;
for (const loc of map.locations) {
  const newId = OLD_TO_NEW[loc.id];
  if (!newId) throw new Error(`Chưa map tỉnh cũ: ${loc.id} (${loc.name})`);
  const { d, bbox } = normalize(loc.path);
  (provinces[newId] ??= { paths: [] }).paths.push(d);
  old[loc.id] = { name: loc.name, newId, bbox, cx: r1((bbox[0] + bbox[2]) / 2), cy: r1((bbox[1] + bbox[3]) / 2) };
  count++;
}
const [, , vw, vh] = map.viewBox.split(/\s+/).map(Number);
const json = {
  _license: 'Dữ liệu bản đồ: @svg-maps/vietnam (https://github.com/VictorCazanave/svg-maps) – CC BY 4.0. Đã gộp theo 34 tỉnh (2025) và chuẩn hoá toạ độ.',
  width: vw,
  height: vh,
  provinces,
  old,
};
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(json));
console.log(`Đã ghi ${Object.keys(provinces).length} tỉnh mới từ ${count} path → ${OUT} (${Math.round(JSON.stringify(json).length / 1024)} KB)`);
