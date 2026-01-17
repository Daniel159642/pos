"""
Migration script to add show_signature column to receipt_settings table
"""

import sqlite3

def migrate_add_signature_setting(db_path='inventory.db'):
    """Add show_signature column to receipt_settings table"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(receipt_settings)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'show_signature' not in columns:
            cursor.execute("""
                ALTER TABLE receipt_settings
                ADD COLUMN show_signature INTEGER DEFAULT 0 CHECK(show_signature IN (0, 1))
            """)
            print("Added show_signature column to receipt_settings table")
        else:
            print("show_signature column already exists")
        
        conn.commit()
        print("Migration completed successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_add_signature_setting()
