"""Tests for Şakarlar SW product APIs"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

class TestProductList:
    """GET /api/products tests"""

    def test_get_all_products(self, client):
        r = client.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 30, f"Expected 30+ products, got {len(data)}"
        print(f"PASS: {len(data)} products returned")

    def test_product_has_required_fields(self, client):
        r = client.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        p = r.json()[0]
        assert "id" in p
        assert "product_name" in p
        assert "barcode" in p
        assert "price" in p
        assert "_id" not in p, "MongoDB _id should be excluded"
        print("PASS: Product fields correct")

    def test_search_turkish_fuzzy_cop(self, client):
        """Search 'cop' should find 'Çöp Poşeti' via Turkish fuzzy"""
        r = client.get(f"{BASE_URL}/api/products?q=cop")
        assert r.status_code == 200
        data = r.json()
        names = [p['product_name'] for p in data]
        found = any('Çöp' in n for n in names)
        assert found, f"'Çöp Poşeti' not found in results: {names}"
        print(f"PASS: Turkish fuzzy search found: {[n for n in names if 'Çöp' in n]}")

    def test_search_returns_list(self, client):
        r = client.get(f"{BASE_URL}/api/products?q=deterjan")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"PASS: search 'deterjan' returned {len(data)} results")

    def test_search_empty_query(self, client):
        r = client.get(f"{BASE_URL}/api/products?q=")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 30
        print("PASS: empty query returns all products")


class TestBarcodeSearch:
    """GET /api/products/barcode/{barcode}"""

    def test_barcode_lookup(self, client):
        r = client.get(f"{BASE_URL}/api/products/barcode/8690000001001")
        assert r.status_code == 200
        data = r.json()
        assert data['barcode'] == '8690000001001'
        assert 'Çöp' in data['product_name']
        print(f"PASS: barcode lookup returned {data['product_name']}")

    def test_barcode_not_found(self, client):
        r = client.get(f"{BASE_URL}/api/products/barcode/0000000000000")
        assert r.status_code == 404
        print("PASS: non-existent barcode returns 404")


class TestProductCRUD:
    """POST/PUT/DELETE /api/products"""

    created_id = None

    def test_create_product(self, client):
        payload = {"product_name": "TEST_Ürün Deneme", "barcode": "TEST001", "price": 99.99}
        r = client.post(f"{BASE_URL}/api/products", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data['product_name'] == payload['product_name']
        assert data['price'] == 99.99
        assert "id" in data
        TestProductCRUD.created_id = data['id']
        print(f"PASS: Created product id={data['id']}")

    def test_get_created_product(self, client):
        if not TestProductCRUD.created_id:
            pytest.skip("No product created")
        r = client.get(f"{BASE_URL}/api/products/{TestProductCRUD.created_id}")
        assert r.status_code == 200
        data = r.json()
        assert data['id'] == TestProductCRUD.created_id
        print("PASS: Created product persisted in DB")

    def test_update_product(self, client):
        if not TestProductCRUD.created_id:
            pytest.skip("No product created")
        r = client.put(f"{BASE_URL}/api/products/{TestProductCRUD.created_id}", json={"price": 149.99})
        assert r.status_code == 200
        data = r.json()
        assert data['price'] == 149.99
        print("PASS: Update product price")

    def test_delete_product(self, client):
        if not TestProductCRUD.created_id:
            pytest.skip("No product created")
        r = client.delete(f"{BASE_URL}/api/products/{TestProductCRUD.created_id}")
        assert r.status_code == 200
        # Verify gone
        r2 = client.get(f"{BASE_URL}/api/products/{TestProductCRUD.created_id}")
        assert r2.status_code == 404
        print("PASS: Product deleted and confirmed 404")

    def test_delete_nonexistent(self, client):
        r = client.delete(f"{BASE_URL}/api/products/nonexistent-id-12345")
        assert r.status_code == 404
        print("PASS: Delete non-existent returns 404")


class TestStats:
    def test_stats(self, client):
        r = client.get(f"{BASE_URL}/api/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total_products" in data
        assert data['total_products'] >= 30
        print(f"PASS: stats total_products={data['total_products']}")
