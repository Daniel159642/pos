# Metadata Extraction - Quick Start Guide

Get started with FREE metadata extraction in 3 steps!

## Step 1: Install Dependencies

```bash
./install_metadata_system.sh
```

Or manually:
```bash
pip install scikit-learn spacy fuzzywuzzy python-Levenshtein requests
python -m spacy download en_core_web_sm
```

## Step 2: Run Database Migration

```bash
python3 migrate_metadata_system.py
```

This creates the necessary tables:
- `categories`
- `product_metadata`
- `metadata_extraction_log`
- `search_history`

## Step 3: Process Your Products

```bash
# Process all products
python3 batch_process_metadata.py

# Or process first 50 only
python3 batch_process_metadata.py --limit 50
```

## Try It Out

Run the examples:
```bash
python3 example_metadata_extraction.py
```

## What You Get

✅ **Brand detection** - Automatically identifies brands  
✅ **Category suggestions** - Suggests product categories  
✅ **Attribute extraction** - Colors, sizes, materials, etc.  
✅ **Keywords & tags** - Extracted from product names  
✅ **Intelligent search** - Semantic search with relevance ranking  
✅ **Auto-categorization** - K-Means clustering for grouping similar products  

## All for FREE!

- No API costs
- No subscriptions
- No rate limits
- Runs locally on your server
- 100% open-source

See `METADATA_EXTRACTION_README.md` for detailed documentation.









