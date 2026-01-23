# Transactions API Documentation

Base URL: `http://localhost:5001/api/v1`

## Overview

The Transactions API provides full CRUD operations for managing accounting transactions (journal entries) in the POS accounting system. All transactions follow double-entry bookkeeping principles where total debits must equal total credits.

## Authentication

Currently, authentication is optional for testing. In production, endpoints should require a valid session token via the `X-Session-Token` header.

## Endpoints

### 1. Get All Transactions
**GET** `/transactions`

Get a list of all transactions with optional filtering and pagination.

**Query Parameters:**
- `start_date` (optional): Filter by start date (YYYY-MM-DD)
- `end_date` (optional): Filter by end date (YYYY-MM-DD)
- `account_id` (optional): Filter by account ID
- `transaction_type` (optional): Filter by type (journal_entry, invoice, bill, payment, etc.)
- `is_posted` (optional): Filter by posted status (true/false)
- `is_void` (optional): Filter by void status (true/false)
- `search` (optional): Search by transaction number or description
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50)

**Example Request:**
```bash
curl "http://localhost:5001/api/v1/transactions?start_date=2024-01-01&is_posted=true"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "transaction": {
        "id": 1,
        "transaction_number": "TRX-20240101-0001",
        "transaction_date": "2024-01-01",
        "transaction_type": "journal_entry",
        "description": "Opening balance",
        "is_posted": true,
        "is_void": false,
        ...
      },
      "lines": [
        {
          "id": 1,
          "account_id": 1,
          "account_name": "Cash",
          "account_number": "1000",
          "debit_amount": 1000.00,
          "credit_amount": 0.00,
          "description": "Cash received"
        },
        {
          "id": 2,
          "account_id": 2,
          "account_name": "Revenue",
          "account_number": "4000",
          "debit_amount": 0.00,
          "credit_amount": 1000.00,
          "description": "Revenue earned"
        }
      ]
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "total_pages": 2
  }
}
```

### 2. Get Transaction by ID
**GET** `/transactions/:id`

Get detailed information about a specific transaction including all lines.

**Example Request:**
```bash
curl http://localhost:5001/api/v1/transactions/1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction": { ... },
    "lines": [ ... ]
  }
}
```

### 3. Create Transaction
**POST** `/transactions`

Create a new transaction (journal entry).

**Request Body:**
```json
{
  "transaction_date": "2024-01-15",
  "transaction_type": "journal_entry",
  "reference_number": "REF-001",
  "description": "Purchase of equipment",
  "lines": [
    {
      "account_id": 5,
      "debit_amount": 5000.00,
      "credit_amount": 0.00,
      "description": "Equipment purchase",
      "entity_type": null,
      "entity_id": null,
      "class_id": null,
      "location_id": null,
      "billable": false
    },
    {
      "account_id": 1,
      "debit_amount": 0.00,
      "credit_amount": 5000.00,
      "description": "Payment from cash"
    }
  ]
}
```

**Required Fields:**
- `transaction_date` (date, ISO format)
- `transaction_type` (string, must be valid type)
- `description` (string, max 500 chars)
- `lines` (array, minimum 2 lines)

**Line Requirements:**
- Each line must have `account_id`, `debit_amount`, `credit_amount`, `description`
- Each line must have either debit OR credit (not both, not neither)
- Total debits must equal total credits

**Example Request:**
```bash
curl -X POST http://localhost:5001/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_date": "2024-01-15",
    "transaction_type": "journal_entry",
    "description": "Test transaction",
    "lines": [
      {"account_id": 1, "debit_amount": 100, "credit_amount": 0, "description": "Debit"},
      {"account_id": 2, "debit_amount": 0, "credit_amount": 100, "description": "Credit"}
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "transaction": { ... },
    "lines": [ ... ]
  }
}
```

### 4. Update Transaction
**PUT** `/transactions/:id`

Update an existing transaction. Cannot update posted transactions.

**Request Body:**
```json
{
  "description": "Updated description",
  "lines": [
    {
      "account_id": 1,
      "debit_amount": 200.00,
      "credit_amount": 0.00,
      "description": "Updated debit"
    },
    {
      "account_id": 2,
      "debit_amount": 0.00,
      "credit_amount": 200.00,
      "description": "Updated credit"
    }
  ]
}
```

**Restrictions:**
- Cannot update posted transactions (must unpost first)
- Cannot update voided transactions
- Updated lines must be balanced

