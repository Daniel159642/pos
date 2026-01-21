"""
Migration script to add amount_paid and change_amount columns to transactions table
"""

import sqlite3

def migrate_add_amount_paid(db_path='inventory.db'):
    """Add amount_paid and change_amount columns to transactions table"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(transactions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'amount_paid' not in columns:
            cursor.execute("""
                ALTER TABLE transactions
                ADD COLUMN amount_paid REAL
            """)
            print("Added amount_paid column to transactions table")
        else:
            print("amount_paid column already exists")
        
        if 'change_amount' not in columns:
            cursor.execute("""
                ALTER TABLE transactions
                ADD COLUMN change_amount REAL DEFAULT 0
            """)
            print("Added change_amount column to transactions table")
        else:
            print("change_amount column already exists")
        
        conn.commit()
        print("Migration completed successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_add_amount_paid()
