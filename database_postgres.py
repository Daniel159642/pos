#!/usr/bin/env python3
"""
Local PostgreSQL database connection module for POS system
Replaces Supabase with local PostgreSQL database.
Uses a connection pool so each request reuses connections (faster for remote DBs e.g. Supabase).
"""

import os
import atexit
from typing import Optional
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
import threading

# Connection pool (lazily created)
_pg_pool: Optional[pool.ThreadedConnectionPool] = None
_pool_lock = threading.Lock()

# Database configuration (from environment variables)
DB_URL = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL') or os.getenv('DB_URL')

# Default local PostgreSQL connection parameters
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'pos_db')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')

# Pool size. Supabase Session mode has a small pool_size limit (e.g. 15); use a low max to avoid "max clients reached".
# For local PostgreSQL we use a larger default so concurrent requests don't exhaust the pool.
_is_local_db = (DB_URL or '').lower().count('localhost') > 0 or (os.getenv('DB_HOST') or 'localhost').lower() == 'localhost'
_default_pool_max = 10 if _is_local_db else 3
POOL_MIN_CONN = int(os.getenv('DB_POOL_MIN', '1'))
POOL_MAX_CONN = int(os.getenv('DB_POOL_MAX', str(_default_pool_max)))


class _PooledConnectionWrapper:
    """Wraps a pooled connection so .close() returns it to the pool instead of closing."""
    __slots__ = ('_pool', '_conn', '_returned')

    def __init__(self, pg_pool: pool.ThreadedConnectionPool, conn):
        self._pool = pg_pool
        self._conn = conn
        self._returned = False

    def close(self):
        if self._returned:
            return
        self._returned = True
        try:
            self._conn.rollback()
        except Exception:
            pass
        try:
            self._pool.putconn(self._conn)
        except Exception:
            pass

    @property
    def closed(self):
        return self._returned or self._conn.closed

    def __getattr__(self, name):
        if self._returned:
            raise psycopg2.InterfaceError("connection already returned to pool")
        return getattr(self._conn, name)


def _build_connection_string():
    """Build PostgreSQL connection string from environment variables"""
    if DB_URL:
        return DB_URL
    return f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


def _get_pool() -> pool.ThreadedConnectionPool:
    """Create or return the global connection pool (thread-safe)."""
    global _pg_pool
    with _pool_lock:
        if _pg_pool is not None:
            return _pg_pool
        connection_string = _build_connection_string()
        if not connection_string:
            raise ValueError(
                "Database connection not configured. "
                "Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD environment variables."
            )
        try:
            _pg_pool = pool.ThreadedConnectionPool(
                POOL_MIN_CONN,
                POOL_MAX_CONN,
                connection_string,
            )
        except Exception as e:
            raise ConnectionError(
                f"Failed to create database pool: {str(e)}. "
                "Check your database connection settings (DATABASE_URL or DB_* variables)."
            ) from e
        return _pg_pool


def get_connection():
    """
    Get a connection from the pool. Call conn.close() when done; the connection
    is returned to the pool for reuse (faster for remote DBs like Supabase).
    """
    p = _get_pool()
    try:
        conn = p.getconn()
        conn.set_session(autocommit=False)
        return _PooledConnectionWrapper(p, conn)
    except Exception as e:
        raise ConnectionError(
            f"Failed to connect to PostgreSQL: {str(e)}. "
            "Check your database connection settings (DATABASE_URL or DB_* variables)."
        ) from e


class _PooledCursorWrapper:
    """Wraps a cursor so closing it also returns the connection to the pool."""
    __slots__ = ('_conn', '_cursor', '_closed')

    def __init__(self, conn, cursor):
        self._conn = conn
        self._cursor = cursor
        self._closed = False

    def close(self):
        if self._closed:
            return
        self._closed = True
        try:
            self._cursor.close()
        except Exception:
            pass
        try:
            self._conn.close()
        except Exception:
            pass

    def __getattr__(self, name):
        if self._closed:
            raise psycopg2.InterfaceError("cursor already closed")
        return getattr(self._cursor, name)


def get_cursor():
    """Get cursor with dict-like row access (RealDictCursor). Closing the cursor returns the connection to the pool."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    return _PooledCursorWrapper(conn, cursor)

def close_connection():
    """Close the connection pool (all connections)."""
    global _pg_pool
    with _pool_lock:
        if _pg_pool is not None:
            try:
                _pg_pool.closeall()
            except Exception:
                pass
            _pg_pool = None


def reset_connection():
    """Reset the pool (close all connections; useful for testing or after errors)."""
    close_connection()


def _close_pool_on_exit():
    """Ensure pool is closed when the process exits."""
    close_connection()


atexit.register(_close_pool_on_exit)

# Compatibility functions for code that might reference establishment context
# These are no-ops since we're not using multi-tenant establishment isolation
def set_current_establishment(establishment_id: Optional[int]):
    """No-op: establishment context not used in local PostgreSQL"""
    pass

def get_current_establishment() -> Optional[int]:
    """Get or create default establishment for local PostgreSQL"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Try to get the first establishment
        cursor.execute("SELECT establishment_id FROM establishments ORDER BY establishment_id LIMIT 1")
        row = cursor.fetchone()
        
        if row:
            establishment_id = row[0] if isinstance(row, tuple) else row.get('establishment_id')
            conn.close()
            return establishment_id
        
        # If no establishment exists, create a default one
        cursor.execute("""
            INSERT INTO establishments (establishment_name, establishment_type, address, phone, email)
            VALUES ('Default Store', 'retail', NULL, NULL, NULL)
            RETURNING establishment_id
        """)
        result = cursor.fetchone()
        establishment_id = result[0] if isinstance(result, tuple) else result.get('establishment_id')
        conn.commit()
        conn.close()
        return establishment_id
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        conn.close()
        # If there's an error, try to get any establishment or return None
        try:
            conn2 = get_connection()
            cursor2 = conn2.cursor()
            cursor2.execute("SELECT establishment_id FROM establishments ORDER BY establishment_id LIMIT 1")
            row2 = cursor2.fetchone()
            conn2.close()
            if row2:
                return row2[0] if isinstance(row2, tuple) else row2.get('establishment_id')
        except:
            pass
        return None
