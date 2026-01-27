#!/usr/bin/env python3
"""
Free Metadata Extraction System using local AI models and free APIs
Completely FREE - no paid services required
"""

import json
import logging
import re
import time
from collections import Counter
from typing import Dict, List, Optional

import psycopg2

logger = logging.getLogger(__name__)

# Optional: requests for barcode lookup (will fail gracefully if not installed)
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    logger.warning("requests not installed. Barcode lookup disabled. pip install requests")

# Optional: sklearn for ML features (will fail gracefully if not installed)
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not installed. Clustering disabled. pip install scikit-learn")

# Optional: fuzzywuzzy for fuzzy matching (will fail gracefully if not installed)
try:
    from fuzzywuzzy import fuzz
    FUZZYWUZZY_AVAILABLE = True
except ImportError:
    FUZZYWUZZY_AVAILABLE = False
    logger.warning("fuzzywuzzy not installed. Fuzzy matching disabled. pip install fuzzywuzzy")

# Optional: spaCy for NLP (will fail gracefully if not installed)
try:
    import spacy
    SPACY_AVAILABLE = True
except (ImportError, Exception):
    SPACY_AVAILABLE = False
    # Don't print warning - spaCy is optional and may have compatibility issues

# Optional: Ollama for LLM-based category naming (will fail gracefully if not installed)
try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    # Don't print warning by default - it's optional

from database import get_connection


