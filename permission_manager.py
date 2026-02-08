#!/usr/bin/env python3
"""
Role-Based Access Control (RBAC) Permission Manager
"""

import hashlib
import secrets
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from functools import wraps
from database import get_connection
from psycopg2.extras import RealDictCursor


class PermissionManager:
    """Manages roles, permissions, and access control"""
    
    def __init__(self):
        pass
    
    def get_connection(self):
        """Get database connection"""
        return get_connection()
    
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
                WHERE employee_id = %s AND active = 1
            """, (employee_id,))
            
            role_result = cursor.fetchone()
            if not role_result:
                return False
            
            role_id = role_result[0] if isinstance(role_result, tuple) else role_result['role_id']
            if role_id is None:
                return False
            
            # Get permission_id
            cursor.execute("""
                SELECT permission_id FROM permissions
                WHERE permission_name = %s
            """, (permission_name,))
            
            perm_result = cursor.fetchone()
            if not perm_result:
                return False
            
            permission_id = perm_result[0] if isinstance(perm_result, tuple) else perm_result['permission_id']
            
            # Check for employee-specific override first
            cursor.execute("""
                SELECT granted FROM employee_permission_overrides
                WHERE employee_id = %s AND permission_id = %s
            """, (employee_id, permission_id))
            
            override = cursor.fetchone()
            if override:
                granted = override[0] if isinstance(override, tuple) else override['granted']
                return bool(granted)
            
            # Check role permissions
            cursor.execute("""
                SELECT granted FROM role_permissions
                WHERE role_id = %s AND permission_id = %s AND granted = 1
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
        conn = None
        try:
            conn = self.get_connection()
            if conn is None or conn.closed:
                return {}
            
            cursor = conn.cursor()
            
            # Get employee's role
            cursor.execute("""
                SELECT role_id FROM employees
                WHERE employee_id = %s AND active = 1
            """, (employee_id,))
            
            role_result = cursor.fetchone()
            role_id = role_result[0] if isinstance(role_result, tuple) else (role_result.get('role_id') if role_result else None)
            if not role_result or role_id is None:
                return {}
            
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
                    ON p.permission_id = rp.permission_id AND rp.role_id = %s
                LEFT JOIN employee_permission_overrides epo 
                    ON p.permission_id = epo.permission_id 
                    AND epo.employee_id = %s
                WHERE epo.granted = 1 OR rp.granted = 1
                ORDER BY p.permission_category, p.permission_name
            """, (role_id, employee_id))
            
            rows = cursor.fetchall()
            
            if rows is None:
                return {}
            
            # Handle both dict-like rows (RealDictRow) and tuple rows
            permissions = []
            for row in rows:
                if hasattr(row, '_asdict'):
                    # Named tuple
                    permissions.append(dict(row._asdict()))
                elif isinstance(row, dict):
                    permissions.append(row)
                else:
                    # Try to convert to dict
                    try:
                        column_names = [desc[0] for desc in cursor.description] if cursor.description else []
                        if column_names:
                            permissions.append(dict(zip(column_names, row)))
                        else:
                            permissions.append(dict(row) if isinstance(row, dict) else {})
                    except (TypeError, ValueError):
                        # Fallback: create dict from row items if possible
                        if hasattr(row, '__iter__') and not isinstance(row, str):
                            permissions.append(dict(row))
                        else:
                            # Last resort: convert to dict manually
                            permissions.append({str(i): val for i, val in enumerate(row)})
            
            # Group by category
            grouped = {}
            for perm in permissions:
                if perm.get('granted'):
                    category = perm.get('permission_category') or 'other'
                    if category not in grouped:
                        grouped[category] = []
                    grouped[category].append({
                        'name': perm.get('permission_name'),
                        'description': perm.get('description') or perm.get('permission_name')
                    })
            
            return grouped
            
        except Exception as e:
            print(f"Error in get_employee_permissions: {e}")
            import traceback
            traceback.print_exc()
            return {}
        finally:
            if conn and not conn.closed:
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
                WHERE permission_name = %s
            """, (permission_name,))
            
            result = cursor.fetchone()
            if not result:
                return False
            
            permission_id = result[0] if isinstance(result, tuple) else result['permission_id']
            
            # Insert or update override
            cursor.execute("""
                INSERT INTO employee_permission_overrides
                (employee_id, permission_id, granted, reason, created_by)
                VALUES (%s, %s, 1, %s, %s)
                ON CONFLICT(employee_id, permission_id) DO UPDATE SET
                    granted = 1,
                    reason = %s,
                    created_by = %s,
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
                WHERE permission_name = %s
            """, (permission_name,))
            
            result = cursor.fetchone()
            if not result:
                return False
            
            permission_id = result[0] if isinstance(result, tuple) else result['permission_id']
            
            # Insert or update override
            cursor.execute("""
                INSERT INTO employee_permission_overrides
                (employee_id, permission_id, granted, reason, created_by)
                VALUES (%s, %s, 0, %s, %s)
                ON CONFLICT(employee_id, permission_id) DO UPDATE SET
                    granted = 0,
                    reason = %s,
                    created_by = %s,
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
        """Log employee activity into audit_log (single audit trail)."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT establishment_id FROM employees WHERE employee_id = %s",
                (employee_id,),
            )
            row = cursor.fetchone()
            establishment_id = row[0] if row and (isinstance(row, tuple) and row[0]) else None
            if not establishment_id:
                cursor.execute("SELECT establishment_id FROM establishments ORDER BY establishment_id LIMIT 1")
                row = cursor.fetchone()
                establishment_id = row[0] if row and (isinstance(row, tuple) and row[0]) else 1
            cursor.execute("""
                INSERT INTO audit_log
                (establishment_id, table_name, record_id, action_type, employee_id, details, ip_address, resource_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                establishment_id,
                resource_type or "activity",
                resource_id or 0,
                action,
                employee_id,
                details,
                ip_address,
                resource_type,
            ))
            conn.commit()
        except Exception as e:
            print(f"Error logging activity: {e}")
        finally:
            conn.close()

    def get_activity_log(self, limit: int = 100, employee_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get activity entries from audit_log (single audit trail). Returns shape compatible with former activity_log."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            if employee_id:
                cursor.execute("""
                    SELECT
                        al.audit_id AS log_id,
                        al.establishment_id,
                        al.employee_id,
                        al.action_type AS action,
                        al.resource_type,
                        al.record_id AS resource_id,
                        al.details,
                        al.ip_address,
                        al.action_timestamp AS created_at,
                        CONCAT(e.first_name, ' ', e.last_name) AS employee_name
                    FROM audit_log al
                    LEFT JOIN employees e ON al.employee_id = e.employee_id
                    WHERE al.employee_id = %s
                    ORDER BY al.action_timestamp DESC
                    LIMIT %s
                """, (employee_id, limit))
            else:
                cursor.execute("""
                    SELECT
                        al.audit_id AS log_id,
                        al.establishment_id,
                        al.employee_id,
                        al.action_type AS action,
                        al.resource_type,
                        al.record_id AS resource_id,
                        al.details,
                        al.ip_address,
                        al.action_timestamp AS created_at,
                        CONCAT(e.first_name, ' ', e.last_name) AS employee_name
                    FROM audit_log al
                    LEFT JOIN employees e ON al.employee_id = e.employee_id
                    ORDER BY al.action_timestamp DESC
                    LIMIT %s
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
                SET role_id = %s, updated_at = CURRENT_TIMESTAMP
                WHERE employee_id = %s
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
        """Get all roles (returns list of dicts with role_id, role_name, etc.)"""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
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
        """Get all permissions (returns list of dicts with permission_id, permission_name, etc.)"""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
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
