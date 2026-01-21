#!/usr/bin/env python3
"""
Migration script to add shipment verification system tables
"""

import sqlite3
from database import get_connection, DB_NAME

def migrate():
    """Add shipment verification tables to the database"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("Migrating shipment verification tables...")
    
    # Update existing pending_shipments table to add new columns
    try:
        # Add new columns to pending_shipments if they don't exist
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN expected_delivery_date DATE
        """)
        print("  ✓ Added expected_delivery_date to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - expected_delivery_date already exists")
        else:
            print(f"  ⚠ Error adding expected_delivery_date: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN actual_delivery_date DATE
        """)
        print("  ✓ Added actual_delivery_date to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - actual_delivery_date already exists")
        else:
            print(f"  ⚠ Error adding actual_delivery_date: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        """)
        print("  ✓ Added uploaded_at to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - uploaded_at already exists")
        else:
            print(f"  ⚠ Error adding uploaded_at: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN document_path TEXT
        """)
        print("  ✓ Added document_path to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - document_path already exists")
        else:
            print(f"  ⚠ Error adding document_path: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN total_expected_items INTEGER DEFAULT 0
        """)
        print("  ✓ Added total_expected_items to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - total_expected_items already exists")
        else:
            print(f"  ⚠ Error adding total_expected_items: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN total_expected_cost REAL DEFAULT 0
        """)
        print("  ✓ Added total_expected_cost to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - total_expected_cost already exists")
        else:
            print(f"  ⚠ Error adding total_expected_cost: {e}")
    
    # Update status column to support new statuses
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN started_by INTEGER
        """)
        print("  ✓ Added started_by to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - started_by already exists")
        else:
            print(f"  ⚠ Error adding started_by: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN started_at DATETIME
        """)
        print("  ✓ Added started_at to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - started_at already exists")
        else:
            print(f"  ⚠ Error adding started_at: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN completed_by INTEGER
        """)
        print("  ✓ Added completed_by to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - completed_by already exists")
        else:
            print(f"  ⚠ Error adding completed_by: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipments 
            ADD COLUMN completed_at DATETIME
        """)
        print("  ✓ Added completed_at to pending_shipments")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - completed_at already exists")
        else:
            print(f"  ⚠ Error adding completed_at: {e}")
    
    # Update pending_shipment_items table
    try:
        cursor.execute("""
            ALTER TABLE pending_shipment_items 
            ADD COLUMN line_number INTEGER
        """)
        print("  ✓ Added line_number to pending_shipment_items")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - line_number already exists")
        else:
            print(f"  ⚠ Error adding line_number: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipment_items 
            ADD COLUMN barcode TEXT
        """)
        print("  ✓ Added barcode to pending_shipment_items")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - barcode already exists")
        else:
            print(f"  ⚠ Error adding barcode: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipment_items 
            ADD COLUMN quantity_verified INTEGER DEFAULT 0
        """)
        print("  ✓ Added quantity_verified to pending_shipment_items")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - quantity_verified already exists")
        else:
            print(f"  ⚠ Error adding quantity_verified: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipment_items 
            ADD COLUMN status TEXT DEFAULT 'pending'
        """)
        print("  ✓ Added status to pending_shipment_items")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - status already exists")
        else:
            print(f"  ⚠ Error adding status: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipment_items 
            ADD COLUMN verified_by INTEGER
        """)
        print("  ✓ Added verified_by to pending_shipment_items")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - verified_by already exists")
        else:
            print(f"  ⚠ Error adding verified_by: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE pending_shipment_items 
            ADD COLUMN verified_at DATETIME
        """)
        print("  ✓ Added verified_at to pending_shipment_items")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("  - verified_at already exists")
        else:
            print(f"  ⚠ Error adding verified_at: {e}")
    
    # Create Shipment_Issues table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shipment_issues (
            issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
            pending_shipment_id INTEGER NOT NULL,
            pending_item_id INTEGER,
            issue_type TEXT NOT NULL CHECK(issue_type IN ('missing', 'damaged', 'wrong_item', 'quantity_mismatch', 'expired', 'quality', 'other')),
            severity TEXT DEFAULT 'minor' CHECK(severity IN ('minor', 'major', 'critical')),
            quantity_affected INTEGER DEFAULT 1,
            reported_by INTEGER NOT NULL,
            reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            description TEXT,
            photo_path TEXT,
            resolution_status TEXT DEFAULT 'open' CHECK(resolution_status IN ('open', 'resolved', 'vendor_contacted', 'credit_issued')),
            resolved_by INTEGER,
            resolved_at DATETIME,
            resolution_notes TEXT,
            FOREIGN KEY (pending_shipment_id) REFERENCES pending_shipments(pending_shipment_id),
            FOREIGN KEY (pending_item_id) REFERENCES pending_shipment_items(pending_item_id),
            FOREIGN KEY (reported_by) REFERENCES employees(employee_id),
            FOREIGN KEY (resolved_by) REFERENCES employees(employee_id)
        )
    """)
    print("  ✓ Created shipment_issues table")
    
    # Create Shipment_Scan_Log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS shipment_scan_log (
            scan_id INTEGER PRIMARY KEY AUTOINCREMENT,
            pending_shipment_id INTEGER NOT NULL,
            pending_item_id INTEGER,
            scanned_barcode TEXT NOT NULL,
            scanned_by INTEGER NOT NULL,
            scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            scan_result TEXT DEFAULT 'match' CHECK(scan_result IN ('match', 'mismatch', 'unknown', 'duplicate')),
            device_id TEXT,
            location TEXT,
            FOREIGN KEY (pending_shipment_id) REFERENCES pending_shipments(pending_shipment_id),
            FOREIGN KEY (pending_item_id) REFERENCES pending_shipment_items(pending_item_id),
            FOREIGN KEY (scanned_by) REFERENCES employees(employee_id)
        )
    """)
    print("  ✓ Created shipment_scan_log table")
    
    # Create Verification_Sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verification_sessions (
            session_id INTEGER PRIMARY KEY AUTOINCREMENT,
            pending_shipment_id INTEGER NOT NULL,
            employee_id INTEGER NOT NULL,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME,
            total_scans INTEGER DEFAULT 0,
            items_verified INTEGER DEFAULT 0,
            issues_reported INTEGER DEFAULT 0,
            device_id TEXT,
            FOREIGN KEY (pending_shipment_id) REFERENCES pending_shipments(pending_shipment_id),
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    print("  ✓ Created verification_sessions table")
    
    # Create Approved_Shipments table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS approved_shipments (
            shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            pending_shipment_id INTEGER,
            vendor_id INTEGER NOT NULL,
            purchase_order_number TEXT,
            received_date DATE,
            approved_by INTEGER NOT NULL,
            approved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_items_received INTEGER DEFAULT 0,
            total_cost REAL DEFAULT 0,
            has_issues INTEGER DEFAULT 0 CHECK(has_issues IN (0, 1)),
            issue_count INTEGER DEFAULT 0,
            FOREIGN KEY (pending_shipment_id) REFERENCES pending_shipments(pending_shipment_id),
            FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
            FOREIGN KEY (approved_by) REFERENCES employees(employee_id)
        )
    """)
    print("  ✓ Created approved_shipments table")
    
    # Create Approved_Shipment_Items table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS approved_shipment_items (
            approved_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            shipment_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity_received INTEGER NOT NULL CHECK(quantity_received > 0),
            unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
            lot_number TEXT,
            expiration_date DATE,
            received_by INTEGER NOT NULL,
            received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shipment_id) REFERENCES approved_shipments(shipment_id),
            FOREIGN KEY (product_id) REFERENCES inventory(product_id),
            FOREIGN KEY (received_by) REFERENCES employees(employee_id)
        )
    """)
    print("  ✓ Created approved_shipment_items table")
    
    # Create indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_shipment_issues_shipment 
        ON shipment_issues(pending_shipment_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_shipment_issues_item 
        ON shipment_issues(pending_item_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_shipment_scan_log_shipment 
        ON shipment_scan_log(pending_shipment_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_shipment_scan_log_item 
        ON shipment_scan_log(pending_item_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_verification_sessions_shipment 
        ON verification_sessions(pending_shipment_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_approved_shipments_pending 
        ON approved_shipments(pending_shipment_id)
    """)
    print("  ✓ Created indexes")
    
    conn.commit()
    conn.close()
    
    print("\n✓ Migration completed successfully!")

if __name__ == '__main__':
    migrate()











