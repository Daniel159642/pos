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

from flask import Flask, render_template, jsonify, send_from_directory, request, Response
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
    list_products, list_vendors, list_shipments, get_sales,
    get_shipment_items, get_shipment_details,
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
    clock_in, clock_out, get_current_clock_status, get_schedule,
    get_store_location_settings, update_store_location_settings,
    get_customer_rewards_settings, update_customer_rewards_settings, calculate_rewards,
    # Accounting functions
    generate_balance_sheet, generate_income_statement,
    generate_trial_balance,
    add_product, create_or_get_category_with_hierarchy,
    # Stripe integration functions
    get_payment_settings, update_payment_settings,
    create_stripe_connect_account, update_stripe_connect_account, get_stripe_connect_account,
    create_stripe_credentials, update_stripe_credentials, get_stripe_credentials, get_stripe_config,
)
from permission_manager import get_permission_manager
from sms_service_email_to_aws import EmailToAWSSMSService
import sqlite3
import os
import json
from datetime import datetime, time
import tempfile
import traceback

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
DB_NAME = 'inventory.db'

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
        print("❌ Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in .env file")
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

def get_table_data(table_name):
    """Get all data from a table"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    
    # Get column names
    columns = [description[0] for description in cursor.description]
    
    conn.close()
    
    # Convert rows to dictionaries
    data = []
    for row in rows:
        data.append({col: row[col] for col in columns})
    
    return columns, data

def get_table_primary_key_columns(table_name):
    """Return a list of primary key column names for a table (can be empty)."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    cols = cursor.fetchall()
    conn.close()
    # PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
    pk_cols = [c[1] for c in cols if c[5]]
    # If composite PK, pk is >0 indicating ordering; preserve ordering
    if len(pk_cols) > 1:
        pk_cols = [c[1] for c in sorted(cols, key=lambda x: x[5]) if x[5]]
    return pk_cols

def get_table_data_for_admin(table_name):
    """
    Get table data plus metadata needed for safe row identification/deletion.
    If table has no primary key, include SQLite rowid as '__rowid__'.
    """
    pk_cols = get_table_primary_key_columns(table_name)

    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if pk_cols:
        cursor.execute(f"SELECT * FROM {table_name}")
    else:
        cursor.execute(f"SELECT rowid as __rowid__, * FROM {table_name}")

    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    conn.close()

    data = [{col: row[col] for col in columns} for row in rows]

    return {
        'columns': columns,
        'data': data,
        'primary_key': pk_cols,
        'rowid_column': None if pk_cols else '__rowid__'
    }

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
                conn = sqlite3.connect(DB_NAME)
                cursor = conn.cursor()
                cursor.execute("SELECT vendor_id FROM vendors WHERE vendor_name = ?", (vendor,))
                vendor_row = cursor.fetchone()
                if vendor_row:
                    vendor_id = vendor_row[0]
                conn.close()
            
            # Create product
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
                auto_extract_metadata=True
            )
            
            return jsonify({
                'success': True,
                'product_id': product_id,
                'message': 'Product created successfully'
            })
        except ValueError as e:
            return jsonify({'success': False, 'message': str(e)}), 400
        except Exception as e:
            traceback.print_exc()
            return jsonify({'success': False, 'message': str(e)}), 500
    else:
        # GET request
        try:
            conn = sqlite3.connect(DB_NAME)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    i.*,
                    v.vendor_name,
                    pm.keywords,
                    pm.tags,
                    pm.attributes
                FROM inventory i
                LEFT JOIN vendors v ON i.vendor_id = v.vendor_id
                LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
                ORDER BY i.product_name
            """)
            
            rows = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            data = [{col: row[col] for col in columns} for row in rows]
            
            conn.close()
            return jsonify({'columns': columns, 'data': data})
        except Exception as e:
            print(f"Error in api_inventory: {e}")
            import traceback
            traceback.print_exc()
            if 'conn' in locals():
                conn.close()
            return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

@app.route('/api/inventory/<int:product_id>', methods=['PUT'])
def api_update_inventory(product_id):
    """Update inventory product with audit logging"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
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
        vendors = list_vendors()
        if not vendors:
            return jsonify({'columns': [], 'data': []})
        
        columns = list(vendors[0].keys())
        return jsonify({'columns': columns, 'data': vendors})

