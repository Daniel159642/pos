#!/usr/bin/env python3
"""
Migration script to add metadata extraction system tables
"""

import sqlite3
from database import get_connection, DB_NAME

def migrate():
    """Add metadata extraction tables to the database"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("Migrating metadata extraction tables...")
    
    # Create Categories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            category_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_name TEXT NOT NULL UNIQUE,
            description TEXT,
            parent_category_id INTEGER,
            is_auto_generated INTEGER DEFAULT 0 CHECK(is_auto_generated IN (0, 1)),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_category_id) REFERENCES categories(category_id)
        )
    """)
    print("  ✓ Created categories table")
    
    # Create Product_Metadata table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS product_metadata (
            metadata_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL UNIQUE,
            brand TEXT,
            color TEXT,
            size TEXT,
            tags TEXT,  -- JSON array of tags
            keywords TEXT,  -- JSON array of keywords
            attributes TEXT,  -- JSON object of attributes
            search_vector TEXT,  -- Full-text search vector
            category_id INTEGER,
            category_confidence REAL DEFAULT 0 CHECK(category_confidence >= 0 AND category_confidence <= 1),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES inventory(product_id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(category_id)
        )
    """)
    print("  ✓ Created product_metadata table")
    
    # Create Metadata_Extraction_Log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS metadata_extraction_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            extraction_method TEXT NOT NULL,
            data_extracted TEXT,  -- JSON object of extracted data
            execution_time_ms INTEGER,
            success INTEGER DEFAULT 1 CHECK(success IN (0, 1)),
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES inventory(product_id) ON DELETE CASCADE
        )
    """)
    print("  ✓ Created metadata_extraction_log table")
    
    # Create Search_History table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS search_history (
            search_id INTEGER PRIMARY KEY AUTOINCREMENT,
            search_query TEXT NOT NULL,
            results_count INTEGER DEFAULT 0,
            filters TEXT,  -- JSON object of filters applied
            user_id INTEGER,
            search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES employees(employee_id)
        )
    """)
    print("  ✓ Created search_history table")
    
    # Create indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_product_metadata_product 
        ON product_metadata(product_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_product_metadata_category 
        ON product_metadata(category_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_product_metadata_brand 
        ON product_metadata(brand)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_metadata_log_product 
        ON metadata_extraction_log(product_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_search_history_timestamp 
        ON search_history(search_timestamp)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_categories_name 
        ON categories(category_name)
    """)
    print("  ✓ Created indexes")
    
    conn.commit()
    conn.close()
    
    print("\n✓ Migration completed successfully!")

if __name__ == '__main__':
    migrate()








