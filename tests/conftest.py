#!/usr/bin/env python3
"""
Pytest configuration and fixtures
"""

import sys
import os
import pytest

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope='session')
def app():
    """Create Flask app for testing"""
    from web_viewer import app
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    return app


@pytest.fixture(scope='function')
def client(app):
    """Create test client"""
    with app.test_client() as client:
        yield client


@pytest.fixture(scope='function')
def mock_account_data():
    """Sample account data for testing"""
    return {
        'id': 1,
        'account_number': '1000',
        'account_name': 'Test Account',
        'account_type': 'Asset',
        'sub_type': 'Current Asset',
        'parent_account_id': None,
        'balance_type': 'debit',
        'description': 'Test account description',
        'is_active': True,
        'is_system_account': False,
        'tax_line_id': None,
        'opening_balance': 0.0,
        'opening_balance_date': None,
        'created_at': None,
        'updated_at': None,
        'created_by': 1,
        'updated_by': 1
    }
