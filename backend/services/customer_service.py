#!/usr/bin/env python3
"""
Customer Service Layer
Business logic for customer management
"""

from typing import Optional, Dict, Any, List
from datetime import date, datetime
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.customer_model import CustomerRepository

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class CustomerService:
    @staticmethod
    def get_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return CustomerRepository.find_all(filters or {})

    @staticmethod
    def get_by_id(customer_id: int) -> Dict[str, Any]:
        c = CustomerRepository.find_by_id(customer_id)
        if not c:
            raise ValueError("Customer not found")
        return c

    @staticmethod
    def get_by_number(customer_number: str) -> Dict[str, Any]:
        c = CustomerRepository.find_by_customer_number(customer_number)
        if not c:
            raise ValueError("Customer not found")
        return c

    @staticmethod
    def _validate_email(email: str) -> None:
        if not email or not email.strip():
            return
        if not EMAIL_RE.match(email.strip()):
            raise ValueError("Invalid email format")

    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        ct = data.get("customer_type", "individual")
        if ct not in ("individual", "business"):
            raise ValueError("Invalid customer type")

        if ct == "business" and not (data.get("company_name") or "").strip():
            raise ValueError("Company name is required for business customers")
        if ct == "individual":
            if not (data.get("first_name") or "").strip():
                raise ValueError("First name is required for individual customers")
            if not (data.get("last_name") or "").strip():
                raise ValueError("Last name is required for individual customers")

        email = (data.get("email") or "").strip()
        if email:
            CustomerService._validate_email(email)
            if CustomerRepository.email_exists(email):
                raise ValueError("Email already exists")

        if data.get("customer_number"):
            if CustomerRepository.find_by_customer_number(data["customer_number"]):
                raise ValueError("Customer number already exists")

        terms_days = data.get("payment_terms_days")
        if terms_days is not None and (not isinstance(terms_days, (int, float)) or terms_days < 0 or terms_days > 365):
            raise ValueError("Payment terms days must be between 0 and 365")

        return CustomerRepository.create(data, user_id)

    @staticmethod
    def update(customer_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        CustomerService.get_by_id(customer_id)

        email = (data.get("email") or "").strip()
        if email:
            CustomerService._validate_email(email)
            if CustomerRepository.email_exists(email, exclude_id=customer_id):
                raise ValueError("Email already exists")

        terms_days = data.get("payment_terms_days")
        if terms_days is not None and (not isinstance(terms_days, (int, float)) or terms_days < 0 or terms_days > 365):
            raise ValueError("Payment terms days must be between 0 and 365")

        return CustomerRepository.update(customer_id, data, user_id)

    @staticmethod
    def delete(customer_id: int) -> None:
        CustomerService.get_by_id(customer_id)
        CustomerRepository.delete(customer_id)

    @staticmethod
    def toggle_status(customer_id: int, user_id: int) -> Dict[str, Any]:
        return CustomerRepository.toggle_status(customer_id, user_id)

    @staticmethod
    def search(term: str, limit: int = 20) -> List[Dict[str, Any]]:
        t = (term or "").strip()
        if len(t) < 2:
            raise ValueError("Search term must be at least 2 characters")
        return CustomerRepository.search(t, limit=limit)

    @staticmethod
    def get_balance(customer_id: int) -> Dict[str, Any]:
        CustomerService.get_by_id(customer_id)
        return CustomerRepository.get_balance(customer_id)

    @staticmethod
    def get_invoices(customer_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        CustomerService.get_by_id(customer_id)
        return CustomerRepository.get_invoices(customer_id, limit=limit)

    @staticmethod
    def get_statement(
        customer_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        customer = CustomerService.get_by_id(customer_id)
        balance = CustomerService.get_balance(customer_id)
        invoices = CustomerRepository.get_invoices(customer_id, limit=100)

        start_d = start_date.date() if isinstance(start_date, datetime) else start_date
        end_d = end_date.date() if isinstance(end_date, datetime) else end_date

        def _to_date(v):
            if v is None:
                return None
            if hasattr(v, "year"):
                return v
            s = str(v)[:10]
            return datetime.strptime(s, "%Y-%m-%d").date() if s else None

        filtered = invoices
        if start_d or end_d:
            filtered = []
            for inv in invoices:
                d = _to_date(inv.get("invoice_date"))
                if d is None:
                    continue
                if start_d and d < start_d:
                    continue
                if end_d and d > end_d:
                    continue
                filtered.append(inv)

        return {
            "customer": customer,
            "balance": balance,
            "invoices": filtered,
            "start_date": start_d.isoformat() if start_d else None,
            "end_date": end_d.isoformat() if end_d else None,
        }


customer_service = CustomerService()
