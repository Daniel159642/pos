#!/usr/bin/env python3
"""
Bill Model/Repository Layer
Handles database operations for bills and bill_lines.
Creates A/P journal entries via transactions/transaction_lines.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime, timedelta
from decimal import Decimal
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database_postgres import get_cursor, get_connection


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


class BillRepository:
    BILLS = "bills"
    BILL_LINES = "bill_lines"
    TRANSACTIONS = "accounting.transactions"
    TRANSACTION_LINES = "accounting.transaction_lines"
    VENDORS = "accounting_vendors"
    ACCOUNTS = "accounting.accounts"
    TAX_RATES = "tax_rates"

    @staticmethod
    def _get_tax_rate(tax_rate_id: Optional[int]) -> float:
        if not tax_rate_id:
            return 0.0
        cursor = get_cursor()
        try:
            cursor.execute(
                "SELECT tax_rate FROM tax_rates WHERE id = %s AND is_active = true",
                (tax_rate_id,),
            )
            row = cursor.fetchone()
            r = _scalar(row, "tax_rate")
            return float(r) if r is not None else 0.0
        finally:
            cursor.close()

    @staticmethod
    def _calculate_line_totals(lines: List[Dict]) -> List[Dict]:
        result = []
        for ln in lines:
            qty = float(ln.get("quantity") or 0)
            uc = float(ln.get("unit_cost") or 0)
            line_total = qty * uc
            rate = BillRepository._get_tax_rate(ln.get("tax_rate_id"))
            tax_amt = line_total * rate if rate else 0.0
            result.append({
                **ln,
                "line_total": line_total,
                "tax_amount": tax_amt,
            })
        return result

    @staticmethod
    def _calculate_due_date(bill_date, terms_days: int) -> str:
        if isinstance(bill_date, str):
            bill_date = datetime.fromisoformat(bill_date.split("T")[0]).date()
        elif hasattr(bill_date, "isoformat"):
            bill_date = bill_date if hasattr(bill_date, "day") else datetime.fromisoformat(str(bill_date)[:10]).date()
        d = bill_date + timedelta(days=int(terms_days or 0))
        return d.isoformat()[:10]

    @staticmethod
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

    @staticmethod
    def _tax_payable_account_id() -> Optional[int]:
        cursor = get_cursor()
        try:
            cursor.execute("""
                SELECT id FROM accounts
                WHERE account_type = 'Liability' AND account_name ILIKE %s
                AND is_active = true
                LIMIT 1
            """, ("%tax%payable%",))
            row = cursor.fetchone()
            return _scalar(row, "id")
        finally:
            cursor.close()

    @staticmethod
    def find_all(filters: Optional[Dict] = None) -> Dict[str, Any]:
        filters = filters or {}
        cursor = get_cursor()
        base = f"""
            SELECT b.* FROM {BillRepository.BILLS} b
            JOIN {BillRepository.VENDORS} v ON v.id = b.vendor_id
            WHERE 1=1
        """
        params: List[Any] = []

        if filters.get("vendor_id"):
            base += " AND b.vendor_id = %s"
            params.append(filters["vendor_id"])
        if filters.get("status"):
            base += " AND b.status = %s"
            params.append(filters["status"])
        if filters.get("start_date"):
            base += " AND b.bill_date >= %s"
            params.append(filters["start_date"])
        if filters.get("end_date"):
            base += " AND b.bill_date <= %s"
            params.append(filters["end_date"])
        if filters.get("overdue_only"):
            base += " AND b.due_date < CURRENT_DATE AND b.balance_due > 0 AND b.status NOT IN ('void','paid')"
        if filters.get("search"):
            base += " AND (b.bill_number ILIKE %s OR b.vendor_reference ILIKE %s OR v.vendor_name ILIKE %s)"
            t = f"%{filters['search']}%"
            params.extend([t, t, t])

        count_sql = f"SELECT COUNT(*) AS total FROM ({base}) _c"
        cursor.execute(count_sql, params)
        total = int(_scalar(cursor.fetchone(), "total") or 0)

        page = max(1, int(filters.get("page") or 1))
        limit = min(100, max(1, int(filters.get("limit") or 50)))
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit if limit else 0

        base += " ORDER BY b.bill_date DESC, b.id DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(base, params)
        rows = cursor.fetchall()
        bills_with_lines = []
        for r in rows:
            b = _row_to_dict(r)
            bid = b.get("id")
            cursor.execute(
                f"SELECT * FROM {BillRepository.BILL_LINES} WHERE bill_id = %s ORDER BY line_number",
                (bid,),
            )
            lines = [_row_to_dict(x) for x in cursor.fetchall()]
            cursor.execute(
                f"SELECT * FROM {BillRepository.VENDORS} WHERE id = %s",
                (b.get("vendor_id"),),
            )
            vend = _row_to_dict(cursor.fetchone())
            bills_with_lines.append({"bill": b, "lines": lines, "vendor": vend})
        cursor.close()
        return {
            "bills": bills_with_lines,
            "total": total,
            "page": page,
            "total_pages": total_pages,
        }

    @staticmethod
    def find_by_id(bill_id: int) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT b.*, v.vendor_name, v.vendor_number FROM {BillRepository.BILLS} b "
                f"JOIN {BillRepository.VENDORS} v ON v.id = b.vendor_id WHERE b.id = %s",
                (bill_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            b = _row_to_dict(row)
            cursor.execute(
                f"SELECT bl.*, a.account_name, a.account_number FROM {BillRepository.BILL_LINES} bl "
                f"JOIN {BillRepository.ACCOUNTS} a ON a.id = bl.account_id WHERE bl.bill_id = %s ORDER BY bl.line_number",
                (bill_id,),
            )
            lines = [_row_to_dict(x) for x in cursor.fetchall()]
            return {
                "bill": b,
                "lines": lines,
                "vendor": {"vendor_name": b.get("vendor_name"), "vendor_number": b.get("vendor_number")},
            }
        finally:
            cursor.close()

    @staticmethod
    def find_by_bill_number(number: str) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT id FROM {BillRepository.BILLS} WHERE bill_number = %s",
                (number,),
            )
            row = cursor.fetchone()
            bid = _scalar(row, "id")
            return BillRepository.find_by_id(bid) if bid else None
        finally:
            cursor.close()

    @staticmethod
    def find_overdue() -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"""
                SELECT b.id FROM {BillRepository.BILLS} b
                WHERE b.due_date < CURRENT_DATE AND b.balance_due > 0
                AND b.status NOT IN ('void','paid')
                ORDER BY b.due_date ASC
            """)
            ids = [_scalar(r, "id") for r in cursor.fetchall() if _scalar(r, "id")]
            return [BillRepository.find_by_id(i) for i in ids]
        finally:
            cursor.close()

    @staticmethod
    def find_by_vendor(vendor_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT id FROM {BillRepository.BILLS} WHERE vendor_id = %s ORDER BY bill_date DESC, id DESC LIMIT %s",
                (vendor_id, limit),
            )
            ids = [_scalar(r, "id") for r in cursor.fetchall() if _scalar(r, "id")]
            return [BillRepository.find_by_id(i) for i in ids]
        finally:
            cursor.close()

    @staticmethod
    def get_by_status(status: str) -> List[Dict[str, Any]]:
        out = BillRepository.find_all({"status": status, "limit": 500})
        return out.get("bills", [])

    @staticmethod
    def create(data: Dict, user_id: int) -> Dict[str, Any]:
        from backend.models.vendor_model import VendorRepository

        vendor = VendorRepository.find_by_id(data["vendor_id"])
        if not vendor:
            raise ValueError("Vendor not found")

        bill_date_raw = data.get("bill_date")
        if isinstance(bill_date_raw, str):
            bill_date_str = bill_date_raw.split("T")[0]
        else:
            bill_date_str = bill_date_raw.isoformat()[:10] if hasattr(bill_date_raw, "isoformat") else str(bill_date_raw)[:10]
        due_date = data.get("due_date")
        if not due_date:
            terms_days = int(vendor.get("payment_terms_days") or 30)
            due_date = BillRepository._calculate_due_date(bill_date_str, terms_days)
        if hasattr(due_date, "isoformat"):
            due_date = due_date.isoformat()[:10]
        elif isinstance(due_date, str):
            due_date = due_date.split("T")[0]
        terms = data.get("terms") or vendor.get("payment_terms") or "Net 30"
        lines_in = data.get("lines") or []
        if not lines_in:
            raise ValueError("Bill must have at least one line item")

        calculated = BillRepository._calculate_line_totals(lines_in)
        subtotal = sum(x["line_total"] for x in calculated)
        total_tax = sum(x["tax_amount"] for x in calculated)
        total = subtotal + total_tax
        amount_paid = 0.0
        balance_due = total

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(
                f"""
                INSERT INTO {BillRepository.BILLS} (
                    bill_number, vendor_id, bill_date, due_date, terms,
                    status, subtotal, tax_amount, total_amount, amount_paid, balance_due,
                    vendor_reference, memo, created_by, updated_by
                ) VALUES (
                    NULL, %s, %s, %s, %s, 'open',
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
                RETURNING *
                """,
                (
                    data["vendor_id"],
                    bill_date_str,
                    due_date,
                    terms,
                    subtotal,
                    total_tax,
                    total,
                    amount_paid,
                    balance_due,
                    data.get("vendor_reference"),
                    data.get("memo"),
                    user_id,
                    user_id,
                ),
            )
            bill_row = cursor.fetchone()
            bill = _row_to_dict(bill_row)
            bill_id = bill["id"]
            bill_number = bill.get("bill_number") or ""

            for i, ln in enumerate(calculated):
                cursor.execute(
                    f"""
                    INSERT INTO {BillRepository.BILL_LINES} (
                        bill_id, line_number, item_id, description, quantity, unit_cost,
                        line_total, tax_rate_id, tax_amount, account_id, class_id,
                        billable, customer_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        bill_id,
                        i + 1,
                        ln.get("item_id"),
                        ln.get("description", ""),
                        ln.get("quantity"),
                        ln.get("unit_cost"),
                        ln["line_total"],
                        ln.get("tax_rate_id"),
                        ln["tax_amount"],
                        ln["account_id"],
                        ln.get("class_id"),
                        bool(ln.get("billable") or False),
                        ln.get("customer_id"),
                    ),
                )

            tx_id = BillRepository._create_accounting_entry(bill_id, user_id, cursor, conn, bill, calculated, total_tax)
            if tx_id:
                cursor.execute(
                    f"UPDATE {BillRepository.BILLS} SET transaction_id = %s WHERE id = %s",
                    (tx_id, bill_id),
                )
                bill["transaction_id"] = tx_id

            conn.commit()
            result = BillRepository.find_by_id(bill_id)
            if result:
                result["vendor"] = vendor
            return result
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def _create_accounting_entry(
        bill_id: int,
        user_id: int,
        cursor,
        conn,
        bill: Dict,
        calculated_lines: List[Dict],
        total_tax: float,
    ) -> Optional[int]:
        ap_id = BillRepository._ap_account_id()
        if not ap_id:
            raise ValueError("Accounts Payable account not found")

        total = float(bill.get("total_amount") or 0)
        bill_date = bill.get("bill_date")
        if isinstance(bill_date, str):
            bill_date = bill_date[:10]
        bill_number = bill.get("bill_number") or ""
        vendor_id = bill.get("vendor_id")

        cursor.execute(
            f"""
            INSERT INTO {BillRepository.TRANSACTIONS} (
                transaction_number, transaction_date, transaction_type, description,
                source_document_id, source_document_type, is_posted, created_by, updated_by
            ) VALUES (NULL, %s, 'bill', %s, %s, 'bill', true, %s, %s)
            RETURNING id
            """,
            (bill_date, f"Bill {bill_number}", bill_id, user_id, user_id),
        )
        row = cursor.fetchone()
        tx_id = _scalar(row, "id")
        if not tx_id:
            return None

        line_num = 1
        for ln in calculated_lines:
            amt = float(ln.get("line_total") or 0)
            if amt <= 0:
                continue
            cursor.execute(
                f"""
                INSERT INTO {BillRepository.TRANSACTION_LINES} (
                    transaction_id, account_id, line_number, debit_amount, credit_amount,
                    description, class_id
                ) VALUES (%s, %s, %s, %s, 0, %s, %s)
                """,
                (
                    tx_id,
                    ln["account_id"],
                    line_num,
                    amt,
                    (ln.get("description") or "")[:255] or "Expense",
                    ln.get("class_id"),
                ),
            )
            line_num += 1

        if total_tax > 0:
            tax_acct = BillRepository._tax_payable_account_id()
            if tax_acct:
                cursor.execute(
                    f"""
                    INSERT INTO {BillRepository.TRANSACTION_LINES} (
                        transaction_id, account_id, line_number, debit_amount, credit_amount, description
                    ) VALUES (%s, %s, %s, %s, 0, 'Sales Tax Paid')
                    """,
                    (tx_id, tax_acct, line_num, total_tax),
                )
                line_num += 1

        cursor.execute(
            f"""
            INSERT INTO {BillRepository.TRANSACTION_LINES} (
                transaction_id, account_id, line_number, debit_amount, credit_amount,
                description, entity_type, entity_id
            ) VALUES (%s, %s, %s, 0, %s, %s, 'vendor', %s)
            """,
            (tx_id, ap_id, line_num, total, f"Bill {bill_number}", vendor_id),
        )

        return tx_id

    @staticmethod
    def update(bill_id: int, data: Dict, user_id: int) -> Dict[str, Any]:
        existing = BillRepository.find_by_id(bill_id)
        if not existing:
            raise ValueError("Bill not found")
        bill = existing["bill"]
        if bill.get("status") == "paid":
            raise ValueError("Cannot modify paid bill")
        if bill.get("status") == "void":
            raise ValueError("Cannot modify voided bill")
        if float(bill.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot modify bill with payments applied. Reverse payments first.")

        from backend.models.vendor_model import VendorRepository

        vendor_id = data.get("vendor_id") or bill.get("vendor_id")
        vendor = VendorRepository.find_by_id(vendor_id)
        if not vendor:
            raise ValueError("Vendor not found")

        due_date = data.get("due_date")
        if not due_date:
            terms_days = int(vendor.get("payment_terms_days") or 30)
            due_date = BillRepository._calculate_due_date(
                data.get("bill_date") or bill.get("bill_date"),
                terms_days,
            )
        if hasattr(due_date, "isoformat"):
            due_date = due_date.isoformat()[:10]
        elif isinstance(due_date, str):
            due_date = due_date.split("T")[0]
        terms = data.get("terms") or vendor.get("payment_terms") or "Net 30"
        lines_in = data.get("lines")
        if not lines_in:
            lines_in = [
                {
                    "description": l.get("description"),
                    "quantity": l.get("quantity"),
                    "unit_cost": l.get("unit_cost"),
                    "tax_rate_id": l.get("tax_rate_id"),
                    "account_id": l.get("account_id"),
                    "item_id": l.get("item_id"),
                    "class_id": l.get("class_id"),
                    "billable": l.get("billable"),
                    "customer_id": l.get("customer_id"),
                }
                for l in existing.get("lines", [])
            ]
        calculated = BillRepository._calculate_line_totals(lines_in)
        subtotal = sum(x["line_total"] for x in calculated)
        total_tax = sum(x["tax_amount"] for x in calculated)
        total = subtotal + total_tax
        amount_paid = float(bill.get("amount_paid") or 0)
        balance_due = total - amount_paid

        cursor = get_cursor()
        conn = get_connection()
        try:
            tx_id = bill.get("transaction_id")
            if tx_id:
                BillRepository._reverse_accounting_entry(tx_id, user_id, cursor)

            cursor.execute(
                f"""
                UPDATE {BillRepository.BILLS} SET
                    vendor_id = %s, bill_date = %s, due_date = %s, terms = %s,
                    subtotal = %s, tax_amount = %s, total_amount = %s, amount_paid = %s, balance_due = %s,
                    vendor_reference = %s, memo = %s, updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (
                    vendor_id,
                    data.get("bill_date") or bill.get("bill_date"),
                    due_date,
                    terms,
                    subtotal,
                    total_tax,
                    total,
                    amount_paid,
                    balance_due,
                    data.get("vendor_reference") if "vendor_reference" in data else bill.get("vendor_reference"),
                    data.get("memo") if "memo" in data else bill.get("memo"),
                    user_id,
                    bill_id,
                ),
            )

            cursor.execute(f"DELETE FROM {BillRepository.BILL_LINES} WHERE bill_id = %s", (bill_id,))
            for i, ln in enumerate(calculated):
                cursor.execute(
                    f"""
                    INSERT INTO {BillRepository.BILL_LINES} (
                        bill_id, line_number, item_id, description, quantity, unit_cost,
                        line_total, tax_rate_id, tax_amount, account_id, class_id,
                        billable, customer_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        bill_id,
                        i + 1,
                        ln.get("item_id"),
                        ln.get("description", ""),
                        ln.get("quantity"),
                        ln.get("unit_cost"),
                        ln["line_total"],
                        ln.get("tax_rate_id"),
                        ln["tax_amount"],
                        ln["account_id"],
                        ln.get("class_id"),
                        bool(ln.get("billable") or False),
                        ln.get("customer_id"),
                    ),
                )

            updated = BillRepository.find_by_id(bill_id)
            ubill = updated["bill"] if updated else None
            if ubill:
                new_tx_id = BillRepository._create_accounting_entry(
                    bill_id, user_id, cursor, conn, ubill, calculated, total_tax
                )
            else:
                new_tx_id = None
            if new_tx_id:
                cursor.execute(
                    f"UPDATE {BillRepository.BILLS} SET transaction_id = %s WHERE id = %s",
                    (new_tx_id, bill_id),
                )
            conn.commit()
            return BillRepository.find_by_id(bill_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def _reverse_accounting_entry(transaction_id: int, user_id: int, cursor) -> None:
        cursor.execute(
            f"""
            UPDATE {BillRepository.TRANSACTIONS} SET
                is_void = true, void_date = CURRENT_DATE, void_reason = 'Bill voided',
                updated_by = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (user_id, transaction_id),
        )

    @staticmethod
    def void_bill(bill_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        existing = BillRepository.find_by_id(bill_id)
        if not existing:
            raise ValueError("Bill not found")
        bill = existing["bill"]
        if bill.get("status") == "void":
            raise ValueError("Bill is already voided")
        if float(bill.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot void bill with payments applied. Reverse payments first.")

        cursor = get_cursor()
        conn = get_connection()
        try:
            tx_id = bill.get("transaction_id")
            if tx_id:
                BillRepository._reverse_accounting_entry(tx_id, user_id, cursor)
            cursor.execute(
                f"""
                UPDATE {BillRepository.BILLS} SET
                    status = 'void', void_date = CURRENT_DATE, void_reason = %s,
                    updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (reason, user_id, bill_id),
            )
            conn.commit()
            row = BillRepository.find_by_id(bill_id)
            return row["bill"] if row else bill
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def update_status(bill_id: int) -> Dict[str, Any]:
        existing = BillRepository.find_by_id(bill_id)
        if not existing:
            raise ValueError("Bill not found")
        bill = existing["bill"]
        balance_due = float(bill.get("balance_due") or 0)
        amount_paid = float(bill.get("amount_paid") or 0)
        new_status = bill.get("status")
        if balance_due <= 0:
            new_status = "paid"
        elif amount_paid > 0:
            new_status = "partial"

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(
                f"UPDATE {BillRepository.BILLS} SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (new_status, bill_id),
            )
            conn.commit()
        finally:
            cursor.close()
        return BillRepository.find_by_id(bill_id)["bill"]

    @staticmethod
    def delete(bill_id: int, user_id: int = 1) -> bool:
        existing = BillRepository.find_by_id(bill_id)
        if not existing:
            raise ValueError("Bill not found")
        bill = existing["bill"]
        if bill.get("status") == "paid":
            raise ValueError("Cannot delete paid bill")
        if float(bill.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot delete bill with payments applied")

        cursor = get_cursor()
        conn = get_connection()
        try:
            tx_id = bill.get("transaction_id")
            if tx_id:
                BillRepository._reverse_accounting_entry(tx_id, user_id, cursor)
            cursor.execute(f"DELETE FROM {BillRepository.BILLS} WHERE id = %s", (bill_id,))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
