#!/usr/bin/env python3
"""
Bill Payment Model/Repository Layer
Handles database operations for bill_payments and bill_payment_applications.
Creates cash/A/P journal entries via transactions/transaction_lines.
Bill balance updates are handled by DB trigger on bill_payment_applications.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database_postgres import get_cursor, get_connection

BILL_PAYMENTS = "bill_payments"
BILL_PAYMENT_APPLICATIONS = "bill_payment_applications"
VENDORS = "accounting_vendors"
BILLS = "bills"
ACCOUNTS = "accounts"
TRANSACTIONS = "transactions"
TRANSACTION_LINES = "transaction_lines"

VALID_METHODS = frozenset({"check", "ach", "wire", "credit_card", "cash", "other"})


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


def _ap_account_id() -> Optional[int]:
    cursor = get_cursor()
    try:
        cursor.execute("""
            SELECT id FROM accounts
            WHERE account_type = 'Liability' AND (
                sub_type ILIKE %s OR account_name ILIKE %s
            ) AND is_active = true
            LIMIT 1
        """, ("%payable%", "%payable%"))
        row = cursor.fetchone()
        return _scalar(row, "id")
    finally:
        cursor.close()


class BillPaymentRepository:
    @staticmethod
    def find_all(filters: Optional[Dict] = None) -> Dict[str, Any]:
        filters = filters or {}
        cursor = get_cursor()
        base = f"""
            SELECT bp.* FROM {BILL_PAYMENTS} bp
            JOIN {VENDORS} v ON v.id = bp.vendor_id
            WHERE 1=1
        """
        params: List[Any] = []

        if filters.get("vendor_id"):
            base += " AND bp.vendor_id = %s"
            params.append(filters["vendor_id"])
        if filters.get("payment_method"):
            base += " AND bp.payment_method = %s"
            params.append(filters["payment_method"])
        if filters.get("status"):
            base += " AND bp.status = %s"
            params.append(filters["status"])
        if filters.get("start_date"):
            base += " AND bp.payment_date >= %s"
            params.append(filters["start_date"])
        if filters.get("end_date"):
            base += " AND bp.payment_date <= %s"
            params.append(filters["end_date"])
        if filters.get("search"):
            t = f"%{filters['search']}%"
            base += " AND (bp.payment_number ILIKE %s OR bp.reference_number ILIKE %s OR v.vendor_name ILIKE %s)"
            params.extend([t, t, t])

        count_sql = f"SELECT COUNT(*) AS total FROM ({base}) _c"
        cursor.execute(count_sql, params)
        total = int(_scalar(cursor.fetchone(), "total") or 0)

        page = max(1, int(filters.get("page") or 1))
        limit = min(100, max(1, int(filters.get("limit") or 50)))
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit if limit else 0

        base += " ORDER BY bp.payment_date DESC, bp.id DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(base, params)
        rows = cursor.fetchall()
        payments_with_apps = []
        for r in rows:
            pmt = _row_to_dict(r)
            pid = pmt.get("id")
            cursor.execute(
                f"SELECT * FROM {BILL_PAYMENT_APPLICATIONS} WHERE bill_payment_id = %s ORDER BY id",
                (pid,),
            )
            apps = [_row_to_dict(x) for x in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {VENDORS} WHERE id = %s", (pmt.get("vendor_id"),))
            vend = _row_to_dict(cursor.fetchone())
            applied = []
            for a in apps:
                cursor.execute(
                    f"SELECT id, bill_number, total_amount, balance_due, amount_paid, status, vendor_reference FROM {BILLS} WHERE id = %s",
                    (a.get("bill_id"),),
                )
                bill_row = cursor.fetchone()
                applied.append({"application": a, "bill": _row_to_dict(bill_row)})
            payments_with_apps.append({
                "payment": pmt,
                "applications": apps,
                "vendor": vend,
                "applied_bills": applied,
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
            cursor.execute(
                f"SELECT bp.*, v.vendor_name, v.vendor_number FROM {BILL_PAYMENTS} bp "
                f"JOIN {VENDORS} v ON v.id = bp.vendor_id WHERE bp.id = %s",
                (payment_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            pmt = _row_to_dict(row)
            cursor.execute(
                f"SELECT * FROM {BILL_PAYMENT_APPLICATIONS} WHERE bill_payment_id = %s ORDER BY id",
                (payment_id,),
            )
            apps = [_row_to_dict(x) for x in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {VENDORS} WHERE id = %s", (pmt.get("vendor_id"),))
            vend = _row_to_dict(cursor.fetchone())
            applied = []
            for a in apps:
                cursor.execute(
                    f"SELECT bpa.*, b.bill_number, b.total_amount, b.balance_due, b.vendor_reference "
                    f"FROM {BILL_PAYMENT_APPLICATIONS} bpa "
                    f"JOIN {BILLS} b ON bpa.bill_id = b.id "
                    f"WHERE bpa.id = %s",
                    (a.get("id"),),
                )
                bill_row = cursor.fetchone()
                applied.append({"application": a, "bill": _row_to_dict(bill_row)})
            return {
                "payment": pmt,
                "applications": apps,
                "vendor": vend,
                "applied_bills": applied,
            }
        finally:
            cursor.close()

    @staticmethod
    def find_by_payment_number(number: str) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT id FROM {BILL_PAYMENTS} WHERE payment_number = %s", (number,))
            row = cursor.fetchone()
            pid = _scalar(row, "id")
            return BillPaymentRepository.find_by_id(pid) if pid else None
        finally:
            cursor.close()

    @staticmethod
    def get_vendor_outstanding_bills(vendor_id: int) -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT id, bill_number, bill_date, due_date, total_amount, amount_paid, balance_due, status, vendor_reference
                FROM {BILLS}
                WHERE vendor_id = %s AND balance_due > 0 AND status NOT IN ('void', 'draft')
                ORDER BY due_date ASC, bill_date ASC
                """,
                (vendor_id,),
            )
            return [_row_to_dict(r) for r in cursor.fetchall()]
        finally:
            cursor.close()

    @staticmethod
    def find_by_vendor(vendor_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT id FROM {BILL_PAYMENTS} WHERE vendor_id = %s ORDER BY payment_date DESC, id DESC LIMIT %s",
                (vendor_id, limit),
            )
            ids = [_scalar(r, "id") for r in cursor.fetchall() if _scalar(r, "id")]
            return [BillPaymentRepository.find_by_id(i) for i in ids]
        finally:
            cursor.close()

    @staticmethod
    def _generate_payment_number(cursor) -> str:
        """Generate next bill payment number in format BPAY-####"""
        try:
            cursor.execute(
                f"""
                SELECT payment_number FROM {BILL_PAYMENTS}
                WHERE payment_number ~ '^BPAY-[0-9]+$'
                ORDER BY CAST(SUBSTRING(payment_number FROM 6) AS INTEGER) DESC
                LIMIT 1
                """
            )
            row = cursor.fetchone()
            if row and row.get("payment_number"):
                last_num = row["payment_number"]
                num_part = int(last_num.split("-")[1])
                next_num = num_part + 1
                return f"BPAY-{next_num:04d}"
            return "BPAY-0001"
        except Exception:
            return "BPAY-0001"

    @staticmethod
    def _create_accounting_entry(
        payment_id: int,
        user_id: int,
        cursor,
        conn,
        payment: Dict,
    ) -> Optional[int]:
        ap_id = _ap_account_id()
        if not ap_id:
            return None
        paid_from_id = payment.get("paid_from_account_id")
        if not paid_from_id:
            return None
        amount = float(payment.get("payment_amount") or 0)
        if amount <= 0:
            return None
        pmt_date = payment.get("payment_date")
        if isinstance(pmt_date, str):
            pmt_date = pmt_date[:10]
        pmt_num = payment.get("payment_number") or ""
        method = payment.get("payment_method") or "other"
        vendor_id = payment.get("vendor_id")

        cursor.execute(
            f"""
            INSERT INTO {TRANSACTIONS} (
                transaction_number, transaction_date, transaction_type, description,
                source_document_id, source_document_type, is_posted, created_by, updated_by
            ) VALUES (NULL, %s, 'bill_payment', %s, %s, 'bill_payment', true, %s, %s)
            RETURNING id
            """,
            (pmt_date, f"Bill Payment {pmt_num}", payment_id, user_id, user_id),
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
            ) VALUES (%s, %s, 1, %s, 0, %s, 'vendor', %s)
            """,
            (tx_id, ap_id, amount, f"Bill Payment {pmt_num}", vendor_id),
        )
        cursor.execute(
            f"""
            INSERT INTO {TRANSACTION_LINES} (
                transaction_id, account_id, line_number, debit_amount, credit_amount,
                description, entity_type, entity_id
            ) VALUES (%s, %s, 2, 0, %s, %s, 'vendor', %s)
            """,
            (tx_id, paid_from_id, amount, f"Payment made - {method}", vendor_id),
        )
        return tx_id

    @staticmethod
    def _reverse_accounting_entry(transaction_id: int, user_id: int, cursor) -> None:
        cursor.execute(
            f"""
            UPDATE {TRANSACTIONS} SET
                is_void = true, void_date = CURRENT_DATE, void_reason = 'Bill payment voided',
                updated_by = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (user_id, transaction_id),
        )

    @staticmethod
    def create(data: Dict, user_id: int) -> Dict[str, Any]:
        from backend.models.vendor_model import VendorRepository
        from backend.models.bill_model import BillRepository

        vendor = VendorRepository.find_by_id(data.get("vendor_id"))
        if not vendor:
            raise ValueError("Vendor not found")

        applications = data.get("applications") or []
        if not applications:
            raise ValueError("Payment must be applied to at least one bill")

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
            bill_out = BillRepository.find_by_id(app.get("bill_id"))
            if not bill_out:
                raise ValueError(f"Bill {app.get('bill_id')} not found")
            bill = bill_out.get("bill") or {}
            if bill.get("vendor_id") != data.get("vendor_id"):
                raise ValueError(
                    f"Bill {bill.get('bill_number', app.get('bill_id'))} does not belong to this vendor"
                )
            if bill.get("status") == "void":
                raise ValueError(f"Cannot apply payment to voided bill {bill.get('bill_number', '')}")
            balance_due = float(bill.get("balance_due") or 0)
            if amt > balance_due:
                raise ValueError(
                    f"Amount applied to bill {bill.get('bill_number', '')} exceeds balance due"
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
            payment_number = BillPaymentRepository._generate_payment_number(cursor)
            cursor.execute(
                f"""
                INSERT INTO {BILL_PAYMENTS} (
                    payment_number, vendor_id, payment_date, payment_method, reference_number,
                    payment_amount, unapplied_amount, paid_from_account_id, memo, status,
                    created_by, updated_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s)
                RETURNING *
                """,
                (
                    payment_number,
                    data["vendor_id"],
                    payment_date,
                    method,
                    data.get("reference_number") or None,
                    payment_amount,
                    unapplied,
                    data["paid_from_account_id"],
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
                    INSERT INTO {BILL_PAYMENT_APPLICATIONS} (bill_payment_id, bill_id, amount_applied)
                    VALUES (%s, %s, %s)
                    """,
                    (pid, app["bill_id"], float(app["amount_applied"])),
                )

                cursor.execute(
                    f"""
                    UPDATE {BILLS} 
                    SET amount_paid = amount_paid + %s,
                        balance_due = balance_due - %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (float(app["amount_applied"]), float(app["amount_applied"]), app["bill_id"]),
                )

                cursor.execute(f"SELECT * FROM {BILLS} WHERE id = %s", (app["bill_id"],))
                bill_row = cursor.fetchone()
                bill_data = _row_to_dict(bill_row)
                balance_due = float(bill_data.get("balance_due") or 0)
                amount_paid = float(bill_data.get("amount_paid") or 0)
                total_amount = float(bill_data.get("total_amount") or 0)

                if balance_due <= 0:
                    cursor.execute(
                        f"UPDATE {BILLS} SET status = 'paid', paid_date = CURRENT_DATE WHERE id = %s",
                        (app["bill_id"],),
                    )
                elif amount_paid > 0 and amount_paid < total_amount:
                    cursor.execute(
                        f"UPDATE {BILLS} SET status = 'partial' WHERE id = %s",
                        (app["bill_id"],),
                    )

            tx_id = BillPaymentRepository._create_accounting_entry(pid, user_id, cursor, conn, payment)
            if tx_id:
                cursor.execute(
                    f"UPDATE {BILL_PAYMENTS} SET transaction_id = %s WHERE id = %s",
                    (tx_id, pid),
                )
                payment["transaction_id"] = tx_id

            conn.commit()
            result = BillPaymentRepository.find_by_id(pid)
            if result:
                result["vendor"] = vendor
            return result
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def update(payment_id: int, data: Dict, user_id: int) -> Dict[str, Any]:
        existing = BillPaymentRepository.find_by_id(payment_id)
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
                return BillPaymentRepository.find_by_id(payment_id)
            updates.append("updated_by = %s")
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.extend([user_id, payment_id])
            cursor.execute(
                f"UPDATE {BILL_PAYMENTS} SET {', '.join(updates)} WHERE id = %s RETURNING *",
                params,
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                raise ValueError("Payment not found")
            return BillPaymentRepository.find_by_id(payment_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def delete(payment_id: int) -> bool:
        out = BillPaymentRepository.find_by_id(payment_id)
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
                cursor.execute(f"UPDATE {BILL_PAYMENTS} SET transaction_id = NULL WHERE id = %s", (payment_id,))
                BillPaymentRepository._reverse_accounting_entry(tx_id, 1, cursor)
            cursor.execute(f"DELETE FROM {BILL_PAYMENTS} WHERE id = %s", (payment_id,))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def void_payment(payment_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        out = BillPaymentRepository.find_by_id(payment_id)
        if not out:
            raise ValueError("Payment not found")
        pmt = out["payment"]
        if pmt.get("status") == "void":
            raise ValueError("Payment is already voided")

        cursor = get_cursor()
        conn = get_connection()
        try:
            for app in out.get("applications") or []:
                amt = float(app.get("amount_applied") or 0)
                bill_id = app.get("bill_id")
                cursor.execute(
                    f"""
                    UPDATE {BILLS} 
                    SET amount_paid = amount_paid - %s,
                        balance_due = balance_due + %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (amt, amt, bill_id),
                )

                cursor.execute(f"SELECT * FROM {BILLS} WHERE id = %s", (bill_id,))
                bill_row = cursor.fetchone()
                bill_data = _row_to_dict(bill_row)
                if bill_data.get("status") == "paid":
                    cursor.execute(
                        f"UPDATE {BILLS} SET status = 'partial', paid_date = NULL WHERE id = %s",
                        (bill_id,),
                    )

            tx_id = pmt.get("transaction_id")
            if tx_id:
                BillPaymentRepository._reverse_accounting_entry(tx_id, user_id, cursor)
            cursor.execute(
                f"""
                UPDATE {BILL_PAYMENTS} SET
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
