# Entity-Relationship Diagram (ERD) - POS Accounting System

## Core Accounting Relationships

```
accounts (Chart of Accounts)
├── id (PK)
├── parent_account_id (FK → accounts.id) [Self-referencing hierarchy]
└── [One-to-Many] → transaction_lines.account_id

transactions (Journal Entries)
├── id (PK)
├── transaction_number (UNIQUE)
└── [One-to-Many] → transaction_lines.transaction_id
    └── [One-to-Many] → invoices.transaction_id
    └── [One-to-Many] → bills.transaction_id
    └── [One-to-Many] → payments.transaction_id
    └── [One-to-Many] → bill_payments.transaction_id
    └── [One-to-Many] → inventory_transactions.transaction_id

transaction_lines (Journal Entry Lines)
├── id (PK)
├── transaction_id (FK → transactions.id) [CASCADE DELETE]
├── account_id (FK → accounts.id)
├── class_id (FK → classes.id)
├── location_id (FK → locations.id)
└── [Debits must equal Credits per transaction]
```

## Customer & Invoice Relationships

```
customers
├── id (PK)
├── customer_number (UNIQUE)
├── tax_rate_id (FK → tax_rates.id)
└── [One-to-Many] → invoices.customer_id
    └── [One-to-Many] → invoice_lines.invoice_id [CASCADE DELETE]
    └── [One-to-Many] → payments.customer_id
        └── [One-to-Many] → payment_applications.payment_id [CASCADE DELETE]
            └── invoice_id (FK → invoices.id)

invoices
├── id (PK)
├── invoice_number (UNIQUE)
├── customer_id (FK → customers.id)
├── transaction_id (FK → transactions.id)
└── [One-to-Many] → invoice_lines.invoice_id [CASCADE DELETE]
    ├── item_id (FK → items.id)
    ├── account_id (FK → accounts.id)
    └── tax_rate_id (FK → tax_rates.id)
```

## Vendor & Bill Relationships

```
vendors
├── id (PK)
├── vendor_number (UNIQUE)
└── [One-to-Many] → bills.vendor_id
    └── [One-to-Many] → bill_lines.bill_id [CASCADE DELETE]
    └── [One-to-Many] → bill_payments.vendor_id
        └── [One-to-Many] → bill_payment_applications.bill_payment_id [CASCADE DELETE]
            └── bill_id (FK → bills.id)

bills
├── id (PK)
├── bill_number (UNIQUE)
├── vendor_id (FK → vendors.id)
├── transaction_id (FK → transactions.id)
└── [One-to-Many] → bill_lines.bill_id [CASCADE DELETE]
    ├── item_id (FK → items.id)
    ├── account_id (FK → accounts.id)
    ├── class_id (FK → classes.id)
    ├── customer_id (FK → customers.id) [if billable]
    └── tax_rate_id (FK → tax_rates.id)
```

## Inventory Relationships

```
items
├── id (PK)
├── item_number (UNIQUE)
├── income_account_id (FK → accounts.id)
├── expense_account_id (FK → accounts.id)
├── asset_account_id (FK → accounts.id)
├── tax_rate_id (FK → tax_rates.id)
└── [One-to-Many] → inventory_transactions.item_id
    └── transaction_id (FK → transactions.id)

inventory_transactions
├── id (PK)
├── item_id (FK → items.id)
├── transaction_id (FK → transactions.id)
└── [Tracks quantity changes and costs]
```

## Payment Relationships

```
payments (Customer Payments)
├── id (PK)
├── payment_number (UNIQUE)
├── customer_id (FK → customers.id)
├── deposit_to_account_id (FK → accounts.id)
├── transaction_id (FK → transactions.id)
└── [One-to-Many] → payment_applications.payment_id [CASCADE DELETE]
    └── invoice_id (FK → invoices.id)

bill_payments (Vendor Payments)
├── id (PK)
├── payment_number (UNIQUE)
├── vendor_id (FK → vendors.id)
├── paid_from_account_id (FK → accounts.id)
├── transaction_id (FK → transactions.id)
└── [One-to-Many] → bill_payment_applications.bill_payment_id [CASCADE DELETE]
    └── bill_id (FK → bills.id)
```

## Supporting Tables

```
tax_rates
├── id (PK)
├── tax_agency_id (FK → vendors.id)
└── [Referenced by] customers, invoice_lines, bill_lines, items

classes (Departments)
├── id (PK)
└── [Referenced by] transaction_lines.class_id, bill_lines.class_id

locations
├── id (PK)
└── [Referenced by] transaction_lines.location_id

users
├── id (PK)
└── [Referenced by] audit_log.user_id, accounts.created_by, etc.

audit_log
├── id (PK)
├── table_name, record_id (Composite lookup)
├── user_id (FK → users.id)
└── [Tracks all changes to major tables]
```

## Key Constraints

1. **Double-Entry Validation**: Sum of debits = Sum of credits for each transaction
2. **Cascade Deletes**: 
   - Delete transaction → deletes transaction_lines
   - Delete invoice → deletes invoice_lines
   - Delete bill → deletes bill_lines
   - Delete payment → deletes payment_applications
3. **Balance Validation**: 
   - invoice.amount_paid + invoice.balance_due = invoice.total_amount
   - bill.amount_paid + bill.balance_due = bill.total_amount
4. **Date Constraints**: due_date >= invoice_date, due_date >= bill_date
5. **Unique Constraints**: All number fields (transaction_number, invoice_number, etc.)

## Data Flow

1. **Invoice Creation**:
   - Create invoice → Create invoice_lines → Create transaction → Create transaction_lines
   
2. **Payment Application**:
   - Create payment → Create payment_applications → Update invoice balance → Update transaction_lines

3. **Inventory Sale**:
   - Create invoice with items → Create inventory_transaction → Update item.quantity_on_hand

4. **Bill Payment**:
   - Create bill_payment → Create bill_payment_applications → Update bill balance → Update transaction_lines
