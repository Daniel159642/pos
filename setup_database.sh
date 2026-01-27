#!/bin/bash
# Complete database setup script for new computers
# This script sets up the entire database with all required tables and data

set -e  # Exit on error

echo "============================================================================"
echo "POS System - Complete Database Setup"
echo "============================================================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✓ Created .env file"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env and set your PostgreSQL connection details!"
        echo "   Example: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos_db"
        echo ""
        read -p "Press Enter after you've configured .env, or Ctrl+C to exit..."
    else
        echo "❌ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Load database connection from .env
source .env 2>/dev/null || true

DB_NAME=${DB_NAME:-pos_db}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

if [ -n "$DATABASE_URL" ]; then
    echo "Using DATABASE_URL from .env"
    PSQL_CMD="psql $DATABASE_URL"
else
    echo "Using individual DB settings: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
fi

echo ""
echo "Step 1: Creating database (if it doesn't exist)..."
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || echo "  Database already exists or createdb failed (this is OK)"

echo ""
echo "Step 2: Running main schema (schema_postgres.sql)..."
$PSQL_CMD -f schema_postgres.sql
if [ $? -eq 0 ]; then
    echo "  ✓ Main schema applied"
else
    echo "  ✗ Error applying main schema"
    exit 1
fi

echo ""
echo "Step 3: Running accounting schema (accounting_schema.sql)..."
if [ -f accounting_schema.sql ]; then
    $PSQL_CMD -f accounting_schema.sql
    if [ $? -eq 0 ]; then
        echo "  ✓ Accounting schema applied"
    else
        echo "  ⚠ Warning: Accounting schema had errors (may already be applied)"
    fi
else
    echo "  - accounting_schema.sql not found, skipping"
fi

echo ""
echo "Step 4: Running returns schema (returns_schema.sql)..."
if [ -f returns_schema.sql ]; then
    $PSQL_CMD -f returns_schema.sql
    if [ $? -eq 0 ]; then
        echo "  ✓ Returns schema applied"
    else
        echo "  ⚠ Warning: Returns schema had errors (may already be applied)"
    fi
else
    echo "  - returns_schema.sql not found, skipping"
fi

echo ""
echo "Step 5: Running migrations..."
for migration in migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "  Applying: $(basename $migration)"
        $PSQL_CMD -f "$migration" 2>/dev/null || echo "    ⚠ Warning: Migration may have errors (tables may already exist)"
    fi
done

echo ""
echo "Step 6: Creating admin account..."
python3 create_admin_account.py << EOF
ADMIN001
Admin
User
123456
EOF

echo ""
echo "Step 7: Initializing permissions (REQUIRED for admin access)..."
python3 init_admin_permissions.py

echo ""
echo "============================================================================"
echo "✓ Database setup complete!"
echo "============================================================================"
echo ""
echo "You can now:"
echo "  1. Start the backend: python3 web_viewer.py"
echo "  2. Start the frontend: cd frontend && npm run dev"
echo "  3. Log in with:"
echo "     - Employee Code: ADMIN001"
echo "     - Password: 123456"
echo ""
