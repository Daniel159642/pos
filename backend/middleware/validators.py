#!/usr/bin/env python3
"""
Input validation middleware for account and transaction endpoints
"""

from functools import wraps
from flask import request, jsonify
from typing import Callable, Any


def validate_transaction_create(func: Callable) -> Callable:
    """Validate transaction creation data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        
        # Required fields
        if not data.get('transaction_date'):
            errors.append({'field': 'transaction_date', 'message': 'Transaction date is required'})
        
        if not data.get('transaction_type'):
            errors.append({'field': 'transaction_type', 'message': 'Transaction type is required'})
        elif data.get('transaction_type') not in [
            'journal_entry', 'invoice', 'bill', 'payment', 'sales_receipt',
            'purchase', 'refund', 'adjustment', 'transfer', 'deposit', 'withdrawal'
        ]:
            errors.append({'field': 'transaction_type', 'message': 'Invalid transaction type'})
        
        if not data.get('description'):
            errors.append({'field': 'description', 'message': 'Description is required'})
        elif len(data.get('description', '')) > 500:
            errors.append({'field': 'description', 'message': 'Description must not exceed 500 characters'})
        
        # Validate lines
        lines = data.get('lines', [])
        if not isinstance(lines, list):
            errors.append({'field': 'lines', 'message': 'Lines must be an array'})
        elif len(lines) < 2:
            errors.append({'field': 'lines', 'message': 'At least 2 transaction lines are required'})
        else:
            for i, line in enumerate(lines):
                if not line.get('account_id'):
                    errors.append({'field': f'lines[{i}].account_id', 'message': 'Account ID is required'})
                elif not isinstance(line.get('account_id'), int) or line.get('account_id') < 1:
                    errors.append({'field': f'lines[{i}].account_id', 'message': 'Account ID must be a positive integer'})
                
                debit = line.get('debit_amount', 0)
                credit = line.get('credit_amount', 0)
                
                if debit is None or credit is None:
                    errors.append({'field': f'lines[{i}]', 'message': 'Each line must have debit_amount and credit_amount'})
                elif debit < 0 or credit < 0:
                    errors.append({'field': f'lines[{i}]', 'message': 'Debit and credit amounts cannot be negative'})
                
                if not line.get('description') or not line.get('description', '').strip():
                    errors.append({'field': f'lines[{i}].description', 'message': 'Line description is required'})
        
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        
        return func(*args, **kwargs)
    
    return wrapper


def validate_transaction_update(func: Callable) -> Callable:
    """Validate transaction update data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        
        # Optional field validations
        if 'transaction_type' in data and data['transaction_type']:
            if data['transaction_type'] not in [
                'journal_entry', 'invoice', 'bill', 'payment', 'sales_receipt',
                'purchase', 'refund', 'adjustment', 'transfer', 'deposit', 'withdrawal'
            ]:
                errors.append({'field': 'transaction_type', 'message': 'Invalid transaction type'})
        
        if 'description' in data and data['description']:
            if len(data['description']) > 500:
                errors.append({'field': 'description', 'message': 'Description must not exceed 500 characters'})
        
        if 'lines' in data:
            if not isinstance(data['lines'], list):
                errors.append({'field': 'lines', 'message': 'Lines must be an array'})
            elif len(data['lines']) < 2:
                errors.append({'field': 'lines', 'message': 'At least 2 transaction lines are required'})
        
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        
        return func(*args, **kwargs)
    
    return wrapper


def validate_transaction_id(func: Callable) -> Callable:
    """Validate transaction ID parameter"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        transaction_id = kwargs.get('transaction_id')
        if transaction_id:
            try:
                transaction_id = int(transaction_id)
                if transaction_id < 1:
                    return jsonify({'success': False, 'message': 'Invalid transaction ID'}), 400
                kwargs['transaction_id'] = transaction_id
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': 'Invalid transaction ID'}), 400
        
        return func(*args, **kwargs)
    
    return wrapper
