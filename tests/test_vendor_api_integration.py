#!/usr/bin/env python3
"""
Integration tests for Vendor API endpoints (Step 18)
"""

import sys
import os
import pytest
import json
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from web_viewer import app

def _unique_email():
    return f"vendor-test-{int(time.time() * 1000)}@test.example.com"


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestVendorAPI:
    def test_get_all_vendors(self, client):
        """Test GET /api/v1/vendors"""
        r = client.get("/api/v1/vendors")
        assert r.status_code == 200
        d = json.loads(r.data)
        assert d["success"] is True
        assert "data" in d
        assert isinstance(d["data"], list)
        assert "pagination" in d
        assert "total" in d["pagination"] and "page" in d["pagination"]

    def test_get_vendors_with_filters(self, client):
        """Test GET /api/v1/vendors?is_active=true"""
        r = client.get("/api/v1/vendors?is_active=true")
        assert r.status_code == 200
        d = json.loads(r.data)
        assert d["success"] is True
        if d["data"]:
            assert all(v.get("is_active") is True for v in d["data"])

    def test_create_vendor(self, client):
        """Test POST /api/v1/vendors (Test 1: Office Supply Co)"""
        payload = {
            "vendor_name": "Office Supply Co",
            "contact_name": "Jane Doe",
            "email": _unique_email(),
            "phone": "555-0100",
            "payment_terms_days": 30,
            "is_1099_vendor": False,
        }
        r = client.post(
            "/api/v1/vendors",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert r.status_code == 201
        d = json.loads(r.data)
        assert d["success"] is True
        assert d["data"]["vendor_name"] == "Office Supply Co"
        assert d["data"]["contact_name"] == "Jane Doe"
        assert "vendor_number" in d["data"]
        assert d["data"]["vendor_number"].startswith("VEND-")
        vid = int(d["data"]["id"])
        # Cleanup
        client.delete(f"/api/v1/vendors/{vid}")

    def test_create_1099_vendor(self, client):
        """Test POST 1099 vendor with tax_id (Test 2)"""
        payload = {
            "vendor_name": "John Smith Consulting",
            "email": _unique_email(),
            "tax_id": "12-3456789",
            "is_1099_vendor": True,
        }
        r = client.post(
            "/api/v1/vendors",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert r.status_code == 201
        d = json.loads(r.data)
        assert d["success"] is True
        assert d["data"]["is_1099_vendor"] is True
        assert d["data"]["tax_id"] == "12-3456789"
        vid = int(d["data"]["id"])
        client.delete(f"/api/v1/vendors/{vid}")

    def test_create_vendor_invalid(self, client):
        """Test POST with missing vendor_name"""
        r = client.post(
            "/api/v1/vendors",
            data=json.dumps({"contact_name": "Nobody"}),
            content_type="application/json",
        )
        assert r.status_code == 400
        d = json.loads(r.data)
        assert d["success"] is False

    def test_get_1099_vendors(self, client):
        """Test GET /api/v1/vendors/1099 (Test 4)"""
        r = client.get("/api/v1/vendors/1099")
        assert r.status_code == 200
        d = json.loads(r.data)
        assert d["success"] is True
        assert "data" in d
        assert "count" in d
        assert isinstance(d["data"], list)

    def test_search_vendors(self, client):
        """Test GET /api/v1/vendors/search?q=office (Test 5)"""
        r = client.get("/api/v1/vendors/search?q=office")
        assert r.status_code == 200
        d = json.loads(r.data)
        assert d["success"] is True
        assert isinstance(d["data"], list)

    def test_search_vendors_short_term(self, client):
        """Search term < 2 chars returns 400"""
        r = client.get("/api/v1/vendors/search?q=a")
        assert r.status_code == 400

    def test_get_vendor_by_id(self, client):
        """Test GET /api/v1/vendors/:id"""
        r = client.get("/api/v1/vendors")
        d = json.loads(r.data)
        if not d.get("data"):
            pytest.skip("No vendors in DB")
        vid = int(d["data"][0]["id"])
        r2 = client.get(f"/api/v1/vendors/{vid}")
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        assert int(d2["data"]["id"]) == vid

    def test_get_vendor_balance(self, client):
        """Test GET /api/v1/vendors/:id/balance (Test 6)"""
        r = client.get("/api/v1/vendors")
        d = json.loads(r.data)
        if not d.get("data"):
            pytest.skip("No vendors in DB")
        vid = int(d["data"][0]["id"])
        r2 = client.get(f"/api/v1/vendors/{vid}/balance")
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        b = d2["data"]
        assert "vendor_id" in b
        assert "total_billed" in b
        assert "total_paid" in b
        assert "balance_due" in b
        assert "overdue_amount" in b

    def test_get_vendor_bills(self, client):
        """Test GET /api/v1/vendors/:id/bills"""
        r = client.get("/api/v1/vendors")
        d = json.loads(r.data)
        if not d.get("data"):
            pytest.skip("No vendors in DB")
        vid = int(d["data"][0]["id"])
        r2 = client.get(f"/api/v1/vendors/{vid}/bills")
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        assert isinstance(d2["data"], list)

    def test_get_vendor_statement(self, client):
        """Test GET /api/v1/vendors/:id/statement"""
        r = client.get("/api/v1/vendors")
        d = json.loads(r.data)
        if not d.get("data"):
            pytest.skip("No vendors in DB")
        vid = int(d["data"][0]["id"])
        r2 = client.get(f"/api/v1/vendors/{vid}/statement")
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        s = d2["data"]
        assert "vendor" in s
        assert "balance" in s
        assert "bills" in s

    def test_update_vendor(self, client):
        """Test PUT /api/v1/vendors/:id"""
        payload = {
            "vendor_name": "Tmp Vendor",
            "contact_name": "Tmp",
            "email": _unique_email(),
            "payment_terms_days": 15,
        }
        r = client.post("/api/v1/vendors", data=json.dumps(payload), content_type="application/json")
        if r.status_code != 201:
            pytest.skip("Create failed")
        d = json.loads(r.data)
        vid = int(d["data"]["id"])
        r2 = client.put(
            f"/api/v1/vendors/{vid}",
            data=json.dumps({"vendor_name": "Tmp Vendor Updated", "payment_terms_days": 7}),
            content_type="application/json",
        )
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["data"]["vendor_name"] == "Tmp Vendor Updated"
        assert d2["data"]["payment_terms_days"] == 7
        client.delete(f"/api/v1/vendors/{vid}")

    def test_toggle_vendor_status(self, client):
        """Test PATCH /api/v1/vendors/:id/toggle-status"""
        r = client.post(
            "/api/v1/vendors",
            data=json.dumps({"vendor_name": "Tmp Toggle Vendor", "email": _unique_email()}),
            content_type="application/json",
        )
        if r.status_code != 201:
            pytest.skip("Create failed")
        d = json.loads(r.data)
        vid = int(d["data"]["id"])
        was_active = d["data"]["is_active"]
        r2 = client.patch(f"/api/v1/vendors/{vid}/toggle-status")
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["data"]["is_active"] is not was_active
        client.delete(f"/api/v1/vendors/{vid}")

    def test_delete_vendor(self, client):
        """Test DELETE /api/v1/vendors/:id"""
        r = client.post(
            "/api/v1/vendors",
            data=json.dumps({"vendor_name": "Tmp Delete Vendor", "email": _unique_email()}),
            content_type="application/json",
        )
        if r.status_code != 201:
            pytest.skip("Create failed")
        d = json.loads(r.data)
        vid = int(d["data"]["id"])
        r2 = client.delete(f"/api/v1/vendors/{vid}")
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        r3 = client.get(f"/api/v1/vendors/{vid}")
        assert r3.status_code == 404

    def test_get_vendor_404(self, client):
        """Test GET /api/v1/vendors/999999"""
        r = client.get("/api/v1/vendors/999999")
        assert r.status_code == 404
