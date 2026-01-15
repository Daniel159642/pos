# Role-Based Access Control (RBAC) System

A comprehensive RBAC system for the POS that provides fine-grained permission management with role-based defaults and per-employee customization.

## Features

- ✅ **Role-based defaults**: Pre-defined roles (Admin, Manager, Cashier, Stock Clerk, Viewer)
- ✅ **Per-employee customization**: Grant/revoke specific permissions per employee
- ✅ **Complete audit trail**: Track all permission changes and actions
- ✅ **Flexible & scalable**: Easy to add new permissions and roles
- ✅ **Frontend integration**: Permission-based UI components
- ✅ **API protection**: Backend permission checks on all endpoints

## Installation

### 1. Run Database Migration

Add RBAC tables to your database:

```bash
python migrate_rbac.py
```

This creates:
- `roles` table
- `permissions` table
- `role_permissions` table (role-permission mapping)
- `employee_permission_overrides` table (per-employee customizations)
- `activity_log` table (audit trail)
- Adds `role_id` column to `employees` table

### 2. Initialize Default Data

Populate default roles and permissions:

```bash
python init_rbac_data.py
```

This creates:
- 5 default roles (Admin, Manager, Cashier, Stock Clerk, Viewer)
- 30+ permissions across categories (sales, inventory, users, reports, settings)
- Permission assignments for each role

### 3. Assign Roles to Employees

```python
from permission_manager import get_permission_manager
from database import get_employee_role

pm = get_permission_manager()

# Get role ID for Admin
roles = pm.get_all_roles()
admin_role = next(r for r in roles if r['role_name'] == 'Admin')

# Assign Admin role to employee
pm.assign_role_to_employee(employee_id=1, role_id=admin_role['role_id'])
```

## Default Roles & Permissions

### Admin
- **All permissions** - Full system access

### Manager
- Sales: process_sale, process_return, apply_discount, view_sales
- Inventory: view_inventory, add_product, edit_product, adjust_inventory, receive_shipment
- Users: view_employees
- Reports: view_sales_reports, view_inventory_reports, view_employee_reports, export_reports
- Settings: manage_vendors, manage_customers

### Cashier
- Sales: process_sale, process_return, apply_discount, view_sales
- Inventory: view_inventory

### Stock Clerk
- Inventory: view_inventory, add_product, edit_product, adjust_inventory, receive_shipment, transfer_inventory
- Reports: view_inventory_reports

### Viewer
- Inventory: view_inventory
- Sales: view_sales
- Reports: view_sales_reports, view_inventory_reports

## Usage

### Backend (Python)

#### Check Permission

```python
from permission_manager import get_permission_manager

pm = get_permission_manager()

# Check if employee has permission
if pm.has_permission(employee_id=1, permission_name='process_sale'):
    # Process sale
    pass
```

#### Get Employee Permissions

```python
permissions = pm.get_employee_permissions(employee_id=1)
# Returns: {
#   'sales': [{'name': 'process_sale', 'description': '...'}, ...],
#   'inventory': [...],
#   ...
# }
```

#### Grant/Revoke Permissions

```python
# Grant specific permission to employee
pm.grant_permission_to_employee(
    employee_id=1,
    permission_name='add_product',
    granted_by=2,  # Admin employee_id
    reason='Temporary promotion'
)

# Revoke permission
pm.revoke_permission_from_employee(
    employee_id=1,
    permission_name='add_product',
    revoked_by=2,
    reason='Promotion ended'
)
```

#### Using Decorator

```python
from permission_manager import require_permission

@app.route('/api/create_order', methods=['POST'])
@require_permission('process_sale')
def create_order():
    # Only employees with 'process_sale' permission can access
    ...
```

### Frontend (React)

#### Permission Context

The `PermissionProvider` wraps your app and provides permission checking:

```jsx
import { PermissionProvider, usePermissions, ProtectedComponent } from './contexts/PermissionContext'

function App() {
  return (
    <PermissionProvider>
      {/* Your app */}
    </PermissionProvider>
  )
}
```

#### Check Permissions in Components

```jsx
import { usePermissions, ProtectedComponent } from '../contexts/PermissionContext'

function InventoryPage() {
  const { hasPermission } = usePermissions()

  return (
    <div>
      <h1>Inventory</h1>
      
      {/* Show add button only if user has permission */}
      <ProtectedComponent permission="add_product">
        <button onClick={addProduct}>Add Product</button>
      </ProtectedComponent>
      
      {/* Conditional rendering */}
      {hasPermission('edit_product') && (
        <button onClick={editProduct}>Edit Product</button>
      )}
    </div>
  )
}
```

