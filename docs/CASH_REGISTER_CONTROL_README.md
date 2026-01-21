# Cash Register Control System

A comprehensive cash register management system for tracking register sessions, cash transactions, and daily reconciliation.

## Features

- **Register Session Management**: Open and close register sessions with starting/ending cash tracking
- **Cash Transaction Tracking**: Record cash in/out, deposits, withdrawals, and adjustments
- **Automatic Reconciliation**: Calculates expected vs. actual cash with discrepancy tracking
- **Session History**: View detailed summaries of past register sessions
- **Audit Trail**: All actions are logged for compliance and security

## Installation

### Step 1: Run the Migration

Run the migration script to create the necessary database tables:

```bash
python migrate_cash_register_control.py
```

This will create:
- `cash_register_sessions` - Tracks register open/close sessions
- `cash_transactions` - Records cash in/out transactions

### Step 2: Verify Backend Functions

The backend functions have been added to `database.py`:
- `open_cash_register()` - Open a new register session
- `close_cash_register()` - Close and reconcile a session
- `add_cash_transaction()` - Record cash transactions
- `get_register_session()` - Retrieve session data
- `get_register_summary()` - Get detailed session summary
- `reconcile_register_session()` - Manager reconciliation

### Step 3: Verify API Endpoints

The API endpoints have been added to `web_viewer.py`:
- `POST /api/register/open` - Open a register
- `POST /api/register/close` - Close a register
- `POST /api/register/transaction` - Add cash transaction
- `GET /api/register/session` - Get session(s)
- `GET /api/register/summary` - Get session summary
- `POST /api/register/reconcile` - Reconcile session

### Step 4: Access the Frontend

The Cash Register component is available at:
- Route: `/cash-register`
- Component: `frontend/src/pages/CashRegister.jsx`

## Usage

### Opening a Register

1. Navigate to the Cash Register page
2. Click "Open Register"
3. Enter:
   - Register ID (default: 1)
   - Starting cash amount
   - Optional notes
4. Click "Open Register"

### During a Shift

While the register is open, you can:
- **Add Cash Transactions**: Record cash in/out, deposits, withdrawals, or adjustments
- **View Current Session**: See starting cash and session details
- **Process Sales**: Cash sales are automatically tracked when orders are created

### Closing a Register

1. Click "Close Register"
2. Enter the actual ending cash count
3. Add optional notes
4. Click "Close Register"

The system will automatically:
- Calculate expected cash (starting + sales - refunds + cash in - cash out)
- Calculate discrepancy (ending - expected)
- Update session status to "closed"

### Viewing Session History

- View recent sessions in the table
- Click "View Summary" to see detailed breakdown including:
  - Session details
  - Sales summary
  - All cash transactions
  - Reconciliation details

### Manager Reconciliation

Managers can reconcile closed sessions (mark as approved):
- Use the `/api/register/reconcile` endpoint
- Requires manager permissions
- Updates session status to "reconciled"

## Database Schema

### cash_register_sessions

| Column | Type | Description |
|--------|------|-------------|
| session_id | INTEGER | Primary key |
| register_id | INTEGER | Register number |
| employee_id | INTEGER | Employee who opened |
| opened_at | TIMESTAMP | Session start time |
| closed_at | TIMESTAMP | Session end time |
| starting_cash | REAL | Starting cash amount |
| ending_cash | REAL | Actual ending cash |
| expected_cash | REAL | Calculated expected cash |
| cash_sales | REAL | Total cash sales |
| cash_refunds | REAL | Total cash refunds |
| cash_in | REAL | Total cash in |
| cash_out | REAL | Total cash out |
| discrepancy | REAL | Difference (ending - expected) |
| status | TEXT | 'open', 'closed', 'reconciled' |
| notes | TEXT | Session notes |

### cash_transactions

| Column | Type | Description |
|--------|------|-------------|
| transaction_id | INTEGER | Primary key |
| session_id | INTEGER | Register session |
| transaction_type | TEXT | 'cash_in', 'cash_out', 'deposit', 'withdrawal', 'adjustment' |
| amount | REAL | Transaction amount |
| reason | TEXT | Reason for transaction |
| employee_id | INTEGER | Employee who made transaction |
| transaction_date | TIMESTAMP | Transaction time |
| notes | TEXT | Transaction notes |

## API Examples

### Open Register

```javascript
POST /api/register/open
{
  "session_token": "...",
  "register_id": 1,
  "starting_cash": 100.00,
  "notes": "Morning shift"
}
```

### Close Register

```javascript
POST /api/register/close
{
  "session_token": "...",
  "session_id": 123,
  "ending_cash": 1250.50,
  "notes": "All cash counted"
}
```

### Add Cash Transaction

```javascript
POST /api/register/transaction
{
  "session_token": "...",
  "session_id": 123,
  "transaction_type": "cash_out",
  "amount": 50.00,
  "reason": "Petty cash",
  "notes": "For office supplies"
}
```

### Get Session Summary

```javascript
GET /api/register/summary?session_id=123&session_token=...
```

## Integration with Existing System

The cash register system integrates with:
- **Orders**: Automatically tracks cash sales from orders with `payment_method = 'cash'`
- **Payment Transactions**: Links to existing payment tracking
- **Employee Sessions**: Uses existing employee authentication
- **Audit Log**: All actions are logged in the audit_log table

## Security & Permissions

Consider adding permissions for:
- `open_register` - Open cash register
- `close_register` - Close cash register
- `add_cash_transaction` - Record cash transactions
- `reconcile_register` - Manager reconciliation
- `view_register_history` - View session history

## Best Practices

1. **Daily Reconciliation**: Close registers at end of each shift
2. **Document Discrepancies**: Always add notes when closing with discrepancies
3. **Regular Audits**: Review session summaries regularly
4. **Cash Handling**: Record all cash in/out transactions immediately
5. **Manager Review**: Have managers reconcile all closed sessions

## Troubleshooting

### Register Already Open
- Only one register session can be open per register_id
- Close existing session before opening a new one

### Discrepancy Calculations
- Expected cash = starting + sales - refunds + cash_in - cash_out
- Discrepancy = ending_cash - expected_cash
- Positive discrepancy = overage, negative = shortage

### Session Not Found
- Verify session_id is correct
- Check that session hasn't been deleted
- Ensure session exists in database

## Future Enhancements

Potential improvements:
- Multiple register support (already supported, just needs UI)
- Cash drawer hardware integration
- Automated cash counting
- Shift reports and analytics
- Email notifications for discrepancies
- Integration with accounting system

## Support

For issues or questions:
1. Check the audit_log table for transaction history
2. Review session summaries for detailed breakdowns
3. Verify employee permissions
4. Check database connection and migration status
