#!/usr/bin/env python3
"""
Transaction Controller
Handles HTTP requests and responses for transaction endpoints
"""

from flask import request, jsonify
from typing import Dict, Any
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.transaction_service import transaction_service
from backend.middleware.error_handler import AppError


class TransactionController:
    """Controller for transaction-related endpoints"""
    
    @staticmethod
    def get_all_transactions() -> tuple:
        """Get all transactions with optional filters"""
        try:
            filters = {}
            
            if request.args.get('start_date'):
                filters['start_date'] = request.args.get('start_date')
            
            if request.args.get('end_date'):
                filters['end_date'] = request.args.get('end_date')
            
            if request.args.get('account_id'):
                try:
                    filters['account_id'] = int(request.args.get('account_id'))
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid account_id'}), 400
            
            if request.args.get('transaction_type'):
                filters['transaction_type'] = request.args.get('transaction_type')
            
            if request.args.get('is_posted') is not None:
                filters['is_posted'] = request.args.get('is_posted').lower() == 'true'
            
            if request.args.get('is_void') is not None:
                filters['is_void'] = request.args.get('is_void').lower() == 'true'
            
            if request.args.get('search'):
                filters['search'] = request.args.get('search')
            
            if request.args.get('page'):
                try:
                    filters['page'] = int(request.args.get('page'))
                except ValueError:
                    filters['page'] = 1
            else:
                filters['page'] = 1
            
            if request.args.get('limit'):
                try:
                    filters['limit'] = int(request.args.get('limit'))
                except ValueError:
                    filters['limit'] = 50
            else:
                filters['limit'] = 50
            
            result = transaction_service.get_all_transactions(filters)
            
            return jsonify({
                'success': True,
                'data': result['transactions'],
                'pagination': {
                    'total': result['total'],
                    'page': result['page'],
                    'limit': filters['limit'],
                    'total_pages': result['total_pages']
                }
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)
    
    @staticmethod
    def get_transaction_by_id(transaction_id: int) -> tuple:
        """Get transaction by ID"""
        try:
            transaction = transaction_service.get_transaction_by_id(transaction_id)
            return jsonify({
                'success': True,
                'data': transaction
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)
    
    @staticmethod
    def create_transaction() -> tuple:
        """Create a new transaction"""
        try:
            data = request.get_json() or {}
            user_id = request.headers.get('X-User-Id') or 1
            
            # Convert date string to date object if needed
            if isinstance(data.get('transaction_date'), str):
                data['transaction_date'] = datetime.fromisoformat(data['transaction_date'].split('T')[0]).date()
            
            transaction = transaction_service.create_transaction(data, user_id)
            
            return jsonify({
                'success': True,
                'message': 'Transaction created successfully',
                'data': transaction
            }), 201
        except ValueError as e:
            raise AppError(str(e), 400)
    
    @staticmethod
    def update_transaction(transaction_id: int) -> tuple:
        """Update an existing transaction"""
        try:
            data = request.get_json() or {}
            user_id = request.headers.get('X-User-Id') or 1
            
            # Convert date string to date object if needed
            if isinstance(data.get('transaction_date'), str):
                data['transaction_date'] = datetime.fromisoformat(data['transaction_date'].split('T')[0]).date()
            
            transaction = transaction_service.update_transaction(transaction_id, data, user_id)
            
            return jsonify({
                'success': True,
                'message': 'Transaction updated successfully',
                'data': transaction
            }), 200
        except ValueError as e:
            if 'not found' in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
    
    @staticmethod
    def delete_transaction(transaction_id: int) -> tuple:
        """Delete a transaction"""
        try:
            transaction_service.delete_transaction(transaction_id)
            return jsonify({
                'success': True,
                'message': 'Transaction deleted successfully'
            }), 200
        except ValueError as e:
            if 'not found' in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
    
    @staticmethod
    def post_transaction(transaction_id: int) -> tuple:
        """Post a transaction"""
        try:
            user_id = request.headers.get('X-User-Id') or 1
            result = transaction_service.post_transaction(transaction_id, user_id)
            
            return jsonify({
                'success': True,
                'message': 'Transaction posted successfully',
                'data': result
            }), 200
        except ValueError as e:
            if 'not found' in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
    
    @staticmethod
    def unpost_transaction(transaction_id: int) -> tuple:
        """Unpost a transaction"""
        try:
            user_id = request.headers.get('X-User-Id') or 1
            result = transaction_service.unpost_transaction(transaction_id, user_id)
            
            return jsonify({
                'success': True,
                'message': 'Transaction unposted successfully',
                'data': result
            }), 200
        except ValueError as e:
            if 'not found' in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
    
    @staticmethod
    def void_transaction(transaction_id: int) -> tuple:
        """Void a transaction"""
        try:
            data = request.get_json() or {}
            reason = data.get('reason', '')
            user_id = request.headers.get('X-User-Id') or 1
            
            result = transaction_service.void_transaction(transaction_id, reason, user_id)
            
            return jsonify({
                'success': True,
                'message': 'Transaction voided successfully',
                'data': result
            }), 200
        except ValueError as e:
            if 'not found' in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
    
    @staticmethod
    def get_general_ledger() -> tuple:
        """Get general ledger"""
        try:
            account_id = None
            if request.args.get('account_id'):
                try:
                    account_id = int(request.args.get('account_id'))
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid account_id'}), 400
            
            start_date = None
            if request.args.get('start_date'):
                try:
                    start_date = datetime.fromisoformat(request.args.get('start_date').split('T')[0]).date()
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
            
            end_date = None
            if request.args.get('end_date'):
                try:
                    end_date = datetime.fromisoformat(request.args.get('end_date').split('T')[0]).date()
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
            
            ledger = transaction_service.get_general_ledger(account_id, start_date, end_date)
            
            return jsonify({
                'success': True,
                'data': ledger
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)
    
    @staticmethod
    def get_account_ledger(account_id: int) -> tuple:
        """Get account ledger with running balance"""
        try:
            start_date = None
            if request.args.get('start_date'):
                try:
                    start_date = datetime.fromisoformat(request.args.get('start_date').split('T')[0]).date()
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
            
            end_date = None
            if request.args.get('end_date'):
                try:
                    end_date = datetime.fromisoformat(request.args.get('end_date').split('T')[0]).date()
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
            
            ledger = transaction_service.get_account_ledger(account_id, start_date, end_date)
            
            return jsonify({
                'success': True,
                'data': ledger
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)


# Singleton instance
transaction_controller = TransactionController()