#### Permission Manager Component

Use the `PermissionManager` component to manage employee permissions:

```jsx
import PermissionManager from './components/PermissionManager'

<PermissionManager employeeId={123} />
```

## API Endpoints

### Get Current Employee's Permissions
**GET/POST** `/api/my/permissions`
```json
{
  "employee_id": 1
}
```

### Check Permission
**POST** `/api/check_permission`
```json
{
  "employee_id": 1,
  "permission_name": "process_sale"
}
```

### Get Employee Permissions
**GET** `/api/employees/{employee_id}/permissions`

### Grant Permission
**POST** `/api/employees/{employee_id}/permissions/grant`
```json
{
  "permission_name": "add_product",
  "granted_by": 2,
  "reason": "Temporary promotion"
}
```

### Revoke Permission
**POST** `/api/employees/{employee_id}/permissions/revoke`
```json
{
  "permission_name": "add_product",
  "revoked_by": 2,
  "reason": "Promotion ended"
}
```

### Assign Role
**POST** `/api/employees/{employee_id}/assign_role`
```json
{
  "role_id": 2
}
```

### Get All Roles
**GET** `/api/roles`

### Get All Permissions
**GET** `/api/permissions`

### Get Activity Log
**GET** `/api/activity_log?limit=100&employee_id=1`

## Permission Categories

- **sales**: process_sale, process_return, apply_discount, void_transaction, view_sales, edit_sale
- **inventory**: view_inventory, add_product, edit_product, delete_product, adjust_inventory, receive_shipment, transfer_inventory
- **users**: view_employees, add_employee, edit_employee, delete_employee, manage_permissions, view_activity_log
- **reports**: view_sales_reports, view_inventory_reports, view_employee_reports, view_financial_reports, export_reports
- **settings**: modify_settings, manage_vendors, manage_customers, backup_database, view_audit_logs

## How It Works

1. **Role Assignment**: Employees are assigned a role (Admin, Manager, etc.)
2. **Role Permissions**: Each role has default permissions
3. **Employee Overrides**: Specific permissions can be granted/revoked per employee
4. **Permission Check**: System checks employee-specific overrides first, then role permissions
5. **Audit Trail**: All permission changes and actions are logged

## Example Workflow

1. **New Employee Setup**:
   ```python
   # Assign Cashier role
   pm.assign_role_to_employee(employee_id=5, role_id=3)  # Cashier role_id
   ```

2. **Temporary Promotion**:
   ```python
   # Grant additional permission
   pm.grant_permission_to_employee(
       employee_id=5,
       permission_name='add_product',
       granted_by=1,  # Admin
       reason='Temporary promotion to assist with inventory'
   )
   ```

3. **Permission Check**:
   ```python
   # In your code
   if pm.has_permission(employee_id=5, permission_name='add_product'):
       add_product(...)
   ```

4. **Frontend Check**:
   ```jsx
   {hasPermission('add_product') && (
     <button onClick={addProduct}>Add Product</button>
   )}
   ```

## Security Notes

- **Permission checks are server-side**: Frontend checks are for UI only
- **Always verify on backend**: Use `@require_permission` decorator or manual checks
- **Audit logging**: All permission changes are logged with who made the change
- **Role hierarchy**: Admin role has all permissions by default
- **System roles**: System roles (like Admin) cannot be deleted

## Troubleshooting

### "Permission denied" errors

1. Check employee has a role assigned
2. Verify role has the required permission
3. Check for employee-specific overrides that might revoke the permission

### Permissions not updating

1. Refresh permissions: `fetchPermissions(employee_id)`
2. Check role assignment: `get_employee_role(employee_id)`
3. Verify permission exists: `pm.get_all_permissions()`

### Frontend not showing permissions

1. Ensure `PermissionProvider` wraps your app
2. Call `fetchPermissions(employee_id)` after login
3. Check browser console for errors

## Next Steps

1. Run migrations: `python migrate_rbac.py`
2. Initialize data: `python init_rbac_data.py`
3. Assign roles to employees
4. Test permission checks in your code
5. Add permission checks to frontend components










