#!/usr/bin/env python3
"""
Unit tests for Account Model/Repository
"""

import sys
import os
import pytest
from unittest.mock import patch, MagicMock
from datetime import date

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models.account_model import Account, AccountRepository


class TestAccountModel:
    """Test cases for Account model"""
    
    def test_account_creation(self):
        """Test Account object creation from dict"""
        account_data = {
            'id': 1,
            'account_number': '1000',
            'account_name': 'Cash',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'is_system_account': False,
            'opening_balance': 1000.0
        }
        
        account = Account(account_data)
        
        assert account.id == 1
        assert account.account_number == '1000'
        assert account.account_name == 'Cash'
        assert account.account_type == 'Asset'
        assert account.balance_type == 'debit'
        assert account.is_active is True
        assert account.opening_balance == 1000.0
    
    def test_account_to_dict(self):
        """Test Account.to_dict() method"""
        account_data = {
            'id': 1,
            'account_number': '1000',
            'account_name': 'Cash',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'is_system_account': False,
            'opening_balance': 1000.0,
            'sub_type': None,
            'parent_account_id': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        }
        
        account = Account(account_data)
        account_dict = account.to_dict()
        
        assert isinstance(account_dict, dict)
        assert account_dict['id'] == 1
        assert account_dict['account_name'] == 'Cash'
        assert account_dict['opening_balance'] == 1000.0


class TestAccountRepository:
    """Test cases for AccountRepository"""
    
    @patch('backend.models.account_model.get_cursor')
    def test_find_all(self, mock_get_cursor):
        """Test find_all method"""
        # Setup mock cursor
        mock_cursor = MagicMock()
        mock_get_cursor.return_value = mock_cursor
        
        # Mock fetchall result
        mock_row1 = MagicMock()
        mock_row1.__getitem__ = lambda self, key: {'id': 1, 'account_name': 'Account 1'}.get(key)
        mock_row2 = MagicMock()
        mock_row2.__getitem__ = lambda self, key: {'id': 2, 'account_name': 'Account 2'}.get(key)
        
        mock_cursor.fetchall.return_value = [mock_row1, mock_row2]
        mock_cursor.close = MagicMock()
        
        # Execute
        accounts = AccountRepository.find_all()
        
        # Assert
        assert len(accounts) == 2
        mock_cursor.execute.assert_called_once()
        mock_cursor.close.assert_called_once()
    
    @patch('backend.models.account_model.get_cursor')
    def test_find_by_id(self, mock_get_cursor):
        """Test find_by_id method"""
        # Setup mock cursor
        mock_cursor = MagicMock()
        mock_get_cursor.return_value = mock_cursor
        
        # Mock fetchone result
        mock_row = MagicMock()
        mock_row.__getitem__ = lambda self, key: {'id': 1, 'account_name': 'Test'}.get(key)
        mock_cursor.fetchone.return_value = mock_row
        mock_cursor.close = MagicMock()
        
        # Execute
        account = AccountRepository.find_by_id(1)
        
        # Assert
        assert account is not None
        mock_cursor.execute.assert_called_once()
        mock_cursor.close.assert_called_once()
    
    @patch('backend.models.account_model.get_cursor')
    def test_find_by_id_not_found(self, mock_get_cursor):
        """Test find_by_id when account doesn't exist"""
        # Setup mock cursor
        mock_cursor = MagicMock()
        mock_get_cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = None
        mock_cursor.close = MagicMock()
        
        # Execute
        account = AccountRepository.find_by_id(999)
        
        # Assert
        assert account is None
        mock_cursor.close.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
