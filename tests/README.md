# Testing Guide

This directory contains all test files for the POS accounting system.

## Test Structure

```
tests/
├── conftest.py                      # Pytest configuration and fixtures
├── test_account_service.py          # Unit tests for account service layer
├── test_account_model.py            # Unit tests for account model/repository
├── test_account_api_integration.py  # Integration tests for account API endpoints
└── README.md                        # This file
```

## Running Tests

### Run All Tests
```bash
pytest
```

### Run Specific Test File
```bash
pytest tests/test_account_service.py
```

### Run Specific Test Class
```bash
pytest tests/test_account_service.py::TestAccountService
```

### Run Specific Test Method
```bash
pytest tests/test_account_service.py::TestAccountService::test_create_account_success
```

### Run with Verbose Output
```bash
pytest -v
```

### Run with Coverage Report
```bash
pytest --cov=backend --cov-report=html
```

This will generate an HTML coverage report in `htmlcov/index.html`.

### Run Only Unit Tests
```bash
pytest -m unit
```

### Run Only Integration Tests
```bash
pytest -m integration
```

## Test Categories

### Unit Tests
- **test_account_service.py**: Tests business logic in the service layer
- **test_account_model.py**: Tests model/repository layer

### Integration Tests
- **test_account_api_integration.py**: Tests full API endpoints with Flask test client

## Test Coverage

Current test coverage focuses on:
- ✅ Account creation with validation
- ✅ Account update with validation
- ✅ Account deletion restrictions
- ✅ System account protection
- ✅ Circular hierarchy prevention
- ✅ API endpoint functionality
- ✅ Error handling

## Writing New Tests

### Unit Test Example
```python
import pytest
from backend.services.account_service import account_service

def test_my_feature():
    """Test description"""
    # Arrange
    data = {'account_name': 'Test'}
    
    # Act
    result = account_service.create_account(data, user_id=1)
    
    # Assert
    assert result.account_name == 'Test'
```

### Integration Test Example
```python
import pytest
import json

def test_api_endpoint(client):
    """Test API endpoint"""
    response = client.get('/api/v1/accounts')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
```

## Test Fixtures

Available fixtures (defined in `conftest.py`):
- `app`: Flask application instance
- `client`: Flask test client
- `mock_account_data`: Sample account data dictionary

## Continuous Integration

Tests should be run:
- Before committing code
- In CI/CD pipeline
- Before deploying to production

## Troubleshooting

### Import Errors
If you get import errors, make sure you're running tests from the project root:
```bash
cd /Users/danielbudnyatsky/pos
pytest
```

### Database Connection Errors
Integration tests may require a database connection. For unit tests, we use mocks to avoid database dependencies.

### Test Failures
Check the test output for detailed error messages. Use `-v` flag for verbose output:
```bash
pytest -v --tb=long
```
