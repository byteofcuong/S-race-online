import { existsSync, readFileSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mergeBalance, type Balance, type ProvincesFile } from '@srace/engine';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const CONFIG_DIR = path.join(ROOT, 'config');
export const LOG_DIR = path.join(ROOT, 'logs');
export const OVERLAY_DIST = path.join(ROOT, 'packages/overlay/dist');
export const CONTROL_DIR = path.join(ROOT, 'packages/control');

export function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (e) {
      console.warn('[config] không đọc được .env:', (e as Error).message);
    }
  }
}

export function loadProvinces(): ProvincesFile {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, 'provinces.json'), 'utf8')) as ProvincesFile;
}

export function loadBalance(): Balance {
  return mergeBalance(JSON.parse(readFileSync(path.join(CONFIG_DIR, 'balance.json'), 'utf8')));
}

/** Theo dõi balance.json, gọi onChange khi file đổi và parse được. */
export function watchBalance(onChange: (b: Balance) => void) {
  let timer: NodeJS.Timeout | undefined;
  try {
    watch(path.join(CONFIG_DIR, 'balance.json'), () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          onChange(loadBalance());
          console.log('[config] balance.json đã nạp lại');
        } catch (e) {
          console.warn('[config] balance.json lỗi, giữ cấu hình cũ:', (e as Error).message);
        }
      }, 150);
    });
  } catch (e) {
    console.warn('[config] không theo dõi được balance.json:', (e as Error).message);
  }
}
