"""
DoorDash integration: receive orders via webhook, create POS orders (Recent Orders + accounting).
Menu Pull: build menu from inventory for GET endpoint. Menu status webhook for create/update result.
"""

from typing import Dict, Any, List, Optional

# Default open hours (MON-SUN 00:00-23:59) when store has no hours configured
_DEFAULT_OPEN_HOURS = [
    {"day_index": "MON", "start_time": "00:00", "end_time": "23:59"},
    {"day_index": "TUE", "start_time": "00:00", "end_time": "23:59"},
    {"day_index": "WED", "start_time": "00:00", "end_time": "23:59"},
    {"day_index": "THU", "start_time": "00:00", "end_time": "23:59"},
    {"day_index": "FRI", "start_time": "00:00", "end_time": "23:59"},
    {"day_index": "SAT", "start_time": "00:00", "end_time": "23:59"},
    {"day_index": "SUN", "start_time": "00:00", "end_time": "23:59"},
]

_DAY_ORDER = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
_DAY_INDEX = {"monday": "MON", "tuesday": "TUE", "wednesday": "WED", "thursday": "THU", "friday": "FRI", "saturday": "SAT", "sunday": "SUN"}


def _normalize_item_special_hours_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure start_time/end_time are HH:MM:SS for DoorDash item_special_hours / item_extra_option_special_hours."""
    if not entry or not isinstance(entry, dict):
        return entry
    out = dict(entry)
    for key in ("start_time", "end_time"):
        v = out.get(key)
        if isinstance(v, str) and v.strip():
            v = v.strip()
            if len(v) == 5 and v[2] == ":":  # HH:MM
                out[key] = v + ":00"
            elif len(v) >= 8:
                out[key] = v[:8]  # HH:MM:SS
            else:
                out[key] = v
    return out


def _valid_doordash_image_url(photo: Any, public_base_url: Optional[str] = None) -> Optional[str]:
    """
    Return a URL suitable for DoorDash original_image_url, or None.
    Requirements: http/https, no query params, ends in .jpg/.jpeg/.png, publicly accessible.
    If photo is a relative path (e.g. uploads/product_photos/x.jpg), public_base_url is used to build absolute URL.
    """
    if not photo or not isinstance(photo, str):
        return None
    s = (photo or "").strip()
    if not s:
        return None
    if s.lower().startswith("http://") or s.lower().startswith("https://"):
        url = s
        if "?" in url:
            url = url.split("?")[0]
        if not (url.lower().endswith(".jpg") or url.lower().endswith(".jpeg") or url.lower().endswith(".png")):
            return None
        return url
    if public_base_url:
        base = (public_base_url or "").strip().rstrip("/")
        if not base:
            return None
        path = s.lstrip("/")
        url = f"{base}/{path}"
        if not (url.lower().endswith(".jpg") or url.lower().endswith(".jpeg") or url.lower().endswith(".png")):
            return None
        return url
    return None


def _dish_info_for_payload(display_type: Any, lower_range: Any, higher_range: Any) -> Optional[Dict[str, Any]]:
    """Build DoorDash dish_info.nutritional_info.calorific_info when at least range is set."""
    if lower_range is None and higher_range is None:
        return None
    lo = int(lower_range) if lower_range is not None and str(lower_range).strip() != "" else 0
    hi = int(higher_range) if higher_range is not None and str(higher_range).strip() != "" else 0
    if lo == 0 and hi == 0:
        return None
    disp = (display_type or "cal") if isinstance(display_type, str) and (display_type or "").strip() else "cal"
    return {
        "nutritional_info": {
            "calorific_info": {
                "display_type": disp[:50],
                "lower_range": lo,
                "higher_range": hi,
            }
        }
    }


def _classification_info_for_payload(tags: Any) -> Optional[Dict[str, Any]]:
    """Build DoorDash classification_info.classification_tags from list of tag strings."""
    if not tags or not isinstance(tags, list):
        return None
    out = [str(t).strip() for t in tags if t is not None and str(t).strip()]
    if not out:
        return None
    return {"classification_tags": out[:20]}


def _item_special_hours_for_payload(raw: Any) -> Optional[List[Dict[str, Any]]]:
    """Return normalized item_special_hours list for DoorDash, or None if empty/missing."""
    if raw is None:
        return None
    if isinstance(raw, list) and len(raw) > 0:
        normalized = [_normalize_item_special_hours_entry(e) for e in raw if isinstance(e, dict)]
        if normalized:
            return normalized
    return None


def _open_hours_from_store_settings() -> List[Dict[str, str]]:
    """Convert store_location_settings.store_hours to DoorDash open_hours format. Returns _DEFAULT_OPEN_HOURS if none."""
    try:
        from database import get_store_location_settings
        settings = get_store_location_settings()
        store_hours = (settings or {}).get("store_hours") if isinstance(settings, dict) else None
        if not store_hours or not isinstance(store_hours, dict):
            return _DEFAULT_OPEN_HOURS
        out = []
        for day in _DAY_ORDER:
            day_data = store_hours.get(day) if isinstance(store_hours.get(day), dict) else None
            if not day_data or day_data.get("closed"):
                out.append({"day_index": _DAY_INDEX[day], "start_time": "00:00", "end_time": "00:00"})
            else:
                start = (day_data.get("open") or "00:00").strip()[:5] or "00:00"
                end = (day_data.get("close") or "23:59").strip()[:5] or "23:59"
                out.append({"day_index": _DAY_INDEX[day], "start_time": start, "end_time": end})
        return out
    except Exception:
        return _DEFAULT_OPEN_HOURS


def build_doordash_menu_pull_response(
    establishment_id: int,
    provider_type: str = "pos",
    external_menu_id: Optional[str] = None,
    reference: Optional[str] = None,
    public_base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build the Menu Pull response for DoorDash: { store: { merchant_supplied_id, provider_type }, menus: [ ... ] }.
    Uses inventory for this establishment; groups by category (inventory.category or "Uncategorized").
    Price is sent in cents (integer). reference is required in menu pull response; id required for MenuUpdate.
    If public_base_url is set, item photo paths are turned into original_image_url (DoorDash POS Integrated Images).
    """
    from database import get_connection
    from psycopg2.extras import RealDictCursor

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    has_item_special_hours = False
    try:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'item_special_hours'
        """)
        has_item_special_hours = cur.fetchone() is not None
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'photo'
        """)
        has_photo = cur.fetchone() is not None
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'doordash_operation_context'
        """)
        has_operation_context = cur.fetchone() is not None
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'inventory'
            AND column_name IN ('doordash_calorific_display_type', 'doordash_calorific_lower_range', 'doordash_calorific_higher_range', 'doordash_classification_tags')
        """)
        nutrition_cols = {row["column_name"] for row in cur.fetchall()}
        cols = "product_id, product_name, sku, product_price, category"
        if has_item_special_hours:
            cols += ", item_special_hours"
        if has_photo:
            cols += ", photo"
        if has_operation_context:
            cols += ", doordash_operation_context"
        for c in ("doordash_calorific_display_type", "doordash_calorific_lower_range", "doordash_calorific_higher_range", "doordash_classification_tags"):
            if c in nutrition_cols:
                cols += ", " + c
        cur.execute(f"""
            SELECT {cols}
            FROM inventory
            WHERE establishment_id = %s AND (sell_at_pos IS NULL OR sell_at_pos = true)
            ORDER BY COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized'), product_name
        """, (establishment_id,))
        rows = cur.fetchall()
        product_ids = [r["product_id"] for r in rows]
        variants_by_product: Dict[int, List[Dict]] = {}
        if product_ids:
            cur.execute("""
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'product_variants'
            """)
            if cur.fetchone():
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'photo'
                """)
                has_variant_photo = cur.fetchone() is not None
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'product_variants'
                    AND column_name IN ('doordash_default_quantity', 'doordash_charge_above', 'doordash_recipe_default')
                """)
                recipe_cols = {row["column_name"] for row in cur.fetchall()}
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'product_variants'
                    AND column_name IN ('doordash_calorific_display_type', 'doordash_calorific_lower_range', 'doordash_calorific_higher_range', 'doordash_classification_tags')
                """)
                variant_nutrition_cols = {row["column_name"] for row in cur.fetchall()}
                vcols = "variant_id, product_id, variant_name, price, sort_order"
                if has_variant_photo:
                    vcols += ", photo"
                if "doordash_default_quantity" in recipe_cols:
                    vcols += ", doordash_default_quantity"
                if "doordash_charge_above" in recipe_cols:
                    vcols += ", doordash_charge_above"
                if "doordash_recipe_default" in recipe_cols:
                    vcols += ", doordash_recipe_default"
                for c in ("doordash_calorific_display_type", "doordash_calorific_lower_range", "doordash_calorific_higher_range", "doordash_classification_tags"):
                    if c in variant_nutrition_cols:
                        vcols += ", " + c
                placeholders = ",".join(["%s"] * len(product_ids))
                cur.execute(
                    f"SELECT {vcols} FROM product_variants WHERE product_id IN ({placeholders}) ORDER BY product_id, sort_order, variant_name",
                    product_ids,
                )
                for v in cur.fetchall():
                    pid = v["product_id"]
                    if pid not in variants_by_product:
                        variants_by_product[pid] = []
                    variants_by_product[pid].append(dict(v))
    finally:
        conn.close()

    # Group by category (use "Uncategorized" if blank)
    categories_map: Dict[str, List[Dict]] = {}
    for r in rows:
        cat_name = (r.get("category") or "").strip() or "Uncategorized"
        if cat_name not in categories_map:
            categories_map[cat_name] = []
        name = (r.get("product_name") or "Item")[:500]
        sku = (r.get("sku") or "")[:1024] or f"pos-{r.get('product_id')}"
        price = float(r.get("product_price") or 0)
        price_cents = int(round(price * 100))
        item_payload = {
            "name": name,
            "description": "",
            "merchant_supplied_id": sku,
            "active": True,
            "is_alcohol": False,
            "is_bike_friendly": True,
            "sort_id": len(categories_map[cat_name]),
            "price": price_cents,
            "tax_rate": "0",
            "extras": [],
        }
        if has_item_special_hours:
            raw_hours = r.get("item_special_hours")
            if isinstance(raw_hours, list):
                try:
                    raw_hours = [x for x in raw_hours if isinstance(x, dict)]
                except Exception:
                    raw_hours = []
            else:
                raw_hours = None
            item_special_hours = _item_special_hours_for_payload(raw_hours)
            if item_special_hours:
                item_payload["item_special_hours"] = item_special_hours
        img_url = _valid_doordash_image_url(r.get("photo"), public_base_url)
        if img_url:
            item_payload["original_image_url"] = img_url
        op_ctx = r.get("doordash_operation_context")
        if isinstance(op_ctx, list) and len(op_ctx) > 0:
            item_payload["operation_context"] = [str(x) for x in op_ctx][:10]
        dish = _dish_info_for_payload(
            r.get("doordash_calorific_display_type"),
            r.get("doordash_calorific_lower_range"),
            r.get("doordash_calorific_higher_range"),
        )
        if dish:
            item_payload["dish_info"] = dish
        class_info = _classification_info_for_payload(r.get("doordash_classification_tags"))
        if class_info:
            item_payload["classification_info"] = class_info
        variants = variants_by_product.get(r["product_id"]) or []
        if variants:
            options = []
            for v in variants:
                opt: Dict[str, Any] = {
                    "name": (v.get("variant_name") or "Option")[:500],
                    "description": "",
                    "merchant_supplied_id": str(v.get("variant_id", ""))[:1024],
                    "active": True,
                    "price": int(round(float(v.get("price") or 0) * 100)),
                    "sort_id": len(options),
                }
                v_img = _valid_doordash_image_url(v.get("photo"), public_base_url)
                if v_img:
                    opt["original_image_url"] = v_img
                dq = v.get("doordash_default_quantity")
                if dq is not None and isinstance(dq, (int, float)):
                    opt["operation_context"] = ["RECIPE"]
                    opt["quantity_info"] = {
                        "default_quantity": int(dq),
                        "charge_above": int(v.get("doordash_charge_above") or dq),
                    }
                    opt["default"] = bool(v.get("doordash_recipe_default"))
                v_dish = _dish_info_for_payload(
                    v.get("doordash_calorific_display_type"),
                    v.get("doordash_calorific_lower_range"),
                    v.get("doordash_calorific_higher_range"),
                )
                if v_dish:
                    opt["dish_info"] = v_dish
                v_class = _classification_info_for_payload(v.get("doordash_classification_tags"))
                if v_class:
                    opt["classification_info"] = v_class
                options.append(opt)
            item_payload["extras"] = [
                {
                    "name": "Size",
                    "subtitle": "",
                    "merchant_supplied_id": f"size-{r['product_id']}"[:1024],
                    "active": True,
                    "sort_id": 0,
                    "options": options,
                }
            ]
        categories_map[cat_name].append(item_payload)

    categories_payload = []
    for sort_id, (cat_name, items) in enumerate(categories_map.items()):
        cat_id = f"cat-{establishment_id}-{sort_id}-{hash(cat_name) % 10**8}"
        categories_payload.append({
            "name": (cat_name or "Uncategorized")[:500],
            "subtitle": "",
            "merchant_supplied_id": cat_id[:1024],
            "active": True,
            "sort_id": sort_id,
            "items": items,
        })

    menu_obj = {
        "name": f"Menu {establishment_id}"[:500],
        "subtitle": "",
        "merchant_supplied_id": (reference or f"menu-{establishment_id}")[:1024],
        "active": True,
        "categories": categories_payload,
    }

    open_hours = _open_hours_from_store_settings()
    one_menu = {
        "reference": reference or f"menu-{establishment_id}",
        "open_hours": open_hours,
        "special_hours": [],
        "menu": menu_obj,
    }
    if external_menu_id:
        one_menu["id"] = external_menu_id

    return {
        "store": {
            "merchant_supplied_id": str(establishment_id),
            "provider_type": provider_type,
        },
        "menus": [one_menu],
    }


def build_doordash_menu_push_payload(
    establishment_id: int,
    provider_type: str = "pos",
    reference: Optional[str] = None,
    public_base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build the Menu Push request body for DoorDash: POST/PATCH body with reference, store, open_hours, special_hours, menu.
    Same data as pull but single menu at top level (no menus array). Required: merchant_supplied_id, provider_type, open_hours, special_hours, menu.name.
    public_base_url: used to build original_image_url for items (DoorDash POS Integrated Images).
    """
    pull = build_doordash_menu_pull_response(
        establishment_id,
        provider_type=provider_type,
        external_menu_id=None,
        reference=reference or f"menu-{establishment_id}",
        public_base_url=public_base_url,
    )
    one_menu = (pull.get("menus") or [{}])[0]
    open_hours = one_menu.get("open_hours") or _DEFAULT_OPEN_HOURS
    special_hours = one_menu.get("special_hours") or []
    menu_obj = one_menu.get("menu") or {}
    # Push schema: menu has name, subtitle, active, categories (no merchant_supplied_id on menu in sample)
    menu_for_push = {
        "name": (menu_obj.get("name") or f"Menu {establishment_id}")[:500],
        "subtitle": (menu_obj.get("subtitle") or "")[:500],
        "active": menu_obj.get("active", True),
        "categories": [],
    }
    for cat in (menu_obj.get("categories") or []):
        items_push = []
        for it in (cat.get("items") or []):
            item_entry = {
                "name": (it.get("name") or "Item")[:500],
                "description": (it.get("description") or "")[:1000],
                "merchant_supplied_id": (it.get("merchant_supplied_id") or "")[:1024],
                "active": it.get("active", True),
                "price": int(it.get("price") or 0),
                "extras": [],
            }
            if it.get("original_image_url"):
                item_entry["original_image_url"] = (it.get("original_image_url") or "").strip()
            if it.get("operation_context") and isinstance(it["operation_context"], list) and len(it["operation_context"]) > 0:
                item_entry["operation_context"] = [str(x) for x in it["operation_context"]][:10]
            if it.get("dish_info") and isinstance(it["dish_info"], dict):
                item_entry["dish_info"] = dict(it["dish_info"])
            if it.get("classification_info") and isinstance(it["classification_info"], dict):
                item_entry["classification_info"] = dict(it["classification_info"])
            if it.get("item_special_hours"):
                item_entry["item_special_hours"] = [
                    _normalize_item_special_hours_entry(e) for e in it["item_special_hours"] if isinstance(e, dict)
                ]
            for ex in (it.get("extras") or []):
                if not isinstance(ex, dict):
                    item_entry["extras"].append(ex)
                    continue
                ex_copy = dict(ex)
                if ex.get("options"):
                    ex_copy["options"] = []
                    for opt in ex["options"]:
                        opt_copy = dict(opt) if isinstance(opt, dict) else opt
                        if isinstance(opt_copy, dict):
                            if opt_copy.get("item_extra_option_special_hours"):
                                opt_copy["item_extra_option_special_hours"] = [
                                    _normalize_item_special_hours_entry(e) for e in opt_copy["item_extra_option_special_hours"] if isinstance(e, dict)
                                ]
                            if opt.get("original_image_url"):
                                opt_copy["original_image_url"] = (opt.get("original_image_url") or "").strip()
                            if opt.get("operation_context") and isinstance(opt["operation_context"], list) and len(opt["operation_context"]) > 0:
                                opt_copy["operation_context"] = [str(x) for x in opt["operation_context"]][:10]
                            if opt.get("quantity_info") and isinstance(opt["quantity_info"], dict):
                                opt_copy["quantity_info"] = dict(opt["quantity_info"])
                            if "default" in opt:
                                opt_copy["default"] = bool(opt["default"])
                            if opt.get("dish_info") and isinstance(opt["dish_info"], dict):
                                opt_copy["dish_info"] = dict(opt["dish_info"])
                            if opt.get("classification_info") and isinstance(opt["classification_info"], dict):
                                opt_copy["classification_info"] = dict(opt["classification_info"])
                        ex_copy["options"].append(opt_copy)
                item_entry["extras"].append(ex_copy)
            if not item_entry["extras"]:
                item_entry["extras"] = it.get("extras") or []
            items_push.append(item_entry)
        menu_for_push["categories"].append({
            "name": (cat.get("name") or "Uncategorized")[:500],
            "subtitle": (cat.get("subtitle") or "")[:500],
            "merchant_supplied_id": (cat.get("merchant_supplied_id") or "")[:1024],
            "active": cat.get("active", True),
            "sort_id": cat.get("sort_id", 0),
            "items": items_push,
        })
    return {
        "reference": reference or f"menu-{establishment_id}",
        "store": pull.get("store") or {"merchant_supplied_id": str(establishment_id), "provider_type": provider_type},
        "open_hours": open_hours,
        "special_hours": special_hours,
        "menu": menu_for_push,
    }


