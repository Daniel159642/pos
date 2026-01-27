#!/usr/bin/env python3
"""
Integration tests for Account API endpoints
"""

import sys
import os
import pytest
import json

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from web_viewer import app


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestAccountAPI:
    """Integration tests for Account API"""
    
    def test_get_all_accounts(self, client):
        """Test GET /api/v1/accounts"""
        response = client.get('/api/v1/accounts')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'data' in data
        assert isinstance(data['data'], list)
    
    def test_get_accounts_with_filter(self, client):
        """Test GET /api/v1/accounts?account_type=Asset"""
        response = client.get('/api/v1/accounts?account_type=Asset')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        if data['data']:
            assert all(acc['account_type'] == 'Asset' for acc in data['data'])
    
    def test_create_account(self, client):
        """Test POST /api/v1/accounts"""
        account_data = {
            'account_name': 'Test Cash Account',
            'account_type': 'Asset',
            'balance_type': 'debit',
            'account_number': 'TEST-001'
        }
        
        response = client.post(
            '/api/v1/accounts',
            data=json.dumps(account_data),
            content_type='application/json'
        )
        
        assert response.status_code in [201, 409]  # 409 if duplicate
        data = json.loads(response.data)
        
        if response.status_code == 201:
            assert data['success'] is True
            assert data['data']['account_name'] == 'Test Cash Account'
            # Clean up
            account_id = data['data']['id']
            client.delete(f'/api/v1/accounts/{account_id}')
    
    def test_create_account_invalid_data(self, client):
        """Test POST /api/v1/accounts with invalid data"""
        invalid_data = {
            'account_name': '',  # Empty name
            'account_type': 'Invalid'  # Invalid type
        }
        
        response = client.post(
            '/api/v1/accounts',
            data=json.dumps(invalid_data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
    
    def test_get_account_by_id(self, client):
        """Test GET /api/v1/accounts/:id"""
        # First get all accounts to find a valid ID
        response = client.get('/api/v1/accounts')
        data = json.loads(response.data)
        
        if data['data']:
            account_id = data['data'][0]['id']
            response = client.get(f'/api/v1/accounts/{account_id}')
            assert response.status_code == 200
            account_data = json.loads(response.data)
            assert account_data['success'] is True
            assert account_data['data']['id'] == account_id
    
    def test_get_nonexistent_account(self, client):
        """Test GET /api/v1/accounts/999999"""
        response = client.get('/api/v1/accounts/999999')
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['success'] is False
    
    def test_update_account(self, client):
        """Test PUT /api/v1/accounts/:id"""
        # First create an account
        account_data = {
            'account_name': 'Test Update Account',
            'account_type': 'Asset',
            'balance_type': 'debit'
        }
        
        create_response = client.post(
            '/api/v1/accounts',
            data=json.dumps(account_data),
            content_type='application/json'
        )
        
        if create_response.status_code == 201:
            account_id = json.loads(create_response.data)['data']['id']
            
            # Update the account
            update_data = {'account_name': 'Updated Account Name'}
            response = client.put(
                f'/api/v1/accounts/{account_id}',
                data=json.dumps(update_data),
                content_type='application/json'
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['success'] is True
            assert data['data']['account_name'] == 'Updated Account Name'
            
            # Clean up
            client.delete(f'/api/v1/accounts/{account_id}')
    
    def test_get_account_tree(self, client):
        """Test GET /api/v1/accounts/tree"""
        response = client.get('/api/v1/accounts/tree')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'data' in data
    
    def test_get_account_balance(self, client):
        """Test GET /api/v1/accounts/:id/balance"""
        # Get first account
        response = client.get('/api/v1/accounts')
        data = json.loads(response.data)
        
        if data['data']:
            account_id = data['data'][0]['id']
            response = client.get(f'/api/v1/accounts/{account_id}/balance')
            assert response.status_code == 200
            balance_data = json.loads(response.data)
            assert balance_data['success'] is True
            assert 'balance' in balance_data['data']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
