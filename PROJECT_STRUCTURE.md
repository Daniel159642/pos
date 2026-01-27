# Project Structure Documentation
## POS Accounting System

This document describes the complete project structure and organization.

## Root Directory Structure

```
pos/
├── 📁 archive/                    # Archived/migrated code
│   ├── fixes/                     # Old fix scripts
│   ├── migrations/                # Migration scripts
│   └── scripts/                   # Old utility scripts
│
├── 📁 docs/                       # Documentation
│   ├── ADMIN_PIN_SETUP.md
│   ├── CALENDAR_INTEGRATION_README.md
│   ├── COMPLETE_SETUP_GUIDE.md
│   └── ... (other docs)
│
├── 📁 frontend/                   # React frontend application
│   ├── 📁 public/                 # Static assets
│   │   └── models/                # ML models (face recognition)
│   ├── 📁 src/                    # Source code
│   │   ├── 📁 components/         # React components
│   │   ├── 📁 pages/              # Page components
│   │   ├── 📁 contexts/           # React contexts
│   │   ├── App.jsx                # Main app component
│   │   └── main.jsx               # Entry point
│   ├── index.html                 # HTML template
│   ├── package.json               # Node dependencies
│   └── vite.config.js             # Vite configuration
│
├── 📁 scripts/                    # Utility scripts
│   ├── auto_categorize_periodic.py
│   ├── batch_process_metadata.py
│   └── ...
│
├── 📁 tests/                      # Test files
│   ├── test_accounting_system.py
│   ├── test_auth_system.py
│   └── ...
│
├── 📁 templates/                  # Flask templates
│   └── index.html
│
├── 📄 accounting_*.sql            # Accounting database schema
├── 📄 database.py                 # Database abstraction layer
├── 📄 database_postgres.py        # PostgreSQL connection
├── 📄 web_viewer.py               # Main Flask application
├── 📄 requirements.txt            # Python dependencies
├── 📄 .env                        # Environment variables (not in git)
├── 📄 .env.example                # Environment variables template
├── 📄 .gitignore                  # Git ignore rules
└── 📄 README.md                   # Project README
```

---

## Backend Structure

### Core Files

**`web_viewer.py`** (Main Application)
- Flask application setup
- API route definitions
- Request handlers
- Error handling
- CORS configuration

**`database.py`** (Database Layer)
- Database abstraction functions
- CRUD operations
- Business logic functions
- Data serialization

**`database_postgres.py`** (PostgreSQL Connection)
- Database connection management
- Connection pooling
- Error handling
- Connection utilities

### Accounting System Files

**Schema Files:**
- `accounting_schema.sql` - Table definitions
- `accounting_triggers.sql` - Database triggers
- `accounting_functions.sql` - Database functions
- `accounting_seed_data.sql` - Seed data
- `setup_accounting_system.sql` - Master setup script

**Documentation:**
- `ACCOUNTING_SYSTEM_DOCUMENTATION.md` - Complete guide
- `accounting_erd.md` - Entity relationship diagram
- `ACCOUNTING_SETUP_INSTRUCTIONS.md` - Setup guide

### Configuration Files

**`.env`** (Environment Variables)
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pos_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pos_db
DB_USER=pos_user
DB_PASSWORD=password

