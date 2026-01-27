#!/usr/bin/env python3
"""
Invoice Model/Repository Layer
Handles database operations for invoices and invoice_lines.
Creates A/R journal entries via transactions/transaction_lines.
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


class InvoiceRepository:
    INVOICES = "invoices"
    LINES = "invoice_lines"
    TRANSACTIONS = "transactions"
    TRANSACTION_LINES = "transaction_lines"
    CUSTOMERS = "accounting_customers"
    ACCOUNTS = "accounts"
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
            up = float(ln.get("unit_price") or 0)
            line_total = qty * up
            disc_pct = float(ln.get("discount_percentage") or 0)
            disc_amt = line_total * (disc_pct / 100) if disc_pct else 0
            after_disc = line_total - disc_amt
            rate = InvoiceRepository._get_tax_rate(ln.get("tax_rate_id"))
            tax_amt = after_disc * rate if rate else 0
            result.append({
                **ln,
                "line_total": line_total,
                "discount_amount": disc_amt,
                "discount_percentage": disc_pct,
                "tax_amount": tax_amt,
                "line_total_with_tax": after_disc + tax_amt,
            })
        return result

    @staticmethod
    def _calculate_due_date(inv_date: date, terms_days: int) -> date:
        if isinstance(inv_date, str):
            inv_date = datetime.fromisoformat(inv_date.split("T")[0]).date()
        d = inv_date + timedelta(days=int(terms_days or 0))
        return d

    @staticmethod
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
            SELECT i.* FROM {InvoiceRepository.INVOICES} i
            JOIN {InvoiceRepository.CUSTOMERS} c ON c.id = i.customer_id
            WHERE 1=1
        """
        params: List[Any] = []

        if filters.get("customer_id"):
            base += " AND i.customer_id = %s"
            params.append(filters["customer_id"])
        if filters.get("status"):
            base += " AND i.status = %s"
            params.append(filters["status"])
        if filters.get("start_date"):
            base += " AND i.invoice_date >= %s"
            params.append(filters["start_date"])
        if filters.get("end_date"):
            base += " AND i.invoice_date <= %s"
            params.append(filters["end_date"])
        if filters.get("overdue_only"):
            base += " AND i.due_date < CURRENT_DATE AND i.balance_due > 0 AND i.status NOT IN ('void','paid')"
        if filters.get("search"):
            base += " AND (i.invoice_number ILIKE %s OR c.display_name ILIKE %s OR c.company_name ILIKE %s)"
            t = f"%{filters['search']}%"
            params.extend([t, t, t])

        count_sql = f"SELECT COUNT(*) AS total FROM ({base}) _c"
        cursor.execute(count_sql, params)
        total = int(_scalar(cursor.fetchone(), "total") or 0)

        page = max(1, int(filters.get("page") or 1))
        limit = min(100, max(1, int(filters.get("limit") or 50)))
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit if limit else 0

        base += " ORDER BY i.invoice_date DESC, i.id DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(base, params)
        rows = cursor.fetchall()
        invoices_with_lines = []
        for r in rows:
            inv = _row_to_dict(r)
            inv_id = inv.get("id")
            cursor.execute(
                f"SELECT * FROM {InvoiceRepository.LINES} WHERE invoice_id = %s ORDER BY line_number",
                (inv_id,),
            )
            lines = [_row_to_dict(x) for x in cursor.fetchall()]
            cursor.execute(
                f"SELECT * FROM {InvoiceRepository.CUSTOMERS} WHERE id = %s",
                (inv.get("customer_id"),),
            )
            cust = _row_to_dict(cursor.fetchone())
            invoices_with_lines.append({"invoice": inv, "lines": lines, "customer": cust})
        cursor.close()
        return {
            "invoices": invoices_with_lines,
            "total": total,
            "page": page,
            "total_pages": total_pages,
        }

    @staticmethod
    def find_by_id(invoice_id: int) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {InvoiceRepository.INVOICES} WHERE id = %s", (invoice_id,))
            row = cursor.fetchone()
            if not row:
                return None
            inv = _row_to_dict(row)
            cursor.execute(
                f"SELECT * FROM {InvoiceRepository.LINES} WHERE invoice_id = %s ORDER BY line_number",
                (invoice_id,),
            )
            lines = [_row_to_dict(x) for x in cursor.fetchall()]
            cursor.execute(
                f"SELECT * FROM {InvoiceRepository.CUSTOMERS} WHERE id = %s",
                (inv.get("customer_id"),),
            )
            cust = _row_to_dict(cursor.fetchone())
            return {"invoice": inv, "lines": lines, "customer": cust}
        finally:
            cursor.close()

    @staticmethod
    def find_by_invoice_number(number: str) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT id FROM {InvoiceRepository.INVOICES} WHERE invoice_number = %s",
                (number,),
            )
            row = cursor.fetchone()
            tid = _scalar(row, "id")
            return InvoiceRepository.find_by_id(tid) if tid else None
        finally:
            cursor.close()

    @staticmethod
    def find_overdue() -> List[Dict]:
        cursor = get_cursor()
        try:
            cursor.execute(f"""
                SELECT i.id FROM {InvoiceRepository.INVOICES} i
                WHERE i.due_date < CURRENT_DATE AND i.balance_due > 0
                AND i.status NOT IN ('void','paid')
                ORDER BY i.due_date ASC
            """)
            ids = [_scalar(r, "id") for r in cursor.fetchall() if _scalar(r, "id")]
            return [InvoiceRepository.find_by_id(i) for i in ids]
        finally:
            cursor.close()

    @staticmethod
    def find_by_customer(customer_id: int, limit: int = 50) -> List[Dict]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"SELECT id FROM {InvoiceRepository.INVOICES} WHERE customer_id = %s ORDER BY invoice_date DESC, id DESC LIMIT %s",
                (customer_id, limit),
            )
            ids = [_scalar(r, "id") for r in cursor.fetchall() if _scalar(r, "id")]
            return [InvoiceRepository.find_by_id(i) for i in ids]
        finally:
            cursor.close()

    @staticmethod
    def get_by_status(status: str) -> List[Dict]:
        out = InvoiceRepository.find_all({"status": status, "limit": 500})
        return out.get("invoices", [])

    @staticmethod
    def create(data: Dict, user_id: int) -> Dict[str, Any]:
        from backend.models.customer_model import CustomerRepository

        customer = CustomerRepository.find_by_id(data["customer_id"])
        if not customer:
            raise ValueError("Customer not found")

        inv_date_raw = data.get("invoice_date")
        if isinstance(inv_date_raw, str):
            inv_date_str = inv_date_raw.split("T")[0]
        else:
            inv_date_str = inv_date_raw.isoformat()[:10] if hasattr(inv_date_raw, "isoformat") else str(inv_date_raw)[:10]
        due_date = data.get("due_date")
        if not due_date:
            terms_days = int(customer.get("payment_terms_days") or 30)
            due_date = InvoiceRepository._calculate_due_date(inv_date_str, terms_days)
        if hasattr(due_date, "isoformat"):
            due_date = due_date.isoformat()[:10]
        elif isinstance(due_date, str):
            due_date = due_date.split("T")[0]
        terms = data.get("terms") or customer.get("payment_terms") or "Net 30"
        lines_in = data.get("lines") or []
        if not lines_in:
            raise ValueError("Invoice must have at least one line item")

        calculated = InvoiceRepository._calculate_line_totals(lines_in)
        subtotal = sum(x["line_total"] for x in calculated)
        total_tax = sum(x["tax_amount"] for x in calculated)
        disc_pct = float(data.get("discount_percentage") or 0)
        total_discount = subtotal * (disc_pct / 100) if disc_pct else 0
        total = subtotal - total_discount + total_tax
        amount_paid = 0.0
        balance_due = total

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(
                f"""
                INSERT INTO {InvoiceRepository.INVOICES} (
                    invoice_number, customer_id, invoice_date, due_date, terms,
                    status, subtotal, tax_amount, discount_amount, discount_percentage,
                    total_amount, amount_paid, balance_due, currency, exchange_rate,
                    billing_address_line1, billing_address_line2, billing_city, billing_state,
                    billing_postal_code, billing_country,
                    shipping_address_line1, shipping_address_line2, shipping_city, shipping_state,
                    shipping_postal_code, shipping_country,
                    memo, internal_notes, created_by, updated_by
                ) VALUES (
                    NULL, %s, %s, %s, %s, 'draft',
                    %s, %s, %s, %s, %s, %s, %s, 'USD', 1.0,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
                RETURNING *
                """,
                (
                    data["customer_id"],
                    inv_date_str,
                    due_date,
                    terms,
                    subtotal,
                    total_tax,
                    total_discount,
                    disc_pct,
                    total,
                    amount_paid,
                    balance_due,
                    customer.get("billing_address_line1"),
                    customer.get("billing_address_line2"),
                    customer.get("billing_city"),
                    customer.get("billing_state"),
                    customer.get("billing_postal_code"),
                    customer.get("billing_country"),
                    customer.get("shipping_address_line1"),
                    customer.get("shipping_address_line2"),
                    customer.get("shipping_city"),
                    customer.get("shipping_state"),
                    customer.get("shipping_postal_code"),
                    customer.get("shipping_country"),
                    data.get("memo"),
                    data.get("internal_notes"),
                    user_id,
                    user_id,
                ),
            )
            inv_row = cursor.fetchone()
            invoice = _row_to_dict(inv_row)
            inv_id = invoice["id"]

            for i, ln in enumerate(calculated):
                cursor.execute(
                    f"""
                    INSERT INTO {InvoiceRepository.LINES} (
                        invoice_id, line_number, item_id, description, quantity, unit_price,
                        line_total, discount_amount, discount_percentage, tax_rate_id, tax_amount,
                        line_total_with_tax, account_id, item_type
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        inv_id,
                        i + 1,
                        ln.get("item_id"),
                        ln.get("description", ""),
                        ln.get("quantity"),
                        ln.get("unit_price"),
                        ln["line_total"],
                        ln["discount_amount"],
                        ln["discount_percentage"],
                        ln.get("tax_rate_id"),
                        ln["tax_amount"],
                        ln["line_total_with_tax"],
                        ln["account_id"],
                        ln.get("item_type") or "product",
                    ),
                )

            tx_id = InvoiceRepository._create_accounting_entry(inv_id, user_id, cursor, conn, invoice, calculated, total_discount, disc_pct)
            if tx_id:
                cursor.execute(
                    f"UPDATE {InvoiceRepository.INVOICES} SET transaction_id = %s WHERE id = %s",
                    (tx_id, inv_id),
                )
                invoice["transaction_id"] = tx_id

            conn.commit()
            result = InvoiceRepository.find_by_id(inv_id)
            if result:
                result["customer"] = customer
            return result
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def _create_accounting_entry(
        invoice_id: int,
        user_id: int,
        cursor,
        conn,
        invoice: Dict,
        calculated_lines: List[Dict],
        total_discount: float,
        discount_pct: float,
    ) -> Optional[int]:
        ar_id = InvoiceRepository._ar_account_id()
        if not ar_id:
            return None

        total = float(invoice.get("total_amount") or 0)
        inv_date = invoice.get("invoice_date")
        if isinstance(inv_date, str):
            inv_date = inv_date[:10]
        inv_num = invoice.get("invoice_number") or ""
        cust_id = invoice.get("customer_id")

        cursor.execute(
            f"""
            INSERT INTO {InvoiceRepository.TRANSACTIONS} (
                transaction_number, transaction_date, transaction_type, description,
                source_document_id, source_document_type, is_posted, created_by, updated_by
            ) VALUES (NULL, %s, 'invoice', %s, %s, 'invoice', true, %s, %s)
            RETURNING id
            """,
            (inv_date, f"Invoice {inv_num}", invoice_id, user_id, user_id),
        )
        row = cursor.fetchone()
        tx_id = _scalar(row, "id")
        if not tx_id:
            return None

        line_num = 1
        cursor.execute(
            f"""
            INSERT INTO {InvoiceRepository.TRANSACTION_LINES} (
                transaction_id, account_id, line_number, debit_amount, credit_amount,
                description, entity_type, entity_id
            ) VALUES (%s, %s, %s, %s, 0, %s, 'customer', %s)
            """,
            (tx_id, ar_id, line_num, total, f"Invoice {inv_num}", cust_id),
        )
        line_num += 1

        for ln in calculated_lines:
            revenue = float(ln["line_total"]) - float(ln.get("discount_amount") or 0)
            if revenue <= 0:
                continue
            cursor.execute(
                f"""
                INSERT INTO {InvoiceRepository.TRANSACTION_LINES} (
                    transaction_id, account_id, line_number, debit_amount, credit_amount, description
                ) VALUES (%s, %s, %s, 0, %s, %s)
                """,
                (tx_id, ln["account_id"], line_num, revenue, ln.get("description", "")[:255] or "Revenue"),
            )
            line_num += 1

        tax_amt = float(invoice.get("tax_amount") or 0)
        if tax_amt > 0:
            tax_acct = InvoiceRepository._tax_payable_account_id()
            if tax_acct:
                cursor.execute(
                    f"""
                    INSERT INTO {InvoiceRepository.TRANSACTION_LINES} (
                        transaction_id, account_id, line_number, debit_amount, credit_amount, description
                    ) VALUES (%s, %s, %s, 0, %s, 'Sales Tax Collected')
                    """,
                    (tx_id, tax_acct, line_num, tax_amt),
                )

        return tx_id

    @staticmethod
    def update(invoice_id: int, data: Dict, user_id: int) -> Dict[str, Any]:
        existing = InvoiceRepository.find_by_id(invoice_id)
        if not existing:
            raise ValueError("Invoice not found")
        inv = existing["invoice"]
        if inv.get("status") == "paid":
            raise ValueError("Cannot modify paid invoice")
        if inv.get("status") == "void":
            raise ValueError("Cannot modify voided invoice")
        if float(inv.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot modify invoice with payments applied. Reverse payments first.")

        from backend.models.customer_model import CustomerRepository

        customer_id = data.get("customer_id") or inv.get("customer_id")
        customer = CustomerRepository.find_by_id(customer_id)
        if not customer:
            raise ValueError("Customer not found")

        due_date = data.get("due_date")
        if not due_date:
            terms_days = int(customer.get("payment_terms_days") or 30)
            due_date = InvoiceRepository._calculate_due_date(
                data.get("invoice_date") or inv.get("invoice_date"),
                terms_days,
            )
        if hasattr(due_date, "isoformat"):
            due_date = due_date.isoformat()[:10]
        terms = data.get("terms") or customer.get("payment_terms") or "Net 30"
        lines_in = data.get("lines")
        if not lines_in:
            lines_in = [
                {"description": l.get("description"), "quantity": l.get("quantity"), "unit_price": l.get("unit_price"),
                 "discount_percentage": l.get("discount_percentage"), "tax_rate_id": l.get("tax_rate_id"),
                 "account_id": l.get("account_id"), "item_id": l.get("item_id"), "item_type": l.get("item_type")}
                for l in existing.get("lines", [])
            ]
        calculated = InvoiceRepository._calculate_line_totals(lines_in)
        subtotal = sum(x["line_total"] for x in calculated)
        total_tax = sum(x["tax_amount"] for x in calculated)
        disc_pct = float(data.get("discount_percentage") or 0)
        total_discount = subtotal * (disc_pct / 100) if disc_pct else 0
        total = subtotal - total_discount + total_tax
        amount_paid = float(inv.get("amount_paid") or 0)
        balance_due = total - amount_paid

        cursor = get_cursor()
        conn = get_connection()
        try:
            tx_id = inv.get("transaction_id")
            if tx_id:
                InvoiceRepository._reverse_accounting_entry(tx_id, user_id, cursor)

            cursor.execute(
                f"""
                UPDATE {InvoiceRepository.INVOICES} SET
                    customer_id = %s, invoice_date = %s, due_date = %s, terms = %s,
                    subtotal = %s, tax_amount = %s, discount_amount = %s, discount_percentage = %s,
                    total_amount = %s, amount_paid = %s, balance_due = %s,
                    billing_address_line1 = %s, billing_address_line2 = %s, billing_city = %s,
                    billing_state = %s, billing_postal_code = %s, billing_country = %s,
                    shipping_address_line1 = %s, shipping_address_line2 = %s, shipping_city = %s,
                    shipping_state = %s, shipping_postal_code = %s, shipping_country = %s,
                    memo = %s, internal_notes = %s, updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (
                    customer_id,
                    data.get("invoice_date") or inv.get("invoice_date"),
                    due_date,
                    terms,
                    subtotal,
                    total_tax,
                    total_discount,
                    disc_pct,
                    total,
                    amount_paid,
                    balance_due,
                    customer.get("billing_address_line1"),
                    customer.get("billing_address_line2"),
                    customer.get("billing_city"),
                    customer.get("billing_state"),
                    customer.get("billing_postal_code"),
                    customer.get("billing_country"),
                    customer.get("shipping_address_line1"),
                    customer.get("shipping_address_line2"),
                    customer.get("shipping_city"),
                    customer.get("shipping_state"),
                    customer.get("shipping_postal_code"),
                    customer.get("shipping_country"),
                    data.get("memo"),
                    data.get("internal_notes"),
                    user_id,
                    invoice_id,
                ),
            )

            cursor.execute(f"DELETE FROM {InvoiceRepository.LINES} WHERE invoice_id = %s", (invoice_id,))
            for i, ln in enumerate(calculated):
                cursor.execute(
                    f"""
                    INSERT INTO {InvoiceRepository.LINES} (
                        invoice_id, line_number, item_id, description, quantity, unit_price,
                        line_total, discount_amount, discount_percentage, tax_rate_id, tax_amount,
                        line_total_with_tax, account_id, item_type
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        invoice_id,
                        i + 1,
                        ln.get("item_id"),
                        ln.get("description", ""),
                        ln.get("quantity"),
                        ln.get("unit_price"),
                        ln["line_total"],
                        ln["discount_amount"],
                        ln["discount_percentage"],
                        ln.get("tax_rate_id"),
                        ln["tax_amount"],
                        ln["line_total_with_tax"],
                        ln["account_id"],
                        ln.get("item_type") or "product",
                    ),
                )

            updated = InvoiceRepository.find_by_id(invoice_id)
            uinv = updated["invoice"] if updated else None
            if uinv:
                new_tx_id = InvoiceRepository._create_accounting_entry(
                    invoice_id, user_id, cursor, conn,
                    uinv, calculated, total_discount, disc_pct,
                )
            else:
                new_tx_id = None
            if new_tx_id:
                cursor.execute(
                    f"UPDATE {InvoiceRepository.INVOICES} SET transaction_id = %s WHERE id = %s",
                    (new_tx_id, invoice_id),
                )
            conn.commit()
            return InvoiceRepository.find_by_id(invoice_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def _reverse_accounting_entry(transaction_id: int, user_id: int, cursor) -> None:
        cursor.execute(
            f"""
            UPDATE {InvoiceRepository.TRANSACTIONS} SET
                is_void = true, void_date = CURRENT_DATE, void_reason = 'Invoice voided',
                updated_by = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (user_id, transaction_id),
        )

    @staticmethod
    def delete(invoice_id: int) -> bool:
        out = InvoiceRepository.find_by_id(invoice_id)
        if not out:
            raise ValueError("Invoice not found")
        inv = out["invoice"]
        if inv.get("status") == "paid":
            raise ValueError("Cannot delete paid invoice")
        if float(inv.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot delete invoice with payments applied")

        cursor = get_cursor()
        conn = get_connection()
        try:
            tx_id = inv.get("transaction_id")
            if tx_id:
                cursor.execute(
                    f"UPDATE {InvoiceRepository.INVOICES} SET transaction_id = NULL WHERE id = %s",
                    (invoice_id,),
                )
                InvoiceRepository._reverse_accounting_entry(tx_id, 1, cursor)
            cursor.execute(f"DELETE FROM {InvoiceRepository.INVOICES} WHERE id = %s", (invoice_id,))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def mark_as_sent(invoice_id: int, user_id: int) -> Dict[str, Any]:
        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(
                f"""
                UPDATE {InvoiceRepository.INVOICES} SET
                    status = 'sent', sent_date = CURRENT_TIMESTAMP, updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
                """,
                (user_id, invoice_id),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                raise ValueError("Invoice not found")
            return _row_to_dict(row)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def void_invoice(invoice_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        out = InvoiceRepository.find_by_id(invoice_id)
        if not out:
            raise ValueError("Invoice not found")
        inv = out["invoice"]
        if inv.get("status") == "void":
            raise ValueError("Invoice is already voided")
        if float(inv.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot void invoice with payments applied. Reverse payments first.")

        cursor = get_cursor()
        conn = get_connection()
        try:
            tx_id = inv.get("transaction_id")
            if tx_id:
                InvoiceRepository._reverse_accounting_entry(tx_id, user_id, cursor)
            cursor.execute(
                f"""
                UPDATE {InvoiceRepository.INVOICES} SET
                    status = 'void', void_date = CURRENT_DATE, void_reason = %s,
                    updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
                """,
                (reason.strip(), user_id, invoice_id),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                raise ValueError("Invoice not found")
            return _row_to_dict(row)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def update_status(invoice_id: int) -> Dict[str, Any]:
        out = InvoiceRepository.find_by_id(invoice_id)
        if not out:
            raise ValueError("Invoice not found")
        inv = out["invoice"]
        status = inv.get("status")
        balance_due = float(inv.get("balance_due") or 0)
        amount_paid = float(inv.get("amount_paid") or 0)
        due_date = inv.get("due_date")
        if isinstance(due_date, str):
            due_date = datetime.fromisoformat(due_date.split("T")[0]).date()

        if status == "void":
            return inv
        if balance_due <= 0:
            new_status = "paid"
        elif amount_paid > 0:
            new_status = "partial"
        elif due_date and datetime.now().date() > due_date and status not in ("draft", "void"):
            new_status = "overdue"
        elif status == "draft":
            new_status = "draft"
        elif inv.get("sent_date"):
            new_status = "sent"
        else:
            new_status = status or "draft"

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(
                f"UPDATE {InvoiceRepository.INVOICES} SET status = %s WHERE id = %s RETURNING *",
                (new_status, invoice_id),
            )
            row = cursor.fetchone()
            conn.commit()
            return _row_to_dict(row) if row else inv
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
