#!/usr/bin/env python3
"""
Transaction Service Layer
Business logic and validation for transactions
"""

from typing import Optional, Dict, Any, List
from datetime import date
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.transaction_model import TransactionRepository
from backend.models.account_model import AccountRepository


class TransactionService:
    """Service layer for transaction business logic"""
    
    VALID_TRANSACTION_TYPES = [
        'journal_entry', 'invoice', 'bill', 'payment', 'sales_receipt',
        'purchase', 'refund', 'adjustment', 'transfer', 'deposit', 'withdrawal'
    ]
    
    @staticmethod
    def get_all_transactions(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get all transactions with optional filters"""
        return TransactionRepository.find_all(filters)
    
    @staticmethod
    def get_transaction_by_id(transaction_id: int) -> Dict[str, Any]:
        """Get transaction by ID, raise error if not found"""
        transaction = TransactionRepository.find_by_id(transaction_id)
        if not transaction:
            raise ValueError('Transaction not found')
        return transaction
    
    @staticmethod
    def create_transaction(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        """Create a new transaction with validation"""
        # Validate transaction type
        if data.get('transaction_type') not in TransactionService.VALID_TRANSACTION_TYPES:
            raise ValueError('Invalid transaction type')
        
        # Validate that all accounts exist and are active
        lines = data.get('lines', [])
        if len(lines) < 2:
            raise ValueError('Transaction must have at least 2 lines')
        
        for line in lines:
            account = AccountRepository.find_by_id(line.get('account_id'))
            if not account:
                raise ValueError(f'Account with ID {line.get("account_id")} not found')
            if not account.is_active:
                raise ValueError(f'Account "{account.account_name}" is inactive')
            
            # Validate each line has either debit or credit (not both, not neither)
            has_debit = float(line.get('debit_amount', 0)) > 0
            has_credit = float(line.get('credit_amount', 0)) > 0
            
            if has_debit and has_credit:
                raise ValueError('A transaction line cannot have both debit and credit amounts')
            
            if not has_debit and not has_credit:
                raise ValueError('A transaction line must have either a debit or credit amount')
        
        # Validate balance
        if not TransactionRepository.validate_balance(lines):
            raise ValueError('Transaction is not balanced. Total debits must equal total credits.')
        
        return TransactionRepository.create(data, user_id)
    
    @staticmethod
    def update_transaction(transaction_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        """Update an existing transaction with validation"""
        transaction = TransactionService.get_transaction_by_id(transaction_id)
        
        if transaction['transaction']['is_posted']:
            raise ValueError('Cannot modify posted transaction. Unpost it first.')
        
        if transaction['transaction']['is_void']:
            raise ValueError('Cannot modify voided transaction')
        
        # Validate accounts if lines are being updated
        if 'lines' in data:
            if len(data['lines']) < 2:
                raise ValueError('Transaction must have at least 2 lines')
            
            for line in data['lines']:
                account = AccountRepository.find_by_id(line.get('account_id'))
                if not account:
                    raise ValueError(f'Account with ID {line.get("account_id")} not found')
                
                # Validate each line
                has_debit = float(line.get('debit_amount', 0)) > 0
                has_credit = float(line.get('credit_amount', 0)) > 0
                
                if has_debit and has_credit:
                    raise ValueError('A transaction line cannot have both debit and credit amounts')
                
                if not has_debit and not has_credit:
                    raise ValueError('A transaction line must have either a debit or credit amount')
        
        return TransactionRepository.update(transaction_id, data, user_id)
    
    @staticmethod
    def delete_transaction(transaction_id: int) -> None:
        """Delete a transaction with validation"""
        transaction = TransactionService.get_transaction_by_id(transaction_id)
        
        if transaction['transaction']['is_posted']:
            raise ValueError('Cannot delete posted transaction. Unpost or void it first.')
        
        if transaction['transaction']['is_void']:
            raise ValueError('Cannot delete voided transaction')
        
        TransactionRepository.delete(transaction_id)
    
    @staticmethod
    def post_transaction(transaction_id: int, user_id: int) -> Dict[str, Any]:
        """Post a transaction"""
        return TransactionRepository.post_transaction(transaction_id, user_id)
    
    @staticmethod
    def unpost_transaction(transaction_id: int, user_id: int) -> Dict[str, Any]:
        """Unpost a transaction"""
        return TransactionRepository.unpost_transaction(transaction_id, user_id)
    
    @staticmethod
    def void_transaction(transaction_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        """Void a transaction"""
        if not reason or not reason.strip():
            raise ValueError('Void reason is required')
        
        return TransactionRepository.void_transaction(transaction_id, reason, user_id)
    
    @staticmethod
    def get_general_ledger(account_id: Optional[int] = None, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        """Get general ledger entries"""
        return TransactionRepository.get_general_ledger(account_id, start_date, end_date)
    
    @staticmethod
    def get_account_ledger(account_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None) -> Dict[str, Any]:
        """Get account ledger with running balance"""
        # Verify account exists
        account = AccountRepository.find_by_id(account_id)
        if not account:
            raise ValueError('Account not found')
        
        ledger = TransactionRepository.get_general_ledger(account_id, start_date, end_date)
        
        # Calculate running balance
        running_balance = 0.0
        ledger_with_balance = []
        
        for entry in ledger:
            debit = float(entry.get('debit_amount', 0))
            credit = float(entry.get('credit_amount', 0))
            amount = debit - credit
            
            if account.balance_type == 'debit':
                running_balance += amount
            else:
                running_balance -= amount
            
            entry_dict = dict(entry)
            entry_dict['running_balance'] = running_balance
            ledger_with_balance.append(entry_dict)
        
        return {
            'account': account.to_dict(),
            'entries': ledger_with_balance,
            'ending_balance': running_balance
        }


# Singleton instance
transaction_service = TransactionService()