# Flask
FLASK_ENV=development
FLASK_DEBUG=True
```

**`requirements.txt`** (Python Dependencies)
- Flask and extensions
- PostgreSQL driver
- Authentication libraries
- Image processing
- ML libraries
- etc.

---

## Frontend Structure

### Source Code (`frontend/src/`)

**`main.jsx`** - Application entry point
- React DOM rendering
- Theme initialization

**`App.jsx`** - Main application component
- Routing configuration
- Layout wrapper
- Protected routes
- Navigation

### Components (`frontend/src/components/`)

**Common Components:**
- `Login.jsx` - Login page
- `Dashboard.jsx` - Dashboard
- `POS.jsx` - Point of sale interface
- `Table.jsx` - Data table component

**Feature Components:**
- `Calendar.jsx` - Calendar/scheduling
- `EmployeeManagement.jsx` - Employee management
- Various page components

### Pages (`frontend/src/pages/`)

- `Accounting.jsx` - Accounting system interface
- `Inventory.jsx` - Inventory management
- `Returns.jsx` - Returns processing
- `Settings.jsx` - Application settings
- etc.

### Contexts (`frontend/src/contexts/`)

- `PermissionContext.jsx` - Permission management
- `ThemeContext.jsx` - Theme (dark/light mode)

### Configuration

**`vite.config.js`** - Vite build configuration
- React plugin
- Path aliases
- Proxy settings

**`package.json`** - Node dependencies and scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

## Database Structure

### Accounting Tables (from Step 1)

**Core Accounting:**
- `accounts` - Chart of accounts
- `transactions` - Journal entry headers
- `transaction_lines` - Journal entry lines

**Customer & Invoice:**
- `accounting_customers` - Customer master
- `invoices` - Invoice headers
- `invoice_lines` - Invoice line items
- `payments` - Customer payments
- `payment_applications` - Payment to invoice matching

**Vendor & Bill:**
- `accounting_vendors` - Vendor master
- `bills` - Vendor bill headers
- `bill_lines` - Bill line items
- `bill_payments` - Vendor payments
- `bill_payment_applications` - Payment to bill matching

**Inventory:**
- `items` - Product/service master
- `inventory_transactions` - Inventory movements

**Supporting:**
- `tax_rates` - Sales tax configuration
- `classes` - Department tracking
- `locations` - Multi-location support
- `users` - System users
- `audit_log` - Change tracking

### Existing POS Tables

- `establishments` - Store/establishment info
- `employees` - Employee records
- `customers` - Customer records (POS)
- `vendors` - Vendor records (POS)
- `inventory` - Product inventory
- `orders` - Sales orders
- `sales` - Sales transactions
- etc.

---

## Scripts Directory

**Utility Scripts:**
- `auto_categorize_periodic.py` - Auto-categorization
- `batch_process_metadata.py` - Batch metadata processing
- `check_dependencies.py` - Dependency checker
- `generate_barcode_images.py` - Barcode generation
- `sync_categories_to_inventory.py` - Category sync

**Setup Scripts:**
- `create_admin_account.py` - Admin account creation
- `setup_admin_pin.py` - PIN setup

---

## Tests Directory

**Test Files:**
- `test_accounting_system.py` - Accounting tests
- `test_auth_system.py` - Authentication tests
- `test_order_system.py` - Order system tests
- `test_tax_and_fees.py` - Tax calculation tests
- etc.

---

## Documentation Files

**Setup Guides:**
- `DEVELOPMENT_SETUP.md` - Development environment setup
- `ACCOUNTING_SETUP_INSTRUCTIONS.md` - Accounting setup
- `QUICK_START.md` - Quick start guide
- `SETUP_FOR_OTHER_COMPUTERS.md` - Multi-computer setup

**System Documentation:**
- `ACCOUNTING_SYSTEM_DOCUMENTATION.md` - Accounting system guide
- `ACCOUNTING_SYSTEM_SUMMARY.md` - Accounting summary
- `PROJECT_STRUCTURE.md` - This file

**Feature Documentation:**
- Various README files in `docs/` directory

---

## File Naming Conventions

### Python Files
- `snake_case.py` - Standard Python convention
- `web_viewer.py` - Main application
- `database_*.py` - Database-related modules

### SQL Files
- `accounting_*.sql` - Accounting schema files
- `schema_*.sql` - General schema files
- `*_schema.sql` - Schema definitions

### JavaScript/React Files
- `PascalCase.jsx` - React components
- `camelCase.js` - Utility files
- `kebab-case.css` - Stylesheets

### Documentation
- `UPPER_CASE.md` - Major documentation
- `lowercase.md` - Feature-specific docs

---

## Development Workflow

### Adding New Features

1. **Backend:**
   - Add route in `web_viewer.py`
   - Add database function in `database.py` if needed
   - Add tests in `tests/`

2. **Frontend:**
   - Create component in `frontend/src/components/`
   - Add page in `frontend/src/pages/` if needed
   - Update routing in `App.jsx`

3. **Database:**
   - Create migration script if schema changes
   - Update documentation

### Code Organization Principles

1. **Separation of Concerns:**
   - Backend: Business logic and API
   - Frontend: UI and user interaction
   - Database: Data storage and integrity

2. **Modularity:**
   - Reusable components
   - Shared utilities
   - Clear interfaces

3. **Documentation:**
   - Code comments
   - README files
   - API documentation

---

## Environment-Specific Files

### Development
- `.env` - Local environment variables
- `venv/` - Python virtual environment
- `node_modules/` - Node dependencies

### Production
- Production `.env` (not in repo)
- Compiled frontend build
- Optimized database

---

## Git Structure

### Branches
- `main` / `master` - Production-ready code
- `develop` - Development branch
- `feature/*` - Feature branches
- `hotfix/*` - Hotfix branches

### Ignored Files (`.gitignore`)
- `.env` - Environment variables
- `venv/` - Virtual environment
- `node_modules/` - Node dependencies
- `__pycache__/` - Python cache
- `*.pyc` - Compiled Python
- `.DS_Store` - macOS files
- Database files (`.db`, `.sqlite`)

---

## Summary

This project follows a standard full-stack structure:
- **Backend**: Python/Flask with PostgreSQL
- **Frontend**: React with Vite
- **Database**: PostgreSQL with comprehensive schema
- **Organization**: Clear separation of concerns
- **Documentation**: Comprehensive guides and docs

For setup instructions, see `DEVELOPMENT_SETUP.md`.
