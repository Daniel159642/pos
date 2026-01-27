#!/usr/bin/env python3
"""
Bill Service Layer
Business logic for bill/expense management
"""

from typing import Optional, Dict, Any, List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.bill_model import BillRepository
from backend.models.vendor_model import VendorRepository
from backend.models.account_model import AccountRepository


class BillService:
    @staticmethod
    def get_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return BillRepository.find_all(filters or {})

    @staticmethod
    def get_by_id(bill_id: int) -> Dict[str, Any]:
        out = BillRepository.find_by_id(bill_id)
        if not out:
            raise ValueError("Bill not found")
        return out

    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        vendor = VendorRepository.find_by_id(data.get("vendor_id"))
        if not vendor:
            raise ValueError("Vendor not found")
        if not vendor.get("is_active", True):
            raise ValueError("Cannot create bill for inactive vendor")

        lines = data.get("lines") or []
        if not lines:
            raise ValueError("Bill must have at least one line item")

        for ln in lines:
            qty = float(ln.get("quantity") or 0)
            if qty <= 0:
                raise ValueError("Line item quantity must be greater than 0")
            uc = float(ln.get("unit_cost") or 0)
            if uc < 0:
                raise ValueError("Line item unit cost cannot be negative")
            if not (ln.get("description") or "").strip():
                raise ValueError("Each line must have a description")

            acc = AccountRepository.find_by_id(ln.get("account_id"))
            if not acc:
                raise ValueError(f"Account {ln.get('account_id')} not found")
            atype = (acc.account_type or "").strip()
            if atype not in ("Expense", "COGS", "Cost of Goods Sold"):
                raise ValueError(
                    f'Account "{acc.account_name}" must be an Expense or COGS account'
                )

            if ln.get("billable") and not ln.get("customer_id"):
                raise ValueError("Billable expenses must have a customer assigned")

        return BillRepository.create(data, user_id)

    @staticmethod
    def update(bill_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        out = BillService.get_by_id(bill_id)
        bill = out["bill"]
        if bill.get("status") == "paid":
            raise ValueError("Cannot modify paid bill")
        if bill.get("status") == "void":
            raise ValueError("Cannot modify voided bill")
        if float(bill.get("amount_paid") or 0) > 0:
            raise ValueError(
                "Cannot modify bill with payments applied. Reverse payments first."
            )

        lines = data.get("lines")
        if lines is not None:
            if not lines:
                raise ValueError("Bill must have at least one line item")
            for ln in lines:
                qty = float(ln.get("quantity") or 0)
                if qty <= 0:
                    raise ValueError("Line item quantity must be greater than 0")
                uc = float(ln.get("unit_cost") or 0)
                if uc < 0:
                    raise ValueError("Line item unit cost cannot be negative")
                if not (ln.get("description") or "").strip():
                    raise ValueError("Each line must have a description")
                acc = AccountRepository.find_by_id(ln.get("account_id"))
                if not acc:
                    raise ValueError(f"Account {ln.get('account_id')} not found")
                atype = (acc.account_type or "").strip()
                if atype not in ("Expense", "COGS", "Cost of Goods Sold"):
                    raise ValueError(
                        f'Account "{acc.account_name}" must be an Expense or COGS account'
                    )
                if ln.get("billable") and not ln.get("customer_id"):
                    raise ValueError("Billable expenses must have a customer assigned")

        return BillRepository.update(bill_id, data, user_id)

    @staticmethod
    def delete(bill_id: int, user_id: int = 1) -> None:
        out = BillService.get_by_id(bill_id)
        bill = out["bill"]
        if bill.get("status") == "paid":
            raise ValueError("Cannot delete paid bill")
        if float(bill.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot delete bill with payments applied")
        BillRepository.delete(bill_id, user_id)

    @staticmethod
    def void_bill(bill_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        r = (reason or "").strip()
        if not r:
            raise ValueError("Void reason is required")
        if len(r) > 500:
            raise ValueError("Void reason must be at most 500 characters")
        return BillRepository.void_bill(bill_id, r, user_id)

    @staticmethod
    def get_by_vendor(vendor_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        return BillRepository.find_by_vendor(vendor_id, limit=limit)

    @staticmethod
    def get_overdue() -> List[Dict[str, Any]]:
        return BillRepository.find_overdue()

    @staticmethod
    def get_by_status(status: str) -> List[Dict[str, Any]]:
        valid = ["draft", "open", "partial", "paid", "void"]
        if status not in valid:
            raise ValueError("Invalid bill status")
        return BillRepository.get_by_status(status)

    @staticmethod
    def update_status(bill_id: int) -> Dict[str, Any]:
        BillService.get_by_id(bill_id)
        return BillRepository.update_status(bill_id)