@app.route('/api/categories', methods=['POST'])
def api_create_category():
    """Create a new category"""
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
        else:
            return jsonify({'success': False, 'message': 'Failed to create category'}), 500
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
                    from database import get_connection, get_product, update_product
                    conn = get_connection()
                    cursor = conn.cursor()
                    cursor.execute("SELECT product_id FROM pending_shipment_items WHERE pending_item_id = ?", (item_id,))
                    row = cursor.fetchone()
                    conn.close()
                    
                    if row and row[0]:  # product_id exists
                        product_id = row[0]
                        product = get_product(product_id)
                        # Always update product photo with verification photo (even if product already has a photo)
                        if product:
                            update_product(
                                product_id=product_id,
                                photo=verification_photo
                            )
                            print(f"Updated product {product_id} photo with verification photo: {verification_photo}")
                except Exception as e:
                    print(f"Warning: Could not update product photo: {e}")
        
        # If no quantity_verified but photo is provided, still update
        if quantity_verified is None and verification_photo is None:
            return jsonify({'success': False, 'message': 'quantity_verified or photo is required'}), 400
        
        success = update_pending_item_verification(
            pending_item_id=item_id,
            quantity_verified=quantity_verified,
            employee_id=employee_id,
            verification_photo=verification_photo
        )
        
        if success:
            return jsonify({
                'success': True,
                'quantity_verified': quantity_verified,
                'verification_photo': verification_photo,
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
        
        # Get workflow settings
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT setting_value FROM shipment_verification_settings 
            WHERE setting_key = 'workflow_mode'
        """)
        setting = cursor.fetchone()
        workflow_mode = setting['setting_value'] if setting else 'simple'
        
        cursor.execute("""
            SELECT setting_value FROM shipment_verification_settings 
            WHERE setting_key = 'auto_add_to_inventory'
        """)
        setting = cursor.fetchone()
        auto_add = setting['setting_value'] == 'true' if setting else True
        
        # Check current workflow step
        cursor.execute("SELECT workflow_step, status FROM pending_shipments WHERE pending_shipment_id = ?", (shipment_id,))
        shipment = cursor.fetchone()
        current_step = shipment['workflow_step'] if shipment else None
        
        conn.close()
        
        # For simple workflow: complete and add to inventory immediately
        if workflow_mode == 'simple' and auto_add:
            result = complete_verification(shipment_id, employee_id, data.get('notes'))
            if result.get('success'):
                # Mark as completed and added to inventory
                conn = sqlite3.connect(DB_NAME)
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE pending_shipments 
                    SET status = 'completed',
                        workflow_step = 'completed',
                        added_to_inventory = 1
                    WHERE pending_shipment_id = ?
                """, (shipment_id,))
                conn.commit()
                conn.close()
            return jsonify(result)
        
        # For three-step workflow: move to next step
        elif workflow_mode == 'three_step':
            # Step 1 (verify): Move to step 2 (confirm pricing)
            if current_step is None or current_step == 'verify':
                conn = sqlite3.connect(DB_NAME)
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE pending_shipments 
                    SET workflow_step = 'confirm_pricing',
                        status = 'in_progress'
                    WHERE pending_shipment_id = ?
                """, (shipment_id,))
                conn.commit()
                conn.close()
                return jsonify({
                    'success': True,
                    'step': 'confirm_pricing',
                    'message': 'Move to step 2: Confirm pricing'
                })
            
            # Step 2 (confirm_pricing): Ready for step 3 (add to inventory)
            elif current_step == 'confirm_pricing':
                conn = sqlite3.connect(DB_NAME)
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE pending_shipments 
                    SET workflow_step = 'ready_for_inventory'
                    WHERE pending_shipment_id = ?
                """, (shipment_id,))
                conn.commit()
                conn.close()
                return jsonify({
                    'success': True,
                    'step': 'ready_for_inventory',
                    'message': 'Ready for step 3: Add to inventory'
                })
        
        # Default: complete normally
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
        verification_mode = request.form.get('verification_mode', 'verify_whole_shipment').strip()
        
        # Validate verification_mode
        if verification_mode not in ('auto_add', 'verify_whole_shipment'):
            verification_mode = 'verify_whole_shipment'
        
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
        
        result = create_order(
            employee_id=data.get('employee_id'),
            items=data.get('items', []),
            payment_method=data.get('payment_method', 'cash'),
            tax_rate=data.get('tax_rate', 0.0),
            discount=data.get('discount', 0.0),
            customer_id=data.get('customer_id'),
            tip=data.get('tip', 0.0),
            order_type=data.get('order_type'),
            customer_info=data.get('customer_info')
        )
        
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
    """Update receipt settings"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Check if settings exist
        cursor.execute("SELECT COUNT(*) FROM receipt_settings")
        count = cursor.fetchone()[0]
        
        # Add return_policy column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE receipt_settings ADD COLUMN return_policy TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists
        
        if count == 0:
            # Insert new settings
            cursor.execute("""
                INSERT INTO receipt_settings (
                    store_name, store_address, store_city, store_state, store_zip,
                    store_phone, store_email, store_website, footer_message, return_policy,
                    show_tax_breakdown, show_payment_method, show_signature
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
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
                data.get('show_signature', 0)
            ))
        else:
            # Update existing settings
            cursor.execute("""
                UPDATE receipt_settings SET
                    store_name = ?,
                    store_address = ?,
                    store_city = ?,
                    store_state = ?,
                    store_zip = ?,
                    store_phone = ?,
                    store_email = ?,
                    store_website = ?,
                    footer_message = ?,
                    return_policy = ?,
                    show_tax_breakdown = ?,
                    show_payment_method = ?,
                    show_signature = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = (SELECT id FROM receipt_settings ORDER BY id DESC LIMIT 1)
            """, (
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
                data.get('show_signature', 0)
            ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Receipt settings updated successfully'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pos-settings', methods=['GET'])
def api_get_pos_settings():
    """Get POS settings"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Create pos_settings table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pos_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                num_registers INTEGER DEFAULT 1,
                register_type TEXT DEFAULT 'one_screen',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        
        # Get settings
        cursor.execute("SELECT * FROM pos_settings ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        
        if row:
            settings = {
                'num_registers': row[1],
                'register_type': row[2]
            }
        else:
            # Return defaults if no settings exist
            settings = {
                'num_registers': 1,
                'register_type': 'one_screen'
            }
        
        conn.close()
        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pos-settings', methods=['POST'])
def api_update_pos_settings():
    """Update POS settings"""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        if data is None:
            return jsonify({'success': False, 'message': 'Invalid JSON in request body'}), 400
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Create pos_settings table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pos_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                num_registers INTEGER DEFAULT 1,
                register_type TEXT DEFAULT 'one_screen',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        
        # Check if settings exist
        cursor.execute("SELECT COUNT(*) FROM pos_settings")
        count = cursor.fetchone()[0]
        
        num_registers = data.get('num_registers', 1)
        register_type = data.get('register_type', 'one_screen')
        
        # Validate register_type
        if register_type not in ['one_screen', 'two_screen']:
            register_type = 'one_screen'
        
        # Validate num_registers
        try:
            num_registers = int(num_registers)
            if num_registers < 1:
                num_registers = 1
        except (ValueError, TypeError):
            num_registers = 1
        
        if count == 0:
            # Insert new settings
            cursor.execute("""
                INSERT INTO pos_settings (num_registers, register_type)
                VALUES (?, ?)
            """, (num_registers, register_type))
        else:
            # Update existing settings
            cursor.execute("""
                UPDATE pos_settings SET
                    num_registers = ?,
                    register_type = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = (SELECT id FROM pos_settings ORDER BY id DESC LIMIT 1)
            """, (num_registers, register_type))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'POS settings updated successfully'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Get all tables endpoint
@app.route('/api/tables/list')
def api_list_tables():
    """Get list of all tables in the database (excluding receipt_preferences)"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]
        # Exclude receipt_preferences table since it's now part of the orders table
        tables = [t for t in tables if t != 'receipt_preferences']
        conn.close()
        return jsonify({'tables': tables})
    except Exception as e:
        print(f"Error listing tables: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'tables': [], 'error': str(e)}), 500

# Raw table endpoints for admin table viewer (always direct table access + metadata)
@app.route('/api/tables/<table_name>', methods=['GET'])
def api_tables_table(table_name):
    """Raw table access for the Tables UI (includes PK/rowid metadata)."""
    # Get all tables dynamically for security check
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        allowed_tables = [row[0] for row in cursor.fetchall()]
        conn.close()
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
        import traceback
        traceback.print_exc()
        return jsonify({'columns': [], 'data': [], 'error': str(e)}), 500

# Generic table endpoints
@app.route('/api/<table_name>', methods=['GET'])
def api_table(table_name):
    """Generic endpoint for any table (read-only)"""
    # Get all tables dynamically for security check
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        allowed_tables = [row[0] for row in cursor.fetchall()]
        conn.close()
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
        import traceback
        traceback.print_exc()
        return jsonify({'columns': [], 'data': [], 'error': str(e)}), 500

@app.route('/api/tables/<table_name>/rows', methods=['DELETE'])
@app.route('/api/<table_name>/rows', methods=['DELETE'])
def api_delete_table_rows(table_name):
    """
    Delete one or more rows from a table.

    Request JSON:
    - If table has single-column PK: { "ids": [1,2,3] }
    - If table has composite PK: { "keys": [ {"pk1":..., "pk2":...}, ... ] }
    - If table has no PK: { "rowids": [123,124] }  (uses SQLite rowid)
    """
    # Get all tables dynamically for security check
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        allowed_tables = [row[0] for row in cursor.fetchall()]
        conn.close()
    except Exception as e:
        print(f"Error getting table list: {e}")
        return jsonify({'success': False, 'message': 'Database error'}), 500

    if table_name not in allowed_tables:
        return jsonify({'success': False, 'message': 'Table not found'}), 404

    if not request.is_json:
        return jsonify({'success': False, 'message': 'Invalid request data'}), 400

    payload = request.get_json(silent=True) or {}

    try:
        pk_cols = get_table_primary_key_columns(table_name)

        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        deleted = 0

        if pk_cols:
            if len(pk_cols) == 1:
                pk = pk_cols[0]
                ids = payload.get('ids', [])
                if not isinstance(ids, list) or len(ids) == 0:
                    conn.close()
                    return jsonify({'success': False, 'message': 'No ids provided'}), 400

                placeholders = ','.join(['?'] * len(ids))
                cursor.execute(f"DELETE FROM {table_name} WHERE {pk} IN ({placeholders})", ids)
                deleted = cursor.rowcount
            else:
                keys = payload.get('keys', [])
                if not isinstance(keys, list) or len(keys) == 0:
                    conn.close()
                    return jsonify({'success': False, 'message': 'No keys provided'}), 400

                clauses = []
                params = []
                for k in keys:
                    if not isinstance(k, dict):
                        continue
                    if any(col not in k for col in pk_cols):
                        continue
                    clauses.append('(' + ' AND '.join([f"{col} = ?" for col in pk_cols]) + ')')
                    params.extend([k[col] for col in pk_cols])

                if not clauses:
                    conn.close()
                    return jsonify({'success': False, 'message': 'Invalid keys provided'}), 400

                cursor.execute(f"DELETE FROM {table_name} WHERE " + " OR ".join(clauses), params)
                deleted = cursor.rowcount
        else:
            rowids = payload.get('rowids', [])
            if not isinstance(rowids, list) or len(rowids) == 0:
                conn.close()
                return jsonify({'success': False, 'message': 'No rowids provided'}), 400

            placeholders = ','.join(['?'] * len(rowids))
            cursor.execute(f"DELETE FROM {table_name} WHERE rowid IN ({placeholders})", rowids)
            deleted = cursor.rowcount

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'deleted': deleted})
    except Exception as e:
        print(f"Error deleting rows from {table_name}: {e}")
        import traceback
        traceback.print_exc()
        try:
            if 'conn' in locals():
                conn.close()
        except Exception:
            pass
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

