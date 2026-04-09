# Şakarlar SW - PRD

## Problem Statement
Internal warehouse mobile application for quickly checking product prices. No login, no cart, just fast price lookup.

## Architecture
- **Frontend**: Expo React Native (SDK 54) - expo-router file-based navigation
- **Backend**: FastAPI + Motor (async MongoDB) - Python
- **Database**: MongoDB
- **Search**: rapidfuzz in-memory fuzzy search with Turkish char normalization

## Core Requirements (Static)
- Search products with live fuzzy search supporting Turkish characters (ç,ğ,ı,ö,ş,ü)
- Barcode scanning via camera with wide horizontal rectangle overlay
- Speed Mode: full-screen white price display, auto-continue after 1 second
- Category filter: Tümü / Temizlik / Ambalaj / Gıda
- Admin panel: add/edit/delete products manually + Excel/CSV bulk import (REPLACE ALL)
- No login system required
- Must work smoothly with 1000+ products
- Currency: Turkish Lira (₺)
- Smart sorting: popular (search_count DESC) > recent (last_searched_at DESC) > others

## User Personas
- **Depo Personeli (Warehouse Staff)**: Primary user, looks up prices quickly
- **Yönetici (Manager)**: Manages product catalog via admin panel

## What's Been Implemented

### v1 (April 2026) - Initial MVP
- Basic product CRUD, fuzzy search, barcode scanner, admin panel, 30 seed products

### v2 (April 2026) - Major Update
- Removed all food products
- Added `category` field (temizlik/ambalaj) to all products
- Added category filter buttons (Tümü/Temizlik/Ambalaj) on main screen
- 45 seed products: 25 temizlik + 20 ambalaj
- Speed Mode: full-screen WHITE overlay with giant dark price (1 second, auto-return)
- Barcode not found: auto-return after 1 second
- Animated price reveal (opacity fade-in on result)
- Admin stats shows total + temizlik + ambalaj counts
- Add/edit product form includes category picker
- Improved fuzzy search (added WRatio scoring)

### v3 (April 2026) - Feature Update
- **Gıda category added**: 4 categories now (Tümü/Temizlik/Ambalaj/Gıda), 55 seed products
- **Smart sorting**: search_count DESC → last_searched_at DESC → fuzzy score
- **Barcode scanner**: wide horizontal rectangle overlay (3:1 ratio) with animated scan line
- **Excel/CSV import**: DELETE ALL + INSERT approach (full replace), tracks last import date
- **Last import date**: displayed in admin panel below import button
- **Admin add/edit**: 3 category buttons (Temizlik/Ambalaj/Gıda)
- **Bug fixes**: Fixed setGidaCount crash, fixed duplicate StyleSheet syntax error in admin
- **Unknown category handling**: CSV with unknown category → set as 'diger'
- **Barcode deduplication**: duplicate barcodes in CSV → keep last occurrence

### Backend (server.py)
- `GET /api/products?q=&category=` - list/search with category filter + priority sort
- `GET /api/products/barcode/{barcode}` - barcode lookup (auto-increments search_count)
- `GET /api/products/{id}` - single product
- `POST /api/products/{id}/view` - increment search_count
- `POST /api/products` - create with category
- `PUT /api/products/{id}` - update with category
- `DELETE /api/products/{id}` - delete
- `POST /api/products/import` - bulk Excel/CSV REPLACE ALL (auto-detects columns, deduplicates)
- `GET /api/stats` - total + temizlik + ambalaj + gida counts
- `GET /api/settings` - last_import timestamp
- In-memory product cache for instant search
- Auto re-seeds on empty DB

### Frontend Screens
- **index.tsx**: Main search screen, 4 category filter buttons, bottom search+scan bar, priority sort
- **scanner.tsx**: Full-screen camera, horizontal rectangle overlay, speed mode, normal mode
- **product/[id].tsx**: Product detail with large price, correct gıda/ambalaj/temizlik badge
- **admin/index.tsx**: Admin panel with 4-category stats, Excel/CSV import + last import date
- **admin/add.tsx**: Add/Edit product form with Temizlik/Ambalaj/Gıda category picker

