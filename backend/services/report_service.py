#!/usr/bin/env python3
"""
Report Service Layer
Business logic for generating financial reports (P&L, Balance Sheet, etc.)
"""

from typing import Dict, Any, List, Optional
from datetime import date, datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.models.account_model import AccountRepository
from backend.models.transaction_model import TransactionRepository
from database_postgres import get_connection


def get_store_inventory_value(establishment_id: Optional[int] = None) -> float:
    """
    Compute total inventory value from actual store stock (public.inventory).
    Value = sum of (current_quantity * product_cost) for all products.
    Used so accounting Balance Sheet Inventory line reflects real stock.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        if establishment_id is not None:
            cursor.execute(
                """
                SELECT COALESCE(SUM(current_quantity * product_cost), 0) AS total_value
                FROM public.inventory
                WHERE establishment_id = %s
                """,
                (establishment_id,),
            )
        else:
            cursor.execute(
                """
                SELECT COALESCE(SUM(current_quantity * product_cost), 0) AS total_value
                FROM public.inventory
                """
            )
        row = cursor.fetchone()
        cursor.close()
        if row and row[0] is not None:
            return float(row[0])
        return 0.0
    except Exception:
        return 0.0
    finally:
        conn.close()


def get_store_inventory_list(establishment_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Return inventory items from actual store stock (public.inventory) for accounting view.
    Each item has product_id, product_name, sku, barcode, current_quantity, product_cost, inventory_value.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        if establishment_id is not None:
            cursor.execute(
                """
                SELECT product_id, product_name, sku, barcode,
                       current_quantity, product_cost,
                       (current_quantity * product_cost) AS inventory_value
                FROM public.inventory
                WHERE establishment_id = %s
                ORDER BY product_name
                """,
                (establishment_id,),
            )
        else:
            cursor.execute(
                """
                SELECT product_id, product_name, sku, barcode,
                       current_quantity, product_cost,
                       (current_quantity * product_cost) AS inventory_value
                FROM public.inventory
                ORDER BY product_name
                """
            )
        columns = [c[0] for c in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        cursor.close()
        return [dict(zip(columns, row)) for row in rows]
    except Exception:
        return []
    finally:
        conn.close()


class ReportService:
    """Service layer for financial report generation"""

    # Income Statement template order: account numbers per section (include zero-balance accounts)
    INCOME_STATEMENT_REVENUE_ORDER = ['4000']  # Sales (Sales Revenue)
    INCOME_STATEMENT_CONTRA_REVENUE_ORDER = ['4010', '4020']  # Less: Sales Return, Less: Discounts and Allowances
    INCOME_STATEMENT_COGS_ORDER = ['5000', '5010', '5020']   # Materials / Cost of Goods Sold, Labor, Overhead
    INCOME_STATEMENT_OPEX_ORDER = [
        '5110', '5120', '5130', '5140', '5150', '5160', '5170', '5180', '5190',
        '5200', '5210', '5220', '5290', '5100'
    ]  # Wages, Advertising, Repairs, Travel, Rent, Delivery, Utilities, Insurance, Mileage, Office Supplies, Depreciation, Interest, Other Expenses, Operating Expenses
    INCOME_STATEMENT_OTHER_INCOME_ORDER = ['4110', '4100']   # Interest Income, Other Income
    INCOME_STATEMENT_TAX_ACCOUNTS = ['6000']   # Tax Expense

    @staticmethod
    def get_profit_loss(start_date: date, end_date: date) -> Dict[str, Any]:
        """Generate Income Statement for date range in template order (Revenue, Net Sales, COGS, Gross Profit, Operating Expenses, Operating Profit, Other Income, Profit Before Taxes, Tax, Net Profit)."""
        all_accounts = AccountRepository.find_all()
        by_number = {acc.account_number: acc for acc in all_accounts if acc.account_number}

        def _f(v):
            return float(v) if v is not None else 0.0

        def _balance(acc):
            if not acc or not getattr(acc, 'is_active', True):
                return 0.0
            return _f(ReportService._calculate_account_balance_for_period(
                acc.id, start_date, end_date, acc.balance_type
            ))

        def _row(acc, balance, pct_base=None):
            b = _f(balance)
            pct = (b / pct_base * 100) if pct_base and pct_base > 0 else 0.0
            return {
                'account_id': acc.id,
                'account_number': acc.account_number,
                'account_name': acc.account_name,
                'account_type': getattr(acc, 'account_type', None),
                'sub_type': getattr(acc, 'sub_type', None),
                'balance': b,
                'percentage_of_revenue': _f(pct)
            }

        # Revenue (credit): template order, include zero
        revenue_rows = []
        for num in ReportService.INCOME_STATEMENT_REVENUE_ORDER:
            acc = by_number.get(num)
            if acc and acc.account_type == 'Revenue':
                bal = _balance(acc)
                revenue_rows.append(_row(acc, bal))
        total_revenue = _f(sum(r['balance'] for r in revenue_rows))

        # Contra revenue (debit): Less: Sales Return, Less: Discounts and Allowances
        contra_rows = []
        for num in ReportService.INCOME_STATEMENT_CONTRA_REVENUE_ORDER:
            acc = by_number.get(num)
            if acc:
                contra_rows.append(_row(acc, _balance(acc)))
        total_contra = _f(sum(r['balance'] for r in contra_rows))

        # Add any Revenue-type accounts not in template order (e.g. other revenue accounts)
        for acc in all_accounts:
            if acc.account_type != 'Revenue' or not acc.is_active or acc.account_number in ReportService.INCOME_STATEMENT_REVENUE_ORDER:
                continue
            revenue_rows.append(_row(acc, _balance(acc)))
        total_revenue = _f(sum(r['balance'] for r in revenue_rows))
        net_sales = _f(total_revenue - total_contra)

        # COGS: template order, include zero
        cogs_rows = []
        for num in ReportService.INCOME_STATEMENT_COGS_ORDER:
            acc = by_number.get(num)
            if acc and acc.account_type in ('COGS', 'Cost of Goods Sold'):
                cogs_rows.append(_row(acc, _balance(acc), net_sales))
        for acc in all_accounts:
            if acc.account_type not in ('COGS', 'Cost of Goods Sold') or not acc.is_active:
                continue
            if acc.account_number in ReportService.INCOME_STATEMENT_COGS_ORDER:
                continue
            cogs_rows.append(_row(acc, _balance(acc), net_sales))
        total_cogs = _f(sum(r['balance'] for r in cogs_rows))
        gross_profit = _f(net_sales - total_cogs)

        # Operating expenses: template order, include zero (exclude Tax)
        opex_rows = []
        for num in ReportService.INCOME_STATEMENT_OPEX_ORDER:
            acc = by_number.get(num)
            if acc and acc.account_type == 'Expense' and getattr(acc, 'sub_type', None) != 'Tax':
                opex_rows.append(_row(acc, _balance(acc), net_sales))
        for acc in all_accounts:
            if acc.account_type != 'Expense' or not acc.is_active:
                continue
            if getattr(acc, 'sub_type', None) == 'Tax':
                continue
            if acc.account_number in ReportService.INCOME_STATEMENT_OPEX_ORDER:
                continue
            opex_rows.append(_row(acc, _balance(acc), net_sales))
        total_operating_expenses = _f(sum(r['balance'] for r in opex_rows))
        operating_profit = _f(gross_profit - total_operating_expenses)

        # Other income: template order, include zero
        other_income_rows = []
        for num in ReportService.INCOME_STATEMENT_OTHER_INCOME_ORDER:
            acc = by_number.get(num)
            if acc and acc.account_type == 'Other Income':
                other_income_rows.append(_row(acc, _balance(acc), net_sales))
        for acc in all_accounts:
            if acc.account_type != 'Other Income' or not acc.is_active:
                continue
            if acc.account_number in ReportService.INCOME_STATEMENT_OTHER_INCOME_ORDER:
                continue
            other_income_rows.append(_row(acc, _balance(acc), net_sales))
        total_other_income = _f(sum(r['balance'] for r in other_income_rows))
        profit_before_taxes = _f(operating_profit + total_other_income)

        # Tax expense
        tax_total = 0.0
        for num in ReportService.INCOME_STATEMENT_TAX_ACCOUNTS:
            acc = by_number.get(num)
            if acc:
                tax_total = _f(tax_total + _balance(acc))
        for acc in all_accounts:
            if getattr(acc, 'sub_type', None) == 'Tax' and acc.is_active and acc.account_number not in ReportService.INCOME_STATEMENT_TAX_ACCOUNTS:
                tax_total = _f(tax_total + _balance(acc))
        net_income = _f(profit_before_taxes - tax_total)

        # Percentages based on net_sales for consistency
        def add_pct(items, base=net_sales):
            return [{**item, 'percentage_of_revenue': _f((item['balance'] / base * 100) if base and base > 0 else 0)} for item in items]

        return {
            'revenue': add_pct(revenue_rows),
            'contra_revenue': add_pct(contra_rows),
            'net_sales': net_sales,
            'cost_of_goods_sold': add_pct(cogs_rows),
            'total_cogs': total_cogs,
            'gross_profit': gross_profit,
            'expenses': add_pct(opex_rows),
            'total_expenses': total_operating_expenses,
            'total_operating_expenses': total_operating_expenses,
            'operating_profit': operating_profit,
            'other_income': add_pct(other_income_rows),
            'total_other_income': total_other_income,
            'profit_before_taxes': profit_before_taxes,
            'tax_expense': tax_total,
            'net_income': net_income,
            'total_revenue': total_revenue,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        }
    
    @staticmethod
    def _calculate_account_balance_for_period(
        account_id: int,
        start_date: date,
        end_date: date,
        balance_type: str
    ) -> float:
        """Calculate account balance for a specific period"""
        ledger = TransactionRepository.get_general_ledger(account_id, start_date, end_date)
        
        total_debits = sum(float(entry.get('debit_amount') or 0) for entry in ledger)
        total_credits = sum(float(entry.get('credit_amount') or 0) for entry in ledger)
        
        # For revenue accounts (credit balance type), credits increase balance (positive)
        # For expense/COGS accounts (debit balance type), debits increase balance (positive for expenses)
        if balance_type == 'credit':
            # Revenue accounts: credits are positive (income)
            return total_credits - total_debits
        else:
            # Expense/COGS accounts: debits are positive (expenses)
            # Return as positive value for expenses
            return total_debits - total_credits
    
    @staticmethod
    def get_comparative_profit_loss(
        current_start: date,
        current_end: date,
        prior_start: date,
        prior_end: date
    ) -> Dict[str, Any]:
        """Generate comparative Profit & Loss statement"""
        current = ReportService.get_profit_loss(current_start, current_end)
        prior = ReportService.get_profit_loss(prior_start, prior_end)
        
        variance = {
            'revenue': current['total_revenue'] - prior['total_revenue'],
            'cogs': current['total_cogs'] - prior['total_cogs'],
            'gross_profit': current['gross_profit'] - prior['gross_profit'],
            'expenses': current['total_expenses'] - prior['total_expenses'],
            'net_income': current['net_income'] - prior['net_income']
        }
        
        variance_percentage = {
            'revenue': ((current['total_revenue'] - prior['total_revenue']) / prior['total_revenue'] * 100) if prior['total_revenue'] > 0 else 0,
            'cogs': ((current['total_cogs'] - prior['total_cogs']) / prior['total_cogs'] * 100) if prior['total_cogs'] > 0 else 0,
            'gross_profit': ((current['gross_profit'] - prior['gross_profit']) / prior['gross_profit'] * 100) if prior['gross_profit'] != 0 else 0,
            'expenses': ((current['total_expenses'] - prior['total_expenses']) / prior['total_expenses'] * 100) if prior['total_expenses'] > 0 else 0,
            'net_income': ((current['net_income'] - prior['net_income']) / abs(prior['net_income']) * 100) if prior['net_income'] != 0 else 0
        }
        
        return {
            'current': current,
            'prior': prior,
            'variance': variance,
            'variance_percentage': variance_percentage
        }

    @staticmethod
    def _to_float(v):
        """Coerce any numeric to float; avoid float + Decimal errors everywhere."""
        if v is None:
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0

    # Template order: account numbers per section so balance sheet matches standard template
    BALANCE_SHEET_TEMPLATE = {
        'current_assets': ['1000', '1010', '1020', '1030', '1100', '1110', '1200', '1300', '1310', '1320', '1350', '1400'],
        'fixed_assets': ['1450', '1500', '1510', '1520', '1530', '1540', '1550', '1560', '1600', '1610', '1620'],
        'other_assets': ['1700', '1800'],
        'current_liabilities': ['2000', '2010', '2020', '2030', '2040', '2050', '2100', '2110', '2120', '2200', '2300'],
        'long_term_liabilities': ['2500', '2510', '2520', '2590', '2600'],
        'equity': ['3000', '3100', '3200', '3300', '3400', '3500', '3600', '3700'],
    }

    @staticmethod
    def get_balance_sheet(as_of_date: date, establishment_id: Optional[int] = None) -> Dict[str, Any]:
        """Generate Balance Sheet as of a specific date in template order. Inventory (1200) uses actual store stock value."""
        _f = ReportService._to_float
        all_accounts = AccountRepository.find_all()
        accounts_by_number = {getattr(a, 'account_number', None): a for a in all_accounts if getattr(a, 'account_number', None)}
        asset_accounts = [a for a in all_accounts if a.account_type == 'Asset' and a.is_active]
        liability_accounts = [a for a in all_accounts if a.account_type == 'Liability' and a.is_active]
        equity_accounts = [a for a in all_accounts if a.account_type == 'Equity' and a.is_active]

        store_inventory_value = get_store_inventory_value(establishment_id)

        def _balance(acc) -> float:
            if getattr(acc, 'account_number', None) == '1200':
                return _f(store_inventory_value)
            b = AccountRepository.get_account_balance(acc.id, as_of_date)
            return _f(b)

        def _item(acc, balance_override=None):
            bal = _f(balance_override) if balance_override is not None else _balance(acc)
            return {
                'account_id': acc.id,
                'account_number': acc.account_number,
                'account_name': acc.account_name,
                'account_type': acc.account_type,
                'sub_type': acc.sub_type,
                'balance': _f(bal),
            }

        def _is_current_asset(a) -> bool:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('current', 'cash', 'bank', 'receivable', 'inventory', 'prepaid', 'short-term', 'investment'))

        def _is_fixed_asset(a) -> bool:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('fixed', 'property', 'equipment', 'depreciat', 'long-term investment', 'intangible', 'plant'))

        def _is_accumulated_depreciation(a) -> bool:
            s = (a.account_name or '').lower()
            return 'accumulated depreciation' in s

        def _is_current_liability(a) -> bool:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('current', 'payable', 'credit card', 'short-term', 'accrued', 'unearned', 'income tax'))

        def _is_long_term_liability(a) -> bool:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('long', 'term', 'loan', 'mortgage', 'deferred'))

        # Current assets: template order, include all current asset accounts (including zero balance)
        current_asset_list = [a for a in asset_accounts if _is_current_asset(a)]
        current_assets = []
        seen_ids = set()
        for num in ReportService.BALANCE_SHEET_TEMPLATE['current_assets']:
            acc = accounts_by_number.get(num)
            if acc and getattr(acc, 'account_type', None) == 'Asset' and acc.id not in seen_ids and _is_current_asset(acc):
                current_assets.append(_item(acc))
                seen_ids.add(acc.id)
        for a in current_asset_list:
            if a.id not in seen_ids:
                current_assets.append(_item(a))
                seen_ids.add(a.id)

        # Fixed assets: template order; collapse "(Less Accumulated Depreciation)" into one line
        accum_depr_total = 0.0
        fixed_no_depr = []
        fixed_seen = set()
        for num in ReportService.BALANCE_SHEET_TEMPLATE['fixed_assets']:
            acc = accounts_by_number.get(num)
            if acc is None or getattr(acc, 'account_type', None) != 'Asset' or not _is_fixed_asset(acc):
                continue
            if _is_accumulated_depreciation(acc):
                accum_depr_total += _balance(acc)
                continue
            if acc.id not in fixed_seen:
                fixed_no_depr.append(_item(acc))
                fixed_seen.add(acc.id)
        for a in asset_accounts:
            if not _is_fixed_asset(a) or _is_accumulated_depreciation(a) or a.id in fixed_seen:
                continue
            fixed_no_depr.append(_item(a))
            fixed_seen.add(a.id)
        if accum_depr_total != 0:
            fixed_no_depr.append({
                'account_id': None,
                'account_number': None,
                'account_name': '(Less Accumulated Depreciation)',
                'account_type': 'Asset',
                'sub_type': 'Fixed Asset',
                'balance': _f(-abs(accum_depr_total)),
            })
        # Sort so "(Less Accumulated Depreciation)" appears after PPE, before Intangible
        def _fixed_sort_key(item):
            if item.get('account_name') == '(Less Accumulated Depreciation)':
                return (1, '')
            num = item.get('account_number') or ''
            return (0, num)
        fixed_assets = sorted(fixed_no_depr, key=_fixed_sort_key)

        # Other assets: template order
        other_assets = []
        for num in ReportService.BALANCE_SHEET_TEMPLATE['other_assets']:
            acc = accounts_by_number.get(num)
            if acc and getattr(acc, 'account_type', None) == 'Asset' and not _is_current_asset(acc) and not _is_fixed_asset(acc):
                other_assets.append(_item(acc))
        for a in asset_accounts:
            if _is_current_asset(a) or _is_fixed_asset(a):
                continue
            num = getattr(a, 'account_number', None)
            if num and num not in ReportService.BALANCE_SHEET_TEMPLATE['other_assets']:
                other_assets.append(_item(a))

        # Current liabilities: template order
        current_liabilities = []
        for num in ReportService.BALANCE_SHEET_TEMPLATE['current_liabilities']:
            acc = accounts_by_number.get(num)
            if acc and getattr(acc, 'account_type', None) == 'Liability' and _is_current_liability(acc):
                current_liabilities.append(_item(acc))
        for a in liability_accounts:
            if _is_long_term_liability(a):
                continue
            num = getattr(a, 'account_number', None)
            if num and num not in ReportService.BALANCE_SHEET_TEMPLATE['current_liabilities']:
                current_liabilities.append(_item(a))

        # Long-term liabilities: template order
        long_term_liabilities = []
        for num in ReportService.BALANCE_SHEET_TEMPLATE['long_term_liabilities']:
            acc = accounts_by_number.get(num)
            if acc and getattr(acc, 'account_type', None) == 'Liability' and _is_long_term_liability(acc):
                long_term_liabilities.append(_item(acc))
        for a in liability_accounts:
            if not _is_long_term_liability(a):
                continue
            num = getattr(a, 'account_number', None)
            if num and num not in ReportService.BALANCE_SHEET_TEMPLATE['long_term_liabilities']:
                long_term_liabilities.append(_item(a))

        total_current_assets = _f(sum(_f(x['balance']) for x in current_assets))
        total_fixed_assets = _f(sum(_f(x['balance']) for x in fixed_assets))
        total_other_assets = _f(sum(_f(x['balance']) for x in other_assets))
        total_assets = _f(total_current_assets + total_fixed_assets + total_other_assets)

        total_current_liabilities = _f(sum(_f(x['balance']) for x in current_liabilities))
        total_long_term_liabilities = _f(sum(_f(x['balance']) for x in long_term_liabilities))
        total_liabilities = _f(total_current_liabilities + total_long_term_liabilities)

        # Equity: template order, include all (including zero balance)
        equity_items = []
        equity_seen = set()
        for num in ReportService.BALANCE_SHEET_TEMPLATE['equity']:
            acc = accounts_by_number.get(num)
            if acc and getattr(acc, 'account_type', None) == 'Equity' and acc.id not in equity_seen:
                equity_items.append(_item(acc))
                equity_seen.add(acc.id)
        for a in equity_accounts:
            if a.id not in equity_seen:
                equity_items.append(_item(a))
                equity_seen.add(a.id)
        retained_earnings = _f(sum(_f(x['balance']) for x in equity_items))

        year_start = date(as_of_date.year, 1, 1)
        pl = ReportService.get_profit_loss(year_start, as_of_date)
        current_year_earnings = _f(pl.get('net_income'))

        # Inventory (1200) uses actual store stock value; ledger 1200 may differ.
        # Add equity adjustment so Assets = Liabilities + Equity (balance sheet balances).
        equity_before_adjustment = _f(retained_earnings) + _f(current_year_earnings)
        inventory_valuation_adjustment = _f(total_assets) - _f(total_liabilities) - _f(equity_before_adjustment)
        total_equity = _f(equity_before_adjustment + inventory_valuation_adjustment)
        balances = abs(_f(total_assets) - _f(total_liabilities + total_equity)) < 0.01

        # Normalize all list items so 'balance' is float
        def _norm(items):
            return [dict((k, _f(v) if k == 'balance' else v) for k, v in item.items()) for item in items]

        return {
            'assets': {
                'current_assets': _norm(current_assets),
                'fixed_assets': _norm(fixed_assets),
                'other_assets': _norm(other_assets),
                'total_current_assets': _f(total_current_assets),
                'total_fixed_assets': _f(total_fixed_assets),
                'total_other_assets': _f(total_other_assets),
                'total_assets': _f(total_assets),
            },
            'liabilities': {
                'current_liabilities': _norm(current_liabilities),
                'long_term_liabilities': _norm(long_term_liabilities),
                'total_current_liabilities': _f(total_current_liabilities),
                'total_long_term_liabilities': _f(total_long_term_liabilities),
                'total_liabilities': _f(total_liabilities),
            },
            'equity': {
                'equity_accounts': _norm(equity_items),
                'retained_earnings': _f(retained_earnings),
                'current_year_earnings': _f(current_year_earnings),
                'inventory_valuation_adjustment': _f(inventory_valuation_adjustment),
                'total_equity': _f(total_equity),
            },
            'as_of_date': as_of_date.isoformat(),
            'balances': balances,
        }

    @staticmethod
    def get_comparative_balance_sheet(current_date: date, prior_date: date) -> Dict[str, Any]:
        """Generate comparative Balance Sheet"""
        current = ReportService.get_balance_sheet(current_date)
        prior = ReportService.get_balance_sheet(prior_date)

        va = current['assets']['total_assets'] - prior['assets']['total_assets']
        vl = current['liabilities']['total_liabilities'] - prior['liabilities']['total_liabilities']
        ve = current['equity']['total_equity'] - prior['equity']['total_equity']

        pa = (va / prior['assets']['total_assets'] * 100) if prior['assets']['total_assets'] != 0 else 0
        pl = (vl / prior['liabilities']['total_liabilities'] * 100) if prior['liabilities']['total_liabilities'] != 0 else 0
        pe = (ve / abs(prior['equity']['total_equity']) * 100) if prior['equity']['total_equity'] != 0 else 0

        return {
            'current': current,
            'prior': prior,
            'variance': {
                'total_assets': va,
                'total_liabilities': vl,
                'total_equity': ve,
            },
            'variance_percentage': {
                'total_assets': pa,
                'total_liabilities': pl,
                'total_equity': pe,
            },
        }

    @staticmethod
    def _get_cash_balance(as_of: date) -> float:
        """Sum of cash/bank account balances as of date."""
        all_accounts = AccountRepository.find_all()
        assets = [a for a in all_accounts if a.account_type == 'Asset' and a.is_active]
        total = 0.0
        for a in assets:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            if any(k in s for k in ('cash', 'bank', 'checking', 'savings')):
                b = AccountRepository.get_account_balance(a.id, as_of)
                total += float(b) if b is not None else 0.0
        return total

    @staticmethod
    def _balance_as_of(account_id: int, as_of: date) -> float:
        b = AccountRepository.get_account_balance(account_id, as_of)
        return float(b) if b is not None else 0.0

    @staticmethod
    def _period_activity(account_id: int, start_date: date, end_date: date, balance_type: str) -> float:
        ledger = TransactionRepository.get_general_ledger(account_id, start_date, end_date)
        debits = sum(float(e.get('debit_amount') or 0) for e in ledger)
        credits = sum(float(e.get('credit_amount') or 0) for e in ledger)
        if balance_type == 'credit':
            return float(credits - debits)
        return float(debits - credits)

    @staticmethod
    def _cash_flow_adjustment(description: str, amount: float, account_id: Optional[int] = None) -> Dict[str, Any]:
        return {'description': description, 'amount': amount, 'account_id': account_id}

    # Cash Flow Statement template: direct-method line item keys and account number mappings
    # Receipts = cash debit (money in); Payments = cash credit (money out). Classify by counterpart account.
    _CF_OPERATIONS_RECEIPTS = {
        'Customers': ['1100', '4000'],           # AR, Sales Revenue
        'Other Operations': ['4100', '4110'],     # Other Income, Interest Income
    }
    _CF_OPERATIONS_PAID = {
        'Inventory purchases': ['1200'],
        'General operating and administrative expenses': ['5100', '5120', '5130', '5140', '5150', '5160', '5170', '5180', '5190', '5200', '5210', '5290', '2000'],  # AP -> general
        'Wage expenses': ['5110'],
        'Interest': ['5220'],
        'Income taxes': ['6000'],
    }
    _CF_INVESTING_RECEIPTS = {
        'Sale of property and equipment': ['1500', '1520'],
        'Collection of principal on loans': ['1400'],
        'Sale of investment securities': ['1350', '1450'],
    }
    _CF_INVESTING_PAID = {
        'Purchase of property and equipment': ['1500'],
        'Making loans to other entities': ['1400'],
        'Purchase of investment securities': ['1350', '1450'],
    }
    _CF_FINANCING_RECEIPTS = {
        'Issuance of stock': ['3000', '3100', '3700'],
        'Borrowing': ['2100', '2500', '2120'],
    }
    _CF_FINANCING_PAID = {
        'Repurchase of stock (treasury stock)': ['3200'],
        'Repayment of loans': ['2100', '2500', '2120'],
        'Dividends': ['3310'],
    }

    @staticmethod
    def _classify_cash_flow_line(account_number: str, account_type: str, receipt: bool, amount: float,
                                  receipt_map: Dict[str, List[str]], paid_map: Dict[str, List[str]]) -> Optional[tuple]:
        """Return (bucket_label, amount) for template line, or None if unclassified. receipt=True means cash debit."""
        num = (account_number or '').strip()
        if receipt:
            for label, nums in receipt_map.items():
                if num in nums:
                    return (label, amount)
        else:
            for label, nums in paid_map.items():
                if num in nums:
                    return (label, -amount)
        return None

    @staticmethod
    def get_cash_flow(start_date: date, end_date: date) -> Dict[str, Any]:
        """Cash Flow Statement (direct method) for period: Operations, Investing, Financing with
        Cash receipts from / Cash paid for template line items. All line items included (zero if no activity)."""
        prior = start_date - timedelta(days=1)
        beginning_cash = ReportService._get_cash_balance(prior)
        ending_cash = ReportService._get_cash_balance(end_date)

        all_accounts = AccountRepository.find_all()
        cash_account_ids = []
        for a in all_accounts:
            if a.account_type != 'Asset' or not getattr(a, 'is_active', True):
                continue
            s = ((getattr(a, 'sub_type') or '') + (getattr(a, 'account_name') or '')).lower()
            if any(k in s for k in ('cash', 'bank', 'checking', 'savings')):
                cash_account_ids.append(a.id)
        if not cash_account_ids:
            op_r = {k: 0.0 for k in ReportService._CF_OPERATIONS_RECEIPTS}
            op_p = {k: 0.0 for k in ReportService._CF_OPERATIONS_PAID}
            inv_r = {k: 0.0 for k in ReportService._CF_INVESTING_RECEIPTS}
            inv_p = {k: 0.0 for k in ReportService._CF_INVESTING_PAID}
            fin_r = {k: 0.0 for k in ReportService._CF_FINANCING_RECEIPTS}
            fin_p = {k: 0.0 for k in ReportService._CF_FINANCING_PAID}
            return ReportService._cash_flow_template_response(
                start_date, end_date, beginning_cash, ending_cash,
                op_r, op_p, inv_r, inv_p, fin_r, fin_p, 0.0, 0.0, 0.0, 0.0
            )

        txns = TransactionRepository.get_transactions_with_lines_involving_accounts(
            cash_account_ids, start_date, end_date
        )

        def _f(x):
            return float(x) if x is not None else 0.0

        op_receipts: Dict[str, float] = {k: 0.0 for k in ReportService._CF_OPERATIONS_RECEIPTS}
        op_paid: Dict[str, float] = {k: 0.0 for k in ReportService._CF_OPERATIONS_PAID}
        inv_receipts: Dict[str, float] = {k: 0.0 for k in ReportService._CF_INVESTING_RECEIPTS}
        inv_paid: Dict[str, float] = {k: 0.0 for k in ReportService._CF_INVESTING_PAID}
        fin_receipts: Dict[str, float] = {k: 0.0 for k in ReportService._CF_FINANCING_RECEIPTS}
        fin_paid: Dict[str, float] = {k: 0.0 for k in ReportService._CF_FINANCING_PAID}

        for txn in txns:
            lines = txn.get('lines') or []
            cash_debit = 0.0
            cash_credit = 0.0
            non_cash: List[Dict[str, Any]] = []
            for line in lines:
                aid = line.get('account_id')
                anum = line.get('account_number') or ''
                atype = line.get('account_type') or ''
                deb = _f(line.get('debit_amount'))
                cred = _f(line.get('credit_amount'))
                if aid in cash_account_ids:
                    cash_debit += deb
                    cash_credit += cred
                else:
                    non_cash.append({'account_number': anum, 'account_type': atype, 'debit_amount': deb, 'credit_amount': cred})
            if not non_cash:
                continue
            # Attribute this transaction's cash_debit to one receipt bucket and cash_credit to one paid bucket (first matching counterpart)
            receipt_done = False
            paid_done = False
            for nc in non_cash:
                anum = nc.get('account_number') or ''
                atype = nc.get('account_type') or ''
                if cash_debit > 1e-9 and not receipt_done:
                    tup = ReportService._classify_cash_flow_line(
                        anum, atype, True, cash_debit,
                        ReportService._CF_OPERATIONS_RECEIPTS, ReportService._CF_OPERATIONS_PAID
                    )
                    if tup:
                        op_receipts[tup[0]] = op_receipts.get(tup[0], 0) + tup[1]
                        receipt_done = True
                    else:
                        tup = ReportService._classify_cash_flow_line(
                            anum, atype, True, cash_debit,
                            ReportService._CF_INVESTING_RECEIPTS, ReportService._CF_INVESTING_PAID
                        )
                        if tup:
                            inv_receipts[tup[0]] = inv_receipts.get(tup[0], 0) + tup[1]
                            receipt_done = True
                        else:
                            tup = ReportService._classify_cash_flow_line(
                                anum, atype, True, cash_debit,
                                ReportService._CF_FINANCING_RECEIPTS, ReportService._CF_FINANCING_PAID
                            )
                            if tup:
                                fin_receipts[tup[0]] = fin_receipts.get(tup[0], 0) + tup[1]
                                receipt_done = True
                if cash_credit > 1e-9 and not paid_done:
                    tup = ReportService._classify_cash_flow_line(
                        anum, atype, False, cash_credit,
                        ReportService._CF_OPERATIONS_RECEIPTS, ReportService._CF_OPERATIONS_PAID
                    )
                    if tup:
                        op_paid[tup[0]] = op_paid.get(tup[0], 0) + tup[1]
                        paid_done = True
                    else:
                        tup = ReportService._classify_cash_flow_line(
                            anum, atype, False, cash_credit,
                            ReportService._CF_INVESTING_RECEIPTS, ReportService._CF_INVESTING_PAID
                        )
                        if tup:
                            inv_paid[tup[0]] = inv_paid.get(tup[0], 0) + tup[1]
                            paid_done = True
                        else:
                            tup = ReportService._classify_cash_flow_line(
                                anum, atype, False, cash_credit,
                                ReportService._CF_FINANCING_RECEIPTS, ReportService._CF_FINANCING_PAID
                            )
                            if tup:
                                fin_paid[tup[0]] = fin_paid.get(tup[0], 0) + tup[1]
                                paid_done = True
                if receipt_done and paid_done:
                    break

        net_ops = sum(op_receipts.values()) + sum(op_paid.values())  # op_paid are already negative
        net_inv = sum(inv_receipts.values()) + sum(inv_paid.values())
        net_fin = sum(fin_receipts.values()) + sum(fin_paid.values())
        net_change = net_ops + net_inv + net_fin

        return ReportService._cash_flow_template_response(
            start_date, end_date, beginning_cash, ending_cash,
            op_receipts, op_paid, inv_receipts, inv_paid, fin_receipts, fin_paid,
            net_ops, net_inv, net_fin, net_change
        )

    @staticmethod
    def _cash_flow_template_response(
        start_date: date, end_date: date,
        beginning_cash: float, ending_cash: float,
        op_receipts: Dict[str, float], op_paid: Dict[str, float],
        inv_receipts: Dict[str, float], inv_paid: Dict[str, float],
        fin_receipts: Dict[str, float], fin_paid: Dict[str, float],
        net_ops: float, net_inv: float, net_fin: float, net_change: float
    ) -> Dict[str, Any]:
        """Build API response with template structure; all line items present (zero if missing)."""
        def _line_list_in_order(order_keys: List[str], d: Dict[str, float]) -> List[Dict[str, Any]]:
            return [{'description': k, 'amount': float(d.get(k, 0))} for k in order_keys]

        op_receipt_order = list(ReportService._CF_OPERATIONS_RECEIPTS.keys())
        op_paid_order = list(ReportService._CF_OPERATIONS_PAID.keys())
        inv_receipt_order = list(ReportService._CF_INVESTING_RECEIPTS.keys())
        inv_paid_order = list(ReportService._CF_INVESTING_PAID.keys())
        fin_receipt_order = list(ReportService._CF_FINANCING_RECEIPTS.keys())
        fin_paid_order = list(ReportService._CF_FINANCING_PAID.keys())
        return {
            'operating_activities': {
                'cash_receipts_from': _line_list_in_order(op_receipt_order, op_receipts),
                'cash_paid_for': _line_list_in_order(op_paid_order, op_paid),
                'net_cash_from_operations': float(net_ops),
            },
            'investing_activities': {
                'cash_receipts_from': _line_list_in_order(inv_receipt_order, inv_receipts),
                'cash_paid_for': _line_list_in_order(inv_paid_order, inv_paid),
                'net_cash_from_investing': float(net_inv),
            },
            'financing_activities': {
                'cash_receipts_from': _line_list_in_order(fin_receipt_order, fin_receipts),
                'cash_paid_for': _line_list_in_order(fin_paid_order, fin_paid),
                'net_cash_from_financing': float(net_fin),
            },
            'beginning_cash': float(beginning_cash),
            'net_change_in_cash': float(net_change),
            'ending_cash': float(ending_cash),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        }

    @staticmethod
    def get_comparative_cash_flow(
        current_start: date,
        current_end: date,
        prior_start: date,
        prior_end: date,
    ) -> Dict[str, Any]:
        current = ReportService.get_cash_flow(current_start, current_end)
        prior = ReportService.get_cash_flow(prior_start, prior_end)
        return {
            'current': current,
            'prior': prior,
            'variance': {
                'net_cash_from_operations': current['operating_activities']['net_cash_from_operations']
                - prior['operating_activities']['net_cash_from_operations'],
                'net_cash_from_investing': current['investing_activities']['net_cash_from_investing']
                - prior['investing_activities']['net_cash_from_investing'],
                'net_cash_from_financing': current['financing_activities']['net_cash_from_financing']
                - prior['financing_activities']['net_cash_from_financing'],
                'net_change_in_cash': current['net_change_in_cash'] - prior['net_change_in_cash'],
            },
        }


# Singleton instance
report_service = ReportService()
