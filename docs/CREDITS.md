# Nguồn tài nguyên

- **Bản đồ Việt Nam**: [svg-maps / @svg-maps/vietnam](https://github.com/VictorCazanave/svg-maps) của Victor Cazanave – giấy phép **CC BY 4.0**. Đã gộp 63 tỉnh cũ (+ Hoàng Sa, Trường Sa) thành 34 tỉnh theo sắp xếp hành chính 2025 và chuẩn hoá toạ độ (`scripts/extract-map.mjs`). Credit hiển thị ở góc dưới overlay.
- **Xe mặc định**: vẽ riêng cho dự án (`packages/overlay/src/assets/vehicles/car-topdown.svg`).
- **Bộ xe tuỳ chọn**: [Kenney Racing Pack](https://kenney.nl/assets/racing-pack) – **CC0**, người dùng tự tải và nhập bằng `scripts/import-kenney.mjs`; không đi kèm repo.
- **Icon hiệu ứng, HUD**: [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (3D) – giấy phép **MIT**, trích qua `@iconify-json/fluent-emoji` (`scripts/extract-icons.mjs`).
- **Font**: [Be Vietnam Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro) – SIL Open Font License, tự host trong `packages/overlay/public/fonts/` (`scripts/fetch-fonts.mjs`).
- Đường đua, ổ gà, hạt hiệu ứng: vẽ bằng code (PixiJS Graphics).
- Âm thanh: tổng hợp bằng WebAudio trong `packages/overlay/src/audio.ts`, không dùng file ngoài.
- Dữ liệu 34 tỉnh thành: theo Nghị quyết sắp xếp đơn vị hành chính cấp tỉnh có hiệu lực 1/7/2025.
- Thư viện: pixi.js (MIT), tiktok-live-connector (MIT), ws (MIT), vite (MIT), vitest (MIT).
