#!/usr/bin/env python3
"""
Bill Controller
Handles HTTP requests and responses for bill endpoints
"""

from flask import request, jsonify
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.bill_service import BillService
from backend.middleware.error_handler import AppError


def _user_id():
    u = getattr(request, "user", None)
    return int(u["id"]) if u and isinstance(u, dict) and u.get("id") else 1


class BillController:
    @staticmethod
    def get_all() -> tuple:
        try:
            filters = {
                "vendor_id": request.args.get("vendor_id"),
                "status": request.args.get("status"),
                "start_date": request.args.get("start_date"),
                "end_date": request.args.get("end_date"),
                "overdue_only": request.args.get("overdue_only") == "true",
                "search": request.args.get("search"),
                "page": request.args.get("page"),
                "limit": request.args.get("limit"),
            }
            if filters["vendor_id"]:
                filters["vendor_id"] = int(filters["vendor_id"])
            if filters.get("page"):
                filters["page"] = int(filters["page"])
            if filters.get("limit"):
                filters["limit"] = min(100, max(1, int(filters["limit"])))
            limit = filters.get("limit") or 50
            result = BillService.get_all(filters)
            return jsonify({
                "success": True,
                "data": result.get("bills", []),
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
    def get_by_id(bill_id: int) -> tuple:
        try:
            out = BillService.get_by_id(bill_id)
            return jsonify({"success": True, "data": out}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def create() -> tuple:
        try:
            data = request.get_json() or {}
            out = BillService.create(data, _user_id())
            return jsonify({
                "success": True,
                "message": "Bill created successfully",
                "data": out,
            }), 201
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def update(bill_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            out = BillService.update(bill_id, data, _user_id())
            return jsonify({
                "success": True,
                "message": "Bill updated successfully",
                "data": out,
            }), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def delete(bill_id: int) -> tuple:
        try:
            BillService.delete(bill_id, _user_id())
            return jsonify({"success": True, "message": "Bill deleted successfully"}), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def void_bill(bill_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            reason = data.get("reason") or ""
            bill = BillService.void_bill(bill_id, reason, _user_id())
            return jsonify({
                "success": True,
                "message": "Bill voided successfully",
                "data": bill,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_overdue() -> tuple:
        try:
            bills = BillService.get_overdue()
            return jsonify({
                "success": True,
                "data": bills,
                "count": len(bills),
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)


bill_controller = BillController()
