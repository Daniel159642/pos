#!/usr/bin/env python3
"""
Invoice Service Layer
Business logic for invoice management
"""

from typing import Optional, Dict, Any, List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.invoice_model import InvoiceRepository
from backend.models.customer_model import CustomerRepository


class InvoiceService:
    @staticmethod
    def get_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return InvoiceRepository.find_all(filters or {})

    @staticmethod
    def get_by_id(invoice_id: int) -> Dict[str, Any]:
        out = InvoiceRepository.find_by_id(invoice_id)
        if not out:
            raise ValueError("Invoice not found")
        return out

    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        customer = CustomerRepository.find_by_id(data.get("customer_id"))
        if not customer:
            raise ValueError("Customer not found")
        if not customer.get("is_active", True):
            raise ValueError("Cannot create invoice for inactive customer")

        lines = data.get("lines") or []
        if not lines:
            raise ValueError("Invoice must have at least one line item")
        for ln in lines:
            qty = float(ln.get("quantity") or 0)
            if qty <= 0:
                raise ValueError("Line item quantity must be greater than 0")
            up = float(ln.get("unit_price") or 0)
            if up < 0:
                raise ValueError("Line item unit price cannot be negative")

        balance = CustomerRepository.get_balance(data["customer_id"])
        rough_total = sum(float(l.get("quantity") or 0) * float(l.get("unit_price") or 0) for l in lines)
        credit_limit = float(customer.get("credit_limit") or 0)
        balance_due = float(balance.get("balance_due") or 0)
        if credit_limit and credit_limit > 0:
            if balance_due + rough_total > credit_limit:
                raise ValueError(
                    f"Invoice would exceed customer credit limit. "
                    f"Current: ${balance_due:.2f}, Limit: ${credit_limit:.2f}"
                )

        return InvoiceRepository.create(data, user_id)

    @staticmethod
    def update(invoice_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        out = InvoiceService.get_by_id(invoice_id)
        inv = out["invoice"]
        if inv.get("status") == "paid":
            raise ValueError("Cannot modify paid invoice")
        if inv.get("status") == "void":
            raise ValueError("Cannot modify voided invoice")
        if float(inv.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot modify invoice with payments applied. Reverse payments first.")

        return InvoiceRepository.update(invoice_id, data, user_id)

    @staticmethod
    def delete(invoice_id: int) -> None:
        out = InvoiceService.get_by_id(invoice_id)
        inv = out["invoice"]
        if inv.get("status") == "paid":
            raise ValueError("Cannot delete paid invoice")
        if float(inv.get("amount_paid") or 0) > 0:
            raise ValueError("Cannot delete invoice with payments applied")
        InvoiceRepository.delete(invoice_id)

    @staticmethod
    def mark_as_sent(invoice_id: int, user_id: int) -> Dict[str, Any]:
        out = InvoiceService.get_by_id(invoice_id)
        if out["invoice"].get("status") == "void":
            raise ValueError("Cannot send voided invoice")
        return InvoiceRepository.mark_as_sent(invoice_id, user_id)

    @staticmethod
    def void_invoice(invoice_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        r = (reason or "").strip()
        if not r:
            raise ValueError("Void reason is required")
        if len(r) > 500:
            raise ValueError("Void reason must be at most 500 characters")
        return InvoiceRepository.void_invoice(invoice_id, r, user_id)

    @staticmethod
    def get_by_customer(customer_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        return InvoiceRepository.find_by_customer(customer_id, limit=limit)

    @staticmethod
    def get_overdue() -> List[Dict[str, Any]]:
        return InvoiceRepository.find_overdue()

    @staticmethod
    def get_by_status(status: str) -> List[Dict[str, Any]]:
        valid = ["draft", "sent", "viewed", "partial", "paid", "overdue", "void"]
        if status not in valid:
            raise ValueError("Invalid invoice status")
        return InvoiceRepository.get_by_status(status)

    @staticmethod
    def update_status(invoice_id: int) -> Dict[str, Any]:
        InvoiceService.get_by_id(invoice_id)
        return InvoiceRepository.update_status(invoice_id)

    @staticmethod
    def generate_invoice_pdf(invoice_id: int):
        raise NotImplementedError("PDF generation not yet implemented")

    @staticmethod
    def send_invoice_email(invoice_id: int, recipient_email: Optional[str] = None):
        raise NotImplementedError("Email sending not yet implemented")


invoice_service = InvoiceService()