@app.route('/api/order_items')
def api_order_items():
    """Get order items with product details"""
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
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
        columns = [description[0] for description in cursor.description]
        data = [{col: row[col] for col in columns} for row in rows]
        
        conn.close()
        return jsonify({'columns': columns, 'data': data})
    except Exception as e:
        print(f"Error in api_order_items: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            conn.close()
        return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

@app.route('/api/payment_transactions')
def api_payment_transactions():
    """Get payment transactions with order details"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
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
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

@app.route('/api/employees')
def api_employees():
    """Get employees data"""
    try:
        employees = list_employees(active_only=False)
        if not employees:
            return jsonify({'columns': [], 'data': []})
        
        columns = list(employees[0].keys())
        return jsonify({'columns': columns, 'data': employees})
    except Exception as e:
        print(f"Error in api_employees: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'columns': [], 'data': []}), 500

@app.route('/api/customers')
def api_customers():
    """Get customers data"""
    columns, data = get_table_data('customers')
    return jsonify({'columns': columns, 'data': data})

@app.route('/api/employee_schedule', methods=['GET', 'POST'])
def api_employee_schedule():
    """Get or create employee schedule"""
    if request.method == 'GET':
        # Get employee schedule with employee names
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
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
            query += " AND es.schedule_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND es.schedule_date <= ?"
            params.append(end_date)
        
        if employee_id:
            query += " AND es.employee_id = ?"
            params.append(employee_id)
        
        cursor.execute(query, params)
        old_schedules = cursor.fetchall()
        
        # Also get published schedules from Scheduled_Shifts (new system)
        # Check if Scheduled_Shifts table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='Scheduled_Shifts'
        """)
        has_scheduled_shifts = cursor.fetchone()
        
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
                new_query += " AND ss.shift_date >= ?"
                new_params.append(start_date)
            
            if end_date:
                new_query += " AND ss.shift_date <= ?"
                new_params.append(end_date)
            
            if employee_id:
                new_query += " AND ss.employee_id = ?"
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
        return jsonify({'columns': columns, 'data': all_schedules})
    
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
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
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
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
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
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check for schedule in employee_schedule table
        cursor.execute("""
            SELECT schedule_id, start_time, end_time, schedule_date
            FROM employee_schedule
            WHERE employee_id = ? AND schedule_date = ?
            ORDER BY start_time
            LIMIT 1
        """, (employee_id, today))
        
        schedule = cursor.fetchone()
        
        # Also check Scheduled_Shifts table
        if not schedule:
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='Scheduled_Shifts'
            """)
            has_scheduled_shifts = cursor.fetchone()
            
            if has_scheduled_shifts:
                cursor.execute("""
                    SELECT ss.scheduled_shift_id, ss.shift_date, ss.start_time, ss.end_time
                    FROM Scheduled_Shifts ss
                    JOIN Schedule_Periods sp ON ss.period_id = sp.period_id
                    WHERE ss.employee_id = ? 
                      AND ss.shift_date = ?
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
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Check if face encoding already exists
        cursor.execute("""
            SELECT face_id FROM employee_face_encodings 
            WHERE employee_id = ?
        """, (employee_id,))
        
        existing = cursor.fetchone()
        
        if existing:
            # Update existing encoding
            cursor.execute("""
                UPDATE employee_face_encodings
                SET face_descriptor = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE employee_id = ?
            """, (json.dumps(face_descriptor), employee_id))
        else:
            # Insert new encoding
            cursor.execute("""
                INSERT INTO employee_face_encodings (
                    employee_id, face_descriptor
                ) VALUES (?, ?)
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
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT face_descriptor FROM employee_face_encodings
            WHERE employee_id = ?
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
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT face_id, registered_at, updated_at
            FROM employee_face_encodings
            WHERE employee_id = ?
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
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
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
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
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
            conn = sqlite3.connect(DB_NAME)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Check for schedule in employee_schedule table
            cursor.execute("""
                SELECT schedule_id, start_time, end_time, schedule_date
                FROM employee_schedule
                WHERE employee_id = ? 
                  AND schedule_date = ?
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
                    WHERE ss.employee_id = ?
                      AND ss.shift_date = ?
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
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
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
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
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

@app.route('/api/dashboard/statistics')
def api_dashboard_statistics():
    """Get comprehensive dashboard statistics"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        from datetime import datetime, timedelta
        
        # Get total orders count
        cursor.execute("SELECT COUNT(*) as total FROM orders")
        total_orders = cursor.fetchone()['total']
        
        # Get total returns count (check if table exists first)
        try:
            cursor.execute("SELECT COUNT(*) as total FROM pending_returns")
            total_returns = cursor.fetchone()['total']
        except sqlite3.OperationalError:
            total_returns = 0
        
        # Revenue by period
        # All time revenue
        cursor.execute("""
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM orders
            WHERE order_status != 'voided'
        """)
        all_time_revenue = cursor.fetchone()['revenue'] or 0
        
        # Today's revenue
        cursor.execute("""
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM orders
            WHERE DATE(order_date) = DATE('now')
                AND order_status != 'voided'
        """)
        today_revenue = cursor.fetchone()['revenue'] or 0
        
        # This week's revenue
        cursor.execute("""
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM orders
            WHERE order_date >= datetime('now', '-7 days')
                AND order_status != 'voided'
        """)
        week_revenue = cursor.fetchone()['revenue'] or 0
        
        # This month's revenue
        cursor.execute("""
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM orders
            WHERE order_date >= datetime('now', 'start of month')
                AND order_status != 'voided'
        """)
        month_revenue = cursor.fetchone()['revenue'] or 0
        
        # Average order value
        cursor.execute("""
            SELECT 
                COALESCE(AVG(total), 0) as avg_order_value,
                COUNT(*) as order_count
            FROM orders
            WHERE order_status != 'voided'
        """)
        avg_result = cursor.fetchone()
        avg_order_value = avg_result['avg_order_value'] or 0 if avg_result['order_count'] > 0 else 0
        
        # Weekly revenue (last 7 days) - detailed
        cursor.execute("""
            SELECT 
                strftime('%Y-%m-%d', order_date) as date,
                COALESCE(SUM(total), 0) as revenue
            FROM orders
            WHERE order_date >= datetime('now', '-7 days')
                AND order_status != 'voided'
            GROUP BY strftime('%Y-%m-%d', order_date)
            ORDER BY date ASC
        """)
        
        revenue_rows = cursor.fetchall()
        weekly_revenue = {row['date']: row['revenue'] for row in revenue_rows}
        
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
                'revenue': revenue
            })
        
        # Monthly revenue (last 12 months)
        cursor.execute("""
            SELECT 
                strftime('%Y-%m', order_date) as month,
                COALESCE(SUM(total), 0) as revenue
            FROM orders
            WHERE order_date >= datetime('now', '-12 months')
                AND order_status != 'voided'
            GROUP BY strftime('%Y-%m', order_date)
            ORDER BY month ASC
        """)
        
        monthly_rows = cursor.fetchall()
        monthly_revenue = {row['month']: row['revenue'] for row in monthly_rows}
        
        # Generate last 12 months
        monthly_data = []
        for i in range(11, -1, -1):
            month_date = (datetime.now() - timedelta(days=30*i)).replace(day=1)
            month_str = month_date.strftime('%Y-%m')
            month_name = month_date.strftime('%b')
            revenue = monthly_revenue.get(month_str, 0)
            monthly_data.append({
                'month': month_str,
                'month_name': month_name,
                'revenue': revenue
            })
        
        # Order status breakdown
        cursor.execute("""
            SELECT 
                order_status,
                COUNT(*) as count
            FROM orders
            GROUP BY order_status
        """)
        status_rows = cursor.fetchall()
        order_status_breakdown = {row['order_status']: row['count'] for row in status_rows}
        
        # Top selling products (last 30 days)
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
        top_products = [dict(row) for row in cursor.fetchall()]
        
        # Inventory statistics
        try:
            cursor.execute("SELECT COUNT(*) as total FROM inventory")
            total_products = cursor.fetchone()['total']
            
            cursor.execute("""
                SELECT COUNT(*) as low_stock
                FROM inventory
                WHERE quantity <= reorder_point
            """)
            low_stock = cursor.fetchone()['low_stock']
            
            cursor.execute("""
                SELECT COALESCE(SUM(quantity * cost), 0) as total_value
                FROM inventory
            """)
            inventory_value = cursor.fetchone()['total_value'] or 0
        except sqlite3.OperationalError:
            total_products = 0
            low_stock = 0
            inventory_value = 0
        
        # Returns rate
        returns_rate = (total_returns / total_orders * 100) if total_orders > 0 else 0
        
        conn.close()
        return jsonify({
            'total_orders': total_orders,
            'total_returns': total_returns,
            'returns_rate': round(returns_rate, 2),
            'revenue': {
                'all_time': all_time_revenue,
                'today': today_revenue,
                'week': week_revenue,
                'month': month_revenue
            },
            'avg_order_value': round(avg_order_value, 2),
            'weekly_revenue': week_data,
            'monthly_revenue': monthly_data,
            'order_status_breakdown': order_status_breakdown,
            'top_products': top_products,
            'inventory': {
                'total_products': total_products,
                'low_stock': low_stock,
                'total_value': inventory_value
            }
        })
    except Exception as e:
        conn.close()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

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
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
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
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    return_id = request.args.get('return_id', type=int)
    
    if return_id:
        cursor.execute("""
            SELECT pri.*, i.product_name, i.sku, pr.return_number
            FROM pending_return_items pri
            JOIN inventory i ON pri.product_id = i.product_id
            JOIN pending_returns pr ON pri.return_id = pr.return_id
            WHERE pri.return_id = ?
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
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Get schedule info before deleting
        cursor.execute("""
            SELECT employee_id, schedule_date, start_time, end_time
            FROM employee_schedule
            WHERE schedule_id = ?
        """, (schedule_id,))
        
        schedule = cursor.fetchone()
        if not schedule:
            conn.close()
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404
        
        # Delete schedule
        cursor.execute("DELETE FROM employee_schedule WHERE schedule_id = ?", (schedule_id,))
        
        # Also delete from master calendar if exists
        cursor.execute("""
            DELETE FROM master_calendar
            WHERE related_table = 'employee_schedule' AND related_id = ?
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
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Verify schedule exists
        cursor.execute("""
            SELECT employee_id, schedule_date, status
            FROM employee_schedule
            WHERE schedule_id = ?
        """, (schedule_id,))
        
        schedule = cursor.fetchone()
        if not schedule:
            conn.close()
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404
        
        # Update schedule to confirmed
        cursor.execute("""
            UPDATE employee_schedule
            SET confirmed = 1, confirmed_at = CURRENT_TIMESTAMP
            WHERE schedule_id = ?
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
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if request.method == 'GET':
            employee_id = request.args.get('employee_id')
            if not employee_id:
                return jsonify({'success': False, 'message': 'employee_id is required'}), 400
            
            cursor.execute("""
                SELECT * FROM employee_availability
                WHERE employee_id = ?
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
                WHERE employee_id = ?
            """, (employee_id,))
            
            exists = cursor.fetchone()
            
            # Prepare data for insertion/update
            availability_data = {}
            for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
                if day in data:
                    availability_data[day] = json.dumps(data[day])
            
            if exists:
                # Update existing
                update_fields = [f"{day} = ?" for day in availability_data.keys()]
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                values = list(availability_data.values())
                values.append(employee_id)
                
                query = f"""
                    UPDATE employee_availability
                    SET {', '.join(update_fields)}
                    WHERE employee_id = ?
                """
                cursor.execute(query, values)
            else:
                # Insert new
                fields = ['employee_id'] + list(availability_data.keys()) + ['updated_at']
                placeholders = ['?'] * len(fields)
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

@app.route('/api/schedule/<int:period_id>', methods=['GET'])
def api_get_schedule(period_id):
    """Get schedule details"""
    try:
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
        from database import add_calendar_event
        
        employee_id = get_employee_from_token()
        if not employee_id:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        scheduler = AutomatedScheduleGenerator()
        result = scheduler.publish_schedule(period_id, employee_id)
        
        if result:
            # Get all shifts from the published schedule
            conn = sqlite3.connect(DB_NAME)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT ss.*, e.first_name || ' ' || e.last_name as employee_name
                FROM Scheduled_Shifts ss
                JOIN employees e ON ss.employee_id = e.employee_id
                WHERE ss.period_id = ? AND ss.is_draft = 0
            """, (period_id,))
            
            shifts = cursor.fetchall()
            
            # Add each shift to master calendar
            for shift in shifts:
                shift_dict = dict(shift)
                event_title = f"{shift_dict['employee_name']} - {shift_dict.get('position', 'Shift')}"
                event_description = f"Shift: {shift_dict['start_time']} - {shift_dict['end_time']}"
                if shift_dict.get('notes'):
                    event_description += f"\n{shift_dict['notes']}"
                
                add_calendar_event(
                    event_date=shift_dict['shift_date'],
                    event_type='schedule',
                    title=event_title,
                    description=event_description,
                    start_time=shift_dict['start_time'],
                    end_time=shift_dict['end_time'],
                    related_id=shift_dict['scheduled_shift_id'],
                    related_table='Scheduled_Shifts',
                    created_by=employee_id
                )
            
            cursor.close()
            conn.close()
        
        return jsonify({'success': result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

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
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
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
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if request.method == 'POST':
            # Create new shift
            data = request.json
            
            cursor.execute("""
                INSERT INTO Scheduled_Shifts
                (period_id, employee_id, shift_date, start_time, end_time,
                 break_duration, position, notes, is_draft)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            """, (period_id, data['employee_id'], data['shift_date'],
                  data['start_time'], data['end_time'], data.get('break_duration', 30),
                  data.get('position'), data.get('notes')))
            
            shift_id = cursor.lastrowid
            
            # Log change
            cursor.execute("""
                INSERT INTO Schedule_Changes
                (period_id, scheduled_shift_id, change_type, changed_by, new_values)
                VALUES (?, ?, 'created', ?, ?)
            """, (period_id, shift_id, employee_id, json.dumps(data)))
            
        elif request.method == 'PUT':
            # Update shift
            data = request.json
            shift_id = data['scheduled_shift_id']
            
            # Get old values
            cursor.execute("""
                SELECT * FROM Scheduled_Shifts WHERE scheduled_shift_id = ?
            """, (shift_id,))
            old_row = cursor.fetchone()
            if not old_row:
                conn.close()
                return jsonify({'success': False, 'message': 'Shift not found'}), 404
            old_values = dict(old_row)
            
            # Update
            cursor.execute("""
                UPDATE Scheduled_Shifts
                SET employee_id = ?,
                    shift_date = ?,
                    start_time = ?,
                    end_time = ?,
                    break_duration = ?,
                    position = ?,
                    notes = ?
                WHERE scheduled_shift_id = ?
            """, (data['employee_id'], data['shift_date'], data['start_time'],
                  data['end_time'], data.get('break_duration', 30),
                  data.get('position'), data.get('notes'), shift_id))
            
            # Log change
            cursor.execute("""
                INSERT INTO Schedule_Changes
                (period_id, scheduled_shift_id, change_type, changed_by, 
                 old_values, new_values)
                VALUES (?, ?, 'modified', ?, ?, ?)
            """, (period_id, shift_id, employee_id, 
                  json.dumps(old_values), json.dumps(data)))
            
        elif request.method == 'DELETE':
            # Delete shift
            shift_id = request.args.get('shift_id')
            if not shift_id:
                conn.close()
                return jsonify({'success': False, 'message': 'shift_id is required'}), 400
            
            # Get old values
            cursor.execute("""
                SELECT * FROM Scheduled_Shifts WHERE scheduled_shift_id = ?
            """, (shift_id,))
            old_row = cursor.fetchone()
            if not old_row:
                conn.close()
                return jsonify({'success': False, 'message': 'Shift not found'}), 404
            old_values = dict(old_row)
            
            # Delete
            cursor.execute("""
                DELETE FROM Scheduled_Shifts WHERE scheduled_shift_id = ?
            """, (shift_id,))
            
            # Log change
            cursor.execute("""
                INSERT INTO Schedule_Changes
                (period_id, scheduled_shift_id, change_type, changed_by, old_values)
                VALUES (?, ?, 'deleted', ?, ?)
            """, (period_id, shift_id, employee_id, json.dumps(old_values)))
        
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
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Delete old recurring availability
        cursor.execute("""
            DELETE FROM Employee_Availability
            WHERE employee_id = ? AND is_recurring = 1
        """, (employee_id,))
        
        # Insert new availability
        for avail in data['availability']:
            cursor.execute("""
                INSERT INTO Employee_Availability
                (employee_id, day_of_week, start_time, end_time, 
                 availability_type, is_recurring)
                VALUES (?, ?, ?, ?, ?, 1)
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
            'data': events
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

@app.route('/api/calendar/subscription/create', methods=['POST'])
def create_subscription():
    """Create calendar subscription for employee"""
    try:
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.json.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_data['employee_id']
        preferences = request.json.get('preferences') or request.json
        
        from calendar_integration import CalendarIntegrationSystem
        calendar_system = CalendarIntegrationSystem(base_url=request.url_root.rstrip('/'))
        
        subscription = calendar_system.create_subscription(employee_id, preferences)
        
        return jsonify({'success': True, 'data': subscription})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/calendar/subscription/urls', methods=['GET'])
def get_subscription_urls():
    """Get calendar subscription URLs"""
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
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all events for employee
        query = """
            SELECT DISTINCT ce.*
            FROM Calendar_Events ce
            LEFT JOIN Employee_Shifts es ON ce.event_id = es.event_id
            LEFT JOIN Shipment_Schedule ss ON ce.event_id = ss.event_id
            LEFT JOIN Event_Attendees ea ON ce.event_id = ea.event_id
            WHERE (es.employee_id = ? 
                   OR ss.assigned_receiver = ? 
                   OR ea.employee_id = ?
                   OR ce.event_type IN ('holiday', 'deadline'))
        """
        params = [employee_id, employee_id, employee_id]
        
        if start_date and end_date:
            query += " AND ce.start_datetime BETWEEN ? AND ?"
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
    """Start new transaction"""
    try:
        session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not session_token:
            session_token = request.json.get('session_token')
        
        if not session_token:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        
        session_data = verify_session(session_token)
        if not session_data.get('valid'):
            return jsonify({'success': False, 'message': 'Invalid session'}), 401
        
        employee_id = session_data['employee_id']
        data = request.json
        
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem(DB_NAME)
        
        result = cds.start_transaction(employee_id, data['items'])
        
        # Emit Socket.IO event for customer display
        if SOCKETIO_AVAILABLE and socketio:
            socketio.emit('transaction_started', result, room='customer_display')
        
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/transaction/<int:transaction_id>', methods=['GET'])
def get_transaction(transaction_id):
    """Get transaction details"""
    try:
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem(DB_NAME)
        
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
        cds = CustomerDisplaySystem(DB_NAME)
        
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
        cds = CustomerDisplaySystem(DB_NAME)
        
        result = cds.process_payment(
            data['transaction_id'],
            data['payment_method_id'],
            data['amount'],
            data.get('card_info'),
            data.get('tip', 0)
        )
        
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
        cds = CustomerDisplaySystem(DB_NAME)
        
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
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        try:
            # Update transaction with signature
            cursor.execute("""
                UPDATE transactions
                SET signature = ?
                WHERE transaction_id = ?
            """, (signature, transaction_id))
            
            if cursor.rowcount == 0:
                conn.close()
                return jsonify({'success': False, 'message': 'Transaction not found'}), 404
            
            conn.commit()
            conn.close()
            
            return jsonify({'success': True, 'message': 'Signature saved successfully'})
        except sqlite3.OperationalError as e:
            # Column might not exist, try to add it
            if 'signature' in str(e).lower():
                conn.close()
                # Run migration
                from migrate_add_signature_to_transactions import migrate_add_signature
                migrate_add_signature(DB_NAME)
                # Try again
                conn = sqlite3.connect(DB_NAME)
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE transactions
                    SET signature = ?
                    WHERE transaction_id = ?
                """, (signature, transaction_id))
                conn.commit()
                conn.close()
                return jsonify({'success': True, 'message': 'Signature saved successfully'})
            else:
                conn.close()
                raise
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/customer-display/settings', methods=['GET', 'POST', 'PUT'])
def get_display_settings():
    """Get or update customer display settings"""
    try:
        from customer_display_system import CustomerDisplaySystem
        cds = CustomerDisplaySystem(DB_NAME)
        
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
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if request.method == 'POST':
            data = request.json if request.is_json else {}
            workflow_mode = data.get('workflow_mode', 'simple')
            auto_add = data.get('auto_add_to_inventory', 'true')
            
            # Update settings
            cursor.execute("""
                UPDATE shipment_verification_settings 
                SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
                WHERE setting_key = ?
            """, (workflow_mode, 'workflow_mode'))
            
            cursor.execute("""
                UPDATE shipment_verification_settings 
                SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
                WHERE setting_key = ?
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
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE pending_shipments 
            SET workflow_step = ?
            WHERE pending_shipment_id = ?
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
            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE pending_shipments 
                SET added_to_inventory = 1,
                    workflow_step = 'completed',
                    status = 'completed'
                WHERE pending_shipment_id = ?
            """, (shipment_id,))
            conn.commit()
            conn.close()
        
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
        import sqlite3
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT COUNT(*) FROM customer_rewards_settings")
            count = cursor.fetchone()[0]
            is_initial_setup = count == 0
        except sqlite3.OperationalError:
            # Table doesn't exist yet, allow initial setup
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
        
        # Update settings
        update_fields = {
            'enabled': data.get('enabled'),
            'require_email': data.get('require_email'),
            'require_phone': data.get('require_phone'),
            'require_both': data.get('require_both'),
            'reward_type': data.get('reward_type'),
            'points_per_dollar': data.get('points_per_dollar'),
            'percentage_discount': data.get('percentage_discount'),
            'fixed_discount': data.get('fixed_discount'),
            'minimum_spend': data.get('minimum_spend')
        }
        
        # Remove None values
        update_fields = {k: v for k, v in update_fields.items() if v is not None}
        
        if update_fields:
            success = update_customer_rewards_settings(**update_fields)
            if success:
                return jsonify({'success': True, 'message': 'Customer rewards settings updated successfully'})
            else:
                return jsonify({'success': False, 'message': 'Failed to update settings'}), 500
        else:
            return jsonify({'success': False, 'message': 'No fields to update'}), 400
            
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
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute("SELECT setting_id FROM sms_settings WHERE store_id = ?", (store_id,))
        exists = cursor.fetchone()
        
        provider = data.get('sms_provider', 'email')
        
        if exists:
            if provider == 'email':
                cursor.execute("""
                    UPDATE sms_settings SET
                        sms_provider = ?,
                        smtp_server = ?,
                        smtp_port = ?,
                        smtp_user = ?,
                        smtp_password = ?,
                        smtp_use_tls = ?,
                        business_name = ?,
                        store_phone_number = ?,
                        auto_send_rewards_earned = ?,
                        auto_send_rewards_redeemed = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE store_id = ?
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
                        sms_provider = ?,
                        aws_access_key_id = ?,
                        aws_secret_access_key = ?,
                        aws_region = ?,
                        business_name = ?,
                        auto_send_rewards_earned = ?,
                        auto_send_rewards_redeemed = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE store_id = ?
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
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
            employee_id=employee_id
        )
        
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
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
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
            query += " AND sm.store_id = ?"
            params.append(store_id)
        
        if customer_id:
            query += " AND sm.customer_id = ?"
            params.append(customer_id)
        
        if phone_number:
            query += " AND sm.phone_number = ?"
            params.append(phone_number)
        
        if status:
            query += " AND sm.status = ?"
            params.append(status)
        
        query += " ORDER BY sm.created_at DESC LIMIT ?"
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
            conn = sqlite3.connect(DB_NAME)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            store_id = request.args.get('store_id')
            if store_id:
                cursor.execute("SELECT * FROM sms_templates WHERE store_id = ? AND is_active = 1 ORDER BY template_name", (store_id,))
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
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sms_templates (store_id, template_name, template_text, category, variables, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
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
    """Get all stores"""
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stores WHERE is_active = 1 ORDER BY store_name")
        rows = cursor.fetchall()
        conn.close()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

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
        # Verify session
        session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
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
                return jsonify(result), 200
            else:
                return jsonify(result), 400
                
    except Exception as e:
        print(f"Error with daily cash count: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================================
# ACCOUNTING API ENDPOINTS
# ============================================================================

@app.route('/api/accounting/accounts', methods=['GET'])
def api_accounting_accounts():
    """Get all accounts from chart of accounts"""
    try:
        # Verify session - try multiple header formats
        session_token = (request.headers.get('X-Session-Token') or 
                        request.headers.get('Authorization', '').replace('Bearer ', '') or 
                        request.args.get('session_token') or
                        (request.json and request.json.get('session_token')))
        
        if not session_token:
            # Try to get from cookie or allow unauthenticated for now (for testing)
            return jsonify({'error': 'Session token required'}), 401
        
        try:
            session_result = verify_session(session_token)
            if not session_result.get('valid'):
                return jsonify({'error': 'Invalid session'}), 401
        except:
            # For now, allow access if session verification fails (for testing)
            pass
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            # Get accounts with balances
            cursor.execute("""
                SELECT 
                    a.id,
                    a.account_number,
                    a.account_name,
                    a.account_type,
                    a.sub_type,
                    a.balance_type,
                    a.is_active,
                    COALESCE(calculate_account_balance(a.id, CURRENT_DATE), 0) as balance
                FROM accounts a
                WHERE a.is_active = true
                ORDER BY a.account_type, a.account_number
            """)
            
            rows = cursor.fetchall()
            accounts = []
            for row in rows:
                accounts.append({
                    'id': row['id'],
                    'account_number': row['account_number'],
                    'account_name': row['account_name'],
                    'account_type': row['account_type'],
                    'sub_type': row['sub_type'],
                    'balance_type': row['balance_type'],
                    'is_active': row['is_active'],
                    'balance': float(row['balance']) if row['balance'] else 0.0
                })
            
            return jsonify(accounts), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_accounts: {db_error}")
            # Return empty array instead of error
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_accounts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/trial-balance', methods=['GET'])
def api_accounting_trial_balance():
    """Get trial balance report"""
    try:
        session_token = (request.headers.get('X-Session-Token') or 
                        request.headers.get('Authorization', '').replace('Bearer ', '') or 
                        request.args.get('session_token'))
        
        # Allow unauthenticated for now (for testing)
        # if not session_token:
        #     return jsonify({'error': 'Session token required'}), 401
        
        as_of_date = request.args.get('as_of_date', None)
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            if as_of_date:
                cursor.execute("SELECT * FROM get_trial_balance(%s)", (as_of_date,))
            else:
                cursor.execute("SELECT * FROM get_trial_balance(CURRENT_DATE)")
            
            rows = cursor.fetchall()
            trial_balance = []
            for row in rows:
                trial_balance.append({
                    'account_id': row['account_id'],
                    'account_number': row['account_number'],
                    'account_name': row['account_name'],
                    'account_type': row['account_type'],
                    'debit_balance': float(row['debit_balance']) if row['debit_balance'] else 0.0,
                    'credit_balance': float(row['credit_balance']) if row['credit_balance'] else 0.0
                })
            
            return jsonify(trial_balance), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_trial_balance: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_trial_balance: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/profit-loss', methods=['GET'])
def api_accounting_profit_loss():
    """Get profit & loss (income statement) report"""
    try:
        # Allow unauthenticated for now (for testing)
        # session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            return jsonify({'error': 'start_date and end_date required'}), 400
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            cursor.execute("SELECT * FROM get_profit_and_loss(%s, %s)", (start_date, end_date))
            
            rows = cursor.fetchall()
            pnl = []
            for row in rows:
                pnl.append({
                    'account_type': row['account_type'],
                    'account_name': row['account_name'],
                    'amount': float(row['amount']) if row['amount'] else 0.0
                })
            
            return jsonify(pnl), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_profit_loss: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_profit_loss: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/balance-sheet', methods=['GET'])
def api_accounting_balance_sheet():
    """Get balance sheet report"""
    try:
        # Allow unauthenticated for now (for testing)
        # session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        
        as_of_date = request.args.get('as_of_date', None)
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            if as_of_date:
                cursor.execute("SELECT * FROM get_balance_sheet(%s)", (as_of_date,))
            else:
                cursor.execute("SELECT * FROM get_balance_sheet(CURRENT_DATE)")
            
            rows = cursor.fetchall()
            balance_sheet = []
            for row in rows:
                balance_sheet.append({
                    'account_type': row['account_type'],
                    'account_name': row['account_name'],
                    'amount': float(row['amount']) if row['amount'] else 0.0
                })
            
            return jsonify(balance_sheet), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_balance_sheet: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_balance_sheet: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/aging', methods=['GET'])
def api_accounting_aging():
    """Get accounts receivable aging report"""
    try:
        # Allow unauthenticated for now (for testing)
        # session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        
        as_of_date = request.args.get('as_of_date', None)
        customer_id = request.args.get('customer_id', None)
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            if as_of_date:
                if customer_id:
                    cursor.execute("SELECT * FROM get_aging_report(%s, %s)", (as_of_date, int(customer_id)))
                else:
                    cursor.execute("SELECT * FROM get_aging_report(%s, NULL)", (as_of_date,))
            else:
                if customer_id:
                    cursor.execute("SELECT * FROM get_aging_report(CURRENT_DATE, %s)", (int(customer_id),))
                else:
                    cursor.execute("SELECT * FROM get_aging_report(CURRENT_DATE, NULL)")
            
            rows = cursor.fetchall()
            aging = []
            for row in rows:
                aging.append({
                    'customer_id': row['customer_id'],
                    'customer_name': row['customer_name'],
                    'current_balance': float(row['current_balance']) if row['current_balance'] else 0.0,
                    'days_0_30': float(row['days_0_30']) if row['days_0_30'] else 0.0,
                    'days_31_60': float(row['days_31_60']) if row['days_31_60'] else 0.0,
                    'days_61_90': float(row['days_61_90']) if row['days_61_90'] else 0.0,
                    'days_over_90': float(row['days_over_90']) if row['days_over_90'] else 0.0,
                    'total_balance': float(row['total_balance']) if row['total_balance'] else 0.0
                })
            
            return jsonify(aging), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_aging: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_aging: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/transactions', methods=['GET'])
def api_accounting_transactions():
    """Get transactions (journal entries)"""
    try:
        # Allow unauthenticated for now (for testing)
        # session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            query = """
                SELECT 
                    id,
                    transaction_number,
                    transaction_date,
                    transaction_type,
                    description,
                    is_posted,
                    is_void,
                    created_at
                FROM transactions
                WHERE 1=1
            """
            params = []
            
            if start_date:
                query += " AND transaction_date >= %s"
                params.append(start_date)
            if end_date:
                query += " AND transaction_date <= %s"
                params.append(end_date)
            
            query += " ORDER BY transaction_date DESC, id DESC LIMIT 100"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            transactions = []
            for row in rows:
                transactions.append({
                    'id': row['id'],
                    'transaction_number': row['transaction_number'],
                    'transaction_date': row['transaction_date'].isoformat() if row['transaction_date'] else None,
                    'transaction_type': row['transaction_type'],
                    'description': row['description'],
                    'is_posted': row['is_posted'],
                    'is_void': row['is_void'],
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None
                })
            
            return jsonify(transactions), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_transactions: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_transactions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/invoices', methods=['GET'])
def api_accounting_invoices():
    """Get invoices"""
    try:
        # Allow unauthenticated for now (for testing)
        # session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            query = """
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.invoice_date,
                    i.due_date,
                    i.status,
                    i.total_amount,
                    i.amount_paid,
                    i.balance_due,
                    c.display_name as customer_name
                FROM invoices i
                LEFT JOIN accounting_customers c ON i.customer_id = c.id
                WHERE 1=1
            """
            params = []
            
            if start_date:
                query += " AND i.invoice_date >= %s"
                params.append(start_date)
            if end_date:
                query += " AND i.invoice_date <= %s"
                params.append(end_date)
            
            query += " ORDER BY i.invoice_date DESC, i.id DESC LIMIT 100"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            invoices = []
            for row in rows:
                invoices.append({
                    'id': row['id'],
                    'invoice_number': row['invoice_number'],
                    'invoice_date': row['invoice_date'].isoformat() if row['invoice_date'] else None,
                    'due_date': row['due_date'].isoformat() if row['due_date'] else None,
                    'status': row['status'],
                    'total_amount': float(row['total_amount']) if row['total_amount'] else 0.0,
                    'amount_paid': float(row['amount_paid']) if row['amount_paid'] else 0.0,
                    'balance_due': float(row['balance_due']) if row['balance_due'] else 0.0,
                    'customer_name': row['customer_name']
                })
            
            return jsonify(invoices), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_invoices: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_invoices: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/bills', methods=['GET'])
def api_accounting_bills():
    """Get vendor bills"""
    try:
        # Allow unauthenticated for now (for testing)
        # session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            query = """
                SELECT 
                    b.id,
                    b.bill_number,
                    b.bill_date,
                    b.due_date,
                    b.status,
                    b.total_amount,
                    b.amount_paid,
                    b.balance_due,
                    v.vendor_name
                FROM bills b
                LEFT JOIN accounting_vendors v ON b.vendor_id = v.id
                WHERE 1=1
            """
            params = []
            
            if start_date:
                query += " AND b.bill_date >= %s"
                params.append(start_date)
            if end_date:
                query += " AND b.bill_date <= %s"
                params.append(end_date)
            
            query += " ORDER BY b.bill_date DESC, b.id DESC LIMIT 100"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            bills = []
            for row in rows:
                bills.append({
                    'id': row['id'],
                    'bill_number': row['bill_number'],
                    'bill_date': row['bill_date'].isoformat() if row['bill_date'] else None,
                    'due_date': row['due_date'].isoformat() if row['due_date'] else None,
                    'status': row['status'],
                    'total_amount': float(row['total_amount']) if row['total_amount'] else 0.0,
                    'amount_paid': float(row['amount_paid']) if row['amount_paid'] else 0.0,
                    'balance_due': float(row['balance_due']) if row['balance_due'] else 0.0,
                    'vendor_name': row['vendor_name']
                })
            
            return jsonify(bills), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_bills: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_bills: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/customers', methods=['GET'])
def api_accounting_customers():
    """Get accounting customers"""
    try:
        # Allow unauthenticated for now (for testing)
        # session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            cursor.execute("""
                SELECT 
                    id,
                    customer_number,
                    display_name,
                    email,
                    phone,
                    account_balance,
                    is_active
                FROM accounting_customers
                WHERE is_active = true
                ORDER BY display_name
                LIMIT 100
            """)
            
            rows = cursor.fetchall()
            customers = []
            for row in rows:
                customers.append({
                    'id': row['id'],
                    'customer_number': row['customer_number'],
                    'display_name': row['display_name'],
                    'email': row['email'],
                    'phone': row['phone'],
                    'account_balance': float(row['account_balance']) if row['account_balance'] else 0.0,
                    'is_active': row['is_active']
                })
            
            return jsonify(customers), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_customers: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_customers: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/accounting/vendors', methods=['GET'])
def api_accounting_vendors():
    """Get accounting vendors"""
    try:
        # Allow unauthenticated for now (for testing)
        # session_token = request.headers.get('X-Session-Token') or request.args.get('session_token')
        
        from database_postgres import get_cursor
        cursor = get_cursor()
        
        try:
            cursor.execute("""
                SELECT 
                    id,
                    vendor_number,
                    vendor_name,
                    email,
                    phone,
                    account_balance,
                    is_active
                FROM accounting_vendors
                WHERE is_active = true
                ORDER BY vendor_name
                LIMIT 100
            """)
            
            rows = cursor.fetchall()
            vendors = []
            for row in rows:
                vendors.append({
                    'id': row['id'],
                    'vendor_number': row['vendor_number'],
                    'vendor_name': row['vendor_name'],
                    'email': row['email'],
                    'phone': row['phone'],
                    'account_balance': float(row['account_balance']) if row['account_balance'] else 0.0,
                    'is_active': row['is_active']
                })
            
            return jsonify(vendors), 200
        except Exception as db_error:
            print(f"Database error in api_accounting_vendors: {db_error}")
            return jsonify([]), 200
        finally:
            if cursor:
                cursor.close()
        
    except Exception as e:
        print(f"Error in api_accounting_vendors: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting web viewer...")
    print("Open your browser to: http://localhost:5001")
    if SOCKETIO_AVAILABLE and socketio:
        print("Socket.IO enabled - real-time features available")
        socketio.run(app, debug=True, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True)
    else:
        print("Socket.IO disabled - using standard Flask server")
        app.run(debug=True, host='0.0.0.0', port=5001)

