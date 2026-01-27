#!/usr/bin/env python3
"""
Barcode Scanner Module
Supports multiple barcode formats (EAN, UPC, Code128, QR codes, etc.)
"""

import cv2
import numpy as np
from PIL import Image
from typing import Optional, List, Dict, Any
from database import get_connection

try:
    from pyzbar import pyzbar
    PYZBAR_AVAILABLE = True
except ImportError:
    PYZBAR_AVAILABLE = False
    print("Warning: pyzbar not installed. Install with: pip install pyzbar")


class BarcodeScanner:
    """Barcode and QR code scanner using pyzbar"""
    
    def __init__(self):
        if not PYZBAR_AVAILABLE:
            raise ImportError(
                "pyzbar is required for barcode scanning. "
                "Install with: pip install pyzbar"
            )
    
    def scan_image(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Scan barcode(s) from an image file
        
        Args:
            image_path: Path to image file
            
        Returns:
            List of detected barcodes with type and data
        """
        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not read image: {image_path}")
            
            # Convert to grayscale if needed
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image
            
            # Decode barcodes
            barcodes = pyzbar.decode(gray)
            
            results = []
            for barcode in barcodes:
                # Extract barcode data
                barcode_data = barcode.data.decode('utf-8')
                barcode_type = barcode.type
                
                # Get bounding box
                rect = barcode.rect
                
                results.append({
                    'data': barcode_data,
                    'type': barcode_type,
                    'rect': {
                        'left': rect.left,
                        'top': rect.top,
                        'width': rect.width,
                        'height': rect.height
                    },
                    'quality': getattr(barcode, 'quality', None)
                })
            
            return results
            
        except Exception as e:
            raise ValueError(f"Error scanning barcode: {str(e)}")
    
    def scan_from_pil_image(self, pil_image: Image.Image) -> List[Dict[str, Any]]:
        """
        Scan barcode(s) from a PIL Image object
        
        Args:
            pil_image: PIL Image object
            
        Returns:
            List of detected barcodes
        """
        try:
            # Convert PIL to numpy array
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            image_array = np.array(pil_image)
            
            # Convert RGB to BGR for OpenCV
            image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
            
            # Decode barcodes
            barcodes = pyzbar.decode(gray)
            
            results = []
            for barcode in barcodes:
                barcode_data = barcode.data.decode('utf-8')
                barcode_type = barcode.type
                rect = barcode.rect
                
                results.append({
                    'data': barcode_data,
                    'type': barcode_type,
                    'rect': {
                        'left': rect.left,
                        'top': rect.top,
                        'width': rect.width,
                        'height': rect.height
                    }
                })
            
            return results
            
        except Exception as e:
            raise ValueError(f"Error scanning barcode from PIL image: {str(e)}")
    
    def lookup_product_by_barcode(self, barcode_data: str) -> Optional[Dict[str, Any]]:
        """
        Look up product in database by barcode
        
        Args:
            barcode_data: Barcode value to search for
            
        Returns:
            Product dictionary or None if not found
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        # Search by barcode field
        cursor.execute("""
            SELECT * FROM inventory
            WHERE barcode = %s
        """, (barcode_data,))
        
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row:
            return dict(row)
        return None
    
    def lookup_product_by_sku(self, sku: str) -> Optional[Dict[str, Any]]:
        """
        Look up product by SKU (fallback if barcode not found)
        
        Args:
            sku: SKU to search for
            
        Returns:
            Product dictionary or None if not found
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM inventory
            WHERE sku = %s
        """, (sku,))
        
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row:
            return dict(row)
        return None
    
    def identify_product(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Scan barcode and return product information
        
        Args:
            image_path: Path to image containing barcode
            
        Returns:
            Dictionary with product info and barcode details, or None
        """
        # Scan for barcodes
        barcodes = self.scan_image(image_path)
        
        if not barcodes:
            return None
        
        # Use first barcode found
        barcode_info = barcodes[0]
        barcode_data = barcode_info['data']
        
        # Try to find product by barcode
        product = self.lookup_product_by_barcode(barcode_data)
        
        # Fallback to SKU lookup if barcode not found
        if not product:
            product = self.lookup_product_by_sku(barcode_data)
        
        if product:
            return {
                'method': 'barcode',
                'confidence': 1.0,  # Barcode is 100% accurate
                'barcode': barcode_info,
                'product': product
            }
        
        # Barcode found but product not in database
        return {
            'method': 'barcode',
            'confidence': 1.0,
            'barcode': barcode_info,
            'product': None,
            'message': f'Barcode {barcode_data} found but product not in database'
        }
    
    def batch_scan(self, image_paths: List[str]) -> List[Dict[str, Any]]:
        """
        Scan multiple images for barcodes
        
        Args:
            image_paths: List of image file paths
            
        Returns:
            List of identification results
        """
        results = []
        
        for image_path in image_paths:
            try:
                result = self.identify_product(image_path)
                if result:
                    result['image'] = image_path
                else:
                    result = {
                        'image': image_path,
                        'method': 'barcode',
                        'barcode': None,
                        'product': None,
                        'message': 'No barcode found in image'
                    }
                results.append(result)
            except Exception as e:
                results.append({
                    'image': image_path,
                    'error': str(e)
                })
        
        return results


def smart_product_identification(
    image_path: str,
    barcode_scanner: Optional[BarcodeScanner] = None,
    image_matcher=None,
    prefer_barcode: bool = True
) -> Dict[str, Any]:
    """
    Smart product identification: Try barcode first, fall back to image matching
    
    Args:
        image_path: Path to query image
        barcode_scanner: BarcodeScanner instance (optional, will create if needed)
        image_matcher: ProductImageMatcher instance (optional)
        prefer_barcode: If True, try barcode first; if False, try image matching first
        
    Returns:
        Dictionary with identification result
    """
    result = {
        'image': image_path,
        'method': None,
        'confidence': 0.0,
        'product': None
    }
    
    # Try barcode scanning first (if preferred and available)
    if prefer_barcode:
        try:
            if barcode_scanner is None:
                barcode_scanner = BarcodeScanner()
            
            barcode_result = barcode_scanner.identify_product(image_path)
            
            if barcode_result and barcode_result.get('product'):
                result.update({
                    'method': 'barcode',
                    'confidence': 1.0,
                    'product': barcode_result['product'],
                    'barcode': barcode_result.get('barcode')
                })
                return result
        except Exception as e:
            # Barcode scanning failed, continue to image matching
            result['barcode_error'] = str(e)
    
    # Fall back to image matching
    if image_matcher is not None:
        try:
            matches = image_matcher.identify_product(
                image_path,
                top_k=1,
                threshold=0.7
            )
            
            if matches:
                result.update({
                    'method': 'image_matching',
                    'confidence': matches[0]['confidence'],
                    'product': {
                        'product_id': matches[0]['product_id'],
                        'sku': matches[0]['sku'],
                        'product_name': matches[0]['name'],
                        'category': matches[0]['category']
                    },
                    'match_details': matches[0]
                })
                return result
        except Exception as e:
            result['image_matching_error'] = str(e)
    
    # Neither method found a match
    result['message'] = 'No product identified'
    return result











