# Install Metadata Extraction Dependencies

Run these commands in your terminal to install all necessary dependencies:

## Option 1: Use the Installation Script

```bash
cd /Users/danielbudnyatsky/pos
chmod +x install_metadata_system.sh
./install_metadata_system.sh
```

## Option 2: Manual Installation

### Step 1: Install Python packages

```bash
pip3 install scikit-learn spacy fuzzywuzzy python-Levenshtein requests
```

Or if you prefer using python3 -m pip:

```bash
python3 -m pip install scikit-learn spacy fuzzywuzzy python-Levenshtein requests
```

### Step 2: Download spaCy English model

```bash
python3 -m spacy download en_core_web_sm
```

## Verify Installation

After installation, verify everything works:

```bash
python3 -c "from metadata_extraction import FreeMetadataSystem; print('✓ All dependencies installed successfully!')"
```

You should see no warnings if all dependencies are installed correctly.

## Dependencies Installed

- **scikit-learn** - Machine learning for clustering and TF-IDF search
- **spacy** - Natural language processing
- **en_core_web_sm** - spaCy English language model (~20MB download)
- **fuzzywuzzy** - Fuzzy string matching
- **python-Levenshtein** - Performance optimization for fuzzywuzzy
- **requests** - HTTP library for free barcode lookup APIs

All of these are FREE and open-source!








