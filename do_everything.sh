#!/bin/bash
# Complete installation and setup script
# Does EVERYTHING needed in one go

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Complete Metadata Extraction System Setup                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Install dependencies
echo "════════════════════════════════════════════════════════════"
echo "STEP 1: Installing Dependencies"
echo "════════════════════════════════════════════════════════════"
echo ""

pip3 install scikit-learn spacy fuzzywuzzy python-Levenshtein requests

echo ""
echo "Downloading spaCy English model (~20MB)..."
python3 -m spacy download en_core_web_sm

echo ""
echo "✓ Dependencies installed!"
echo ""

# Step 2: Run database migration
echo "════════════════════════════════════════════════════════════"
echo "STEP 2: Database Migration"
echo "════════════════════════════════════════════════════════════"
echo ""

python3 migrate_metadata_system.py
echo ""

# Step 3: Process all products
echo "════════════════════════════════════════════════════════════"
echo "STEP 3: Processing All Products"
echo "════════════════════════════════════════════════════════════"
echo ""

python3 batch_process_metadata.py
echo ""

# Step 4: Auto-categorize
echo "════════════════════════════════════════════════════════════"
echo "STEP 4: Auto-Categorizing Products"
echo "════════════════════════════════════════════════════════════"
echo ""

python3 -c "
from metadata_extraction import FreeMetadataSystem
ms = FreeMetadataSystem()
ms.auto_categorize_products_kmeans()
print('✓ Auto-categorization completed!')
"
echo ""

# Step 5: Final verification
echo "════════════════════════════════════════════════════════════"
echo "STEP 5: Verification"
echo "════════════════════════════════════════════════════════════"
echo ""

python3 check_dependencies.py
echo ""

python3 -c "
from database import get_connection
import sqlite3

conn = get_connection()
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM product_metadata')
metadata_count = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM categories')
categories_count = cursor.fetchone()[0]

conn.close()

print(f'✓ {metadata_count} products have metadata')
print(f'✓ {categories_count} categories created')
"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✓ ALL DONE! System is ready to use                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""









