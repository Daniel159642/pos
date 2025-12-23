# POS Inventory Database

A comprehensive inventory management database for a Point of Sale (POS) system with shipment tracking and vendor management.

## Database Schema

### Inventory Table

The `inventory` table contains the following columns:

- **product_id** (INTEGER, PRIMARY KEY, AUTOINCREMENT) - Unique product identifier
- **product_name** (TEXT, NOT NULL) - Name of the product
- **sku** (TEXT, UNIQUE, NOT NULL) - Stock Keeping Unit (unique identifier)
- **product_price** (REAL, NOT NULL) - Selling price of the product
- **product_cost** (REAL, NOT NULL) - Cost of the product for the store
- **vendor** (TEXT) - Vendor/supplier name (legacy field)
- **vendor_id** (INTEGER) - Foreign key to vendors table
- **photo** (TEXT) - Path or URL to product photo
- **current_quantity** (INTEGER, NOT NULL, DEFAULT 0) - Current stock quantity
- **category** (TEXT) - Product category or department
- **last_restocked** (TIMESTAMP) - Last time inventory was restocked
- **created_at** (TIMESTAMP) - Record creation timestamp
- **updated_at** (TIMESTAMP) - Last update timestamp

### Vendors Table

- **vendor_id** (INTEGER, PRIMARY KEY, AUTOINCREMENT) - Unique vendor identifier
- **vendor_name** (TEXT, NOT NULL) - Name of the vendor
- **contact_person** (TEXT) - Contact person name
- **email** (TEXT) - Vendor email address
- **phone** (TEXT) - Vendor phone number
- **address** (TEXT) - Vendor address
- **created_at** (TIMESTAMP) - Record creation timestamp

### Shipments Table

- **shipment_id** (INTEGER, PRIMARY KEY, AUTOINCREMENT) - Unique shipment identifier
- **vendor_id** (INTEGER) - Foreign key to vendors table
- **shipment_date** (TEXT) - Date shipment was sent
- **received_date** (TEXT) - Date shipment was received
- **purchase_order_number** (TEXT) - PO number
- **tracking_number** (TEXT) - Shipping tracking number
- **total_cost** (REAL) - Total cost of shipment
- **notes** (TEXT) - Additional notes
- **created_at** (TIMESTAMP) - Record creation timestamp

### Shipment_Items Table

- **shipment_item_id** (INTEGER, PRIMARY KEY, AUTOINCREMENT) - Unique item identifier
- **shipment_id** (INTEGER, NOT NULL) - Foreign key to shipments table
- **product_id** (INTEGER, NOT NULL) - Foreign key to inventory table
- **quantity_received** (INTEGER, NOT NULL) - Quantity received in this shipment
- **unit_cost** (REAL, NOT NULL) - Cost per unit
- **lot_number** (TEXT) - Lot/batch number
- **expiration_date** (TEXT) - Product expiration date
- **received_timestamp** (TIMESTAMP) - When item was received

### Sales Table

- **sale_id** (INTEGER, PRIMARY KEY, AUTOINCREMENT) - Unique sale identifier
- **product_id** (INTEGER, NOT NULL) - Foreign key to inventory table
- **quantity_sold** (INTEGER, NOT NULL) - Quantity sold/used
- **sale_price** (REAL, NOT NULL) - Price per unit sold
- **sale_date** (TIMESTAMP) - When the sale occurred
- **notes** (TEXT) - Additional notes about the sale

### Pending_Shipments Table

- **pending_shipment_id** (INTEGER, PRIMARY KEY, AUTOINCREMENT) - Unique pending shipment identifier
- **vendor_id** (INTEGER, NOT NULL) - Foreign key to vendors table
- **expected_date** (TEXT) - Expected delivery date
- **upload_timestamp** (TIMESTAMP) - When document was uploaded
- **file_path** (TEXT) - Path to uploaded document
- **purchase_order_number** (TEXT) - PO number
- **tracking_number** (TEXT) - Shipping tracking number
- **status** (TEXT) - Status: 'pending_review', 'approved', or 'rejected'
- **reviewed_by** (TEXT) - Who reviewed the shipment
- **reviewed_date** (TIMESTAMP) - When it was reviewed
- **notes** (TEXT) - Additional notes

### Pending_Shipment_Items Table

- **pending_item_id** (INTEGER, PRIMARY KEY, AUTOINCREMENT) - Unique item identifier
- **pending_shipment_id** (INTEGER, NOT NULL) - Foreign key to pending_shipments table
- **product_sku** (TEXT) - SKU from vendor document
- **product_name** (TEXT) - Product name from vendor document
- **quantity_expected** (INTEGER, NOT NULL) - Expected quantity from document
- **quantity_verified** (INTEGER) - Verified quantity after physical check
- **unit_cost** (REAL, NOT NULL) - Cost per unit
- **lot_number** (TEXT) - Lot/batch number
- **expiration_date** (TEXT) - Product expiration date
- **discrepancy_notes** (TEXT) - Notes about quantity discrepancies
- **product_id** (INTEGER) - Matched product_id (after verification)

