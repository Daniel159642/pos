#!/usr/bin/env python3
"""
Web viewer for inventory database - Google Sheets style interface
"""

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
    get_discrepancies, get_audit_trail,
    create_pending_return, approve_pending_return, reject_pending_return,
    get_pending_return, list_pending_returns,
    get_employee_role, assign_role_to_employee,
    start_verification_session, scan_item, report_shipment_issue,
    get_verification_progress, complete_verification,
    get_pending_shipments_with_progress, get_shipment_items,
    create_shipment_from_document
)
from permission_manager import get_permission_manager
import sqlite3
import os
import json
from datetime import datetime
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

@app.route('/api/inventory')
def api_inventory():
    """Get inventory data with vendor names"""
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                i.*,
                v.vendor_name
            FROM inventory i
            LEFT JOIN vendors v ON i.vendor_id = v.vendor_id
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

@app.route('/api/vendors')
def api_vendors():
    """Get vendors data"""
    vendors = list_vendors()
    if not vendors:
        return jsonify({'columns': [], 'data': []})
    
    columns = list(vendors[0].keys())
    return jsonify({'columns': columns, 'data': vendors})

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
        employee_id = request.json.get('employee_id')
        if not employee_id:
            # Try to get from session
            session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not session_token:
                session_token = request.json.get('session_token')
            if session_token:
                session_data = verify_session(session_token)
                if session_data and session_data.get('valid'):
                    employee_id = session_data.get('employee_id')
        
        if not employee_id:
            return jsonify({'success': False, 'message': 'Employee ID required'}), 401
        
        device_id = request.json.get('device_id')
        result = start_verification_session(shipment_id, employee_id, device_id)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

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
    """Complete verification and approve shipment"""
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
        result = complete_verification(
            shipment_id,
            employee_id,
            data.get('notes')
        )
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
            uploaded_by=employee_id
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

# Authentication endpoints
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
            tip=data.get('tip', 0.0)
        )
        
        return jsonify(result)
    except Exception as e:
        print(f"Create order error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# Get all tables endpoint
@app.route('/api/tables/list')
def api_list_tables():
    """Get list of all tables in the database"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return jsonify({'tables': tables})
    except Exception as e:
        print(f"Error listing tables: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'tables': [], 'error': str(e)}), 500

# Generic table endpoints
@app.route('/api/<table_name>')
def api_table(table_name):
    """Generic endpoint for any table"""
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
        columns, data = get_table_data(table_name)
        return jsonify({'columns': columns, 'data': data})
    except Exception as e:
        print(f"Error loading table {table_name}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'columns': [], 'data': [], 'error': str(e)}), 500

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
    employees = list_employees(active_only=False)
    if not employees:
        return jsonify({'columns': [], 'data': []})
    
    columns = list(employees[0].keys())
    return jsonify({'columns': columns, 'data': employees})

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
        
        query += " ORDER BY es.schedule_date DESC, es.start_time"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
        data = [{col: row[col] for col in columns} for row in rows]
        
        conn.close()
        return jsonify({'columns': columns, 'data': data})
    
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
    """Get dashboard statistics: total orders, total returns, and weekly revenue"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get total orders count
        cursor.execute("SELECT COUNT(*) as total FROM orders")
        total_orders = cursor.fetchone()['total']
        
        # Get total returns count
        cursor.execute("SELECT COUNT(*) as total FROM pending_returns")
        total_returns = cursor.fetchone()['total']
        
        # Get weekly revenue (last 7 days)
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
        
        # Generate all 7 days of the week (including days with 0 revenue)
        from datetime import datetime, timedelta
        today = datetime.now().date()
        week_data = []
        for i in range(6, -1, -1):  # Last 7 days (6 days ago to today)
            day = today - timedelta(days=i)
            date_str = day.strftime('%Y-%m-%d')
            day_name = day.strftime('%a')  # Mon, Tue, etc.
            revenue = weekly_revenue.get(date_str, 0)
            week_data.append({
                'date': date_str,
                'day': day_name,
                'revenue': revenue
            })
        
        conn.close()
        return jsonify({
            'total_orders': total_orders,
            'total_returns': total_returns,
            'weekly_revenue': week_data
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
        
        # Create employee
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
            pin_code=data.get('pin_code')
        )
        
        # Assign role if provided
        if data.get('role_id'):
            assign_role_to_employee(employee_id, data['role_id'])
        
        employee = get_employee(employee_id)
        
        return jsonify({
            'success': True,
            'employee_id': employee_id,
            'employee': employee
        })
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

@app.route('/api/master_calendar')
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

@app.route('/customer-display')
def customer_display():
    """Render customer display page"""
    return render_template('customer_display.html')

if __name__ == '__main__':
    print("Starting web viewer...")
    print("Open your browser to: http://localhost:5001")
    if SOCKETIO_AVAILABLE and socketio:
        print("Socket.IO enabled - real-time features available")
        socketio.run(app, debug=True, host='0.0.0.0', port=5001)
    else:
        print("Socket.IO disabled - using standard Flask server")
        app.run(debug=True, host='0.0.0.0', port=5001)

