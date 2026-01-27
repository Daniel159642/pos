#!/usr/bin/env python3
"""
Product Image Matcher using Deep Learning Embeddings
Uses EfficientNet for feature extraction and cosine similarity for matching
"""

import torch
import torchvision.transforms as transforms
from torchvision import models
import numpy as np
from PIL import Image
import pickle
import os
from typing import List, Dict, Optional, Any
from database import get_connection


class ProductImageMatcher:
    def __init__(self, model_name='efficientnet_b0', device=None):
        """
        Initialize the image matcher with a pre-trained model
        EfficientNet is lightweight and accurate - perfect for mobile/edge devices
        
        Args:
            model_name: Model to use ('efficientnet_b0' or 'resnet18')
            device: PyTorch device ('cuda', 'cpu', or None for auto-detect)
        """
        # Set device
        if device is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = torch.device(device)
        
        print(f"Using device: {self.device}")
        
        # Load pre-trained model
        if model_name == 'efficientnet_b0':
            try:
                # Try new API (torchvision 0.13+)
                self.model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
            except (AttributeError, TypeError):
                try:
                    # Fallback for older torchvision versions
                    self.model = models.efficientnet_b0(pretrained=True)
                except Exception as e:
                    raise RuntimeError(f"Failed to load EfficientNet model: {e}. Make sure torchvision is installed correctly.")
            # Remove classification layer to get embeddings
            self.model = torch.nn.Sequential(*list(self.model.children())[:-1])
        elif model_name == 'resnet18':
            try:
                # Try new API (torchvision 0.13+)
                self.model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
            except (AttributeError, TypeError):
                try:
                    # Fallback for older torchvision versions
                    self.model = models.resnet18(pretrained=True)
                except Exception as e:
                    raise RuntimeError(f"Failed to load ResNet model: {e}. Make sure torchvision is installed correctly.")
            # Remove classification layer
            self.model = torch.nn.Sequential(*list(self.model.children())[:-1])
        else:
            raise ValueError(f"Unknown model: {model_name}. Choose 'efficientnet_b0' or 'resnet18'")
        
        self.model.to(self.device)
        self.model.eval()
        
        # Image preprocessing
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                               std=[0.229, 0.224, 0.225])
        ])
        
        # Load or create embedding database
        self.product_embeddings = {}
        self.product_metadata = {}
    
    def extract_embedding(self, image_path: str) -> np.ndarray:
        """
        Extract feature embedding from image
        
        Args:
            image_path: Path to image file
            
        Returns:
            Normalized embedding vector
        """
        try:
            image = Image.open(image_path).convert('RGB')
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                embedding = self.model(input_tensor)
            
            # Flatten and normalize
            embedding = embedding.cpu().squeeze().numpy()
            embedding = embedding.flatten()
            embedding = embedding / (np.linalg.norm(embedding) + 1e-8)  # Add small epsilon to avoid division by zero
            
            return embedding
        except Exception as e:
            raise ValueError(f"Error processing image {image_path}: {str(e)}")
    
    def build_product_database(self, rebuild_existing: bool = False):
        """
        Build embedding database from all product images in inventory
        Run this once when setting up, then periodically when adding products
        
        Args:
            rebuild_existing: If True, rebuild embeddings even if they exist
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get all products with images
        if rebuild_existing:
            cursor.execute("""
                SELECT product_id, sku, product_name, photo, category
                FROM inventory
                WHERE photo IS NOT NULL AND photo != ''
            """)
        else:
            # Only get products without embeddings
            cursor.execute("""
                SELECT product_id, sku, product_name, photo, category
                FROM inventory
                WHERE photo IS NOT NULL AND photo != ''
                AND (image_embedding IS NULL OR last_embedding_update IS NULL)
            """)
        
        products = cursor.fetchall()
        
        if not products:
            print("No products with images found in database")
            conn.close()
            return
        
        print(f"Building embeddings for {len(products)} products...")
        
        processed = 0
        errors = 0
        
        for product in products:
            product_id, sku, product_name, photo_path, category = product
            
            try:
                # Check if image file exists
                if not os.path.exists(photo_path):
                    print(f"✗ Image not found: {product_name} ({photo_path})")
                    errors += 1
                    continue
                
                # Extract embedding
                embedding = self.extract_embedding(photo_path)
                
                # Store in memory
                self.product_embeddings[product_id] = embedding
                self.product_metadata[product_id] = {
                    'sku': sku,
                    'name': product_name,
                    'category': category or '',
                    'image_path': photo_path
                }
                
                # Save embedding to database (as pickle)
                embedding_blob = pickle.dumps(embedding)
                cursor.execute("""
                    UPDATE inventory
                    SET image_embedding = ?,
                        last_embedding_update = CURRENT_TIMESTAMP
                    WHERE product_id = ?
                """, (embedding_blob, product_id))
                
                processed += 1
                print(f"✓ Processed: {product_name} (ID: {product_id})")
                
            except Exception as e:
                print(f"✗ Error with {product_name} (ID: {product_id}): {e}")
                errors += 1
        
        conn.commit()
        conn.close()
        
        # Save to disk for fast loading
        self.save_database('product_embeddings.pkl')
        
        print(f"\nDatabase built: {processed} products processed, {errors} errors")
        print(f"Total products in memory: {len(self.product_embeddings)}")
    
    def load_from_database(self):
        """Load embeddings from database into memory"""
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT product_id, sku, product_name, photo, category, image_embedding
            FROM inventory
            WHERE image_embedding IS NOT NULL
        """)
        
        products = cursor.fetchall()
        
        self.product_embeddings = {}
        self.product_metadata = {}
        
        for product in products:
            product_id, sku, product_name, photo_path, category, embedding_blob = product
            
            try:
                embedding = pickle.loads(embedding_blob)
                self.product_embeddings[product_id] = embedding
                self.product_metadata[product_id] = {
                    'sku': sku,
                    'name': product_name,
                    'category': category or '',
                    'image_path': photo_path
                }
            except Exception as e:
                print(f"Error loading embedding for product {product_id}: {e}")
        
        conn.close()
        print(f"Loaded {len(self.product_embeddings)} product embeddings from database")
    
    def save_database(self, filepath: str):
        """Save embeddings to disk for fast loading"""
        data = {
            'embeddings': self.product_embeddings,
            'metadata': self.product_metadata
        }
        with open(filepath, 'wb') as f:
            pickle.dump(data, f)
        print(f"Saved embeddings to {filepath}")
    
    def load_database(self, filepath: str):
        """Load embeddings from disk"""
        if not os.path.exists(filepath):
            print(f"Embedding file not found: {filepath}. Building from database...")
            self.build_product_database()
            return
        
        with open(filepath, 'rb') as f:
            data = pickle.load(f)
        self.product_embeddings = data['embeddings']
        self.product_metadata = data['metadata']
        print(f"Loaded {len(self.product_embeddings)} product embeddings from {filepath}")
    
    def cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(dot_product / (norm1 * norm2))
    
    def identify_product(self, query_image_path: str, top_k: int = 5, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """
        Identify product from employee photo
        Returns top matches with confidence scores
        
        Args:
            query_image_path: Path to query image
            top_k: Number of top matches to return
            threshold: Minimum confidence threshold (0.0 to 1.0)
            
        Returns:
            List of match dictionaries with product info and confidence
        """
        if not self.product_embeddings:
            raise ValueError("No product embeddings loaded. Call load_database() or build_product_database() first.")
        
        # Extract embedding from query image
        query_embedding = self.extract_embedding(query_image_path)
        
        # Calculate similarity with all products
        similarities = {}
        for product_id, db_embedding in self.product_embeddings.items():
            similarity = self.cosine_similarity(query_embedding, db_embedding)
            similarities[product_id] = similarity
        
        # Sort by similarity
        sorted_matches = sorted(similarities.items(), 
                               key=lambda x: x[1], 
                               reverse=True)[:top_k]
        
        # Format results
        results = []
        for product_id, similarity in sorted_matches:
            if similarity >= threshold:
                metadata = self.product_metadata[product_id]
                results.append({
                    'product_id': int(product_id),
                    'confidence': float(similarity),
                    'sku': metadata['sku'],
                    'name': metadata['name'],
                    'category': metadata['category'],
                    'reference_image': metadata['image_path']
                })
        
        return results
    
    def batch_identify_shipment(self, image_paths: List[str], threshold: float = 0.75) -> List[Dict[str, Any]]:
        """
        Identify multiple products from shipment photos
        Returns all matched products
        
        Args:
            image_paths: List of image file paths
            threshold: Minimum confidence threshold
            
        Returns:
            List of identified products with match info
        """
        identified_products = []
        
        for image_path in image_paths:
            matches = self.identify_product(image_path, top_k=1, threshold=threshold)
            if matches:
                identified_products.append({
                    'image': image_path,
                    'match': matches[0]
                })
            else:
                identified_products.append({
                    'image': image_path,
                    'match': None,
                    'error': 'No match found above threshold'
                })
        
        return identified_products
    
    def log_identification(self, product_id: int, query_image_path: str, 
                         confidence: float, identified_by: str, 
                         context: str = 'manual_lookup') -> int:
        """
        Log an image-based identification to the database
        
        Args:
            product_id: Matched product ID
            query_image_path: Path to query image
            confidence: Confidence score
            identified_by: Employee name or ID
            context: Context of identification ('inventory_check', 'shipment_receiving', 'manual_lookup')
            
        Returns:
            Identification record ID
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO image_identifications 
            (product_id, query_image_path, confidence_score, identified_by, context)
            VALUES (?, ?, ?, ?, ?)
        """, (product_id, query_image_path, confidence, identified_by, context))
        
        identification_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return identification_id

