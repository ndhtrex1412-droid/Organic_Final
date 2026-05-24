from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx
import google.generativeai as genai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

gemini_api_key = os.environ.get('GEMINI_API_KEY')
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
ocr_router = APIRouter()

uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# Khai báo cấu trúc dữ liệu gửi lên từ Frontend
class OCRRequest(BaseModel):
    image_base64: str


JWT_SECRET = os.environ.get('JWT_SECRET', 'organic_food_store_secret')
JWT_ALGORITHM = 'HS256'

# Ollama configuration — chạy local, offline 100%
OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'http://localhost:11434').rstrip('/')
OLLAMA_CHAT_MODEL = os.environ.get('OLLAMA_CHAT_MODEL', 'qwen2.5:3b')
OLLAMA_VISION_MODEL = os.environ.get('OLLAMA_VISION_MODEL', 'llava:7b')
OLLAMA_TIMEOUT = float(os.environ.get('OLLAMA_TIMEOUT', '120'))

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminResponse(BaseModel):
    username: str
    token: str

class UserRegister(BaseModel):
    full_name: str
    email: str
    phone: str
    password: str
    address: str
    province: str
    district: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    email: str
    full_name: str
    token: str

class CartItem(BaseModel):
    product_id: str
    quantity: int

class CartAdd(BaseModel):
    product_id: str
    quantity: int = 1

class CheckoutData(BaseModel):
    full_name: str
    phone: str
    address: str
    province: str
    district: str
    payment_method: str
    notes: Optional[str] = None

class ContactForm(BaseModel):
    full_name: str
    email: str
    phone: str
    subject: str
    message: str

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ProductID: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ProductName: str
    PathImage: str
    ProductType: str
    Quantity: float
    Unit: str
    Price: float
    Description: str
    Origin: str = "Việt Nam"
    Certification: str = "VietGAP"
    CreateDate: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    UpdateDate: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProductCreate(BaseModel):
    ProductName: str
    PathImage: str
    ProductType: str
    Quantity: float = Field(ge=0, description="Số lượng phải >= 0")
    Unit: str
    Price: float = Field(ge=0, description="Giá phải >= 0")
    Description: str
    Origin: str = "Việt Nam"
    Certification: str = "VietGAP"

class ProductUpdate(BaseModel):
    ProductName: Optional[str] = None
    PathImage: Optional[str] = None
    ProductType: Optional[str] = None
    Quantity: Optional[float] = Field(None, ge=0, description="Số lượng phải >= 0")
    Unit: Optional[str] = None
    Price: Optional[float] = Field(None, ge=0, description="Giá phải >= 0")
    Description: Optional[str] = None
    Origin: Optional[str] = None
    Certification: Optional[str] = None

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

class OCRRequest(BaseModel):
    image_base64: str

def create_token(username: str) -> str:
    payload = {
        'username': username,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload['username']
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@api_router.post("/auth/login", response_model=AdminResponse)
async def login(credentials: AdminLogin):
    admin = await db.admins.find_one({"username": credentials.username}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), admin['password'].encode('utf-8')):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    token = create_token(credentials.username)
    return AdminResponse(username=credentials.username, token=token)

