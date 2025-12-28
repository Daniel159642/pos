#!/usr/bin/env python3
"""
Quick script to check which dependencies are installed
"""

import sys

print("=" * 60)
print("Checking Metadata Extraction Dependencies")
print("=" * 60)
print()

dependencies = {
    'scikit-learn': 'sklearn',
    'spacy': 'spacy',
    'fuzzywuzzy': 'fuzzywuzzy',
    'requests': 'requests',
    'python-Levenshtein': 'Levenshtein'
}

installed = []
missing = []

for package_name, import_name in dependencies.items():
    try:
        __import__(import_name)
        installed.append(package_name)
        print(f"✓ {package_name}: INSTALLED")
    except ImportError:
        missing.append(package_name)
        print(f"✗ {package_name}: NOT INSTALLED")

print()

# Check spaCy model
try:
    import spacy
    try:
        spacy.load('en_core_web_sm')
        print("✓ spaCy model 'en_core_web_sm': INSTALLED")
    except OSError:
        print("✗ spaCy model 'en_core_web_sm': NOT INSTALLED")
        missing.append('spacy-model')
except ImportError:
    pass

print()
print("=" * 60)

if missing:
    print(f"\n⚠ Missing {len(missing)} dependencies:")
    for pkg in missing:
        if pkg == 'spacy-model':
            print("  - spaCy model (run: python3 -m spacy download en_core_web_sm)")
        else:
            print(f"  - {pkg}")
    print("\nInstall with:")
    print("  pip3 install scikit-learn spacy fuzzywuzzy python-Levenshtein requests")
    print("  python3 -m spacy download en_core_web_sm")
else:
    print("\n✓ All dependencies are installed!")
    print("The metadata extraction system is ready with full functionality!")

print()

