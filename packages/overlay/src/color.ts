/** Tiện ích màu dùng chung cho cảnh và HUD. */

export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Độ sáng cảm nhận 0..1 của màu hex. */
export function luminance(hex: string): number {
  const n = hexToNum(hex);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Màu chữ đọc được trên nền màu này. */
export function textOn(hex: string): string {
  return luminance(hex) > 0.62 ? '#1b1d24' : '#ffffff';
}

/** Làm tối màu (k 0..1). */
export function darken(n: number, k: number): number {
  const r = ((n >> 16) & 255) * k, g = ((n >> 8) & 255) * k, b = (n & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
