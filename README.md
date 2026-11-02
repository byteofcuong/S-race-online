# 🏁 Đường Đua Chữ S

Game tương tác cho **TikTok LIVE**: 34 tỉnh thành đua xe dọc bản đồ hình chữ S từ Cà Mau ra Lũng Cú. Người xem chơi cho tỉnh của mình bằng bình luận, thả tim, quà, follow và share. Ván 4 phút, tự nối ván, có giờ vàng, phá đội dẫn đầu, khiên, combo, bám đuổi.

- Overlay 1080×1920 cho TikTok LIVE Studio / OBS, bố cục tránh khung bình luận TikTok
- Kết nối TikTok qua `tiktok-live-connector`; có simulator để test không cần lên live
- Luật chơi tách riêng, có test; mọi số cân bằng ở `config/balance.json` (nạp lại nóng)

```bash
npm install
npm run build && npm start      # http://localhost:8787  |  control: /control/
npm test
```

Tài liệu: [docs/SETUP.md](docs/SETUP.md) (cài đặt, LIVE Studio, checklist) · [docs/DESIGN.md](docs/DESIGN.md) (luật chơi, bố cục, cân bằng).

## Cấu trúc

```
config/        provinces.json (34 tỉnh + alias), balance.json
packages/
  engine/      luật chơi (TypeScript thuần) + test
  server/      Node: TikTok/simulator → engine → WebSocket, HTTP API, log JSONL
  overlay/     Vite + PixiJS: bản đồ, xe, hiệu ứng, HUD, âm thanh
  control/     trang điều khiển cho streamer
docs/
```

## Ranh giới

Chỉ vinh danh trên màn hình, không phần thưởng vật chất, không vòng quay hay hộp bí ẩn; mọi hiệu ứng cố định theo mức quà. Thư viện kết nối TikTok là reverse-engineering, không phải API chính thức, có thể cần cập nhật khi TikTok thay đổi.
