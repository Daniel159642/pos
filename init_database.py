#!/usr/bin/env python3
"""
Initialize the inventory database
"""

import sqlite3
import os

DB_NAME = 'inventory.db'
SCHEMA_FILE = 'schema.sql'

def init_database():
    """Create and initialize the database"""
    # Remove existing database if it exists (for fresh start)
    if os.path.exists(DB_NAME):
        print(f"Removing existing database: {DB_NAME}")
        os.remove(DB_NAME)
    
    # Read schema file
    with open(SCHEMA_FILE, 'r') as f:
        schema = f.read()
    
    # Create database connection
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Execute schema
    cursor.executescript(schema)
    
    # Commit changes
    conn.commit()
    
    # Get list of all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    
    print(f"Database '{DB_NAME}' initialized successfully!")
    print(f"\nCreated {len(tables)} table(s):")
    for table in tables:
        table_name = table[0]
        print(f"\n  Table: {table_name}")
        
        # Get column information
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        for col in columns:
            col_name = col[1]
            col_type = col[2]
            not_null = "NOT NULL" if col[3] else ""
            default = f"DEFAULT {col[4]}" if col[4] else ""
            pk = "PRIMARY KEY" if col[5] else ""
            
            parts = [col_name, col_type]
            if pk:
                parts.append(pk)
            if not_null:
                parts.append(not_null)
            if default:
                parts.append(default)
            
            print(f"    - {' '.join(parts)}")
    
    # Check for triggers
    cursor.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
    triggers = cursor.fetchall()
    if triggers:
        print(f"\n  Created {len(triggers)} trigger(s):")
        for trigger in triggers:
            print(f"    - {trigger[0]}")
    
    conn.close()

if __name__ == '__main__':
    init_database()

