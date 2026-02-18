"""
Import Square export files (CSV or Excel) into POS inventory.
Supports Square Item Library export and similar column names.
"""
from __future__ import annotations

import csv
import io
import re
from typing import Any, Dict, List, Optional, Tuple

# Header aliases -> our field name
ITEM_HEADER_MAP = {
    "item name": "product_name",
    "name": "product_name",
    "product name": "product_name",
    "title": "product_name",
    "item": "product_name",
    "sku": "sku",
    "item id": "sku",
    "product id": "sku",
    "variation id": "sku",
    "price": "product_price",
    "unit price": "product_price",
    "sale price": "product_price",
    "retail price": "product_price",
    "amount": "product_price",
    "cost": "product_cost",
    "unit cost": "product_cost",
    "category": "category",
    "category name": "category",
    "barcode": "barcode",
    "upc": "barcode",
    "quantity": "current_quantity",
    "current quantity": "current_quantity",
    "inventory": "current_quantity",
    "description": "description",
}


def _normalize_header(h: str) -> str:
    return (h or "").strip().lower()


def _parse_amount(s: Any) -> float:
    if s is None or s == "":
        return 0.0
    if isinstance(s, (int, float)):
        return float(s)
    t = str(s).strip().replace(",", "")
    # Remove currency symbols and spaces
    t = re.sub(r"^[$€£¥\s]+|\s+$", "", t)
    t = re.sub(r"[^\d.\-]", "", t)
    try:
        return float(t)
    except ValueError:
        return 0.0


def _parse_int(s: Any) -> int:
    if s is None or s == "":
        return 0
    if isinstance(s, int):
        return s
    try:
        return int(float(str(s).strip().replace(",", "")))
    except (ValueError, TypeError):
        return 0


def parse_square_items_file(
    file_content: bytes,
    filename: str = "",
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parse a Square (or similar) items export file. Returns (list of row dicts, list of parse errors).
    Row dict keys: product_name, sku, product_price, product_cost, category, barcode, current_quantity.
    """
    errors: List[str] = []
    rows: List[Dict[str, Any]] = []
    lower = (filename or "").lower()

    if lower.endswith(".xlsx") or lower.endswith(".xls"):
        try:
            import pandas as pd
            df = pd.read_excel(io.BytesIO(file_content), engine="openpyxl" if lower.endswith(".xlsx") else None)
            if df is None or df.empty:
                return [], ["File is empty or could not be read."]
            # First row as headers
            headers = [str(c).strip() for c in df.columns]
            for idx, r in df.iterrows():
                row_dict: Dict[str, str] = {}
                for i, h in enumerate(headers):
                    val = r.iloc[i]
                    if pd.isna(val):
                        val = ""
                    row_dict[h] = str(val).strip() if val != "" else ""
                mapped = _map_row_to_product(row_dict)
                if mapped:
                    rows.append(mapped)
        except Exception as e:
            errors.append(f"Excel parse error: {e}")
            return [], errors
        return rows, errors

    # CSV
    try:
        text = file_content.decode("utf-8-sig")
    except Exception:
        try:
            text = file_content.decode("latin-1")
        except Exception as e:
            errors.append(f"Could not decode file: {e}")
            return [], errors
    reader = csv.reader(io.StringIO(text))
    line_rows = list(reader)
    if not line_rows:
        return [], ["File is empty."]
    headers = [_normalize_header(h) for h in line_rows[0]]
    for i, cells in enumerate(line_rows[1:], start=2):
        row_dict = {}
        for j, h in enumerate(line_rows[0]):
            val = cells[j] if j < len(cells) else ""
            row_dict[h] = str(val).strip() if val else ""
        mapped = _map_row_to_product(row_dict)
        if mapped:
            rows.append(mapped)
    return rows, errors


def _map_row_to_product(row_dict: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """Map a raw row (header -> value) to our product fields using ITEM_HEADER_MAP."""
    out: Dict[str, Any] = {
        "product_name": "",
        "sku": "",
        "product_price": 0.0,
        "product_cost": 0.0,
        "category": None,
        "barcode": None,
        "current_quantity": 0,
    }
    used_headers = set()
    for raw_h, val in row_dict.items():
        norm = _normalize_header(raw_h)
        field = ITEM_HEADER_MAP.get(norm)
        if not field or field in used_headers:
            continue
        used_headers.add(field)
        if field == "product_name":
            out["product_name"] = (val or "").strip()[:255]
        elif field == "sku":
            out["sku"] = (val or "").strip()[:100]
        elif field == "product_price":
            out["product_price"] = _parse_amount(val)
        elif field == "product_cost":
            out["product_cost"] = _parse_amount(val)
        elif field == "category":
            out["category"] = (val or "").strip()[:100] or None
        elif field == "barcode":
            out["barcode"] = (val or "").strip()[:100] or None
        elif field == "current_quantity":
            out["current_quantity"] = _parse_int(val)
    if not out["product_name"] and not out["sku"]:
        return None
    if not out["product_name"]:
        out["product_name"] = out["sku"] or "Imported item"
    if not out["sku"]:
        out["sku"] = f"imp-{hash(out['product_name']) % 10**8}"
    return out


def run_square_file_import(
    items_rows: List[Dict[str, Any]],
    establishment_id_override: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Import parsed item rows into POS inventory via add_product.
    Returns: { success, imported: int, skipped: int, errors: list of str }.
    """
    from database import add_product
    from database_postgres import get_current_establishment

    result = {"success": True, "imported": 0, "skipped": 0, "errors": []}
    establishment_id = establishment_id_override
    if establishment_id is None:
        try:
            establishment_id = get_current_establishment()
        except Exception:
            establishment_id = 1

    for row in items_rows:
        name = (row.get("product_name") or "").strip() or "Imported"
        sku = (row.get("sku") or "").strip() or f"imp-{result['imported'] + result['skipped'] + 1}"
        price = float(row.get("product_price", 0) or 0)
        cost = float(row.get("product_cost", 0) or 0)
        category = row.get("category")
        barcode = row.get("barcode")
        qty = int(row.get("current_quantity", 0) or 0)
        try:
            add_product(
                product_name=name[:255],
                sku=sku[:100],
                product_price=price,
                product_cost=cost,
                current_quantity=qty,
                category=category,
                barcode=barcode,
                item_type="product",
                sell_at_pos=True,
            )
            result["imported"] += 1
        except Exception as e:
            result["skipped"] += 1
            result["errors"].append(f"{name or sku}: {str(e)[:80]}")
            if len(result["errors"]) >= 20:
                result["errors"].append("... more errors omitted")
                break
    return result