def push_doordash_menu(establishment_id: int, config: Dict[str, Any]) -> tuple:
    """
    Push menu to DoorDash: POST to create or PATCH to update using stored menu UUID.
    Returns (success: bool, message: str). Uses marketplace API base URL (openapi.doordash.com).
    """
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return (False, "DoorDash API key not configured")
    provider_type = (config.get("provider_type") or "pos").strip() or "pos"
    reference = f"menu-{establishment_id}"
    public_base_url = (config.get("doordash_public_base_url") or config.get("public_base_url") or "").strip() or None
    payload = build_doordash_menu_push_payload(establishment_id, provider_type=provider_type, reference=reference, public_base_url=public_base_url)
    base_url = (config.get("marketplace_base_url") or config.get("api_base_url") or "https://openapi.doordash.com").strip().rstrip("/")
    url_create = f"{base_url}/marketplace/api/v1/menus"
    menu_uuid = (config.get("doordash_menu_uuid") or "").strip()
    import requests
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        if menu_uuid:
            url_update = f"{base_url}/marketplace/api/v1/menus/{menu_uuid}"
            r = requests.patch(url_update, json=payload, headers=headers, timeout=30)
        else:
            r = requests.post(url_create, json=payload, headers=headers, timeout=30)
        if 200 <= r.status_code < 300:
            return (True, "Created" if not menu_uuid else "Updated")
        try:
            err_body = r.json()
            msg = err_body.get("message") or err_body.get("error") or r.text[:500]
        except Exception:
            msg = r.text[:500] if r.text else f"HTTP {r.status_code}"
        return (False, msg)
    except requests.exceptions.Timeout:
        return (False, "Request timed out")
    except requests.exceptions.RequestException as e:
        return (False, str(e)[:500])


