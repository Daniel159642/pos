#!/usr/bin/env python3
"""
Periodic auto-categorization script
Run this periodically (e.g., daily) to re-categorize products after new ones are added

Usage:
    python3 auto_categorize_periodic.py
"""

from metadata_extraction import FreeMetadataSystem
from sync_categories_to_inventory import sync_categories

def auto_categorize_periodic():
    """
    Run periodic auto-categorization
    Groups all products into categories and syncs to inventory
    """
    print("=" * 70)
    print("Periodic Auto-Categorization")
    print("=" * 70)
    print()
    
    metadata_system = FreeMetadataSystem()
    
    # Run K-Means clustering (with optional LLM naming)
    print("Running K-Means clustering...")
    try:
        metadata_system.auto_categorize_products_kmeans(min_products_per_category=3)
        print("✓ Clustering completed")
    except Exception as e:
        print(f"⚠ Clustering error: {e}")
        return
    
    # Sync categories to inventory table
    print()
    print("Syncing categories to inventory...")
    try:
        sync_categories()
        print("✓ Categories synced")
    except Exception as e:
        print(f"⚠ Category sync error: {e}")
    
    print()
    print("=" * 70)
    print("✓ Periodic categorization complete!")
    print("=" * 70)

if __name__ == '__main__':
    auto_categorize_periodic()

