#!/usr/bin/env python3
"""
Web viewer for inventory database - Google Sheets style interface
"""

import os
# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed. Environment variables must be set manually.")

from flask import Flask, render_template, jsonify, send_from_directory, request, Response, make_response
from werkzeug.utils import secure_filename

# Socket.IO support
try:
    from flask_socketio import SocketIO, emit
    socketio = None
    SOCKETIO_AVAILABLE = True
except ImportError:
    SOCKETIO_AVAILABLE = False
    print("Warning: flask-socketio not installed. Real-time features will be disabled.")
from database import (
    list_products, list_vendors, list_categories, list_shipments, get_sales,
    get_shipment_items, get_shipment_details, get_product,
    employee_login, verify_session, employee_logout,
    list_employees, get_employee, add_employee, update_employee, delete_employee, list_orders,
    get_employee_by_clerk_user_id, link_clerk_user_to_employee, verify_pin_login, generate_pin,
    get_connection,
    get_discrepancies, get_audit_trail,
    create_pending_return, approve_pending_return, reject_pending_return,
    get_pending_return, list_pending_returns,
    get_employee_role, assign_role_to_employee,
    start_verification_session, scan_item, report_shipment_issue,
    get_verification_progress, complete_verification,
    get_pending_shipments_with_progress, get_shipment_items,
    create_shipment_from_document, update_pending_item_verification, add_vendor,
    create_pending_shipment, add_pending_shipment_item, generate_unique_barcode,
    clock_in, clock_out, get_current_clock_status, get_schedule,
    get_store_location_settings, update_store_location_settings,
    get_customer_rewards_settings, update_customer_rewards_settings, calculate_rewards,
    add_customer, get_customer, update_customer, add_customer_points, search_customers, get_customer_rewards_detail,
    # Accounting / store settings
    get_establishment_settings, update_establishment_settings, get_labor_summary,
    generate_balance_sheet, generate_income_statement,
    generate_trial_balance,
    add_product, create_or_get_category_with_hierarchy,
    suggest_categories_for_product, assign_category_to_product,
    # Stripe integration functions
    get_payment_settings, update_payment_settings,
    create_stripe_connect_account, update_stripe_connect_account, get_stripe_connect_account,
    create_stripe_credentials, update_stripe_credentials, get_stripe_credentials, get_stripe_config,
)
from permission_manager import get_permission_manager
from sms_service_email_to_aws import EmailToAWSSMSService
import os
# QuickBooks-style accounting backend (accounting schema)
try:
    from backend.controllers.account_controller import account_controller
    from backend.controllers.transaction_controller import transaction_controller
    from backend.controllers.report_controller import report_controller
    from backend.controllers.bill_controller import bill_controller
    from backend.controllers.bill_payment_controller import bill_payment_controller
    from backend.controllers.invoice_controller import invoice_controller
    from backend.controllers.payment_controller import payment_controller
    from backend.controllers.vendor_controller import vendor_controller
    from backend.controllers.customer_controller import customer_controller
    from backend.middleware.error_handler import AppError, handle_error as handle_app_error
    _ACCOUNTING_BACKEND_AVAILABLE = True
except Exception as e:
    _ACCOUNTING_BACKEND_AVAILABLE = False
    print(f"Note: Accounting backend not loaded: {e}")
import sys
import json
from datetime import datetime, time, date
from decimal import Decimal
import tempfile
import traceback
import io
from psycopg2 import sql
from psycopg2.extras import RealDictCursor

try:
    import barcode
    from barcode.writer import ImageWriter
    _BARCODE_GEN_AVAILABLE = True
except ImportError:
    _BARCODE_GEN_AVAILABLE = False

# Initialize image matcher and barcode scanner (lazy loading)
_image_matcher = None
_barcode_scanner = None

def get_image_matcher():
    """Get or initialize the image matcher singleton"""
    global _image_matcher
    if _image_matcher is None:
        try:
            from product_image_matcher import ProductImageMatcher
            _image_matcher = ProductImageMatcher()
            # Try to load from database first, fallback to file
            try:
                _image_matcher.load_from_database()
            except:
                # If database load fails, try loading from file
                if os.path.exists('product_embeddings.pkl'):
                    _image_matcher.load_database('product_embeddings.pkl')
                else:
                    print("Warning: No product embeddings found. Run build_product_database() first.")
        except ImportError as e:
            print(f"Warning: Could not import ProductImageMatcher: {e}")
            print("Install dependencies: pip install torch torchvision Pillow numpy")
            return None
    return _image_matcher

def get_barcode_scanner():
    """Get or initialize the barcode scanner singleton"""
    global _barcode_scanner
    if _barcode_scanner is None:
        try:
            from barcode_scanner import BarcodeScanner
            _barcode_scanner = BarcodeScanner()
        except ImportError as e:
            print(f"Warning: Could not import BarcodeScanner: {e}")
            print("Install dependencies: pip install pyzbar opencv-python")
            return None
    return _barcode_scanner

app = Flask(__name__)

# Initialize SMS service
sms_service = EmailToAWSSMSService()

# ============================================================================
# DATABASE CONNECTION - Initialize after database import
# ============================================================================

# Initialize establishment context functions (no-ops for local PostgreSQL)
set_current_establishment = None
get_current_establishment = None

# System now uses local PostgreSQL - no Supabase
# Import PostgreSQL connection (required)
try:
    from database_postgres import (
        get_connection as get_postgres_connection,
        set_current_establishment as _set_establishment,
        get_current_establishment as _get_establishment
    )
    # Test connection on startup
    try:
        test_conn = get_postgres_connection()
        test_conn.close()
        set_current_establishment = _set_establishment
        get_current_establishment = _get_establishment
        print("✓ Connected to local PostgreSQL database")
    except Exception as conn_err:
        print(f"❌ ERROR: PostgreSQL connection failed: {conn_err}")
        print("❌ This system requires PostgreSQL. Please check your database connection settings.")
        print("❌ Set DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD (and DB_NAME) in .env file")
        raise SystemExit("Cannot start without PostgreSQL connection")
except ImportError as e:
    print(f"❌ ERROR: PostgreSQL module not found: {e}")
    print("❌ Install required packages: pip3 install psycopg2-binary python-dotenv")
    raise SystemExit("Cannot start without PostgreSQL dependencies")
except Exception as e:
    print(f"❌ ERROR: Could not initialize PostgreSQL: {e}")
    raise SystemExit("Cannot start without PostgreSQL")

# ============================================================================
# ESTABLISHMENT CONTEXT HANDLING (no-op for local PostgreSQL)
# ============================================================================

def get_establishment_from_request():
    """
    No-op for local PostgreSQL (no multi-tenant establishment context needed)
    """
    return None

@app.before_request
def set_establishment_context():
    """No-op for local PostgreSQL (no multi-tenant establishment context needed)"""
    pass

# Initialize Socket.IO
if SOCKETIO_AVAILABLE:
    # Use threading mode instead of eventlet to avoid blocking issues
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
else:
    socketio = None

# Optional CORS support
try:
    from flask_cors import CORS
    CORS(app)
except ImportError:
    # CORS not installed, but that's okay - Vite proxy handles it in dev mode
    pass

# Error handler to ensure all errors return JSON
@app.errorhandler(400)
def handle_400_error(e):
    """Handle 400 errors and return JSON"""
    error_msg = str(e) if e else 'Bad request'
    try:
        return jsonify({'success': False, 'error': error_msg, 'message': 'Bad request'}), 400
    except Exception as json_err:
        return Response(f'{{"success": false, "error": "{error_msg}", "message": "Bad request"}}', 
                       mimetype='application/json', status=400)

@app.errorhandler(500)
def handle_500_error(e):
    """Handle 500 errors and return JSON"""
    import traceback
    import sys
    exc_type, exc_value, exc_traceback = sys.exc_info()
    if exc_type:
        traceback.print_exception(exc_type, exc_value, exc_traceback)
    else:
        traceback.print_exc()
    
    error_msg = str(e) if e else 'Internal server error'
    try:
        return jsonify({'success': False, 'error': error_msg, 'message': 'Internal server error'}), 500
    except Exception as json_err:
        # Last resort - return plain text JSON
        return Response(f'{{"success": false, "error": "{error_msg}", "message": "Internal server error"}}', 
                       mimetype='application/json', status=500)

if _ACCOUNTING_BACKEND_AVAILABLE:
    @app.errorhandler(AppError)
    def handle_app_error_exc(e):
        return handle_app_error(e)

# After request hook to ensure all error responses are JSON
@app.after_request
def after_request(response):
    """Ensure all error responses return JSON"""
    if response.status_code >= 400 and response.content_type != 'application/json':
        try:
            # Try to parse existing response and convert to JSON
            if response.data:
                try:
                    existing_data = response.get_data(as_text=True)
                    if existing_data:
                        # If response has data, wrap it in JSON
                        return jsonify({'success': False, 'error': existing_data, 'message': 'Internal server error'}), response.status_code
                except:
                    pass
            # If no data or parsing failed, return generic JSON error
            return jsonify({'success': False, 'error': 'Internal server error', 'message': 'An error occurred'}), response.status_code
        except Exception as json_err:
            # Last resort - return plain text JSON
            error_msg = 'Internal server error'
            try:
                error_msg = str(json_err)
            except:
                pass
            return Response(f'{{"success": false, "error": "{error_msg}", "message": "Internal server error"}}', 
                           mimetype='application/json', status=response.status_code)
    return response

# Check if React build exists
BUILD_DIR = 'frontend/dist'
HAS_BUILD = os.path.exists(BUILD_DIR) and os.path.exists(os.path.join(BUILD_DIR, 'index.html'))

def _pg_conn():
    """PostgreSQL connection with dict-like rows."""
    conn = get_connection()
    return conn, conn.cursor(cursor_factory=RealDictCursor)


def _json_serial(obj):
    """Convert date/time/Decimal to JSON-serializable types."""
    if obj is None:
        return None
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, time):
        return obj.strftime('%H:%M:%S')
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _sanitize_for_json(obj):
    """Recursively convert date/time/Decimal in dicts/lists to JSON-serializable types."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(x) for x in obj]
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, time):
        return obj.strftime('%H:%M:%S')
    if isinstance(obj, Decimal):
        return float(obj)
    return obj

def _pg_allowed_tables():
    """List public table names (PostgreSQL)."""
    conn, cursor = _pg_conn()
    try:
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%%'")
        return [r['tablename'] for r in cursor.fetchall()]
    finally:
        conn.close()

def get_table_data(table_name):
    """Get all data from a table (PostgreSQL)."""
    conn, cursor = _pg_conn()
    try:
        cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table_name)))
        rows = cursor.fetchall()
        columns = list(rows[0].keys()) if rows else []
        return columns, [dict(r) for r in rows]
    finally:
        conn.close()

def get_table_primary_key_columns(table_name):
    """Return primary key column names for a table (PostgreSQL)."""
    conn, cursor = _pg_conn()
    try:
        cursor.execute("""
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) AND NOT a.attisdropped
            WHERE i.indrelid = %s::regclass AND i.indisprimary
            ORDER BY array_position(i.indkey, a.attnum)
        """, (table_name,))
        return [r['attname'] for r in cursor.fetchall()]
    finally:
        conn.close()

def get_table_data_for_admin(table_name):
    """Get table data plus PK metadata (PostgreSQL). No rowid fallback."""
    pk_cols = get_table_primary_key_columns(table_name)
    conn, cursor = _pg_conn()
    try:
        cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table_name)))
        rows = cursor.fetchall()
        columns = list(rows[0].keys()) if rows else []
        data = [dict(r) for r in rows]
        return {
            'columns': columns,
            'data': data,
            'primary_key': pk_cols,
            'rowid_column': None
        }
    finally:
        conn.close()

@app.route('/')
def index():
    """Serve React app or redirect to dev server"""
    if HAS_BUILD:
        return send_from_directory(BUILD_DIR, 'index.html')
    else:
        return '''
        <html>
            <body>
                <h1>React app not built</h1>
                <p>Run in development mode:</p>
                <ol>
                    <li>cd frontend</li>
                    <li>npm install</li>
                    <li>npm run dev</li>
                </ol>
                <p>Or build for production:</p>
                <ol>
                    <li>cd frontend</li>
                    <li>npm install</li>
                    <li>npm run build</li>
                </ol>
            </body>
        </html>
        '''

@app.route('/assets/<path:path>')
def serve_assets(path):
    """Serve static assets from React build"""
    if HAS_BUILD:
        return send_from_directory(os.path.join(BUILD_DIR, 'assets'), path)
    return '', 404

@app.route('/api/inventory', methods=['GET', 'POST'])
def api_inventory():
    """Get inventory data with vendor names and metadata, or create a new product"""
    if request.method == 'POST':
        try:
            # Handle both JSON and form-data (for file uploads)
            if request.is_json:
                data = request.json
            else:
                data = request.form.to_dict()
            
            # Required fields
            product_name = data.get('product_name')
            sku = data.get('sku')
            product_price = data.get('product_price')
            product_cost = data.get('product_cost')
            
            if not product_name or not sku:
                return jsonify({'success': False, 'message': 'product_name and sku are required'}), 400
            
            # Convert price and cost to float
            try:
                product_price = float(product_price) if product_price else 0.0
                product_cost = float(product_cost) if product_cost else 0.0
            except (ValueError, TypeError):
                return jsonify({'success': False, 'message': 'product_price and product_cost must be valid numbers'}), 400
            
            # Handle photo upload if provided
            photo_path = data.get('photo')  # Can be a URL/path from JSON
            if 'photo' in request.files:
                photo = request.files['photo']
                if photo.filename:
                    filename = secure_filename(f"product_{sku}_{datetime.now().timestamp()}_{photo.filename}")
                    upload_dir = 'uploads/product_photos'
                    os.makedirs(upload_dir, exist_ok=True)
                    photo_path = os.path.join(upload_dir, filename)
                    photo.save(photo_path)
            
            # Handle vendor - can be vendor_id (int) or vendor_name (str)
            vendor_id = data.get('vendor_id')
            vendor = data.get('vendor') or data.get('vendor_name')
            
            # If vendor is a string name, try to find vendor_id
            if not vendor_id and vendor:
                conn, cursor = _pg_conn()
                try:
                    cursor.execute("SELECT vendor_id FROM vendors WHERE vendor_name = %s LIMIT 1", (vendor,))
                    row = cursor.fetchone()
                    if row:
                        vendor_id = row['vendor_id']
                finally:
                    conn.close()

            item_type = (data.get('item_type') or 'product').lower()
            if item_type not in ('product', 'ingredient'):
                item_type = 'product'
            unit = data.get('unit')
            sell_at_pos = data.get('sell_at_pos', True)
            if isinstance(sell_at_pos, str):
                sell_at_pos = sell_at_pos.lower() in ('true', '1', 'yes')
            if item_type == 'ingredient':
                sell_at_pos = False

            # Create product or ingredient
            product_id = add_product(
                product_name=product_name,
                sku=sku,
                product_price=product_price,
                product_cost=product_cost,
                vendor=vendor,
                vendor_id=vendor_id,
                photo=photo_path,
                current_quantity=int(data.get('current_quantity', 0)) or 0,
                category=data.get('category'),
                barcode=data.get('barcode'),
                auto_extract_metadata=(item_type == 'product'),
                item_type=item_type,
                unit=unit,
                sell_at_pos=sell_at_pos
            )
            kind = 'Ingredient' if item_type == 'ingredient' else 'Product'
            return jsonify({
                'success': True,
                'product_id': product_id,
                'message': f'{kind} created successfully'
            })
        except ValueError as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500
    else:
        # GET request (PostgreSQL) - optional filter: item_type=product|ingredient (default: all)
        try:
            from database import ensure_metadata_tables
            ensure_metadata_tables()
            item_type_filter = request.args.get('item_type', '').lower()
            conn, cursor = _pg_conn()
            try:
                sql = """
                    SELECT 
                        i.*,
                        v.vendor_name,
                        pm.keywords,
                        pm.tags,
                        pm.attributes,
                        pm.brand,
                        pm.color,
                        pm.size,
                        pm.category_id as metadata_category_id,
                        c.category_name as metadata_category_name,
                        pm.category_confidence
                    FROM inventory i
                    LEFT JOIN vendors v ON i.vendor_id = v.vendor_id
                    LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
                    LEFT JOIN categories c ON pm.category_id = c.category_id
                    WHERE 1=1
                """
                params = []
                cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'item_type'")
                has_item_type = cursor.fetchone() is not None
                if has_item_type and item_type_filter == 'product':
                    sql += " AND (i.item_type = 'product' OR i.item_type IS NULL)"
                elif has_item_type and item_type_filter == 'ingredient':
                    sql += " AND i.item_type = 'ingredient'"
                if has_item_type:
                    sql += " ORDER BY i.item_type NULLS LAST, i.product_name"
                else:
                    sql += " ORDER BY i.product_name"
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                columns = list(rows[0].keys()) if rows else []
                data = [dict(r) for r in rows]
                # Use full category path for each item so master category filter includes subcategories
                try:
                    cats = list_categories(include_path=True)
                    category_id_to_path = {c['category_id']: c.get('category_path') or c.get('category_name') for c in cats if c.get('category_id')}
                    for row in data:
                        cid = row.get('metadata_category_id')
                        if cid and cid in category_id_to_path and category_id_to_path[cid]:
                            row['category'] = category_id_to_path[cid]
                except Exception:
                    pass
                include_variants = request.args.get('include_variants', '').lower() in ('1', 'true', 'yes')
                if include_variants and data:
                    try:
                        product_ids = [r.get('product_id') for r in data if r.get('product_id')]
                        if product_ids:
                            placeholders = ','.join(['%s'] * len(product_ids))
                            cursor.execute(
                                "SELECT variant_id, product_id, variant_name, price, cost, sort_order FROM product_variants WHERE product_id IN (" + placeholders + ") ORDER BY product_id, sort_order, variant_name",
                                tuple(product_ids)
                            )
                            variant_rows = cursor.fetchall()
                            variants_by_product = {}
                            for v in variant_rows:
                                vd = dict(v)
                                pid = vd.get('product_id')
                                if pid not in variants_by_product:
                                    variants_by_product[pid] = []
                                variants_by_product[pid].append(vd)
                            for row in data:
                                row['variants'] = variants_by_product.get(row.get('product_id')) or []
                    except Exception:
                        for row in data:
                            row['variants'] = []
                return jsonify({'columns': columns, 'data': data})
            finally:
                conn.close()
        except Exception as e:
            print(f"Error in api_inventory: {e}")
            traceback.print_exc()
            return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

@app.route('/api/inventory/<int:product_id>', methods=['PUT'])
def api_update_inventory(product_id):
    """Update inventory product with audit logging"""
    try:
        if request.is_json:
            data = request.json
        else:
            data = request.form.to_dict()
            if request.files:
                for k, v in request.files.items():
                    if v and v.filename:
                        upload_dir = 'uploads/product_photos'
                        os.makedirs(upload_dir, exist_ok=True)
                        path = os.path.join(upload_dir, secure_filename(f"product_{product_id}_{datetime.now().timestamp()}_{v.filename}"))
                        v.save(path)
                        data['photo'] = path
            for key in ('product_price', 'product_cost', 'current_quantity', 'vendor_id'):
                if key in data and data[key] not in (None, ''):
                    try:
                        data[key] = float(data[key]) if key != 'current_quantity' else int(float(data[key]))
                    except (TypeError, ValueError):
                        pass
        
        # Verify session and get employee_id
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found in session'}), 401
        
        # Get update fields (exclude session_token and product_id)
        update_fields = {k: v for k, v in data.items() 
                        if k not in ['session_token', 'product_id'] and v is not None}
        
        if not update_fields:
            return jsonify({'success': False, 'message': 'No fields to update'}), 400
        
        # Update product with audit logging
        from database import update_product
        success = update_product(product_id, employee_id=employee_id, **update_fields)
        
        if success:
            return jsonify({'success': True, 'message': 'Product updated successfully'})
        else:
            return jsonify({'success': False, 'message': 'Product not found or update failed'}), 404
            
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        print(f"Error updating inventory: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


# ---------------------------------------------------------------------------
# Product variants (sizes with different prices) and ingredients (recipes)
# ---------------------------------------------------------------------------

@app.route('/api/inventory/<int:product_id>/variants', methods=['GET', 'POST'])
def api_product_variants(product_id):
    """Get or add size/variant options for a product (e.g. Small $3, Large $5)."""
    from database import get_product, get_product_variants, add_product_variant
    if request.method == 'GET':
        try:
            variants = get_product_variants(product_id)
            return jsonify({'success': True, 'data': variants})
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500
    else:
        try:
            data = request.get_json() or {}
            variant_name = (data.get('variant_name') or data.get('name') or '').strip()
            price = float(data.get('price', 0))
            cost = float(data.get('cost', 0))
            sort_order = int(data.get('sort_order', 0))
            if not variant_name:
                return jsonify({'success': False, 'message': 'variant_name is required'}), 400
            if price < 0:
                return jsonify({'success': False, 'message': 'price must be >= 0'}), 400
            variant_id = add_product_variant(product_id, variant_name, price, cost, sort_order)
            return jsonify({'success': True, 'variant_id': variant_id, 'message': 'Variant added'}), 201
        except ValueError as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventory/variants/<int:variant_id>', methods=['PUT', 'DELETE'])
def api_product_variant_by_id(variant_id):
    """Update or delete a product variant."""
    from database import update_product_variant, delete_product_variant, get_variant_by_id
    if request.method == 'DELETE':
        try:
            ok = delete_product_variant(variant_id)
            return jsonify({'success': ok, 'message': 'Variant deleted' if ok else 'Variant not found'}), 200 if ok else 404
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500
    try:
        data = request.get_json() or {}
        updates = {}
        if 'variant_name' in data or 'name' in data:
            updates['variant_name'] = (data.get('variant_name') or data.get('name') or '').strip()
        if 'price' in data:
            updates['price'] = float(data['price'])
        if 'cost' in data:
            updates['cost'] = float(data['cost'])
        if 'sort_order' in data:
            updates['sort_order'] = int(data['sort_order'])
        if not updates:
            return jsonify({'success': False, 'message': 'No fields to update'}), 400
        ok = update_product_variant(variant_id, **updates)
        return jsonify({'success': ok, 'message': 'Variant updated' if ok else 'Variant not found'}), 200 if ok else 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventory/<int:product_id>/ingredients', methods=['GET', 'POST'])
def api_product_ingredients(product_id):
    """Get or add recipe ingredients for a product (ingredients used to make this product)."""
    from database import get_product_ingredients, add_product_ingredient
    if request.method == 'GET':
        try:
            variant_id = request.args.get('variant_id', type=int)
            ingredients = get_product_ingredients(product_id, variant_id if variant_id else None)
            return jsonify({'success': True, 'data': ingredients})
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500
    else:
        try:
            data = request.get_json() or {}
            ingredient_id = data.get('ingredient_id')
            quantity_required = float(data.get('quantity_required', data.get('quantity', 0)))
            unit = (data.get('unit') or '').strip()
            variant_id = data.get('variant_id')
            if not ingredient_id:
                return jsonify({'success': False, 'message': 'ingredient_id is required'}), 400
            if quantity_required <= 0:
                return jsonify({'success': False, 'message': 'quantity_required must be > 0'}), 400
            if not unit:
                return jsonify({'success': False, 'message': 'unit is required (e.g. oz, lb, each)'}), 400
            rid = add_product_ingredient(product_id, int(ingredient_id), quantity_required, unit, variant_id)
            return jsonify({'success': True, 'id': rid, 'message': 'Ingredient added to recipe'}), 201
        except ValueError as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventory/ingredients/<int:recipe_id>', methods=['DELETE'])
def api_delete_product_ingredient(recipe_id):
    """Remove an ingredient from a product recipe."""
    from database import delete_product_ingredient
    try:
        ok = delete_product_ingredient(recipe_id)
        return jsonify({'success': ok, 'message': 'Ingredient removed from recipe' if ok else 'Not found'}), 200 if ok else 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/vendors/<int:vendor_id>', methods=['PUT'])
def api_update_vendor(vendor_id):
    """Update a vendor"""
    try:
        from database import update_vendor
        data = request.json if request.is_json else request.form.to_dict()
        
        success = update_vendor(
            vendor_id=vendor_id,
            vendor_name=data.get('vendor_name'),
            contact_person=data.get('contact_person'),
            email=data.get('email'),
            phone=data.get('phone'),
            address=data.get('address')
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Vendor updated successfully'
            })
        return jsonify({'success': False, 'message': 'Vendor not found or no changes made'}), 404
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/vendors', methods=['GET', 'POST'])
def api_vendors():
    """Get vendors data or create a new vendor"""
    if request.method == 'POST':
        try:
            data = request.json if request.is_json else request.form.to_dict()
            vendor_name = data.get('vendor_name')
            
            if not vendor_name:
                return jsonify({'success': False, 'message': 'vendor_name is required'}), 400
            
            vendor_id = add_vendor(
                vendor_name=vendor_name,
                contact_person=data.get('contact_person'),
                email=data.get('email'),
                phone=data.get('phone'),
                address=data.get('address')
            )
            
            return jsonify({
                'success': True,
                'vendor_id': vendor_id,
                'message': 'Vendor created successfully'
            })
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500
    else:
        # GET request
        try:
            vendors = list_vendors()
            if not vendors:
                return jsonify({'columns': [], 'data': []})
            
            columns = list(vendors[0].keys())
            return jsonify({'columns': columns, 'data': vendors})
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
def api_update_category(category_id):
    """Update a category - supports updating the full category path"""
    try:
        from database import get_connection, create_or_get_category_with_hierarchy
        data = request.json if request.is_json else request.form.to_dict()
        category_path = data.get('category_name') or data.get('category_path')
        
        if not category_path:
            return jsonify({'success': False, 'message': 'category_name or category_path is required'}), 400
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Check if category exists
        cursor.execute("SELECT category_id, category_name, parent_category_id FROM categories WHERE category_id = %s", (category_id,))
        existing = cursor.fetchone()
        if not existing:
            conn.close()
            return jsonify({'success': False, 'message': 'Category not found'}), 404
        
        # If the path contains ">", it's a hierarchical path
        if '>' in category_path:
            # Parse the path to get the leaf name and parent path
            parts = [p.strip() for p in category_path.split('>')]
            leaf_name = parts[-1]
            
            # Get the parent category_id for the new path (everything except the leaf)
            parent_path = ' > '.join(parts[:-1]) if len(parts) > 1 else None
            parent_id = None
            if parent_path:
                parent_id = create_or_get_category_with_hierarchy(parent_path, conn)
            
            # Update the category's name and parent
            cursor.execute(
                "UPDATE categories SET category_name = %s, parent_category_id = %s WHERE category_id = %s",
                (leaf_name, parent_id, category_id)
            )
        else:
            # Simple category name update (no hierarchy) - set parent to NULL
            cursor.execute(
                "UPDATE categories SET category_name = %s, parent_category_id = NULL WHERE category_id = %s",
                (category_path, category_id)
            )
        
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Category updated successfully'
            })
        return jsonify({'success': False, 'message': 'Category not found or no changes made'}), 404
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/categories', methods=['GET', 'POST'])
def api_categories():
    """Get categories (with category_path) or create a new category"""
    if request.method == 'POST':
        try:
            data = request.json if request.is_json else request.form.to_dict()
            category_path = data.get('category_path') or data.get('category_name')

            if not category_path:
                return jsonify({'success': False, 'message': 'category_path or category_name is required'}), 400

            category_id = create_or_get_category_with_hierarchy(category_path)

            if category_id:
                return jsonify({
                    'success': True,
                    'category_id': category_id,
                    'message': 'Category created successfully'
                })
            return jsonify({'success': False, 'message': 'Failed to create category'}), 500
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500
    try:
        categories = list_categories(include_path=True)
        if not categories:
            return jsonify({'columns': [], 'data': []})
        columns = list(categories[0].keys())
        return jsonify({'columns': columns, 'data': categories})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'columns': [], 'data': []})


@app.route('/api/categories/suggest', methods=['POST'])
def api_categories_suggest():
    """Suggest categories for a product (product_name, optional barcode). No DB write."""
    try:
        data = request.json if request.is_json else {}
        product_name = data.get('product_name') or ''
        barcode = data.get('barcode')
        if not product_name:
            return jsonify({'success': False, 'message': 'product_name is required'}), 400
        suggestions = suggest_categories_for_product(product_name=product_name, barcode=barcode)
        return jsonify({'success': True, 'suggestions': suggestions})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventory/<int:product_id>/category', methods=['PATCH', 'PUT'])
def api_inventory_category(product_id):
    """Assign category to product. Body: {category_id} or {category_path}."""
    try:
        data = request.json if request.is_json else {}
        category_id = data.get('category_id')
        category_path = data.get('category_path')
        if category_id is None and not category_path:
            return jsonify({'success': False, 'message': 'category_id or category_path required'}), 400
        ok = assign_category_to_product(
            product_id=product_id,
            category_id=category_id,
            category_path=category_path,
            confidence=1.0
        )
        if ok:
            return jsonify({'success': True, 'message': 'Category assigned'})
        return jsonify({'success': False, 'message': 'Assign failed'}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/categories/bulk-assign', methods=['POST'])
def api_categories_bulk_assign():
    """Bulk assign categories. Body: {assignments: [{product_id, category_id}|{product_id, category_path}]}."""
    try:
        data = request.json if request.is_json else {}
        assignments = data.get('assignments') or []
        if not assignments:
            return jsonify({'success': False, 'message': 'assignments array required'}), 400
        updated = 0
        for item in assignments:
            pid = item.get('product_id')
            cid = item.get('category_id')
            path = item.get('category_path')
            if pid is None:
                continue
            if assign_category_to_product(product_id=pid, category_id=cid, category_path=path, confidence=1.0):
                updated += 1
        return jsonify({'success': True, 'updated': updated, 'total': len(assignments)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments')
def api_shipments():
    """Get shipments data"""
    shipments = list_shipments()
    if not shipments:
        return jsonify({'columns': [], 'data': []})
    
    columns = list(shipments[0].keys())
    return jsonify({'columns': columns, 'data': shipments})

@app.route('/api/sales')
def api_sales():
    """Get sales data"""
    sales = get_sales()
    if not sales:
        return jsonify({'columns': [], 'data': []})
    
    columns = list(sales[0].keys())
    return jsonify({'columns': columns, 'data': sales})

@app.route('/api/pending_shipments')
def api_pending_shipments():
    """Get pending shipments data with progress"""
    try:
        status = request.args.get('status')
        shipments = get_pending_shipments_with_progress(status)
        
        if not shipments:
            return jsonify({'columns': [], 'data': []})
        
        columns = list(shipments[0].keys())
        return jsonify({'columns': columns, 'data': shipments})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

# Shipment Verification API Endpoints
@app.route('/api/shipments/<int:shipment_id>/start', methods=['POST'])
def api_start_verification(shipment_id):
    """Start verification session"""
    try:
        data = request.json if request.is_json else {}
        employee_id = data.get('employee_id')
        if not employee_id:
            # Try to get from session
            session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not session_token:
                session_token = data.get('session_token')
            if session_token:
                session_data = verify_session(session_token)
                if session_data and session_data.get('valid'):
                    employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        device_id = data.get('device_id')
        result = start_verification_session(shipment_id, employee_id, device_id)
        if result and 'session_id' in result:
            return jsonify({'success': True, **result})
        else:
            return jsonify({'success': False, 'message': 'Failed to start session', 'details': result}), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in api_start_verification: {error_trace}")
        return jsonify({'success': False, 'message': str(e), 'error': error_trace}), 500

@app.route('/api/shipments/<int:shipment_id>/scan', methods=['POST'])
def api_scan_item(shipment_id):
    """Process scanned barcode"""
    try:
        employee_id = request.json.get('employee_id')
        if not employee_id:
            session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not session_token:
                session_token = request.json.get('session_token')
            if session_token:
                session_data = verify_session(session_token)
                if session_data and session_data.get('valid'):
                    employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        data = request.json
        result = scan_item(
            shipment_id,
            data['barcode'],
            employee_id,
            data.get('device_id'),
            data.get('session_id'),
            data.get('location')
        )
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/<int:shipment_id>/progress', methods=['GET'])
def api_get_progress(shipment_id):
    """Get verification progress"""
    try:
        progress = get_verification_progress(shipment_id)
        return jsonify(progress)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/pending_items/<int:item_id>/update', methods=['POST'])
def api_update_item_verification(item_id):
    """Update pending item verification quantity"""
    try:
        # Get employee ID from session
        employee_id = None
        data = request.json if request.is_json else {}
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = data.get('session_token')
        if session_token:
            session_data = verify_session(session_token)
            if session_data and session_data.get('valid'):
                employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        quantity_verified = data.get('quantity_verified')
        product_price = data.get('product_price')
        if product_price is not None:
            try:
                product_price = float(product_price)
            except (TypeError, ValueError):
                product_price = None
        
        # Handle photo upload if provided
        verification_photo = None
        if 'photo' in request.files:
            photo = request.files['photo']
            if photo.filename:
                filename = secure_filename(f"verification_{item_id}_{datetime.now().timestamp()}_{photo.filename}")
                upload_dir = 'uploads/verification_photos'
                os.makedirs(upload_dir, exist_ok=True)
                photo_path = os.path.join(upload_dir, filename)
                photo.save(photo_path)
                verification_photo = photo_path
                
                # Get product_id from pending item and update product photo if it doesn't have one
                try:
                    from database import get_product, update_product
                    conn, cursor = _pg_conn()
                    try:
                        cursor.execute("SELECT product_id FROM pending_shipment_items WHERE pending_item_id = %s", (item_id,))
                        row = cursor.fetchone()
                        if row and row.get('product_id'):
                            product_id = row['product_id']
                        product = get_product(product_id)
                        # Always update product photo with verification photo (even if product already has a photo)
                        if product:
                            update_product(
                                product_id=product_id,
                                photo=verification_photo
                            )
                            print(f"Updated product {product_id} photo with verification photo: {verification_photo}")
                    finally:
                        conn.close()
                except Exception as e:
                    print(f"Warning: Could not update product photo: {e}")
        
        # Require at least one updatable field (quantity, photo, or price)
        if quantity_verified is None and verification_photo is None and product_price is None:
            return jsonify({'success': False, 'message': 'quantity_verified, photo, or product_price is required'}), 400
        
        success = update_pending_item_verification(
            pending_item_id=item_id,
            quantity_verified=quantity_verified,
            employee_id=employee_id,
            verification_photo=verification_photo,
            unit_price=product_price,
        )
        
        if success:
            return jsonify({
                'success': True,
                'quantity_verified': quantity_verified,
                'verification_photo': verification_photo,
                'product_price': product_price,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to update item'}), 400
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in api_update_item_verification: {error_trace}")
        return jsonify({'success': False, 'message': str(e), 'error': error_trace}), 500

@app.route('/api/shipments/<int:shipment_id>/issues', methods=['POST'])
def api_report_issue(shipment_id):
    """Report an issue"""
    try:
        employee_id = request.json.get('employee_id')
        if not employee_id:
            session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not session_token:
                session_token = request.json.get('session_token')
            if session_token:
                session_data = verify_session(session_token)
                if session_data and session_data.get('valid'):
                    employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        data = request.json
        
        # Handle photo upload if provided
        photo_path = None
        if 'photo' in request.files:
            photo = request.files['photo']
            if photo.filename:
                filename = secure_filename(f"{shipment_id}_{datetime.now().timestamp()}_{photo.filename}")
                upload_dir = 'uploads/issues'
                os.makedirs(upload_dir, exist_ok=True)
                photo_path = os.path.join(upload_dir, filename)
                photo.save(photo_path)
        
        issue_id = report_shipment_issue(
            shipment_id,
            data.get('pending_item_id'),
            data['issue_type'],
            data['description'],
            data.get('quantity_affected', 1),
            employee_id,
            data.get('severity', 'minor'),
            photo_path
        )
        
        return jsonify({'success': True, 'issue_id': issue_id})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/<int:shipment_id>/complete', methods=['POST'])
def api_complete_verification(shipment_id):
    """Complete verification step - behavior depends on workflow mode"""
    try:
        data = request.json if request.is_json else {}
        employee_id = data.get('employee_id')
        if not employee_id:
            session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not session_token:
                session_token = data.get('session_token')
            if session_token:
                session_data = verify_session(session_token)
                if session_data and session_data.get('valid'):
                    employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        # Get workflow_step from shipment (for three-step workflow support)
        # But verification_mode comes from the shipment record, not settings
        conn, cursor = _pg_conn()
        try:
            cursor.execute("SELECT workflow_step, status FROM pending_shipments WHERE pending_shipment_id = %s", (shipment_id,))
            shipment = cursor.fetchone()
            current_step = shipment['workflow_step'] if shipment else None
        finally:
            conn.close()
        
        # Support three-step workflow if needed (but verification_mode is from shipment, not settings)
        if current_step == 'confirm_pricing':
            conn, cursor = _pg_conn()
            try:
                cursor.execute("""
                    UPDATE pending_shipments SET workflow_step = 'ready_for_inventory'
                    WHERE pending_shipment_id = %s
                """, (shipment_id,))
                conn.commit()
                return jsonify({'success': True, 'step': 'ready_for_inventory', 'message': 'Ready for step 3: Add to inventory'})
            finally:
                conn.close()
        
        # Complete verification - uses verification_mode from the shipment record
        # (set when shipment was created, not from settings)
        result = complete_verification(shipment_id, employee_id, data.get('notes'))
        return jsonify(result)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/<int:shipment_id>/items', methods=['GET'])
def api_get_shipment_items(shipment_id):
    """Get all items in a shipment"""
    try:
        items = get_shipment_items(shipment_id)
        return jsonify(items)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/shipments/preview-manual', methods=['POST'])
def api_preview_shipment_manual():
    """Upload a document for manual entry only: save file and return empty items (no scraping)."""
    try:
        if 'document' not in request.files:
            return jsonify({'success': False, 'message': 'No document file provided'}), 400
        file = request.files['document']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        filename = secure_filename(f"preview_{datetime.now().timestamp()}_{file.filename}")
        upload_dir = 'uploads/shipments'
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)
        return jsonify({
            'success': True,
            'items': [],
            'file_path': file_path,
            'filename': file.filename
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/shipments/preview', methods=['POST'])
def api_preview_shipment():
    """Preview scraped data from a vendor shipment document without creating shipment.
    For manual entry (no scrape), use POST /api/shipments/preview-manual instead."""
    try:
        # Check if file is present
        if 'document' not in request.files:
            return jsonify({'success': False, 'message': 'No document file provided'}), 400
        
        file = request.files['document']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        # Accept manual from header, form body, or query string
        manual_val = (
            (request.headers.get('X-Shipment-Manual-Entry') or '') or
            (request.form.get('manual') or '') or
            (request.args.get('manual') or '')
        ).strip().lower()
        manual = manual_val in ('1', 'true', 'yes')
        
        # Save uploaded file temporarily
        filename = secure_filename(f"preview_{datetime.now().timestamp()}_{file.filename}")
        upload_dir = 'uploads/shipments'
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)
        
        if manual:
            return jsonify({
                'success': True,
                'items': [],
                'file_path': file_path,
                'filename': file.filename
            })
        
        # Scrape the document
        from document_scraper import scrape_document
        try:
            items = scrape_document(file_path)
        except Exception as e:
            # Clean up file on error
            try:
                os.remove(file_path)
            except:
                pass
            return jsonify({'success': False, 'message': f'Error scraping document: {str(e)}'}), 400
        
        if not items:
            # Clean up file if no items
            try:
                os.remove(file_path)
            except:
                pass
            return jsonify({'success': False, 'message': 'No items found in document'}), 400
        
        return jsonify({
            'success': True,
            'items': items,
            'file_path': file_path,
            'filename': file.filename
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/draft/save', methods=['POST'])
def api_save_shipment_draft():
    """Save a shipment draft"""
    try:
        employee_id = None
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.form.get('session_token')
        if session_token:
            session_data = verify_session(session_token)
            if session_data and session_data.get('valid'):
                employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        items_data = request.form.get('items')
        file_path = request.form.get('file_path')
        draft_id = request.form.get('draft_id')  # Optional: for updating existing draft
        
        if not items_data:
            return jsonify({'success': False, 'message': 'Items data required'}), 400
        
        import json
        try:
            items = json.loads(items_data)
        except:
            return jsonify({'success': False, 'message': 'Invalid items data'}), 400
        
        vendor_id = request.form.get('vendor_id')
        if not vendor_id:
            return jsonify({'success': False, 'message': 'Vendor ID required'}), 400
        
        try:
            vendor_id = int(vendor_id)
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid vendor ID'}), 400
        
        purchase_order_number = request.form.get('purchase_order_number', '').strip() or None
        expected_delivery_date = request.form.get('expected_delivery_date', '').strip() or None
        tracking_number = request.form.get('tracking_number', '').strip() or None
        
        draft_id_int = int(draft_id) if draft_id else None
        
        from database import save_shipment_draft
        saved_draft_id = save_shipment_draft(
            vendor_id=vendor_id,
            items=items,
            file_path=file_path,
            expected_date=expected_delivery_date,
            purchase_order_number=purchase_order_number,
            tracking_number=tracking_number,
            uploaded_by=employee_id,
            draft_id=draft_id_int
        )
        
        return jsonify({
            'success': True,
            'draft_id': saved_draft_id,
            'message': 'Draft saved successfully'
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/draft/<int:draft_id>', methods=['GET'])
def api_load_draft(draft_id):
    """Load a shipment draft"""
    try:
        from database import get_pending_shipment_details
        draft = get_pending_shipment_details(draft_id)
        
        if not draft:
            return jsonify({'success': False, 'message': 'Draft not found'}), 404
        
        if draft.get('status') != 'draft':
            return jsonify({'success': False, 'message': 'Not a draft'}), 400
        
        # Format items for frontend
        items = []
        for item in draft.get('items', []):
            items.append({
                'product_sku': item.get('product_sku', ''),
                'product_name': item.get('product_name', ''),
                'quantity_expected': item.get('quantity_expected', 0),
                'unit_cost': float(item.get('unit_cost', 0.0)),
                'lot_number': item.get('lot_number', ''),
                'expiration_date': item.get('expiration_date', ''),
                'barcode': item.get('barcode', '')
            })
        
        return jsonify({
            'success': True,
            'draft': {
                'draft_id': draft.get('pending_shipment_id'),
                'vendor_id': draft.get('vendor_id'),
                'file_path': draft.get('file_path'),
                'expected_date': draft.get('expected_date'),
                'purchase_order_number': draft.get('purchase_order_number'),
                'tracking_number': draft.get('tracking_number'),
                'items': items
            }
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/draft/<int:draft_id>/confirm', methods=['POST'])
def api_confirm_draft(draft_id):
    """Confirm a draft - change status from 'draft' to 'in_progress'"""
    try:
        employee_id = None
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.form.get('session_token')
        if session_token:
            session_data = verify_session(session_token)
            if session_data and session_data.get('valid'):
                employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        # Get items data if provided (for updating items before confirming)
        items_data = request.form.get('items')
        if items_data:
            import json
            try:
                items = json.loads(items_data)
            except:
                return jsonify({'success': False, 'message': 'Invalid items data'}), 400
            
            # Update draft with new items
            from database import save_shipment_draft
            vendor_id = request.form.get('vendor_id')
            if vendor_id:
                try:
                    vendor_id = int(vendor_id)
                except ValueError:
                    return jsonify({'success': False, 'message': 'Invalid vendor ID'}), 400
                
                # Get current draft to preserve other fields
                from database import get_pending_shipment
                current_draft = get_pending_shipment(draft_id)
                if not current_draft or current_draft.get('status') != 'draft':
                    return jsonify({'success': False, 'message': 'Draft not found'}), 404
                
                # Update draft with new items
                save_shipment_draft(
                    vendor_id=vendor_id or current_draft.get('vendor_id'),
                    items=items,
                    file_path=request.form.get('file_path') or current_draft.get('file_path'),
                    expected_date=request.form.get('expected_delivery_date') or current_draft.get('expected_date'),
                    purchase_order_number=request.form.get('purchase_order_number') or current_draft.get('purchase_order_number'),
                    tracking_number=request.form.get('tracking_number') or current_draft.get('tracking_number'),
                    uploaded_by=employee_id,
                    draft_id=draft_id
                )
        
        # Update status to 'in_progress'
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                UPDATE pending_shipments
                SET status = 'in_progress',
                    upload_timestamp = NOW()
                WHERE pending_shipment_id = %s AND status = 'draft'
            """, (draft_id,))
            
            if cursor.rowcount == 0:
                conn.rollback()
                return jsonify({'success': False, 'message': 'Draft not found or already confirmed'}), 404
            
            conn.commit()
            
            # Get updated shipment info
            from database import get_pending_shipment_details
            shipment = get_pending_shipment_details(draft_id)
            
            return jsonify({
                'success': True,
                'pending_shipment_id': draft_id,
                'items_added': len(shipment.get('items', [])) if shipment else 0,
                'message': 'Draft confirmed and moved to in progress'
            })
        except Exception as e:
            conn.rollback()
            raise
        finally:
            pass
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/upload', methods=['POST'])
def api_upload_shipment():
    """Upload and process a vendor shipment document"""
    try:
        # Get employee ID from session
        employee_id = None
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.form.get('session_token')
        if session_token:
            session_data = verify_session(session_token)
            if session_data and session_data.get('valid'):
                employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        # Check if this is a preview confirmation (has items data)
        items_data = request.form.get('items')
        file_path = request.form.get('file_path')
        
        if items_data and file_path:
            # This is a confirmation from preview - use the edited items
            import json
            try:
                items = json.loads(items_data)
            except:
                return jsonify({'success': False, 'message': 'Invalid items data'}), 400
            
            # Get form data
            vendor_id = request.form.get('vendor_id')
            if not vendor_id:
                return jsonify({'success': False, 'message': 'Vendor ID required'}), 400
            
            try:
                vendor_id = int(vendor_id)
            except ValueError:
                return jsonify({'success': False, 'message': 'Invalid vendor ID'}), 400
            
            purchase_order_number = request.form.get('purchase_order_number', '').strip()
            expected_delivery_date = request.form.get('expected_delivery_date', '').strip() or None
            verification_mode = request.form.get('verification_mode', 'auto_add').strip()
            
            # Validate verification_mode
            if verification_mode not in ('auto_add', 'verify_whole_shipment'):
                verification_mode = 'auto_add'
            
            # Create pending shipment with the edited items
            try:
                pending_shipment_id = create_pending_shipment(
                    vendor_id=vendor_id,
                    file_path=file_path,
                    expected_date=expected_delivery_date,
                    purchase_order_number=purchase_order_number if purchase_order_number else None,
                    uploaded_by=employee_id,
                    verification_mode=verification_mode
                )
            except Exception as e:
                return jsonify({'success': False, 'message': f'Error creating pending shipment: {str(e)}'}), 400
            
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
            
            return jsonify({
                'success': True,
                'pending_shipment_id': pending_shipment_id,
                'items_added': items_added,
                'total_expected': total_expected,
                'total_cost': total_cost
            })
        
        # Original flow: file upload
        # Check if file is present
        if 'document' not in request.files:
            return jsonify({'success': False, 'message': 'No document file provided'}), 400
        
        file = request.files['document']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        # Get form data
        vendor_id = request.form.get('vendor_id')
        if not vendor_id:
            return jsonify({'success': False, 'message': 'Vendor ID required'}), 400
        
        try:
            vendor_id = int(vendor_id)
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid vendor ID'}), 400
        
        purchase_order_number = request.form.get('purchase_order_number', '').strip()
        expected_delivery_date = request.form.get('expected_delivery_date', '').strip() or None
        verification_mode = request.form.get('verification_mode', 'auto_add').strip()
        
        # Validate verification_mode
        if verification_mode not in ('auto_add', 'verify_whole_shipment'):
            verification_mode = 'auto_add'
        
        # Save uploaded file
        filename = secure_filename(f"{vendor_id}_{datetime.now().timestamp()}_{file.filename}")
        upload_dir = 'uploads/shipments'
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)
        
        # Process document and create pending shipment
        result = create_shipment_from_document(
            file_path=file_path,
            vendor_id=vendor_id,
            purchase_order_number=purchase_order_number if purchase_order_number else None,
            expected_delivery_date=expected_delivery_date,
            uploaded_by=employee_id,
            verification_mode=verification_mode
        )
        
        if not result.get('success'):
            # Clean up uploaded file on error
            try:
                os.remove(file_path)
            except:
                pass
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Authentication endpoints (Clerk temporarily disabled)
@app.route('/api/clerk/link', methods=['POST'])
def api_link_clerk_user():
    return jsonify({'success': False, 'message': 'Clerk auth is temporarily disabled.'}), 410

