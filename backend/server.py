from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Tuple
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
        ('Ç', 'c'), ('Ğ', 'g'), ('İ', 'i'), ('Ö', 'o'), ('Ş', 's'), ('Ü', 'u'),
    ]:
        text = text.replace(src, dst)
    return text


# ─── Models ───────────────────────────────────────────────────────────────────
class ProductCreate(BaseModel):
    product_name: str
    barcode: str
    price: float
    category: str = "temizlik"          # temizlik | ambalaj | gida


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


# ─── Priority sort ────────────────────────────────────────────────────────────
def ts_to_neg(ts: Optional[str]) -> float:
    """Converts ISO timestamp to negative float for descending sort. None → +inf."""
    if not ts:
        return float('inf')
    try:
        return -datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp()
    except Exception:
        return float('inf')


def sort_by_priority(results: List[Tuple[dict, float]]) -> List[dict]:
    """Sort: most popular → recently searched → by fuzzy score."""
    results.sort(key=lambda x: (
        -(x[0].get('search_count', 0) or 0),   # popular first
        ts_to_neg(x[0].get('last_searched_at')),  # recently searched
        -x[1],                                    # highest fuzzy score
    ))
    return [r[0] for r in results]


# ─── Fuzzy search ─────────────────────────────────────────────────────────────
def fuzzy_search(products: List[dict], query: str, threshold: int = 35) -> List[dict]:
    norm_q = normalize_turkish(query)
    results: List[Tuple[dict, float]] = []
    for p in products:
        sn = p.get('search_name', normalize_turkish(p['product_name']))
        score = max(
            fuzz.partial_ratio(norm_q, sn),
            fuzz.token_sort_ratio(norm_q, sn),
            fuzz.WRatio(norm_q, sn),
        )
        if score >= threshold:
            results.append((p, score))
    return sort_by_priority(results)[:80]


# ─── Count helper (in-place, no full cache invalidation) ─────────────────────
async def increment_product_count(product_id: str):
    now = datetime.now(timezone.utc).isoformat()
    await db.products.update_one(
        {"id": product_id},
        {"$inc": {"search_count": 1}, "$set": {"last_searched_at": now}},
    )
    # Update in-memory cache entry directly
    global _products_cache
    if _products_cache:
        for p in _products_cache:
            if p.get('id') == product_id:
                p['search_count'] = (p.get('search_count') or 0) + 1
                p['last_searched_at'] = now
                break


# ─── Routes ───────────────────────────────────────────────────────────────────
@api_router.get("/products")
async def get_products(q: Optional[str] = None, category: Optional[str] = None):
    products = await get_cached_products()
    # Category filter
    if category and category not in ('all', 'tumu', ''):
        products = [p for p in products if p.get('category', '') == category]
    # No query → return all, sorted by popularity
    if not q or not q.strip():
        sorted_all = sort_by_priority([(p, 0) for p in products])
        return sorted_all
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
    cat_col = next(
        (c for c in df.columns if any(k in c for k in ['category', 'kategori', 'cat'])),
        None
    )

    if not all([name_col, barcode_col, price_col]):
        raise HTTPException(
            status_code=400,
            detail="Sütunlar bulunamadı. CSV'de: product_name, barcode, price gereklidir."
        )

    to_insert = []
    seen_barcodes: set = set()
    now = datetime.now(timezone.utc).isoformat()
    for _, row in df.iterrows():
        try:
            name = str(row[name_col]).strip()
            barcode = str(row[barcode_col]).strip()
            # Skip if name or barcode is missing/nan
            if not name or not barcode or name == 'nan' or barcode == 'nan':
                continue
            # Price: default to 0 if missing
            try:
                price_str = str(row[price_col]).replace(',', '.').strip()
                price = float(price_str) if price_str and price_str != 'nan' else 0.0
            except Exception:
                price = 0.0
            raw_cat = str(row[cat_col]).strip().lower() if cat_col else ''
            # Normalize common Turkish variants
            cat_map = {
                'temizlik': 'temizlik',
                'ambalaj': 'ambalaj',
                'gida': 'gida', 'gıda': 'gida', 'g\u0131da': 'gida',
            }
            category = cat_map.get(raw_cat, 'diger')
            # Deduplicate by barcode (keep last occurrence)
            seen_barcodes.add(barcode)
            to_insert.append({
                "id": str(uuid.uuid4()),
                "product_name": name,
                "barcode": barcode,
                "price": price,
                "category": category,
                "search_name": normalize_turkish(name),
                "search_count": 0,
                "last_searched_at": None,
                "created_at": now,
                "updated_at": now,
            })
        except Exception:
            continue

    # Deduplicate: keep last occurrence per barcode
    deduped: dict = {}
    for p in to_insert:
        deduped[p['barcode']] = p
    to_insert = list(deduped.values())

    if not to_insert:
        return {"imported": 0, "total": len(df), "skipped": len(df), "last_import": None}

    # Replace ALL products
    await db.products.delete_many({})
    await db.products.insert_many(to_insert)
    await invalidate_cache()

    # Track last import timestamp
    now_import = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"key": "last_import"},
        {"$set": {"value": now_import}},
        upsert=True,
    )

    return {
        "imported": len(to_insert),
        "total": len(df),
        "skipped": len(df) - len(to_insert),
        "last_import": now_import,
    }