def get_doordash_store_menu(establishment_id: int, config: Dict[str, Any], onboarding_id: Optional[str] = None) -> tuple:
    """
    Get active menu(s) from DoorDash for a store.
    - Integrated: GET .../stores/{merchant_supplied_id}/store_menu (store already configured to our provider).
    - Onboarding: GET .../store_onboarding/{onboarding_id}/store_menu (SSIO merchants with onboarding ID).
    Returns (success: bool, data: dict | None, error_message: str | None). data is the JSON response (menus array, etc.).
    """
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return (False, None, "DoorDash API key not configured")
    base_url = (config.get("marketplace_base_url") or config.get("api_base_url") or "https://openapi.doordash.com").strip().rstrip("/")
    import requests
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        if onboarding_id and str(onboarding_id).strip():
            url = f"{base_url}/marketplace/api/v1/store_onboarding/{onboarding_id.strip()}/store_menu"
        else:
            merchant_supplied_id = str(establishment_id)
            url = f"{base_url}/marketplace/api/v1/stores/{merchant_supplied_id}/store_menu"
        r = requests.get(url, headers=headers, timeout=30)
        if 200 <= r.status_code < 300:
            try:
                data = r.json()
                return (True, data, None)
            except Exception as e:
                return (False, None, str(e)[:500])
        try:
            err_body = r.json()
            msg = err_body.get("message") or err_body.get("error") or r.text[:500]
        except Exception:
            msg = r.text[:500] if r.text else f"HTTP {r.status_code}"
        return (False, None, msg)
    except requests.exceptions.Timeout:
        return (False, None, "Request timed out")
    except requests.exceptions.RequestException as e:
        return (False, None, str(e)[:500])


