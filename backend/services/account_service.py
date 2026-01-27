#!/usr/bin/env python3
"""
Account Service Layer
Business logic and validation for accounts
"""

from typing import Optional, Dict, Any, List
from datetime import date
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.account_model import Account, AccountRepository


class AccountService:
    """Service layer for account business logic"""
    
    VALID_ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'COGS', 
                          'Other Income', 'Other Expense', 'Cost of Goods Sold']
    VALID_BALANCE_TYPES = ['debit', 'credit']
    
    @staticmethod
    def get_all_accounts(filters: Optional[Dict[str, Any]] = None) -> List[Account]:
        """Get all accounts with optional filters"""
        return AccountRepository.find_all(filters)
    
    @staticmethod
    def get_account_by_id(account_id: int) -> Account:
        """Get account by ID, raise error if not found"""
        account = AccountRepository.find_by_id(account_id)
        if not account:
            raise ValueError('Account not found')
        return account
    
    @staticmethod
    def get_account_by_number(account_number: str) -> Account:
        """Get account by account number, raise error if not found"""
        account = AccountRepository.find_by_account_number(account_number)
        if not account:
            raise ValueError('Account not found')
        return account
    
    @staticmethod
    def create_account(data: Dict[str, Any], user_id: int) -> Account:
        """Create a new account with validation"""
        # Validate account type
        if data.get('account_type') not in AccountService.VALID_ACCOUNT_TYPES:
            raise ValueError('Invalid account type')
        
        # Validate balance type
        if data.get('balance_type') not in AccountService.VALID_BALANCE_TYPES:
            raise ValueError('Balance type must be debit or credit')
        
        # Check for duplicate account number
        if data.get('account_number'):
            existing = AccountRepository.find_by_account_number(data['account_number'])
            if existing:
                raise ValueError('Account number already exists')
        
        # Validate parent account exists
        if data.get('parent_account_id'):
            parent = AccountRepository.find_by_id(data['parent_account_id'])
            if not parent:
                raise ValueError('Parent account not found')
        
        return AccountRepository.create(data, user_id)
    
    @staticmethod
    def update_account(account_id: int, data: Dict[str, Any], user_id: int) -> Account:
        """Update an account with validation"""
        account = AccountService.get_account_by_id(account_id)
        
        # Prevent modifying system accounts
        if account.is_system_account:
            if 'account_type' in data or 'balance_type' in data:
                raise ValueError('Cannot modify account type or balance type of system accounts')
        
        # Check for duplicate account number
        if 'account_number' in data and data['account_number'] != account.account_number:
            existing = AccountRepository.find_by_account_number(data['account_number'])
            if existing:
                raise ValueError('Account number already exists')
        
        # Validate parent account and prevent circular reference
        if 'parent_account_id' in data:
            if data['parent_account_id'] == account_id:
                raise ValueError('Account cannot be its own parent')
            if data['parent_account_id']:
                AccountService.validate_account_hierarchy(account_id, data['parent_account_id'])
        
        # Validate account type if provided
        if 'account_type' in data and data['account_type'] not in AccountService.VALID_ACCOUNT_TYPES:
            raise ValueError('Invalid account type')
        
        # Validate balance type if provided
        if 'balance_type' in data and data['balance_type'] not in AccountService.VALID_BALANCE_TYPES:
            raise ValueError('Balance type must be debit or credit')
        
        return AccountRepository.update(account_id, data, user_id)
    
    @staticmethod
    def delete_account(account_id: int) -> None:
        """Delete an account with validation"""
        account = AccountService.get_account_by_id(account_id)
        
        if account.is_system_account:
            raise ValueError('Cannot delete system account')
        
        AccountRepository.delete(account_id)
    
    @staticmethod
    def get_account_children(account_id: int) -> List[Account]:
        """Get child accounts of a parent"""
        AccountService.get_account_by_id(account_id)  # Verify parent exists
        return AccountRepository.find_children(account_id)
    
    @staticmethod
    def get_account_tree(root_id: Optional[int] = None) -> Dict[str, Any]:
        """Get hierarchical account tree structure"""
        def build_tree(parent_id: Optional[int]) -> List[Dict[str, Any]]:
            if parent_id:
                accounts = AccountRepository.find_children(parent_id)
            else:
                # Get root accounts (no parent)
                filters = {'parent_account_id': None}
                accounts = AccountRepository.find_all(filters)
            
            result = []
            for account in accounts:
                account_dict = account.to_dict()
                account_dict['children'] = build_tree(account.id)
                result.append(account_dict)
            
            return result
        
        if root_id:
            root = AccountService.get_account_by_id(root_id)
            root_dict = root.to_dict()
            root_dict['children'] = build_tree(root_id)
            return root_dict
        
        return {'accounts': build_tree(None)}
    
    @staticmethod
    def get_account_balance(account_id: int, as_of_date: Optional[date] = None) -> Dict[str, Any]:
        """Get account balance with metadata"""
        account = AccountService.get_account_by_id(account_id)
        balance = AccountRepository.get_account_balance(account_id, as_of_date)
        
        return {
            'account_id': account_id,
            'account_name': account.account_name,
            'balance': balance,
            'balance_type': account.balance_type,
            'as_of_date': as_of_date.isoformat() if as_of_date else None
        }
    
    @staticmethod
    def toggle_account_status(account_id: int, user_id: int) -> Account:
        """Toggle account active status"""
        account = AccountService.get_account_by_id(account_id)
        return AccountRepository.update(account_id, {'is_active': not account.is_active}, user_id)
    
    @staticmethod
    def validate_account_hierarchy(account_id: int, new_parent_id: int) -> bool:
        """Validate that setting parent won't create circular reference"""
        # Check if new_parent_id is a descendant of account_id
        current_parent_id = new_parent_id
        
        while current_parent_id:
            if current_parent_id == account_id:
                raise ValueError('Cannot create circular parent-child relationship')
            
            parent = AccountRepository.find_by_id(current_parent_id)
            if not parent:
                break
            current_parent_id = parent.parent_account_id
        
        return True
    
    @staticmethod
    def search_accounts(search_term: str) -> List[Account]:
        """Search accounts by name or number"""
        return AccountRepository.search(search_term)


# Singleton instance
account_service = AccountService()
