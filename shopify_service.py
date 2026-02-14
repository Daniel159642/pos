"""
Shopify integration: fetch orders from Shopify Admin API and sync into POS orders
so they appear on Recent Orders and in accounting.
"""

from typing import Dict, Any, List, Optional
import requests
from datetime import datetime, timezone

# Normalize store URL: allow "store.myshopify.com" or "https://store.myshopify.com"
def _normalize_store_url(store_url: str) -> str:
    u = (store_url or "").strip().lower()
    if not u:
        return ""
    if not u.startswith("http"):
        u = "https://" + u
    return u.rstrip("/")


def fetch_orders(
    store_url: str,
    access_token: str,
    since_id: Optional[int] = None,
    limit: int = 50,
    status: str = "any",
) -> List[Dict[str, Any]]:
    """
    Fetch orders from Shopify Admin REST API.
    GET /admin/api/2024-01/orders.json
    Returns list of order objects (id, order_number, line_items, shipping_address, customer, etc.).
    """
    base = _normalize_store_url(store_url)
    if not base or not access_token:
        return []
    # Remove .myshopify.com path if someone pasted full admin URL
    if ".myshopify.com/admin" in base:
        base = base.split(".myshopify.com")[0] + ".myshopify.com"
    url = f"{base}/admin/api/2024-01/orders.json"
    params = {"limit": min(limit, 250), "status": status}
    if since_id is not None:
        params["since_id"] = since_id
    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}
    try:
        r = requests.get(url, params=params, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()
        return (data.get("orders") or []) if isinstance(data, dict) else []
    except Exception as e:
        print(f"Shopify fetch_orders error: {e}")
        return []


def _format_address(addr: Optional[Dict]) -> str:
    if not addr or not isinstance(addr, dict):
        return ""
    parts = [
        addr.get("address1"),
        addr.get("address2"),
        addr.get("city"),
        addr.get("province"),
        addr.get("zip"),
        addr.get("country"),
    ]
    return ", ".join(p for p in parts if p)


def build_pos_payload_from_shopify_order(
    shopify_order: Dict[str, Any],
    establishment_id: int,
    price_multiplier: float = 1.0,
) -> Optional[Dict[str, Any]]:
    """
    Map one Shopify order to the payload expected by create_order / api_orders_from_integration.
    Resolves line items to product_id via SKU (creates placeholder product if missing).
    Returns None if order has no line items or is cancelled.
    """
    from database import get_or_create_product_for_shopify

    if not shopify_order or not isinstance(shopify_order, dict):
        return None
    if str(shopify_order.get("cancel_reason") or "") or str(shopify_order.get("cancelled_at") or ""):
        return None  # skip cancelled
    line_items = shopify_order.get("line_items") or []
    if not line_items:
        return None

    items = []
    for li in line_items:
        sku = (li.get("sku") or "").strip() or (li.get("variant_id") and str(li.get("variant_id"))) or ""
        title = (li.get("title") or "Item")[:255]
        qty = int(li.get("quantity") or 1)
        if qty < 1:
            continue
        # Price from Shopify is string in shop currency
        try:
            price = float(li.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        price = price * price_multiplier
        product_id = get_or_create_product_for_shopify(establishment_id, sku or f"shopify-{li.get('id')}", title, price)
        items.append({
            "product_id": product_id,
            "quantity": qty,
            "unit_price": price,
            "discount": float(li.get("total_discount") or 0) / max(qty, 1),
            "tax_rate": 0,
        })
    if not items:
        return None

    # Customer and address from shipping_address or billing_address or customer
    shipping = shopify_order.get("shipping_address") or {}
    billing = shopify_order.get("billing_address") or {}
    customer = shopify_order.get("customer") or {}
    name = (
        (shipping.get("name") or "").strip()
        or (billing.get("name") or "").strip()
        or (customer.get("first_name") or "").strip() + " " + (customer.get("last_name") or "").strip()
        or "Shopify Customer"
    ).strip() or "Shopify Customer"
    phone = (shipping.get("phone") or billing.get("phone") or customer.get("phone") or "").strip() or None
    email = (customer.get("email") or shopify_order.get("email") or "").strip() or None
    address = _format_address(shipping) or _format_address(billing) or None

    # Prepare-by: use fulfillment deadline or created_at + 1 hour
    prepare_by = None
    created = shopify_order.get("created_at")
    if created:
        try:
            # Parse ISO and output same for API
            if "T" in str(created):
                prepare_by = created
            else:
                prepare_by = created + "T12:00:00Z"
        except Exception:
            pass

    return {
        "order_source": "shopify",
        "items": items,
        "customer_name": name,
        "customer_phone": phone,
        "customer_email": email,
        "customer_address": address,
        "order_type": "delivery" if address else "pickup",
        "prepare_by_iso": prepare_by,
        "tax_rate": 0,
        "discount": 0,
        "tip": 0,
        "shopify_order_id": shopify_order.get("id"),
        "shopify_order_number": shopify_order.get("order_number") or shopify_order.get("name"),
    }


def sync_shopify_orders(establishment_id: int) -> Dict[str, Any]:
    """
    Fetch Shopify integration config, get orders from Shopify API (since last_synced_order_id),
    create POS orders and journalize to accounting. Update last_synced_order_id in config.
    Returns { success, created: int, errors: list, last_synced_order_id }.
    """
    from database import get_integrations, create_order, get_connection
    from psycopg2.extras import RealDictCursor
    import json

    result = {"success": True, "created": 0, "errors": [], "last_synced_order_id": None}
    integrations = get_integrations(establishment_id)
    integration = next((i for i in integrations if i.get("provider") == "shopify" and i.get("enabled")), None)
    if not integration:
        result["success"] = False
        result["errors"].append("Shopify integration not enabled or not configured")
        return result

    config = integration.get("config") or {}
    if not isinstance(config, dict):
        config = {}
    store_url = (config.get("store_url") or "").strip()
    access_token = (config.get("api_key") or config.get("access_token") or "").strip()
    price_multiplier = float(config.get("price_multiplier") or 1)
    last_synced = config.get("last_synced_order_id")
    since_id = int(last_synced) if last_synced is not None else None

    if not store_url or not access_token:
        result["success"] = False
        result["errors"].append("Shopify store URL and Admin API access token are required")
        return result

    orders = fetch_orders(store_url, access_token, since_id=since_id, limit=100, status="any")
    if not orders:
        result["last_synced_order_id"] = last_synced
        return result

    # Get default employee for create_order
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT employee_id FROM employees WHERE active = 1 ORDER BY employee_id LIMIT 1")
        row = cur.fetchone()
        employee_id = (row.get("employee_id") if row and isinstance(row, dict) else (row[0] if row else None)) if row else None
    finally:
        conn.close()

    if not employee_id:
        result["success"] = False
        result["errors"].append("No active employee found for creating orders")
        return result

    # Process oldest first (Shopify returns newest first when no since_id; with since_id we get newer only)
    max_id = since_id
    for shopify_order in orders:
        oid = shopify_order.get("id")
        if oid is not None and (max_id is None or oid > max_id):
            max_id = oid
        payload = build_pos_payload_from_shopify_order(shopify_order, establishment_id, price_multiplier)
        if not payload:
            continue
        items = payload.pop("items")
        payload.pop("shopify_order_id", None)
        payload.pop("shopify_order_number", None)
        try:
            cr = create_order(
                employee_id=employee_id,
                items=items,
                payment_method="mobile_payment",
                tax_rate=float(payload.get("tax_rate") or 0),
                discount=float(payload.get("discount") or 0),
                customer_id=None,
                tip=float(payload.get("tip") or 0),
                order_type=(payload.get("order_type") or "delivery").strip() or "delivery",
                customer_info={
                    "name": payload.get("customer_name") or "Shopify Customer",
                    "phone": payload.get("customer_phone"),
                    "email": payload.get("customer_email"),
                    "address": payload.get("customer_address"),
                },
                payment_status="completed",
                order_status_override="placed",
                order_source="shopify",
                prepare_by=payload.get("prepare_by_iso"),
                establishment_id_override=establishment_id,
            )
            if cr.get("success") and cr.get("order_id"):
                result["created"] += 1
                try:
                    from pos_accounting_bridge import journalize_sale_to_accounting
                    journalize_sale_to_accounting(cr["order_id"], employee_id)
                except Exception as je:
                    result["errors"].append(f"Order {cr.get('order_number')} created but accounting failed: {je}")
            else:
                result["errors"].append(cr.get("message") or "Create order failed")
        except Exception as e:
            result["errors"].append(str(e))

    if max_id is not None:
        config["last_synced_order_id"] = max_id
        config["last_synced_at"] = datetime.now(tz=timezone.utc).isoformat()
        from database import upsert_integration
        upsert_integration(establishment_id, "shopify", True, config)
        result["last_synced_order_id"] = max_id

    return result
