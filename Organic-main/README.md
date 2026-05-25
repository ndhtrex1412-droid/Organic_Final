# 🥬 Dự án Organic Store - Cửa hàng Thực phẩm Hữu cơ

Dự án Web nâng cao gồm **Frontend (React)** và **Backend (FastAPI)** kết hợp cơ sở dữ liệu **MongoDB**. Hệ thống tích hợp tính năng chatbot AI tư vấn dinh dưỡng và nhận diện thực phẩm qua hình ảnh (OCR) sử dụng Gemini API / Ollama.

---

## 📁 Cấu trúc Dự án

```text
Organic_Final/
├── backend/            # FastAPI Backend
│   ├── backups/        # Các bản xuất dữ liệu MongoDB (.json)
│   ├── .env.example    # File cấu hình mẫu cho backend
│   ├── server.py       # Điểm khởi chạy API backend
│   └── requirements.txt# Các thư viện Python cần thiết
├── frontend/           # React Frontend
│   ├── src/            # Mã nguồn frontend (React components, pages, CSS)
│   ├── .env.example    # File cấu hình mẫu cho frontend
│   └── package.json    # Cấu hình dependency và lệnh chạy React
├── .gitignore          # Cấu hình bỏ qua các thư mục không cần đẩy lên GitHub
└── README.md           # Hướng dẫn chạy và triển khai dự án
```

---

## 🛠️ Yêu cầu Hệ thống trước khi cài đặt

Máy tính của bạn (hoặc máy demo) cần được cài đặt sẵn:
1. **Node.js** (Phiên bản v18 trở lên)
2. **Python** (Phiên bản 3.10 trở lên)
3. **MongoDB Community Server** (Đang chạy ở cổng mặc định `27017`)
4. **Git** (Dùng để clone và quản lý mã nguồn)

---

## 🚀 Hướng dẫn Cài đặt & Chạy dự án (Local Development)

### Bước 1: Clone dự án về máy
```bash
git clone <URL_KHO_CHỨA_GITHUB_CỦA_BẠN>
cd Organic-main
```

### Bước 2: Thiết lập & Chạy Backend
1. Di chuyển vào thư mục backend:
   ```bash
   cd backend
   ```
2. Tạo môi trường ảo Python (khuyên dùng để tránh xung đột thư viện):
   ```bash
   python -m venv venv
   ```
3. Kích hoạt môi trường ảo:
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (CMD):**
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - **macOS / Linux:**
     ```bash
     source venv/bin/activate
     ```
4. Cài đặt các thư viện cần thiết:
   ```bash
   pip install -r requirements.txt
   ```
5. Sao chép và cấu hình file `.env`:
   - Tạo file `.env` bằng cách sao chép file `.env.example`:
     ```bash
     copy .env.example .env
     ```
   - Mở file `.env` vừa tạo và điền khóa `GEMINI_API_KEY` của bạn để kích hoạt tính năng Chatbot AI (hoặc cấu hình kết nối MongoDB nếu khác cổng mặc định).
6. Khởi động server backend:
   ```bash
   uvicorn server:app --reload
   ```
   *Backend sẽ chạy tại: `http://localhost:8000`*

### Bước 3: Thiết lập & Chạy Frontend
1. Mở một terminal mới và di chuyển vào thư mục frontend:
   ```bash
   cd frontend
   ```
2. Cài đặt các thư viện Node.js:
   ```bash
   npm install
   # Hoặc nếu dùng yarn:
   yarn install
   ```
3. Sao chép và cấu hình file `.env`:
   - Tạo file `.env` bằng cách sao chép file `.env.example`:
     ```bash
     copy .env.example .env
     ```
   - File `.env` chứa URL kết nối tới backend (`REACT_APP_BACKEND_URL=http://localhost:8000`). Bạn có thể giữ nguyên nếu chạy local.
4. Chạy ứng dụng React:
   ```bash
   npm start
   # Hoặc nếu dùng yarn:
   yarn start
   ```
   *Trình duyệt sẽ tự động mở trang: `http://localhost:3000`*

---

## 🗄️ Nhập dữ liệu mẫu (Database Seed & Restore)

Hệ thống có cơ chế tự động nạp (seed) dữ liệu sản phẩm mẫu khi backend khởi động lần đầu nếu database trống. Tuy nhiên, nếu bạn muốn xoá sạch database và nạp lại dữ liệu chuẩn hoặc khôi phục dữ liệu đã backup:

### 1. Reset và Seed dữ liệu mẫu:
Khi đang kích hoạt môi trường ảo trong thư mục `backend`:
```bash
python seed_test_data.py --reset
```

### 2. Khôi phục từ bản backup JSON có sẵn:
Thư mục `backend/backups` đã đi kèm một bản backup dữ liệu chuẩn. Bạn có thể khôi phục dữ liệu nhanh chóng bằng lệnh:
```bash
python db_tools.py import backups/export_20260418_225048 --drop
```
*(Tham số `--drop` giúp xoá sạch các collection cũ trước khi nhập để tránh bị trùng lặp dữ liệu)*

---

## 🧑‍💻 Thông tin Tài khoản mặc định

Sau khi seed dữ liệu, bạn có thể đăng nhập vào trang quản trị (Admin) bằng tài khoản:
- **Đường dẫn Admin:** `http://localhost:3000/admin/login` (hoặc chuyển hướng từ giao diện trang chủ)
- **Tài khoản (Username):** `admin68`
- **Mật khẩu (Password):** `password123`
