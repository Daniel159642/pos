#!/usr/bin/env python3
"""
Bill Payment Service Layer
Business logic for vendor bill payment management
"""

from typing import Optional, Dict, Any, List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.bill_payment_model import BillPaymentRepository
from backend.models.vendor_model import VendorRepository
from backend.models.bill_model import BillRepository
from backend.models.account_model import AccountRepository


class BillPaymentService:
    @staticmethod
    def get_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return BillPaymentRepository.find_all(filters or {})

    @staticmethod
    def get_by_id(payment_id: int) -> Dict[str, Any]:
        out = BillPaymentRepository.find_by_id(payment_id)
        if not out:
            raise ValueError("Payment not found")
        return out

    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        vendor = VendorRepository.find_by_id(data.get("vendor_id"))
        if not vendor:
            raise ValueError("Vendor not found")
        if not vendor.get("is_active", True):
            raise ValueError("Cannot create payment for inactive vendor")

        amount = float(data.get("payment_amount") or 0)
        if amount <= 0:
            raise ValueError("Payment amount must be greater than 0")

        method = (data.get("payment_method") or "other").strip().lower()
        valid = {"check", "ach", "wire", "credit_card", "cash", "other"}
        if method not in valid:
            raise ValueError("Invalid payment method")

        paid_from_id = data.get("paid_from_account_id")
        if not paid_from_id:
            raise ValueError("Paid from account is required")
        acc = AccountRepository.find_by_id(paid_from_id)
        if not acc:
            raise ValueError("Paid from account not found")
        if acc.account_type != "Asset":
            raise ValueError("Paid from account must be an Asset account (cash or bank)")
        if not getattr(acc, "is_active", True):
            raise ValueError("Paid from account is inactive")

        applications = data.get("applications") or []
        if not applications:
            raise ValueError("Payment must be applied to at least one bill")

        total_applied = sum(float(a.get("amount_applied") or 0) for a in applications)
        if total_applied > amount:
            raise ValueError("Total amount applied cannot exceed payment amount")

        for app in applications:
            amt = float(app.get("amount_applied") or 0)
            if amt <= 0:
                raise ValueError("Each application must have an amount_applied greater than 0")

        return BillPaymentRepository.create(data, user_id)

    @staticmethod
    def update(payment_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        return BillPaymentRepository.update(payment_id, data, user_id)

    @staticmethod
    def delete(payment_id: int) -> None:
        BillPaymentRepository.delete(payment_id)

    @staticmethod
    def void_payment(payment_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        r = (reason or "").strip()
        if not r:
            raise ValueError("Void reason is required")
        if len(r) > 500:
            raise ValueError("Void reason must be at most 500 characters")
        return BillPaymentRepository.void_payment(payment_id, r, user_id)

    @staticmethod
    def get_vendor_payments(vendor_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        vendor = VendorRepository.find_by_id(vendor_id)
        if not vendor:
            raise ValueError("Vendor not found")
        return BillPaymentRepository.find_by_vendor(vendor_id, limit=limit)

    @staticmethod
    def get_vendor_outstanding_bills(vendor_id: int) -> List[Dict[str, Any]]:
        vendor = VendorRepository.find_by_id(vendor_id)
        if not vendor:
            raise ValueError("Vendor not found")
        return BillPaymentRepository.get_vendor_outstanding_bills(vendor_id)

    @staticmethod
    def get_payment_check_data(payment_id: int) -> Dict[str, Any]:
        out = BillPaymentService.get_by_id(payment_id)
        total_applied = sum(float(a.get("amount_applied") or 0) for a in out.get("applications") or [])
        payment = out.get("payment") or {}
        amount = float(payment.get("payment_amount") or 0)
        dollars = int(amount)
        cents = int(round((amount - dollars) * 100))
        amount_text = f"{dollars} and {cents}/100 dollars"
        return {
            "payment": payment,
            "vendor": out.get("vendor"),
            "applications": out.get("applications"),
            "applied_bills": out.get("applied_bills"),
            "total_applied": total_applied,
            "payment_amount_text": amount_text,
        }


bill_payment_service = BillPaymentService()
