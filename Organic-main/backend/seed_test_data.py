"""
Seed toàn bộ dữ liệu test cho dự án.

Chạy:
    cd backend
    python seed_test_data.py              # thêm data nếu chưa có (idempotent)
    python seed_test_data.py --reset      # XÓA sạch rồi seed lại từ đầu

Các collection được tạo:
    - admins           1 admin   (admin68 / password123)
    - users            3 khách hàng test
    - products        15 sản phẩm hữu cơ đa dạng
    - cart             2 giỏ hàng mẫu
    - chat_history     5 lịch sử chat AI
    - contacts         3 form liên hệ
    - orders           2 đơn hàng mẫu
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "organic_store")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin68")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "password123")


def hashpw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def now_iso(offset_hours: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=offset_hours)).isoformat()


# ---------- SEED DATA ----------
PRODUCTS = [
    {"ProductName": "Gạo ST25 hữu cơ", "PathImage": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400",
     "ProductType": "Ngũ cốc", "Quantity": 500, "Unit": "kg", "Price": 85000,
     "Description": "Gạo ST25 hữu cơ đạt chuẩn VietGAP, giống gạo ngon nhất thế giới 2019.",
     "Origin": "Sóc Trăng, Việt Nam", "Certification": "VietGAP, USDA Organic"},
    {"ProductName": "Thanh long Bình Thuận", "PathImage": "https://images.unsplash.com/photo-1527325678964-54921661f888?w=400",
     "ProductType": "Trái cây", "Quantity": 200, "Unit": "kg", "Price": 45000,
     "Description": "Thanh long ruột đỏ hữu cơ, giàu vitamin C và chất xơ.",
     "Origin": "Bình Thuận, Việt Nam", "Certification": "VietGAP"},
    {"ProductName": "Cà phê Đắk Lắk hữu cơ", "PathImage": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400",
     "ProductType": "Đồ uống", "Quantity": 150, "Unit": "kg", "Price": 350000,
     "Description": "Cà phê Arabica hữu cơ từ cao nguyên Đắk Lắk.",
     "Origin": "Đắk Lắk, Việt Nam", "Certification": "USDA Organic, Rainforest Alliance"},
    {"ProductName": "Măng cụt Lái Thiêu", "PathImage": "https://images.unsplash.com/photo-1591735090331-3e74a1ee4d24?w=400",
     "ProductType": "Trái cây", "Quantity": 100, "Unit": "kg", "Price": 120000,
     "Description": "Măng cụt đặc sản Lái Thiêu, ngọt thanh, giàu chất chống oxy hóa.",
     "Origin": "Bình Dương, Việt Nam", "Certification": "VietGAP"},
    {"ProductName": "Rau muống hữu cơ", "PathImage": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
     "ProductType": "Rau củ", "Quantity": 80, "Unit": "kg", "Price": 25000,
     "Description": "Rau muống hữu cơ tươi ngon, đạt chuẩn TCVN 11041:2015.",
     "Origin": "Đà Lạt, Việt Nam", "Certification": "TCVN 11041:2015, VietGAP"},
    {"ProductName": "Cải bó xôi hữu cơ", "PathImage": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
     "ProductType": "Rau củ", "Quantity": 60, "Unit": "kg", "Price": 35000,
     "Description": "Cải bó xôi (rau chân vịt) trồng thuỷ canh hữu cơ, giàu sắt.",
     "Origin": "Lâm Đồng, Việt Nam", "Certification": "VietGAP"},
    {"ProductName": "Cà chua bi hữu cơ", "PathImage": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400",
     "ProductType": "Rau củ", "Quantity": 120, "Unit": "kg", "Price": 40000,
     "Description": "Cà chua bi ngọt, giòn, canh tác hữu cơ trong nhà kính.",
     "Origin": "Đà Lạt, Việt Nam", "Certification": "VietGAP, GlobalGAP"},
    {"ProductName": "Bơ sáp Đắk Lắk", "PathImage": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400",
     "ProductType": "Trái cây", "Quantity": 90, "Unit": "kg", "Price": 65000,
     "Description": "Bơ sáp dẻo, thơm, giàu omega-3 và vitamin E.",
     "Origin": "Đắk Lắk, Việt Nam", "Certification": "VietGAP"},
    {"ProductName": "Xoài cát Hoà Lộc", "PathImage": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400",
     "ProductType": "Trái cây", "Quantity": 150, "Unit": "kg", "Price": 55000,
     "Description": "Xoài cát Hòa Lộc đặc sản Tiền Giang, ngọt đậm, thơm.",
     "Origin": "Tiền Giang, Việt Nam", "Certification": "VietGAP, GlobalGAP"},
    {"ProductName": "Trứng gà ác hữu cơ", "PathImage": "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=400",
     "ProductType": "Thực phẩm tươi", "Quantity": 300, "Unit": "vỉ 10 quả", "Price": 55000,
     "Description": "Trứng gà ác chăn thả tự nhiên, bổ dưỡng.",
     "Origin": "Long An, Việt Nam", "Certification": "VietGAP"},
    {"ProductName": "Mật ong rừng U Minh", "PathImage": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400",
     "ProductType": "Thực phẩm khô", "Quantity": 70, "Unit": "chai 500ml", "Price": 250000,
     "Description": "Mật ong rừng nguyên chất, khai thác tự nhiên.",
     "Origin": "Cà Mau, Việt Nam", "Certification": "OCOP 4 sao"},
    {"ProductName": "Hạt điều Bình Phước", "PathImage": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400",
     "ProductType": "Hạt dinh dưỡng", "Quantity": 200, "Unit": "kg", "Price": 320000,
     "Description": "Hạt điều rang muối, giòn, béo, nguồn gốc Bình Phước.",
     "Origin": "Bình Phước, Việt Nam", "Certification": "HACCP, ISO 22000"},
    {"ProductName": "Trà sen Tây Hồ", "PathImage": "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400",
     "ProductType": "Đồ uống", "Quantity": 40, "Unit": "hộp 100g", "Price": 450000,
     "Description": "Trà sen ướp thủ công từ hoa sen Tây Hồ đặc sản Hà Nội.",
     "Origin": "Hà Nội, Việt Nam", "Certification": "OCOP 5 sao"},
    {"ProductName": "Nấm linh chi Đà Lạt", "PathImage": "https://images.unsplash.com/photo-1607301406259-dfb186e15de8?w=400",
     "ProductType": "Dược liệu", "Quantity": 50, "Unit": "kg", "Price": 1200000,
     "Description": "Nấm linh chi đỏ sấy khô, dược liệu quý.",
     "Origin": "Lâm Đồng, Việt Nam", "Certification": "GACP-WHO"},
    {"ProductName": "Nước mắm Phú Quốc", "PathImage": "https://images.unsplash.com/photo-1599909533677-d52b8b0e7a3a?w=400",
     "ProductType": "Gia vị", "Quantity": 100, "Unit": "chai 500ml", "Price": 85000,
     "Description": "Nước mắm cá cơm truyền thống Phú Quốc, độ đạm 40N.",
     "Origin": "Kiên Giang, Việt Nam", "Certification": "Chỉ dẫn địa lý EU"},
]

USERS = [
    {"full_name": "Nguyễn Thị Lan", "email": "lan@test.com", "phone": "0912345678",
     "password": "test1234", "address": "12 Nguyễn Huệ", "province": "Thành phố Hồ Chí Minh", "district": "Quận 1"},
    {"full_name": "Trần Văn Nam", "email": "nam@test.com", "phone": "0987654321",
     "password": "test1234", "address": "56 Phố Huế", "province": "Thành phố Hà Nội", "district": "Quận Hai Bà Trưng"},
    {"full_name": "Lê Minh Hoa", "email": "hoa@test.com", "phone": "0901122334",
     "password": "test1234", "address": "34 Bạch Đằng", "province": "Thành phố Đà Nẵng", "district": "Quận Hải Châu"},
]

CONTACTS = [
    {"full_name": "Phạm Văn Đức", "email": "duc@gmail.com", "phone": "0911222333",
     "subject": "Hỏi về chứng nhận VietGAP",
     "message": "Chào shop, cho tôi hỏi sản phẩm rau muống có giấy chứng nhận VietGAP không?"},
    {"full_name": "Hoàng Thị Mai", "email": "mai@gmail.com", "phone": "0944555666",
     "subject": "Góp ý dịch vụ giao hàng",
     "message": "Giao hàng đúng hẹn, đóng gói cẩn thận, rất hài lòng!"},
    {"full_name": "Võ Văn Khánh", "email": "khanh@gmail.com", "phone": "0977888999",
     "subject": "Yêu cầu mua sỉ",
     "message": "Tôi muốn mua 100kg gạo ST25 cho nhà hàng, xin báo giá sỉ."},
]

CHAT_HISTORY = [
    ("admin68", "Rau muống có lợi gì cho sức khỏe?",
     "Rau muống giàu vitamin A, C, sắt và chất xơ, giúp cải thiện tiêu hoá, thanh nhiệt, tốt cho mắt và hỗ trợ giảm cân."),
    ("lan@test.com", "Gạo ST25 nấu sao ngon?",
     "Bạn vo gạo nhẹ, ngâm 15 phút, tỉ lệ nước 1:1.2, nấu bằng nồi cơm điện chế độ trắng chuẩn là có cơm dẻo thơm."),
    ("nam@test.com", "Thanh long ruột đỏ khác ruột trắng ra sao?",
     "Thanh long ruột đỏ ngọt hơn, giàu betacyanin (chất chống oxy hoá) và vitamin C cao hơn loại ruột trắng khoảng 2 lần."),
    ("admin68", "Cà phê hữu cơ khác cà phê thường thế nào?",
     "Cà phê hữu cơ không dùng thuốc trừ sâu và phân hoá học, giữ được hương vị tự nhiên và an toàn cho sức khỏe người uống."),
    ("hoa@test.com", "Bơ sáp chín dùng làm gì?",
     "Bơ sáp có thể ăn trực tiếp, làm sinh tố, salad, kem bơ, bánh mì bơ. Giàu chất béo tốt và vitamin E cho da."),
]


async def clear_all(db):
    for col in ["admins", "users", "products", "cart", "chat_history", "contacts", "orders"]:
        await db[col].delete_many({})
    print("✓ Đã xoá toàn bộ collection cũ")


async def seed_admins(db):
    if await db.admins.find_one({"username": ADMIN_USERNAME}):
        print(f"• Admin {ADMIN_USERNAME} đã tồn tại, bỏ qua")
        return
    await db.admins.insert_one({
        "username": ADMIN_USERNAME,
        "password": hashpw(ADMIN_PASSWORD),
    })
    print(f"✓ Admin: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")


async def seed_users(db):
    created = 0
    for u in USERS:
        if await db.users.find_one({"email": u["email"]}):
            continue
        doc = {**u, "password": hashpw(u["password"]), "created_at": now_iso()}
        await db.users.insert_one(doc)
        created += 1
    print(f"✓ Users: {created} khách hàng mới (mật khẩu chung: test1234)")


async def seed_products(db):
    if await db.products.count_documents({}) > 0:
        print(f"• Products: đã có sẵn, bỏ qua (dùng --reset để làm mới)")
        return
    now = now_iso()
    docs = [
        {**p, "ProductID": str(uuid.uuid4()), "CreateDate": now, "UpdateDate": now}
        for p in PRODUCTS
    ]
    await db.products.insert_many(docs)
    print(f"✓ Products: {len(docs)} sản phẩm hữu cơ")


async def seed_carts(db):
    if await db.cart.count_documents({}) > 0:
        print("• Carts: đã có sẵn, bỏ qua")
        return
    products = await db.products.find({}).limit(5).to_list(5)
    if not products:
        return
    # Lan có 2 sản phẩm, Nam có 3 sản phẩm
    cart_items = [
        {"user": "lan@test.com", "product_id": products[0]["ProductID"],
         "product_name": products[0]["ProductName"], "price": products[0]["Price"],
         "image": products[0]["PathImage"], "quantity": 2},
        {"user": "lan@test.com", "product_id": products[4]["ProductID"],
         "product_name": products[4]["ProductName"], "price": products[4]["Price"],
         "image": products[4]["PathImage"], "quantity": 1},
        {"user": "nam@test.com", "product_id": products[1]["ProductID"],
         "product_name": products[1]["ProductName"], "price": products[1]["Price"],
         "image": products[1]["PathImage"], "quantity": 3},
        {"user": "nam@test.com", "product_id": products[2]["ProductID"],
         "product_name": products[2]["ProductName"], "price": products[2]["Price"],
         "image": products[2]["PathImage"], "quantity": 1},
        {"user": "nam@test.com", "product_id": products[3]["ProductID"],
         "product_name": products[3]["ProductName"], "price": products[3]["Price"],
         "image": products[3]["PathImage"], "quantity": 2},
    ]
    await db.cart.insert_many(cart_items)
    print(f"✓ Carts: {len(cart_items)} item trong 2 giỏ hàng (lan@ & nam@)")


async def seed_chat(db):
    if await db.chat_history.count_documents({}) > 0:
        print("• Chat history: đã có sẵn, bỏ qua")
        return
    docs = [
        {"username": u, "user_message": q, "ai_response": a, "timestamp": now_iso(-i)}
        for i, (u, q, a) in enumerate(CHAT_HISTORY)
    ]
    await db.chat_history.insert_many(docs)
    print(f"✓ Chat history: {len(docs)} đoạn hội thoại")


async def seed_contacts(db):
    if await db.contacts.count_documents({}) > 0:
        print("• Contacts: đã có sẵn, bỏ qua")
        return
    docs = [{**c, "status": "new", "created_at": now_iso(-i)} for i, c in enumerate(CONTACTS)]
    await db.contacts.insert_many(docs)
    print(f"✓ Contacts: {len(docs)} form liên hệ")


async def seed_orders(db):
    if await db.orders.count_documents({}) > 0:
        print("• Orders: đã có sẵn, bỏ qua")
        return
    products = await db.products.find({}).limit(3).to_list(3)
    if not products:
        return
    orders = [
        {
            "user": "lan@test.com",
            "full_name": "Nguyễn Thị Lan",
            "phone": "0912345678",
            "address": "12 Nguyễn Huệ",
            "province": "Thành phố Hồ Chí Minh",
            "district": "Quận 1",
            "payment_method": "COD",
            "notes": "Giao giờ hành chính",
            "items": [
                {"product_id": products[0]["ProductID"], "product_name": products[0]["ProductName"],
                 "price": products[0]["Price"], "quantity": 2},
            ],
            "total": products[0]["Price"] * 2,
            "status": "delivered",
            "created_at": now_iso(-72),
        },
        {
            "user": "nam@test.com",
            "full_name": "Trần Văn Nam",
            "phone": "0987654321",
            "address": "56 Phố Huế",
            "province": "Thành phố Hà Nội",
            "district": "Quận Hai Bà Trưng",
            "payment_method": "Chuyển khoản",
            "notes": "",
            "items": [
                {"product_id": products[1]["ProductID"], "product_name": products[1]["ProductName"],
                 "price": products[1]["Price"], "quantity": 3},
                {"product_id": products[2]["ProductID"], "product_name": products[2]["ProductName"],
                 "price": products[2]["Price"], "quantity": 1},
            ],
            "total": products[1]["Price"] * 3 + products[2]["Price"],
            "status": "processing",
            "created_at": now_iso(-5),
        },
    ]
    await db.orders.insert_many(orders)
    print(f"✓ Orders: {len(orders)} đơn hàng mẫu")


async def main(reset: bool):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"\n🌱 Seed database: {DB_NAME} @ {MONGO_URL}\n")

    if reset:
        await clear_all(db)

    await seed_admins(db)
    await seed_users(db)
    await seed_products(db)
    await seed_carts(db)
    await seed_chat(db)
    await seed_contacts(db)
    await seed_orders(db)

    print("\n📊 Thống kê:")
    for col in ["admins", "users", "products", "cart", "chat_history", "contacts", "orders"]:
        count = await db[col].count_documents({})
        print(f"   - {col:15s}: {count} document(s)")

    print("\n✅ Seed hoàn tất!\n")
    print("🔐 Tài khoản test:")
    print(f"   Admin    : {ADMIN_USERNAME} / {ADMIN_PASSWORD}    (đăng nhập ở mục 'Đăng nhập quản trị viên')")
    print( "   Customer : lan@test.com    / test1234")
    print( "              nam@test.com    / test1234")
    print( "              hoa@test.com    / test1234")
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed test data cho Organic Store")
    parser.add_argument("--reset", action="store_true", help="Xoá sạch toàn bộ data trước khi seed")
    args = parser.parse_args()
    try:
        asyncio.run(main(args.reset))
    except KeyboardInterrupt:
        sys.exit(1)
