#!/usr/bin/env python3
"""
Payment Service Layer
Business logic for customer payment management
"""

from typing import Optional, Dict, Any, List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.payment_model import PaymentRepository
from backend.models.customer_model import CustomerRepository
from backend.models.account_model import AccountRepository


class PaymentService:
    @staticmethod
    def get_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return PaymentRepository.find_all(filters or {})

    @staticmethod
    def get_by_id(payment_id: int) -> Dict[str, Any]:
        out = PaymentRepository.find_by_id(payment_id)
        if not out:
            raise ValueError("Payment not found")
        return out

    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        customer = CustomerRepository.find_by_id(data.get("customer_id"))
        if not customer:
            raise ValueError("Customer not found")
        if not customer.get("is_active", True):
            raise ValueError("Cannot create payment for inactive customer")

        amount = float(data.get("payment_amount") or 0)
        if amount <= 0:
            raise ValueError("Payment amount must be greater than 0")

        method = (data.get("payment_method") or "other").strip().lower()
        valid = {"cash", "check", "credit_card", "debit_card", "bank_transfer", "ach", "other"}
        if method not in valid:
            raise ValueError("Invalid payment method")

        deposit_id = data.get("deposit_to_account_id")
        if not deposit_id:
            raise ValueError("Deposit account is required")
        acc = AccountRepository.find_by_id(deposit_id)
        if not acc:
            raise ValueError("Deposit account not found")
        if acc.account_type != "Asset":
            raise ValueError("Deposit account must be an Asset account (cash or bank)")
        if not getattr(acc, "is_active", True):
            raise ValueError("Deposit account is inactive")

        applications = data.get("applications") or []
        if not applications:
            raise ValueError("Payment must be applied to at least one invoice")

        total_applied = sum(float(a.get("amount_applied") or 0) for a in applications)
        if total_applied > amount:
            raise ValueError("Total amount applied cannot exceed payment amount")

        for app in applications:
            amt = float(app.get("amount_applied") or 0)
            if amt <= 0:
                raise ValueError("Each application must have an amount_applied greater than 0")

        return PaymentRepository.create(data, user_id)

    @staticmethod
    def update(payment_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        return PaymentRepository.update(payment_id, data, user_id)

    @staticmethod
    def delete(payment_id: int) -> None:
        PaymentRepository.delete(payment_id)

    @staticmethod
    def void_payment(payment_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        r = (reason or "").strip()
        if not r:
            raise ValueError("Void reason is required")
        if len(r) > 500:
            raise ValueError("Void reason must be at most 500 characters")
        return PaymentRepository.void_payment(payment_id, r, user_id)

    @staticmethod
    def get_customer_payments(customer_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        customer = CustomerRepository.find_by_id(customer_id)
        if not customer:
            raise ValueError("Customer not found")
        return PaymentRepository.find_by_customer(customer_id, limit=limit)

    @staticmethod
    def get_customer_outstanding_invoices(customer_id: int) -> List[Dict[str, Any]]:
        customer = CustomerRepository.find_by_id(customer_id)
        if not customer:
            raise ValueError("Customer not found")
        return PaymentRepository.get_customer_outstanding_invoices(customer_id)

    @staticmethod
    def get_payment_receipt(payment_id: int) -> Dict[str, Any]:
        out = PaymentService.get_by_id(payment_id)
        total_applied = sum(float(a.get("amount_applied") or 0) for a in out.get("applications") or [])
        return {
            "payment": out.get("payment"),
            "customer": out.get("customer"),
            "applications": out.get("applications"),
            "applied_invoices": out.get("applied_invoices"),
            "total_applied": total_applied,
        }


payment_service = PaymentService()
