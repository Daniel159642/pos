#!/usr/bin/env python3
"""
Database utility functions for inventory management
PostgreSQL ONLY - All SQLite code has been removed
"""

import hashlib
import logging
import secrets
import json
import re
import os
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)
_ensure_metadata_lock = threading.Lock()
_category_path_cache: Dict[str, int] = {}
_category_cache_max_size = 1000
_ensure_shipment_lock = threading.Lock()

# Import local PostgreSQL connection - this is the ONLY database backend
try:
    from database_postgres import (
        get_connection as get_postgres_connection,
        get_current_establishment,
        set_current_establishment
    )
except ImportError:
    raise ImportError(
        "database_postgres module not found. "
        "This system requires PostgreSQL. Install: pip3 install psycopg2-binary python-dotenv"
    )

def generate_unique_barcode(pending_shipment_id: int, line_number: int, product_sku: str = '') -> str:
    """
    Generate a unique 12-digit barcode for a shipment item
    Format: 200 (shipment prefix) + shipment_id (4 digits) + line_number (4 digits) + checksum (1 digit)
    
    Args:
        pending_shipment_id: The pending shipment ID
        line_number: The line number in the shipment
        product_sku: Optional SKU for uniqueness
    
    Returns:
        A 12-digit barcode string
    """
    # Use prefix 200 for shipment items
    prefix = "200"
    
    # Pad shipment_id to 4 digits (supports up to 9999 shipments)
    shipment_id_str = str(pending_shipment_id % 10000).zfill(4)
    
    # Pad line_number to 4 digits (supports up to 9999 items per shipment)
    line_str = str(line_number % 10000).zfill(4)
    
    # Combine prefix + shipment_id + line_number (11 digits total)
    barcode_base = prefix + shipment_id_str + line_str
    
    # Calculate checksum (sum of digits mod 10)
    checksum = sum(int(d) for d in barcode_base) % 10
    
    # Return 12-digit barcode
    barcode = barcode_base + str(checksum)
    
    # Check for uniqueness and adjust if needed
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check in pending_shipment_items
    cursor.execute("SELECT COUNT(*) FROM pending_shipment_items WHERE barcode = %s", (barcode,))
    pending_count = cursor.fetchone()[0] or 0
    
    # Check in inventory
    cursor.execute("SELECT COUNT(*) FROM inventory WHERE barcode = %s", (barcode,))
    inventory_count = cursor.fetchone()[0] or 0
    
    conn.close()
    
    # If barcode already exists, add a hash-based suffix
    if pending_count > 0 or inventory_count > 0:
        # Use a hash of SKU + shipment_id + line_number to create unique suffix
        hash_input = f"{product_sku}{pending_shipment_id}{line_number}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest()[:2], 16) % 100
        # Replace last 2 digits with hash value
        barcode = barcode[:-2] + str(hash_value).zfill(2)
    
    return barcode

def get_connection():
    """
    Get local PostgreSQL connection
    This system uses PostgreSQL exclusively - no SQLite support
    """
    return get_postgres_connection()

def set_connection_override(connection_func):
    """
    Override the connection function (compatibility function for web_viewer.py)
    Since this module only uses PostgreSQL now, this is a no-op
    """
    # No-op since we only use PostgreSQL
    pass

