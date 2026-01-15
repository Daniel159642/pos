#!/usr/bin/env python3
"""
Database utility functions for inventory management
"""

import sqlite3
import hashlib
import secrets
import json
import re
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_NAME = 'inventory.db'

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
    cursor.execute("SELECT COUNT(*) as count FROM pending_shipment_items WHERE barcode = ?", (barcode,))
    pending_count = cursor.fetchone()['count']
    
    # Check in inventory
    cursor.execute("SELECT COUNT(*) as count FROM inventory WHERE barcode = ?", (barcode,))
    inventory_count = cursor.fetchone()['count']
    
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
    """Get database connection with timeout to handle locks"""
    try:
        conn = sqlite3.connect(DB_NAME, timeout=20.0)  # Increased timeout for better lock handling
        conn.row_factory = sqlite3.Row  # Enable column access by name
        # Enable WAL mode for better concurrency (if not already enabled)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            # Also set busy timeout at connection level
            conn.execute("PRAGMA busy_timeout = 20000")
        except:
            pass
        return conn
    except sqlite3.Error as e:
        raise ConnectionError(f"Database connection failed: {str(e)}") from e

def create_or_get_category_with_hierarchy(category_path: str, conn=None) -> Optional[int]:
    """
    Create or get category with parent-child hierarchy
    Example: "Electronics > Phones > Smartphones" creates:
    - Electronics (parent)
    - Phones (child of Electronics)
    - Smartphones (child of Phones)
    
    Args:
        category_path: Category path like "Electronics > Phones" or "Electronics"
        conn: Optional database connection (creates new if None)
    
    Returns:
        The category_id of the most specific category, or None if invalid
    """
    if conn is None:
        conn = get_connection()
        should_close = True
    else:
        should_close = False
    
    try:
        cursor = conn.cursor()
        
        # Split category path by > or →
        parts = [p.strip() for p in re.split(r'[>→]', category_path) if p.strip()]
        
        if not parts:
            if should_close:
                conn.close()
            return None
        
        parent_id = None
        
        for i, category_name in enumerate(parts):
            # Check if category exists
            if parent_id:
                cursor.execute("""
                    SELECT category_id FROM categories
                    WHERE category_name = ? AND parent_category_id = ?
                """, (category_name, parent_id))
            else:
                cursor.execute("""
                    SELECT category_id FROM categories
                    WHERE category_name = ? AND parent_category_id IS NULL
                """, (category_name,))
            
            result = cursor.fetchone()
            
            if result:
                category_id = result[0]
            else:
                # Create new category
                cursor.execute("""
                    INSERT INTO categories (category_name, parent_category_id, is_auto_generated)
                    VALUES (?, ?, 1)
                """, (category_name, parent_id))
                category_id = cursor.lastrowid
            
            parent_id = category_id
        
        conn.commit()
        return parent_id  # Return most specific category
        
    except Exception as e:
        print(f"Error creating category hierarchy: {e}")
        if should_close:
            conn.close()
        return None
    finally:
        if should_close:
            conn.close()

def extract_metadata_for_product(product_id: int, auto_sync_category: bool = True):
    """
    Automatically extract metadata for a product
    Called automatically when products are created or updated
    
    Args:
        product_id: ID of the product to extract metadata for
        auto_sync_category: If True, sync category to inventory.category field
    """
    try:
        from metadata_extraction import FreeMetadataSystem
        
        # Get product
        product = get_product(product_id)
        if not product:
            return False
        
        # Extract metadata
        metadata_system = FreeMetadataSystem()
        metadata = metadata_system.extract_metadata_from_product(
            product_name=product['product_name'],
            barcode=product.get('barcode'),
            description=None
        )
        
        # Save metadata
        metadata_system.save_product_metadata(
            product_id=product_id,
            metadata=metadata,
            extraction_method='auto_on_create'
        )
        
        # Optionally sync category to inventory.category field
        if auto_sync_category:
            try:
                # Get category from metadata
                category_suggestions = metadata.get('category_suggestions', [])
                if category_suggestions and len(category_suggestions) > 0:
                    suggested_category = category_suggestions[0].get('category_name')
                    if suggested_category:
                        conn = get_connection()
                        cursor = conn.cursor()
                        
                        # Create or get category with hierarchy (e.g., "Electronics > Phones")
                        category_id = create_or_get_category_with_hierarchy(
                            suggested_category, conn
                        )
                        
                        # Update inventory.category with most specific category name
                        # Extract just the last part (most specific)
                        category_parts = [p.strip() for p in re.split(r'[>→]', suggested_category)]
                        most_specific = category_parts[-1] if category_parts else suggested_category
                        
                        if product.get('category') != most_specific:
                            cursor.execute("""
                                UPDATE inventory 
                                SET category = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE product_id = ?
                            """, (most_specific, product_id))
                        
                        conn.commit()
                        conn.close()
            except Exception as e:
                print(f"Warning: Category sync failed for product {product_id}: {e}")
                pass  # Don't fail if category sync fails
        
        return True
    except Exception as e:
        # Silently fail - metadata extraction is optional
        # Uncomment for debugging: print(f"Metadata extraction failed for product {product_id}: {e}")
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    except sqlite3.IntegrityError as e:
        conn.rollback()
        conn.close()
        raise ValueError(f"SKU '{sku}' already exists in database") from e

