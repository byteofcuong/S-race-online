import { Assets, Texture } from 'pixi.js';
import type { ProvincesFile } from '@srace/engine';

/** SVG Fluent Emoji đã trích (scripts/extract-icons.mjs) – Vite cấp URL cho từng file. */
const ICONS = import.meta.glob('./assets/icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function builtinIconUrl(name: string): string | undefined {
  return ICONS[`./assets/icons/${name}.svg`];
}

/** public/assets/manifest.json – ảnh do người dùng cung cấp, ghi đè icon mặc định. */
export interface Manifest {
  vehicles?: Record<string, string>; // "ha-noi" | "region:tay-nam-bo" → đường dẫn ảnh (tương đối public/assets)
  icons?: Record<string, string>; // "fire" → đường dẫn ảnh
  map?: { background?: string };
  /** icon ảnh người dùng quay mặt bên nào (mặc định trái) */
  facing?: Record<string, 'left' | 'right'>;
}

/** Hướng mặt của icon Fluent mặc định (để lật đúng chiều chạy). */
const BUILTIN_FACING: Record<string, 'left' | 'right'> = {
  canoe: 'left',
  'motor-scooter': 'left',
  bus: 'left',
  elephant: 'left',
  automobile: 'left',
  bicycle: 'left',
  'sport-utility-vehicle': 'left',
  'racing-car': 'left',
};

export class AssetStore {
  manifest: Manifest = {};
  private cache = new Map<string, Promise<Texture | undefined>>();
  private base = './assets/';

  async loadManifest(): Promise<void> {
    try {
      const r = await fetch(`${this.base}manifest.json?t=${Date.now()}`, { cache: 'no-store' });
      this.manifest = r.ok ? ((await r.json()) as Manifest) : {};
    } catch {
      this.manifest = {};
    }
    this.cache.clear();
  }

  private resolve(p: string): string {
    return /^(https?:)?\//.test(p) || p.startsWith('data:') ? p : this.base + p;
  }

  /** Nạp texture (SVG rasterize ở resolution 2, PNG giữ nguyên). Lỗi → undefined, không vỡ overlay. */
  texture(url: string | undefined): Promise<Texture | undefined> {
    if (!url) return Promise.resolve(undefined);
    let p = this.cache.get(url);
    if (!p) {
      p = Assets.load<Texture>({ src: url, data: { resolution: 2 } }).catch((e) => {
        console.warn('[assets] không nạp được', url, e);
        return undefined;
      });
      this.cache.set(url, p);
    }
    return p;
  }

  iconUrl(name: string): string | undefined {
    const m = this.manifest.icons?.[name];
    return m ? this.resolve(m) : builtinIconUrl(name);
  }

  icon(name: string): Promise<Texture | undefined> {
    return this.texture(this.iconUrl(name));
  }

  /** Tên phương tiện của một tỉnh (ưu tiên ghi đè tỉnh → vùng). */
  vehicleName(provinces: ProvincesFile, provinceId: string): string {
    const p = provinces.provinces.find((x) => x.id === provinceId);
    return p?.vehicle ?? provinces.regions[p?.region ?? '']?.vehicle ?? 'racing-car';
  }

  /** URL + hướng mặt của phương tiện: manifest tỉnh → manifest vùng → icon mặc định. */
  vehicle(provinces: ProvincesFile, provinceId: string): { url: string | undefined; facing: 'left' | 'right'; name: string } {
    const p = provinces.provinces.find((x) => x.id === provinceId);
    const name = this.vehicleName(provinces, provinceId);
    const m = this.manifest.vehicles ?? {};
    const custom = m[provinceId] ?? m[`region:${p?.region}`] ?? m[name];
    if (custom) return { url: this.resolve(custom), facing: this.manifest.facing?.[provinceId] ?? this.manifest.facing?.[name] ?? 'left', name };
    return { url: builtinIconUrl(name), facing: BUILTIN_FACING[name] ?? 'left', name };
  }

  async preload(provinces: ProvincesFile, icons: string[]): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    const vehicles = new Set<string>();
    for (const p of provinces.provinces) vehicles.add(p.id);
    for (const id of vehicles) jobs.push(this.texture(this.vehicle(provinces, id).url));
    for (const n of icons) jobs.push(this.icon(n));
    await Promise.all(jobs);
  }
}

export const assets = new AssetStore();
