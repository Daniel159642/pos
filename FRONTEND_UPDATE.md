# Frontend Update Summary

## Overview
The React frontend has been updated to include all new database tables and features.

## New Features

### 1. Authentication System
- **Login Component**: Employee authentication with employee code and password
- **Session Management**: Token-based session tracking
- **Logout**: Secure session termination

### 2. Table Categories
The frontend is organized into 5 main categories:

#### Inventory
- Inventory
- Vendors
- Shipments
- Pending Shipments
- Shipment Discrepancies

#### Sales
- Orders (with tax and transaction fees)
- Order Items
- Payment Transactions (with fee tracking)
- Customers

#### HR
- Employees
- Employee Schedule
- Time Clock
- Employee Sessions

#### Accounting
- Chart of Accounts
- Journal Entries
- Journal Entry Lines
- Fiscal Periods
- Retained Earnings

#### System
- Audit Log
- Master Calendar

### 3. Enhanced Table Display
- **Currency Formatting**: Automatic $ formatting for price, cost, total, amount, fee fields
- **Percentage Formatting**: Automatic % formatting for rate fields
- **Date/Time Formatting**: Localized date/time display
- **Boolean Formatting**: Yes/No for boolean fields
- **Improved Styling**: Better visual hierarchy with alternating row colors

### 4. API Endpoints
All tables are accessible via REST API:
- `/api/<table_name>` - Generic table endpoint
- `/api/login` - Employee login
- `/api/verify_session` - Session verification
- `/api/logout` - Employee logout

Specialized endpoints with joins:
- `/api/orders` - Orders with employee/customer names
- `/api/order_items` - Order items with product details
- `/api/payment_transactions` - Payments with order details
- `/api/employee_schedule` - Schedule with employee names
- `/api/time_clock` - Time entries with employee names
- `/api/journal_entries` - Journal entries with employee names
- `/api/journal_entry_lines` - Journal lines with account details
- `/api/shipment_discrepancies` - Discrepancies with full details
- `/api/audit_log` - Audit trail with employee names

## Running the Frontend

### Development Mode
```bash
cd frontend
npm install
npm run dev
```
The frontend will run on http://localhost:3000 with hot reload.

### Production Build
```bash
cd frontend
npm install
npm run build
```
The build will be in `frontend/dist/` and served by the Flask backend.

### Backend Server
```bash
python3 web_viewer.py
```
The backend runs on http://localhost:5001

## Features

### Authentication
- Employees must log in with their employee code and password
- Sessions are tracked and verified
- Logout clears session token

### Data Display
- All tables are displayed in a clean, spreadsheet-like interface
- Automatic formatting for currency, percentages, dates
- Responsive design with horizontal scrolling for wide tables
- Category-based navigation for easy access

### Security
- Table access is whitelisted (only allowed tables can be queried)
- Session-based authentication required
- API endpoints validate session tokens

## New Tables Available

1. **orders** - Sales orders with tax_rate, tax_amount, transaction_fee
2. **order_items** - Order line items with tax_rate, tax_amount
3. **payment_transactions** - Payment records with transaction_fee, transaction_fee_rate, net_amount
4. **customers** - Customer information
5. **employees** - Employee details with authentication
6. **employee_schedule** - Employee shift schedules
7. **time_clock** - Clock in/out records
8. **employee_sessions** - Active login sessions
9. **chart_of_accounts** - Accounting chart of accounts
10. **journal_entries** - Accounting journal entries
11. **journal_entry_lines** - Journal entry line items
12. **fiscal_periods** - Accounting periods
13. **retained_earnings** - Retained earnings records
14. **shipment_discrepancies** - Shipment discrepancy tracking
15. **audit_log** - System audit trail
16. **master_calendar** - Calendar events

## Notes

- The frontend uses Vite for fast development
- Proxy configuration routes `/api/*` to Flask backend on port 5001
- All API calls include session token in headers
- Table data is automatically formatted based on column names











