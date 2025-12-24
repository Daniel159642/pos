#!/usr/bin/env python3
"""
Role-Based Access Control (RBAC) Permission Manager
"""

import sqlite3
import hashlib
import secrets
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from functools import wraps
from database import get_connection, DB_NAME


class PermissionManager:
    """Manages roles, permissions, and access control"""
    
    def __init__(self):
        self.db_name = DB_NAME
    
    def get_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        return conn
    
    def has_permission(self, employee_id: int, permission_name: str) -> bool:
        """
        Check if employee has specific permission
        Checks role permissions first, then employee-specific overrides
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get employee's role_id
            cursor.execute("""
                SELECT role_id FROM employees
                WHERE employee_id = ? AND active = 1
            """, (employee_id,))
            
            role_result = cursor.fetchone()
            if not role_result:
                return False
            
            role_id = role_result[0]
            if role_id is None:
                return False
            
            # Get permission_id
            cursor.execute("""
                SELECT permission_id FROM permissions
                WHERE permission_name = ?
            """, (permission_name,))
            
            perm_result = cursor.fetchone()
            if not perm_result:
                return False
            
            permission_id = perm_result[0]
            
            # Check for employee-specific override first
            cursor.execute("""
                SELECT granted FROM employee_permission_overrides
                WHERE employee_id = ? AND permission_id = ?
            """, (employee_id, permission_id))
            
            override = cursor.fetchone()
            if override:
                return bool(override[0])
            
            # Check role permissions
            cursor.execute("""
                SELECT granted FROM role_permissions
                WHERE role_id = ? AND permission_id = ? AND granted = 1
            """, (role_id, permission_id))
            
            role_perm = cursor.fetchone()
            return bool(role_perm) if role_perm else False
            
        finally:
            conn.close()
    
    def get_employee_permissions(self, employee_id: int) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all permissions for an employee, grouped by category
        Returns dict with category as key and list of permissions as value
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get employee's role
            cursor.execute("""
                SELECT role_id FROM employees
                WHERE employee_id = ? AND active = 1
            """, (employee_id,))
            
            role_result = cursor.fetchone()
            if not role_result or role_result[0] is None:
                return {}
            
            role_id = role_result[0]
            
            # Get all permissions with role and override status
            cursor.execute("""
                SELECT DISTINCT
                    p.permission_id,
                    p.permission_name,
                    p.permission_category,
                    p.description,
                    CASE 
                        WHEN epo.granted IS NOT NULL THEN epo.granted
                        ELSE COALESCE(rp.granted, 0)
                    END as granted
                FROM permissions p
                LEFT JOIN role_permissions rp 
                    ON p.permission_id = rp.permission_id AND rp.role_id = ?
                LEFT JOIN employee_permission_overrides epo 
                    ON p.permission_id = epo.permission_id 
                    AND epo.employee_id = ?
                WHERE epo.granted = 1 OR rp.granted = 1
                ORDER BY p.permission_category, p.permission_name
            """, (role_id, employee_id))
            
            permissions = cursor.fetchall()
            
            # Group by category
            grouped = {}
            for perm in permissions:
                if perm['granted']:
                    category = perm['permission_category'] or 'other'
                    if category not in grouped:
                        grouped[category] = []
                    grouped[category].append({
                        'name': perm['permission_name'],
                        'description': perm['description'] or perm['permission_name']
                    })
            
            return grouped
            
        finally:
            conn.close()
    
    def grant_permission_to_employee(self, employee_id: int, permission_name: str,
                                    granted_by: int, reason: Optional[str] = None) -> bool:
        """Grant specific permission to employee (override role)"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get permission_id
            cursor.execute("""
                SELECT permission_id FROM permissions
                WHERE permission_name = ?
            """, (permission_name,))
            
            result = cursor.fetchone()
            if not result:
                return False
            
            permission_id = result[0]
            
            # Insert or update override
            cursor.execute("""
                INSERT INTO employee_permission_overrides
                (employee_id, permission_id, granted, reason, created_by)
                VALUES (?, ?, 1, ?, ?)
                ON CONFLICT(employee_id, permission_id) DO UPDATE SET
                    granted = 1,
                    reason = ?,
                    created_by = ?,
                    created_at = CURRENT_TIMESTAMP
            """, (employee_id, permission_id, reason, granted_by, reason, granted_by))
            
            conn.commit()
            
            # Log the action
            self.log_activity(
                granted_by, 'grant_permission', 'employee',
                employee_id,
                f"Granted {permission_name} to employee {employee_id}",
                None
            )
            
            return True
            
        except Exception as e:
            conn.rollback()
            print(f"Error granting permission: {e}")
            return False
        finally:
            conn.close()
    
    def revoke_permission_from_employee(self, employee_id: int, permission_name: str,
                                       revoked_by: int, reason: Optional[str] = None) -> bool:
        """Revoke specific permission from employee"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get permission_id
            cursor.execute("""
                SELECT permission_id FROM permissions
                WHERE permission_name = ?
            """, (permission_name,))
            
            result = cursor.fetchone()
            if not result:
                return False
            
            permission_id = result[0]
            
            # Insert or update override
            cursor.execute("""
                INSERT INTO employee_permission_overrides
                (employee_id, permission_id, granted, reason, created_by)
                VALUES (?, ?, 0, ?, ?)
                ON CONFLICT(employee_id, permission_id) DO UPDATE SET
                    granted = 0,
                    reason = ?,
                    created_by = ?,
                    created_at = CURRENT_TIMESTAMP
            """, (employee_id, permission_id, reason, revoked_by, reason, revoked_by))
            
            conn.commit()
            
            # Log the action
            self.log_activity(
                revoked_by, 'revoke_permission', 'employee',
                employee_id,
                f"Revoked {permission_name} from employee {employee_id}",
                None
            )
            
            return True
            
        except Exception as e:
            conn.rollback()
            print(f"Error revoking permission: {e}")
            return False
        finally:
            conn.close()
    
    def log_activity(self, employee_id: int, action: str, resource_type: Optional[str],
                     resource_id: Optional[int], details: str, ip_address: Optional[str] = None):
        """Log employee activity"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO activity_log
                (employee_id, action, resource_type, resource_id, details, ip_address)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (employee_id, action, resource_type, resource_id, details, ip_address))
            
            conn.commit()
        except Exception as e:
            print(f"Error logging activity: {e}")
        finally:
            conn.close()
    
    def get_activity_log(self, limit: int = 100, employee_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get activity log entries"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if employee_id:
                cursor.execute("""
                    SELECT al.*, e.first_name || ' ' || e.last_name as employee_name
                    FROM activity_log al
                    LEFT JOIN employees e ON al.employee_id = e.employee_id
                    WHERE al.employee_id = ?
                    ORDER BY al.created_at DESC
                    LIMIT ?
                """, (employee_id, limit))
            else:
                cursor.execute("""
                    SELECT al.*, e.first_name || ' ' || e.last_name as employee_name
                    FROM activity_log al
                    LEFT JOIN employees e ON al.employee_id = e.employee_id
                    ORDER BY al.created_at DESC
                    LIMIT ?
                """, (limit,))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()
    
    def assign_role_to_employee(self, employee_id: int, role_id: int) -> bool:
        """Assign a role to an employee"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                UPDATE employees
                SET role_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE employee_id = ?
            """, (role_id, employee_id))
            
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            print(f"Error assigning role: {e}")
            return False
        finally:
            conn.close()
    
    def get_all_roles(self) -> List[Dict[str, Any]]:
        """Get all roles"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT * FROM roles
                ORDER BY role_name
            """)
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()
    
    def get_all_permissions(self) -> List[Dict[str, Any]]:
        """Get all permissions"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT * FROM permissions
                ORDER BY permission_category, permission_name
            """)
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()


