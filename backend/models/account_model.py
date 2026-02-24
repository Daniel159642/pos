#!/usr/bin/env python3
"""
Account Model/Repository Layer
Handles all database operations for accounts table
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
import sys
import os

# Add parent directory to path to import database_postgres
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database_postgres import get_cursor, get_connection
from psycopg2.extras import RealDictCursor


class Account:
    """Account entity/model"""
    
    def __init__(self, row: Dict[str, Any]):
        self.id = row.get('id')
        self.account_number = row.get('account_number')
        self.account_name = row.get('account_name')
        self.account_type = row.get('account_type')
        self.sub_type = row.get('sub_type')
        self.parent_account_id = row.get('parent_account_id')
        self.balance_type = row.get('balance_type')
        self.description = row.get('description')
        self.is_active = row.get('is_active', True)
        self.is_system_account = row.get('is_system_account', False)
        self.tax_line_id = row.get('tax_line_id')
        self.opening_balance = float(row.get('opening_balance', 0)) if row.get('opening_balance') is not None else 0.0
        self.opening_balance_date = row.get('opening_balance_date')
        self.created_at = row.get('created_at')
        self.updated_at = row.get('updated_at')
        self.created_by = row.get('created_by')
        self.updated_by = row.get('updated_by')
        self.qbo_id = row.get('qbo_id')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert account to dictionary"""
        return {
            'id': self.id,
            'account_number': self.account_number,
            'account_name': self.account_name,
            'account_type': self.account_type,
            'sub_type': self.sub_type,
            'parent_account_id': self.parent_account_id,
            'balance_type': self.balance_type,
            'description': self.description,
            'is_active': self.is_active,
            'is_system_account': self.is_system_account,
            'tax_line_id': self.tax_line_id,
            'opening_balance': self.opening_balance,
            'opening_balance_date': self.opening_balance_date.isoformat() if self.opening_balance_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'updated_by': self.updated_by,
            'qbo_id': self.qbo_id
        }