### Automatic Inventory Updates

Two database triggers automatically update inventory quantities:

1. **On Shipment Receipt**: When shipment items are added, the trigger:
   - Increases `current_quantity` by the `quantity_received`
   - Updates `last_restocked` timestamp
   - Updates `updated_at` timestamp

2. **On Sale**: When sales are recorded, the trigger:
   - Decreases `current_quantity` by the `quantity_sold`
   - Updates `updated_at` timestamp

## Setup

1. Initialize the database:
   ```bash
   python3 init_database.py
   ```

This will create an `inventory.db` SQLite database file with the inventory table.

## Usage

The `database.py` module provides utility functions for managing inventory, vendors, shipments, and shipment items.

### Inventory Management

- `add_product()` - Add a new product
- `get_product()` - Get product by ID
- `get_product_by_sku()` - Get product by SKU
- `update_product()` - Update product information
- `delete_product()` - Delete a product
- `list_products()` - List products with optional filters
- `update_quantity()` - Update product quantity

### Vendor Management

- `add_vendor()` - Add a new vendor
- `get_vendor()` - Get vendor by ID
- `list_vendors()` - List all vendors
- `update_vendor()` - Update vendor information
- `delete_vendor()` - Delete a vendor

### Shipment Management

- `create_shipment()` - Create a new shipment
- `get_shipment()` - Get shipment by ID
- `get_shipment_details()` - Get full shipment details with vendor and items
- `list_shipments()` - List shipments with optional filters
- `update_shipment()` - Update shipment information

### Shipment Items

- `add_shipment_item()` - Add an item to a shipment (automatically updates inventory)
- `get_shipment_items()` - Get all items for a shipment
- `get_shipment_item()` - Get shipment item by ID

### Sales/Transaction Management

- `record_sale()` - Record a sale/transaction (automatically decreases inventory)
- `get_sales()` - Get sales records with optional filters

### Pending Shipment Management

- `create_pending_shipment()` - Create a new pending shipment record
- `add_pending_shipment_item()` - Add an item to a pending shipment
- `get_pending_shipment()` - Get pending shipment by ID
- `get_pending_shipment_details()` - Get full pending shipment with items
- `get_pending_shipment_items()` - Get all items for a pending shipment
- `list_pending_shipments()` - List pending shipments with filters
- `update_pending_item_verification()` - Update verified quantity and product match
- `auto_match_pending_items()` - Automatically match items to products by SKU
- `approve_pending_shipment()` - Approve and transfer to actual shipment
- `reject_pending_shipment()` - Reject a pending shipment

### Reporting & Inventory Tracking

- `trace_product_to_vendors()` - Trace a product back to its source shipments and vendors
- `get_inventory_by_vendor()` - **Get remaining inventory breakdown by vendor using FIFO logic**
  - Shows which vendor's inventory is still in stock
  - Tracks which shipments have remaining inventory
  - Uses First-In-First-Out (FIFO) to determine which vendor's stock remains

### Examples

#### Basic Inventory Operations

```python
from database import add_product, get_product, list_products

# Add a product
product_id = add_product(
    product_name="Widget A",
    sku="WID-001",
    product_price=29.99,
    product_cost=15.00,
    vendor="Widget Co",
    current_quantity=100,
    category="Electronics"
)

# Get a product
product = get_product(product_id)
print(product)

# List all products
all_products = list_products()

# List products by category
electronics = list_products(category="Electronics")
```

#### Shipment Tracking Workflow

```python
from database import (
    add_vendor, create_shipment, add_shipment_item,
    trace_product_to_vendors, get_shipment_details
)

# 1. Add a vendor
vendor_id = add_vendor(
    vendor_name="Widget Co",
    contact_person="John Doe",
    email="john@widgetco.com",
    phone="555-0123",
    address="123 Main St, City, State"
)

# 2. Create a shipment
shipment_id = create_shipment(
    vendor_id=vendor_id,
    purchase_order_number="PO-2024-001",
    tracking_number="TRACK123456",
    total_cost=1500.00,
    notes="Expected delivery: Next week"
)

# 3. Add items to shipment (automatically updates inventory)
add_shipment_item(
    shipment_id=shipment_id,
    product_id=product_id,
    quantity_received=50,
    unit_cost=15.00,
    lot_number="LOT-2024-001",
    expiration_date="2025-12-31"
)

# 4. Trace product back to vendors
product_history = trace_product_to_vendors(product_id)
for record in product_history:
    print(f"Received {record['quantity_received']} from {record['vendor_name']} on {record['shipment_date']}")

# 5. Get full shipment details
shipment = get_shipment_details(shipment_id)
print(f"Shipment from {shipment['vendor_name']} with {len(shipment['items'])} items")
```