# Global permission manager instance
_permission_manager = None

def get_permission_manager():
    """Get or create permission manager singleton"""
    global _permission_manager
    if _permission_manager is None:
        _permission_manager = PermissionManager()
    return _permission_manager


def require_permission(permission_name: str):
    """
    Decorator to check if user has permission
    Usage:
        @require_permission('process_sale')
        def create_sale():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import request, jsonify
            
            # Get employee_id from session or request
            # This assumes you have employee_id in session or request context
            employee_id = None
            
            # Try to get from session token (if using session-based auth)
            if hasattr(request, 'employee_id'):
                employee_id = request.employee_id
            # Try to get from JSON body
            elif request.json and 'employee_id' in request.json:
                employee_id = request.json['employee_id']
            # Try to get from form data
            elif request.form and 'employee_id' in request.form:
                employee_id = int(request.form['employee_id'])
            
            if not employee_id:
                return jsonify({'error': 'Employee ID required', 'success': False}), 401
            
            # Check permission
            pm = get_permission_manager()
            if not pm.has_permission(employee_id, permission_name):
                pm.log_activity(
                    employee_id, 'permission_denied', 'system', None,
                    f"Attempted {permission_name} without permission",
                    request.remote_addr
                )
                return jsonify({
                    'error': 'Permission denied',
                    'success': False,
                    'required_permission': permission_name
                }), 403
            
            # Log successful action
            pm.log_activity(
                employee_id, permission_name,
                request.path.split('/')[-1] if request.path else None,
                None,
                f"Performed {permission_name}",
                request.remote_addr
            )
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

