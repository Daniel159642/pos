# Install Optional Dependencies Now

Run these commands in your terminal to install all optional dependencies:

## Quick Install (Recommended)

```bash
cd /Users/danielbudnyatsky/pos
./install_metadata_system.sh
```

## Manual Install

If the script doesn't work, install manually:

```bash
# Install all Python packages
pip3 install scikit-learn spacy fuzzywuzzy python-Levenshtein requests

# Download spaCy English language model (~20MB)
python3 -m spacy download en_core_web_sm
```

## Verify Installation

After installation, verify everything works:

```bash
python3 -c "from metadata_extraction import FreeMetadataSystem; print('✓ All dependencies installed!')"
```

You should see **NO warnings** if everything is installed correctly.

## After Installation - Re-run Auto-Categorization

Once dependencies are installed, you can improve the categorization:

```bash
python3 -c "from metadata_extraction import FreeMetadataSystem; ms = FreeMetadataSystem(); ms.auto_categorize_products_kmeans()"
```

This will use K-Means clustering to automatically group similar products into better categories.

## What You Get

With all dependencies installed, you'll have:

✅ **Advanced NLP** - Better keyword and tag extraction using spaCy  
✅ **K-Means Clustering** - Automatic product categorization  
✅ **TF-IDF Search** - Semantic search with relevance ranking  
✅ **Fuzzy Matching** - Better brand and attribute matching  
✅ **Free Barcode Lookup** - Lookup product info from barcodes (Open Food Facts)  

All 100% FREE - no paid services required!









