# Accounts API Documentation

Base URL: `http://localhost:5001/api/v1`

## Overview

The Accounts API provides full CRUD operations for managing the Chart of Accounts in the POS accounting system. All endpoints follow RESTful conventions and return JSON responses.

## Authentication

Currently, authentication is optional for testing. In production, endpoints should require a valid session token via the `X-Session-Token` header.

## Endpoints

### 1. Get All Accounts
**GET** `/accounts`

Get a list of all accounts with optional filtering.

**Query Parameters:**
- `account_type` (optional): Filter by account type (Asset, Liability, Equity, Revenue, Expense, COGS, Other Income, Other Expense, Cost of Goods Sold)
- `is_active` (optional): Filter by active status (true/false)
- `parent_account_id` (optional): Filter by parent account ID
- `search` (optional): Search by account name or number

**Example Request:**
```bash
curl http://localhost:5001/api/v1/accounts?account_type=Asset&is_active=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "account_number": "1000",
      "account_name": "Cash",
      "account_type": "Asset",
      "sub_type": "Current Asset",
      "balance_type": "debit",
      "is_active": true,
      "is_system_account": false,
      "opening_balance": 0.0,
      "parent_account_id": null,
      "description": null,
      "created_at": "2024-01-01T00:00:00",
      "updated_at": "2024-01-01T00:00:00"
    }
  ],
  "count": 10
}
```

### 2. Get Account by ID
**GET** `/accounts/:id`

Get detailed information about a specific account.

**Example Request:**
```bash
curl http://localhost:5001/api/v1/accounts/1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "account_number": "1000",
    "account_name": "Cash",
    "account_type": "Asset",
    "balance_type": "debit",
    "is_active": true,
    ...
  }
}
```

### 3. Create Account
**POST** `/accounts`

Create a new account.

**Request Body:**
```json
{
  "account_name": "New Account",
  "account_type": "Asset",
  "balance_type": "debit",
  "account_number": "1150",
  "sub_type": "Current Asset",
  "parent_account_id": 1,
  "description": "Account description",
  "opening_balance": 1000.00,
  "opening_balance_date": "2024-01-01"
}
```

**Required Fields:**
- `account_name` (string, max 255 chars)
- `account_type` (enum: Asset, Liability, Equity, Revenue, Expense, COGS, Other Income, Other Expense, Cost of Goods Sold)
- `balance_type` (enum: debit, credit)

**Optional Fields:**
- `account_number` (string, max 20 chars, must be unique)
- `sub_type` (string, max 100 chars)
- `parent_account_id` (integer)
- `description` (string, max 1000 chars)
- `opening_balance` (decimal, default: 0)
- `opening_balance_date` (date, ISO format)

**Example Request:**
```bash
curl -X POST http://localhost:5001/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "account_name": "Test Account",
    "account_type": "Asset",
    "balance_type": "debit"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": 11,
    "account_name": "Test Account",
    ...
  }
}
```

### 4. Update Account
**PUT** `/accounts/:id`

Update an existing account.

**Request Body:**
```json
{
  "account_name": "Updated Account Name",
  "description": "Updated description",
  "is_active": true
}
```

All fields are optional. Only provided fields will be updated.

**Example Request:**
```bash
curl -X PUT http://localhost:5001/api/v1/accounts/1 \
  -H "Content-Type: application/json" \
  -d '{"account_name": "Updated Name"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Account updated successfully",
  "data": {
    "id": 1,
    "account_name": "Updated Name",
    ...
  }
}
```

### 5. Delete Account
**DELETE** `/accounts/:id`

Delete an account. The account cannot be deleted if:
- It has child accounts
- It has been used in transactions
- It is a system account

**Example Request:**
```bash
curl -X DELETE http://localhost:5001/api/v1/accounts/11
```

**Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

### 6. Get Account Children
**GET** `/accounts/:id/children`

Get all child accounts of a parent account.

**Example Request:**
```bash
curl http://localhost:5001/api/v1/accounts/1/children
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "account_name": "Child Account",
      ...
    }
  ]
}
```

### 7. Get Account Tree
**GET** `/accounts/tree`

Get hierarchical account tree structure.

**Query Parameters:**
- `rootId` (optional): Start tree from specific account ID

**Example Request:**
```bash
curl http://localhost:5001/api/v1/accounts/tree
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": 1,
        "account_name": "Assets",
        "children": [
          {
            "id": 2,
            "account_name": "Current Assets",
            "children": []
          }
        ]
      }
    ]
  }
}
```

### 8. Get Account Balance
**GET** `/accounts/:id/balance`

Get current balance for an account.

**Query Parameters:**
- `asOfDate` (optional): Date to calculate balance as of (YYYY-MM-DD format)

**Example Request:**
```bash
curl http://localhost:5001/api/v1/accounts/1/balance?asOfDate=2024-01-01
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account_id": 1,
    "account_name": "Cash",
    "balance": 5000.00,
    "balance_type": "debit",
    "as_of_date": "2024-01-01"
  }
}
```

### 9. Toggle Account Status
**PATCH** `/accounts/:id/toggle-status`

Toggle the active status of an account.

**Example Request:**
```bash
curl -X PATCH http://localhost:5001/api/v1/accounts/1/toggle-status
```

**Response:**
```json
{
  "success": true,
  "message": "Account activated successfully",
  "data": {
    "id": 1,
    "is_active": true,
    ...
  }
}
```

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Error message here"
}
```

For validation errors:
```json
{
  "success": false,
  "errors": [
    {
      "field": "account_name",
      "message": "Account name is required"
    }
  ]
}
```

### Common Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Internal Server Error

## Business Rules

1. **Account Types**: Must be one of: Asset, Liability, Equity, Revenue, Expense, COGS, Other Income, Other Expense, Cost of Goods Sold
2. **Balance Types**: Must be either "debit" or "credit"
3. **Account Numbers**: Must be unique if provided
4. **System Accounts**: Cannot have account_type or balance_type modified, cannot be deleted
5. **Parent-Child Relationships**: Cannot create circular references
6. **Deletion Restrictions**: Cannot delete accounts with children or that have been used in transactions

## Testing

### Run Unit Tests
```bash
pytest tests/test_account_service.py -v
```

### Run Integration Tests
```bash
pytest tests/test_account_api_integration.py -v
```

### Manual Testing with curl

```bash
# Get all accounts
curl http://localhost:5001/api/v1/accounts

# Create account
curl -X POST http://localhost:5001/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"account_name": "Test", "account_type": "Asset", "balance_type": "debit"}'

# Get account by ID
curl http://localhost:5001/api/v1/accounts/1

# Update account
curl -X PUT http://localhost:5001/api/v1/accounts/1 \
  -H "Content-Type: application/json" \
  -d '{"account_name": "Updated"}'

# Delete account
curl -X DELETE http://localhost:5001/api/v1/accounts/1
```
