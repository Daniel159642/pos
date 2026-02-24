#!/usr/bin/env python3
"""
Transaction Model/Repository Layer
Handles all database operations for transactions and transaction_lines tables
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
import sys
import os

# Add parent directory to path to import database_postgres
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database_postgres import get_cursor, get_connection
from psycopg2.extras import RealDictCursor


class Transaction:
    """Transaction entity/model"""
    
    def __init__(self, row: Dict[str, Any]):
        self.id = row.get('id')
        self.transaction_number = row.get('transaction_number')
        self.transaction_date = row.get('transaction_date')
        self.transaction_type = row.get('transaction_type')
        self.reference_number = row.get('reference_number')
        self.description = row.get('description')
        self.source_document_id = row.get('source_document_id')
        self.source_document_type = row.get('source_document_type')
        self.is_posted = row.get('is_posted', False)
        self.is_void = row.get('is_void', False)
        self.void_date = row.get('void_date')
        self.void_reason = row.get('void_reason')
        self.reconciliation_status = row.get('reconciliation_status', 'unreconciled')
        self.reconciled_date = row.get('reconciled_date')
        self.created_at = row.get('created_at')
        self.updated_at = row.get('updated_at')
        self.created_by = row.get('created_by')
        self.updated_by = row.get('updated_by')
        self.qbo_id = row.get('qbo_id')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert transaction to dictionary"""
        return {
            'id': self.id,
            'transaction_number': self.transaction_number,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'transaction_type': self.transaction_type,
            'reference_number': self.reference_number,
            'description': self.description,
            'source_document_id': self.source_document_id,
            'source_document_type': self.source_document_type,
            'is_posted': self.is_posted,
            'is_void': self.is_void,
            'void_date': self.void_date.isoformat() if self.void_date else None,
            'void_reason': self.void_reason,
            'reconciliation_status': self.reconciliation_status,
            'reconciled_date': self.reconciled_date.isoformat() if self.reconciled_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'updated_by': self.updated_by,
            'qbo_id': self.qbo_id
        }


