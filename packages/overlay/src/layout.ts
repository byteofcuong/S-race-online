/** Bố cục 1080×1920 – các vùng TikTok che được mô tả trong docs/DESIGN.md */
export const W = 1080;
export const H = 1920;

/** Vùng đường đua (an toàn toàn bộ chiều ngang). Toast nằm ở cột biển bên phải (x 600–1060). */
export const TRACK_TOP = 344;
export const TRACK_BOTTOM = 1040;

/**
 * Bản đồ thật (viewBox 812×873 của @svg-maps/vietnam, đất liền x 0–380, y 0–800).
 * Scale để đất liền vừa chiều cao vùng đua; đảo ở bên phải.
 */
export const MAP_SCALE = (TRACK_BOTTOM - TRACK_TOP) / 805;
export const MAP_ORIGIN = { x: 236, y: TRACK_TOP - 2 };

export function mapToScreen(x: number, y: number): { x: number; y: number } {
  return { x: MAP_ORIGIN.x + x * MAP_SCALE, y: MAP_ORIGIN.y + y * MAP_SCALE };
}

export interface TrackPoint {
  /** id tỉnh cũ trong vietnam.json (lấy tâm) */
  old: string;
  /** tên mốc hiển thị */
  name: string;
  dx?: number;
  dy?: number;
  side: 'left' | 'right';
  /** hiện nhãn (chỉ vài thành phố lớn để bản đồ gọn) */
  label?: boolean;
  start?: boolean;
  finish?: boolean;
}

/** Đường đua đi qua các mốc này (toạ độ = tâm tỉnh cũ + offset trong hệ viewBox bản đồ). */
export const TRACK_POINTS: TrackPoint[] = [
  { old: 'camau', name: 'Cà Mau', dx: -4, dy: 10, side: 'left', label: true, start: true },
  { old: 'cantho', name: 'Cần Thơ', side: 'left' },
  { old: 'hcm', name: 'TP.HCM', dx: -4, dy: 4, side: 'left', label: true },
  { old: 'binhthuan', name: 'Phan Thiết', dx: 14, dy: 10, side: 'right' },
  { old: 'khanhhoa', name: 'Nha Trang', dx: 12, dy: 6, side: 'right' },
  { old: 'binhdinh', name: 'Quy Nhơn', dx: 10, side: 'right' },
  { old: 'quangngai', name: 'Quảng Ngãi', dx: 12, side: 'right' },
  { old: 'danang', name: 'Đà Nẵng', dx: 4, side: 'right', label: true },
  { old: 'tthue', name: 'Huế', dx: 8, dy: 6, side: 'left', label: true },
  { old: 'quangbinh', name: 'Đồng Hới', dx: 16, dy: 4, side: 'right' },
  { old: 'nghean', name: 'Vinh', dx: 34, dy: 10, side: 'right' },
  { old: 'thanhhoa', name: 'Thanh Hóa', dx: 20, dy: 6, side: 'right' },
  { old: 'hanoi', name: 'Hà Nội', dx: 2, side: 'right', label: true },
  { old: 'tuyenquang', name: 'Tuyên Quang', dx: -2, side: 'left' },
  { old: 'hagiang', name: 'Lũng Cú', dx: 4, dy: -28, side: 'right', label: true, finish: true },
];

/** Nhãn quần đảo (bắt buộc hiển thị). */
export const ISLAND_LABELS = [
  { name: 'QĐ. Hoàng Sa', x: 574, y: 392 },
  { name: 'QĐ. Trường Sa', x: 640, y: 735 },
];
