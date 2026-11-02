# Hình ảnh & cách thay bằng ảnh của bạn

## Nguyên tắc hình ảnh

Màn hình live nhỏ và chật, nên overlay giữ **ít thứ, đồng bộ**:

- Đất liền một tông cát; chỉ tỉnh của 8 đội đang hiện trên đường được tô màu đội.
- Tất cả xe là **cùng một bộ xe nhìn từ trên**, thân xe nhuộm màu đội. Màu tỉnh lấy cùng độ bão hoà và độ sáng nên không chói.
- HUD dùng một kiểu thẻ kính tối, chữ trắng, một màu nhấn vàng. Icon Fluent Emoji chỉ dùng nhỏ và ít.
- Chỉ 6 nhãn thành phố + 2 quần đảo. Không mây, không sóng.

## Hiện tại dùng gì

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Bản đồ 34 tỉnh + Hoàng Sa, Trường Sa | `@svg-maps/vietnam` → `packages/overlay/src/assets/vietnam.json` (`scripts/extract-map.mjs`) | CC BY 4.0, ghi credit ở góc overlay |
| Xe mặc định | `packages/overlay/src/assets/vehicles/car-topdown.svg` (vẽ riêng, thang xám để nhuộm màu) | thuộc dự án |
| Icon HUD, hiệu ứng | Microsoft Fluent Emoji → `packages/overlay/src/assets/icons/*.svg` (`scripts/extract-icons.mjs`, danh sách `scripts/icons.list`) | MIT |
| Font Be Vietnam Pro | `packages/overlay/public/fonts/` (`scripts/fetch-fonts.mjs`) | OFL |

## Dùng bộ xe Kenney Racing Pack (khuyên dùng)

Bộ xe đua nhìn từ trên rất đẹp, miễn phí, giấy phép CC0.

1. Tải zip tại https://kenney.nl/assets/racing-pack và giải nén.
2. Chạy:

   ```bash
   node scripts/import-kenney.mjs "đường/dẫn/thư-mục/đã-giải-nén"
   npm run build
   ```

   Script tìm các file `car_<màu>_<số>.png` và `motorcycle_<màu>.png`, chọn một màu làm ảnh gốc, copy vào `packages/overlay/public/assets/vehicles/kenney/` và ghi `vehiclePack` vào `packages/overlay/public/assets/manifest.json`.
3. Mỗi vùng tự được gán một dáng xe khác nhau trong bộ; Đông Nam Bộ dùng xe máy nếu bộ có ảnh xe máy. Màu thân xe vẫn theo màu đội.
4. Gỡ bộ xe: `node scripts/import-kenney.mjs --reset`.

> Script đã được kiểm tra với một bộ ảnh giả đặt tên theo kiểu Kenney, **chưa chạy với file zip thật** của Kenney. Nếu tên file trong zip khác, script báo không tìm thấy; nếu xe chạy ngang hoặc lùi, sửa `"nose"` trong manifest thành `down`, `left` hoặc `right`.

Chỉnh dáng xe theo vùng hoặc theo tỉnh trong `manifest.json`:

```json
"vehiclePack": {
  "dir": "vehicles/kenney",
  "shape": "car_yellow_{n}.png",
  "nose": "up",
  "variants": {
    "default": 1,
    "region:tay-nam-bo": 3,
    "region:dong-nam-bo": "motorcycle_yellow.png",
    "ha-noi": 5
  }
}
```

Thứ tự ưu tiên: id tỉnh → `region:<vùng>` → `default`.

## Thay bằng ảnh của bạn (AI / designer)

Đặt PNG vào `packages/overlay/public/assets/` rồi khai báo:

```json
{
  "vehicles": { "region:tay-nam-bo": "vehicles/ghe.png", "ha-noi": "vehicles/ha-noi.png" },
  "icons": { "fire": "icons/lua.png", "shield": "icons/khien.png" }
}
```

`vehicles` ưu tiên cao hơn `vehiclePack`. Thiếu file hoặc lỗi thì tự quay về xe vẽ sẵn, không vỡ overlay. Bấm **Nạp lại ảnh** trong control hoặc `npm run build` lại.

### Quy cách ảnh xe

- **Nhìn từ trên xuống, mũi xe hướng lên**, nền trong suốt, khoảng 128×256 px.
- Thân xe màu **trắng hoặc xám sáng**: overlay nhuộm theo màu đội, nên phần sáng sẽ thành màu đội, phần tối (kính, lốp) giữ tối. Ảnh màu bất kỳ vẫn dùng được vì overlay tự chuyển sang thang xám, nhưng ảnh trắng cho màu chuẩn nhất.
- Không bóng đổ, không chữ, không viền ảnh.

Prompt gợi ý (Midjourney / Ideogram), giữ nguyên hậu tố cho cả bộ:

> `top-down view of a [Vietnamese wooden sampan boat | delivery motorbike | sleeper coach bus | city bicycle | compact 4x4], facing up, plain white body with dark windows, clean cartoon game asset, thick outline, soft shading, isolated on transparent background, no text, no shadow --ar 1:2`

## Tạo lại asset từ nguồn

```bash
node scripts/extract-map.mjs     # bản đồ
node scripts/extract-icons.mjs   # icon trong scripts/icons.list
node scripts/fetch-fonts.mjs     # font
```
