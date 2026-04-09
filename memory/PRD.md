# Şakarlar SW - PRD

## Problem Statement
Internal warehouse mobile application for quickly checking product prices. No login, no cart, just fast price lookup.

## Architecture
- **Frontend**: Expo React Native (SDK 54) - expo-router file-based navigation
- **Backend**: FastAPI + Motor (async MongoDB) - Python
- **Database**: MongoDB
- **Search**: rapidfuzz in-memory fuzzy search with Turkish normalization

## Core Requirements (Static)
- Search products with live fuzzy search supporting Turkish characters (ç,ğ,ı,ö,ş,ü)
- Barcode scanning via camera
- Speed Mode: auto-continue scanning after each successful scan
- Admin panel: add/edit/delete products manually + CSV/Excel bulk import
- No login system required
- Must work smoothly with 1000+ products
- Currency: Turkish Lira (₺)

## User Personas
- **Depo Personeli (Warehouse Staff)**: Primary user, looks up prices quickly
- **Yönetici (Manager)**: Manages product catalog via admin panel

## What's Been Implemented (April 2026)
### Backend (server.py)
- `GET /api/products?q=` - list all or fuzzy search
- `GET /api/products/barcode/{barcode}` - barcode lookup
- `GET /api/products/{id}` - single product
- `POST /api/products` - create product
- `PUT /api/products/{id}` - update product
- `DELETE /api/products/{id}` - delete product
- `POST /api/products/import` - bulk CSV/Excel import
- `GET /api/stats` - total product count
- Turkish character normalization (ç→c, ğ→g, etc.)
- In-memory product cache for instant search
- 30 seed products on first startup

### Frontend Screens
- **index.tsx**: Main search screen with bottom search bar, speed mode toggle, product list
- **scanner.tsx**: Full-screen camera barcode scanner with overlay, speed mode auto-continue
- **product/[id].tsx**: Product detail with large price display
- **admin/index.tsx**: Admin panel with product list, CSV/Excel import, stats
- **admin/add.tsx**: Add/Edit product form with barcode scan

### Libraries
- rapidfuzz: fuzzy search
- expo-camera@17.0.10: barcode scanning
- expo-document-picker@14.0.8: file import
- lucide-react-native + react-native-svg: icons
- expo-haptics: vibration feedback

## Prioritized Backlog

### P0 (Done)
- [x] Live fuzzy search with Turkish support
- [x] Product list view
- [x] Product detail screen
- [x] Barcode scanner with camera
- [x] Speed Mode
- [x] Admin panel
- [x] CSV/Excel import
- [x] Manual add/edit/delete

### P1 (Next)
- [ ] Export products to CSV
- [ ] Price history tracking
- [ ] Product categories/tags
- [ ] Bulk price update

### P2 (Future)
- [ ] Multi-warehouse support
- [ ] Low-stock alerts
- [ ] Offline mode with local cache
- [ ] Print price labels