def _doordash_get_store_api(establishment_id: int, config: Dict[str, Any], path_suffix: str) -> tuple:
    """GET api/v1/stores/{merchant_supplied_id}/{path_suffix}. Returns (success, data, error_message)."""
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return (False, None, "DoorDash API key not configured")
    base_url = (config.get("api_base_url") or "https://api.doordash.com").strip().rstrip("/")
    merchant_supplied_id = str(establishment_id)
    url = f"{base_url}/api/v1/stores/{merchant_supplied_id}/{path_suffix}"
    import requests
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "SampleIntegration/1.0",
    }
    try:
        r = requests.get(url, headers=headers, timeout=30)
        if 200 <= r.status_code < 300:
            try:
                return (True, r.json(), None)
            except Exception as e:
                return (False, None, str(e)[:500])
        try:
            err_body = r.json()
            msg = err_body.get("message") or err_body.get("error") or r.text[:500]
        except Exception:
            msg = r.text[:500] if r.text else f"HTTP {r.status_code}"
        return (False, None, msg)
    except requests.exceptions.Timeout:
        return (False, None, "Request timed out")
    except requests.exceptions.RequestException as e:
        return (False, None, str(e)[:500])


def get_doordash_store_details(establishment_id: int, config: Dict[str, Any]) -> tuple:
    """
    Get store info from DoorDash: order protocol (POS/tablet), special instructions max length,
    is_active, current_deactivations, auto_release settings, etc.
    Returns (success: bool, data: dict | None, error_message: str | None).
    """
    return _doordash_get_store_api(establishment_id, config, "store_details")


def get_doordash_menu_details(establishment_id: int, config: Dict[str, Any]) -> tuple:
    """
    Get menu info from DoorDash: menu_id, is_active, is_pos_menu, url, latest_menu_update,
    last_successful_menu_update_at, open_hours, special_hours per menu.
    Returns (success: bool, data: dict | None, error_message: str | None).
    """
    return _doordash_get_store_api(establishment_id, config, "menu_details")


# Accepted reasons for store deactivation (Store activation status change API)
DOORDASH_STORE_DEACTIVATE_REASONS = [
    "out_of_business",
    "delete_store",
    "payment_issue",
    "operational_issues",
    "store_self_disabled_in_their_POS_portal",
    "store_pos_connectivity_issues",
]


def update_doordash_store_status(
    establishment_id: int,
    config: Dict[str, Any],
    is_active: bool,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    end_time: Optional[str] = None,
    duration_in_secs: Optional[str] = None,
    duration_in_hours: Optional[str] = None,
) -> tuple:
    """
    PUT api/v1/stores/{merchant_supplied_id}/status — activate or deactivate store on DoorDash.
    Reactivate: only is_active=True is required (reason/notes ignored).
    Deactivate: is_active=False, reason (required), notes (required). Optional: end_time (ISO),
    or duration_in_hours + duration_in_secs for temporary deactivation.
    Without end_time/duration, DoorDash deactivates for 2 weeks then auto-reactivates.
    Returns (success: bool, message: str). On 400 from DoorDash (e.g. banking/menu checks), returns (False, message).
    """
    import requests
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return (False, "DoorDash API key not configured")
    base_url = (config.get("api_base_url") or "https://api.doordash.com").strip().rstrip("/")
    merchant_supplied_id = str(establishment_id)
    url = f"{base_url}/api/v1/stores/{merchant_supplied_id}/status"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "SampleIntegration/1.0",
    }
    if is_active:
        payload: Dict[str, Any] = {"is_active": True}
    else:
        reason_val = (reason or "").strip()
        notes_val = (notes or "").strip()
        if not reason_val:
            return (False, "Deactivation requires a reason")
        if reason_val not in DOORDASH_STORE_DEACTIVATE_REASONS:
            return (False, f"Reason must be one of: {', '.join(DOORDASH_STORE_DEACTIVATE_REASONS)}")
        if not notes_val:
            return (False, "Deactivation requires notes (detail for internal records)")
        payload = {
            "is_active": False,
            "reason": reason_val,
            "notes": notes_val[:2000],
        }
        if end_time and str(end_time).strip():
            payload["end_time"] = str(end_time).strip()
        if duration_in_hours is not None and str(duration_in_hours).strip():
            payload["duration_in_hours"] = str(duration_in_hours).strip()
        if duration_in_secs is not None and str(duration_in_secs).strip():
            payload["duration_in_secs"] = str(duration_in_secs).strip()
    try:
        r = requests.put(url, json=payload, headers=headers, timeout=30)
        if 200 <= r.status_code < 300:
            return (True, "Store reactivated" if is_active else "Store deactivation sent successfully")
        try:
            err_body = r.json()
            msg = err_body.get("message") or err_body.get("error") or r.text[:500]
        except Exception:
            msg = r.text[:500] if r.text else f"HTTP {r.status_code}"
        return (False, msg)
    except requests.exceptions.Timeout:
        return (False, "Request timed out")
    except requests.exceptions.RequestException as e:
        return (False, str(e)[:500])


