#!/usr/bin/env python3
"""
Item Model/Repository Layer
Handles database operations for items and inventory_transactions.
Tracks inventory quantities, costing methods, and inventory movements.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database_postgres import get_cursor, get_connection

ITEMS = "items"
INVENTORY_TRANSACTIONS = "inventory_transactions"
ACCOUNTS = "accounts"
INVOICE_LINES = "invoice_lines"
BILL_LINES = "bill_lines"

VALID_ITEM_TYPES = frozenset({"inventory", "non_inventory", "service", "bundle"})
VALID_COST_METHODS = frozenset({"FIFO", "LIFO", "Average"})


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


class ItemRepository:
    @staticmethod
    def find_all(filters: Optional[Dict] = None) -> Dict[str, Any]:
        filters = filters or {}
        cursor = get_cursor()
        base = f"""
            SELECT * FROM {ITEMS} WHERE 1=1
        """
        params: List[Any] = []

        if filters.get("item_type"):
            base += " AND item_type = %s"
            params.append(filters["item_type"])
        if filters.get("is_active") is not None:
            base += " AND is_active = %s"
            params.append(filters["is_active"])
        if filters.get("low_stock"):
            base += " AND quantity_on_hand <= reorder_point AND item_type = 'inventory'"
        if filters.get("category_id"):
            base += " AND category_id = %s"
            params.append(filters["category_id"])
        if filters.get("search"):
            t = f"%{filters['search']}%"
            base += " AND (item_name ILIKE %s OR item_number ILIKE %s OR barcode ILIKE %s)"
            params.extend([t, t, t])

        count_sql = f"SELECT COUNT(*) AS total FROM ({base}) _c"
        cursor.execute(count_sql, params)
        total = int(_scalar(cursor.fetchone(), "total") or 0)

        page = max(1, int(filters.get("page") or 1))
        limit = min(100, max(1, int(filters.get("limit") or 50)))
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit if limit else 0

        base += " ORDER BY item_name ASC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(base, params)
        rows = cursor.fetchall()
        items = [_row_to_dict(r) for r in rows]
        cursor.close()
        return {
            "items": items,
            "total": total,
            "page": page,
            "total_pages": total_pages,
        }

    @staticmethod
    def find_by_id(item_id: int) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {ITEMS} WHERE id = %s", (item_id,))
            row = cursor.fetchone()
            return _row_to_dict(row)
        finally:
            cursor.close()

    @staticmethod
    def find_by_item_number(item_number: str) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {ITEMS} WHERE item_number = %s", (item_number,))
            row = cursor.fetchone()
            return _row_to_dict(row)
        finally:
            cursor.close()

    @staticmethod
    def find_by_barcode(barcode: str) -> Optional[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(f"SELECT * FROM {ITEMS} WHERE barcode = %s", (barcode,))
            row = cursor.fetchone()
            return _row_to_dict(row)
        finally:
            cursor.close()

    @staticmethod
    def generate_item_number() -> str:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT item_number FROM {ITEMS}
                WHERE item_number ~ '^ITEM-[0-9]+$'
                ORDER BY CAST(SUBSTRING(item_number FROM 6) AS INTEGER) DESC
                LIMIT 1
                """
            )
            row = cursor.fetchone()
            if row and row.get("item_number"):
                last_num = row["item_number"]
                num_part = int(last_num.split("-")[1])
                next_num = num_part + 1
                return f"ITEM-{next_num:04d}"
            return "ITEM-0001"
        except Exception:
            return "ITEM-0001"
        finally:
            cursor.close()

    @staticmethod
    def create(data: Dict, user_id: int) -> Dict[str, Any]:
        item_number = data.get("item_number")
        if not item_number:
            item_number = ItemRepository.generate_item_number()

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(
                f"""
                INSERT INTO {ITEMS} (
                    item_number, item_name, item_type, description, barcode, unit_of_measure,
                    category_id, income_account_id, expense_account_id, asset_account_id,
                    quantity_on_hand, reorder_point, reorder_quantity, purchase_cost, average_cost,
                    sales_price, is_taxable, tax_rate_id, cost_method, is_active,
                    created_by, updated_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s
                )
                RETURNING *
                """,
                (
                    item_number,
                    data["item_name"],
                    data["item_type"],
                    data.get("description"),
                    data.get("barcode"),
                    data.get("unit_of_measure") or "ea",
                    data.get("category_id"),
                    data["income_account_id"],
                    data["expense_account_id"],
                    data.get("asset_account_id"),
                    data.get("quantity_on_hand") or 0,
                    data.get("reorder_point") or 0,
                    data.get("reorder_quantity") or 0,
                    data.get("purchase_cost") or 0,
                    data.get("purchase_cost") or 0,  # Initial average cost = purchase cost
                    data["sales_price"],
                    data.get("is_taxable") if data.get("is_taxable") is not None else True,
                    data.get("tax_rate_id"),
                    data.get("cost_method") or "Average",
                    data.get("is_active") if data.get("is_active") is not None else True,
                    user_id,
                    user_id,
                ),
            )
            row = cursor.fetchone()
            conn.commit()
            return _row_to_dict(row)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def update(item_id: int, data: Dict, user_id: int) -> Dict[str, Any]:
        existing = ItemRepository.find_by_id(item_id)
        if not existing:
            raise ValueError("Item not found")

        allowed = {
            "item_name", "item_type", "description", "barcode", "unit_of_measure",
            "category_id", "income_account_id", "expense_account_id", "asset_account_id",
            "reorder_point", "reorder_quantity", "purchase_cost", "sales_price",
            "is_taxable", "tax_rate_id", "cost_method", "is_active"
        }
        cursor = get_cursor()
        conn = get_connection()
        try:
            updates = []
            params = []
            for k, v in data.items():
                if k not in allowed or v is None:
                    continue
                updates.append(f"{k} = %s")
                params.append(v)
            if not updates:
                return ItemRepository.find_by_id(item_id)
            updates.append("updated_by = %s")
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.extend([user_id, item_id])
            cursor.execute(
                f"UPDATE {ITEMS} SET {', '.join(updates)} WHERE id = %s RETURNING *",
                params,
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                raise ValueError("Item not found")
            return _row_to_dict(row)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def delete(item_id: int) -> bool:
        existing = ItemRepository.find_by_id(item_id)
        if not existing:
            raise ValueError("Item not found")

        can_delete = ItemRepository.can_delete(item_id)
        if not can_delete:
            raise ValueError("Cannot delete item that has been used in transactions")

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(f"DELETE FROM {ITEMS} WHERE id = %s", (item_id,))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def record_sale(
        item_id: int, quantity: float, sale_price: float, invoice_id: int, user_id: int
    ) -> Dict[str, Any]:
        client = get_connection()
        cursor = client.cursor()

        try:
            cursor.execute("BEGIN")

            item = ItemRepository.find_by_id(item_id)
            if not item:
                raise ValueError("Item not found")

            if item.get("item_type") in ("service", "non_inventory"):
                raise ValueError("Cannot record inventory sale for service or non-inventory items")

            qty_on_hand = float(item.get("quantity_on_hand") or 0)
            if qty_on_hand < quantity:
                raise ValueError(f"Insufficient inventory. Available: {qty_on_hand}, Requested: {quantity}")

            # Calculate COGS based on costing method
            cogs = ItemRepository.get_cogs(item_id, quantity)
            unit_cost = cogs / quantity if quantity > 0 else 0

            # Create inventory transaction
            cursor.execute(
                f"""
                INSERT INTO {INVENTORY_TRANSACTIONS} (
                    item_id, transaction_date, transaction_type, quantity_change, unit_cost,
                    total_cost, source_document_type, source_document_id, created_by
                ) VALUES (%s, CURRENT_DATE, 'sale', %s, %s, %s, 'invoice', %s, %s)
                RETURNING *
                """,
                (item_id, -quantity, unit_cost, -cogs, invoice_id, user_id),
            )
            inv_txn = _row_to_dict(cursor.fetchone())

            # Update item quantity
            cursor.execute(
                f"UPDATE {ITEMS} SET quantity_on_hand = quantity_on_hand - %s WHERE id = %s",
                (quantity, item_id),
            )

            cursor.execute("COMMIT")
            return inv_txn
        except Exception:
            cursor.execute("ROLLBACK")
            raise
        finally:
            cursor.close()

    @staticmethod
    def record_purchase(
        item_id: int, quantity: float, unit_cost: float, bill_id: int, user_id: int
    ) -> Dict[str, Any]:
        client = get_connection()
        cursor = client.cursor()

        try:
            cursor.execute("BEGIN")

            item = ItemRepository.find_by_id(item_id)
            if not item:
                raise ValueError("Item not found")

            if item.get("item_type") in ("service", "non_inventory"):
                raise ValueError("Cannot record inventory purchase for service or non-inventory items")

            total_cost = quantity * unit_cost

            # Create inventory transaction
            cursor.execute(
                f"""
                INSERT INTO {INVENTORY_TRANSACTIONS} (
                    item_id, transaction_date, transaction_type, quantity_change, unit_cost,
                    total_cost, source_document_type, source_document_id, created_by
                ) VALUES (%s, CURRENT_DATE, 'purchase', %s, %s, %s, 'bill', %s, %s)
                RETURNING *
                """,
                (item_id, quantity, unit_cost, total_cost, bill_id, user_id),
            )
            inv_txn = _row_to_dict(cursor.fetchone())

            # Update item quantity
            cursor.execute(
                f"UPDATE {ITEMS} SET quantity_on_hand = quantity_on_hand + %s, purchase_cost = %s WHERE id = %s",
                (quantity, unit_cost, item_id),
            )

            # Recalculate average cost
            new_avg_cost = ItemRepository.calculate_average_cost(item_id)
            cursor.execute(
                f"UPDATE {ITEMS} SET average_cost = %s WHERE id = %s",
                (new_avg_cost, item_id),
            )

            cursor.execute("COMMIT")
            return inv_txn
        except Exception:
            cursor.execute("ROLLBACK")
            raise
        finally:
            cursor.close()

    @staticmethod
    def record_adjustment(data: Dict, user_id: int) -> Dict[str, Any]:
        item = ItemRepository.find_by_id(data["item_id"])
        if not item:
            raise ValueError("Item not found")

        adjustment_type = data.get("adjustment_type")
        quantity = float(data.get("quantity") or 0)
        quantity_change = quantity if adjustment_type == "increase" else -quantity
        unit_cost = data.get("unit_cost") or item.get("average_cost") or 0
        total_cost = quantity_change * unit_cost

        cursor = get_cursor()
        conn = get_connection()
        try:
            cursor.execute(
                f"""
                INSERT INTO {INVENTORY_TRANSACTIONS} (
                    item_id, transaction_date, transaction_type, quantity_change, unit_cost,
                    total_cost, notes, created_by
                ) VALUES (%s, CURRENT_DATE, 'adjustment', %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (data["item_id"], quantity_change, unit_cost, total_cost, data.get("reason"), user_id),
            )
            row = cursor.fetchone()
            
            # Update item quantity
            cursor.execute(
                f"UPDATE {ITEMS} SET quantity_on_hand = quantity_on_hand + %s WHERE id = %s",
                (quantity_change, data["item_id"]),
            )
            
            conn.commit()
            return _row_to_dict(row)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def get_cogs(item_id: int, quantity: float) -> float:
        item = ItemRepository.find_by_id(item_id)
        if not item:
            raise ValueError("Item not found")

        cost_method = item.get("cost_method") or "Average"
        if cost_method == "FIFO":
            return ItemRepository.calculate_fifo_cost(item_id, quantity)
        elif cost_method == "LIFO":
            return ItemRepository.calculate_lifo_cost(item_id, quantity)
        else:  # Average
            avg_cost = float(item.get("average_cost") or 0)
            return avg_cost * quantity

    @staticmethod
    def calculate_average_cost(item_id: int) -> float:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT 
                    COALESCE(SUM(quantity_change * unit_cost) / NULLIF(SUM(quantity_change), 0), 0) as avg_cost
                FROM {INVENTORY_TRANSACTIONS}
                WHERE item_id = %s AND quantity_change > 0
                """,
                (item_id,),
            )
            row = cursor.fetchone()
            return float(_scalar(row, "avg_cost") or 0)
        finally:
            cursor.close()

    @staticmethod
    def calculate_fifo_cost(item_id: int, quantity_needed: float) -> float:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT quantity_change, unit_cost
                FROM {INVENTORY_TRANSACTIONS}
                WHERE item_id = %s AND quantity_change > 0
                ORDER BY transaction_date ASC, id ASC
                """,
                (item_id,),
            )
            rows = cursor.fetchall()

            remaining_qty = quantity_needed
            total_cost = 0.0

            for row in rows:
                available_qty = float(row.get("quantity_change") or 0)
                unit_cost = float(row.get("unit_cost") or 0)
                qty_to_use = min(remaining_qty, available_qty)
                total_cost += qty_to_use * unit_cost
                remaining_qty -= qty_to_use

                if remaining_qty <= 0:
                    break

            return total_cost
        finally:
            cursor.close()

    @staticmethod
    def calculate_lifo_cost(item_id: int, quantity_needed: float) -> float:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT quantity_change, unit_cost
                FROM {INVENTORY_TRANSACTIONS}
                WHERE item_id = %s AND quantity_change > 0
                ORDER BY transaction_date DESC, id DESC
                """,
                (item_id,),
            )
            rows = cursor.fetchall()

            remaining_qty = quantity_needed
            total_cost = 0.0

            for row in rows:
                available_qty = float(row.get("quantity_change") or 0)
                unit_cost = float(row.get("unit_cost") or 0)
                qty_to_use = min(remaining_qty, available_qty)
                total_cost += qty_to_use * unit_cost
                remaining_qty -= qty_to_use

                if remaining_qty <= 0:
                    break

            return total_cost
        finally:
            cursor.close()

    @staticmethod
    def get_low_stock_items() -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT * FROM {ITEMS} 
                WHERE quantity_on_hand <= reorder_point 
                  AND item_type = 'inventory'
                  AND is_active = true
                ORDER BY quantity_on_hand ASC
                """
            )
            rows = cursor.fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            cursor.close()

    @staticmethod
    def get_inventory_value() -> float:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT SUM(quantity_on_hand * average_cost) as total_value
                FROM {ITEMS}
                WHERE item_type = 'inventory' AND is_active = true
                """
            )
            row = cursor.fetchone()
            return float(_scalar(row, "total_value") or 0)
        finally:
            cursor.close()

    @staticmethod
    def get_inventory_report() -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT 
                    i.id,
                    i.item_number,
                    i.item_name,
                    i.quantity_on_hand,
                    i.reorder_point,
                    i.average_cost,
                    i.sales_price,
                    i.quantity_on_hand * i.average_cost as inventory_value,
                    CASE WHEN i.quantity_on_hand <= i.reorder_point THEN true ELSE false END as needs_reorder
                FROM {ITEMS} i
                WHERE i.item_type = 'inventory' AND i.is_active = true
                ORDER BY i.item_name
                """
            )
            rows = cursor.fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            cursor.close()

    @staticmethod
    def get_item_history(item_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = get_cursor()
        try:
            cursor.execute(
                f"""
                SELECT * FROM {INVENTORY_TRANSACTIONS}
                WHERE item_id = %s
                ORDER BY transaction_date DESC, id DESC
                LIMIT %s
                """,
                (item_id, limit),
            )
            rows = cursor.fetchall()
            return [_row_to_dict(r) for r in rows]
        finally:
            cursor.close()

    @staticmethod
    def can_delete(item_id: int) -> bool:
        cursor = get_cursor()
        try:
            # Check if item has been used in any transactions
            cursor.execute(
                f"SELECT COUNT(*) FROM {INVENTORY_TRANSACTIONS} WHERE item_id = %s",
                (item_id,),
            )
            txn_count = int(_scalar(cursor.fetchone(), "count") or 0)

            cursor.execute(
                f"SELECT COUNT(*) FROM {INVOICE_LINES} WHERE item_id = %s",
                (item_id,),
            )
            invoice_count = int(_scalar(cursor.fetchone(), "count") or 0)

            cursor.execute(
                f"SELECT COUNT(*) FROM {BILL_LINES} WHERE item_id = %s",
                (item_id,),
            )
            bill_count = int(_scalar(cursor.fetchone(), "count") or 0)

            return txn_count == 0 and invoice_count == 0 and bill_count == 0
        finally:
            cursor.close()
