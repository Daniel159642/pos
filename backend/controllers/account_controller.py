#!/usr/bin/env python3
"""
Account Controller
Handles HTTP requests and responses for account endpoints
"""

from flask import request, jsonify
from typing import Dict, Any
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.account_service import account_service
from backend.middleware.error_handler import AppError


class AccountController:
    """Controller for account-related endpoints"""
    
    @staticmethod
    def get_all_accounts() -> tuple:
        """Get all accounts with optional filters"""
        try:
            filters = {}
            
            if request.args.get('account_type'):
                filters['account_type'] = request.args.get('account_type')
            
            if request.args.get('is_active') is not None:
                filters['is_active'] = request.args.get('is_active').lower() == 'true'
            
            if request.args.get('parent_account_id'):
                try:
                    filters['parent_account_id'] = int(request.args.get('parent_account_id'))
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid parent_account_id'}), 400
            
            if request.args.get('search'):
                filters['search'] = request.args.get('search')
            
            accounts = account_service.get_all_accounts(filters)
            
            return jsonify({
                'success': True,
                'data': [account.to_dict() for account in accounts],
                'count': len(accounts)
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)
    
    @staticmethod
    def get_account_by_id(account_id: int) -> tuple:
        """Get account by ID"""
        try:
            account = account_service.get_account_by_id(account_id)
            return jsonify({
                'success': True,
                'data': account.to_dict()
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)
    
    @staticmethod
    def create_account() -> tuple:
        """Create a new account"""
        try:
            data = request.get_json() or {}
            user_id = request.headers.get('X-User-Id') or 1  # Get from auth middleware later
            
            account = account_service.create_account(data, user_id)
            
            return jsonify({
                'success': True,
                'message': 'Account created successfully',
                'data': account.to_dict()
            }), 201
        except ValueError as e:
            raise AppError(str(e), 400)
    
    @staticmethod
    def update_account(account_id: int) -> tuple:
        """Update an existing account"""
        try:
            data = request.get_json() or {}
            user_id = request.headers.get('X-User-Id') or 1
            
            account = account_service.update_account(account_id, data, user_id)
            
            return jsonify({
                'success': True,
                'message': 'Account updated successfully',
                'data': account.to_dict()
            }), 200
        except ValueError as e:
            if 'not found' in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
    
    @staticmethod
    def delete_account(account_id: int) -> tuple:
        """Delete an account"""
        try:
            account_service.delete_account(account_id)
            return jsonify({
                'success': True,
                'message': 'Account deleted successfully'
            }), 200
        except ValueError as e:
            if 'not found' in str(e).lower():
                raise AppError(str(e), 404)
            raise AppError(str(e), 400)
    
    @staticmethod
    def get_account_children(account_id: int) -> tuple:
        """Get child accounts of a parent"""
        try:
            children = account_service.get_account_children(account_id)
            return jsonify({
                'success': True,
                'data': [account.to_dict() for account in children]
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)
    
    @staticmethod
    def get_account_tree() -> tuple:
        """Get hierarchical account tree"""
        try:
            root_id = None
            if request.args.get('rootId'):
                try:
                    root_id = int(request.args.get('rootId'))
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid rootId'}), 400
            
            tree = account_service.get_account_tree(root_id)
            return jsonify({
                'success': True,
                'data': tree
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)
    
    @staticmethod
    def get_account_balance(account_id: int) -> tuple:
        """Get account balance"""
        try:
            from datetime import date
            
            as_of_date = None
            if request.args.get('asOfDate'):
                try:
                    as_of_date = date.fromisoformat(request.args.get('asOfDate'))
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid date format. Use YYYY-MM-DD'}), 400
            
            balance = account_service.get_account_balance(account_id, as_of_date)
            return jsonify({
                'success': True,
                'data': balance
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)
    
    @staticmethod
    def toggle_account_status(account_id: int) -> tuple:
        """Toggle account active status"""
        try:
            user_id = request.headers.get('X-User-Id') or 1
            account = account_service.toggle_account_status(account_id, user_id)
            
            status = 'activated' if account.is_active else 'deactivated'
            return jsonify({
                'success': True,
                'message': f'Account {status} successfully',
                'data': account.to_dict()
            }), 200
        except ValueError as e:
            raise AppError(str(e), 404)


# Singleton instance
account_controller = AccountController()
