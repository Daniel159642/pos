#!/usr/bin/env python3
"""
Invoice Controller
Handles HTTP requests and responses for invoice endpoints
"""

from flask import request, jsonify
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.invoice_service import invoice_service
from backend.middleware.error_handler import AppError


def _user_id():
    u = getattr(request, "user", None)
    return int(u["id"]) if u and isinstance(u, dict) and u.get("id") else 1


class InvoiceController:
    @staticmethod
    def get_all() -> tuple:
        try:
            filters = {
                "customer_id": request.args.get("customer_id"),
                "status": request.args.get("status"),
                "start_date": request.args.get("start_date"),
                "end_date": request.args.get("end_date"),
                "overdue_only": request.args.get("overdue_only") == "true",
                "search": request.args.get("search"),
                "page": request.args.get("page"),
                "limit": request.args.get("limit"),
            }
            if filters["customer_id"]:
                filters["customer_id"] = int(filters["customer_id"])
            if filters.get("page"):
                filters["page"] = int(filters["page"])
            if filters.get("limit"):
                filters["limit"] = min(100, max(1, int(filters["limit"])))
            limit = filters.get("limit") or 50
            result = invoice_service.get_all(filters)
            return jsonify({
                "success": True,
                "data": result.get("invoices", []),
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
    def get_by_id(invoice_id: int) -> tuple:
        try:
            out = invoice_service.get_by_id(invoice_id)
            return jsonify({"success": True, "data": out}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def create() -> tuple:
        try:
            data = request.get_json() or {}
            out = invoice_service.create(data, _user_id())
            return jsonify({
                "success": True,
                "message": "Invoice created successfully",
                "data": out,
            }), 201
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def update(invoice_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            out = invoice_service.update(invoice_id, data, _user_id())
            return jsonify({
                "success": True,
                "message": "Invoice updated successfully",
                "data": out,
            }), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def delete(invoice_id: int) -> tuple:
        try:
            invoice_service.delete(invoice_id)
            return jsonify({"success": True, "message": "Invoice deleted successfully"}), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def mark_as_sent(invoice_id: int) -> tuple:
        try:
            inv = invoice_service.mark_as_sent(invoice_id, _user_id())
            return jsonify({
                "success": True,
                "message": "Invoice marked as sent",
                "data": inv,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def void_invoice(invoice_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            reason = data.get("reason") or ""
            inv = invoice_service.void_invoice(invoice_id, reason, _user_id())
            return jsonify({
                "success": True,
                "message": "Invoice voided successfully",
                "data": inv,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_overdue() -> tuple:
        try:
            invoices = invoice_service.get_overdue()
            return jsonify({
                "success": True,
                "data": invoices,
                "count": len(invoices),
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)


invoice_controller = InvoiceController()
