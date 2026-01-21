#!/usr/bin/env python3
"""
Migration script to add image matching columns and tables to existing database
"""

import sqlite3
import os
from database import DB_NAME


def migrate_database():
    """Add image matching columns and tables to existing database"""
    
    if not os.path.exists(DB_NAME):
        print(f"Database {DB_NAME} does not exist. Run init_database.py first.")
        return
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Starting migration for image matching and barcode scanning system...")
    
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(inventory)")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Add barcode column if it doesn't exist
    if 'barcode' not in columns:
        print("Adding barcode column to inventory table...")
        try:
            cursor.execute("ALTER TABLE inventory ADD COLUMN barcode TEXT")
            print("✓ Added barcode column")
        except sqlite3.OperationalError as e:
            print(f"✗ Error adding barcode: {e}")
    else:
        print("✓ barcode column already exists")
    
    # Create barcode index if it doesn't exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_barcode'")
    if not cursor.fetchone():
        print("Creating barcode index...")
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_barcode ON inventory(barcode)")
            print("✓ Created barcode index")
        except sqlite3.OperationalError as e:
            print(f"✗ Error creating barcode index: {e}")
    else:
        print("✓ barcode index already exists")
    
    # Add image_embedding column if it doesn't exist
    if 'image_embedding' not in columns:
        print("Adding image_embedding column to inventory table...")
        try:
            cursor.execute("ALTER TABLE inventory ADD COLUMN image_embedding BLOB")
            print("✓ Added image_embedding column")
        except sqlite3.OperationalError as e:
            print(f"✗ Error adding image_embedding: {e}")
    else:
        print("✓ image_embedding column already exists")
    
    # Add last_embedding_update column if it doesn't exist
    if 'last_embedding_update' not in columns:
        print("Adding last_embedding_update column to inventory table...")
        try:
            cursor.execute("ALTER TABLE inventory ADD COLUMN last_embedding_update TIMESTAMP")
            print("✓ Added last_embedding_update column")
        except sqlite3.OperationalError as e:
            print(f"✗ Error adding last_embedding_update: {e}")
    else:
        print("✓ last_embedding_update column already exists")
    
    # Create image_identifications table if it doesn't exist
    print("Creating image_identifications table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS image_identifications (
            identification_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            query_image_path TEXT NOT NULL,
            confidence_score REAL NOT NULL CHECK(confidence_score >= 0 AND confidence_score <= 1),
            identified_by TEXT,
            identified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            context TEXT DEFAULT 'manual_lookup' CHECK(context IN ('inventory_check', 'shipment_receiving', 'manual_lookup')),
            FOREIGN KEY (product_id) REFERENCES inventory(product_id)
        )
    """)
    print("✓ Created image_identifications table")
    
    # Create indexes
    print("Creating indexes...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_image_identifications_product 
        ON image_identifications(product_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_image_identifications_date 
        ON image_identifications(identified_at)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_image_identifications_context 
        ON image_identifications(context)
    """)
    print("✓ Created indexes")
    
    conn.commit()
    conn.close()
    
    print("\n✓ Migration completed successfully!")


if __name__ == '__main__':
    migrate_database()

