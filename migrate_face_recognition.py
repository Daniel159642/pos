#!/usr/bin/env python3
"""
Migration script to add face recognition tables for employee clock in/out
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def migrate():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("============================================================")
    print("Add Face Recognition Tables")
    print("============================================================")
    print()
    
    try:
        # Create employee_face_encodings table
        print("Creating employee_face_encodings table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_face_encodings (
                face_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL UNIQUE,
                face_descriptor TEXT NOT NULL,  -- JSON array of 128 float values (face-api.js descriptor)
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
            )
        """)
        print("✓ employee_face_encodings table created successfully!")
        
        # Create index
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_face_employee 
            ON employee_face_encodings(employee_id)
        """)
        print("✓ Index created successfully!")
        
        conn.commit()
        print("\n✓ Face recognition tables migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"Error creating face recognition tables: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()

