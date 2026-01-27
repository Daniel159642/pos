#!/usr/bin/env python3
"""
Integration tests for Bill API endpoints (Step 20).

Prerequisite: audit_log table must have an 'action' column (see accounting_schema.sql).
If bill create/update/void/delete fail with "column \"action\" of relation \"audit_log\"
does not exist", run the accounting schema and triggers (e.g. accounting_schema.sql,
accounting_triggers.sql) so audit_log matches the audit_trigger_function.
"""

import sys
import os
import pytest
import json
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from web_viewer import app


def _unique_email():
    return f"bill-vendor-{int(time.time() * 1000)}@test.example.com"


def _get_or_create_vendor(client):
    """Create a vendor for bill tests; return vendor id."""
    r = client.post(
        "/api/v1/vendors",
        data=json.dumps({
            "vendor_name": "Bill Test Vendor",
            "email": _unique_email(),
            "payment_terms_days": 30,
            "is_1099_vendor": False,
        }),
        content_type="application/json",
    )
    assert r.status_code == 201, r.data.decode()
    d = json.loads(r.data)
    return int(d["data"]["id"])


def _get_expense_account_id(client):
    """Get first Expense or COGS account id from chart of accounts."""
    r = client.get("/api/v1/accounts")
    assert r.status_code == 200, r.data.decode()
    d = json.loads(r.data)
    accounts = d.get("data") or []
    for acc in accounts:
        at = (acc.get("account_type") or "").strip()
        if at in ("Expense", "COGS", "Cost of Goods Sold"):
            return int(acc["id"])
    pytest.skip("No Expense/COGS account in chart of accounts")


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestBillAPI:
    def test_get_all_bills(self, client):
        """Test GET /api/v1/bills"""
        r = client.get("/api/v1/bills")
        assert r.status_code == 200
        d = json.loads(r.data)
        assert d["success"] is True
        assert "data" in d
        assert isinstance(d["data"], list)
        assert "pagination" in d
        assert "total" in d["pagination"] and "page" in d["pagination"]

    def test_get_bills_with_filters(self, client):
        """Test GET /api/v1/bills?status=open"""
        r = client.get("/api/v1/bills?status=open")
        assert r.status_code == 200
        d = json.loads(r.data)
        assert d["success"] is True
        if d["data"]:
            for b in d["data"]:
                bill = b.get("bill") or b
                assert bill.get("status") == "open"

    def test_get_overdue_bills(self, client):
        """Test GET /api/v1/bills/overdue"""
        r = client.get("/api/v1/bills/overdue")
        assert r.status_code == 200
        d = json.loads(r.data)
        assert d["success"] is True
        assert "data" in d
        assert "count" in d
        assert isinstance(d["data"], list)

    def test_create_bill(self, client):
        """Test POST /api/v1/bills"""
        vid = _get_or_create_vendor(client)
        acc_id = _get_expense_account_id(client)
        payload = {
            "vendor_id": vid,
            "bill_date": "2024-01-15",
            "vendor_reference": "INV-TEST-001",
            "lines": [
                {
                    "description": "Office Supplies",
                    "quantity": 10,
                    "unit_cost": 25.0,
                    "account_id": acc_id,
                }
            ],
        }
        r = client.post(
            "/api/v1/bills",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert r.status_code == 201, r.data.decode()
        d = json.loads(r.data)
        assert d["success"] is True
        assert "data" in d
        out = d["data"]
        bill = out.get("bill") or out
        assert "bill_number" in bill
        assert str(bill["bill_number"]).startswith("BILL-")
        assert bill["vendor_id"] == vid
        assert float(bill.get("total_amount") or 0) == 250.0
        assert bill.get("status") == "open"
        bid = int(bill["id"])
        # Cleanup: delete bill then vendor
        client.delete(f"/api/v1/bills/{bid}")
        client.delete(f"/api/v1/vendors/{vid}")

    def test_create_billable_expense(self, client):
        """Test POST bill with billable=true, customer_id (if we have a customer)"""
        vid = _get_or_create_vendor(client)
        acc_id = _get_expense_account_id(client)
        # Get a customer for billable expense
        r = client.get("/api/v1/customers?limit=1")
        if r.status_code != 200:
            client.delete(f"/api/v1/vendors/{vid}")
            pytest.skip("Customers API not available")
        dc = json.loads(r.data)
        customers = dc.get("data") or []
        if not customers:
            client.delete(f"/api/v1/vendors/{vid}")
            pytest.skip("No customers in DB for billable expense test")
        cust = customers[0] if isinstance(customers[0], dict) else customers[0].get("customer") or customers[0]
        cid = int(cust.get("id") or cust.get("customer_id") or 0)
        if not cid:
            client.delete(f"/api/v1/vendors/{vid}")
            pytest.skip("No customer id")
        payload = {
            "vendor_id": vid,
            "bill_date": "2024-01-20",
            "lines": [
                {
                    "description": "Client Meeting Lunch",
                    "quantity": 1,
                    "unit_cost": 75.0,
                    "account_id": acc_id,
                    "billable": True,
                    "customer_id": cid,
                }
            ],
        }
        r = client.post(
            "/api/v1/bills",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert r.status_code == 201, r.data.decode()
        d = json.loads(r.data)
        assert d["success"] is True
        out = d["data"]
        bill = out.get("bill") or out
        bid = int(bill["id"])
        lines = out.get("lines") or []
        assert any(l.get("billable") for l in lines)
        client.delete(f"/api/v1/bills/{bid}")
        client.delete(f"/api/v1/vendors/{vid}")

    def test_create_bill_invalid(self, client):
        """Test POST with missing vendor_id / invalid lines"""
        r = client.post(
            "/api/v1/bills",
            data=json.dumps({
                "bill_date": "2024-01-15",
                "lines": [{"description": "X", "quantity": 1, "unit_cost": 10, "account_id": 1}],
            }),
            content_type="application/json",
        )
        assert r.status_code == 400
        d = json.loads(r.data)
        assert d["success"] is False

    def test_get_bill_by_id(self, client):
        """Test GET /api/v1/bills/:id"""
        vid = _get_or_create_vendor(client)
        acc_id = _get_expense_account_id(client)
        r = client.post(
            "/api/v1/bills",
            data=json.dumps({
                "vendor_id": vid,
                "bill_date": "2024-02-01",
                "lines": [{"description": "Test", "quantity": 1, "unit_cost": 50.0, "account_id": acc_id}],
            }),
            content_type="application/json",
        )
        assert r.status_code == 201
        d = json.loads(r.data)
        bid = int((d["data"].get("bill") or d["data"])["id"])
        r2 = client.get(f"/api/v1/bills/{bid}")
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        assert int((d2["data"].get("bill") or d2["data"])["id"]) == bid
        client.delete(f"/api/v1/bills/{bid}")
        client.delete(f"/api/v1/vendors/{vid}")

    def test_update_bill(self, client):
        """Test PUT /api/v1/bills/:id"""
        vid = _get_or_create_vendor(client)
        acc_id = _get_expense_account_id(client)
        r = client.post(
            "/api/v1/bills",
            data=json.dumps({
                "vendor_id": vid,
                "bill_date": "2024-02-10",
                "lines": [{"description": "Original", "quantity": 2, "unit_cost": 30.0, "account_id": acc_id}],
            }),
            content_type="application/json",
        )
        assert r.status_code == 201
        d = json.loads(r.data)
        bid = int((d["data"].get("bill") or d["data"])["id"])
        r2 = client.put(
            f"/api/v1/bills/{bid}",
            data=json.dumps({
                "vendor_id": vid,
                "bill_date": "2024-02-10",
                "memo": "Updated memo",
                "lines": [{"description": "Updated line", "quantity": 3, "unit_cost": 20.0, "account_id": acc_id}],
            }),
            content_type="application/json",
        )
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        bill = (d2["data"].get("bill") or d2["data"])
        assert float(bill.get("total_amount") or 0) == 60.0
        client.delete(f"/api/v1/bills/{bid}")
        client.delete(f"/api/v1/vendors/{vid}")

    def test_void_bill(self, client):
        """Test POST /api/v1/bills/:id/void"""
        vid = _get_or_create_vendor(client)
        acc_id = _get_expense_account_id(client)
        r = client.post(
            "/api/v1/bills",
            data=json.dumps({
                "vendor_id": vid,
                "bill_date": "2024-03-01",
                "lines": [{"description": "To void", "quantity": 1, "unit_cost": 100.0, "account_id": acc_id}],
            }),
            content_type="application/json",
        )
        assert r.status_code == 201
        d = json.loads(r.data)
        bid = int((d["data"].get("bill") or d["data"])["id"])
        r2 = client.post(
            f"/api/v1/bills/{bid}/void",
            data=json.dumps({"reason": "Test void"}),
            content_type="application/json",
        )
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        bill = d2.get("data") or {}
        assert bill.get("status") == "void"
        client.delete(f"/api/v1/vendors/{vid}")

    def test_void_bill_no_reason(self, client):
        """Void without reason returns 400"""
        vid = _get_or_create_vendor(client)
        acc_id = _get_expense_account_id(client)
        r = client.post(
            "/api/v1/bills",
            data=json.dumps({
                "vendor_id": vid,
                "bill_date": "2024-03-05",
                "lines": [{"description": "No void reason", "quantity": 1, "unit_cost": 10.0, "account_id": acc_id}],
            }),
            content_type="application/json",
        )
        assert r.status_code == 201
        d = json.loads(r.data)
        bid = int((d["data"].get("bill") or d["data"])["id"])
        r2 = client.post(
            f"/api/v1/bills/{bid}/void",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert r2.status_code == 400
        client.delete(f"/api/v1/bills/{bid}")
        client.delete(f"/api/v1/vendors/{vid}")

    def test_delete_bill(self, client):
        """Test DELETE /api/v1/bills/:id"""
        vid = _get_or_create_vendor(client)
        acc_id = _get_expense_account_id(client)
        r = client.post(
            "/api/v1/bills",
            data=json.dumps({
                "vendor_id": vid,
                "bill_date": "2024-03-10",
                "lines": [{"description": "To delete", "quantity": 1, "unit_cost": 5.0, "account_id": acc_id}],
            }),
            content_type="application/json",
        )
        assert r.status_code == 201
        d = json.loads(r.data)
        bid = int((d["data"].get("bill") or d["data"])["id"])
        r2 = client.delete(f"/api/v1/bills/{bid}")
        assert r2.status_code == 200
        d2 = json.loads(r2.data)
        assert d2["success"] is True
        r3 = client.get(f"/api/v1/bills/{bid}")
        assert r3.status_code == 404
        client.delete(f"/api/v1/vendors/{vid}")

    def test_get_bill_404(self, client):
        """Test GET /api/v1/bills/999999"""
        r = client.get("/api/v1/bills/999999")
        assert r.status_code == 404
