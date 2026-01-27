#!/usr/bin/env python3
"""
Inventory Controller
Handles HTTP requests and responses for inventory endpoints
"""

from flask import request, jsonify
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.inventory_service import inventory_service
from backend.middleware.error_handler import AppError


def _user_id():
    u = getattr(request, "user", None)
    return int(u["id"]) if u and isinstance(u, dict) and u.get("id") else 1


class InventoryController:
    @staticmethod
    def get_all_items() -> tuple:
        try:
            filters = {
                "item_type": request.args.get("item_type"),
                "is_active": request.args.get("is_active"),
                "low_stock": request.args.get("low_stock") == "true",
                "category_id": request.args.get("category_id"),
                "search": request.args.get("search"),
                "page": request.args.get("page"),
                "limit": request.args.get("limit"),
            }
            if filters["is_active"] is not None:
                filters["is_active"] = filters["is_active"] == "true"
            if filters["category_id"]:
                try:
                    filters["category_id"] = int(filters["category_id"])
                except (TypeError, ValueError):
                    filters["category_id"] = None
            try:
                filters["page"] = int(filters["page"]) if filters.get("page") else 1
            except (TypeError, ValueError):
                filters["page"] = 1
            try:
                filters["limit"] = min(100, max(1, int(filters["limit"]))) if filters.get("limit") else 50
            except (TypeError, ValueError):
                filters["limit"] = 50
            limit = filters.get("limit") or 50
            result = inventory_service.get_all_items(filters)
            return jsonify({
                "success": True,
                "data": result.get("items", []),
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
    def get_item_by_id(item_id: int) -> tuple:
        try:
            item = inventory_service.get_item_by_id(item_id)
            return jsonify({"success": True, "data": item}), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def create_item() -> tuple:
        try:
            data = request.get_json() or {}
            item = inventory_service.create_item(data, _user_id())
            return jsonify({
                "success": True,
                "message": "Item created successfully",
                "data": item,
            }), 201
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def update_item(item_id: int) -> tuple:
        try:
            data = request.get_json() or {}
            item = inventory_service.update_item(item_id, data, _user_id())
            return jsonify({
                "success": True,
                "message": "Item updated successfully",
                "data": item,
            }), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def delete_item(item_id: int) -> tuple:
        try:
            inventory_service.delete_item(item_id)
            return jsonify({"success": True, "message": "Item deleted successfully"}), 200
        except ValueError as e:
            if "not found" in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def adjust_inventory() -> tuple:
        try:
            data = request.get_json() or {}
            transaction = inventory_service.adjust_inventory(data, _user_id())
            return jsonify({
                "success": True,
                "message": "Inventory adjusted successfully",
                "data": transaction,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 400)
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_low_stock_items() -> tuple:
        try:
            items = inventory_service.get_low_stock_items()
            return jsonify({
                "success": True,
                "data": items,
                "count": len(items),
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_inventory_value() -> tuple:
        try:
            value = inventory_service.get_inventory_value()
            return jsonify({
                "success": True,
                "data": {"total_inventory_value": value},
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_inventory_report() -> tuple:
        try:
            report = inventory_service.get_inventory_report()
            return jsonify({
                "success": True,
                "data": report,
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_item_history(item_id: int) -> tuple:
        try:
            limit = request.args.get("limit")
            limit_int = int(limit) if limit else 50
            history = inventory_service.get_item_history(item_id, limit_int)
            return jsonify({
                "success": True,
                "data": history,
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)
        except Exception as e:
            raise AppError(str(e), 500)


inventory_controller = InventoryController()
