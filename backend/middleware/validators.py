#!/usr/bin/env python3
"""
Input validation middleware for account and transaction endpoints
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


# -----------------------------------------------------------------------------
# Vendor validators
# -----------------------------------------------------------------------------
import re as _re

_vendor_tax_id_re = _re.compile(r'^\d{2}-\d{7}$|^\d{3}-\d{2}-\d{4}$')


def validate_vendor_create(func: Callable) -> Callable:
    """Validate vendor creation data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        name = (data.get('vendor_name') or '').strip()
        if not name:
            errors.append({'field': 'vendor_name', 'message': 'Vendor name is required'})
        elif len(name) > 255:
            errors.append({'field': 'vendor_name', 'message': 'Vendor name must not exceed 255 characters'})
        if data.get('contact_name') and len(str(data['contact_name'])) > 100:
            errors.append({'field': 'contact_name', 'message': 'Contact name must not exceed 100 characters'})
        if data.get('email') and '@' not in str(data['email']):
            errors.append({'field': 'email', 'message': 'Invalid email format'})
        if data.get('phone') and len(str(data['phone'])) > 20:
            errors.append({'field': 'phone', 'message': 'Phone must not exceed 20 characters'})
        if data.get('website'):
            w = str(data['website']).strip()
            if len(w) > 255:
                errors.append({'field': 'website', 'message': 'Website must not exceed 255 characters'})
            elif w and not (w.startswith('http://') or w.startswith('https://')):
                errors.append({'field': 'website', 'message': 'Invalid website URL'})
        terms = data.get('payment_terms_days')
        if terms is not None:
            try:
                t = int(terms)
                if t < 0 or t > 365:
                    errors.append({'field': 'payment_terms_days', 'message': 'Payment terms days must be between 0 and 365'})
            except (TypeError, ValueError):
                errors.append({'field': 'payment_terms_days', 'message': 'Payment terms days must be an integer'})
        if data.get('tax_id') and not _vendor_tax_id_re.match(str(data['tax_id']).strip()):
            errors.append({'field': 'tax_id', 'message': 'Tax ID must be XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)'})
        if 'is_1099_vendor' in data and not isinstance(data['is_1099_vendor'], bool):
            errors.append({'field': 'is_1099_vendor', 'message': 'is_1099_vendor must be a boolean'})
        if data.get('vendor_number') and len(str(data['vendor_number'])) > 20:
            errors.append({'field': 'vendor_number', 'message': 'Vendor number must not exceed 20 characters'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_vendor_update(func: Callable) -> Callable:
    """Validate vendor update data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        if data.get('vendor_name') is not None:
            name = (data.get('vendor_name') or '').strip()
            if not name:
                errors.append({'field': 'vendor_name', 'message': 'Vendor name must not be empty'})
            elif len(name) > 255:
                errors.append({'field': 'vendor_name', 'message': 'Vendor name must not exceed 255 characters'})
        if data.get('email') is not None and data.get('email') and '@' not in str(data['email']):
            errors.append({'field': 'email', 'message': 'Invalid email format'})
        terms = data.get('payment_terms_days')
        if terms is not None:
            try:
                t = int(terms)
                if t < 0 or t > 365:
                    errors.append({'field': 'payment_terms_days', 'message': 'Payment terms days must be between 0 and 365'})
            except (TypeError, ValueError):
                errors.append({'field': 'payment_terms_days', 'message': 'Payment terms days must be an integer'})
        if 'is_active' in data and not isinstance(data['is_active'], bool):
            errors.append({'field': 'is_active', 'message': 'is_active must be a boolean'})
        if data.get('tax_id') is not None and data.get('tax_id') and not _vendor_tax_id_re.match(str(data['tax_id']).strip()):
            errors.append({'field': 'tax_id', 'message': 'Tax ID must be XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_vendor_id(func: Callable) -> Callable:
    """Validate vendor ID parameter"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        vid = kwargs.get('vendor_id')
        if vid is not None:
            try:
                vid = int(vid)
                if vid < 1:
                    return jsonify({'success': False, 'message': 'Invalid vendor ID'}), 400
                kwargs['vendor_id'] = vid
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': 'Invalid vendor ID'}), 400
        return func(*args, **kwargs)
    return wrapper


# -----------------------------------------------------------------------------
# Bill validators
# -----------------------------------------------------------------------------


def validate_bill_create(func: Callable) -> Callable:
    """Validate bill creation data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        try:
            vid = data.get('vendor_id')
            if vid is None:
                errors.append({'field': 'vendor_id', 'message': 'Vendor ID is required'})
            else:
                v = int(vid)
                if v < 1:
                    errors.append({'field': 'vendor_id', 'message': 'Vendor ID must be a positive integer'})
        except (TypeError, ValueError):
            errors.append({'field': 'vendor_id', 'message': 'Vendor ID must be a positive integer'})
        if not data.get('bill_date'):
            errors.append({'field': 'bill_date', 'message': 'Bill date is required'})
        if data.get('vendor_reference') and len(str(data['vendor_reference'])) > 100:
            errors.append({'field': 'vendor_reference', 'message': 'Vendor reference must not exceed 100 characters'})
        lines = data.get('lines')
        if not isinstance(lines, list) or len(lines) < 1:
            errors.append({'field': 'lines', 'message': 'Bill must have at least one line item'})
        else:
            for i, ln in enumerate(lines):
                if not (ln.get('description') or '').strip():
                    errors.append({'field': f'lines[{i}].description', 'message': 'Each line must have a description'})
                qty = ln.get('quantity')
                if qty is None:
                    errors.append({'field': f'lines[{i}].quantity', 'message': 'Each line must have a quantity'})
                else:
                    try:
                        q = float(qty)
                        if q <= 0:
                            errors.append({'field': f'lines[{i}].quantity', 'message': 'Quantity must be greater than 0'})
                    except (TypeError, ValueError):
                        errors.append({'field': f'lines[{i}].quantity', 'message': 'Quantity must be a number'})
                uc = ln.get('unit_cost')
                if uc is None:
                    errors.append({'field': f'lines[{i}].unit_cost', 'message': 'Each line must have a unit cost'})
                else:
                    try:
                        u = float(uc)
                        if u < 0:
                            errors.append({'field': f'lines[{i}].unit_cost', 'message': 'Unit cost cannot be negative'})
                    except (TypeError, ValueError):
                        errors.append({'field': f'lines[{i}].unit_cost', 'message': 'Unit cost must be a number'})
                if not ln.get('account_id'):
                    errors.append({'field': f'lines[{i}].account_id', 'message': 'Each line must have an account_id'})
                if ln.get('billable') and not ln.get('customer_id'):
                    errors.append({'field': f'lines[{i}]', 'message': 'Billable expenses must have a customer_id'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_bill_update(func: Callable) -> Callable:
    """Validate bill update data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        if data.get('vendor_id') is not None:
            try:
                v = int(data['vendor_id'])
                if v < 1:
                    errors.append({'field': 'vendor_id', 'message': 'Vendor ID must be a positive integer'})
            except (TypeError, ValueError):
                errors.append({'field': 'vendor_id', 'message': 'Vendor ID must be a positive integer'})
        lines = data.get('lines')
        if lines is not None:
            if not isinstance(lines, list) or len(lines) < 1:
                errors.append({'field': 'lines', 'message': 'Bill must have at least one line item'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_bill_id(func: Callable) -> Callable:
    """Validate bill ID parameter"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        bid = kwargs.get('bill_id')
        if bid is not None:
            try:
                bid = int(bid)
                if bid < 1:
                    return jsonify({'success': False, 'message': 'Invalid bill ID'}), 400
                kwargs['bill_id'] = bid
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': 'Invalid bill ID'}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_bill_void(func: Callable) -> Callable:
    """Validate bill void request (reason required)"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        reason = (data.get('reason') or '').strip()
        if not reason:
            return jsonify({'success': False, 'message': 'Void reason is required'}), 400
        if len(reason) > 500:
            return jsonify({'success': False, 'message': 'Void reason must be between 1 and 500 characters'}), 400
        return func(*args, **kwargs)
    return wrapper


# -----------------------------------------------------------------------------
# Bill Payment validators
# -----------------------------------------------------------------------------


def validate_bill_payment_create(func: Callable) -> Callable:
    """Validate bill payment creation data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        try:
            vid = data.get('vendor_id')
            if vid is None:
                errors.append({'field': 'vendor_id', 'message': 'Vendor ID is required'})
            else:
                v = int(vid)
                if v < 1:
                    errors.append({'field': 'vendor_id', 'message': 'Vendor ID must be a positive integer'})
        except (TypeError, ValueError):
            errors.append({'field': 'vendor_id', 'message': 'Vendor ID must be a positive integer'})
        if not data.get('payment_date'):
            errors.append({'field': 'payment_date', 'message': 'Payment date is required'})
        method = (data.get('payment_method') or '').strip().lower()
        if not method:
            errors.append({'field': 'payment_method', 'message': 'Payment method is required'})
        elif method not in ('check', 'ach', 'wire', 'credit_card', 'cash', 'other'):
            errors.append({'field': 'payment_method', 'message': 'Invalid payment method'})
        try:
            amt = float(data.get('payment_amount') or 0)
            if amt <= 0:
                errors.append({'field': 'payment_amount', 'message': 'Payment amount must be greater than 0'})
        except (TypeError, ValueError):
            errors.append({'field': 'payment_amount', 'message': 'Payment amount must be a valid number'})
        try:
            paid_from = data.get('paid_from_account_id')
            if paid_from is None:
                errors.append({'field': 'paid_from_account_id', 'message': 'Paid from account is required'})
            else:
                p = int(paid_from)
                if p < 1:
                    errors.append({'field': 'paid_from_account_id', 'message': 'Paid from account ID must be a positive integer'})
        except (TypeError, ValueError):
            errors.append({'field': 'paid_from_account_id', 'message': 'Paid from account ID must be a positive integer'})
        if data.get('reference_number') and len(str(data['reference_number'])) > 50:
            errors.append({'field': 'reference_number', 'message': 'Reference number must not exceed 50 characters'})
        apps = data.get('applications')
        if not isinstance(apps, list) or len(apps) < 1:
            errors.append({'field': 'applications', 'message': 'Payment must be applied to at least one bill'})
        else:
            for i, app in enumerate(apps):
                try:
                    bid = app.get('bill_id')
                    if bid is None:
                        errors.append({'field': f'applications[{i}].bill_id', 'message': 'Each application must have a valid bill_id'})
                    else:
                        b = int(bid)
                        if b < 1:
                            errors.append({'field': f'applications[{i}].bill_id', 'message': 'Bill ID must be a positive integer'})
                except (TypeError, ValueError):
                    errors.append({'field': f'applications[{i}].bill_id', 'message': 'Bill ID must be a positive integer'})
                try:
                    amt = float(app.get('amount_applied') or 0)
                    if amt <= 0:
                        errors.append({'field': f'applications[{i}].amount_applied', 'message': 'Each application must have an amount_applied greater than 0'})
                except (TypeError, ValueError):
                    errors.append({'field': f'applications[{i}].amount_applied', 'message': 'Amount applied must be a valid number'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_bill_payment_update(func: Callable) -> Callable:
    """Validate bill payment update data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        if data.get('payment_date') is not None and not data.get('payment_date'):
            errors.append({'field': 'payment_date', 'message': 'Payment date must be a valid date'})
        if data.get('payment_method') is not None:
            method = (data.get('payment_method') or '').strip().lower()
            if method and method not in ('check', 'ach', 'wire', 'credit_card', 'cash', 'other'):
                errors.append({'field': 'payment_method', 'message': 'Invalid payment method'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_bill_payment_id(func: Callable) -> Callable:
    """Validate bill payment ID parameter"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        pid = kwargs.get('payment_id')
        if pid is not None:
            try:
                pid = int(pid)
                if pid < 1:
                    return jsonify({'success': False, 'message': 'Invalid payment ID'}), 400
                kwargs['payment_id'] = pid
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': 'Invalid payment ID'}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_bill_payment_void(func: Callable) -> Callable:
    """Validate bill payment void request (reason required)"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        reason = (data.get('reason') or '').strip()
        if not reason:
            return jsonify({'success': False, 'message': 'Void reason is required'}), 400
        if len(reason) > 500:
            return jsonify({'success': False, 'message': 'Void reason must be between 1 and 500 characters'}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_vendor_id_for_bills(func: Callable) -> Callable:
    """Validate vendor ID parameter for outstanding bills"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        vid = kwargs.get('vendor_id')
        if vid is not None:
            try:
                vid = int(vid)
                if vid < 1:
                    return jsonify({'success': False, 'message': 'Invalid vendor ID'}), 400
                kwargs['vendor_id'] = vid
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': 'Invalid vendor ID'}), 400
        return func(*args, **kwargs)
    return wrapper


# -----------------------------------------------------------------------------
# Item/Inventory validators
# -----------------------------------------------------------------------------


def validate_item_create(func: Callable) -> Callable:
    """Validate item creation data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        name = (data.get('item_name') or '').strip()
        if not name:
            errors.append({'field': 'item_name', 'message': 'Item name is required'})
        elif len(name) > 255:
            errors.append({'field': 'item_name', 'message': 'Item name must not exceed 255 characters'})
        item_type = data.get('item_type')
        if not item_type:
            errors.append({'field': 'item_type', 'message': 'Item type is required'})
        elif item_type not in ('inventory', 'non_inventory', 'service', 'bundle'):
            errors.append({'field': 'item_type', 'message': 'Invalid item type'})
        try:
            income_id = data.get('income_account_id')
            if income_id is None:
                errors.append({'field': 'income_account_id', 'message': 'Income account is required'})
            else:
                i = int(income_id)
                if i < 1:
                    errors.append({'field': 'income_account_id', 'message': 'Income account ID must be a positive integer'})
        except (TypeError, ValueError):
            errors.append({'field': 'income_account_id', 'message': 'Income account ID must be a positive integer'})
        try:
            expense_id = data.get('expense_account_id')
            if expense_id is None:
                errors.append({'field': 'expense_account_id', 'message': 'Expense account is required'})
            else:
                e = int(expense_id)
                if e < 1:
                    errors.append({'field': 'expense_account_id', 'message': 'Expense account ID must be a positive integer'})
        except (TypeError, ValueError):
            errors.append({'field': 'expense_account_id', 'message': 'Expense account ID must be a positive integer'})
        if item_type == 'inventory':
            try:
                asset_id = data.get('asset_account_id')
                if asset_id is None:
                    errors.append({'field': 'asset_account_id', 'message': 'Asset account is required for inventory items'})
                else:
                    a = int(asset_id)
                    if a < 1:
                        errors.append({'field': 'asset_account_id', 'message': 'Asset account ID must be a positive integer'})
            except (TypeError, ValueError):
                errors.append({'field': 'asset_account_id', 'message': 'Asset account ID must be a positive integer'})
        try:
            sp = float(data.get('sales_price') or 0)
            if sp < 0:
                errors.append({'field': 'sales_price', 'message': 'Sales price cannot be negative'})
        except (TypeError, ValueError):
            errors.append({'field': 'sales_price', 'message': 'Sales price must be a valid number'})
        if data.get('cost_method') and data['cost_method'] not in ('FIFO', 'LIFO', 'Average'):
            errors.append({'field': 'cost_method', 'message': 'Invalid cost method'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_item_update(func: Callable) -> Callable:
    """Validate item update data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        if data.get('item_name') is not None:
            name = (data.get('item_name') or '').strip()
            if not name:
                errors.append({'field': 'item_name', 'message': 'Item name must not be empty'})
            elif len(name) > 255:
                errors.append({'field': 'item_name', 'message': 'Item name must not exceed 255 characters'})
        if data.get('item_type') and data['item_type'] not in ('inventory', 'non_inventory', 'service', 'bundle'):
            errors.append({'field': 'item_type', 'message': 'Invalid item type'})
        if 'sales_price' in data:
            try:
                sp = float(data['sales_price'] or 0)
                if sp < 0:
                    errors.append({'field': 'sales_price', 'message': 'Sales price cannot be negative'})
            except (TypeError, ValueError):
                errors.append({'field': 'sales_price', 'message': 'Sales price must be a valid number'})
        if 'is_active' in data and not isinstance(data['is_active'], bool):
            errors.append({'field': 'is_active', 'message': 'is_active must be a boolean'})
        if data.get('cost_method') and data['cost_method'] not in ('FIFO', 'LIFO', 'Average'):
            errors.append({'field': 'cost_method', 'message': 'Invalid cost method'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_item_id(func: Callable) -> Callable:
    """Validate item ID parameter"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        iid = kwargs.get('item_id')
        if iid is not None:
            try:
                iid = int(iid)
                if iid < 1:
                    return jsonify({'success': False, 'message': 'Invalid item ID'}), 400
                kwargs['item_id'] = iid
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': 'Invalid item ID'}), 400
        return func(*args, **kwargs)
    return wrapper


def validate_inventory_adjustment(func: Callable) -> Callable:
    """Validate inventory adjustment data"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        data = request.get_json() or {}
        errors = []
        try:
            iid = data.get('item_id')
            if iid is None:
                errors.append({'field': 'item_id', 'message': 'Item ID is required'})
            else:
                i = int(iid)
                if i < 1:
                    errors.append({'field': 'item_id', 'message': 'Item ID must be a positive integer'})
        except (TypeError, ValueError):
            errors.append({'field': 'item_id', 'message': 'Item ID must be a positive integer'})
        adj_type = data.get('adjustment_type')
        if not adj_type:
            errors.append({'field': 'adjustment_type', 'message': 'Adjustment type is required'})
        elif adj_type not in ('increase', 'decrease'):
            errors.append({'field': 'adjustment_type', 'message': 'Adjustment type must be increase or decrease'})
        try:
            qty = float(data.get('quantity') or 0)
            if qty <= 0:
                errors.append({'field': 'quantity', 'message': 'Quantity must be greater than 0'})
        except (TypeError, ValueError):
            errors.append({'field': 'quantity', 'message': 'Quantity must be a valid number'})
        reason = (data.get('reason') or '').strip()
        if not reason:
            errors.append({'field': 'reason', 'message': 'Reason is required'})
        elif len(reason) > 500:
            errors.append({'field': 'reason', 'message': 'Reason must not exceed 500 characters'})
        if errors:
            return jsonify({'success': False, 'errors': errors}), 400
        return func(*args, **kwargs)
    return wrapper
