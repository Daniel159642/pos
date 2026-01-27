#!/usr/bin/env python3
"""
Payment Model/Repository Layer
Handles database operations for payments and payment_applications.
Creates cash/A/R journal entries via transactions/transaction_lines.
Invoice balance updates are handled by DB trigger on payment_applications.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database_postgres import get_cursor, get_connection

PAYMENTS = "payments"
PAYMENT_APPLICATIONS = "payment_applications"
CUSTOMERS = "accounting_customers"
INVOICES = "invoices"
ACCOUNTS = "accounts"
TRANSACTIONS = "transactions"
TRANSACTION_LINES = "transaction_lines"

VALID_METHODS = frozenset({"cash", "check", "credit_card", "debit_card", "bank_transfer", "ach", "other"})


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


def _ar_account_id() -> Optional[int]:
    cursor = get_cursor()
    try:
        cursor.execute("""
            SELECT id FROM accounts
            WHERE account_type = 'Asset' AND (
                sub_type ILIKE %s OR account_name ILIKE %s
            ) AND is_active = true
            LIMIT 1
        """, ("%receivable%", "%receivable%"))
        row = cursor.fetchone()
        return _scalar(row, "id")
    finally:
        cursor.close()


class PaymentRepository:
    @staticmethod
    def find_all(filters: Optional[Dict] = None) -> Dict[str, Any]:
        filters = filters or {}
        cursor = get_cursor()
        base = f"""
            SELECT p.* FROM {PAYMENTS} p
            JOIN {CUSTOMERS} c ON c.id = p.customer_id
            WHERE 1=1
        """
        params: List[Any] = []

        if filters.get("customer_id"):
            base += " AND p.customer_id = %s"
            params.append(filters["customer_id"])
        if filters.get("payment_method"):
            base += " AND p.payment_method = %s"
            params.append(filters["payment_method"])
        if filters.get("status"):
            base += " AND p.status = %s"
            params.append(filters["status"])
        if filters.get("start_date"):
            base += " AND p.payment_date >= %s"
            params.append(filters["start_date"])
        if filters.get("end_date"):
            base += " AND p.payment_date <= %s"
            params.append(filters["end_date"])
        if filters.get("search"):
            t = f"%{filters['search']}%"
            base += " AND (p.payment_number ILIKE %s OR p.reference_number ILIKE %s OR c.display_name ILIKE %s OR c.company_name ILIKE %s)"
            params.extend([t, t, t, t])

        count_sql = f"SELECT COUNT(*) AS total FROM ({base}) _c"
        cursor.execute(count_sql, params)
        total = int(_scalar(cursor.fetchone(), "total") or 0)

        page = max(1, int(filters.get("page") or 1))
        limit = min(100, max(1, int(filters.get("limit") or 50)))
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit if limit else 0

        base += " ORDER BY p.payment_date DESC, p.id DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(base, params)
        rows = cursor.fetchall()
        payments_with_apps = []
        for r in rows:
            pmt = _row_to_dict(r)
            pid = pmt.get("id")
            cursor.execute(
                f"SELECT * FROM {PAYMENT_APPLICATIONS} WHERE payment_id = %s ORDER BY id",
                (pid,),
            )
            apps = [_row_to_dict(x) for x in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {CUSTOMERS} WHERE id = %s", (pmt.get("customer_id"),))
            cust = _row_to_dict(cursor.fetchone())
            applied = []
            for a in apps:
                cursor.execute(f"SELECT id, invoice_number, total_amount, balance_due, amount_paid, status FROM {INVOICES} WHERE id = %s", (a.get("invoice_id"),))
                inv_row = cursor.fetchone()
                applied.append({"application": a, "invoice": _row_to_dict(inv_row)})
            payments_with_apps.append({
                "payment": pmt,
                "applications": apps,
                "customer": cust,
                "applied_invoices": applied,
            })
        cursor.close()
        return {
            "payments": payments_with_apps,
            "total": total,
            "page": page,
            "total_pages": total_pages,
        }

    @staticmethod
    def find_by_id(payment_id: int) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {PAYMENTS} WHERE id = %s", (payment_id,))
            row = cursor.fetchone()
            if not row:
                return None
            pmt = _row_to_dict(row)
            cursor.execute(
                f"SELECT * FROM {PAYMENT_APPLICATIONS} WHERE payment_id = %s ORDER BY id",
                (payment_id,),
            )
            apps = [_row_to_dict(x) for x in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {CUSTOMERS} WHERE id = %s", (pmt.get("customer_id"),))
            cust = _row_to_dict(cursor.fetchone())
            applied = []
            for a in apps:
                cursor.execute(
                    f"SELECT id, invoice_number, total_amount, balance_due, amount_paid, status FROM {INVOICES} WHERE id = %s",
                    (a.get("invoice_id"),),
                )
                inv_row = cursor.fetchone()
                applied.append({"application": a, "invoice": _row_to_dict(inv_row)})
            return {
                "payment": pmt,
                "applications": apps,
                "customer": cust,
                "applied_invoices": applied,
            }
        finally:
            cursor.close()

    @staticmethod
    def find_by_payment_number(number: str) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT id FROM {PAYMENTS} WHERE payment_number = %s", (number,))
            row = cursor.fetchone()
            pid = _scalar(row, "id")
            return PaymentRepository.find_by_id(pid) if pid else None
        finally:
            cursor.close()

    @staticmethod
    def get_customer_outstanding_invoices(customer_id: int) -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT id, invoice_number, invoice_date, due_date, total_amount, amount_paid, balance_due, status
                FROM {INVOICES}
                WHERE customer_id = %s AND balance_due > 0 AND status NOT IN ('void', 'draft')
                ORDER BY due_date ASC, invoice_date ASC
                """,
                (customer_id,),
            )
            return [_row_to_dict(r) for r in cursor.fetchall()]
        finally:
            cursor.close()

    @staticmethod
    def find_by_customer(customer_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT id FROM {PAYMENTS} WHERE customer_id = %s ORDER BY payment_date DESC, id DESC LIMIT %s",
                (customer_id, limit),
            )
            ids = [_scalar(r, "id") for r in cursor.fetchall() if _scalar(r, "id")]
            return [PaymentRepository.find_by_id(i) for i in ids]
        finally:
            cursor.close()

    @staticmethod
    def _create_accounting_entry(
        payment_id: int,
        user_id: int,
        cursor,
        conn,
        payment: Dict,
    ) -> Optional[int]:
        ar_id = _ar_account_id()
        if not ar_id:
            return None
        deposit_id = payment.get("deposit_to_account_id")
        if not deposit_id:
            return None
        amount = float(payment.get("payment_amount") or 0)
        if amount <= 0:
            return None
        pmt_date = payment.get("payment_date")
        if isinstance(pmt_date, str):
            pmt_date = pmt_date[:10]
        pmt_num = payment.get("payment_number") or ""
        method = payment.get("payment_method") or "other"
        cust_id = payment.get("customer_id")

        cursor.execute(
            f"""
            INSERT INTO {TRANSACTIONS} (
                transaction_number, transaction_date, transaction_type, description,
                source_document_id, source_document_type, is_posted, created_by, updated_by
            ) VALUES (NULL, %s, 'payment', %s, %s, 'payment', true, %s, %s)
            RETURNING id
            """,
            (pmt_date, f"Payment {pmt_num}", payment_id, user_id, user_id),
        )
        row = cursor.fetchone()
        tx_id = _scalar(row, "id")
        if not tx_id:
            return None

        cursor.execute(
            f"""
            INSERT INTO {TRANSACTION_LINES} (
                transaction_id, account_id, line_number, debit_amount, credit_amount,
                description, entity_type, entity_id
            ) VALUES (%s, %s, 1, %s, 0, %s, 'customer', %s)
            """,
            (tx_id, deposit_id, amount, f"Payment received - {method}", cust_id),
        )
        cursor.execute(
            f"""
            INSERT INTO {TRANSACTION_LINES} (
                transaction_id, account_id, line_number, debit_amount, credit_amount,
                description, entity_type, entity_id
            ) VALUES (%s, %s, 2, 0, %s, %s, 'customer', %s)
            """,
            (tx_id, ar_id, amount, f"Payment {pmt_num}", cust_id),
        )
        return tx_id

    @staticmethod
    def _reverse_accounting_entry(transaction_id: int, user_id: int, cursor) -> None:
        cursor.execute(
            f"""
            UPDATE {TRANSACTIONS} SET
                is_void = true, void_date = CURRENT_DATE, void_reason = 'Payment voided',
                updated_by = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (user_id, transaction_id),
        )

    @staticmethod
    def create(data: Dict, user_id: int) -> Dict[str, Any]:
        from backend.models.customer_model import CustomerRepository
        from backend.models.invoice_model import InvoiceRepository

        customer = CustomerRepository.find_by_id(data.get("customer_id"))
        if not customer:
            raise ValueError("Customer not found")

        applications = data.get("applications") or []
        if not applications:
            raise ValueError("Payment must be applied to at least one invoice")

        total_applied = sum(float(a.get("amount_applied") or 0) for a in applications)
        payment_amount = float(data.get("payment_amount") or 0)
        if payment_amount <= 0:
            raise ValueError("Payment amount must be greater than 0")
        if total_applied > payment_amount:
            raise ValueError("Total amount applied cannot exceed payment amount")

        for app in applications:
            amt = float(app.get("amount_applied") or 0)
            if amt <= 0:
                raise ValueError("Each application amount must be greater than 0")
            inv_out = InvoiceRepository.find_by_id(app.get("invoice_id"))
            if not inv_out:
                raise ValueError(f"Invoice {app.get('invoice_id')} not found")
            inv = inv_out.get("invoice") or {}
            if inv.get("customer_id") != data.get("customer_id"):
                raise ValueError(
                    f"Invoice {inv.get('invoice_number', app.get('invoice_id'))} does not belong to this customer"
                )
            if inv.get("status") == "void":
                raise ValueError(f"Cannot apply payment to voided invoice {inv.get('invoice_number', '')}")
            balance_due = float(inv.get("balance_due") or 0)
            if amt > balance_due:
                raise ValueError(
                    f"Amount applied to invoice {inv.get('invoice_number', '')} exceeds balance due"
                )

        payment_date = data.get("payment_date")
        if isinstance(payment_date, str):
            payment_date = payment_date.split("T")[0]
        elif hasattr(payment_date, "isoformat"):
            payment_date = payment_date.isoformat()[:10]
        else:
            payment_date = str(payment_date)[:10]

        unapplied = payment_amount - total_applied
        method = (data.get("payment_method") or "other").strip().lower()
        if method not in VALID_METHODS:
            method = "other"

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(
                f"""
                INSERT INTO {PAYMENTS} (
                    payment_number, customer_id, payment_date, payment_method, reference_number,
                    payment_amount, unapplied_amount, deposit_to_account_id, memo, status,
                    created_by, updated_by
                ) VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s)
                RETURNING *
                """,
                (
                    data["customer_id"],
                    payment_date,
                    method,
                    data.get("reference_number") or None,
                    payment_amount,
                    unapplied,
                    data["deposit_to_account_id"],
                    data.get("memo") or None,
                    user_id,
                    user_id,
                ),
            )
            row = cursor.fetchone()
            payment = _row_to_dict(row)
            pid = payment["id"]

            for app in applications:
                cursor.execute(
                    f"""
                    INSERT INTO {PAYMENT_APPLICATIONS} (payment_id, invoice_id, amount_applied)
                    VALUES (%s, %s, %s)
                    """,
                    (pid, app["invoice_id"], float(app["amount_applied"])),
                )
            tx_id = PaymentRepository._create_accounting_entry(pid, user_id, cursor, conn, payment)
            if tx_id:
                cursor.execute(
                    f"UPDATE {PAYMENTS} SET transaction_id = %s WHERE id = %s",
                    (tx_id, pid),
                )
                payment["transaction_id"] = tx_id

            conn.commit()
            result = PaymentRepository.find_by_id(pid)
            if result:
                result["customer"] = customer
            return result
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def update(payment_id: int, data: Dict, user_id: int) -> Dict[str, Any]:
        existing = PaymentRepository.find_by_id(payment_id)
        if not existing:
            raise ValueError("Payment not found")
        pmt = existing["payment"]
        if pmt.get("status") == "void":
            raise ValueError("Cannot modify voided payment")
        if data.get("applications") is not None:
            raise ValueError("Cannot modify payment applications. Void and create a new payment instead.")

        allowed = {"payment_date", "payment_method", "reference_number", "memo"}
        cursor = get_cursor()
        conn = get_connection()
        try:
            updates = []
            params = []
            for k, v in data.items():
                if k not in allowed or v is None:
                    continue
                if k == "payment_date":
                    if isinstance(v, str):
                        v = v.split("T")[0]
                    elif hasattr(v, "isoformat"):
                        v = v.isoformat()[:10]
                if k == "payment_method":
                    v = (v or "other").strip().lower()
                    if v not in VALID_METHODS:
                        v = "other"
                updates.append(f"{k} = %s")
                params.append(v)
            if not updates:
                return PaymentRepository.find_by_id(payment_id)
            updates.append("updated_by = %s")
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.extend([user_id, payment_id])
            cursor.execute(
                f"UPDATE {PAYMENTS} SET {', '.join(updates)} WHERE id = %s RETURNING *",
                params,
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                raise ValueError("Payment not found")
            return PaymentRepository.find_by_id(payment_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def delete(payment_id: int) -> bool:
        out = PaymentRepository.find_by_id(payment_id)
        if not out:
            raise ValueError("Payment not found")
        pmt = out["payment"]
        if pmt.get("status") == "void":
            raise ValueError("Cannot delete voided payment")
        if out.get("applications"):
            raise ValueError("Cannot delete payment with applications. Void it instead.")

        cursor = get_cursor()
        conn = get_connection()
        try:
            tx_id = pmt.get("transaction_id")
            if tx_id:
                cursor.execute(f"UPDATE {PAYMENTS} SET transaction_id = NULL WHERE id = %s", (payment_id,))
                PaymentRepository._reverse_accounting_entry(tx_id, 1, cursor)
            cursor.execute(f"DELETE FROM {PAYMENTS} WHERE id = %s", (payment_id,))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def void_payment(payment_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        out = PaymentRepository.find_by_id(payment_id)
        if not out:
            raise ValueError("Payment not found")
        pmt = out["payment"]
        if pmt.get("status") == "void":
            raise ValueError("Payment is already voided")

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(f"DELETE FROM {PAYMENT_APPLICATIONS} WHERE payment_id = %s", (payment_id,))
            tx_id = pmt.get("transaction_id")
            if tx_id:
                PaymentRepository._reverse_accounting_entry(tx_id, user_id, cursor)
            cursor.execute(
                f"""
                UPDATE {PAYMENTS} SET
                    status = 'void', void_date = CURRENT_DATE, void_reason = %s,
                    updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
                """,
                (reason.strip(), user_id, payment_id),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                raise ValueError("Payment not found")
            return _row_to_dict(row)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
