#!/usr/bin/env python3
"""
Customer Controller
Handles HTTP requests and responses for customer endpoints
"""

from flask import request, jsonify
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.customer_service import customer_service
from backend.middleware.error_handler import AppError


def _user_id():
    u = getattr(request, "user", None)
    return int(u["id"]) if u and isinstance(u, dict) and u.get("id") else 1


class CustomerController:
    @staticmethod
    def get_all() -> tuple:
        try:
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
                "customer_type": request.args.get("customer_type") or None,
                "is_active": is_active,
                "search": request.args.get("search") or None,
                "page": page,
                "limit": limit,
            }
            result = customer_service.get_all(filters)
            return jsonify({
                "success": True,
                "data": result["customers"],
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
    def get_by_id(customer_id: int) -> tuple:
        try:
            customer = customer_service.get_by_id(customer_id)
            return jsonify({"success": True, "data": customer}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def create() -> tuple:
        try:
            data = request.get_json() or {}
            customer = customer_service.create(data, _user_id())
            return jsonify({
                "success": True,
                "message": "Customer created successfully",
                "data": customer,
            }), 201
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def update(customer_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            customer = customer_service.update(customer_id, data, _user_id())
            return jsonify({
                "success": True,
                "message": "Customer updated successfully",
                "data": customer,
            }), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def delete(customer_id: int) -> tuple:
        try:
            customer_service.delete(customer_id)
            return jsonify({"success": True, "message": "Customer deleted successfully"}), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def toggle_status(customer_id: int) -> tuple:
        try:
            customer = customer_service.toggle_status(customer_id, _user_id())
            return jsonify({
                "success": True,
                "message": f"Customer {'activated' if customer.get('is_active') else 'deactivated'} successfully",
                "data": customer,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def search() -> tuple:
        try:
            q = request.args.get("q") or ""
            customers = customer_service.search(q)
            return jsonify({"success": True, "data": customers}), 200
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_balance(customer_id: int) -> tuple:
        try:
            balance = customer_service.get_balance(customer_id)
            return jsonify({"success": True, "data": balance}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_invoices(customer_id: int) -> tuple:
        try:
            limit = request.args.get("limit")
            limit = int(limit) if limit else 10
            invoices = customer_service.get_invoices(customer_id, limit=limit)
            return jsonify({"success": True, "data": invoices}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_statement(customer_id: int) -> tuple:
        try:
            start_s = request.args.get("start_date")
            end_s = request.args.get("end_date")
            start_date = datetime.fromisoformat(start_s.split("T")[0]) if start_s else None
            end_date = datetime.fromisoformat(end_s.split("T")[0]) if end_s else None
            statement = customer_service.get_statement(customer_id, start_date=start_date, end_date=end_date)
            return jsonify({"success": True, "data": statement}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)


customer_controller = CustomerController()