class FreeMetadataSystem:
    
    def __init__(self):
        # Load spaCy for NLP (free, runs locally)
        self.nlp = None
        if SPACY_AVAILABLE:
            try:
                self.nlp = spacy.load("en_core_web_sm")
            except OSError:
                logger.warning("spaCy model 'en_core_web_sm' not found. python -m spacy download en_core_web_sm")
                self.nlp = None
        
        # Load product knowledge base
        self.category_keywords = self._load_category_keywords()
        self.brand_list = self._load_known_brands()
        self.product_knowledge = self._load_product_knowledge_base()
        self.product_to_category = self._load_product_to_category_mapping()
    
    def _load_product_knowledge_base(self):
        """
        Human-like product knowledge base
        Think like a human: what would you say about an apple? It's crunchy, sweet, red or green, 
        good for snacking, baking, salads. This captures real-world understanding.
        """
        return {
            # Fruits with human-like attributes
            'apple': {
                'category': 'Food & Beverage > Produce > Fruits',
                'type': 'fruit',
                'texture': 'crunchy',
                'taste': 'sweet',
                'colors': ['red', 'green', 'yellow'],
                'uses': ['snack', 'baking', 'salad', 'juice', 'sauce'],
                'characteristics': ['round', 'firm', 'juicy', 'refreshing', 'healthy'],
                'storage': 'refrigerate',
                'description': 'Crisp, sweet fruit perfect for snacking or cooking'
            },
            'apples': {
                'category': 'Food & Beverage > Produce > Fruits',
                'type': 'fruit',
                'texture': 'crunchy',
                'taste': 'sweet',
                'colors': ['red', 'green', 'yellow'],
                'uses': ['snack', 'baking', 'salad', 'juice', 'sauce'],
                'characteristics': ['round', 'firm', 'juicy', 'refreshing', 'healthy'],
                'storage': 'refrigerate',
                'description': 'Crisp, sweet fruit perfect for snacking or cooking'
            },
            'banana': {
                'category': 'Food & Beverage > Produce > Fruits',
                'type': 'fruit',
                'texture': 'soft',
                'taste': 'sweet',
                'colors': ['yellow', 'green'],
                'uses': ['snack', 'smoothie', 'baking', 'cereal'],
                'characteristics': ['curved', 'creamy', 'portable', 'energy', 'potassium'],
                'storage': 'room temperature',
                'description': 'Sweet, creamy fruit great for quick energy'
            },
            'bananas': {
                'category': 'Food & Beverage > Produce > Fruits',
                'type': 'fruit',
                'texture': 'soft',
                'taste': 'sweet',
                'colors': ['yellow', 'green'],
                'uses': ['snack', 'smoothie', 'baking', 'cereal'],
                'characteristics': ['curved', 'creamy', 'portable', 'energy', 'potassium'],
                'storage': 'room temperature',
                'description': 'Sweet, creamy fruit great for quick energy'
            },
            'cucumber': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crisp',
                'taste': 'mild',
                'colors': ['green'],
                'uses': ['salad', 'pickle', 'snack', 'smoothie', 'garnish'],
                'characteristics': ['refreshing', 'hydrating', 'cool', 'long', 'cylindrical', 'high water'],
                'storage': 'refrigerate',
                'description': 'Cool, crisp vegetable perfect for salads and refreshing snacks'
            },
            'cucumbers': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crisp',
                'taste': 'mild',
                'colors': ['green'],
                'uses': ['salad', 'pickle', 'snack', 'smoothie', 'garnish'],
                'characteristics': ['refreshing', 'hydrating', 'cool', 'long', 'cylindrical', 'high water'],
                'storage': 'refrigerate',
                'description': 'Cool, crisp vegetable perfect for salads and refreshing snacks'
            },
            'tomato': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'juicy',
                'taste': 'sweet',
                'colors': ['red', 'yellow', 'green'],
                'uses': ['salad', 'sauce', 'soup', 'sandwich', 'cooking'],
                'characteristics': ['juicy', 'versatile', 'round', 'fresh', 'flavorful'],
                'storage': 'room temperature',
                'description': 'Juicy, versatile vegetable used in countless dishes'
            },
            'tomatoes': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'juicy',
                'taste': 'sweet',
                'colors': ['red', 'yellow', 'green'],
                'uses': ['salad', 'sauce', 'soup', 'sandwich', 'cooking'],
                'characteristics': ['juicy', 'versatile', 'round', 'fresh', 'flavorful'],
                'storage': 'room temperature',
                'description': 'Juicy, versatile vegetable used in countless dishes'
            },
            'cherry tomato': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'juicy',
                'taste': 'sweet',
                'colors': ['red', 'yellow'],
                'uses': ['salad', 'snack', 'garnish', 'roasting'],
                'characteristics': ['small', 'sweet', 'bite-sized', 'pop', 'bursting'],
                'storage': 'room temperature',
                'description': 'Small, sweet tomatoes perfect for snacking and salads'
            },
            'cherry tomatoes': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'juicy',
                'taste': 'sweet',
                'colors': ['red', 'yellow'],
                'uses': ['salad', 'snack', 'garnish', 'roasting'],
                'characteristics': ['small', 'sweet', 'bite-sized', 'pop', 'bursting'],
                'storage': 'room temperature',
                'description': 'Small, sweet tomatoes perfect for snacking and salads'
            },
            'carrot': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crunchy',
                'taste': 'sweet',
                'colors': ['orange', 'purple', 'yellow'],
                'uses': ['snack', 'cooking', 'salad', 'juice', 'soup'],
                'characteristics': ['crunchy', 'sweet', 'long', 'root', 'vitamin a', 'healthy'],
                'storage': 'refrigerate',
                'description': 'Crunchy, sweet root vegetable great for snacking and cooking'
            },
            'carrots': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crunchy',
                'taste': 'sweet',
                'colors': ['orange', 'purple', 'yellow'],
                'uses': ['snack', 'cooking', 'salad', 'juice', 'soup'],
                'characteristics': ['crunchy', 'sweet', 'long', 'root', 'vitamin a', 'healthy'],
                'storage': 'refrigerate',
                'description': 'Crunchy, sweet root vegetable great for snacking and cooking'
            },
            'lettuce': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crisp',
                'taste': 'mild',
                'colors': ['green'],
                'uses': ['salad', 'sandwich', 'wrap', 'garnish'],
                'characteristics': ['leafy', 'fresh', 'crisp', 'light', 'hydrating'],
                'storage': 'refrigerate',
                'description': 'Fresh, crisp leafy green perfect for salads and sandwiches'
            },
            'milk': {
                'category': 'Food & Beverage > Dairy',
                'type': 'dairy',
                'texture': 'liquid',
                'taste': 'creamy',
                'colors': ['white'],
                'uses': ['drink', 'cooking', 'baking', 'cereal', 'coffee'],
                'characteristics': ['creamy', 'nutritious', 'calcium', 'protein', 'versatile'],
                'storage': 'refrigerate',
                'description': 'Creamy, nutritious dairy product essential for cooking and drinking'
            },
            # Add more products as needed
        }
    
    def _load_product_to_category_mapping(self):
        """
        Map specific products to their semantic categories
        This allows "apple" to be categorized as "fruit" even if "fruit" doesn't appear in the name
        """
        # Extract just category mappings from knowledge base for backward compatibility
        knowledge_base = self._load_product_knowledge_base()
        mapping = {}
        for product, info in knowledge_base.items():
            if isinstance(info, dict):
                mapping[product] = info['category']
            else:
                # Handle simple string mappings (backward compatibility)
                mapping[product] = info
        return mapping
    
    def _load_product_knowledge_base(self):
        """
        Human-like product knowledge base
        Think like a human: what would you say about an apple? It's crunchy, sweet, red or green, 
        good for snacking, baking, salads. This captures real-world understanding.
        """
        return {
            # Fruits with human-like attributes
            'apple': {
                'category': 'Food & Beverage > Produce > Fruits',
                'type': 'fruit',
                'texture': 'crunchy',
                'taste': 'sweet',
                'colors': ['red', 'green', 'yellow'],
                'uses': ['snack', 'baking', 'salad', 'juice', 'sauce'],
                'characteristics': ['round', 'firm', 'juicy', 'refreshing', 'healthy'],
                'storage': 'refrigerate',
                'description': 'Crisp, sweet fruit perfect for snacking or cooking'
            },
            'apples': {
                'category': 'Food & Beverage > Produce > Fruits',
                'type': 'fruit',
                'texture': 'crunchy',
                'taste': 'sweet',
                'colors': ['red', 'green', 'yellow'],
                'uses': ['snack', 'baking', 'salad', 'juice', 'sauce'],
                'characteristics': ['round', 'firm', 'juicy', 'refreshing', 'healthy'],
                'storage': 'refrigerate',
                'description': 'Crisp, sweet fruit perfect for snacking or cooking'
            },
            'banana': {
                'category': 'Food & Beverage > Produce > Fruits',
                'type': 'fruit',
                'texture': 'soft',
                'taste': 'sweet',
                'colors': ['yellow', 'green'],
                'uses': ['snack', 'smoothie', 'baking', 'cereal'],
                'characteristics': ['curved', 'creamy', 'portable', 'energy', 'potassium'],
                'storage': 'room temperature',
                'description': 'Sweet, creamy fruit great for quick energy'
            },
            'bananas': {
                'category': 'Food & Beverage > Produce > Fruits',
                'type': 'fruit',
                'texture': 'soft',
                'taste': 'sweet',
                'colors': ['yellow', 'green'],
                'uses': ['snack', 'smoothie', 'baking', 'cereal'],
                'characteristics': ['curved', 'creamy', 'portable', 'energy', 'potassium'],
                'storage': 'room temperature',
                'description': 'Sweet, creamy fruit great for quick energy'
            },
            'cucumber': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crisp',
                'taste': 'mild',
                'colors': ['green'],
                'uses': ['salad', 'pickle', 'snack', 'smoothie', 'garnish'],
                'characteristics': ['refreshing', 'hydrating', 'cool', 'long', 'cylindrical', 'high water'],
                'storage': 'refrigerate',
                'description': 'Cool, crisp vegetable perfect for salads and refreshing snacks'
            },
            'cucumbers': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crisp',
                'taste': 'mild',
                'colors': ['green'],
                'uses': ['salad', 'pickle', 'snack', 'smoothie', 'garnish'],
                'characteristics': ['refreshing', 'hydrating', 'cool', 'long', 'cylindrical', 'high water'],
                'storage': 'refrigerate',
                'description': 'Cool, crisp vegetable perfect for salads and refreshing snacks'
            },
            'tomato': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'juicy',
                'taste': 'sweet',
                'colors': ['red', 'yellow', 'green'],
                'uses': ['salad', 'sauce', 'soup', 'sandwich', 'cooking'],
                'characteristics': ['juicy', 'versatile', 'round', 'fresh', 'flavorful'],
                'storage': 'room temperature',
                'description': 'Juicy, versatile vegetable used in countless dishes'
            },
            'tomatoes': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'juicy',
                'taste': 'sweet',
                'colors': ['red', 'yellow', 'green'],
                'uses': ['salad', 'sauce', 'soup', 'sandwich', 'cooking'],
                'characteristics': ['juicy', 'versatile', 'round', 'fresh', 'flavorful'],
                'storage': 'room temperature',
                'description': 'Juicy, versatile vegetable used in countless dishes'
            },
            'cherry tomato': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'juicy',
                'taste': 'sweet',
                'colors': ['red', 'yellow'],
                'uses': ['salad', 'snack', 'garnish', 'roasting'],
                'characteristics': ['small', 'sweet', 'bite-sized', 'pop', 'bursting'],
                'storage': 'room temperature',
                'description': 'Small, sweet tomatoes perfect for snacking and salads'
            },
            'cherry tomatoes': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'juicy',
                'taste': 'sweet',
                'colors': ['red', 'yellow'],
                'uses': ['salad', 'snack', 'garnish', 'roasting'],
                'characteristics': ['small', 'sweet', 'bite-sized', 'pop', 'bursting'],
                'storage': 'room temperature',
                'description': 'Small, sweet tomatoes perfect for snacking and salads'
            },
            'carrot': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crunchy',
                'taste': 'sweet',
                'colors': ['orange', 'purple', 'yellow'],
                'uses': ['snack', 'cooking', 'salad', 'juice', 'soup'],
                'characteristics': ['crunchy', 'sweet', 'long', 'root', 'vitamin a', 'healthy'],
                'storage': 'refrigerate',
                'description': 'Crunchy, sweet root vegetable great for snacking and cooking'
            },
            'carrots': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crunchy',
                'taste': 'sweet',
                'colors': ['orange', 'purple', 'yellow'],
                'uses': ['snack', 'cooking', 'salad', 'juice', 'soup'],
                'characteristics': ['crunchy', 'sweet', 'long', 'root', 'vitamin a', 'healthy'],
                'storage': 'refrigerate',
                'description': 'Crunchy, sweet root vegetable great for snacking and cooking'
            },
            'lettuce': {
                'category': 'Food & Beverage > Produce > Vegetables',
                'type': 'vegetable',
                'texture': 'crisp',
                'taste': 'mild',
                'colors': ['green'],
                'uses': ['salad', 'sandwich', 'wrap', 'garnish'],
                'characteristics': ['leafy', 'fresh', 'crisp', 'light', 'hydrating'],
                'storage': 'refrigerate',
                'description': 'Fresh, crisp leafy green perfect for salads and sandwiches'
            },
            'milk': {
                'category': 'Food & Beverage > Dairy',
                'type': 'dairy',
                'texture': 'liquid',
                'taste': 'creamy',
                'colors': ['white'],
                'uses': ['drink', 'cooking', 'baking', 'cereal', 'coffee'],
                'characteristics': ['creamy', 'nutritious', 'calcium', 'protein', 'versatile'],
                'storage': 'refrigerate',
                'description': 'Creamy, nutritious dairy product essential for cooking and drinking'
            },
            # Add more products as needed - keep old simple mappings for products not yet in knowledge base
            # Note: 'banana', 'bananas', 'cherry tomato', 'cherry tomatoes' already defined above as dicts
            'orange': 'Food & Beverage > Produce',
            'oranges': 'Food & Beverage > Produce',
            'grape': 'Food & Beverage > Produce',
            'grapes': 'Food & Beverage > Produce',
            'strawberry': 'Food & Beverage > Produce',
            'strawberries': 'Food & Beverage > Produce',
            'blueberry': 'Food & Beverage > Produce',
            'blueberries': 'Food & Beverage > Produce',
            'raspberry': 'Food & Beverage > Produce',
            'raspberries': 'Food & Beverage > Produce',
            'blackberry': 'Food & Beverage > Produce',
            'blackberries': 'Food & Beverage > Produce',
            'peach': 'Food & Beverage > Produce',
            'peaches': 'Food & Beverage > Produce',
            'pear': 'Food & Beverage > Produce',
            'pears': 'Food & Beverage > Produce',
            'plum': 'Food & Beverage > Produce',
            'plums': 'Food & Beverage > Produce',
            'cherry': 'Food & Beverage > Produce',
            'cherries': 'Food & Beverage > Produce',
            'mango': 'Food & Beverage > Produce',
            'mangoes': 'Food & Beverage > Produce',
            'pineapple': 'Food & Beverage > Produce',
            'watermelon': 'Food & Beverage > Produce',
            'melon': 'Food & Beverage > Produce',
            'cantaloupe': 'Food & Beverage > Produce',
            'kiwi': 'Food & Beverage > Produce',
            'avocado': 'Food & Beverage > Produce',
            'avocados': 'Food & Beverage > Produce',
            'lemon': 'Food & Beverage > Produce',
            'lemons': 'Food & Beverage > Produce',
            'lime': 'Food & Beverage > Produce',
            'limes': 'Food & Beverage > Produce',
            
            # Vegetables
            # Note: 'carrot', 'carrots', 'tomato', 'tomatoes' already defined above as dicts
            'lettuce': 'Food & Beverage > Produce > Vegetables',
            'potato': 'Food & Beverage > Produce > Vegetables',
            'potatoes': 'Food & Beverage > Produce > Vegetables',
            'onion': 'Food & Beverage > Produce > Vegetables',
            'onions': 'Food & Beverage > Produce > Vegetables',
            'garlic': 'Food & Beverage > Produce',
            'pepper': 'Food & Beverage > Produce',
            'peppers': 'Food & Beverage > Produce',
            'bell pepper': 'Food & Beverage > Produce',
            # Note: 'cucumber' and 'cucumbers' already defined above as dicts - don't override
            'broccoli': 'Food & Beverage > Produce',
            'cauliflower': 'Food & Beverage > Produce',
            'spinach': 'Food & Beverage > Produce',
            'kale': 'Food & Beverage > Produce',
            'celery': 'Food & Beverage > Produce',
            'corn': 'Food & Beverage > Produce',
            'peas': 'Food & Beverage > Produce',
            'green beans': 'Food & Beverage > Produce',
            'asparagus': 'Food & Beverage > Produce',
            'zucchini': 'Food & Beverage > Produce',
            'squash': 'Food & Beverage > Produce',
            'mushroom': 'Food & Beverage > Produce',
            'mushrooms': 'Food & Beverage > Produce',
            
            # Dairy
            # Note: 'milk' already defined above as dict - don't override
            'cheese': 'Food & Beverage > Dairy',
            'yogurt': 'Food & Beverage > Dairy',
            'butter': 'Food & Beverage > Dairy',
            'cream': 'Food & Beverage > Dairy',
            'sour cream': 'Food & Beverage > Dairy',
            'cottage cheese': 'Food & Beverage > Dairy',
            
            # Beverages
            'coffee': 'Food & Beverage > Beverages',
            'tea': 'Food & Beverage > Beverages',
            'juice': 'Food & Beverage > Beverages',
            'soda': 'Food & Beverage > Beverages',
            'water': 'Food & Beverage > Beverages',
            'beer': 'Food & Beverage > Beverages',
            'wine': 'Food & Beverage > Beverages',
            
            # Add more product mappings as needed
        }
    
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
        # Make sure product_name is in metadata for category matching
        if 'product_name' not in metadata:
            metadata['product_name'] = product_name
        
        # First, try to get human-like product knowledge
        product_knowledge = self._get_product_knowledge(product_name)
        if product_knowledge and isinstance(product_knowledge, dict):
            # Enrich metadata with human-like understanding
            metadata['attributes'].update({
                'type': product_knowledge.get('type'),
                'texture': product_knowledge.get('texture'),
                'taste': product_knowledge.get('taste'),
                'storage': product_knowledge.get('storage'),
                'description': product_knowledge.get('description')
            })
            # Add colors, uses, and characteristics as tags/keywords
            if product_knowledge.get('colors'):
                metadata['tags'].extend(product_knowledge['colors'])
            if product_knowledge.get('uses'):
                metadata['tags'].extend(product_knowledge['uses'])
            if product_knowledge.get('characteristics'):
                metadata['keywords'].extend(product_knowledge['characteristics'])
            
            # Set category from knowledge base
            metadata['category_suggestions'] = [{
                'category_name': product_knowledge['category'],
                'confidence': 0.95
            }]
        else:
            # Fall back to semantic matching
            semantic_match = self._match_product_semantically(product_name)
            if semantic_match:
                metadata['category_suggestions'] = [semantic_match]
            else:
                # Fall back to keyword-based matching
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

        if not metadata.get('category_suggestions'):
            logger.debug(
                "No category_suggestions for product_name=%r barcode=%r",
                product_name, barcode
            )
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
                        tags = product.get('categories_tags') or []
                        path = None
                        if tags:
                            parts = [t.replace("en:", "").replace(":", " ").strip().title() for t in tags if t]
                            path = " > ".join(parts) if parts else (tags[0].replace("en:", "").replace(":", " ").strip().title() or tags[0])
                        metadata = {
                            'brand': product.get('brands'),
                            'keywords': product.get('product_name', '').split() if product.get('product_name') else [],
                            'category_suggestions': [{'category_name': path, 'confidence': 0.9}] if path else [],
                            'attributes': {
                                'quantity': product.get('quantity'),
                                'packaging': product.get('packaging')
                            }
                        }
        
        except Exception as e:
            logger.debug("Barcode lookup failed for %s: %s", barcode, e)
        
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
    
    def _get_product_knowledge(self, product_name):
        """
        Get human-like product knowledge (attributes, uses, characteristics)
        Returns None if product not in knowledge base
        """
        if not product_name:
            return None
        
        product_name_lower = product_name.lower()
        
        # Try full product name first
        if product_name_lower in self.product_knowledge:
            result = self.product_knowledge[product_name_lower]
            return result if isinstance(result, dict) else None
        
        # Try multi-word combinations first (e.g., "cherry tomato", "cherry tomatoes")
        words = product_name_lower.split()
        for i in range(len(words)):
            for j in range(i+1, len(words)+1):
                phrase = ' '.join(words[i:j])
                if phrase in self.product_knowledge:
                    result = self.product_knowledge[phrase]
                    if isinstance(result, dict):
                        return result
        
        # Try individual words (singular/plural)
        for word in words:
            # Remove common prefixes/suffixes
            clean_word = word.strip('.,!?;:()[]{}"\'-')
            if clean_word in self.product_knowledge:
                result = self.product_knowledge[clean_word]
                if isinstance(result, dict):
                    return result
        
        return None
    
    def _match_product_semantically(self, product_name):
        """
        Match product to category based on semantic understanding
        e.g., "apple" -> "fruit" even if "fruit" doesn't appear in the name
        """
        if not product_name:
            return None
        
        product_name_lower = product_name.lower()
        
        # Check each word in the product name against our semantic mapping
        words = product_name_lower.split()
        
        # Try full product name first
        if product_name_lower in self.product_to_category:
            category_path = self.product_to_category[product_name_lower]
            return {
                'category_name': category_path,
                'confidence': 0.95  # High confidence for exact semantic matches
            }
        
        # Try individual words
        for word in words:
            # Remove common prefixes/suffixes
            clean_word = word.strip('.,!?;:()[]{}"\'-')
            if clean_word in self.product_to_category:
                category_path = self.product_to_category[clean_word]
                return {
                    'category_name': category_path,
                    'confidence': 0.90  # High confidence for semantic matches
                }
        
        return None
    
    def _match_category_with_hierarchy(self, metadata):
        """
        Match category with intelligent parent-child hierarchy
        Returns category path like "Electronics > Phones > Smartphones"
        """
        product_name_lower = metadata.get('product_name', '').lower()
        keywords = [k.lower() for k in metadata.get('keywords', [])]
        tags = [t.lower() for t in metadata.get('tags', [])]
        all_text = product_name_lower + ' ' + ' '.join(keywords) + ' ' + ' '.join(tags)
        
        # Helper function to check if keyword matches (handles plurals and word boundaries)
        import re
        def keyword_matches(text, keyword):
            """Check if keyword matches text, handling plurals and word boundaries"""
            # Use word boundaries to avoid partial matches (e.g., "car" in "carrots")
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                return True
            # Try plural/singular variations with word boundaries
            if keyword.endswith('s'):
                # Keyword is plural, try singular
                singular = keyword[:-1]
                pattern = r'\b' + re.escape(singular) + r'\b'
                if re.search(pattern, text, re.IGNORECASE):
                    return True
            else:
                # Keyword is singular, try plural
                plural = keyword + 's'
                pattern = r'\b' + re.escape(plural) + r'\b'
                if re.search(pattern, text, re.IGNORECASE):
                    return True
                # Try 'es' plural
                plural_es = keyword + 'es'
                pattern = r'\b' + re.escape(plural_es) + r'\b'
                if re.search(pattern, text, re.IGNORECASE):
                    return True
            return False
        
        # Define category hierarchy with specific subcategories
        category_hierarchy = {
            'Electronics': {
                'Phones': ['phone', 'smartphone', 'iphone', 'android', 'mobile', 'cell'],
                'Computers': ['computer', 'laptop', 'pc', 'desktop', 'macbook', 'notebook'],
                'Audio': ['headphone', 'speaker', 'earbud', 'audio', 'sound', 'earphone'],
                'Cameras': ['camera', 'dslr', 'mirrorless', 'photography', 'lens'],
                'TV & Video': ['tv', 'television', 'monitor', 'display', 'screen', 'projector'],
                'Accessories': ['charger', 'cable', 'adapter', 'case', 'cover', 'stand']
            },
            'Clothing': {
                'Tops': ['shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'tank', 'polo'],
                'Bottoms': ['pants', 'jeans', 'shorts', 'skirt', 'trousers', 'leggings'],
                'Footwear': ['shoes', 'sneakers', 'boots', 'sandals', 'slippers', 'heels'],
                'Outerwear': ['jacket', 'coat', 'parka', 'windbreaker', 'blazer'],
                'Accessories': ['hat', 'cap', 'gloves', 'scarf', 'belt', 'tie']
            },
            'Food & Beverage': {
                'Snacks': ['snack', 'chip', 'cracker', 'cookie', 'candy', 'nuts'],
                'Beverages': ['drink', 'soda', 'juice', 'water', 'beverage', 'tea', 'coffee'],
                'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
                'Produce': {
                    'Vegetables': ['vegetable', 'onion', 'onions', 'lettuce', 'tomato', 'tomatoes', 'carrot', 'carrots', 'cucumber', 'cucumbers', 'pepper', 'peppers', 'bell pepper', 'broccoli', 'cauliflower', 'spinach', 'kale', 'celery', 'corn', 'peas', 'green beans', 'asparagus', 'zucchini', 'squash', 'mushroom', 'mushrooms', 'potato', 'potatoes', 'garlic'],
                    'Fruits': ['fruit', 'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges', 'grape', 'grapes', 'strawberry', 'strawberries', 'blueberry', 'blueberries', 'raspberry', 'raspberries', 'blackberry', 'blackberries', 'peach', 'peaches', 'pear', 'pears', 'plum', 'plums', 'cherry', 'cherries', 'mango', 'mangoes', 'pineapple', 'watermelon', 'melon', 'cantaloupe', 'kiwi', 'avocado', 'avocados', 'lemon', 'lemons', 'lime', 'limes']
                },
                'Pantry': ['pasta', 'rice', 'cereal', 'flour', 'sugar', 'spice']
            },
            'Home & Kitchen': {
                'Cookware': ['pan', 'pot', 'skillet', 'cookware', 'baking', 'bakeware'],
                'Appliances': ['blender', 'toaster', 'microwave', 'oven', 'mixer', 'coffee maker'],
                'Dining': ['plate', 'bowl', 'cup', 'mug', 'utensil', 'silverware'],
                'Furniture': ['chair', 'table', 'sofa', 'desk', 'shelf', 'cabinet'],
                'Decor': ['lamp', 'curtain', 'picture', 'frame', 'vase', 'candle']
            },
            'Beauty & Personal Care': {
                'Skincare': ['lotion', 'cream', 'moisturizer', 'serum', 'cleanser', 'toner'],
                'Haircare': ['shampoo', 'conditioner', 'hair', 'styling', 'gel', 'spray'],
                'Makeup': ['makeup', 'lipstick', 'foundation', 'mascara', 'eyeshadow'],
                'Fragrance': ['perfume', 'cologne', 'fragrance', 'scent', 'body spray'],
                'Tools': ['brush', 'comb', 'razor', 'tweezers', 'mirror', 'tweezers']
            },
            'Sports & Outdoors': {
                'Fitness': ['weights', 'dumbbell', 'yoga', 'mat', 'resistance', 'exercise'],
                'Outdoor': ['camping', 'hiking', 'backpack', 'tent', 'sleeping', 'gear'],
                'Team Sports': ['ball', 'basketball', 'football', 'soccer', 'baseball'],
                'Water Sports': ['swimming', 'surf', 'paddle', 'kayak', 'snorkel'],
                'Winter Sports': ['ski', 'snowboard', 'ice', 'skate', 'sled']
            },
            'Toys & Games': {
                'Action Figures': ['action', 'figure', 'doll', 'toy', 'character'],
                'Board Games': ['board', 'game', 'puzzle', 'card', 'strategy'],
                'Electronics': ['video', 'game', 'console', 'controller', 'gaming'],
                'Educational': ['educational', 'learning', 'stem', 'science', 'math']
            },
            'Books & Stationery': {
                'Books': ['book', 'novel', 'magazine', 'textbook', 'manual'],
                'Writing': ['pen', 'pencil', 'marker', 'highlighter', 'eraser'],
                'Paper': ['notebook', 'paper', 'journal', 'planner', 'calendar'],
                'Office': ['stapler', 'tape', 'folder', 'binder', 'envelope']
            },
            'Tools & Hardware': {
                'Hand Tools': ['hammer', 'screwdriver', 'wrench', 'pliers', 'tool'],
                'Power Tools': ['drill', 'saw', 'sander', 'grinder', 'power'],
                'Hardware': ['screw', 'nail', 'bolt', 'nut', 'hardware'],
                'Paint & Supplies': ['paint', 'brush', 'roller', 'tape', 'primer']
            },
            'Health & Wellness': {
                'Supplements': ['vitamin', 'supplement', 'pill', 'capsule', 'tablet'],
                'Medical': ['medicine', 'bandage', 'thermometer', 'first aid'],
                'Wellness': ['health', 'wellness', 'fitness', 'nutrition'],
                'Personal Care': ['sanitizer', 'mask', 'gloves', 'wipes']
            },
            'Pet Supplies': {
                'Food': ['pet food', 'dog food', 'cat food', 'treat', 'kibble'],
                'Toys': ['pet toy', 'dog toy', 'cat toy', 'chew'],
                'Accessories': ['collar', 'leash', 'cage', 'aquarium', 'bed'],
                'Care': ['litter', 'bowl', 'grooming', 'shampoo']
            },
            'Automotive': {
                'Parts': ['tire', 'oil', 'filter', 'brake', 'engine', 'battery'],
                'Accessories': ['wiper', 'light', 'mirror', 'seat cover', 'mat'],
                'Maintenance': ['fluids', 'cleaner', 'wax', 'polish']
            }
        }
        
        best_match = None
        best_score = 0
        
        # Find best matching category hierarchy
        for parent_cat, subcats in category_hierarchy.items():
            # Check parent category keywords
            parent_keywords = self.category_keywords.get(parent_cat, [])
            parent_score = sum(1 for kw in parent_keywords if keyword_matches(all_text, kw))
            
            # Always check subcategories (even if parent doesn't match)
            # This allows matching subcategories that might not have parent keyword matches
            best_subcat = None
            best_subcat_score = 0
            best_subsubcat = None
            best_subsubcat_score = 0
            
            for subcat, subcat_data in subcats.items():
                # Handle nested subcategories (e.g., Produce > Vegetables)
                if isinstance(subcat_data, dict):
                    # This is a nested structure (subcat has its own subcategories)
                    subcat_score = 0  # Parent subcat doesn't have direct keywords
                    for subsubcat, subsubcat_keywords in subcat_data.items():
                        subsubcat_score = sum(1 for kw in subsubcat_keywords if keyword_matches(all_text, kw))
                        if subsubcat_score > 0:
                            total_score = parent_score + (subsubcat_score * 5)  # Weight sub-subcategory highest
                            if total_score > best_score:
                                best_score = total_score
                                best_subcat = subcat
                                best_subsubcat = subsubcat
                                best_subsubcat_score = subsubcat_score
                else:
                    # This is a simple list of keywords (old format)
                    subcat_keywords = subcat_data
                    subcat_score = sum(1 for kw in subcat_keywords if keyword_matches(all_text, kw))
                    # If subcategory matches, use it (even without parent match)
                    if subcat_score > 0:
                        total_score = parent_score + (subcat_score * 3)  # Weight subcategory much higher
                        
                        if total_score > best_score:
                            best_score = total_score
                            best_subcat = subcat
                            best_subcat_score = subcat_score
                            best_subsubcat = None  # No nested subcategory
            
            # Build hierarchy path
            if best_subsubcat:
                # 3-level hierarchy: parent > subcat > subsubcat
                best_match = f"{parent_cat} > {best_subcat} > {best_subsubcat}"
            elif best_subcat:
                # 2-level hierarchy: parent > subcat
                best_match = f"{parent_cat} > {best_subcat}"
            elif parent_score > 0:
                # Use parent category only if no subcategory matched
                if parent_score > best_score:
                    best_match = parent_cat
                    best_score = parent_score
        
        if best_match:
            # Normalize confidence score (0.0 to 1.0)
            confidence = min(best_score / 10.0, 1.0)
            return {
                'category_name': best_match,
                'confidence': confidence
            }
        
        return None
    
    def _match_category(self, metadata):
        """
        Match product to category using intelligent hierarchy first, then fallback to simple matching
        """
        # Try hierarchy matching first (more intelligent, creates parent-child categories)
        hierarchy_match = self._match_category_with_hierarchy(metadata)
        if hierarchy_match:
            return hierarchy_match
        
        # Fallback to simple keyword matching if hierarchy doesn't match
        # Combine all text data
        all_text = ' '.join(
            metadata.get('keywords', []) +
            metadata.get('tags', []) +
            [str(v) for v in metadata.get('attributes', {}).values()]
        ).lower()
        
        # Score each category
        category_scores = {}
        
        # Helper function to check if keyword matches (handles plurals and word boundaries)
        import re
        def keyword_matches(text, keyword):
            """Check if keyword matches text, handling plurals and word boundaries"""
            # Use word boundaries to avoid partial matches (e.g., "car" in "carrots")
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                return True
            # Try plural/singular variations with word boundaries
            if keyword.endswith('s'):
                # Keyword is plural, try singular
                singular = keyword[:-1]
                pattern = r'\b' + re.escape(singular) + r'\b'
                if re.search(pattern, text, re.IGNORECASE):
                    return True
            else:
                # Keyword is singular, try plural
                plural = keyword + 's'
                pattern = r'\b' + re.escape(plural) + r'\b'
                if re.search(pattern, text, re.IGNORECASE):
                    return True
                # Try 'es' plural
                plural_es = keyword + 'es'
                pattern = r'\b' + re.escape(plural_es) + r'\b'
                if re.search(pattern, text, re.IGNORECASE):
                    return True
            return False
        
        for category, keywords in self.category_keywords.items():
            score = 0
            for keyword in keywords:
                if keyword_matches(all_text, keyword):
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
        Save extracted metadata to database (PostgreSQL)
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
                # Find or create category with hierarchy support
                from database import create_or_get_category_with_hierarchy
                category_path = category_match.get('category_name')
                if category_path:
                    # Use hierarchy function to create/get category
                    category_id = create_or_get_category_with_hierarchy(category_path, conn)
                else:
                    category_id = None
                
                confidence = category_match.get('confidence', 0)
            
            # Insert or update metadata (PostgreSQL uses INSERT ... ON CONFLICT)
            # First check if record exists
            cursor.execute("SELECT metadata_id FROM product_metadata WHERE product_id = %s", (product_id,))
            exists = cursor.fetchone()
            
            if exists:
                cursor.execute("""
                    UPDATE product_metadata SET
                        brand = %s,
                        color = %s,
                        size = %s,
                        tags = %s,
                        keywords = %s,
                        attributes = %s,
                        search_vector = %s,
                        category_id = %s,
                        category_confidence = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE product_id = %s
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
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
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
                VALUES (%s, %s, %s, %s, 1)
            """, (product_id, extraction_method, json.dumps(metadata), execution_time))
            
            conn.commit()
            
        except Exception as e:
            conn.rollback()
            # Log error
            try:
                cursor.execute("""
                    INSERT INTO metadata_extraction_log
                    (product_id, extraction_method, success, error_message)
                    VALUES (%s, %s, 0, %s)
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
            # Handle dict-like row access (PostgreSQL RealDictCursor)
            product_dict = dict(product) if isinstance(product, dict) else {
                'product_id': product[0],
                'product_name': product[1],
                'keywords': product[2],
                'tags': product[3],
                'brand': product[4]
            }
            keywords = json.loads(product_dict['keywords']) if product_dict['keywords'] else []
            tags = json.loads(product_dict['tags']) if product_dict['tags'] else []
            brand = product_dict['brand'] or ''
            
            text = ' '.join([brand] + keywords + tags)
            product_texts.append(text)
            product_ids.append(product_dict['product_id'])
            product_names_map[product_dict['product_id']] = product_dict['product_name']
        
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
                WHERE category_name = %s
            """, (category_name,))
            
            result = cursor.fetchone()
            
            if result:
                category_id = result['category_id'] if isinstance(result, dict) else result[0]
            else:
                cursor.execute("""
                    INSERT INTO categories (category_name, is_auto_generated)
                    VALUES (%s, 1)
                    RETURNING category_id
                """, (category_name,))
                row = cursor.fetchone()
                category_id = row['category_id'] if isinstance(row, dict) else row[0]
            
            # Assign products to category (use the cluster_product_ids we already computed)
            for prod_id in cluster_product_ids:
                cursor.execute("""
                    UPDATE product_metadata
                    SET category_id = %s,
                        category_confidence = 0.80
                    WHERE product_id = %s
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
        cursor = conn.cursor()
        
        # Get all products
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
        
        all_products = cursor.fetchall()
        
        if not SKLEARN_AVAILABLE:
            # Fallback to simple text matching
            query_lower = query.lower()
            results = []
            for product in all_products:
                # Handle dict-like row access (PostgreSQL RealDictCursor)
                product_dict = dict(product) if isinstance(product, dict) else {
                    'product_name': product[1],
                    'search_vector': product[12],
                    'category_id': product[7],
                    'brand': product[6],
                    'product_price': product[4]
                }
                product_name = product_dict['product_name'].lower()
                search_vector = (product_dict['search_vector'] or '').lower()
                
                # Simple relevance: count word matches
                query_words = set(query_lower.split())
                product_words = set((product_name + ' ' + search_vector).split())
                relevance = len(query_words & product_words) / len(query_words) if query_words else 0
                
                if relevance > 0:
                    # Apply filters
                    if filters:
                        if 'category_id' in filters and product_dict['category_id'] != filters['category_id']:
                            continue
                        if 'brand' in filters and product_dict['brand'] != filters['brand']:
                            continue
                        if 'min_price' in filters and product_dict['product_price'] < filters['min_price']:
                            continue
                        if 'max_price' in filters and product_dict['product_price'] > filters['max_price']:
                            continue
                    
                    result_dict = product_dict.copy() if isinstance(product_dict, dict) else dict(product)
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
                product_dict = dict(product) if isinstance(product, dict) else {
                    'product_id': product[0],
                    'product_name': product[1],
                    'sku': product[2],
                    'barcode': product[3],
                    'product_price': product[4],
                    'current_quantity': product[5],
                    'brand': product[6],
                    'category_id': product[7],
                    'category_name': product[8],
                    'tags': product[9],
                    'keywords': product[10],
                    'attributes': product[11],
                    'search_vector': product[12]
                }
                
                # Apply filters
                if filters:
                    if 'category_id' in filters and product_dict['category_id'] != filters['category_id']:
                        continue
                    if 'brand' in filters and product_dict['brand'] != filters['brand']:
                        continue
                    if 'min_price' in filters and product_dict['product_price'] < filters['min_price']:
                        continue
                    if 'max_price' in filters and product_dict['product_price'] > filters['max_price']:
                        continue
                
                result_dict = product_dict.copy()
                result_dict['relevance_score'] = float(similarities[idx])
                results.append(result_dict)
                
                if len(results) >= limit:
                    break
        
        # Log search
        try:
            cursor.execute("""
                INSERT INTO search_history (search_query, results_count)
                VALUES (%s, %s)
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