class AccountRepository:
    """Repository for account database operations"""
    
    @staticmethod
    def find_all(filters: Optional[Dict[str, Any]] = None) -> List[Account]:
        """Get all accounts with optional filters"""
        cursor = get_cursor()
        try:
            query = """
                SELECT * FROM accounting.accounts
                WHERE 1=1
            """
            params = []
            
            if filters:
                if filters.get('account_type'):
                    query += " AND account_type = %s"
                    params.append(filters['account_type'])
                
                if filters.get('is_active') is not None:
                    query += " AND is_active = %s"
                    params.append(filters['is_active'])
                
                if filters.get('parent_account_id') is not None:
                    query += " AND parent_account_id = %s"
                    params.append(filters['parent_account_id'])
                
                if filters.get('search'):
                    query += " AND (account_name ILIKE %s OR account_number ILIKE %s)"
                    search_term = f"%{filters['search']}%"
                    params.extend([search_term, search_term])
            
            query += " ORDER BY account_number, account_name"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [Account(dict(row)) for row in rows]
        finally:
            cursor.close()
    
    @staticmethod
    def find_by_id(account_id: int) -> Optional[Account]:
        """Find account by ID"""
        cursor = get_cursor()
        try:
            cursor.execute("SELECT * FROM accounting.accounts WHERE id = %s", (account_id,))
            row = cursor.fetchone()
            return Account(dict(row)) if row else None
        finally:
            cursor.close()
    
    @staticmethod
    def find_by_account_number(account_number: str) -> Optional[Account]:
        """Find account by account number"""
        cursor = get_cursor()
        try:
            cursor.execute("SELECT * FROM accounting.accounts WHERE account_number = %s", (account_number,))
            row = cursor.fetchone()
            return Account(dict(row)) if row else None
        finally:
            cursor.close()
    
    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Account:
        """Create a new account. Use a single connection so commit applies to the insert."""
        conn = get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                # opening_balance_date must be a date or None; empty string causes InvalidDatetimeFormat
                ob_date = data.get('opening_balance_date')
                if ob_date == '' or (isinstance(ob_date, str) and not ob_date.strip()):
                    ob_date = None

                cursor.execute("""
                    INSERT INTO accounting.accounts (
                        account_number, account_name, account_type, sub_type,
                        parent_account_id, balance_type, description, opening_balance,
                        opening_balance_date, created_by, updated_by, qbo_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                """, (
                    data.get('account_number'),
                    data['account_name'],
                    data['account_type'],
                    data.get('sub_type'),
                    data.get('parent_account_id'),
                    data['balance_type'],
                    data.get('description'),
                    data.get('opening_balance', 0),
                    ob_date,
                    user_id,
                    user_id,
                    data.get('qbo_id')
                ))
                row = cursor.fetchone()
                conn.commit()
                return Account(dict(row))
            except Exception as e:
                conn.rollback()
                raise
            finally:
                cursor.close()
        finally:
            conn.close()
    
    @staticmethod
    def update(account_id: int, data: Dict[str, Any], user_id: int) -> Account:
        """Update an existing account. Use a single connection so commit applies to the update."""
        conn = get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                # Build dynamic update query
                fields = []
                params = []
                
                allowed_fields = [
                    'account_number', 'account_name', 'account_type', 'sub_type',
                    'parent_account_id', 'balance_type', 'description', 'is_active',
                    'opening_balance', 'opening_balance_date', 'qbo_id'
                ]
                
                for field in allowed_fields:
                    if field in data:
                        val = data[field]
                        if field == 'opening_balance_date' and (val == '' or (isinstance(val, str) and not val.strip())):
                            val = None
                        fields.append(f"{field} = %s")
                        params.append(val)
                
                if not fields:
                    cursor.close()
                    conn.close()
                    return AccountRepository.find_by_id(account_id)
                
                fields.append("updated_by = %s")
                params.append(user_id)
                params.append(account_id)
                
                query = f"UPDATE accounting.accounts SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING *"
                cursor.execute(query, params)
                row = cursor.fetchone()
                
                if not row:
                    raise ValueError('Account not found')
                
                conn.commit()
                return Account(dict(row))
            except Exception as e:
                conn.rollback()
                raise
            finally:
                cursor.close()
        finally:
            conn.close()
    
    @staticmethod
    def delete(account_id: int) -> bool:
        """Delete an account. Use a single connection so commit applies to the delete."""
        conn = get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                # Check if account has child accounts
                cursor.execute("SELECT COUNT(*) AS cnt FROM accounting.accounts WHERE parent_account_id = %s", (account_id,))
                child_count = cursor.fetchone()['cnt'] or 0
                if child_count > 0:
                    raise ValueError('Cannot delete account with child accounts')
                
                # Check if account has been used in transactions
                cursor.execute("SELECT COUNT(*) AS cnt FROM accounting.transaction_lines WHERE account_id = %s", (account_id,))
                transaction_count = cursor.fetchone()['cnt'] or 0
                if transaction_count > 0:
                    raise ValueError('Cannot delete account that has been used in transactions')
                
                # Check if it's a system account
                account = AccountRepository.find_by_id(account_id)
                if account and account.is_system_account:
                    raise ValueError('Cannot delete system account')
                
                cursor.execute("DELETE FROM accounting.accounts WHERE id = %s", (account_id,))
                conn.commit()
                return cursor.rowcount > 0
            except Exception as e:
                conn.rollback()
                raise
            finally:
                cursor.close()
        finally:
            conn.close()
    
    @staticmethod
    def find_children(parent_id: int) -> List[Account]:
        """Find all child accounts of a parent"""
        cursor = get_cursor()
        try:
            cursor.execute("""
                SELECT * FROM accounting.accounts
                WHERE parent_account_id = %s
                ORDER BY account_number
            """, (parent_id,))
            rows = cursor.fetchall()
            return [Account(dict(row)) for row in rows]
        finally:
            cursor.close()
    
    @staticmethod
    def get_account_balance(account_id: int, as_of_date: Optional[date] = None) -> float:
        """Get account balance. Uses DB function if present, else computes from transaction_lines."""
        cursor = get_cursor()
        try:
            if as_of_date:
                cursor.execute("SELECT accounting.calculate_account_balance(%s, %s) as balance", (account_id, as_of_date))
            else:
                cursor.execute("SELECT accounting.calculate_account_balance(%s, CURRENT_DATE) as balance", (account_id,))
            row = cursor.fetchone()
            if not row or row['balance'] is None:
                return 0.0
            return float(row['balance'])
        except Exception:
            # DB function may not exist (e.g. bootstrap-only); compute in Python
            return AccountRepository._compute_account_balance(account_id, as_of_date)
        finally:
            try:
                cursor.close()
            except Exception:
                pass

    @staticmethod
    def _compute_account_balance(account_id: int, as_of_date: Optional[date] = None) -> float:
        """Compute account balance from transaction_lines (no DB function required)."""
        cursor = get_cursor()
        try:
            cursor.execute(
                "SELECT balance_type, COALESCE(opening_balance, 0) as opening_balance FROM accounting.accounts WHERE id = %s",
                (account_id,)
            )
            row = cursor.fetchone()
            if not row:
                return 0.0
            balance_type = (row.get('balance_type') or 'debit').lower()
            opening = float(row.get('opening_balance') or 0)
            d = as_of_date if as_of_date is not None else date.today()
            cursor.execute("""
                SELECT COALESCE(SUM(tl.debit_amount), 0) as td, COALESCE(SUM(tl.credit_amount), 0) as tc
                FROM accounting.transaction_lines tl
                JOIN accounting.transactions t ON t.id = tl.transaction_id
                WHERE tl.account_id = %s AND t.is_posted = true AND (t.is_void IS NOT TRUE OR t.is_void = false)
                  AND t.transaction_date <= %s
            """, (account_id, d))
            r = cursor.fetchone()
            td = float(r['td'] or 0) if r else 0
            tc = float(r['tc'] or 0) if r else 0
            if balance_type == 'credit':
                return float(opening + tc - td)
            return float(opening + td - tc)
        finally:
            cursor.close()
    
    @staticmethod
    def search(search_term: str) -> List[Account]:
        """Search accounts by name or number"""
        cursor = get_cursor()
        try:
            search_pattern = f"%{search_term}%"
            cursor.execute("""
                SELECT * FROM accounting.accounts
                WHERE account_name ILIKE %s OR account_number ILIKE %s
                ORDER BY account_number, account_name
            """, (search_pattern, search_pattern))
            rows = cursor.fetchall()
            return [Account(dict(row)) for row in rows]
        finally:
            cursor.close()


# Singleton instance
account_repository = AccountRepository()