### 5. Delete Transaction
**DELETE** `/transactions/:id`

Delete a transaction. Cannot delete posted or voided transactions.

**Restrictions:**
- Cannot delete posted transactions (must unpost or void first)
- Cannot delete voided transactions

### 6. Post Transaction
**POST** `/transactions/:id/post`

Post a transaction (makes it affect account balances).

**Restrictions:**
- Transaction must be balanced
- Transaction must not be voided
- Transaction must not already be posted

**Example Request:**
```bash
curl -X POST http://localhost:5001/api/v1/transactions/1/post
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction posted successfully",
  "data": { ... }
}
```

### 7. Unpost Transaction
**POST** `/transactions/:id/unpost`

Unpost a transaction (reverses its effect on account balances).

**Restrictions:**
- Transaction must be posted
- Transaction must not be voided

### 8. Void Transaction
**POST** `/transactions/:id/void`

Void a transaction.

**Request Body:**
```json
{
  "reason": "Entered in error"
}
```

**Restrictions:**
- Transaction must not already be voided
- Reason is required

**Example Request:**
```bash
curl -X POST http://localhost:5001/api/v1/transactions/1/void \
  -H "Content-Type: application/json" \
  -d '{"reason": "Entered in error"}'
```

### 9. Get General Ledger
**GET** `/transactions/general-ledger`

Get all posted transactions in general ledger format.

**Query Parameters:**
- `account_id` (optional): Filter by account
- `start_date` (optional): Filter by start date
- `end_date` (optional): Filter by end date

**Example Request:**
```bash
curl "http://localhost:5001/api/v1/transactions/general-ledger?start_date=2024-01-01"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "transaction_id": 1,
      "transaction_number": "TRX-001",
      "transaction_date": "2024-01-01",
      "account_id": 1,
      "account_name": "Cash",
      "debit_amount": 1000.00,
      "credit_amount": 0.00,
      ...
    }
  ]
}
```

### 10. Get Account Ledger
**GET** `/transactions/account-ledger/:accountId`

Get all transactions for a specific account with running balance.

**Query Parameters:**
- `start_date` (optional): Filter by start date
- `end_date` (optional): Filter by end date

**Example Request:**
```bash
curl "http://localhost:5001/api/v1/transactions/account-ledger/1?start_date=2024-01-01"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account": {
      "id": 1,
      "account_name": "Cash",
      ...
    },
    "entries": [
      {
        "transaction_id": 1,
        "debit_amount": 1000.00,
        "credit_amount": 0.00,
        "running_balance": 1000.00,
        ...
      }
    ],
    "ending_balance": 1000.00
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
      "field": "lines",
      "message": "At least 2 transaction lines are required"
    }
  ]
}
```

### Common Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

## Business Rules

1. **Double-Entry Bookkeeping**: Total debits must equal total credits
2. **Minimum Lines**: Transactions must have at least 2 lines
3. **Line Validation**: Each line must have either debit OR credit (not both, not neither)
4. **Account Validation**: All accounts must exist and be active
5. **Posting Restrictions**: Cannot modify posted transactions (must unpost first)
6. **Voiding**: Voided transactions cannot be modified or deleted
7. **Transaction Types**: Must be one of: journal_entry, invoice, bill, payment, sales_receipt, purchase, refund, adjustment, transfer, deposit, withdrawal

## Transaction Number Generation

Transaction numbers are automatically generated by database trigger if not provided. Format: `TRX-YYYYMMDD-NNNN`

## Testing

### Run Unit Tests
```bash
pytest tests/test_transaction_service.py -v
```

### Run Integration Tests
```bash
pytest tests/test_transaction_api_integration.py -v
```

### Manual Testing with curl

```bash
# Get all transactions
curl http://localhost:5001/api/v1/transactions

# Create balanced transaction
curl -X POST http://localhost:5001/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_date": "2024-01-15",
    "transaction_type": "journal_entry",
    "description": "Test",
    "lines": [
      {"account_id": 1, "debit_amount": 100, "credit_amount": 0, "description": "Debit"},
      {"account_id": 2, "debit_amount": 0, "credit_amount": 100, "description": "Credit"}
    ]
  }'

# Post transaction
curl -X POST http://localhost:5001/api/v1/transactions/1/post

# Get general ledger
curl http://localhost:5001/api/v1/transactions/general-ledger
```
