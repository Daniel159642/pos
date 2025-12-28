#!/usr/bin/env python3
"""
Free Metadata Extraction System using local AI models and free APIs
Completely FREE - no paid services required
"""

import sqlite3
import json
import re
from typing import Dict, List, Optional
from collections import Counter
import time

# Optional: requests for barcode lookup (will fail gracefully if not installed)
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("Warning: requests not installed. Barcode lookup will be disabled. Install with: pip install requests")

# Optional: sklearn for ML features (will fail gracefully if not installed)
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("Warning: scikit-learn not installed. Clustering and advanced search will be disabled. Install with: pip install scikit-learn")

# Optional: fuzzywuzzy for fuzzy matching (will fail gracefully if not installed)
try:
    from fuzzywuzzy import fuzz
    FUZZYWUZZY_AVAILABLE = True
except ImportError:
    FUZZYWUZZY_AVAILABLE = False
    print("Warning: fuzzywuzzy not installed. Fuzzy matching will be disabled. Install with: pip install fuzzywuzzy")

# Optional: spaCy for NLP (will fail gracefully if not installed)
try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    print("Warning: spaCy not installed. Install with: pip install spacy && python -m spacy download en_core_web_sm")

# Optional: Ollama for LLM-based category naming (will fail gracefully if not installed)
try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    # Don't print warning by default - it's optional

from database import get_connection, DB_NAME


