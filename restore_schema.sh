#!/bin/bash
# Restore database schema from dump file
# Run this after pulling code to ensure database matches

set -e

# Load .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_NAME=${DB_NAME:-pos_db}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

SCHEMA_FILE="database_schema_dump.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ Schema file $SCHEMA_FILE not found!"
    echo "Run dump_schema.sh first, or use setup_complete_database.py"
    exit 1
fi

echo "Restoring database schema from $SCHEMA_FILE..."

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $SCHEMA_FILE

echo "✓ Schema restored"