def _flatten_order_items(doordash_order: Dict[str, Any], establishment_id: int, price_multiplier: float) -> tuple:
    """
    Flatten DoorDash order categories/items/extras/options into POS order items.
    Supports recipes: uses chargeable_quantity when present for option pricing; collects removed_options for notes.
    Collects line_item_id and line_option_id for Merchant Order Adjustment API.
    Returns (order_items: List[Dict], recipe_notes: Optional[str], doordash_lines: List[Dict]).
    """
    from database import get_or_create_product_for_doordash

    order_items: List[Dict[str, Any]] = []
    doordash_lines: List[Dict[str, Any]] = []
    removed_names: List[str] = []
    categories = doordash_order.get("categories") or []
    subtotal_cents = int(doordash_order.get("subtotal") or 0)

    for cat in categories:
        if not isinstance(cat, dict):
            continue
        for it in (cat.get("items") or []):
            if not isinstance(it, dict):
                continue
            name = (it.get("name") or "Item").strip() or "Item"
            ext_id = str(it.get("merchant_supplied_id") or "") or f"item-{hash(name) % 10**8}"
            qty = int(it.get("quantity") or 1)
            if qty < 1:
                continue
            price_cents = int(it.get("price") or 0)
            unit_price = (price_cents / 100.0) * price_multiplier if price_cents > 0 else 0.01
            product_id = get_or_create_product_for_doordash(establishment_id, ext_id, name, unit_price if unit_price > 0 else 0.01)
            if unit_price <= 0:
                unit_price = 0.01
            line_item_id = (it.get("line_item_id") or it.get("id") or "").strip() or None
            if line_item_id:
                doordash_lines.append({
                    "line_item_id": line_item_id,
                    "line_option_id": None,
                    "product_id": product_id,
                    "quantity": qty,
                    "unit_price_cents": price_cents,
                })
            order_items.append({"product_id": product_id, "quantity": qty, "unit_price": round(unit_price, 2), "discount": 0, "tax_rate": 0})
            for ex in (it.get("extras") or []):
                if not isinstance(ex, dict):
                    continue
                for ro in (ex.get("removed_options") or []):
                    if isinstance(ro, dict):
                        n = (ro.get("name") or ro.get("merchant_supplied_id") or "").strip()
                        if n and n not in removed_names:
                            removed_names.append(n)
                for opt in (ex.get("options") or []):
                    if not isinstance(opt, dict):
                        continue
                    opt_name = (opt.get("name") or "Modifier").strip() or "Modifier"
                    opt_id = str(opt.get("merchant_supplied_id") or "") or f"opt-{hash(opt_name) % 10**8}"
                    opt_qty = int(opt.get("quantity") or 1)
                    chargeable = opt.get("chargeable_quantity")
                    if chargeable is not None and isinstance(chargeable, (int, float)):
                        opt_qty = int(chargeable)
                    if opt_qty < 1:
                        continue
                    opt_cents = int(opt.get("price") or 0)
                    opt_price = (opt_cents / 100.0) * price_multiplier if opt_cents > 0 else 0.01
                    pid_opt = get_or_create_product_for_doordash(establishment_id, opt_id, opt_name, opt_price if opt_price > 0 else 0.01)
                    line_option_id = (opt.get("line_option_id") or opt.get("line_item_id") or opt.get("id") or "").strip() or None
                    if line_item_id and line_option_id:
                        doordash_lines.append({
                            "line_item_id": line_item_id,
                            "line_option_id": line_option_id,
                            "product_id": pid_opt,
                            "quantity": opt_qty,
                            "unit_price_cents": opt_cents,
                        })
                    order_items.append({"product_id": pid_opt, "quantity": opt_qty, "unit_price": round(opt_price, 2) if opt_price > 0 else 0.01, "discount": 0, "tax_rate": 0})

    recipe_notes = ("Removed: " + ", ".join(removed_names)) if removed_names else None

    if not order_items and subtotal_cents > 0:
        product_id = get_or_create_product_for_doordash(establishment_id, "doordash-order-total", "DoorDash Order", (subtotal_cents / 100.0) * price_multiplier)
        order_items.append({"product_id": product_id, "quantity": 1, "unit_price": round((subtotal_cents / 100.0) * price_multiplier, 2), "discount": 0, "tax_rate": 0})
    return (order_items, recipe_notes, doordash_lines)


