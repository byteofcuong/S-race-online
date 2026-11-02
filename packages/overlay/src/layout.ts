/** Bố cục 1080×1920 – các vùng TikTok che được mô tả trong docs/DESIGN.md */
export const W = 1080;
export const H = 1920;

/** Vùng đường đua (an toàn toàn bộ chiều ngang). Phía trên (340–450) dành cho toast. */
export const TRACK_TOP = 456;
export const TRACK_BOTTOM = 1040;

/** Mốc địa lý → toạ độ màn hình. lon 104.5–109.5, lat 8.8–23.4 */
export function geo(lon: number, lat: number): { x: number; y: number } {
  return { x: 262 + (lon - 104.5) * 108, y: 1014 - (lat - 8.8) * 37.2 };
}

export interface Landmark {
  name: string;
  lon: number;
  lat: number;
  /** nhãn đặt bên trái hay phải đường */
  side: 'left' | 'right';
  finish?: boolean;
  start?: boolean;
}

/** Đường chữ S đi qua các mốc này (theo thứ tự từ Nam ra Bắc). */
export const LANDMARKS: Landmark[] = [
  { name: 'Cà Mau', lon: 105.15, lat: 9.18, side: 'left', start: true },
  { name: 'Cần Thơ', lon: 105.78, lat: 10.03, side: 'left' },
  { name: 'TP.HCM', lon: 106.7, lat: 10.78, side: 'left' },
  { name: 'Phan Thiết', lon: 108.1, lat: 10.93, side: 'right' },
  { name: 'Nha Trang', lon: 109.19, lat: 12.25, side: 'right' },
  { name: 'Quy Nhơn', lon: 109.22, lat: 13.78, side: 'right' },
  { name: 'Quảng Ngãi', lon: 108.8, lat: 15.12, side: 'right' },
  { name: 'Đà Nẵng', lon: 108.2, lat: 16.05, side: 'right' },
  { name: 'Huế', lon: 107.58, lat: 16.46, side: 'right' },
  { name: 'Đồng Hới', lon: 106.6, lat: 17.47, side: 'right' },
  { name: 'Vinh', lon: 105.68, lat: 18.68, side: 'left' },
  { name: 'Thanh Hóa', lon: 105.78, lat: 19.8, side: 'left' },
  { name: 'Hà Nội', lon: 105.85, lat: 21.03, side: 'right' },
  { name: 'Hà Giang', lon: 104.98, lat: 22.83, side: 'left' },
  { name: 'Lũng Cú', lon: 105.32, lat: 23.37, side: 'right', finish: true },
];
