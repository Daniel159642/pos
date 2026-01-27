#!/usr/bin/env python3
"""
Integration tests for Transaction API endpoints
"""

import sys
import os
import pytest
import json
from datetime import date

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from web_viewer import app


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestTransactionAPI:
    """Integration tests for Transaction API"""
    
    def test_get_all_transactions(self, client):
        """Test GET /api/v1/transactions"""
        response = client.get('/api/v1/transactions')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'data' in data
        assert isinstance(data['data'], list)
        assert 'pagination' in data
    
    def test_create_transaction(self, client):
        """Test POST /api/v1/transactions"""
        transaction_data = {
            'transaction_date': date.today().isoformat(),
            'transaction_type': 'journal_entry',
            'description': 'Test Journal Entry',
            'lines': [
                {
                    'account_id': 1,
                    'debit_amount': 100.00,
                    'credit_amount': 0.00,
                    'description': 'Debit entry'
                },
                {
                    'account_id': 2,
                    'debit_amount': 0.00,
                    'credit_amount': 100.00,
                    'description': 'Credit entry'
                }
            ]
        }
        
        response = client.post(
            '/api/v1/transactions',
            data=json.dumps(transaction_data),
            content_type='application/json'
        )
        
        assert response.status_code in [201, 400]  # 400 if accounts don't exist
        data = json.loads(response.data)
        
        if response.status_code == 201:
            assert data['success'] is True
            assert 'data' in data
            assert 'transaction' in data['data']
            assert 'lines' in data['data']
            # Clean up
            transaction_id = data['data']['transaction']['id']
            client.delete(f'/api/v1/transactions/{transaction_id}')
    
    def test_create_unbalanced_transaction(self, client):
        """Test POST /api/v1/transactions with unbalanced entries"""
        transaction_data = {
            'transaction_date': date.today().isoformat(),
            'transaction_type': 'journal_entry',
            'description': 'Unbalanced Entry',
            'lines': [
                {
                    'account_id': 1,
                    'debit_amount': 100.00,
                    'credit_amount': 0.00,
                    'description': 'Debit'
                },
                {
                    'account_id': 2,
                    'debit_amount': 0.00,
                    'credit_amount': 50.00,  # Unbalanced!
                    'description': 'Credit'
                }
            ]
        }
        
        response = client.post(
            '/api/v1/transactions',
            data=json.dumps(transaction_data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
        assert 'not balanced' in data['message'].lower() or 'balance' in data['message'].lower()
    
    def test_get_transaction_by_id(self, client):
        """Test GET /api/v1/transactions/:id"""
        # First get all transactions to find a valid ID
        response = client.get('/api/v1/transactions')
        data = json.loads(response.data)
        
        if data['data']:
            transaction_id = data['data'][0]['transaction']['id']
            response = client.get(f'/api/v1/transactions/{transaction_id}')
            assert response.status_code == 200
            transaction_data = json.loads(response.data)
            assert transaction_data['success'] is True
            assert transaction_data['data']['transaction']['id'] == transaction_id
    
    def test_get_general_ledger(self, client):
        """Test GET /api/v1/transactions/general-ledger"""
        response = client.get('/api/v1/transactions/general-ledger')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert isinstance(data['data'], list)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