@api_router.get("/products/barcode/{barcode}")
async def get_by_barcode(barcode: str):
    products = await get_cached_products()
    for p in products:
        if p.get('barcode') == barcode:
            # Auto-increment on successful scan (fire and forget)
            import asyncio
            asyncio.create_task(increment_product_count(p['id']))
            return p
    raise HTTPException(status_code=404, detail="Ürün bulunamadı")


@api_router.post("/products/{product_id}/view")
async def view_product(product_id: str):
    """Called when a product detail page is opened."""
    await increment_product_count(product_id)
    return {"ok": True}


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
        "search_count": 0,
        "last_searched_at": None,
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
    total = await db.products.count_documents({})
    temizlik = await db.products.count_documents({"category": "temizlik"})
    ambalaj = await db.products.count_documents({"category": "ambalaj"})
    gida = await db.products.count_documents({"category": "gida"})
    return {"total_products": total, "temizlik": temizlik, "ambalaj": ambalaj, "gida": gida}


@api_router.get("/settings")
async def get_settings():
    setting = await db.settings.find_one({"key": "last_import"}, {"_id": 0})
    return {"last_import": setting["value"] if setting else None}


# ─── Include router ───────────────────────────────────────────────────────────
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# ─── Seed data ────────────────────────────────────────────────────────────────
SEED_TEMIZLIK = [
    ("Çöp Poşeti Büyük Boy 10'lu",        "8690001001001",  12.50),
    ("Çöp Poşeti Orta Boy 20'li",          "8690001001002",   9.90),
    ("Çöp Poşeti Küçük Boy 30'lu",         "8690001001003",   7.75),
    ("Çamaşır Suyu 5L",                    "8690001001004",  85.00),
    ("Çamaşır Suyu 1L",                    "8690001001005",  22.50),
    ("Bulaşık Deterjanı 750ml",            "8690001001006",  38.90),
    ("Bulaşık Deterjanı 3L",               "8690001001007",  95.00),
    ("Toz Deterjan 3kg",                   "8690001001008", 145.00),
    ("Çamaşır Makinesi Kapsülü 30'lu",     "8690001001009", 185.00),
    ("Yumuşatıcı 1L",                      "8690001001010",  48.50),
    ("WC Temizleyici 750ml",               "8690001001011",  32.00),
    ("Banyo Temizleyici 750ml",            "8690001001012",  35.00),
    ("Cam Temizleyici 750ml",              "8690001001013",  28.00),
    ("Yüzey Temizleyici 1L",               "8690001001014",  42.00),
    ("Kağıt Havlu 4'lü",                   "8690001001015",  32.50),
    ("Kağıt Havlu 8'li",                   "8690001001016",  58.00),
    ("Tuvalet Kağıdı 12'li",               "8690001001017",  72.00),
    ("Islak Mendil 80'li",                 "8690001001018",  22.00),
    ("Sünger Sarı-Yeşil 5'li",             "8690001001019",  18.50),
    ("El Sabunu 500ml",                    "8690001001020",  35.00),
    ("Dezenfektan Sprey 1L",               "8690001001021",  65.00),
    ("Klor 4L",                            "8690001001022",  55.00),
    ("Yağ Çözücü Sprey 500ml",             "8690001001023",  45.00),
    ("Peçete 100'lü",                      "8690001001024",  12.00),
    ("Havlu Dispenser Kağıt 200'lü",       "8690001001025",  48.00),
]

