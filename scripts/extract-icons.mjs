/**
 * Trích icon Fluent Emoji (MIT) từ gói @iconify-json/fluent-emoji thành file SVG riêng lẻ.
 * Gói nặng ~100MB nên không làm dependency; chỉ tải tạm khi chạy script này.
 * Chạy: node scripts/extract-icons.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/overlay/src/assets/icons');
const PKG = '@iconify-json/fluent-emoji@1.2.7';

const names = readFileSync(path.join(ROOT, 'scripts/icons.list'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const tmp = mkdtempSync(path.join(os.tmpdir(), 'fluent-emoji-'));
console.log('Tải', PKG, '→', tmp);
execSync(`npm pack ${PKG} --silent`, { cwd: tmp, stdio: 'inherit' });
const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
execSync(`tar -xzf "${tgz}"`, { cwd: tmp, stdio: 'inherit' });
const json = JSON.parse(readFileSync(path.join(tmp, 'package/icons.json'), 'utf8'));

mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const name of names) {
  const icon = json.icons[name];
  if (!icon) {
    console.warn('  thiếu icon:', name);
    continue;
  }
  const w = icon.width ?? json.width ?? 32;
  const h = icon.height ?? json.height ?? 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${icon.body}</svg>\n`;
  writeFileSync(path.join(OUT, `${name}.svg`), svg);
  ok++;
}
if (!existsSync(path.join(OUT, 'LICENSE.txt'))) {
  writeFileSync(
    path.join(OUT, 'LICENSE.txt'),
    'Fluent Emoji – Copyright (c) Microsoft Corporation. MIT License. https://github.com/microsoft/fluentui-emoji\nTrích qua @iconify-json/fluent-emoji.\n',
  );
}
console.log(`Đã ghi ${ok}/${names.length} icon vào ${OUT}`);
