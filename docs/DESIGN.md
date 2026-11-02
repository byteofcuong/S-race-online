# Thiết kế game – Đường Đua Chữ S

Người xem TikTok LIVE chơi cho **tỉnh của mình**: 34 tỉnh/thành đua xe từ Cà Mau ra Lũng Cú (Hà Giang). Mỗi ván ~4 phút, ván nối ván. Phần thưởng chỉ là vinh danh trên màn hình, không có yếu tố may rủi.

## Vòng đời một ván

| Pha | Mặc định | Màn hình |
|---|---|---|
| `lobby` | 15s | "Ván N sắp bắt đầu", xe xếp hàng ở Cà Mau |
| `racing` | 180s | Đua; đồng hồ đếm ngược tổng (180 + 45) |
| `golden` | 45s | Giờ vàng: quà ×2, đồng hồ vàng to, CTA đổi màu. 45s thay vì 30s vì stream trễ 3–10s |
| `podium` | 10s | Vô địch, top 3, MVP, chuỗi thắng → tự sang ván mới |

Đội về đích (`progress = 1`) trước giờ → kết ván ngay ("về đích Lũng Cú").

## Hành động → tác dụng

| Hành động | Tác dụng | Ghi chú |
|---|---|---|
| Bình luận tên tỉnh / mã / biển số | Vào đội (đổi đội tối đa 1 lần/ván) | Tên tỉnh cũ (Hải Dương, Quảng Nam…) tự map sang tỉnh mới, có toast "(Hải Dương)" |
| Bình luận không khớp | Tự xếp vào đội ít người nhất trong top 8 | Tắt được: `team.autoAssignUnmatched` |
| Thả tim | 10 tim = +0.2% quãng đường cho đội mình | Tim của người chưa có đội dồn cho **đội chót** → "quỹ tiếp sức" |
| Quà 1–9💎 (nhỏ) | Tăng tốc 3s | |
| Quà 10–99💎 (vừa) | Nitro 4s + lửa + tên người tặng trên xe | |
| Quà 100–999💎 (lớn) | Nitro + **phá** đội cao nhất không phải đội mình: lùi 2%, đứng im 4s | Có ổ gà + khói + toast khiêu khích trả đũa |
| Quà ≥1000💎 (siêu) | Nitro dài + **bão** phá tất cả đội khác 3s | Mưa, rung màn hình |
| Follow | +100% thanh khiên | 1 khiên đỡ 1 lần phá, tối đa 1 khiên |
| Share | +25% thanh khiên | |

Quãng đường từ quà: `0.0008/💎` tới 100💎, sau đó `0.0002/💎`, trần 0.30 mỗi quà. Giờ vàng ×2 (chỉ quà). Combo: 3 quà cùng đội trong 10s → quà sau +25% trong 10s.

Quà streak (hoa hồng…) được tính **phần chênh** `repeatCount` mỗi lần sự kiện tới (xe nhích ngay), và bậc hiệu ứng (phá/bão) tính theo **tổng** khi streak kết thúc.

## Giữ kịch tính

- **Bám đuổi**: 3 đội cuối trong top 8 được +15/10/5% tốc độ nền; **không bao giờ** cộng cho đội dẫn đầu; **tắt trong giờ vàng** để tiền quyết định.
- **Giờ vàng** chỉ nhân quà, không nhân tim hay bám đuổi.
- **Đội mới giữa ván** xuất phát ở vị trí đội chót (không bị bỏ xa).
- **CTA đổi theo ngữ cảnh**: bình thường xoay vòng hướng dẫn; có đội bị phá → "trả đũa"; giờ vàng → "quà nhân đôi còn Ns".
- **Chuỗi thắng** (👑), **MVP ván**, **top gifter mỗi đội** (hiện trong control) – danh phận ngay trong ván.

## Bố cục 1080×1920 (tránh UI TikTok trên điện thoại)

```
y    0– 240  header TikTok              → trống (trời)
y  244– 328  thanh trạng thái (ván, đồng hồ / đồng hồ vàng, pha)
y  344–1040  bản đồ Việt Nam thật + đường đua + xe   ← vùng an toàn toàn chiều ngang
             x 640–1060, y 352–500: cột toast (trên biển, tối đa 2)
y 1058–1134  CTA (trên khung bình luận; đôi khi bị banner quà che một phần – chấp nhận)
y 1160–1750  x 712–1060: bảng đua 8 đội (bên phải, bình luận không che)
             x    0– 700: trống (khung bình luận TikTok)
y 1760–1920  thanh nhập + nút quà        → chỉ thống kê mờ + credit
```

Nền: biển xanh dịu ở vùng bản đồ, tối dần từ y ≈ 1100 để chữ bình luận TikTok (trắng) đọc được. HUD là một kiểu thẻ kính tối, toast một kiểu (thanh màu bên trái theo loại), tối đa 2 toast. Xem nguyên tắc hình ảnh trong docs/ASSETS.md.

Các số che là ước lượng từ nguồn bên thứ ba. Bật phím **D** trong overlay để hiện khung mô phỏng, rồi đối chiếu với ảnh chụp từ điện thoại khi live thử và chỉnh `packages/overlay/src/style.css` nếu lệch.

## Cân bằng bằng số liệu

`logs/YYYY-MM-DD.jsonl` ghi mọi `event` (tim, quà, bình luận) và `fx` (nitro, phá, khiên, pha). Sau 2–3 buổi live, đọc:

- Khoảng cách top 1–2 lúc bắt đầu giờ vàng (nên < 10%)
- Tỉ lệ ván có người về đích sớm (nên 10–30%)
- Số lần phá / số lần khiên đỡ
- Đội nào thắng liên tục nhiều ván → tăng `rubberBand` hoặc giảm `capPerGift`

Tất cả số ở `config/balance.json`, nạp lại nóng.

## Kiến trúc

- `packages/engine` – luật chơi thuần TypeScript, deterministic, có test (`npm test`).
- `packages/server` – Node: nguồn sự kiện (`sources/tiktok.ts` bọc `tiktok-live-connector`, `sources/simulator.ts`), vòng lặp 30 tick/s, WebSocket snapshot 10Hz + fx tức thời, HTTP API cho control, log JSONL.
- `packages/overlay` – Vite + PixiJS: chỉ render; bản đồ một tông (`scene/Map.ts`), đường đua theo địa lý (`scene/Track.ts`), xe top-down nhuộm màu đội (`scene/Vehicle.ts`, xe giãn cách tối thiểu và đi làn xen kẽ để không chồng nhau), hiệu ứng tiết chế (`scene/Effects.ts`); HUD bằng DOM; âm thanh tổng hợp WebAudio. Ảnh tuỳ chỉnh và bộ xe Kenney qua `public/assets/manifest.json` (xem docs/ASSETS.md).
- `packages/control` – trang điều khiển tĩnh.
- `config/provinces.json` – 34 tỉnh, mã, alias tỉnh cũ, biển số, màu.

## Sau MVP (giai đoạn 2)

Mùa giải tuần + bảng 34 tỉnh (SQLite), trưởng đoàn tuần gắn tên trên xe, chung kết Chủ nhật, chọn mục tiêu phá bằng bình luận (`phá HN`), tách hiệu ứng ổ gà / tắc đường, lọc tên người dùng nâng cao, thay icon bằng ảnh vẽ riêng (pipeline đã sẵn, xem docs/ASSETS.md).
