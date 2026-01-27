#!/usr/bin/env python3
"""
Sync categories from product_metadata to inventory.category field.
Updates inventory table so the frontend can display categories.
Uses category_confidence threshold (default 0.3); only syncs when confidence >= threshold.
"""

import logging
import re

from database import get_connection

logger = logging.getLogger(__name__)


def sync_categories(min_confidence: float = 0.3):
    """Update inventory.category from product_metadata categories (PostgreSQL)."""
    conn = get_connection()
    cursor = conn.cursor()

    logger.info("Syncing categories from metadata to inventory (min_confidence=%.2f)...", min_confidence)

    cursor.execute("""
        SELECT
            i.product_id,
            i.product_name,
            i.category AS current_category,
            c.category_name AS metadata_category,
            COALESCE(pm.category_confidence, 0) AS category_confidence
        FROM inventory i
        LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
        LEFT JOIN categories c ON pm.category_id = c.category_id
        WHERE c.category_name IS NOT NULL
          AND COALESCE(pm.category_confidence, 0) >= %s
    """, (min_confidence,))

    products = cursor.fetchall()
    updated = 0

    for row in products:
        product_id = row[0]
        product_name = row[1]
        current_category = row[2]
        metadata_category = row[3]
        if not metadata_category:
            continue
        category_parts = [p.strip() for p in re.split(r'[>→]', metadata_category) if p.strip()]
        most_specific = category_parts[-1] if category_parts else metadata_category

        if current_category != most_specific:
            cursor.execute("""
                UPDATE inventory
                SET category = %s, updated_at = CURRENT_TIMESTAMP
                WHERE product_id = %s
            """, (most_specific, product_id))
            logger.info("Updated %s: %r -> %r", product_name, current_category or "None", most_specific)
            updated += 1

    conn.commit()
    conn.close()
    logger.info("Synced %d products with categories.", updated)
    return updated


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sync_categories()









