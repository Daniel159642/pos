#!/usr/bin/env python3
"""
Input validation middleware for account endpoints
"""

from functools import wraps
from flask import request, jsonify
from typing import Callable, Any


def validate_account_create(func: Callable) -> Callable:
    """Validate account creation data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        
        # Required fields
        if not data.get('account_name'):
            errors.append({'field': 'account_name', 'message': 'Account name is required'})
        elif len(data.get('account_name', '')) > 255:
            errors.append({'field': 'account_name', 'message': 'Account name must not exceed 255 characters'})
        
        if not data.get('account_type'):
            errors.append({'field': 'account_type', 'message': 'Account type is required'})
        elif data.get('account_type') not in ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'COGS', 
                                               'Other Income', 'Other Expense', 'Cost of Goods Sold']:
            errors.append({'field': 'account_type', 'message': 'Invalid account type'})
        
        if not data.get('balance_type'):
            errors.append({'field': 'balance_type', 'message': 'Balance type is required'})
        elif data.get('balance_type') not in ['debit', 'credit']:
            errors.append({'field': 'balance_type', 'message': 'Balance type must be debit or credit'})
        
        # Optional fields validation
        if 'account_number' in data and data['account_number']:
            if len(data['account_number']) > 20:
                errors.append({'field': 'account_number', 'message': 'Account number must not exceed 20 characters'})
        
        if 'sub_type' in data and data['sub_type']:
            if len(data['sub_type']) > 100:
                errors.append({'field': 'sub_type', 'message': 'Sub type must not exceed 100 characters'})
        
        if 'description' in data and data['description']:
            if len(data['description']) > 1000:
                errors.append({'field': 'description', 'message': 'Description must not exceed 1000 characters'})
        
        if 'parent_account_id' in data and data['parent_account_id'] is not None:
            try:
                parent_id = int(data['parent_account_id'])
                if parent_id < 1:
                    errors.append({'field': 'parent_account_id', 'message': 'Parent account ID must be a positive integer'})
            except (ValueError, TypeError):
                errors.append({'field': 'parent_account_id', 'message': 'Parent account ID must be an integer'})
        
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        
        return func(*args, **kwargs)
    
    return wrapper


def validate_account_update(func: Callable) -> Callable:
    """Validate account update data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        
        # Optional field validations
        if 'account_name' in data and data['account_name']:
            if len(data['account_name']) > 255:
                errors.append({'field': 'account_name', 'message': 'Account name must not exceed 255 characters'})
        
        if 'account_type' in data and data['account_type']:
            if data['account_type'] not in ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'COGS',
                                             'Other Income', 'Other Expense', 'Cost of Goods Sold']:
                errors.append({'field': 'account_type', 'message': 'Invalid account type'})
        
        if 'balance_type' in data and data['balance_type']:
            if data['balance_type'] not in ['debit', 'credit']:
                errors.append({'field': 'balance_type', 'message': 'Balance type must be debit or credit'})
        
        if 'account_number' in data and data['account_number']:
            if len(data['account_number']) > 20:
                errors.append({'field': 'account_number', 'message': 'Account number must not exceed 20 characters'})
        
        if 'is_active' in data and not isinstance(data['is_active'], bool):
            errors.append({'field': 'is_active', 'message': 'is_active must be a boolean'})
        
        if 'parent_account_id' in data and data['parent_account_id'] is not None:
            try:
                parent_id = int(data['parent_account_id'])
                if parent_id < 1:
                    errors.append({'field': 'parent_account_id', 'message': 'Parent account ID must be a positive integer'})
            except (ValueError, TypeError):
                errors.append({'field': 'parent_account_id', 'message': 'Parent account ID must be an integer or null'})
        
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        
        return func(*args, **kwargs)
    
    return wrapper


def validate_account_id(func: Callable) -> Callable:
    """Validate account ID parameter"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        account_id = kwargs.get('account_id')
        if account_id:
            try:
                account_id = int(account_id)
                if account_id < 1:
                    return jsonify({'success': False, 'message': 'Invalid account ID'}), 400
                kwargs['account_id'] = account_id
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': 'Invalid account ID'}), 400
        
        return func(*args, **kwargs)
    
    return wrapper
