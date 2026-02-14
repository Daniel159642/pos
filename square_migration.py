"""
Square data migration: pull data from Square API and insert into POS database.
Supports: inventory (catalog), employees (team members), orders, payments/transactions.
Statistics are derived from order/payment history after migration.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

# Square API base URLs
SQUARE_BASE = "https://connect.squareup.com"
SQUARE_SANDBOX_BASE = "https://connect.squareupsandbox.com"
SQUARE_API_VERSION = "2024-11-20"


def _square_request(
    access_token: str,
    path: str,
    method: str = "GET",
    body: Optional[Dict[str, Any]] = None,
    sandbox: bool = False,
) -> Dict[str, Any]:
    base = SQUARE_SANDBOX_BASE if sandbox else SQUARE_BASE
    url = f"{base}{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Square-Version": SQUARE_API_VERSION,
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode()
            err_json = json.loads(err_body)
            errors = err_json.get("errors", [])
            msg = errors[0].get("detail", err_body) if errors else str(e)
        except Exception:
            msg = str(e)
        raise ValueError(msg)


def verify_connection(access_token: str, sandbox: bool = False) -> Tuple[bool, str]:
    """Verify Square access token and return (success, message)."""
    try:
        r = _square_request(access_token, "/v2/merchants/me", method="GET", sandbox=sandbox)
        merchant = r.get("merchant") or {}
        mid = merchant.get("id", "")
        name = (merchant.get("business_name") or merchant.get("id") or "Square").strip()
        return True, f"Connected to {name} (merchant {mid})"
    except Exception as e:
        return False, str(e)


def _get_locations(access_token: str, sandbox: bool) -> List[str]:
    r = _square_request(access_token, "/v2/locations", method="GET", sandbox=sandbox)
    locs = r.get("locations") or []
    return [loc["id"] for loc in locs if loc.get("id")]


def _fetch_catalog_items(access_token: str, sandbox: bool) -> List[Dict[str, Any]]:
    """Fetch all ITEM catalog objects (with nested variations)."""
    objects: List[Dict] = []
    cursor = None
    while True:
        body = {"object_types": ["ITEM"], "limit": 100}
        if cursor:
            body["cursor"] = cursor
        r = _square_request(
            access_token, "/v2/catalog/search", method="POST", body=body, sandbox=sandbox
        )
        objs = r.get("objects") or []
        objects.extend(objs)
        cursor = r.get("cursor")
        if not cursor:
            break
    return objects


def _fetch_team_members(access_token: str, sandbox: bool) -> List[Dict[str, Any]]:
    team_members: List[Dict] = []
    cursor = None
    while True:
        body = {"limit": 200}
        if cursor:
            body["cursor"] = cursor
        r = _square_request(
            access_token,
            "/v2/team-members/search",
            method="POST",
            body=body,
            sandbox=sandbox,
        )
        team_members_batch = r.get("team_members") or []
        team_members.extend(team_members_batch)
        cursor = r.get("cursor")
        if not cursor:
            break
    return team_members


def _fetch_orders(
    access_token: str, location_ids: List[str], sandbox: bool
) -> List[Dict[str, Any]]:
    orders: List[Dict] = []
    cursor = None
    while True:
        body = {
            "location_ids": location_ids,
            "query": {
                "filter": {"state_filter": {"states": ["COMPLETED"]}},
                "sort": {"sort_field": "CLOSED_AT", "sort_order": "DESC"},
            },
            "limit": 500,
            "return_entries": False,
        }
        if cursor:
            body["cursor"] = cursor
        r = _square_request(
            access_token, "/v2/orders/search", method="POST", body=body, sandbox=sandbox
        )
        batch = r.get("orders") or []
        orders.extend(batch)
        cursor = r.get("cursor")
        if not cursor:
            break
    return orders


def _fetch_payments(access_token: str, sandbox: bool) -> List[Dict[str, Any]]:
    payments: List[Dict] = []
    cursor = None
    while True:
        path = "/v2/payments?limit=100"
        if cursor:
            path += f"&cursor={urllib.parse.quote(cursor)}"
        r = _square_request(access_token, path, method="GET", sandbox=sandbox)
        batch = r.get("payments") or []
        payments.extend(batch)
        cursor = r.get("cursor")
        if not cursor:
            break
    return payments


def run_migration(
    access_token: str,
    sandbox: bool,
    migrate: Dict[str, bool],
    establishment_id_override: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Run Square migration. migrate keys: inventory, employees, order_history, payments, transactions, statistics.
    Returns counts: inventory, employees, orders, payments, and optional error.
    """
    from database import add_product, add_employee, create_order, get_connection
    from database_postgres import get_current_establishment

    result = {
        "success": True,
        "inventory": 0,
        "employees": 0,
        "orders": 0,
        "payments": 0,
    }
    catalog_id_to_product_id: Dict[str, int] = {}
    square_order_id_to_order_id: Dict[str, int] = {}
    location_ids: List[str] = []

    try:
        location_ids = _get_locations(access_token, sandbox)
        if not location_ids and (migrate.get("order_history") or migrate.get("payments")):
            result["success"] = False
            result["error"] = "No Square locations found. Ensure the token has ORDERS_READ and LOCATION_READ."
            return result
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
        return result

    # 1) Inventory: catalog items -> add_product (one per item variation)
    if migrate.get("inventory"):
        try:
            items = _fetch_catalog_items(access_token, sandbox)
            for obj in items:
                if obj.get("type") != "ITEM" or obj.get("is_deleted"):
                    continue
                item_data = obj.get("item_data") or {}
                name = (item_data.get("name") or "Unnamed").strip()
                variations = item_data.get("variations") or []
                if not variations:
                    # Single product, no variation
                    sku = (item_data.get("sku") or obj.get("id", "") or "")[:100] or f"sq-{obj.get('id', '')}"[:100]
                    price = 0.0
                    try:
                        pid = add_product(
                            product_name=name,
                            sku=sku,
                            product_price=price,
                            product_cost=0,
                            current_quantity=0,
                            category=item_data.get("category_id") or None,
                            barcode=None,
                            item_type="product",
                            sell_at_pos=True,
                        )
                        catalog_id_to_product_id[obj.get("id", "")] = pid
                        result["inventory"] += 1
                    except Exception:
                        pass  # skip duplicates / invalid
                    continue
                for var in variations:
                    if var.get("is_deleted"):
                        continue
                    var_data = var.get("item_variation_data") or {}
                    var_name = (var_data.get("name") or "Default").strip()
                    full_name = f"{name} - {var_name}" if var_name and var_name != "Default" else name
                    sku = var_data.get("sku") or var.get("id", "")
                    price_money = var_data.get("price_money") or {}
                    price = float((price_money.get("amount") or 0)) / 100.0
                    try:
                        pid = add_product(
                            product_name=full_name[:255],
                            sku=(sku or f"sq-{var.get('id')}")[:100],
                            product_price=price,
                            product_cost=0,
                            current_quantity=0,
                            category=item_data.get("category_id") or None,
                            barcode=var_data.get("sku") or None,
                            item_type="product",
                            sell_at_pos=True,
                        )
                        catalog_id_to_product_id[var.get("id", "")] = pid
                        catalog_id_to_product_id[obj.get("id", "")] = pid  # item id -> first variation product
                        result["inventory"] += 1
                    except Exception:
                        pass
        except Exception as e:
            result["error"] = f"Inventory: {e}"
            result["success"] = False
            return result

    # 2) Employees: team members -> add_employee
    if migrate.get("employees"):
        try:
            members = _fetch_team_members(access_token, sandbox)
            for m in members:
                if m.get("status") != "ACTIVE":
                    continue
                given = (m.get("given_name") or "").strip()
                family = (m.get("family_name") or "").strip()
                email = (m.get("email_address") or "").strip()
                phone = (m.get("phone_number") or "").strip()
                try:
                    add_employee(
                        first_name=given or "Square",
                        last_name=family or "User",
                        email=email or None,
                        phone=phone or None,
                        username=email or m.get("id", ""),
                        employee_code=m.get("id", "")[:50],
                        position="Team Member",
                        employment_type="part_time",
                    )
                    result["employees"] += 1
                except Exception:
                    pass
        except Exception as e:
            result["error"] = result.get("error", "") + f" Employees: {e}"
            result["success"] = False
            if not migrate.get("order_history") and not migrate.get("payments"):
                return result

    # Need first employee for create_order
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT employee_id FROM employees WHERE active = 1 ORDER BY employee_id LIMIT 1")
    row = cur.fetchone()
    default_employee_id = row[0] if row and isinstance(row, tuple) else (row.get("employee_id") if isinstance(row, dict) else None)
    conn.close()
    if not default_employee_id and migrate.get("order_history"):
        result["success"] = False
        result["error"] = result.get("error", "") + " No active employee for orders. Migrate employees first or add one."
        return result

    # 3) Orders: Square orders -> create_order
    if migrate.get("order_history") and default_employee_id and location_ids:
        try:
            orders_data = _fetch_orders(access_token, location_ids, sandbox)
            for sq_order in orders_data:
                sq_id = sq_order.get("id")
                if not sq_id:
                    continue
                line_items = sq_order.get("line_items") or []
                items_for_create: List[Dict[str, Any]] = []
                for li in line_items:
                    catalog_id = li.get("catalog_object_id") or li.get("catalog_item_id")
                    product_id = catalog_id_to_product_id.get(catalog_id) if catalog_id else None
                    if not product_id:
                        continue
                    qty = int(li.get("quantity", 1) or 1)
                    base_price = (li.get("base_price_money") or {}).get("amount") or 0
                    unit_price = float(base_price) / 100.0
                    items_for_create.append(
                        {"product_id": product_id, "quantity": qty, "unit_price": unit_price}
                    )
                if not items_for_create:
                    continue
                amount = (sq_order.get("net_amounts") or {}).get("total_money") or {}
                total_cents = int(amount.get("amount") or 0)
                total = total_cents / 100.0
                tax_money = (sq_order.get("net_amounts") or {}).get("tax_money") or {}
                tax = float((tax_money.get("amount") or 0)) / 100.0
                discount_money = (sq_order.get("net_amounts") or {}).get("discount_money") or {}
                discount = float((discount_money.get("amount") or 0)) / 100.0
                try:
                    create_result = create_order(
                        employee_id=default_employee_id,
                        items=items_for_create,
                        payment_method="credit_card",
                        tax_rate=0,
                        discount=discount,
                        tip=0,
                        payment_status="completed",
                        order_status_override="completed",
                        order_source="square",
                        establishment_id_override=establishment_id_override,
                    )
                    if create_result.get("success") and create_result.get("order_id"):
                        order_id = create_result["order_id"]
                        square_order_id_to_order_id[sq_id] = order_id
                        result["orders"] += 1
                except Exception:
                    pass
        except Exception as e:
            result["error"] = result.get("error", "") + f" Orders: {e}"
            result["success"] = False
            return result

    # 4) Payments / Transactions: Square payments -> payment_transactions (link by order_id from our orders)
    if (migrate.get("payments") or migrate.get("transactions")) and square_order_id_to_order_id:
        try:
            payments_data = _fetch_payments(access_token, sandbox)
            conn = get_connection()
            cur = conn.cursor()
            for pay in payments_data:
                order_id_sq = pay.get("order_id")
                our_order_id = square_order_id_to_order_id.get(order_id_sq) if order_id_sq else None
                if not our_order_id:
                    continue
                amount_money = pay.get("amount_money") or {}
                amount = float((amount_money.get("amount") or 0)) / 100.0
                if amount <= 0:
                    continue
                card_details = pay.get("card_details") or {}
                card_last_four = (card_details.get("last_4") or "")
                status = "approved" if (pay.get("status") or "").upper() == "COMPLETED" else "pending"
                try:
                    cur.execute("""
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'payment_transactions'
                    """)
                    cols = [r[0] for r in cur.fetchall()]
                    establishment_id = establishment_id_override
                    if establishment_id is None:
                        from database_postgres import get_current_establishment
                        establishment_id = get_current_establishment()
                    if not establishment_id:
                        cur.execute("SELECT establishment_id FROM orders WHERE order_id = %s LIMIT 1", (our_order_id,))
                        row = cur.fetchone()
                        establishment_id = row[0] if row else 1
                    if "tip" in cols and "employee_id" in cols:
                        cur.execute("""
                            INSERT INTO payment_transactions (
                                establishment_id, order_id, payment_method, amount,
                                transaction_fee, transaction_fee_rate, net_amount, status, tip, employee_id
                            ) VALUES (%s, %s, %s, %s, 0, 0, %s, %s, 0, %s)
                        """, (establishment_id, our_order_id, "credit_card", amount, amount, status, default_employee_id))
                    else:
                        cur.execute("""
                            INSERT INTO payment_transactions (
                                establishment_id, order_id, payment_method, amount,
                                transaction_fee, transaction_fee_rate, net_amount, status
                            ) VALUES (%s, %s, %s, %s, 0, 0, %s, %s)
                        """, (establishment_id, our_order_id, "credit_card", amount, amount, status))
                    result["payments"] += 1
                except Exception:
                    pass
            conn.commit()
            conn.close()
        except Exception as e:
            result["error"] = result.get("error", "") + f" Payments: {e}"
            result["success"] = False

    # Statistics: no separate Square API; frontend message says derived from order/payment history
    return result
