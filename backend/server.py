from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import pandas as pd
import io
from rapidfuzz import fuzz

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─── Turkish normalization ────────────────────────────────────────────────────
def normalize_turkish(text: str) -> str:
    text = text.lower()
    for src, dst in [
        ('ç', 'c'), ('ğ', 'g'), ('ı', 'i'), ('ö', 'o'), ('ş', 's'), ('ü', 'u'),
        ('Ç', 'c'), ('Ğ', 'g'), ('İ', 'i'), ('Ö', 'o'), ('Ş', 's'), ('Ü', 'u')
    ]:
        text = text.replace(src, dst)
    return text


# ─── Pydantic models ──────────────────────────────────────────────────────────
class ProductCreate(BaseModel):
    product_name: str
    barcode: str
    price: float


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    barcode: Optional[str] = None
    price: Optional[float] = None


# ─── In-memory cache ─────────────────────────────────────────────────────────
_products_cache: Optional[List[dict]] = None


async def invalidate_cache():
    global _products_cache
    _products_cache = None


async def get_cached_products() -> List[dict]:
    global _products_cache
    if _products_cache is None:
        docs = await db.products.find({}, {"_id": 0}).to_list(50000)
        _products_cache = docs
    return _products_cache


def fuzzy_search(products: List[dict], query: str, threshold: int = 38) -> List[dict]:
    norm_q = normalize_turkish(query)
    results = []
    for p in products:
        sn = p.get('search_name', normalize_turkish(p['product_name']))
        score = max(
            fuzz.partial_ratio(norm_q, sn),
            fuzz.token_sort_ratio(norm_q, sn)
        )
        if score >= threshold:
            results.append((p, score))
    results.sort(key=lambda x: x[1], reverse=True)
    return [r[0] for r in results[:60]]


# ─── Routes (specific before parameterized!) ─────────────────────────────────
@api_router.get("/products")
async def get_products(q: Optional[str] = None):
    products = await get_cached_products()
    if not q or not q.strip():
        return products
    return fuzzy_search(products, q.strip())