### Libraries
- rapidfuzz: fuzzy search (Turkish normalized)
- expo-camera@17.0.10: barcode scanning
- expo-document-picker@14.0.8: file import
- lucide-react-native + react-native-svg: icons
- expo-haptics: vibration feedback

## Prioritized Backlog

### P0 (Done)
- [x] Live fuzzy search with Turkish support
- [x] Category filter (Tümü/Temizlik/Ambalaj/Gıda)
- [x] Speed Mode full-screen price display
- [x] Barcode scanner with camera (horizontal rectangle)
- [x] Admin panel with 4-category stats
- [x] Excel/CSV import (DELETE ALL + INSERT) with last import date
- [x] Manual add/edit/delete with 3-category picker
- [x] Smart search priority sorting

### P1 (Next)
- [ ] Export products to CSV
- [ ] Price history tracking
- [ ] Bulk price update by category
- [ ] Stock quantity tracking

### P2 (Future)
- [ ] Print price labels from app
- [ ] Offline mode with local cache
- [ ] Multiple warehouse support


## User Personas
- **Depo Personeli (Warehouse Staff)**: Primary user, looks up prices quickly
- **Yönetici (Manager)**: Manages product catalog via admin panel

## What's Been Implemented

### v1 (April 2026) - Initial MVP
- Basic product CRUD, fuzzy search, barcode scanner, admin panel, 30 seed products

### v2 (April 2026) - Major Update
- Removed all food products
- Added `category` field (temizlik/ambalaj) to all products
- Added category filter buttons (Tümü/Temizlik/Ambalaj) on main screen
- 45 seed products: 25 temizlik + 20 ambalaj
- Speed Mode: full-screen WHITE overlay with giant dark price (1 second, auto-return)
- Barcode not found: auto-return after 1 second
- Animated price reveal (opacity fade-in on result)
- Admin stats shows total + temizlik + ambalaj counts
- Add/edit product form includes category picker
- Improved fuzzy search (added WRatio scoring)

### Backend (server.py)
- `GET /api/products?q=&category=` - list/search with category filter
- `GET /api/products/barcode/{barcode}` - barcode lookup
- `GET /api/products/{id}` - single product
- `POST /api/products` - create with category
- `PUT /api/products/{id}` - update with category
- `DELETE /api/products/{id}` - delete
- `POST /api/products/import` - bulk CSV/Excel import (auto-detects category column)
- `GET /api/stats` - total + temizlik + ambalaj counts
- In-memory product cache for instant search
- Auto re-seeds if products lack category field

### Frontend Screens
- **index.tsx**: Main search screen, category filter buttons, bottom search+scan bar
- **scanner.tsx**: Full-screen camera, speed mode (white full-screen price overlay), normal mode (bottom sheet)
- **product/[id].tsx**: Product detail with large 64px price, category badge, barcode
- **admin/index.tsx**: Admin panel with category breakdown stats, CSV/Excel import
- **admin/add.tsx**: Add/Edit product form with Temizlik/Ambalaj category picker

### Libraries
- rapidfuzz: fuzzy search (Turkish normalized)
- expo-camera@17.0.10: barcode scanning
- expo-document-picker@14.0.8: file import
- lucide-react-native + react-native-svg: icons
- expo-haptics: vibration feedback

## Prioritized Backlog

### P0 (Done)
- [x] Live fuzzy search with Turkish support
- [x] Category filter (Tümü/Temizlik/Ambalaj)
- [x] Speed Mode full-screen price display
- [x] Barcode scanner with camera
- [x] Admin panel with category breakdown
- [x] CSV/Excel import with category column support
- [x] Manual add/edit/delete with category
- [x] Only cleaning + packaging products

### P1 (Next)
- [ ] Export products to CSV
- [ ] Price history tracking
- [ ] Bulk price update by category
- [ ] Stock quantity tracking

### P2 (Future)
- [ ] Print price labels from app
- [ ] Offline mode with local cache
- [ ] Multiple warehouse support
