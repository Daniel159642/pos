#!/usr/bin/env python3
"""
Vendor Model/Repository Layer
Handles all database operations for accounting_vendors and bills
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database_postgres import get_cursor


def _row_to_dict(row) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    d = dict(row) if hasattr(row, "keys") else {}
    out = {}
    for k, v in d.items():
        if isinstance(v, (date, datetime)):
            out[k] = v.isoformat() if v else None
        elif hasattr(v, "__float__") and not isinstance(v, bool) and v is not None:
            try:
                out[k] = float(v)
            except (TypeError, ValueError):
                out[k] = v
        else:
            out[k] = v
    return out


def _scalar(row, *keys):
    if row is None:
        return None
    if hasattr(row, "keys"):
        for k in keys:
            if k in row:
                return row[k]
        return next(iter(row.values())) if row else None
    return row[0] if len(row) > 0 else None


class VendorRepository:
    """Repository for accounting_vendors and bills"""

    TABLE = "accounting_vendors"
    BILLS_TABLE = "bills"

    @staticmethod
    def find_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        cursor = get_cursor()
        base = f"SELECT * FROM {VendorRepository.TABLE} WHERE 1=1"
        params: List[Any] = []

        if filters:
            if filters.get("is_1099_vendor") is not None:
                base += " AND is_1099_vendor = %s"
                params.append(filters["is_1099_vendor"])
            if filters.get("is_active") is not None:
                base += " AND is_active = %s"
                params.append(filters["is_active"])
            if filters.get("search"):
                base += " AND (vendor_number ILIKE %s OR vendor_name ILIKE %s OR contact_name ILIKE %s OR email ILIKE %s)"
                t = f"%{filters['search']}%"
                params.extend([t] * 4)

        count_sql = f"SELECT COUNT(*) AS total FROM ({base}) _c"
        cursor.execute(count_sql, params)
        total = int(_scalar(cursor.fetchone(), "total") or 0)

        page = max(1, int(filters.get("page") or 1))
        limit = min(100, max(1, int(filters.get("limit") or 50)))
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit if limit else 0

        base += " ORDER BY vendor_number, vendor_name LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(base, params)
        rows = cursor.fetchall()
        vendors = [_row_to_dict(r) for r in rows]
        cursor.close()

        return {"vendors": vendors, "total": total, "page": page, "total_pages": total_pages}

    @staticmethod
    def find_by_id(vendor_id: int) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {VendorRepository.TABLE} WHERE id = %s", (vendor_id,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None
        finally:
            cursor.close()

    @staticmethod
    def find_by_vendor_number(vendor_number: str) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {VendorRepository.TABLE} WHERE vendor_number = %s", (vendor_number,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None
        finally:
            cursor.close()

    @staticmethod
    def find_by_email(email: str, exclude_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            if exclude_id is not None:
                cursor.execute(
                    f"SELECT * FROM {VendorRepository.TABLE} WHERE LOWER(email) = LOWER(%s) AND id != %s",
                    (email, exclude_id),
                )
            else:
                cursor.execute(f"SELECT * FROM {VendorRepository.TABLE} WHERE LOWER(email) = LOWER(%s)", (email,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None
        finally:
            cursor.close()

    @staticmethod
    def email_exists(email: str, exclude_id: Optional[int] = None) -> bool:
        return VendorRepository.find_by_email(email, exclude_id) is not None

    @staticmethod
    def generate_vendor_number() -> str:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT vendor_number FROM {VendorRepository.TABLE}
                WHERE vendor_number ~ '^VEND-[0-9]+$'
                ORDER BY CAST(SUBSTRING(vendor_number FROM 6) AS INTEGER) DESC
                LIMIT 1
                """
            )
            row = cursor.fetchone()
            if not row:
                return "VEND-0001"
            vn = _scalar(row, "vendor_number")
            num = int(re.sub(r"^VEND-", "", str(vn)))
            return f"VEND-{num + 1:04d}"
        finally:
            cursor.close()

    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        vendor_number = data.get("vendor_number") or VendorRepository.generate_vendor_number()
        if data.get("vendor_number"):
            existing = VendorRepository.find_by_vendor_number(data["vendor_number"])
            if existing:
                raise ValueError("Vendor number already exists")

        cursor = get_cursor()
        conn = cursor.connection
        try:
            cursor.execute(
                f"""
                INSERT INTO {VendorRepository.TABLE} (
                    vendor_number, vendor_name, contact_name, email, phone, website,
                    address_line1, address_line2, city, state, postal_code, country,
                    payment_terms, payment_terms_days, account_number, tax_id,
                    is_1099_vendor, payment_method, notes, created_by, updated_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING *
                """,
                (
                    vendor_number,
                    (data.get("vendor_name") or "").strip(),
                    data.get("contact_name"),
                    data.get("email"),
                    data.get("phone"),
                    data.get("website"),
                    data.get("address_line1"),
                    data.get("address_line2"),
                    data.get("city"),
                    data.get("state"),
                    data.get("postal_code"),
                    data.get("country") or "US",
                    data.get("payment_terms"),
                    data.get("payment_terms_days", 30),
                    data.get("account_number"),
                    data.get("tax_id"),
                    bool(data.get("is_1099_vendor", False)),
                    data.get("payment_method"),
                    data.get("notes"),
                    user_id,
                    user_id,
                ),
            )
            row = cursor.fetchone()
            conn.commit()
            return _row_to_dict(row)
        finally:
            cursor.close()

    @staticmethod
    def update(vendor_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        allowed = {
            "vendor_name", "contact_name", "email", "phone", "website",
            "address_line1", "address_line2", "city", "state", "postal_code", "country",
            "payment_terms", "payment_terms_days", "account_number", "tax_id",
            "is_1099_vendor", "payment_method", "notes", "is_active",
        }
        updates = []
        params = []
        for k, v in data.items():
            if k not in allowed:
                continue
            if v is None and k != "is_active":
                continue
            if k == "is_1099_vendor":
                updates.append("is_1099_vendor = %s")
                params.append(bool(v))
            elif k == "is_active":
                updates.append("is_active = %s")
                params.append(bool(v))
            elif k == "vendor_name" and v is not None:
                updates.append("vendor_name = %s")
                params.append((v or "").strip())
            else:
                updates.append(f"{k} = %s")
                params.append(v)

        if not updates:
            existing = VendorRepository.find_by_id(vendor_id)
            if not existing:
                raise ValueError("Vendor not found")
            return existing

        updates.append("updated_by = %s")
        params.append(user_id)
        params.append(vendor_id)

        cursor = get_cursor()
        conn = cursor.connection
        try:
            cursor.execute(
                f"UPDATE {VendorRepository.TABLE} SET updated_at = CURRENT_TIMESTAMP, {', '.join(updates)} WHERE id = %s RETURNING *",
                params,
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError("Vendor not found")
            conn.commit()
            return _row_to_dict(row)
        finally:
            cursor.close()

    @staticmethod
    def delete(vendor_id: int) -> bool:
        if not VendorRepository.can_delete(vendor_id):
            raise ValueError("Cannot delete vendor with existing bills or transactions")
        cursor = get_cursor()
        conn = cursor.connection
        try:
            cursor.execute(f"DELETE FROM {VendorRepository.TABLE} WHERE id = %s", (vendor_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()

    @staticmethod
    def search(term: str, limit: int = 20) -> List[Dict[str, Any]]:
        t = f"%{term}%"
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT * FROM {VendorRepository.TABLE}
                WHERE vendor_number ILIKE %s OR vendor_name ILIKE %s OR contact_name ILIKE %s OR email ILIKE %s
                ORDER BY vendor_name
                LIMIT %s
                """,
                (t, t, t, t, limit),
            )
            rows = cursor.fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            cursor.close()

    @staticmethod
    def get_balance(vendor_id: int) -> Dict[str, Any]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT
                    COALESCE(SUM(CASE WHEN b.status != 'void' THEN b.total_amount ELSE 0 END), 0) AS total_billed,
                    COALESCE(SUM(CASE WHEN b.status != 'void' THEN b.amount_paid ELSE 0 END), 0) AS total_paid,
                    COALESCE(SUM(CASE WHEN b.status != 'void' THEN b.balance_due ELSE 0 END), 0) AS balance_due,
                    COALESCE(SUM(CASE WHEN b.status != 'void' AND b.due_date < CURRENT_DATE THEN b.balance_due ELSE 0 END), 0) AS overdue_amount
                FROM {VendorRepository.BILLS_TABLE} b
                WHERE b.vendor_id = %s
                """,
                (vendor_id,),
            )
            row = cursor.fetchone()
        finally:
            cursor.close()

        total_billed = float(_scalar(row, "total_billed") or 0)
        total_paid = float(_scalar(row, "total_paid") or 0)
        balance_due = float(_scalar(row, "balance_due") or 0)
        overdue_amount = float(_scalar(row, "overdue_amount") or 0)

        return {
            "vendor_id": vendor_id,
            "total_billed": total_billed,
            "total_paid": total_paid,
            "balance_due": balance_due,
            "overdue_amount": overdue_amount,
        }

    @staticmethod
    def get_bills(vendor_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT * FROM {VendorRepository.BILLS_TABLE}
                WHERE vendor_id = %s
                ORDER BY bill_date DESC, id DESC
                LIMIT %s
                """,
                (vendor_id, limit),
            )
            rows = cursor.fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            cursor.close()

    @staticmethod
    def get_1099_vendors() -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT * FROM {VendorRepository.TABLE}
                WHERE is_1099_vendor = true AND is_active = true
                ORDER BY vendor_name
                """
            )
            rows = cursor.fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            cursor.close()

    @staticmethod
    def can_delete(vendor_id: int) -> bool:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT COUNT(*) AS n FROM {VendorRepository.BILLS_TABLE} WHERE vendor_id = %s",
                (vendor_id,),
            )
            n = int(_scalar(cursor.fetchone(), "n") or 0)
            return n == 0
        finally:
            cursor.close()

    @staticmethod
    def toggle_status(vendor_id: int, user_id: int) -> Dict[str, Any]:
        v = VendorRepository.find_by_id(vendor_id)
        if not v:
            raise ValueError("Vendor not found")
        return VendorRepository.update(vendor_id, {"is_active": not v.get("is_active")}, user_id)
