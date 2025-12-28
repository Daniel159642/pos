#!/bin/bash
# Complete setup script for metadata extraction system
# This does EVERYTHING needed after dependencies are installed

set -e  # Exit on error

echo "========================================="
echo "Complete Metadata Extraction Setup"
echo "========================================="
echo ""

# Step 1: Check dependencies
echo "Step 1: Checking dependencies..."
python3 check_dependencies.py

echo ""
echo "If dependencies are missing, install them first:"
echo "  pip3 install scikit-learn spacy fuzzywuzzy python-Levenshtein requests"
echo "  python3 -m spacy download en_core_web_sm"
echo ""
read -p "Press Enter to continue after installing dependencies, or Ctrl+C to cancel..."
echo ""

# Step 2: Run migration (idempotent - safe to run multiple times)
echo "Step 2: Running database migration..."
python3 migrate_metadata_system.py
echo ""

# Step 3: Process all products
echo "Step 3: Processing all products to extract metadata..."
python3 batch_process_metadata.py
echo ""

# Step 4: Run auto-categorization (if scikit-learn is available)
echo "Step 4: Auto-categorizing products with K-Means clustering..."
python3 -c "
from metadata_extraction import FreeMetadataSystem
try:
    ms = FreeMetadataSystem()
    ms.auto_categorize_products_kmeans()
    print('✓ Auto-categorization completed successfully!')
except Exception as e:
    if 'scikit-learn' in str(e):
        print('⚠ Skipping auto-categorization (scikit-learn not installed)')
    else:
        print(f'⚠ Error: {e}')
"
echo ""

# Step 5: Verify everything works
echo "Step 5: Verifying installation..."
python3 -c "
from metadata_extraction import FreeMetadataSystem
from database import get_connection
import sqlite3

# Check metadata extraction
ms = FreeMetadataSystem()
print('✓ Metadata system initialized')

# Check database
conn = get_connection()
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM product_metadata')
count = cursor.fetchone()[0]
print(f'✓ {count} products have metadata')
conn.close()
"
echo ""

echo "========================================="
echo "✓ Setup Complete!"
echo "========================================="
echo ""
echo "Your metadata extraction system is ready!"
echo ""
echo "Next steps:"
echo "  - Use intelligent search: python3 -c \"from metadata_extraction import FreeMetadataSystem; ms = FreeMetadataSystem(); print(ms.intelligent_search('vegetables'))\""
echo "  - Check metadata: python3 check_dependencies.py"
echo ""

