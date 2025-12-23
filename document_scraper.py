#!/usr/bin/env python3
"""
Document scraping utilities for vendor shipment documents
Supports PDF, Excel, and CSV formats
"""

import os
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False


def scrape_vendor_pdf(pdf_path: str, column_mapping: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    Extract shipment data from vendor PDF
    
    Args:
        pdf_path: Path to PDF file
        column_mapping: Optional mapping of vendor column names to standard names
                       e.g., {'Item Code': 'product_sku', 'Description': 'product_name'}
    
    Returns:
        List of dictionaries with shipment item data
    """
    if not PDF_AVAILABLE:
        raise ImportError("pdfplumber is required for PDF scraping. Install with: pip install pdfplumber")
    
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    default_mapping = {
        'Item Code': 'product_sku',
        'SKU': 'product_sku',
        'Product Code': 'product_sku',
        'Code': 'product_sku',
        'Description': 'product_name',
        'Product Name': 'product_name',
        'Item': 'product_name',
        'Qty': 'quantity_expected',
        'Quantity': 'quantity_expected',
        'Qty Expected': 'quantity_expected',
        'Unit Price': 'unit_cost',
        'Price': 'unit_cost',
        'Cost': 'unit_cost',
        'Lot #': 'lot_number',
        'Lot Number': 'lot_number',
        'Lot': 'lot_number',
        'Expiration Date': 'expiration_date',
        'Exp Date': 'expiration_date',
        'Expiry': 'expiration_date'
    }
    
    if column_mapping:
        default_mapping.update(column_mapping)
    
    items = []
    
    with pdfplumber.open(pdf_path) as pdf:
        # Extract tables from all pages
        for page in pdf.pages:
            tables = page.extract_tables()
            
            for table in tables:
                if not table or len(table) < 2:
                    continue
                
                # First row is usually headers
                headers = [h.strip() if h else '' for h in table[0]]
                
                # Map headers to standard names
                mapped_headers = {}
                for i, header in enumerate(headers):
                    header_lower = header.lower()
                    for key, value in default_mapping.items():
                        if key.lower() in header_lower:
                            mapped_headers[value] = i
                            break
                
                # Process data rows
                for row in table[1:]:
                    if not row or len(row) < 2:
                        continue
                    
                    item = {}
                    
                    # Extract data based on mapped headers
                    if 'product_sku' in mapped_headers:
                        item['product_sku'] = str(row[mapped_headers['product_sku']]).strip() if row[mapped_headers['product_sku']] else None
                    
                    if 'product_name' in mapped_headers:
                        item['product_name'] = str(row[mapped_headers['product_name']]).strip() if row[mapped_headers['product_name']] else None
                    
                    if 'quantity_expected' in mapped_headers:
                        qty_str = str(row[mapped_headers['quantity_expected']]).strip() if row[mapped_headers['quantity_expected']] else '0'
                        # Remove non-numeric characters
                        qty_str = re.sub(r'[^\d.]', '', qty_str)
                        try:
                            item['quantity_expected'] = int(float(qty_str))
                        except (ValueError, TypeError):
                            item['quantity_expected'] = 0
                    
                    if 'unit_cost' in mapped_headers:
                        cost_str = str(row[mapped_headers['unit_cost']]).strip() if row[mapped_headers['unit_cost']] else '0'
                        # Remove currency symbols and commas
                        cost_str = re.sub(r'[^\d.]', '', cost_str)
                        try:
                            item['unit_cost'] = float(cost_str)
                        except (ValueError, TypeError):
                            item['unit_cost'] = 0.0
                    
                    if 'lot_number' in mapped_headers:
                        item['lot_number'] = str(row[mapped_headers['lot_number']]).strip() if row[mapped_headers['lot_number']] else None
                    
                    if 'expiration_date' in mapped_headers:
                        item['expiration_date'] = str(row[mapped_headers['expiration_date']]).strip() if row[mapped_headers['expiration_date']] else None
                    
                    # Only add items with valid SKU and quantity
                    if item.get('product_sku') and item.get('quantity_expected', 0) > 0:
                        items.append(item)
    
    return items


def scrape_vendor_excel(file_path: str, sheet_name: Optional[str] = None, 
                        column_mapping: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    Extract shipment data from Excel file
    
    Args:
        file_path: Path to Excel file
        sheet_name: Optional sheet name (defaults to first sheet)
        column_mapping: Optional mapping of vendor column names to standard names
    
    Returns:
        List of dictionaries with shipment item data
    """
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas and openpyxl are required for Excel scraping. Install with: pip install pandas openpyxl")
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Excel file not found: {file_path}")
    
    default_mapping = {
        'SKU': 'product_sku',
        'Item Code': 'product_sku',
        'Product Code': 'product_sku',
        'Code': 'product_sku',
        'Product Name': 'product_name',
        'Description': 'product_name',
        'Item': 'product_name',
        'Quantity': 'quantity_expected',
        'Qty': 'quantity_expected',
        'Qty Expected': 'quantity_expected',
        'Price': 'unit_cost',
        'Unit Price': 'unit_cost',
        'Cost': 'unit_cost',
        'Lot Number': 'lot_number',
        'Lot #': 'lot_number',
        'Lot': 'lot_number',
        'Expiration Date': 'expiration_date',
        'Exp Date': 'expiration_date',
        'Expiry': 'expiration_date'
    }
    
    if column_mapping:
        default_mapping.update(column_mapping)
    
    try:
        if sheet_name:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise ValueError(f"Error reading Excel file: {e}")
    
    # Rename columns based on mapping
    df = df.rename(columns=default_mapping)
    
    items = []
    
    # Process each row
    for _, row in df.iterrows():
        item = {}
        
        # Extract data
        if 'product_sku' in df.columns:
            sku = row.get('product_sku')
            if pd.notna(sku):
                item['product_sku'] = str(sku).strip()
        
        if 'product_name' in df.columns:
            name = row.get('product_name')
            if pd.notna(name):
                item['product_name'] = str(name).strip()
        
        if 'quantity_expected' in df.columns:
            qty = row.get('quantity_expected')
            if pd.notna(qty):
                try:
                    item['quantity_expected'] = int(float(qty))
                except (ValueError, TypeError):
                    item['quantity_expected'] = 0
        
        if 'unit_cost' in df.columns:
            cost = row.get('unit_cost')
            if pd.notna(cost):
                try:
                    item['unit_cost'] = float(cost)
                except (ValueError, TypeError):
                    item['unit_cost'] = 0.0
        
        if 'lot_number' in df.columns:
            lot = row.get('lot_number')
            if pd.notna(lot):
                item['lot_number'] = str(lot).strip()
        
        if 'expiration_date' in df.columns:
            exp = row.get('expiration_date')
            if pd.notna(exp):
                # Try to format date if it's a datetime
                if isinstance(exp, datetime):
                    item['expiration_date'] = exp.strftime('%Y-%m-%d')
                else:
                    item['expiration_date'] = str(exp).strip()
        
        # Only add items with valid SKU and quantity
        if item.get('product_sku') and item.get('quantity_expected', 0) > 0:
            items.append(item)
    
    return items


def scrape_vendor_csv(file_path: str, column_mapping: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    Extract shipment data from CSV file
    
    Args:
        file_path: Path to CSV file
        column_mapping: Optional mapping of vendor column names to standard names
    
    Returns:
        List of dictionaries with shipment item data
    """
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas is required for CSV scraping. Install with: pip install pandas")
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CSV file not found: {file_path}")
    
    default_mapping = {
        'SKU': 'product_sku',
        'Item Code': 'product_sku',
        'Product Code': 'product_sku',
        'Code': 'product_sku',
        'Product Name': 'product_name',
        'Description': 'product_name',
        'Item': 'product_name',
        'Quantity': 'quantity_expected',
        'Qty': 'quantity_expected',
        'Qty Expected': 'quantity_expected',
        'Price': 'unit_cost',
        'Unit Price': 'unit_cost',
        'Cost': 'unit_cost',
        'Lot Number': 'lot_number',
        'Lot #': 'lot_number',
        'Lot': 'lot_number',
        'Expiration Date': 'expiration_date',
        'Exp Date': 'expiration_date',
        'Expiry': 'expiration_date'
    }
    
    if column_mapping:
        default_mapping.update(column_mapping)
    
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        raise ValueError(f"Error reading CSV file: {e}")
    
    # Rename columns based on mapping
    df = df.rename(columns=default_mapping)
    
    items = []
    
    # Process each row
    for _, row in df.iterrows():
        item = {}
        
        # Extract data
        if 'product_sku' in df.columns:
            sku = row.get('product_sku')
            if pd.notna(sku):
                item['product_sku'] = str(sku).strip()
        
        if 'product_name' in df.columns:
            name = row.get('product_name')
            if pd.notna(name):
                item['product_name'] = str(name).strip()
        
        if 'quantity_expected' in df.columns:
            qty = row.get('quantity_expected')
            if pd.notna(qty):
                try:
                    item['quantity_expected'] = int(float(qty))
                except (ValueError, TypeError):
                    item['quantity_expected'] = 0
        
        if 'unit_cost' in df.columns:
            cost = row.get('unit_cost')
            if pd.notna(cost):
                try:
                    item['unit_cost'] = float(cost)
                except (ValueError, TypeError):
                    item['unit_cost'] = 0.0
        
        if 'lot_number' in df.columns:
            lot = row.get('lot_number')
            if pd.notna(lot):
                item['lot_number'] = str(lot).strip()
        
        if 'expiration_date' in df.columns:
            exp = row.get('expiration_date')
            if pd.notna(exp):
                item['expiration_date'] = str(exp).strip()
        
        # Only add items with valid SKU and quantity
        if item.get('product_sku') and item.get('quantity_expected', 0) > 0:
            items.append(item)
    
    return items


def scrape_document(file_path: str, column_mapping: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    Automatically detect file type and scrape document
    
    Args:
        file_path: Path to document file
        column_mapping: Optional mapping of vendor column names to standard names
    
    Returns:
        List of dictionaries with shipment item data
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    file_ext = os.path.splitext(file_path)[1].lower()
    
    if file_ext == '.pdf':
        return scrape_vendor_pdf(file_path, column_mapping)
    elif file_ext in ['.xlsx', '.xls']:
        return scrape_vendor_excel(file_path, column_mapping=column_mapping)
    elif file_ext == '.csv':
        return scrape_vendor_csv(file_path, column_mapping)
    else:
        raise ValueError(f"Unsupported file type: {file_ext}. Supported: .pdf, .xlsx, .xls, .csv")

