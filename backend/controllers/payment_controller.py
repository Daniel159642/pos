#!/usr/bin/env python3
"""
Payment Controller
Handles HTTP requests and responses for payment endpoints
"""

from flask import request, jsonify
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.payment_service import payment_service
from backend.middleware.error_handler import AppError


def _user_id():
    u = getattr(request, "user", None)
    return int(u["id"]) if u and isinstance(u, dict) and u.get("id") else 1


class PaymentController:
    @staticmethod
    def get_all() -> tuple:
        try:
            filters = {
                "customer_id": request.args.get("customer_id"),
                "payment_method": request.args.get("payment_method"),
                "status": request.args.get("status"),
                "start_date": request.args.get("start_date"),
                "end_date": request.args.get("end_date"),
                "search": request.args.get("search"),
                "page": request.args.get("page"),
                "limit": request.args.get("limit"),
            }
            if filters["customer_id"]:
                try:
                    filters["customer_id"] = int(filters["customer_id"])
                except (TypeError, ValueError):
                    filters["customer_id"] = None
            try:
                filters["page"] = int(filters["page"]) if filters.get("page") else 1
            except (TypeError, ValueError):
                filters["page"] = 1
            try:
                filters["limit"] = min(100, max(1, int(filters["limit"]))) if filters.get("limit") else 50
            except (TypeError, ValueError):
                filters["limit"] = 50
            limit = filters.get("limit") or 50
            result = payment_service.get_all(filters)
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
            out = payment_service.get_by_id(payment_id)
            return jsonify({"success": True, "data": out}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def create() -> tuple:
        try:
            data = request.get_json() or {}
            out = payment_service.create(data, _user_id())
            return jsonify({
                "success": True,
                "message": "Payment created successfully",
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
            out = payment_service.update(payment_id, data, _user_id())
            return jsonify({
                "success": True,
                "message": "Payment updated successfully",
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
            payment_service.delete(payment_id)
            return jsonify({"success": True, "message": "Payment deleted successfully"}), 200
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
            out = payment_service.void_payment(payment_id, reason, _user_id())
            return jsonify({
                "success": True,
                "message": "Payment voided successfully",
                "data": out,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_customer_outstanding_invoices(customer_id: int) -> tuple:
        try:
            invoices = payment_service.get_customer_outstanding_invoices(customer_id)
            return jsonify({"success": True, "data": invoices}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_payment_receipt(payment_id: int) -> tuple:
        try:
            receipt = payment_service.get_payment_receipt(payment_id)
            return jsonify({"success": True, "data": receipt}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)


payment_controller = PaymentController()