def _extract_doordash_promotions(doordash_order: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract Integrated Promotions data: order-level applied_discounts_details, item-level
    applied_item_discount_details, and funding totals. Returns dict with total_discount_cents,
    doordash_promo_details (for DB JSONB), total_merchant_funded_cents, total_doordash_funded_cents.
    """
    order_details = list(doordash_order.get("applied_discounts_details") or [])
    if not isinstance(order_details, list):
        order_details = []
    item_details: List[Dict[str, Any]] = []
    for cat in (doordash_order.get("categories") or []):
        if not isinstance(cat, dict):
            continue
        for it in (cat.get("items") or []):
            if not isinstance(it, dict):
                continue
            applied = it.get("applied_item_discount_details")
            if isinstance(applied, list) and applied:
                for entry in applied:
                    if isinstance(entry, dict):
                        item_details.append({
                            "item_name": (it.get("name") or "").strip(),
                            "merchant_supplied_id": (it.get("merchant_supplied_id") or "").strip(),
                            **{k: v for k, v in entry.items() if k in (
                                "total_discount_amount", "promo_id", "promo_code", "external_campaign_id",
                                "merchant_funded_discount_amount", "doordash_funded_discount_amount", "promo_quantity"
                            )}
                        })
    total_discount_cents = 0
    total_merchant_cents = 0
    total_doordash_cents = 0
    for entry in order_details:
        if isinstance(entry, dict):
            total_discount_cents += int(entry.get("total_discount_amount") or 0)
            total_merchant_cents += int(entry.get("merchant_funded_discount_amount") or 0)
            total_doordash_cents += int(entry.get("doordash_funded_discount_amount") or 0)
    for entry in item_details:
        total_discount_cents += int(entry.get("total_discount_amount") or 0)
        total_merchant_cents += int(entry.get("merchant_funded_discount_amount") or 0)
        total_doordash_cents += int(entry.get("doordash_funded_discount_amount") or 0)
    if not order_details and not item_details:
        order_total_merchant = int(doordash_order.get("total_merchant_funded_discount_amount") or 0)
        if order_total_merchant >= 0:
            total_merchant_cents = order_total_merchant
    elif order_details or item_details:
        order_total = int(doordash_order.get("total_merchant_funded_discount_amount") or 0)
        if order_total >= 0 and order_total != total_merchant_cents:
            total_merchant_cents = order_total
    promo_details = {
        "applied_discounts_details": order_details,
        "applied_item_discount_details": item_details,
        "total_merchant_funded_discount_cents": total_merchant_cents,
        "total_doordash_funded_discount_cents": total_doordash_cents,
    }
    return {
        "total_discount_cents": total_discount_cents,
        "doordash_promo_details": promo_details,
        "total_merchant_funded_cents": total_merchant_cents,
        "total_doordash_funded_cents": total_doordash_cents,
    }


def _add_bag_fee_items(doordash_order: Dict[str, Any], items: List[Dict[str, Any]], establishment_id: int, price_multiplier: float) -> Optional[str]:
    """
    Append Bag Fee line items from custom_fee (type BAG_FEE; price and tax in cents).
    DoorDash charges the customer; we add a line item so the POS order reflects the fee for reconciliation.
    Returns a note line for bag fee tax if present (caller can append to order notes).
    """
    custom_fee = doordash_order.get("custom_fee")
    if not isinstance(custom_fee, list):
        return None
    from database import get_or_create_product_for_doordash
    bag_fee_tax_note = None
    for entry in custom_fee:
        if not isinstance(entry, dict) or (entry.get("type") or "").strip().upper() != "BAG_FEE":
            continue
        try:
            price_cents = int(entry.get("price") or 0)
            tax_cents = int(entry.get("tax") or 0)
        except (TypeError, ValueError):
            continue
        if price_cents <= 0:
            continue
        unit_price = (price_cents / 100.0) * price_multiplier
        product_id = get_or_create_product_for_doordash(establishment_id, "doordash-bag-fee", "Bag Fee", unit_price if unit_price > 0 else 0.01)
        items.append({"product_id": product_id, "quantity": 1, "unit_price": round(unit_price, 2), "discount": 0, "tax_rate": 0})
        if tax_cents > 0 and bag_fee_tax_note is None:
            bag_fee_tax_note = f"Bag fee tax: ${tax_cents / 100:.2f}"
    return bag_fee_tax_note


def build_pos_payload_from_doordash_order(doordash_order: Dict[str, Any], establishment_id: int, price_multiplier: float = 1.0) -> Optional[Dict[str, Any]]:
    if not doordash_order or not isinstance(doordash_order, dict):
        return None
    items, recipe_notes, doordash_lines = _flatten_order_items(doordash_order, establishment_id, price_multiplier)
    if not items:
        return None
    bag_fee_tax_note = _add_bag_fee_items(doordash_order, items, establishment_id, price_multiplier)
    promo = _extract_doordash_promotions(doordash_order)
    consumer = doordash_order.get("consumer") or {}
    if isinstance(consumer, dict):
        first = (consumer.get("first_name") or "").strip()
        last = (consumer.get("last_name") or "").strip()
        name = f"{first} {last}".strip() or "DoorDash Customer"
        phone = (consumer.get("phone") or "").strip() or None
        email = (consumer.get("email") or "").strip() or None
    else:
        name, phone, email = "DoorDash Customer", None, None
    prepare_by = (doordash_order.get("estimated_pickup_time") or "").strip() or None
    is_pickup = doordash_order.get("is_pickup") is True
    order_type = "pickup" if is_pickup else "delivery"
    tax_cents = int(doordash_order.get("tax") or 0)
    tax_rate = 0.0
    subtotal_for_tax_cents = doordash_order.get("subtotal_for_tax")
    subtotal_tax_amount_cents = doordash_order.get("subtotal_tax_amount")
    if subtotal_for_tax_cents is not None and subtotal_tax_amount_cents is not None:
        try:
            st = int(subtotal_for_tax_cents)
            sta = int(subtotal_tax_amount_cents)
            if st > 0:
                tax_rate = (sta / 100.0) / (st / 100.0)
        except (TypeError, ValueError):
            pass
    if tax_rate <= 0 and tax_cents > 0:
        items_subtotal = sum(it["quantity"] * it["unit_price"] for it in items)
        if items_subtotal > 0:
            tax_rate = (tax_cents / 100.0) / items_subtotal
    tip_cents = int(doordash_order.get("merchant_tip_amount") or doordash_order.get("tip_amount") or 0)
    tip = tip_cents / 100.0
    order_notes = (doordash_order.get("order_special_instructions") or (doordash_order.get("special_instructions") or "") or "").strip()
    if recipe_notes:
        order_notes = f"{order_notes}\n{recipe_notes}".strip() if order_notes else recipe_notes

    # Self-Delivery: delivery_address, address_instructions, delivery_fee (store uses own fleet)
    customer_address = None
    delivery_address = doordash_order.get("delivery_address")
    if isinstance(delivery_address, dict) and not is_pickup:
        street = (delivery_address.get("street") or "").strip()
        subpremise = (delivery_address.get("subpremise") or "").strip()
        city = (delivery_address.get("city") or "").strip()
        state = (delivery_address.get("state") or "").strip()
        zip_code = (delivery_address.get("zip_code") or "").strip()
        country_code = (delivery_address.get("country_code") or "").strip()
        parts = [p for p in [street, f"Apt/Unit {subpremise}" if subpremise else None, city, f"{state} {zip_code}".strip() or None, country_code if country_code and country_code != "US" else None] if p]
        customer_address = ", ".join(parts) if parts else None
    address_instructions = (doordash_order.get("address_instructions") or "").strip() or (isinstance(delivery_address, dict) and (delivery_address.get("address_instructions") or "").strip()) or None
    delivery_fee_cents = None
    try:
        delivery_fee_cents = int(doordash_order.get("delivery_fee") or 0)
    except (TypeError, ValueError):
        pass
    if address_instructions:
        order_notes = f"{order_notes}\nDelivery instructions: {address_instructions}".strip() if order_notes else f"Delivery instructions: {address_instructions}"
    if delivery_fee_cents is not None and delivery_fee_cents > 0:
        order_notes = f"{order_notes}\nDelivery fee (charged to customer): ${delivery_fee_cents / 100:.2f}".strip() if order_notes else f"Delivery fee (charged to customer): ${delivery_fee_cents / 100:.2f}"
    if bag_fee_tax_note:
        order_notes = f"{order_notes}\n{bag_fee_tax_note}".strip() if order_notes else bag_fee_tax_note

    # Plasticware toggle: consumer opt-in/opt-out for single-use utensils, napkins, etc.
    plastic_ware = doordash_order.get("is_plastic_ware_option_selected")
    if plastic_ware is True:
        order_notes = f"{order_notes}\nInclude plasticware / utensils (customer requested)".strip() if order_notes else "Include plasticware / utensils (customer requested)"
    elif plastic_ware is False:
        order_notes = f"{order_notes}\nNo plasticware".strip() if order_notes else "No plasticware"

    discount_dollars = (promo["total_discount_cents"] / 100.0) if promo["total_discount_cents"] else 0.0
    return {
        "order_source": "doordash",
        "items": items,
        "customer_name": name,
        "customer_phone": phone,
        "customer_email": email,
        "customer_address": customer_address,
        "order_type": order_type,
        "prepare_by_iso": prepare_by,
        "tax_rate": tax_rate,
        "discount": round(discount_dollars, 2),
        "tip": tip,
        "doordash_order_id": doordash_order.get("id"),
        "notes": order_notes or None,
        "doordash_lines": doordash_lines,
        "doordash_promo_details": promo["doordash_promo_details"] if promo["total_discount_cents"] or promo["total_merchant_funded_cents"] or promo["total_doordash_funded_cents"] else None,
        "doordash_total_merchant_funded_discount_cents": promo["total_merchant_funded_cents"] or None,
        "doordash_total_doordash_funded_discount_cents": promo["total_doordash_funded_cents"] or None,
    }


# Standard failure reasons (DoorDash required themes for tracking)
FAILURE_REASON_STORE_HOURS = "Store Unavailable - Hours out of Sync"
FAILURE_REASON_STORE_CLOSED = "Store Unavailable - Closed or Remodel"
FAILURE_REASON_CONNECTIVITY = "Store Unavailable - Connectivity Issue"
FAILURE_REASON_CAPACITY = "Store is experiencing high order volume and cannot prepare your order for the requested time."
FAILURE_REASON_PICKUP_TIME = "Pickup time sent in the order is no longer available."
FAILURE_REASON_STORE_DISABLED = "Store is disabled for online ordering. Store must be enabled to receive orders."
FAILURE_REASON_ITEM_OOS = "Item Unavailable - {name} - {id} - Out of stock"
FAILURE_REASON_ITEM_HOURS = "Item Unavailable - {name} - {id} - This item is not being served at this time"
FAILURE_REASON_ITEM_MISSING = "Item Missing - {name} - {id} - This item is no longer on the Menu"
FAILURE_REASON_PRICING = "Pricing Mismatch - {name} - {id}"
FAILURE_REASON_STORE_MISCONFIGURED = "Store is misconfigured with incorrect integration ID"
FAILURE_REASON_PROMO = "Promo {external_campaign_id} failed validation"
FAILURE_REASON_PROMO_BY_ID = "Promo {promo_id} failed validation"


def confirm_doordash_order(
    doordash_order_id: str,
    merchant_supplied_id: str,
    success: bool = True,
    failure_reason: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    prep_time: Optional[str] = None,
    pickup_instructions: Optional[str] = None,
) -> bool:
    """
    Confirm or fail a DoorDash order (PATCH /api/v1/orders/{id}).
    prep_time: optional ISO datetime UTC for provider-calculated prep time (do not echo estimated_pickup_time).
    pickup_instructions: optional message shown to the Dasher when they receive the order and when they arrive at the store.
    """
    if not config or not doordash_order_id:
        return False
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return False
    base_url = (config.get("api_base_url") or "https://api.doordash.com").strip().rstrip("/")
    url = f"{base_url}/api/v1/orders/{doordash_order_id}"
    payload: Dict[str, Any] = {"merchant_supplied_id": str(merchant_supplied_id), "order_status": "success" if success else "fail"}
    if failure_reason and not success:
        payload["failure_reason"] = failure_reason[:500]
    if prep_time and success and isinstance(prep_time, str) and prep_time.strip():
        payload["prep_time"] = prep_time.strip()[:64]
    if success and pickup_instructions and isinstance(pickup_instructions, str) and pickup_instructions.strip():
        payload["pickup_instructions"] = pickup_instructions.strip()[:500]
    try:
        import requests
        r = requests.patch(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=15)
        return 200 <= r.status_code < 300
    except Exception as e:
        print(f"Doordash confirm order error: {e}")
        return False


def _doordash_marketplace_base(config: Optional[Dict[str, Any]]) -> str:
    """Base URL for DoorDash Marketplace API (order events, cancellation)."""
    return (config.get("doordash_marketplace_base_url") or config.get("api_base_url") or "https://openapi.doordash.com").strip().rstrip("/")


def notify_doordash_order_ready(doordash_order_id: str, merchant_supplied_id: str, config: Optional[Dict[str, Any]] = None) -> bool:
    """
    Order Ready Signal (ORS): notify DoorDash that the order is ready for pickup.
    PATCH https://openapi.doordash.com/marketplace/api/v1/orders/{id}/events/order_ready_for_pickup
    Payload: { "merchant_supplied_id": "<pos order id>" }. DoorDash returns 202 on success.
    Returns True if request accepted (202 or 2xx).
    """
    if not config or not doordash_order_id:
        return False
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return False
    base = _doordash_marketplace_base(config)
    url = f"{base}/marketplace/api/v1/orders/{doordash_order_id}/events/order_ready_for_pickup"
    payload = {"merchant_supplied_id": str(merchant_supplied_id)}
    try:
        import requests
        r = requests.patch(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=15)
        return 200 <= r.status_code < 300
    except Exception as e:
        print(f"Doordash order ready error: {e}")
        return False


def build_live_order_manager_url(external_order_id: str, config: Optional[Dict[str, Any]]) -> tuple:
    """
    Build the Live Order Manager for POS URL with JWT for iframe/webview.
    URL format: https://www.doordash.com/merchant/live-order-management/v2?id=<orderId>#t=<JWT>
    Config: order_manager_jwt_secret (required), order_manager_iss (optional), order_manager_kid (optional).
    JWT exp 900s (15 min) recommended for POS. Returns (url: str | None, error: str | None).
    """
    if not config or not (external_order_id or "").strip():
        return (None, "Missing config or external_order_id")
    secret = (config.get("order_manager_jwt_secret") or "").strip()
    if not secret:
        return (None, "DoorDash Order Manager JWT secret not configured. Add order_manager_jwt_secret in Settings → Integrations → DoorDash.")
    try:
        import jwt
        import time
        iat = int(time.time())
        exp = iat + 900  # 15 minutes
        iss = (config.get("order_manager_iss") or config.get("api_key") or "pos").strip() or "pos"
        kid = (config.get("order_manager_kid") or config.get("api_key") or "").strip() or "default"
        payload = {"iss": iss[:128], "kid": kid[:128], "iat": iat, "exp": exp}
        token = jwt.encode(payload, secret, algorithm="HS256")
        if hasattr(token, "decode"):
            token = token.decode("utf-8")
        base = "https://www.doordash.com/merchant/live-order-management/v2"
        url = f"{base}?id={external_order_id.strip()}#t={token}"
        return (url, None)
    except Exception as e:
        return (None, str(e)[:500])


def generate_doordash_reporting_jwt(access_key: Dict[str, Any], validity_seconds: int = 300) -> str:
    """
    Generate a JWT for DoorDash Reporting API (Data Exchange).
    access_key: dict with developer_id, key_id, signing_secret (base64).
    validity_seconds: token lifetime (default 300 = 5 min). Returns the JWT string.
    """
    import base64
    import jwt
    import time
    developer_id = str(access_key.get("developer_id") or "").strip()
    key_id = str(access_key.get("key_id") or "").strip()
    signing_secret_b64 = (access_key.get("signing_secret") or "").strip()
    if not developer_id or not key_id or not signing_secret_b64:
        raise ValueError("access_key must include developer_id, key_id, and signing_secret")
    secret_bytes = base64.b64decode(signing_secret_b64)
    now = int(time.time())
    payload = {
        "aud": "doordash",
        "iss": developer_id,
        "kid": key_id,
        "exp": now + validity_seconds,
        "iat": now,
    }
    headers = {"dd-ver": "DD-JWT-V1"}
    token = jwt.encode(payload, secret_bytes, algorithm="HS256", headers=headers)
    if hasattr(token, "decode"):
        token = token.decode("utf-8")
    return token


def adjust_doordash_order(
    doordash_order_id: str,
    items: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> tuple:
    """
    Merchant Order Adjustment: PATCH .../orders/{id}/adjustment.
    items: list of { line_item_id, adjustment_type: ITEM_UPDATE|ITEM_REMOVE|ITEM_SUBSTITUTE, quantity?, options?: [{ line_option_id, adjustment_type, quantity }], substituted_item?: { name, merchant_supplied_id, price, quantity } }.
    price in substituted_item is in cents. Returns (success: bool, status_code: Optional[int], message: str).
    """
    if not config or not doordash_order_id or not items:
        return (False, None, "Missing order id, config, or items")
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return (False, None, "No API key")
    base = _doordash_marketplace_base(config)
    url = f"{base}/marketplace/api/v1/orders/{doordash_order_id}/adjustment"
    payload = {"items": []}
    for it in items:
        entry: Dict[str, Any] = {
            "line_item_id": str(it.get("line_item_id") or "").strip(),
            "adjustment_type": (it.get("adjustment_type") or "ITEM_UPDATE").strip().upper(),
        }
        if not entry["line_item_id"]:
            continue
        if entry["adjustment_type"] not in ("ITEM_UPDATE", "ITEM_REMOVE", "ITEM_SUBSTITUTE"):
            entry["adjustment_type"] = "ITEM_UPDATE"
        if entry["adjustment_type"] == "ITEM_UPDATE" and "quantity" in it:
            entry["quantity"] = int(it["quantity"])
        if entry["adjustment_type"] == "ITEM_UPDATE" and it.get("options"):
            entry["options"] = []
            for o in it["options"]:
                opt_entry = {
                    "line_option_id": str(o.get("line_option_id") or "").strip(),
                    "adjustment_type": (o.get("adjustment_type") or "ITEM_UPDATE").strip().upper(),
                }
                if opt_entry["line_option_id"] and "quantity" in o:
                    opt_entry["quantity"] = int(o["quantity"])
                    entry["options"].append(opt_entry)
        if entry["adjustment_type"] == "ITEM_SUBSTITUTE" and it.get("substituted_item"):
            sub = it["substituted_item"]
            entry["substituted_item"] = {
                "name": (sub.get("name") or "Substitute")[:500],
                "merchant_supplied_id": str(sub.get("merchant_supplied_id") or "")[:1024],
                "price": int(sub.get("price", 0)),
                "quantity": int(sub.get("quantity", 1)),
            }
        payload["items"].append(entry)
    if not payload["items"]:
        return (False, None, "No valid adjustment items")
    try:
        import requests
        r = requests.patch(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=15)
        if 200 <= r.status_code < 300:
            return (True, r.status_code, r.text or "OK")
        return (False, r.status_code, (r.text or "")[:500] or f"HTTP {r.status_code}")
    except Exception as e:
        print(f"Doordash adjust order error: {e}")
        return (False, None, str(e))


def cancel_doordash_order(
    doordash_order_id: str,
    cancel_reason: str = "OTHER",
    cancel_details: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> tuple:
    """
    Merchant order cancellation: PATCH .../orders/{id}/cancellation.
    cancel_reason (required): ITEM_OUT_OF_STOCK | STORE_CLOSED | KITCHEN_BUSY | OTHER.
    DoorDash temporarily deactivates: STORE_CLOSED 12 hrs, KITCHEN_BUSY 15 min. Success is 202.
    Returns (success: bool, status_code: Optional[int]).
    """
    if not config or not doordash_order_id:
        return (False, None)
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        return (False, None)
    valid = ("ITEM_OUT_OF_STOCK", "STORE_CLOSED", "KITCHEN_BUSY", "OTHER")
    reason = (cancel_reason or "OTHER").strip().upper()
    if reason not in valid:
        reason = "OTHER"
    base = _doordash_marketplace_base(config)
    url = f"{base}/marketplace/api/v1/orders/{doordash_order_id}/cancellation"
    payload: Dict[str, Any] = {"cancel_reason": reason}
    if cancel_details and isinstance(cancel_details, str) and cancel_details.strip():
        payload["cancel_details"] = cancel_details.strip()[:500]
    try:
        import requests
        r = requests.patch(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=15)
        return (200 <= r.status_code < 300, r.status_code)
    except Exception as e:
        print(f"Doordash cancel order error: {e}")
        return (False, None)
