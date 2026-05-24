# 🤖 Hướng dẫn cài AI Chatbot bằng Ollama (offline + online)

Ollama chạy **model ngôn ngữ ngay trên máy bạn**, không cần internet, không cần API key, miễn phí 100%.

---

## ⚡ TL;DR (chạy nhanh 3 lệnh)

```bash
# 1. Cài Ollama → https://ollama.com/download  (Windows/Mac/Linux, 1-click installer)
# 2. Mở terminal mới, pull 2 model:
ollama pull qwen2.5:3b      # chat tiếng Việt (~2GB)
ollama pull llava:7b        # nhận diện ảnh  (~4.5GB) — bỏ qua nếu không cần OCR
# 3. Ollama tự chạy nền sau khi cài. Khởi động lại backend. Xong!
```

---

## 📋 Các bước chi tiết

### Bước 1. Tải và cài Ollama

| OS | Cách cài |
|---|---|
| **Windows** | Vào https://ollama.com/download/windows → tải `OllamaSetup.exe` → chạy → xong |
| **macOS** | Vào https://ollama.com/download/mac → tải `Ollama-darwin.zip` → mở ra kéo vào Applications |
| **Linux** | `curl -fsSL https://ollama.com/install.sh \| sh` |

Sau khi cài, Ollama **tự động chạy nền** (biểu tượng lạc đà ở system tray trên Windows/Mac).

**Kiểm tra Ollama đã chạy chưa:**
```bash
curl http://localhost:11434/api/tags
# Nếu trả về JSON {"models": [...]} → OK
```

---

### Bước 2. Tải model

Mở terminal, gõ:

```bash
ollama pull qwen2.5:3b
```

`Qwen2.5-3B` là model của Alibaba — **tiếng Việt rất tốt**, nhẹ (~2GB), chạy trên máy 8GB RAM thoải mái.

**Nếu muốn OCR ảnh (nhận diện rau củ)** — pull thêm vision model:
```bash
ollama pull llava:7b
```

Hoặc model tốt hơn (yêu cầu 16GB RAM):
```bash
ollama pull llama3.2-vision:11b
```

### Gợi ý chọn model theo cấu hình máy

| RAM máy | Chat model | Vision model |
|---|---|---|
| **8 GB** | `qwen2.5:3b` (2GB) | `llava:7b` (4.5GB) |
| **16 GB** | `qwen2.5:7b` (4.5GB) hoặc `llama3.2:3b` | `llava:13b` hoặc `llama3.2-vision:11b` |
| **32 GB+** | `qwen2.5:14b` hoặc `llama3.1:8b` | `llama3.2-vision:11b` |
| **Yếu (< 8GB)** | `qwen2.5:0.5b` (400MB, chất lượng kém hơn) | bỏ qua OCR |

Xem danh sách đầy đủ: https://ollama.com/library

---

### Bước 3. Cấu hình backend (đã làm sẵn)

File `backend/.env` đã có:
```env
OLLAMA_HOST="http://localhost:11434"
OLLAMA_CHAT_MODEL="qwen2.5:3b"
OLLAMA_VISION_MODEL="llava:7b"
OLLAMA_TIMEOUT="120"
```

**Nếu bạn pull model khác** → sửa `OLLAMA_CHAT_MODEL` / `OLLAMA_VISION_MODEL` cho khớp tên model (ví dụ `llama3.2:3b`).

---

### Bước 4. Khởi động lại backend

```bash
# Dừng backend cũ (Ctrl+C), khởi động lại:
cd backend
uvicorn server:app --reload --port 8001
```

### Bước 5. Test chat

Vào trang web → click **"Trợ Lý Dinh Dưỡng AI"** → gõ `Rau muống có lợi gì?` → chờ 3-10 giây (lần đầu Ollama load model hơi lâu, lần sau nhanh hơn).

---

## 🌐 Online & Offline — hoạt động thế nào?

Ollama chạy **100% local**. Không cần internet để chat. Khi bạn:
- **Có internet**: vẫn dùng Ollama (không gọi dịch vụ ngoài)
- **Mất internet**: vẫn dùng Ollama — chat hoạt động bình thường

Model sau khi pull nằm trên ổ cứng. Không gọi ra bên ngoài.

---

## ❓ Xử lý lỗi thường gặp

| Lỗi | Cách sửa |
|---|---|
| `Không kết nối được Ollama tại http://localhost:11434` | Ollama chưa chạy. Windows/Mac: mở app Ollama từ menu Start / Applications. Linux: chạy `ollama serve` trong 1 terminal riêng |
| `Chưa cài model 'qwen2.5:3b'. Chạy: ollama pull qwen2.5:3b` | Pull model theo gợi ý |
| Chat rất chậm (> 30s/câu) | Máy yếu. Thử model nhỏ hơn: `ollama pull qwen2.5:1.5b` rồi sửa `OLLAMA_CHAT_MODEL` trong .env |
| Response bằng tiếng Anh thay vì tiếng Việt | Model quá nhỏ. Dùng `qwen2.5:3b` hoặc `qwen2.5:7b` — Qwen đa ngôn ngữ tốt nhất trong các model mở |
| Port 11434 bị chiếm | Đổi port Ollama: `OLLAMA_HOST=127.0.0.1:11435 ollama serve`, rồi sửa `OLLAMA_HOST` trong `.env` |

---

## 💡 Mẹo hay

### Xem các model đã có trong máy
```bash
ollama list
```

### Xoá model không dùng (tiết kiệm ổ cứng)
```bash
ollama rm tên-model
```

### Test model trực tiếp trong terminal
```bash
ollama run qwen2.5:3b
>>> Cho tôi biết lợi ích của rau muống
```

### Chạy Ollama trên server khác (không phải local)
Nếu bạn deploy backend lên server, Ollama cài trên server đó. Hoặc trỏ về 1 máy có Ollama:
```env
OLLAMA_HOST="http://192.168.1.100:11434"
```
Trên máy có Ollama, bật listen mọi IP:
```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

---

## 🆚 So sánh nhanh với Gemini/ChatGPT

| Tiêu chí | Ollama (local) | Gemini/ChatGPT (cloud) |
|---|---|---|
| Cần internet | ❌ Không | ✅ Có |
| Chi phí | 🆓 Miễn phí vĩnh viễn | 💰 Miễn phí có giới hạn, trả phí theo request |
| Riêng tư | ✅ 100% (dữ liệu không rời máy) | ⚠️ Gửi lên server Google/OpenAI |
| Tốc độ | Tùy máy (3-15s với model 3B trên RAM 8GB) | 1-3 giây ổn định |
| Chất lượng | Tốt cho câu hỏi phổ thông | Xuất sắc, kiến thức rộng |
| Cài đặt | Cài 1 lần, chạy mãi | Chỉ cần API key |

**Kết luận:** cho bài tập / dùng cá nhân / demo → **Ollama là lựa chọn tuyệt vời**: ổn định, không phụ thuộc bên ngoài, không phát sinh chi phí, không lo quota.
