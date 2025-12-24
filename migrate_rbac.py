#!/usr/bin/env python3
"""
Migration script to add RBAC tables and role_id to employees table
"""

import sqlite3
import os
from database import DB_NAME


def migrate_rbac():
    """Add RBAC tables and update employees table"""
    
    if not os.path.exists(DB_NAME):
        print(f"Database {DB_NAME} does not exist. Run init_database.py first.")
        return
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Starting RBAC migration...")
    
    # Check if role_id column exists in employees table
    cursor.execute("PRAGMA table_info(employees)")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Add role_id column if it doesn't exist
    if 'role_id' not in columns:
        print("Adding role_id column to employees table...")
        try:
            cursor.execute("ALTER TABLE employees ADD COLUMN role_id INTEGER")
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_employees_role 
                ON employees(role_id)
            """)
            print("✓ Added role_id column to employees table")
        except sqlite3.OperationalError as e:
            print(f"✗ Error adding role_id: {e}")
    else:
        print("✓ role_id column already exists")
    
    # Create RBAC tables
    print("\nCreating RBAC tables...")
    
    # Roles table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            role_id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_name TEXT UNIQUE NOT NULL,
            description TEXT,
            is_system_role INTEGER DEFAULT 0 CHECK(is_system_role IN (0, 1)),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("✓ Created roles table")
    
    # Permissions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS permissions (
            permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
            permission_name TEXT UNIQUE NOT NULL,
            permission_category TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("✓ Created permissions table")
    
    # Role-Permission mapping
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_id INTEGER NOT NULL,
            permission_id INTEGER NOT NULL,
            granted INTEGER DEFAULT 1 CHECK(granted IN (0, 1)),
            FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
            FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
            UNIQUE(role_id, permission_id)
        )
    """)
    print("✓ Created role_permissions table")
    
    # Employee permission overrides
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employee_permission_overrides (
            override_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            permission_id INTEGER NOT NULL,
            granted INTEGER CHECK(granted IN (0, 1)),
            reason TEXT,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
            FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES employees(employee_id),
            UNIQUE(employee_id, permission_id)
        )
    """)
    print("✓ Created employee_permission_overrides table")
    
    # Activity log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activity_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id INTEGER,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    print("✓ Created activity_log table")
    
    # Create indexes
    print("\nCreating indexes...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_employee_overrides_employee ON employee_permission_overrides(employee_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_employee_overrides_permission ON employee_permission_overrides(permission_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_log_employee ON activity_log(employee_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role_id)")
    print("✓ Created indexes")
    
    conn.commit()
    conn.close()
    
    print("\n✓ RBAC migration completed successfully!")
    print("\nNext step: Run init_rbac_data.py to populate default roles and permissions")


if __name__ == '__main__':
    migrate_rbac()

