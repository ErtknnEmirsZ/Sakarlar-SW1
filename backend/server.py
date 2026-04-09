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
    category: str = "temizlik"   # temizlik | ambalaj


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    barcode: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None


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


def fuzzy_search(products: List[dict], query: str, threshold: int = 35) -> List[dict]:
    norm_q = normalize_turkish(query)
    results = []
    for p in products:
        sn = p.get('search_name', normalize_turkish(p['product_name']))
        score = max(
            fuzz.partial_ratio(norm_q, sn),
            fuzz.token_sort_ratio(norm_q, sn),
            fuzz.WRatio(norm_q, sn),
        )
        if score >= threshold:
            results.append((p, score))
    results.sort(key=lambda x: x[1], reverse=True)
    return [r[0] for r in results[:80]]


# ─── Routes ───────────────────────────────────────────────────────────────────
@api_router.get("/products")
async def get_products(q: Optional[str] = None, category: Optional[str] = None):
    products = await get_cached_products()
    # Category filter
    if category and category not in ('all', 'tumu', ''):
        products = [p for p in products if p.get('category', '') == category]
    # Fuzzy search
    if q and q.strip():
        return fuzzy_search(products, q.strip())
    return products


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
    cat_col = next(
        (c for c in df.columns if any(k in c for k in ['category', 'kategori', 'cat'])),
        None
    )

    if not all([name_col, barcode_col, price_col]):
        raise HTTPException(
            status_code=400,
            detail="Sütunlar bulunamadı. CSV'de: product_name, barcode, price sütunları olmalıdır."
        )

    to_insert = []
    now = datetime.now(timezone.utc).isoformat()
    for _, row in df.iterrows():
        try:
            name = str(row[name_col]).strip()
            barcode = str(row[barcode_col]).strip()
            price_str = str(row[price_col]).replace(',', '.').strip()
            price = float(price_str)
            category = str(row[cat_col]).strip().lower() if cat_col else "temizlik"
            if category not in ('temizlik', 'ambalaj'):
                category = 'temizlik'
            if name and barcode and name != 'nan' and price >= 0:
                to_insert.append({
                    "id": str(uuid.uuid4()),
                    "product_name": name,
                    "barcode": barcode,
                    "price": price,
                    "category": category,
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
        "category": data.category,
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
    temizlik = await db.products.count_documents({"category": "temizlik"})
    ambalaj = await db.products.count_documents({"category": "ambalaj"})
    return {"total_products": count, "temizlik": temizlik, "ambalaj": ambalaj}


# ─── Include router ───────────────────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Seed data (ONLY cleaning & packaging) ───────────────────────────────────
SEED_PRODUCTS = [
    # ── TEMİZLİK ──────────────────────────────────────────────
    ("Çöp Poşeti Büyük Boy 10'lu",        "8690001001001", 12.50,  "temizlik"),
    ("Çöp Poşeti Orta Boy 20'li",          "8690001001002",  9.90,  "temizlik"),
    ("Çöp Poşeti Küçük Boy 30'lu",         "8690001001003",  7.75,  "temizlik"),
    ("Çamaşır Suyu 5L",                    "8690001001004", 85.00,  "temizlik"),
    ("Çamaşır Suyu 1L",                    "8690001001005", 22.50,  "temizlik"),
    ("Bulaşık Deterjanı 750ml",            "8690001001006", 38.90,  "temizlik"),
    ("Bulaşık Deterjanı 3L",               "8690001001007", 95.00,  "temizlik"),
    ("Toz Deterjan 3kg",                   "8690001001008",145.00,  "temizlik"),
    ("Çamaşır Makinesi Kapsülü 30'lu",     "8690001001009",185.00,  "temizlik"),
    ("Yumuşatıcı 1L",                      "8690001001010", 48.50,  "temizlik"),
    ("WC Temizleyici 750ml",               "8690001001011", 32.00,  "temizlik"),
    ("Banyo Temizleyici 750ml",            "8690001001012", 35.00,  "temizlik"),
    ("Cam Temizleyici 750ml",              "8690001001013", 28.00,  "temizlik"),
    ("Yüzey Temizleyici 1L",               "8690001001014", 42.00,  "temizlik"),
    ("Kağıt Havlu 4'lü",                   "8690001001015", 32.50,  "temizlik"),
    ("Kağıt Havlu 8'li",                   "8690001001016", 58.00,  "temizlik"),
    ("Tuvalet Kağıdı 12'li",               "8690001001017", 72.00,  "temizlik"),
    ("Islak Mendil 80'li",                 "8690001001018", 22.00,  "temizlik"),
    ("Sünger Sarı-Yeşil 5'li",             "8690001001019", 18.50,  "temizlik"),
    ("El Sabunu 500ml",                    "8690001001020", 35.00,  "temizlik"),
    ("Dezenfektan Sprey 1L",               "8690001001021", 65.00,  "temizlik"),
    ("Klor 4L",                            "8690001001022", 55.00,  "temizlik"),
    ("Yağ Çözücü Sprey 500ml",             "8690001001023", 45.00,  "temizlik"),
    ("Peçete 100'lü",                      "8690001001024", 12.00,  "temizlik"),
    ("Havlu Dispenser Kağıt 200'lü",       "8690001001025", 48.00,  "temizlik"),
    # ── AMBALAJ ───────────────────────────────────────────────
    ("Streç Film 50cm x 300m",             "8690001002001",125.00,  "ambalaj"),
    ("Streç Film 100cm x 100m",            "8690001002002",185.00,  "ambalaj"),
    ("Koli Bandı 45mm x 100m",             "8690001002003", 22.00,  "ambalaj"),
    ("Koli Bandı 50mm x 100m",             "8690001002004", 28.00,  "ambalaj"),
    ("Koli Bandı Şeffaf 12'li Paket",      "8690001002005",145.00,  "ambalaj"),
    ("Kraft Kağıt 50cm x 50m",             "8690001002006", 85.00,  "ambalaj"),
    ("Balonlu Naylon 50cm x 50m",          "8690001002007", 95.00,  "ambalaj"),
    ("Kağıt Poşet Büyük 100'lü",           "8690001002008", 65.00,  "ambalaj"),
    ("Kağıt Poşet Küçük 100'lü",           "8690001002009", 45.00,  "ambalaj"),
    ("Plastik Torba 25x35 1000'li",        "8690001002010", 85.00,  "ambalaj"),
    ("Plastik Torba 35x50 500'li",         "8690001002011", 72.00,  "ambalaj"),
    ("Etiket Rulo 100x150 500'li",         "8690001002012",125.00,  "ambalaj"),
    ("Etiket Rulo 50x30 1000'li",          "8690001002013", 95.00,  "ambalaj"),
    ("Nakliye Kolisi 30x30x30",            "8690001002014", 12.50,  "ambalaj"),
    ("Nakliye Kolisi 40x40x40",            "8690001002015", 18.00,  "ambalaj"),
    ("Nakliye Kolisi 60x40x40",            "8690001002016", 25.00,  "ambalaj"),
    ("Köpük Naylon Rulo 1m x 50m",         "8690001002017",155.00,  "ambalaj"),
    ("Karton Bölücü 30x30",                "8690001002018",  8.50,  "ambalaj"),
    ("Vakum Torbası 30x40 10'lu",          "8690001002019", 35.00,  "ambalaj"),
    ("Streç Eldiven L Beden 100'lü",       "8690001002020", 45.00,  "ambalaj"),
]


@app.on_event("startup")
async def startup():
    # Re-seed if no products or if products lack category field
    count = await db.products.count_documents({})
    sample = await db.products.find_one({})
    needs_reseed = count == 0 or (sample and 'category' not in sample)

    if needs_reseed:
        await db.products.drop()
        now = datetime.now(timezone.utc).isoformat()
        products = [
            {
                "id": str(uuid.uuid4()),
                "product_name": name,
                "barcode": barcode,
                "price": price,
                "category": category,
                "search_name": normalize_turkish(name),
                "created_at": now,
                "updated_at": now,
            }
            for name, barcode, price, category in SEED_PRODUCTS
        ]
        await db.products.insert_many(products)
        logger.info(f"Re-seeded {len(products)} products (temizlik + ambalaj)")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
