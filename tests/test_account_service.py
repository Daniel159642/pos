#!/usr/bin/env python3
"""
Unit tests for Account Service
"""

import sys
import os
import pytest
from unittest.mock import Mock, patch, MagicMock, PropertyMock

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.account_service import account_service, AccountService
from backend.models.account_model import Account, AccountRepository


class TestAccountService:
    """Test cases for AccountService"""
    
    @patch.object(AccountRepository, 'find_by_account_number')
    @patch.object(AccountRepository, 'create')
    def test_create_account_success(self, mock_create, mock_find_by_number):
        """Test successful account creation"""
        # Setup
        mock_account = Account({
            'id': 1,
            'account_name': 'Test Account',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'is_system_account': False,
            'opening_balance': 0,
            'sub_type': None,
            'parent_account_id': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        })
        
        mock_find_by_number.return_value = None
        mock_create.return_value = mock_account
        
        # Execute - with account_number to trigger the check
        data = {
            'account_name': 'Test Account',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'account_number': 'TEST-001'
        }
        result = account_service.create_account(data, user_id=1)
        
        # Assert
        assert result.account_name == 'Test Account'
        mock_find_by_number.assert_called_once_with('TEST-001')
        mock_create.assert_called_once()
    
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
    
    @patch.object(AccountRepository, 'find_by_account_number')
    def test_create_account_duplicate_number(self, mock_find_by_number):
        """Test account creation with duplicate account number"""
        # Setup
        existing_account = Account({
            'id': 1,
            'account_number': '1000',
            'account_name': 'Existing',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'is_system_account': False,
            'opening_balance': 0,
            'sub_type': None,
            'parent_account_id': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        })
        mock_find_by_number.return_value = existing_account
        
        # Execute & Assert
        data = {
            'account_number': '1000',
            'account_name': 'New Account',
            'account_type': 'Asset',
            'balance_type': 'debit'
        }
        
        with pytest.raises(ValueError, match='Account number already exists'):
            account_service.create_account(data, user_id=1)
    
    @patch.object(AccountRepository, 'update')
    @patch.object(AccountRepository, 'find_by_id')
    def test_update_account_success(self, mock_find_by_id, mock_update):
        """Test successful account update"""
        # Setup
        existing_account = Account({
            'id': 1,
            'account_name': 'Original',
            'is_system_account': False,
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'opening_balance': 0,
            'sub_type': None,
            'parent_account_id': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        })
        updated_account = Account({
            'id': 1,
            'account_name': 'Updated',
            'is_system_account': False,
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'opening_balance': 0,
            'sub_type': None,
            'parent_account_id': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        })
        
        mock_find_by_id.return_value = existing_account
        mock_update.return_value = updated_account
        
        # Execute
        result = account_service.update_account(1, {'account_name': 'Updated'}, user_id=1)
        
        # Assert
        assert result.account_name == 'Updated'
        mock_update.assert_called_once()
    
    @patch.object(AccountRepository, 'find_by_id')
    def test_update_system_account_restriction(self, mock_find_by_id):
        """Test that system accounts cannot have type/balance_type modified"""
        # Setup
        system_account = Account({
            'id': 1,
            'account_name': 'System Account',
            'is_system_account': True,
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'opening_balance': 0,
            'sub_type': None,
            'parent_account_id': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        })
        mock_find_by_id.return_value = system_account
        
        # Execute & Assert
        with pytest.raises(ValueError, match='Cannot modify account type or balance type'):
            account_service.update_account(1, {'account_type': 'Liability'}, user_id=1)
    
    @patch.object(AccountRepository, 'find_by_id')
    def test_delete_system_account(self, mock_find_by_id):
        """Test that system accounts cannot be deleted"""
        # Setup
        system_account = Account({
            'id': 1,
            'is_system_account': True,
            'account_name': 'System',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'opening_balance': 0,
            'sub_type': None,
            'parent_account_id': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        })
        mock_find_by_id.return_value = system_account
        
        # Execute & Assert
        with pytest.raises(ValueError, match='Cannot delete system account'):
            account_service.delete_account(1)
    
    @patch.object(AccountRepository, 'find_by_id')
    def test_validate_circular_hierarchy(self, mock_find_by_id):
        """Test prevention of circular parent-child relationships"""
        # Setup - account 1 has parent 2, and we're trying to make 2's parent 1
        # This would create a circular reference: 1 -> 2 -> 1
        account1 = Account({
            'id': 1,
            'parent_account_id': 2,  # Account 1 currently has parent 2
            'account_name': 'Account 1',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'is_system_account': False,
            'opening_balance': 0,
            'sub_type': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        })
        account2 = Account({
            'id': 2,
            'parent_account_id': None,  # Account 2 has no parent currently
            'account_name': 'Account 2',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'is_active': True,
            'is_system_account': False,
            'opening_balance': 0,
            'sub_type': None,
            'description': None,
            'tax_line_id': None,
            'opening_balance_date': None,
            'created_at': None,
            'updated_at': None,
            'created_by': None,
            'updated_by': None
        })
        
        def find_by_id_side_effect(account_id):
            if account_id == 1:
                return account1
            elif account_id == 2:
                return account2
            return None
        
        mock_find_by_id.side_effect = find_by_id_side_effect
        
        # Execute & Assert
        # We're trying to set account 1's parent to 2, but account 1 already has parent 2
        # Wait, that's not circular. Let me think...
        # Actually, we want to test: if we try to make account 2's parent = 1,
        # but account 1's parent is 2, that would be circular.
        # So we're validating: can account 1 have parent 2? 
        # Check: does account 2 have account 1 as an ancestor? 
        # Account 2's parent is None, so no. But wait, account 1's parent IS 2.
        # So if we're trying to set account 1's parent to 2, and account 1 already has parent 2, that's not a change.
        # Let me re-read the validation logic...
        # The validation checks if new_parent_id is a descendant of account_id.
        # If account_id=1 and new_parent_id=2, we check if 2 is a descendant of 1.
        # We check: does account 2 have account 1 as an ancestor? 
        # Account 2's parent is None, so no. But wait, we need to check if account 1 is in the chain.
        # Actually, the issue is: if account 1 has parent 2, and we try to make account 2's parent = 1,
        # that would create: 2 -> 1 -> 2, which is circular.
        # So the test should be: validate_account_hierarchy(2, 1) should fail because 1 has parent 2.
        
        # Actually, let me check the actual validation code to understand the logic better
        # The validation prevents: if we're setting account_id's parent to new_parent_id,
        # and new_parent_id is already a descendant of account_id, that's circular.
        # So if account 1 has parent 2, and we try to set account 2's parent to 1,
        # we check: is account 1 a descendant of account 2? 
        # Account 1's parent is 2, so account 1 IS a descendant of 2.
        # So validate_account_hierarchy(2, 1) should fail.
        
        # But wait, the test is calling validate_account_hierarchy(1, 2)
        # This means: can account 1 have parent 2?
        # We check: is account 2 a descendant of account 1?
        # Account 2's parent is None, so account 2 is NOT a descendant of account 1.
        # So this should NOT fail. The test is wrong.
        
        # Let me fix the test to actually test a circular case:
        # If account 1 has parent 2, and we try to set account 2's parent to 1,
        # that would create a circle. So validate_account_hierarchy(2, 1) should fail.
        
        # But actually, looking at the current state:
        # Account 1 has parent 2
        # Account 2 has parent None
        # If we try to set account 2's parent to 1, we check: is account 1 a descendant of account 2?
        # Account 1's parent is 2, so yes, account 1 IS a descendant of account 2.
        # So validate_account_hierarchy(2, 1) should raise an error.
        
        with pytest.raises(ValueError, match='Cannot create circular'):
            account_service.validate_account_hierarchy(2, 1)  # Can account 2 have parent 1? No, because 1 has parent 2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
