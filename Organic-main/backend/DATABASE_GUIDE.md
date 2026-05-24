# Quản lý Database

## 📦 Backup & Export

### Xuất toàn bộ database ra file JSON

```bash
cd backend
python db_tools.py export
# → Tạo thư mục: backend/backups/export_<timestamp>/
#    Mỗi collection 1 file .json + _meta.json ghi thông tin

# Tuỳ chọn chỉ định thư mục:
python db_tools.py export --dir /path/to/my_backup
```

Mỗi collection trở thành 1 file JSON dễ đọc bằng notepad, có thể commit vào git,
copy qua USB, email cho đồng đội, v.v.

### Xem các bản backup đã có

```bash
python db_tools.py list
```

### Nhập ngược lại (restore)

```bash
# Thêm vào DB hiện tại (giữ dữ liệu cũ)
python db_tools.py import backups/export_20260118_120000

# Xoá sạch DB rồi nhập lại từ đầu (an toàn, khuyến nghị khi chuyển máy)
python db_tools.py import backups/export_20260118_120000 --drop
```

### Seed lại dữ liệu test nhanh

```bash
python seed_test_data.py           # thêm data còn thiếu
python seed_test_data.py --reset   # xoá hết rồi seed lại
```

### (Tuỳ chọn nâng cao) Dùng `mongodump`/`mongorestore` chính chủ

Nếu có cài MongoDB Tools (`mongodump`, `mongorestore`):

```bash
# Backup
mongodump --uri="mongodb://localhost:27017" --db=test_database --out=./mongodump_backup

# Restore
mongorestore --uri="mongodb://localhost:27017" --db=test_database ./mongodump_backup/test_database
```

Format BSON gốc của MongoDB, giữ nguyên 100% kiểu dữ liệu. Phù hợp để backup định kỳ.

---

## 🔄 Đồng bộ 2 chiều (App ↔ MongoDB)

### Đã bật sẵn: Polling tự động mỗi 5 giây

Frontend tự động fetch lại dữ liệu mỗi **5 giây** ở các trang:

| Trang | Dữ liệu được polling |
|---|---|
| Trang chủ `/` | Danh sách sản phẩm (tên, giá, ảnh, số lượng, loại) |
| Giỏ hàng `/cart` | Items trong giỏ |
| Admin Sản phẩm `/admin/products` | Toàn bộ kho + tồn kho |
| Admin Kho `/admin/inventory` | Thống kê tồn kho |

### Luồng đồng bộ

```
┌─────────────────┐                    ┌─────────────────┐
│   MongoDB       │◄──────────────────►│    Backend      │
│   (Compass)     │   read/write       │  (FastAPI)      │
└─────────────────┘                    └────────┬────────┘
                                                │
                                    polling 5s  │
                                                ▼
                                       ┌─────────────────┐
                                       │   Frontend      │
                                       │   (React)       │
                                       └─────────────────┘
```

### Kịch bản 1: Sửa trong App → MongoDB cập nhật **tức thì**
1. Admin vào `/admin/products` → click Edit sản phẩm → đổi giá → Save
2. Backend ghi xuống MongoDB ngay lập tức
3. MongoDB Compass refresh (F5) sẽ thấy giá mới

### Kịch bản 2: Sửa trong MongoDB Compass → App cập nhật **trong 5 giây**
1. Mở Compass → `test_database.products` → double-click field `Price` của "Gạo ST25" → sửa 85000 → 99000 → nhấn **Update**
2. Trang chủ web đang mở: tối đa **5 giây** sau tự hiển thị giá mới (không cần F5)

### Kịch bản 3: Sửa trực tiếp trong MongoDB shell
```javascript
use test_database
db.products.updateOne(
  { ProductName: "Gạo ST25 hữu cơ" },
  { $set: { Price: 95000, Quantity: 600 } }
)
```
Frontend tự reflect sau 5s.

### Muốn đồng bộ tức thì (< 1 giây)?

MongoDB Change Streams hỗ trợ push real-time nhưng yêu cầu **replica set**.
Convert standalone MongoDB thành replica set (1 node, local):

```bash
# Dừng mongod hiện tại trước, sau đó:
mongod --dbpath /path/to/data --replSet rs0
# Kết nối mongosh:
mongosh
> rs.initiate()
```

Sau đó sửa `MONGO_URL` trong `backend/.env`:
```env
MONGO_URL="mongodb://localhost:27017/?replicaSet=rs0"
```

Nếu bạn cần, hãy yêu cầu mình bật **SSE (Server-Sent Events) + Change Streams**
để push ngay khi có thay đổi thay vì polling.

---

## 📊 Các field có thể sửa trực tiếp trên MongoDB

Collection `products` — mọi field đều sửa được trong Compass:

| Field | Kiểu | Ghi chú |
|---|---|---|
| `ProductID` | string | **Không sửa** — khoá liên kết với giỏ hàng/đơn hàng |
| `ProductName` | string | Tên hiển thị |
| `PathImage` | string (URL) | Link ảnh — có thể dùng Unsplash, Imgur, hoặc host riêng |
| `ProductType` | string | Loại: "Rau củ", "Trái cây", "Ngũ cốc", "Đồ uống", … |
| `Quantity` | number | Tồn kho |
| `Unit` | string | Đơn vị: "kg", "chai 500ml", "vỉ 10 quả", … |
| `Price` | number | Đơn giá (VND) |
| `Description` | string | Mô tả chi tiết |
| `Origin` | string | Xuất xứ |
| `Certification` | string | VietGAP, USDA Organic, TCVN 11041, … |
| `CreateDate` / `UpdateDate` | ISO string | Ngày tạo/cập nhật |

⚠️ **Lưu ý quan trọng khi sửa tay:**
- **Không đổi `ProductID`** — nó được tham chiếu trong `cart` và `orders`
- `Price` và `Quantity` phải là **số** (không phải chuỗi). Trong Compass chọn kiểu "Int32" hoặc "Double"
- `PathImage` nên dùng URL trực tiếp tới ảnh `.jpg/.png/.webp`. Test bằng cách dán URL vào trình duyệt trước.
