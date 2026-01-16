#!/usr/bin/env python3
"""
Migration script to add Azure Face API tables for employee face recognition
Replaces the old face-api.js implementation with Azure Face API
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def migrate():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("============================================================")
    print("Add Azure Face API Tables")
    print("============================================================")
    print()
    
    try:
        # Create employee_azure_faces table to store Azure Face API person IDs
        print("Creating employee_azure_faces table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_azure_faces (
                face_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL UNIQUE,
                azure_person_id TEXT NOT NULL,  -- Azure Face API person ID
                enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                enrollment_images_count INTEGER DEFAULT 1,  -- Number of face images enrolled
                is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
            )
        """)
        print("✓ employee_azure_faces table created successfully!")
        
        # Create index
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_azure_face_employee 
            ON employee_azure_faces(employee_id)
        """)
        print("✓ Index created successfully!")
        
        # Create face_enrollment_log table to track enrollment attempts
        print("Creating face_enrollment_log table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS face_enrollment_log (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                enrollment_status TEXT NOT NULL,  -- 'success', 'failed', 'pending'
                error_message TEXT,
                enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
            )
        """)
        print("✓ face_enrollment_log table created successfully!")
        
        # Create face_recognition_log table to track recognition attempts
        print("Creating face_recognition_log table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS face_recognition_log (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER,  -- NULL if recognition failed
                recognition_status TEXT NOT NULL,  -- 'success', 'failed', 'no_face', 'multiple_faces'
                confidence REAL,  -- Confidence score if successful
                error_message TEXT,
                recognized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL
            )
        """)
        print("✓ face_recognition_log table created successfully!")
        
        # Migrate existing face encodings if they exist
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='employee_face_encodings'
        """)
        if cursor.fetchone():
            print("\nNote: Old face-api.js table (employee_face_encodings) exists.")
            print("Azure Face API uses a different system. Old encodings will not be migrated.")
            print("Employees will need to re-enroll using Azure Face API.")
        
        conn.commit()
        print("\n✓ Azure Face API tables migration completed successfully!")
        print("\nNext steps:")
        print("1. Set AZURE_FACE_ENDPOINT and AZURE_FACE_SUBSCRIPTION_KEY environment variables")
        print("2. Run the enrollment process for each employee")
        print("3. The system will automatically train the person group")
        
    except Exception as e:
        conn.rollback()
        print(f"Error creating Azure Face API tables: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
