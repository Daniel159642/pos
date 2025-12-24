#!/usr/bin/env python3
"""
Initialize pending returns tables in the database
"""

import sqlite3

DB_NAME = 'inventory.db'

def init_returns_tables():
    """Create pending returns tables if they don't exist"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Read and execute the returns schema
    with open('returns_schema.sql', 'r') as f:
        schema = f.read()
    
    # Execute each statement
    for statement in schema.split(';'):
        statement = statement.strip()
        if statement:
            try:
                cursor.execute(statement)
            except sqlite3.OperationalError as e:
                if 'already exists' not in str(e).lower():
                    print(f"Warning: {e}")
    
    conn.commit()
    conn.close()
    print("Returns tables initialized successfully!")

if __name__ == '__main__':
    init_returns_tables()