class TransactionLine:
    """Transaction Line entity/model"""
    
    def __init__(self, row: Dict[str, Any]):
        self.id = row.get('id')
        self.transaction_id = row.get('transaction_id')
        self.account_id = row.get('account_id')
        self.line_number = row.get('line_number')
        self.debit_amount = float(row.get('debit_amount', 0)) if row.get('debit_amount') is not None else 0.0
        self.credit_amount = float(row.get('credit_amount', 0)) if row.get('credit_amount') is not None else 0.0
        self.description = row.get('description')
        self.entity_type = row.get('entity_type')
        self.entity_id = row.get('entity_id')
        self.class_id = row.get('class_id')
        self.location_id = row.get('location_id')
        self.billable = row.get('billable', False)
        self.created_at = row.get('created_at')
        self.updated_at = row.get('updated_at')
        # Additional fields from joins
        self.account_name = row.get('account_name')
        self.account_number = row.get('account_number')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert transaction line to dictionary"""
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'account_id': self.account_id,
            'account_name': self.account_name,
            'account_number': self.account_number,
            'line_number': self.line_number,
            'debit_amount': self.debit_amount,
            'credit_amount': self.credit_amount,
            'description': self.description,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'class_id': self.class_id,
            'location_id': self.location_id,
            'billable': self.billable,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class TransactionRepository:
    """Repository for transaction database operations"""
    
    @staticmethod
    def find_all(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get all transactions with optional filters and pagination"""
        cursor = get_cursor()
        try:
            page = filters.get('page', 1) if filters else 1
            limit = filters.get('limit', 50) if filters else 50
            offset = (page - 1) * limit
            
            # Build base query
            query = """
                SELECT DISTINCT t.*
                FROM accounting.transactions t
                LEFT JOIN accounting.transaction_lines tl ON t.id = tl.transaction_id
                WHERE 1=1
            """
            params = []
            param_count = 1
            
            if filters:
                if filters.get('start_date'):
                    query += " AND t.transaction_date >= %s"
                    params.append(filters['start_date'])
                
                if filters.get('end_date'):
                    query += " AND t.transaction_date <= %s"
                    params.append(filters['end_date'])
                
                if filters.get('account_id'):
                    query += " AND tl.account_id = %s"
                    params.append(filters['account_id'])
                
                if filters.get('transaction_type'):
                    query += " AND t.transaction_type = %s"
                    params.append(filters['transaction_type'])
                
                if filters.get('is_posted') is not None:
                    query += " AND t.is_posted = %s"
                    params.append(filters['is_posted'])
                
                if filters.get('is_void') is not None:
                    query += " AND t.is_void = %s"
                    params.append(filters['is_void'])
                
                if filters.get('search'):
                    query += " AND (t.transaction_number ILIKE %s OR t.description ILIKE %s)"
                    search_term = f"%{filters['search']}%"
                    params.append(search_term)
                    params.append(search_term)
            
            # Get total count - need to modify query for counting
            count_query = query.replace('SELECT DISTINCT t.*', 'SELECT COUNT(DISTINCT t.id)')
            cursor.execute(count_query, params)
            row = cursor.fetchone()
            total = (list(row.values())[0] or 0) if row else 0
            
            # Add ordering and pagination
            query += " ORDER BY t.transaction_date DESC, t.id DESC LIMIT %s OFFSET %s"
            params.append(limit)
            params.append(offset)
            
            cursor.execute(query, params)
            transaction_rows = cursor.fetchall()
            
            # Get lines for each transaction
            transactions_with_lines = []
            for txn_row in transaction_rows:
                txn = Transaction(dict(txn_row))
                
                # Get lines for this transaction
                cursor.execute("""
                    SELECT tl.*, a.account_name, a.account_number
                    FROM accounting.transaction_lines tl
                    JOIN accounting.accounts a ON tl.account_id = a.id
                    WHERE tl.transaction_id = %s
                    ORDER BY tl.line_number
                """, (txn.id,))
                
                line_rows = cursor.fetchall()
                lines = [TransactionLine(dict(row)) for row in line_rows]
                
                transactions_with_lines.append({
                    'transaction': txn.to_dict(),
                    'lines': [line.to_dict() for line in lines]
                })
            
            total_pages = (total + limit - 1) // limit if limit > 0 else 1
            
            return {
                'transactions': transactions_with_lines,
                'total': total,
                'page': page,
                'total_pages': total_pages
            }
        finally:
            cursor.close()
    
    @staticmethod
    def find_by_id(transaction_id: int) -> Optional[Dict[str, Any]]:
        """Find transaction by ID with lines"""
        cursor = get_cursor()
        try:
            cursor.execute("SELECT * FROM accounting.transactions WHERE id = %s", (transaction_id,))
            txn_row = cursor.fetchone()
            
            if not txn_row:
                return None
            
            txn = Transaction(dict(txn_row))
            
            # Get lines
            cursor.execute("""
                SELECT tl.*, a.account_name, a.account_number
                FROM accounting.transaction_lines tl
                JOIN accounting.accounts a ON tl.account_id = a.id
                WHERE tl.transaction_id = %s
                ORDER BY tl.line_number
            """, (transaction_id,))
            
            line_rows = cursor.fetchall()
            lines = [TransactionLine(dict(row)) for row in line_rows]
            
            return {
                'transaction': txn.to_dict(),
                'lines': [line.to_dict() for line in lines]
            }
        finally:
            cursor.close()
    
    @staticmethod
    def find_by_transaction_number(transaction_number: str) -> Optional[Dict[str, Any]]:
        """Find transaction by transaction number"""
        cursor = get_cursor()
        try:
            cursor.execute("SELECT * FROM accounting.transactions WHERE transaction_number = %s", (transaction_number,))
            txn_row = cursor.fetchone()
            
            if not txn_row:
                return None
            
            txn = Transaction(dict(txn_row))
            
            # Get lines
            cursor.execute("""
                SELECT tl.*, a.account_name, a.account_number
                FROM accounting.transaction_lines tl
                JOIN accounting.accounts a ON tl.account_id = a.id
                WHERE tl.transaction_id = %s
                ORDER BY tl.line_number
            """, (txn.id,))
            
            line_rows = cursor.fetchall()
            lines = [TransactionLine(dict(row)) for row in line_rows]
            
            return {
                'transaction': txn.to_dict(),
                'lines': [line.to_dict() for line in lines]
            }
        finally:
            cursor.close()

    @staticmethod
    def find_by_source_document(source_document_type: str, source_document_id: int) -> Optional[Dict[str, Any]]:
        """Find a posted transaction by source document (e.g. order, order_void, return). Used for idempotency."""
        cursor = get_cursor()
        try:
            cursor.execute("""
                SELECT * FROM accounting.transactions
                WHERE source_document_type = %s AND source_document_id = %s AND is_posted = true AND (is_void IS NOT TRUE OR is_void = false)
                ORDER BY id DESC LIMIT 1
            """, (source_document_type, source_document_id))
            txn_row = cursor.fetchone()
            if not txn_row:
                return None
            txn = Transaction(dict(txn_row))
            cursor.execute("""
                SELECT tl.*, a.account_name, a.account_number
                FROM accounting.transaction_lines tl
                JOIN accounting.accounts a ON tl.account_id = a.id
                WHERE tl.transaction_id = %s
                ORDER BY tl.line_number
            """, (txn.id,))
            line_rows = cursor.fetchall()
            lines = [TransactionLine(dict(row)) for row in line_rows]
            return {
                'transaction': txn.to_dict(),
                'lines': [line.to_dict() for line in lines]
            }
        finally:
            cursor.close()
    
    @staticmethod
    def create(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        """Create a new transaction with lines"""
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            # psycopg2 transactions are implicit - no need for explicit begin()
            
            # Validate balance
            if not TransactionRepository.validate_balance(data.get('lines', [])):
                raise ValueError('Transaction is not balanced. Total debits must equal total credits.')
            
            # Generate transaction number (database trigger will handle if empty)
            transaction_number = data.get('transaction_number') or ''
            
            # Insert transaction (optionally link to POS order/shipment via source_document_*)
            cursor.execute("""
                INSERT INTO accounting.transactions (
                    transaction_number, transaction_date, transaction_type,
                    reference_number, description, source_document_id, source_document_type,
                    is_posted, created_by, updated_by, qbo_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, false, %s, %s, %s)
                RETURNING *
            """, (
                transaction_number,
                data['transaction_date'],
                data['transaction_type'],
                data.get('reference_number'),
                data['description'],
                data.get('source_document_id'),
                data.get('source_document_type'),
                user_id,
                user_id,
                data.get('qbo_id')
            ))
            
            txn_row = cursor.fetchone()
            txn = Transaction(dict(txn_row))
            
            # Insert transaction lines
            lines = []
            for i, line_data in enumerate(data.get('lines', []), 1):
                cursor.execute("""
                    INSERT INTO accounting.transaction_lines (
                        transaction_id, account_id, line_number, debit_amount, credit_amount,
                        description, entity_type, entity_id, class_id, location_id, billable
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                """, (
                    txn.id,
                    line_data['account_id'],
                    i,
                    line_data.get('debit_amount', 0),
                    line_data.get('credit_amount', 0),
                    line_data.get('description', ''),
                    line_data.get('entity_type'),
                    line_data.get('entity_id'),
                    line_data.get('class_id'),
                    line_data.get('location_id'),
                    line_data.get('billable', False)
                ))
                
                line_row = cursor.fetchone()
                lines.append(TransactionLine(dict(line_row)))
            
            conn.commit()
            
            return {
                'transaction': txn.to_dict(),
                'lines': [line.to_dict() for line in lines]
            }
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update(transaction_id: int, data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        """Update an existing transaction"""
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            # Check if transaction exists
            existing = TransactionRepository.find_by_id(transaction_id)
            if not existing:
                raise ValueError('Transaction not found')
            
            if existing['transaction']['is_posted']:
                raise ValueError('Cannot modify posted transaction. Unpost it first.')
            
            # Update transaction header
            update_fields = []
            update_values = []
            
            allowed_fields = ['transaction_date', 'transaction_type', 'reference_number', 'description', 'qbo_id']
            for field in allowed_fields:
                if field in data:
                    update_fields.append(f"{field} = %s")
                    update_values.append(data[field])
            
            if update_fields:
                update_fields.append("updated_by = %s")
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                update_values.append(user_id)
                update_values.append(transaction_id)
                
                cursor.execute(
                    f"UPDATE accounting.transactions SET {', '.join(update_fields)} WHERE id = %s",
                    update_values
                )
            
            # Update lines if provided
            if 'lines' in data:
                # Validate balance
                if not TransactionRepository.validate_balance(data['lines']):
                    raise ValueError('Transaction is not balanced. Total debits must equal total credits.')
                
                # Delete existing lines
                cursor.execute("DELETE FROM accounting.transaction_lines WHERE transaction_id = %s", (transaction_id,))
                
                # Insert new lines
                for i, line_data in enumerate(data['lines'], 1):
                    cursor.execute("""
                        INSERT INTO accounting.transaction_lines (
                            transaction_id, account_id, line_number, debit_amount, credit_amount,
                            description, entity_type, entity_id, class_id, location_id, billable
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        transaction_id,
                        line_data['account_id'],
                        i,
                        line_data.get('debit_amount', 0),
                        line_data.get('credit_amount', 0),
                        line_data.get('description', ''),
                        line_data.get('entity_type'),
                        line_data.get('entity_id'),
                        line_data.get('class_id'),
                        line_data.get('location_id'),
                        line_data.get('billable', False)
                    ))
            
            conn.commit()
            
            # Return updated transaction
            return TransactionRepository.find_by_id(transaction_id)
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def delete(transaction_id: int) -> bool:
        """Delete a transaction"""
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            # Check if transaction exists and can be deleted
            existing = TransactionRepository.find_by_id(transaction_id)
            if not existing:
                raise ValueError('Transaction not found')
            
            if existing['transaction']['is_posted']:
                raise ValueError('Cannot delete posted transaction. Unpost or void it first.')
            
            cursor.execute("DELETE FROM accounting.transactions WHERE id = %s", (transaction_id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def post_transaction(transaction_id: int, user_id: int) -> Dict[str, Any]:
        """Post a transaction"""
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            existing = TransactionRepository.find_by_id(transaction_id)
            if not existing:
                raise ValueError('Transaction not found')
            if existing['transaction']['is_posted']:
                raise ValueError('Transaction is already posted')
            if existing['transaction']['is_void']:
                raise ValueError('Cannot post voided transaction')
            if not TransactionRepository.validate_balance(existing['lines']):
                raise ValueError('Cannot post unbalanced transaction')
            cursor.execute("""
                UPDATE accounting.transactions
                SET is_posted = true, updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (user_id, transaction_id))
            conn.commit()
            return TransactionRepository.find_by_id(transaction_id)
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def unpost_transaction(transaction_id: int, user_id: int) -> Dict[str, Any]:
        """Unpost a transaction"""
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            existing = TransactionRepository.find_by_id(transaction_id)
            if not existing:
                raise ValueError('Transaction not found')
            if not existing['transaction']['is_posted']:
                raise ValueError('Transaction is not posted')
            if existing['transaction']['is_void']:
                raise ValueError('Cannot unpost voided transaction')
            cursor.execute("""
                UPDATE accounting.transactions
                SET is_posted = false, updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (user_id, transaction_id))
            conn.commit()
            return TransactionRepository.find_by_id(transaction_id)
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def void_transaction(transaction_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        """Void a transaction"""
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            existing = TransactionRepository.find_by_id(transaction_id)
            if not existing:
                raise ValueError('Transaction not found')
            if existing['transaction']['is_void']:
                raise ValueError('Transaction is already voided')
            cursor.execute("""
                UPDATE accounting.transactions
                SET is_void = true, void_reason = %s, void_date = CURRENT_DATE,
                    updated_by = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (reason or '', user_id, transaction_id))
            conn.commit()
            return TransactionRepository.find_by_id(transaction_id)
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def validate_balance(lines: List[Dict[str, Any]]) -> bool:
        """Validate that total debits equal total credits"""
        total_debits = sum(float(line.get('debit_amount', 0)) for line in lines)
        total_credits = sum(float(line.get('credit_amount', 0)) for line in lines)
        
        # Allow small rounding differences (0.01)
        return abs(total_debits - total_credits) < 0.01
    
    @staticmethod
    def get_general_ledger(account_id: Optional[int] = None, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        """Get general ledger entries"""
        cursor = get_cursor()
        try:
            query = """
                SELECT 
                    t.id as transaction_id,
                    t.transaction_number,
                    t.transaction_date,
                    t.transaction_type,
                    t.description as transaction_description,
                    t.reference_number,
                    tl.id as line_id,
                    tl.account_id,
                    a.account_number,
                    a.account_name,
                    a.account_type,
                    tl.debit_amount,
                    tl.credit_amount,
                    tl.description as line_description
                FROM accounting.transactions t
                JOIN accounting.transaction_lines tl ON t.id = tl.transaction_id
                JOIN accounting.accounts a ON tl.account_id = a.id
                WHERE t.is_posted = true AND t.is_void = false
            """
            params = []
            param_count = 1
            
            if account_id:
                query += " AND tl.account_id = %s"
                params.append(account_id)
            
            if start_date:
                query += " AND t.transaction_date >= %s"
                params.append(start_date)
            
            if end_date:
                query += " AND t.transaction_date <= %s"
                params.append(end_date)
            
            query += " ORDER BY t.transaction_date, t.id, tl.line_number"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            cursor.close()

    @staticmethod
    def get_transactions_with_lines_involving_accounts(
        account_ids: List[int],
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """Get all posted, non-void transactions in date range that have at least one line
        touching any of the given account_ids. Returns each transaction with full lines
        (account_number, account_type, debit_amount, credit_amount) for cash flow classification."""
        if not account_ids:
            return []
        cursor = get_cursor()
        try:
            placeholders = ','.join(['%s'] * len(account_ids))
            cursor.execute("""
                SELECT t.id AS transaction_id, t.transaction_date,
                       tl.account_id, a.account_number, a.account_type, a.account_name,
                       tl.debit_amount, tl.credit_amount
                FROM accounting.transactions t
                JOIN accounting.transaction_lines tl ON t.id = tl.transaction_id
                JOIN accounting.accounts a ON tl.account_id = a.id
                WHERE t.is_posted = true AND t.is_void = false
                  AND t.transaction_date >= %s AND t.transaction_date <= %s
                  AND t.id IN (
                    SELECT DISTINCT transaction_id FROM accounting.transaction_lines
                    WHERE account_id IN (""" + placeholders + """)
                  )
                ORDER BY t.transaction_date, t.id, tl.line_number
            """, [start_date, end_date] + list(account_ids))
            rows = cursor.fetchall()
            # Group by transaction
            by_txn: Dict[int, Dict[str, Any]] = {}
            for row in rows:
                r = dict(row)
                txn_id = r['transaction_id']
                if txn_id not in by_txn:
                    by_txn[txn_id] = {'transaction_id': txn_id, 'transaction_date': r['transaction_date'], 'lines': []}
                by_txn[txn_id]['lines'].append({
                    'account_id': r['account_id'],
                    'account_number': r['account_number'],
                    'account_type': r['account_type'],
                    'account_name': r.get('account_name'),
                    'debit_amount': float(r.get('debit_amount') or 0),
                    'credit_amount': float(r.get('credit_amount') or 0),
                })
            return list(by_txn.values())
        finally:
            cursor.close()


# Singleton instance
transaction_repository = TransactionRepository()
