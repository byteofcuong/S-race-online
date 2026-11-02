import { Assets, Texture } from 'pixi.js';
import type { ProvincesFile } from '@srace/engine';
import carTopdownUrl from './assets/vehicles/car-topdown.svg?url';

/** SVG Fluent Emoji đã trích (scripts/extract-icons.mjs) – Vite cấp URL cho từng file. */
const ICONS = import.meta.glob('./assets/icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function builtinIconUrl(name: string): string | undefined {
  return ICONS[`./assets/icons/${name}.svg`];
}

export type Nose = 'up' | 'down' | 'left' | 'right';

/** Bộ xe top-down (ví dụ Kenney Racing Pack) đã nhập bằng scripts/import-kenney.mjs. */
export interface VehiclePack {
  /** thư mục trong public/assets */
  dir: string;
  /** mẫu tên file, {n} = số biến thể. Ví dụ "car_yellow_{n}.png" */
  shape: string;
  /** mũi xe trong ảnh gốc hướng về đâu (mặc định up) */
  nose?: Nose;
  /** biến thể theo tỉnh / "region:<vùng>" / "default": số {n} hoặc tên file .png */
  variants?: Record<string, number | string>;
}

/** public/assets/manifest.json – ảnh do người dùng cung cấp, ghi đè mặc định. */
export interface Manifest {
  vehiclePack?: VehiclePack | null;
  /** ảnh xe riêng từng tỉnh / "region:<vùng>" (top-down, mũi hướng lên) */
  vehicles?: Record<string, string>;
  icons?: Record<string, string>; // "fire" → đường dẫn ảnh
}

export interface VehicleAsset {
  url: string;
  nose: Nose;
  /** dùng làm khoá cache + để HUD biết có dùng pack ngoài không */
  source: 'pack' | 'custom' | 'builtin';
}

export const BUILTIN_VEHICLE: VehicleAsset = { url: carTopdownUrl, nose: 'up', source: 'builtin' };

/** góc cần xoay thêm để mũi xe trong ảnh hướng lên */
export function noseOffset(n: Nose): number {
  return n === 'down' ? Math.PI : n === 'left' ? Math.PI / 2 : n === 'right' ? -Math.PI / 2 : 0;
}

export class AssetStore {
  manifest: Manifest = {};
  private cache = new Map<string, Promise<Texture | undefined>>();
  private tintCache = new Map<string, Promise<Texture | undefined>>();
  private base = './assets/';

  async loadManifest(): Promise<void> {
    try {
      const r = await fetch(`${this.base}manifest.json?t=${Date.now()}`, { cache: 'no-store' });
      this.manifest = r.ok ? ((await r.json()) as Manifest) : {};
    } catch {
      this.manifest = {};
    }
    this.cache.clear();
    this.tintCache.clear();
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

  /**
   * Texture thang xám đã chuẩn hoá độ sáng để `sprite.tint = màu đội` cho ra đúng màu đội.
   * Ảnh màu bất kỳ (xe đỏ/vàng của Kenney) đều dùng được: phần sáng nhất của thân xe được kéo về ~trắng,
   * kính và lốp vốn tối nên vẫn tối.
   */
  tintable(url: string, targetHeight = 192): Promise<Texture | undefined> {
    let p = this.tintCache.get(url);
    if (!p) {
      p = (async () => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const nw = img.naturalWidth || 72;
        const nh = img.naturalHeight || 132;
        const k = targetHeight / Math.max(nw, nh);
        const w = Math.max(1, Math.round(nw * k));
        const h = Math.max(1, Math.round(nh * k));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;
        // độ sáng các điểm đủ đục → lấy phân vị 90 để chuẩn hoá
        const lums: number[] = [];
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] > 200) lums.push(0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]);
        }
        lums.sort((a, b) => a - b);
        const p90 = lums.length ? lums[Math.floor(lums.length * 0.9)] : 255;
        const scale = Math.min(3, Math.max(1, 245 / Math.max(1, p90)));
        for (let i = 0; i < px.length; i += 4) {
          const l = Math.min(255, (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) * scale);
          px[i] = px[i + 1] = px[i + 2] = l;
        }
        ctx.putImageData(data, 0, 0);
        return Texture.from(canvas);
      })().catch((e) => {
        console.warn('[assets] không tạo được texture tint', url, e);
        return undefined;
      });
      this.tintCache.set(url, p);
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

  get usingPack(): boolean {
    return !!this.manifest.vehiclePack;
  }

  /** Ảnh xe của một tỉnh: ảnh riêng (manifest.vehicles) → bộ xe (vehiclePack) → xe vẽ sẵn. */
  vehicle(provinces: ProvincesFile, provinceId: string): VehicleAsset {
    const p = provinces.provinces.find((x) => x.id === provinceId);
    const region = p?.region ?? '';
    const custom = this.manifest.vehicles?.[provinceId] ?? this.manifest.vehicles?.[`region:${region}`];
    if (custom) return { url: this.resolve(custom), nose: 'up', source: 'custom' };
    const pack = this.manifest.vehiclePack;
    if (pack?.dir && pack.shape) {
      const v = pack.variants ?? {};
      const variant = v[provinceId] ?? v[`region:${region}`] ?? v.default ?? 1;
      const file = typeof variant === 'string' && /\.(png|webp|svg)$/i.test(variant) ? variant : pack.shape.replace('{n}', String(variant));
      return { url: this.resolve(`${pack.dir.replace(/\/$/, '')}/${file}`), nose: pack.nose ?? 'up', source: 'pack' };
    }
    return BUILTIN_VEHICLE;
  }

  /** Texture tint được cho xe; ảnh ngoài lỗi → rơi về xe vẽ sẵn. */
  async vehicleTexture(provinces: ProvincesFile, provinceId: string): Promise<{ tex: Texture; nose: Nose } | undefined> {
    const a = this.vehicle(provinces, provinceId);
    const t = await this.tintable(a.url);
    if (t) return { tex: t, nose: a.nose };
    const fb = await this.tintable(BUILTIN_VEHICLE.url);
    return fb ? { tex: fb, nose: 'up' } : undefined;
  }

  async preload(provinces: ProvincesFile, icons: string[]): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    const urls = new Set(provinces.provinces.map((p) => this.vehicle(provinces, p.id).url));
    for (const u of urls) jobs.push(this.tintable(u));
    for (const n of icons) jobs.push(this.icon(n));
    await Promise.all(jobs);
  }
}

export const assets = new AssetStore();