@api_router.post("/products/import")
async def import_products(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename or ""
    try:
        if filename.lower().endswith('.csv'):
            try:
                df = pd.read_csv(io.BytesIO(content), encoding='utf-8-sig')
            except Exception:
                df = pd.read_csv(io.BytesIO(content), encoding='latin-1')
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dosya okunamadı: {str(e)}")

    df.columns = [str(c).strip().lower() for c in df.columns]

    name_col = next(
        (c for c in df.columns if any(k in c for k in ['name', 'ad', 'isim', 'urun', 'ürün', 'product'])),
        df.columns[0] if len(df.columns) > 0 else None
    )
    barcode_col = next(
        (c for c in df.columns if any(k in c for k in ['barcode', 'barkod', 'kod', 'ean', 'bar'])),
        df.columns[1] if len(df.columns) > 1 else None
    )
    price_col = next(
        (c for c in df.columns if any(k in c for k in ['price', 'fiyat', 'tutar', 'ucret', 'ücret'])),
        df.columns[2] if len(df.columns) > 2 else None
    )

    if not all([name_col, barcode_col, price_col]):
        raise HTTPException(
            status_code=400,
            detail="Sütunlar bulunamadı. CSV/Excel'de: product_name, barcode, price sütunları olmalıdır."
        )

    to_insert = []
    now = datetime.now(timezone.utc).isoformat()
    for _, row in df.iterrows():
        try:
            name = str(row[name_col]).strip()
            barcode = str(row[barcode_col]).strip()
            price_str = str(row[price_col]).replace(',', '.').strip()
            price = float(price_str)
            if name and barcode and name != 'nan' and price >= 0:
                to_insert.append({
                    "id": str(uuid.uuid4()),
                    "product_name": name,
                    "barcode": barcode,
                    "price": price,
                    "search_name": normalize_turkish(name),
                    "created_at": now,
                    "updated_at": now,
                })
        except Exception:
            continue

    if to_insert:
        await db.products.insert_many(to_insert)
        await invalidate_cache()

    return {"imported": len(to_insert), "total": len(df), "skipped": len(df) - len(to_insert)}


@api_router.get("/products/barcode/{barcode}")
async def get_by_barcode(barcode: str):
    products = await get_cached_products()
    for p in products:
        if p.get('barcode') == barcode:
            return p
    raise HTTPException(status_code=404, detail="Ürün bulunamadı")


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return doc


@api_router.post("/products")
async def create_product(data: ProductCreate):
    now = datetime.now(timezone.utc).isoformat()
    product = {
        "id": str(uuid.uuid4()),
        "product_name": data.product_name,
        "barcode": data.barcode,
        "price": data.price,
        "search_name": normalize_turkish(data.product_name),
        "created_at": now,
        "updated_at": now,
    }
    await db.products.insert_one(product)
    product.pop("_id", None)
    await invalidate_cache()
    return product


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductUpdate):
    update = {k: v for k, v in data.dict().items() if v is not None}
    if "product_name" in update:
        update["search_name"] = normalize_turkish(update["product_name"])
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.products.update_one({"id": product_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    await invalidate_cache()
    return doc


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    await invalidate_cache()
    return {"message": "Ürün silindi"}


@api_router.get("/stats")
async def get_stats():
    count = await db.products.count_documents({})
    return {"total_products": count}


# ─── Include router ───────────────────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Seed data ────────────────────────────────────────────────────────────────
SEED_PRODUCTS = [
    ("Çöp Poşeti Büyük 10'lu", "8690000001001", 12.50),
    ("Çöp Poşeti Küçük 20'li", "8690000001002", 8.75),
    ("Deterjan Omo 1kg", "8690000001003", 45.90),
    ("Su Bardağı Plastik 100'lü", "8690000001004", 18.00),
    ("Kağıt Havlu 4'lü", "8690000001005", 32.50),
    ("Sünger Bulaşık 2'li", "8690000001006", 6.25),
    ("Tuz 1kg", "8690000001007", 7.50),
    ("Şeker 1kg", "8690000001008", 25.00),
    ("Un 1kg", "8690000001009", 15.75),
    ("Makarna 500g", "8690000001010", 14.90),
    ("Pirinç 1kg", "8690000001011", 42.00),
    ("Zeytinyağı 1L", "8690000001012", 185.00),
    ("Ayçiçek Yağı 1L", "8690000001013", 65.00),
    ("Domates Salçası 700g", "8690000001014", 38.50),
    ("Konserve Bezelye 400g", "8690000001015", 22.00),
    ("Nescafe 200g", "8690000001016", 125.00),
    ("Çay Demlik Poşet 100'lü", "8690000001017", 85.00),
    ("Şampuan 400ml", "8690000001018", 55.00),
    ("Diş Macunu 75ml", "8690000001019", 28.50),
    ("Sabun 4'lü Paket", "8690000001020", 35.00),
    ("Peçete 100'lü", "8690000001021", 12.00),
    ("Tuvalet Kağıdı 24'lü", "8690000001022", 95.00),
    ("Bulaşık Deterjanı 750ml", "8690000001023", 42.00),
    ("Çamaşır Suyu 1L", "8690000001024", 28.00),
    ("Cam Sileceği", "8690000001025", 65.00),
    ("Mendil 10'lu Paket", "8690000001026", 9.50),
    ("Kolonya 400ml", "8690000001027", 45.00),
    ("Plastik Tabak 25'li", "8690000001028", 22.00),
    ("Plastik Çatal 50'li", "8690000001029", 15.00),
    ("Alüminyum Folyo 30m", "8690000001030", 38.00),
]


@app.on_event("startup")
async def startup():
    count = await db.products.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        products = [
            {
                "id": str(uuid.uuid4()),
                "product_name": name,
                "barcode": barcode,
                "price": price,
                "search_name": normalize_turkish(name),
                "created_at": now,
                "updated_at": now,
            }
            for name, barcode, price in SEED_PRODUCTS
        ]
        await db.products.insert_many(products)
        logger.info(f"Seeded {len(products)} products")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
