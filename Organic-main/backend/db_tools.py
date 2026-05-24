"""
Export / Import / Backup cho database.

Cách dùng:
    python db_tools.py export             # xuất tất cả collection ra backups/export_<timestamp>/
    python db_tools.py export --dir my_backup
    python db_tools.py import backups/export_20260118_120000   # nhập từ thư mục đã xuất
    python db_tools.py import my_backup --drop                 # xoá collection cũ rồi nhập
    python db_tools.py list               # liệt kê các bản backup

Định dạng: JSON thuần (1 file/collection) - dễ đọc, dễ sửa bằng bất kỳ editor nào,
hoạt động trên mọi OS, không phụ thuộc lệnh `mongodump`.
"""
import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
BACKUPS_DIR = ROOT / "backups"

COLLECTIONS = ["admins", "users", "products", "cart", "chat_history", "contacts", "orders"]


class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return {"$oid": str(o)}
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)


def decode_mongo_types(obj):
    if isinstance(obj, dict):
        if set(obj.keys()) == {"$oid"}:
            return ObjectId(obj["$oid"])
        return {k: decode_mongo_types(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [decode_mongo_types(v) for v in obj]
    return obj


async def export_db(target_dir: Path):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    target_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n📤 Export: {DB_NAME} → {target_dir}\n")
    meta = {
        "database": DB_NAME,
        "mongo_url": MONGO_URL,
        "exported_at": datetime.now().isoformat(),
        "collections": {},
    }

    for col in COLLECTIONS:
        docs = await db[col].find({}).to_list(None)
        file_path = target_dir / f"{col}.json"
        with file_path.open("w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False, indent=2, cls=MongoJSONEncoder)
        meta["collections"][col] = len(docs)
        print(f"   ✓ {col:15s} {len(docs):4d} doc → {file_path.name}")

    with (target_dir / "_meta.json").open("w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    total = sum(meta["collections"].values())
    print(f"\n✅ Đã xuất {total} documents.\n   Thư mục: {target_dir}")
    client.close()


async def import_db(source_dir: Path, drop: bool):
    if not source_dir.exists():
        print(f"❌ Không tìm thấy thư mục: {source_dir}")
        sys.exit(1)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"\n📥 Import: {source_dir} → {DB_NAME}")
    if drop:
        print("   ⚠️  Chế độ --drop: sẽ XOÁ dữ liệu cũ")
    print()

    total = 0
    for col in COLLECTIONS:
        file_path = source_dir / f"{col}.json"
        if not file_path.exists():
            print(f"   • {col}: (bỏ qua, không có file)")
            continue
        with file_path.open("r", encoding="utf-8") as f:
            docs = json.load(f)
        docs = [decode_mongo_types(d) for d in docs]

        if drop:
            await db[col].delete_many({})
        if docs:
            await db[col].insert_many(docs)
        total += len(docs)
        print(f"   ✓ {col:15s} {len(docs):4d} doc")

    print(f"\n✅ Đã nhập {total} documents.")
    client.close()


def list_backups():
    if not BACKUPS_DIR.exists():
        print("Chưa có bản backup nào (thư mục backups/ trống).")
        return
    items = sorted([p for p in BACKUPS_DIR.iterdir() if p.is_dir()], reverse=True)
    if not items:
        print("Chưa có bản backup nào.")
        return
    print(f"\n📦 Danh sách backup trong {BACKUPS_DIR}:\n")
    for p in items:
        meta_file = p / "_meta.json"
        info = ""
        if meta_file.exists():
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            total = sum(meta.get("collections", {}).values())
            info = f" — {total} docs — {meta.get('exported_at', '')[:19]}"
        print(f"   • {p.name}{info}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Export / Import / Backup MongoDB")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_export = sub.add_parser("export", help="Xuất DB ra file JSON")
    p_export.add_argument("--dir", default=None, help="Thư mục đích (mặc định: backups/export_<timestamp>)")

    p_import = sub.add_parser("import", help="Nhập DB từ thư mục đã xuất")
    p_import.add_argument("source", help="Thư mục chứa file .json đã xuất")
    p_import.add_argument("--drop", action="store_true", help="Xoá collection cũ trước khi nhập")

    sub.add_parser("list", help="Liệt kê các bản backup")

    args = parser.parse_args()

    if args.cmd == "export":
        target = Path(args.dir) if args.dir else BACKUPS_DIR / f"export_{datetime.now():%Y%m%d_%H%M%S}"
        asyncio.run(export_db(target))
    elif args.cmd == "import":
        asyncio.run(import_db(Path(args.source), args.drop))
    elif args.cmd == "list":
        list_backups()


if __name__ == "__main__":
    main()
