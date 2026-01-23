#!/usr/bin/env python3
"""
Unit tests for Transaction Service
"""

import sys
import os
import pytest
from unittest.mock import Mock, patch
from datetime import date

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.transaction_service import transaction_service
from backend.models.transaction_model import Transaction, TransactionLine


class TestTransactionService:
    """Test cases for TransactionService"""
    
    @patch('backend.services.transaction_service.TransactionRepository')
    @patch('backend.services.transaction_service.AccountRepository')
    def test_create_transaction_success(self, mock_account_repo, mock_txn_repo):
        """Test successful transaction creation"""
        # Setup
        mock_account1 = Mock()
        mock_account1.is_active = True
        mock_account1.account_name = 'Cash'
        
        mock_account2 = Mock()
        mock_account2.is_active = True
        mock_account2.account_name = 'Revenue'
        
        mock_account_repo.find_by_id.side_effect = [mock_account1, mock_account2]
        
        mock_transaction = {
            'transaction': {'id': 1, 'transaction_number': 'TRX-001'},
            'lines': []
        }
        mock_txn_repo.create.return_value = mock_transaction
        mock_txn_repo.validate_balance.return_value = True
        
        # Execute
        data = {
            'transaction_date': date.today(),
            'transaction_type': 'journal_entry',
            'description': 'Test transaction',
            'lines': [
                {'account_id': 1, 'debit_amount': 100, 'credit_amount': 0, 'description': 'Debit'},
                {'account_id': 2, 'debit_amount': 0, 'credit_amount': 100, 'description': 'Credit'}
            ]
        }
        result = transaction_service.create_transaction(data, user_id=1)
        
        # Assert
        assert result['transaction']['id'] == 1
        mock_txn_repo.create.assert_called_once()
    
    def test_create_transaction_invalid_type(self):
        """Test transaction creation with invalid transaction type"""
        data = {
            'transaction_date': date.today(),
            'transaction_type': 'Invalid',
            'description': 'Test',
            'lines': []
        }
        
        with pytest.raises(ValueError, match='Invalid transaction type'):
            transaction_service.create_transaction(data, user_id=1)
    
    def test_create_transaction_insufficient_lines(self):
        """Test transaction creation with less than 2 lines"""
        data = {
            'transaction_date': date.today(),
            'transaction_type': 'journal_entry',
            'description': 'Test',
            'lines': [
                {'account_id': 1, 'debit_amount': 100, 'credit_amount': 0, 'description': 'Line'}
            ]
        }
        
        with pytest.raises(ValueError, match='at least 2 lines'):
            transaction_service.create_transaction(data, user_id=1)
    
    @patch('backend.services.transaction_service.TransactionRepository')
    @patch('backend.services.transaction_service.AccountRepository')
    def test_create_transaction_unbalanced(self, mock_account_repo, mock_txn_repo):
        """Test transaction creation with unbalanced entries"""
        mock_account1 = Mock()
        mock_account1.is_active = True
        mock_account2 = Mock()
        mock_account2.is_active = True
        mock_account_repo.find_by_id.side_effect = [mock_account1, mock_account2]
        
        mock_txn_repo.validate_balance.return_value = False
        
        data = {
            'transaction_date': date.today(),
            'transaction_type': 'journal_entry',
            'description': 'Unbalanced',
            'lines': [
                {'account_id': 1, 'debit_amount': 100, 'credit_amount': 0, 'description': 'Debit'},
                {'account_id': 2, 'debit_amount': 0, 'credit_amount': 50, 'description': 'Credit'}
            ]
        }
        
        with pytest.raises(ValueError, match='not balanced'):
            transaction_service.create_transaction(data, user_id=1)
    
    @patch('backend.services.transaction_service.TransactionRepository')
    def test_update_posted_transaction(self, mock_txn_repo):
        """Test that posted transactions cannot be updated"""
        mock_txn_repo.find_by_id.return_value = {
            'transaction': {'id': 1, 'is_posted': True, 'is_void': False},
            'lines': []
        }
        
        with pytest.raises(ValueError, match='Cannot modify posted transaction'):
            transaction_service.update_transaction(1, {'description': 'Updated'}, user_id=1)
    
    @patch('backend.services.transaction_service.TransactionRepository')
    def test_delete_posted_transaction(self, mock_txn_repo):
        """Test that posted transactions cannot be deleted"""
        mock_txn_repo.find_by_id.return_value = {
            'transaction': {'id': 1, 'is_posted': True, 'is_void': False},
            'lines': []
        }
        
        with pytest.raises(ValueError, match='Cannot delete posted transaction'):
            transaction_service.delete_transaction(1)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