class FreeMetadataSystem:
    
    def __init__(self):
        # Load spaCy for NLP (free, runs locally)
        self.nlp = None
        if SPACY_AVAILABLE:
            try:
                self.nlp = spacy.load("en_core_web_sm")
            except OSError:
                print("Warning: spaCy model 'en_core_web_sm' not found.")
                print("Install with: python -m spacy download en_core_web_sm")
                self.nlp = None
        
        # Load product knowledge base
        self.category_keywords = self._load_category_keywords()
        self.brand_list = self._load_known_brands()
    
    def _load_category_keywords(self):
        """
        Predefined category keywords - completely free
        Add more as needed for your store
        """
        return {
            'Electronics': [
                'phone', 'computer', 'laptop', 'tablet', 'headphone', 'speaker',
                'camera', 'tv', 'monitor', 'keyboard', 'mouse', 'charger', 
                'cable', 'adapter', 'battery', 'electronics', 'digital', 
                'wireless', 'bluetooth', 'usb', 'hdmi'
            ],
            'Clothing': [
                'shirt', 'pants', 'dress', 'jacket', 'coat', 'shoes', 'socks',
                'hat', 'gloves', 'scarf', 'jeans', 'sweater', 'hoodie', 'shorts',
                'skirt', 'blouse', 't-shirt', 'clothing', 'apparel', 'wear',
                'cotton', 'polyester', 'fabric', 'size', 'small', 'medium', 'large'
            ],
            'Home & Kitchen': [
                'kitchen', 'cookware', 'pan', 'pot', 'plate', 'bowl', 'cup',
                'utensil', 'knife', 'spoon', 'fork', 'appliance', 'blender',
                'toaster', 'microwave', 'furniture', 'chair', 'table', 'lamp',
                'bedding', 'towel', 'curtain', 'storage', 'container'
            ],
            'Beauty & Personal Care': [
                'shampoo', 'soap', 'lotion', 'cream', 'perfume', 'makeup',
                'cosmetic', 'skincare', 'haircare', 'brush', 'comb', 'razor',
                'toothbrush', 'toothpaste', 'deodorant', 'beauty', 'care'
            ],
            'Food & Beverage': [
                'food', 'snack', 'drink', 'beverage', 'coffee', 'tea', 'juice',
                'soda', 'water', 'milk', 'bread', 'cereal', 'pasta', 'rice',
                'sauce', 'spice', 'candy', 'chocolate', 'cookie', 'chip'
            ],
            'Sports & Outdoors': [
                'sports', 'fitness', 'exercise', 'gym', 'ball', 'bat', 'racket',
                'outdoor', 'camping', 'hiking', 'fishing', 'bike', 'bicycle',
                'skateboard', 'yoga', 'weights', 'dumbbell', 'treadmill'
            ],
            'Toys & Games': [
                'toy', 'game', 'puzzle', 'doll', 'action figure', 'lego',
                'board game', 'card game', 'video game', 'play', 'kids',
                'children', 'baby', 'infant', 'educational'
            ],
            'Books & Stationery': [
                'book', 'novel', 'magazine', 'pen', 'pencil', 'notebook',
                'paper', 'marker', 'eraser', 'ruler', 'stapler', 'tape',
                'folder', 'binder', 'envelope', 'stationery', 'office'
            ],
            'Tools & Hardware': [
                'tool', 'hammer', 'screwdriver', 'drill', 'saw', 'wrench',
                'pliers', 'hardware', 'screw', 'nail', 'bolt', 'nut',
                'paint', 'brush', 'tape measure', 'ladder', 'toolbox'
            ],
            'Health & Wellness': [
                'vitamin', 'supplement', 'medicine', 'pill', 'tablet',
                'capsule', 'health', 'wellness', 'bandage', 'thermometer',
                'mask', 'sanitizer', 'first aid', 'medical'
            ],
            'Pet Supplies': [
                'pet', 'dog', 'cat', 'bird', 'fish', 'animal', 'food',
                'treat', 'toy', 'collar', 'leash', 'cage', 'aquarium',
                'litter', 'bowl', 'bed'
            ],
            'Automotive': [
                'car', 'auto', 'vehicle', 'tire', 'oil', 'filter', 'brake',
                'engine', 'battery', 'wiper', 'light', 'mirror', 'seat',
                'cover', 'mat', 'accessories', 'parts'
            ]
        }
    
    def _load_known_brands(self):
        """
        Common brand names - free database
        Expand this list based on your inventory
        """
        return [
            # Electronics
            'Apple', 'Samsung', 'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'Asus',
            'Microsoft', 'Google', 'Amazon', 'Bose', 'JBL', 'Canon', 'Nikon',
            
            # Clothing
            'Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok', 'Levi', 'Gap',
            'H&M', 'Zara', 'Uniqlo', 'Champion', 'Vans', 'Converse',
            
            # Home
            'IKEA', 'Cuisinart', 'KitchenAid', 'Pyrex', 'Rubbermaid', 'Tupperware',
            
            # Beauty
            'Olay', 'Dove', 'Neutrogena', 'Revlon', 'Maybelline', 'CoverGirl',
            
            # Food
            'Coca-Cola', 'Pepsi', 'Nestle', 'Kraft', 'General Mills', 'Kellogg',
            
            # Add more brands relevant to your store
        ]
    
    def extract_metadata_from_product(self, product_name, barcode=None, 
                                     description=None, vendor_data=None):
        """
        Extract metadata using FREE methods only
        """
        start_time = time.time()
        
        metadata = {
            'keywords': [],
            'tags': [],
            'attributes': {},
            'brand': None,
            'category_suggestions': [],
            'confidence_scores': {}
        }
        
        # 1. Free barcode lookup (Open Product Data)
        if barcode:
            barcode_metadata = self._free_barcode_lookup(barcode)
            if barcode_metadata:
                metadata = self._merge_metadata(metadata, barcode_metadata)
        
        # 2. Parse product name using rules and NLP
        name_metadata = self._parse_with_nlp(product_name)
        metadata = self._merge_metadata(metadata, name_metadata)
        
        # 3. Extract from description
        if description:
            desc_metadata = self._parse_with_nlp(description)
            metadata = self._merge_metadata(metadata, desc_metadata)
        
        # 4. Use vendor data
        if vendor_data:
            metadata = self._merge_metadata(metadata, vendor_data)
        
        # 5. Rule-based categorization (FREE)
        category_match = self._match_category(metadata)
        if category_match:
            metadata['category_suggestions'] = [category_match]
        
        # 6. Extract brand
        brand = self._extract_brand(product_name)
        if brand:
            metadata['brand'] = brand
        
        # 7. Extract attributes (color, size, etc.)
        attributes = self._extract_attributes(product_name, description)
        metadata['attributes'].update(attributes)
        
        execution_time = int((time.time() - start_time) * 1000)
        metadata['execution_time_ms'] = execution_time
        
        return metadata
    
    def _free_barcode_lookup(self, barcode):
        """
        Use FREE barcode APIs (no API key needed)
        """
        metadata = {}
        
        if not REQUESTS_AVAILABLE:
            return metadata
        
        try:
            # Option 1: Open Food Facts (free, no API key)
            if len(barcode) == 13 or len(barcode) == 12:  # EAN/UPC
                response = requests.get(
                    f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json",
                    timeout=3
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('status') == 1:
                        product = data.get('product', {})
                        
                        metadata = {
                            'brand': product.get('brands'),
                            'keywords': product.get('product_name', '').split() if product.get('product_name') else [],
                            'category_suggestions': [product.get('categories_tags', [''])[0]] if product.get('categories_tags') else [],
                            'attributes': {
                                'quantity': product.get('quantity'),
                                'packaging': product.get('packaging')
                            }
                        }
        
        except Exception as e:
            # Silently fail - barcode lookup is optional
            pass
        
        return metadata
    
    def _parse_with_nlp(self, text):
        """
        Use spaCy NLP (FREE, runs locally) to extract metadata
        Falls back to simple rule-based extraction if spaCy not available
        """
        metadata = {
            'keywords': [],
            'tags': [],
            'attributes': {},
            'entities': []
        }
        
        if not text:
            return metadata
        
        # Use spaCy if available
        if self.nlp:
            doc = self.nlp(text.lower())
            
            # Extract named entities
            for ent in doc.ents:
                if ent.label_ in ['PRODUCT', 'ORG', 'GPE', 'MONEY', 'QUANTITY']:
                    metadata['entities'].append({
                        'text': ent.text,
                        'type': ent.label_
                    })
            
            # Extract nouns and adjectives as keywords
            for token in doc:
                if token.pos_ in ['NOUN', 'PROPN'] and len(token.text) > 2:
                    metadata['keywords'].append(token.text)
                elif token.pos_ == 'ADJ' and len(token.text) > 3:
                    metadata['tags'].append(token.text)
        else:
            # Fallback: simple word extraction
            words = re.findall(r'\b[a-z]{3,}\b', text.lower())
            # Filter out common stop words
            stop_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'way', 'use', 'her', 'she', 'him', 'his', 'its', 'our', 'out', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how'}
            metadata['keywords'] = [w for w in words if w not in stop_words][:20]
        
        # Remove duplicates
        metadata['keywords'] = list(set(metadata['keywords']))
        metadata['tags'] = list(set(metadata['tags']))
        
        return metadata
    
    def _extract_brand(self, text):
        """
        Extract brand using rule-based matching
        """
        text_lower = text.lower()
        
        # Check against known brands
        for brand in self.brand_list:
            if brand.lower() in text_lower:
                return brand
        
        # Check if first word is capitalized (often a brand)
        words = text.split()
        if words and words[0][0].isupper() and len(words[0]) > 2:
            # Check if it's not a common word
            common_words = ['the', 'a', 'an', 'new', 'used', 'vintage']
            if words[0].lower() not in common_words:
                return words[0]
        
        return None
    
    def _extract_attributes(self, name, description=None):
        """
        Extract product attributes using regex patterns
        """
        text = f"{name} {description or ''}"
        attributes = {}
        
        # Color extraction
        colors = [
            'red', 'blue', 'green', 'yellow', 'black', 'white', 'pink',
            'purple', 'orange', 'brown', 'gray', 'grey', 'silver', 'gold',
            'navy', 'turquoise', 'magenta', 'cyan', 'beige', 'tan'
        ]
        for color in colors:
            if re.search(rf'\b{color}\b', text, re.IGNORECASE):
                attributes['color'] = color
                break
        
        # Size extraction
        size_patterns = [
            (r'\b(small|medium|large|x-?large|xx-?large)\b', 'size'),
            (r'\b([XS|S|M|L|XL|XXL|XXXL])\b', 'size'),
            (r'\b(\d+(?:\.\d+)?)\s*(oz|ml|L|lb|kg|g|inch|in|cm|mm|ft|gallon|qt)\b', 'measurement'),
        ]
        
        for pattern, attr_name in size_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                attributes[attr_name] = match.group(0)
        
        # Material extraction
        materials = [
            'plastic', 'metal', 'wood', 'glass', 'fabric', 'cotton',
            'polyester', 'leather', 'stainless', 'aluminum', 'steel',
            'ceramic', 'rubber', 'silicone', 'nylon'
        ]
        for material in materials:
            if re.search(rf'\b{material}\b', text, re.IGNORECASE):
                attributes['material'] = material
                break
        
        # Quantity/Pack size
        pack_match = re.search(r'(\d+)\s*[-]?\s*pack', text, re.IGNORECASE)
        if pack_match:
            attributes['pack_size'] = pack_match.group(1)
        
        return attributes
    
    def _match_category(self, metadata):
        """
        Match product to category using keyword matching
        """
        # Combine all text data
        all_text = ' '.join(
            metadata.get('keywords', []) +
            metadata.get('tags', []) +
            [str(v) for v in metadata.get('attributes', {}).values()]
        ).lower()
        
        # Score each category
        category_scores = {}
        
        for category, keywords in self.category_keywords.items():
            score = 0
            for keyword in keywords:
                if keyword in all_text:
                    score += 1
            
            if score > 0:
                category_scores[category] = score
        
        # Return best match
        if category_scores:
            best_category = max(category_scores.items(), key=lambda x: x[1])
            return {
                'category_name': best_category[0],
                'confidence': min(best_category[1] / 10, 1.0)  # Normalize
            }
        
        return None
    
    def _generate_category_name_with_llm(self, product_names: List[str], top_keywords: List[str]) -> Optional[str]:
        """
        Generate a better category name using local LLM (Mistral via Ollama)
        Falls back to keyword-based naming if LLM not available
        """
        if not OLLAMA_AVAILABLE:
            return None
        
        try:
            # Create prompt for LLM
            products_list = ', '.join(product_names[:8])  # Limit products shown
            keywords_list = ', '.join(top_keywords[:5])  # Include top keywords
            
            prompt = f"""These products belong to the same category:
{products_list}

Key terms: {keywords_list}

Generate a concise, clear category name (1-3 words). Examples: "Fresh Vegetables", "Organic Produce", "Dairy Products".

Category name only (no explanation):"""
            
            # Try to generate with Ollama
            response = ollama.generate(
                model='mistral',  # or 'llama2', 'llama3', etc.
                prompt=prompt,
                options={
                    'temperature': 0.3,  # Lower temperature for more deterministic results
                    'num_predict': 20   # Short response
                }
            )
            
            # Extract category name from response
            category_name = response.get('response', '').strip()
            
            # Clean up the response (remove quotes, take first line, etc.)
            category_name = category_name.split('\n')[0].strip()
            category_name = category_name.strip('"\'')
            
            # Validate it's reasonable (1-4 words, reasonable length)
            words = category_name.split()
            if 1 <= len(words) <= 4 and len(category_name) <= 50:
                return category_name.title()
            else:
                return None
                
        except Exception as e:
            # Silently fail and fall back to keyword-based naming
            # Uncomment for debugging: print(f"LLM category generation failed: {e}")
            return None
    
    def _merge_metadata(self, base, new):
        """
        Merge two metadata dictionaries
        """
        merged = base.copy()
        
        for key, value in new.items():
            if key not in merged or not merged[key]:
                merged[key] = value
            elif isinstance(value, list):
                merged[key] = list(set(merged.get(key, []) + value))
            elif isinstance(value, dict):
                if key not in merged:
                    merged[key] = {}
                merged[key].update(value)
        
        return merged
    
    def save_product_metadata(self, product_id, metadata, extraction_method='auto'):
        """
        Save extracted metadata to database (SQLite)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Prepare data
            attributes = metadata.get('attributes', {})
            keywords = metadata.get('keywords', [])
            tags = metadata.get('tags', [])
            
            # Build search vector
            search_vector = ' '.join([
                metadata.get('brand', ''),
                ' '.join(keywords),
                ' '.join(tags),
                json.dumps(attributes)
            ])
            
            # Get suggested category
            category_suggestions = metadata.get('category_suggestions', [])
            category_match = category_suggestions[0] if category_suggestions else None
            category_id = None
            confidence = 0
            
            if category_match:
                # Find or create category
                cursor.execute("""
                    SELECT category_id FROM categories
                    WHERE category_name = ?
                """, (category_match.get('category_name'),))
                
                result = cursor.fetchone()
                if result:
                    category_id = result[0]
                else:
                    # Create new category
                    cursor.execute("""
                        INSERT INTO categories (category_name, is_auto_generated)
                        VALUES (?, 1)
                    """, (category_match.get('category_name'),))
                    category_id = cursor.lastrowid
                
                confidence = category_match.get('confidence', 0)
            
            # Insert or update metadata (SQLite uses INSERT OR REPLACE)
            # First check if record exists
            cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = ?", (product_id,))
            exists = cursor.fetchone()
            
            if exists:
                cursor.execute("""
                    UPDATE product_metadata SET
                        brand = ?,
                        color = ?,
                        size = ?,
                        tags = ?,
                        keywords = ?,
                        attributes = ?,
                        search_vector = ?,
                        category_id = ?,
                        category_confidence = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE product_id = ?
                """, (
                    metadata.get('brand'),
                    attributes.get('color'),
                    attributes.get('size'),
                    json.dumps(tags[:20]),  # Limit to 20 tags
                    json.dumps(keywords[:30]),  # Limit to 30 keywords
                    json.dumps(attributes),
                    search_vector,
                    category_id,
                    confidence,
                    product_id
                ))
            else:
                cursor.execute("""
                    INSERT INTO product_metadata 
                    (product_id, brand, color, size, tags, keywords, 
                     attributes, search_vector, category_id, category_confidence, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                product_id,
                metadata.get('brand'),
                attributes.get('color'),
                attributes.get('size'),
                json.dumps(tags[:20]),  # Limit to 20 tags
                json.dumps(keywords[:30]),  # Limit to 30 keywords
                json.dumps(attributes),
                search_vector,
                category_id,
                confidence
            ))
            
            # Log extraction
            execution_time = metadata.get('execution_time_ms', 0)
            cursor.execute("""
                INSERT INTO metadata_extraction_log
                (product_id, extraction_method, data_extracted, execution_time_ms, success)
                VALUES (?, ?, ?, ?, 1)
            """, (product_id, extraction_method, json.dumps(metadata), execution_time))
            
            conn.commit()
            
        except Exception as e:
            conn.rollback()
            # Log error
            try:
                cursor.execute("""
                    INSERT INTO metadata_extraction_log
                    (product_id, extraction_method, success, error_message)
                    VALUES (?, ?, 0, ?)
                """, (product_id, extraction_method, str(e)))
                conn.commit()
            except:
                pass
            raise
        finally:
            conn.close()
    
    def auto_categorize_products_kmeans(self, min_products_per_category=5):
        """
        Auto-categorize using K-Means clustering (FREE, runs locally)
        """
        if not SKLEARN_AVAILABLE:
            raise Exception("scikit-learn is required for K-Means clustering. Install with: pip install scikit-learn")
        
        conn = get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all products with keywords
        cursor.execute("""
            SELECT 
                i.product_id,
                i.product_name,
                pm.keywords,
                pm.tags,
                pm.brand
            FROM inventory i
            LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
            WHERE pm.keywords IS NOT NULL
        """)
        
        products = cursor.fetchall()
        
        if len(products) < min_products_per_category * 2:
            print("Not enough products for clustering")
            cursor.close()
            conn.close()
            return
        
        # Create text features
        product_texts = []
        product_ids = []
        product_names_map = {}  # Map product_id to product_name for LLM naming
        
        for product in products:
            keywords = json.loads(product['keywords']) if product['keywords'] else []
            tags = json.loads(product['tags']) if product['tags'] else []
            brand = product['brand'] or ''
            
            text = ' '.join([brand] + keywords + tags)
            product_texts.append(text)
            product_ids.append(product['product_id'])
            product_names_map[product['product_id']] = product['product_name']
        
        # TF-IDF vectorization (FREE)
        vectorizer = TfidfVectorizer(
            max_features=100,
            stop_words='english',
            ngram_range=(1, 2)
        )
        X = vectorizer.fit_transform(product_texts)
        
        # Determine number of clusters
        n_clusters = max(3, len(products) // min_products_per_category)
        n_clusters = min(n_clusters, 15)
        
        # K-Means clustering (FREE)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(X)
        
        # Generate category names from cluster keywords
        feature_names = vectorizer.get_feature_names_out()
        
        for cluster_id in range(n_clusters):
            # Get cluster center
            center = kmeans.cluster_centers_[cluster_id]
            
            # Get top features for this cluster
            top_indices = center.argsort()[-5:][::-1]
            top_words = [feature_names[i] for i in top_indices]
            
            # Get products in this cluster for LLM naming
            cluster_product_ids = [
                product_ids[i] for i, c in enumerate(clusters) if c == cluster_id
            ]
            cluster_product_names = [
                product_names_map[product_ids[i]] 
                for i, c in enumerate(clusters) if c == cluster_id
            ]
            
            # Try to generate category name with LLM (hybrid approach)
            category_name = self._generate_category_name_with_llm(
                cluster_product_names[:10],  # Limit to 10 products for prompt
                top_words
            )
            
            # Fallback to keyword-based name if LLM fails
            if not category_name:
                category_name = ' '.join(top_words[:3]).title()
            
            # Check if similar category exists
            cursor.execute("""
                SELECT category_id FROM categories
                WHERE category_name = ?
            """, (category_name,))
            
            result = cursor.fetchone()
            
            if result:
                category_id = result['category_id']
            else:
                cursor.execute("""
                    INSERT INTO categories (category_name, is_auto_generated)
                    VALUES (?, 1)
                """, (category_name,))
                category_id = cursor.lastrowid
            
            # Assign products to category (use the cluster_product_ids we already computed)
            for prod_id in cluster_product_ids:
                cursor.execute("""
                    UPDATE product_metadata
                    SET category_id = ?,
                        category_confidence = 0.80
                    WHERE product_id = ?
                """, (category_id, prod_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"Created {n_clusters} categories using K-Means clustering")
    
    def intelligent_search(self, query, limit=20, filters=None):
        """
        Search using TF-IDF similarity (FREE, runs locally)
        Falls back to simple text matching if scikit-learn not available
        """
        conn = get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all products (barcode column may not exist in older databases)
        try:
            cursor.execute("""
                SELECT 
                    i.product_id,
                    i.product_name,
                    i.sku,
                    i.barcode,
                    i.product_price,
                    i.current_quantity,
                    pm.brand,
                    pm.category_id,
                    c.category_name,
                    pm.tags,
                    pm.keywords,
                    pm.attributes,
                    pm.search_vector
                FROM inventory i
                LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
                LEFT JOIN categories c ON pm.category_id = c.category_id
            """)
        except sqlite3.OperationalError:
            # Fallback if barcode column doesn't exist
            cursor.execute("""
                SELECT 
                    i.product_id,
                    i.product_name,
                    i.sku,
                    NULL as barcode,
                    i.product_price,
                    i.current_quantity,
                    pm.brand,
                    pm.category_id,
                    c.category_name,
                    pm.tags,
                    pm.keywords,
                    pm.attributes,
                    pm.search_vector
                FROM inventory i
                LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
                LEFT JOIN categories c ON pm.category_id = c.category_id
            """)
        
        all_products = cursor.fetchall()
        
        if not SKLEARN_AVAILABLE:
            # Fallback to simple text matching
            query_lower = query.lower()
            results = []
            for product in all_products:
                product_name = product['product_name'].lower()
                search_vector = (product['search_vector'] or '').lower()
                
                # Simple relevance: count word matches
                query_words = set(query_lower.split())
                product_words = set((product_name + ' ' + search_vector).split())
                relevance = len(query_words & product_words) / len(query_words) if query_words else 0
                
                if relevance > 0:
                    # Apply filters
                    if filters:
                        if 'category_id' in filters and product['category_id'] != filters['category_id']:
                            continue
                        if 'brand' in filters and product['brand'] != filters['brand']:
                            continue
                        if 'min_price' in filters and product['product_price'] < filters['min_price']:
                            continue
                        if 'max_price' in filters and product['product_price'] > filters['max_price']:
                            continue
                    
                    result_dict = dict(product)
                    result_dict['relevance_score'] = relevance
                    results.append(result_dict)
            
            # Sort by relevance
            results.sort(key=lambda x: x['relevance_score'], reverse=True)
            results = results[:limit]
        else:
            # Build corpus
            corpus = [p['search_vector'] or '' for p in all_products]
            corpus.append(query)
            
            # TF-IDF vectorization
            vectorizer = TfidfVectorizer(stop_words='english')
            tfidf_matrix = vectorizer.fit_transform(corpus)
            
            # Calculate similarity
            query_vector = tfidf_matrix[-1]
            similarities = cosine_similarity(query_vector, tfidf_matrix[:-1])[0]
            
            # Rank products
            ranked_indices = similarities.argsort()[::-1]
            
            # Filter results
            results = []
            for idx in ranked_indices:
                if similarities[idx] < 0.1:  # Threshold
                    break
                
                product = all_products[idx]
                
                # Apply filters
                if filters:
                    if 'category_id' in filters and product['category_id'] != filters['category_id']:
                        continue
                    if 'brand' in filters and product['brand'] != filters['brand']:
                        continue
                    if 'min_price' in filters and product['product_price'] < filters['min_price']:
                        continue
                    if 'max_price' in filters and product['product_price'] > filters['max_price']:
                        continue
                
                result_dict = dict(product)
                result_dict['relevance_score'] = float(similarities[idx])
                results.append(result_dict)
                
                if len(results) >= limit:
                    break
        
        # Log search
        try:
            cursor.execute("""
                INSERT INTO search_history (search_query, results_count)
                VALUES (?, ?)
            """, (query, len(results)))
            conn.commit()
        except:
            pass
        
        cursor.close()
        conn.close()
        
        return results


if __name__ == '__main__':
    # Test the system
    system = FreeMetadataSystem()
    
    # Test extraction
    metadata = system.extract_metadata_from_product(
        "Nike Air Max Running Shoes Size 10 Black",
        description="High-performance running shoes with air cushioning"
    )
    
    print("Extracted Metadata:")
    print(json.dumps(metadata, indent=2))

