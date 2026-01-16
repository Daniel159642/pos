#!/usr/bin/env python3
"""
Tax Form Generation Module
Generates W-2, 1099-NEC, Form 941, Form 940 in PDF format using reportlab
"""

from reportlab.lib.pagesizes import letter, legal
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from datetime import datetime
import os
from typing import Dict, List, Optional

def generate_w2_form(
    employee_id: int,
    employee_data: Dict,
    payroll_summary: Dict,
    output_path: str,
    employer_info: Optional[Dict] = None
) -> bool:
    """
    Generate W-2 form (Copy A for IRS, Copy B for employee, Copy C for employer)
    
    Args:
        employee_id: Employee ID
        employee_data: Dict with employee information (name, SSN, address)
        payroll_summary: Dict with tax year totals (wages, federal tax, state tax, etc.)
        output_path: Path to save PDF
        employer_info: Optional employer information dict
    """
    try:
        from database import get_connection
        
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        # W-2 Form styling
        normal_style = ParagraphStyle(
            'Normal',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=12
        )
        
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=16,
            textColor=colors.black,
            alignment=1  # Center
        )
        
        # W-2 Form Data
        tax_year = payroll_summary.get('tax_year', datetime.now().year)
        wages = payroll_summary.get('federal_wages', 0.0)
        federal_tax = payroll_summary.get('federal_tax_withheld', 0.0)
        social_security_wages = payroll_summary.get('social_security_wages', wages)
        social_security_tax = payroll_summary.get('social_security_tax_withheld', 0.0)
        medicare_wages = payroll_summary.get('medicare_wages', wages)
        medicare_tax = payroll_summary.get('medicare_tax_withheld', 0.0)
        state_tax = payroll_summary.get('state_tax_withheld', 0.0)
        
        # Employer info defaults
        if not employer_info:
            employer_info = {
                'name': 'Your Company Name',
                'ein': '12-3456789',
                'address': '123 Business St, City, ST 12345'
            }
        
        # W-2 Form Table
        w2_data = [
            ['Form W-2', 'Wage and Tax Statement', '', '', f'{tax_year} Copy A For Social Security Administration'],
            ['a Control number', 'b Employer identification number (EIN)', '', '', ''],
            ['', employer_info['ein'], '', '', ''],
            ['c Employer\'s name, address, and ZIP code', '', '', '', ''],
            [employer_info['name'], '', '', '', ''],
            [employer_info['address'], '', '', '', ''],
            ['d Employee\'s social security number', '', '', '', ''],
            [employee_data.get('ssn', 'XXX-XX-XXXX'), '', '', '', ''],
            ['e Employee\'s first name and middle initial', 'f Employee\'s last name', '', '', ''],
            [employee_data.get('first_name', '') + ' ' + employee_data.get('middle_initial', ''), 
             employee_data.get('last_name', ''), '', '', ''],
            ['g Employee\'s address and ZIP code', '', '', '', ''],
            [employee_data.get('address', ''), '', '', '', ''],
            ['', '', '', '', ''],
            ['1 Wages, tips, other compensation', '2 Federal income tax withheld', 
             '3 Social security wages', '4 Social security tax withheld', 
             '5 Medicare wages and tips', '6 Medicare tax withheld'],
            [f'${wages:,.2f}', f'${federal_tax:,.2f}', f'${social_security_wages:,.2f}', 
             f'${social_security_tax:,.2f}', f'${medicare_wages:,.2f}', f'${medicare_tax:,.2f}'],
            ['15 State', '16 State wages, tips, etc.', '17 State income tax', '', ''],
            ['CA', f'${wages:,.2f}', f'${state_tax:,.2f}', '', '']
        ]
        
        # Create table
        w2_table = Table(w2_data, colWidths=[1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch])
        w2_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (4, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (4, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (4, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (4, 0), 10),
            ('BOTTOMPADDING', (0, 0), (4, 0), 12),
            ('BACKGROUND', (0, 13), (5, 13), colors.lightgrey),
            ('FONTNAME', (0, 13), (5, 13), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        elements.append(w2_table)
        elements.append(Spacer(1, 0.5*inch))
        
        # Footer
        footer_text = f'<b>Employee ID:</b> {employee_id}<br/>' \
                     f'<b>Generated:</b> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br/>' \
                     f'<i>This is a system-generated form. Verify all information before filing.</i>'
        elements.append(Paragraph(footer_text, normal_style))
        
        doc.build(elements)
        return True
        
    except Exception as e:
        print(f"Error generating W-2 form: {e}")
        import traceback
        traceback.print_exc()
        return False

def generate_1099nec_form(
    contractor_name: str,
    contractor_tin: str,
    contractor_address: str,
    payments_summary: Dict,
    output_path: str,
    payer_info: Optional[Dict] = None
) -> bool:
    """
    Generate 1099-NEC form for independent contractors
    
    Args:
        contractor_name: Contractor name
        contractor_tin: Contractor TIN/SSN
        contractor_address: Contractor address
        payments_summary: Dict with tax year payment totals
        output_path: Path to save PDF
        payer_info: Optional payer information dict
    """
    try:
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        normal_style = ParagraphStyle(
            'Normal',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=12
        )
        
        # 1099-NEC Data
        tax_year = payments_summary.get('tax_year', datetime.now().year)
        nonemployee_compensation = payments_summary.get('total_payments', 0.0)
        
        # Payer info defaults
        if not payer_info:
            payer_info = {
                'name': 'Your Company Name',
                'tin': '12-3456789',
                'address': '123 Business St, City, ST 12345'
            }
        
        # 1099-NEC Form Table
        nec_data = [
            ['Form 1099-NEC', 'Nonemployee Compensation', '', f'{tax_year} Copy A For IRS'],
            ['PAYER\'S name, street address, city or town, province or state, country, ZIP or foreign postal code, and telephone no.', '', '', ''],
            [payer_info['name'], '', '', ''],
            [payer_info['address'], '', '', ''],
            ['PAYER\'S TIN', 'RECIPIENT\'S TIN', '', ''],
            [payer_info['tin'], contractor_tin, '', ''],
            ['RECIPIENT\'S name', '', '', ''],
            [contractor_name, '', '', ''],
            ['RECIPIENT\'S street address (including apt. no.)', '', '', ''],
            [contractor_address, '', '', ''],
            ['RECIPIENT\'S city, state, and ZIP code', '', '', ''],
            [contractor_address.split(',')[-1] if ',' in contractor_address else '', '', '', ''],
            ['', '', '', ''],
            ['1 Nonemployee compensation', 'Federal income tax withheld', 'State tax withheld', 'State/Payer\'s state no.'],
            [f'${nonemployee_compensation:,.2f}', '$0.00', '$0.00', 'CA'],
        ]
        
        # Create table
        nec_table = Table(nec_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1*inch])
        nec_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (3, 0), colors.darkgreen),
            ('TEXTCOLOR', (0, 0), (3, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (3, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (3, 0), 10),
            ('BOTTOMPADDING', (0, 0), (3, 0), 12),
            ('BACKGROUND', (0, 12), (3, 12), colors.lightgrey),
            ('FONTNAME', (0, 12), (3, 12), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        elements.append(nec_table)
        elements.append(Spacer(1, 0.5*inch))
        
        # Footer
        footer_text = f'<b>Contractor:</b> {contractor_name}<br/>' \
                     f'<b>Generated:</b> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br/>' \
                     f'<i>This is a system-generated form. Verify all information before filing.</i>'
        elements.append(Paragraph(footer_text, normal_style))
        
        doc.build(elements)
        return True
        
    except Exception as e:
        print(f"Error generating 1099-NEC form: {e}")
        import traceback
        traceback.print_exc()
        return False

def generate_form_941_summary(
    quarter: int,
    tax_year: int,
    payroll_data: List[Dict],
    output_path: str,
    employer_info: Optional[Dict] = None
) -> bool:
    """
    Generate Form 941 (Quarterly Federal Tax Return) summary
    
    Args:
        quarter: Quarter number (1-4)
        tax_year: Tax year
        payroll_data: List of payroll records for the quarter
        output_path: Path to save PDF
        employer_info: Optional employer information dict
    """
    try:
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        normal_style = ParagraphStyle(
            'Normal',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=12
        )
        
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=colors.black,
            alignment=1
        )
        
        # Calculate totals
        total_wages = sum(p.get('gross_pay', 0) for p in payroll_data)
        total_federal_tax = sum(p.get('federal_income_tax_withheld', 0) for p in payroll_data)
        total_ss_tax = sum(p.get('social_security_tax_withheld', 0) + p.get('social_security_tax_employer', 0) for p in payroll_data)
        total_medicare_tax = sum(p.get('medicare_tax_withheld', 0) + p.get('medicare_tax_employer', 0) for p in payroll_data)
        total_tax_liability = total_federal_tax + total_ss_tax + total_medicare_tax
        
        # Employer info defaults
        if not employer_info:
            employer_info = {
                'name': 'Your Company Name',
                'ein': '12-3456789',
                'address': '123 Business St, City, ST 12345'
            }
        
        # Form 941 Summary Table
        form941_data = [
            ['Form 941', f'Employer\'s QUARTERLY Federal Tax Return - Q{quarter} {tax_year}', '', ''],
            ['', '', '', ''],
            ['Employer Information', '', '', ''],
            ['Name:', employer_info['name'], 'EIN:', employer_info['ein']],
            ['Address:', employer_info['address'], '', ''],
            ['', '', '', ''],
            ['Part 1: Answer these questions for this quarter', '', '', ''],
            ['1 Number of employees paid during quarter', f'{len(set(p.get("employee_id") for p in payroll_data))}', '', ''],
            ['2 Wages, tips, and other compensation', f'${total_wages:,.2f}', '', ''],
            ['3 Total income tax withheld from wages', f'${total_federal_tax:,.2f}', '', ''],
            ['5a Taxable social security wages', f'${total_wages:,.2f}', '', ''],
            ['5b Taxable social security tips', '$0.00', '', ''],
            ['5c Taxable Medicare wages & tips', f'${total_wages:,.2f}', '', ''],
            ['5d Section 3121(q) Notice and Demand', '$0.00', '', ''],
            ['', '', '', ''],
            ['Part 2: Deposit schedule and tax liability', '', '', ''],
            ['15 Total taxes (add lines 6, 10, and 11)', f'${total_tax_liability:,.2f}', '', ''],
            ['16 Total deposits for this quarter', f'${total_tax_liability:,.2f}', '', ''],
            ['17 Balance due', '$0.00', '', '']
        ]
        
        form941_table = Table(form941_data, colWidths=[2.5*inch, 2*inch, 1*inch, 1*inch])
        form941_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (3, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (3, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (3, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (3, 0), 12),
            ('BOTTOMPADDING', (0, 0), (3, 0), 12),
            ('BACKGROUND', (0, 6), (3, 6), colors.lightgrey),
            ('FONTNAME', (0, 6), (3, 6), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        elements.append(Paragraph(f'Form 941 - Q{quarter} {tax_year}', title_style))
        elements.append(Spacer(1, 0.3*inch))
        elements.append(form941_table)
        elements.append(Spacer(1, 0.3*inch))
        
        footer_text = f'<b>Generated:</b> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br/>' \
                     f'<i>This is a summary for informational purposes. Use official IRS forms for filing.</i>'
        elements.append(Paragraph(footer_text, normal_style))
        
        doc.build(elements)
        return True
        
    except Exception as e:
        print(f"Error generating Form 941 summary: {e}")
        import traceback
        traceback.print_exc()
        return False

def generate_form_940_summary(
    tax_year: int,
    payroll_data: List[Dict],
    output_path: str,
    employer_info: Optional[Dict] = None
) -> bool:
    """
    Generate Form 940 (Federal Unemployment Tax) summary
    
    Args:
        tax_year: Tax year
        payroll_data: List of all payroll records for the year
        output_path: Path to save PDF
        employer_info: Optional employer information dict
    """
    try:
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        normal_style = ParagraphStyle(
            'Normal',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=12
        )
        
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=colors.black,
            alignment=1
        )
        
        # Calculate FUTA tax (6% on first $7,000 per employee)
        futa_wage_base = 7000.0
        futa_rate = 0.006  # 0.6% after state credit
        
        employee_totals = {}
        for payroll in payroll_data:
            emp_id = payroll.get('employee_id')
            if emp_id not in employee_totals:
                employee_totals[emp_id] = 0.0
            employee_totals[emp_id] += payroll.get('gross_pay', 0)
        
        total_futa_wages = sum(min(wages, futa_wage_base) for wages in employee_totals.values())
        total_futa_tax = total_futa_wages * futa_rate
        
        # Employer info defaults
        if not employer_info:
            employer_info = {
                'name': 'Your Company Name',
                'ein': '12-3456789',
                'address': '123 Business St, City, ST 12345'
            }
        
        # Form 940 Summary Table
        form940_data = [
            ['Form 940', f'Employer\'s Annual Federal Unemployment (FUTA) Tax Return - {tax_year}', '', ''],
            ['', '', '', ''],
            ['Employer Information', '', '', ''],
            ['Name:', employer_info['name'], 'EIN:', employer_info['ein']],
            ['Address:', employer_info['address'], '', ''],
            ['', '', '', ''],
            ['Part II: Computation of Annual FUTA Tax', '', '', ''],
            ['10 Total FUTA taxable wages (first $7,000 per employee)', f'${total_futa_wages:,.2f}', '', ''],
            ['11 FUTA tax before adjustments (line 10 × 0.006)', f'${total_futa_tax:,.2f}', '', ''],
            ['12 FUTA tax deposited for the year', f'${total_futa_tax:,.2f}', '', ''],
            ['15 Total FUTA tax', f'${total_futa_tax:,.2f}', '', ''],
            ['16 FUTA tax deposited for the year (same as line 12)', f'${total_futa_tax:,.2f}', '', ''],
            ['17 Balance due', '$0.00', '', '']
        ]
        
        form940_table = Table(form940_data, colWidths=[2.5*inch, 2*inch, 1*inch, 1*inch])
        form940_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (3, 0), colors.darkred),
            ('TEXTCOLOR', (0, 0), (3, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (3, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (3, 0), 12),
            ('BOTTOMPADDING', (0, 0), (3, 0), 12),
            ('BACKGROUND', (0, 6), (3, 6), colors.lightgrey),
            ('FONTNAME', (0, 6), (3, 6), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        elements.append(Paragraph(f'Form 940 - {tax_year}', title_style))
        elements.append(Spacer(1, 0.3*inch))
        elements.append(form940_table)
        elements.append(Spacer(1, 0.3*inch))
        
        footer_text = f'<b>Generated:</b> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br/>' \
                     f'<i>This is a summary for informational purposes. Use official IRS forms for filing.</i>'
        elements.append(Paragraph(footer_text, normal_style))
        
        doc.build(elements)
        return True
        
    except Exception as e:
        print(f"Error generating Form 940 summary: {e}")
        import traceback
        traceback.print_exc()
        return False
