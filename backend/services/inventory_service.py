#!/usr/bin/env python3
"""
Inventory Service Layer
Business logic for inventory item management
"""

from typing import Optional, Dict, Any, List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.item_model import ItemRepository
from backend.models.account_model import AccountRepository


class InventoryService:
    @staticmethod
    def get_all_items(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return ItemRepository.find_all(filters or {})

    @staticmethod
    def get_item_by_id(item_id: int) -> Dict[str, Any]:
        item = ItemRepository.find_by_id(item_id)
        if not item:
            raise ValueError("Item not found")
        return item

    @staticmethod
    def create_item(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        # Validate item name
        if not data.get("item_name") or not str(data.get("item_name", "")).strip():
            raise ValueError("Item name is required")

        # Validate item type
        valid_types = {"inventory", "non_inventory", "service", "bundle"}
        item_type = data.get("item_type")
        if not item_type or item_type not in valid_types:
            raise ValueError("Invalid item type")

        # Validate accounts
        income_account_id = data.get("income_account_id")
        if not income_account_id:
            raise ValueError("Income account is required")
        income_account = AccountRepository.find_by_id(income_account_id)
        if not income_account:
            raise ValueError("Income account not found")
        if income_account.account_type != "Revenue":
            raise ValueError("Income account must be a Revenue account")

        expense_account_id = data.get("expense_account_id")
        if not expense_account_id:
            raise ValueError("Expense account is required")
        expense_account = AccountRepository.find_by_id(expense_account_id)
        if not expense_account:
            raise ValueError("Expense account not found")
        if expense_account.account_type not in ("Expense", "COGS", "Cost of Goods Sold"):
            raise ValueError("Expense account must be an Expense or COGS account")

        # For inventory items, asset account is required
        if item_type == "inventory":
            asset_account_id = data.get("asset_account_id")
            if not asset_account_id:
                raise ValueError("Asset account is required for inventory items")
            asset_account = AccountRepository.find_by_id(asset_account_id)
            if not asset_account:
                raise ValueError("Asset account not found")
            if asset_account.account_type != "Asset":
                raise ValueError("Asset account must be an Asset account")

        # Validate barcode uniqueness if provided
        if data.get("barcode"):
            existing = ItemRepository.find_by_barcode(data["barcode"])
            if existing:
                raise ValueError("Barcode already exists")

        # Validate item number if provided
        if data.get("item_number"):
            existing = ItemRepository.find_by_item_number(data["item_number"])
            if existing:
                raise ValueError("Item number already exists")

        # Validate sales price
        sales_price = float(data.get("sales_price") or 0)
        if sales_price < 0:
            raise ValueError("Sales price cannot be negative")

        return ItemRepository.create(data, user_id)

    @staticmethod
    def update_item(item_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        item = InventoryService.get_item_by_id(item_id)

        # Validate barcode if being updated
        if data.get("barcode") and data["barcode"] != item.get("barcode"):
            existing = ItemRepository.find_by_barcode(data["barcode"])
            if existing and existing.get("id") != item_id:
                raise ValueError("Barcode already exists")

        # Validate sales price if being updated
        if "sales_price" in data:
            sales_price = float(data["sales_price"] or 0)
            if sales_price < 0:
                raise ValueError("Sales price cannot be negative")

        return ItemRepository.update(item_id, data, user_id)

    @staticmethod
    def delete_item(item_id: int) -> None:
        item = InventoryService.get_item_by_id(item_id)
        ItemRepository.delete(item_id)

    @staticmethod
    def adjust_inventory(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        item = InventoryService.get_item_by_id(data.get("item_id"))

        if item.get("item_type") != "inventory":
            raise ValueError("Can only adjust inventory items")

        adjustment_type = data.get("adjustment_type")
        quantity = float(data.get("quantity") or 0)
        
        if adjustment_type == "decrease":
            qty_on_hand = float(item.get("quantity_on_hand") or 0)
            if qty_on_hand < quantity:
                raise ValueError(f"Cannot decrease by {quantity}. Current quantity: {qty_on_hand}")

        reason = data.get("reason")
        if not reason or not str(reason).strip():
            raise ValueError("Adjustment reason is required")

        return ItemRepository.record_adjustment(data, user_id)

    @staticmethod
    def get_low_stock_items() -> List[Dict[str, Any]]:
        return ItemRepository.get_low_stock_items()

    @staticmethod
    def get_inventory_value() -> float:
        return ItemRepository.get_inventory_value()

    @staticmethod
    def get_inventory_report() -> List[Dict[str, Any]]:
        return ItemRepository.get_inventory_report()

    @staticmethod
    def get_item_history(item_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        item = InventoryService.get_item_by_id(item_id)
        return ItemRepository.get_item_history(item_id, limit)


inventory_service = InventoryService()