def ensure_metadata_tables(conn=None):
    """Ensure metadata extraction tables exist in PostgreSQL."""
    with _ensure_metadata_lock:
        should_close = False
        if conn is None:
            conn = get_connection()
            should_close = True
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_metadata'")
            if cursor.fetchone():
                if should_close:
                    try:
                        conn.close()
                    except Exception:
                        pass
                return
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    category_id SERIAL PRIMARY KEY,
                    category_name TEXT NOT NULL,
                    description TEXT,
                    parent_category_id INTEGER REFERENCES categories(category_id),
                    is_auto_generated INTEGER DEFAULT 0 CHECK(is_auto_generated IN (0, 1)),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_root_name
                ON categories (category_name) WHERE parent_category_id IS NULL
            """)
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_parent
                ON categories (category_name, parent_category_id) WHERE parent_category_id IS NOT NULL
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS product_metadata (
                    metadata_id SERIAL PRIMARY KEY,
                    product_id INTEGER NOT NULL UNIQUE REFERENCES inventory(product_id) ON DELETE CASCADE,
                    brand TEXT,
                    color TEXT,
                    size TEXT,
                    tags TEXT,
                    keywords TEXT,
                    attributes TEXT,
                    search_vector TEXT,
                    category_id INTEGER REFERENCES categories(category_id),
                    category_confidence REAL DEFAULT 0 CHECK(category_confidence >= 0 AND category_confidence <= 1),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS metadata_extraction_log (
                    log_id SERIAL PRIMARY KEY,
                    product_id INTEGER NOT NULL REFERENCES inventory(product_id) ON DELETE CASCADE,
                    extraction_method TEXT NOT NULL,
                    data_extracted TEXT,
                    execution_time_ms INTEGER,
                    success INTEGER DEFAULT 1 CHECK(success IN (0, 1)),
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS search_history (
                    search_id SERIAL PRIMARY KEY,
                    search_query TEXT NOT NULL,
                    results_count INTEGER DEFAULT 0,
                    filters TEXT,
                    user_id INTEGER REFERENCES employees(employee_id),
                    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_product_metadata_product ON product_metadata(product_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_product_metadata_category ON product_metadata(category_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_product_metadata_brand ON product_metadata(brand)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_metadata_log_product ON metadata_extraction_log(product_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(search_timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(category_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_category_id)")
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
        finally:
            if should_close:
                try:
                    conn.close()
                except Exception:
                    pass

def ensure_shipment_verification_tables(conn=None):
    """Ensure shipment verification tables and columns exist."""
    with _ensure_shipment_lock:
        should_close = False
        if conn is None:
            conn = get_connection()
            should_close = True
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipment_verification_settings'")
            if cursor.fetchone():
                if should_close:
                    try:
                        conn.close()
                    except Exception:
                        pass
                return
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shipment_verification_settings (
                    setting_key TEXT PRIMARY KEY,
                    setting_value TEXT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                INSERT INTO shipment_verification_settings (setting_key, setting_value, description)
                VALUES
                    ('workflow_mode', 'simple', 'Verification workflow mode: simple or three_step'),
                    ('auto_add_to_inventory', 'true', 'Automatically add verified items to inventory')
                ON CONFLICT (setting_key) DO NOTHING
            """)
            cursor.execute("ALTER TABLE pending_shipments ADD COLUMN IF NOT EXISTS workflow_step TEXT")
            cursor.execute("ALTER TABLE pending_shipments ADD COLUMN IF NOT EXISTS added_to_inventory INTEGER DEFAULT 0 CHECK(added_to_inventory IN (0, 1))")
            cursor.execute("ALTER TABLE pending_shipment_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'")
            cursor.execute("ALTER TABLE pending_shipment_items ADD COLUMN IF NOT EXISTS verified_by INTEGER")
            cursor.execute("ALTER TABLE pending_shipment_items ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP")
            cursor.execute("ALTER TABLE pending_shipment_items ADD COLUMN IF NOT EXISTS barcode TEXT")
            cursor.execute("ALTER TABLE pending_shipment_items ADD COLUMN IF NOT EXISTS line_number INTEGER")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shipment_issues (
                    issue_id SERIAL PRIMARY KEY,
                    pending_shipment_id INTEGER NOT NULL REFERENCES pending_shipments(pending_shipment_id),
                    pending_item_id INTEGER REFERENCES pending_shipment_items(pending_item_id),
                    issue_type TEXT NOT NULL CHECK(issue_type IN ('missing', 'damaged', 'wrong_item', 'quantity_mismatch', 'expired', 'quality', 'other')),
                    severity TEXT DEFAULT 'minor' CHECK(severity IN ('minor', 'major', 'critical')),
                    quantity_affected INTEGER DEFAULT 1,
                    reported_by INTEGER NOT NULL REFERENCES employees(employee_id),
                    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    description TEXT,
                    photo_path TEXT,
                    resolution_status TEXT DEFAULT 'open' CHECK(resolution_status IN ('open', 'resolved', 'vendor_contacted', 'credit_issued')),
                    resolved_by INTEGER REFERENCES employees(employee_id),
                    resolved_at TIMESTAMP,
                    resolution_notes TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shipment_scan_log (
                    scan_id SERIAL PRIMARY KEY,
                    pending_shipment_id INTEGER NOT NULL REFERENCES pending_shipments(pending_shipment_id),
                    pending_item_id INTEGER REFERENCES pending_shipment_items(pending_item_id),
                    scanned_barcode TEXT NOT NULL,
                    scanned_by INTEGER NOT NULL REFERENCES employees(employee_id),
                    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    scan_result TEXT DEFAULT 'match' CHECK(scan_result IN ('match', 'mismatch', 'unknown', 'duplicate')),
                    device_id TEXT,
                    location TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS verification_sessions (
                    session_id SERIAL PRIMARY KEY,
                    pending_shipment_id INTEGER NOT NULL REFERENCES pending_shipments(pending_shipment_id),
                    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ended_at TIMESTAMP,
                    total_scans INTEGER DEFAULT 0,
                    items_verified INTEGER DEFAULT 0,
                    issues_reported INTEGER DEFAULT 0,
                    device_id TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS approved_shipments (
                    shipment_id SERIAL PRIMARY KEY,
                    pending_shipment_id INTEGER REFERENCES pending_shipments(pending_shipment_id),
                    vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id),
                    purchase_order_number TEXT,
                    received_date DATE,
                    approved_by INTEGER NOT NULL REFERENCES employees(employee_id),
                    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    total_items_received INTEGER DEFAULT 0,
                    total_cost NUMERIC DEFAULT 0,
                    has_issues INTEGER DEFAULT 0 CHECK(has_issues IN (0, 1)),
                    issue_count INTEGER DEFAULT 0
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS approved_shipment_items (
                    approved_item_id SERIAL PRIMARY KEY,
                    shipment_id INTEGER NOT NULL REFERENCES approved_shipments(shipment_id),
                    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
                    quantity_received INTEGER NOT NULL CHECK(quantity_received > 0),
                    unit_cost NUMERIC NOT NULL CHECK(unit_cost >= 0),
                    lot_number TEXT,
                    expiration_date DATE,
                    received_by INTEGER NOT NULL REFERENCES employees(employee_id),
                    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipment_issues_shipment ON shipment_issues(pending_shipment_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipment_issues_item ON shipment_issues(pending_item_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipment_scan_log_shipment ON shipment_scan_log(pending_shipment_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipment_scan_log_item ON shipment_scan_log(pending_item_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_verification_sessions_shipment ON verification_sessions(pending_shipment_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_approved_shipments_pending ON approved_shipments(pending_shipment_id)")
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
        finally:
            if should_close:
                try:
                    conn.close()
                except Exception:
                    pass

def _normalize_category_path(category_path: str) -> List[str]:
    """Normalize and split category path. Returns list of segments, or empty if invalid."""
    if not category_path or not isinstance(category_path, str):
        return []
    # Collapse whitespace, split by > or →
    raw = re.sub(r'\s+', ' ', category_path).strip()
    parts = [p.strip() for p in re.split(r'[>→]', raw) if p.strip()]
    return parts


def get_category_by_path(category_path: str, conn=None) -> Optional[int]:
    """
    Look up category_id by path (read-only). Does not create.
    Returns the most specific category_id, or None if any segment is missing.
    """
    parts = _normalize_category_path(category_path)
    if not parts:
        return None
    path_key = " > ".join(parts)
    if path_key in _category_path_cache:
        return _category_path_cache[path_key]
    if conn is None:
        conn = get_connection()
        should_close = True
    else:
        should_close = False
    try:
        cursor = conn.cursor()
        parent_id = None
        for category_name in parts:
            if parent_id is not None:
                cursor.execute("""
                    SELECT category_id FROM categories
                    WHERE category_name = %s AND parent_category_id = %s
                """, (category_name, parent_id))
            else:
                cursor.execute("""
                    SELECT category_id FROM categories
                    WHERE category_name = %s AND parent_category_id IS NULL
                """, (category_name,))
            row = cursor.fetchone()
            if not row:
                return None
            parent_id = row[0]
        if len(_category_path_cache) < _category_cache_max_size:
            _category_path_cache[path_key] = parent_id
        return parent_id
    except Exception as e:
        logger.warning("get_category_by_path failed: %s", e)
        return None
    finally:
        if should_close and conn:
            try:
                conn.close()
            except Exception:
                pass


def create_or_get_category_with_hierarchy(category_path: str, conn=None) -> Optional[int]:
    """
    Create or get category with parent-child hierarchy.
    Example: "Electronics > Phones > Smartphones" creates:
    - Electronics (parent)
    - Phones (child of Electronics)
    - Smartphones (child of Phones)
    Uses RETURNING for Postgres; normalizes/validates path; idempotent under races.
    """
    import psycopg2
    parts = _normalize_category_path(category_path)
    if not parts:
        logger.debug("create_or_get_category: empty or invalid path %r", category_path)
        return None
    path_key = " > ".join(parts)
    if path_key in _category_path_cache:
        return _category_path_cache[path_key]
    if conn is None:
        conn = get_connection()
        should_close = True
    else:
        should_close = False
    try:
        cursor = conn.cursor()
        parent_id = None
        for category_name in parts:
            if parent_id is not None:
                cursor.execute("""
                    SELECT category_id FROM categories
                    WHERE category_name = %s AND parent_category_id = %s
                """, (category_name, parent_id))
            else:
                cursor.execute("""
                    SELECT category_id FROM categories
                    WHERE category_name = %s AND parent_category_id IS NULL
                """, (category_name,))
            row = cursor.fetchone()
            if row:
                category_id = row[0]
            else:
                try:
                    cursor.execute("""
                        INSERT INTO categories (category_name, parent_category_id, is_auto_generated)
                        VALUES (%s, %s, 1)
                        RETURNING category_id
                    """, (category_name, parent_id))
                    r = cursor.fetchone()
                    category_id = r[0] if r else None
                except psycopg2.IntegrityError:
                    conn.rollback()
                    if parent_id is not None:
                        cursor.execute("""
                            SELECT category_id FROM categories
                            WHERE category_name = %s AND parent_category_id = %s
                        """, (category_name, parent_id))
                    else:
                        cursor.execute("""
                            SELECT category_id FROM categories
                            WHERE category_name = %s AND parent_category_id IS NULL
                        """, (category_name,))
                    row = cursor.fetchone()
                    category_id = row[0] if row else None
                if category_id is None:
                    logger.warning("create_or_get_category: failed for %r", category_name)
                    return None
            parent_id = category_id
        conn.commit()
        if len(_category_path_cache) < _category_cache_max_size:
            _category_path_cache[path_key] = parent_id
        return parent_id
    except Exception as e:
        logger.warning("create_or_get_category_with_hierarchy failed: %s", e)
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    finally:
        if should_close and conn:
            try:
                conn.close()
            except Exception:
                pass

def _build_category_path(category_id: int, by_id: Dict[int, Dict]) -> str:
    """Build full path (e.g. 'Electronics > Phones') by walking parent_category_id."""
    parts = []
    cid = category_id
    while cid:
        node = by_id.get(cid)
        if not node:
            break
        name = node.get("category_name")
        if isinstance(name, bytes):
            name = name.decode("utf-8", errors="replace")
        parts.append(str(name))
        cid = node.get("parent_category_id")
    return " > ".join(reversed(parts)) if parts else ""


def list_categories(include_path: bool = True) -> List[Dict[str, Any]]:
    """List all categories. Optionally include category_path (e.g. 'Electronics > Phones')."""
    from psycopg2.extras import RealDictCursor
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            conn.rollback()
        except Exception:
            pass
        cursor.execute("SELECT * FROM categories ORDER BY category_name")
        rows = cursor.fetchall()
        if not rows:
            return []
        out = [dict(row) for row in rows]
        if include_path:
            by_id = {r["category_id"]: r for r in out}
            for r in out:
                r["category_path"] = _build_category_path(r["category_id"], by_id)
        return out
    except Exception as e:
        error_message = str(e).lower()
        if "categories" in error_message and "does not exist" in error_message:
            return []
        logger.exception("list_categories failed")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def suggest_categories_for_product(product_name: str, barcode: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return category suggestions for a product (no DB write)."""
    try:
        from metadata_extraction import FreeMetadataSystem
        system = FreeMetadataSystem()
        metadata = system.extract_metadata_from_product(
            product_name=product_name,
            barcode=barcode,
            description=None
        )
        suggestions = metadata.get("category_suggestions") or []
        return [
            {"category_name": s.get("category_name"), "confidence": s.get("confidence", 0)}
            for s in suggestions if s.get("category_name")
        ]
    except Exception as e:
        logger.warning("suggest_categories_for_product failed: %s", e)
        return []


def assign_category_to_product(
    product_id: int,
    category_id: Optional[int] = None,
    category_path: Optional[str] = None,
    confidence: float = 1.0
) -> bool:
    """Assign category to product. Provide category_id or category_path. Updates product_metadata and inventory.category."""
    if category_id is None and not category_path:
        return False
    if category_id is None:
        category_id = create_or_get_category_with_hierarchy(category_path)
    if category_id is None:
        return False
    parts = _normalize_category_path(category_path) if category_path else []
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = %s", (product_id,))
        exists = cursor.fetchone()
        if exists:
            cursor.execute("""
                UPDATE product_metadata SET category_id = %s, category_confidence = %s, updated_at = CURRENT_TIMESTAMP
                WHERE product_id = %s
            """, (category_id, confidence, product_id))
        else:
            cursor.execute("""
                INSERT INTO product_metadata (product_id, category_id, category_confidence, updated_at)
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            """, (product_id, category_id, confidence))
        cursor.execute("SELECT category_name FROM categories WHERE category_id = %s", (category_id,))
        row = cursor.fetchone()
        leaf_name = (row[0] if row else None) or (parts[-1] if parts else str(category_id))
        cursor.execute("""
            UPDATE inventory SET category = %s, updated_at = NOW() WHERE product_id = %s
        """, (leaf_name, product_id))
        conn.commit()
        return True
    except Exception as e:
        logger.warning("assign_category_to_product failed: %s", e)
        conn.rollback()
        return False
    finally:
        conn.close()


def extract_metadata_for_product(product_id: int, auto_sync_category: bool = True):
    """
    Automatically extract metadata for a product
    Called automatically when products are created or updated
    
    Args:
        product_id: ID of the product to extract metadata for
        auto_sync_category: If True, sync category to inventory.category field
    """
    print(f"  [extract_metadata_for_product] Starting for product_id={product_id}, auto_sync_category={auto_sync_category}")
    try:
        print(f"  [extract_metadata_for_product] Importing FreeMetadataSystem...")
        from metadata_extraction import FreeMetadataSystem
        print(f"  [extract_metadata_for_product] Import successful")
        
        # Get product
        print(f"  [extract_metadata_for_product] Getting product {product_id}...")
        product = get_product(product_id)
        if not product:
            print(f"⚠ ERROR: Product {product_id} not found - cannot extract metadata")
            return False
        
        print(f"  Product found: {product.get('product_name')} (SKU: {product.get('sku')})")
        
        # Extract metadata
        print(f"  Extracting metadata for: {product.get('product_name')} (SKU: {product.get('sku')}, Barcode: {product.get('barcode')})")
        metadata_system = FreeMetadataSystem()
        metadata = metadata_system.extract_metadata_from_product(
            product_name=product['product_name'],
            barcode=product.get('barcode'),
            description=None
        )
        print(f"  Extracted metadata: {json.dumps(metadata, indent=2, default=str)[:500]}...")  # Print first 500 chars
        
        # Save metadata
        try:
            metadata_system.save_product_metadata(
                product_id=product_id,
                metadata=metadata,
                extraction_method='auto_on_create'
            )
            print(f"✓ Saved metadata to product_metadata table for product {product_id}")
            
            # Verify metadata was saved
            verify_conn = get_connection()
            try:
                verify_cursor = verify_conn.cursor()
                verify_cursor.execute("""
                    SELECT brand, color, size, category_id, tags, keywords 
                    FROM product_metadata 
                    WHERE product_id = %s
                """, (product_id,))
                verify_row = verify_cursor.fetchone()
                if verify_row:
                    print(f"  Verified metadata in DB: brand={verify_row[0]}, color={verify_row[1]}, size={verify_row[2]}, category_id={verify_row[3]}")
                    if verify_row[4]:  # tags
                        print(f"  Tags: {verify_row[4][:100]}...")
                    if verify_row[5]:  # keywords
                        print(f"  Keywords: {verify_row[5][:100]}...")
                else:
                    print(f"  ⚠ WARNING: Metadata not found in database after save!")
            except Exception as verify_err:
                print(f"  ⚠ Error verifying metadata: {verify_err}")
            finally:
                verify_conn.close()
        except Exception as e:
            print(f"⚠ Error saving metadata for product {product_id}: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Optionally sync category to inventory.category field
        if auto_sync_category:
            try:
                category_suggestions = metadata.get('category_suggestions', [])
                if not category_suggestions:
                    print(f"⚠ No category suggestions for product {product_id} ({product.get('product_name')})")
                else:
                    suggested_category = category_suggestions[0].get('category_name')
                    confidence = category_suggestions[0].get('confidence', 0)
                    if suggested_category:
                        print(f"✓ Category suggestion for product {product_id}: {suggested_category} (confidence: {confidence:.2f})")
                        conn = get_connection()
                        try:
                            cursor = conn.cursor()
                            cat_id = create_or_get_category_with_hierarchy(suggested_category, conn)
                            if cat_id is None:
                                print(f"⚠ Failed to create/get category '{suggested_category}' for product {product_id}")
                            else:
                                parts = _normalize_category_path(suggested_category)
                                most_specific = parts[-1] if parts else suggested_category
                                # Get current category from database (not from cached product dict)
                                cursor.execute("SELECT category FROM inventory WHERE product_id = %s", (product_id,))
                                current_row = cursor.fetchone()
                                current_category = current_row[0] if current_row else None
                                
                                if current_category != most_specific:
                                    cursor.execute("""
                                        UPDATE inventory
                                        SET category = %s, updated_at = NOW()
                                        WHERE product_id = %s
                                    """, (most_specific, product_id))
                                    conn.commit()
                                    print(f"✓ Updated category for product {product_id}: '{current_category}' -> '{most_specific}'")
                                    # Verify the update
                                    cursor.execute("SELECT category FROM inventory WHERE product_id = %s", (product_id,))
                                    verify_row = cursor.fetchone()
                                    verified_category = verify_row[0] if verify_row else None
                                    print(f"  Verified category in DB: '{verified_category}'")
                                else:
                                    print(f"✓ Category already set for product {product_id}: '{most_specific}'")
                        except Exception as e:
                            print(f"⚠ Error syncing category for product {product_id}: {e}")
                            import traceback
                            traceback.print_exc()
                            conn.rollback()
                        finally:
                            conn.close()
                    else:
                        print(f"⚠ Empty category_name in suggestions for product {product_id}")
            except Exception as e:
                print(f"⚠ Category sync failed for product_id={product_id}: {e}")
                import traceback
                traceback.print_exc()
        return True
    except Exception as e:
        print(f"⚠ ERROR: Metadata extraction failed for product_id={product_id}: {e}")
        import traceback
        traceback.print_exc()
        logger.debug("Metadata extraction failed for product_id=%s: %s", product_id, e)
        return False

def add_product(
    product_name: str,
    sku: str,
    product_price: float,
    product_cost: float,
    vendor: Optional[str] = None,
    vendor_id: Optional[int] = None,
    photo: Optional[str] = None,
    current_quantity: int = 0,
    category: Optional[str] = None,
    barcode: Optional[str] = None,
    auto_extract_metadata: bool = True
) -> int:
    """
    Add a new product to inventory
    
    Args:
        auto_extract_metadata: If True, automatically extract metadata after creating product
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO inventory 
            (product_name, sku, product_price, product_cost, vendor, vendor_id, photo, current_quantity, category, barcode)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (product_name, sku, product_price, product_cost, vendor, vendor_id, photo, current_quantity, category, barcode))
        
        conn.commit()
        product_id = cursor.lastrowid
        conn.close()
        
        # Automatically extract metadata if enabled
        if auto_extract_metadata:
            try:
                extract_metadata_for_product(product_id, auto_sync_category=True)
            except Exception:
                pass  # Don't fail product creation if metadata extraction fails
        
        return product_id
    except Exception as e:
        import psycopg2
        if isinstance(e, psycopg2.IntegrityError):
            conn.rollback()
            conn.close()
            raise ValueError(f"SKU '{sku}' already exists in database") from e

def get_product(product_id: int) -> Optional[Dict[str, Any]]:
    """Get a product by ID"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("SELECT * FROM inventory WHERE product_id = %s", (product_id,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()

def get_product_by_sku(sku: str) -> Optional[Dict[str, Any]]:
    """Get a product by SKU"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM inventory WHERE sku = %s", (sku,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def get_product_by_barcode(barcode: str) -> Optional[Dict[str, Any]]:
    """Get a product by barcode"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM inventory WHERE barcode = %s", (barcode,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def update_product(product_id: int, employee_id: Optional[int] = None, auto_extract_metadata: bool = False, **kwargs) -> bool:
    """
    Update product information with optional audit logging
    
    Args:
        auto_extract_metadata: If True, automatically extract metadata after update (useful if product_name changed)
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get old values for audit log
    old_product = get_product(product_id)
    if not old_product:
        conn.close()
        return False
    
    # Build update query dynamically
    allowed_fields = ['product_name', 'sku', 'product_price', 'product_cost', 
                     'vendor', 'vendor_id', 'photo', 'current_quantity', 'category', 'barcode']
    
    updates = []
    values = []
    new_values = {}
    
    for field, value in kwargs.items():
        if field in allowed_fields:
            updates.append(f"{field} = %s")
            values.append(value)
            new_values[field] = value
    
    if not updates:
        conn.close()
        return False
    
    # Add updated_at timestamp
    updates.append("updated_at = NOW()")
    values.append(datetime.now().isoformat())
    values.append(product_id)
    
    query = f"UPDATE inventory SET {', '.join(updates)} WHERE product_id = %s"
    
    try:
        cursor.execute(query, values)
        conn.commit()
        success = cursor.rowcount > 0
        
        # Log to audit log if employee_id is provided
        if success and employee_id:
            # Get new values for audit log using the same connection
            cursor.execute("SELECT * FROM inventory WHERE product_id = %s", (product_id,))
            updated_row = cursor.fetchone()
            if updated_row:
                updated_product = {col: updated_row[col] for col in updated_row.keys()}
                # Only log fields that changed
                old_values_filtered = {k: old_product.get(k) for k in new_values.keys()}
                new_values_filtered = {k: updated_product.get(k) for k in new_values.keys()}
                
                # Only log if there are actual changes
                if old_values_filtered != new_values_filtered:
                    try:
                        log_audit_action(
                            table_name='inventory',
                            record_id=product_id,
                            action_type='UPDATE',
                            employee_id=employee_id,
                            old_values=old_values_filtered,
                            new_values=new_values_filtered,
                            notes=f"Product updated: {old_product.get('product_name', 'Unknown')}"
                        )
                    except:
                        pass  # Don't fail if audit logging fails
        
        conn.close()
        
        # Automatically extract metadata if enabled and product name changed
        if auto_extract_metadata and 'product_name' in kwargs:
            try:
                extract_metadata_for_product(product_id, auto_sync_category=True)
            except Exception:
                pass  # Don't fail update if metadata extraction fails
        
        return success
    except Exception as e:
        import psycopg2
        conn.rollback()
        conn.close()
        if isinstance(e, psycopg2.IntegrityError):
            raise ValueError(f"SKU already exists in database") from e
        raise

def delete_product(product_id: int) -> bool:
    """Delete a product from inventory"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM inventory WHERE product_id = %s", (product_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

def list_products(
    category: Optional[str] = None,
    vendor: Optional[str] = None,
    min_quantity: Optional[int] = None
) -> List[Dict[str, Any]]:
    """List all products with optional filters"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM inventory WHERE 1=1"
    params = []
    
    if category:
        query += " AND category = %s"
        params.append(category)
    
    if vendor:
        query += " AND vendor = %s"
        params.append(vendor)
    
    if min_quantity is not None:
        query += " AND current_quantity >= %s"
        params.append(min_quantity)
    
    query += " ORDER BY product_name"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def update_quantity(product_id: int, quantity_change: int) -> bool:
    """Update product quantity (add or subtract)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get current quantity
    cursor.execute("SELECT current_quantity FROM inventory WHERE product_id = %s", (product_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return False
    
    new_quantity = row['current_quantity'] + quantity_change
    
    if new_quantity < 0:
        conn.close()
        raise ValueError("Quantity cannot be negative")
    
    cursor.execute("""
        UPDATE inventory 
        SET current_quantity = %s, updated_at = NOW()
        WHERE product_id = %s
    """, (new_quantity, datetime.now().isoformat(), product_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

# ============================================================================
# Vendor Management Functions
# ============================================================================

def _get_or_create_default_establishment(conn=None) -> int:
    """Get or create a default establishment (for local PostgreSQL)"""
    from psycopg2.extras import RealDictCursor
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True
    
    # Use RealDictCursor for consistent results
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Check if connection is in a bad state and rollback if needed
        try:
            conn.rollback()
        except:
            pass  # Ignore if already rolled back or no transaction
        
        # Check if establishments table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'establishments'
            )
        """)
        table_exists_result = cursor.fetchone()
        if isinstance(table_exists_result, dict):
            table_exists = table_exists_result.get('exists', False)
        else:
            table_exists = table_exists_result[0] if table_exists_result else False
        
        if not table_exists:
            # Create the establishments table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS establishments (
                    establishment_id SERIAL PRIMARY KEY,
                    establishment_name TEXT NOT NULL,
                    establishment_code TEXT UNIQUE NOT NULL,
                    subdomain TEXT UNIQUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    is_active BOOLEAN DEFAULT TRUE,
                    settings JSONB DEFAULT '{}'::jsonb
                )
            """)
            # Commit table creation
            if should_close:
                conn.commit()
            else:
                # If using shared connection, commit the table creation
                conn.commit()
                # Then rollback to start fresh for caller
                conn.rollback()
        
        # Try to get the first establishment
        cursor.execute("SELECT establishment_id FROM establishments LIMIT 1")
        result = cursor.fetchone()
        
        if result:
            # Handle both dict (RealDictCursor) and tuple results
            if isinstance(result, dict):
                establishment_id = result.get('establishment_id')
            else:
                establishment_id = result[0] if result else None
        else:
            establishment_id = None
        
        if not establishment_id:
            # Create a default establishment if none exists
            try:
                cursor.execute("""
                    INSERT INTO establishments (establishment_name, establishment_code, is_active)
                    VALUES ('Default Store', 'default', TRUE)
                    RETURNING establishment_id
                """)
                result = cursor.fetchone()
                if isinstance(result, dict):
                    establishment_id = result.get('establishment_id')
                else:
                    establishment_id = result[0] if result else None
                # Only commit if we're managing our own connection
                if should_close:
                    conn.commit()
                # If using shared connection, commit the establishment creation
                # so it's available for the caller's transaction
                else:
                    conn.commit()
                    # Rollback to start fresh transaction for caller
                    conn.rollback()
            except Exception as create_err:
                # If creation fails (e.g., duplicate key), rollback and try to get existing one
                try:
                    conn.rollback()
                    # Try to get it again in case it was created by another process
                    cursor.execute("SELECT establishment_id FROM establishments WHERE establishment_code = 'default' LIMIT 1")
                    result = cursor.fetchone()
                    if result:
                        if isinstance(result, dict):
                            establishment_id = result.get('establishment_id')
                        else:
                            establishment_id = result[0] if result else None
                except:
                    conn.rollback()
                    raise
        
        if not establishment_id:
            raise ValueError("Failed to get or create default establishment")
        
        return establishment_id
    except Exception as e:
        # Rollback on any error
        try:
            conn.rollback()
        except:
            pass
        import traceback
        traceback.print_exc()
        raise
    finally:
        if should_close:
            try:
                conn.close()
            except:
                pass

def add_vendor(
    vendor_name: str,
    contact_person: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None
) -> int:
    """Add a new vendor"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass  # Ignore if already rolled back or no transaction
        
        # Get or create default establishment
        establishment_id = _get_or_create_default_establishment(conn)
        
        cursor.execute("""
            INSERT INTO vendors (establishment_id, vendor_name, contact_person, email, phone, address)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING vendor_id
        """, (establishment_id, vendor_name, contact_person, email, phone, address))
        
        result = cursor.fetchone()
        if isinstance(result, dict):
            vendor_id = result.get('vendor_id')
        else:
            vendor_id = result[0] if result else None
        
        # Commit the transaction
        conn.commit()
        
        if vendor_id is None:
            raise ValueError("Failed to create vendor - no ID returned")
        
        return vendor_id
    except Exception as e:
        # Rollback on any error
        try:
            conn.rollback()
        except:
            pass
        import traceback
        traceback.print_exc()
        raise
    finally:
        try:
            conn.close()
        except:
            pass

def get_vendor(vendor_id: int) -> Optional[Dict[str, Any]]:
    """Get a vendor by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM vendors WHERE vendor_id = %s", (vendor_id,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def list_vendors() -> List[Dict[str, Any]]:
    """List all vendors"""
    from psycopg2.extras import RealDictCursor
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass  # Ignore if already rolled back or no transaction
        
        cursor.execute("SELECT * FROM vendors ORDER BY vendor_name")
        rows = cursor.fetchall()
        
        # RealDictCursor returns dict-like rows, convert to list of dicts
        if rows:
            return [dict(row) for row in rows]
        else:
            return []
    except Exception as e:
        import traceback
        traceback.print_exc()
        if conn:
            try:
                conn.rollback()
            except:
                pass
        raise
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

def update_vendor(vendor_id: int, **kwargs) -> bool:
    """Update vendor information"""
    conn = get_connection()
    cursor = conn.cursor()
    
    allowed_fields = ['vendor_name', 'contact_person', 'email', 'phone', 'address']
    updates = []
    values = []
    
    for field, value in kwargs.items():
        if field in allowed_fields:
            updates.append(f"{field} = %s")
            values.append(value)
    
    if not updates:
        conn.close()
        return False
    
    values.append(vendor_id)
    query = f"UPDATE vendors SET {', '.join(updates)} WHERE vendor_id = %s"
    
    cursor.execute(query, values)
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

def delete_vendor(vendor_id: int) -> bool:
    """Delete a vendor"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM vendors WHERE vendor_id = %s", (vendor_id,))
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

# ============================================================================
# Shipment Management Functions
# ============================================================================

def create_shipment(
    vendor_id: int,
    shipment_date: Optional[str] = None,
    received_date: Optional[str] = None,
    purchase_order_number: Optional[str] = None,
    tracking_number: Optional[str] = None,
    total_cost: Optional[float] = None,
    notes: Optional[str] = None
) -> int:
    """Create a new shipment"""
    conn = get_connection()
    cursor = conn.cursor()
    
    if shipment_date is None:
        shipment_date = datetime.now().date().isoformat()
    if received_date is None:
        received_date = datetime.now().date().isoformat()
    
    cursor.execute("""
        INSERT INTO shipments 
        (vendor_id, shipment_date, received_date, purchase_order_number, 
         tracking_number, total_cost, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (vendor_id, shipment_date, received_date, purchase_order_number, 
          tracking_number, total_cost, notes))
    
    conn.commit()
    shipment_id = cursor.lastrowid
    conn.close()
    
    return shipment_id

def get_shipment(shipment_id: int) -> Optional[Dict[str, Any]]:
    """Get a shipment by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM shipments WHERE shipment_id = %s", (shipment_id,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def list_shipments(
    vendor_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List shipments with optional filters"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM shipments WHERE 1=1"
    params = []
    
    if vendor_id:
        query += " AND vendor_id = %s"
        params.append(vendor_id)
    
    if start_date:
        query += " AND shipment_date >= %s"
        params.append(start_date)
    
    if end_date:
        query += " AND shipment_date <= %s"
        params.append(end_date)
    
    query += " ORDER BY shipment_date DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def update_shipment(shipment_id: int, **kwargs) -> bool:
    """Update shipment information"""
    conn = get_connection()
    cursor = conn.cursor()
    
    allowed_fields = ['vendor_id', 'shipment_date', 'received_date', 
                     'purchase_order_number', 'tracking_number', 'total_cost', 'notes']
    updates = []
    values = []
    
    for field, value in kwargs.items():
        if field in allowed_fields:
            updates.append(f"{field} = %s")
            values.append(value)
    
    if not updates:
        conn.close()
        return False
    
    values.append(shipment_id)
    query = f"UPDATE shipments SET {', '.join(updates)} WHERE shipment_id = %s"
    
    cursor.execute(query, values)
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

# ============================================================================
# Shipment Items Management Functions
# ============================================================================

def add_shipment_item(
    shipment_id: int,
    product_id: int,
    quantity_received: int,
    unit_cost: float,
    lot_number: Optional[str] = None,
    expiration_date: Optional[str] = None
) -> int:
    """Add an item to a shipment (triggers inventory update automatically)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO shipment_items 
            (shipment_id, product_id, quantity_received, unit_cost, lot_number, expiration_date)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (shipment_id, product_id, quantity_received, unit_cost, lot_number, expiration_date))
        
        conn.commit()
        # For PostgreSQL, use RETURNING or fetch the ID from cursor
        shipment_item_id = cursor.lastrowid if hasattr(cursor, 'lastrowid') else None
        conn.close()
        
        return shipment_item_id
    except Exception as e:
        import psycopg2
        conn.rollback()
        if isinstance(e, psycopg2.IntegrityError):
            pass  # Handle integrity error
        conn.close()
        raise ValueError(f"Invalid shipment_id or product_id") from e

def get_shipment_items(shipment_id: int) -> List[Dict[str, Any]]:
    """Get all items for a shipment"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT si.*, i.product_name, i.sku
        FROM shipment_items si
        JOIN inventory i ON si.product_id = i.product_id
        WHERE si.shipment_id = %s
        ORDER BY si.shipment_item_id
    """, (shipment_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_shipment_item(shipment_item_id: int) -> Optional[Dict[str, Any]]:
    """Get a shipment item by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM shipment_items WHERE shipment_item_id = %s", (shipment_item_id,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

# ============================================================================
# Reporting/Query Functions
# ============================================================================

def trace_product_to_vendors(product_id: int) -> List[Dict[str, Any]]:
    """Trace a product back to its source shipments and vendors"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            i.product_name,
            i.sku,
            si.quantity_received,
            si.unit_cost,
            si.lot_number,
            si.expiration_date,
            si.received_timestamp,
            s.shipment_date,
            s.received_date,
            s.purchase_order_number,
            s.tracking_number,
            v.vendor_name,
            v.contact_person,
            v.email,
            v.phone
        FROM inventory i
        JOIN shipment_items si ON i.product_id = si.product_id
        JOIN shipments s ON si.shipment_id = s.shipment_id
        JOIN vendors v ON s.vendor_id = v.vendor_id
        WHERE i.product_id = %s
        ORDER BY s.shipment_date DESC, si.received_timestamp DESC
    """, (product_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_shipment_details(shipment_id: int) -> Optional[Dict[str, Any]]:
    """Get full shipment details including vendor and items"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get shipment with vendor info
    cursor.execute("""
        SELECT s.*, v.vendor_name, v.contact_person, v.email, v.phone
        FROM shipments s
        JOIN vendors v ON s.vendor_id = v.vendor_id
        WHERE s.shipment_id = %s
    """, (shipment_id,))
    
    shipment = cursor.fetchone()
    if not shipment:
        conn.close()
        return None
    
    # Get shipment items
    items = get_shipment_items(shipment_id)
    
    result = dict(shipment)
    result['items'] = items
    
    conn.close()
    return result

# ============================================================================
# Sales/Transaction Management Functions
# ============================================================================

def record_sale(
    product_id: int,
    quantity_sold: int,
    sale_price: float,
    notes: Optional[str] = None
) -> int:
    """Record a sale/transaction (automatically decreases inventory)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if enough inventory exists
    cursor.execute("SELECT current_quantity FROM inventory WHERE product_id = %s", (product_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise ValueError(f"Product ID {product_id} not found")
    
    current_qty = row['current_quantity']
    if quantity_sold > current_qty:
        conn.close()
        raise ValueError(f"Insufficient inventory. Available: {current_qty}, Requested: {quantity_sold}")
    
    try:
        cursor.execute("""
            INSERT INTO sales (product_id, quantity_sold, sale_price, notes)
            VALUES (%s, %s, %s, %s)
        """, (product_id, quantity_sold, sale_price, notes))
        
        conn.commit()
        # For PostgreSQL, need to use RETURNING or fetch differently
        sale_id = cursor.lastrowid if hasattr(cursor, 'lastrowid') else None
        conn.close()
        
        return sale_id
    except Exception as e:
        import psycopg2
        if isinstance(e, psycopg2.IntegrityError):
            conn.rollback()
            conn.close()
            raise ValueError(f"Error recording sale") from e

def get_sales(
    product_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get sales records with optional filters"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT s.*, i.product_name, i.sku
        FROM sales s
        JOIN inventory i ON s.product_id = i.product_id
        WHERE 1=1
    """
    params = []
    
    if product_id:
        query += " AND s.product_id = %s"
        params.append(product_id)
    
    if start_date:
        query += " AND DATE(s.sale_date) >= %s"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(s.sale_date) <= %s"
        params.append(end_date)
    
    query += " ORDER BY s.sale_date DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

# ============================================================================
# Inventory Tracking by Vendor Functions
# ============================================================================

def get_inventory_by_vendor(product_id: int) -> Dict[str, Any]:
    """
    Get remaining inventory breakdown by vendor using FIFO (First In First Out) logic.
    Shows which vendor's inventory is still in stock.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get product info
    cursor.execute("SELECT * FROM inventory WHERE product_id = %s", (product_id,))
    product = cursor.fetchone()
    
    if not product:
        conn.close()
        return None
    
    # Get all shipments for this product (oldest first for FIFO)
    cursor.execute("""
        SELECT 
            si.shipment_item_id,
            si.quantity_received,
            si.received_timestamp,
            si.unit_cost,
            si.lot_number,
            si.expiration_date,
            s.shipment_id,
            s.shipment_date,
            s.received_date,
            v.vendor_id,
            v.vendor_name,
            s.purchase_order_number
        FROM shipment_items si
        JOIN shipments s ON si.shipment_id = s.shipment_id
        JOIN vendors v ON s.vendor_id = v.vendor_id
        WHERE si.product_id = %s
        ORDER BY si.received_timestamp ASC
    """, (product_id,))
    
    shipments = cursor.fetchall()
    
    # Get total quantity sold
    cursor.execute("SELECT COALESCE(SUM(quantity_sold), 0) as total_sold FROM sales WHERE product_id = %s", (product_id,))
    total_sold_row = cursor.fetchone()
    total_sold = total_sold_row['total_sold'] if total_sold_row else 0
    
    # Calculate remaining inventory by vendor using FIFO
    remaining_to_allocate = product['current_quantity']
    vendor_breakdown = []
    
    # Process shipments in reverse (newest first) to see what's left
    # FIFO means oldest inventory is sold first, so newest is what remains
    for shipment in reversed(shipments):
        shipment_qty = shipment['quantity_received']
        
        # Calculate how much of this shipment is remaining
        # If we've already allocated all remaining inventory, this shipment is fully sold
        if remaining_to_allocate <= 0:
            remaining_from_shipment = 0
        elif remaining_to_allocate >= shipment_qty:
            # This entire shipment is still in stock
            remaining_from_shipment = shipment_qty
            remaining_to_allocate -= shipment_qty
        else:
            # Partially remaining
            remaining_from_shipment = remaining_to_allocate
            remaining_to_allocate = 0
        
        if remaining_from_shipment > 0:
            vendor_breakdown.append({
                'vendor_id': shipment['vendor_id'],
                'vendor_name': shipment['vendor_name'],
                'shipment_id': shipment['shipment_id'],
                'shipment_date': shipment['shipment_date'],
                'received_date': shipment['received_date'],
                'purchase_order_number': shipment['purchase_order_number'],
                'quantity_received': shipment_qty,
                'quantity_remaining': remaining_from_shipment,
                'quantity_sold_from_shipment': shipment_qty - remaining_from_shipment,
                'unit_cost': shipment['unit_cost'],
                'lot_number': shipment['lot_number'],
                'expiration_date': shipment['expiration_date'],
                'received_timestamp': shipment['received_timestamp']
            })
    
    # Reverse to show oldest first
    vendor_breakdown.reverse()
    
    # Calculate totals by vendor
    vendor_totals = {}
    for item in vendor_breakdown:
        vendor_id = item['vendor_id']
        vendor_name = item['vendor_name']
        if vendor_id not in vendor_totals:
            vendor_totals[vendor_id] = {
                'vendor_name': vendor_name,
                'total_remaining': 0,
                'shipments': []
            }
        vendor_totals[vendor_id]['total_remaining'] += item['quantity_remaining']
        vendor_totals[vendor_id]['shipments'].append(item)
    
    conn.close()
    
    return {
        'product_id': product_id,
        'product_name': product['product_name'],
        'sku': product['sku'],
        'current_quantity': product['current_quantity'],
        'total_sold': total_sold,
        'vendor_breakdown': vendor_breakdown,
        'vendor_totals': list(vendor_totals.values())
    }

# ============================================================================
# Pending Shipment Management Functions
# ============================================================================

def create_pending_shipment(
    vendor_id: int,
    file_path: Optional[str] = None,
    expected_date: Optional[str] = None,
    purchase_order_number: Optional[str] = None,
    tracking_number: Optional[str] = None,
    notes: Optional[str] = None,
    uploaded_by: Optional[int] = None,
    verification_mode: str = 'auto_add'
) -> int:
    """Create a new pending shipment record"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass
        
        # Get or create default establishment
        # This function handles its own transaction state
        try:
            establishment_id = _get_or_create_default_establishment(conn)
        except Exception as e:
            # If establishment creation fails, rollback and re-raise
            try:
                conn.rollback()
            except:
                pass
            raise
        
        # Ensure we're in a clean transaction state after establishment creation
        try:
            conn.rollback()  # Start fresh transaction
        except:
            pass
        
        # Check if vendors table exists (required for foreign key)
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'vendors'
            )
        """)
        vendors_exists_result = cursor.fetchone()
        if isinstance(vendors_exists_result, dict):
            vendors_exists = vendors_exists_result.get('exists', False)
        else:
            vendors_exists = vendors_exists_result[0] if vendors_exists_result else False
        
        if not vendors_exists:
            # Create vendors table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vendors (
                    vendor_id SERIAL PRIMARY KEY,
                    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
                    vendor_name TEXT NOT NULL,
                    contact_person TEXT,
                    email TEXT,
                    phone TEXT,
                    address TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            conn.commit()
            conn.rollback()
        
        # Check if pending_shipments table exists, create if not
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pending_shipments'
            )
        """)
        table_exists_result = cursor.fetchone()
        if isinstance(table_exists_result, dict):
            table_exists = table_exists_result.get('exists', False)
        else:
            table_exists = table_exists_result[0] if table_exists_result else False
        
        if not table_exists:
            # Create pending_shipments table
            try:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS pending_shipments (
                        pending_shipment_id SERIAL PRIMARY KEY,
                        establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
                        vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id),
                        expected_date TEXT,
                        upload_timestamp TIMESTAMP DEFAULT NOW(),
                        file_path TEXT,
                        purchase_order_number TEXT,
                        tracking_number TEXT,
                        status TEXT DEFAULT 'in_progress' CHECK(status IN ('pending_review', 'in_progress', 'approved', 'rejected', 'completed_with_issues')),
                        uploaded_by INTEGER,
                        approved_by INTEGER,
                        approved_date TIMESTAMP,
                        reviewed_by TEXT,
                        reviewed_date TIMESTAMP,
                        notes TEXT,
                        started_by INTEGER,
                        started_at TIMESTAMP,
                        completed_by INTEGER,
                        completed_at TIMESTAMP,
                        verification_mode TEXT DEFAULT 'verify_whole_shipment'
                    )
                """)
                conn.commit()
                conn.rollback()
            except Exception as create_err:
                # If creation fails, rollback and check if table was created anyway
                try:
                    conn.rollback()
                    # Check again if table exists
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = 'pending_shipments'
                        )
                    """)
                    check_result = cursor.fetchone()
                    if isinstance(check_result, dict):
                        table_exists = check_result.get('exists', False)
                    else:
                        table_exists = check_result[0] if check_result else False
                    if not table_exists:
                        # Table still doesn't exist, raise the error
                        import traceback
                        traceback.print_exc()
                        raise ValueError(f"Failed to create pending_shipments table: {create_err}") from create_err
                except Exception as check_err:
                    import traceback
                    traceback.print_exc()
                    raise
        
        # Check if pending_shipment_items table exists, create if not
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pending_shipment_items'
            )
        """)
        items_table_exists_result = cursor.fetchone()
        if isinstance(items_table_exists_result, dict):
            items_table_exists = items_table_exists_result.get('exists', False)
        else:
            items_table_exists = items_table_exists_result[0] if items_table_exists_result else False
        
        if not items_table_exists:
            # Create pending_shipment_items table
            try:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS pending_shipment_items (
                        pending_item_id SERIAL PRIMARY KEY,
                        establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
                        pending_shipment_id INTEGER NOT NULL REFERENCES pending_shipments(pending_shipment_id) ON DELETE CASCADE,
                        product_sku TEXT,
                        product_name TEXT,
                        quantity_expected INTEGER NOT NULL CHECK(quantity_expected > 0),
                        quantity_verified INTEGER,
                        unit_cost NUMERIC(10,2) NOT NULL CHECK(unit_cost >= 0),
                        lot_number TEXT,
                        expiration_date TEXT,
                        discrepancy_notes TEXT,
                        product_id INTEGER REFERENCES inventory(product_id),
                        barcode TEXT,
                        line_number INTEGER
                    )
                """)
                conn.commit()
                conn.rollback()
            except Exception as create_err:
                # If creation fails, rollback and check if table was created anyway
                try:
                    conn.rollback()
                    # Check again if table exists
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = 'pending_shipment_items'
                        )
                    """)
                    check_result = cursor.fetchone()
                    if isinstance(check_result, dict):
                        items_table_exists = check_result.get('exists', False)
                    else:
                        items_table_exists = check_result[0] if check_result else False
                    if not items_table_exists:
                        # Table still doesn't exist, raise the error
                        import traceback
                        traceback.print_exc()
                        raise ValueError(f"Failed to create pending_shipment_items table: {create_err}") from create_err
                except Exception as check_err:
                    import traceback
                    traceback.print_exc()
                    raise
        
        # Ensure verification tracking columns exist
        try:
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'pending_shipments' AND table_schema = 'public'")
            columns = [col[0] for col in cursor.fetchall()]
            if 'verification_mode' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments 
                    ADD COLUMN verification_mode TEXT DEFAULT 'verify_whole_shipment'
                """)
                conn.commit()
                conn.rollback()
            if 'started_by' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments 
                    ADD COLUMN started_by INTEGER
                """)
                conn.commit()
                conn.rollback()
            if 'started_at' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments 
                    ADD COLUMN started_at TIMESTAMP
                """)
                conn.commit()
                conn.rollback()
            if 'completed_by' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments 
                    ADD COLUMN completed_by INTEGER
                """)
                conn.commit()
                conn.rollback()
            if 'completed_at' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments 
                    ADD COLUMN completed_at TIMESTAMP
                """)
                conn.commit()
                conn.rollback()
        except Exception as e:
            # Rollback on error and continue
            try:
                conn.rollback()
            except:
                pass
            # Column might already exist, continue
        
        if expected_date is None:
            expected_date = datetime.now().date().isoformat()
        
        # Validate verification_mode
        if verification_mode not in ('auto_add', 'verify_whole_shipment'):
            verification_mode = 'verify_whole_shipment'
        
        cursor.execute("""
            INSERT INTO pending_shipments 
            (establishment_id, vendor_id, file_path, expected_date, purchase_order_number, tracking_number, notes, uploaded_by, verification_mode, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'in_progress')
            RETURNING pending_shipment_id
        """, (establishment_id, vendor_id, file_path, expected_date, purchase_order_number, tracking_number, notes, uploaded_by, verification_mode))
        
        result = cursor.fetchone()
        if isinstance(result, dict):
            pending_shipment_id = result.get('pending_shipment_id')
        else:
            pending_shipment_id = result[0] if result else None
        
        conn.commit()
        
        if pending_shipment_id is None:
            raise ValueError("Failed to create pending shipment - no ID returned")
        
        return pending_shipment_id
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        import traceback
        traceback.print_exc()
        raise
    finally:
        try:
            conn.close()
        except:
            pass

def add_pending_shipment_item(
    pending_shipment_id: int,
    product_sku: str,
    product_name: Optional[str] = None,
    quantity_expected: int = 0,
    unit_cost: float = 0.0,
    lot_number: Optional[str] = None,
    expiration_date: Optional[str] = None,
    barcode: Optional[str] = None,
    line_number: Optional[int] = None
) -> int:
    """Add an item to a pending shipment"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass
        
        # Get or create default establishment
        establishment_id = _get_or_create_default_establishment(conn)
        
        # Try to match SKU to existing product
        cursor.execute("SELECT product_id FROM inventory WHERE sku = %s", (product_sku,))
        product_row = cursor.fetchone()
        if isinstance(product_row, dict):
            product_id = product_row.get('product_id')
        else:
            product_id = product_row[0] if product_row else None
        
        # Check if barcode and line_number columns exist
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'pending_shipment_items' AND table_schema = 'public'")
        column_rows = cursor.fetchall()
        # Handle both dict (RealDictCursor) and tuple results
        if column_rows and isinstance(column_rows[0], dict):
            columns = [row.get('column_name') for row in column_rows]
        else:
            columns = [row[0] for row in column_rows]
        has_barcode = 'barcode' in columns
        has_line_number = 'line_number' in columns
        
        if has_barcode and has_line_number:
            cursor.execute("""
                INSERT INTO pending_shipment_items 
                (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected, 
                 unit_cost, lot_number, expiration_date, product_id, barcode, line_number)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING pending_item_id
            """, (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected,
                  unit_cost, lot_number, expiration_date, product_id, barcode, line_number))
        elif has_barcode:
            cursor.execute("""
                INSERT INTO pending_shipment_items 
                (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected, 
                 unit_cost, lot_number, expiration_date, product_id, barcode)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING pending_item_id
            """, (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected,
                  unit_cost, lot_number, expiration_date, product_id, barcode))
        elif has_line_number:
            cursor.execute("""
                INSERT INTO pending_shipment_items 
                (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected, 
                 unit_cost, lot_number, expiration_date, product_id, line_number)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING pending_item_id
            """, (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected,
                  unit_cost, lot_number, expiration_date, product_id, line_number))
        else:
            cursor.execute("""
                INSERT INTO pending_shipment_items 
                (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected, 
                 unit_cost, lot_number, expiration_date, product_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING pending_item_id
            """, (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected,
                  unit_cost, lot_number, expiration_date, product_id))
        
        result = cursor.fetchone()
        if isinstance(result, dict):
            pending_item_id = result.get('pending_item_id')
        else:
            pending_item_id = result[0] if result else None
        
        conn.commit()
        
        if pending_item_id is None:
            raise ValueError("Failed to create pending shipment item - no ID returned")
        
        return pending_item_id
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        import traceback
        traceback.print_exc()
        raise
    finally:
        try:
            conn.close()
        except:
            pass

def get_pending_shipment(pending_shipment_id: int) -> Optional[Dict[str, Any]]:
    """Get a pending shipment by ID"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass
        
        cursor.execute("""
            SELECT ps.*, v.vendor_name, v.contact_person, v.email, v.phone
            FROM pending_shipments ps
            JOIN vendors v ON ps.vendor_id = v.vendor_id
            WHERE ps.pending_shipment_id = %s
        """, (pending_shipment_id,))
        
        row = cursor.fetchone()
        
        if row:
            return dict(row)
        return None
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        import traceback
        traceback.print_exc()
        raise
    finally:
        # Don't close the shared global connection
        pass

def get_pending_shipment_items(pending_shipment_id: int) -> List[Dict[str, Any]]:
    """Get all items for a pending shipment"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass
        
        cursor.execute("""
            SELECT 
                psi.*,
                i.product_id as matched_product_id,
                i.product_name as matched_product_name,
                CASE 
                    WHEN i.product_id IS NOT NULL THEN 'matched'
                    ELSE 'unmatched'
                END as match_status
            FROM pending_shipment_items psi
            LEFT JOIN inventory i ON psi.product_sku = i.sku
            WHERE psi.pending_shipment_id = %s
            ORDER BY psi.pending_item_id
        """, (pending_shipment_id,))
        
        rows = cursor.fetchall()
        
        return [dict(row) for row in rows]
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        import traceback
        traceback.print_exc()
        raise
    finally:
        # Don't close the shared global connection
        pass

def get_pending_shipment_details(pending_shipment_id: int) -> Optional[Dict[str, Any]]:
    """Get full pending shipment details including vendor and items"""
    shipment = get_pending_shipment(pending_shipment_id)
    if not shipment:
        return None
    
    items = get_pending_shipment_items(pending_shipment_id)
    shipment['items'] = items
    
    return shipment

def save_shipment_draft(
    vendor_id: int,
    items: List[Dict[str, Any]],
    file_path: Optional[str] = None,
    expected_date: Optional[str] = None,
    purchase_order_number: Optional[str] = None,
    tracking_number: Optional[str] = None,
    uploaded_by: Optional[int] = None,
    draft_id: Optional[int] = None
) -> int:
    """Save or update a shipment draft"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        conn.rollback()
        establishment_id = _get_or_create_default_establishment(conn)
        conn.rollback()
        
        if draft_id:
            # Update existing draft
            cursor.execute("""
                UPDATE pending_shipments
                SET vendor_id = %s,
                    file_path = %s,
                    expected_date = %s,
                    purchase_order_number = %s,
                    tracking_number = %s,
                    upload_timestamp = NOW()
                WHERE pending_shipment_id = %s AND status = 'draft'
            """, (vendor_id, file_path, expected_date, purchase_order_number, tracking_number, draft_id))
            
            if cursor.rowcount == 0:
                raise ValueError("Draft not found or not a draft")
            
            # Delete existing items
            cursor.execute("DELETE FROM pending_shipment_items WHERE pending_shipment_id = %s", (draft_id,))
            
            pending_shipment_id = draft_id
        else:
            # Create new draft
            # Try to insert with 'draft' status, if constraint fails, we'll handle it
            try:
                cursor.execute("""
                    INSERT INTO pending_shipments 
                    (establishment_id, vendor_id, file_path, expected_date, purchase_order_number, 
                     tracking_number, status, uploaded_by, upload_timestamp)
                    VALUES (%s, %s, %s, %s, %s, %s, 'draft', %s, NOW())
                    RETURNING pending_shipment_id
                """, (establishment_id, vendor_id, file_path, expected_date, purchase_order_number, 
                      tracking_number, uploaded_by))
                result = cursor.fetchone()
                pending_shipment_id = result['pending_shipment_id'] if isinstance(result, dict) else result[0]
            except Exception as e:
                # If constraint error, try to alter the constraint
                error_str = str(e).lower()
                if 'check constraint' in error_str or 'violates check constraint' in error_str:
                    # Try to alter the constraint to allow 'draft'
                    try:
                        conn.rollback()
                        # Drop and recreate the constraint
                        cursor.execute("""
                            ALTER TABLE pending_shipments 
                            DROP CONSTRAINT IF EXISTS pending_shipments_status_check
                        """)
                        cursor.execute("""
                            ALTER TABLE pending_shipments 
                            ADD CONSTRAINT pending_shipments_status_check 
                            CHECK (status IN ('pending_review', 'in_progress', 'approved', 'rejected', 'completed_with_issues', 'draft'))
                        """)
                        conn.commit()
                        conn.rollback()
                        
                        # Retry the insert
                        cursor.execute("""
                            INSERT INTO pending_shipments 
                            (establishment_id, vendor_id, file_path, expected_date, purchase_order_number, 
                             tracking_number, status, uploaded_by, upload_timestamp)
                            VALUES (%s, %s, %s, %s, %s, %s, 'draft', %s, NOW())
                            RETURNING pending_shipment_id
                        """, (establishment_id, vendor_id, file_path, expected_date, purchase_order_number, 
                              tracking_number, uploaded_by))
                        result = cursor.fetchone()
                        pending_shipment_id = result['pending_shipment_id'] if isinstance(result, dict) else result[0]
                    except Exception as alter_err:
                        conn.rollback()
                        raise ValueError(f"Failed to create draft: {str(alter_err)}") from alter_err
                else:
                    raise
        
        # Commit the pending_shipment first so items can reference it
        conn.commit()
        
        # Add items using the same connection
        for idx, item in enumerate(items):
            barcode = item.get('barcode')
            if not barcode or barcode.strip() == '':
                from database import generate_unique_barcode
                barcode = generate_unique_barcode(
                    pending_shipment_id=pending_shipment_id,
                    line_number=idx + 1,
                    product_sku=item.get('product_sku', '')
                )
            
            # Try to match SKU to existing product
            cursor.execute("SELECT product_id FROM inventory WHERE sku = %s", (item.get('product_sku', ''),))
            product_row = cursor.fetchone()
            if isinstance(product_row, dict):
                product_id = product_row.get('product_id')
            else:
                product_id = product_row[0] if product_row else None
            
            # Check if barcode and line_number columns exist
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'pending_shipment_items' AND table_schema = 'public'")
            column_rows = cursor.fetchall()
            if column_rows and isinstance(column_rows[0], dict):
                columns = [row.get('column_name') for row in column_rows]
            else:
                columns = [row[0] for row in column_rows]
            has_barcode = 'barcode' in columns
            has_line_number = 'line_number' in columns
            
            if has_barcode and has_line_number:
                cursor.execute("""
                    INSERT INTO pending_shipment_items 
                    (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected, 
                     unit_cost, lot_number, expiration_date, product_id, barcode, line_number)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING pending_item_id
                """, (establishment_id, pending_shipment_id, item.get('product_sku', ''), 
                      item.get('product_name'), item.get('quantity_expected', 0), 
                      float(item.get('unit_cost', 0.0)), item.get('lot_number'), 
                      item.get('expiration_date'), product_id, barcode, idx + 1))
            elif has_barcode:
                cursor.execute("""
                    INSERT INTO pending_shipment_items 
                    (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected, 
                     unit_cost, lot_number, expiration_date, product_id, barcode)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING pending_item_id
                """, (establishment_id, pending_shipment_id, item.get('product_sku', ''), 
                      item.get('product_name'), item.get('quantity_expected', 0), 
                      float(item.get('unit_cost', 0.0)), item.get('lot_number'), 
                      item.get('expiration_date'), product_id, barcode))
            else:
                cursor.execute("""
                    INSERT INTO pending_shipment_items 
                    (establishment_id, pending_shipment_id, product_sku, product_name, quantity_expected, 
                     unit_cost, lot_number, expiration_date, product_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING pending_item_id
                """, (establishment_id, pending_shipment_id, item.get('product_sku', ''), 
                      item.get('product_name'), item.get('quantity_expected', 0), 
                      float(item.get('unit_cost', 0.0)), item.get('lot_number'), 
                      item.get('expiration_date'), product_id))
        
        conn.commit()
        return pending_shipment_id
    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        raise
    finally:
        pass

def list_pending_shipments(
    status: Optional[str] = None,
    vendor_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """List pending shipments with optional filters"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT ps.*, v.vendor_name
        FROM pending_shipments ps
        JOIN vendors v ON ps.vendor_id = v.vendor_id
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND ps.status = %s"
        params.append(status)
    
    if vendor_id:
        query += " AND ps.vendor_id = %s"
        params.append(vendor_id)
    
    query += " ORDER BY ps.upload_timestamp DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def add_item_to_inventory_immediately(
    pending_item_id: int,
    employee_id: int
) -> Dict[str, Any]:
    """
    Add a pending shipment item to inventory immediately (for auto-add mode)
    Returns success status and details. Runs metadata extraction and category assignment.
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        establishment_id = _get_or_create_default_establishment(conn)
        # Get the pending item and shipment info
        cursor.execute("""
            SELECT psi.*, ps.vendor_id, ps.pending_shipment_id, v.vendor_name
            FROM pending_shipment_items psi
            JOIN pending_shipments ps ON psi.pending_shipment_id = ps.pending_shipment_id
            JOIN vendors v ON ps.vendor_id = v.vendor_id
            WHERE psi.pending_item_id = %s
        """, (pending_item_id,))
        row = cursor.fetchone()
        if not row or not cursor.description:
            conn.close()
            return {'success': False, 'message': 'Item not found'}
        item = dict(zip([c[0] for c in cursor.description], row))
        vendor_id = item['vendor_id']
        vendor_name = item['vendor_name']
        pending_shipment_id = item['pending_shipment_id']
        quantity_verified = item.get('quantity_verified', 0)
        
        print(f"DEBUG add_item_to_inventory_immediately: pending_item_id={pending_item_id}, quantity_verified={quantity_verified}, product_id={item.get('product_id')}")
        
        if quantity_verified <= 0:
            conn.close()
            print(f"DEBUG: No quantity verified for item {pending_item_id}")
            return {'success': False, 'message': 'No quantity verified'}
        
        # Get or create product
        product_id = item.get('product_id')
        created_new_product = False
        if not product_id:
            # Create product if it doesn't exist
            product_name = item['product_name'] or f"Product {item['product_sku']}"
            unit_cost = item.get('unit_cost', 0.0)
            barcode = item.get('barcode')
            sku = item['product_sku']

            if not sku or not sku.strip():
                conn.close()
                return {'success': False, 'message': 'SKU is required'}

            cursor.execute(
                "SELECT product_id FROM inventory WHERE sku = %s AND establishment_id = %s",
                (sku, establishment_id)
            )
            existing_row = cursor.fetchone()
            if existing_row and cursor.description:
                existing = dict(zip([c[0] for c in cursor.description], existing_row))
                product_id = existing['product_id']
            else:
                # Create new product (no vendor column; use vendor_id only)
                cursor.execute("""
                    INSERT INTO inventory 
                    (establishment_id, product_name, sku, barcode, product_price, product_cost, vendor_id, current_quantity, category)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 0, NULL)
                    RETURNING product_id
                """, (establishment_id, product_name, sku, barcode, unit_cost, unit_cost, vendor_id))
                product_row = cursor.fetchone()
                product_id = product_row[0] if product_row else None
                created_new_product = True

                # Update pending item with product_id
                cursor.execute("""
                    UPDATE pending_shipment_items
                    SET product_id = %s
                    WHERE pending_item_id = %s
                """, (product_id, pending_item_id))
        else:
            # Update product barcode if missing
            if item.get('barcode'):
                cursor.execute("""
                    UPDATE inventory 
                    SET barcode = %s
                    WHERE product_id = %s AND (barcode IS NULL OR barcode = '')
                """, (item['barcode'], product_id))
            
            # Check if product needs metadata extraction
            try:
                cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = %s", (product_id,))
                has_metadata = cursor.fetchone()
                if not has_metadata:
                    # Product exists but has no metadata - extract it
                    extract_metadata_for_product(product_id, auto_sync_category=True)
            except Exception as e:
                print(f"Warning: Metadata check/extraction failed for existing product {product_id}: {e}")
        
        # Ensure approved_shipment exists for this pending shipment (for auto-add mode)
        cursor.execute("""
            SELECT shipment_id FROM approved_shipments
            WHERE pending_shipment_id = %s
        """, (pending_shipment_id,))
        
        approved_row = cursor.fetchone()
        if not approved_row:
            # Create approved shipment record
            cursor.execute("""
                INSERT INTO approved_shipments
                (pending_shipment_id, vendor_id, purchase_order_number, 
                 received_date, approved_by, total_items_received, total_cost,
                 has_issues, issue_count)
                SELECT 
                    %s,
                    vendor_id,
                    purchase_order_number,
                    CURRENT_DATE, %s,
                    0,
                    0,
                    0,
                    0
                FROM pending_shipments
                WHERE pending_shipment_id = %s
                RETURNING shipment_id
            """, (pending_shipment_id, employee_id, pending_shipment_id))
            row = cursor.fetchone()
            approved_shipment_id = row[0] if row else None
        else:
            if cursor.description:
                approved = dict(zip([c[0] for c in cursor.description], approved_row))
                approved_shipment_id = approved['shipment_id']
            else:
                approved_shipment_id = approved_row[0]
        
        # Add quantity to inventory (vendor_id only; vendor column removed)
        cursor.execute("""
            UPDATE inventory
            SET current_quantity = current_quantity + %s,
                vendor_id = %s,
                last_restocked = CURRENT_TIMESTAMP
            WHERE product_id = %s
        """, (quantity_verified, vendor_id, product_id))
        
        # Check if item already in approved_shipment_items for this specific pending item
        # In auto-add mode, we track by product_id only (one record per product per shipment)
        cursor.execute("""
            SELECT approved_item_id, quantity_received FROM approved_shipment_items
            WHERE shipment_id = %s AND product_id = %s
            LIMIT 1
        """, (approved_shipment_id, product_id))
        existing_row = cursor.fetchone()
        if existing_row and cursor.description:
            existing_item = dict(zip([c[0] for c in cursor.description], existing_row))
            cursor.execute("""
                UPDATE approved_shipment_items
                SET quantity_received = quantity_received + %s,
                    received_by = %s
                WHERE approved_item_id = %s
            """, (quantity_verified, employee_id, existing_item['approved_item_id']))
        else:
            # Insert new record
            cursor.execute("""
                INSERT INTO approved_shipment_items
                (shipment_id, product_id, quantity_received, unit_cost, 
                 lot_number, expiration_date, received_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (approved_shipment_id, product_id, quantity_verified, 
                  item.get('unit_cost', 0.0), item.get('lot_number'), 
                  item.get('expiration_date'), employee_id))
        
        # Update approved_shipment totals
        cursor.execute("""
            UPDATE approved_shipments
            SET total_items_received = (
                SELECT COALESCE(SUM(quantity_received), 0) FROM approved_shipment_items
                WHERE shipment_id = %s
            ),
            total_cost = (
                SELECT COALESCE(SUM(quantity_received * unit_cost), 0) FROM approved_shipment_items
                WHERE shipment_id = %s
            )
            WHERE shipment_id = %s
        """, (approved_shipment_id, approved_shipment_id, approved_shipment_id))
        
        conn.commit()
        conn.close()

        # Run metadata extraction + category assignment after commit so get_product sees the row.
        # For new products always run; for existing we already ran in !has_metadata branch.
        if created_new_product and product_id:
            print(f"\n{'='*60}")
            print(f"Starting metadata extraction for new product {product_id}")
            print(f"{'='*60}")
            try:
                result = extract_metadata_for_product(product_id, auto_sync_category=True)
                if result:
                    print(f"✓ Successfully extracted metadata and category for new product {product_id}")
                else:
                    print(f"⚠ Metadata extraction returned False for product {product_id}")
                    # Try to get product info to debug
                    try:
                        product = get_product(product_id)
                        if product:
                            print(f"  Product exists: {product.get('product_name')} (SKU: {product.get('sku')})")
                        else:
                            print(f"  ⚠ Product {product_id} not found in database!")
                    except Exception as debug_err:
                        print(f"  ⚠ Error getting product for debug: {debug_err}")
            except Exception as e:
                print(f"⚠ ERROR: Metadata extraction exception for product {product_id}: {e}")
                import traceback
                traceback.print_exc()

        return {
            'success': True,
            'product_id': product_id,
            'quantity_added': quantity_verified
        }

    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"ERROR in add_item_to_inventory_immediately: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def update_pending_item_verification(
    pending_item_id: int,
    quantity_verified: Optional[int] = None,
    product_id: Optional[int] = None,
    discrepancy_notes: Optional[str] = None,
    employee_id: Optional[int] = None,
    verification_photo: Optional[str] = None
) -> bool:
    """Update verified quantity and product match for a pending item"""
    import time
    max_retries = 5
    retry_delay = 0.1  # Start with 100ms
    
    for attempt in range(max_retries):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            # Get current item to determine new status and check verification mode
            expected = None
            current_verified = None
            verification_mode = 'verify_whole_shipment'
            pending_shipment_id = None
            
            if quantity_verified is not None:
                cursor.execute("""
                    SELECT psi.quantity_expected, COALESCE(psi.quantity_verified, 0) as quantity_verified,
                           ps.verification_mode, ps.pending_shipment_id
                    FROM pending_shipment_items psi
                    JOIN pending_shipments ps ON psi.pending_shipment_id = ps.pending_shipment_id
                    WHERE psi.pending_item_id = %s
                """, (pending_item_id,))
                row = cursor.fetchone()
                if row and cursor.description:
                    item = dict(zip([c[0] for c in cursor.description], row))
                    expected = item['quantity_expected']
                    current_verified = item['quantity_verified']
                    verification_mode = item.get('verification_mode', 'verify_whole_shipment')
                    pending_shipment_id = item['pending_shipment_id']
            
            updates = []
            values = []
            
            if quantity_verified is not None:
                updates.append("quantity_verified = %s")
                values.append(quantity_verified)
                # Update verified_by and verified_at when quantity changes
                if employee_id is not None:
                    updates.append("verified_by = %s")
                    values.append(employee_id)
                    updates.append("verified_at = CURRENT_TIMESTAMP")
                # Update status
                if expected is not None:
                    if quantity_verified >= expected:
                        updates.append("status = 'verified'")
                    elif quantity_verified > 0:
                        updates.append("status = 'pending'")
                    else:
                        updates.append("status = 'pending'")
            
            if product_id is not None:
                updates.append("product_id = %s")
                values.append(product_id)
            
            if discrepancy_notes is not None:
                updates.append("discrepancy_notes = %s")
                values.append(discrepancy_notes)
            
            if verification_photo is not None:
                updates.append("verification_photo = %s")
                values.append(verification_photo)
            
            if not updates:
                conn.close()
                return False
            
            values.append(pending_item_id)
            query = f"UPDATE pending_shipment_items SET {', '.join(updates)} WHERE pending_item_id = %s"
            
            cursor.execute(query, values)
            conn.commit()
            success = cursor.rowcount > 0
            
            # Extract metadata if product was matched/created
            if success and product_id is not None:
                try:
                    cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = %s", (product_id,))
                    has_metadata = cursor.fetchone()
                    if not has_metadata:
                        # Extract metadata for newly matched product
                        extract_metadata_for_product(product_id, auto_sync_category=True)
                except Exception as e:
                    print(f"Warning: Metadata extraction failed for product {product_id}: {e}")
            
            # If auto-add mode and quantity was updated, add to inventory immediately
            print(f"DEBUG: verification_mode={verification_mode}, quantity_verified={quantity_verified}, employee_id={employee_id}, success={success}")
            if success and verification_mode == 'auto_add' and quantity_verified is not None and quantity_verified > 0 and employee_id:
                print(f"✓ Auto-add mode detected - adding item {pending_item_id} to inventory immediately...")
                conn.close()  # Close current connection first
                try:
                    # Add to inventory immediately
                    result = add_item_to_inventory_immediately(pending_item_id, employee_id)
                    if not result.get('success'):
                        print(f"ERROR: Failed to add item to inventory in auto-add mode: {result.get('message', 'Unknown error')}")
                        import traceback
                        traceback.print_exc()
                    else:
                        print(f"✓ SUCCESS: Added {result.get('quantity_added', 0)} units of product {result.get('product_id')} to inventory")
                except Exception as e:
                    print(f"ERROR: Exception adding item to inventory in auto-add mode: {e}")
                    import traceback
                    traceback.print_exc()
                    # Don't fail the update if auto-add fails
            else:
                if success:
                    print(f"DEBUG: Not adding to inventory - mode={verification_mode}, qty={quantity_verified}, emp={employee_id}")
                conn.close()
            
            return success
            
        except Exception as e:
            if "database is locked" in str(e).lower() and attempt < max_retries - 1:
                if conn:
                    try:
                        conn.close()
                    except:
                        pass
                # Exponential backoff with jitter
                delay = retry_delay * (2 ** attempt) + (time.time() % 0.1)
                time.sleep(delay)
                continue
            else:
                if conn:
                    try:
                        conn.close()
                    except:
                        pass
                raise
        except Exception as e:
            if conn:
                try:
                    conn.close()
                except:
                    pass
            raise
    
    return False

def approve_pending_shipment(
    pending_shipment_id: int,
    reviewed_by: str,
    notes: Optional[str] = None
) -> int:
    """
    Approve and transfer pending shipment to actual shipment.
    Returns the new shipment_id.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get pending shipment info
        cursor.execute("""
            SELECT vendor_id, expected_date, purchase_order_number, tracking_number, notes, status
            FROM pending_shipments
            WHERE pending_shipment_id = %s
        """, (pending_shipment_id,))
        pending_row = cursor.fetchone()
        
        if not pending_row:
            conn.rollback()
            conn.close()
            raise ValueError(f"Pending shipment {pending_shipment_id} not found")
        
        pending = dict(pending_row)
        
        if pending['status'] not in ('pending_review', 'in_progress'):
            conn.rollback()
            conn.close()
            raise ValueError(f"Pending shipment {pending_shipment_id} is not in a valid status for approval (current: {pending['status']})")
        
        # Create actual shipment
        received_date = datetime.now().date().isoformat()
        cursor.execute("""
            INSERT INTO shipments 
            (vendor_id, shipment_date, received_date, purchase_order_number, tracking_number, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (pending['vendor_id'], pending['expected_date'], received_date,
              pending.get('purchase_order_number'), pending.get('tracking_number'),
              notes or pending.get('notes')))
        
        shipment_id = cursor.lastrowid
        
        # Transfer items (use verified quantity if available, otherwise expected)
        cursor.execute("""
            INSERT INTO shipment_items 
            (shipment_id, product_id, quantity_received, unit_cost, lot_number, expiration_date)
            SELECT 
                %s,
                COALESCE(psi.product_id, 
                    (SELECT product_id FROM inventory WHERE sku = psi.product_sku LIMIT 1)),
                COALESCE(psi.quantity_verified, psi.quantity_expected),
                psi.unit_cost,
                psi.lot_number,
                psi.expiration_date
            FROM pending_shipment_items psi
            WHERE psi.pending_shipment_id = %s
            AND COALESCE(psi.quantity_verified, psi.quantity_expected) > 0
        """, (shipment_id, pending_shipment_id))
        
        # Update pending shipment status
        cursor.execute("""
            UPDATE pending_shipments
            SET status = 'approved',
                reviewed_by = %s,
                reviewed_date = CURRENT_TIMESTAMP,
                notes = %s
            WHERE pending_shipment_id = %s
        """, (reviewed_by, notes, pending_shipment_id))
        
        conn.commit()
        
        # Extract metadata for products in this shipment (if they don't have metadata)
        try:
            # Get unique products from this shipment
            cursor.execute("""
                SELECT DISTINCT si.product_id, i.product_name, i.barcode
                FROM shipment_items si
                JOIN inventory i ON si.product_id = i.product_id
                LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
                WHERE si.shipment_id = %s 
                AND pm.metadata_id IS NULL
            """, (shipment_id,))
            
            products_needing_metadata = cursor.fetchall()
            
            # Extract metadata for each product
            for product_row in products_needing_metadata:
                try:
                    extract_metadata_for_product(product_row['product_id'], auto_sync_category=True)
                except Exception:
                    pass  # Continue with other products if one fails
        except Exception:
            pass  # Don't fail shipment approval if metadata extraction fails
        
        # Log audit action
        try:
            log_audit_action(
                table_name='pending_shipments',
                record_id=pending_shipment_id,
                action_type='APPROVE',
                employee_id=int(reviewed_by) if reviewed_by.isdigit() else None,
                old_values={'status': pending.get('status', 'in_progress')},
                new_values={'status': 'approved'},
                notes=f'Shipment approved by {reviewed_by}'
            )
        except:
            pass  # Don't fail if audit logging fails
        
        conn.close()
        
        return shipment_id
        
    except Exception as e:
        conn.rollback()
        conn.close()
        raise ValueError(f"Error approving pending shipment: {e}") from e

def reject_pending_shipment(
    pending_shipment_id: int,
    reviewed_by: str,
    notes: Optional[str] = None
) -> bool:
    """Reject a pending shipment"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE pending_shipments
        SET status = 'rejected',
            reviewed_by = %s,
            reviewed_date = CURRENT_TIMESTAMP,
            notes = %s
        WHERE pending_shipment_id = %s
    """, (reviewed_by, notes, pending_shipment_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

def auto_match_pending_items(pending_shipment_id: int) -> Dict[str, Any]:
    """
    Automatically match pending items to products by SKU.
    Returns statistics about matches.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get all pending items
    cursor.execute("""
        SELECT pending_item_id, product_sku
        FROM pending_shipment_items
        WHERE pending_shipment_id = %s
    """, (pending_shipment_id,))
    
    items = cursor.fetchall()
    
    matched = 0
    unmatched = 0
    
    for item in items:
        # Try to find matching product
        cursor.execute("SELECT product_id FROM inventory WHERE sku = %s", (item['product_sku'],))
        product_row = cursor.fetchone()
        
        if product_row:
            cursor.execute("""
                UPDATE pending_shipment_items
                SET product_id = %s
                WHERE pending_item_id = %s
            """, (product_row['product_id'], item['pending_item_id']))
            matched += 1
        else:
            unmatched += 1
    
    conn.commit()
    conn.close()
    
    return {
        'total_items': len(items),
        'matched': matched,
        'unmatched': unmatched
    }

# ============================================================================
# EMPLOYEE MANAGEMENT FUNCTIONS
# ============================================================================

def generate_pin() -> str:
    """Generate a random 6-digit PIN"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def is_admin_user(employee_id: int, cursor) -> bool:
    """Check if employee is an admin user"""
    # Check by role_id (Admin role)
    cursor.execute("""
        SELECT r.role_name 
        FROM employees e
        LEFT JOIN roles r ON e.role_id = r.role_id
        WHERE e.employee_id = %s
    """, (employee_id,))
    role = cursor.fetchone()
    if role and role[0] and 'admin' in role[0].lower():
        return True
    
    # Check by position
    cursor.execute("SELECT position FROM employees WHERE employee_id = %s", (employee_id,))
    position = cursor.fetchone()
    if position and position[0] and 'admin' in position[0].lower():
        return True
    
    return False

def validate_admin_password(password: str) -> bool:
    """Validate that admin password contains only numbers"""
    return password.isdigit()

def add_employee(
    employee_code: Optional[str] = None,
    username: Optional[str] = None,
    first_name: str = None,
    last_name: str = None,
    position: str = None,
    date_started: str = None,
    password: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    department: Optional[str] = None,
    hourly_rate: Optional[float] = None,
    salary: Optional[float] = None,
    employment_type: str = 'part_time',
    address: Optional[str] = None,
    emergency_contact_name: Optional[str] = None,
    emergency_contact_phone: Optional[str] = None,
    notes: Optional[str] = None,
    role_id: Optional[int] = None,
    pin_code: Optional[str] = None,
    clerk_user_id: Optional[str] = None
) -> int:
    """Add a new employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Validate admin password (must be numeric only)
    if password:
        is_admin = False
        # Check if role is admin
        if role_id:
            cursor.execute("SELECT role_name FROM roles WHERE role_id = %s", (role_id,))
            role = cursor.fetchone()
            if role and role[0] and 'admin' in role[0].lower():
                is_admin = True
        # Check if position is admin
        if position and 'admin' in position.lower():
            is_admin = True
        
        if is_admin and not validate_admin_password(password):
            conn.close()
            raise ValueError("Admin passwords must contain only numbers")
    
    password_hash = hash_password(password) if password else None
    
    # Use username if provided, otherwise fall back to employee_code
    login_identifier = username if username else employee_code
    if not login_identifier:
        conn.close()
        raise ValueError("Either username or employee_code must be provided")
    
    try:
        # Get establishment_id (for multi-tenant support if needed)
        establishment_id = get_current_establishment()
        if not establishment_id:
            conn.close()
            raise ValueError("establishment_id is required. Set establishment context first.")
        
        # Check if table has username column (RBAC migration)
        # Check columns using PostgreSQL information_schema
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'employees' AND table_schema = 'public'
        """)
        columns = [row[0] for row in cursor.fetchall()]
        
        has_username = 'username' in columns
        has_role_id = 'role_id' in columns
        has_pin_code = 'pin_code' in columns
        has_clerk_user_id = 'clerk_user_id' in columns
        has_establishment_id = 'establishment_id' in columns
        
        # Add missing columns if needed (only if we're providing values for them)
        if pin_code and not has_pin_code:
            try:
                cursor.execute("ALTER TABLE employees ADD COLUMN pin_code TEXT")
                has_pin_code = True
                conn.commit()
                print("[DEBUG] Added pin_code column to employees table")
            except Exception as e:
                print(f"[DEBUG] Could not add pin_code column: {e}")
        
        if clerk_user_id and not has_clerk_user_id:
            try:
                cursor.execute("ALTER TABLE employees ADD COLUMN clerk_user_id TEXT")
                has_clerk_user_id = True
                conn.commit()
                print("[DEBUG] Added clerk_user_id column to employees table")
            except Exception as e:
                print(f"[DEBUG] Could not add clerk_user_id column: {e}")
        
        if role_id and not has_role_id:
            try:
                cursor.execute("ALTER TABLE employees ADD COLUMN role_id INTEGER")
                has_role_id = True
                conn.commit()
                print("[DEBUG] Added role_id column to employees table")
            except Exception as e:
                print(f"[DEBUG] Could not add role_id column: {e}")
        
        # Generate PIN if not provided
        if not pin_code:
            pin_code = generate_pin()
        
        # PostgreSQL uses %s placeholders
        param_placeholder = '%s'
        
        # Build base fields and values
        base_fields = ['first_name', 'last_name', 'email', 'phone', 'position', 'department',
                      'date_started', 'password_hash', 'hourly_rate', 'salary', 'employment_type', 'address',
                      'emergency_contact_name', 'emergency_contact_phone', 'notes']
        base_values = [first_name, last_name, email, phone, position, department,
                      date_started, password_hash, hourly_rate, salary, employment_type, address,
                      emergency_contact_name, emergency_contact_phone, notes]
        
        # Add establishment_id (for multi-tenant support if needed)
        if has_establishment_id and establishment_id:
            base_fields.insert(0, 'establishment_id')
            base_values.insert(0, establishment_id)
        
        if has_username:
            # Use username column
            fields = ['username'] + base_fields
            values = [login_identifier] + base_values
            # Add optional fields if columns exist AND values are provided
            if has_role_id and role_id is not None:
                fields.append('role_id')
                values.append(role_id)
            if has_pin_code and pin_code:
                fields.append('pin_code')
                values.append(pin_code)
            if has_clerk_user_id and clerk_user_id:
                fields.append('clerk_user_id')
                values.append(clerk_user_id)
        else:
            # Fall back to employee_code
            fields = ['employee_code'] + base_fields
            values = [login_identifier] + base_values
            # Add optional fields if columns exist AND values are provided
            if has_role_id and role_id is not None:
                fields.append('role_id')
                values.append(role_id)
            if has_pin_code and pin_code:
                fields.append('pin_code')
                values.append(pin_code)
            if has_clerk_user_id and clerk_user_id:
                fields.append('clerk_user_id')
                values.append(clerk_user_id)
        
        # Build and execute INSERT query
        placeholders = ', '.join([param_placeholder] * len(fields))
        fields_str = ', '.join(fields)
        
        cursor.execute(f"""
            INSERT INTO employees ({fields_str})
            VALUES ({placeholders})
            RETURNING employee_id
        """, tuple(values))
        employee_id = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        return employee_id
    except Exception as e:
        import psycopg2
        if conn and not conn.closed:
            try:
                conn.rollback()
            except:
                pass
        if conn:
            try:
                conn.close()
            except:
                pass
        if isinstance(e, psycopg2.IntegrityError):
            raise ValueError(f"Employee identifier '{login_identifier}' already exists") from e
        raise

def get_employee_by_clerk_user_id(clerk_user_id: str) -> Optional[Dict[str, Any]]:
    """Get employee by Clerk user ID"""
    conn = None
    try:
        conn = get_connection()
        if conn is None or conn.closed:
            print("Error: Invalid connection in get_employee_by_clerk_user_id")
            return None
        
        cursor = conn.cursor()
        
        # Check if column exists using PostgreSQL information_schema
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'employees' AND table_schema = 'public'
            AND column_name = 'clerk_user_id'
        """)
        has_column = cursor.fetchone() is not None
        
        if not has_column:
            return None
        
        # Use PostgreSQL placeholder
        cursor.execute("SELECT * FROM employees WHERE clerk_user_id = %s", (clerk_user_id,))
        
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # Handle both Row objects (SQLite) and tuple/dict (PostgreSQL)
        if hasattr(row, 'keys'):
            employee = dict(row)
        else:
            try:
                column_names = [desc[0] for desc in cursor.description] if cursor.description else []
                if column_names:
                    employee = dict(zip(column_names, row))
                else:
                    employee = dict(row) if isinstance(row, dict) else {}
            except Exception as e:
                print(f"Error converting row to dict: {e}")
                employee = dict(row) if isinstance(row, dict) else {}
        
        return employee
    except Exception as e:
        print(f"Error getting employee by Clerk user ID: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        if conn and not conn.closed:
            conn.close()

def link_clerk_user_to_employee(employee_id: int, clerk_user_id: str) -> bool:
    """Link a Clerk user ID to an employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = \'employees\' AND table_schema = 'public'")
        columns = [col[0] for col in cursor.fetchall()]
        
        if 'clerk_user_id' not in columns:
            # Add column if it doesn't exist
            cursor.execute("ALTER TABLE employees ADD COLUMN clerk_user_id TEXT UNIQUE")
        
        cursor.execute("UPDATE employees SET clerk_user_id = %s WHERE employee_id = %s", (clerk_user_id, employee_id))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error linking Clerk user to employee: {e}")
        return False

def verify_pin_login(clerk_user_id: str, pin_code: str) -> Optional[Dict[str, Any]]:
    """Verify PIN login for a Clerk-authenticated user"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if columns exist using PostgreSQL information_schema
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'employees' AND table_schema = 'public'
            AND column_name IN ('clerk_user_id', 'pin_code')
        """)
        columns = [row[0] for row in cursor.fetchall()]
        
        if 'clerk_user_id' not in columns or 'pin_code' not in columns:
            conn.close()
            print(f"[DEBUG] Missing columns: clerk_user_id={'clerk_user_id' in columns}, pin_code={'pin_code' in columns}")
            return None
        
        # Use PostgreSQL placeholder
        cursor.execute("""
            SELECT * FROM employees 
            WHERE clerk_user_id = %s AND pin_code = %s
        """, (clerk_user_id, pin_code))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            print(f"[DEBUG] No employee found with clerk_user_id={clerk_user_id} and provided PIN")
            return None
        
        # Handle PostgreSQL row data (RealDictCursor provides dict-like rows)
        if hasattr(row, 'keys'):
            employee = dict(row)
        else:
            try:
                column_names = [desc[0] for desc in cursor.description]
                employee = dict(zip(column_names, row))
            except:
                # Fallback
                employee = dict(row) if isinstance(row, dict) else {}
        
        print(f"[DEBUG] PIN login verified successfully for employee_id={employee.get('employee_id')}")
        return employee
    except Exception as e:
        conn.close()
        print(f"Error verifying PIN login: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_employee(employee_id: int) -> Optional[Dict[str, Any]]:
    """Get employee by ID with tip summary"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM employees WHERE employee_id = %s", (employee_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
    
    employee = dict(row)
    
    # Get tip summary if employee_tips table exists
    cursor.execute("""
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_tips'
    """)
    if cursor.fetchone():
        cursor.execute("""
            SELECT 
                COUNT(*) as total_tip_transactions,
                COALESCE(SUM(tip_amount), 0) as total_tips_all_time,
                COALESCE(SUM(CASE WHEN DATE(tip_date) = DATE('now') THEN tip_amount ELSE 0 END), 0) as tips_today,
                COALESCE(SUM(CASE WHEN DATE(tip_date) >= DATE('now', 'start of month') THEN tip_amount ELSE 0 END), 0) as tips_this_month,
                COALESCE(AVG(tip_amount), 0) as avg_tip_amount
            FROM employee_tips
            WHERE employee_id = %s
        """, (employee_id,))
        tip_summary = cursor.fetchone()
        if tip_summary:
            employee['tip_summary'] = dict(tip_summary)
        else:
            employee['tip_summary'] = {
                'total_tip_transactions': 0,
                'total_tips_all_time': 0.0,
                'tips_today': 0.0,
                'tips_this_month': 0.0,
                'avg_tip_amount': 0.0
            }
    
    conn.close()
    
    return employee

def list_employees(active_only: bool = True) -> List[Dict[str, Any]]:
    """List all employees with tip summaries"""
    from psycopg2.extras import RealDictCursor
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass
        
        # Check if employee_tips table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'employee_tips'
            )
        """)
        tips_table_result = cursor.fetchone()
        if isinstance(tips_table_result, dict):
            has_tips_table = tips_table_result.get('exists', False)
        else:
            has_tips_table = tips_table_result[0] if tips_table_result else False
        
        if active_only:
            if has_tips_table:
                cursor.execute("""
                    SELECT 
                        e.*,
                        COALESCE(SUM(et.tip_amount), 0) as total_tips_all_time,
                        COUNT(et.tip_id) as total_tip_transactions
                    FROM employees e
                    LEFT JOIN employee_tips et ON e.employee_id = et.employee_id
                    WHERE e.active = 1 
                    GROUP BY e.employee_id
                    ORDER BY e.last_name, e.first_name
                """)
            else:
                cursor.execute("""
                    SELECT * FROM employees 
                    WHERE active = 1 
                    ORDER BY last_name, first_name
                """)
        else:
            if has_tips_table:
                cursor.execute("""
                    SELECT 
                        e.*,
                        COALESCE(SUM(et.tip_amount), 0) as total_tips_all_time,
                        COUNT(et.tip_id) as total_tip_transactions
                    FROM employees e
                    LEFT JOIN employee_tips et ON e.employee_id = et.employee_id
                    GROUP BY e.employee_id
                    ORDER BY e.last_name, e.first_name
                """)
            else:
                cursor.execute("""
                    SELECT * FROM employees 
                    ORDER BY last_name, first_name
                """)
        
        rows = cursor.fetchall()
        
        if rows is None:
            return []
        
        # RealDictRow from psycopg2 is already dict-like, convert to regular dict for JSON serialization
        from datetime import date, datetime
        result = []
        for row in rows:
            if isinstance(row, dict):
                # RealDictRow is a dict subclass - convert to regular dict
                # Also convert date/datetime objects to strings for JSON serialization
                row_dict = {}
                for k, v in row.items():
                    if isinstance(v, (date, datetime)):
                        row_dict[k] = v.isoformat()
                    else:
                        row_dict[k] = v
                result.append(row_dict)
            else:
                # Fallback for other types
                row_dict = {}
                for k in (row.keys() if hasattr(row, 'keys') else range(len(row))):
                    v = row[k]
                    if isinstance(v, (date, datetime)):
                        row_dict[k] = v.isoformat()
                    else:
                        row_dict[k] = v
                result.append(row_dict)
        
        return result
    except Exception as e:
        print(f"Error in list_employees: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            try:
                conn.rollback()
            except:
                pass
        return []
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

def update_employee(employee_id: int, **kwargs) -> bool:
    """Update employee information"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if table has RBAC columns
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'employees' AND table_schema = 'public'
    """)
    columns = [row[0] for row in cursor.fetchall()]
    has_role_id = 'role_id' in columns
    has_pin_code = 'pin_code' in columns
    has_username = 'username' in columns
    
    allowed_fields = [
        'first_name', 'last_name', 'email', 'phone', 'position', 'department',
        'hourly_rate', 'salary', 'employment_type', 'address',
        'emergency_contact_name', 'emergency_contact_phone', 'notes', 'active',
        'date_terminated'
    ]
    
    # Add RBAC fields if they exist
    if has_role_id:
        allowed_fields.append('role_id')
    if has_pin_code:
        allowed_fields.append('pin_code')
    if has_username:
        allowed_fields.append('username')
    
    # Handle password update separately
    password = kwargs.pop('password', None)
    
    updates = []
    values = []
    
    for field, value in kwargs.items():
        if field in allowed_fields:
            updates.append(f"{field} = %s")
            values.append(value)
    
    # Handle password update
    if password:
        password_hash = hash_password(password)
        updates.append("password_hash = %s")
        values.append(password_hash)
    
    if not updates:
        conn.close()
        return False
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(employee_id)
    
    query = f"UPDATE employees SET {', '.join(updates)} WHERE employee_id = %s"
    
    cursor.execute(query, values)
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

def delete_employee(employee_id: int) -> bool:
    """Delete (deactivate) an employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Soft delete - set active to 0
    cursor.execute("""
        UPDATE employees
        SET active = 0,
            date_terminated = NOW(),
            updated_at = NOW()
        WHERE employee_id = %s
    """, (employee_id,))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

# ============================================================================
# CUSTOMER MANAGEMENT FUNCTIONS
# ============================================================================

def add_customer(
    customer_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None
) -> int:
    """Add a new customer"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO customers (customer_name, email, phone)
        VALUES (%s, %s, %s)
        RETURNING customer_id
    """, (customer_name, email, phone))
    
    result = cursor.fetchone()
    if isinstance(result, dict):
        customer_id = result.get('customer_id')
    else:
        customer_id = result[0] if result else None
    
    conn.commit()
    conn.close()
    
    return customer_id

def get_customer(customer_id: int) -> Optional[Dict[str, Any]]:
    """Get customer by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM customers WHERE customer_id = %s", (customer_id,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

# ============================================================================
# ORDER PROCESSING FUNCTIONS
# ============================================================================

def generate_order_number() -> str:
    """Generate a unique order number"""
    conn = get_connection()
    cursor = conn.cursor()
    
    today = datetime.now().strftime('%Y%m%d')
    cursor.execute("""
        SELECT COUNT(*) FROM orders 
        WHERE DATE(order_date) = DATE('now')
    """)
    count = cursor.fetchone()[0]
    
    order_number = f"ORD-{today}-{count + 1:04d}"
    conn.close()
    
    return order_number

def calculate_transaction_fee(payment_method: str, amount: float, fee_rates: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """
    Calculate transaction fee based on payment method
    
    Returns: dict with 'fee_rate', 'transaction_fee', 'net_amount'
    """
    if fee_rates is None:
        # Default fee rates (as decimal, e.g., 0.029 for 2.9%)
        fee_rates = {
            'credit_card': 0.029,  # 2.9% typical for credit cards
            'debit_card': 0.015,   # 1.5% typical for debit cards
            'mobile_payment': 0.026,  # 2.6% for mobile payments
            'cash': 0.0,
            'check': 0.0,
            'store_credit': 0.0
        }
    
    fee_rate = fee_rates.get(payment_method, 0.0)
    transaction_fee = amount * fee_rate
    net_amount = amount - transaction_fee
    
    return {
        'fee_rate': fee_rate,
        'transaction_fee': transaction_fee,
        'net_amount': net_amount
    }

def create_order(
    employee_id: int,
    items: List[Dict[str, Any]],
    payment_method: str,
    customer_id: Optional[int] = None,
    tax_rate: float = 0.0,
    discount: float = 0.0,
    transaction_fee_rates: Optional[Dict[str, float]] = None,
    notes: Optional[str] = None,
    tip: float = 0.0,
    order_type: Optional[str] = None,
    customer_info: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Create a new order and process payment
    
    items: List of dicts with keys: product_id, quantity, unit_price, discount (optional), tax_rate (optional)
    payment_method: 'cash', 'credit_card', 'debit_card', 'mobile_payment', 'check', 'store_credit'
    tax_rate: Tax rate as decimal (e.g., 0.08 for 8%)
    transaction_fee_rates: Optional dict to override default fee rates
    order_type: \'pickup\' or \'delivery\' (optional)
    customer_info: Dict with \'name\', \'phone\', and optionally \'address\' (for delivery)
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get establishment_id (use current establishment for the order)
        from database_postgres import get_current_establishment
        establishment_id = get_current_establishment()
        
        # If establishment_id is None, use _get_or_create_default_establishment as fallback
        if establishment_id is None:
            establishment_id = _get_or_create_default_establishment(conn)
        
        # Validate inventory availability first
        # Check products by product_id only (products may have different establishment_id)
        product_establishment_map = {}  # Track each product's establishment_id
        
        for item in items:
            product_id = item['product_id']
            quantity = int(item['quantity'])
            
            # Check if product exists (by product_id only, not filtering by establishment_id)
            cursor.execute("SELECT current_quantity, establishment_id FROM inventory WHERE product_id = %s", (product_id,))
            row = cursor.fetchone()
            
            if not row:
                conn.rollback()
                conn.close()
                return {
                    'success': False,
                    'message': f'Product ID {product_id} not found',
                    'order_id': None
                }
            
            # Handle both dict and tuple row formats
            if isinstance(row, dict):
                available_qty = row.get('current_quantity', 0)
                product_establishment_id = row.get('establishment_id')
            else:
                available_qty = row[0] if row else 0
                product_establishment_id = row[1] if len(row) > 1 else None
            
            # Store product's establishment_id for later use in order_items
            product_establishment_map[product_id] = product_establishment_id or establishment_id
                
            if available_qty < quantity:
                conn.rollback()
                conn.close()
                return {
                    'success': False,
                    'message': f'Insufficient inventory for product_id {product_id}. Available: {available_qty}, Requested: {quantity}',
                    'order_id': None
                }        # Handle customer info if provided (for pickup/delivery orders or rewards program)
        if customer_info and customer_info.get('name'):
            # Create or get customer
            customer_name = customer_info.get('name', '')
            customer_phone = customer_info.get('phone', '')
            customer_email = customer_info.get('email', '')
            customer_address = customer_info.get('address', '') if order_type == 'delivery' else None
            
            # Try to find existing customer by phone or email
            if customer_phone:
                cursor.execute("SELECT customer_id FROM customers WHERE phone = %s", (customer_phone,))
                existing_customer = cursor.fetchone()
            elif customer_email:
                cursor.execute("SELECT customer_id FROM customers WHERE email = %s", (customer_email,))
                existing_customer = cursor.fetchone()
            else:
                existing_customer = None
            
            if existing_customer:
                customer_id = existing_customer['customer_id']
                # Update customer info if provided
                update_fields = []
                update_values = []
                if customer_name:
                    update_fields.append("customer_name = %s")
                    update_values.append(customer_name)
                if customer_email:
                    update_fields.append("email = %s")
                    update_values.append(customer_email)
                if customer_phone:
                    update_fields.append("phone = %s")
                    update_values.append(customer_phone)
                if customer_address:
                    update_fields.append("address = %s")
                    update_values.append(customer_address)
                if update_fields:
                    update_values.append(customer_id)
                    cursor.execute(f"""
                        UPDATE customers 
                        SET {', '.join(update_fields)}
                        WHERE customer_id = %s
                    """, update_values)
            else:
                # Create new customer
                cursor.execute("""
                    INSERT INTO customers (customer_name, email, phone, address)
                    VALUES (%s, %s, %s, %s)
                    RETURNING customer_id
                """, (customer_name, customer_email, customer_phone, customer_address))
                result = cursor.fetchone()
                if isinstance(result, dict):
                    customer_id = result.get('customer_id')
                else:
                    customer_id = result[0] if result else None
        

        
        # Generate order number
        order_number = generate_order_number()
        
        # Calculate subtotal and tax for each item
        subtotal = 0.0
        total_tax = 0.0
        
        for item in items:
            item_qty = int(item['quantity'])
            item_price = float(item['unit_price'])  # Ensure it's a float
            item_discount = float(item.get('discount', 0.0))
            item_tax_rate = float(item.get('tax_rate', tax_rate))  # Item-specific tax rate or use order tax rate
            item_subtotal = (item_qty * item_price) - item_discount
            item_tax = item_subtotal * item_tax_rate
            
            subtotal += item_subtotal
            total_tax += item_tax
        
        # Ensure establishment_id is set (should already be set above, but double-check)
        if establishment_id is None:
            establishment_id = _get_or_create_default_establishment(conn)
        
        # Calculate transaction fee (on subtotal + tax - discount, before tip)
        pre_fee_total = subtotal + total_tax - discount
        fee_calc = calculate_transaction_fee(payment_method, pre_fee_total, transaction_fee_rates)
        transaction_fee = fee_calc['transaction_fee']
        
        # Calculate final total (including transaction fee and tip)
        total = pre_fee_total + transaction_fee + tip
        
        # Create order - check if tip and order_type columns exist
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = \'orders\' AND table_schema = 'public'")
        columns = [col[0] for col in cursor.fetchall()]
        has_tip = 'tip' in columns
        has_order_type = 'order_type' in columns
        
        # Get current datetime using local timezone (ensure accurate time)
        # datetime.now() uses system local timezone automatically
        now = datetime.now()
        current_datetime = now.strftime('%Y-%m-%d %H:%M:%S')
        
        # Debug: Verify the time being set (can be removed later)
        import time
        local_time = time.localtime()
        print(f"Order date being set: {current_datetime}")
        print(f"System local time: {local_time.tm_year}-{local_time.tm_mon:02d}-{local_time.tm_mday:02d} {local_time.tm_hour:02d}:{local_time.tm_min:02d}:{local_time.tm_sec:02d}")
        
        if has_tip and has_order_type:
            cursor.execute("""
                INSERT INTO orders (
                    establishment_id, order_number, order_date, employee_id, customer_id, subtotal, tax_rate, tax_amount, 
                    discount, transaction_fee, tip, total, payment_method, payment_status, order_status, order_type, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'completed', 'completed', %s, %s)
                RETURNING order_id
            """, (establishment_id, order_number, current_datetime, employee_id, customer_id, subtotal, tax_rate, total_tax,
                  discount, transaction_fee, tip, total, payment_method, order_type, notes))
        elif has_tip:
            cursor.execute("""
                INSERT INTO orders (
                    establishment_id, order_number, order_date, employee_id, customer_id, subtotal, tax_rate, tax_amount, 
                    discount, transaction_fee, tip, total, payment_method, payment_status, order_status, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'completed', 'completed', %s)
                RETURNING order_id
            """, (establishment_id, order_number, current_datetime, employee_id, customer_id, subtotal, tax_rate, total_tax,
                  discount, transaction_fee, tip, total, payment_method, notes))
        else:
            # Fallback for older schema (no tip or order_type)
            cursor.execute("""
                INSERT INTO orders (
                    establishment_id, order_number, order_date, employee_id, customer_id, subtotal, tax_rate, tax_amount, 
                    discount, transaction_fee, total, payment_method, payment_status, order_status, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'completed', 'completed', %s)
                RETURNING order_id
            """, (establishment_id, order_number, current_datetime, employee_id, customer_id, subtotal, tax_rate, total_tax,
                  discount, transaction_fee, total, payment_method, notes))
        
        result = cursor.fetchone()
        if isinstance(result, dict):
            order_id = result.get('order_id')
        else:
            order_id = result[0] if result else None
        
        # Add order items (triggers will update inventory)
        print(f"Creating order_items for order_id {order_id}, {len(items)} items")
        for idx, item in enumerate(items):
            print(f"Processing item {idx + 1}/{len(items)}: {item}")
            product_id = item['product_id']
            quantity = int(item['quantity'])
            unit_price = float(item['unit_price'])  # Ensure it's a float
            item_discount = float(item.get('discount', 0.0))
            item_tax_rate = float(item.get('tax_rate', tax_rate))
            item_subtotal = (quantity * unit_price) - item_discount
            item_tax = item_subtotal * item_tax_rate
            
            # Use the product's establishment_id for the order_item
            item_establishment_id = product_establishment_map.get(product_id, establishment_id)
            
            # Verify product exists before inserting
            cursor.execute("SELECT product_id FROM inventory WHERE product_id = %s", (product_id,))
            product_check = cursor.fetchone()
            if not product_check:
                conn.rollback()
                conn.close()
                return {
                    'success': False,
                    'message': f'Product ID {product_id} does not exist in inventory',
                    'order_id': None
                }
            
            try:
                # Insert order item with all fields
                cursor.execute("""
                    INSERT INTO order_items (
                        establishment_id, order_id, product_id, quantity, unit_price, discount, subtotal,
                        tax_rate, tax_amount
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (item_establishment_id, order_id, product_id, quantity, unit_price, item_discount, item_subtotal,
                      item_tax_rate, item_tax))
                
                # Verify the insert succeeded
                if cursor.rowcount == 0:
                    raise Exception(f"Failed to insert order_item for product_id {product_id}")
                
                print(f"Successfully inserted order_item: order_id={order_id}, product_id={product_id}, quantity={quantity}")
                
                # Update inventory quantity (decrease by quantity sold)
                # Use the product's establishment_id for the update
                cursor.execute("""
                    UPDATE inventory
                    SET current_quantity = current_quantity - %s,
                        updated_at = NOW()
                    WHERE product_id = %s AND establishment_id = %s
                """, (quantity, product_id, item_establishment_id))
                
                if cursor.rowcount == 0:
                    print(f"Warning: Inventory update affected 0 rows for product_id {product_id}, establishment_id {item_establishment_id}")
                    
            except Exception as item_error:
                # If order_item insertion fails, rollback the entire transaction
                import traceback
                print(f"Error inserting order_item for product_id {product_id}: {str(item_error)}")
                traceback.print_exc()
                conn.rollback()
                conn.close()
                return {
                    'success': False,
                    'message': f'Error inserting order item for product_id {product_id}: {str(item_error)}',
                    'order_id': None
                }
        
        # Record payment transaction with fee details and tip
        # Check if tip and employee_id columns exist
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = \'payment_transactions\' AND table_schema = 'public'")
        columns = [col[0] for col in cursor.fetchall()]
        has_tip = 'tip' in columns
        has_employee_id = 'employee_id' in columns
        
        if has_tip and has_employee_id:
            cursor.execute("""
                INSERT INTO payment_transactions (
                    establishment_id, order_id, payment_method, amount, transaction_fee, transaction_fee_rate,
                    net_amount, status, tip, employee_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'approved', %s, %s)
                RETURNING transaction_id
            """, (establishment_id, order_id, payment_method, pre_fee_total, transaction_fee, 
                  fee_calc['fee_rate'], fee_calc['net_amount'], tip, employee_id))
        else:
            # Fallback for older schema
            cursor.execute("""
                INSERT INTO payment_transactions (
                    establishment_id, order_id, payment_method, amount, transaction_fee, transaction_fee_rate,
                    net_amount, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'approved')
                RETURNING transaction_id
            """, (establishment_id, order_id, payment_method, pre_fee_total, transaction_fee, 
                  fee_calc['fee_rate'], fee_calc['net_amount']))
        
        result = cursor.fetchone()
        if isinstance(result, dict):
            transaction_id = result.get('transaction_id')
        else:
            transaction_id = result[0] if result else None
        
        # Record tip in employee_tips table if tip exists
        if tip > 0:
            cursor.execute("""
                SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_tips'
            """)
            if cursor.fetchone():
                cursor.execute("""
                    INSERT INTO employee_tips (
                        employee_id, order_id, transaction_id, tip_amount, payment_method
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (employee_id, order_id, transaction_id, tip, payment_method))
        
        # Track customer spending and award rewards if customer_id exists
        rewards_info = {'points_earned': 0, 'discount_amount': 0.0, 'reward_type': 'points'}
        if customer_id:
            try:
                # Get rewards settings
                rewards_settings = get_customer_rewards_settings()
                
                if rewards_settings.get('enabled'):
                    # Calculate rewards based on total (subtotal + tax, before discount and fees)
                    amount_for_rewards = subtotal + total_tax
                    rewards_info = calculate_rewards(amount_for_rewards, rewards_settings)
                    
                    # Update customer total_spent
                    cursor.execute("""
                        UPDATE customers 
                        SET total_spent = COALESCE(total_spent, 0) + %s
                        WHERE customer_id = %s
                    """, (amount_for_rewards, customer_id))
                    
                    # Award rewards based on type
                    if rewards_info['reward_type'] == 'points' and rewards_info['points_earned'] > 0:
                        # Add points to customer
                        cursor.execute("""
                            UPDATE customers 
                            SET loyalty_points = COALESCE(loyalty_points, 0) + %s
                            WHERE customer_id = %s
                        """, (rewards_info['points_earned'], customer_id))
                    elif rewards_info['discount_amount'] > 0:
                        # Apply discount to order if reward type is percentage or fixed
                        # Note: This is for future use - currently discount is handled separately
                        pass
            except Exception as e:
                # Don't fail the order if rewards calculation fails
                print(f"Error calculating rewards: {e}")
                import traceback
                traceback.print_exc()
        
        # Verify order_items were inserted before committing
        cursor.execute("SELECT COUNT(*) FROM order_items WHERE order_id = %s", (order_id,))
        items_count_result = cursor.fetchone()
        items_count = items_count_result[0] if items_count_result else 0
        
        if items_count != len(items):
            conn.rollback()
            conn.close()
            return {
                'success': False,
                'message': f'Order created but only {items_count} of {len(items)} items were saved. Transaction rolled back.',
                'order_id': None
            }
        
        print(f"Order {order_number} (ID: {order_id}) created successfully with {items_count} items")
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'order_id': order_id,
            'order_number': order_number,
            'subtotal': subtotal,
            'tax_amount': total_tax,
            'transaction_fee': transaction_fee,
            'total': total,
            'rewards': rewards_info,
            'items_count': items_count,
            'message': f'Order {order_number} processed successfully'
        }
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return {
            'success': False,
            'message': f'Error processing order: {str(e)}',
            'order_id': None
        }

def get_order_details(order_id: int) -> Optional[Dict[str, Any]]:
    """Get complete order information"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get order header
    cursor.execute("""
        SELECT 
            o.*,
            e.first_name || ' ' || e.last_name as employee_name,
            c.customer_name
        FROM orders o
        LEFT JOIN employees e ON o.employee_id = e.employee_id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.order_id = %s
    """, (order_id,))
    
    # Note: The query will automatically include new fields: tax_rate, tax_amount, transaction_fee
    
    order_row = cursor.fetchone()
    if not order_row:
        conn.close()
        return None
    
    order = dict(order_row)
    
    # Get order items
    cursor.execute("""
        SELECT 
            oi.*,
            i.product_name,
            i.sku
        FROM order_items oi
        JOIN inventory i ON oi.product_id = i.product_id
        WHERE oi.order_id = %s
    """, (order_id,))
    
    items = [dict(row) for row in cursor.fetchall()]
    
    # Get payment transactions
    cursor.execute("""
        SELECT * FROM payment_transactions
        WHERE order_id = %s
    """, (order_id,))
    
    payments = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        'order': order,
        'items': items,
        'payments': payments
    }

def void_order(order_id: int, employee_id: int, reason: Optional[str] = None) -> Dict[str, Any]:
    """Void an order and return items to inventory"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get order items to return to inventory
        cursor.execute("""
            SELECT product_id, quantity
            FROM order_items
            WHERE order_id = %s
        """, (order_id,))
        
        items = cursor.fetchall()
        
        if not items:
            conn.close()
            return {'success': False, 'message': 'Order not found or has no items'}
        
        # Check if order is already voided
        cursor.execute("SELECT order_status FROM orders WHERE order_id = %s", (order_id,))
        status_row = cursor.fetchone()
        if not status_row:
            conn.close()
            return {'success': False, 'message': 'Order not found'}
        
        if status_row['order_status'] == 'voided':
            conn.close()
            return {'success': False, 'message': 'Order is already voided'}
        
        # Return items to inventory
        for item in items:
            cursor.execute("""
                UPDATE inventory
                SET current_quantity = current_quantity + %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = %s
            """, (item['quantity'], item['product_id']))
        
        # Update order status
        notes_text = f"\nVoided by employee_id {employee_id} on {datetime.now().isoformat()}"
        if reason:
            notes_text += f". Reason: {reason}"
        
        cursor.execute("""
            UPDATE orders
            SET order_status = 'voided',
                notes = COALESCE(notes, '') || %s
            WHERE order_id = %s
        """, (notes_text, order_id))
        
        # Update payment status
        cursor.execute("""
            UPDATE payment_transactions
            SET status = 'refunded'
            WHERE order_id = %s
        """, (order_id,))
        
        conn.commit()
        conn.close()
        
        return {'success': True, 'message': 'Order voided successfully'}
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return {'success': False, 'message': str(e)}

def process_return(
    order_id: int,
    items_to_return: List[Dict[str, Any]],
    employee_id: int,
    reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process a partial or full return
    items_to_return: List of dicts with keys: order_item_id, quantity
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        total_refund = 0.0
        
        for item in items_to_return:
            order_item_id = item['order_item_id']
            return_qty = item['quantity']
            
            # Get original item details
            cursor.execute("""
                SELECT product_id, quantity, unit_price, discount
                FROM order_items
                WHERE order_item_id = %s
            """, (order_item_id,))
            
            original = cursor.fetchone()
            if not original:
                raise ValueError(f"Order item {order_item_id} not found")
            
            original = dict(original)
            
            if return_qty > original['quantity']:
                raise ValueError(f"Return quantity ({return_qty}) exceeds original quantity ({original['quantity']})")
            
            # Calculate refund amount
            item_refund = (original['unit_price'] * return_qty) - \
                         (original['discount'] * return_qty / original['quantity'])
            total_refund += item_refund
            
            # Return items to inventory
            cursor.execute("""
                UPDATE inventory
                SET current_quantity = current_quantity + %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = %s
            """, (return_qty, original['product_id']))
            
            # Update order item quantity if partial return
            if return_qty < original['quantity']:
                new_qty = original['quantity'] - return_qty
                new_subtotal = (original['unit_price'] * new_qty) - original['discount']
                
                cursor.execute("""
                    UPDATE order_items
                    SET quantity = %s,
                        subtotal = %s
                    WHERE order_item_id = %s
                """, (new_qty, new_subtotal, order_item_id))
            else:
                # Full return - delete item
                cursor.execute("""
                    DELETE FROM order_items
                    WHERE order_item_id = %s
                """, (order_item_id,))
        
        # Update order total
        notes_text = f"\nReturn processed by employee_id {employee_id} on {datetime.now().isoformat()}"
        if reason:
            notes_text += f". Reason: {reason}"
        notes_text += f". Refund: ${total_refund:.2f}"
        
        cursor.execute("""
            UPDATE orders
            SET total = total - %s,
                subtotal = subtotal - %s,
                order_status = 'returned',
                notes = COALESCE(notes, '') || %s
            WHERE order_id = %s
        """, (total_refund, total_refund, notes_text, order_id))
        
        # Record refund transaction
        cursor.execute("""
            INSERT INTO payment_transactions (
                order_id, payment_method, amount, status
            ) VALUES (%s, 'refund', %s, 'refunded')
        """, (order_id, -total_refund))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'message': 'Return processed successfully',
            'refund_amount': total_refund
        }
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return {'success': False, 'message': str(e)}

# ============================================================================
# PENDING RETURNS FUNCTIONS
# ============================================================================

def create_pending_return(
    order_id: int,
    items_to_return: List[Dict[str, Any]],
    employee_id: int,
    customer_id: Optional[int] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a pending return (items not yet returned to inventory)
    items_to_return: List of dicts with keys: order_item_id, quantity, condition, notes
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Verify order exists
        cursor.execute("SELECT order_id, order_number FROM orders WHERE order_id = %s", (order_id,))
        order = cursor.fetchone()
        if not order:
            conn.close()
            return {'success': False, 'message': 'Order not found'}
        
        order = dict(order)
        
        # Generate unique return number
        # Check how many returns already exist for this order on this date
        date_str = datetime.now().strftime('%Y%m%d')
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM pending_returns
            WHERE order_id = %s AND return_number LIKE %s
        """, (order_id, f"RET-{date_str}-{order_id}%"))
        
        existing_count = cursor.fetchone()['count']
        
        # Add sequence number if there are existing returns
        if existing_count > 0:
            return_number = f"RET-{date_str}-{order_id}-{existing_count + 1}"
        else:
            return_number = f"RET-{date_str}-{order_id}"
        
        total_refund = 0.0
        return_items = []
        
        for item in items_to_return:
            order_item_id = item['order_item_id']
            return_qty = item['quantity']
            condition = item.get('condition', 'new')
            item_notes = item.get('notes', '')
            
            # Get original item details
            cursor.execute("""
                SELECT oi.product_id, oi.quantity, oi.unit_price, oi.discount, oi.subtotal,
                       i.product_name, i.sku
                FROM order_items oi
                JOIN inventory i ON oi.product_id = i.product_id
                WHERE oi.order_item_id = %s
            """, (order_item_id,))
            
            original = cursor.fetchone()
            if not original:
                raise ValueError(f"Order item {order_item_id} not found")
            
            original = dict(original)
            
            if return_qty > original['quantity']:
                raise ValueError(f"Return quantity ({return_qty}) exceeds original quantity ({original['quantity']})")
            
            # Calculate refund amount
            item_refund = (original['unit_price'] * return_qty) - \
                         (original['discount'] * return_qty / original['quantity'])
            total_refund += item_refund
            
            return_items.append({
                'order_item_id': order_item_id,
                'product_id': original['product_id'],
                'quantity': return_qty,
                'unit_price': original['unit_price'],
                'discount': original['discount'] * return_qty / original['quantity'],
                'refund_amount': item_refund,
                'condition': condition,
                'notes': item_notes
            })
        
        # Create pending return
        cursor.execute("""
            INSERT INTO pending_returns (
                return_number, order_id, employee_id, customer_id,
                total_refund_amount, reason, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (return_number, order_id, employee_id, customer_id, total_refund, reason, notes))
        
        return_id = cursor.lastrowid
        
        # Create return items
        for item in return_items:
            cursor.execute("""
                INSERT INTO pending_return_items (
                    return_id, order_item_id, product_id, quantity,
                    unit_price, discount, refund_amount, condition, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                return_id, item['order_item_id'], item['product_id'],
                item['quantity'], item['unit_price'], item['discount'],
                item['refund_amount'], item['condition'], item['notes']
            ))
        
        conn.commit()
        conn.close()
        
        # Log audit after committing the main transaction
        try:
            log_audit_action(
                table_name='pending_returns',
                record_id=return_id,
                action_type='INSERT',
                employee_id=employee_id,
                new_values={'return_number': return_number, 'order_id': order_id, 'status': 'pending'}
            )
        except Exception as audit_error:
            # Don't fail the return if audit logging fails
            print(f"Warning: Audit logging failed: {audit_error}")
        
        return {
            'success': True,
            'return_id': return_id,
            'return_number': return_number,
            'total_refund_amount': total_refund,
            'message': 'Pending return created successfully'
        }
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return {'success': False, 'message': str(e)}

def approve_pending_return(return_id: int, approved_by: int, notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Approve a pending return - returns items to inventory and creates accounting entries
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get return details
        cursor.execute("""
            SELECT pr.*, o.order_number
            FROM pending_returns pr
            JOIN orders o ON pr.order_id = o.order_id
            WHERE pr.return_id = %s
        """, (return_id,))
        
        return_record = cursor.fetchone()
        if not return_record:
            conn.close()
            return {'success': False, 'message': 'Return not found'}
        
        return_record = dict(return_record)
        
        if return_record['status'] != 'pending':
            conn.close()
            return {'success': False, 'message': f"Return is already {return_record['status']}"}
        
        # Get return items
        cursor.execute("""
            SELECT pri.*, i.product_name, i.sku
            FROM pending_return_items pri
            JOIN inventory i ON pri.product_id = i.product_id
            WHERE pri.return_id = %s
        """, (return_id,))
        
        return_items = [dict(row) for row in cursor.fetchall()]
        
        if not return_items:
            conn.close()
            return {'success': False, 'message': 'No items found for return'}
        
        # Return items to inventory
        for item in return_items:
            cursor.execute("""
                UPDATE inventory
                SET current_quantity = current_quantity + %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = %s
            """, (item['quantity'], item['product_id']))
        
        # Update order items (reduce quantities or delete)
        order_id = return_record['order_id']
        for item in return_items:
            # Get current order item quantity
            cursor.execute("""
                SELECT quantity FROM order_items WHERE order_item_id = %s
            """, (item['order_item_id'],))
            
            current = cursor.fetchone()
            if current:
                current_qty = current['quantity']
                new_qty = current_qty - item['quantity']
                
                if new_qty <= 0:
                    # Delete item if fully returned
                    cursor.execute("DELETE FROM order_items WHERE order_item_id = %s", (item['order_item_id'],))
                else:
                    # Update quantity
                    cursor.execute("""
                        UPDATE order_items
                        SET quantity = %s,
                            subtotal = (unit_price * %s) - discount
                        WHERE order_item_id = %s
                    """, (new_qty, new_qty, item['order_item_id']))
        
        # Update order totals
        total_refund = return_record['total_refund_amount']
        notes_text = f"\nReturn approved by employee_id {approved_by} on {datetime.now().isoformat()}"
        if notes:
            notes_text += f". Notes: {notes}"
        notes_text += f". Refund: ${total_refund:.2f}"
        
        cursor.execute("""
            UPDATE orders
            SET total = total - %s,
                subtotal = subtotal - %s,
                order_status = CASE 
                    WHEN (SELECT COUNT(*) FROM order_items WHERE order_id = %s) = 0 
                    THEN 'returned' 
                    ELSE order_status 
                END,
                notes = COALESCE(notes, '') || %s
            WHERE order_id = %s
        """, (total_refund, total_refund, order_id, notes_text, order_id))
        
        # Record refund transaction
        cursor.execute("""
            INSERT INTO payment_transactions (
                order_id, payment_method, amount, status
            ) VALUES (%s, 'refund', %s, 'refunded')
        """, (order_id, -total_refund))
        
        # Update return status
        cursor.execute("""
            UPDATE pending_returns
            SET status = 'approved',
                approved_by = %s,
                approved_date = CURRENT_TIMESTAMP,
                notes = COALESCE(notes, '') || %s
            WHERE return_id = %s
        """, (approved_by, notes, return_id))
        
        conn.commit()
        conn.close()
        
        # Create journal entry for return (after committing main transaction)
        try:
            journalize_return(order_id, total_refund, approved_by)
        except Exception as journal_error:
            print(f"Warning: Journal entry creation failed: {journal_error}")
        
        # Log audit after committing the main transaction
        try:
            log_audit_action(
                table_name='pending_returns',
                record_id=return_id,
                action_type='APPROVE',
                employee_id=approved_by,
                notes=f'Return approved. Refund: ${total_refund:.2f}'
            )
        except Exception as audit_error:
            print(f"Warning: Audit logging failed: {audit_error}")
        
        return {
            'success': True,
            'message': 'Return approved and processed successfully',
            'refund_amount': total_refund
        }
        
    except Exception as e:
        conn.rollback()
        conn.close()
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def reject_pending_return(return_id: int, rejected_by: int, reason: Optional[str] = None) -> Dict[str, Any]:
    """Reject a pending return"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE pending_returns
            SET status = 'rejected',
                approved_by = %s,
                approved_date = CURRENT_TIMESTAMP,
                notes = COALESCE(notes, '') || %s
            WHERE return_id = %s AND status = 'pending'
        """, (rejected_by, f"\nRejected: {reason or 'No reason provided'}", return_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return {'success': False, 'message': 'Return not found or not in pending status'}
        
        conn.commit()
        conn.close()
        
        # Log audit after committing the main transaction
        try:
            log_audit_action(
                table_name='pending_returns',
                record_id=return_id,
                action_type='RETURN',
                employee_id=rejected_by,
                notes=f'Return rejected. Reason: {reason}'
            )
        except Exception as audit_error:
            print(f"Warning: Audit logging failed: {audit_error}")
        
        return {'success': True, 'message': 'Return rejected successfully'}
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return {'success': False, 'message': str(e)}

def process_return_immediate(
    order_id: int,
    items_to_return: List[Dict[str, Any]],
    employee_id: int,
    customer_id: Optional[int] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    return_type: str = 'refund',  # 'exchange' or 'refund'
    exchange_timing: Optional[str] = None,  # 'now' or 'later' (only for exchange)
    return_subtotal: float = 0,
    return_tax: float = 0,
    return_processing_fee: float = 0,
    return_total: float = 0,
    payment_method: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process a return immediately (no pending state)
    Returns items to inventory, processes refund or creates exchange credit
    """
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Verify order exists
        cursor.execute("SELECT order_id, order_number, establishment_id FROM orders WHERE order_id = %s", (order_id,))
        order = cursor.fetchone()
        if not order:
            conn.close()
            return {'success': False, 'message': 'Order not found'}
        
        order = dict(order)
        establishment_id = order['establishment_id']
        
        # Generate unique return number
        date_str = datetime.now().strftime('%Y%m%d')
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM pending_returns
            WHERE order_id = %s AND return_number LIKE %s
        """, (order_id, f"RET-{date_str}-{order_id}%"))
        
        existing_count = cursor.fetchone()['count']
        if existing_count > 0:
            return_number = f"RET-{date_str}-{order_id}-{existing_count + 1}"
        else:
            return_number = f"RET-{date_str}-{order_id}"
        
        # Calculate return amounts from items
        calculated_subtotal = 0
        calculated_tax = 0
        
        # Process return items and calculate amounts
        for item in items_to_return:
            order_item_id = item['order_item_id']
            return_qty = item['quantity']
            condition = item.get('condition', 'new')
            item_notes = item.get('notes', '')
            
            # Get original item details
            cursor.execute("""
                SELECT oi.product_id, oi.quantity, oi.unit_price, oi.discount, oi.subtotal,
                       oi.tax_rate, oi.tax_amount, i.product_name, i.sku
                FROM order_items oi
                JOIN inventory i ON oi.product_id = i.product_id
                WHERE oi.order_item_id = %s
            """, (order_item_id,))
            
            original = cursor.fetchone()
            if not original:
                raise ValueError(f"Order item {order_item_id} not found")
            
            original = dict(original)
            
            if return_qty > original['quantity']:
                raise ValueError(f"Return quantity ({return_qty}) exceeds original quantity ({original['quantity']})")
            
            # Calculate refund amounts for this item
            item_unit_price = float(original['unit_price'])
            item_discount = float(original.get('discount', 0))
            item_subtotal = (item_unit_price * return_qty) - (item_discount * return_qty / original['quantity'])
            item_tax_rate = float(original.get('tax_rate', 0.08))
            item_tax = item_subtotal * item_tax_rate
            
            calculated_subtotal += item_subtotal
            calculated_tax += item_tax
            
            return_items_data.append({
                'order_item_id': order_item_id,
                'product_id': original['product_id'],
                'quantity': return_qty,
                'original_quantity': original['quantity'],
                'unit_price': item_unit_price,
                'discount': item_discount * return_qty / original['quantity'],
                'refund_amount': item_subtotal,
                'tax': item_tax,
                'condition': condition,
                'notes': item_notes
            })
        
        # Use calculated values if provided values are 0 or use provided values
        final_subtotal = return_subtotal if return_subtotal > 0 else calculated_subtotal
        final_tax = return_tax if return_tax > 0 else calculated_tax
        
        # Calculate processing fee (proportional to original order)
        final_processing_fee = return_processing_fee
        if final_processing_fee == 0:
            cursor.execute("SELECT transaction_fee, subtotal FROM orders WHERE order_id = %s", (order_id,))
            order_fees = cursor.fetchone()
            if order_fees and order_fees.get('transaction_fee') and order_fees.get('subtotal'):
                fee_rate = float(order_fees['transaction_fee']) / float(order_fees['subtotal'])
                final_processing_fee = final_subtotal * fee_rate
        
        # Final return total
        final_return_total = return_total if return_total > 0 else (final_subtotal + final_tax - final_processing_fee)
        
        # Create return record (using pending_returns table but immediately approved)
        cursor.execute("""
            INSERT INTO pending_returns (
                return_number, order_id, employee_id, customer_id,
                total_refund_amount, reason, notes, status, approved_by, approved_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'approved', %s, CURRENT_TIMESTAMP)
            RETURNING return_id
        """, (return_number, order_id, employee_id, customer_id, final_return_total, reason, notes, employee_id))
        
        return_result = cursor.fetchone()
        return_id = return_result['return_id'] if isinstance(return_result, dict) else return_result[0]
        
        # Create return item records and process inventory
        for item_data in return_items_data:
            cursor.execute("""
                INSERT INTO pending_return_items (
                    return_id, order_item_id, product_id, quantity,
                    unit_price, discount, refund_amount, condition, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                return_id, item_data['order_item_id'], item_data['product_id'],
                item_data['quantity'], item_data['unit_price'], 
                item_data['discount'],
                item_data['refund_amount'], item_data['condition'], item_data['notes']
            ))
            
            # Return items to inventory
            cursor.execute("""
                UPDATE inventory
                SET current_quantity = current_quantity + %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = %s
            """, (item_data['quantity'], item_data['product_id']))
            
            # Update order item quantity if partial return
            original_qty = item_data['original_quantity']
            return_qty = item_data['quantity']
            
            if return_qty < original_qty:
                new_qty = original_qty - return_qty
                new_subtotal = (item_data['unit_price'] * new_qty) - (item_data['discount'] * new_qty / original_qty)
                
                cursor.execute("""
                    UPDATE order_items
                    SET quantity = %s,
                        subtotal = %s
                    WHERE order_item_id = %s
                """, (new_qty, new_subtotal, item_data['order_item_id']))
            else:
                # Full return - delete item
                cursor.execute("DELETE FROM order_items WHERE order_item_id = %s", (item_data['order_item_id'],))
        
        # Create exchange credit if exchange type
        exchange_credit_id = None
        exchange_credit_number = None
        if return_type == 'exchange':
            # Generate exchange credit number
            exchange_credit_number = f"EXC-{date_str}-{return_id}"
            
            # Create exchange credit record (we'll use a simple table or store in a JSON field)
            # For now, we'll store it in a way that can be scanned at checkout
            # This could be a new table: exchange_credits
            # For simplicity, we'll create a record that can be looked up by the credit number
            cursor.execute("""
                INSERT INTO payment_transactions (
                    establishment_id, order_id, payment_method, amount, 
                    net_amount, status, transaction_date, notes
                ) VALUES (%s, %s, 'store_credit', %s, %s, 'approved', CURRENT_TIMESTAMP, %s)
                RETURNING transaction_id
            """, (
                establishment_id, order_id, final_return_total, final_return_total,
                f'Exchange credit for return {return_number}. Credit: {exchange_credit_number}'
            ))
            
            exchange_result = cursor.fetchone()
            exchange_credit_id = exchange_result['transaction_id'] if isinstance(exchange_result, dict) else exchange_result[0]
        
        # Process refund if refund type
        if return_type == 'refund':
            # Record refund transaction
            cursor.execute("""
                INSERT INTO payment_transactions (
                    establishment_id, order_id, payment_method, amount, 
                    net_amount, status, transaction_date
                ) VALUES (%s, %s, 'refund', %s, %s, 'refunded', CURRENT_TIMESTAMP)
            """, (establishment_id, order_id, -final_return_total, -final_return_total))
        
        # Update order notes
        notes_text = f"\nReturn processed by employee_id {employee_id} on {datetime.now().isoformat()}"
        if reason:
            notes_text += f". Reason: {reason}"
        notes_text += f". Refund: ${final_return_total:.2f}. Type: {return_type}"
        if return_type == 'exchange':
            notes_text += f". Exchange credit: {exchange_credit_number}"
        
        cursor.execute("""
            UPDATE orders
            SET notes = COALESCE(notes, '') || %s
            WHERE order_id = %s
        """, (notes_text, order_id))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'return_id': return_id,
            'return_number': return_number,
            'return_total': final_return_total,
            'return_subtotal': final_subtotal,
            'return_tax': final_tax,
            'return_processing_fee': final_processing_fee,
            'return_type': return_type,
            'exchange_credit_id': exchange_credit_id,
            'exchange_credit_number': exchange_credit_number,
            'message': 'Return processed successfully'
        }
        
    except Exception as e:
        conn.rollback()
        conn.close()
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def get_pending_return(return_id: int) -> Optional[Dict[str, Any]]:
    """Get a pending return with items"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT pr.*, 
               o.order_number,
               e.first_name || ' ' || e.last_name as employee_name,
               c.customer_name
        FROM pending_returns pr
        JOIN orders o ON pr.order_id = o.order_id
        JOIN employees e ON pr.employee_id = e.employee_id
        LEFT JOIN customers c ON pr.customer_id = c.customer_id
        WHERE pr.return_id = %s
    """, (return_id,))
    
    return_record = cursor.fetchone()
    if not return_record:
        conn.close()
        return None
    
    return_record = dict(return_record)
    
    # Get items
    cursor.execute("""
        SELECT pri.*, i.product_name, i.sku
        FROM pending_return_items pri
        JOIN inventory i ON pri.product_id = i.product_id
        WHERE pri.return_id = %s
    """, (return_id,))
    
    return_record['items'] = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return return_record

def list_pending_returns(
    status: Optional[str] = None,
    order_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """List pending returns"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT pr.*,
               o.order_number,
               e.first_name || ' ' || e.last_name as employee_name,
               c.customer_name
        FROM pending_returns pr
        JOIN orders o ON pr.order_id = o.order_id
        JOIN employees e ON pr.employee_id = e.employee_id
        LEFT JOIN customers c ON pr.customer_id = c.customer_id
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND pr.status = %s"
        params.append(status)
    
    if order_id:
        query += " AND pr.order_id = %s"
        params.append(order_id)
    
    query += " ORDER BY pr.return_date DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

# ============================================================================
# SALES REPORTING FUNCTIONS
# ============================================================================

def get_daily_sales_by_employee(start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get daily sales by employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            DATE(o.order_date) as sale_date,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_id,
            COUNT(o.order_id) as num_orders,
            SUM(o.total) as total_sales,
            AVG(o.total) as avg_order_value
        FROM orders o
        JOIN employees e ON o.employee_id = e.employee_id
        WHERE o.order_status = 'completed'
    """
    params = []
    
    if start_date:
        query += " AND DATE(o.order_date) >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(o.order_date) <= ?"
        params.append(end_date)
    
    query += " GROUP BY DATE(o.order_date), e.employee_id ORDER BY sale_date DESC, total_sales DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_top_selling_products(limit: int = 10, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get top selling products"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            i.product_name,
            i.sku,
            i.product_id,
            SUM(oi.quantity) as total_sold,
            SUM(oi.subtotal) as total_revenue
        FROM order_items oi
        JOIN inventory i ON oi.product_id = i.product_id
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.order_status = 'completed'
    """
    params = []
    
    if start_date:
        query += " AND DATE(o.order_date) >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(o.order_date) <= ?"
        params.append(end_date)
    
    query += " GROUP BY oi.product_id ORDER BY total_sold DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_payment_method_breakdown(start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get payment method breakdown"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            payment_method,
            COUNT(*) as transaction_count,
            SUM(total) as total_amount
        FROM orders
        WHERE order_status = 'completed'
    """
    params = []
    
    if start_date:
        query += " AND DATE(order_date) >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(order_date) <= ?"
        params.append(end_date)
    
    query += " GROUP BY payment_method ORDER BY total_amount DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def list_orders(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    employee_id: Optional[int] = None,
    order_status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List orders with optional filters, including receipt preferences"""
    from psycopg2.extras import RealDictCursor
    
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Check if receipt_preferences table exists
        check_cursor = conn.cursor()
        check_cursor.execute("""
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipt_preferences'
        """)
        has_receipt_prefs = check_cursor.fetchone() is not None
        check_cursor.close()
        
        if has_receipt_prefs:
            # Join with receipt preferences through payment_transactions
            # Note: If multiple transactions exist, this will get the first matching receipt preference
            query = """
                SELECT DISTINCT
                    o.*,
                    e.first_name || ' ' || e.last_name as employee_name,
                    c.customer_name,
                    rp.receipt_type,
                    rp.email_address as receipt_email,
                    rp.phone_number as receipt_phone
                FROM orders o
                LEFT JOIN employees e ON o.employee_id = e.employee_id
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                LEFT JOIN payment_transactions pt ON o.order_id = pt.order_id
                LEFT JOIN receipt_preferences rp ON pt.transaction_id = rp.transaction_id
                WHERE 1=1
            """
        else:
            query = """
                SELECT 
                    o.*,
                    e.first_name || ' ' || e.last_name as employee_name,
                    c.customer_name
                FROM orders o
                LEFT JOIN employees e ON o.employee_id = e.employee_id
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                WHERE 1=1
            """
        
        params = []
        
        if start_date:
            query += " AND DATE(o.order_date) >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(o.order_date) <= %s"
            params.append(end_date)
        
        if employee_id:
            query += " AND o.employee_id = %s"
            params.append(employee_id)
        
        if order_status:
            query += " AND o.order_status = %s"
            params.append(order_status)
        
        query += " ORDER BY o.order_date DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # RealDictCursor already returns dict-like objects
        return [dict(row) for row in rows]
    finally:
        conn.close()

def get_tips_by_employee(
    employee_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get tips received by employees"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if employee_tips table exists
    cursor.execute("""
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_tips'
    """)
    has_tips_table = cursor.fetchone() is not None
    
    if has_tips_table:
        # Use employee_tips table
        query = """
            SELECT 
                et.employee_id,
                e.first_name || ' ' || e.last_name as employee_name,
                COUNT(et.tip_id) as num_transactions,
                SUM(et.tip_amount) as total_tips,
                AVG(et.tip_amount) as avg_tip,
                DATE(et.tip_date) as tip_date
            FROM employee_tips et
            JOIN employees e ON et.employee_id = e.employee_id
            WHERE et.tip_amount > 0
        """
        params = []
        
        if employee_id:
            query += " AND et.employee_id = %s"
            params.append(employee_id)
        
        if start_date:
            query += " AND DATE(et.tip_date) >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(et.tip_date) <= ?"
            params.append(end_date)
        
        query += " GROUP BY et.employee_id, DATE(et.tip_date) ORDER BY tip_date DESC, total_tips DESC"
    else:
        # Fallback to payment_transactions
        query = """
            SELECT 
                pt.employee_id,
                e.first_name || ' ' || e.last_name as employee_name,
                COUNT(pt.transaction_id) as num_transactions,
                SUM(COALESCE(pt.tip, 0)) as total_tips,
                AVG(COALESCE(pt.tip, 0)) as avg_tip,
                DATE(pt.transaction_date) as tip_date
            FROM payment_transactions pt
            JOIN orders o ON pt.order_id = o.order_id
            JOIN employees e ON COALESCE(pt.employee_id, o.employee_id) = e.employee_id
            WHERE COALESCE(pt.tip, 0) > 0
        """
        params = []
        
        if employee_id:
            query += " AND COALESCE(pt.employee_id, o.employee_id) = ?"
            params.append(employee_id)
        
        if start_date:
            query += " AND DATE(pt.transaction_date) >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(pt.transaction_date) <= ?"
            params.append(end_date)
        
        query += " GROUP BY pt.employee_id, DATE(pt.transaction_date) ORDER BY tip_date DESC, total_tips DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_employee_tip_summary(
    employee_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """Get tip summary for a specific employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if employee_tips table exists
    cursor.execute("""
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_tips'
    """)
    has_tips_table = cursor.fetchone() is not None
    
    if has_tips_table:
        query = """
            SELECT 
                COUNT(et.tip_id) as num_transactions,
                SUM(et.tip_amount) as total_tips,
                AVG(et.tip_amount) as avg_tip,
                MIN(et.tip_amount) as min_tip,
                MAX(et.tip_amount) as max_tip
            FROM employee_tips et
            WHERE et.employee_id = %s
              AND et.tip_amount > 0
        """
        params = [employee_id]
        
        if start_date:
            query += " AND DATE(et.tip_date) >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(et.tip_date) <= ?"
            params.append(end_date)
    else:
        # Fallback to payment_transactions
        query = """
            SELECT 
                COUNT(pt.transaction_id) as num_transactions,
                SUM(COALESCE(pt.tip, 0)) as total_tips,
                AVG(COALESCE(pt.tip, 0)) as avg_tip,
                MIN(COALESCE(pt.tip, 0)) as min_tip,
                MAX(COALESCE(pt.tip, 0)) as max_tip
            FROM payment_transactions pt
            JOIN orders o ON pt.order_id = o.order_id
            WHERE COALESCE(pt.employee_id, o.employee_id) = %s
              AND COALESCE(pt.tip, 0) > 0
        """
        params = [employee_id]
        
        if start_date:
            query += " AND DATE(pt.transaction_date) >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(pt.transaction_date) <= ?"
            params.append(end_date)
    
    cursor.execute(query, params)
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return {
        'num_transactions': 0,
        'total_tips': 0.0,
        'avg_tip': 0.0,
        'min_tip': 0.0,
        'max_tip': 0.0
    }

def get_employee_tips(
    employee_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get all tips for a specific employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if employee_tips table exists
    cursor.execute("""
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_tips'
    """)
    has_tips_table = cursor.fetchone() is not None
    
    if has_tips_table:
        query = """
            SELECT 
                et.*,
                o.order_number,
                o.order_date,
                o.total as order_total
            FROM employee_tips et
            JOIN orders o ON et.order_id = o.order_id
            WHERE et.employee_id = %s
        """
        params = [employee_id]
        
        if start_date:
            query += " AND DATE(et.tip_date) >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(et.tip_date) <= ?"
            params.append(end_date)
        
        query += " ORDER BY et.tip_date DESC"
    else:
        # Fallback to payment_transactions
        query = """
            SELECT 
                pt.transaction_id as tip_id,
                pt.employee_id,
                pt.order_id,
                pt.transaction_id,
                COALESCE(pt.tip, 0) as tip_amount,
                pt.transaction_date as tip_date,
                pt.payment_method,
                o.order_number,
                o.order_date,
                o.total as order_total
            FROM payment_transactions pt
            JOIN orders o ON pt.order_id = o.order_id
            WHERE COALESCE(pt.employee_id, o.employee_id) = %s
              AND COALESCE(pt.tip, 0) > 0
        """
        params = [employee_id]
        
        if start_date:
            query += " AND DATE(pt.transaction_date) >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(pt.transaction_date) <= ?"
            params.append(end_date)
        
        query += " ORDER BY pt.transaction_date DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

# ============================================================================
# EMPLOYEE SCHEDULE FUNCTIONS
# ============================================================================

def add_schedule(
    employee_id: int,
    schedule_date: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    break_duration: int = 0,
    notes: Optional[str] = None
) -> int:
    """Add a schedule entry for an employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO employee_schedule (
            employee_id, schedule_date, start_time, end_time, break_duration, notes
        ) VALUES (%s, %s, %s, %s, %s, %s)
    """, (employee_id, schedule_date, start_time, end_time, break_duration, notes))
    
    conn.commit()
    schedule_id = cursor.lastrowid
    conn.close()
    
    return schedule_id

def clock_in(employee_id: int, schedule_id: Optional[int] = None, schedule_date: Optional[str] = None,
             latitude: Optional[float] = None, longitude: Optional[float] = None, 
             address: Optional[str] = None) -> Dict[str, Any]:
    """
    Clock in an employee
    If schedule_id is provided, updates that schedule. Otherwise creates a new one.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Validate location if provided
        location_validation = None
        if latitude is not None and longitude is not None:
            location_validation = validate_location(latitude, longitude)
            if not location_validation['valid']:
                conn.close()
                return {
                    'success': False,
                    'message': location_validation['message'],
                    'location_validation': location_validation
                }
        
        if schedule_id:
            # Update existing schedule
            cursor.execute("""
                UPDATE employee_schedule
                SET clock_in_time = CURRENT_TIMESTAMP,
                    status = 'clocked_in',
                    clock_in_latitude = %s,
                    clock_in_longitude = %s,
                    clock_in_address = %s
                WHERE schedule_id = %s AND employee_id = %s
            """, (latitude, longitude, address, schedule_id, employee_id))
            
            if cursor.rowcount == 0:
                conn.close()
                return {'success': False, 'message': 'Schedule not found'}
        else:
            # Create new schedule entry
            if not schedule_date:
                schedule_date = datetime.now().date().isoformat()
            
            cursor.execute("""
                INSERT INTO employee_schedule (
                    employee_id, schedule_date, clock_in_time, status,
                    clock_in_latitude, clock_in_longitude, clock_in_address
                ) VALUES (%s, %s, CURRENT_TIMESTAMP, 'clocked_in', %s, %s, %s)
            """, (employee_id, schedule_date, latitude, longitude, address))
            
            schedule_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'schedule_id': schedule_id,
            'message': 'Clocked in successfully',
            'location_validation': location_validation
        }
    except Exception as e:
        conn.rollback()
        conn.close()
        return {'success': False, 'message': str(e)}

def clock_out(employee_id: int, schedule_id: int) -> Dict[str, Any]:
    """Clock out an employee and calculate hours worked"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get schedule with clock in time
        cursor.execute("""
            SELECT clock_in_time, start_time, end_time, break_duration
            FROM employee_schedule
            WHERE schedule_id = %s AND employee_id = %s
        """, (schedule_id, employee_id))
        
        schedule = cursor.fetchone()
        if not schedule:
            conn.close()
            return {'success': False, 'message': 'Schedule not found'}
        
        schedule = dict(schedule)
        
        if not schedule['clock_in_time']:
            conn.close()
            return {'success': False, 'message': 'Employee has not clocked in'}
        
        # Calculate hours worked
        clock_in_str = schedule['clock_in_time']
        if isinstance(clock_in_str, str):
            clock_in = datetime.fromisoformat(clock_in_str.replace('Z', '+00:00') if 'Z' in clock_in_str else clock_in_str)
        else:
            clock_in = clock_in_str
        
        clock_out_time = datetime.now()
        
        # Calculate difference in hours
        time_diff = clock_out_time - clock_in
        hours_worked = time_diff.total_seconds() / 3600.0
        
        # Subtract break duration
        if schedule['break_duration']:
            hours_worked -= (schedule['break_duration'] / 60.0)
        
        # Calculate overtime (assuming 8 hours is standard, adjust as needed)
        overtime_hours = max(0, hours_worked - 8.0)
        
        # Update schedule
        cursor.execute("""
            UPDATE employee_schedule
            SET clock_out_time = CURRENT_TIMESTAMP,
                hours_worked = %s,
                overtime_hours = %s,
                status = 'clocked_out'
            WHERE schedule_id = %s AND employee_id = %s
        """, (hours_worked, overtime_hours, schedule_id, employee_id))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'hours_worked': hours_worked,
            'overtime_hours': overtime_hours,
            'message': 'Clocked out successfully'
        }
    except Exception as e:
        conn.rollback()
        conn.close()
        return {'success': False, 'message': str(e)}

def get_schedule(
    employee_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get schedule entries"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            es.*,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_code
        FROM employee_schedule es
        JOIN employees e ON es.employee_id = e.employee_id
        WHERE 1=1
    """
    params = []
    
    if employee_id:
        query += " AND es.employee_id = %s"
        params.append(employee_id)
    
    if start_date:
        query += " AND es.schedule_date >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND es.schedule_date <= ?"
        params.append(end_date)
    
    query += " ORDER BY es.schedule_date DESC, es.start_time"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_current_clock_status(employee_id: int) -> Optional[Dict[str, Any]]:
    """Get current clock status for an employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            es.*,
            e.first_name || ' ' || e.last_name as employee_name
        FROM employee_schedule es
        JOIN employees e ON es.employee_id = e.employee_id
        WHERE es.employee_id = %s 
          AND es.status = 'clocked_in'
          AND DATE(es.clock_in_time) = DATE('now')
        ORDER BY es.clock_in_time DESC
        LIMIT 1
    """, (employee_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

# ============================================================================
# MASTER CALENDAR FUNCTIONS
# ============================================================================

def add_calendar_event(
    event_date: str,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    related_id: Optional[int] = None,
    related_table: Optional[str] = None,
    created_by: Optional[int] = None,
    employee_ids: Optional[List[int]] = None
) -> int:
    """Add an event to the master calendar
    
    Args:
        employee_ids: List of employee IDs. If None or empty, event is for everyone.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        establishment_id = _get_or_create_default_establishment(conn)
        cursor.execute("""
            INSERT INTO master_calendar (
                establishment_id, event_date, event_type, title, description,
                start_time, end_time, related_id, related_table, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING calendar_id
        """, (establishment_id, event_date, event_type, title, description,
              start_time, end_time, related_id, related_table, created_by))
        row = cursor.fetchone()
        calendar_id = row[0] if row else None
        
        # If employee_ids provided, assign event to specific employees
        if calendar_id and employee_ids:
            for employee_id in employee_ids:
                cursor.execute("""
                    INSERT INTO calendar_event_employees (calendar_id, employee_id)
                    VALUES (%s, %s)
                """, (calendar_id, employee_id))
        
        conn.commit()
        return calendar_id
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_calendar_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get calendar events"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
            SELECT 
                c.*,
                e.first_name || ' ' || e.last_name as created_by_name
            FROM master_calendar c
            LEFT JOIN employees e ON c.created_by = e.employee_id
            WHERE 1=1
        """
        params = []
        if start_date:
            query += " AND c.event_date >= %s"
            params.append(start_date)
        if end_date:
            query += " AND c.event_date <= %s"
            params.append(end_date)
        if event_type:
            query += " AND c.event_type = %s"
            params.append(event_type)
        query += " ORDER BY c.event_date, c.start_time"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def add_shipment_to_calendar(shipment_id: int, shipment_date: str) -> int:
    """Add a shipment to the calendar"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get shipment details
    cursor.execute("""
        SELECT s.*, v.vendor_name
        FROM shipments s
        JOIN vendors v ON s.vendor_id = v.vendor_id
        WHERE s.shipment_id = %s
    """, (shipment_id,))
    
    shipment = cursor.fetchone()
    if not shipment:
        conn.close()
        raise ValueError(f"Shipment {shipment_id} not found")
    
    shipment = dict(shipment)
    
    title = f"Shipment from {shipment['vendor_name']}"
    if shipment.get('purchase_order_number'):
        title += f" (PO: {shipment['purchase_order_number']})"
    
    calendar_id = add_calendar_event(
        event_date=shipment_date,
        event_type='shipment',
        title=title,
        description=shipment.get('notes'),
        related_id=shipment_id,
        related_table='shipments'
    )
    
    conn.close()
    return calendar_id

def get_calendar_view(start_date: str, end_date: str) -> Dict[str, Any]:
    """Get a calendar view with all events, schedules, and shipments"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get all calendar events
    events = get_calendar_events(start_date=start_date, end_date=end_date)
    
    # Get schedules
    schedules = get_schedule(start_date=start_date, end_date=end_date)
    
    # Get shipments in date range
    cursor.execute("""
        SELECT 
            s.shipment_id,
            s.received_date as event_date,
            s.purchase_order_number,
            v.vendor_name,
            'shipment' as event_type
        FROM shipments s
        JOIN vendors v ON s.vendor_id = v.vendor_id
        WHERE s.received_date >= %s AND s.received_date <= %s
    """, (start_date, end_date))
    
    shipments = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        'events': events,
        'schedules': schedules,
        'shipments': shipments
    }

# ============================================================================
# EMPLOYEE AUTHENTICATION & SESSION MANAGEMENT
# ============================================================================

def employee_login(
    employee_code: Optional[str] = None,
    username: Optional[str] = None,
    password: str = None,
    ip_address: Optional[str] = None,
    device_info: Optional[str] = None
) -> Dict[str, Any]:
    """Authenticate employee and create session"""
    from database_postgres import get_cursor
    cursor = get_cursor()  # Use RealDictCursor
    conn = cursor.connection
    
    # Support both username and employee_code for backward compatibility
    login_identifier = username if username else employee_code
    if not login_identifier:
        conn.close()
        return {'success': False, 'message': 'Username or employee code required'}
    
    if not password:
        conn.close()
        return {'success': False, 'message': 'Password is required'}
    
    password_hash = hash_password(password)
    
    # Check if table has username column (RBAC migration)
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' AND table_schema = 'public'")
    column_rows = cursor.fetchall()
    # Handle both RealDictRow and tuple results
    if column_rows and isinstance(column_rows[0], dict):
        columns = [row.get('column_name') for row in column_rows]
    else:
        columns = [row[0] if isinstance(row, (tuple, list)) else row.get('column_name', row) for row in column_rows]
    has_username = 'username' in columns
    
    # Verify credentials - try username first if available, then employee_code
    if has_username:
        cursor.execute("""
            SELECT employee_id, first_name, last_name, position, active, password_hash, username, employee_code
            FROM employees
            WHERE username = %s OR employee_code = %s
        """, (login_identifier, login_identifier))
    else:
        cursor.execute("""
            SELECT employee_id, first_name, last_name, position, active, password_hash, employee_code
            FROM employees
            WHERE employee_code = %s
        """, (login_identifier,))
    
    employee = cursor.fetchone()
    
    if not employee:
        conn.close()
        return {'success': False, 'message': 'Invalid credentials'}
    
    # Convert to dict - handle both RealDictRow and tuple
    if isinstance(employee, dict):
        employee = dict(employee)
    else:
        # Tuple - convert using column names
        columns = [desc[0] for desc in cursor.description]
        employee = {col: val for col, val in zip(columns, employee)}
    
    # Check if employee has a password set
    if not employee.get('password_hash'):
        conn.close()
        return {'success': False, 'message': 'Account has no password set. Please contact administrator.'}
    
    # Check password
    if employee['password_hash'] != password_hash:
        conn.close()
        return {'success': False, 'message': 'Invalid credentials'}
    
    if not employee['active']:
        conn.close()
        return {'success': False, 'message': 'Account is inactive'}
    
    # Generate session token
    session_token = secrets.token_urlsafe(32)
    
    # Get establishment_id from employee
    establishment_id = employee.get('establishment_id')
    if not establishment_id:
        # Get establishment_id from employee record
        cursor.execute("SELECT establishment_id FROM employees WHERE employee_id = %s", (employee['employee_id'],))
        est_row = cursor.fetchone()
        if est_row:
            establishment_id = est_row.get('establishment_id') if isinstance(est_row, dict) else est_row[0]
    
    # Create session record - check if establishment_id column exists
    cursor.execute("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'employee_sessions' AND table_schema = 'public' AND column_name = 'establishment_id'
    """)
    has_establishment_id = cursor.fetchone() is not None
    
    if has_establishment_id and establishment_id:
        cursor.execute("""
            INSERT INTO employee_sessions (
                employee_id, establishment_id, session_token, ip_address, device_info
            ) VALUES (%s, %s, %s, %s, %s)
        """, (employee['employee_id'], establishment_id, session_token, ip_address, device_info))
    else:
        cursor.execute("""
            INSERT INTO employee_sessions (
                employee_id, session_token, ip_address, device_info
            ) VALUES (%s, %s, %s, %s)
        """, (employee['employee_id'], session_token, ip_address, device_info))
    
    # Update last login
    cursor.execute("""
        UPDATE employees
        SET last_login = CURRENT_TIMESTAMP
        WHERE employee_id = %s
    """, (employee['employee_id'],))
    
    conn.commit()
    conn.close()
    
    # Log login action (don't fail login if audit logging fails)
    try:
        log_audit_action(
            table_name='employees',
            record_id=employee['employee_id'],
            action_type='LOGIN',
            employee_id=employee['employee_id'],
            ip_address=ip_address,
            notes=f'Employee {login_identifier} logged in'
        )
    except Exception as audit_error:
        # Log error but don't fail the login
        print(f"Warning: Failed to log audit action for login: {audit_error}")
    
    return {
        'success': True,
        'employee_id': employee['employee_id'],
        'employee_name': f"{employee['first_name']} {employee['last_name']}",
        'position': employee['position'],
        'session_token': session_token
    }

def get_employee_role(employee_id: int) -> Optional[Dict[str, Any]]:
    """Get employee's role information"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT e.employee_id, e.role_id, r.role_name, r.description
        FROM employees e
        LEFT JOIN roles r ON e.role_id = r.role_id
        WHERE e.employee_id = %s AND e.active = 1
    """, (employee_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def assign_role_to_employee(employee_id: int, role_id: int) -> bool:
    """Assign a role to an employee"""
    conn = get_connection()
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
        raise ValueError(f"Error assigning role: {e}") from e
    finally:
        conn.close()

def verify_session(session_token: str) -> Dict[str, Any]:
    """Verify if session is valid"""
    from psycopg2.extras import RealDictCursor
    if not session_token:
        return {'valid': False, 'message': 'Session token is required'}
    
    conn = None
    try:
        conn = get_connection()
        if conn is None or conn.closed:
            return {'valid': False, 'message': 'Database connection failed'}
        
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT es.*, e.first_name, e.last_name, e.position, e.active
            FROM employee_sessions es
            JOIN employees e ON es.employee_id = e.employee_id
            WHERE es.session_token = %s 
              AND es.is_active = 1
              AND e.active = 1
        """, (session_token,))
        
        session = cursor.fetchone()
        
        if session:
            # Handle both dict-like rows (RealDictRow) and tuple rows
            if isinstance(session, dict):
                session_dict = session
            elif hasattr(session, '_asdict'):
                session_dict = dict(session._asdict())
            else:
                # Try to convert to dict
                try:
                    column_names = [desc[0] for desc in cursor.description] if cursor.description else []
                    if column_names:
                        session_dict = dict(zip(column_names, session))
                    else:
                        session_dict = dict(session) if isinstance(session, dict) else {}
                except (TypeError, ValueError):
                    # Fallback: convert manually
                    session_dict = {str(i): val for i, val in enumerate(session)} if hasattr(session, '__iter__') and not isinstance(session, str) else {}
            
            return {
                'valid': True,
                'employee_id': session_dict.get('employee_id'),
                'employee_name': f"{session_dict.get('first_name', '')} {session_dict.get('last_name', '')}".strip(),
                'position': session_dict.get('position', '')
            }
        
        return {'valid': False}
    except Exception as e:
        print(f"Error in verify_session: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            try:
                conn.rollback()
            except:
                pass
        return {'valid': False, 'message': str(e)}
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

def employee_logout(session_token: str) -> Dict[str, Any]:
    """End employee session"""
    if not session_token:
        return {'success': False, 'message': 'Session token is required'}
    
    conn = None
    try:
        conn = get_connection()
        if conn is None or conn.closed:
            return {'success': False, 'message': 'Database connection failed'}
        
        cursor = conn.cursor()
        
        # Get employee_id before logout
        cursor.execute("SELECT employee_id FROM employee_sessions WHERE session_token = %s", (session_token,))
        session = cursor.fetchone()
        
        if session:
            # Handle both dict-like rows (RealDictRow) and tuple rows
            if isinstance(session, dict):
                employee_id = session.get('employee_id')
            elif hasattr(session, '_asdict'):
                employee_id = dict(session._asdict()).get('employee_id')
            else:
                # Try to get employee_id from tuple
                try:
                    column_names = [desc[0] for desc in cursor.description] if cursor.description else []
                    if column_names and 'employee_id' in column_names:
                        session_dict = dict(zip(column_names, session))
                        employee_id = session_dict.get('employee_id')
                    else:
                        employee_id = session[0] if isinstance(session, (tuple, list)) and len(session) > 0 else None
                except (TypeError, ValueError, IndexError):
                    employee_id = None
            
            if employee_id:
                cursor.execute("""
                    UPDATE employee_sessions
                    SET is_active = 0,
                        logout_time = CURRENT_TIMESTAMP
                    WHERE session_token = %s
                """, (session_token,))
                
                conn.commit()
                
                # Log logout action (don't fail logout if audit logging fails)
                try:
                    log_audit_action(
                        table_name='employee_sessions',
                        record_id=employee_id,
                        action_type='LOGOUT',
                        employee_id=employee_id,
                        notes='Employee logged out'
                    )
                except Exception as audit_error:
                    # Log error but don't fail the logout
                    print(f"Warning: Failed to log audit action for logout: {audit_error}")
                return {'success': True, 'message': 'Logged out successfully'}
        
        return {'success': False, 'message': 'Session not found'}
    except Exception as e:
        print(f"Error in employee_logout: {e}")
        import traceback
        traceback.print_exc()
        if conn and not conn.closed:
            try:
                conn.rollback()
            except:
                pass
        return {'success': False, 'message': str(e)}
    finally:
        if conn and not conn.closed:
            conn.close()

def change_employee_password(employee_id: int, old_password: str, new_password: str) -> Dict[str, Any]:
    """Change employee password"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Verify old password
    cursor.execute("SELECT password_hash FROM employees WHERE employee_id = %s", (employee_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return {'success': False, 'message': 'Employee not found'}
    
    if dict(row)['password_hash'] != hash_password(old_password):
        conn.close()
        return {'success': False, 'message': 'Incorrect old password'}
    
    # Validate admin password (must be numeric only)
    if is_admin_user(employee_id, cursor) and not validate_admin_password(new_password):
        conn.close()
        return {'success': False, 'message': 'Admin passwords must contain only numbers'}
    
    # Update password
    new_password_hash = hash_password(new_password)
    cursor.execute("""
        UPDATE employees
        SET password_hash = %s
        WHERE employee_id = %s
    """, (new_password_hash, employee_id))
    
    conn.commit()
    conn.close()
    
    return {'success': True, 'message': 'Password changed successfully'}

# ============================================================================
# TIME CLOCK FUNCTIONS
# ============================================================================

def time_clock_in(employee_id: int) -> Dict[str, Any]:
    """Employee clocks in"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if already clocked in
    cursor.execute("""
        SELECT time_entry_id
        FROM time_clock
        WHERE employee_id = %s 
          AND clock_out IS NULL
    """, (employee_id,))
    
    if cursor.fetchone():
        conn.close()
        return {'success': False, 'message': 'Already clocked in'}
    
    # Clock in
    cursor.execute("""
        INSERT INTO time_clock (employee_id, clock_in, status)
        VALUES (%s, CURRENT_TIMESTAMP, 'clocked_in')
    """, (employee_id,))
    
    time_entry_id = cursor.lastrowid
    
    conn.commit()
    
    # Log clock in action
    log_audit_action(
        table_name='time_clock',
        record_id=time_entry_id,
        action_type='CLOCK_IN',
        employee_id=employee_id,
        notes='Employee clocked in'
    )
    
    conn.close()
    
    return {
        'success': True,
        'time_entry_id': time_entry_id,
        'message': 'Clocked in successfully'
    }

def time_clock_out(employee_id: int) -> Dict[str, Any]:
    """Employee clocks out"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get active time entry
    cursor.execute("""
        SELECT time_entry_id, clock_in
        FROM time_clock
        WHERE employee_id = %s 
          AND clock_out IS NULL
        ORDER BY clock_in DESC
        LIMIT 1
    """, (employee_id,))
    
    result = cursor.fetchone()
    
    if not result:
        conn.close()
        return {'success': False, 'message': 'Not clocked in'}
    
    result = dict(result)
    time_entry_id = result['time_entry_id']
    clock_in_str = result['clock_in']
    
    # Calculate hours
    if isinstance(clock_in_str, str):
        clock_in = datetime.fromisoformat(clock_in_str.replace('Z', '+00:00') if 'Z' in clock_in_str else clock_in_str)
    else:
        clock_in = clock_in_str
    
    clock_out_time = datetime.now()
    time_diff = clock_out_time - clock_in
    total_hours = time_diff.total_seconds() / 3600.0
    
    # Update time entry
    cursor.execute("""
        UPDATE time_clock
        SET clock_out = CURRENT_TIMESTAMP,
            status = 'clocked_out',
            total_hours = %s
        WHERE time_entry_id = %s
    """, (total_hours, time_entry_id))
    
    conn.commit()
    
    # Log clock out action
    log_audit_action(
        table_name='time_clock',
        record_id=time_entry_id,
        action_type='CLOCK_OUT',
        employee_id=employee_id,
        notes=f'Employee clocked out - {total_hours:.2f} hours worked'
    )
    
    conn.close()
    
    return {
        'success': True,
        'total_hours': total_hours,
        'message': 'Clocked out successfully'
    }

def time_start_break(employee_id: int) -> Dict[str, Any]:
    """Start break"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE time_clock
        SET break_start = CURRENT_TIMESTAMP,
            status = 'on_break'
        WHERE employee_id = %s 
          AND clock_out IS NULL
          AND break_start IS NULL
    """, (employee_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        return {'success': False, 'message': 'Cannot start break'}
    
    conn.commit()
    conn.close()
    
    return {'success': True, 'message': 'Break started'}

def time_end_break(employee_id: int) -> Dict[str, Any]:
    """End break"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE time_clock
        SET break_end = CURRENT_TIMESTAMP,
            status = 'clocked_in'
        WHERE employee_id = %s 
          AND clock_out IS NULL
          AND break_start IS NOT NULL
          AND break_end IS NULL
    """, (employee_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        return {'success': False, 'message': 'No active break'}
    
    conn.commit()
    conn.close()
    
    return {'success': True, 'message': 'Break ended'}

def get_timesheet(employee_id: int, start_date: str, end_date: str) -> Dict[str, Any]:
    """Get employee timesheet for date range"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            DATE(clock_in) as work_date,
            clock_in,
            clock_out,
            break_start,
            break_end,
            total_hours,
            status
        FROM time_clock
        WHERE employee_id = %s
          AND DATE(clock_in) >= %s AND DATE(clock_in) <= %s
        ORDER BY clock_in DESC
    """, (employee_id, start_date, end_date))
    
    timesheet = [dict(row) for row in cursor.fetchall()]
    
    # Calculate total hours
    cursor.execute("""
        SELECT SUM(total_hours) as total
        FROM time_clock
        WHERE employee_id = %s
          AND DATE(clock_in) >= %s AND DATE(clock_in) <= %s
          AND clock_out IS NOT NULL
    """, (employee_id, start_date, end_date))
    
    total_row = cursor.fetchone()
    total_hours = total_row['total'] if total_row and total_row['total'] else 0.0
    
    conn.close()
    
    return {
        'timesheet': timesheet,
        'total_hours': total_hours
    }

# ============================================================================
# AUDIT LOGGING FUNCTIONS
# ============================================================================

def log_audit_action(
    table_name: str,
    record_id: int,
    action_type: str,
    employee_id: int,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    notes: Optional[str] = None
) -> int:
    """Log any database action to audit log"""
    conn = get_connection()
    cursor = conn.cursor()
    
    old_values_json = json.dumps(old_values) if old_values else None
    new_values_json = json.dumps(new_values) if new_values else None
    
    # Get establishment_id if needed
    establishment_id = None
    cursor.execute("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND table_schema = 'public' AND column_name = 'establishment_id'
    """)
    has_establishment_id = cursor.fetchone() is not None
    
    if has_establishment_id:
        # Try to get establishment_id from employee
        try:
            emp_cursor = conn.cursor()
            emp_cursor.execute("SELECT establishment_id FROM employees WHERE employee_id = %s", (employee_id,))
            est_row = emp_cursor.fetchone()
            if est_row:
                establishment_id = est_row.get('establishment_id') if isinstance(est_row, dict) else est_row[0]
            emp_cursor.close()
        except:
            pass
    
    if has_establishment_id and establishment_id:
        cursor.execute("""
            INSERT INTO audit_log (
                establishment_id, table_name, record_id, action_type, employee_id,
                old_values, new_values, ip_address, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (establishment_id, table_name, record_id, action_type, employee_id,
              old_values_json, new_values_json, ip_address, notes))
    else:
        cursor.execute("""
            INSERT INTO audit_log (
                table_name, record_id, action_type, employee_id,
                old_values, new_values, ip_address, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (table_name, record_id, action_type, employee_id,
              old_values_json, new_values_json, ip_address, notes))
    
    conn.commit()
    audit_id = cursor.lastrowid
    conn.close()
    
    return audit_id

def get_audit_trail(
    table_name: Optional[str] = None,
    record_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 1000
) -> List[Dict[str, Any]]:
    """Retrieve audit trail with filters"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            al.*,
            e.first_name || ' ' || e.last_name as employee_name,
            e.position
        FROM audit_log al
        JOIN employees e ON al.employee_id = e.employee_id
        WHERE 1=1
    """
    params = []
    
    if table_name:
        query += " AND al.table_name = %s"
        params.append(table_name)
    
    if record_id:
        query += " AND al.record_id = %s"
        params.append(record_id)
    
    if employee_id:
        query += " AND al.employee_id = %s"
        params.append(employee_id)
    
    if start_date:
        query += " AND DATE(al.action_timestamp) >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(al.action_timestamp) <= ?"
        params.append(end_date)
    
    query += " ORDER BY al.action_timestamp DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    audit_trail = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return audit_trail

# ============================================================================
# ACCOUNTING SYSTEM FUNCTIONS
# ============================================================================

def initialize_chart_of_accounts() -> Dict[str, Any]:
    """Initialize standard chart of accounts"""
    conn = get_connection()
    cursor = conn.cursor()
    
    accounts = [
        # ASSETS
        ('1000', 'Cash', 'asset', 'current_asset', 'debit'),
        ('1010', 'Petty Cash', 'asset', 'current_asset', 'debit'),
        ('1100', 'Accounts Receivable', 'asset', 'current_asset', 'debit'),
        ('1200', 'Inventory', 'asset', 'current_asset', 'debit'),
        ('1300', 'Prepaid Expenses', 'asset', 'current_asset', 'debit'),
        ('1500', 'Equipment', 'asset', 'fixed_asset', 'debit'),
        ('1510', 'Accumulated Depreciation - Equipment', 'contra_asset', 'fixed_asset', 'credit'),
        ('1600', 'Furniture & Fixtures', 'asset', 'fixed_asset', 'debit'),
        ('1610', 'Accumulated Depreciation - Furniture', 'contra_asset', 'fixed_asset', 'credit'),
        # LIABILITIES
        ('2000', 'Accounts Payable', 'liability', 'current_liability', 'credit'),
        ('2100', 'Sales Tax Payable', 'liability', 'current_liability', 'credit'),
        ('2200', 'Wages Payable', 'liability', 'current_liability', 'credit'),
        ('2300', 'Unearned Revenue', 'liability', 'current_liability', 'credit'),
        ('2500', 'Notes Payable - Long Term', 'liability', 'long_term_liability', 'credit'),
        # EQUITY
        ('3000', "Owner's Capital", 'equity', 'owner_equity', 'credit'),
        ('3100', "Owner's Drawings", 'equity', 'owner_equity', 'debit'),
        ('3200', 'Retained Earnings', 'equity', 'retained_earnings', 'credit'),
        ('3300', 'Common Stock', 'equity', 'paid_in_capital', 'credit'),
        ('3400', 'Additional Paid-In Capital', 'equity', 'paid_in_capital', 'credit'),
        # REVENUE
        ('4000', 'Sales Revenue', 'revenue', 'operating_revenue', 'credit'),
        ('4100', 'Sales Returns and Allowances', 'contra_revenue', 'operating_revenue', 'debit'),
        ('4200', 'Sales Discounts', 'contra_revenue', 'operating_revenue', 'debit'),
        ('4500', 'Other Income', 'revenue', 'non_operating_revenue', 'credit'),
        # EXPENSES
        ('5000', 'Cost of Goods Sold', 'expense', 'cogs', 'debit'),
        ('5100', 'Inventory Shrinkage', 'expense', 'cogs', 'debit'),
        ('5200', 'Freight In', 'expense', 'cogs', 'debit'),
        ('6000', 'Salaries and Wages Expense', 'expense', 'operating_expense', 'debit'),
        ('6100', 'Rent Expense', 'expense', 'operating_expense', 'debit'),
        ('6200', 'Utilities Expense', 'expense', 'operating_expense', 'debit'),
        ('6300', 'Insurance Expense', 'expense', 'operating_expense', 'debit'),
        ('6400', 'Office Supplies Expense', 'expense', 'operating_expense', 'debit'),
        ('6500', 'Depreciation Expense', 'expense', 'operating_expense', 'debit'),
        ('6600', 'Marketing and Advertising', 'expense', 'operating_expense', 'debit'),
        ('6700', 'Bank Fees', 'expense', 'operating_expense', 'debit'),
        ('6800', 'Damaged Goods Expense', 'expense', 'operating_expense', 'debit'),
        ('6900', 'Shipping Discrepancy Loss', 'expense', 'operating_expense', 'debit'),
    ]
    
    added = 0
    skipped = 0
    
    for account_number, account_name, account_type, account_subtype, normal_balance in accounts:
        try:
            cursor.execute("""
                INSERT INTO chart_of_accounts (
                    account_number, account_name, account_type, account_subtype, normal_balance
                ) VALUES (%s, %s, %s, %s, %s)
            """, (account_number, account_name, account_type, account_subtype, normal_balance))
            added += 1
        except Exception:
            skipped += 1
    
    conn.commit()
    conn.close()
    
    return {
        'added': added,
        'skipped': skipped,
        'total': len(accounts)
    }

def add_account(
    account_number: str,
    account_name: str,
    account_type: str,
    normal_balance: str,
    account_subtype: Optional[str] = None,
    parent_account_id: Optional[int] = None,
    description: Optional[str] = None
) -> int:
    """Add a new account to chart of accounts"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO chart_of_accounts (
                account_number, account_name, account_type, account_subtype,
                normal_balance, parent_account_id, description
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (account_number, account_name, account_type, account_subtype,
              normal_balance, parent_account_id, description))
        
        conn.commit()
        account_id = cursor.lastrowid
        conn.close()
        return account_id
    except Exception as e:
        import psycopg2
        if isinstance(e, psycopg2.IntegrityError):
            conn.rollback()
            conn.close()
            raise ValueError(f"Account number '{account_number}' already exists") from e

def get_account_by_number(account_number: str) -> Optional[Dict[str, Any]]:
    """Get account by account number"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM chart_of_accounts WHERE account_number = %s", (account_number,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def create_journal_entry(
    entry_date: str,
    transaction_source: str,
    source_id: Optional[int],
    description: str,
    line_items: List[Dict[str, Any]],
    employee_id: int,
    entry_type: str = 'standard',
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a journal entry with multiple lines (double-entry bookkeeping)
    
    line_items: List of dicts with keys: account_number, debit_amount, credit_amount, description
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Generate entry number
        cursor.execute("""
            SELECT COUNT(*) + 1 as next_num
            FROM journal_entries
            WHERE strftime('%Y', entry_date) = strftime('%Y', %s)
        """, (entry_date,))
        
        next_num = cursor.fetchone()[0]
        entry_number = f"JE-{datetime.now().year}-{next_num:05d}"
        
        # Validate debits = credits
        total_debits = sum(float(item.get('debit_amount', 0)) for item in line_items)
        total_credits = sum(float(item.get('credit_amount', 0)) for item in line_items)
        
        if abs(total_debits - total_credits) > 0.01:  # Allow small floating point differences
            conn.close()
            return {
                'success': False,
                'message': f'Debits ({total_debits:.2f}) must equal Credits ({total_credits:.2f})'
            }
        
        # Create journal entry header
        cursor.execute("""
            INSERT INTO journal_entries (
                entry_number, entry_date, entry_type, transaction_source, source_id,
                description, employee_id, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (entry_number, entry_date, entry_type, transaction_source, source_id,
              description, employee_id, notes))
        
        journal_entry_id = cursor.lastrowid
        
        # Create journal entry lines
        for idx, item in enumerate(line_items, start=1):
            # Get account_id from account_number
            account = get_account_by_number(item['account_number'])
            if not account:
                conn.rollback()
                conn.close()
                return {
                    'success': False,
                    'message': f"Account {item['account_number']} not found"
                }
            
            cursor.execute("""
                INSERT INTO journal_entry_lines (
                    journal_entry_id, line_number, account_id,
                    debit_amount, credit_amount, description
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (journal_entry_id, idx, account['account_id'],
                  item.get('debit_amount', 0), item.get('credit_amount', 0),
                  item.get('description', '')))
        
        conn.commit()
        
        # Log audit action
        log_audit_action(
            table_name='journal_entries',
            record_id=journal_entry_id,
            action_type='INSERT',
            employee_id=employee_id,
            new_values={'entry_number': entry_number, 'description': description}
        )
        
        conn.close()
        
        return {
            'success': True,
            'journal_entry_id': journal_entry_id,
            'entry_number': entry_number
        }
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return {'success': False, 'message': str(e)}

def post_journal_entry(journal_entry_id: int, employee_id: int) -> bool:
    """Post a journal entry (mark as posted)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE journal_entries
        SET posted = 1,
            posted_date = CURRENT_TIMESTAMP
        WHERE journal_entry_id = %s
    """, (journal_entry_id,))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    if success:
        log_audit_action(
            table_name='journal_entries',
            record_id=journal_entry_id,
            action_type='UPDATE',
            employee_id=employee_id,
            new_values={'posted': True}
        )
    
    return success

def journalize_sale(order_id: int, employee_id: int) -> Dict[str, Any]:
    """Create journal entry for a sale with transaction fees"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get order details - check if tip column exists
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = \'orders\' AND table_schema = 'public'")
    columns = [col[0] for col in cursor.fetchall()]
    has_tip = 'tip' in columns
    has_order_type = 'order_type' in columns
    if has_tip:
        cursor.execute("""
            SELECT 
                o.total,
                o.tax_amount,
                o.subtotal,
                o.transaction_fee,
                o.tip,
                o.payment_method
            FROM orders o
            WHERE o.order_id = %s
        """, (order_id,))
    else:
        cursor.execute("""
            SELECT 
                o.total,
                o.tax_amount,
                o.subtotal,
                o.transaction_fee,
                0.0 as tip,
                o.payment_method
            FROM orders o
            WHERE o.order_id = %s
        """, (order_id,))
    
    order = cursor.fetchone()
    if not order:
        conn.close()
        return {'success': False, 'message': 'Order not found'}
    
    order = dict(order)
    
    # Get payment transaction details
    cursor.execute("""
        SELECT net_amount, transaction_fee
        FROM payment_transactions
        WHERE order_id = %s
        LIMIT 1
    """, (order_id,))
    
    payment = cursor.fetchone()
    payment = dict(payment) if payment else {'net_amount': order['total'], 'transaction_fee': order.get('transaction_fee', 0.0)}
    
    # Get COGS
    cursor.execute("""
        SELECT SUM(oi.quantity * i.product_cost) as cogs
        FROM order_items oi
        JOIN inventory i ON oi.product_id = i.product_id
        WHERE oi.order_id = %s
    """, (order_id,))
    
    cogs_row = cursor.fetchone()
    cogs = cogs_row['cogs'] if cogs_row and cogs_row['cogs'] else 0.0
    
    conn.close()
    
    # Determine cash account based on payment method
    cash_account = '1000'  # Cash (default)
    if order['payment_method'] in ['credit_card', 'debit_card', 'mobile_payment']:
        cash_account = '1100'  # Accounts Receivable (will be settled when payment processor deposits)
    
    # Get tip amount
    tip_amount = float(order.get('tip', 0.0))
    
    # Build journal entry line items
    line_items = [
        {
            'account_number': cash_account,
            'debit_amount': float(payment['net_amount']) + tip_amount,  # Net amount after fees + tip
            'credit_amount': 0,
            'description': f'Payment received (net after fees + tip)'
        },
        {
            'account_number': '4000',  # Sales Revenue
            'debit_amount': 0,
            'credit_amount': float(order['subtotal']),
            'description': f'Sales revenue'
        },
        {
            'account_number': '2100',  # Sales Tax Payable
            'debit_amount': 0,
            'credit_amount': float(order['tax_amount']),
            'description': f'Sales tax collected'
        },
        {
            'account_number': '5000',  # COGS
            'debit_amount': float(cogs),
            'credit_amount': 0,
            'description': f'Cost of goods sold'
        },
        {
            'account_number': '1200',  # Inventory
            'debit_amount': 0,
            'credit_amount': float(cogs),
            'description': f'Inventory reduction'
        }
    ]
    
    # Add tip revenue if tip exists
    if tip_amount > 0:
        line_items.append({
            'account_number': '4500',  # Other Income (tips)
            'debit_amount': 0,
            'credit_amount': tip_amount,
            'description': f'Tip received'
        })
    
    # Add transaction fee expense if applicable
    if payment['transaction_fee'] > 0:
        line_items.append({
            'account_number': '6700',  # Bank Fees / Transaction Fees
            'debit_amount': float(payment['transaction_fee']),
            'credit_amount': 0,
            'description': f'Payment processing fee ({order["payment_method"]})'
        })
        
        # Credit the difference (gross - net) to balance the entry
        gross_amount = float(order['total'])
        net_amount = float(payment['net_amount'])
        fee_amount = float(payment['transaction_fee'])
        
        # Adjust cash account to reflect gross amount collected (including tip)
        # The difference (fee) is already accounted for in the fee expense
        # We need to debit the full gross amount and credit the fee separately
        # Update cash account to gross amount (which includes tip)
        line_items[0]['debit_amount'] = gross_amount + tip_amount
    
    return create_journal_entry(
        entry_date=datetime.now().date().isoformat(),
        transaction_source='sale',
        source_id=order_id,
        description=f'Sale transaction for Order #{order_id}',
        line_items=line_items,
        employee_id=employee_id
    )

def journalize_shipment_received(shipment_id: int, employee_id: int) -> Dict[str, Any]:
    """Create journal entry when shipment is received"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get shipment details
    cursor.execute("""
        SELECT 
            SUM(si.quantity_received * si.unit_cost) as total_cost
        FROM shipment_items si
        WHERE si.shipment_id = %s
    """, (shipment_id,))
    
    shipment = cursor.fetchone()
    conn.close()
    
    if not shipment or not shipment['total_cost']:
        return {'success': False, 'message': 'Shipment not found or has no items'}
    
    # Journal Entry for Shipment:
    line_items = [
        {
            'account_number': '1200',  # Inventory
            'debit_amount': float(shipment['total_cost']),
            'credit_amount': 0,
            'description': f'Inventory received'
        },
        {
            'account_number': '2000',  # Accounts Payable
            'debit_amount': 0,
            'credit_amount': float(shipment['total_cost']),
            'description': f'Amount owed to vendor'
        }
    ]
    
    return create_journal_entry(
        entry_date=datetime.now().date().isoformat(),
        transaction_source='shipment',
        source_id=shipment_id,
        description=f'Inventory received - Shipment #{shipment_id}',
        line_items=line_items,
        employee_id=employee_id
    )

def journalize_return(order_id: int, return_amount: float, employee_id: int) -> Dict[str, Any]:
    """Create journal entry for customer return"""
    line_items = [
        {
            'account_number': '4100',  # Sales Returns
            'debit_amount': float(return_amount),
            'credit_amount': 0,
            'description': f'Customer return'
        },
        {
            'account_number': '1000',  # Cash
            'debit_amount': 0,
            'credit_amount': float(return_amount),
            'description': f'Refund issued'
        }
    ]
    
    return create_journal_entry(
        entry_date=datetime.now().date().isoformat(),
        transaction_source='return',
        source_id=order_id,
        description=f'Customer return for Order #{order_id}',
        line_items=line_items,
        employee_id=employee_id
    )

def journalize_damaged_goods(discrepancy_id: int, amount: float, employee_id: int) -> Dict[str, Any]:
    """Write off damaged goods"""
    line_items = [
        {
            'account_number': '6800',  # Damaged Goods Expense
            'debit_amount': float(amount),
            'credit_amount': 0,
            'description': f'Damaged goods write-off'
        },
        {
            'account_number': '1200',  # Inventory
            'debit_amount': 0,
            'credit_amount': float(amount),
            'description': f'Inventory reduction'
        }
    ]
    
    return create_journal_entry(
        entry_date=datetime.now().date().isoformat(),
        transaction_source='adjustment',
        source_id=discrepancy_id,
        description=f'Damaged goods write-off - Discrepancy #{discrepancy_id}',
        line_items=line_items,
        employee_id=employee_id
    )

# ============================================================================
# SHIPMENT DISCREPANCY TRACKING
# ============================================================================

def report_discrepancy(
    product_id: int,
    discrepancy_type: str,
    expected_quantity: int,
    actual_quantity: int,
    unit_cost: float,
    employee_id: int,
    shipment_id: Optional[int] = None,
    pending_shipment_id: Optional[int] = None,
    expected_product_sku: Optional[str] = None,
    actual_product_sku: Optional[str] = None,
    notes: Optional[str] = None,
    photos: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Report a shipment discrepancy"""
    conn = get_connection()
    cursor = conn.cursor()
    
    discrepancy_qty = actual_quantity - expected_quantity
    financial_impact = abs(discrepancy_qty) * unit_cost
    
    photos_json = json.dumps(photos) if photos else None
    
    cursor.execute("""
        INSERT INTO shipment_discrepancies (
            shipment_id, pending_shipment_id, product_id,
            discrepancy_type, expected_quantity, actual_quantity,
            discrepancy_quantity, expected_product_sku, actual_product_sku,
            financial_impact, reported_by, resolution_notes, photos
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (shipment_id, pending_shipment_id, product_id, discrepancy_type,
          expected_quantity, actual_quantity, discrepancy_qty,
          expected_product_sku, actual_product_sku, financial_impact,
          employee_id, notes, photos_json))
    
    discrepancy_id = cursor.lastrowid
    
    # Update pending shipment item if applicable
    if pending_shipment_id:
        cursor.execute("""
            UPDATE pending_shipment_items
            SET discrepancy_notes = %s
            WHERE pending_shipment_id = %s AND product_id = %s
        """, (notes, pending_shipment_id, product_id))
    
    conn.commit()
    
    # Log audit action
    log_audit_action(
        table_name='shipment_discrepancies',
        record_id=discrepancy_id,
        action_type='INSERT',
        employee_id=employee_id,
        new_values={
            'discrepancy_type': discrepancy_type,
            'financial_impact': financial_impact
        },
        notes=notes
    )
    
    conn.close()
    
    return {
        'success': True,
        'discrepancy_id': discrepancy_id,
        'financial_impact': financial_impact
    }

def resolve_discrepancy(
    discrepancy_id: int,
    resolution_status: str,
    employee_id: int,
    resolution_notes: Optional[str] = None,
    vendor_notified: bool = False,
    vendor_response: Optional[str] = None,
    claim_number: Optional[str] = None,
    journalize: bool = True
) -> Dict[str, Any]:
    """Resolve a discrepancy and optionally create journal entry"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get discrepancy details
    cursor.execute("""
        SELECT * FROM shipment_discrepancies
        WHERE discrepancy_id = %s
    """, (discrepancy_id,))
    
    discrepancy = cursor.fetchone()
    if not discrepancy:
        conn.close()
        return {'success': False, 'message': 'Discrepancy not found'}
    
    discrepancy = dict(discrepancy)
    
    # Update discrepancy status
    cursor.execute("""
        UPDATE shipment_discrepancies
        SET resolution_status = %s,
            resolved_by = %s,
            resolved_date = CURRENT_TIMESTAMP,
            resolution_notes = %s,
            vendor_notified = %s,
            vendor_response = %s,
            claim_number = %s
        WHERE discrepancy_id = %s
    """, (resolution_status, employee_id, resolution_notes,
          int(vendor_notified), vendor_response, claim_number, discrepancy_id))
    
    conn.commit()
    conn.close()
    
    # Create journal entry if writing off
    if journalize and resolution_status == 'written_off':
        if discrepancy['discrepancy_type'] in ['damaged', 'missing']:
            journalize_damaged_goods(
                discrepancy_id,
                discrepancy['financial_impact'],
                employee_id
            )
    
    # Log audit action
    log_audit_action(
        table_name='shipment_discrepancies',
        record_id=discrepancy_id,
        action_type='UPDATE',
        employee_id=employee_id,
        old_values={'resolution_status': discrepancy['resolution_status']},
        new_values={'resolution_status': resolution_status},
        notes=resolution_notes
    )
    
    return {'success': True, 'message': 'Discrepancy resolved'}

def get_discrepancy_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get summary of discrepancies"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            discrepancy_type,
            resolution_status,
            COUNT(*) as count,
            SUM(financial_impact) as total_impact
        FROM shipment_discrepancies
        WHERE 1=1
    """
    params = []
    
    if start_date:
        query += " AND DATE(reported_date) >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(reported_date) <= ?"
        params.append(end_date)
    
    query += " GROUP BY discrepancy_type, resolution_status"
    
    cursor.execute(query, params)
    summary = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return summary

def get_discrepancies(
    shipment_id: Optional[int] = None,
    pending_shipment_id: Optional[int] = None,
    resolution_status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get discrepancy records with filters"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            sd.*,
            i.product_name,
            i.sku,
            e1.first_name || ' ' || e1.last_name as reported_by_name,
            e2.first_name || ' ' || e2.last_name as resolved_by_name
        FROM shipment_discrepancies sd
        JOIN inventory i ON sd.product_id = i.product_id
        JOIN employees e1 ON sd.reported_by = e1.employee_id
        LEFT JOIN employees e2 ON sd.resolved_by = e2.employee_id
        WHERE 1=1
    """
    params = []
    
    if shipment_id:
        query += " AND sd.shipment_id = %s"
        params.append(shipment_id)
    
    if pending_shipment_id:
        query += " AND sd.pending_shipment_id = %s"
        params.append(pending_shipment_id)
    
    if resolution_status:
        query += " AND sd.resolution_status = %s"
        params.append(resolution_status)
    
    query += " ORDER BY sd.reported_date DESC"
    
    cursor.execute(query, params)
    discrepancies = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return discrepancies

# ============================================================================
# FINANCIAL STATEMENT GENERATION
# ============================================================================

def generate_balance_sheet(as_of_date: Optional[str] = None) -> Dict[str, Any]:
    """Generate Balance Sheet"""
    conn = get_connection()
    cursor = conn.cursor()
    
    if not as_of_date:
        as_of_date = datetime.now().date().isoformat()
    
    cursor.execute("""
        SELECT 
            coa.account_type,
            coa.account_subtype,
            coa.account_number,
            coa.account_name,
            coa.normal_balance,
            COALESCE(SUM(
                CASE WHEN coa.normal_balance = 'debit' 
                     THEN jel.debit_amount - jel.credit_amount
                     ELSE jel.credit_amount - jel.debit_amount 
                END
            ), 0) as balance
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON coa.account_id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.journal_entry_id
        WHERE (je.posted = 1 OR je.posted IS NULL)
          AND (je.entry_date <= ? OR je.entry_date IS NULL)
          AND coa.account_type IN ('asset', 'contra_asset', 'liability', 'equity')
        GROUP BY coa.account_id
        ORDER BY 
            CASE 
                WHEN coa.account_type = 'asset' THEN 1
                WHEN coa.account_type = 'contra_asset' THEN 2
                WHEN coa.account_type = 'liability' THEN 3
                WHEN coa.account_type = 'equity' THEN 4
            END,
            coa.account_number
    """, (as_of_date,))
    
    accounts = [dict(row) for row in cursor.fetchall()]
    
    # Organize by type
    balance_sheet = {
        'assets': [],
        'liabilities': [],
        'equity': [],
        'date': as_of_date
    }
    
    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0
    
    for account in accounts:
        balance = float(account['balance']) if account['balance'] else 0.0
        
        if account['account_type'] in ['asset', 'contra_asset']:
            balance_sheet['assets'].append(account)
            if account['account_type'] == 'asset':
                total_assets += balance
            else:  # contra_asset
                total_assets -= balance
        elif account['account_type'] == 'liability':
            balance_sheet['liabilities'].append(account)
            total_liabilities += balance
        elif account['account_type'] == 'equity':
            balance_sheet['equity'].append(account)
            total_equity += balance
    
    balance_sheet['total_assets'] = total_assets
    balance_sheet['total_liabilities'] = total_liabilities
    balance_sheet['total_equity'] = total_equity
    balance_sheet['total_liabilities_and_equity'] = total_liabilities + total_equity
    
    conn.close()
    
    return balance_sheet

def generate_income_statement(start_date: str, end_date: str) -> Dict[str, Any]:
    """Generate Income Statement"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            coa.account_type,
            coa.account_subtype,
            coa.account_number,
            coa.account_name,
            coa.normal_balance,
            COALESCE(SUM(
                CASE WHEN coa.normal_balance = 'debit' 
                     THEN jel.debit_amount - jel.credit_amount
                     ELSE jel.credit_amount - jel.debit_amount 
                END
            ), 0) as balance
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON coa.account_id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.journal_entry_id
        WHERE je.posted = 1
          AND je.entry_date BETWEEN ? AND %s
          AND coa.account_type IN ('revenue', 'contra_revenue', 'expense')
        GROUP BY coa.account_id
        ORDER BY 
            CASE 
                WHEN coa.account_type = 'revenue' THEN 1
                WHEN coa.account_type = 'contra_revenue' THEN 2
                WHEN coa.account_subtype = 'cogs' THEN 3
                WHEN coa.account_type = 'expense' THEN 4
            END,
            coa.account_number
    """, (start_date, end_date))
    
    accounts = [dict(row) for row in cursor.fetchall()]
    
    income_statement = {
        'revenue': [],
        'cogs': [],
        'expenses': [],
        'period': f"{start_date} to {end_date}"
    }
    
    total_revenue = 0.0
    total_cogs = 0.0
    total_expenses = 0.0
    
    for account in accounts:
        balance = float(account['balance']) if account['balance'] else 0.0
        
        if account['account_type'] == 'revenue':
            income_statement['revenue'].append(account)
            total_revenue += balance
        elif account['account_type'] == 'contra_revenue':
            income_statement['revenue'].append(account)
            total_revenue -= balance
        elif account['account_subtype'] == 'cogs':
            income_statement['cogs'].append(account)
            total_cogs += balance
        elif account['account_type'] == 'expense':
            income_statement['expenses'].append(account)
            total_expenses += balance
    
    gross_profit = total_revenue - total_cogs
    net_income = gross_profit - total_expenses
    
    income_statement['total_revenue'] = total_revenue
    income_statement['total_cogs'] = total_cogs
    income_statement['gross_profit'] = gross_profit
    income_statement['total_expenses'] = total_expenses
    income_statement['net_income'] = net_income
    
    conn.close()
    
    return income_statement

def generate_trial_balance(as_of_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Generate Trial Balance"""
    conn = get_connection()
    cursor = conn.cursor()
    
    if not as_of_date:
        as_of_date = datetime.now().date().isoformat()
    
    cursor.execute("""
        SELECT 
            coa.account_number,
            coa.account_name,
            coa.account_type,
            COALESCE(SUM(jel.debit_amount), 0) as total_debits,
            COALESCE(SUM(jel.credit_amount), 0) as total_credits,
            COALESCE(SUM(
                CASE WHEN coa.normal_balance = 'debit' 
                     THEN jel.debit_amount - jel.credit_amount
                     ELSE jel.credit_amount - jel.debit_amount 
                END
            ), 0) as balance
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON coa.account_id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.journal_entry_id
        WHERE je.posted = 1
          AND (je.entry_date <= ? OR je.entry_date IS NULL)
        GROUP BY coa.account_id
        HAVING total_debits > 0 OR total_credits > 0
        ORDER BY coa.account_number
    """, (as_of_date,))
    
    trial_balance = [dict(row) for row in cursor.fetchall()]
    
    # Calculate totals
    total_debits = sum(float(row['total_debits']) for row in trial_balance)
    total_credits = sum(float(row['total_credits']) for row in trial_balance)
    
    conn.close()
    
    return {
        'accounts': trial_balance,
        'total_debits': total_debits,
        'total_credits': total_credits,
        'date': as_of_date
    }

def add_fiscal_period(
    period_name: str,
    start_date: str,
    end_date: str
) -> int:
    """Add a fiscal period"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO fiscal_periods (period_name, start_date, end_date)
        VALUES (%s, %s, %s)
    """, (period_name, start_date, end_date))
    
    conn.commit()
    period_id = cursor.lastrowid
    conn.close()
    
    return period_id

def calculate_retained_earnings(
    period_id: int,
    beginning_balance: float,
    dividends: float = 0.0
) -> Dict[str, Any]:
    """Calculate and record retained earnings for a period"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get period dates
    cursor.execute("""
        SELECT start_date, end_date
        FROM fiscal_periods
        WHERE period_id = %s
    """, (period_id,))
    
    period = cursor.fetchone()
    if not period:
        conn.close()
        return {'success': False, 'message': 'Period not found'}
    
    period = dict(period)
    
    # Get net income for period
    income_stmt = generate_income_statement(period['start_date'], period['end_date'])
    
    net_income = income_stmt['net_income']
    ending_balance = beginning_balance + net_income - dividends
    
    # Record retained earnings
    cursor.execute("""
        INSERT INTO retained_earnings (
            fiscal_period_id, beginning_balance, net_income,
            dividends, ending_balance
        ) VALUES (%s, %s, %s, %s, %s)
    """, (period_id, beginning_balance, net_income, dividends, ending_balance))
    
    conn.commit()
    retained_earnings_id = cursor.lastrowid
    conn.close()
    
    return {
        'success': True,
        'retained_earnings_id': retained_earnings_id,
        'beginning_balance': beginning_balance,
        'net_income': net_income,
        'dividends': dividends,
        'ending_balance': ending_balance
    }

# ============================================================================
# SHIPMENT VERIFICATION SYSTEM
# ============================================================================

def start_verification_session(pending_shipment_id: int, employee_id: int, device_id: Optional[str] = None) -> Dict[str, Any]:
    """Start a new verification session"""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        ensure_shipment_verification_tables(conn)
        
        # Ensure verification columns exist for pending_shipments
        try:
            cursor.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'pending_shipments' AND table_schema = 'public'
            """)
            columns = [col[0] for col in cursor.fetchall()]
            if 'started_by' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments
                    ADD COLUMN started_by INTEGER
                """)
                conn.commit()
                conn.rollback()
            if 'started_at' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments
                    ADD COLUMN started_at TIMESTAMP
                """)
                conn.commit()
                conn.rollback()
            if 'completed_by' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments
                    ADD COLUMN completed_by INTEGER
                """)
                conn.commit()
                conn.rollback()
            if 'completed_at' not in columns:
                cursor.execute("""
                    ALTER TABLE pending_shipments
                    ADD COLUMN completed_at TIMESTAMP
                """)
                conn.commit()
                conn.rollback()
            # Ensure status constraint allows in_progress
            cursor.execute("""
                SELECT conname, pg_get_constraintdef(c.oid)
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = 'pending_shipments' AND c.contype = 'c'
            """)
            constraints = cursor.fetchall()
            status_constraint = None
            status_definition = None
            for constraint in constraints:
                if isinstance(constraint, dict):
                    name = constraint.get('conname')
                    definition = constraint.get('pg_get_constraintdef')
                else:
                    name = constraint[0] if constraint else None
                    definition = constraint[1] if constraint and len(constraint) > 1 else None
                if definition and 'status' in definition:
                    status_constraint = name
                    status_definition = definition
                    break
            if status_definition and "'in_progress'" not in status_definition:
                cursor.execute(
                    f'ALTER TABLE pending_shipments DROP CONSTRAINT IF EXISTS "{status_constraint}"'
                )
                cursor.execute("""
                    ALTER TABLE pending_shipments
                    ADD CONSTRAINT pending_shipments_status_check
                    CHECK (status IN ('pending_review', 'in_progress', 'approved', 'rejected', 'completed_with_issues'))
                """)
                conn.commit()
                conn.rollback()
        except Exception:
            try:
                conn.rollback()
            except:
                pass
            # Best effort; continue and rely on fallback update below
        
        # Update shipment status (try with started_by/started_at if columns exist, otherwise just status)
        try:
            cursor.execute("""
                UPDATE pending_shipments 
                SET status = 'in_progress',
                    started_by = %s,
                    started_at = CURRENT_TIMESTAMP
                WHERE pending_shipment_id = %s
            """, (employee_id, pending_shipment_id))
        except Exception as e:
            # Columns might not exist, try without them
            if 'no such column' in str(e).lower() or 'does not exist' in str(e).lower() or 'undefined column' in str(e).lower():
                cursor.execute("""
                    UPDATE pending_shipments 
                    SET status = 'in_progress'
                    WHERE pending_shipment_id = %s
                """, (pending_shipment_id,))
            else:
                raise
        
        # Create session
        cursor.execute("""
            INSERT INTO verification_sessions 
            (pending_shipment_id, employee_id, device_id)
            VALUES (%s, %s, %s)
            RETURNING session_id
        """, (pending_shipment_id, employee_id, device_id))
        session_row = cursor.fetchone()
        session_id = session_row[0] if session_row else None

        # Get shipment details
        cursor.execute("""
            SELECT ps.*, v.vendor_name,
                   (SELECT COUNT(*) FROM pending_shipment_items WHERE pending_shipment_id = ps.pending_shipment_id) as total_items
            FROM pending_shipments ps
            LEFT JOIN vendors v ON ps.vendor_id = v.vendor_id
            WHERE ps.pending_shipment_id = %s
        """, (pending_shipment_id,))
        shipment_row = cursor.fetchone()
        if shipment_row and cursor.description:
            shipment = dict(zip([c[0] for c in cursor.description], shipment_row))
        else:
            shipment = None

        conn.commit()

        return {
            'session_id': session_id,
            'shipment': shipment
        }
    except Exception as e:
        if conn:
            conn.rollback()
        raise ValueError(f"Failed to start verification session: {str(e)}") from e
    finally:
        if conn:
            conn.close()

def scan_item(pending_shipment_id: int, barcode: str, employee_id: int, 
              device_id: Optional[str] = None, session_id: Optional[int] = None, 
              location: Optional[str] = None) -> Dict[str, Any]:
    """Process a scanned barcode during verification"""
    conn = get_connection()
    cursor = conn.cursor()

    ensure_shipment_verification_tables(conn)
    
    # Find matching item in pending shipment
    cursor.execute("""
        SELECT psi.*, i.product_id, i.product_name as inventory_name
        FROM pending_shipment_items psi
        LEFT JOIN inventory i ON (psi.product_sku = i.sku OR psi.barcode = i.barcode OR i.barcode = %s)
        WHERE psi.pending_shipment_id = %s 
        AND (psi.barcode = %s OR psi.product_sku = %s OR i.barcode = %s)
        AND psi.status != 'verified'
    """, (barcode, pending_shipment_id, barcode, barcode, barcode))
    row = cursor.fetchone()
    item = dict(zip([c[0] for c in cursor.description], row)) if row and cursor.description else None

    scan_result = 'unknown'
    response = {}
    pending_item_id = None

    if item:
        pending_item_id = item['pending_item_id']
        
        # Check if already fully verified
        if item.get('quantity_verified', 0) >= item.get('quantity_expected', 0):
            scan_result = 'duplicate'
            response = {
                'status': 'duplicate',
                'message': f"Item already fully verified ({item.get('quantity_expected', 0)} units)",
                'item': item
            }
        else:
            # Increment verified quantity
            new_quantity = item.get('quantity_verified', 0) + 1
            scan_result = 'match'
            
            # Determine new status
            new_status = 'verified' if new_quantity >= item.get('quantity_expected', 0) else 'pending'
            
            cursor.execute("""
                UPDATE pending_shipment_items
                SET quantity_verified = %s,
                    verified_by = %s,
                    verified_at = CURRENT_TIMESTAMP,
                    status = %s
                WHERE pending_item_id = %s
            """, (new_quantity, employee_id, new_status, item['pending_item_id']))
            
            response = {
                'status': 'success',
                'item': item,
                'quantity_verified': new_quantity,
                'quantity_expected': item.get('quantity_expected', 0),
                'remaining': item.get('quantity_expected', 0) - new_quantity,
                'fully_verified': new_quantity >= item.get('quantity_expected', 0)
            }
            
            # Update session stats if session_id provided
            if session_id:
                cursor.execute("""
                    UPDATE verification_sessions
                    SET total_scans = total_scans + 1,
                        items_verified = items_verified + 1
                    WHERE session_id = %s
                """, (session_id,))
    else:
        # Unknown item scanned
        scan_result = 'mismatch'
        response = {
            'status': 'unknown',
            'message': 'Item not found in this shipment',
            'barcode': barcode,
            'suggest_issue': True
        }
    
    # Log the scan
    cursor.execute("""
        INSERT INTO shipment_scan_log
        (pending_shipment_id, pending_item_id, scanned_barcode, 
         scanned_by, scan_result, device_id, location)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (pending_shipment_id, pending_item_id, barcode, employee_id, scan_result, device_id, location))
    
    conn.commit()
    conn.close()
    
    return response

def report_shipment_issue(pending_shipment_id: int, pending_item_id: Optional[int], 
                         issue_type: str, description: str, quantity_affected: int,
                         employee_id: int, severity: str = 'minor', 
                         photo_path: Optional[str] = None) -> int:
    """Report an issue with a shipment item"""
    conn = get_connection()
    cursor = conn.cursor()

    ensure_shipment_verification_tables(conn)
    
    # Create issue record
    cursor.execute("""
        INSERT INTO shipment_issues
        (pending_shipment_id, pending_item_id, issue_type, severity,
         quantity_affected, reported_by, description, photo_path)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING issue_id
    """, (pending_shipment_id, pending_item_id, issue_type, severity,
          quantity_affected, employee_id, description, photo_path))
    row = cursor.fetchone()
    issue_id = row[0] if row else None
    
    # Mark item as having issue if pending_item_id provided
    if pending_item_id:
        cursor.execute("""
            UPDATE pending_shipment_items
            SET status = 'issue',
                discrepancy_notes = COALESCE(discrepancy_notes || '\n', '') || 'Issue reported: ' || %s
            WHERE pending_item_id = %s
        """, (description, pending_item_id))
    
    # Update session stats
    cursor.execute("""
        UPDATE verification_sessions
        SET issues_reported = issues_reported + 1
        WHERE pending_shipment_id = %s 
        AND employee_id = %s
        AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
    """, (pending_shipment_id, employee_id))
    
    conn.commit()
    conn.close()
    
    return issue_id

def get_verification_progress(pending_shipment_id: int) -> Dict[str, Any]:
    """Get current verification progress"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass
        
        # Overall stats - calculate verified/issue status based on quantity_verified and discrepancy_notes
        cursor.execute("""
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(quantity_expected), 0) as total_expected_quantity,
                COALESCE(SUM(quantity_verified), 0) as total_verified_quantity,
                SUM(CASE 
                    WHEN COALESCE(quantity_verified, 0) >= quantity_expected 
                    THEN 1 ELSE 0 
                END) as items_fully_verified,
                SUM(CASE 
                    WHEN discrepancy_notes IS NOT NULL AND discrepancy_notes != '' 
                    THEN 1 ELSE 0 
                END) as items_with_issues
            FROM pending_shipment_items
            WHERE pending_shipment_id = %s
        """, (pending_shipment_id,))
        
        progress_row = cursor.fetchone()
        if isinstance(progress_row, dict):
            progress = dict(progress_row)
        else:
            progress = {}
        
        # Items still pending
        cursor.execute("""
            SELECT pending_item_id, product_sku, product_name, 
                   quantity_expected, COALESCE(quantity_verified, 0) as quantity_verified,
                   unit_cost, product_id, barcode, lot_number, expiration_date,
                   discrepancy_notes,
                   (quantity_expected - COALESCE(quantity_verified, 0)) as remaining
            FROM pending_shipment_items
            WHERE pending_shipment_id = %s
            ORDER BY COALESCE(line_number, pending_item_id)
        """, (pending_shipment_id,))
        
        raw_items = [dict(row) for row in cursor.fetchall()]
        # Exclude summary rows (e.g. TOTAL, SUBTOTAL from vendor sheets) — they are not verifiable line items
        _SUMMARY_SKUS = frozenset(s.strip().upper() for s in ('TOTAL', 'SUBTOTAL', 'GRAND TOTAL', 'TOTAL ITEMS'))
        pending_items = [
            it for it in raw_items
            if (it.get('product_sku') or '').strip().upper() not in _SUMMARY_SKUS
        ]
        
        # Issues - use discrepancy_notes from pending_shipment_items instead of shipment_issues table
        issues = []
        for item in pending_items:
            if item.get('discrepancy_notes'):
                issues.append({
                    'pending_item_id': item.get('pending_item_id'),
                    'product_name': item.get('product_name'),
                    'product_sku': item.get('product_sku'),
                    'notes': item.get('discrepancy_notes'),
                    'quantity_expected': item.get('quantity_expected'),
                    'quantity_verified': item.get('quantity_verified')
                })
        
        # Get shipment info
        cursor.execute("""
            SELECT pending_shipment_id, status, vendor_id
            FROM pending_shipments
            WHERE pending_shipment_id = %s
        """, (pending_shipment_id,))
        shipment_row = cursor.fetchone()
        if isinstance(shipment_row, dict):
            shipment = dict(shipment_row)
        else:
            shipment = {}
        
        # Calculate completion percentage
        total_expected = progress.get('total_expected_quantity', 0) or 0
        total_verified = progress.get('total_verified_quantity', 0) or 0
        if total_expected > 0:
            completion_pct = (total_verified / total_expected) * 100
        else:
            completion_pct = 0.0
        
        return {
            'pending_shipment_id': pending_shipment_id,
            'total_items': progress.get('total_items', 0) or 0,
            'total_expected_quantity': total_expected,
            'total_verified_quantity': total_verified,
            'items_fully_verified': progress.get('items_fully_verified', 0) or 0,
            'items_with_issues': progress.get('items_with_issues', 0) or 0,
            'completion_percentage': round(completion_pct, 2),
            'pending_items': pending_items,
            'issues': issues,
            'shipment': shipment
        }
        
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        import traceback
        traceback.print_exc()
        raise
    finally:
        # Don't close the shared global connection
        # The connection is managed by database_postgres.py
        pass
    
    # Calculate completion percentage
    if progress['total_expected_quantity']:
        completion_pct = (progress['total_verified_quantity'] / 
                        progress['total_expected_quantity'] * 100)
    else:
        completion_pct = 0
    
    return {
        'progress': progress,
        'completion_percentage': round(completion_pct, 2),
        'pending_items': pending_items,
        'issues': issues,
        'is_complete': (progress['total_verified_quantity'] >= 
                      progress['total_expected_quantity']),
        'shipment': shipment
    }

def complete_verification(pending_shipment_id: int, employee_id: int, notes: Optional[str] = None) -> Dict[str, Any]:
    """Complete verification and move to approved shipments"""
    print(f"\n{'='*60}")
    print(f"Starting completion for shipment {pending_shipment_id} (employee {employee_id})")
    print(f"{'='*60}")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get establishment_id for product creation
    establishment_id = _get_or_create_default_establishment(conn)
    print(f"✓ Using establishment_id: {establishment_id}")
    
    # Check if all items are verified or have issues
    # Allow completion if items are verified (status='verified') OR have quantity_verified >= quantity_expected
    cursor.execute("""
        SELECT COUNT(*) as unverified_count
        FROM pending_shipment_items
        WHERE pending_shipment_id = %s 
        AND status = 'pending'
        AND COALESCE(quantity_verified, 0) < quantity_expected
    """, (pending_shipment_id,))
    
    result = dict(cursor.fetchone())
    
    if result['unverified_count'] > 0:
        conn.close()
        return {
            'success': False,
            'message': f"{result['unverified_count']} items still need verification"
        }
    
    print(f"✓ All items verified for shipment {pending_shipment_id}, proceeding with completion...")
    
    # Get shipment info
    cursor.execute("""
        SELECT ps.*, 
               (SELECT COUNT(*) FROM shipment_issues WHERE pending_shipment_id = ps.pending_shipment_id) as issue_count,
               COALESCE(SUM(psi.quantity_verified), 0) as total_received,
               COALESCE(SUM(psi.quantity_verified * psi.unit_cost), 0) as total_cost
        FROM pending_shipments ps
        LEFT JOIN pending_shipment_items psi ON ps.pending_shipment_id = psi.pending_shipment_id
        WHERE ps.pending_shipment_id = %s
        GROUP BY ps.pending_shipment_id
    """, (pending_shipment_id,))
    
    shipment = dict(cursor.fetchone())
    
    # Check if approved shipment already exists (for auto-add mode)
    cursor.execute("""
        SELECT shipment_id FROM approved_shipments
        WHERE pending_shipment_id = %s
    """, (pending_shipment_id,))
    
    existing_approved = cursor.fetchone()
    if existing_approved:
        existing_approved = dict(existing_approved)
        approved_shipment_id = existing_approved['shipment_id']
        # Update totals
        cursor.execute("""
            UPDATE approved_shipments
            SET total_items_received = (
                SELECT COALESCE(SUM(quantity_received), 0) FROM approved_shipment_items
                WHERE shipment_id = %s
            ),
            total_cost = (
                SELECT COALESCE(SUM(quantity_received * unit_cost), 0) FROM approved_shipment_items
                WHERE shipment_id = %s
            ),
            approved_by = %s
            WHERE shipment_id = %s
        """, (approved_shipment_id, approved_shipment_id, employee_id, approved_shipment_id))
    else:
        # Create approved shipment
        cursor.execute("""
            INSERT INTO approved_shipments
            (pending_shipment_id, vendor_id, purchase_order_number, 
             received_date, approved_by, total_items_received, total_cost,
             has_issues, issue_count)
            VALUES (%s, %s, %s, DATE('now'), %s, %s, %s, %s, %s)
        """, (pending_shipment_id, shipment['vendor_id'], 
              shipment.get('purchase_order_number'), employee_id,
              shipment['total_received'], shipment['total_cost'],
              1 if shipment['issue_count'] > 0 else 0, shipment['issue_count']))
        
        approved_shipment_id = cursor.lastrowid
    
    vendor_id = shipment['vendor_id']
    
    # Get vendor name for new products
    cursor.execute("SELECT vendor_name FROM vendors WHERE vendor_id = %s", (vendor_id,))
    vendor_row = cursor.fetchone()
    vendor_name = vendor_row['vendor_name'] if vendor_row else None
    
    # First, ensure product_id is set for all items by matching with inventory
    # Also update barcodes for existing products that don't have one
    # Match products by SKU within the same establishment
    cursor.execute("""
        UPDATE pending_shipment_items
        SET product_id = (
            SELECT product_id FROM inventory 
            WHERE sku = pending_shipment_items.product_sku 
            AND establishment_id = %s
            LIMIT 1
        )
        WHERE pending_shipment_id = %s
        AND product_id IS NULL
        AND product_sku IS NOT NULL
        AND product_sku != ''
    """, (establishment_id, pending_shipment_id))
    
    # Extract metadata for newly matched products (that now have product_id set)
    try:
        cursor.execute("""
            SELECT DISTINCT psi.product_id
            FROM pending_shipment_items psi
            LEFT JOIN product_metadata pm ON psi.product_id = pm.product_id
            WHERE psi.pending_shipment_id = %s
            AND psi.product_id IS NOT NULL
            AND pm.metadata_id IS NULL
        """, (pending_shipment_id,))
        newly_matched_products = cursor.fetchall()
        for product_row in newly_matched_products:
            try:
                extract_metadata_for_product(product_row['product_id'], auto_sync_category=True)
            except Exception as e:
                print(f"Warning: Metadata extraction failed for matched product {product_row['product_id']}: {e}")
    except Exception as e:
        print(f"Warning: Error checking metadata for matched products: {e}")
    
    # Update barcodes for existing products that don't have one
    cursor.execute("""
        UPDATE inventory
        SET barcode = (
            SELECT barcode FROM pending_shipment_items psi
            WHERE psi.product_id = inventory.product_id
            AND psi.pending_shipment_id = %s
            AND psi.barcode IS NOT NULL AND psi.barcode != ''
            LIMIT 1
        )
        WHERE product_id IN (
            SELECT DISTINCT product_id FROM pending_shipment_items
            WHERE pending_shipment_id = %s AND product_id IS NOT NULL
        )
        AND (barcode IS NULL OR barcode = '')
    """, (pending_shipment_id, pending_shipment_id))
    
    # Create products for items that don't exist in inventory yet
    # Get the first barcode for each SKU (in case there are multiple items with same SKU)
    cursor.execute("""
        SELECT DISTINCT 
            product_sku, 
            product_name, 
            unit_cost,
            (SELECT barcode FROM pending_shipment_items psi2 
             WHERE psi2.product_sku = psi.product_sku 
             AND psi2.pending_shipment_id = psi.pending_shipment_id
             AND psi2.barcode IS NOT NULL AND psi2.barcode != ''
             LIMIT 1) as barcode
        FROM pending_shipment_items psi
        WHERE psi.pending_shipment_id = %s
        AND psi.product_id IS NULL
        AND psi.product_sku IS NOT NULL
        AND psi.product_sku != ''
        AND COALESCE(psi.quantity_verified, 0) > 0
    """, (pending_shipment_id,))
    
    items_to_create = cursor.fetchall()
    
    for item in items_to_create:
        sku = item['product_sku']
        if not sku or not sku.strip():
            continue  # Skip items with empty SKU
        
        sku = sku.strip()
        product_name = item['product_name'] or f'Product {sku}'
        unit_cost = item['unit_cost'] or 0.0
        barcode = item.get('barcode') or None
        
        try:
            # Check if product already exists (in case it was just created)
            cursor.execute("SELECT product_id, barcode FROM inventory WHERE sku = %s AND establishment_id = %s", (sku, establishment_id))
            existing = cursor.fetchone()
            if existing:
                new_product_id = existing['product_id']
                # Update barcode if product doesn't have one and we have one from shipment
                if (not existing['barcode'] or existing['barcode'].strip() == '') and barcode:
                    cursor.execute("""
                        UPDATE inventory 
                        SET barcode = %s
                        WHERE product_id = %s
                    """, (barcode, new_product_id))
                
                # Extract metadata if product doesn't have it yet
                try:
                    cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = %s", (new_product_id,))
                    has_metadata = cursor.fetchone()
                    if not has_metadata:
                        # Product exists but has no metadata - extract it
                        extract_metadata_for_product(new_product_id, auto_sync_category=True)
                except Exception as e:
                    print(f"Warning: Metadata check/extraction failed for existing product {new_product_id}: {e}")
            else:
                # Create new product in inventory with barcode
                cursor.execute("""
                    INSERT INTO inventory 
                    (establishment_id, product_name, sku, barcode, product_price, product_cost, vendor, vendor_id, current_quantity, category)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, NULL)
                    RETURNING product_id
                """, (establishment_id, product_name, sku, barcode, unit_cost, unit_cost, vendor_name, vendor_id))
                
                result = cursor.fetchone()
                if isinstance(result, dict):
                    new_product_id = result.get('product_id')
                else:
                    new_product_id = result[0] if result else None
                
                if not new_product_id:
                    print(f"⚠ ERROR: Failed to get product_id after creating product for SKU {sku}")
                    continue
                
                print(f"✓ Created new product {new_product_id} for SKU {sku} ({product_name})")
                
                # Automatically extract metadata and assign category with hierarchy
                try:
                    extract_metadata_for_product(new_product_id, auto_sync_category=True)
                    print(f"✓ Extracted metadata for new product {new_product_id} ({product_name})")
                except Exception as e:
                    print(f"⚠ Warning: Metadata extraction failed for product {new_product_id} (SKU: {sku}): {e}")
                    import traceback
                    traceback.print_exc()
                    # Continue even if metadata extraction fails
            
            # Update pending_shipment_items with the new product_id
            cursor.execute("""
                UPDATE pending_shipment_items
                SET product_id = %s
                WHERE pending_shipment_id = %s
                AND product_sku = %s
                AND product_id IS NULL
            """, (new_product_id, pending_shipment_id, sku))
            print(f"✓ Updated {cursor.rowcount} pending_shipment_items with product_id {new_product_id} for SKU {sku}")
        except Exception as e:
            # Log error but continue with other items
            print(f"Error creating product for SKU {sku}: {e}")
            import traceback
            traceback.print_exc()
            # Don't rollback here, just continue - other items might succeed
            continue
    
    # Transfer verified items to approved shipment items (only if not already added in auto-add mode)
    cursor.execute("""
        INSERT INTO approved_shipment_items
        (shipment_id, product_id, quantity_received, unit_cost, 
         lot_number, expiration_date, received_by)
        SELECT 
            %s,
            psi.product_id,
            COALESCE(psi.quantity_verified, 0),
            psi.unit_cost,
            psi.lot_number,
            psi.expiration_date,
            %s
        FROM pending_shipment_items psi
        WHERE psi.pending_shipment_id = %s
        AND COALESCE(psi.quantity_verified, 0) > 0
        AND psi.product_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM approved_shipment_items asi
            WHERE asi.shipment_id = %s AND asi.product_id = psi.product_id
        )
    """, (approved_shipment_id, employee_id, pending_shipment_id, approved_shipment_id))
    
    # Check verification mode - in auto-add mode, items are already added to inventory
    cursor.execute("""
        SELECT verification_mode FROM pending_shipments
        WHERE pending_shipment_id = %s
    """, (pending_shipment_id,))
    mode_result = cursor.fetchone()
    verification_mode = mode_result['verification_mode'] if mode_result else 'verify_whole_shipment'
    
    # Update inventory quantities and vendor_id for all verified items (only if not auto-add mode)
    if verification_mode != 'auto_add':
        # Get all verified items with their product_ids
        # First, try to match any items that still don't have product_id
        cursor.execute("""
            UPDATE pending_shipment_items
            SET product_id = (
                SELECT product_id FROM inventory 
                WHERE sku = pending_shipment_items.product_sku 
                AND establishment_id = %s
                LIMIT 1
            )
            WHERE pending_shipment_id = %s
            AND product_id IS NULL
            AND product_sku IS NOT NULL
            AND product_sku != ''
        """, (establishment_id, pending_shipment_id))
        
        # Get all verified items with their product_ids
        cursor.execute("""
            SELECT product_id, SUM(quantity_verified) as total_quantity
            FROM pending_shipment_items
            WHERE pending_shipment_id = %s
            AND product_id IS NOT NULL
            AND COALESCE(quantity_verified, 0) > 0
            GROUP BY product_id
        """, (pending_shipment_id,))
        
        items_to_update = cursor.fetchall()
        
        # Update inventory for each product - set vendor_id and update quantity
        inventory_updates = 0
        for item in items_to_update:
            product_id = item['product_id']
            quantity = item['total_quantity']
            try:
                cursor.execute("""
                    UPDATE inventory
                    SET current_quantity = current_quantity + %s,
                        vendor_id = %s,
                        vendor = %s,
                        last_restocked = CURRENT_TIMESTAMP
                    WHERE product_id = %s
                """, (quantity, vendor_id, vendor_name, product_id))
                if cursor.rowcount > 0:
                    inventory_updates += 1
                    print(f"✓ Added {quantity} units of product {product_id} to inventory")
                else:
                    print(f"⚠ Warning: Product {product_id} not found in inventory - skipping quantity update")
            except Exception as e:
                print(f"⚠ Error updating inventory for product {product_id}: {e}")
                import traceback
                traceback.print_exc()
                # Continue with other items even if one fails
        
        # Check for items that still don't have product_id but have verified quantity
        cursor.execute("""
            SELECT COUNT(*) as unmatched_count
            FROM pending_shipment_items
            WHERE pending_shipment_id = %s
            AND product_id IS NULL
            AND COALESCE(quantity_verified, 0) > 0
            AND (product_sku IS NULL OR product_sku = '')
        """, (pending_shipment_id,))
        unmatched = cursor.fetchone()
        if unmatched and unmatched['unmatched_count'] > 0:
            print(f"⚠ Warning: {unmatched['unmatched_count']} verified items have no SKU and cannot be added to inventory")
        
        print(f"✓ Updated inventory for {inventory_updates} products")
    
    # Update pending shipment status
    status = 'completed_with_issues' if shipment['issue_count'] > 0 else 'approved'
    cursor.execute("""
        UPDATE pending_shipments
        SET status = %s,
            completed_by = %s,
            completed_at = CURRENT_TIMESTAMP,
            notes = COALESCE(notes || '\n', '') || COALESCE(%s, '')
        WHERE pending_shipment_id = %s
    """, (status, employee_id, notes, pending_shipment_id))
    
    # End any open verification sessions
    cursor.execute("""
        UPDATE verification_sessions
        SET ended_at = CURRENT_TIMESTAMP
        WHERE pending_shipment_id = %s AND ended_at IS NULL
    """, (pending_shipment_id,))
    
    conn.commit()
    conn.close()
    
    print(f"✓ Shipment {pending_shipment_id} completed successfully!")
    print(f"  - Approved shipment ID: {approved_shipment_id}")
    print(f"  - Total items: {shipment['total_received']}")
    print(f"  - Total cost: ${float(shipment['total_cost']):.2f}")
    print(f"  - Issues: {shipment['issue_count']}")
    
    return {
        'success': True,
        'approved_shipment_id': approved_shipment_id,
        'total_items': shipment['total_received'],
        'total_cost': float(shipment['total_cost']),
        'has_issues': shipment['issue_count'] > 0,
        'issue_count': shipment['issue_count']
    }

def get_pending_shipments_with_progress(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get list of pending shipments with verification progress"""
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass  # Ignore if already rolled back or no transaction
        
        # Check if pending_shipments table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pending_shipments'
            )
        """)
        table_exists = cursor.fetchone()
        if isinstance(table_exists, dict):
            table_exists = table_exists.get('exists', False)
        else:
            table_exists = table_exists[0] if table_exists else False
        
        if not table_exists:
            # Table doesn't exist, return empty list
            return []
        
        # Use a subquery approach to handle GROUP BY properly with ps.*
        base_query = """
            SELECT 
                ps.pending_shipment_id,
                ps.establishment_id,
                ps.vendor_id,
                ps.expected_date,
                ps.upload_timestamp,
                ps.file_path,
                ps.purchase_order_number,
                ps.tracking_number,
                ps.status,
                ps.uploaded_by,
                ps.approved_by,
                ps.approved_date,
                ps.reviewed_by,
                ps.reviewed_date,
                ps.notes,
                ps.started_by,
                v.vendor_name,
                e1.first_name || ' ' || e1.last_name as uploaded_by_name,
                e2.first_name || ' ' || e2.last_name as started_by_name,
                COALESCE(item_stats.total_items, 0) as total_items,
                COALESCE(item_stats.total_expected, 0) as total_expected,
                COALESCE(item_stats.total_verified, 0) as total_verified,
                COALESCE(issue_stats.issue_count, 0) as issue_count,
                CASE 
                    WHEN COALESCE(item_stats.total_expected, 0) > 0 
                    THEN ROUND((COALESCE(item_stats.total_verified, 0) * 100.0 / item_stats.total_expected), 2)
                    ELSE 0
                END as progress_percentage
            FROM pending_shipments ps
            JOIN vendors v ON ps.vendor_id = v.vendor_id
            LEFT JOIN employees e1 ON ps.uploaded_by = e1.employee_id
            LEFT JOIN employees e2 ON ps.started_by = e2.employee_id
            LEFT JOIN (
                SELECT 
                    pending_shipment_id,
                    COUNT(DISTINCT pending_item_id) as total_items,
                    COALESCE(SUM(quantity_expected), 0) as total_expected,
                    COALESCE(SUM(quantity_verified), 0) as total_verified
                FROM pending_shipment_items
                GROUP BY pending_shipment_id
            ) item_stats ON ps.pending_shipment_id = item_stats.pending_shipment_id
            LEFT JOIN (
                SELECT 
                    pending_shipment_id,
                    COUNT(*) as issue_count
                FROM pending_shipment_items
                WHERE discrepancy_notes IS NOT NULL AND discrepancy_notes != ''
                GROUP BY pending_shipment_id
            ) issue_stats ON ps.pending_shipment_id = issue_stats.pending_shipment_id
        """
        
        if status:
            base_query += " WHERE ps.status = %s"
            base_query += " ORDER BY ps.upload_timestamp DESC"
            cursor.execute(base_query, (status,))
        else:
            base_query += " ORDER BY ps.upload_timestamp DESC"
            cursor.execute(base_query)
        
        shipments = [dict(row) for row in cursor.fetchall()]
        
        # Ensure progress_percentage is a number (not string)
        for shipment in shipments:
            if 'progress_percentage' in shipment:
                try:
                    shipment['progress_percentage'] = float(shipment['progress_percentage']) if shipment['progress_percentage'] is not None else 0.0
                except (ValueError, TypeError):
                    shipment['progress_percentage'] = 0.0
        
        return shipments
    except Exception as e:
        import traceback
        traceback.print_exc()
        if conn:
            try:
                conn.rollback()
            except:
                pass
        # If table doesn't exist, return empty list instead of raising
        if "does not exist" in str(e) or "UndefinedTable" in str(type(e).__name__):
            return []
        raise
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

def get_shipment_items(pending_shipment_id: int) -> List[Dict[str, Any]]:
    """Get all items in a shipment with verification status"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT psi.*,
               (psi.quantity_expected - COALESCE(psi.quantity_verified, 0)) as remaining,
               CASE 
                   WHEN COALESCE(psi.quantity_verified, 0) >= psi.quantity_expected THEN 'complete'
                   WHEN COALESCE(psi.quantity_verified, 0) > 0 THEN 'partial'
                   ELSE 'not_started'
               END as verification_status
        FROM pending_shipment_items psi
        WHERE psi.pending_shipment_id = %s
        ORDER BY COALESCE(psi.line_number, psi.pending_item_id)
    """, (pending_shipment_id,))
    
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return items

def create_shipment_from_document(
    file_path: str,
    vendor_id: int,
    purchase_order_number: Optional[str] = None,
    expected_delivery_date: Optional[str] = None,
    uploaded_by: Optional[int] = None,
    column_mapping: Optional[Dict[str, str]] = None,
    verification_mode: str = 'verify_whole_shipment'
) -> Dict[str, Any]:
    """
    Create a pending shipment from a scraped vendor document
    
    Args:
        file_path: Path to the uploaded document
        vendor_id: Vendor ID
        purchase_order_number: Optional PO number
        expected_delivery_date: Optional expected delivery date
        uploaded_by: Employee ID who uploaded
        column_mapping: Optional column mapping for document scraping
        verification_mode: 'auto_add' or 'verify_whole_shipment' (default)
    
    Returns:
        Dictionary with pending_shipment_id and items created
    """
    from document_scraper import scrape_document
    
    # Scrape the document
    try:
        items = scrape_document(file_path, column_mapping)
    except Exception as e:
        return {
            'success': False,
            'message': f'Error scraping document: {str(e)}'
        }
    
    if not items:
        return {
            'success': False,
            'message': 'No items found in document'
        }
    
    # Create pending shipment
    try:
        pending_shipment_id = create_pending_shipment(
            vendor_id=vendor_id,
            file_path=file_path,
            expected_date=expected_delivery_date,
            purchase_order_number=purchase_order_number,
            uploaded_by=uploaded_by,
            verification_mode=verification_mode
        )
    except Exception as e:
        return {
            'success': False,
            'message': f'Error creating pending shipment: {str(e)}'
        }
    
    # Add items to pending shipment
    items_added = 0
    total_expected = 0
    total_cost = 0.0
    
    for idx, item in enumerate(items):
        try:
            # Auto-generate barcode if not provided
            barcode = item.get('barcode')
            if not barcode or barcode.strip() == '':
                barcode = generate_unique_barcode(
                    pending_shipment_id=pending_shipment_id,
                    line_number=idx + 1,
                    product_sku=item.get('product_sku', '')
                )
            
            add_pending_shipment_item(
                pending_shipment_id=pending_shipment_id,
                product_sku=item.get('product_sku', ''),
                product_name=item.get('product_name'),
                quantity_expected=item.get('quantity_expected', 0),
                unit_cost=item.get('unit_cost', 0.0),
                lot_number=item.get('lot_number'),
                expiration_date=item.get('expiration_date'),
                barcode=barcode,
                line_number=idx + 1
            )
            items_added += 1
            total_expected += item.get('quantity_expected', 0)
            total_cost += item.get('quantity_expected', 0) * item.get('unit_cost', 0.0)
        except Exception as e:
            print(f"Error adding item {idx}: {e}")
            continue
    
    # Update shipment totals (only update columns that exist)
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Ensure connection is in a good state
        try:
            conn.rollback()
        except:
            pass
        
        # Check which columns exist
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'pending_shipments' AND table_schema = 'public'")
        column_rows = cursor.fetchall()
        if column_rows and isinstance(column_rows[0], dict):
            columns = [row.get('column_name') for row in column_rows]
        else:
            columns = [row[0] for row in column_rows]
        
        # Build UPDATE query with only existing columns
        updates = []
        values = []
        
        if 'total_expected_items' in columns:
            updates.append("total_expected_items = %s")
            values.append(items_added)
        
        if 'total_expected_cost' in columns:
            updates.append("total_expected_cost = %s")
            values.append(total_cost)
        
        if 'document_path' in columns:
            updates.append("document_path = %s")
            values.append(file_path)
        elif 'file_path' in columns:
            # Use file_path if document_path doesn't exist
            updates.append("file_path = %s")
            values.append(file_path)
        
        updates.append("status = %s")
        values.append('in_progress')
        
        values.append(pending_shipment_id)
        
        if updates:
            query = f"UPDATE pending_shipments SET {', '.join(updates)} WHERE pending_shipment_id = %s"
            cursor.execute(query, tuple(values))
            conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        import traceback
        traceback.print_exc()
        # Don't fail the whole operation if update fails
        print(f"Warning: Failed to update shipment totals: {e}")
    finally:
        try:
            conn.close()
        except:
            pass
    
    return {
        'success': True,
        'pending_shipment_id': pending_shipment_id,
        'items_added': items_added,
        'total_expected': total_expected,
        'total_cost': float(total_cost)
    }

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth using Haversine formula
    Returns distance in meters
    """
    # Earth radius in meters
    R = 6371000
    
    # Convert to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance

def get_store_location_settings() -> Optional[Dict[str, Any]]:
    """Get store location settings"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM store_location_settings 
        ORDER BY id DESC 
        LIMIT 1
    """)
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return dict(row)

def update_store_location_settings(
    store_name: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    address: Optional[str] = None,
    allowed_radius_meters: Optional[float] = None,
    require_location: Optional[int] = None
) -> bool:
    """Update store location settings"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if settings exist
        cursor.execute("SELECT COUNT(*) FROM store_location_settings")
        count = cursor.fetchone()[0]
        
        if count == 0:
            # Create new settings
            cursor.execute("""
                INSERT INTO store_location_settings (
                    store_name, latitude, longitude, address, 
                    allowed_radius_meters, require_location
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                store_name or 'Store',
                latitude,
                longitude,
                address,
                allowed_radius_meters or 100.0,
                require_location if require_location is not None else 1
            ))
        else:
            # Update existing settings
            updates = []
            params = []
            
            if store_name is not None:
                updates.append("store_name = %s")
                params.append(store_name)
            if latitude is not None:
                updates.append("latitude = %s")
                params.append(latitude)
            if longitude is not None:
                updates.append("longitude = %s")
                params.append(longitude)
            if address is not None:
                updates.append("address = %s")
                params.append(address)
            if allowed_radius_meters is not None:
                updates.append("allowed_radius_meters = %s")
                params.append(allowed_radius_meters)
            if require_location is not None:
                updates.append("require_location = %s")
                params.append(require_location)
            
            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                
                query = f"""
                    UPDATE store_location_settings 
                    SET {', '.join(updates)}
                    WHERE id = (SELECT id FROM store_location_settings ORDER BY id DESC LIMIT 1)
                """
                cursor.execute(query, params)
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error updating store location settings: {e}")
        return False

def validate_location(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    Validate if a location is within the allowed radius of the store
    Returns dict with 'valid' (bool), 'message' (str), and 'distance' (float in meters)
    """
    settings = get_store_location_settings()
    
    if not settings:
        # No location settings configured, allow all locations
        return {
            'valid': True,
            'message': 'Location settings not configured',
            'distance': None
        }
    
    # Check if location verification is required
    if settings.get('require_location', 1) == 0:
        return {
            'valid': True,
            'message': 'Location verification is disabled',
            'distance': None
        }
    
    store_lat = settings.get('latitude')
    store_lon = settings.get('longitude')
    allowed_radius = settings.get('allowed_radius_meters', 100.0)
    
    if store_lat is None or store_lon is None:
        return {
            'valid': True,
            'message': 'Store location not set',
            'distance': None
        }
    
    # Calculate distance
    distance = haversine_distance(store_lat, store_lon, latitude, longitude)
    
    if distance <= allowed_radius:
        return {
            'valid': True,
            'message': f'Location verified (within {distance:.0f}m of store)',
            'distance': distance
        }
    else:
        return {
            'valid': False,
            'message': f'Location too far from store ({distance:.0f}m away, allowed: {allowed_radius:.0f}m)',
            'distance': distance
        }

def get_customer_rewards_settings() -> Optional[Dict[str, Any]]:
    """Get customer rewards settings"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create table if it doesn't exist
    cursor.execute("""
            CREATE TABLE IF NOT EXISTS customer_rewards_settings (
            id SERIAL PRIMARY KEY,
            enabled INTEGER DEFAULT 0 CHECK(enabled IN (0, 1)),
            require_email INTEGER DEFAULT 0 CHECK(require_email IN (0, 1)),
            require_phone INTEGER DEFAULT 0 CHECK(require_phone IN (0, 1)),
            require_both INTEGER DEFAULT 0 CHECK(require_both IN (0, 1)),
            reward_type TEXT DEFAULT 'points' CHECK(reward_type IN ('points', 'percentage', 'fixed')),
            points_per_dollar REAL DEFAULT 1.0 CHECK(points_per_dollar >= 0),
            percentage_discount REAL DEFAULT 0.0 CHECK(percentage_discount >= 0 AND percentage_discount <= 100),
            fixed_discount REAL DEFAULT 0.0 CHECK(fixed_discount >= 0),
            minimum_spend REAL DEFAULT 0.0 CHECK(minimum_spend >= 0),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    
    cursor.execute("""
        SELECT * FROM customer_rewards_settings 
        ORDER BY id DESC 
        LIMIT 1
    """)
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        # Return defaults if no settings exist
        return {
            'enabled': 0,
            'require_email': 0,
            'require_phone': 0,
            'require_both': 0,
            'reward_type': 'points',
            'points_per_dollar': 1.0,
            'percentage_discount': 0.0,
            'fixed_discount': 0.0,
            'minimum_spend': 0.0
        }
    
    return dict(row)

def update_customer_rewards_settings(**kwargs) -> bool:
    """Update customer rewards settings"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Create table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customer_rewards_settings (
            id SERIAL PRIMARY KEY,
                enabled INTEGER DEFAULT 0 CHECK(enabled IN (0, 1)),
                require_email INTEGER DEFAULT 0 CHECK(require_email IN (0, 1)),
                require_phone INTEGER DEFAULT 0 CHECK(require_phone IN (0, 1)),
                require_both INTEGER DEFAULT 0 CHECK(require_both IN (0, 1)),
                reward_type TEXT DEFAULT 'points' CHECK(reward_type IN ('points', 'percentage', 'fixed')),
                points_per_dollar REAL DEFAULT 1.0 CHECK(points_per_dollar >= 0),
                percentage_discount REAL DEFAULT 0.0 CHECK(percentage_discount >= 0 AND percentage_discount <= 100),
                fixed_discount REAL DEFAULT 0.0 CHECK(fixed_discount >= 0),
                minimum_spend REAL DEFAULT 0.0 CHECK(minimum_spend >= 0),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        
        # Check if settings exist
        cursor.execute("SELECT COUNT(*) FROM customer_rewards_settings")
        count = cursor.fetchone()[0]
        
        allowed_fields = [
            'enabled', 'require_email', 'require_phone', 'require_both',
            'reward_type', 'points_per_dollar', 'percentage_discount',
            'fixed_discount', 'minimum_spend'
        ]
        
        if count == 0:
            # Create new settings with defaults
            insert_fields = []
            insert_placeholders = []
            insert_values = []
            
            defaults = {
                'enabled': 0,
                'require_email': 0,
                'require_phone': 0,
                'require_both': 0,
                'reward_type': 'points',
                'points_per_dollar': 1.0,
                'percentage_discount': 0.0,
                'fixed_discount': 0.0,
                'minimum_spend': 0.0
            }
            
            for field in allowed_fields:
                insert_fields.append(field)
                insert_placeholders.append('?')
                insert_values.append(kwargs.get(field, defaults.get(field)))
            
            cursor.execute(f"""
                INSERT INTO customer_rewards_settings ({', '.join(insert_fields)})
                VALUES ({', '.join(insert_placeholders)})
            """, insert_values)
        else:
            # Update existing settings
            updates = []
            params = []
            
            for field in allowed_fields:
                if field in kwargs:
                    updates.append(f"{field} = %s")
                    params.append(kwargs[field])
            
            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                cursor.execute(f"""
                    UPDATE customer_rewards_settings 
                    SET {', '.join(updates)}
                    WHERE id = (SELECT id FROM customer_rewards_settings ORDER BY id DESC LIMIT 1)
                """, params)
        
        conn.commit()
        return True
    except Exception as e:
        print(f"Error updating customer rewards settings: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        conn.close()

def calculate_rewards(amount_spent: float, settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Calculate rewards based on amount spent and settings
    
    Returns: dict with 'points_earned', 'discount_amount', 'reward_type'
    """
    if settings is None:
        settings = get_customer_rewards_settings()
    
    if not settings.get('enabled'):
        return {'points_earned': 0, 'discount_amount': 0.0, 'reward_type': settings.get('reward_type', 'points')}
    
    minimum_spend = settings.get('minimum_spend', 0.0)
    if amount_spent < minimum_spend:
        return {'points_earned': 0, 'discount_amount': 0.0, 'reward_type': settings.get('reward_type', 'points')}
    
    reward_type = settings.get('reward_type', 'points')
    
    if reward_type == 'points':
        points_per_dollar = settings.get('points_per_dollar', 1.0)
        points_earned = int(amount_spent * points_per_dollar)
        return {'points_earned': points_earned, 'discount_amount': 0.0, 'reward_type': 'points'}
    elif reward_type == 'percentage':
        percentage = settings.get('percentage_discount', 0.0)
        discount_amount = amount_spent * (percentage / 100.0)
        return {'points_earned': 0, 'discount_amount': discount_amount, 'reward_type': 'percentage'}
    elif reward_type == 'fixed':
        fixed_discount = settings.get('fixed_discount', 0.0)
        return {'points_earned': 0, 'discount_amount': fixed_discount, 'reward_type': 'fixed'}
    
    return {'points_earned': 0, 'discount_amount': 0.0, 'reward_type': reward_type}

# ============================================================================
# STRIPE INTEGRATION FUNCTIONS
# ============================================================================

def get_payment_settings(store_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Get payment settings for store (or default if single store)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        if store_id:
            cursor.execute("""
                SELECT * FROM payment_settings 
                WHERE store_id = %s
                ORDER BY setting_id DESC 
                LIMIT 1
            """, (store_id,))
        else:
            cursor.execute("""
                SELECT * FROM payment_settings 
                ORDER BY setting_id DESC 
                LIMIT 1
            """)
    except Exception as e:
        # Table doesn't exist - return None
        conn.close()
        return None
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return dict(row)

def update_payment_settings(
    store_id: Optional[int] = None,
    payment_processor: Optional[str] = None,
    stripe_account_id: Optional[int] = None,
    stripe_credential_id: Optional[int] = None,
    default_currency: Optional[str] = None,
    transaction_fee_rate: Optional[float] = None,
    transaction_fee_fixed: Optional[float] = None,
    enabled_payment_methods: Optional[str] = None,
    require_cvv: Optional[int] = None,
    require_zip: Optional[int] = None,
    auto_capture: Optional[int] = None
) -> bool:
    """Update payment settings"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Create payment_settings table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payment_settings (
                setting_id SERIAL PRIMARY KEY,
                store_id INTEGER,
                payment_processor TEXT DEFAULT 'cash_only',
                stripe_account_id INTEGER,
                stripe_credential_id INTEGER,
                default_currency TEXT DEFAULT 'usd',
                transaction_fee_rate REAL DEFAULT 0.029,
                transaction_fee_fixed REAL DEFAULT 0.30,
                enabled_payment_methods TEXT DEFAULT '["cash"]',
                require_cvv INTEGER DEFAULT 1 CHECK(require_cvv IN (0, 1)),
                require_zip INTEGER DEFAULT 0 CHECK(require_zip IN (0, 1)),
                auto_capture INTEGER DEFAULT 1 CHECK(auto_capture IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        
        # Check if settings exist
        if store_id:
            cursor.execute("SELECT COUNT(*) FROM payment_settings WHERE store_id = %s", (store_id,))
        else:
            cursor.execute("SELECT COUNT(*) FROM payment_settings")
        count = cursor.fetchone()[0]
        
        if count == 0:
            # Create new settings
            cursor.execute("""
                INSERT INTO payment_settings (
                    store_id, payment_processor, stripe_account_id, stripe_credential_id,
                    default_currency, transaction_fee_rate, transaction_fee_fixed,
                    enabled_payment_methods, require_cvv, require_zip, auto_capture
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                store_id,
                payment_processor or 'cash_only',
                stripe_account_id,
                stripe_credential_id,
                default_currency or 'usd',
                transaction_fee_rate or 0.029,
                transaction_fee_fixed or 0.30,
                enabled_payment_methods or '["cash"]',
                require_cvv if require_cvv is not None else 1,
                require_zip if require_zip is not None else 0,
                auto_capture if auto_capture is not None else 1
            ))
        else:
            # Update existing settings
            updates = []
            params = []
            
            if payment_processor is not None:
                updates.append("payment_processor = %s")
                params.append(payment_processor)
            if stripe_account_id is not None:
                updates.append("stripe_account_id = %s")
                params.append(stripe_account_id)
            if stripe_credential_id is not None:
                updates.append("stripe_credential_id = %s")
                params.append(stripe_credential_id)
            if default_currency is not None:
                updates.append("default_currency = %s")
                params.append(default_currency)
            if transaction_fee_rate is not None:
                updates.append("transaction_fee_rate = %s")
                params.append(transaction_fee_rate)
            if transaction_fee_fixed is not None:
                updates.append("transaction_fee_fixed = %s")
                params.append(transaction_fee_fixed)
            if enabled_payment_methods is not None:
                updates.append("enabled_payment_methods = %s")
                params.append(enabled_payment_methods)
            if require_cvv is not None:
                updates.append("require_cvv = %s")
                params.append(require_cvv)
            if require_zip is not None:
                updates.append("require_zip = %s")
                params.append(require_zip)
            if auto_capture is not None:
                updates.append("auto_capture = %s")
                params.append(auto_capture)
            
            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                
                if store_id:
                    query = f"""
                        UPDATE payment_settings 
                        SET {', '.join(updates)}
                        WHERE store_id = %s
                    """
                    params.append(store_id)
                else:
                    query = f"""
                        UPDATE payment_settings 
                        SET {', '.join(updates)}
                        WHERE setting_id = (SELECT setting_id FROM payment_settings ORDER BY setting_id DESC LIMIT 1)
                    """
                
                cursor.execute(query, params)
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        import traceback
        traceback.print_exc()
        print(f"Error updating payment settings: {e}")
        return False

def create_stripe_connect_account(
    store_id: Optional[int] = None,
    account_type: str = 'express',
    email: Optional[str] = None,
    country: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Create a Stripe Connect account record"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO stripe_accounts (
                store_id, stripe_account_type, email, country
            ) VALUES (%s, %s, %s, %s)
        """, (store_id, account_type, email, country))
        
        account_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {'stripe_account_id': account_id, 'success': True}
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error creating Stripe Connect account: {e}")
        return None

def update_stripe_connect_account(
    stripe_account_id: int,
    stripe_connected_account_id: Optional[str] = None,
    stripe_publishable_key: Optional[str] = None,
    stripe_access_token_encrypted: Optional[str] = None,
    stripe_refresh_token_encrypted: Optional[str] = None,
    onboarding_completed: Optional[int] = None,
    onboarding_link: Optional[str] = None,
    onboarding_link_expires_at: Optional[str] = None,
    charges_enabled: Optional[int] = None,
    payouts_enabled: Optional[int] = None,
    country: Optional[str] = None,
    email: Optional[str] = None,
    business_type: Optional[str] = None
) -> bool:
    """Update Stripe Connect account"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        updates = []
        params = []
        
        if stripe_connected_account_id is not None:
            updates.append("stripe_connected_account_id = %s")
            params.append(stripe_connected_account_id)
        if stripe_publishable_key is not None:
            updates.append("stripe_publishable_key = %s")
            params.append(stripe_publishable_key)
        if stripe_access_token_encrypted is not None:
            updates.append("stripe_access_token_encrypted = %s")
            params.append(stripe_access_token_encrypted)
        if stripe_refresh_token_encrypted is not None:
            updates.append("stripe_refresh_token_encrypted = %s")
            params.append(stripe_refresh_token_encrypted)
        if onboarding_completed is not None:
            updates.append("onboarding_completed = %s")
            params.append(onboarding_completed)
        if onboarding_link is not None:
            updates.append("onboarding_link = %s")
            params.append(onboarding_link)
        if onboarding_link_expires_at is not None:
            updates.append("onboarding_link_expires_at = %s")
            params.append(onboarding_link_expires_at)
        if charges_enabled is not None:
            updates.append("charges_enabled = %s")
            params.append(charges_enabled)
        if payouts_enabled is not None:
            updates.append("payouts_enabled = %s")
            params.append(payouts_enabled)
        if country is not None:
            updates.append("country = %s")
            params.append(country)
        if email is not None:
            updates.append("email = %s")
            params.append(email)
        if business_type is not None:
            updates.append("business_type = %s")
            params.append(business_type)
        
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(stripe_account_id)
            
            query = f"""
                UPDATE stripe_accounts 
                SET {', '.join(updates)}
                WHERE stripe_account_id = %s
            """
            cursor.execute(query, params)
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error updating Stripe Connect account: {e}")
        return False

def get_stripe_connect_account(stripe_account_id: int) -> Optional[Dict[str, Any]]:
    """Get Stripe Connect account by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM stripe_accounts 
        WHERE stripe_account_id = %s
    """, (stripe_account_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return dict(row)

def create_stripe_credentials(
    store_id: Optional[int] = None,
    stripe_publishable_key: str = '',
    stripe_secret_key_encrypted: str = '',
    webhook_secret_encrypted: Optional[str] = None,
    test_mode: int = 0
) -> Optional[Dict[str, Any]]:
    """Create Stripe credentials record (for direct API keys)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO stripe_credentials (
                store_id, stripe_publishable_key, stripe_secret_key_encrypted,
                webhook_secret_encrypted, test_mode
            ) VALUES (%s, %s, %s, %s, %s)
        """, (store_id, stripe_publishable_key, stripe_secret_key_encrypted, 
              webhook_secret_encrypted, test_mode))
        
        credential_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {'credential_id': credential_id, 'success': True}
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error creating Stripe credentials: {e}")
        return None

def update_stripe_credentials(
    credential_id: int,
    stripe_publishable_key: Optional[str] = None,
    stripe_secret_key_encrypted: Optional[str] = None,
    webhook_secret_encrypted: Optional[str] = None,
    test_mode: Optional[int] = None,
    verified: Optional[int] = None
) -> bool:
    """Update Stripe credentials"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        updates = []
        params = []
        
        if stripe_publishable_key is not None:
            updates.append("stripe_publishable_key = %s")
            params.append(stripe_publishable_key)
        if stripe_secret_key_encrypted is not None:
            updates.append("stripe_secret_key_encrypted = %s")
            params.append(stripe_secret_key_encrypted)
        if webhook_secret_encrypted is not None:
            updates.append("webhook_secret_encrypted = %s")
            params.append(webhook_secret_encrypted)
        if test_mode is not None:
            updates.append("test_mode = %s")
            params.append(test_mode)
        if verified is not None:
            updates.append("verified = %s")
            params.append(verified)
            updates.append("last_verified_at = CURRENT_TIMESTAMP")
        
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(credential_id)
            
            query = f"""
                UPDATE stripe_credentials 
                SET {', '.join(updates)}
                WHERE credential_id = %s
            """
            cursor.execute(query, params)
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error updating Stripe credentials: {e}")
        return False

def get_stripe_credentials(credential_id: int) -> Optional[Dict[str, Any]]:
    """Get Stripe credentials by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM stripe_credentials 
        WHERE credential_id = %s
    """, (credential_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return dict(row)

def get_stripe_config(store_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    Get complete Stripe configuration for store
    Returns decrypted keys and all relevant settings
    """
    from encryption_utils import decrypt
    
    payment_settings = get_payment_settings(store_id)
    if not payment_settings:
        return None
    
    config = {
        'payment_processor': payment_settings.get('payment_processor', 'cash_only'),
        'default_currency': payment_settings.get('default_currency', 'usd'),
        'transaction_fee_rate': payment_settings.get('transaction_fee_rate', 0.029),
        'transaction_fee_fixed': payment_settings.get('transaction_fee_fixed', 0.30),
        'enabled_payment_methods': json.loads(payment_settings.get('enabled_payment_methods', '["cash"]')),
        'require_cvv': payment_settings.get('require_cvv', 1),
        'require_zip': payment_settings.get('require_zip', 0),
        'auto_capture': payment_settings.get('auto_capture', 1)
    }
    
    # Get Stripe Connect account if configured
    if payment_settings.get('stripe_account_id'):
        connect_account = get_stripe_connect_account(payment_settings['stripe_account_id'])
        if connect_account:
            config['stripe_connect'] = {
                'account_id': connect_account['stripe_connected_account_id'],
                'publishable_key': connect_account.get('stripe_publishable_key'),
                'charges_enabled': connect_account.get('charges_enabled', 0),
                'payouts_enabled': connect_account.get('payouts_enabled', 0),
                'onboarding_completed': connect_account.get('onboarding_completed', 0)
            }
            # Decrypt tokens if present
            if connect_account.get('stripe_access_token_encrypted'):
                try:
                    config['stripe_connect']['access_token'] = decrypt(connect_account['stripe_access_token_encrypted'])
                except:
                    pass
    
    # Get Direct API keys if configured
    if payment_settings.get('stripe_credential_id'):
        credentials = get_stripe_credentials(payment_settings['stripe_credential_id'])
        if credentials:
            config['stripe_direct'] = {
                'publishable_key': credentials.get('stripe_publishable_key'),
                'test_mode': credentials.get('test_mode', 0),
                'verified': credentials.get('verified', 0)
            }
            # Decrypt secret key
            if credentials.get('stripe_secret_key_encrypted'):
                try:
                    config['stripe_direct']['secret_key'] = decrypt(credentials['stripe_secret_key_encrypted'])
                except:
                    pass
    
    return config

# ============================================================================
# ONBOARDING SYSTEM FUNCTIONS
# ============================================================================

def get_onboarding_status() -> Dict[str, Any]:
    """Get current onboarding status"""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Check if table exists (PostgreSQL)
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'store_setup'
            )
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            # Table doesn't exist - onboarding not started
            return {
                'setup_completed': False,
                'setup_step': 1,
                'completed_at': None
            }
        
        cursor.execute("""
            SELECT * FROM store_setup 
            ORDER BY setup_id DESC 
            LIMIT 1
        """)
        
        row = cursor.fetchone()
        
        if not row:
            return {
                'setup_completed': False,
                'setup_step': 1,
                'completed_at': None
            }
        
        # Handle both Row objects (SQLite) and tuple/dict (PostgreSQL)
        if hasattr(row, 'keys'):
            # PostgreSQL RealDictCursor provides dict-like access
            row_dict = dict(row)
        else:
            # Tuple or list - need to get column names
            try:
                column_names = [desc[0] for desc in cursor.description]
                row_dict = dict(zip(column_names, row))
            except:
                # Fallback: assume order matches schema
                row_dict = {
                    'setup_completed': row[0] if len(row) > 0 else 0,
                    'setup_step': row[1] if len(row) > 1 else 1,
                    'completed_at': row[2] if len(row) > 2 else None
                }
        
        return {
            'setup_completed': bool(row_dict.get('setup_completed', 0)),
            'setup_step': row_dict.get('setup_step', 1),
            'completed_at': row_dict.get('completed_at')
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error getting onboarding status: {e}")
        # Return default status on error
        return {
            'setup_completed': False,
            'setup_step': 1,
            'completed_at': None
        }
    finally:
        if conn and not conn.closed:
            try:
                conn.close()
            except:
                pass

def update_onboarding_step(step: int) -> bool:
    """Update current onboarding step"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Create store_setup table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS store_setup (
                setup_id SERIAL PRIMARY KEY,
                setup_completed INTEGER DEFAULT 0 CHECK(setup_completed IN (0, 1)),
                setup_step INTEGER DEFAULT 1,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        
        cursor.execute("SELECT COUNT(*) FROM store_setup")
        count = cursor.fetchone()[0]
        
        if count == 0:
            cursor.execute("""
                INSERT INTO store_setup (setup_step)
                VALUES (%s)
            """, (step,))
        else:
            cursor.execute("""
                UPDATE store_setup 
                SET setup_step = %s, updated_at = CURRENT_TIMESTAMP
                WHERE setup_id = (SELECT setup_id FROM store_setup ORDER BY setup_id DESC LIMIT 1)
            """, (step,))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error updating onboarding step: {e}")
        if conn and not conn.closed:
            try:
                conn.rollback()
            except:
                pass
            try:
                conn.close()
            except:
                pass
        return False

def complete_onboarding() -> bool:
    """Mark onboarding as complete"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Create store_setup table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS store_setup (
                setup_id SERIAL PRIMARY KEY,
                setup_completed INTEGER DEFAULT 0 CHECK(setup_completed IN (0, 1)),
                setup_step INTEGER DEFAULT 1,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        
        # Check if store_setup table exists and has rows
        cursor.execute("SELECT COUNT(*) FROM store_setup")
        count = cursor.fetchone()[0]
        
        if count == 0:
            # Create a new row if none exists
            cursor.execute("""
                INSERT INTO store_setup (setup_completed, setup_step, completed_at, updated_at)
                VALUES (1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """)
        else:
            # Update existing row
            cursor.execute("""
                UPDATE store_setup 
                SET setup_completed = 1, 
                    setup_step = 6,
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE setup_id = (SELECT setup_id FROM store_setup ORDER BY setup_id DESC LIMIT 1)
            """)
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            conn.rollback()
        except:
            pass
        try:
            conn.close()
        except:
            pass
        print(f"Error completing onboarding: {e}")
        return False

def save_onboarding_progress(step_name: str, data: Optional[Dict[str, Any]] = None) -> bool:
    """Save progress for a specific onboarding step"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Create onboarding_progress table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS onboarding_progress (
                progress_id SERIAL PRIMARY KEY,
                step_name TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(step_name)
            )
        """)
        conn.commit()
        
        # Check if progress exists
        cursor.execute("""
            SELECT progress_id FROM onboarding_progress 
            WHERE step_name = %s
        """, (step_name,))
        
        existing = cursor.fetchone()
        
        # Serialize data to JSON
        data_json = None
        if data is not None:
            try:
                data_json = json.dumps(data)
            except (TypeError, ValueError) as json_err:
                print(f"Warning: Could not serialize data to JSON: {json_err}")
                data_json = None
        
        if existing:
            # Update existing
            cursor.execute("""
                UPDATE onboarding_progress 
                SET completed = 1,
                    completed_at = CURRENT_TIMESTAMP,
                    data = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE step_name = %s
            """, (data_json, step_name))
        else:
            # Create new - try INSERT first, fall back to UPDATE if UNIQUE constraint fails
            try:
                cursor.execute("""
                    INSERT INTO onboarding_progress (step_name, completed, data, completed_at)
                    VALUES (%s, 1, %s, CURRENT_TIMESTAMP)
                """, (step_name, data_json))
            except Exception as e:
                # Check if it's an integrity error (unique constraint violation)
                import psycopg2
                if isinstance(e, psycopg2.IntegrityError):
                    # UNIQUE constraint violation - update instead
                    cursor.execute("""
                        UPDATE onboarding_progress 
                        SET completed = 1,
                            completed_at = CURRENT_TIMESTAMP,
                            data = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE step_name = %s
                    """, (data_json, step_name))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error saving onboarding progress: {e}")
        if conn and not conn.closed:
            try:
                conn.rollback()
            except:
                pass
            try:
                conn.close()
            except:
                pass
        return False

def get_onboarding_progress(step_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Get onboarding progress for a specific step or all steps"""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        if step_name:
            cursor.execute("""
                SELECT * FROM onboarding_progress 
                WHERE step_name = %s
            """, (step_name,))
            row = cursor.fetchone()
            
            if not row:
                if conn and not conn.closed:
                    conn.close()
                return None
            
            # Handle different row formats (tuple vs dict-like)
            if hasattr(row, 'keys'):
                result = dict(row)
            else:
                try:
                    column_names = [desc[0] for desc in cursor.description]
                    result = dict(zip(column_names, row))
                except Exception:
                    result = dict(row) if isinstance(row, dict) else {}
            
            if result.get('data'):
                try:
                    result['data'] = json.loads(result['data'])
                except (TypeError, ValueError, json.JSONDecodeError):
                    pass
            
            if conn and not conn.closed:
                conn.close()
            return result
        else:
            cursor.execute("""
                SELECT * FROM onboarding_progress 
                ORDER BY created_at
            """)
            rows = cursor.fetchall()
            
            progress = {}
            if rows:
                try:
                    column_names = [desc[0] for desc in cursor.description]
                except Exception:
                    column_names = None
                
                for row in rows:
                    # Handle different row formats
                    if hasattr(row, 'keys'):
                        step = dict(row)
                    elif column_names:
                        step = dict(zip(column_names, row))
                    else:
                        step = dict(row) if isinstance(row, dict) else {}
                    
                    if step.get('data'):
                        try:
                            step['data'] = json.loads(step['data'])
                        except (TypeError, ValueError, json.JSONDecodeError):
                            pass
                    
                    if 'step_name' in step:
                        progress[step['step_name']] = step
            
            if conn and not conn.closed:
                conn.close()
            return progress
    except Exception as e:
        if conn and not conn.closed:
            try:
                conn.close()
            except:
                pass
        print(f"Error getting onboarding progress: {e}")
        import traceback
        traceback.print_exc()
        return None

# ============================================================================
# CASH REGISTER CONTROL FUNCTIONS
# ============================================================================

def open_cash_register(employee_id: int, register_id: int = 1, starting_cash: float = 0.0, notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Open a new cash register session
    
    Args:
        employee_id: Employee opening the register
        register_id: Register number (default 1)
        starting_cash: Starting cash amount
        notes: Optional notes
    
    Returns:
        Dict with session_id and status
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if there's an open session for this register
        cursor.execute("""
            SELECT session_id FROM cash_register_sessions
            WHERE register_id = %s AND status = 'open'
        """, (register_id,))
        
        existing = cursor.fetchone()
        if existing:
            conn.close()
            return {
                'success': False,
                'message': f'Register {register_id} is already open',
                'session_id': existing[0]
            }
        
        # Create new session
        cursor.execute("""
            INSERT INTO cash_register_sessions
            (register_id, employee_id, starting_cash, notes, status)
            VALUES (%s, %s, %s, %s, 'open')
        """, (register_id, employee_id, starting_cash, notes))
        
        session_id = cursor.lastrowid
        
        # Log audit
        try:
            log_audit_action(
                table_name='cash_register_sessions',
                record_id=session_id,
                action_type='INSERT',
                employee_id=employee_id,
                new_values={'register_id': register_id, 'starting_cash': starting_cash, 'status': 'open'}
            )
        except:
            pass  # Don't fail if audit logging fails
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'session_id': session_id,
            'message': f'Register {register_id} opened successfully'
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error opening cash register: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def close_cash_register(session_id: int, employee_id: int, ending_cash: float, notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Close a cash register session and calculate reconciliation
    
    Args:
        session_id: Session to close
        employee_id: Employee closing the register
        ending_cash: Actual cash count
        notes: Optional notes
    
    Returns:
        Dict with reconciliation details
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get session details
        cursor.execute("""
            SELECT register_id, employee_id, starting_cash, opened_at, status
            FROM cash_register_sessions
            WHERE session_id = %s
        """, (session_id,))
        
        session = cursor.fetchone()
        if not session:
            conn.close()
            return {'success': False, 'message': 'Session not found'}
        
        session = dict(zip(['register_id', 'employee_id', 'starting_cash', 'opened_at', 'status'], session))
        
        if session['status'] != 'open':
            conn.close()
            return {'success': False, 'message': f"Session is already {session['status']}"}
        
        # Calculate cash sales and refunds from orders
        cursor.execute("""
            SELECT 
                COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total ELSE 0 END), 0) as cash_sales,
                COALESCE(SUM(CASE WHEN o.payment_method = 'cash' AND o.order_status = 'returned' THEN o.total ELSE 0 END), 0) as cash_refunds
            FROM orders o
            WHERE o.order_date >= %s AND o.order_date <= datetime('now')
            AND o.payment_method = 'cash'
        """, (session['opened_at'],))
        
        sales_data = cursor.fetchone()
        cash_sales = sales_data[0] if sales_data else 0.0
        cash_refunds = sales_data[1] if sales_data else 0.0
        
        # Calculate cash in/out transactions
        cursor.execute("""
            SELECT 
                COALESCE(SUM(CASE WHEN transaction_type IN ('cash_in', 'deposit') THEN amount ELSE 0 END), 0) as cash_in,
                COALESCE(SUM(CASE WHEN transaction_type IN ('cash_out', 'withdrawal') THEN amount ELSE 0 END), 0) as cash_out
            FROM cash_transactions
            WHERE session_id = %s
        """, (session_id,))
        
        trans_data = cursor.fetchone()
        cash_in = trans_data[0] if trans_data else 0.0
        cash_out = trans_data[1] if trans_data else 0.0
        
        # Calculate expected cash
        expected_cash = session['starting_cash'] + cash_sales - cash_refunds + cash_in - cash_out
        
        # Calculate discrepancy
        discrepancy = ending_cash - expected_cash
        
        # Update session
        cursor.execute("""
            UPDATE cash_register_sessions
            SET closed_at = CURRENT_TIMESTAMP,
                closed_by = %s,
                ending_cash = %s,
                expected_cash = %s,
                cash_sales = %s,
                cash_refunds = %s,
                cash_in = %s,
                cash_out = %s,
                discrepancy = %s,
                status = 'closed',
                notes = COALESCE(notes, '') || CASE WHEN ? IS NOT NULL THEN '\n' || ? ELSE '' END
            WHERE session_id = %s
        """, (employee_id, ending_cash, expected_cash, cash_sales, cash_refunds, 
              cash_in, cash_out, discrepancy, notes, notes, session_id))
        
        # Log audit
        try:
            log_audit_action(
                table_name='cash_register_sessions',
                record_id=session_id,
                action_type='UPDATE',
                employee_id=employee_id,
                new_values={
                    'status': 'closed',
                    'ending_cash': ending_cash,
                    'expected_cash': expected_cash,
                    'discrepancy': discrepancy
                }
            )
        except:
            pass
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'session_id': session_id,
            'starting_cash': session['starting_cash'],
            'ending_cash': ending_cash,
            'expected_cash': expected_cash,
            'cash_sales': cash_sales,
            'cash_refunds': cash_refunds,
            'cash_in': cash_in,
            'cash_out': cash_out,
            'discrepancy': discrepancy,
            'message': 'Register closed successfully'
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error closing cash register: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def add_cash_transaction(session_id: int, employee_id: int, transaction_type: str, amount: float, reason: Optional[str] = None, notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Add a cash transaction (cash in/out, deposit, withdrawal, adjustment)
    
    Args:
        session_id: Register session ID
        employee_id: Employee making the transaction
        transaction_type: 'cash_in', 'cash_out', 'deposit', 'withdrawal', 'adjustment'
        amount: Transaction amount
        reason: Reason for transaction
        notes: Optional notes
    
    Returns:
        Dict with transaction_id and status
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Verify session is open
        cursor.execute("""
            SELECT status FROM cash_register_sessions WHERE session_id = %s
        """, (session_id,))
        
        session = cursor.fetchone()
        if not session:
            conn.close()
            return {'success': False, 'message': 'Session not found'}
        
        if session[0] != 'open':
            conn.close()
            return {'success': False, 'message': f'Session is {session[0]}, cannot add transactions'}
        
        # Insert transaction
        cursor.execute("""
            INSERT INTO cash_transactions
            (session_id, employee_id, transaction_type, amount, reason, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (session_id, employee_id, transaction_type, amount, reason, notes))
        
        transaction_id = cursor.lastrowid
        
        # Log audit
        try:
            log_audit_action(
                table_name='cash_transactions',
                record_id=transaction_id,
                action_type='INSERT',
                employee_id=employee_id,
                new_values={
                    'transaction_type': transaction_type,
                    'amount': amount,
                    'reason': reason
                }
            )
        except:
            pass
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'transaction_id': transaction_id,
            'message': 'Cash transaction recorded successfully'
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error adding cash transaction: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def get_register_session(session_id: Optional[int] = None, register_id: Optional[int] = None, status: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Get cash register session(s)
    
    Args:
        session_id: Specific session ID
        register_id: Filter by register ID
        status: Filter by status ('open', 'closed', 'reconciled')
    
    Returns:
        Session dict or list of sessions
    """
    conn = get_connection()
    cursor = conn.cursor()
    # PostgreSQL cursor returns dict-like rows
    
    try:
        if session_id:
            cursor.execute("""
                SELECT crs.*,
                       e1.first_name || ' ' || e1.last_name as opened_by_name,
                       e2.first_name || ' ' || e2.last_name as closed_by_name,
                       e3.first_name || ' ' || e3.last_name as reconciled_by_name
                FROM cash_register_sessions crs
                LEFT JOIN employees e1 ON crs.employee_id = e1.employee_id
                LEFT JOIN employees e2 ON crs.closed_by = e2.employee_id
                LEFT JOIN employees e3 ON crs.reconciled_by = e3.employee_id
                WHERE crs.session_id = %s
            """, (session_id,))
            
            row = cursor.fetchone()
            conn.close()
            return dict(row) if row else None
        else:
            query = """
                SELECT crs.*,
                       e1.first_name || ' ' || e1.last_name as opened_by_name,
                       e2.first_name || ' ' || e2.last_name as closed_by_name,
                       e3.first_name || ' ' || e3.last_name as reconciled_by_name
                FROM cash_register_sessions crs
                LEFT JOIN employees e1 ON crs.employee_id = e1.employee_id
                LEFT JOIN employees e2 ON crs.closed_by = e2.employee_id
                LEFT JOIN employees e3 ON crs.reconciled_by = e3.employee_id
                WHERE 1=1
            """
            params = []
            
            if register_id:
                query += " AND crs.register_id = %s"
                params.append(register_id)
            
            if status:
                query += " AND crs.status = %s"
                params.append(status)
            
            query += " ORDER BY crs.opened_at DESC"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            return [dict(row) for row in rows]
            
    except Exception as e:
        conn.close()
        print(f"Error getting register session: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_register_summary(session_id: int) -> Dict[str, Any]:
    """
    Get detailed summary of a register session including all transactions
    
    Args:
        session_id: Session ID
    
    Returns:
        Dict with session details and transactions
    """
    conn = get_connection()
    cursor = conn.cursor()
    # PostgreSQL cursor returns dict-like rows
    
    try:
        # Get session
        session = get_register_session(session_id=session_id)
        if not session:
            return {'success': False, 'message': 'Session not found'}
        
        # Get cash transactions
        cursor.execute("""
            SELECT ct.*,
                   e.first_name || ' ' || e.last_name as employee_name
            FROM cash_transactions ct
            JOIN employees e ON ct.employee_id = e.employee_id
            WHERE ct.session_id = %s
            ORDER BY ct.transaction_date
        """, (session_id,))
        
        transactions = [dict(row) for row in cursor.fetchall()]
        
        # Get cash sales from orders
        cursor.execute("""
            SELECT 
                COUNT(*) as transaction_count,
                COALESCE(SUM(CASE WHEN o.order_status != 'voided' THEN o.total ELSE 0 END), 0) as total_sales,
                COALESCE(SUM(CASE WHEN o.order_status = 'voided' THEN o.total ELSE 0 END), 0) as voided_amount
            FROM orders o
            WHERE o.payment_method = 'cash'
            AND o.order_date >= ? AND o.order_date <= COALESCE(%s, datetime('now'))
        """, (session['opened_at'], session.get('closed_at')))
        
        sales_data = dict(cursor.fetchone())
        
        conn.close()
        
        return {
            'success': True,
            'session': session,
            'transactions': transactions,
            'sales': sales_data
        }
        
    except Exception as e:
        conn.close()
        print(f"Error getting register summary: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def reconcile_register_session(session_id: int, employee_id: int, notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Mark a register session as reconciled (manager approval)
    
    Args:
        session_id: Session to reconcile
        employee_id: Employee reconciling (should be manager)
        notes: Optional reconciliation notes
    
    Returns:
        Dict with status
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check session exists and is closed
        cursor.execute("""
            SELECT status FROM cash_register_sessions WHERE session_id = %s
        """, (session_id,))
        
        session = cursor.fetchone()
        if not session:
            conn.close()
            return {'success': False, 'message': 'Session not found'}
        
        if session[0] != 'closed':
            conn.close()
            return {'success': False, 'message': f'Session must be closed before reconciliation (current: {session[0]})'}
        
        # Update to reconciled
        cursor.execute("""
            UPDATE cash_register_sessions
            SET status = 'reconciled',
                reconciled_by = %s,
                reconciled_at = CURRENT_TIMESTAMP,
                notes = COALESCE(notes, '') || CASE WHEN ? IS NOT NULL THEN '\nReconciled: ' || ? ELSE '' END
            WHERE session_id = %s
        """, (employee_id, notes, notes, session_id))
        
        # Log audit
        try:
            log_audit_action(
                table_name='cash_register_sessions',
                record_id=session_id,
                action_type='APPROVE',
                employee_id=employee_id,
                new_values={'status': 'reconciled'}
            )
        except:
            pass
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'message': 'Session reconciled successfully'
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error reconciling register: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

# ============================================================================
# REGISTER CASH SETTINGS AND DAILY COUNTS
# ============================================================================

def save_register_cash_settings(
    register_id: int,
    cash_mode: str,
    total_amount: Optional[float] = None,
    denominations: Optional[Dict[str, int]] = None,
    employee_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Save register cash settings (total amount or denomination breakdown)
    
    Args:
        register_id: Register number
        cash_mode: 'total' or 'denominations'
        total_amount: Total cash amount (if cash_mode is 'total')
        denominations: Dict of denominations (if cash_mode is 'denominations')
                       e.g., {'100': 2, '50': 1, '20': 5, '10': 10, '5': 20, '1': 50, '0.25': 40, '0.10': 50, '0.05': 40, '0.01': 100}
        employee_id: Employee saving the settings
    
    Returns:
        Dict with success status
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        if cash_mode not in ['total', 'denominations']:
            conn.close()
            return {'success': False, 'message': 'cash_mode must be "total" or "denominations"'}
        
        if cash_mode == 'total' and (total_amount is None or total_amount < 0):
            conn.close()
            return {'success': False, 'message': 'total_amount is required and must be >= 0'}
        
        if cash_mode == 'denominations':
            if not denominations:
                conn.close()
                return {'success': False, 'message': 'denominations dict is required'}
            
            # Calculate total from denominations
            total = 0.0
            for denom, count in denominations.items():
                try:
                    total += float(denom) * int(count)
                except (ValueError, TypeError):
                    pass
            
            total_amount = total
            denominations_json = json.dumps(denominations)
        else:
            denominations_json = None
        
        # Check if setting exists
        cursor.execute("""
            SELECT setting_id FROM register_cash_settings
            WHERE register_id = %s
        """, (register_id,))
        
        existing = cursor.fetchone()
        
        if existing:
            # Update existing
            cursor.execute("""
                UPDATE register_cash_settings
                SET cash_mode = %s,
                    total_amount = %s,
                    denominations = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE register_id = %s
            """, (cash_mode, total_amount, denominations_json, register_id))
        else:
            # Insert new
            cursor.execute("""
                INSERT INTO register_cash_settings
                (register_id, cash_mode, total_amount, denominations, is_active)
                VALUES (%s, %s, %s, %s, 1)
            """, (register_id, cash_mode, total_amount, denominations_json))
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'message': 'Register cash settings saved successfully',
            'total_amount': total_amount
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error saving register cash settings: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def get_register_cash_settings(register_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    Get register cash settings
    
    Args:
        register_id: Specific register ID, or None for all
    
    Returns:
        Settings dict or list of settings
    """
    conn = get_connection()
    cursor = conn.cursor()
    # PostgreSQL cursor returns dict-like rows
    
    try:
        if register_id:
            cursor.execute("""
                SELECT * FROM register_cash_settings
                WHERE register_id = %s AND is_active = 1
            """, (register_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                result = dict(row)
                if result.get('denominations'):
                    try:
                        result['denominations'] = json.loads(result['denominations'])
                    except:
                        result['denominations'] = {}
                return result
            return None
        else:
            cursor.execute("""
                SELECT * FROM register_cash_settings
                WHERE is_active = 1
                ORDER BY register_id
            """)
            
            rows = cursor.fetchall()
            conn.close()
            
            results = []
            for row in rows:
                result = dict(row)
                if result.get('denominations'):
                    try:
                        result['denominations'] = json.loads(result['denominations'])
                    except:
                        result['denominations'] = {}
                results.append(result)
            
            return results
            
    except Exception as e:
        conn.close()
        print(f"Error getting register cash settings: {e}")
        import traceback
        traceback.print_exc()
        return None

def save_daily_cash_count(
    register_id: int,
    count_date: str,
    count_type: str,
    total_amount: float,
    employee_id: int,
    denominations: Optional[Dict[str, int]] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Save a daily cash count (drop, opening, or closing)
    
    Args:
        register_id: Register number
        count_date: Date of count (YYYY-MM-DD)
        count_type: 'drop', 'opening', or 'closing'
        total_amount: Total cash amount
        employee_id: Employee who counted
        denominations: Optional denomination breakdown
        notes: Optional notes
    
    Returns:
        Dict with success status and count_id
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        if count_type not in ['drop', 'opening', 'closing']:
            conn.close()
            return {'success': False, 'message': 'count_type must be "drop", "opening", or "closing"'}
        
        if total_amount < 0:
            conn.close()
            return {'success': False, 'message': 'total_amount must be >= 0'}
        
        denominations_json = None
        if denominations:
            # Calculate total from denominations if provided
            calculated_total = 0.0
            for denom, count in denominations.items():
                try:
                    calculated_total += float(denom) * int(count)
                except (ValueError, TypeError):
                    pass
            
            # Use calculated total if provided total is 0 or doesn't match
            if total_amount == 0 or abs(total_amount - calculated_total) < 0.01:
                total_amount = calculated_total
            
            denominations_json = json.dumps(denominations)
        
        # Check if count already exists for this date/type
        cursor.execute("""
            SELECT count_id FROM daily_cash_counts
            WHERE register_id = %s AND count_date = %s AND count_type = %s
        """, (register_id, count_date, count_type))
        
        existing = cursor.fetchone()
        
        if existing:
            # Update existing
            cursor.execute("""
                UPDATE daily_cash_counts
                SET total_amount = %s,
                    denominations = %s,
                    counted_by = %s,
                    counted_at = CURRENT_TIMESTAMP,
                    notes = %s
                WHERE count_id = %s
            """, (total_amount, denominations_json, employee_id, notes, existing[0]))
            count_id = existing[0]
        else:
            # Insert new
            cursor.execute("""
                INSERT INTO daily_cash_counts
                (register_id, count_date, count_type, total_amount, denominations, counted_by, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (register_id, count_date, count_type, total_amount, denominations_json, employee_id, notes))
            count_id = cursor.lastrowid
        
        # Log audit
        try:
            log_audit_action(
                table_name='daily_cash_counts',
                record_id=count_id,
                action_type='INSERT' if not existing else 'UPDATE',
                employee_id=employee_id,
                new_values={
                    'register_id': register_id,
                    'count_date': count_date,
                    'count_type': count_type,
                    'total_amount': total_amount
                }
            )
        except:
            pass
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'count_id': count_id,
            'message': f'Daily cash count saved successfully',
            'total_amount': total_amount
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error saving daily cash count: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': str(e)}

def get_daily_cash_counts(
    register_id: Optional[int] = None,
    count_date: Optional[str] = None,
    count_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get daily cash counts
    
    Args:
        register_id: Filter by register ID
        count_date: Filter by specific date
        count_type: Filter by type ('drop', 'opening', 'closing')
        start_date: Filter from date
        end_date: Filter to date
    
    Returns:
        List of count dicts
    """
    conn = get_connection()
    cursor = conn.cursor()
    # PostgreSQL cursor returns dict-like rows
    
    try:
        query = """
            SELECT dc.*,
                   e.first_name || ' ' || e.last_name as counted_by_name
            FROM daily_cash_counts dc
            JOIN employees e ON dc.counted_by = e.employee_id
            WHERE 1=1
        """
        params = []
        
        if register_id:
            query += " AND dc.register_id = %s"
            params.append(register_id)
        
        if count_date:
            query += " AND dc.count_date = %s"
            params.append(count_date)
        
        if count_type:
            query += " AND dc.count_type = %s"
            params.append(count_type)
        
        if start_date:
            query += " AND dc.count_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND dc.count_date <= ?"
            params.append(end_date)
        
        query += " ORDER BY dc.count_date DESC, dc.counted_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for row in rows:
            result = dict(row)
            if result.get('denominations'):
                try:
                    result['denominations'] = json.loads(result['denominations'])
                except:
                    result['denominations'] = {}
            results.append(result)
        
        return results
        
    except Exception as e:
        conn.close()
        print(f"Error getting daily cash counts: {e}")
        import traceback
        traceback.print_exc()
        return []
