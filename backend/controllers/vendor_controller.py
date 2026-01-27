#!/usr/bin/env python3
"""
Vendor Controller
Handles HTTP requests and responses for vendor endpoints
"""

from flask import request, jsonify
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.vendor_service import vendor_service
from backend.middleware.error_handler import AppError


def _user_id():
    u = getattr(request, "user", None)
    return int(u["id"]) if u and isinstance(u, dict) and u.get("id") else 1


class VendorController:
    @staticmethod
    def get_all() -> tuple:
        try:
            is_1099_raw = request.args.get("is_1099_vendor")
            is_1099 = None
            if is_1099_raw is not None:
                is_1099 = str(is_1099_raw).lower() in ("true", "1", "yes")
            is_active_raw = request.args.get("is_active")
            is_active = None
            if is_active_raw is not None:
                is_active = str(is_active_raw).lower() in ("true", "1", "yes")
            page_raw = request.args.get("page")
            limit_raw = request.args.get("limit")
            try:
                page = int(page_raw) if page_raw else 1
            except (TypeError, ValueError):
                page = 1
            try:
                limit = min(100, max(1, int(limit_raw))) if limit_raw else 50
            except (TypeError, ValueError):
                limit = 50
            filters = {
                "is_1099_vendor": is_1099,
                "is_active": is_active,
                "search": request.args.get("search") or None,
                "page": page,
                "limit": limit,
            }
            result = vendor_service.get_all(filters)
            return jsonify({
                "success": True,
                "data": result["vendors"],
                "pagination": {
                    "total": result["total"],
                    "page": result["page"],
                    "limit": limit,
                    "total_pages": result["total_pages"],
                },
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_by_id(vendor_id: int) -> tuple:
        try:
            vendor = vendor_service.get_by_id(vendor_id)
            return jsonify({"success": True, "data": vendor}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def create() -> tuple:
        try:
            data = request.get_json() or {}
            vendor = vendor_service.create(data, _user_id())
            return jsonify({
                "success": True,
                "message": "Vendor created successfully",
                "data": vendor,
            }), 201
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def update(vendor_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            vendor = vendor_service.update(vendor_id, data, _user_id())
            return jsonify({
                "success": True,
                "message": "Vendor updated successfully",
                "data": vendor,
            }), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def delete(vendor_id: int) -> tuple:
        try:
            vendor_service.delete(vendor_id)
            return jsonify({"success": True, "message": "Vendor deleted successfully"}), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def toggle_status(vendor_id: int) -> tuple:
        try:
            vendor = vendor_service.toggle_status(vendor_id, _user_id())
            return jsonify({
                "success": True,
                "message": f"Vendor {'activated' if vendor.get('is_active') else 'deactivated'} successfully",
                "data": vendor,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def search() -> tuple:
        try:
            q = request.args.get("q") or ""
            vendors = vendor_service.search(q)
            return jsonify({"success": True, "data": vendors}), 200
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_balance(vendor_id: int) -> tuple:
        try:
            balance = vendor_service.get_balance(vendor_id)
            return jsonify({"success": True, "data": balance}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_bills(vendor_id: int) -> tuple:
        try:
            limit = request.args.get("limit")
            limit = int(limit) if limit else 10
            bills = vendor_service.get_bills(vendor_id, limit=limit)
            return jsonify({"success": True, "data": bills}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_1099_vendors() -> tuple:
        try:
            vendors = vendor_service.get_1099_vendors()
            return jsonify({"success": True, "data": vendors, "count": len(vendors)}), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_statement(vendor_id: int) -> tuple:
        try:
            start_s = request.args.get("start_date")
            end_s = request.args.get("end_date")
            start_date = datetime.fromisoformat(start_s.split("T")[0]) if start_s else None
            end_date = datetime.fromisoformat(end_s.split("T")[0]) if end_s else None
            statement = vendor_service.get_statement(vendor_id, start_date=start_date, end_date=end_date)
            return jsonify({"success": True, "data": statement}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)


vendor_controller = VendorController()