def get_product(product_id: int) -> Optional[Dict[str, Any]]:
    """Get a product by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM inventory WHERE product_id = ?", (product_id,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def get_product_by_sku(sku: str) -> Optional[Dict[str, Any]]:
    """Get a product by SKU"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM inventory WHERE sku = ?", (sku,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def get_product_by_barcode(barcode: str) -> Optional[Dict[str, Any]]:
    """Get a product by barcode"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM inventory WHERE barcode = ?", (barcode,))
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
            updates.append(f"{field} = ?")
            values.append(value)
            new_values[field] = value
    
    if not updates:
        conn.close()
        return False
    
    # Add updated_at timestamp
    updates.append("updated_at = ?")
    values.append(datetime.now().isoformat())
    values.append(product_id)
    
    query = f"UPDATE inventory SET {', '.join(updates)} WHERE product_id = ?"
    
    try:
        cursor.execute(query, values)
        conn.commit()
        success = cursor.rowcount > 0
        
        # Log to audit log if employee_id is provided
        if success and employee_id:
            # Get new values for audit log using the same connection
            cursor.execute("SELECT * FROM inventory WHERE product_id = ?", (product_id,))
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
    except sqlite3.IntegrityError as e:
        conn.rollback()
        conn.close()
        raise ValueError(f"SKU already exists in database") from e

def delete_product(product_id: int) -> bool:
    """Delete a product from inventory"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM inventory WHERE product_id = ?", (product_id,))
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
        query += " AND category = ?"
        params.append(category)
    
    if vendor:
        query += " AND vendor = ?"
        params.append(vendor)
    
    if min_quantity is not None:
        query += " AND current_quantity >= ?"
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
    cursor.execute("SELECT current_quantity FROM inventory WHERE product_id = ?", (product_id,))
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
        SET current_quantity = ?, updated_at = ?
        WHERE product_id = ?
    """, (new_quantity, datetime.now().isoformat(), product_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

# ============================================================================
# Vendor Management Functions
# ============================================================================

def add_vendor(
    vendor_name: str,
    contact_person: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None
) -> int:
    """Add a new vendor"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO vendors (vendor_name, contact_person, email, phone, address)
        VALUES (?, ?, ?, ?, ?)
    """, (vendor_name, contact_person, email, phone, address))
    
    conn.commit()
    vendor_id = cursor.lastrowid
    conn.close()
    
    return vendor_id

def get_vendor(vendor_id: int) -> Optional[Dict[str, Any]]:
    """Get a vendor by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM vendors WHERE vendor_id = ?", (vendor_id,))
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def list_vendors() -> List[Dict[str, Any]]:
    """List all vendors"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM vendors ORDER BY vendor_name")
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def update_vendor(vendor_id: int, **kwargs) -> bool:
    """Update vendor information"""
    conn = get_connection()
    cursor = conn.cursor()
    
    allowed_fields = ['vendor_name', 'contact_person', 'email', 'phone', 'address']
    updates = []
    values = []
    
    for field, value in kwargs.items():
        if field in allowed_fields:
            updates.append(f"{field} = ?")
            values.append(value)
    
    if not updates:
        conn.close()
        return False
    
    values.append(vendor_id)
    query = f"UPDATE vendors SET {', '.join(updates)} WHERE vendor_id = ?"
    
    cursor.execute(query, values)
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success

def delete_vendor(vendor_id: int) -> bool:
    """Delete a vendor"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM vendors WHERE vendor_id = ?", (vendor_id,))
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
        VALUES (?, ?, ?, ?, ?, ?, ?)
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
    
    cursor.execute("SELECT * FROM shipments WHERE shipment_id = ?", (shipment_id,))
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
        query += " AND vendor_id = ?"
        params.append(vendor_id)
    
    if start_date:
        query += " AND shipment_date >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND shipment_date <= ?"
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
            updates.append(f"{field} = ?")
            values.append(value)
    
    if not updates:
        conn.close()
        return False
    
    values.append(shipment_id)
    query = f"UPDATE shipments SET {', '.join(updates)} WHERE shipment_id = ?"
    
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
            VALUES (?, ?, ?, ?, ?, ?)
        """, (shipment_id, product_id, quantity_received, unit_cost, lot_number, expiration_date))
        
        conn.commit()
        shipment_item_id = cursor.lastrowid
        conn.close()
        
        return shipment_item_id
    except sqlite3.IntegrityError as e:
        conn.rollback()
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
        WHERE si.shipment_id = ?
        ORDER BY si.shipment_item_id
    """, (shipment_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_shipment_item(shipment_item_id: int) -> Optional[Dict[str, Any]]:
    """Get a shipment item by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM shipment_items WHERE shipment_item_id = ?", (shipment_item_id,))
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
        WHERE i.product_id = ?
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
        WHERE s.shipment_id = ?
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
    cursor.execute("SELECT current_quantity FROM inventory WHERE product_id = ?", (product_id,))
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
            VALUES (?, ?, ?, ?)
        """, (product_id, quantity_sold, sale_price, notes))
        
        conn.commit()
        sale_id = cursor.lastrowid
        conn.close()
        
        return sale_id
    except sqlite3.IntegrityError as e:
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
        query += " AND s.product_id = ?"
        params.append(product_id)
    
    if start_date:
        query += " AND DATE(s.sale_date) >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(s.sale_date) <= ?"
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
    cursor.execute("SELECT * FROM inventory WHERE product_id = ?", (product_id,))
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
        WHERE si.product_id = ?
        ORDER BY si.received_timestamp ASC
    """, (product_id,))
    
    shipments = cursor.fetchall()
    
    # Get total quantity sold
    cursor.execute("SELECT COALESCE(SUM(quantity_sold), 0) as total_sold FROM sales WHERE product_id = ?", (product_id,))
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
    verification_mode: str = 'verify_whole_shipment'
) -> int:
    """Create a new pending shipment record"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Ensure verification_mode column exists
    try:
        cursor.execute("PRAGMA table_info(pending_shipments)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'verification_mode' not in columns:
            cursor.execute("""
                ALTER TABLE pending_shipments 
                ADD COLUMN verification_mode TEXT DEFAULT 'verify_whole_shipment'
            """)
            conn.commit()
    except Exception:
        pass  # Column might already exist
    
    if expected_date is None:
        expected_date = datetime.now().date().isoformat()
    
    # Validate verification_mode
    if verification_mode not in ('auto_add', 'verify_whole_shipment'):
        verification_mode = 'verify_whole_shipment'
    
    cursor.execute("""
        INSERT INTO pending_shipments 
        (vendor_id, file_path, expected_date, purchase_order_number, tracking_number, notes, uploaded_by, verification_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (vendor_id, file_path, expected_date, purchase_order_number, tracking_number, notes, uploaded_by, verification_mode))
    
    conn.commit()
    pending_shipment_id = cursor.lastrowid
    conn.close()
    
    return pending_shipment_id

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
    conn = get_connection()
    cursor = conn.cursor()
    
    # Try to match SKU to existing product
    cursor.execute("SELECT product_id FROM inventory WHERE sku = ?", (product_sku,))
    product_row = cursor.fetchone()
    product_id = product_row['product_id'] if product_row else None
    
    # Check if barcode and line_number columns exist
    cursor.execute("PRAGMA table_info(pending_shipment_items)")
    columns = [col[1] for col in cursor.fetchall()]
    has_barcode = 'barcode' in columns
    has_line_number = 'line_number' in columns
    
    if has_barcode and has_line_number:
        cursor.execute("""
            INSERT INTO pending_shipment_items 
            (pending_shipment_id, product_sku, product_name, quantity_expected, 
             unit_cost, lot_number, expiration_date, product_id, barcode, line_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (pending_shipment_id, product_sku, product_name, quantity_expected,
              unit_cost, lot_number, expiration_date, product_id, barcode, line_number))
    elif has_barcode:
        cursor.execute("""
            INSERT INTO pending_shipment_items 
            (pending_shipment_id, product_sku, product_name, quantity_expected, 
             unit_cost, lot_number, expiration_date, product_id, barcode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (pending_shipment_id, product_sku, product_name, quantity_expected,
              unit_cost, lot_number, expiration_date, product_id, barcode))
    elif has_line_number:
        cursor.execute("""
            INSERT INTO pending_shipment_items 
            (pending_shipment_id, product_sku, product_name, quantity_expected, 
             unit_cost, lot_number, expiration_date, product_id, line_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (pending_shipment_id, product_sku, product_name, quantity_expected,
              unit_cost, lot_number, expiration_date, product_id, line_number))
    else:
        cursor.execute("""
            INSERT INTO pending_shipment_items 
            (pending_shipment_id, product_sku, product_name, quantity_expected, 
             unit_cost, lot_number, expiration_date, product_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (pending_shipment_id, product_sku, product_name, quantity_expected,
              unit_cost, lot_number, expiration_date, product_id))
    
    conn.commit()
    pending_item_id = cursor.lastrowid
    conn.close()
    
    return pending_item_id

def get_pending_shipment(pending_shipment_id: int) -> Optional[Dict[str, Any]]:
    """Get a pending shipment by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT ps.*, v.vendor_name, v.contact_person, v.email, v.phone
        FROM pending_shipments ps
        JOIN vendors v ON ps.vendor_id = v.vendor_id
        WHERE ps.pending_shipment_id = ?
    """, (pending_shipment_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def get_pending_shipment_items(pending_shipment_id: int) -> List[Dict[str, Any]]:
    """Get all items for a pending shipment"""
    conn = get_connection()
    cursor = conn.cursor()
    
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
        WHERE psi.pending_shipment_id = ?
        ORDER BY psi.pending_item_id
    """, (pending_shipment_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_pending_shipment_details(pending_shipment_id: int) -> Optional[Dict[str, Any]]:
    """Get full pending shipment details including vendor and items"""
    shipment = get_pending_shipment(pending_shipment_id)
    if not shipment:
        return None
    
    items = get_pending_shipment_items(pending_shipment_id)
    shipment['items'] = items
    
    return shipment

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
        query += " AND ps.status = ?"
        params.append(status)
    
    if vendor_id:
        query += " AND ps.vendor_id = ?"
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
    Returns success status and details
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get the pending item and shipment info
        cursor.execute("""
            SELECT psi.*, ps.vendor_id, ps.pending_shipment_id, v.vendor_name
            FROM pending_shipment_items psi
            JOIN pending_shipments ps ON psi.pending_shipment_id = ps.pending_shipment_id
            JOIN vendors v ON ps.vendor_id = v.vendor_id
            WHERE psi.pending_item_id = ?
        """, (pending_item_id,))
        
        item = cursor.fetchone()
        if not item:
            conn.close()
            return {'success': False, 'message': 'Item not found'}
        
        item = dict(item)
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
        if not product_id:
            # Create product if it doesn't exist
            product_name = item['product_name'] or f"Product {item['product_sku']}"
            unit_cost = item.get('unit_cost', 0.0)
            barcode = item.get('barcode')
            sku = item['product_sku']
            
            if not sku or not sku.strip():
                conn.close()
                return {'success': False, 'message': 'SKU is required'}
            
            cursor.execute("SELECT product_id FROM inventory WHERE sku = ?", (sku,))
            existing = cursor.fetchone()
            
            if existing:
                existing = dict(existing)
                product_id = existing['product_id']
            else:
                # Create new product
                cursor.execute("""
                    INSERT INTO inventory 
                    (product_name, sku, barcode, product_price, product_cost, vendor, vendor_id, current_quantity, category)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)
                """, (product_name, sku, barcode, unit_cost, unit_cost, vendor_name, vendor_id))
                product_id = cursor.lastrowid
                
                # Extract metadata
                try:
                    extract_metadata_for_product(product_id, auto_sync_category=True)
                    print(f"✓ Extracted metadata for new product {product_id} ({product_name})")
                except Exception as e:
                    print(f"⚠ Warning: Metadata extraction failed for product {product_id}: {e}")
                    import traceback
                    traceback.print_exc()
                
                # Update pending item with product_id
                cursor.execute("""
                    UPDATE pending_shipment_items
                    SET product_id = ?
                    WHERE pending_item_id = ?
                """, (product_id, pending_item_id))
        else:
            # Update product barcode if missing
            if item.get('barcode'):
                cursor.execute("""
                    UPDATE inventory 
                    SET barcode = ?
                    WHERE product_id = ? AND (barcode IS NULL OR barcode = '')
                """, (item['barcode'], product_id))
            
            # Check if product needs metadata extraction
            try:
                cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = ?", (product_id,))
                has_metadata = cursor.fetchone()
                if not has_metadata:
                    # Product exists but has no metadata - extract it
                    extract_metadata_for_product(product_id, auto_sync_category=True)
            except Exception as e:
                print(f"Warning: Metadata check/extraction failed for existing product {product_id}: {e}")
        
        # Ensure approved_shipment exists for this pending shipment (for auto-add mode)
        cursor.execute("""
            SELECT shipment_id FROM approved_shipments
            WHERE pending_shipment_id = ?
        """, (pending_shipment_id,))
        
        approved_shipment = cursor.fetchone()
        if not approved_shipment:
            # Create approved shipment record
            cursor.execute("""
                INSERT INTO approved_shipments
                (pending_shipment_id, vendor_id, purchase_order_number, 
                 received_date, approved_by, total_items_received, total_cost,
                 has_issues, issue_count)
                SELECT 
                    ?,
                    vendor_id,
                    purchase_order_number,
                    DATE('now'),
                    ?,
                    0,
                    0,
                    0,
                    0
                FROM pending_shipments
                WHERE pending_shipment_id = ?
            """, (pending_shipment_id, employee_id, pending_shipment_id))
            approved_shipment_id = cursor.lastrowid
        else:
            approved_shipment = dict(approved_shipment)
            approved_shipment_id = approved_shipment['shipment_id']
        
        # Add quantity to inventory
        cursor.execute("""
            UPDATE inventory
            SET current_quantity = current_quantity + ?,
                vendor_id = ?,
                vendor = ?,
                last_restocked = CURRENT_TIMESTAMP
            WHERE product_id = ?
        """, (quantity_verified, vendor_id, vendor_name, product_id))
        
        # Check if item already in approved_shipment_items for this specific pending item
        # In auto-add mode, we track by product_id only (one record per product per shipment)
        cursor.execute("""
            SELECT approved_item_id, quantity_received FROM approved_shipment_items
            WHERE shipment_id = ? AND product_id = ?
            LIMIT 1
        """, (approved_shipment_id, product_id))
        
        existing_item = cursor.fetchone()
        if existing_item:
            # Update existing record - add to quantity
            cursor.execute("""
                UPDATE approved_shipment_items
                SET quantity_received = quantity_received + ?,
                    received_by = ?
                WHERE approved_item_id = ?
            """, (quantity_verified, employee_id, existing_item['approved_item_id']))
        else:
            # Insert new record
            cursor.execute("""
                INSERT INTO approved_shipment_items
                (shipment_id, product_id, quantity_received, unit_cost, 
                 lot_number, expiration_date, received_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (approved_shipment_id, product_id, quantity_verified, 
                  item.get('unit_cost', 0.0), item.get('lot_number'), 
                  item.get('expiration_date'), employee_id))
        
        # Update approved_shipment totals
        cursor.execute("""
            UPDATE approved_shipments
            SET total_items_received = (
                SELECT COALESCE(SUM(quantity_received), 0) FROM approved_shipment_items
                WHERE shipment_id = ?
            ),
            total_cost = (
                SELECT COALESCE(SUM(quantity_received * unit_cost), 0) FROM approved_shipment_items
                WHERE shipment_id = ?
            )
            WHERE shipment_id = ?
        """, (approved_shipment_id, approved_shipment_id, approved_shipment_id))
        
        conn.commit()
        conn.close()
        
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
    employee_id: Optional[int] = None
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
                    WHERE psi.pending_item_id = ?
                """, (pending_item_id,))
                item = cursor.fetchone()
                if item:
                    item = dict(item)
                    expected = item['quantity_expected']
                    current_verified = item['quantity_verified']
                    verification_mode = item.get('verification_mode', 'verify_whole_shipment')
                    pending_shipment_id = item['pending_shipment_id']
            
            updates = []
            values = []
            
            if quantity_verified is not None:
                updates.append("quantity_verified = ?")
                values.append(quantity_verified)
                # Update verified_by and verified_at when quantity changes
                if employee_id is not None:
                    updates.append("verified_by = ?")
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
                updates.append("product_id = ?")
                values.append(product_id)
            
            if discrepancy_notes is not None:
                updates.append("discrepancy_notes = ?")
                values.append(discrepancy_notes)
            
            if not updates:
                conn.close()
                return False
            
            values.append(pending_item_id)
            query = f"UPDATE pending_shipment_items SET {', '.join(updates)} WHERE pending_item_id = ?"
            
            cursor.execute(query, values)
            conn.commit()
            success = cursor.rowcount > 0
            
            # Extract metadata if product was matched/created
            if success and product_id is not None:
                try:
                    cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = ?", (product_id,))
                    has_metadata = cursor.fetchone()
                    if not has_metadata:
                        # Extract metadata for newly matched product
                        extract_metadata_for_product(product_id, auto_sync_category=True)
                except Exception as e:
                    print(f"Warning: Metadata extraction failed for product {product_id}: {e}")
            
            # If auto-add mode and quantity was updated, add to inventory immediately
            if success and verification_mode == 'auto_add' and quantity_verified is not None and quantity_verified > 0 and employee_id:
                conn.close()  # Close current connection first
                try:
                    # Add to inventory immediately
                    result = add_item_to_inventory_immediately(pending_item_id, employee_id)
                    if not result.get('success'):
                        print(f"ERROR: Failed to add item to inventory in auto-add mode: {result.get('message', 'Unknown error')}")
                        import traceback
                        traceback.print_exc()
                    else:
                        print(f"SUCCESS: Added {result.get('quantity_added', 0)} units of product {result.get('product_id')} to inventory")
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
            
        except sqlite3.OperationalError as e:
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
            WHERE pending_shipment_id = ?
        """, (pending_shipment_id,))
        pending_row = cursor.fetchone()
        
        if not pending_row:
            conn.rollback()
            conn.close()
            raise ValueError(f"Pending shipment {pending_shipment_id} not found")
        
        pending = dict(pending_row)
        
        if pending['status'] != 'pending_review':
            conn.rollback()
            conn.close()
            raise ValueError(f"Pending shipment {pending_shipment_id} is not in pending_review status")
        
        # Create actual shipment
        received_date = datetime.now().date().isoformat()
        cursor.execute("""
            INSERT INTO shipments 
            (vendor_id, shipment_date, received_date, purchase_order_number, tracking_number, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (pending['vendor_id'], pending['expected_date'], received_date,
              pending.get('purchase_order_number'), pending.get('tracking_number'),
              notes or pending.get('notes')))
        
        shipment_id = cursor.lastrowid
        
        # Transfer items (use verified quantity if available, otherwise expected)
        cursor.execute("""
            INSERT INTO shipment_items 
            (shipment_id, product_id, quantity_received, unit_cost, lot_number, expiration_date)
            SELECT 
                ?,
                COALESCE(psi.product_id, 
                    (SELECT product_id FROM inventory WHERE sku = psi.product_sku LIMIT 1)),
                COALESCE(psi.quantity_verified, psi.quantity_expected),
                psi.unit_cost,
                psi.lot_number,
                psi.expiration_date
            FROM pending_shipment_items psi
            WHERE psi.pending_shipment_id = ?
            AND COALESCE(psi.quantity_verified, psi.quantity_expected) > 0
        """, (shipment_id, pending_shipment_id))
        
        # Update pending shipment status
        cursor.execute("""
            UPDATE pending_shipments
            SET status = 'approved',
                reviewed_by = ?,
                reviewed_date = CURRENT_TIMESTAMP,
                notes = ?
            WHERE pending_shipment_id = ?
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
                WHERE si.shipment_id = ? 
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
                old_values={'status': 'pending_review'},
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
            reviewed_by = ?,
            reviewed_date = CURRENT_TIMESTAMP,
            notes = ?
        WHERE pending_shipment_id = ?
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
        WHERE pending_shipment_id = ?
    """, (pending_shipment_id,))
    
    items = cursor.fetchall()
    
    matched = 0
    unmatched = 0
    
    for item in items:
        # Try to find matching product
        cursor.execute("SELECT product_id FROM inventory WHERE sku = ?", (item['product_sku'],))
        product_row = cursor.fetchone()
        
        if product_row:
            cursor.execute("""
                UPDATE pending_shipment_items
                SET product_id = ?
                WHERE pending_item_id = ?
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
        WHERE e.employee_id = ?
    """, (employee_id,))
    role = cursor.fetchone()
    if role and role[0] and 'admin' in role[0].lower():
        return True
    
    # Check by position
    cursor.execute("SELECT position FROM employees WHERE employee_id = ?", (employee_id,))
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
    pin_code: Optional[str] = None
) -> int:
    """Add a new employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Validate admin password (must be numeric only)
    if password:
        is_admin = False
        # Check if role is admin
        if role_id:
            cursor.execute("SELECT role_name FROM roles WHERE role_id = ?", (role_id,))
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
        # Check if table has username column (RBAC migration)
        cursor.execute("PRAGMA table_info(employees)")
        columns = [col[1] for col in cursor.fetchall()]
        has_username = 'username' in columns
        has_role_id = 'role_id' in columns
        has_pin_code = 'pin_code' in columns
        
        if has_username:
            # Use username column
            if has_role_id and has_pin_code:
                cursor.execute("""
                    INSERT INTO employees (
                        username, first_name, last_name, email, phone, position, department,
                        date_started, password_hash, hourly_rate, salary, employment_type, address,
                        emergency_contact_name, emergency_contact_phone, notes, role_id, pin_code
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (login_identifier, first_name, last_name, email, phone, position, department,
                      date_started, password_hash, hourly_rate, salary, employment_type, address,
                      emergency_contact_name, emergency_contact_phone, notes, role_id, pin_code))
            else:
                cursor.execute("""
                    INSERT INTO employees (
                        username, first_name, last_name, email, phone, position, department,
                        date_started, password_hash, hourly_rate, salary, employment_type, address,
                        emergency_contact_name, emergency_contact_phone, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (login_identifier, first_name, last_name, email, phone, position, department,
                      date_started, password_hash, hourly_rate, salary, employment_type, address,
                      emergency_contact_name, emergency_contact_phone, notes))
        else:
            # Fall back to employee_code
            cursor.execute("""
                INSERT INTO employees (
                    employee_code, first_name, last_name, email, phone, position, department,
                    date_started, password_hash, hourly_rate, salary, employment_type, address,
                    emergency_contact_name, emergency_contact_phone, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (login_identifier, first_name, last_name, email, phone, position, department,
                  date_started, password_hash, hourly_rate, salary, employment_type, address,
                  emergency_contact_name, emergency_contact_phone, notes))
        
        conn.commit()
        employee_id = cursor.lastrowid
        conn.close()
        return employee_id
    except sqlite3.IntegrityError as e:
        conn.rollback()
        conn.close()
        raise ValueError(f"Employee identifier '{login_identifier}' already exists") from e

def get_employee(employee_id: int) -> Optional[Dict[str, Any]]:
    """Get employee by ID with tip summary"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
    
    employee = dict(row)
    
    # Get tip summary if employee_tips table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='employee_tips'
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
            WHERE employee_id = ?
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
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if employee_tips table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='employee_tips'
    """)
    has_tips_table = cursor.fetchone() is not None
    
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
    conn.close()
    
    return [dict(row) for row in rows]

def update_employee(employee_id: int, **kwargs) -> bool:
    """Update employee information"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if table has RBAC columns
    cursor.execute("PRAGMA table_info(employees)")
    columns = [col[1] for col in cursor.fetchall()]
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
            updates.append(f"{field} = ?")
            values.append(value)
    
    # Handle password update
    if password:
        password_hash = hash_password(password)
        updates.append("password_hash = ?")
        values.append(password_hash)
    
    if not updates:
        conn.close()
        return False
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(employee_id)
    
    query = f"UPDATE employees SET {', '.join(updates)} WHERE employee_id = ?"
    
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
            date_terminated = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = ?
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
        VALUES (?, ?, ?)
    """, (customer_name, email, phone))
    
    conn.commit()
    customer_id = cursor.lastrowid
    conn.close()
    
    return customer_id

def get_customer(customer_id: int) -> Optional[Dict[str, Any]]:
    """Get customer by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,))
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
    tip: float = 0.0
) -> Dict[str, Any]:
    """
    Create a new order and process payment
    
    items: List of dicts with keys: product_id, quantity, unit_price, discount (optional), tax_rate (optional)
    payment_method: 'cash', 'credit_card', 'debit_card', 'mobile_payment', 'check', 'store_credit'
    tax_rate: Tax rate as decimal (e.g., 0.08 for 8%)
    transaction_fee_rates: Optional dict to override default fee rates
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Validate inventory availability first
        for item in items:
            product_id = item['product_id']
            quantity = item['quantity']
            
            cursor.execute("SELECT current_quantity FROM inventory WHERE product_id = ?", (product_id,))
            row = cursor.fetchone()
            
            if not row:
                conn.rollback()
                conn.close()
                return {
                    'success': False,
                    'message': f'Product ID {product_id} not found',
                    'order_id': None
                }
            
            available_qty = row['current_quantity']
            if available_qty < quantity:
                conn.rollback()
                conn.close()
                return {
                    'success': False,
                    'message': f'Insufficient inventory for product_id {product_id}. Available: {available_qty}, Requested: {quantity}',
                    'order_id': None
                }
        
        # Generate order number
        order_number = generate_order_number()
        
        # Calculate subtotal and tax for each item
        subtotal = 0.0
        total_tax = 0.0
        
        for item in items:
            item_qty = item['quantity']
            item_price = item['unit_price']
            item_discount = item.get('discount', 0.0)
            item_tax_rate = item.get('tax_rate', tax_rate)  # Item-specific tax rate or use order tax rate
            item_subtotal = (item_qty * item_price) - item_discount
            item_tax = item_subtotal * item_tax_rate
            
            subtotal += item_subtotal
            total_tax += item_tax
        
        # Calculate transaction fee (on subtotal + tax - discount, before tip)
        pre_fee_total = subtotal + total_tax - discount
        fee_calc = calculate_transaction_fee(payment_method, pre_fee_total, transaction_fee_rates)
        transaction_fee = fee_calc['transaction_fee']
        
        # Calculate final total (including transaction fee and tip)
        total = pre_fee_total + transaction_fee + tip
        
        # Create order - check if tip column exists
        cursor.execute("PRAGMA table_info(orders)")
        columns = [col[1] for col in cursor.fetchall()]
        has_tip = 'tip' in columns
        
        if has_tip:
            cursor.execute("""
                INSERT INTO orders (
                    order_number, employee_id, customer_id, subtotal, tax_rate, tax_amount, 
                    discount, transaction_fee, tip, total, payment_method, payment_status, order_status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'completed', ?)
            """, (order_number, employee_id, customer_id, subtotal, tax_rate, total_tax,
                  discount, transaction_fee, tip, total, payment_method, notes))
        else:
            # Fallback for older schema
            cursor.execute("""
                INSERT INTO orders (
                    order_number, employee_id, customer_id, subtotal, tax_rate, tax_amount, 
                    discount, transaction_fee, total, payment_method, payment_status, order_status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'completed', ?)
            """, (order_number, employee_id, customer_id, subtotal, tax_rate, total_tax,
                  discount, transaction_fee, total, payment_method, notes))
        
        order_id = cursor.lastrowid
        
        # Add order items (triggers will update inventory)
        for item in items:
            product_id = item['product_id']
            quantity = item['quantity']
            unit_price = item['unit_price']
            item_discount = item.get('discount', 0.0)
            item_tax_rate = item.get('tax_rate', tax_rate)
            item_subtotal = (quantity * unit_price) - item_discount
            item_tax = item_subtotal * item_tax_rate
            
            cursor.execute("""
                INSERT INTO order_items (
                    order_id, product_id, quantity, unit_price, discount, subtotal,
                    tax_rate, tax_amount
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (order_id, product_id, quantity, unit_price, item_discount, item_subtotal,
                  item_tax_rate, item_tax))
        
        # Record payment transaction with fee details and tip
        # Check if tip and employee_id columns exist
        cursor.execute("PRAGMA table_info(payment_transactions)")
        columns = [col[1] for col in cursor.fetchall()]
        has_tip = 'tip' in columns
        has_employee_id = 'employee_id' in columns
        
        if has_tip and has_employee_id:
            cursor.execute("""
                INSERT INTO payment_transactions (
                    order_id, payment_method, amount, transaction_fee, transaction_fee_rate,
                    net_amount, status, tip, employee_id
                ) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?)
            """, (order_id, payment_method, pre_fee_total, transaction_fee, 
                  fee_calc['fee_rate'], fee_calc['net_amount'], tip, employee_id))
        else:
            # Fallback for older schema
            cursor.execute("""
                INSERT INTO payment_transactions (
                    order_id, payment_method, amount, transaction_fee, transaction_fee_rate,
                    net_amount, status
                ) VALUES (?, ?, ?, ?, ?, ?, 'approved')
            """, (order_id, payment_method, pre_fee_total, transaction_fee, 
                  fee_calc['fee_rate'], fee_calc['net_amount']))
        
        transaction_id = cursor.lastrowid
        
        # Record tip in employee_tips table if tip exists
        if tip > 0:
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='employee_tips'
            """)
            if cursor.fetchone():
                cursor.execute("""
                    INSERT INTO employee_tips (
                        employee_id, order_id, transaction_id, tip_amount, payment_method
                    ) VALUES (?, ?, ?, ?, ?)
                """, (employee_id, order_id, transaction_id, tip, payment_method))
        
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
        WHERE o.order_id = ?
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
        WHERE oi.order_id = ?
    """, (order_id,))
    
    items = [dict(row) for row in cursor.fetchall()]
    
    # Get payment transactions
    cursor.execute("""
        SELECT * FROM payment_transactions
        WHERE order_id = ?
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
            WHERE order_id = ?
        """, (order_id,))
        
        items = cursor.fetchall()
        
        if not items:
            conn.close()
            return {'success': False, 'message': 'Order not found or has no items'}
        
        # Check if order is already voided
        cursor.execute("SELECT order_status FROM orders WHERE order_id = ?", (order_id,))
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
                SET current_quantity = current_quantity + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
            """, (item['quantity'], item['product_id']))
        
        # Update order status
        notes_text = f"\nVoided by employee_id {employee_id} on {datetime.now().isoformat()}"
        if reason:
            notes_text += f". Reason: {reason}"
        
        cursor.execute("""
            UPDATE orders
            SET order_status = 'voided',
                notes = COALESCE(notes, '') || ?
            WHERE order_id = ?
        """, (notes_text, order_id))
        
        # Update payment status
        cursor.execute("""
            UPDATE payment_transactions
            SET status = 'refunded'
            WHERE order_id = ?
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
                WHERE order_item_id = ?
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
                SET current_quantity = current_quantity + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
            """, (return_qty, original['product_id']))
            
            # Update order item quantity if partial return
            if return_qty < original['quantity']:
                new_qty = original['quantity'] - return_qty
                new_subtotal = (original['unit_price'] * new_qty) - original['discount']
                
                cursor.execute("""
                    UPDATE order_items
                    SET quantity = ?,
                        subtotal = ?
                    WHERE order_item_id = ?
                """, (new_qty, new_subtotal, order_item_id))
            else:
                # Full return - delete item
                cursor.execute("""
                    DELETE FROM order_items
                    WHERE order_item_id = ?
                """, (order_item_id,))
        
        # Update order total
        notes_text = f"\nReturn processed by employee_id {employee_id} on {datetime.now().isoformat()}"
        if reason:
            notes_text += f". Reason: {reason}"
        notes_text += f". Refund: ${total_refund:.2f}"
        
        cursor.execute("""
            UPDATE orders
            SET total = total - ?,
                subtotal = subtotal - ?,
                order_status = 'returned',
                notes = COALESCE(notes, '') || ?
            WHERE order_id = ?
        """, (total_refund, total_refund, notes_text, order_id))
        
        # Record refund transaction
        cursor.execute("""
            INSERT INTO payment_transactions (
                order_id, payment_method, amount, status
            ) VALUES (?, 'refund', ?, 'refunded')
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
        cursor.execute("SELECT order_id, order_number FROM orders WHERE order_id = ?", (order_id,))
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
            WHERE order_id = ? AND return_number LIKE ?
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
                WHERE oi.order_item_id = ?
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (return_number, order_id, employee_id, customer_id, total_refund, reason, notes))
        
        return_id = cursor.lastrowid
        
        # Create return items
        for item in return_items:
            cursor.execute("""
                INSERT INTO pending_return_items (
                    return_id, order_item_id, product_id, quantity,
                    unit_price, discount, refund_amount, condition, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            WHERE pr.return_id = ?
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
            WHERE pri.return_id = ?
        """, (return_id,))
        
        return_items = [dict(row) for row in cursor.fetchall()]
        
        if not return_items:
            conn.close()
            return {'success': False, 'message': 'No items found for return'}
        
        # Return items to inventory
        for item in return_items:
            cursor.execute("""
                UPDATE inventory
                SET current_quantity = current_quantity + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
            """, (item['quantity'], item['product_id']))
        
        # Update order items (reduce quantities or delete)
        order_id = return_record['order_id']
        for item in return_items:
            # Get current order item quantity
            cursor.execute("""
                SELECT quantity FROM order_items WHERE order_item_id = ?
            """, (item['order_item_id'],))
            
            current = cursor.fetchone()
            if current:
                current_qty = current['quantity']
                new_qty = current_qty - item['quantity']
                
                if new_qty <= 0:
                    # Delete item if fully returned
                    cursor.execute("DELETE FROM order_items WHERE order_item_id = ?", (item['order_item_id'],))
                else:
                    # Update quantity
                    cursor.execute("""
                        UPDATE order_items
                        SET quantity = ?,
                            subtotal = (unit_price * ?) - discount
                        WHERE order_item_id = ?
                    """, (new_qty, new_qty, item['order_item_id']))
        
        # Update order totals
        total_refund = return_record['total_refund_amount']
        notes_text = f"\nReturn approved by employee_id {approved_by} on {datetime.now().isoformat()}"
        if notes:
            notes_text += f". Notes: {notes}"
        notes_text += f". Refund: ${total_refund:.2f}"
        
        cursor.execute("""
            UPDATE orders
            SET total = total - ?,
                subtotal = subtotal - ?,
                order_status = CASE 
                    WHEN (SELECT COUNT(*) FROM order_items WHERE order_id = ?) = 0 
                    THEN 'returned' 
                    ELSE order_status 
                END,
                notes = COALESCE(notes, '') || ?
            WHERE order_id = ?
        """, (total_refund, total_refund, order_id, notes_text, order_id))
        
        # Record refund transaction
        cursor.execute("""
            INSERT INTO payment_transactions (
                order_id, payment_method, amount, status
            ) VALUES (?, 'refund', ?, 'refunded')
        """, (order_id, -total_refund))
        
        # Update return status
        cursor.execute("""
            UPDATE pending_returns
            SET status = 'approved',
                approved_by = ?,
                approved_date = CURRENT_TIMESTAMP,
                notes = COALESCE(notes, '') || ?
            WHERE return_id = ?
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
                approved_by = ?,
                approved_date = CURRENT_TIMESTAMP,
                notes = COALESCE(notes, '') || ?
            WHERE return_id = ? AND status = 'pending'
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
        WHERE pr.return_id = ?
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
        WHERE pri.return_id = ?
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
        query += " AND pr.status = ?"
        params.append(status)
    
    if order_id:
        query += " AND pr.order_id = ?"
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
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if receipt_preferences table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='receipt_preferences'
    """)
    has_receipt_prefs = cursor.fetchone() is not None
    
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
                rp.phone_number as receipt_phone,
                rp.sent as receipt_sent,
                rp.sent_at as receipt_sent_at
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
        query += " AND DATE(o.order_date) >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND DATE(o.order_date) <= ?"
        params.append(end_date)
    
    if employee_id:
        query += " AND o.employee_id = ?"
        params.append(employee_id)
    
    if order_status:
        query += " AND o.order_status = ?"
        params.append(order_status)
    
    query += " ORDER BY o.order_date DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

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
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='employee_tips'
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
            query += " AND et.employee_id = ?"
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
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='employee_tips'
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
            WHERE et.employee_id = ?
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
            WHERE COALESCE(pt.employee_id, o.employee_id) = ?
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
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='employee_tips'
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
            WHERE et.employee_id = ?
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
            WHERE COALESCE(pt.employee_id, o.employee_id) = ?
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
        ) VALUES (?, ?, ?, ?, ?, ?)
    """, (employee_id, schedule_date, start_time, end_time, break_duration, notes))
    
    conn.commit()
    schedule_id = cursor.lastrowid
    conn.close()
    
    return schedule_id

def clock_in(employee_id: int, schedule_id: Optional[int] = None, schedule_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Clock in an employee
    If schedule_id is provided, updates that schedule. Otherwise creates a new one.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        if schedule_id:
            # Update existing schedule
            cursor.execute("""
                UPDATE employee_schedule
                SET clock_in_time = CURRENT_TIMESTAMP,
                    status = 'clocked_in'
                WHERE schedule_id = ? AND employee_id = ?
            """, (schedule_id, employee_id))
            
            if cursor.rowcount == 0:
                conn.close()
                return {'success': False, 'message': 'Schedule not found'}
        else:
            # Create new schedule entry
            if not schedule_date:
                schedule_date = datetime.now().date().isoformat()
            
            cursor.execute("""
                INSERT INTO employee_schedule (
                    employee_id, schedule_date, clock_in_time, status
                ) VALUES (?, ?, CURRENT_TIMESTAMP, 'clocked_in')
            """, (employee_id, schedule_date))
            
            schedule_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'schedule_id': schedule_id,
            'message': 'Clocked in successfully'
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
            WHERE schedule_id = ? AND employee_id = ?
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
                hours_worked = ?,
                overtime_hours = ?,
                status = 'clocked_out'
            WHERE schedule_id = ? AND employee_id = ?
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
        query += " AND es.employee_id = ?"
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
        WHERE es.employee_id = ? 
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
        cursor.execute("""
            INSERT INTO master_calendar (
                event_date, event_type, title, description, start_time, end_time,
                related_id, related_table, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (event_date, event_type, title, description, start_time, end_time,
              related_id, related_table, created_by))
        
        calendar_id = cursor.lastrowid
        
        # If employee_ids provided, assign event to specific employees
        if employee_ids:
            for employee_id in employee_ids:
                cursor.execute("""
                    INSERT INTO calendar_event_employees (calendar_id, employee_id)
                    VALUES (?, ?)
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
    conn = get_connection()
    cursor = conn.cursor()
    
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
        query += " AND c.event_date >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND c.event_date <= ?"
        params.append(end_date)
    
    if event_type:
        query += " AND c.event_type = ?"
        params.append(event_type)
    
    query += " ORDER BY c.event_date, c.start_time"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def add_shipment_to_calendar(shipment_id: int, shipment_date: str) -> int:
    """Add a shipment to the calendar"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get shipment details
    cursor.execute("""
        SELECT s.*, v.vendor_name
        FROM shipments s
        JOIN vendors v ON s.vendor_id = v.vendor_id
        WHERE s.shipment_id = ?
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
        WHERE s.received_date >= ? AND s.received_date <= ?
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
    conn = get_connection()
    cursor = conn.cursor()
    
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
    cursor.execute("PRAGMA table_info(employees)")
    columns = [col[1] for col in cursor.fetchall()]
    has_username = 'username' in columns
    
    # Verify credentials - try username first if available, then employee_code
    if has_username:
        cursor.execute("""
            SELECT employee_id, first_name, last_name, position, active, password_hash, username, employee_code
            FROM employees
            WHERE username = ? OR employee_code = ?
        """, (login_identifier, login_identifier))
    else:
        cursor.execute("""
            SELECT employee_id, first_name, last_name, position, active, password_hash, employee_code
            FROM employees
            WHERE employee_code = ?
        """, (login_identifier,))
    
    employee = cursor.fetchone()
    
    if not employee:
        conn.close()
        return {'success': False, 'message': 'Invalid credentials'}
    
    employee = dict(employee)
    
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
    
    # Create session record
    cursor.execute("""
        INSERT INTO employee_sessions (
            employee_id, session_token, ip_address, device_info
        ) VALUES (?, ?, ?, ?)
    """, (employee['employee_id'], session_token, ip_address, device_info))
    
    # Update last login
    cursor.execute("""
        UPDATE employees
        SET last_login = CURRENT_TIMESTAMP
        WHERE employee_id = ?
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
        WHERE e.employee_id = ? AND e.active = 1
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
            SET role_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = ?
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
    if not session_token:
        return {'valid': False, 'message': 'Session token is required'}
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT es.*, e.first_name, e.last_name, e.position, e.active
        FROM employee_sessions es
        JOIN employees e ON es.employee_id = e.employee_id
        WHERE es.session_token = ? 
          AND es.is_active = 1
          AND e.active = 1
    """, (session_token,))
    
    session = cursor.fetchone()
    conn.close()
    
    if session:
        session = dict(session)
        return {
            'valid': True,
            'employee_id': session['employee_id'],
            'employee_name': f"{session['first_name']} {session['last_name']}",
            'position': session['position']
        }
    
    return {'valid': False}

def employee_logout(session_token: str) -> Dict[str, Any]:
    """End employee session"""
    if not session_token:
        return {'success': False, 'message': 'Session token is required'}
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get employee_id before logout
    cursor.execute("SELECT employee_id FROM employee_sessions WHERE session_token = ?", (session_token,))
    session = cursor.fetchone()
    
    if session:
        employee_id = dict(session)['employee_id']
        
        cursor.execute("""
            UPDATE employee_sessions
            SET is_active = 0,
                logout_time = CURRENT_TIMESTAMP
            WHERE session_token = ?
        """, (session_token,))
        
        conn.commit()
        conn.close()
        
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
    
    conn.close()
    return {'success': False, 'message': 'Session not found'}

def change_employee_password(employee_id: int, old_password: str, new_password: str) -> Dict[str, Any]:
    """Change employee password"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Verify old password
    cursor.execute("SELECT password_hash FROM employees WHERE employee_id = ?", (employee_id,))
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
        SET password_hash = ?
        WHERE employee_id = ?
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
        WHERE employee_id = ? 
          AND clock_out IS NULL
    """, (employee_id,))
    
    if cursor.fetchone():
        conn.close()
        return {'success': False, 'message': 'Already clocked in'}
    
    # Clock in
    cursor.execute("""
        INSERT INTO time_clock (employee_id, clock_in, status)
        VALUES (?, CURRENT_TIMESTAMP, 'clocked_in')
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
        WHERE employee_id = ? 
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
            total_hours = ?
        WHERE time_entry_id = ?
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
        WHERE employee_id = ? 
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
        WHERE employee_id = ? 
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
        WHERE employee_id = ?
          AND DATE(clock_in) >= ? AND DATE(clock_in) <= ?
        ORDER BY clock_in DESC
    """, (employee_id, start_date, end_date))
    
    timesheet = [dict(row) for row in cursor.fetchall()]
    
    # Calculate total hours
    cursor.execute("""
        SELECT SUM(total_hours) as total
        FROM time_clock
        WHERE employee_id = ?
          AND DATE(clock_in) >= ? AND DATE(clock_in) <= ?
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
    
    cursor.execute("""
        INSERT INTO audit_log (
            table_name, record_id, action_type, employee_id,
            old_values, new_values, ip_address, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        query += " AND al.table_name = ?"
        params.append(table_name)
    
    if record_id:
        query += " AND al.record_id = ?"
        params.append(record_id)
    
    if employee_id:
        query += " AND al.employee_id = ?"
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
                ) VALUES (?, ?, ?, ?, ?)
            """, (account_number, account_name, account_type, account_subtype, normal_balance))
            added += 1
        except sqlite3.IntegrityError:
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (account_number, account_name, account_type, account_subtype,
              normal_balance, parent_account_id, description))
        
        conn.commit()
        account_id = cursor.lastrowid
        conn.close()
        return account_id
    except sqlite3.IntegrityError as e:
        conn.rollback()
        conn.close()
        raise ValueError(f"Account number '{account_number}' already exists") from e

def get_account_by_number(account_number: str) -> Optional[Dict[str, Any]]:
    """Get account by account number"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM chart_of_accounts WHERE account_number = ?", (account_number,))
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
            WHERE strftime('%Y', entry_date) = strftime('%Y', ?)
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
                ) VALUES (?, ?, ?, ?, ?, ?)
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
        WHERE journal_entry_id = ?
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
    cursor.execute("PRAGMA table_info(orders)")
    columns = [col[1] for col in cursor.fetchall()]
    has_tip = 'tip' in columns
    
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
            WHERE o.order_id = ?
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
            WHERE o.order_id = ?
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
        WHERE order_id = ?
        LIMIT 1
    """, (order_id,))
    
    payment = cursor.fetchone()
    payment = dict(payment) if payment else {'net_amount': order['total'], 'transaction_fee': order.get('transaction_fee', 0.0)}
    
    # Get COGS
    cursor.execute("""
        SELECT SUM(oi.quantity * i.product_cost) as cogs
        FROM order_items oi
        JOIN inventory i ON oi.product_id = i.product_id
        WHERE oi.order_id = ?
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
        WHERE si.shipment_id = ?
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (shipment_id, pending_shipment_id, product_id, discrepancy_type,
          expected_quantity, actual_quantity, discrepancy_qty,
          expected_product_sku, actual_product_sku, financial_impact,
          employee_id, notes, photos_json))
    
    discrepancy_id = cursor.lastrowid
    
    # Update pending shipment item if applicable
    if pending_shipment_id:
        cursor.execute("""
            UPDATE pending_shipment_items
            SET discrepancy_notes = ?
            WHERE pending_shipment_id = ? AND product_id = ?
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
        WHERE discrepancy_id = ?
    """, (discrepancy_id,))
    
    discrepancy = cursor.fetchone()
    if not discrepancy:
        conn.close()
        return {'success': False, 'message': 'Discrepancy not found'}
    
    discrepancy = dict(discrepancy)
    
    # Update discrepancy status
    cursor.execute("""
        UPDATE shipment_discrepancies
        SET resolution_status = ?,
            resolved_by = ?,
            resolved_date = CURRENT_TIMESTAMP,
            resolution_notes = ?,
            vendor_notified = ?,
            vendor_response = ?,
            claim_number = ?
        WHERE discrepancy_id = ?
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
        query += " AND sd.shipment_id = ?"
        params.append(shipment_id)
    
    if pending_shipment_id:
        query += " AND sd.pending_shipment_id = ?"
        params.append(pending_shipment_id)
    
    if resolution_status:
        query += " AND sd.resolution_status = ?"
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
          AND je.entry_date BETWEEN ? AND ?
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
        VALUES (?, ?, ?)
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
        WHERE period_id = ?
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
        ) VALUES (?, ?, ?, ?, ?)
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
        
        # Update shipment status (try with started_by/started_at if columns exist, otherwise just status)
        try:
            cursor.execute("""
                UPDATE pending_shipments 
                SET status = 'in_progress',
                    started_by = ?,
                    started_at = CURRENT_TIMESTAMP
                WHERE pending_shipment_id = ?
            """, (employee_id, pending_shipment_id))
        except sqlite3.OperationalError as e:
            # Columns might not exist, try without them
            if 'no such column' in str(e).lower():
                cursor.execute("""
                    UPDATE pending_shipments 
                    SET status = 'in_progress'
                    WHERE pending_shipment_id = ?
                """, (pending_shipment_id,))
            else:
                raise
        
        # Create session
        cursor.execute("""
            INSERT INTO verification_sessions 
            (pending_shipment_id, employee_id, device_id)
            VALUES (?, ?, ?)
        """, (pending_shipment_id, employee_id, device_id))
        
        session_id = cursor.lastrowid
        
        # Get shipment details
        cursor.execute("""
            SELECT ps.*, v.vendor_name,
                   (SELECT COUNT(*) FROM pending_shipment_items WHERE pending_shipment_id = ps.pending_shipment_id) as total_items
            FROM pending_shipments ps
            LEFT JOIN vendors v ON ps.vendor_id = v.vendor_id
            WHERE ps.pending_shipment_id = ?
        """, (pending_shipment_id,))
        
        shipment = cursor.fetchone()
        
        conn.commit()
        
        return {
            'session_id': session_id,
            'shipment': dict(shipment) if shipment else None
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
    
    # Find matching item in pending shipment
    cursor.execute("""
        SELECT psi.*, i.product_id, i.product_name as inventory_name
        FROM pending_shipment_items psi
        LEFT JOIN inventory i ON (psi.product_sku = i.sku OR psi.barcode = i.barcode OR i.barcode = ?)
        WHERE psi.pending_shipment_id = ? 
        AND (psi.barcode = ? OR psi.product_sku = ? OR i.barcode = ?)
        AND psi.status != 'verified'
    """, (barcode, pending_shipment_id, barcode, barcode, barcode))
    
    item = cursor.fetchone()
    
    scan_result = 'unknown'
    response = {}
    pending_item_id = None
    
    if item:
        item = dict(item)
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
                SET quantity_verified = ?,
                    verified_by = ?,
                    verified_at = CURRENT_TIMESTAMP,
                    status = ?
                WHERE pending_item_id = ?
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
                    WHERE session_id = ?
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
        VALUES (?, ?, ?, ?, ?, ?, ?)
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
    
    # Create issue record
    cursor.execute("""
        INSERT INTO shipment_issues
        (pending_shipment_id, pending_item_id, issue_type, severity,
         quantity_affected, reported_by, description, photo_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (pending_shipment_id, pending_item_id, issue_type, severity,
          quantity_affected, employee_id, description, photo_path))
    
    issue_id = cursor.lastrowid
    
    # Mark item as having issue if pending_item_id provided
    if pending_item_id:
        cursor.execute("""
            UPDATE pending_shipment_items
            SET status = 'issue',
                discrepancy_notes = COALESCE(discrepancy_notes || '\n', '') || 'Issue reported: ' || ?
            WHERE pending_item_id = ?
        """, (description, pending_item_id))
    
    # Update session stats
    cursor.execute("""
        UPDATE verification_sessions
        SET issues_reported = issues_reported + 1
        WHERE pending_shipment_id = ? 
        AND employee_id = ?
        AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
    """, (pending_shipment_id, employee_id))
    
    conn.commit()
    conn.close()
    
    return issue_id

def get_verification_progress(pending_shipment_id: int) -> Dict[str, Any]:
    """Get current verification progress"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Overall stats
    cursor.execute("""
        SELECT 
            COUNT(*) as total_items,
            COALESCE(SUM(quantity_expected), 0) as total_expected_quantity,
            COALESCE(SUM(quantity_verified), 0) as total_verified_quantity,
            SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as items_fully_verified,
            SUM(CASE WHEN status = 'issue' THEN 1 ELSE 0 END) as items_with_issues
        FROM pending_shipment_items
        WHERE pending_shipment_id = ?
    """, (pending_shipment_id,))
    
    progress = dict(cursor.fetchone())
    
    # Items still pending
    cursor.execute("""
        SELECT pending_item_id, product_sku, product_name, 
               quantity_expected, COALESCE(quantity_verified, 0) as quantity_verified,
               unit_cost, product_id, barcode, lot_number, expiration_date,
               (quantity_expected - COALESCE(quantity_verified, 0)) as remaining
        FROM pending_shipment_items
        WHERE pending_shipment_id = ?
        ORDER BY COALESCE(line_number, pending_item_id)
    """, (pending_shipment_id,))
    
    pending_items = [dict(row) for row in cursor.fetchall()]
    
    # Issues
    cursor.execute("""
        SELECT si.*, psi.product_name, psi.product_sku,
               e.first_name || ' ' || e.last_name as reported_by_name
        FROM shipment_issues si
        LEFT JOIN pending_shipment_items psi ON si.pending_item_id = psi.pending_item_id
        JOIN employees e ON si.reported_by = e.employee_id
        WHERE si.pending_shipment_id = ?
        ORDER BY si.reported_at DESC
    """, (pending_shipment_id,))
    
    issues = [dict(row) for row in cursor.fetchall()]
    
    # Get shipment info including workflow_step
    cursor.execute("""
        SELECT pending_shipment_id, status, workflow_step, added_to_inventory, vendor_id
        FROM pending_shipments
        WHERE pending_shipment_id = ?
    """, (pending_shipment_id,))
    shipment_row = cursor.fetchone()
    shipment = dict(shipment_row) if shipment_row else {}
    
    conn.close()
    
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
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if all items are verified or have issues
    cursor.execute("""
        SELECT COUNT(*) as unverified_count
        FROM pending_shipment_items
        WHERE pending_shipment_id = ? 
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
    
    # Get shipment info
    cursor.execute("""
        SELECT ps.*, 
               (SELECT COUNT(*) FROM shipment_issues WHERE pending_shipment_id = ps.pending_shipment_id) as issue_count,
               COALESCE(SUM(psi.quantity_verified), 0) as total_received,
               COALESCE(SUM(psi.quantity_verified * psi.unit_cost), 0) as total_cost
        FROM pending_shipments ps
        LEFT JOIN pending_shipment_items psi ON ps.pending_shipment_id = psi.pending_shipment_id
        WHERE ps.pending_shipment_id = ?
        GROUP BY ps.pending_shipment_id
    """, (pending_shipment_id,))
    
    shipment = dict(cursor.fetchone())
    
    # Check if approved shipment already exists (for auto-add mode)
    cursor.execute("""
        SELECT shipment_id FROM approved_shipments
        WHERE pending_shipment_id = ?
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
                WHERE shipment_id = ?
            ),
            total_cost = (
                SELECT COALESCE(SUM(quantity_received * unit_cost), 0) FROM approved_shipment_items
                WHERE shipment_id = ?
            ),
            approved_by = ?
            WHERE shipment_id = ?
        """, (approved_shipment_id, approved_shipment_id, employee_id, approved_shipment_id))
    else:
        # Create approved shipment
        cursor.execute("""
            INSERT INTO approved_shipments
            (pending_shipment_id, vendor_id, purchase_order_number, 
             received_date, approved_by, total_items_received, total_cost,
             has_issues, issue_count)
            VALUES (?, ?, ?, DATE('now'), ?, ?, ?, ?, ?)
        """, (pending_shipment_id, shipment['vendor_id'], 
              shipment.get('purchase_order_number'), employee_id,
              shipment['total_received'], shipment['total_cost'],
              1 if shipment['issue_count'] > 0 else 0, shipment['issue_count']))
        
        approved_shipment_id = cursor.lastrowid
    
    vendor_id = shipment['vendor_id']
    
    # Get vendor name for new products
    cursor.execute("SELECT vendor_name FROM vendors WHERE vendor_id = ?", (vendor_id,))
    vendor_row = cursor.fetchone()
    vendor_name = vendor_row['vendor_name'] if vendor_row else None
    
    # First, ensure product_id is set for all items by matching with inventory
    # Also update barcodes for existing products that don't have one
    cursor.execute("""
        UPDATE pending_shipment_items
        SET product_id = (
            SELECT product_id FROM inventory WHERE sku = pending_shipment_items.product_sku LIMIT 1
        )
        WHERE pending_shipment_id = ?
        AND product_id IS NULL
        AND product_sku IS NOT NULL
    """, (pending_shipment_id,))
    
    # Extract metadata for newly matched products (that now have product_id set)
    try:
        cursor.execute("""
            SELECT DISTINCT psi.product_id
            FROM pending_shipment_items psi
            LEFT JOIN product_metadata pm ON psi.product_id = pm.product_id
            WHERE psi.pending_shipment_id = ?
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
            AND psi.pending_shipment_id = ?
            AND psi.barcode IS NOT NULL AND psi.barcode != ''
            LIMIT 1
        )
        WHERE product_id IN (
            SELECT DISTINCT product_id FROM pending_shipment_items
            WHERE pending_shipment_id = ? AND product_id IS NOT NULL
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
        WHERE psi.pending_shipment_id = ?
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
            cursor.execute("SELECT product_id, barcode FROM inventory WHERE sku = ?", (sku,))
            existing = cursor.fetchone()
            if existing:
                new_product_id = existing['product_id']
                # Update barcode if product doesn't have one and we have one from shipment
                if (not existing['barcode'] or existing['barcode'].strip() == '') and barcode:
                    cursor.execute("""
                        UPDATE inventory 
                        SET barcode = ?
                        WHERE product_id = ?
                    """, (barcode, new_product_id))
                
                # Extract metadata if product doesn't have it yet
                try:
                    cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = ?", (new_product_id,))
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
                    (product_name, sku, barcode, product_price, product_cost, vendor, vendor_id, current_quantity, category)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)
                """, (product_name, sku, barcode, unit_cost, unit_cost, vendor_name, vendor_id))
                
                new_product_id = cursor.lastrowid
                
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
                SET product_id = ?
                WHERE pending_shipment_id = ?
                AND product_sku = ?
                AND product_id IS NULL
            """, (new_product_id, pending_shipment_id, sku))
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
            ?,
            psi.product_id,
            COALESCE(psi.quantity_verified, 0),
            psi.unit_cost,
            psi.lot_number,
            psi.expiration_date,
            ?
        FROM pending_shipment_items psi
        WHERE psi.pending_shipment_id = ?
        AND COALESCE(psi.quantity_verified, 0) > 0
        AND psi.product_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM approved_shipment_items asi
            WHERE asi.shipment_id = ? AND asi.product_id = psi.product_id
        )
    """, (approved_shipment_id, employee_id, pending_shipment_id, approved_shipment_id))
    
    # Check verification mode - in auto-add mode, items are already added to inventory
    cursor.execute("""
        SELECT verification_mode FROM pending_shipments
        WHERE pending_shipment_id = ?
    """, (pending_shipment_id,))
    mode_result = cursor.fetchone()
    verification_mode = mode_result['verification_mode'] if mode_result else 'verify_whole_shipment'
    
    # Update inventory quantities and vendor_id for all verified items (only if not auto-add mode)
    if verification_mode != 'auto_add':
        # Get all verified items with their product_ids
        cursor.execute("""
            SELECT product_id, SUM(quantity_verified) as total_quantity
            FROM pending_shipment_items
            WHERE pending_shipment_id = ?
            AND product_id IS NOT NULL
            AND COALESCE(quantity_verified, 0) > 0
            GROUP BY product_id
        """, (pending_shipment_id,))
        
        items_to_update = cursor.fetchall()
        
        # Update inventory for each product - set vendor_id and update quantity
        for item in items_to_update:
            product_id = item['product_id']
            quantity = item['total_quantity']
            cursor.execute("""
                UPDATE inventory
                SET current_quantity = current_quantity + ?,
                    vendor_id = ?,
                    vendor = ?,
                    last_restocked = CURRENT_TIMESTAMP
                WHERE product_id = ?
            """, (quantity, vendor_id, vendor_name, product_id))
    
    # Update pending shipment status
    status = 'completed_with_issues' if shipment['issue_count'] > 0 else 'approved'
    cursor.execute("""
        UPDATE pending_shipments
        SET status = ?,
            completed_by = ?,
            completed_at = CURRENT_TIMESTAMP,
            notes = COALESCE(notes || '\n', '') || COALESCE(?, '')
        WHERE pending_shipment_id = ?
    """, (status, employee_id, notes, pending_shipment_id))
    
    # End any open verification sessions
    cursor.execute("""
        UPDATE verification_sessions
        SET ended_at = CURRENT_TIMESTAMP
        WHERE pending_shipment_id = ? AND ended_at IS NULL
    """, (pending_shipment_id,))
    
    conn.commit()
    conn.close()
    
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
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            ps.*, 
            v.vendor_name,
            e1.first_name || ' ' || e1.last_name as uploaded_by_name,
            e2.first_name || ' ' || e2.last_name as started_by_name,
            COUNT(DISTINCT psi.pending_item_id) as total_items,
            COALESCE(SUM(psi.quantity_expected), 0) as total_expected,
            COALESCE(SUM(psi.quantity_verified), 0) as total_verified,
            COUNT(DISTINCT si.issue_id) as issue_count,
            CASE 
                WHEN COALESCE(SUM(psi.quantity_expected), 0) > 0 
                THEN ROUND((COALESCE(SUM(psi.quantity_verified), 0) * 100.0 / SUM(psi.quantity_expected)), 2)
                ELSE 0
            END as progress_percentage
        FROM pending_shipments ps
        JOIN vendors v ON ps.vendor_id = v.vendor_id
        LEFT JOIN employees e1 ON ps.uploaded_by = e1.employee_id
        LEFT JOIN employees e2 ON ps.started_by = e2.employee_id
        LEFT JOIN pending_shipment_items psi 
            ON ps.pending_shipment_id = psi.pending_shipment_id
        LEFT JOIN shipment_issues si 
            ON ps.pending_shipment_id = si.pending_shipment_id
    """
    
    if status:
        query += " WHERE ps.status = ?"
        cursor.execute(query + " GROUP BY ps.pending_shipment_id ORDER BY ps.upload_timestamp DESC", 
                     (status,))
    else:
        cursor.execute(query + " GROUP BY ps.pending_shipment_id ORDER BY ps.upload_timestamp DESC")
    
    shipments = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return shipments

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
        WHERE psi.pending_shipment_id = ?
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
    
    # Update shipment totals
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE pending_shipments
        SET total_expected_items = ?,
            total_expected_cost = ?,
            document_path = ?,
            status = 'pending_review'
        WHERE pending_shipment_id = ?
    """, (items_added, total_cost, file_path, pending_shipment_id))
    conn.commit()
    conn.close()
    
    return {
        'success': True,
        'pending_shipment_id': pending_shipment_id,
        'items_added': items_added,
        'total_expected': total_expected,
        'total_cost': float(total_cost)
    }

