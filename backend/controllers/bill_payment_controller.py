#!/usr/bin/env python3
"""
Bill Payment Controller
Handles HTTP requests and responses for bill payment endpoints
"""

from flask import request, jsonify
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.bill_payment_service import bill_payment_service
from backend.middleware.error_handler import AppError


def _user_id():
    u = getattr(request, "user", None)
    return int(u["id"]) if u and isinstance(u, dict) and u.get("id") else 1


class BillPaymentController:
    @staticmethod
    def get_all() -> tuple:
        try:
            filters = {
                "vendor_id": request.args.get("vendor_id"),
                "payment_method": request.args.get("payment_method"),
                "status": request.args.get("status"),
                "start_date": request.args.get("start_date"),
                "end_date": request.args.get("end_date"),
                "search": request.args.get("search"),
                "page": request.args.get("page"),
                "limit": request.args.get("limit"),
            }
            if filters["vendor_id"]:
                try:
                    filters["vendor_id"] = int(filters["vendor_id"])
                except (TypeError, ValueError):
                    filters["vendor_id"] = None
            try:
                filters["page"] = int(filters["page"]) if filters.get("page") else 1
            except (TypeError, ValueError):
                filters["page"] = 1
            try:
                filters["limit"] = min(100, max(1, int(filters["limit"]))) if filters.get("limit") else 50
            except (TypeError, ValueError):
                filters["limit"] = 50
            limit = filters.get("limit") or 50
            result = bill_payment_service.get_all(filters)
            return jsonify({
                "success": True,
                "data": result.get("payments", []),
                "pagination": {
                    "total": result.get("total", 0),
                    "page": result.get("page", 1),
                    "limit": limit,
                    "total_pages": result.get("total_pages", 1),
                },
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_by_id(payment_id: int) -> tuple:
        try:
            out = bill_payment_service.get_by_id(payment_id)
            return jsonify({"success": True, "data": out}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def create() -> tuple:
        try:
            data = request.get_json() or {}
            out = bill_payment_service.create(data, _user_id())
            return jsonify({
                "success": True,
                "message": "Bill payment created successfully",
                "data": out,
            }), 201
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def update(payment_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            out = bill_payment_service.update(payment_id, data, _user_id())
            return jsonify({
                "success": True,
                "message": "Bill payment updated successfully",
                "data": out,
            }), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def delete(payment_id: int) -> tuple:
        try:
            bill_payment_service.delete(payment_id)
            return jsonify({"success": True, "message": "Bill payment deleted successfully"}), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def void_payment(payment_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            reason = data.get("reason") or ""
            out = bill_payment_service.void_payment(payment_id, reason, _user_id())
            return jsonify({
                "success": True,
                "message": "Bill payment voided successfully",
                "data": out,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_vendor_outstanding_bills(vendor_id: int) -> tuple:
        try:
            bills = bill_payment_service.get_vendor_outstanding_bills(vendor_id)
            return jsonify({"success": True, "data": bills}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_payment_check_data(payment_id: int) -> tuple:
        try:
            check_data = bill_payment_service.get_payment_check_data(payment_id)
            return jsonify({"success": True, "data": check_data}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)


bill_payment_controller = BillPaymentController()
