"""
Migration script to add signature column to transactions table
"""

import sqlite3

def migrate_add_signature(db_path='inventory.db'):
    """Add signature column to transactions table"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(transactions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'signature' not in columns:
            cursor.execute("""
                ALTER TABLE transactions
                ADD COLUMN signature TEXT
            """)
            print("Added signature column to transactions table")
        else:
            print("signature column already exists")
        
        conn.commit()
        print("Migration completed successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_add_signature()