SEED_AMBALAJ = [
    ("Streç Film 50cm x 300m",             "8690001002001", 125.00),
    ("Streç Film 100cm x 100m",            "8690001002002", 185.00),
    ("Koli Bandı 45mm x 100m",             "8690001002003",  22.00),
    ("Koli Bandı 50mm x 100m",             "8690001002004",  28.00),
    ("Koli Bandı Şeffaf 12'li Paket",      "8690001002005", 145.00),
    ("Kraft Kağıt 50cm x 50m",             "8690001002006",  85.00),
    ("Balonlu Naylon 50cm x 50m",          "8690001002007",  95.00),
    ("Kağıt Poşet Büyük 100'lü",           "8690001002008",  65.00),
    ("Kağıt Poşet Küçük 100'lü",           "8690001002009",  45.00),
    ("Plastik Torba 25x35 1000'li",        "8690001002010",  85.00),
    ("Plastik Torba 35x50 500'li",         "8690001002011",  72.00),
    ("Etiket Rulo 100x150 500'li",         "8690001002012", 125.00),
    ("Etiket Rulo 50x30 1000'li",          "8690001002013",  95.00),
    ("Nakliye Kolisi 30x30x30",            "8690001002014",  12.50),
    ("Nakliye Kolisi 40x40x40",            "8690001002015",  18.00),
    ("Nakliye Kolisi 60x40x40",            "8690001002016",  25.00),
    ("Köpük Naylon Rulo 1m x 50m",         "8690001002017", 155.00),
    ("Karton Bölücü 30x30",                "8690001002018",   8.50),
    ("Vakum Torbası 30x40 10'lu",          "8690001002019",  35.00),
    ("Streç Eldiven L Beden 100'lü",       "8690001002020",  45.00),
]

SEED_GIDA = [
    ("Tuz 1kg",                            "8690001003001",   7.50),
    ("Şeker 1kg",                          "8690001003002",  25.00),
    ("Un 1kg",                             "8690001003003",  15.75),
    ("Makarna 500g",                       "8690001003004",  14.90),
    ("Pirinç 1kg",                         "8690001003005",  42.00),
    ("Nescafe 200g",                       "8690001003006", 125.00),
    ("Çay Demlik Poşet 100'lü",            "8690001003007",  85.00),
    ("Ayçiçek Yağı 1L",                    "8690001003008",  65.00),
    ("Zeytinyağı 750ml",                   "8690001003009", 145.00),
    ("Su 5L",                              "8690001003010",  12.00),
]


def make_doc(name: str, barcode: str, price: float, category: str, now: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "product_name": name,
        "barcode": barcode,
        "price": price,
        "category": category,
        "search_name": normalize_turkish(name),
        "search_count": 0,
        "last_searched_at": None,
        "created_at": now,
        "updated_at": now,
    }


@app.on_event("startup")
async def startup():
    count = await db.products.count_documents({})
    sample = await db.products.find_one({})

    # Full reseed if no products or old schema (no category)
    if count == 0 or (sample and 'category' not in sample):
        await db.products.drop()
        now = datetime.now(timezone.utc).isoformat()
        docs = (
            [make_doc(n, b, p, 'temizlik', now) for n, b, p in SEED_TEMIZLIK] +
            [make_doc(n, b, p, 'ambalaj', now) for n, b, p in SEED_AMBALAJ] +
            [make_doc(n, b, p, 'gida', now) for n, b, p in SEED_GIDA]
        )
        await db.products.insert_many(docs)
        logger.info(f"Full reseed: {len(docs)} products")
        return

    # Migration 1: add search_count / last_searched_at to old docs
    if sample and 'search_count' not in sample:
        await db.products.update_many(
            {"search_count": {"$exists": False}},
            {"$set": {"search_count": 0, "last_searched_at": None}},
        )
        await invalidate_cache()
        logger.info("Migrated: added search_count field")

    # Migration 2: add gıda products if missing
    gida_count = await db.products.count_documents({"category": "gida"})
    if gida_count == 0:
        now = datetime.now(timezone.utc).isoformat()
        docs = [make_doc(n, b, p, 'gida', now) for n, b, p in SEED_GIDA]
        await db.products.insert_many(docs)
        await invalidate_cache()
        logger.info(f"Migration: added {len(docs)} gıda products")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
