#!/usr/bin/env python3
"""
Web viewer for inventory database - Google Sheets style interface
"""

from flask import Flask, render_template, jsonify, send_from_directory, request
from database import (
    list_products, list_vendors, list_shipments, get_sales,
    get_shipment_items, get_shipment_details,
    employee_login, verify_session, employee_logout,
    list_employees, list_orders,
    get_discrepancies, get_audit_trail
)
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
DB_NAME = 'inventory.db'

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
    """Get inventory data"""
    products = list_products()
    if not products:
        return jsonify({'columns': [], 'data': []})
    
    # Get all columns from first product
    columns = list(products[0].keys())
    return jsonify({'columns': columns, 'data': products})

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
    """Get pending shipments data"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT ps.*, v.vendor_name
        FROM pending_shipments ps
        JOIN vendors v ON ps.vendor_id = v.vendor_id
        ORDER BY ps.upload_timestamp DESC
    """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

# Authentication endpoints
@app.route('/api/login', methods=['POST'])
def api_login():
    """Employee login"""
    try:
        if not request.json:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        data = request.json
        result = employee_login(
            employee_code=data.get('employee_code'),
            password=data.get('password'),
            ip_address=request.remote_addr,
            device_info=request.headers.get('User-Agent')
        )
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
            customer_id=data.get('customer_id')
        )
        
        return jsonify(result)
    except Exception as e:
        print(f"Create order error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# Generic table endpoints
@app.route('/api/<table_name>')
def api_table(table_name):
    """Generic endpoint for any table"""
    # Whitelist of allowed tables for security
    allowed_tables = [
        'inventory', 'vendors', 'shipments', 'shipment_items', 'pending_shipments',
        'pending_shipment_items', 'orders', 'order_items', 'payment_transactions',
        'customers', 'employees', 'employee_schedule', 'employee_sessions',
        'time_clock', 'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
        'fiscal_periods', 'retained_earnings', 'shipment_discrepancies',
        'audit_log', 'master_calendar'
    ]
    
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
    orders = list_orders()
    if not orders:
        return jsonify({'columns': [], 'data': []})
    
    columns = list(orders[0].keys())
    return jsonify({'columns': columns, 'data': orders})

@app.route('/api/order_items')
def api_order_items():
    """Get order items with product details"""
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
        JOIN inventory i ON oi.product_id = i.product_id
        JOIN orders o ON oi.order_id = o.order_id
        ORDER BY oi.order_id DESC, oi.order_item_id
    """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

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

@app.route('/api/employee_schedule')
def api_employee_schedule():
    """Get employee schedule with employee names"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            es.*,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_code
        FROM employee_schedule es
        JOIN employees e ON es.employee_id = e.employee_id
        ORDER BY es.schedule_date DESC, es.start_time
    """)
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    data = [{col: row[col] for col in columns} for row in rows]
    
    conn.close()
    return jsonify({'columns': columns, 'data': data})

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

if __name__ == '__main__':
    print("Starting web viewer...")
    print("Open your browser to: http://localhost:5001")
    app.run(debug=True, host='0.0.0.0', port=5001)