@api_router.post("/users/register", response_model=UserResponse)
async def register_user(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email đã được sử dụng")
    
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_doc = {
        "full_name": user_data.full_name,
        "email": user_data.email,
        "phone": user_data.phone,
        "password": hashed_password,
        "address": user_data.address,
        "province": user_data.province,
        "district": user_data.district,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_data.email)
    return UserResponse(email=user_data.email, full_name=user_data.full_name, token=token)

@api_router.post("/users/login", response_model=UserResponse)
async def login_user(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng")
    
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng")
    
    token = create_token(credentials.email)
    return UserResponse(email=credentials.email, full_name=user['full_name'], token=token)

@api_router.get("/auth/verify")
async def verify(username: str = Depends(verify_token)):
    return {"username": username, "authenticated": True}

@api_router.get("/products", response_model=List[Product])
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    return products

@api_router.get("/products/admin", response_model=List[Product])
async def get_products_admin(username: str = Depends(verify_token)):
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    return products

@api_router.delete("/products/bulk")
async def bulk_delete_products(product_ids: List[str], username: str = Depends(verify_token)):
    result = await db.products.delete_many({"ProductID": {"$in": product_ids}})
    return {"message": f"Đã xóa {result.deleted_count} sản phẩm", "deleted_count": result.deleted_count}

@api_router.post("/products/duplicate")
async def bulk_duplicate_products(product_ids: List[str], username: str = Depends(verify_token)):
    duplicated = 0
    for pid in product_ids:
        original = await db.products.find_one({"ProductID": pid}, {"_id": 0})
        if original:
            new_product = {**original}
            new_product["ProductID"] = str(uuid.uuid4())
            new_product["ProductName"] = original['ProductName']
            new_product["CreateDate"] = datetime.now(timezone.utc).isoformat()
            new_product["UpdateDate"] = datetime.now(timezone.utc).isoformat()
            await db.products.insert_one(new_product)
            duplicated += 1
    return {"message": f"Đã nhân bản {duplicated} sản phẩm", "duplicated_count": duplicated}

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product_detail(product_id: str):
    product = await db.products.find_one({"ProductID": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    return Product(**product)

@api_router.post("/cart/add")
async def add_to_cart(item: CartAdd, username: str = Depends(verify_token)):
    product = await db.products.find_one({"ProductID": item.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    
    cart_item = await db.cart.find_one({"user": username, "product_id": item.product_id})
    if cart_item:
        await db.cart.update_one(
            {"user": username, "product_id": item.product_id},
            {"$inc": {"quantity": item.quantity}}
        )
    else:
        await db.cart.insert_one({
            "user": username,
            "product_id": item.product_id,
            "product_name": product['ProductName'],
            "price": product['Price'],
            "image": product['PathImage'],
            "quantity": item.quantity
        })
    return {"message": "Đã thêm vào giỏ hàng"}

@api_router.get("/cart")
async def get_cart(username: str = Depends(verify_token)):
    cart_items = await db.cart.find({"user": username}, {"_id": 0}).to_list(100)
    total = sum(item['price'] * item['quantity'] for item in cart_items)
    return {"items": cart_items, "total": total}

@api_router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, username: str = Depends(verify_token)):
    await db.cart.delete_one({"user": username, "product_id": product_id})
    return {"message": "Đã xóa khỏi giỏ hàng"}

@api_router.put("/cart/{product_id}")
async def update_cart_quantity(product_id: str, quantity_data: dict, username: str = Depends(verify_token)):
    new_quantity = quantity_data.get('quantity', 1)
    if new_quantity < 1:
        raise HTTPException(status_code=400, detail="Số lượng phải lớn hơn 0")
    
    result = await db.cart.update_one(
        {"user": username, "product_id": product_id},
        {"$set": {"quantity": new_quantity}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Sản phẩm không có trong giỏ hàng")
    
    return {"message": "Đã cập nhật số lượng"}

@api_router.post("/checkout")
async def checkout(checkout_data: CheckoutData, username: str = Depends(verify_token)):
    cart_items = await db.cart.find({"user": username}, {"_id": 0}).to_list(100)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Giỏ hàng trống")
    
    total = sum(item['price'] * item['quantity'] for item in cart_items)
    order = {
        "user": username,
        "items": cart_items,
        "total": total,
        "shipping_info": checkout_data.model_dump(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.orders.insert_one(order)
    await db.cart.delete_many({"user": username})
    
    return {"message": "Đặt hàng thành công", "order_id": str(result.inserted_id), "total": total}

@api_router.post("/contact")
async def submit_contact(contact: ContactForm):
    contact_doc = contact.model_dump()
    contact_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    contact_doc['status'] = 'new'
    await db.contacts.insert_one(contact_doc)
    return {"message": "Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất."}

@api_router.get("/admin/orders")
async def get_admin_orders(username: str = Depends(verify_token)):
    user = await db.admins.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=403, detail="Only admins can manage orders")
    orders = await db.orders.find({}).sort("created_at", -1).to_list(1000)
    result = []
    for order in orders:
        order["order_id"] = str(order.pop("_id"))
        # Ensure shipping_info exists with safe defaults
        if "shipping_info" not in order or order["shipping_info"] is None:
            order["shipping_info"] = {
                "full_name": "N/A", "phone": "N/A", "address": "N/A",
                "district": "", "province": "", "payment_method": "cod", "notes": ""
            }
        if "items" not in order or order["items"] is None:
            order["items"] = []
        result.append(order)
    return JSONResponse(content=result)

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: dict, username: str = Depends(verify_token)):
    user = await db.admins.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=403, detail="Only admins can manage orders")
    
    new_status = payload.get("status")
    if new_status not in ["pending", "processing", "confirmed", "cancelled", "completed", "delivered"]:
        raise HTTPException(status_code=400, detail="Invalid order status")
        
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID format")
        
    result = await db.orders.update_one({"_id": oid}, {"$set": {"status": new_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
        
    return {"message": f"Đã cập nhật trạng thái đơn hàng thành {new_status}", "status": new_status}


@api_router.post("/upload-image")
async def upload_image(file: UploadFile = File(...), username: str = Depends(verify_token)):
    user = await db.admins.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=403, detail="Only admins can upload images")
    try:
        file_extension = file.filename.split(".")[-1]
        new_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = uploads_dir / new_filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"url": f"http://localhost:8000/uploads/{new_filename}"}
    except Exception as e:
        logger.error(f"Image upload error: {e}")
        raise HTTPException(status_code=500, detail="Could not upload image")

@api_router.post("/products", response_model=Product, status_code=status.HTTP_201_CREATED)
async def create_product(product_data: ProductCreate, username: str = Depends(verify_token)):
    product = Product(**product_data.model_dump())
    doc = product.model_dump()
    await db.products.insert_one(doc)
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_data: ProductUpdate, username: str = Depends(verify_token)):
    existing = await db.products.find_one({"ProductID": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_dict = {k: v for k, v in product_data.model_dump().items() if v is not None}
    update_dict['UpdateDate'] = datetime.now(timezone.utc).isoformat()
    
    await db.products.update_one({"ProductID": product_id}, {"$set": update_dict})
    
    updated = await db.products.find_one({"ProductID": product_id}, {"_id": 0})
    return Product(**updated)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, username: str = Depends(verify_token)):
    result = await db.products.delete_one({"ProductID": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

@api_router.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage, username: str = Depends(verify_token)):
    system_prompt = (
        "Bạn là trợ lý AI chuyên về dinh dưỡng, sức khỏe và thực phẩm hữu cơ tại Việt Nam. "
        "Hãy trả lời bằng tiếng Việt. Nhiệm vụ của bạn là cung cấp thông tin chi tiết về dinh dưỡng, "
        "lợi ích sức khỏe của rau củ quả, thực phẩm hữu cơ, mẹo nấu ăn và các tiêu chuẩn hữu cơ (như VietGAP, TCVN). "
        "QUAN TRỌNG: Bạn BẮT BUỘC PHẢI TỪ CHỐI trả lời bất kỳ câu hỏi nào không liên quan đến rau củ quả, thực phẩm hữu cơ, dinh dưỡng hoặc sức khỏe. "
        "Nếu người dùng hỏi về chủ đề ngoài lề (ví dụ: lập trình, toán học, lịch sử, chính trị, giải trí, v.v.), "
        "hãy lịch sự trả lời: 'Xin lỗi, tôi là trợ lý AI chuyên về dinh dưỡng và thực phẩm hữu cơ. Tôi chỉ có thể giúp bạn giải đáp các vấn đề liên quan đến sức khỏe, rau củ quả và sản phẩm hữu cơ.' "
        "Giữ câu trả lời ngắn gọn, lịch sự và đầy đủ thông tin."
    )
    
    try:
        model = genai.GenerativeModel('gemini-flash-lite-latest', system_instruction=system_prompt)
        response = model.generate_content(message.message)
        response_text = response.text.strip()
    except Exception as e:
        logging.error(f"Gemini chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat service error: {e}")

    await db.chat_history.insert_one({
        "username": username,
        "user_message": message.message,
        "ai_response": response_text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return ChatResponse(response=response_text)


import json
import base64

@api_router.post("/ocr/identify")
async def identify_image(request: OCRRequest, username: str = Depends(verify_token)):
    all_products = await db.products.find({}, {"_id": 0}).to_list(1000)
    products_info = "\n".join([f"- ID: {p['ProductID']}, Tên: {p['ProductName']}, Loại: {p['ProductType']}" for p in all_products])
    
    system_prompt = (
        "Bạn là chuyên gia nhận diện thực phẩm và rau củ quả Việt Nam.\n"
        "Nhiệm vụ:\n"
        "1. Nhận diện hình ảnh và mô tả ngắn gọn (tên, đặc điểm, dinh dưỡng).\n"
        f"2. So sánh và tìm các sản phẩm khớp hoặc liên quan nhất trong danh sách cửa hàng của chúng tôi dưới đây:\n{products_info}\n\n"
        "YÊU CẦU: Bắt buộc trả về KẾT QUẢ DƯỚI DẠNG JSON với cấu trúc:\n"
        "{\n"
        '  "description": "Mô tả của bạn...",\n'
        '  "matched_product_ids": ["ID1", "ID2"]\n'
        "}\n"
        "Lưu ý: matched_product_ids là mảng chứa các ID sản phẩm phù hợp. Nếu không có sản phẩm nào phù hợp, trả về mảng rỗng [].\n"
        "Tuyệt đối chỉ trả về chuỗi JSON hợp lệ, không có văn bản nào khác. Không dùng thẻ markdown ```json."
    )
    
    # Extract base64 and mime_type
    mime_type = "image/jpeg"
    b64_str = request.image_base64
    if b64_str.startswith("data:"):
        parts = b64_str.split(";", 1)
        mime_type = parts[0].replace("data:", "")
        b64_str = parts[1].split(",", 1)[-1]
    elif "," in b64_str:
        b64_str = b64_str.split(",", 1)[-1]
        
    try:
        model = genai.GenerativeModel('gemini-flash-lite-latest', system_instruction=system_prompt)
        image_part = {
            "mime_type": mime_type,
            "data": base64.b64decode(b64_str)
        }
        response = model.generate_content([
            "Hãy nhận diện hình ảnh này và trả về JSON theo đúng định dạng yêu cầu.", 
            image_part
        ])
        ai_response = response.text.strip()
        
        # Parse JSON
        if ai_response.startswith("```json"):
            ai_response = ai_response[7:-3].strip()
        elif ai_response.startswith("```"):
            ai_response = ai_response[3:-3].strip()
            
        data = json.loads(ai_response)
        desc = data.get("description", "Không thể nhận diện chi tiết.")
        matched_ids = data.get("matched_product_ids", [])
        
        matched = [p for p in all_products if p['ProductID'] in matched_ids]
        
        return {"identification": desc, "matched_products": matched}

    except Exception as e:
        logging.error(f"Gemini OCR error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR service error: {e}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

SAMPLE_PRODUCTS_SEED = [
    {
        "ProductName": "Gạo ST25 hữu cơ",
        "PathImage": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400",
        "ProductType": "Ngũ cốc",
        "Quantity": 500,
        "Unit": "kg",
        "Price": 85000,
        "Description": "Gạo ST25 hữu cơ đạt chuẩn VietGAP, giống gạo ngon nhất thế giới 2019.",
        "Origin": "Sóc Trăng, Việt Nam",
        "Certification": "VietGAP, USDA Organic",
    },
    {
        "ProductName": "Thanh long Bình Thuận",
        "PathImage": "https://images.unsplash.com/photo-1527325678964-54921661f888?w=400",
        "ProductType": "Trái cây",
        "Quantity": 200,
        "Unit": "kg",
        "Price": 45000,
        "Description": "Thanh long ruột đỏ hữu cơ từ Bình Thuận, giàu vitamin C và chất xơ.",
        "Origin": "Bình Thuận, Việt Nam",
        "Certification": "VietGAP",
    },
    {
        "ProductName": "Cà phê Đắk Lắk hữu cơ",
        "PathImage": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400",
        "ProductType": "Đồ uống",
        "Quantity": 150,
        "Unit": "kg",
        "Price": 350000,
        "Description": "Cà phê Arabica hữu cơ từ cao nguyên Đắk Lắk, chứng nhận USDA Organic.",
        "Origin": "Đắk Lắk, Việt Nam",
        "Certification": "USDA Organic, Rainforest Alliance",
    },
    {
        "ProductName": "Măng cụt Lái Thiêu",
        "PathImage": "https://images.unsplash.com/photo-1634141413395-76e6be727084?w=400",
        "ProductType": "Trái cây",
        "Quantity": 100,
        "Unit": "kg",
        "Price": 120000,
        "Description": "Măng cụt đặc sản Lái Thiêu, Bình Dương. Ngọt thanh, giàu chất chống oxi hóa.",
        "Origin": "Bình Dương, Việt Nam",
        "Certification": "VietGAP",
    },
    {
        "ProductName": "Rau muống hữu cơ",
        "PathImage": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
        "ProductType": "Rau củ",
        "Quantity": 80,
        "Unit": "kg",
        "Price": 25000,
        "Description": "Rau muống hữu cơ tươi ngon, đạt chuẩn TCVN 11041:2015 về rau hữu cơ.",
        "Origin": "Đà Lạt, Việt Nam",
        "Certification": "TCVN 11041:2015, VietGAP",
    },
    {
        "ProductName": "Bơ sáp Đắk Lắk",
        "PathImage": "https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=400",
        "ProductType": "Trái cây",
        "Quantity": 150,
        "Unit": "kg",
        "Price": 65000,
        "Description": "Bơ sáp béo ngậy, ruột vàng, vỏ mỏng. Thu hoạch trực tiếp từ các nông trại hữu cơ tại Đắk Lắk.",
        "Origin": "Đắk Lắk, Việt Nam",
        "Certification": "VietGAP",
    },
    {
        "ProductName": "Nấm hương rừng",
        "PathImage": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400",
        "ProductType": "Rau củ",
        "Quantity": 50,
        "Unit": "kg",
        "Price": 250000,
        "Description": "Nấm hương rừng sấy khô tự nhiên, mùi thơm đặc trưng, giàu protein và khoáng chất.",
        "Origin": "Sapa, Việt Nam",
        "Certification": "Organic",
    },
    {
        "ProductName": "Hạt điều rang muối Bình Phước",
        "PathImage": "https://images.unsplash.com/photo-1536484892006-45a5c0dbabcf?w=400",
        "ProductType": "Ngũ cốc",
        "Quantity": 300,
        "Unit": "hộp",
        "Price": 160000,
        "Description": "Hạt điều nguyên hạt loại 1, rang củi thủ công giữ nguyên vị ngọt bùi tự nhiên.",
        "Origin": "Bình Phước, Việt Nam",
        "Certification": "HACCP, ISO 22000",
    },
    {
        "ProductName": "Mật ong hoa rừng nguyên chất",
        "PathImage": "https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=400",
        "ProductType": "Gia vị",
        "Quantity": 200,
        "Unit": "lít",
        "Price": 220000,
        "Description": "Mật ong thu hoạch tự nhiên từ rừng nhiệt đới, nguyên chất 100%, không pha trộn đường.",
        "Origin": "Gia Lai, Việt Nam",
        "Certification": "USDA Organic",
    },
    {
        "ProductName": "Trà xanh Thái Nguyên",
        "PathImage": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
        "ProductType": "Đồ uống",
        "Quantity": 120,
        "Unit": "kg",
        "Price": 380000,
        "Description": "Trà búp xanh thượng hạng, quy trình trồng và chế biến đạt chuẩn VietGAP, nước trong, hậu ngọt.",
        "Origin": "Thái Nguyên, Việt Nam",
        "Certification": "VietGAP",
    },
]


async def _seed_admin_user():
    """Ensure default admin user exists. Credentials come from env."""
    admin_username = os.environ.get('ADMIN_USERNAME', 'admin68')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'password123')

    existing_admin = await db.admins.find_one({"username": admin_username})
    if existing_admin:
        return

    hashed_password = bcrypt.hashpw(
        admin_password.encode('utf-8'), bcrypt.gensalt()
    ).decode('utf-8')
    await db.admins.insert_one({
        "username": admin_username,
        "password": hashed_password,
    })
    logger.info(f"Admin user seeded: {admin_username}")


async def _seed_sample_products():
    """Seed sample Vietnamese organic products if collection is empty."""
    product_count = await db.products.count_documents({})
    if product_count > 0:
        # Update images of existing products that still use placeholder images
        image_map = {item["ProductName"]: item["PathImage"] for item in SAMPLE_PRODUCTS_SEED}
        for name, url in image_map.items():
            await db.products.update_one(
                {"ProductName": name, "PathImage": {"$regex": "placehold\.co"}},
                {"$set": {"PathImage": url}}
            )
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    products = [
        {
            **item,
            "ProductID": str(uuid.uuid4()),
            "CreateDate": now_iso,
            "UpdateDate": now_iso,
        }
        for item in SAMPLE_PRODUCTS_SEED
    ]
    await db.products.insert_many(products)
    logger.info("Vietnamese sample products seeded")


@app.on_event("startup")
async def startup_db():
    await _seed_admin_user()
    await _seed_sample_products()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()