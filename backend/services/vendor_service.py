#!/usr/bin/env python3
"""
Vendor Service Layer
Business logic for vendor (supplier) management
"""

from typing import Optional, Dict, Any, List
from datetime import date, datetime
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.vendor_model import VendorRepository

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
TAX_ID_RE = re.compile(r"^\d{2}-\d{7}$|^\d{3}-\d{2}-\d{4}$")


class VendorService:
    @staticmethod
    def get_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return VendorRepository.find_all(filters or {})

    @staticmethod
    def get_by_id(vendor_id: int) -> Dict[str, Any]:
        v = VendorRepository.find_by_id(vendor_id)
        if not v:
            raise ValueError("Vendor not found")
        return v

    @staticmethod
    def get_by_number(vendor_number: str) -> Dict[str, Any]:
        v = VendorRepository.find_by_vendor_number(vendor_number)
        if not v:
            raise ValueError("Vendor not found")
        return v

    @staticmethod
    def _validate_email(email: str) -> None:
        if not email or not email.strip():
            return
        if not EMAIL_RE.match(email.strip()):
            raise ValueError("Invalid email format")

    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        name = (data.get("vendor_name") or "").strip()
        if not name:
            raise ValueError("Vendor name is required")

        email = (data.get("email") or "").strip()
        if email:
            VendorService._validate_email(email)
            if VendorRepository.email_exists(email):
                raise ValueError("Email already exists")

        if data.get("vendor_number"):
            if VendorRepository.find_by_vendor_number(data["vendor_number"]):
                raise ValueError("Vendor number already exists")

        terms_days = data.get("payment_terms_days")
        if terms_days is not None and (
            not isinstance(terms_days, (int, float)) or terms_days < 0 or terms_days > 365
        ):
            raise ValueError("Payment terms days must be between 0 and 365")

        if data.get("is_1099_vendor") and data.get("tax_id"):
            tid = (data.get("tax_id") or "").strip()
            if tid and not TAX_ID_RE.match(tid):
                raise ValueError("Invalid tax ID format. Use XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)")

        return VendorRepository.create(data, user_id)

    @staticmethod
    def update(vendor_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        VendorService.get_by_id(vendor_id)

        email = (data.get("email") or "").strip()
        if email:
            VendorService._validate_email(email)
            if VendorRepository.email_exists(email, exclude_id=vendor_id):
                raise ValueError("Email already exists")

        terms_days = data.get("payment_terms_days")
        if terms_days is not None and (
            not isinstance(terms_days, (int, float)) or terms_days < 0 or terms_days > 365
        ):
            raise ValueError("Payment terms days must be between 0 and 365")

        vendor = VendorRepository.find_by_id(vendor_id)
        is_1099 = data.get("is_1099_vendor")
        if is_1099 is None and vendor:
            is_1099 = vendor.get("is_1099_vendor")
        tid = (data.get("tax_id") or (vendor or {}).get("tax_id") or "").strip()
        if is_1099 and tid and not TAX_ID_RE.match(tid):
            raise ValueError("Invalid tax ID format. Use XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)")

        return VendorRepository.update(vendor_id, data, user_id)

    @staticmethod
    def delete(vendor_id: int) -> None:
        VendorService.get_by_id(vendor_id)
        VendorRepository.delete(vendor_id)

    @staticmethod
    def toggle_status(vendor_id: int, user_id: int) -> Dict[str, Any]:
        return VendorRepository.toggle_status(vendor_id, user_id)

    @staticmethod
    def search(term: str, limit: int = 20) -> List[Dict[str, Any]]:
        t = (term or "").strip()
        if len(t) < 2:
            raise ValueError("Search term must be at least 2 characters")
        return VendorRepository.search(t, limit=limit)

    @staticmethod
    def get_balance(vendor_id: int) -> Dict[str, Any]:
        VendorService.get_by_id(vendor_id)
        return VendorRepository.get_balance(vendor_id)

    @staticmethod
    def get_bills(vendor_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        VendorService.get_by_id(vendor_id)
        return VendorRepository.get_bills(vendor_id, limit=limit)

    @staticmethod
    def get_1099_vendors() -> List[Dict[str, Any]]:
        return VendorRepository.get_1099_vendors()

    @staticmethod
    def get_statement(
        vendor_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        vendor = VendorService.get_by_id(vendor_id)
        balance = VendorRepository.get_balance(vendor_id)
        bills = VendorRepository.get_bills(vendor_id, limit=100)

        start_d = start_date.date() if isinstance(start_date, datetime) else start_date
        end_d = end_date.date() if isinstance(end_date, datetime) else end_date

        def _to_date(v):
            if v is None:
                return None
            if hasattr(v, "year"):
                return v
            s = str(v)[:10]
            return datetime.strptime(s, "%Y-%m-%d").date() if s else None

        filtered = bills
        if start_d or end_d:
            filtered = []
            for b in bills:
                d = _to_date(b.get("bill_date"))
                if d is None:
                    continue
                if start_d and d < start_d:
                    continue
                if end_d and d > end_d:
                    continue
                filtered.append(b)

        return {
            "vendor": vendor,
            "balance": balance,
            "bills": filtered,
            "start_date": start_d.isoformat() if start_d else None,
            "end_date": end_d.isoformat() if end_d else None,
        }


vendor_service = VendorService()
