#!/usr/bin/env python3
"""
Customer Model/Repository Layer
Handles all database operations for accounting_customers table
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database_postgres import get_cursor


def _row_to_dict(row) -> Dict[str, Any]:
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


class CustomerRepository:
    """Repository for accounting_customers database operations"""

    TABLE = "accounting_customers"
    INVOICES_TABLE = "invoices"

    @staticmethod
    def find_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get customers with optional filters, pagination, sorting"""
        cursor = get_cursor()
        base = f"SELECT * FROM {CustomerRepository.TABLE} WHERE 1=1"
        params: List[Any] = []
        n = 1

        if filters:
            if filters.get("customer_type"):
                base += f" AND customer_type = %s"
                params.append(filters["customer_type"])
                n += 1
            if filters.get("is_active") is not None:
                base += f" AND is_active = %s"
                params.append(filters["is_active"])
                n += 1
            if filters.get("search"):
                base += f" AND (customer_number ILIKE %s OR company_name ILIKE %s OR first_name ILIKE %s OR last_name ILIKE %s OR display_name ILIKE %s OR email ILIKE %s)"
                t = f"%{filters['search']}%"
                params.extend([t] * 6)
                n += 6

        # Count total
        count_sql = f"SELECT COUNT(*) AS total FROM ({base}) _c"
        cursor.execute(count_sql, params)
        total = int(_scalar(cursor.fetchone(), "total") or 0)

        page = max(1, int(filters.get("page") or 1))
        limit = min(100, max(1, int(filters.get("limit") or 50)))
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit if limit else 0

        base += " ORDER BY customer_number, display_name LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(base, params)
        rows = cursor.fetchall()
        customers = [_row_to_dict(r) for r in rows]
        cursor.close()

        return {
            "customers": customers,
            "total": total,
            "page": page,
            "total_pages": total_pages,
        }

    @staticmethod
    def find_by_id(customer_id: int) -> Optional[Dict[str, Any]]:
        """Find customer by id"""
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {CustomerRepository.TABLE} WHERE id = %s", (customer_id,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None
        finally:
            cursor.close()

    @staticmethod
    def find_by_customer_number(customer_number: str) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {CustomerRepository.TABLE} WHERE customer_number = %s", (customer_number,))
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
                    f"SELECT * FROM {CustomerRepository.TABLE} WHERE LOWER(email) = LOWER(%s) AND id != %s",
                    (email, exclude_id),
                )
            else:
                cursor.execute(f"SELECT * FROM {CustomerRepository.TABLE} WHERE LOWER(email) = LOWER(%s)", (email,))
            row = cursor.fetchone()
            return _row_to_dict(row) if row else None
        finally:
            cursor.close()

    @staticmethod
    def email_exists(email: str, exclude_id: Optional[int] = None) -> bool:
        return CustomerRepository.find_by_email(email, exclude_id) is not None

    @staticmethod
    def generate_customer_number() -> str:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT customer_number FROM {CustomerRepository.TABLE}
                WHERE customer_number ~ '^CUST-[0-9]+$'
                ORDER BY CAST(SUBSTRING(customer_number FROM 6) AS INTEGER) DESC
                LIMIT 1
                """
            )
            row = cursor.fetchone()
            if not row:
                return "CUST-0001"
            cn = _scalar(row, "customer_number")
            num = int(re.sub(r"^CUST-", "", str(cn)))
            return f"CUST-{num + 1:04d}"
        finally:
            cursor.close()

    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        customer_number = data.get("customer_number") or CustomerRepository.generate_customer_number()
        if data.get("customer_number"):
            existing = CustomerRepository.find_by_customer_number(data["customer_number"])
            if existing:
                raise ValueError("Customer number already exists")

        display_name = data.get("display_name")
        if not display_name:
            if data.get("customer_type") == "business":
                display_name = data.get("company_name") or customer_number
            else:
                display_name = (
                    f"{data.get('first_name') or ''} {data.get('last_name') or ''}".strip() or customer_number
                )

        cursor = get_cursor()
        conn = cursor.connection
        try:
            cursor.execute(
                f"""
                INSERT INTO {CustomerRepository.TABLE} (
                    customer_number, customer_type, company_name, first_name, last_name, display_name,
                    email, phone, mobile, website,
                    billing_address_line1, billing_address_line2, billing_city, billing_state,
                    billing_postal_code, billing_country,
                    shipping_address_line1, shipping_address_line2, shipping_city, shipping_state,
                    shipping_postal_code, shipping_country,
                    payment_terms, payment_terms_days, credit_limit, tax_exempt, tax_exempt_id,
                    tax_rate_id, notes, created_by, updated_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING *
                """,
                (
                    customer_number,
                    data.get("customer_type", "individual"),
                    data.get("company_name"),
                    data.get("first_name"),
                    data.get("last_name"),
                    display_name,
                    data.get("email"),
                    data.get("phone"),
                    data.get("mobile"),
                    data.get("website"),
                    data.get("billing_address_line1"),
                    data.get("billing_address_line2"),
                    data.get("billing_city"),
                    data.get("billing_state"),
                    data.get("billing_postal_code"),
                    data.get("billing_country"),
                    data.get("shipping_address_line1"),
                    data.get("shipping_address_line2"),
                    data.get("shipping_city"),
                    data.get("shipping_state"),
                    data.get("shipping_postal_code"),
                    data.get("shipping_country"),
                    data.get("payment_terms"),
                    data.get("payment_terms_days", 30),
                    data.get("credit_limit"),
                    bool(data.get("tax_exempt", False)),
                    data.get("tax_exempt_id"),
                    data.get("tax_rate_id"),
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
    def update(customer_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        allowed = {
            "customer_type", "company_name", "first_name", "last_name", "display_name",
            "email", "phone", "mobile", "website",
            "billing_address_line1", "billing_address_line2", "billing_city", "billing_state",
            "billing_postal_code", "billing_country",
            "shipping_address_line1", "shipping_address_line2", "shipping_city", "shipping_state",
            "shipping_postal_code", "shipping_country",
            "payment_terms", "payment_terms_days", "credit_limit", "tax_exempt", "tax_exempt_id",
            "tax_rate_id", "notes", "is_active",
        }
        updates = []
        params = []
        for k, v in data.items():
            if k not in allowed:
                continue
            if v is None and k != "is_active":
                continue
            if k == "tax_exempt":
                updates.append("tax_exempt = %s")
                params.append(bool(v))
            elif k == "is_active":
                updates.append("is_active = %s")
                params.append(bool(v))
            else:
                updates.append(f"{k} = %s")
                params.append(v)

        if not updates:
            existing = CustomerRepository.find_by_id(customer_id)
            if not existing:
                raise ValueError("Customer not found")
            return existing

        updates.append("updated_by = %s")
        params.append(user_id)
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(customer_id)

        cursor = get_cursor()
        conn = cursor.connection
        try:
            cursor.execute(
                f"UPDATE {CustomerRepository.TABLE} SET {', '.join(updates)} WHERE id = %s RETURNING *",
                params,
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError("Customer not found")
            conn.commit()
            return _row_to_dict(row)
        finally:
            cursor.close()

    @staticmethod
    def delete(customer_id: int) -> bool:
        if not CustomerRepository.can_delete(customer_id):
            raise ValueError("Cannot delete customer with existing invoices or transactions")
        cursor = get_cursor()
        conn = cursor.connection
        try:
            cursor.execute(f"DELETE FROM {CustomerRepository.TABLE} WHERE id = %s", (customer_id,))
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
                SELECT * FROM {CustomerRepository.TABLE}
                WHERE customer_number ILIKE %s OR company_name ILIKE %s OR first_name ILIKE %s
                   OR last_name ILIKE %s OR display_name ILIKE %s OR email ILIKE %s
                ORDER BY display_name
                LIMIT %s
                """,
                (t, t, t, t, t, t, limit),
            )
            rows = cursor.fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            cursor.close()

    @staticmethod
    def get_balance(customer_id: int) -> Dict[str, Any]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT
                    COALESCE(SUM(CASE WHEN status != 'void' THEN total_amount ELSE 0 END), 0) AS total_invoiced,
                    COALESCE(SUM(CASE WHEN status != 'void' THEN amount_paid ELSE 0 END), 0) AS total_paid,
                    COALESCE(SUM(CASE WHEN status != 'void' THEN balance_due ELSE 0 END), 0) AS balance_due
                FROM {CustomerRepository.INVOICES_TABLE}
                WHERE customer_id = %s
                """,
                (customer_id,),
            )
            row = cursor.fetchone()
        finally:
            cursor.close()

        total_invoiced = float(_scalar(row, "total_invoiced") or 0)
        total_paid = float(_scalar(row, "total_paid") or 0)
        balance_due = float(_scalar(row, "balance_due") or 0)
        cust = CustomerRepository.find_by_id(customer_id)
        credit_limit = float(cust.get("credit_limit") or 0) if cust else 0
        credit_available = max(0, credit_limit - balance_due)

        return {
            "customer_id": customer_id,
            "total_invoiced": total_invoiced,
            "total_paid": total_paid,
            "balance_due": balance_due,
            "credit_available": credit_available,
        }

    @staticmethod
    def get_invoices(customer_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT * FROM {CustomerRepository.INVOICES_TABLE}
                WHERE customer_id = %s
                ORDER BY invoice_date DESC, id DESC
                LIMIT %s
                """,
                (customer_id, limit),
            )
            rows = cursor.fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            cursor.close()

    @staticmethod
    def can_delete(customer_id: int) -> bool:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT COUNT(*) AS n FROM {CustomerRepository.INVOICES_TABLE} WHERE customer_id = %s",
                (customer_id,),
            )
            n = int(_scalar(cursor.fetchone(), "n") or 0)
            return n == 0
        finally:
            cursor.close()

    @staticmethod
    def toggle_status(customer_id: int, user_id: int) -> Dict[str, Any]:
        c = CustomerRepository.find_by_id(customer_id)
        if not c:
            raise ValueError("Customer not found")
        return CustomerRepository.update(customer_id, {"is_active": not c.get("is_active")}, user_id)
