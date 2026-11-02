# Hình ảnh & cách thay bằng ảnh của bạn

## Hiện tại dùng gì

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Bản đồ 34 tỉnh + Hoàng Sa, Trường Sa | `@svg-maps/vietnam` → `packages/overlay/src/assets/vietnam.json` (script `scripts/extract-map.mjs`) | CC BY 4.0 (đã ghi credit ở góc overlay và docs/CREDITS.md) |
| Phương tiện 7 vùng, icon HUD/hiệu ứng | Microsoft Fluent Emoji 3D → `packages/overlay/src/assets/icons/*.svg` (script `scripts/extract-icons.mjs`, danh sách `scripts/icons.list`) | MIT |
| Font Be Vietnam Pro | `packages/overlay/public/fonts/` (script `scripts/fetch-fonts.mjs`) | OFL |
| Đường đua, biển, mây, hạt lửa/khói/confetti | vẽ bằng code (PixiJS) | – |

Phương tiện mặc định theo vùng (sửa trong `config/provinces.json` → `regions[].vehicle`, hoặc ghi đè từng tỉnh bằng `vehicle`):

| Vùng | Icon | Ý nghĩa |
|---|---|---|
| tay-nam-bo | `canoe` | ghe miền Tây |
| dong-nam-bo | `motor-scooter` | xe máy Sài Gòn |
| nam-trung-bo | `bus` | xe khách giường nằm |
| tay-nguyen | `elephant` | voi Buôn Đôn |
| bac-trung-bo | `automobile` | ô tô |
| dong-bang-bac-bo | `bicycle` | xe đạp phố cổ |
| mien-nui-bac | `sport-utility-vehicle` | xe địa hình |

Bất kỳ icon nào trong `scripts/icons.list` đều dùng được làm phương tiện; thêm tên vào list rồi chạy `node scripts/extract-icons.mjs`.

## Thay bằng ảnh của bạn (AI / designer)

1. Đặt file PNG vào `packages/overlay/public/assets/` (ví dụ `vehicles/ghe.png`, `icons/fire.png`).
2. Khai báo trong `packages/overlay/public/assets/manifest.json`:

```json
{
  "vehicles": {
    "region:tay-nam-bo": "vehicles/ghe.png",
    "region:dong-nam-bo": "vehicles/xe-may.png",
    "ha-noi": "vehicles/ha-noi.png"
  },
  "icons": {
    "fire": "icons/lua.png",
    "shield": "icons/khien.png"
  },
  "facing": { "region:tay-nam-bo": "left" }
}
```

   - Khoá phương tiện: `"<id tỉnh>"` (ưu tiên cao nhất) → `"region:<id vùng>"` → `"<tên icon>"`.
   - `facing`: ảnh của bạn quay mặt sang **trái** (mặc định) hay **phải**; overlay tự lật theo chiều chạy.
   - Thiếu file hoặc lỗi → tự dùng icon mặc định, không vỡ overlay.
3. Trong control bấm **Nạp lại ảnh** (hoặc tải lại overlay). Khi chạy `npm run dev`, Vite phục vụ `public/` trực tiếp; khi `npm start`, chạy `npm run build` lại để copy vào `dist/`.

### Quy cách ảnh

- PNG nền trong suốt, **512×512** (phương tiện) hoặc **256×256** (icon). Overlay hiển thị phương tiện cao ~64px, icon 24–110px.
- Phương tiện: nhìn ngang hoặc 3/4, **quay mặt sang trái**, chân xe sát mép dưới, căn giữa ngang, không có bóng đổ (overlay tự vẽ bóng + vòng màu đội).
- Không chữ, không nền, không viền ảnh. Màu rực, viền dày, sáng để nổi trên nền biển xanh.
- Tên file không dấu, chữ thường.

### Bộ prompt tạo ảnh đồng bộ phong cách (Midjourney / Ideogram / DALL·E)

Hậu tố chung (dán vào cuối mọi prompt):

> `cute 3D cartoon game asset, bright saturated colors, soft studio lighting, thick clean outline, slightly chunky proportions, side view facing left, centered, isolated on plain white background, no text, no shadow on ground --ar 1:1`

(Xoá nền trắng bằng công cụ remove-background, hoặc dùng mô hình hỗ trợ nền trong suốt.)

| File | Prompt |
|---|---|
| `vehicles/ghe.png` | Vietnamese wooden sampan boat with a small motor, a basket of fruit on board, friendly cartoon style |
| `vehicles/xe-may.png` | Vietnamese delivery motorbike stacked with colorful goods and a plastic stool, cartoon style |
| `vehicles/xe-khach.png` | Vietnamese sleeper coach bus, white and orange, friendly cartoon style |
| `vehicles/voi.png` | friendly cartoon elephant wearing a colorful woven blanket, Central Highlands Vietnam |
| `vehicles/o-to.png` | small cheerful hatchback car, red, cartoon style |
| `vehicles/xe-dap.png` | classic Hanoi city bicycle with a basket of flowers, cartoon style |
| `vehicles/xe-dia-hinh.png` | compact off-road 4x4 with roof rack and mud guards, green, cartoon style |
| `icons/lua.png` | stylized nitro flame burst, orange and yellow, cartoon game icon |
| `icons/khien.png` | glossy blue shield with a star, cartoon game icon |
| `icons/o-ga.png` | cartoon pothole with cracked asphalt, top-down, game icon |
| `icons/bao.png` | cartoon tornado with a stormy cloud, game icon |

Mẹo: tạo cả 7 phương tiện trong **một phiên** với cùng seed/style reference để đồng bộ; xuất tất cả cùng kích thước; kiểm tra ở độ cao 64px xem còn nhận ra hình không.

### Bản đồ nền tuỳ chỉnh

`manifest.json` → `"map": { "background": "map/bg.png" }` (1080×1920, phủ toàn khung, vùng biển/trời). Hiện tại đây là chỗ dành sẵn; nền biển đang vẽ bằng CSS/gradient + sóng, đất liền luôn vẽ từ dữ liệu bản đồ để tô màu theo đội.
