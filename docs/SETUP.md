# Cài đặt & chạy – Đường Đua Chữ S

## Yêu cầu

- Windows/macOS/Linux, **Node.js 20 trở lên** (https://nodejs.org)
- PC phát live bằng **TikTok LIVE Studio** (Windows) hoặc OBS có stream key
- (Khuyến nghị) API key **Euler Stream** – https://www.eulerstream.com → Dashboard → API Keys. Gói free bị giới hạn, khi live thật nên có key.

## 1. Cài

```bash
git clone <repo>
cd S-race-online
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

Mở `.env`, điền:

```
TIKTOK_USERNAME=ten_tiktok_cua_ban     # không có @
EULER_API_KEY=...                      # nếu có
PORT=8787
SOURCE=simulator                       # hoặc tiktok để tự kết nối khi khởi động
```

## 2. Chạy

### Chạy thật (một lệnh, một cổng)

```bash
npm run build      # build overlay một lần (lặp lại khi cập nhật code)
npm start
```

- Overlay: http://localhost:8787/
- Bảng điều khiển: http://localhost:8787/control/

### Chạy phát triển (tự reload khi sửa code)

```bash
npm run dev
```

- Overlay: http://localhost:5173/ (Vite)
- Control: http://localhost:8787/control/

### Test

```bash
npm test          # luật chơi, parser tên tỉnh
npm run typecheck
```

## 3. Thêm vào TikTok LIVE Studio

1. Trong LIVE Studio chọn chế độ dọc **9:16**, độ phân giải **1080×1920**.
2. Thêm nguồn → **Link / Web (Browser)** → dán `http://localhost:8787/` → kích thước **1080 × 1920**, đặt phủ toàn khung.
3. Bật tiếng cho nguồn nếu muốn hiệu ứng âm thanh (hoặc tắt từ control và tự chơi nhạc).
4. Bấm **TEST** của Studio, mở app TikTok trên điện thoại để xem bố cục có bị khung bình luận che không. Trong overlay bấm phím **D** (hoặc bật trong control) để hiện khung mô phỏng UI TikTok.

> Nếu nguồn Link trong Studio không hiển thị được (Studio dùng nhân trình duyệt cũ): mở overlay trong **OBS** bằng Browser Source 1080×1920 → bật **OBS Virtual Camera** → trong LIVE Studio chọn camera là "OBS Virtual Camera".

## 4. Kết nối TikTok khi đã lên live

1. Bấm **LIVE** trên Studio để lên sóng trước.
2. Mở http://localhost:8787/control/ → nhập tên TikTok → **Kết nối**.
3. Trạng thái "tiktok: đã kết nối" là xong. Thả tim/bình luận từ một tài khoản khác để kiểm tra.

Server tự kết nối lại khi rớt mạng (10s) hoặc khi kênh chưa live (30s).

## 5. Checklist trước mỗi buổi live

- [ ] `npm start` đang chạy, control mở được
- [ ] Overlay hiện trong Studio đúng 1080×1920, không bị cắt
- [ ] Kết nối TikTok "đã kết nối"
- [ ] Bấm **Reset buổi live** trong control để xoá đội của buổi trước
- [ ] Tắt chế độ đám đông giả lập (nếu đã bật để test)
- [ ] Âm lượng overlay hợp lý so với giọng nói

## 6. Thay hình ảnh

Xem [ASSETS.md](ASSETS.md): đặt PNG vào `packages/overlay/public/assets/`, khai báo trong `manifest.json`, bấm **Nạp lại ảnh** trong control.

## 7. Chỉnh cân bằng

Mọi con số ở `config/balance.json`; server tự nạp lại khi lưu file, không cần restart. Log sự kiện ở `logs/YYYY-MM-DD.jsonl` để xem lại sau buổi live (xem docs/DESIGN.md).

## 8. Lỗi thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| "kênh chưa live" | Phải bấm LIVE trên Studio trước khi kết nối |
| Kết nối thất bại liên tục | Thiếu/ hết hạn EULER_API_KEY; thư viện `tiktok-live-connector` cần cập nhật (`npm update tiktok-live-connector`) |
| Không có sự kiện like | TikTok không gửi like cho mọi lượt khi phòng đông; bình thường |
| Overlay trắng trong Studio | Dùng đường vòng OBS Virtual Camera (mục 3) |
| Không có tiếng trong trình duyệt | Trình duyệt chặn autoplay: click vào trang một lần. Trong OBS/Studio không cần |
