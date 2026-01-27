#!/bin/bash
# Dump database schema (structure only, no data) to a file
# This can be committed to git and used to sync database structure

set -e

# Load .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_NAME=${DB_NAME:-pos_db}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

OUTPUT_FILE="database_schema_dump.sql"

echo "Dumping database schema to $OUTPUT_FILE..."

# Dump schema only (no data)
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f $OUTPUT_FILE

echo "✓ Schema dumped to $OUTPUT_FILE"
echo ""
echo "To restore on another computer:"
echo "  psql -U postgres -d pos_db -f $OUTPUT_FILE"
