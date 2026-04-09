"""Backend tests for Şakarlar SW warehouse app"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

# Stats & counts
class TestStats:
    def test_stats_total_45(self, client):
        r = client.get(f"{BASE_URL}/api/stats")
        assert r.status_code == 200
        data = r.json()
        assert data['total_products'] == 45, f"Expected 45, got {data['total_products']}"

    def test_stats_temizlik_25(self, client):
        r = client.get(f"{BASE_URL}/api/stats")
        data = r.json()
        assert data['temizlik'] == 25, f"Expected 25, got {data['temizlik']}"

    def test_stats_ambalaj_20(self, client):
        r = client.get(f"{BASE_URL}/api/stats")
        data = r.json()
        assert data['ambalaj'] == 20, f"Expected 20, got {data['ambalaj']}"

# Category filter
class TestCategoryFilter:
    def test_all_products(self, client):
        r = client.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 45, f"Expected 45, got {len(data)}"

    def test_temizlik_filter(self, client):
        r = client.get(f"{BASE_URL}/api/products?category=temizlik")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 25, f"Expected 25, got {len(data)}"
        for p in data:
            assert p['category'] == 'temizlik'

    def test_ambalaj_filter(self, client):
        r = client.get(f"{BASE_URL}/api/products?category=ambalaj")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 20, f"Expected 20, got {len(data)}"
        for p in data:
            assert p['category'] == 'ambalaj'

    def test_no_food_products(self, client):
        r = client.get(f"{BASE_URL}/api/products")
        data = r.json()
        names = [p['product_name'].lower() for p in data]
        food_keywords = ['tuz', 'şeker', 'pirinç', 'makarna']
        found = [n for n in names for k in food_keywords if k in n]
        assert len(found) == 0, f"Found food products: {found}"

# Search
class TestSearch:
    def test_search_cop_returns_cop_poseti(self, client):
        r = client.get(f"{BASE_URL}/api/products?q=cop")
        assert r.status_code == 200
        data = r.json()
        names = [p['product_name'] for p in data]
        found = any('öp' in n or 'op' in n.lower() for n in names)
        assert found, f"'cop' search didn't return çöp poşeti. Got: {names[:5]}"

    def test_search_strecfilm(self, client):
        r = client.get(f"{BASE_URL}/api/products?q=strecfilm")
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        cats = [p['category'] for p in data]
        assert 'ambalaj' in cats

    def test_search_with_category(self, client):
        r = client.get(f"{BASE_URL}/api/products?q=cop&category=temizlik")
        assert r.status_code == 200
        data = r.json()
        for p in data:
            assert p['category'] == 'temizlik'

# Barcode
class TestBarcode:
    def test_barcode_lookup(self, client):
        r = client.get(f"{BASE_URL}/api/products/barcode/8690001001001")
        assert r.status_code == 200
        data = r.json()
        assert data['barcode'] == '8690001001001'

    def test_barcode_not_found(self, client):
        r = client.get(f"{BASE_URL}/api/products/barcode/0000000000000")
        assert r.status_code == 404

# CRUD
class TestCRUD:
    created_id = None

    def test_create_product(self, client):
        r = client.post(f"{BASE_URL}/api/products", json={
            "product_name": "TEST_Deneme Urunu",
            "barcode": "TEST9999999999",
            "price": 10.0,
            "category": "temizlik"
        })
        assert r.status_code == 200
        data = r.json()
        assert data['category'] == 'temizlik'
        TestCRUD.created_id = data['id']

    def test_update_product(self, client):
        if not TestCRUD.created_id:
            pytest.skip("No product to update")
        r = client.put(f"{BASE_URL}/api/products/{TestCRUD.created_id}", json={"category": "ambalaj"})
        assert r.status_code == 200
        assert r.json()['category'] == 'ambalaj'

    def test_delete_product(self, client):
        if not TestCRUD.created_id:
            pytest.skip("No product to delete")
        r = client.delete(f"{BASE_URL}/api/products/{TestCRUD.created_id}")
        assert r.status_code == 200
        r2 = client.get(f"{BASE_URL}/api/products/{TestCRUD.created_id}")
        assert r2.status_code == 404
