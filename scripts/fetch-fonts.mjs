/**
 * Tải font Be Vietnam Pro (OFL) về packages/overlay/public/fonts để overlay chạy offline trong LIVE Studio.
 * Chạy: node scripts/fetch-fonts.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/overlay/public/fonts');
mkdirSync(OUT, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const cssUrl = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;700;900&display=swap';
const css = await (await fetch(cssUrl, { headers: { 'user-agent': UA } })).text();

// tách từng @font-face, chỉ giữ subset latin + vietnamese
const blocks = css.split('@font-face').slice(1);
let out = '';
let n = 0;
for (const b of blocks) {
  const comment = (css.slice(0, css.indexOf(b)).match(/\/\*\s*(\w+)\s*\*\/\s*$/) || [])[1];
  const subset = (b.match(/unicode-range:\s*([^;]+)/) || [])[1] || '';
  const isViet = subset.includes('U+0102') || subset.includes('U+1EA0');
  const isLatin = subset.startsWith('U+0000-00FF');
  if (!isViet && !isLatin) continue;
  const weight = (b.match(/font-weight:\s*(\d+)/) || [])[1];
  const url = (b.match(/url\(([^)]+\.woff2)\)/) || [])[1];
  if (!weight || !url) continue;
  const file = `be-vietnam-pro-${weight}-${isViet ? 'vietnamese' : 'latin'}.woff2`;
  const buf = Buffer.from(await (await fetch(url, { headers: { 'user-agent': UA } })).arrayBuffer());
  writeFileSync(path.join(OUT, file), buf);
  n++;
  out += `@font-face{font-family:'Be Vietnam Pro';font-style:normal;font-weight:${weight};font-display:swap;src:url(./${file}) format('woff2');unicode-range:${subset.trim()};}\n`;
  void comment;
}
writeFileSync(path.join(OUT, 'fonts.css'), out);
console.log(`Đã tải ${n} file font vào ${OUT}`);