#### Vendor-Specific Inventory Tracking

This feature allows you to see exactly which vendor's inventory is still in stock, even after multiple shipments and sales:

```python
from database import (
    add_vendor, add_product, create_shipment, add_shipment_item,
    record_sale, get_inventory_by_vendor
)

# 1. Create vendors
vendor_a_id = add_vendor(vendor_name="Vendor A", email="a@vendor.com")
vendor_b_id = add_vendor(vendor_name="Vendor B", email="b@vendor.com")

# 2. Create product
product_id = add_product(
    product_name="Widget",
    sku="WID-001",
    product_price=25.00,
    product_cost=10.00
)

# 3. Receive 50 units from Vendor A
shipment_a = create_shipment(vendor_id=vendor_a_id, purchase_order_number="PO-A-001")
add_shipment_item(shipment_id=shipment_a, product_id=product_id, 
                  quantity_received=50, unit_cost=10.00)

# 4. Receive 100 units from Vendor B
shipment_b = create_shipment(vendor_id=vendor_b_id, purchase_order_number="PO-B-001")
add_shipment_item(shipment_id=shipment_b, product_id=product_id, 
                  quantity_received=100, unit_cost=9.50)

# 5. Sell 80 units (FIFO: all 50 from Vendor A + 30 from Vendor B)
record_sale(product_id=product_id, quantity_sold=80, sale_price=25.00)

# 6. Check remaining inventory by vendor
breakdown = get_inventory_by_vendor(product_id)
print(f"Total remaining: {breakdown['current_quantity']} units")
for vendor_total in breakdown['vendor_totals']:
    print(f"{vendor_total['vendor_name']}: {vendor_total['total_remaining']} units")
# Output: Vendor B: 70 units (all remaining inventory is from Vendor B)
```

**How it works:**
- Uses FIFO (First-In-First-Out) logic: oldest inventory is sold first
- Tracks which shipments have remaining inventory
- Shows exactly which vendor's stock is still available
- Provides detailed breakdown by shipment with lot numbers and costs

#### Document Scraping and Pending Shipments

The system supports uploading vendor documents (PDF, Excel, CSV) and automatically extracting shipment data:

```python
from database import (
    create_pending_shipment, add_pending_shipment_item,
    auto_match_pending_items, approve_pending_shipment,
    get_pending_shipment_details
)
from document_scraper import scrape_document

# 1. Scrape vendor document
items = scrape_document('vendor_shipment.pdf')  # or .xlsx, .csv

# 2. Create pending shipment
pending_id = create_pending_shipment(
    vendor_id=vendor_id,
    file_path='vendor_shipment.pdf',
    purchase_order_number='PO-2024-001'
)

# 3. Add scraped items
for item in items:
    add_pending_shipment_item(
        pending_shipment_id=pending_id,
        product_sku=item['product_sku'],
        product_name=item['product_name'],
        quantity_expected=item['quantity_expected'],
        unit_cost=item['unit_cost'],
        lot_number=item.get('lot_number')
    )

# 4. Auto-match items to products
match_results = auto_match_pending_items(pending_id)
print(f"Matched {match_results['matched']} items")

# 5. Review and verify quantities
pending_details = get_pending_shipment_details(pending_id)
# ... review items, update verified quantities if needed ...

# 6. Approve and transfer to actual shipment
shipment_id = approve_pending_shipment(
    pending_shipment_id=pending_id,
    reviewed_by="Admin User"
)
# Inventory is automatically updated via trigger!
```

**Document Scraping Features:**
- Supports PDF, Excel (.xlsx, .xls), and CSV files
- Automatic column mapping (customizable)
- Handles various vendor document formats
- Extracts: SKU, product name, quantity, cost, lot numbers, expiration dates

**Workflow:**
1. Upload vendor document → Scrape data
2. Create pending shipment → Add items
3. Auto-match items to products by SKU
4. Review and verify quantities (handle discrepancies)
5. Approve → Transfers to actual shipment and updates inventory

## Installation

For document scraping features, install optional dependencies:

```bash
pip install pdfplumber pandas openpyxl
```

- `pdfplumber` - For PDF document scraping
- `pandas` - For Excel/CSV file processing
- `openpyxl` - For Excel file support

## Database File

The database is stored as `inventory.db` (SQLite format) in the project directory.

