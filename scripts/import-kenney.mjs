/**
 * Nhập bộ xe Kenney Racing Pack (CC0) vào overlay.
 *
 * 1. Tải https://kenney.nl/assets/racing-pack, giải nén.
 * 2. node scripts/import-kenney.mjs <thư-mục-đã-giải-nén>
 * 3. npm run build (hoặc bấm "Nạp lại ảnh" trong control khi chạy npm run dev)
 *
 * Script quét đệ quy tìm car_<màu>_<số>.png và motorcycle_<màu>.png, chọn MỘT màu làm ảnh gốc
 * (overlay chuyển sang thang xám rồi nhuộm theo màu đội), copy vào packages/overlay/public/assets/vehicles/kenney
 * và ghi manifest.json → vehiclePack. Mỗi vùng được gán một mẫu xe khác nhau trong bộ.
 *
 * Gỡ bộ xe: node scripts/import-kenney.mjs --reset
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'packages/overlay/public/assets');
const DEST_REL = 'vehicles/kenney';
const DEST = path.join(PUBLIC, DEST_REL);
const MANIFEST = path.join(PUBLIC, 'manifest.json');
const PROVINCES = path.join(ROOT, 'config/provinces.json');
const COLOR_PREF = ['yellow', 'red', 'blue', 'green', 'white', 'black'];

function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    return {};
  }
}
function writeManifest(m) {
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
}

const arg = process.argv[2];
if (!arg) {
  console.error('Cách dùng: node scripts/import-kenney.mjs <thư-mục-Kenney-Racing-Pack>  |  --reset');
  process.exit(1);
}

if (arg === '--reset') {
  rmSync(DEST, { recursive: true, force: true });
  const parent = path.dirname(DEST);
  if (existsSync(parent) && readdirSync(parent).length === 0) rmSync(parent, { recursive: true });
  const m = readManifest();
  m.vehiclePack = null;
  writeManifest(m);
  console.log('Đã gỡ bộ xe, overlay dùng lại xe vẽ sẵn.');
  process.exit(0);
}

const src = path.resolve(arg);
if (!existsSync(src) || !statSync(src).isDirectory()) {
  console.error(`Không thấy thư mục: ${src}`);
  process.exit(1);
}

/** @type {{file:string, color:string, n:number}[]} */
const cars = [];
/** @type {{file:string, color:string}[]} */
const motos = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else {
      let m = name.match(/^car_([a-z]+)_(\d+)\.png$/i);
      if (m) cars.push({ file: full, color: m[1].toLowerCase(), n: Number(m[2]) });
      m = name.match(/^motorcycle_([a-z]+)\.png$/i);
      if (m) motos.push({ file: full, color: m[1].toLowerCase() });
    }
  }
};
walk(src);

if (cars.length === 0) {
  console.error('Không tìm thấy file car_<màu>_<số>.png nào. Bạn đã giải nén đúng Racing Pack chưa? (thư mục PNG/Cars)');
  process.exit(1);
}

const colors = [...new Set(cars.map((c) => c.color))];
const color = COLOR_PREF.find((c) => colors.includes(c)) ?? colors[0];
const chosen = cars.filter((c) => c.color === color).sort((a, b) => a.n - b.n);
// ảnh trùng tên ở nhiều thư mục (ví dụ có bản @2x) → giữ bản lớn nhất
const byN = new Map();
for (const c of chosen) {
  const prev = byN.get(c.n);
  if (!prev || statSync(c.file).size > statSync(prev.file).size) byN.set(c.n, c);
}
const moto = motos.find((m) => m.color === color) ?? motos[0];

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const c of byN.values()) copyFileSync(c.file, path.join(DEST, path.basename(c.file)));
if (moto) copyFileSync(moto.file, path.join(DEST, path.basename(moto.file)));
writeFileSync(
  path.join(DEST, 'LICENSE.txt'),
  'Racing Pack by Kenney (www.kenney.nl) – Creative Commons Zero (CC0). Không bắt buộc ghi công, nhưng cảm ơn Kenney!\n',
);

// gán mẫu xe theo vùng để mỗi miền một dáng xe, cùng một bộ
const regions = Object.keys(JSON.parse(readFileSync(PROVINCES, 'utf8')).regions);
const ns = [...byN.keys()];
const variants = { default: ns[0] };
regions.forEach((r, i) => {
  variants[`region:${r}`] = ns[i % ns.length];
});
if (moto && regions.includes('dong-nam-bo')) variants['region:dong-nam-bo'] = path.basename(moto.file); // xe máy Sài Gòn

const m = readManifest();
m.vehiclePack = { dir: DEST_REL, shape: `car_${color}_{n}.png`, nose: 'up', variants };
writeManifest(m);

console.log(`Tìm thấy ${cars.length} ảnh xe (${colors.join(', ')}), ${motos.length} ảnh xe máy.`);
console.log(`Dùng màu "${color}" làm ảnh gốc (overlay tự nhuộm theo màu đội).`);
console.table(Object.entries(variants).map(([k, v]) => ({ khoa: k, mau_xe: v })));
console.log(`Đã copy vào ${path.relative(ROOT, DEST)} và cập nhật manifest.json.`);
console.log('Nếu mũi xe trong ảnh không hướng lên, sửa "nose" trong manifest (up/down/left/right).');
console.log('Tiếp theo: npm run build (hoặc bấm "Nạp lại ảnh" trong control khi chạy npm run dev).');
