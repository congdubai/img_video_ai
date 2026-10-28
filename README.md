# Hệ Thống Làm Video YouTube Giải Thích Kiến Thức (Phong Cách Nguệch Ngoạc)

Hệ thống chạy **100% Local**, chuyên biệt cho video phong cách "Nguệch Ngoạc": minh họa vẽ tay doodle (nét đen dày, màu phẳng, nền kem, nhân vật đầu tròn trắng), giọng đọc tiếng Việt, zoom mượt không giật, chuyển cảnh mờ và phụ đề tiếng Việt có hiệu ứng.

---

## 1. Kiến Trúc 3 Lớp & Nguồn Sự Thật Duy Nhất

```
Giao diện React (Vite) ──HTTP/WebSocket──▶ API FastAPI ──┐
                                                          ├──▶ LÕI (core, Python thuần)
CLI (main.py) ────────────────────────────────────────────┘
```

- **Nguồn sự thật:** Toàn bộ dữ liệu nằm trong thư mục `projects/<ten_du_an>/`. Không dùng cơ sở dữ liệu riêng. Tắt giao diện hay chạy song song CLI không bao giờ lệch hay mất dữ liệu.
- **Chống lỗi thời (Stale detection):** Mọi file đầu ra (`timeline.json`, `scenes.json`, `prompts.json`, `images/metadata.json`) đều lưu kèm mã băm SHA-256 fingerprint của file đầu vào. Khi bạn sửa kịch bản hay cảnh, các bước phía sau tự động báo **"Lỗi thời"** và hỏi trước khi làm lại, không tự tiện ghi đè.
- **Tối ưu VRAM (RTX 4050 6GB):** Hàng đợi chỉ cho phép **1 tác vụ GPU tại một thời điểm** và tự động gọi `torch.cuda.empty_cache()` cùng `gc.collect()` ngay khi xong hoặc khi người dùng bấm **Hủy**.

---

## 2. Cấu Trúc Thư Mục Dự Án

```text
projects/<ten_du_an>/
  ├── script.txt        # Kịch bản gốc (mỗi câu hoặc đoạn ngắn một dòng)
  ├── audio/            # voice.wav hoàn chỉnh và sentence_XXX.wav từng câu
  ├── timeline.json     # Mốc thời gian từng câu (tính chính xác theo số mẫu Kokoro)
  ├── scenes.json       # Danh sách CẢNH (gộp câu, mục tiêu 5-12 giây)
  ├── prompts.json      # Lệnh sinh ảnh tiếng Anh & overlay_text (bạn duyệt/sửa)
  ├── images/           # scene_001.png ... và metadata.json kèm seed
  ├── output/           # video.mp4, preview.mp4, subtitles.ass
  └── config.yaml       # Cấu hình riêng của dự án (nếu muốn ghi đè mặc định)
```

---

## 3. Cách Sử Dụng

### Cách 1: Giao diện Web Trực Quan (1 lệnh duy nhất)
Chạy lệnh sau trên terminal:
```bash
python run.py
```
*(Nếu dùng Python đường dẫn riêng: `D:\Python311\python.exe run.py`)*

Lệnh sẽ tự động khởi động Backend FastAPI, Frontend React Vite và **tự động mở trình duyệt** tại `http://localhost:5173`.

### Cách 2: Dòng Lệnh CLI (Tự động hóa)
```bash
# Bước 1: Đọc kịch bản và xuất timeline mốc thời gian
python main.py tts --project sample_project

# Bước 2: Gom câu thành cảnh (mục tiêu 5-12s)
python main.py scenes --project sample_project

# Bước 3: Tạo khung lệnh sinh ảnh tiếng Anh
python main.py prompts --project sample_project

# Bước 4: Sinh ảnh từ các lệnh đã duyệt (hoặc --all để bỏ qua kiểm tra)
python main.py images --project sample_project --all

# Bước 5: Render video MP4 (Single-pass FFmpeg + NVENC)
python main.py render --project sample_project

# Chế độ xem thử nhanh 720p hoặc một đoạn:
python main.py render --project sample_project --preview --from 0 --to 20

# Chạy tự động:
python main.py all --project sample_project
```

---

## 4. Hướng Dẫn Thiết Lập Khi Về Máy Nhà (RTX 4050 6GB)

### 1. Giọng Đọc Kokoro (Giọng Ngọc Huyền)
- Đặt file model ONNX vào: `models/kokoro/kokoro-v0_19.onnx`
- Đặt file voices vào: `models/kokoro/voices.json`
- Khi chưa có file weights, hệ thống sẽ tự động dùng bộ phát âm mô phỏng (formant synthesis) để bạn có thể test trọn vẹn kịch bản và mốc thời gian.

### 2. Sinh Ảnh Doodle (ComfyUI / Diffusers / Placeholder)
- Mở file `config.default.yaml` hoặc `projects/<du_an>/config.yaml`:
  - Để dùng **ComfyUI**: đổi `images.engine: "comfyui"` và bật ComfyUI tại `http://127.0.0.1:8188`.
  - Để dùng **Placeholder (Vẽ tay nhanh không tốn VRAM)**: để `images.engine: "placeholder"`.

### 3. Quy Trình Bạn Tự Làm Prompts
1. Trong giao diện web (hoặc file `scenes.json`), bấm nút **"Sao chép kịch bản cảnh"** để copy toàn bộ thoại kèm mốc thời gian.
2. Mang đi sinh prompt tiếng Anh bằng công cụ bạn thích.
3. Quay lại bước **"4. Lệnh ảnh"** trên web, dán prompt vào từng cảnh, nhập chữ tiêu đề (nếu có) và bấm **"Duyệt tất cả"**.
4. Bấm **"Tiếp theo: Sinh ảnh"** -> Hệ thống chỉ sinh ảnh cho các cảnh đã duyệt!
