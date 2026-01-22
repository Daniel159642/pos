#!/usr/bin/env python3
"""
Unit tests for Account Service
"""

import sys
import os
import pytest
from unittest.mock import Mock, patch, MagicMock

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.account_service import account_service
from backend.models.account_model import Account


class TestAccountService:
    """Test cases for AccountService"""
    
    @patch('backend.services.account_service.AccountRepository')
    def test_create_account_success(self, mock_repo):
        """Test successful account creation"""
        # Setup
        mock_account = Account({
            'id': 1,
            'account_name': 'Test Account',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'is_system_account': False,
            'opening_balance': 0
        })
        
        mock_repo.find_by_account_number.return_value = None
        mock_repo.create.return_value = mock_account
        
        # Execute
        data = {
            'account_name': 'Test Account',
            'account_type': 'Asset',
            'balance_type': 'debit'
        }
        result = account_service.create_account(data, user_id=1)
        
        # Assert
        assert result.account_name == 'Test Account'
        mock_repo.find_by_account_number.assert_called_once()
        mock_repo.create.assert_called_once()
    
    def test_create_account_invalid_type(self):
        """Test account creation with invalid account type"""
        data = {
            'account_name': 'Test',
            'account_type': 'Invalid',
            'balance_type': 'debit'
        }
        
        with pytest.raises(ValueError, match='Invalid account type'):
            account_service.create_account(data, user_id=1)
    
    def test_create_account_invalid_balance_type(self):
        """Test account creation with invalid balance type"""
        data = {
            'account_name': 'Test',
            'account_type': 'Asset',
            'balance_type': 'invalid'
        }
        
        with pytest.raises(ValueError, match='Balance type must be debit or credit'):
            account_service.create_account(data, user_id=1)
    
    @patch('backend.services.account_service.AccountRepository')
    def test_create_account_duplicate_number(self, mock_repo):
        """Test account creation with duplicate account number"""
        # Setup
        existing_account = Account({
            'id': 1,
            'account_number': '1000',
            'account_name': 'Existing'
        })
        mock_repo.find_by_account_number.return_value = existing_account
        
        # Execute & Assert
        data = {
            'account_number': '1000',
            'account_name': 'New Account',
            'account_type': 'Asset',
            'balance_type': 'debit'
        }
        
        with pytest.raises(ValueError, match='Account number already exists'):
            account_service.create_account(data, user_id=1)
    
    @patch('backend.services.account_service.AccountRepository')
    def test_update_account_success(self, mock_repo):
        """Test successful account update"""
        # Setup
        existing_account = Account({
            'id': 1,
            'account_name': 'Original',
            'is_system_account': False
        })
        updated_account = Account({
            'id': 1,
            'account_name': 'Updated',
            'is_system_account': False
        })
        
        mock_repo.find_by_id.return_value = existing_account
        mock_repo.update.return_value = updated_account
        
        # Execute
        result = account_service.update_account(1, {'account_name': 'Updated'}, user_id=1)
        
        # Assert
        assert result.account_name == 'Updated'
        mock_repo.update.assert_called_once()
    
    @patch('backend.services.account_service.AccountRepository')
    def test_update_system_account_restriction(self, mock_repo):
        """Test that system accounts cannot have type/balance_type modified"""
        # Setup
        system_account = Account({
            'id': 1,
            'account_name': 'System Account',
            'is_system_account': True,
            'account_type': 'Asset',
            'balance_type': 'debit'
        })
        mock_repo.find_by_id.return_value = system_account
        
        # Execute & Assert
        with pytest.raises(ValueError, match='Cannot modify account type or balance type'):
            account_service.update_account(1, {'account_type': 'Liability'}, user_id=1)
    
    @patch('backend.services.account_service.AccountRepository')
    def test_delete_system_account(self, mock_repo):
        """Test that system accounts cannot be deleted"""
        # Setup
        system_account = Account({
            'id': 1,
            'is_system_account': True
        })
        mock_repo.find_by_id.return_value = system_account
        
        # Execute & Assert
        with pytest.raises(ValueError, match='Cannot delete system account'):
            account_service.delete_account(1)
    
    @patch('backend.services.account_service.AccountRepository')
    def test_validate_circular_hierarchy(self, mock_repo):
        """Test prevention of circular parent-child relationships"""
        # Setup - account 1 has parent 2, and we're trying to make 2's parent 1
        account1 = Account({'id': 1, 'parent_account_id': 2})
        account2 = Account({'id': 2, 'parent_account_id': None})
        
        mock_repo.find_by_id.side_effect = lambda x: account1 if x == 1 else account2
        
        # Execute & Assert
        with pytest.raises(ValueError, match='Cannot create circular'):
            account_service.validate_account_hierarchy(1, 2)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