@app.route('/api/clerk/pin-login', methods=['POST'])
def api_pin_login():
    return jsonify({'success': False, 'message': 'Clerk auth is temporarily disabled.'}), 410

@app.route('/api/clerk/employee', methods=['GET'])
def api_get_employee_by_clerk():
    return jsonify({'success': False, 'message': 'Clerk auth is temporarily disabled.'}), 410

@app.route('/api/generate-pin', methods=['POST'])
def api_generate_pin():
    """Generate a random PIN"""
    try:
        pin = generate_pin()
        return jsonify({
            'success': True,
            'pin': pin
        })
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in api_generate_pin: {error_trace}")
        return jsonify({'success': False, 'error': str(e), 'trace': error_trace}), 500

@app.route('/api/login', methods=['POST'])
def api_login():
    """Employee login"""
    try:
        print("Login request received")
        # Check if request has JSON data
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        print(f"Login attempt for: {data.get('username') or data.get('employee_code')}")
        
        # Validate required fields
        username = data.get('username')
        employee_code = data.get('employee_code')
        password = data.get('password')
        
        if not password:
            return jsonify({'success': False, 'message': 'Password is required'}), 400
        
        if not username and not employee_code:
            return jsonify({'success': False, 'message': 'Username or employee code is required'}), 400
        
        # Call login function
        print("Calling employee_login...")
        result = employee_login(
            username=username,
            employee_code=employee_code,
            password=password,
            ip_address=request.remote_addr or '127.0.0.1',
            device_info=request.headers.get('User-Agent', 'Unknown')
        )
        print(f"Login result: success={result.get('success')}")
        
        return jsonify(result)
    except Exception as e:
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/verify_session', methods=['POST'])
def api_verify_session():
    """Verify session token"""
    try:
        if not request.json:
            return jsonify({'valid': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        result = verify_session(data.get('session_token'))
        return jsonify(result)
    except Exception as e:
        print(f"Verify session error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'valid': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/logout', methods=['POST'])
def api_logout():
    """Employee logout"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        result = employee_logout(data.get('session_token'))
        return jsonify(result)
    except Exception as e:
        print(f"Logout error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/create_order', methods=['POST'])
def api_create_order():
    """Create a new order"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        from database import create_order
        settings = get_establishment_settings(None)
        # Use store default sales tax % when tax_rate not provided or zero
        tax_rate = data.get('tax_rate')
        if tax_rate is None or (isinstance(tax_rate, (int, float)) and float(tax_rate) == 0):
            pct = float(settings.get('default_sales_tax_pct') or 0)
            tax_rate = pct / 100.0
        else:
            tax_rate = float(tax_rate)
        fee_rates = settings.get('transaction_fee_rates')
        result = create_order(
            employee_id=data.get('employee_id'),
            items=data.get('items', []),
            payment_method=data.get('payment_method', 'cash'),
            tax_rate=tax_rate,
            discount=data.get('discount', 0.0),
            customer_id=data.get('customer_id'),
            tip=data.get('tip', 0.0),
            order_type=data.get('order_type'),
            customer_info=data.get('customer_info'),
            points_used=int(data.get('points_used', 0) or 0),
            transaction_fee_rates=fee_rates
        )
        
        # Post to accounting (accounting.transactions) so Accounting page reflects the sale
        if result.get('success') and result.get('order_id'):
            employee_id = data.get('employee_id')
            if not employee_id and request.headers.get('Authorization'):
                session_token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
                if session_token:
                    session_data = verify_session(session_token)
                    if session_data and session_data.get('valid'):
                        employee_id = session_data.get('employee_id')
            if not employee_id:
                try:
                    conn = get_connection()
                    cur = conn.cursor()
                    cur.execute("SELECT employee_id FROM employees WHERE is_active = 1 ORDER BY employee_id LIMIT 1")
                    row = cur.fetchone()
                    conn.close()
                    employee_id = row[0] if row and isinstance(row, tuple) else (row.get('employee_id') if isinstance(row, dict) else None)
                except Exception:
                    employee_id = None
            if employee_id:
                try:
                    from pos_accounting_bridge import journalize_sale_to_accounting
                    jr = journalize_sale_to_accounting(result['order_id'], int(employee_id))
                    if not jr.get('success'):
                        print(f"Accounting journalize_sale (order {result['order_id']}): {jr.get('message', 'unknown')}")
                except Exception as je:
                    import traceback
                    print(f"Accounting journalize_sale error (order {result['order_id']}): {je}")
                    traceback.print_exc()
        
        return jsonify(result)
    except Exception as e:
        print(f"Create order error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/receipt/transaction/<int:transaction_id>', methods=['GET'])
def api_generate_transaction_receipt(transaction_id):
    """Generate receipt PDF for a transaction"""
    try:
        from receipt_generator import generate_transaction_receipt
        
        pdf_bytes = generate_transaction_receipt(transaction_id)
        
        if pdf_bytes:
            response = Response(pdf_bytes, mimetype='application/pdf')
            response.headers['Content-Disposition'] = f'attachment; filename=receipt_transaction_{transaction_id}.pdf'
            return response
        else:
            return jsonify({'success': False, 'message': 'Transaction not found or error generating receipt'}), 404
    except ImportError as e:
        return jsonify({'success': False, 'message': 'Receipt generation not available. Install reportlab: pip install reportlab qrcode'}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receipt/<int:order_id>', methods=['GET'])
def api_generate_receipt(order_id):
    """Generate receipt PDF for an order"""
    try:
        from receipt_generator import generate_receipt_with_barcode
        
        pdf_bytes = generate_receipt_with_barcode(order_id)
        
        if pdf_bytes:
            response = Response(pdf_bytes, mimetype='application/pdf')
            response.headers['Content-Disposition'] = f'attachment; filename=receipt_{order_id}.pdf'
            return response
        else:
            return jsonify({'success': False, 'message': 'Order not found or error generating receipt'}), 404
    except ImportError as e:
        return jsonify({'success': False, 'message': 'Receipt generation not available. Install reportlab: pip install reportlab qrcode'}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receipt-settings', methods=['GET'])
def api_get_receipt_settings():
    """Get receipt settings"""
    try:
        from receipt_generator import get_receipt_settings
        settings = get_receipt_settings()
        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receipt-settings', methods=['POST'])
def api_update_receipt_settings():
    """Update receipt settings (PostgreSQL)"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        data = request.json
        conn, cursor = _pg_conn()
        try:
            cursor.execute("SELECT COUNT(*) AS c FROM receipt_settings")
            count = cursor.fetchone()['c']
            vals = (
                data.get('store_name', 'Store'),
                data.get('store_address', ''),
                data.get('store_city', ''),
                data.get('store_state', ''),
                data.get('store_zip', ''),
                data.get('store_phone', ''),
                data.get('store_email', ''),
                data.get('store_website', ''),
                data.get('footer_message', 'Thank you for your business!'),
                data.get('return_policy', ''),
                data.get('show_tax_breakdown', 1),
                data.get('show_payment_method', 1),
                data.get('show_signature', 0),
            )
            if count == 0:
                cursor.execute("""
                    INSERT INTO receipt_settings (
                        store_name, store_address, store_city, store_state, store_zip,
                        store_phone, store_email, store_website, footer_message, return_policy,
                        show_tax_breakdown, show_payment_method, show_signature
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, vals)
            else:
                cursor.execute("""
                    UPDATE receipt_settings SET
                        store_name = %s, store_address = %s, store_city = %s, store_state = %s,
                        store_zip = %s, store_phone = %s, store_email = %s, store_website = %s,
                        footer_message = %s, return_policy = %s,
                        show_tax_breakdown = %s, show_payment_method = %s, show_signature = %s,
                        updated_at = NOW()
                    WHERE id = (SELECT id FROM receipt_settings ORDER BY id DESC LIMIT 1)
                """, vals)
            conn.commit()
            return jsonify({'success': True, 'message': 'Receipt settings updated successfully'})
        finally:
            conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receipt-templates', methods=['GET'])
def api_list_receipt_templates():
    """List custom receipt templates"""
    try:
        conn, cursor = _pg_conn()
        try:
            cursor.execute("""
                SELECT id, name, settings, created_at
                FROM receipt_templates
                ORDER BY created_at DESC
            """)
            rows = cursor.fetchall()
            templates = []
            for r in rows:
                templates.append({
                    'id': r['id'],
                    'name': r['name'],
                    'settings': r['settings'] if isinstance(r['settings'], dict) else (json.loads(r['settings']) if isinstance(r['settings'], str) else {}),
                    'created_at': r['created_at'].isoformat() if hasattr(r['created_at'], 'isoformat') else str(r['created_at'])
                })
            return jsonify({'success': True, 'templates': templates})
        finally:
            conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receipt-templates', methods=['POST'])
def api_create_receipt_template():
    """Create a new named receipt template"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        data = request.json
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'success': False, 'message': 'Template name is required'}), 400
        settings = data.get('settings')
        if settings is None:
            settings = {}
        conn, cursor = _pg_conn()
        try:
            cursor.execute("""
                INSERT INTO receipt_templates (name, settings)
                VALUES (%s, %s)
                RETURNING id, name, settings, created_at
            """, (name, json.dumps(settings) if not isinstance(settings, str) else settings))
            row = cursor.fetchone()
            conn.commit()
            return jsonify({
                'success': True,
                'template': {
                    'id': row['id'],
                    'name': row['name'],
                    'settings': row['settings'] if isinstance(row['settings'], dict) else json.loads(row['settings'] or '{}'),
                    'created_at': row['created_at'].isoformat() if hasattr(row['created_at'], 'isoformat') else str(row['created_at'])
                }
            })
        finally:
            conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pos-settings', methods=['GET'])
def api_get_pos_settings():
    """Get POS settings (PostgreSQL)"""
    try:
        conn, cursor = _pg_conn()
        try:
            cursor.execute("SELECT * FROM pos_settings ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            if row:
                settings = {'num_registers': row.get('num_registers', 1), 'register_type': row.get('register_type', 'one_screen')}
            else:
                settings = {'num_registers': 1, 'register_type': 'one_screen'}
            return jsonify({'success': True, 'settings': settings})
        finally:
            conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pos-settings', methods=['POST'])
def api_update_pos_settings():
    """Update POS settings (PostgreSQL)"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        data = request.get_json()
        if data is None:
            return jsonify({'success': False, 'message': 'Invalid JSON in request body'}), 400
        num_registers = data.get('num_registers', 1)
        register_type = data.get('register_type', 'one_screen')
        if register_type not in ['one_screen', 'two_screen']:
            register_type = 'one_screen'
        try:
            num_registers = int(num_registers)
            if num_registers < 1:
                num_registers = 1
        except (ValueError, TypeError):
            num_registers = 1
        conn, cursor = _pg_conn()
        try:
            cursor.execute("SELECT COUNT(*) AS c FROM pos_settings")
            count = cursor.fetchone()['c']
            if count == 0:
                cursor.execute("INSERT INTO pos_settings (num_registers, register_type) VALUES (%s, %s)", (num_registers, register_type))
            else:
                cursor.execute("""
                    UPDATE pos_settings SET num_registers = %s, register_type = %s, updated_at = NOW()
                    WHERE id = (SELECT id FROM pos_settings ORDER BY id DESC LIMIT 1)
                """, (num_registers, register_type))
            conn.commit()
            return jsonify({'success': True, 'message': 'POS settings updated successfully'})
        finally:
            conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pos-search-filters', methods=['GET'])
def api_get_pos_search_filters():
    """Get configurable POS search filter definitions (size/topping/modifier abbrevs for pizza, drinks, bouquets, etc.)."""
    try:
        settings = get_establishment_settings(None)
        filters = settings.get('pos_search_filters')
        return jsonify({'success': True, 'data': filters if filters is not None else _default_pos_search_filters()})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

def _default_pos_search_filters():
    """Default filter groups for pizza/drinks (configurable per store)."""
    return {
        'filter_groups': [
            {
                'id': 'size',
                'label': 'Size',
                'applies_to_categories': ['Pizza', 'Drinks', 'Beverages'],
                'options': [
                    {'abbrevs': ['sm', 's'], 'value': 'Small', 'variant_name': 'Small'},
                    {'abbrevs': ['md', 'm', 'med'], 'value': 'Medium', 'variant_name': 'Medium'},
                    {'abbrevs': ['lg', 'l'], 'value': 'Large', 'variant_name': 'Large'},
                    {'abbrevs': ['slice', 'sl'], 'value': 'Slice', 'variant_name': 'Slice'},
                    {'abbrevs': ['10', '10in'], 'value': '10"', 'variant_name': '10"'},
                    {'abbrevs': ['12', '12in'], 'value': '12"', 'variant_name': '12"'},
                    {'abbrevs': ['14', '14in'], 'value': '14"', 'variant_name': '14"'},
                ],
            },
            {
                'id': 'topping',
                'label': 'Topping',
                'applies_to_categories': ['Pizza'],
                'options': [
                    {'abbrevs': ['roni', 'pep'], 'value': 'Pepperoni'},
                    {'abbrevs': ['pep'], 'value': 'Peppers', 'quantity_abbrevs': {'1/2': '½', 'half': '½', 'full': 'Full'}},
                    {'abbrevs': ['mush'], 'value': 'Mushrooms'},
                    {'abbrevs': ['olive'], 'value': 'Olives'},
                    {'abbrevs': ['saus'], 'value': 'Sausage'},
                    {'abbrevs': ['ham'], 'value': 'Ham'},
                    {'abbrevs': ['bacon'], 'value': 'Bacon'},
                    {'abbrevs': ['pine', 'pineapple'], 'value': 'Pineapple'},
                    {'abbrevs': ['onion'], 'value': 'Onion'},
                    {'abbrevs': ['jal'], 'value': 'Jalapeño'},
                ],
            },
            {
                'id': 'drink_addin',
                'label': 'Add-in',
                'applies_to_categories': ['Drinks', 'Beverages'],
                'options': [
                    {'abbrevs': ['esp', 'shot'], 'value': 'Extra shot'},
                    {'abbrevs': ['oat'], 'value': 'Oat milk'},
                    {'abbrevs': ['almond'], 'value': 'Almond milk'},
                    {'abbrevs': ['ice'], 'value': 'Iced'},
                    {'abbrevs': ['decaf'], 'value': 'Decaf'},
                ],
            },
        ],
    }

@app.route('/api/pos-search-filters', methods=['POST'])
def api_update_pos_search_filters():
    """Update POS search filter definitions (for any product type: pizza, drinks, bouquets, etc.)."""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        data = request.get_json()
        if data is None:
            return jsonify({'success': False, 'message': 'Invalid JSON'}), 400
        filters = data.get('filter_groups') is not None and {'filter_groups': data.get('filter_groups')} or data
        from database import update_establishment_settings
        ok = update_establishment_settings(None, {'pos_search_filters': filters})
        if not ok:
            return jsonify({'success': False, 'message': 'Failed to update settings'}), 500
        return jsonify({'success': True, 'message': 'POS search filters updated', 'data': filters})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Get all tables endpoint
@app.route('/api/tables/list')
def api_list_tables():
    """Get list of all tables in the database (excluding receipt_preferences)"""
    try:
        tables = _pg_allowed_tables()
        tables = sorted([t for t in tables if t != 'receipt_preferences'])
        return jsonify({'tables': tables})
    except Exception as e:
        print(f"Error listing tables: {e}")
        traceback.print_exc()
        return jsonify({'tables': [], 'error': str(e)}), 500

# Raw table endpoints for admin table viewer (always direct table access + metadata)
@app.route('/api/tables/<table_name>', methods=['GET'])
def api_tables_table(table_name):
    """Raw table access for the Tables UI (includes PK metadata)."""
    try:
        allowed_tables = _pg_allowed_tables()
    except Exception as e:
        print(f"Error getting table list: {e}")
        return jsonify({'columns': [], 'data': [], 'error': 'Database error'}), 500
    if table_name not in allowed_tables:
        return jsonify({'columns': [], 'data': [], 'error': 'Table not found'}), 404
    try:
        result = get_table_data_for_admin(table_name)
        return jsonify(result)
    except Exception as e:
        print(f"Error loading table {table_name}: {e}")
        traceback.print_exc()
        return jsonify({'columns': [], 'data': [], 'error': str(e)}), 500

# Generic table endpoints
@app.route('/api/<table_name>', methods=['GET'])
def api_table(table_name):
    """Generic endpoint for any table (read-only)"""
    try:
        allowed_tables = _pg_allowed_tables()
    except Exception as e:
        print(f"Error getting table list: {e}")
        return jsonify({'columns': [], 'data': [], 'error': 'Database error'}), 500
    if table_name not in allowed_tables:
        return jsonify({'columns': [], 'data': [], 'error': 'Table not found'}), 404
    try:
        result = get_table_data_for_admin(table_name)
        return jsonify(result)
    except Exception as e:
        print(f"Error loading table {table_name}: {e}")
        traceback.print_exc()
        return jsonify({'columns': [], 'data': [], 'error': str(e)}), 500

@app.route('/api/tables/<table_name>/rows', methods=['DELETE'])
@app.route('/api/<table_name>/rows', methods=['DELETE'])
def api_delete_table_rows(table_name):
    """
    Delete one or more rows from a table (PostgreSQL).
    Request JSON: single-column PK { "ids": [1,2,3] } or composite PK { "keys": [ {"pk1":..., "pk2":...}, ... ] }.
    """
    try:
        allowed_tables = _pg_allowed_tables()
    except Exception as e:
        print(f"Error getting table list: {e}")
        return jsonify({'success': False, 'message': 'Database error'}), 500
    if table_name not in allowed_tables:
        return jsonify({'success': False, 'message': 'Table not found'}), 404
    if not request.is_json:
        return jsonify({'success': False, 'message': 'Invalid request data'}), 400
    payload = request.get_json(silent=True) or {}
    pk_cols = get_table_primary_key_columns(table_name)
    if not pk_cols:
        return jsonify({'success': False, 'message': 'Table has no primary key; delete by ids/keys not supported'}), 400
    try:
        conn, cursor = _pg_conn()
        deleted = 0
        try:
            if len(pk_cols) == 1:
                pk = pk_cols[0]
                ids = payload.get('ids', [])
                if not isinstance(ids, list) or len(ids) == 0:
                    return jsonify({'success': False, 'message': 'No ids provided'}), 400
                ph = sql.SQL(',').join([sql.Placeholder()] * len(ids))
                cursor.execute(sql.SQL("DELETE FROM {} WHERE {} IN ({})").format(
                    sql.Identifier(table_name), sql.Identifier(pk), ph), ids)
                deleted = cursor.rowcount
            else:
                keys = payload.get('keys', [])
                if not isinstance(keys, list) or len(keys) == 0:
                    return jsonify({'success': False, 'message': 'No keys provided'}), 400
                clauses = []
                params = []
                for k in keys:
                    if not isinstance(k, dict) or any(col not in k for col in pk_cols):
                        continue
                    clauses.append('(' + ' AND '.join([f"{c} = %s" for c in pk_cols]) + ')')
                    params.extend([k[col] for col in pk_cols])
                if not clauses:
                    return jsonify({'success': False, 'message': 'Invalid keys provided'}), 400
                q = "DELETE FROM {} WHERE " + " OR ".join(clauses)
                cursor.execute(sql.SQL(q).format(sql.Identifier(table_name)), params)
                deleted = cursor.rowcount
            conn.commit()
            return jsonify({'success': True, 'deleted': deleted})
        finally:
            conn.close()
    except Exception as e:
        print(f"Error deleting rows from {table_name}: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Specialized endpoints with joins
@app.route('/api/orders')
def api_orders():
    """Get orders with employee and customer names"""
    try:
        orders = list_orders()
        if not orders:
            return jsonify({'columns': [], 'data': []})
        
        columns = list(orders[0].keys())
        return jsonify({'columns': columns, 'data': orders})
    except Exception as e:
        print(f"Error in api_orders: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

@app.route('/api/orders/search', methods=['GET'])
def api_search_orders():
    """Search orders by order_number or order_id"""
    try:
        order_number = request.args.get('order_number')
        order_id = request.args.get('order_id')
        
        if not order_number and not order_id:
            return jsonify({'error': 'order_number or order_id required', 'data': []}), 400
        
        conn, cursor = _pg_conn()
        try:
            if order_id:
                # Search by order_id
                cursor.execute("""
                    SELECT 
                        o.*,
                        e.first_name || ' ' || e.last_name as employee_name,
                        c.customer_name
                    FROM orders o
                    LEFT JOIN employees e ON o.employee_id = e.employee_id
                    LEFT JOIN customers c ON o.customer_id = c.customer_id
                    WHERE o.order_id = %s
                """, (int(order_id),))
            else:
                # Search by order_number (exact match, case-insensitive, or partial)
                cursor.execute("""
                    SELECT 
                        o.*,
                        e.first_name || ' ' || e.last_name as employee_name,
                        c.customer_name
                    FROM orders o
                    LEFT JOIN employees e ON o.employee_id = e.employee_id
                    LEFT JOIN customers c ON o.customer_id = c.customer_id
                    WHERE o.order_number::text ILIKE %s
                       OR o.order_number::text = %s
                    ORDER BY o.order_date DESC
                    LIMIT 10
                """, (f'%{order_number}%', order_number))
            
            rows = cursor.fetchall()
            data = [dict(r) for r in rows]
            return jsonify({'data': data})
        finally:
            conn.close()
    except Exception as e:
        print(f"Error in api_search_orders: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'data': []}), 500

@app.route('/api/orders/<int:order_id>/void', methods=['POST'])
def api_void_order(order_id):
    """Void an order (reverses inventory and posts accounting reversal)"""
    try:
        employee_id = None
        data = request.json or {}
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '').strip() or data.get('session_token')
        if session_token:
            session_data = verify_session(session_token)
            if session_data and session_data.get('valid'):
                employee_id = session_data.get('employee_id')
        if not employee_id:
            employee_id = data.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID or session required'}), 401
        from database import void_order
        result = void_order(order_id=order_id, employee_id=employee_id, reason=data.get('reason'))
        if result.get('success'):
            return jsonify(result), 200
        return jsonify(result), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/order_items')
def api_order_items():
    """Get order items with product details"""
    try:
        order_id = request.args.get('order_id')
        conn, cursor = _pg_conn()
        try:
            if order_id:
                # Fetch items for specific order
                cursor.execute("""
                    SELECT 
                        oi.*,
                        i.product_name,
                        i.sku,
                        o.order_number
                    FROM order_items oi
                    LEFT JOIN inventory i ON oi.product_id = i.product_id
                    LEFT JOIN orders o ON oi.order_id = o.order_id
                    WHERE oi.order_id = %s
                    ORDER BY oi.order_item_id
                """, (int(order_id),))
            else:
                # Fetch all order items
                cursor.execute("""
                    SELECT 
                        oi.*,
                        i.product_name,
                        i.sku,
                        o.order_number
                    FROM order_items oi
                    LEFT JOIN inventory i ON oi.product_id = i.product_id
                    LEFT JOIN orders o ON oi.order_id = o.order_id
                    ORDER BY oi.order_id DESC, oi.order_item_id
                """)
            rows = cursor.fetchall()
            columns = list(rows[0].keys()) if rows else []
            data = [dict(r) for r in rows]
            return jsonify({'columns': columns, 'data': data})
        finally:
            conn.close()
    except Exception as e:
        print(f"Error in api_order_items: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

@app.route('/api/payment_transactions')
def api_payment_transactions():
    """Get payment transactions with order details"""
    try:
        conn, cursor = _pg_conn()
        try:
            cursor.execute("""
                SELECT 
                    pt.*,
                    o.order_number,
                    o.total as order_total
                FROM payment_transactions pt
                JOIN orders o ON pt.order_id = o.order_id
                ORDER BY pt.transaction_date DESC
            """)
            rows = cursor.fetchall()
            columns = list(rows[0].keys()) if rows else []
            data = [dict(r) for r in rows]
            return jsonify({'columns': columns, 'data': data})
        finally:
            conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

@app.route('/api/employees')
def api_employees():
    """Get employees data"""
    try:
        employees = list_employees(active_only=False)
        if not employees:
            return jsonify({'columns': [], 'data': []})
        
        if len(employees) > 0:
            columns = list(employees[0].keys())
        else:
            columns = []
        return jsonify({'columns': columns, 'data': employees})
    except Exception as e:
        print(f"Error in api_employees: {e}")
        import traceback
        traceback.print_exc()
        # Return proper JSON error response - ensure it's always valid JSON
        try:
            return jsonify({
                'error': str(e),
                'columns': [],
                'data': []
            }), 500
        except Exception as json_err:
            # Last resort - return plain JSON string
            return Response(
                '{"error": "Internal server error", "columns": [], "data": []}',
                mimetype='application/json',
                status=500
            )

@app.route('/api/customers', methods=['GET', 'POST'])
def api_customers():
    """Get customers data (GET) or create customer (POST)"""
    if request.method == 'POST':
        try:
            data = request.get_json() or {}
            cid = add_customer(
                customer_name=data.get('customer_name'),
                email=data.get('email'),
                phone=data.get('phone'),
                address=data.get('address'),
                establishment_id=None
            )
            return jsonify({'success': True, 'customer_id': cid})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 400
    columns, data = get_table_data('customers')
    return jsonify({'columns': columns, 'data': data})


@app.route('/api/customers/<int:customer_id>', methods=['GET', 'PUT'])
def api_customer_by_id(customer_id):
    """Get one customer (GET) or update customer (PUT)."""
    if request.method == 'GET':
        try:
            customer = get_customer(customer_id)
            if not customer:
                return jsonify({'success': False, 'message': 'Customer not found'}), 404
            return jsonify({'success': True, 'data': customer})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500
    # PUT
    try:
        data = request.get_json() or {}
        ok = update_customer(
            customer_id,
            customer_name=data.get('customer_name'),
            email=data.get('email'),
            phone=data.get('phone'),
            address=data.get('address')
        )
        if not ok:
            return jsonify({'success': False, 'message': 'Customer not found or no changes'}), 404
        customer = get_customer(customer_id)
        return jsonify({'success': True, 'data': customer})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 400


@app.route('/api/customers/<int:customer_id>/points', methods=['POST'])
def api_customer_add_points(customer_id):
    """Add or subtract loyalty points (body: points (int), optional reason)."""
    try:
        data = request.get_json() or {}
        points = data.get('points')
        if points is None:
            return jsonify({'success': False, 'message': 'points required'}), 400
        try:
            points = int(points)
        except (TypeError, ValueError):
            return jsonify({'success': False, 'message': 'points must be an integer'}), 400
        new_balance = add_customer_points(customer_id, points, reason=data.get('reason'))
        if new_balance is None:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        return jsonify({'success': True, 'data': {'loyalty_points': new_balance}})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/customers/search')
def api_customers_search():
    """Search customers by name, email, or phone (for POS customer lookup)."""
    try:
        q = request.args.get('q', '').strip()
        establishment_id = request.args.get('establishment_id', type=int) or None
        results = search_customers(establishment_id, q, limit=20)
        return jsonify({'success': True, 'data': results})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'data': [], 'message': str(e)}), 500


@app.route('/api/customers/<int:customer_id>/rewards')
def api_customer_rewards(customer_id):
    """Get customer rewards detail: points, order count, total spent, popular items."""
    try:
        detail = get_customer_rewards_detail(customer_id)
        if not detail:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        return jsonify({'success': True, 'data': detail})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/employee_schedule', methods=['GET', 'POST'])
def api_employee_schedule():
    """Get or create employee schedule"""
    if request.method == 'GET':
        # Get employee schedule with employee names
        conn, cursor = _pg_conn()
        
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        employee_id = request.args.get('employee_id')
        
        # Get schedules from employee_schedule table (old system)
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
        
        if start_date:
            query += " AND es.schedule_date >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND es.schedule_date <= %s"
            params.append(end_date)
        
        if employee_id:
            query += " AND es.employee_id = %s"
            params.append(employee_id)
        
        cursor.execute(query, params)
        old_schedules = cursor.fetchall()
        
        # Also get published schedules from Scheduled_Shifts (new system)
        cursor.execute("""
            SELECT EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'scheduled_shifts') AS ok
        """)
        row = cursor.fetchone()
        has_scheduled_shifts = row and row.get('ok')
        
        new_schedules = []
        if has_scheduled_shifts:
            new_query = """
                SELECT 
                    ss.scheduled_shift_id as schedule_id,
                    ss.employee_id,
                    ss.shift_date as schedule_date,
                    ss.start_time,
                    ss.end_time,
                    ss.break_duration,
                    ss.notes,
                    NULL as clock_in_time,
                    NULL as clock_out_time,
                    NULL as hours_worked,
                    NULL as overtime_hours,
                    'scheduled' as status,
                    0 as confirmed,
                    NULL as confirmed_at,
                    e.first_name || ' ' || e.last_name as employee_name,
                    e.employee_code
                FROM Scheduled_Shifts ss
                JOIN employees e ON ss.employee_id = e.employee_id
                JOIN Schedule_Periods sp ON ss.period_id = sp.period_id
                WHERE ss.is_draft = 0 AND sp.status = 'published'
            """
            new_params = []
            
            if start_date:
                new_query += " AND ss.shift_date >= %s"
                new_params.append(start_date)
            
            if end_date:
                new_query += " AND ss.shift_date <= %s"
                new_params.append(end_date)
            
            if employee_id:
                new_query += " AND ss.employee_id = %s"
                new_params.append(employee_id)
            
            new_query += " ORDER BY ss.shift_date DESC, ss.start_time"
            
            cursor.execute(new_query, new_params)
            new_schedules = cursor.fetchall()
        
        # Combine both schedules
        all_schedules = []
        
        # Add old schedules
        for row in old_schedules:
            schedule_dict = {col: row[col] for col in row.keys()}
            all_schedules.append(schedule_dict)
        
        # Add new schedules (convert to same format)
        for row in new_schedules:
            schedule_dict = {col: row[col] for col in row.keys()}
            all_schedules.append(schedule_dict)
        
        # Sort by date and time
        all_schedules.sort(key=lambda x: (
            x.get('schedule_date') or '',
            x.get('start_time') or ''
        ), reverse=True)
        
        # Get columns (use columns from first schedule, or from old query if no schedules)
        if all_schedules:
            columns = list(all_schedules[0].keys())
        else:
            columns = [description[0] for description in cursor.description] if old_schedules else []
        
        conn.close()
        return jsonify({'columns': columns, 'data': _sanitize_for_json(all_schedules)})
    
    elif request.method == 'POST':
        # Create new schedule
        try:
            if not request.json:
                return jsonify({'success': False, 'message': 'Invalid request data'}), 400
            
            data = request.json
            from database import add_schedule, add_calendar_event, get_employee
            
            # Get employee info for calendar event
            employee = get_employee(data.get('employee_id'))
            if not employee:
                return jsonify({'success': False, 'message': 'Employee not found'}), 404
            
            # Create schedule
            schedule_id = add_schedule(
                employee_id=data.get('employee_id'),
                schedule_date=data.get('schedule_date'),
                start_time=data.get('start_time'),
                end_time=data.get('end_time'),
                break_duration=data.get('break_duration', 0),
                notes=data.get('notes')
            )
            
            # Add to master calendar
            employee_name = f"{employee['first_name']} {employee['last_name']}"
            title = f"{employee_name}: {data.get('start_time', '')} - {data.get('end_time', '')}"
            
            # Get current user from session if available
            created_by = None
            session_token = request.headers.get('Authorization') or request.json.get('session_token')
            if session_token:
                try:
                    from database import verify_session
                    session_data = verify_session(session_token)
                    if session_data.get('valid'):
                        created_by = session_data.get('employee_id')
                except:
                    pass
            
            add_calendar_event(
                event_date=data.get('schedule_date'),
                event_type='schedule',
                title=title,
                description=data.get('notes'),
                start_time=data.get('start_time'),
                end_time=data.get('end_time'),
                related_id=schedule_id,
                related_table='employee_schedule',
                created_by=created_by
            )
            
            return jsonify({
                'success': True,
                'schedule_id': schedule_id,
                'message': 'Schedule created successfully'
            })
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/time_clock')
def api_time_clock():
    """Get time clock entries with employee names"""
    conn, cursor = _pg_conn()
    
    cursor.execute("""
        SELECT 
            tc.*,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_code
        FROM time_clock tc
        JOIN employees e ON tc.employee_id = e.employee_id
        ORDER BY tc.clock_in DESC
    """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

@app.route('/api/employee_sessions')
def api_employee_sessions():
    """Get employee sessions with employee names"""
    conn, cursor = _pg_conn()
    
    cursor.execute("""
        SELECT 
            es.*,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_code
        FROM employee_sessions es
        JOIN employees e ON es.employee_id = e.employee_id
        ORDER BY es.login_time DESC
    """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

@app.route('/api/clock/status', methods=['GET'])
def api_clock_status():
    """Get current clock status for the logged-in employee"""
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        clock_status = get_current_clock_status(employee_id)
        
        if clock_status:
            return jsonify({
                'success': True,
                'clocked_in': True,
                'clock_in_time': clock_status.get('clock_in_time'),
                'schedule_id': clock_status.get('schedule_id'),
                'employee_name': clock_status.get('employee_name'),
                'schedule_date': clock_status.get('schedule_date'),
                'start_time': clock_status.get('start_time'),
                'end_time': clock_status.get('end_time')
            })
        else:
            return jsonify({
                'success': True,
                'clocked_in': False
            })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/clock/in', methods=['POST'])
def api_clock_in():
    """
    Clock in employee with schedule comparison
    This endpoint is used by BOTH button click and face recognition methods.
    Both methods save identical data to the employee_schedule table.
    """
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        # Get employee info
        employee = get_employee(employee_id)
        if not employee:
            return jsonify({'success': False, 'message': 'Employee not found'}), 404
        
        employee_name = f"{employee['first_name']} {employee['last_name']}"
        clock_in_time = datetime.now()
        today = clock_in_time.date().isoformat()
        current_time = clock_in_time.time()
        
        # Get schedule for today
        conn, cursor = _pg_conn()
        
        # Check for schedule in employee_schedule table
        cursor.execute("""
            SELECT schedule_id, start_time, end_time, schedule_date
            FROM employee_schedule
            WHERE employee_id = %s AND schedule_date = %s
            ORDER BY start_time
            LIMIT 1
        """, (employee_id, today))
        
        schedule = cursor.fetchone()
        
        if not schedule:
            cursor.execute("""
                SELECT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'scheduled_shifts') AS ok
            """)
            r = cursor.fetchone()
            has_scheduled_shifts = r and r.get('ok')
            if has_scheduled_shifts:
                cursor.execute("""
                    SELECT ss.scheduled_shift_id, ss.shift_date, ss.start_time, ss.end_time
                    FROM Scheduled_Shifts ss
                    JOIN Schedule_Periods sp ON ss.period_id = sp.period_id
                    WHERE ss.employee_id = %s 
                      AND ss.shift_date = %s
                      AND ss.is_draft = 0 
                      AND sp.status = 'published'
                    ORDER BY ss.start_time
                    LIMIT 1
                """, (employee_id, today))
                schedule = cursor.fetchone()
        
        comparison_result = {
            'has_schedule': False,
            'status': 'no_schedule',
            'message': 'No schedule found for today',
            'scheduled_start_time': None,
            'scheduled_end_time': None,
            'minutes_late': 0,
            'on_time': False,
            'early': False,
            'wrong_hours': False
        }
        
        if schedule:
            schedule_dict = dict(schedule)
            scheduled_start = schedule_dict.get('start_time')
            scheduled_end = schedule_dict.get('end_time')
            
            if scheduled_start:
                comparison_result['has_schedule'] = True
                comparison_result['scheduled_start_time'] = scheduled_start
                comparison_result['scheduled_end_time'] = scheduled_end
                
                # Parse scheduled start time
                start_parts = scheduled_start.split(':')
                scheduled_hour = int(start_parts[0])
                scheduled_minute = int(start_parts[1]) if len(start_parts) > 1 else 0
                scheduled_time_obj = datetime.combine(clock_in_time.date(), 
                                                      time(scheduled_hour, scheduled_minute))
                current_time_obj = clock_in_time.replace(second=0, microsecond=0)
                
                # Calculate time difference in minutes
                time_diff_minutes = (current_time_obj - scheduled_time_obj).total_seconds() / 60
                
                # Determine status (5 minute grace period)
                if time_diff_minutes <= 5 and time_diff_minutes >= -5:
                    comparison_result['status'] = 'on_time'
                    comparison_result['message'] = 'Clocked in on time'
                    comparison_result['on_time'] = True
                elif time_diff_minutes > 5:
                    comparison_result['status'] = 'late'
                    comparison_result['message'] = f'Clocked in {int(time_diff_minutes)} minutes late'
                    comparison_result['minutes_late'] = int(time_diff_minutes)
                else:
                    comparison_result['status'] = 'early'
                    comparison_result['message'] = f'Clocked in {int(abs(time_diff_minutes))} minutes early'
                    comparison_result['early'] = True
                
                # Check if working at wrong hours (more than 2 hours early or late)
                if abs(time_diff_minutes) > 120:
                    comparison_result['wrong_hours'] = True
                    comparison_result['message'] += ' (Working at wrong hours)'
        
        # Clock in using database function
        schedule_id = None
        if schedule:
            schedule_dict = dict(schedule)
            schedule_id = schedule_dict.get('schedule_id') or schedule_dict.get('scheduled_shift_id')
        
        # Get location from request
        latitude = request.json.get('latitude')
        longitude = request.json.get('longitude')
        address = request.json.get('address')
        
        clock_result = clock_in(employee_id, schedule_id=schedule_id, schedule_date=today,
                                latitude=latitude, longitude=longitude, address=address)
        
        if clock_result['success']:
            response = {
                'success': True,
                'message': 'Clocked in successfully',
                'employee_name': employee_name,
                'clock_in_time': clock_in_time.isoformat(),
                'schedule_comparison': comparison_result
            }
            if 'location_validation' in clock_result:
                response['location_validation'] = clock_result['location_validation']
            return jsonify(response)
        else:
            return jsonify({
                'success': False,
                'message': clock_result.get('message', 'Failed to clock in')
            }), 400
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/clock/out', methods=['POST'])
def api_clock_out():
    """
    Clock out employee
    This endpoint is used by BOTH button click and face recognition methods.
    Both methods save identical data to the employee_schedule table.
    """
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        # Get current clock status
        clock_status = get_current_clock_status(employee_id)
        if not clock_status:
            return jsonify({'success': False, 'message': 'Not currently clocked in'}), 400
        
        schedule_id = clock_status.get('schedule_id')
        if not schedule_id:
            return jsonify({'success': False, 'message': 'Schedule ID not found'}), 400
        
        # Get location from request
        latitude = request.json.get('latitude') if request.is_json else None
        longitude = request.json.get('longitude') if request.is_json else None
        address = request.json.get('address') if request.is_json else None
        
        # Clock out
        clock_result = clock_out(employee_id, schedule_id,
                                 latitude=latitude, longitude=longitude, address=address)
        
        if clock_result['success']:
            # Get employee info
            employee = get_employee(employee_id)
            employee_name = f"{employee['first_name']} {employee['last_name']}" if employee else 'Unknown'
            
            response = {
                'success': True,
                'message': 'Clocked out successfully',
                'employee_name': employee_name,
                'clock_out_time': datetime.now().isoformat(),
                'hours_worked': clock_result.get('hours_worked'),
                'overtime_hours': clock_result.get('overtime_hours')
            }
            if 'location_validation' in clock_result:
                response['location_validation'] = clock_result['location_validation']
            return jsonify(response)
        else:
            return jsonify({
                'success': False,
                'message': clock_result.get('message', 'Failed to clock out')
            }), 400
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/face/register', methods=['POST'])
def api_register_face():
    """Register face encoding for an employee"""
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        data = request.json
        if not data or 'face_descriptor' not in data:
            return jsonify({'success': False, 'message': 'Face descriptor required'}), 400
        
        face_descriptor = data['face_descriptor']
        
        # Validate that face_descriptor is a list/array of numbers
        if not isinstance(face_descriptor, list):
            return jsonify({'success': False, 'message': 'Face descriptor must be an array'}), 400
        
        if len(face_descriptor) != 128:
            return jsonify({'success': False, 'message': 'Face descriptor must have 128 values'}), 400
        
        # Store face encoding in database
        conn, cursor = _pg_conn()
        
        # Check if face encoding already exists
        cursor.execute("""
            SELECT face_id FROM employee_face_encodings 
            WHERE employee_id = %s
        """, (employee_id,))
        
        existing = cursor.fetchone()
        
        if existing:
            # Update existing encoding
            cursor.execute("""
                UPDATE employee_face_encodings
                SET face_descriptor = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE employee_id = %s
            """, (json.dumps(face_descriptor), employee_id))
        else:
            # Insert new encoding
            cursor.execute("""
                INSERT INTO employee_face_encodings (
                    employee_id, face_descriptor
                ) VALUES (%s, %s)
            """, (employee_id, json.dumps(face_descriptor)))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Face registered successfully'
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/face/verify', methods=['POST'])
def api_verify_face():
    """Verify face against stored encoding"""
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        data = request.json
        if not data or 'face_descriptor' not in data:
            return jsonify({'success': False, 'message': 'Face descriptor required'}), 400
        
        input_descriptor = data['face_descriptor']
        
        # Validate descriptor
        if not isinstance(input_descriptor, list) or len(input_descriptor) != 128:
            return jsonify({'success': False, 'message': 'Invalid face descriptor'}), 400
        
        # Get stored face encoding for this employee
        conn, cursor = _pg_conn()
        
        cursor.execute("""
            SELECT face_descriptor FROM employee_face_encodings
            WHERE employee_id = %s
        """, (employee_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({
                'success': False,
                'message': 'No face registered for this employee',
                'verified': False
            }), 404
        
        # Parse stored descriptor
        stored_descriptor = json.loads(row[0])
        
        # Calculate cosine similarity (face-api.js uses cosine distance)
        # Similarity = 1 - distance, so we want similarity > threshold
        similarity = cosine_similarity(input_descriptor, stored_descriptor)
        
        # Threshold for face recognition (0.6 is typical, but can be adjusted)
        # face-api.js typically uses 0.6 as default threshold
        threshold = data.get('threshold', 0.6)
        verified = similarity >= threshold
        
        return jsonify({
            'success': True,
            'verified': verified,
            'similarity': similarity,
            'threshold': threshold,
            'message': 'Face verified' if verified else 'Face does not match'
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/face/status', methods=['GET'])
def api_face_status():
    """Check if employee has registered face"""
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        conn, cursor = _pg_conn()
        
        cursor.execute("""
            SELECT face_id, registered_at, updated_at
            FROM employee_face_encodings
            WHERE employee_id = %s
        """, (employee_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return jsonify({
                'success': True,
                'has_face': True,
                'registered_at': row[1],
                'updated_at': row[2]
            })
        else:
            return jsonify({
                'success': True,
                'has_face': False
            })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors"""
    import math
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(a * a for a in vec2))
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0
    
    return dot_product / (magnitude1 * magnitude2)

@app.route('/api/face/identify', methods=['POST'])
def api_identify_face():
    """
    Identify which employee a face belongs to by comparing against all registered faces.
    This is the core face recognition authentication service.
    """
    try:
        data = request.json
        if not data or 'face_descriptor' not in data:
            return jsonify({'success': False, 'message': 'Face descriptor required'}), 400
        
        input_descriptor = data['face_descriptor']
        
        # Validate descriptor
        if not isinstance(input_descriptor, list) or len(input_descriptor) != 128:
            return jsonify({'success': False, 'message': 'Invalid face descriptor'}), 400
        
        # Get all registered face encodings with employee info
        conn, cursor = _pg_conn()
        
        cursor.execute("""
            SELECT 
                efe.employee_id,
                efe.face_descriptor,
                e.first_name,
                e.last_name,
                e.employee_code,
                e.position,
                e.active
            FROM employee_face_encodings efe
            JOIN employees e ON efe.employee_id = e.employee_id
            WHERE e.active = 1
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return jsonify({
                'success': False,
                'message': 'No employees have registered faces',
                'employee_id': None
            }), 404
        
        # Compare against all registered faces and find best match
        best_match = None
        best_similarity = 0.0
        threshold = data.get('threshold', 0.6)  # Default threshold for face recognition
        
        for row in rows:
            stored_descriptor = json.loads(row['face_descriptor'])
            similarity = cosine_similarity(input_descriptor, stored_descriptor)
            
            if similarity > best_similarity and similarity >= threshold:
                best_similarity = similarity
                best_match = {
                    'employee_id': row['employee_id'],
                    'first_name': row['first_name'],
                    'last_name': row['last_name'],
                    'employee_code': row['employee_code'],
                    'position': row['position'],
                    'similarity': similarity
                }
        
        if best_match:
            return jsonify({
                'success': True,
                'identified': True,
                'employee_id': best_match['employee_id'],
                'employee_name': f"{best_match['first_name']} {best_match['last_name']}",
                'employee_code': best_match['employee_code'],
                'position': best_match['position'],
                'similarity': best_match['similarity'],
                'confidence': f"{(best_match['similarity'] * 100):.1f}%",
                'message': f"Face identified as {best_match['first_name']} {best_match['last_name']}"
            })
        else:
            return jsonify({
                'success': True,
                'identified': False,
                'best_similarity': best_similarity,
                'threshold': threshold,
                'message': f'Face not recognized. Best match: {(best_similarity * 100):.1f}% (needs ≥{threshold * 100:.0f}%)'
            })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/face/clock', methods=['POST'])
def api_face_clock():
    """
    Clock in or out using face recognition.
    First identifies the employee by face, then performs clock in/out.
    This allows employees to clock in/out without being logged in.
    """
    try:
        data = request.json
        if not data or 'face_descriptor' not in data:
            return jsonify({'success': False, 'message': 'Face descriptor required'}), 400
        
        action = data.get('action', 'clock_in')  # 'clock_in' or 'clock_out'
        input_descriptor = data['face_descriptor']
        
        # Validate descriptor
        if not isinstance(input_descriptor, list) or len(input_descriptor) != 128:
            return jsonify({'success': False, 'message': 'Invalid face descriptor'}), 400
        
        # Step 1: Identify the employee by face
        identify_data = request.json.copy()
        identify_data['threshold'] = data.get('threshold', 0.6)
        
        # Call internal identify function (simulate by calling the logic)
        conn, cursor = _pg_conn()
        
        cursor.execute("""
            SELECT 
                efe.employee_id,
                efe.face_descriptor,
                e.first_name,
                e.last_name,
                e.employee_code,
                e.position,
                e.active
            FROM employee_face_encodings efe
            JOIN employees e ON efe.employee_id = e.employee_id
            WHERE e.active = 1
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return jsonify({
                'success': False,
                'message': 'No employees have registered faces',
            }), 404
        
        # Find best match
        best_match = None
        best_similarity = 0.0
        threshold = data.get('threshold', 0.6)
        
        for row in rows:
            stored_descriptor = json.loads(row['face_descriptor'])
            similarity = cosine_similarity(input_descriptor, stored_descriptor)
            
            if similarity > best_similarity and similarity >= threshold:
                best_similarity = similarity
                best_match = {
                    'employee_id': row['employee_id'],
                    'first_name': row['first_name'],
                    'last_name': row['last_name'],
                    'employee_code': row['employee_code'],
                    'similarity': similarity
                }
        
        if not best_match:
            return jsonify({
                'success': False,
                'message': f'Face not recognized. Best match: {(best_similarity * 100):.1f}% (needs ≥{threshold * 100:.0f}%)',
                'best_similarity': best_similarity
            }), 401
        
        employee_id = best_match['employee_id']
        employee_name = f"{best_match['first_name']} {best_match['last_name']}"
        
        # Step 2: Perform clock in/out for identified employee
        if action == 'clock_in':
            # Get employee info
            employee = get_employee(employee_id)
            if not employee:
                return jsonify({'success': False, 'message': 'Employee not found'}), 404
            
            clock_in_time = datetime.now()
            today = clock_in_time.date().isoformat()
            current_time = clock_in_time.time()
            
            # Get schedule for today
            conn, cursor = _pg_conn()
            
            # Check for schedule in employee_schedule table
            cursor.execute("""
                SELECT schedule_id, start_time, end_time, schedule_date
                FROM employee_schedule
                WHERE employee_id = %s 
                  AND schedule_date = %s
                  AND clock_in_time IS NULL
                ORDER BY start_time ASC
                LIMIT 1
            """, (employee_id, today))
            
            schedule = cursor.fetchone()
            schedule_dict = None
            if schedule:
                schedule_dict = dict(schedule)
            
            # If no schedule found, check Scheduled_Shifts
            if not schedule:
                cursor.execute("""
                    SELECT ss.shift_id as schedule_id, ss.start_time, ss.end_time, ss.shift_date as schedule_date
                    FROM Scheduled_Shifts ss
                    JOIN Schedule_Periods sp ON ss.period_id = sp.period_id
                    WHERE ss.employee_id = %s
                      AND ss.shift_date = %s
                      AND ss.published = 1
                      AND NOT EXISTS (
                          SELECT 1 FROM employee_schedule es
                          WHERE es.schedule_id = ss.shift_id
                      )
                    ORDER BY ss.start_time ASC
                    LIMIT 1
                """, (employee_id, today))
                
                schedule = cursor.fetchone()
                if schedule:
                    schedule_dict = dict(schedule)
            
            conn.close()
            
            # Clock in using the database function
            # Get location from request
            latitude = request.json.get('latitude') if request.is_json else None
            longitude = request.json.get('longitude') if request.is_json else None
            address = request.json.get('address') if request.is_json else None
            
            result = clock_in(employee_id, schedule_id=schedule_id, schedule_date=today,
                             latitude=latitude, longitude=longitude, address=address)
            
            if not result['success']:
                return jsonify({
                    'success': False,
                    'message': result.get('message', 'Failed to clock in')
                }), 400
            
            # Compare with schedule if available
            schedule_comparison = None
            if schedule_dict:
                schedule_start = datetime.strptime(schedule_dict['start_time'], '%H:%M:%S').time()
                schedule_end = datetime.strptime(schedule_dict['end_time'], '%H:%M:%S').time() if schedule_dict.get('end_time') else None
                
                # Calculate time difference
                time_diff_minutes = (current_time.hour * 60 + current_time.minute) - (schedule_start.hour * 60 + schedule_start.minute)
                
                status = 'on_time'
                if time_diff_minutes > 5:
                    status = 'late'
                elif time_diff_minutes < -5:
                    status = 'early'
                
                # Check if working at wrong hours
                wrong_hours = False
                if schedule_end:
                    if current_time < schedule_start or current_time > schedule_end:
                        # Check if it's close to scheduled hours (within 30 min before or after)
                        start_minutes = schedule_start.hour * 60 + schedule_start.minute
                        end_minutes = schedule_end.hour * 60 + schedule_end.minute
                        current_minutes = current_time.hour * 60 + current_time.minute
                        
                        if abs(current_minutes - start_minutes) > 30 and abs(current_minutes - end_minutes) > 30:
                            wrong_hours = True
                
                schedule_comparison = {
                    'status': status,
                    'minutes_late': time_diff_minutes if status == 'late' else 0,
                    'wrong_hours': wrong_hours,
                    'scheduled_start': schedule_start.strftime('%H:%M:%S'),
                    'scheduled_end': schedule_end.strftime('%H:%M:%S') if schedule_end else None,
                    'message': f"{status.replace('_', ' ').title()}" + (f" - {abs(time_diff_minutes)} minutes" if time_diff_minutes != 0 else "")
                }
            
            return jsonify({
                'success': True,
                'employee_id': employee_id,
                'employee_name': employee_name,
                'clock_in_time': clock_in_time.isoformat(),
                'schedule_comparison': schedule_comparison,
                'face_identification': {
                    'similarity': best_match['similarity'],
                    'confidence': f"{(best_match['similarity'] * 100):.1f}%"
                },
                'message': f'Clocked in successfully for {employee_name}'
            })
            
        elif action == 'clock_out':
            # Get current clock status
            clock_status = get_current_clock_status(employee_id)
            if not clock_status:
                return jsonify({'success': False, 'message': 'Not currently clocked in'}), 400
            
            schedule_id = clock_status.get('schedule_id')
            if not schedule_id:
                return jsonify({'success': False, 'message': 'Schedule ID not found'}), 400
            
            # Clock out using the database function
            # Get location from request
            latitude = request.json.get('latitude') if request.is_json else None
            longitude = request.json.get('longitude') if request.is_json else None
            address = request.json.get('address') if request.is_json else None
            
            clock_result = clock_out(employee_id, schedule_id,
                                     latitude=latitude, longitude=longitude, address=address)
            
            if clock_result['success']:
                return jsonify({
                    'success': True,
                    'employee_id': employee_id,
                    'employee_name': employee_name,
                    'hours_worked': clock_result.get('hours_worked'),
                    'face_identification': {
                        'similarity': best_match['similarity'],
                        'confidence': f"{(best_match['similarity'] * 100):.1f}%"
                    },
                    'message': f'Clocked out successfully for {employee_name}'
                })
            else:
                return jsonify({
                    'success': False,
                    'message': clock_result.get('message', 'Failed to clock out')
                }), 400
        else:
            return jsonify({'success': False, 'message': 'Invalid action. Use "clock_in" or "clock_out"'}), 400
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/journal_entries')
def api_journal_entries():
    """Get journal entries with employee names"""
    conn, cursor = _pg_conn()
    
    cursor.execute("""
        SELECT 
            je.*,
            e.first_name || ' ' || e.last_name as employee_name
        FROM journal_entries je
        JOIN employees e ON je.employee_id = e.employee_id
        ORDER BY je.entry_date DESC, je.journal_entry_id DESC
    """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

@app.route('/api/journal_entry_lines')
def api_journal_entry_lines():
    """Get journal entry lines with account details"""
    conn, cursor = _pg_conn()
    
    cursor.execute("""
        SELECT 
            jel.*,
            coa.account_number,
            coa.account_name,
            coa.account_type,
            je.entry_number,
            je.entry_date
        FROM journal_entry_lines jel
        JOIN chart_of_accounts coa ON jel.account_id = coa.account_id
        JOIN journal_entries je ON jel.journal_entry_id = je.journal_entry_id
        ORDER BY je.entry_date DESC, jel.journal_entry_id, jel.line_number
    """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

@app.route('/api/shipment_discrepancies')
def api_shipment_discrepancies():
    """Get shipment discrepancies with product and employee details"""
    discrepancies = get_discrepancies()
    if not discrepancies:
        return jsonify({'columns': [], 'data': []})
    
    columns = list(discrepancies[0].keys())
    return jsonify({'columns': columns, 'data': discrepancies})

@app.route('/api/audit_log')
def api_audit_log():
    """Get audit log with employee names"""
    audit_trail = get_audit_trail(limit=1000)
    if not audit_trail:
        return jsonify({'columns': [], 'data': []})
    
    columns = list(audit_trail[0].keys())
    return jsonify({'columns': columns, 'data': audit_trail})

@app.route('/api/dashboard/statistics', methods=['GET'])
def api_dashboard_statistics():
    """Get comprehensive dashboard statistics"""
    try:
        conn, cursor = _pg_conn()
        is_postgres = True
    except Exception as e:
        import traceback
        return jsonify({'error': 'Database connection failed', 'detail': str(e), 'traceback': traceback.format_exc()}), 500
    
    try:
        # Import datetime at the top level to avoid issues
        from datetime import datetime, timedelta
        import sys
        
        def get_result_value(result, key, index=0):
            """Helper to get value from result dict or tuple"""
            if result is None:
                return 0
            if isinstance(result, dict):
                value = result.get(key, 0)
                return value if value is not None else 0
            elif isinstance(result, (list, tuple)):
                return result[index] if result and len(result) > index and result[index] is not None else 0
            return 0
        
        # Get total orders count (check if table exists first)
        total_orders = 0
        try:
            if is_postgres:
                # Check if orders table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'orders'
                    )
                """)
                table_exists_result = cursor.fetchone()
                table_exists = False
                if table_exists_result:
                    if isinstance(table_exists_result, dict):
                        table_exists = table_exists_result.get('exists', False)
                    elif isinstance(table_exists_result, (list, tuple)) and len(table_exists_result) > 0:
                        table_exists = bool(table_exists_result[0])
                
                if table_exists:
                    cursor.execute("SELECT COUNT(*) as total FROM orders")
                    result = cursor.fetchone()
                    total_orders = get_result_value(result, 'total', 0)
            else:
                cursor.execute("SELECT COUNT(*) as total FROM orders")
                result = cursor.fetchone()
                total_orders = get_result_value(result, 'total', 0)
        except Exception as e:
            print(f"Error getting total orders: {e}")
            total_orders = 0
        
        # Get total returns count (check if table exists first)
        total_returns = 0
        try:
            if is_postgres:
                # Check if table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'pending_returns'
                    )
                """)
                table_exists_result = cursor.fetchone()
                table_exists = False
                if table_exists_result:
                    if isinstance(table_exists_result, dict):
                        table_exists = table_exists_result.get('exists', False)
                    elif isinstance(table_exists_result, (list, tuple)) and len(table_exists_result) > 0:
                        table_exists = bool(table_exists_result[0])
                
                if table_exists:
                    cursor.execute("SELECT COUNT(*) as total FROM pending_returns")
                    result = cursor.fetchone()
                    total_returns = get_result_value(result, 'total', 0)
            else:
                cursor.execute("SELECT COUNT(*) as total FROM pending_returns")
                result = cursor.fetchone()
                total_returns = get_result_value(result, 'total', 0)
        except Exception as e:
            print(f"Error getting total returns: {e}")
            total_returns = 0
        
        # Revenue by period
        # All time revenue
        all_time_revenue = 0.0
        try:
            cursor.execute("""
                SELECT COALESCE(SUM(total), 0) as revenue
                FROM orders
                WHERE (order_status != 'voided' OR order_status IS NULL)
            """)
            result = cursor.fetchone()
            all_time_revenue = get_result_value(result, 'revenue', 0)
        except Exception as e:
            print(f"Error getting all time revenue: {e}")
            all_time_revenue = 0.0
        
        # Today's revenue
        today_revenue = 0.0
        try:
            if is_postgres:
                cursor.execute("""
                    SELECT COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date::date = CURRENT_DATE
                        AND (order_status != 'voided' OR order_status IS NULL)
                """)
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE DATE(order_date) = DATE('now')
                        AND (order_status != 'voided' OR order_status IS NULL)
                """)
            result = cursor.fetchone()
            today_revenue = get_result_value(result, 'revenue', 0)
        except Exception as e:
            print(f"Error getting today's revenue: {e}")
            today_revenue = 0.0
        
        # This week's revenue
        week_revenue = 0.0
        try:
            if is_postgres:
                cursor.execute("""
                    SELECT COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
                        AND (order_status != 'voided' OR order_status IS NULL)
                """)
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date >= datetime('now', '-7 days')
                        AND (order_status != 'voided' OR order_status IS NULL)
                """)
            result = cursor.fetchone()
            week_revenue = get_result_value(result, 'revenue', 0)
        except Exception as e:
            print(f"Error getting week revenue: {e}")
            week_revenue = 0.0
        
        # This month's revenue
        month_revenue = 0.0
        try:
            if is_postgres:
                cursor.execute("""
                    SELECT COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)
                        AND (order_status != 'voided' OR order_status IS NULL)
                """)
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date >= datetime('now', 'start of month')
                        AND (order_status != 'voided' OR order_status IS NULL)
                """)
            result = cursor.fetchone()
            month_revenue = get_result_value(result, 'revenue', 0)
        except Exception as e:
            print(f"Error getting month revenue: {e}")
            month_revenue = 0.0
        
        # Average order value
        avg_order_value = 0.0
        try:
            cursor.execute("""
                SELECT 
                    COALESCE(AVG(total), 0) as avg_order_value,
                    COUNT(*) as order_count
                FROM orders
                WHERE (order_status != 'voided' OR order_status IS NULL)
            """)
            avg_result = cursor.fetchone()
            avg_order_value = get_result_value(avg_result, 'avg_order_value', 0)
            order_count = get_result_value(avg_result, 'order_count', 1)
            if order_count == 0:
                avg_order_value = 0
        except Exception as e:
            print(f"Error getting avg order value: {e}")
            avg_order_value = 0.0
        
        # Weekly revenue (last 7 days) - detailed
        revenue_rows = []
        try:
            if is_postgres:
                cursor.execute("""
                    SELECT 
                        order_date::date::text as date,
                        COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
                        AND (order_status != 'voided' OR order_status IS NULL)
                    GROUP BY order_date::date
                    ORDER BY date ASC
                """)
            else:
                cursor.execute("""
                    SELECT 
                        strftime('%Y-%m-%d', order_date) as date,
                        COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date >= datetime('now', '-7 days')
                        AND (order_status != 'voided' OR order_status IS NULL)
                    GROUP BY strftime('%Y-%m-%d', order_date)
                    ORDER BY date ASC
                """)
            
            revenue_rows = cursor.fetchall()
        except Exception as e:
            print(f"Error getting weekly revenue: {e}")
            revenue_rows = []
        weekly_revenue = {}
        for row in revenue_rows:
            if row:
                if isinstance(row, dict):
                    date_key = row.get('date', '')
                    revenue_val = row.get('revenue', 0)
                    if date_key:
                        weekly_revenue[date_key] = revenue_val
                else:
                    if len(row) > 0:
                        date_key = str(row[0]) if row[0] else ''
                        revenue_val = row[1] if len(row) > 1 else 0
                        if date_key:
                            weekly_revenue[date_key] = revenue_val
        
        today = datetime.now().date()
        week_data = []
        for i in range(6, -1, -1):  # Last 7 days
            day = today - timedelta(days=i)
            date_str = day.strftime('%Y-%m-%d')
            day_name = day.strftime('%a')
            revenue = weekly_revenue.get(date_str, 0)
            week_data.append({
                'date': date_str,
                'day': day_name,
                'revenue': float(revenue) if revenue else 0
            })
        
        # Monthly revenue (last 12 months) - still needed for other parts
        monthly_rows = []
        try:
            if is_postgres:
                cursor.execute("""
                    SELECT 
                        TO_CHAR(order_date, 'YYYY-MM') as month,
                        COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date >= CURRENT_DATE - INTERVAL '12 months'
                        AND (order_status != 'voided' OR order_status IS NULL)
                    GROUP BY TO_CHAR(order_date, 'YYYY-MM')
                    ORDER BY month ASC
                """)
            else:
                cursor.execute("""
                    SELECT 
                        strftime('%Y-%m', order_date) as month,
                        COALESCE(SUM(total), 0) as revenue
                    FROM orders
                    WHERE order_date >= datetime('now', '-12 months')
                        AND (order_status != 'voided' OR order_status IS NULL)
                    GROUP BY strftime('%Y-%m', order_date)
                    ORDER BY month ASC
                """)
            
            monthly_rows = cursor.fetchall()
        except Exception as e:
            print(f"Error getting monthly revenue: {e}")
            monthly_rows = []
        monthly_revenue = {}
        for row in monthly_rows:
            if row:
                if isinstance(row, dict):
                    month_key = row.get('month', '')
                    revenue_val = row.get('revenue', 0)
                    if month_key:
                        monthly_revenue[month_key] = revenue_val
                else:
                    if len(row) > 0:
                        month_key = str(row[0]) if row[0] else ''
                        revenue_val = row[1] if len(row) > 1 else 0
                        if month_key:
                            monthly_revenue[month_key] = revenue_val
        
        # Generate last 12 months
        monthly_data = []
        try:
            today = datetime.now().date()
            current_year = today.year
            current_month = today.month
            
            for i in range(11, -1, -1):
                # Calculate month by going back i months
                target_month = current_month - i
                target_year = current_year
                
                # Handle year rollover
                while target_month <= 0:
                    target_month += 12
                    target_year -= 1
                
                month_date = datetime(target_year, target_month, 1).date()
                month_str = month_date.strftime('%Y-%m')
                month_name = month_date.strftime('%b')
                revenue = monthly_revenue.get(month_str, 0)
                monthly_data.append({
                    'month': month_str,
                    'month_name': month_name,
                    'revenue': float(revenue) if revenue else 0
                })
        except Exception as e:
            print(f"Error generating monthly data: {e}")
            import traceback
            traceback.print_exc()
            monthly_data = []
        
        # Order status breakdown
        order_status_breakdown = {}
        try:
            # Check if cursor is still valid, create new one if needed
            try:
                cursor.execute("SELECT 1")
            except:
                # Cursor is closed, create a new one
                cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT 
                    order_status,
                    COUNT(*) as count
                FROM orders
                GROUP BY order_status
            """)
            status_rows = cursor.fetchall()
            for row in status_rows:
                if row:
                    if isinstance(row, dict):
                        status_key = row.get('order_status', '')
                        count_val = row.get('count', 0)
                        if status_key:
                            order_status_breakdown[status_key] = count_val
                    else:
                        if len(row) > 0:
                            status_key = str(row[0]) if row[0] else ''
                            count_val = row[1] if len(row) > 1 else 0
                            if status_key:
                                order_status_breakdown[status_key] = count_val
        except Exception as e:
            print(f"Error getting order status breakdown: {e}")
            order_status_breakdown = {}
        
        # Top selling products (last 30 days) - not needed for current UI but keeping for API compatibility
        top_products = []
        try:
            if is_postgres:
                cursor.execute("""
                    SELECT 
                        i.product_id,
                        i.product_name,
                        SUM(oi.quantity)::integer as total_quantity,
                        SUM(oi.subtotal) as total_revenue
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.order_id
                    JOIN inventory i ON oi.product_id = i.product_id
                    WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
                        AND o.order_status != 'voided'
                    GROUP BY i.product_id, i.product_name
                    ORDER BY total_quantity DESC
                    LIMIT 10
                """)
            else:
                cursor.execute("""
                    SELECT 
                        i.product_id,
                        i.product_name,
                        SUM(oi.quantity) as total_quantity,
                        SUM(oi.subtotal) as total_revenue
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.order_id
                    JOIN inventory i ON oi.product_id = i.product_id
                    WHERE o.order_date >= datetime('now', '-30 days')
                        AND o.order_status != 'voided'
                    GROUP BY i.product_id, i.product_name
                    ORDER BY total_quantity DESC
                    LIMIT 10
                """)
            for row in cursor.fetchall():
                if isinstance(row, dict):
                    top_products.append(dict(row))
                else:
                    top_products.append({
                        'product_id': row[0],
                        'product_name': row[1],
                        'total_quantity': row[2] if len(row) > 2 else 0,
                        'total_revenue': row[3] if len(row) > 3 else 0
                    })
        except Exception as e:
            print(f"Error getting top products: {e}")
            top_products = []
        
        # Inventory statistics
        try:
            cursor.execute("SELECT COUNT(*) as total FROM inventory")
            result = cursor.fetchone()
            total_products = get_result_value(result, 'total', 0)
            
            # Check if reorder_point column exists
            try:
                if is_postgres:
                    cursor.execute("""
                        SELECT COUNT(*) as low_stock
                        FROM inventory
                        WHERE current_quantity <= 10
                    """)
                else:
                    cursor.execute("""
                        SELECT COUNT(*) as low_stock
                        FROM inventory
                        WHERE current_quantity <= 10
                    """)
                result = cursor.fetchone()
                low_stock = get_result_value(result, 'low_stock', 0)
            except:
                low_stock = 0
            
            cursor.execute("""
                SELECT COALESCE(SUM(current_quantity * product_cost), 0) as total_value
                FROM inventory
            """)
            result = cursor.fetchone()
            inventory_value = get_result_value(result, 'total_value', 0)
        except Exception:
            total_products = 0
            low_stock = 0
            inventory_value = 0
        
        # Returns rate
        returns_rate = (total_returns / total_orders * 100) if total_orders > 0 else 0
        
        # Today's returns count and amount
        today_returns_count = 0
        today_returns_amount = 0
        try:
            # Check if pending_returns table exists first
            if is_postgres:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'pending_returns'
                    )
                """)
                table_exists_result = cursor.fetchone()
                table_exists = False
                if table_exists_result:
                    if isinstance(table_exists_result, dict):
                        table_exists = table_exists_result.get('exists', False)
                    elif isinstance(table_exists_result, (list, tuple)) and len(table_exists_result) > 0:
                        table_exists = bool(table_exists_result[0])
                
                if table_exists:
                    cursor.execute("""
                        SELECT 
                            COUNT(*) as count,
                            COALESCE(SUM(total_refund_amount), 0) as amount
                        FROM pending_returns
                        WHERE return_date::date = CURRENT_DATE
                            AND status = 'approved'
                    """)
                    today_returns_result = cursor.fetchone()
                    if isinstance(today_returns_result, dict):
                        today_returns_count = today_returns_result.get('count', 0) or 0
                        today_returns_amount = today_returns_result.get('amount', 0) or 0
                    else:
                        today_returns_count = today_returns_result[0] if today_returns_result and len(today_returns_result) > 0 else 0
                        today_returns_amount = today_returns_result[1] if today_returns_result and len(today_returns_result) > 1 else 0
        except Exception as e:
            import traceback
            print(f"Error getting today's returns: {e}")
            traceback.print_exc()
            today_returns_count = 0
            today_returns_amount = 0
        
        # Don't close connection here - it's a global connection that should stay open
        # conn.close()  # Commented out to keep connection alive
        
        # Ensure all values are JSON-serializable
        try:
            response_data = {
                'total_orders': int(total_orders) if total_orders is not None else 0,
                'total_returns': int(total_returns) if total_returns is not None else 0,
                'returns_rate': round(float(returns_rate), 2) if returns_rate is not None else 0.0,
                'returns': {
                    'today': int(today_returns_count) if today_returns_count is not None else 0,
                    'today_amount': float(today_returns_amount) if today_returns_amount is not None else 0.0
                },
                'revenue': {
                    'all_time': float(all_time_revenue) if all_time_revenue is not None else 0.0,
                    'today': float(today_revenue) if today_revenue is not None else 0.0,
                    'week': float(week_revenue) if week_revenue is not None else 0.0,
                    'month': float(month_revenue) if month_revenue is not None else 0.0
                },
                'avg_order_value': round(float(avg_order_value), 2) if avg_order_value is not None else 0.0,
                'weekly_revenue': week_data if week_data else [],
                'monthly_revenue': monthly_data if monthly_data else [],
                'order_status_breakdown': {str(k): int(v) for k, v in order_status_breakdown.items()} if order_status_breakdown else {},
                'top_products': top_products if top_products else [],
                'inventory': {
                    'total_products': int(total_products) if total_products is not None else 0,
                    'low_stock': int(low_stock) if low_stock is not None else 0,
                    'total_value': float(inventory_value) if inventory_value is not None else 0.0
                }
            }
            return jsonify(response_data)
        except Exception as json_err:
            import traceback
            print(f"Error serializing response: {json_err}")
            traceback.print_exc()
            return jsonify({
                'error': 'Failed to serialize response',
                'message': str(json_err)
            }), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in api_dashboard_statistics: {e}")
        print(error_trace)
        if conn:
            try:
                conn.close()
            except:
                pass
        return jsonify({
            'error': str(e),
            'message': 'Failed to load dashboard statistics',
            'traceback': error_trace
        }), 500
    finally:
        # Ensure connection is closed
        if conn:
            try:
                conn.close()
            except:
                pass

# ============================================================================
# IMAGE MATCHING API ENDPOINTS
# ============================================================================

@app.route('/api/identify_product', methods=['POST'])
def api_identify_product():
    """API endpoint for smart product identification (barcode first, then image matching)"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Get optional parameters
        use_barcode = request.form.get('use_barcode', 'true').lower() == 'true'
        use_image_matching = request.form.get('use_image_matching', 'true').lower() == 'true'
        top_k = int(request.form.get('top_k', 5))
        threshold = float(request.form.get('threshold', 0.7))
        context = request.form.get('context', 'manual_lookup')
        identified_by = request.form.get('identified_by', 'unknown')
        
        # Save temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            file.save(tmp_file.name)
            temp_path = tmp_file.name
        
        try:
            from barcode_scanner import smart_product_identification
            
            # Get scanners
            barcode_scanner = get_barcode_scanner() if use_barcode else None
            image_matcher = get_image_matcher() if use_image_matching else None
            
            # Use smart identification (barcode first, then image matching)
            result = smart_product_identification(
                image_path=temp_path,
                barcode_scanner=barcode_scanner,
                image_matcher=image_matcher,
                prefer_barcode=use_barcode
            )
            
            # Format response
            if result.get('product'):
                product = result['product']
                
                # Log identification if image matcher is available
                if image_matcher and result.get('method') == 'image_matching':
                    try:
                        image_matcher.log_identification(
                            product_id=product.get('product_id'),
                            query_image_path=temp_path,
                            confidence=result.get('confidence', 1.0),
                            identified_by=identified_by,
                            context=context
                        )
                    except:
                        pass
                
                # Format match for response
                match_data = {
                    'product_id': product.get('product_id'),
                    'confidence': result.get('confidence', 1.0),
                    'sku': product.get('sku'),
                    'name': product.get('product_name'),
                    'category': product.get('category', ''),
                    'method': result.get('method', 'unknown')
                }
                
                if result.get('barcode'):
                    match_data['barcode'] = result['barcode']
                
                return jsonify({
                    'success': True,
                    'method': result.get('method'),
                    'matches': [match_data]
                })
            else:
                return jsonify({
                    'success': False,
                    'message': result.get('message', 'No product identified'),
                    'method': result.get('method'),
                    'matches': []
                }), 404
                
        finally:
            # Clean up temp file
            try:
                os.remove(temp_path)
            except:
                pass
                
    except Exception as e:
        print(f"Identify product error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/identify_shipment', methods=['POST'])
def api_identify_shipment():
    """Identify multiple products from shipment photos (barcode + image matching)"""
    try:
        if 'images' not in request.files:
            return jsonify({'success': False, 'error': 'No images provided'}), 400
        
        files = request.files.getlist('images')
        if not files:
            return jsonify({'success': False, 'error': 'No files selected'}), 400
        
        use_barcode = request.form.get('use_barcode', 'true').lower() == 'true'
        use_image_matching = request.form.get('use_image_matching', 'true').lower() == 'true'
        threshold = float(request.form.get('threshold', 0.75))
        identified_by = request.form.get('identified_by', 'unknown')
        
        temp_paths = []
        for file in files:
            if file.filename == '':
                continue
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
                file.save(tmp_file.name)
                temp_paths.append(tmp_file.name)
        
        try:
            from barcode_scanner import smart_product_identification
            
            # Get scanners
            barcode_scanner = get_barcode_scanner() if use_barcode else None
            image_matcher = get_image_matcher() if use_image_matching else None
            
            identified = []
            for image_path in temp_paths:
                result = smart_product_identification(
                    image_path=image_path,
                    barcode_scanner=barcode_scanner,
                    image_matcher=image_matcher,
                    prefer_barcode=use_barcode
                )
                
                # Format result
                item = {
                    'image': image_path,
                    'method': result.get('method'),
                    'confidence': result.get('confidence', 0.0)
                }
                
                if result.get('product'):
                    product = result['product']
                    item['match'] = {
                        'product_id': product.get('product_id'),
                        'sku': product.get('sku'),
                        'name': product.get('product_name'),
                        'category': product.get('category', ''),
                        'confidence': result.get('confidence', 1.0)
                    }
                    
                    if result.get('barcode'):
                        item['barcode'] = result['barcode']
                    
                    # Log identification if image matcher is available
                    if image_matcher and result.get('method') == 'image_matching':
                        try:
                            image_matcher.log_identification(
                                product_id=product.get('product_id'),
                                query_image_path=image_path,
                                confidence=result.get('confidence', 1.0),
                                identified_by=identified_by,
                                context='shipment_receiving'
                            )
                        except:
                            pass
                else:
                    item['match'] = None
                    item['message'] = result.get('message', 'No product identified')
                
                identified.append(item)
            
            return jsonify({
                'success': True,
                'total_items': len(identified),
                'identified_products': identified
            })
            
        finally:
            # Clean up temp files
            for path in temp_paths:
                try:
                    os.remove(path)
                except:
                    pass
                    
    except Exception as e:
        print(f"Identify shipment error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/build_product_database', methods=['POST'])
def api_build_product_database():
    """Build or rebuild the product embedding database"""
    matcher = get_image_matcher()
    if matcher is None:
        return jsonify({
            'success': False,
            'error': 'Image matching not available. Install dependencies first.'
        }), 503
    
    try:
        rebuild = request.json.get('rebuild_existing', False) if request.json else False
        matcher.build_product_database(rebuild_existing=rebuild)
        
        return jsonify({
            'success': True,
            'message': f'Product database built with {len(matcher.product_embeddings)} products'
        })
    except Exception as e:
        print(f"Build database error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/image_identifications')
def api_image_identifications():
    """Get image identification history"""
    conn, cursor = _pg_conn()
    
    cursor.execute("""
        SELECT 
            ii.*,
            i.product_name,
            i.sku
        FROM image_identifications ii
        JOIN inventory i ON ii.product_id = i.product_id
        ORDER BY ii.identified_at DESC
        LIMIT 1000
    """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

# ============================================================================
# PRODUCT BARCODE IMAGE GENERATION
# ============================================================================

def _product_barcode_value(product):
    """Get or generate barcode value for a product (12 digits for EAN13)."""
    b = (product.get('barcode') or '').strip()
    if b and b.isdigit() and len(b) >= 8:
        return b[:12].zfill(12) if len(b) < 12 else b[:12]
    pid = product.get('product_id') or 0
    prefix = '100'
    base = prefix + str(pid % 100000).zfill(5) + '0000'
    base = base[:11]
    checksum = sum(int(d) for d in base) % 10
    return base + str(checksum)

def _generate_product_barcode_png(barcode_value):
    """Generate barcode PNG bytes using existing system (EAN13/Code128)."""
    if not _BARCODE_GEN_AVAILABLE:
        return None
    try:
        if barcode_value.isdigit() and len(barcode_value) == 12:
            code = barcode.get('ean13', '0' + barcode_value, writer=ImageWriter())
        elif barcode_value.isdigit():
            code = barcode.get('code128', barcode_value, writer=ImageWriter())
        else:
            code = barcode.get('code128', barcode_value, writer=ImageWriter())
        options = {
            'module_width': 0.5,
            'module_height': 15.0,
            'quiet_zone': 6.5,
            'font_size': 10,
            'text_distance': 5.0,
            'background': 'white',
            'foreground': 'black',
            'write_text': True,
            'text': barcode_value,
        }
        img = code.render(options)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()
    except Exception as e:
        traceback.print_exc()
        return None

@app.route('/api/product_barcode_image')
def api_product_barcode_image():
    """Generate product barcode PNG. Query: product_id=."""
    product_id = request.args.get('product_id', type=int)
    if not product_id:
        return jsonify({'success': False, 'error': 'product_id required'}), 400
    product = get_product(product_id)
    if not product:
        return jsonify({'success': False, 'error': 'Product not found'}), 404
    if not _BARCODE_GEN_AVAILABLE:
        return jsonify({'success': False, 'error': 'Barcode generation not available. Install python-barcode[images].'}), 503
    barcode_value = _product_barcode_value(product)
    png_bytes = _generate_product_barcode_png(barcode_value)
    if not png_bytes:
        return jsonify({'success': False, 'error': 'Failed to generate barcode image'}), 500
    return Response(png_bytes, mimetype='image/png', headers={
        'Cache-Control': 'no-store',
        'Content-Disposition': f'inline; filename="barcode_{product_id}.png"',
    })

# ============================================================================
# BARCODE SCANNING API ENDPOINTS
# ============================================================================

@app.route('/api/scan_barcode', methods=['POST'])
def api_scan_barcode():
    """Scan barcode from image (barcode only, no image matching)"""
    scanner = get_barcode_scanner()
    if scanner is None:
        return jsonify({
            'success': False,
            'error': 'Barcode scanning not available. Install pyzbar and opencv-python.'
        }), 503
    
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Save temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            file.save(tmp_file.name)
            temp_path = tmp_file.name
        
        try:
            # Scan barcode
            result = scanner.identify_product(temp_path)
            
            if result and result.get('product'):
                return jsonify({
                    'success': True,
                    'method': 'barcode',
                    'barcode': result.get('barcode'),
                    'product': result['product']
                })
            elif result and result.get('barcode'):
                # Barcode found but product not in database
                return jsonify({
                    'success': False,
                    'method': 'barcode',
                    'barcode': result.get('barcode'),
                    'message': result.get('message', 'Product not found in database'),
                    'product': None
                }), 404
            else:
                return jsonify({
                    'success': False,
                    'message': 'No barcode found in image'
                }), 404
                
        finally:
            # Clean up temp file
            try:
                os.remove(temp_path)
            except:
                pass
                
    except Exception as e:
        print(f"Scan barcode error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/scan_barcodes', methods=['POST'])
def api_scan_barcodes():
    """Scan multiple barcodes from images"""
    scanner = get_barcode_scanner()
    if scanner is None:
        return jsonify({
            'success': False,
            'error': 'Barcode scanning not available. Install pyzbar and opencv-python.'
        }), 503
    
    try:
        if 'images' not in request.files:
            return jsonify({'success': False, 'error': 'No images provided'}), 400
        
        files = request.files.getlist('images')
        if not files:
            return jsonify({'success': False, 'error': 'No files selected'}), 400
        
        temp_paths = []
        for file in files:
            if file.filename == '':
                continue
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
                file.save(tmp_file.name)
                temp_paths.append(tmp_file.name)
        
        try:
            results = scanner.batch_scan(temp_paths)
            
            return jsonify({
                'success': True,
                'total_items': len(results),
                'scanned_items': results
            })
            
        finally:
            # Clean up temp files
            for path in temp_paths:
                try:
                    os.remove(path)
                except:
                    pass
                    
    except Exception as e:
        print(f"Scan barcodes error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# RETURNS API ENDPOINTS
# ============================================================================

@app.route('/api/create_return', methods=['POST'])
def api_create_return():
    """Create a pending return"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        result = create_pending_return(
            order_id=data.get('order_id'),
            items_to_return=data.get('items', []),
            employee_id=data.get('employee_id'),
            customer_id=data.get('customer_id'),
            reason=data.get('reason'),
            notes=data.get('notes')
        )
        return jsonify(result)
    except Exception as e:
        print(f"Create return error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/approve_return', methods=['POST'])
def api_approve_return():
    """Approve a pending return"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        result = approve_pending_return(
            return_id=data.get('return_id'),
            approved_by=data.get('approved_by'),
            notes=data.get('notes')
        )
        if result.get('success') and result.get('refund_amount') and result.get('return_id') is not None and result.get('order_id') is not None:
            try:
                from pos_accounting_bridge import journalize_return_to_accounting
                jr = journalize_return_to_accounting(
                    result['return_id'],
                    result['order_id'],
                    float(result['refund_amount']),
                    result.get('approved_by'),
                    None
                )
                if not jr.get('success'):
                    print(f"Accounting journalize_return (approve return {result['return_id']}): {jr.get('message', 'unknown')}")
            except Exception as je:
                print(f"Accounting journalize_return error (approve return): {je}")
        return jsonify(result)
    except Exception as e:
        print(f"Approve return error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/reject_return', methods=['POST'])
def api_reject_return():
    """Reject a pending return"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        result = reject_pending_return(
            return_id=data.get('return_id'),
            rejected_by=data.get('rejected_by'),
            reason=data.get('reason')
        )
        return jsonify(result)
    except Exception as e:
        print(f"Reject return error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/pending_returns')
def api_pending_returns():
    """Get pending returns"""
    try:
        status = request.args.get('status')
        order_id = request.args.get('order_id', type=int)
        
        returns = list_pending_returns(status=status, order_id=order_id)
        if not returns:
            return jsonify({'columns': [], 'data': []})
        
        columns = list(returns[0].keys())
        return jsonify({'columns': columns, 'data': returns})
    except Exception as e:
        print(f"Get pending returns error: {e}")
        return jsonify({'columns': [], 'data': [], 'error': str(e)}), 500

@app.route('/api/pending_return_items')
def api_pending_return_items():
    """Get pending return items"""
    conn, cursor = _pg_conn()
    
    return_id = request.args.get('return_id', type=int)
    
    if return_id:
        cursor.execute("""
            SELECT pri.*, i.product_name, i.sku, pr.return_number
            FROM pending_return_items pri
            JOIN inventory i ON pri.product_id = i.product_id
            JOIN pending_returns pr ON pri.return_id = pr.return_id
            WHERE pri.return_id = %s
        """, (return_id,))
    else:
        cursor.execute("""
            SELECT pri.*, i.product_name, i.sku, pr.return_number
            FROM pending_return_items pri
            JOIN inventory i ON pri.product_id = i.product_id
            JOIN pending_returns pr ON pri.return_id = pr.return_id
            ORDER BY pri.return_id DESC
        """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

@app.route('/api/process_return', methods=['POST'])
def api_process_return():
    """Process a return immediately (no pending state)"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        from database import process_return_immediate
        from receipt_generator import generate_return_receipt, generate_exchange_receipt
        
        result = process_return_immediate(
            order_id=data.get('order_id'),
            items_to_return=data.get('items', []),
            employee_id=data.get('employee_id'),
            customer_id=data.get('customer_id'),
            reason=data.get('reason'),
            notes=data.get('notes'),
            return_type=data.get('return_type', 'refund'),
            exchange_timing=data.get('exchange_timing'),
            return_subtotal=data.get('return_subtotal', 0),
            return_tax=data.get('return_tax', 0),
            return_processing_fee=data.get('return_processing_fee', 0),
            return_total=data.get('return_total', 0),
            payment_method=data.get('payment_method')
        )
        
        if not result.get('success'):
            return jsonify(result), 400
        
        # Post return to accounting (accounting.transactions)
        employee_id = data.get('employee_id')
        if not employee_id and request.headers.get('Authorization'):
            session_token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
            if session_token:
                session_data = verify_session(session_token)
                if session_data and session_data.get('valid'):
                    employee_id = session_data.get('employee_id')
        if employee_id and result.get('return_total'):
            try:
                from pos_accounting_bridge import journalize_return_to_accounting
                jr = journalize_return_to_accounting(
                    result['return_id'],
                    data.get('order_id'),
                    float(result['return_total']),
                    employee_id,
                    data.get('payment_method'),
                    data.get('return_type', 'refund')
                )
                if not jr.get('success'):
                    print(f"Accounting journalize_return (return {result['return_id']}): {jr.get('message', 'unknown')}")
            except Exception as je:
                print(f"Accounting journalize_return error (return {result['return_id']}): {je}")
        
        # Return receipt URL (will be generated on demand via endpoint)
        result['return_receipt_url'] = f"/api/receipt/return/{result['return_id']}"
        
        # Generate exchange receipt if exchange and later
        if result.get('return_type') == 'exchange' and data.get('exchange_timing') == 'later':
            result['exchange_receipt_url'] = f"/api/receipt/exchange/{result['exchange_credit_id']}"
        else:
            result['exchange_receipt_url'] = None
        
        return jsonify(result)
    except Exception as e:
        print(f"Process return error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/receipt/return/<int:return_id>', methods=['GET'])
def api_generate_return_receipt(return_id):
    """Generate return receipt PDF"""
    try:
        from receipt_generator import generate_return_receipt
        
        pdf_bytes = generate_return_receipt(return_id)
        
        if pdf_bytes:
            response = Response(pdf_bytes, mimetype='application/pdf')
            response.headers['Content-Disposition'] = f'attachment; filename=return_receipt_{return_id}.pdf'
            return response
        else:
            return jsonify({'success': False, 'message': 'Failed to generate return receipt'}), 500
    except Exception as e:
        print(f"Generate return receipt error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receipt/exchange/<int:exchange_credit_id>', methods=['GET'])
def api_generate_exchange_receipt(exchange_credit_id):
    """Generate exchange receipt PDF"""
    try:
        from receipt_generator import generate_exchange_receipt
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        
        # Get exchange credit details
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT transaction_id, amount, notes
            FROM payment_transactions
            WHERE transaction_id = %s AND payment_method = 'store_credit'
        """, (exchange_credit_id,))
        
        credit_data = cursor.fetchone()
        conn.close()
        
        if not credit_data:
            return jsonify({'success': False, 'message': 'Exchange credit not found'}), 404
        
        credit_data = dict(credit_data)
        # Extract credit number from notes
        credit_number = credit_data.get('notes', '').split('Credit: ')[-1] if 'Credit: ' in credit_data.get('notes', '') else f"EXC-{exchange_credit_id}"
        
        pdf_bytes = generate_exchange_receipt(
            exchange_credit_id,
            credit_number,
            float(credit_data['amount'])
        )
        
        if pdf_bytes:
            response = Response(pdf_bytes, mimetype='application/pdf')
            response.headers['Content-Disposition'] = f'attachment; filename=exchange_receipt_{exchange_credit_id}.pdf'
            return response
        else:
            return jsonify({'success': False, 'message': 'Failed to generate exchange receipt'}), 500
    except Exception as e:
        print(f"Generate exchange receipt error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/apply_exchange_credit', methods=['POST'])
def api_apply_exchange_credit():
    """Apply exchange credit to an order as a discount"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            order_id = data.get('order_id')
            exchange_credit_id = data.get('exchange_credit_id')
            credit_amount = float(data.get('credit_amount', 0))
            
            # Get current order total
            cursor.execute("SELECT total, subtotal, discount FROM orders WHERE order_id = %s", (order_id,))
            order = cursor.fetchone()
            if not order:
                return jsonify({'success': False, 'message': 'Order not found'}), 404
            
            order = dict(order)
            current_total = float(order['total'])
            current_subtotal = float(order['subtotal'])
            current_discount = float(order.get('discount', 0))
            
            # Apply credit as discount
            new_discount = current_discount + credit_amount
            new_total = current_total - credit_amount
            
            # Update order
            cursor.execute("""
                UPDATE orders
                SET discount = %s,
                    total = %s
                WHERE order_id = %s
            """, (new_discount, new_total, order_id))
            
            # Mark exchange credit as used
            cursor.execute("""
                UPDATE payment_transactions
                SET status = 'refunded',
                    notes = COALESCE(notes, '') || ' | Used on order ' || %s
                WHERE transaction_id = %s AND payment_method = 'store_credit'
            """, (order_id, exchange_credit_id))
            
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': True,
                'message': 'Exchange credit applied successfully',
                'credit_applied': credit_amount,
                'new_total': new_total
            })
        except Exception as e:
            conn.rollback()
            conn.close()
            raise e
    except Exception as e:
        print(f"Apply exchange credit error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/exchange_credit/<credit_number>', methods=['GET'])
def api_get_exchange_credit(credit_number):
    """Get exchange credit by credit number (for scanning at checkout)"""
    try:
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Look up exchange credit by credit number in notes
        cursor.execute("""
            SELECT transaction_id, amount, notes, order_id
            FROM payment_transactions
            WHERE payment_method = 'store_credit'
            AND status = 'approved'
            AND notes LIKE %s
        """, (f'%Credit: {credit_number}%',))
        
        credit = cursor.fetchone()
        conn.close()
        
        if not credit:
            return jsonify({'success': False, 'message': 'Exchange credit not found'}), 404
        
        credit = dict(credit)
        
        # Extract return_id from notes if available
        return_id = None
        if credit.get('notes'):
            import re
            match = re.search(r'return (\w+)', credit['notes'])
            if match:
                try:
                    return_id = int(match.group(1))
                except:
                    pass
        
        return jsonify({
            'success': True,
            'credit': {
                'transaction_id': credit['transaction_id'],
                'credit_number': credit_number,
                'amount': float(credit['amount']),
                'return_id': return_id,
                'order_id': credit.get('order_id')
            }
        })
    except Exception as e:
        print(f"Get exchange credit error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# RBAC API ENDPOINTS
# ============================================================================

@app.route('/api/my/permissions', methods=['GET', 'POST'])
def api_my_permissions():
    """Get current employee's permissions"""
    try:
        # Get employee_id from session or request
        employee_id = None
        if request.method == 'POST' and request.json:
            employee_id = request.json.get('employee_id')
        elif request.args:
            employee_id = request.args.get('employee_id', type=int)
        
        if not employee_id:
            return jsonify({'error': 'Employee ID required'}), 400
        
        pm = get_permission_manager()
        permissions = pm.get_employee_permissions(employee_id)
        
        return jsonify({
            'success': True,
            'permissions': permissions
        })
    except Exception as e:
        print(f"Get permissions error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/check_permission', methods=['POST'])
def api_check_permission():
    """Check if employee has specific permission"""
    try:
        if not request.json:
            return jsonify({'error': 'Invalid request'}), 400
        
        employee_id = request.json.get('employee_id')
        permission_name = request.json.get('permission_name')
        
        if not employee_id or not permission_name:
            return jsonify({'error': 'employee_id and permission_name required'}), 400
        
        pm = get_permission_manager()
        has_perm = pm.has_permission(employee_id, permission_name)
        
        return jsonify({
            'success': True,
            'has_permission': has_perm
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees/<int:employee_id>/permissions', methods=['GET'])
def api_employee_permissions(employee_id):
    """Get permissions for specific employee"""
    try:
        pm = get_permission_manager()
        permissions = pm.get_employee_permissions(employee_id)
        
        return jsonify({
            'success': True,
            'permissions': permissions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees/<int:employee_id>/permissions/grant', methods=['POST'])
def api_grant_permission(employee_id):
    """Grant permission to employee"""
    try:
        if not request.json:
            return jsonify({'error': 'Invalid request'}), 400
        
        permission_name = request.json.get('permission_name')
        granted_by = request.json.get('granted_by')
        reason = request.json.get('reason')
        
        if not permission_name or not granted_by:
            return jsonify({'error': 'permission_name and granted_by required'}), 400
        
        pm = get_permission_manager()
        success = pm.grant_permission_to_employee(
            employee_id, permission_name, granted_by, reason
        )
        
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees/<int:employee_id>/permissions/revoke', methods=['POST'])
def api_revoke_permission(employee_id):
    """Revoke permission from employee"""
    try:
        if not request.json:
            return jsonify({'error': 'Invalid request'}), 400
        
        permission_name = request.json.get('permission_name')
        revoked_by = request.json.get('revoked_by')
        reason = request.json.get('reason')
        
        if not permission_name or not revoked_by:
            return jsonify({'error': 'permission_name and revoked_by required'}), 400
        
        pm = get_permission_manager()
        success = pm.revoke_permission_from_employee(
            employee_id, permission_name, revoked_by, reason
        )
        
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/roles', methods=['GET'])
def api_roles():
    """Get all roles"""
    try:
        pm = get_permission_manager()
        roles = pm.get_all_roles()
        
        return jsonify({
            'success': True,
            'roles': roles
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/permissions', methods=['GET'])
def api_permissions():
    """Get all permissions"""
    try:
        pm = get_permission_manager()
        permissions = pm.get_all_permissions()
        
        return jsonify({
            'success': True,
            'permissions': permissions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employees/<int:employee_id>/assign_role', methods=['POST'])
def api_assign_role(employee_id):
    """Assign role to employee"""
    try:
        if not request.json:
            return jsonify({'error': 'Invalid request'}), 400
        
        role_id = request.json.get('role_id')
        if role_id is None:
            return jsonify({'error': 'role_id required'}), 400
        
        success = assign_role_to_employee(employee_id, role_id)
        
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/activity_log', methods=['GET'])
def api_activity_log():
    """Get activity log"""
    try:
        limit = request.args.get('limit', 100, type=int)
        employee_id = request.args.get('employee_id', type=int)
        
        pm = get_permission_manager()
        logs = pm.get_activity_log(limit=limit, employee_id=employee_id)
        
        return jsonify({
            'success': True,
            'logs': logs
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# EMPLOYEE MANAGEMENT API ENDPOINTS (Admin Only)
# ============================================================================

@app.route('/api/admin/employees', methods=['POST'])
def api_create_employee():
    """Create a new employee (Admin only)"""
    try:
        if not request.json:
            return jsonify({'error': 'Invalid request'}), 400
        
        data = request.json
        
        # Required fields
        required = ['first_name', 'last_name', 'position', 'date_started']
        for field in required:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Clerk temporarily disabled - always use pin_only
        account_type = 'pin_only'
        clerk_user_id = None
        pin_code = data.get('pin_code')
        invitation_sent = False
        
        # PIN-only account - generate PIN if not provided
        if not pin_code:
            pin_code = generate_pin()
        
        # Create employee record
        employee_id = add_employee(
            username=data.get('username') or data.get('employee_code'),
            first_name=data['first_name'],
            last_name=data['last_name'],
            position=data['position'],
            date_started=data['date_started'],
            password=data.get('password'),
            email=data.get('email'),
            phone=data.get('phone'),
            department=data.get('department'),
            hourly_rate=data.get('hourly_rate'),
            salary=data.get('salary'),
            employment_type=data.get('employment_type', 'part_time'),
            address=data.get('address'),
            emergency_contact_name=data.get('emergency_contact_name'),
            emergency_contact_phone=data.get('emergency_contact_phone'),
            notes=data.get('notes'),
            role_id=data.get('role_id'),
            pin_code=pin_code,
            clerk_user_id=clerk_user_id
        )
        
        # Assign role if provided
        if data.get('role_id'):
            assign_role_to_employee(employee_id, data['role_id'])
        
        employee = get_employee(employee_id)
        
        # Prepare response
        response_data = {
            'success': True,
            'employee_id': employee_id,
            'employee': employee,
            'account_type': account_type,
            'invitation_sent': invitation_sent
        }
        
        # Include generated PIN when we created one
        if pin_code and not data.get('pin_code'):
            response_data['generated_pin'] = pin_code
        
        return jsonify(response_data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/employees/<int:employee_id>', methods=['PUT'])
def api_update_employee(employee_id):
    """Update an employee (Admin only)"""
    try:
        if not request.json:
            return jsonify({'error': 'Invalid request'}), 400
        
        data = request.json
        
        # Update employee
        success = update_employee(employee_id, **data)
        
        if not success:
            return jsonify({'error': 'Employee not found or no changes made'}), 404
        
        # Update role if provided
        if 'role_id' in data:
            assign_role_to_employee(employee_id, data['role_id'])
        
        employee = get_employee(employee_id)
        
        return jsonify({
            'success': True,
            'employee': employee
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/employees/<int:employee_id>', methods=['DELETE'])
def api_delete_employee(employee_id):
    """Delete (deactivate) an employee (Admin only)"""
    try:
        success = delete_employee(employee_id)
        
        if not success:
            return jsonify({'error': 'Employee not found'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Employee deactivated successfully'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/employees/<int:employee_id>', methods=['GET'])
def api_get_employee(employee_id):
    """Get employee details with role information"""
    try:
        employee = get_employee(employee_id)
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        # Get role information
        role_info = get_employee_role(employee_id)
        if role_info:
            employee['role'] = role_info
        
        return jsonify({
            'success': True,
            'employee': employee
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/employee_schedule/<int:schedule_id>', methods=['DELETE'])
def api_delete_schedule(schedule_id):
    """Delete an employee schedule"""
    try:
        conn, cursor = _pg_conn()
        
        # Get schedule info before deleting
        cursor.execute("""
            SELECT employee_id, schedule_date, start_time, end_time
            FROM employee_schedule
            WHERE schedule_id = %s
        """, (schedule_id,))
        
        schedule = cursor.fetchone()
        if not schedule:
            conn.close()
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404
        
        # Delete schedule
        cursor.execute("DELETE FROM employee_schedule WHERE schedule_id = %s", (schedule_id,))
        
        # Also delete from master calendar if exists
        cursor.execute("""
            DELETE FROM master_calendar
            WHERE related_table = 'employee_schedule' AND related_id = %s
        """, (schedule_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Schedule deleted successfully'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/employee_schedule/<int:schedule_id>/confirm', methods=['POST'])
def api_confirm_schedule(schedule_id):
    """Confirm an assigned schedule"""
    try:
        conn, cursor = _pg_conn()
        
        # Verify schedule exists
        cursor.execute("""
            SELECT employee_id, schedule_date, status
            FROM employee_schedule
            WHERE schedule_id = %s
        """, (schedule_id,))
        
        schedule = cursor.fetchone()
        if not schedule:
            conn.close()
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404
        
        # Update schedule to confirmed
        cursor.execute("""
            UPDATE employee_schedule
            SET confirmed = 1, confirmed_at = CURRENT_TIMESTAMP
            WHERE schedule_id = %s
        """, (schedule_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Schedule confirmed successfully'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/employee_availability', methods=['GET', 'POST'])
def api_employee_availability():
    """Get or update employee availability"""
    try:
        conn, cursor = _pg_conn()
        
        if request.method == 'GET':
            employee_id = request.args.get('employee_id')
            if not employee_id:
                return jsonify({'success': False, 'message': 'employee_id is required'}), 400
            
            cursor.execute("""
                SELECT * FROM employee_availability
                WHERE employee_id = %s
            """, (employee_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                # Parse JSON strings for each day
                data = dict(row)
                for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
                    if data.get(day):
                        try:
                            data[day] = json.loads(data[day])
                        except:
                            data[day] = {'available': False, 'start': '09:00', 'end': '17:00'}
                    else:
                        data[day] = {'available': False, 'start': '09:00', 'end': '17:00'}
                
                return jsonify({'success': True, 'data': data})
            else:
                # Return default availability
                default_data = {
                    'employee_id': int(employee_id),
                    'monday': {'available': True, 'start': '09:00', 'end': '17:00'},
                    'tuesday': {'available': True, 'start': '09:00', 'end': '17:00'},
                    'wednesday': {'available': True, 'start': '09:00', 'end': '17:00'},
                    'thursday': {'available': True, 'start': '09:00', 'end': '17:00'},
                    'friday': {'available': True, 'start': '09:00', 'end': '17:00'},
                    'saturday': {'available': False, 'start': '09:00', 'end': '17:00'},
                    'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
                }
                return jsonify({'success': True, 'data': default_data})
        
        elif request.method == 'POST':
            if not request.json:
                return jsonify({'success': False, 'message': 'Invalid request data'}), 400
            
            data = request.json
            employee_id = data.get('employee_id')
            if not employee_id:
                return jsonify({'success': False, 'message': 'employee_id is required'}), 400
            
            # Check if availability exists
            cursor.execute("""
                SELECT availability_id FROM employee_availability
                WHERE employee_id = %s
            """, (employee_id,))
            
            exists = cursor.fetchone()
            
            # Prepare data for insertion/update
            availability_data = {}
            for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
                if day in data:
                    availability_data[day] = json.dumps(data[day])
            
            if exists:
                # Update existing
                update_fields = [f"{day} = %s" for day in availability_data.keys()]
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                values = list(availability_data.values())
                values.append(employee_id)
                
                query = f"""
                    UPDATE employee_availability
                    SET {', '.join(update_fields)}
                    WHERE employee_id = %s
                """
                cursor.execute(query, values)
            else:
                # Insert new
                fields = ['employee_id'] + list(availability_data.keys()) + ['updated_at']
                placeholders = ['%s'] * len(fields)
                values = [employee_id] + list(availability_data.values()) + ['CURRENT_TIMESTAMP']
                
                query = f"""
                    INSERT INTO employee_availability ({', '.join(fields)})
                    VALUES ({', '.join(placeholders)})
                """
                cursor.execute(query, values)
            
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': True,
                'data': data,
                'message': 'Availability saved successfully'
            })
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Schedule Management Endpoints
def get_employee_from_token():
    """Helper to get employee_id from session token"""
    session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not session_token:
        session_token = request.json.get('session_token') if request.json else None
    if not session_token:
        return None
    session_data = verify_session(session_token)
    if session_data and session_data.get('valid'):
        return session_data.get('employee_id')
    return None

@app.route('/api/schedule/generate', methods=['POST'])
def api_generate_schedule():
    """Generate automated schedule"""
    try:
        from schedule_generator import AutomatedScheduleGenerator
        
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        data = request.json
        week_start = data.get('week_start_date')
        if not week_start:
            return jsonify({'success': False, 'message': 'week_start_date is required'}), 400
        
        settings = data.get('settings', {})
        
        # Extract end date from settings if provided
        week_end = settings.get('week_end_date')
        if not week_end:
            # Default to 6 days after start if not provided
            from datetime import datetime, timedelta
            start_dt = datetime.strptime(week_start, '%Y-%m-%d')
            week_end = (start_dt + timedelta(days=6)).strftime('%Y-%m-%d')
        
        scheduler = AutomatedScheduleGenerator()
        result = scheduler.generate_schedule(week_start, settings, employee_id)
        
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/drafts', methods=['GET'])
def api_list_drafts():
    """List draft schedules (status = 'draft')"""
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401

        conn, cursor = _pg_conn()
        cursor.execute("""
            SELECT period_id, week_start_date, week_end_date, status, created_at,
                   total_labor_hours, estimated_labor_cost
            FROM schedule_periods
            WHERE status = 'draft'
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        drafts = [dict(r) for r in rows]
        return jsonify({'success': True, 'data': _sanitize_for_json(drafts)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/published', methods=['GET'])
def api_list_published():
    """List published schedules (status = 'published')"""
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401

        conn, cursor = _pg_conn()
        cursor.execute("""
            SELECT period_id, week_start_date, week_end_date, status, created_at,
                   published_at, total_labor_hours, estimated_labor_cost
            FROM schedule_periods
            WHERE status = 'published'
            ORDER BY published_at DESC NULLS LAST, week_start_date DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        published = [dict(r) for r in rows]
        return jsonify({'success': True, 'data': _sanitize_for_json(published)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/<int:period_id>/unpublish', methods=['POST'])
def api_unpublish_schedule(period_id):
    """Convert published schedule to draft for editing"""
    conn = None
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401

        conn, cursor = _pg_conn()
        cursor.execute(
            "SELECT period_id, status FROM schedule_periods WHERE period_id = %s",
            (period_id,)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404
        if row.get('status') != 'published':
            return jsonify({'success': False, 'message': 'Only published schedules can be unpublished'}), 400

        cursor.execute("""
            UPDATE schedule_periods
            SET status = 'draft', published_by = NULL, published_at = NULL
            WHERE period_id = %s
        """, (period_id,))
        cursor.execute("""
            UPDATE scheduled_shifts SET is_draft = 1 WHERE period_id = %s
        """, (period_id,))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@app.route('/api/schedule/<int:period_id>', methods=['GET', 'DELETE'])
def api_get_schedule(period_id):
    """Get schedule details or delete a draft period"""
    try:
        if request.method == 'DELETE':
            employee_id = get_employee_from_token()
            if not employee_id:
                return jsonify({'success': False, 'message': 'Authentication required'}), 401
            conn, cursor = _pg_conn()
            cursor.execute(
                "SELECT period_id, status FROM schedule_periods WHERE period_id = %s",
                (period_id,)
            )
            row = cursor.fetchone()
            if not row:
                conn.close()
                return jsonify({'success': False, 'message': 'Schedule not found'}), 404
            if row.get('status') != 'draft':
                conn.close()
                return jsonify({'success': False, 'message': 'Only draft schedules can be deleted'}), 400
            cursor.execute("DELETE FROM schedule_periods WHERE period_id = %s", (period_id,))
            conn.commit()
            conn.close()
            return jsonify({'success': True})

        from schedule_generator import AutomatedScheduleGenerator
        scheduler = AutomatedScheduleGenerator()
        summary = scheduler.get_schedule_summary(period_id)
        if not summary:
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404
        return jsonify(summary)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/<int:period_id>/publish', methods=['POST'])
def api_publish_schedule(period_id):
    """Publish schedule to employees and add to master calendar"""
    try:
        from schedule_generator import AutomatedScheduleGenerator
        
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        scheduler = AutomatedScheduleGenerator()
        result = scheduler.publish_schedule(period_id, employee_id)
        
        # Published shifts are shown via /api/employee_schedule (Scheduled_Shifts).
        # Do NOT add them to master_calendar — the Calendar loads both APIs and would
        # show each shift twice (event + schedule). Profile weekly schedule also uses
        # employee_schedule, so nothing extra is needed.
        
        return jsonify({'success': result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/<int:period_id>/save-draft', methods=['POST'])
def api_save_draft(period_id):
    """Persist draft schedule (optional period updates). Shift edits are already saved via PUT /shift."""
    conn = None
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401

        conn, cursor = _pg_conn()
        cursor.execute(
            "SELECT period_id, status FROM schedule_periods WHERE period_id = %s",
            (period_id,)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404
        if row.get('status') != 'draft':
            return jsonify({'success': False, 'message': 'Only draft schedules can be saved'}), 400

        data = (request.json or {})
        updates = []
        params = []
        if 'week_start_date' in data and data['week_start_date']:
            updates.append('week_start_date = %s')
            params.append(data['week_start_date'])
        if 'week_end_date' in data and data['week_end_date']:
            updates.append('week_end_date = %s')
            params.append(data['week_end_date'])
        if 'generation_settings' in data and data['generation_settings'] is not None:
            updates.append('generation_settings = %s')
            params.append(json.dumps(data['generation_settings']) if isinstance(data['generation_settings'], dict) else str(data['generation_settings']))

        if updates:
            params.append(period_id)
            cursor.execute(
                "UPDATE schedule_periods SET " + ", ".join(updates) + " WHERE period_id = %s",
                params
            )
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@app.route('/api/schedule/<int:period_id>/save-template', methods=['POST'])
def api_save_template(period_id):
    """Save schedule as template"""
    try:
        from schedule_generator import AutomatedScheduleGenerator
        
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        data = request.json
        template_name = data.get('template_name')
        if not template_name:
            return jsonify({'success': False, 'message': 'template_name is required'}), 400
        
        scheduler = AutomatedScheduleGenerator()
        template_id = scheduler.save_as_template(
            period_id,
            template_name,
            data.get('description', ''),
            employee_id
        )
        
        return jsonify({'success': True, 'template_id': template_id})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/copy-template', methods=['POST'])
def api_copy_from_template():
    """Copy schedule from template"""
    try:
        from schedule_generator import AutomatedScheduleGenerator
        
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        data = request.json
        template_id = data.get('template_id')
        week_start = data.get('week_start_date')
        
        if not template_id or not week_start:
            return jsonify({'success': False, 'message': 'template_id and week_start_date are required'}), 400
        
        scheduler = AutomatedScheduleGenerator()
        period_id = scheduler.copy_schedule_from_template(
            template_id,
            week_start,
            employee_id
        )
        
        if not period_id:
            return jsonify({'success': False, 'message': 'Template not found'}), 404
        
        return jsonify({'success': True, 'period_id': period_id})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/templates', methods=['GET'])
def api_get_templates():
    """Get all schedule templates"""
    try:
        conn, cursor = _pg_conn()
        
        cursor.execute("""
            SELECT st.*, 
                   e.first_name || ' ' || e.last_name as created_by_name
            FROM Schedule_Templates st
            LEFT JOIN employees e ON st.created_by = e.employee_id
            ORDER BY st.last_used DESC, st.created_at DESC
        """)
        
        templates = [dict(row) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return jsonify(templates)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedule/<int:period_id>/shift', methods=['POST', 'PUT', 'DELETE'])
def api_manage_shift(period_id):
    """Create, update, or delete shift in draft schedule"""
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        conn, cursor = _pg_conn()
        
        if request.method == 'POST':
            # Create new shift
            data = request.json
            
            cursor.execute("""
                INSERT INTO Scheduled_Shifts
                (period_id, employee_id, shift_date, start_time, end_time,
                 break_duration, position, notes, is_draft)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)
                RETURNING scheduled_shift_id
            """, (period_id, data['employee_id'], data['shift_date'],
                  data['start_time'], data['end_time'], data.get('break_duration', 30),
                  data.get('position'), data.get('notes')))
            shift_id = cursor.fetchone()['scheduled_shift_id']
            try:
                cursor.execute("""
                    INSERT INTO Schedule_Changes
                    (period_id, scheduled_shift_id, change_type, changed_by, new_values)
                    VALUES (%s, %s, 'created', %s, %s)
                """, (period_id, shift_id, employee_id, json.dumps(data, default=_json_serial)))
            except Exception:
                pass  # Schedule_Changes table may not exist
            
        elif request.method == 'PUT':
            # Update shift
            data = request.json
            shift_id = data['scheduled_shift_id']
            
            cursor.execute("""
                SELECT * FROM Scheduled_Shifts WHERE scheduled_shift_id = %s
            """, (shift_id,))
            old_row = cursor.fetchone()
            if not old_row:
                conn.close()
                return jsonify({'success': False, 'message': 'Shift not found'}), 404
            old_values = dict(old_row)
            cursor.execute("""
                UPDATE Scheduled_Shifts
                SET employee_id = %s, shift_date = %s, start_time = %s, end_time = %s,
                    break_duration = %s, position = %s, notes = %s
                WHERE scheduled_shift_id = %s
            """, (data['employee_id'], data['shift_date'], data['start_time'],
                  data['end_time'], data.get('break_duration', 30),
                  data.get('position'), data.get('notes'), shift_id))
            
            try:
                cursor.execute("""
                    INSERT INTO Schedule_Changes
                    (period_id, scheduled_shift_id, change_type, changed_by,
                     old_values, new_values)
                    VALUES (%s, %s, 'modified', %s, %s, %s)
                """, (period_id, shift_id, employee_id,
                      json.dumps(old_values, default=_json_serial),
                      json.dumps(data, default=_json_serial)))
            except Exception:
                pass  # Schedule_Changes table may not exist
            
        elif request.method == 'DELETE':
            # Delete shift
            shift_id = request.args.get('shift_id')
            if not shift_id:
                conn.close()
                return jsonify({'success': False, 'message': 'shift_id is required'}), 400
            
            # Get old values
            cursor.execute("""
                SELECT * FROM Scheduled_Shifts WHERE scheduled_shift_id = %s
            """, (shift_id,))
            old_row = cursor.fetchone()
            if not old_row:
                conn.close()
                return jsonify({'success': False, 'message': 'Shift not found'}), 404
            old_values = dict(old_row)
            
            # Delete
            cursor.execute("""
                DELETE FROM Scheduled_Shifts WHERE scheduled_shift_id = %s
            """, (shift_id,))
            
            try:
                cursor.execute("""
                    INSERT INTO Schedule_Changes
                    (period_id, scheduled_shift_id, change_type, changed_by, old_values)
                    VALUES (%s, %s, 'deleted', %s, %s)
                """, (period_id, shift_id, employee_id, json.dumps(old_values, default=_json_serial)))
            except Exception:
                pass  # Schedule_Changes table may not exist
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/availability/submit', methods=['POST'])
def api_submit_availability():
    """Employee submits their availability"""
    try:
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        data = request.json
        if not data or 'availability' not in data:
            return jsonify({'success': False, 'message': 'availability array is required'}), 400
        
        conn, cursor = _pg_conn()
        
        # Delete old recurring availability
        cursor.execute("""
            DELETE FROM Employee_Availability
            WHERE employee_id = %s AND is_recurring = 1
        """, (employee_id,))
        
        # Insert new availability
        for avail in data['availability']:
            cursor.execute("""
                INSERT INTO Employee_Availability
                (employee_id, day_of_week, start_time, end_time, 
                 availability_type, is_recurring)
                VALUES (%s, %s, %s, %s, %s, 1)
            """, (employee_id, avail['day'], avail['start_time'],
                  avail['end_time'], avail.get('type', 'available')))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/master_calendar', methods=['GET'])
def api_master_calendar():
    """Get master calendar events"""
    try:
        from database import get_calendar_events
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        event_type = request.args.get('event_type')
        
        events = get_calendar_events(
            start_date=start_date,
            end_date=end_date,
            event_type=event_type
        )
        return jsonify({
            'success': True,
            'data': _sanitize_for_json(events)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/master_calendar', methods=['POST'])
def api_create_calendar_event():
    """Create a new calendar event (admin only)"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
        # Verify session and get employee
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        position = session_result.get('position', '').lower()
        
        # Check if user is admin
        if position not in ['admin', 'manager']:
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        # Validate required fields
        event_date = data.get('event_date')
        event_type = data.get('event_type')
        title = data.get('title')
        
        if not event_date or not event_type or not title:
            return jsonify({'success': False, 'message': 'event_date, event_type, and title are required'}), 400
        
        # Validate event_type
        valid_types = ['schedule', 'shipment', 'holiday', 'event', 'meeting', 'maintenance', 'other']
        if event_type not in valid_types:
            return jsonify({'success': False, 'message': f'event_type must be one of: {", ".join(valid_types)}'}), 400
        
        from database import add_calendar_event
        
        # Get employee_ids if provided (empty list means for everyone)
        employee_ids = data.get('employee_ids')
        if employee_ids is not None and len(employee_ids) == 0:
            employee_ids = None  # Empty list means for everyone
        
        calendar_id = add_calendar_event(
            event_date=event_date,
            event_type=event_type,
            title=title,
            description=data.get('description'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            related_id=data.get('related_id'),
            related_table=data.get('related_table'),
            created_by=employee_id,
            employee_ids=employee_ids
        )
        
        return jsonify({
            'success': True,
            'message': 'Event created successfully',
            'calendar_id': calendar_id
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Calendar Integration Endpoints
@app.route('/calendar/subscribe/<token>.ics')
def calendar_feed(token):
    """iCal feed endpoint - accessible by calendar apps"""
    try:
        from calendar_integration import CalendarIntegrationSystem
        
        calendar_system = CalendarIntegrationSystem(base_url=request.url_root.rstrip('/'))
        ical_data = calendar_system.generate_ical_feed(token)
        
        if not ical_data:
            return "Invalid or expired subscription", 404
        
        response = Response(ical_data, mimetype='text/calendar')
        response.headers['Content-Disposition'] = 'attachment; filename=calendar.ics'
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        
        return response
    except Exception as e:
        traceback.print_exc()
        return f"Error generating calendar feed: {str(e)}", 500

def _create_calendar_subscriptions_table_if_missing():
    """Create calendar_subscriptions table (lowercase) so INSERT finds it. Idempotent."""
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS calendar_subscriptions (
                subscription_id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                subscription_token VARCHAR(255) NOT NULL,
                include_shifts SMALLINT DEFAULT 1,
                include_shipments SMALLINT DEFAULT 1,
                include_meetings SMALLINT DEFAULT 1,
                include_deadlines SMALLINT DEFAULT 1,
                calendar_name VARCHAR(255) DEFAULT 'My Work Schedule',
                is_active SMALLINT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        cur.close()
    except Exception:
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


@app.route('/api/calendar/subscription/create', methods=['POST'])
def api_calendar_subscription_create():
    """Create calendar subscription for employee"""
    try:
        _create_calendar_subscriptions_table_if_missing()
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        data = request.get_json(silent=True) or {}
        if not session_token:
            session_token = data.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_data.get('employee_id')
        if employee_id is None:
            return jsonify({'success': False, 'message': 'Session missing employee_id'}), 401
        
        preferences = data.get('preferences') or data
        
        from calendar_integration import CalendarIntegrationSystem
        base_url = request.url_root.rstrip('/')
        if not base_url or base_url.startswith('http://localhost:3000'):
            try:
                base_url = request.host_url.rstrip('/').replace('localhost:3000', 'localhost:5001')
            except Exception:
                base_url = 'http://localhost:5001'
        calendar_system = CalendarIntegrationSystem(base_url=base_url)
        
        subscription = calendar_system.create_subscription(employee_id, preferences)
        
        return jsonify({'success': True, 'data': subscription})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

def _ensure_calendar_subscriptions_table():
    """Create calendar_subscriptions table if it does not exist."""
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS calendar_subscriptions (
                subscription_id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                subscription_token VARCHAR(255) NOT NULL,
                include_shifts SMALLINT DEFAULT 1,
                include_shipments SMALLINT DEFAULT 1,
                include_meetings SMALLINT DEFAULT 1,
                include_deadlines SMALLINT DEFAULT 1,
                calendar_name VARCHAR(255) DEFAULT 'My Work Schedule',
                is_active SMALLINT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        cur.close()
    except Exception:
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


@app.route('/api/calendar/subscription/urls', methods=['GET'])
def get_subscription_urls():
    """Get calendar subscription URLs"""
    try:
        try:
            _create_calendar_subscriptions_table_if_missing()
        except Exception:
            pass
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.args.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_data['employee_id']
        
        from calendar_integration import CalendarIntegrationSystem
        calendar_system = CalendarIntegrationSystem(base_url=request.url_root.rstrip('/'))
        
        urls = calendar_system.get_employee_calendar_url(employee_id)
        
        if urls:
            return jsonify({'success': True, 'data': urls})
        else:
            # Create new subscription if none exists
            subscription = calendar_system.create_subscription(employee_id)
            return jsonify({'success': True, 'data': subscription})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/calendar/events/<int:event_id>/export', methods=['GET'])
def export_event(event_id):
    """Export single event as .ics file"""
    try:
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.args.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_data.get('employee_id')
        
        from calendar_integration import CalendarIntegrationSystem
        calendar_system = CalendarIntegrationSystem()
        
        ical_data = calendar_system.export_single_event_ics(event_id, employee_id)
        
        if not ical_data:
            return jsonify({'success': False, 'message': 'Event not found'}), 404
        
        return Response(
            ical_data,
            mimetype='text/calendar',
            headers={
                'Content-Disposition': f'attachment; filename=event_{event_id}.ics'
            }
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shifts/create', methods=['POST'])
def create_shift():
    """Create employee shift"""
    try:
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.json.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        created_by = session_data['employee_id']
        data = request.json
        
        from calendar_integration import CalendarIntegrationSystem
        from datetime import datetime
        
        calendar_system = CalendarIntegrationSystem()
        
        start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
        
        result = calendar_system.create_shift_event(
            data['employee_id'],
            start_time,
            end_time,
            data['shift_type'],
            data.get('notes'),
            created_by
        )
        
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/schedule', methods=['POST'])
def schedule_shipment():
    """Schedule shipment delivery"""
    try:
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.json.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        created_by = session_data['employee_id']
        data = request.json
        
        from calendar_integration import CalendarIntegrationSystem
        from datetime import datetime
        
        calendar_system = CalendarIntegrationSystem()
        
        expected_date = datetime.fromisoformat(data['expected_date'].replace('Z', '+00:00'))
        
        result = calendar_system.create_shipment_event(
            data['vendor_id'],
            expected_date,
            data['delivery_window'],
            data['assigned_receiver'],
            data.get('notes'),
            created_by
        )
        
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/calendar/events', methods=['GET'])
def get_events():
    """Get calendar events for employee"""
    try:
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.args.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_data['employee_id']
        start_date = request.args.get('start', '')
        end_date = request.args.get('end', '')
        
        conn, cursor = _pg_conn()
        
        # Get all events for employee
        query = """
            SELECT DISTINCT ce.*
            FROM Calendar_Events ce
            LEFT JOIN Employee_Shifts es ON ce.event_id = es.event_id
            LEFT JOIN Shipment_Schedule ss ON ce.event_id = ss.event_id
            LEFT JOIN Event_Attendees ea ON ce.event_id = ea.event_id
            WHERE (es.employee_id = %s 
                   OR ss.assigned_receiver = %s 
                   OR ea.employee_id = %s
                   OR ce.event_type IN ('holiday', 'deadline'))
        """
        params = [employee_id, employee_id, employee_id]
        
        if start_date and end_date:
            query += " AND ce.start_datetime BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        
        query += " ORDER BY ce.start_datetime"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        events = [dict(row) for row in rows]
        
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'data': events})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# SOCKET.IO EVENT HANDLERS
# ============================================================================

if SOCKETIO_AVAILABLE and socketio:
    from flask_socketio import join_room
    
    @socketio.on('connect')
    def handle_connect():
        print('Client connected to Socket.IO')
        emit('connected', {'status': 'ok'})
    
    @socketio.on('disconnect')
    def handle_disconnect():
        print('Client disconnected from Socket.IO')
    
    @socketio.on('join')
    def handle_join(data):
        room = data.get('room', 'customer_display')
        join_room(room)
        print(f'Client joined room: {room}')
        emit('joined', {'room': room})

# ============================================================================
# CUSTOMER DISPLAY SYSTEM API ENDPOINTS
# ============================================================================

@app.route('/api/transaction/start', methods=['POST'])
def start_transaction():
    """Start new transaction. Returns a single Response (no tuple) to avoid CORS/Flask issues."""
    try:
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        data = request.get_json(silent=True) if request.is_json else request.json
        if not session_token and data:
            session_token = data.get('session_token')
        if not session_token:
            return make_response(jsonify({'success': False, 'message': 'Authentication required'}), 401)
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return make_response(jsonify({'success': False, 'message': 'Invalid session'}), 401)
        if not data or not isinstance(data, dict):
            return make_response(jsonify({'success': False, 'message': 'Invalid request body'}), 400)
        items = data.get('items')
        if not items:
            return make_response(jsonify({'success': False, 'message': 'items required'}), 400)
        employee_id = session_data['employee_id']
        customer_id = data.get('customer_id')
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem()
        result = cds.start_transaction(employee_id, items, customer_id)
        if SOCKETIO_AVAILABLE and socketio:
            socketio.emit('transaction_started', result, room='customer_display')
        return make_response(jsonify({'success': True, 'data': result}))
    except Exception as e:
        traceback.print_exc()
        return make_response(jsonify({'success': False, 'message': str(e)}), 500)

@app.route('/api/transaction/<int:transaction_id>', methods=['GET'])
def get_transaction(transaction_id):
    """Get transaction details"""
    try:
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem()
        
        details = cds.get_transaction_details(transaction_id)
        if not details:
            return jsonify({'success': False, 'message': 'Transaction not found'}), 404
        
        return jsonify({'success': True, 'data': details})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/payment-methods', methods=['GET'])
def get_payment_methods():
    """Get available payment methods"""
    try:
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem()
        
        methods = cds.get_payment_methods()
        return jsonify({'success': True, 'data': methods})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/payment/process', methods=['POST'])
def process_payment():
    """Process payment"""
    try:
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.json.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        data = request.json
        
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem()
        
        result = cds.process_payment(
            data['transaction_id'],
            data['payment_method_id'],
            data['amount'],
            data.get('card_info'),
            data.get('tip', 0)
        )
        
        # When payment completes for an order, ensure sale is journalized to accounting (idempotent)
        if result.get('success') and result.get('order_id'):
            try:
                from pos_accounting_bridge import journalize_sale_to_accounting
                employee_id = session_data.get('employee_id') or session_data.get('user_id')
                if employee_id:
                    jr = journalize_sale_to_accounting(int(result['order_id']), int(employee_id))
                    if not jr.get('success') and jr.get('message'):
                        print(f"Accounting journalize_sale error (process_payment order {result['order_id']}): {jr.get('message')}")
            except Exception as je:
                print(f"Accounting journalize_sale error (process_payment): {je}")
        
        # Emit Socket.IO events for customer display
        if SOCKETIO_AVAILABLE and socketio:
            if result.get('success'):
                socketio.emit('payment_processed', result, room='customer_display')
                socketio.emit('payment_success', result, room='customer_display')
            else:
                socketio.emit('payment_error', result, room='customer_display')
        
        return jsonify({'success': result.get('success', False), 'data': result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receipt/preference', methods=['POST'])
def save_receipt_preference():
    """Save receipt preference"""
    try:
        data = request.json
        
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem()
        
        preference_id = cds.save_receipt_preference(
            data['transaction_id'],
            data['receipt_type'],
            data.get('email'),
            data.get('phone')
        )
        
        return jsonify({'success': True, 'preference_id': preference_id})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/transaction/signature', methods=['POST'])
def save_transaction_signature():
    """Save signature for a transaction"""
    try:
        data = request.json
        transaction_id = data.get('transaction_id')
        signature = data.get('signature')  # Base64 encoded image
        
        if not transaction_id or not signature:
            return jsonify({'success': False, 'message': 'Transaction ID and signature are required'}), 400
        
        conn, cursor = _pg_conn()
        try:
            cursor.execute("""
                UPDATE transactions SET signature = %s WHERE transaction_id = %s
            """, (signature, transaction_id))
            if cursor.rowcount == 0:
                return jsonify({'success': False, 'message': 'Transaction not found'}), 404
            conn.commit()
            return jsonify({'success': True, 'message': 'Signature saved successfully'})
        finally:
            conn.close()
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/customer-display/settings', methods=['GET', 'POST', 'PUT'])
def get_display_settings():
    """Get or update customer display settings"""
    try:
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem()
        
        if request.method == 'GET':
            settings = cds.get_display_settings()
            return jsonify({'success': True, 'data': settings})
        else:
            # POST or PUT - update settings
            data = request.get_json() or {}
            
            # Validate session
            session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not session_token:
                session_token = request.cookies.get('session_token')
            
            if not session_token:
                return jsonify({'success': False, 'message': 'Authentication required'}), 401
            
            employee = verify_session(session_token)
            if not employee:
                return jsonify({'success': False, 'message': 'Invalid session'}), 401
            
            # Check admin permission
            pm = get_permission_manager()
            if not pm.has_permission(employee['employee_id'], 'manage_settings'):
                # Fallback: check if user is admin/owner
                if employee.get('position', '').lower() not in ['admin', 'owner', 'manager']:
                    return jsonify({'success': False, 'message': 'Permission denied'}), 403
            
            # Update settings
            cds.update_display_settings(**data)
            updated_settings = cds.get_display_settings()
            return jsonify({'success': True, 'data': updated_settings})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Shipment Verification Workflow Settings
@app.route('/api/shipment-verification/settings', methods=['GET', 'POST'])
def api_verification_settings():
    """Get or update shipment verification workflow settings"""
    try:
        from database import ensure_shipment_verification_tables
        ensure_shipment_verification_tables()
        conn, cursor = _pg_conn()
        
        if request.method == 'POST':
            data = request.json if request.is_json else {}
            workflow_mode = data.get('workflow_mode', 'simple')
            auto_add = data.get('auto_add_to_inventory', 'true')
            
            # Update settings
            cursor.execute("""
                UPDATE shipment_verification_settings 
                SET setting_value = %s, updated_at = CURRENT_TIMESTAMP
                WHERE setting_key = %s
            """, (workflow_mode, 'workflow_mode'))
            
            cursor.execute("""
                UPDATE shipment_verification_settings 
                SET setting_value = %s, updated_at = CURRENT_TIMESTAMP
                WHERE setting_key = %s
            """, (auto_add, 'auto_add_to_inventory'))
            
            conn.commit()
        
        # Get all settings
        cursor.execute("SELECT setting_key, setting_value, description FROM shipment_verification_settings")
        rows = cursor.fetchall()
        settings = {row['setting_key']: row['setting_value'] for row in rows}
        
        conn.close()
        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
        traceback.print_exc()
        if 'conn' in locals():
            conn.close()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/<int:shipment_id>/workflow-step', methods=['POST'])
def api_update_workflow_step(shipment_id):
    """Update workflow step for a shipment"""
    try:
        data = request.json if request.is_json else {}
        step = data.get('step')  # 'verify', 'confirm_pricing', 'add_to_inventory'
        
        if not step:
            return jsonify({'success': False, 'message': 'Step is required'}), 400
        
        from database import ensure_shipment_verification_tables
        ensure_shipment_verification_tables()
        conn, cursor = _pg_conn()
        cursor.execute("""
            UPDATE pending_shipments 
            SET workflow_step = %s
            WHERE pending_shipment_id = %s
        """, (step, shipment_id))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'step': step})
    except Exception as e:
        traceback.print_exc()
        if 'conn' in locals():
            conn.close()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/shipments/<int:shipment_id>/add-to-inventory', methods=['POST'])
def api_add_to_inventory(shipment_id):
    """Add verified items to inventory (Step 3 of three-step workflow)"""
    try:
        employee_id = None
        data = request.json if request.is_json else {}
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = data.get('session_token')
        if session_token:
            session_data = verify_session(session_token)
            if session_data and session_data.get('valid'):
                employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        # Complete verification (adds to inventory via complete_verification function)
        result = complete_verification(shipment_id, employee_id, data.get('notes'))
        
        if result.get('success'):
            # Mark as added to inventory
            conn, cursor = _pg_conn()
            cursor.execute("""
                UPDATE pending_shipments 
                SET added_to_inventory = 1,
                    workflow_step = 'completed',
                    status = 'completed'
                WHERE pending_shipment_id = %s
            """, (shipment_id,))
            conn.commit()
            conn.close()
            # Post to accounting so Accounting page reflects inventory received
            try:
                from pos_accounting_bridge import journalize_shipment_received_to_accounting
                jr = journalize_shipment_received_to_accounting(shipment_id, employee_id)
                if not jr.get('success'):
                    print(f"Accounting journalize_shipment (pending_shipment {shipment_id}): {jr.get('message', 'unknown')}")
            except Exception as je:
                print(f"Accounting journalize_shipment error (pending_shipment {shipment_id}): {je}")
        
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        if 'conn' in locals():
            conn.close()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/store-location-settings', methods=['GET'])
def api_get_store_location_settings():
    """Get store location settings"""
    try:
        settings = get_store_location_settings()
        if settings:
            return jsonify(settings)
        else:
            return jsonify({
                'store_name': 'Store',
                'latitude': None,
                'longitude': None,
                'address': '',
                'allowed_radius_meters': 100.0,
                'require_location': 1
            })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/store-location-settings', methods=['POST'])
def api_update_store_location_settings():
    """Update store location settings (admin only)"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        
        # Check if user is admin or has manage_settings permission
        employee = get_employee(employee_id)
        is_admin = employee and employee.get('position', '').lower() == 'admin'
        
        pm = get_permission_manager()
        has_permission = pm.has_permission(employee_id, 'manage_settings')
        
        if not is_admin and not has_permission:
            return jsonify({'success': False, 'message': 'Permission denied. Admin access or manage_settings permission required.'}), 403
        
        # Update settings - convert types properly
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        allowed_radius = data.get('allowed_radius_meters')
        
        # Convert to float if provided and not None/empty
        if latitude is not None and latitude != '':
            try:
                latitude = float(latitude)
            except (ValueError, TypeError):
                latitude = None
        
        if longitude is not None and longitude != '':
            try:
                longitude = float(longitude)
            except (ValueError, TypeError):
                longitude = None
        
        if allowed_radius is not None and allowed_radius != '':
            try:
                allowed_radius = float(allowed_radius)
            except (ValueError, TypeError):
                allowed_radius = None
        
        # Convert require_location to int if provided
        require_location = data.get('require_location')
        if require_location is not None:
            try:
                require_location = int(require_location)
            except (ValueError, TypeError):
                require_location = None
        
        success = update_store_location_settings(
            store_name=data.get('store_name') or None,
            latitude=latitude,
            longitude=longitude,
            address=data.get('address') or None,
            allowed_radius_meters=allowed_radius,
            require_location=require_location
        )
        
        if success:
            return jsonify({'success': True, 'message': 'Store location settings updated'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update settings'}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# STRIPE INTEGRATION API ENDPOINTS
# ============================================================================

@app.route('/api/payment-settings', methods=['GET'])
def api_get_payment_settings():
    """Get payment settings"""
    try:
        settings = get_payment_settings()
        if settings:
            # Don't expose encrypted keys in GET request
            safe_settings = {k: v for k, v in settings.items() 
                           if 'encrypted' not in k.lower() and 'secret' not in k.lower()}
            return jsonify({'success': True, 'settings': safe_settings})
        else:
            return jsonify({
                'success': True,
                'settings': {
                    'payment_processor': 'cash_only',
                    'enabled_payment_methods': '["cash"]'
                }
            })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/payment-settings', methods=['POST'])
def api_update_payment_settings():
    """Update payment settings"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
        # Verify session (optional for onboarding, required for settings updates)
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if session_token:
            session_result = verify_session(session_token)
            if not session_result.get('valid'):
                return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        # Parse enabled_payment_methods if it's a string
        enabled_methods = data.get('enabled_payment_methods')
        if isinstance(enabled_methods, str):
            try:
                enabled_methods = json.loads(enabled_methods)
            except:
                enabled_methods = ['cash']
        if isinstance(enabled_methods, list):
            enabled_methods = json.dumps(enabled_methods)
        
        success = update_payment_settings(
            payment_processor=data.get('payment_processor'),
            stripe_account_id=data.get('stripe_account_id'),
            stripe_credential_id=data.get('stripe_credential_id'),
            default_currency=data.get('default_currency'),
            transaction_fee_rate=data.get('transaction_fee_rate'),
            transaction_fee_fixed=data.get('transaction_fee_fixed'),
            enabled_payment_methods=enabled_methods,
            require_cvv=data.get('require_cvv'),
            require_zip=data.get('require_zip'),
            auto_capture=data.get('auto_capture')
        )
        
        if success:
            return jsonify({'success': True, 'message': 'Payment settings updated'})
        else:
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'message': 'Failed to update settings. Check server logs for details.'}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stripe/connect/create', methods=['POST'])
def api_create_stripe_connect_account():
    """Create Stripe Connect account and return onboarding link"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        email = data.get('email')
        country = data.get('country', 'US')
        account_type = data.get('account_type', 'express')
        
        # Check if Stripe is configured
        stripe_secret_key = os.getenv('STRIPE_SECRET_KEY')
        if not stripe_secret_key:
            return jsonify({
                'success': False,
                'message': 'Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.'
            }), 500
        
        try:
            import stripe
            stripe.api_key = stripe_secret_key
            
            # Create connected account
            account = stripe.Account.create(
                type=account_type,
                country=country.upper(),
                email=email,
                capabilities={
                    'card_payments': {'requested': True},
                    'transfers': {'requested': True},
                },
            )
            
            # Create account link for onboarding
            account_link = stripe.AccountLink.create(
                account=account.id,
                refresh_url=f"{request.host_url}onboarding/stripe/refresh",
                return_url=f"{request.host_url}onboarding/stripe/complete",
                type='account_onboarding',
            )
            
            # Save to database
            account_record = create_stripe_connect_account(
                account_type=account_type,
                email=email,
                country=country
            )
            
            if account_record:
                update_stripe_connect_account(
                    stripe_account_id=account_record['stripe_account_id'],
                    stripe_connected_account_id=account.id,
                    onboarding_link=account_link.url,
                    onboarding_link_expires_at=None  # Stripe handles expiration
                )
                
                # Update payment settings to use this account
                update_payment_settings(
                    payment_processor='stripe_connect',
                    stripe_account_id=account_record['stripe_account_id']
                )
                
                return jsonify({
                    'success': True,
                    'onboarding_url': account_link.url,
                    'account_id': account.id,
                    'stripe_account_id': account_record['stripe_account_id']
                })
            else:
                return jsonify({'success': False, 'message': 'Failed to save account'}), 500
                
        except Exception as stripe_error:
            return jsonify({
                'success': False,
                'message': f'Stripe error: {str(stripe_error)}'
            }), 500
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stripe/connect/status', methods=['POST'])
def api_check_stripe_connect_status():
    """Check Stripe Connect account onboarding status"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        stripe_account_id = data.get('stripe_account_id')
        connected_account_id = data.get('connected_account_id')
        
        if not stripe_account_id and not connected_account_id:
            return jsonify({'success': False, 'message': 'stripe_account_id or connected_account_id required'}), 400
        
        stripe_secret_key = os.getenv('STRIPE_SECRET_KEY')
        if not stripe_secret_key:
            return jsonify({'success': False, 'message': 'Stripe not configured'}), 500
        
        try:
            import stripe
            stripe.api_key = stripe_secret_key
            
            # Get account from database if we have stripe_account_id
            if stripe_account_id:
                account_record = get_stripe_connect_account(stripe_account_id)
                if account_record:
                    connected_account_id = account_record.get('stripe_connected_account_id')
            
            if not connected_account_id:
                return jsonify({'success': False, 'message': 'Account not found'}), 404
            
            # Fetch account from Stripe
            account = stripe.Account.retrieve(connected_account_id)
            
            # Update database with latest status
            if stripe_account_id:
                update_stripe_connect_account(
                    stripe_account_id=stripe_account_id,
                    charges_enabled=1 if account.charges_enabled else 0,
                    payouts_enabled=1 if account.payouts_enabled else 0,
                    onboarding_completed=1 if (account.charges_enabled and account.payouts_enabled) else 0,
                    country=account.country,
                    email=account.email
                )
            
            return jsonify({
                'success': True,
                'charges_enabled': account.charges_enabled,
                'payouts_enabled': account.payouts_enabled,
                'onboarding_completed': account.charges_enabled and account.payouts_enabled,
                'country': account.country,
                'email': account.email
            })
            
        except Exception as stripe_error:
            return jsonify({
                'success': False,
                'message': f'Stripe error: {str(stripe_error)}'
            }), 500
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stripe/credentials/validate', methods=['POST'])
def api_validate_stripe_credentials():
    """Validate Stripe API keys (for direct mode)"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        publishable_key = data.get('publishable_key', '').strip()
        secret_key = data.get('secret_key', '').strip()
        
        if not publishable_key or not secret_key:
            return jsonify({'success': False, 'message': 'Both publishable and secret keys are required'}), 400
        
        # Validate key format
        if not publishable_key.startswith('pk_'):
            return jsonify({'success': False, 'message': 'Invalid publishable key format'}), 400
        
        if not (secret_key.startswith('sk_test_') or secret_key.startswith('sk_live_')):
            return jsonify({'success': False, 'message': 'Invalid secret key format'}), 400
        
        # Test the keys with Stripe API
        try:
            import stripe
            stripe.api_key = secret_key
            
            # Make a test API call
            account = stripe.Account.retrieve()
            
            # Determine if test or live mode
            test_mode = 1 if secret_key.startswith('sk_test_') else 0
            
            # Encrypt and save credentials
            from encryption_utils import encrypt
            
            credential_record = create_stripe_credentials(
                stripe_publishable_key=publishable_key,
                stripe_secret_key_encrypted=encrypt(secret_key),
                test_mode=test_mode
            )
            
            if credential_record:
                # Mark as verified
                update_stripe_credentials(
                    credential_id=credential_record['credential_id'],
                    verified=1
                )
                
                # Update payment settings to use these credentials
                update_payment_settings(
                    payment_processor='stripe_direct',
                    stripe_credential_id=credential_record['credential_id']
                )
                
                return jsonify({
                    'success': True,
                    'message': 'Stripe credentials validated and saved',
                    'credential_id': credential_record['credential_id'],
                    'test_mode': test_mode,
                    'account_id': account.id
                })
            else:
                return jsonify({'success': False, 'message': 'Failed to save credentials'}), 500
                
        except stripe.error.AuthenticationError:
            return jsonify({'success': False, 'message': 'Invalid API keys. Please check your credentials.'}), 400
        except Exception as stripe_error:
            return jsonify({
                'success': False,
                'message': f'Stripe error: {str(stripe_error)}'
            }), 500
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stripe/config', methods=['GET'])
def api_get_stripe_config():
    """Get complete Stripe configuration (for payment processing)"""
    try:
        config = get_stripe_config()
        if config:
            # Don't expose decrypted keys in API response
            safe_config = config.copy()
            if 'stripe_connect' in safe_config:
                safe_config['stripe_connect'] = {k: v for k, v in safe_config['stripe_connect'].items() 
                                                 if k != 'access_token'}
            if 'stripe_direct' in safe_config:
                safe_config['stripe_direct'] = {k: v for k, v in safe_config['stripe_direct'].items() 
                                               if k != 'secret_key'}
            return jsonify({'success': True, 'config': safe_config})
        else:
            return jsonify({'success': True, 'config': {'payment_processor': 'cash_only'}})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# ONBOARDING API ENDPOINTS (removed - onboarding disabled)
# ============================================================================

@app.route('/api/onboarding/status', methods=['GET'])
def api_get_onboarding_status():
    return jsonify({'success': False, 'message': 'Onboarding has been removed.'}), 410

@app.route('/api/onboarding/update-step', methods=['POST'])
def api_update_onboarding_step():
    return jsonify({'success': False, 'message': 'Onboarding has been removed.'}), 410

@app.route('/api/onboarding/step', methods=['POST'])
def api_save_onboarding_step():
    return jsonify({'success': False, 'message': 'Onboarding has been removed.'}), 410

@app.route('/api/onboarding/complete', methods=['POST'])
def api_complete_onboarding():
    return jsonify({'success': False, 'message': 'Onboarding has been removed.'}), 410

@app.route('/api/customer-rewards-settings', methods=['GET'])
def api_get_customer_rewards_settings():
    """Get customer rewards settings"""
    try:
        settings = get_customer_rewards_settings()
        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/customer-rewards-settings', methods=['POST'])
def api_update_customer_rewards_settings():
    """Update customer rewards settings (admin only, or during onboarding)"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
        # Check if settings exist in database (allow initial setup without strict auth)
        conn, cursor = _pg_conn()
        try:
            cursor.execute("SELECT COUNT(*) AS c FROM customer_rewards_settings")
            count = cursor.fetchone()['c']
            is_initial_setup = count == 0
        except Exception:
            is_initial_setup = True
        finally:
            conn.close()
        
        # Verify session if not initial setup
        session_token = data.get('session_token') or request.headers.get('X-Session-Token') or request.cookies.get('session_token')
        
        if not is_initial_setup:
            if not session_token:
                return jsonify({'success': False, 'message': 'Session token required'}), 401
            
            session_result = verify_session(session_token)
            if not session_result or not session_result.get('valid'):
                return jsonify({'success': False, 'message': 'Invalid session'}), 401
            
            employee_id = session_result.get('employee_id')
            
            # Check if user is admin or has manage_settings permission
            employee = get_employee(employee_id)
            is_admin = employee and employee.get('position', '').lower() == 'admin'
            
            pm = get_permission_manager()
            has_permission = pm.has_permission(employee_id, 'manage_settings')
            
            if not is_admin and not has_permission:
                return jsonify({'success': False, 'message': 'Permission denied. Admin access or manage_settings permission required.'}), 403
        
        # Ensure customer_rewards_settings has points_enabled, percentage_enabled, fixed_enabled (migrate if missing)
        conn, cursor = _pg_conn()
        try:
            for col, typ in [('points_enabled', 'INTEGER DEFAULT 1'), ('percentage_enabled', 'INTEGER DEFAULT 0'), ('fixed_enabled', 'INTEGER DEFAULT 0')]:
                cursor.execute("""
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'customer_rewards_settings' AND column_name = %s
                """, (col,))
                if cursor.fetchone() is None:
                    try:
                        cursor.execute(f"ALTER TABLE customer_rewards_settings ADD COLUMN {col} {typ}")
                        conn.commit()
                    except Exception:
                        conn.rollback()
        except Exception as mig_err:
            try:
                conn.rollback()
            except Exception:
                pass
        finally:
            conn.close()

        # Update settings - run UPDATE here so we never touch database.py (avoids cached code)
        allowed_keys = {
            'enabled', 'require_email', 'require_phone', 'require_both',
            'reward_type', 'points_per_dollar', 'points_redemption_value',
            'percentage_discount', 'fixed_discount', 'minimum_spend'
        }
        raw = {
            'enabled': data.get('enabled'),
            'require_email': data.get('require_email'),
            'require_phone': data.get('require_phone'),
            'require_both': data.get('require_both'),
            'reward_type': data.get('reward_type'),
            'points_per_dollar': data.get('points_per_dollar'),
            'points_redemption_value': data.get('points_redemption_value'),
            'percentage_discount': data.get('percentage_discount'),
            'fixed_discount': data.get('fixed_discount'),
            'minimum_spend': data.get('minimum_spend')
        }
        update_fields = {k: v for k, v in raw.items() if k in allowed_keys and v is not None}
        
        if not update_fields:
            return jsonify({'success': False, 'message': 'No fields to update'}), 400

        conn, cursor = _pg_conn()
        try:
            cursor.execute("SELECT COUNT(*) AS c FROM customer_rewards_settings")
            count = cursor.fetchone()['c']
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'customer_rewards_settings'
            """)
            existing_cols = {r['column_name'] for r in cursor.fetchall()}
            # Only columns that exist (no points_enabled etc. unless migrated)
            base_cols = [
                'enabled', 'require_email', 'require_phone', 'require_both',
                'reward_type', 'points_per_dollar', 'points_redemption_value',
                'percentage_discount', 'fixed_discount', 'minimum_spend'
            ]
            cols_that_exist = [c for c in base_cols if c in existing_cols]
            defaults = {
                'enabled': 0, 'require_email': 0, 'require_phone': 0, 'require_both': 0,
                'reward_type': 'points', 'points_per_dollar': 1.0, 'points_redemption_value': 0.01,
                'percentage_discount': 0.0, 'fixed_discount': 0.0, 'minimum_spend': 0.0
            }
            if count == 0:
                vals = [update_fields.get(c, defaults.get(c)) for c in cols_that_exist]
                placeholders = ', '.join(['%s'] * len(cols_that_exist))
                cursor.execute(
                    f"INSERT INTO customer_rewards_settings ({', '.join(cols_that_exist)}) VALUES ({placeholders})",
                    vals
                )
            else:
                set_cols = [k for k in update_fields if k in existing_cols]
                if set_cols:
                    set_clause = ', '.join(f"{c} = %s" for c in set_cols)
                    params = [update_fields[c] for c in set_cols]
                    cursor.execute(f"""
                        UPDATE customer_rewards_settings
                        SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                        WHERE id = (SELECT id FROM customer_rewards_settings ORDER BY id DESC LIMIT 1)
                    """, params)
            conn.commit()
            return jsonify({'success': True, 'message': 'Customer rewards settings updated successfully'})
        except Exception as db_err:
            conn.rollback()
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(db_err)}), 500
        finally:
            conn.close()
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/customer-display')
def customer_display():
    """Render customer display page"""
    return render_template('customer_display.html')

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """Serve uploaded files"""
    try:
        return send_from_directory('uploads', filename)
    except Exception as e:
        print(f"Error serving file {filename}: {e}")
        return jsonify({'error': 'File not found'}), 404

# ============================================================================
# SMS CRM API ENDPOINTS
# ============================================================================

@app.route('/api/sms/settings/<int:store_id>', methods=['GET', 'POST'])
def api_sms_settings(store_id):
    """Get or update SMS settings for a store"""
    try:
        if request.method == 'GET':
            settings = sms_service.get_store_sms_settings(store_id)
            if settings:
                # Hide sensitive data
                if settings.get('smtp_password'):
                    settings['smtp_password'] = '***'
                if settings.get('aws_secret_access_key'):
                    settings['aws_secret_access_key'] = '***'
                if settings.get('twilio_auth_token'):
                    settings['twilio_auth_token'] = '***'
            return jsonify(settings or {})
        
        # POST - Update settings
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        employee = get_employee(employee_id)
        is_admin = employee and employee.get('position', '').lower() == 'admin'
        
        pm = get_permission_manager()
        has_permission = pm.has_permission(employee_id, 'manage_settings')
        
        if not is_admin and not has_permission:
            return jsonify({'success': False, 'message': 'Permission denied'}), 403
        
        conn, cursor = _pg_conn()
        
        cursor.execute("SELECT setting_id FROM sms_settings WHERE store_id = %s", (store_id,))
        exists = cursor.fetchone()
        
        provider = data.get('sms_provider', 'email')
        
        if exists:
            if provider == 'email':
                cursor.execute("""
                    UPDATE sms_settings SET
                        sms_provider = %s,
                        smtp_server = %s,
                        smtp_port = %s,
                        smtp_user = %s,
                        smtp_password = %s,
                        smtp_use_tls = %s,
                        business_name = %s,
                        store_phone_number = %s,
                        auto_send_rewards_earned = %s,
                        auto_send_rewards_redeemed = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE store_id = %s
                """, (
                    provider,
                    data.get('smtp_server', 'smtp.gmail.com'),
                    data.get('smtp_port', 587),
                    data.get('smtp_user'),
                    data.get('smtp_password'),
                    data.get('smtp_use_tls', 1),
                    data.get('business_name'),
                    data.get('store_phone_number'),
                    data.get('auto_send_rewards_earned', 1),
                    data.get('auto_send_rewards_redeemed', 1),
                    store_id
                ))
            elif provider == 'aws_sns':
                cursor.execute("""
                    UPDATE sms_settings SET
                        sms_provider = %s,
                        aws_access_key_id = %s,
                        aws_secret_access_key = %s,
                        aws_region = %s,
                        business_name = %s,
                        auto_send_rewards_earned = %s,
                        auto_send_rewards_redeemed = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE store_id = %s
                """, (
                    provider,
                    data.get('aws_access_key_id'),
                    data.get('aws_secret_access_key'),
                    data.get('aws_region', 'us-east-1'),
                    data.get('business_name'),
                    data.get('auto_send_rewards_earned', 1),
                    data.get('auto_send_rewards_redeemed', 1),
                    store_id
                ))
        else:
            # Insert new settings
            if provider == 'email':
                cursor.execute("""
                    INSERT INTO sms_settings (
                        store_id, sms_provider, smtp_server, smtp_port,
                        smtp_user, smtp_password, smtp_use_tls, business_name,
                        auto_send_rewards_earned, auto_send_rewards_redeemed
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    store_id, provider,
                    data.get('smtp_server', 'smtp.gmail.com'),
                    data.get('smtp_port', 587),
                    data.get('smtp_user'),
                    data.get('smtp_password'),
                    data.get('smtp_use_tls', 1),
                    data.get('business_name'),
                    data.get('auto_send_rewards_earned', 1),
                    data.get('auto_send_rewards_redeemed', 1)
                ))
            elif provider == 'aws_sns':
                cursor.execute("""
                    INSERT INTO sms_settings (
                        store_id, sms_provider, aws_access_key_id,
                        aws_secret_access_key, aws_region, business_name,
                        auto_send_rewards_earned, auto_send_rewards_redeemed
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    store_id, provider,
                    data.get('aws_access_key_id'),
                    data.get('aws_secret_access_key'),
                    data.get('aws_region', 'us-east-1'),
                    data.get('business_name'),
                    data.get('auto_send_rewards_earned', 1),
                    data.get('auto_send_rewards_redeemed', 1)
                ))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/sms/migrate-to-aws/<int:store_id>', methods=['POST'])
def api_migrate_to_aws(store_id):
    """Migrate store from email to AWS SNS"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        result = sms_service.migrate_to_aws(
            store_id=store_id,
            aws_access_key=data.get('aws_access_key_id'),
            aws_secret=data.get('aws_secret_access_key'),
            region=data.get('aws_region', 'us-east-1')
        )
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/sms/send', methods=['POST'])
def api_sms_send():
    """Send SMS message"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        store_id = data.get('store_id', 1)
        phone_number = data.get('phone_number')
        message_text = data.get('message_text')
        customer_id = data.get('customer_id')
        carrier_preference = data.get('carrier_preference')  # att, verizon, tmobile, sprint (for email-to-SMS)
        
        if not phone_number or not message_text:
            return jsonify({'success': False, 'message': 'Phone number and message text required'}), 400
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        employee_id = None
        if session_token:
            session_result = verify_session(session_token)
            if session_result.get('valid'):
                employee_id = session_result.get('employee_id')
        
        result = sms_service.send_sms(
            store_id=store_id,
            phone_number=phone_number,
            message=message_text,
            customer_id=customer_id,
            employee_id=employee_id,
            carrier_preference=carrier_preference
        )
        # Debug: log result so terminal shows what happened (gateway, phone_cleaned, error)
        if result.get('success'):
            print(f"[SMS] Sent OK: phone_cleaned={result.get('phone_cleaned')} gateway={result.get('gateway_used')} carrier_tried={result.get('carrier_tried')}")
        else:
            print(f"[SMS] Send failed: {result.get('error')} phone_cleaned={result.get('phone_cleaned')}")
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/sms/rewards/earned', methods=['POST'])
def api_sms_rewards_earned():
    """Automatically send rewards earned message"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        store_id = data.get('store_id', 1)
        customer_id = data.get('customer_id')
        points_earned = data.get('points_earned')
        total_points = data.get('total_points')
        
        if not customer_id or points_earned is None or total_points is None:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        result = sms_service.send_rewards_earned_message(
            store_id=store_id,
            customer_id=customer_id,
            points_earned=points_earned,
            total_points=total_points
        )
        
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/sms/messages', methods=['GET'])
def api_sms_messages():
    """Get SMS messages"""
    try:
        conn, cursor = _pg_conn()
        
        store_id = request.args.get('store_id')
        customer_id = request.args.get('customer_id')
        phone_number = request.args.get('phone_number')
        status = request.args.get('status')
        limit = int(request.args.get('limit', 100))
        
        query = """
            SELECT 
                sm.*,
                c.customer_name,
                e.first_name || ' ' || e.last_name as employee_name,
                s.store_name
            FROM sms_messages sm
            LEFT JOIN customers c ON sm.customer_id = c.customer_id
            LEFT JOIN employees e ON sm.created_by = e.employee_id
            LEFT JOIN stores s ON sm.store_id = s.store_id
            WHERE 1=1
        """
        params = []
        
        if store_id:
            query += " AND sm.store_id = %s"
            params.append(store_id)
        
        if customer_id:
            query += " AND sm.customer_id = %s"
            params.append(customer_id)
        
        if phone_number:
            query += " AND sm.phone_number = %s"
            params.append(phone_number)
        
        if status:
            query += " AND sm.status = %s"
            params.append(status)
        
        query += " ORDER BY sm.created_at DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/sms/templates', methods=['GET', 'POST'])
def api_sms_templates():
    """Get or create SMS templates"""
    try:
        if request.method == 'GET':
            conn, cursor = _pg_conn()
            
            store_id = request.args.get('store_id')
            if store_id:
                cursor.execute("SELECT * FROM sms_templates WHERE store_id = %s AND is_active = 1 ORDER BY template_name", (store_id,))
            else:
                cursor.execute("SELECT * FROM sms_templates WHERE is_active = 1 ORDER BY template_name")
            
            rows = cursor.fetchall()
            conn.close()
            return jsonify([dict(row) for row in rows])
        
        # POST - Create template
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        
        conn, cursor = _pg_conn()
        cursor.execute("""
            INSERT INTO sms_templates (store_id, template_name, template_text, category, variables, created_by)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            data.get('store_id', 1),
            data.get('template_name'),
            data.get('template_text'),
            data.get('category', 'rewards'),
            json.dumps(data.get('variables', [])),
            employee_id
        ))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/sms/stores', methods=['GET'])
def api_sms_stores():
    """Get all stores. Returns empty list if stores table does not exist."""
    conn = None
    try:
        conn, cursor = _pg_conn()
        try:
            cursor.execute("SELECT * FROM stores WHERE is_active = 1 ORDER BY store_name")
            rows = cursor.fetchall()
            return jsonify([dict(row) for row in rows])
        except Exception as db_err:
            if 'does not exist' in str(db_err) or 'UndefinedTable' in type(db_err).__name__:
                return jsonify([])
            raise
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

# ============================================================================
# CASH REGISTER CONTROL API ENDPOINTS
# ============================================================================

@app.route('/api/register/open', methods=['POST'])
def api_open_register():
    """Open a cash register session"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found in session'}), 401
        
        from database import open_cash_register
        
        result = open_cash_register(
            employee_id=employee_id,
            register_id=data.get('register_id', 1),
            starting_cash=data.get('starting_cash', 0.0),
            notes=data.get('notes')
        )
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        print(f"Error opening register: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/register/close', methods=['POST'])
def api_close_register():
    """Close a cash register session"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found in session'}), 401
        
        session_id = data.get('session_id')
        if not session_id:
            return jsonify({'success': False, 'message': 'session_id is required'}), 400
        
        ending_cash = data.get('ending_cash')
        if ending_cash is None:
            return jsonify({'success': False, 'message': 'ending_cash is required'}), 400
        
        from database import close_cash_register
        
        result = close_cash_register(
            session_id=session_id,
            employee_id=employee_id,
            ending_cash=float(ending_cash),
            notes=data.get('notes')
        )
        
        if result.get('success'):
            # Post cash over/short to accounting when discrepancy
            if result.get('discrepancy') is not None and abs(float(result.get('discrepancy', 0))) >= 0.01:
                try:
                    from pos_accounting_bridge import journalize_register_close_to_accounting
                    jr = journalize_register_close_to_accounting(
                        session_id,
                        employee_id,
                        float(result.get('expected_cash', 0)),
                        float(result.get('ending_cash', 0)),
                        float(result['discrepancy'])
                    )
                    if not jr.get('success'):
                        print(f"Accounting register close (session {session_id}): {jr.get('message', 'unknown')}")
                except Exception as je:
                    print(f"Accounting register close error (session {session_id}): {je}")
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        print(f"Error closing register: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/register/transaction', methods=['POST'])
def api_add_cash_transaction():
    """Add a cash transaction (cash in/out)"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found in session'}), 401
        
        from database import add_cash_transaction
        
        result = add_cash_transaction(
            session_id=data.get('session_id'),
            employee_id=employee_id,
            transaction_type=data.get('transaction_type'),
            amount=float(data.get('amount', 0)),
            reason=data.get('reason'),
            notes=data.get('notes')
        )
        
        if result.get('success'):
            # Post cash in/out to accounting
            try:
                from pos_accounting_bridge import journalize_cash_transaction_to_accounting
                jr = journalize_cash_transaction_to_accounting(
                    data.get('session_id'),
                    employee_id,
                    data.get('transaction_type', ''),
                    float(data.get('amount', 0)),
                    data.get('reason'),
                    result.get('transaction_id')
                )
                if not jr.get('success'):
                    print(f"Accounting cash transaction: {jr.get('message', 'unknown')}")
            except Exception as je:
                print(f"Accounting cash transaction error: {je}")
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        print(f"Error adding cash transaction: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/register/session', methods=['GET'])
def api_get_register_session():
    """Get register session(s)"""
    try:
        # Verify session (support Bearer for POS)
        session_token = (
            request.headers.get('Authorization', '').replace('Bearer ', '').strip() or
            request.headers.get('X-Session-Token') or
            request.args.get('session_token')
        )
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        from database import get_register_session
        
        session_id = request.args.get('session_id')
        register_id = request.args.get('register_id')
        status = request.args.get('status')
        
        if session_id:
            result = get_register_session(session_id=int(session_id))
        else:
            result = get_register_session(
                register_id=int(register_id) if register_id else None,
                status=status
            )
        
        if result:
            return jsonify({'success': True, 'data': result}), 200
        else:
            return jsonify({'success': False, 'message': 'Session not found'}), 404
            
    except Exception as e:
        print(f"Error getting register session: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/register/summary', methods=['GET'])
def api_get_register_summary():
    """Get detailed register session summary"""
    try:
        # Verify session
        session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        session_id = request.args.get('session_id')
        if not session_id:
            return jsonify({'success': False, 'message': 'session_id is required'}), 400
        
        from database import get_register_summary
        
        result = get_register_summary(int(session_id))
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 404
            
    except Exception as e:
        print(f"Error getting register summary: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/register/reconcile', methods=['POST'])
def api_reconcile_register():
    """Reconcile a closed register session (manager approval)"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        
        # Verify session
        session_token = data.get('session_token') or request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found in session'}), 401
        
        session_id = data.get('session_id')
        if not session_id:
            return jsonify({'success': False, 'message': 'session_id is required'}), 400
        
        from database import reconcile_register_session
        
        result = reconcile_register_session(
            session_id=session_id,
            employee_id=employee_id,
            notes=data.get('notes')
        )
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        print(f"Error reconciling register: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/register/events', methods=['GET'])
def api_get_register_events():
    """Get all register events (open, close, drop, take out)"""
    try:
        # Verify session
        session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        from database import get_register_events
        
        register_id = request.args.get('register_id')
        limit = request.args.get('limit', 100)
        
        result = get_register_events(
            register_id=int(register_id) if register_id else None,
            limit=int(limit) if limit else 100
        )
        
        return jsonify({'success': True, 'data': result}), 200
            
    except Exception as e:
        print(f"Error getting register events: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# REGISTER CASH SETTINGS AND DAILY COUNTS API ENDPOINTS
# ============================================================================

@app.route('/api/register/cash-settings', methods=['GET', 'POST'])
def api_register_cash_settings():
    """Get or save register cash settings"""
    try:
        # Verify session
        session_token = request.headers.get('X-Session-Token') or request.args.get('session_token') or (request.json and request.json.get('session_token'))
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found in session'}), 401
        
        from database import get_register_cash_settings, save_register_cash_settings
        
        if request.method == 'GET':
            register_id = request.args.get('register_id')
            if register_id:
                result = get_register_cash_settings(int(register_id))
            else:
                result = get_register_cash_settings()
            
            if result is not None:
                return jsonify({'success': True, 'data': result}), 200
            else:
                return jsonify({'success': True, 'data': []}), 200
        else:
            # POST - save settings
            if not request.json:
                return jsonify({'success': False, 'message': 'Invalid request data'}), 400
            
            data = request.json
            register_id = data.get('register_id', 1)
            cash_mode = data.get('cash_mode', 'total')
            total_amount = data.get('total_amount')
            denominations = data.get('denominations')
            
            result = save_register_cash_settings(
                register_id=register_id,
                cash_mode=cash_mode,
                total_amount=total_amount,
                denominations=denominations,
                employee_id=employee_id
            )
            
            if result.get('success'):
                return jsonify(result), 200
            else:
                return jsonify(result), 400
                
    except Exception as e:
        print(f"Error with register cash settings: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/register/daily-count', methods=['GET', 'POST'])
def api_daily_cash_count():
    """Get or save daily cash counts"""
    try:
        # Verify session
        session_token = request.headers.get('X-Session-Token') or request.args.get('session_token') or (request.json and request.json.get('session_token'))
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found in session'}), 401
        
        from database import get_daily_cash_counts, save_daily_cash_count
        
        if request.method == 'GET':
            register_id = request.args.get('register_id')
            count_date = request.args.get('count_date')
            count_type = request.args.get('count_type')
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            
            result = get_daily_cash_counts(
                register_id=int(register_id) if register_id else None,
                count_date=count_date,
                count_type=count_type,
                start_date=start_date,
                end_date=end_date
            )
            
            return jsonify({'success': True, 'data': result}), 200
        else:
            # POST - save count
            if not request.json:
                return jsonify({'success': False, 'message': 'Invalid request data'}), 400
            
            data = request.json
            register_id = data.get('register_id', 1)
            count_date = data.get('count_date')
            count_type = data.get('count_type', 'drop')
            total_amount = data.get('total_amount', 0.0)
            denominations = data.get('denominations')
            notes = data.get('notes')
            
            if not count_date:
                # Use today's date if not provided
                from datetime import datetime
                count_date = datetime.now().strftime('%Y-%m-%d')
            
            result = save_daily_cash_count(
                register_id=register_id,
                count_date=count_date,
                count_type=count_type,
                total_amount=float(total_amount),
                employee_id=employee_id,
                denominations=denominations,
                notes=notes
            )
            
            if result.get('success'):
                # Post cash drop to accounting when count_type is drop and amount > 0
                if count_type == 'drop' and float(total_amount or 0) > 0 and result.get('count_id'):
                    try:
                        from pos_accounting_bridge import journalize_cash_drop_to_accounting
                        jr = journalize_cash_drop_to_accounting(
                            int(result['count_id']),
                            float(total_amount),
                            employee_id,
                            reason=notes
                        )
                        if not jr.get('success') and jr.get('message'):
                            print(f"Accounting journalize_cash_drop error: {jr.get('message')}")
                    except Exception as je:
                        print(f"Accounting journalize_cash_drop error: {je}")
                return jsonify(result), 200
            else:
                return jsonify(result), 400
                
    except Exception as e:
        print(f"Error with daily cash count: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# QUICKBOOKS-STYLE ACCOUNTING API (/api/v1/* and /api/accounting/*)
# ============================================================================

if _ACCOUNTING_BACKEND_AVAILABLE:
    # ---------- /api/v1/accounts ----------
    @app.route('/api/v1/accounts', methods=['GET'])
    def api_v1_accounts_list():
        return account_controller.get_all_accounts()

    @app.route('/api/v1/accounts', methods=['POST'])
    def api_v1_accounts_create():
        return account_controller.create_account()

    @app.route('/api/v1/accounts/tree', methods=['GET'])
    def api_v1_accounts_tree():
        return account_controller.get_account_tree()

    @app.route('/api/v1/accounts/<int:account_id>', methods=['GET'])
    def api_v1_accounts_get(account_id):
        return account_controller.get_account_by_id(account_id)

    @app.route('/api/v1/accounts/<int:account_id>', methods=['PUT'])
    def api_v1_accounts_update(account_id):
        return account_controller.update_account(account_id)

    @app.route('/api/v1/accounts/<int:account_id>', methods=['DELETE'])
    def api_v1_accounts_delete(account_id):
        return account_controller.delete_account(account_id)

    @app.route('/api/v1/accounts/<int:account_id>/children', methods=['GET'])
    def api_v1_accounts_children(account_id):
        return account_controller.get_account_children(account_id)

    @app.route('/api/v1/accounts/<int:account_id>/balance', methods=['GET'])
    def api_v1_accounts_balance(account_id):
        return account_controller.get_account_balance(account_id)

    @app.route('/api/v1/accounts/<int:account_id>/toggle-status', methods=['PATCH'])
    def api_v1_accounts_toggle(account_id):
        return account_controller.toggle_account_status(account_id)

    # ---------- /api/v1/transactions ----------
    @app.route('/api/v1/transactions', methods=['GET'])
    def api_v1_transactions_list():
        return transaction_controller.get_all_transactions()

    @app.route('/api/v1/transactions', methods=['POST'])
    def api_v1_transactions_create():
        return transaction_controller.create_transaction()

    @app.route('/api/v1/transactions/general-ledger', methods=['GET'])
    def api_v1_transactions_gl():
        return transaction_controller.get_general_ledger()

    @app.route('/api/v1/transactions/account-ledger/<int:account_id>', methods=['GET'])
    def api_v1_transactions_account_ledger(account_id):
        return transaction_controller.get_account_ledger(account_id)

    @app.route('/api/v1/transactions/<int:transaction_id>', methods=['GET'])
    def api_v1_transactions_get(transaction_id):
        return transaction_controller.get_transaction_by_id(transaction_id)

    @app.route('/api/v1/transactions/<int:transaction_id>', methods=['PUT'])
    def api_v1_transactions_update(transaction_id):
        return transaction_controller.update_transaction(transaction_id)

    @app.route('/api/v1/transactions/<int:transaction_id>', methods=['DELETE'])
    def api_v1_transactions_delete(transaction_id):
        return transaction_controller.delete_transaction(transaction_id)

    @app.route('/api/v1/transactions/<int:transaction_id>/post', methods=['POST'])
    def api_v1_transactions_post(transaction_id):
        return transaction_controller.post_transaction(transaction_id)

    @app.route('/api/v1/transactions/<int:transaction_id>/unpost', methods=['POST'])
    def api_v1_transactions_unpost(transaction_id):
        return transaction_controller.unpost_transaction(transaction_id)

    @app.route('/api/v1/transactions/<int:transaction_id>/void', methods=['POST'])
    def api_v1_transactions_void(transaction_id):
        return transaction_controller.void_transaction(transaction_id)

    # ---------- /api/v1/customers (accounting customers for invoices/payments) ----------
    @app.route('/api/v1/customers', methods=['GET'])
    def api_v1_customers_list():
        return customer_controller.get_all()

    @app.route('/api/v1/customers', methods=['POST'])
    def api_v1_customers_create():
        return customer_controller.create()

    @app.route('/api/v1/customers/<int:customer_id>', methods=['GET'])
    def api_v1_customers_get(customer_id):
        return customer_controller.get_by_id(customer_id)

    @app.route('/api/v1/customers/<int:customer_id>', methods=['PUT'])
    def api_v1_customers_update(customer_id):
        return customer_controller.update(customer_id)

    @app.route('/api/v1/customers/<int:customer_id>', methods=['DELETE'])
    def api_v1_customers_delete(customer_id):
        return customer_controller.delete(customer_id)

    # ---------- /api/v1/vendors ----------
    @app.route('/api/v1/vendors', methods=['GET'])
    def api_v1_vendors_list():
        return vendor_controller.get_all()

    @app.route('/api/v1/vendors', methods=['POST'])
    def api_v1_vendors_create():
        return vendor_controller.create()

    @app.route('/api/v1/vendors/search', methods=['GET'])
    def api_v1_vendors_search():
        return vendor_controller.search()

    @app.route('/api/v1/vendors/<int:vendor_id>', methods=['GET'])
    def api_v1_vendors_get(vendor_id):
        return vendor_controller.get_by_id(vendor_id)

    @app.route('/api/v1/vendors/<int:vendor_id>', methods=['PUT'])
    def api_v1_vendors_update(vendor_id):
        return vendor_controller.update(vendor_id)

    @app.route('/api/v1/vendors/<int:vendor_id>', methods=['DELETE'])
    def api_v1_vendors_delete(vendor_id):
        return vendor_controller.delete(vendor_id)

    @app.route('/api/v1/vendors/<int:vendor_id>/toggle-status', methods=['PATCH'])
    def api_v1_vendors_toggle(vendor_id):
        return vendor_controller.toggle_status(vendor_id)

    @app.route('/api/v1/vendors/<int:vendor_id>/balance', methods=['GET'])
    def api_v1_vendors_balance(vendor_id):
        return vendor_controller.get_balance(vendor_id)

    @app.route('/api/v1/vendors/<int:vendor_id>/bills', methods=['GET'])
    def api_v1_vendors_bills(vendor_id):
        return vendor_controller.get_bills(vendor_id)

    @app.route('/api/v1/vendors/<int:vendor_id>/statement', methods=['GET'])
    def api_v1_vendors_statement(vendor_id):
        return vendor_controller.get_statement(vendor_id)

    @app.route('/api/v1/vendors/1099', methods=['GET'])
    def api_v1_vendors_1099():
        return vendor_controller.get_1099_vendors()

    # ---------- /api/v1/bills ----------
    @app.route('/api/v1/bills', methods=['GET'])
    def api_v1_bills_list():
        return bill_controller.get_all()

    @app.route('/api/v1/bills', methods=['POST'])
    def api_v1_bills_create():
        return bill_controller.create()

    @app.route('/api/v1/bills/overdue', methods=['GET'])
    def api_v1_bills_overdue():
        return bill_controller.get_overdue()

    @app.route('/api/v1/bills/<int:bill_id>', methods=['GET'])
    def api_v1_bills_get(bill_id):
        return bill_controller.get_by_id(bill_id)

    @app.route('/api/v1/bills/<int:bill_id>', methods=['PUT'])
    def api_v1_bills_update(bill_id):
        return bill_controller.update(bill_id)

    @app.route('/api/v1/bills/<int:bill_id>', methods=['DELETE'])
    def api_v1_bills_delete(bill_id):
        return bill_controller.delete(bill_id)

    @app.route('/api/v1/bills/<int:bill_id>/void', methods=['POST'])
    def api_v1_bills_void(bill_id):
        return bill_controller.void_bill(bill_id)

    # ---------- /api/v1/invoices ----------
    @app.route('/api/v1/invoices', methods=['GET'])
    def api_v1_invoices_list():
        return invoice_controller.get_all()

    @app.route('/api/v1/invoices', methods=['POST'])
    def api_v1_invoices_create():
        return invoice_controller.create()

    @app.route('/api/v1/invoices/overdue', methods=['GET'])
    def api_v1_invoices_overdue():
        return invoice_controller.get_overdue()

    @app.route('/api/v1/invoices/<int:invoice_id>', methods=['GET'])
    def api_v1_invoices_get(invoice_id):
        return invoice_controller.get_by_id(invoice_id)

    @app.route('/api/v1/invoices/<int:invoice_id>', methods=['PUT'])
    def api_v1_invoices_update(invoice_id):
        return invoice_controller.update(invoice_id)

    @app.route('/api/v1/invoices/<int:invoice_id>', methods=['DELETE'])
    def api_v1_invoices_delete(invoice_id):
        return invoice_controller.delete(invoice_id)

    @app.route('/api/v1/invoices/<int:invoice_id>/mark-sent', methods=['POST'])
    def api_v1_invoices_mark_sent(invoice_id):
        return invoice_controller.mark_as_sent(invoice_id)

    @app.route('/api/v1/invoices/<int:invoice_id>/void', methods=['POST'])
    def api_v1_invoices_void(invoice_id):
        return invoice_controller.void_invoice(invoice_id)

    # ---------- /api/v1/payments (customer payments / receive payment) ----------
    @app.route('/api/v1/payments', methods=['GET'])
    def api_v1_payments_list():
        return payment_controller.get_all()

    @app.route('/api/v1/payments', methods=['POST'])
    def api_v1_payments_create():
        return payment_controller.create()

    @app.route('/api/v1/payments/<int:payment_id>', methods=['GET'])
    def api_v1_payments_get(payment_id):
        return payment_controller.get_by_id(payment_id)

    @app.route('/api/v1/payments/<int:payment_id>', methods=['PUT'])
    def api_v1_payments_update(payment_id):
        return payment_controller.update(payment_id)

    @app.route('/api/v1/payments/<int:payment_id>', methods=['DELETE'])
    def api_v1_payments_delete(payment_id):
        return payment_controller.delete(payment_id)

    @app.route('/api/v1/payments/<int:payment_id>/void', methods=['POST'])
    def api_v1_payments_void(payment_id):
        return payment_controller.void_payment(payment_id)

    @app.route('/api/v1/customers/<int:customer_id>/outstanding-invoices', methods=['GET'])
    def api_v1_customers_outstanding_invoices(customer_id):
        return payment_controller.get_customer_outstanding_invoices(customer_id)

    @app.route('/api/v1/payments/<int:payment_id>/receipt', methods=['GET'])
    def api_v1_payments_receipt(payment_id):
        return payment_controller.get_payment_receipt(payment_id)

    # ---------- /api/v1/bill-payments ----------
    @app.route('/api/v1/bill-payments', methods=['GET'])
    def api_v1_bill_payments_list():
        return bill_payment_controller.get_all()

    @app.route('/api/v1/bill-payments', methods=['POST'])
    def api_v1_bill_payments_create():
        return bill_payment_controller.create()

    @app.route('/api/v1/bill-payments/<int:payment_id>', methods=['GET'])
    def api_v1_bill_payments_get(payment_id):
        return bill_payment_controller.get_by_id(payment_id)

    @app.route('/api/v1/bill-payments/<int:payment_id>', methods=['PUT'])
    def api_v1_bill_payments_update(payment_id):
        return bill_payment_controller.update(payment_id)

    @app.route('/api/v1/bill-payments/<int:payment_id>', methods=['DELETE'])
    def api_v1_bill_payments_delete(payment_id):
        return bill_payment_controller.delete(payment_id)

    @app.route('/api/v1/bill-payments/<int:payment_id>/void', methods=['POST'])
    def api_v1_bill_payments_void(payment_id):
        return bill_payment_controller.void_payment(payment_id)

    @app.route('/api/v1/vendors/<int:vendor_id>/outstanding-bills', methods=['GET'])
    def api_v1_vendors_outstanding_bills(vendor_id):
        return bill_payment_controller.get_vendor_outstanding_bills(vendor_id)

    @app.route('/api/v1/bill-payments/<int:payment_id>/check-data', methods=['GET'])
    def api_v1_bill_payments_check_data(payment_id):
        return bill_payment_controller.get_payment_check_data(payment_id)

    # ---------- /api/v1/reports (P&L, Balance Sheet, Cash Flow - same data as /api/accounting, used by reportService) ----------
    @app.route('/api/v1/reports/profit-loss', methods=['GET'])
    def api_v1_reports_profit_loss():
        return report_controller.get_profit_loss()

    @app.route('/api/v1/reports/profit-loss/comparative', methods=['GET'])
    def api_v1_reports_profit_loss_comparative():
        return report_controller.get_comparative_profit_loss()

    @app.route('/api/v1/reports/balance-sheet', methods=['GET'])
    def api_v1_reports_balance_sheet():
        return report_controller.get_balance_sheet()

    @app.route('/api/v1/reports/balance-sheet/comparative', methods=['GET'])
    def api_v1_reports_balance_sheet_comparative():
        return report_controller.get_comparative_balance_sheet()

    @app.route('/api/v1/reports/cash-flow', methods=['GET'])
    def api_v1_reports_cash_flow():
        return report_controller.get_cash_flow()

    @app.route('/api/v1/reports/cash-flow/comparative', methods=['GET'])
    def api_v1_reports_cash_flow_comparative():
        return report_controller.get_comparative_cash_flow()

    # ---------- /api/accounting reports (trial-balance, P&L, balance-sheet) ----------
    @app.route('/api/accounting/trial-balance', methods=['GET'])
    def api_accounting_trial_balance():
        as_of = request.args.get('as_of_date')
        if not as_of:
            as_of = date.today().isoformat()
        try:
            d = datetime.fromisoformat(as_of.split('T')[0]).date()
        except Exception:
            return jsonify({'success': False, 'message': 'Invalid as_of_date. Use YYYY-MM-DD'}), 400
        conn, cur = _pg_conn()
        cur.execute("SELECT * FROM accounting.get_trial_balance(%s)", (d,))
        rows = cur.fetchall()
        data = [dict(row) for row in rows]
        conn.close()
        total_d = sum(float(row.get('total_debits') or 0) for row in data)
        total_c = sum(float(row.get('total_credits') or 0) for row in data)
        return jsonify({'success': True, 'data': {'accounts': data, 'total_debits': total_d, 'total_credits': total_c, 'date': as_of}}), 200

    @app.route('/api/accounting/profit-loss', methods=['GET'])
    def api_accounting_profit_loss():
        return report_controller.get_profit_loss()

    @app.route('/api/accounting/profit-loss/comparative', methods=['GET'])
    def api_accounting_profit_loss_comparative():
        return report_controller.get_comparative_profit_loss()

    @app.route('/api/accounting/balance-sheet', methods=['GET'])
    def api_accounting_balance_sheet():
        return report_controller.get_balance_sheet()

    @app.route('/api/accounting/balance-sheet/comparative', methods=['GET'])
    def api_accounting_balance_sheet_comparative():
        return report_controller.get_comparative_balance_sheet()

    @app.route('/api/accounting/cash-flow', methods=['GET'])
    def api_accounting_cash_flow():
        return report_controller.get_cash_flow()

    @app.route('/api/accounting/cash-flow/comparative', methods=['GET'])
    def api_accounting_cash_flow_comparative():
        return report_controller.get_comparative_cash_flow()

    @app.route('/api/accounting/aging', methods=['GET'])
    def api_accounting_aging():
        as_of = request.args.get('as_of_date')
        if not as_of:
            as_of = date.today().isoformat()
        try:
            d = datetime.fromisoformat(as_of.split('T')[0]).date()
        except Exception:
            return jsonify({'success': False, 'message': 'Invalid as_of_date. Use YYYY-MM-DD'}), 400
        conn, cur = _pg_conn()
        try:
            cur.execute("SELECT * FROM accounting.get_aging_report(%s)", (d,))
            rows = cur.fetchall()
            data = [dict(row) for row in rows]
        except Exception:
            data = []
        finally:
            conn.close()
        return jsonify({'success': True, 'data': data}), 200

    @app.route('/api/accounting/invoices', methods=['GET'])
    def api_accounting_invoices():
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        conn, cur = _pg_conn()
        try:
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'orders'
            """)
            cols = [r[0] for r in cur.fetchall()]
            has_customer = 'customer_id' in cols
            q = """
                SELECT o.order_id AS id, o.order_number AS invoice_number,
                       o.order_date::text AS invoice_date, o.total AS total_amount,
                       o.total AS balance_due, o.order_status AS status
            """
            if has_customer:
                q = """
                SELECT o.order_id AS id, o.order_number AS invoice_number,
                       o.order_date::text AS invoice_date, o.total AS total_amount,
                       o.total AS balance_due, o.order_status AS status,
                       c.customer_name AS customer_name
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                WHERE 1=1
                """
            else:
                q = """
                SELECT o.order_id AS id, o.order_number AS invoice_number,
                       o.order_date::text AS invoice_date, o.total AS total_amount,
                       o.total AS balance_due, o.order_status AS status,
                       NULL AS customer_name
                FROM orders o
                WHERE 1=1
                """
            params = []
            if start_date:
                q += " AND o.order_date::date >= %s"
                params.append(start_date)
            if end_date:
                q += " AND o.order_date::date <= %s"
                params.append(end_date)
            q += " ORDER BY o.order_date DESC LIMIT 500"
            cur.execute(q, params)
            rows = cur.fetchall()
            data = [dict(zip([c[0] for c in cur.description], r)) for r in rows] if cur.description else []
        except Exception as e:
            data = []
            print(f"Accounting invoices error: {e}")
        finally:
            conn.close()
        return jsonify({'success': True, 'data': data}), 200

    @app.route('/api/accounting/bills', methods=['GET'])
    def api_accounting_bills():
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        conn, cur = _pg_conn()
        try:
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'approved_shipments'")
            if cur.fetchone():
                q = """
                    SELECT a.shipment_id AS id, ('BILL-' || a.shipment_id) AS bill_number,
                           a.received_date::text AS bill_date, a.total_cost AS total_amount,
                           a.total_cost AS balance_due, 'open' AS status,
                           v.vendor_name
                    FROM approved_shipments a
                    LEFT JOIN vendors v ON a.vendor_id = v.vendor_id
                    WHERE a.total_cost IS NOT NULL AND a.total_cost > 0
                """
                params = []
                if start_date:
                    q += " AND a.received_date::date >= %s"
                    params.append(start_date)
                if end_date:
                    q += " AND a.received_date::date <= %s"
                    params.append(end_date)
                q += " ORDER BY a.received_date DESC LIMIT 500"
                cur.execute(q, params)
            else:
                q2 = """
                    SELECT s.shipment_id AS id, ('BILL-' || s.shipment_id) AS bill_number,
                           s.shipment_date::text AS bill_date,
                           COALESCE(SUM(si.quantity_received * si.unit_cost), 0) AS total_amount,
                           COALESCE(SUM(si.quantity_received * si.unit_cost), 0) AS balance_due,
                           'open' AS status, v.vendor_name
                    FROM shipments s
                    LEFT JOIN shipment_items si ON s.shipment_id = si.shipment_id
                    LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
                    WHERE 1=1
                """
                params2 = []
                if start_date:
                    q2 += " AND s.shipment_date::date >= %s"
                    params2.append(start_date)
                if end_date:
                    q2 += " AND s.shipment_date::date <= %s"
                    params2.append(end_date)
                q2 += " GROUP BY s.shipment_id, s.shipment_date, v.vendor_name ORDER BY s.shipment_date DESC LIMIT 500"
                cur.execute(q2, params2)
            rows = cur.fetchall()
            data = [dict(zip([c[0] for c in cur.description], r)) for r in rows] if cur.description else []
        except Exception as e:
            data = []
            print(f"Accounting bills error: {e}")
        finally:
            conn.close()
        return jsonify({'success': True, 'data': data}), 200

    @app.route('/api/accounting/customers', methods=['GET'])
    def api_accounting_customers():
        conn, cur = _pg_conn()
        try:
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers'")
            if cur.fetchone():
                cur.execute("""
                    SELECT customer_id AS id, customer_id AS customer_number, customer_name AS name,
                           customer_name AS display_name, email, phone, COALESCE(address, '') AS address,
                           0 AS account_balance
                    FROM customers ORDER BY customer_name LIMIT 1000
                """)
                rows = cur.fetchall()
                data = [dict(zip([c[0] for c in cur.description], r)) for r in rows] if cur.description else []
            else:
                data = []
        except Exception as e:
            data = []
            print(f"Accounting customers error: {e}")
        finally:
            conn.close()
        return jsonify({'success': True, 'data': data}), 200

    @app.route('/api/accounting/vendors', methods=['GET'])
    def api_accounting_vendors():
        try:
            vendors = list_vendors()
            data = [{'id': v.get('vendor_id'), 'vendor_number': v.get('vendor_id'), 'vendor_name': v.get('vendor_name'),
                     'contact_person': v.get('contact_person'), 'email': v.get('email'), 'phone': v.get('phone'),
                     'address': v.get('address') or '', 'account_balance': 0} for v in (vendors or [])]
        except Exception as e:
            data = []
            print(f"Accounting vendors error: {e}")
        return jsonify({'success': True, 'data': data}), 200

@app.route('/api/accounting/settings', methods=['GET', 'PATCH'])
def api_accounting_settings():
    """Get or update store accounting settings (sales tax %, transaction fee rates)."""
    try:
        session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found'}), 401
        employee_role = get_employee_role(employee_id)
        if employee_role not in ['manager', 'admin']:
            return jsonify({'success': False, 'message': 'Manager or Admin required'}), 403

        if request.method == 'GET':
            settings = get_establishment_settings(None)
            return jsonify({'success': True, 'data': settings}), 200

        # PATCH
        data = request.get_json() or {}
        updates = {}
        if 'default_sales_tax_pct' in data:
            updates['default_sales_tax_pct'] = float(data['default_sales_tax_pct'])
        if 'transaction_fee_rates' in data:
            updates['transaction_fee_rates'] = dict(data['transaction_fee_rates'])
        if not updates:
            return jsonify({'success': False, 'message': 'No settings to update'}), 400
        ok = update_establishment_settings(None, updates)
        if not ok:
            return jsonify({'success': False, 'message': 'Failed to update settings'}), 500
        settings = get_establishment_settings(None)
        return jsonify({'success': True, 'data': settings}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/accounting/labor-summary', methods=['GET'])
def api_accounting_labor_summary():
    """Hours worked and labor cost from time_clock + employees (hourly_rate)."""
    try:
        session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found'}), 401
        employee_role = get_employee_role(employee_id)
        if employee_role not in ['manager', 'admin']:
            return jsonify({'success': False, 'message': 'Manager or Admin required'}), 403
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        if not start_date or not end_date:
            return jsonify({'success': False, 'message': 'start_date and end_date required'}), 400
        result = get_labor_summary(start_date, end_date, None)
        return jsonify({'success': True, 'data': result}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/accounting/dashboard', methods=['GET'])
def api_accounting_dashboard():
    """Get accounting dashboard data"""
    try:
        # Verify session and permissions
        session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        if not session_token:
            return jsonify({'success': False, 'message': 'Session token required'}), 401
        
        session_result = verify_session(session_token)
        if not session_result.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_result.get('employee_id')
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID not found in session'}), 401
        
        # Check permissions (Manager or Admin required)
        permission_manager = get_permission_manager()
        employee_role = get_employee_role(employee_id)
        if employee_role not in ['manager', 'admin']:
            return jsonify({'success': False, 'message': 'Manager or Admin access required'}), 403
        
        # Get date range
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            return jsonify({'success': False, 'message': 'start_date and end_date are required'}), 400
        
        conn = get_connection()
        cursor = conn.cursor()
        transaction_count = 0
        total_revenue = 0.0
        total_tax_collected = 0.0
        total_transaction_fees = 0.0
        try:
            cursor.execute("""
                SELECT COALESCE(COUNT(*), 0) as cnt,
                       COALESCE(SUM(total), 0) as total_revenue,
                       COALESCE(SUM(tax_amount), 0) as total_tax,
                       COALESCE(SUM(transaction_fee), 0) as total_fees
                FROM orders
                WHERE order_date >= %s AND order_date <= %s AND order_status != 'voided'
            """, (start_date, end_date))
            row = cursor.fetchone()
            transaction_count = int(row[0]) if row and row[0] else 0
            total_revenue = float(row[1]) if row and row[1] else 0.0
            total_tax_collected = float(row[2]) if row and row[2] else 0.0
            total_transaction_fees = float(row[3]) if row and row[3] else 0.0
        except Exception:
            pass

        # Returns (approved) in date range
        try:
            cursor.execute("""
                SELECT COALESCE(SUM(total_refund_amount), 0) as returns_total
                FROM pending_returns
                WHERE status = 'approved' AND approved_date >= %s AND approved_date <= %s
            """, (start_date, end_date))
            ret_row = cursor.fetchone()
            returns_total = float(ret_row[0]) if ret_row and ret_row[0] else 0.0
        except Exception:
            returns_total = 0.0

        # COGS for orders in range (order_items qty * inventory product_cost)
        try:
            cursor.execute("""
                SELECT COALESCE(SUM(oi.quantity * i.product_cost), 0) as cogs
                FROM order_items oi
                JOIN inventory i ON i.product_id = oi.product_id
                JOIN orders o ON o.order_id = oi.order_id
                WHERE o.order_date >= %s AND o.order_date <= %s AND o.order_status != 'voided'
            """, (start_date, end_date))
            cogs_row = cursor.fetchone()
            total_cogs = float(cogs_row[0]) if cogs_row and cogs_row[0] else 0.0
        except Exception:
            total_cogs = 0.0
        # Margin = revenue - cogs (product sale price vs cost)
        margin = total_revenue - total_cogs

        # Expenses (shipments) - table may not exist
        total_expenses = 0.0
        try:
            cursor.execute("""
                SELECT COALESCE(SUM(si.quantity_received * si.unit_cost), 0) as total_expenses
                FROM shipments s
                JOIN shipment_items si ON s.shipment_id = si.shipment_id
                WHERE s.received_date >= %s AND s.received_date <= %s
            """, (start_date, end_date))
            expenses_result = cursor.fetchone()
            total_expenses = float(expenses_result[0]) if expenses_result and expenses_result[0] else 0.0
        except Exception:
            pass

        # Payroll: prefer time_clock + hourly_rate labor summary
        labor = get_labor_summary(start_date, end_date, None)
        total_payroll = float(labor.get('total_labor_cost') or 0.0)
        try:
            cursor.execute("""
                SELECT COALESCE(SUM(amount), 0) as total_payroll
                FROM payroll
                WHERE pay_period_start >= %s AND pay_period_end <= %s
            """, (start_date, end_date))
            payroll_result = cursor.fetchone()
            if payroll_result and payroll_result[0]:
                total_payroll = float(payroll_result[0])
        except Exception:
            pass

        net_income = total_revenue - total_expenses - total_payroll - returns_total

        cash_balance = 0.0
        try:
            cursor.execute("""
                SELECT COALESCE(SUM(total), 0) as cash_balance
                FROM orders
                WHERE payment_method = 'cash' AND order_date <= %s AND order_status != 'voided'
            """, (end_date,))
            cash_result = cursor.fetchone()
            cash_balance = float(cash_result[0]) if cash_result and cash_result[0] else 0.0
        except Exception:
            pass

        conn.close()

        return jsonify({
            'total_revenue': total_revenue,
            'total_expenses': total_expenses,
            'total_payroll': total_payroll,
            'net_income': net_income,
            'cash_balance': cash_balance,
            'total_tax_collected': total_tax_collected,
            'outstanding_taxes': total_tax_collected,
            'pos_summary': {
                'transaction_count': transaction_count,
                'revenue': total_revenue,
                'tax_collected': total_tax_collected,
                'transaction_fees': total_transaction_fees,
                'returns_total': returns_total,
                'cogs': total_cogs,
                'margin': margin
            },
            'labor_summary': labor
        }), 200
        
    except Exception as e:
        print(f"Error in accounting dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Auto-sync database on startup (check if updates needed)
if __name__ == '__main__':
    # Check if database needs syncing (only on startup, not on import)
    try:
        if os.path.exists('auto_sync_database.py'):
            import subprocess
            result = subprocess.run(
                [sys.executable, 'auto_sync_database.py'],
                capture_output=True,
                timeout=10
            )
            # Only print if there were actual updates
            if 'updated' in result.stdout.decode('utf-8', errors='ignore').lower():
                print(result.stdout.decode('utf-8', errors='ignore'))
    except Exception as e:
        # Silently fail - don't block startup if sync fails
        pass
    print("Starting web viewer...")
    print("Open your browser to: http://localhost:5001")
    if SOCKETIO_AVAILABLE and socketio:
        print("Socket.IO enabled - real-time features available")
        # use_reloader=False avoids "write() before start_response" on Socket.IO WebSocket upgrade
        socketio.run(app, debug=True, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True, use_reloader=False)
    else:
        print("Socket.IO disabled - using standard Flask server")
        app.run(debug=True, host='0.0.0.0', port=5001)

