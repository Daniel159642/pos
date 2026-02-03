#!/usr/bin/env python3
"""
Generate PDF from accounting report CSV content (for save-to-directory).
"""

import csv
import io
from typing import List, Optional

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def _parse_csv_content(content: str) -> List[List[str]]:
    """Parse CSV string into rows (handles quoted fields)."""
    rows = []
    reader = csv.reader(io.StringIO(content.strip()))
    for row in reader:
        rows.append([c.strip() for c in row])
    return rows


def generate_report_pdf(csv_content: str, report_type: str = 'report') -> Optional[bytes]:
    """
    Convert report CSV content to a formatted PDF.
    Returns PDF bytes or None if reportlab is not available.
    """
    if not REPORTLAB_AVAILABLE:
        return None

    rows = _parse_csv_content(csv_content)
    if not rows:
        return None

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )
    styles = getSampleStyleSheet()

    story = []

    # Title (first row)
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=6,
        alignment=TA_CENTER,
    )
    story.append(Paragraph(rows[0][0] if rows[0] else 'Report', title_style))

    # Subtitle (second row: period or as-of date)
    if len(rows) > 1 and rows[1]:
        sub_style = ParagraphStyle(
            'ReportSubtitle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#444'),
            spaceAfter=12,
            alignment=TA_CENTER,
        )
        story.append(Paragraph(rows[1][0], sub_style))

    story.append(Spacer(1, 0.15 * inch))

    # Build table: skip first 2 rows (title, subtitle), find column header row then collect all rows
    rest = [r for r in rows[2:] if r and any(c.strip() for c in r)]
    if not rest:
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    # Infer column count from first row that has 2+ columns (header)
    col_count = 2
    header_idx = 0
    for i, row in enumerate(rest):
        if len(row) >= 2:
            col_count = max(col_count, len(row))
            header_idx = i
            break
    if col_count < 2:
        col_count = max(len(r) for r in rest) if rest else 2

    # Header row
    header_row = rest[header_idx]
    col_count = max(col_count, len(header_row), max(len(r) for r in rest) if rest else 2)
    # Pad header to col_count
    header_row = list(header_row) + [''] * (col_count - len(header_row)) if len(header_row) < col_count else header_row[:col_count]
    table_data = [header_row]

    for row in rest[header_idx + 1:]:
        # Section headers (1 col) -> pad to col_count; data rows pad/truncate to col_count
        r = list(row) + [''] * (col_count - len(row)) if len(row) < col_count else row[:col_count]
        table_data.append(r)

    if not table_data:
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    # Build platypus Table
    col_widths = [None] * col_count
    total_width = 7 * inch  # letter width minus margins
    if col_count == 2:
        col_widths = [4.5 * inch, 2 * inch]
    elif col_count == 3:
        col_widths = [3.5 * inch, 1.5 * inch, 1.5 * inch]
    elif col_count >= 4:
        w = total_width / col_count
        col_widths = [w] * col_count
    else:
        col_widths = [total_width / col_count] * col_count

    t = Table(table_data, colWidths=col_widths[:col_count])
    style_list = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8e8e8')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ccc')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    # Section headers (single-column rows): bold background
    for i, row in enumerate(table_data[1:], start=1):
        if len(row) >= 1 and row[0].strip() and (len(row) == 1 or all(not c.strip() for c in row[1:])):
            style_list.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f0f0f0')))
            style_list.append(('FONTNAME', (0, i), (-1, i), 'Helvetica-Bold'))
    t.setStyle(TableStyle(style_list))
    story.append(t)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_table_pdf(rows: List[List[str]], title: str = 'Shipment Document') -> Optional[bytes]:
    """Build a PDF from a list of rows (e.g. from Excel). Title at top, then table."""
    if not REPORTLAB_AVAILABLE or not rows:
        return None
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )
    styles = getSampleStyleSheet()
    story = []
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=12,
        alignment=TA_CENTER,
    )
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 0.1 * inch))
    col_count = max(len(r) for r in rows) if rows else 2
    col_count = max(col_count, 2)
    table_data = []
    for row in rows:
        r = [str(c) for c in row]
        r = r + [''] * (col_count - len(r)) if len(r) < col_count else r[:col_count]
        table_data.append(r)
    total_width = 7 * inch
    col_widths = [total_width / col_count] * col_count
    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8e8e8')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ccc')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(t)
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def file_to_pdf_bytes(file_path: str) -> Optional[bytes]:
    """
    Convert a file (PDF, CSV, or Excel) to PDF bytes for viewing.
    - PDF: returns file bytes as-is.
    - CSV: parses and builds report PDF.
    - Excel (.xlsx/.xls): reads first sheet and builds table PDF.
    """
    import os
    if not os.path.isfile(file_path):
        return None
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        with open(file_path, 'rb') as f:
            return f.read()
    if ext == '.csv':
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        return generate_report_pdf(content, 'shipment')
    if ext in ['.xlsx', '.xls']:
        try:
            import pandas as pd
            df = pd.read_excel(file_path, sheet_name=0, header=None)
            rows = df.fillna('').astype(str).values.tolist()
            return generate_table_pdf(rows, 'Shipment Document')
        except Exception:
            return None
    return None
