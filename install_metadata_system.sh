#!/bin/bash
# install_metadata_system.sh
# Installation script for FREE metadata extraction system

echo "========================================="
echo "Installing FREE Metadata Extraction System"
echo "========================================="
echo ""
echo "This system uses only FREE, open-source libraries:"
echo "  - scikit-learn (machine learning)"
echo "  - spacy (NLP - runs locally)"
echo "  - fuzzywuzzy (fuzzy matching)"
echo "  - requests (for free barcode APIs)"
echo ""
echo "No paid APIs or services required!"
echo ""

# Install Python packages (all free)
echo "Installing Python packages..."
pip3 install scikit-learn spacy fuzzywuzzy python-Levenshtein requests

# Download spaCy English model (free, ~20MB)
echo ""
echo "Downloading spaCy English model (free, ~20MB)..."
python3 -m spacy download en_core_web_sm

echo ""
echo "========================================="
echo "✓ Installation complete!"
echo "========================================="
echo ""
echo "All dependencies are FREE and open-source."
echo "No API keys or paid services required."
echo ""
echo "Next steps:"
echo "  1. Run migration: python3 migrate_metadata_system.py"
echo "  2. Process products: python3 batch_process_metadata.py"
echo ""

