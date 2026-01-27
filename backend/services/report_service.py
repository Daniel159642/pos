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


class ReportService:
    """Service layer for financial report generation"""
    
    @staticmethod
    def get_profit_loss(start_date: date, end_date: date) -> Dict[str, Any]:
        """Generate Profit & Loss statement for date range"""
        # Get all accounts by type
        all_accounts = AccountRepository.find_all()
        
        # Filter accounts by type
        revenue_accounts = [acc for acc in all_accounts if acc.account_type == 'Revenue']
        expense_accounts = [acc for acc in all_accounts if acc.account_type == 'Expense']
        cogs_accounts = [acc for acc in all_accounts if acc.account_type in ['COGS', 'Cost of Goods Sold']]
        
        # Calculate balances for each account in the period
        revenue_balances = []
        for account in revenue_accounts:
            if account.is_active:
                balance = ReportService._calculate_account_balance_for_period(
                    account.id, start_date, end_date, account.balance_type
                )
                if balance != 0:  # Only include accounts with activity
                    revenue_balances.append({
                        'account_id': account.id,
                        'account_number': account.account_number,
                        'account_name': account.account_name,
                        'account_type': account.account_type,
                        'sub_type': account.sub_type,
                        'balance': balance
                    })
        
        cogs_balances = []
        for account in cogs_accounts:
            if account.is_active:
                balance = ReportService._calculate_account_balance_for_period(
                    account.id, start_date, end_date, account.balance_type
                )
                if balance != 0:
                    cogs_balances.append({
                        'account_id': account.id,
                        'account_number': account.account_number,
                        'account_name': account.account_name,
                        'account_type': account.account_type,
                        'sub_type': account.sub_type,
                        'balance': balance
                    })
        
        expense_balances = []
        for account in expense_accounts:
            if account.is_active:
                balance = ReportService._calculate_account_balance_for_period(
                    account.id, start_date, end_date, account.balance_type
                )
                if balance != 0:
                    expense_balances.append({
                        'account_id': account.id,
                        'account_number': account.account_number,
                        'account_name': account.account_name,
                        'account_type': account.account_type,
                        'sub_type': account.sub_type,
                        'balance': balance
                    })
        
        # Calculate totals
        total_revenue = sum(item['balance'] for item in revenue_balances)
        total_cogs = sum(item['balance'] for item in cogs_balances)
        gross_profit = total_revenue - total_cogs
        total_expenses = sum(item['balance'] for item in expense_balances)
        net_income = gross_profit - total_expenses
        
        # Calculate percentage of revenue for each line
        def add_percentage(items):
            return [
                {
                    **item,
                    'percentage_of_revenue': (item['balance'] / total_revenue * 100) if total_revenue > 0 else 0
                }
                for item in items
            ]
        
        return {
            'revenue': add_percentage(revenue_balances),
            'cost_of_goods_sold': add_percentage(cogs_balances),
            'expenses': add_percentage(expense_balances),
            'total_revenue': total_revenue,
            'total_cogs': total_cogs,
            'gross_profit': gross_profit,
            'total_expenses': total_expenses,
            'net_income': net_income,
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
        
        total_debits = sum(entry.get('debit_amount', 0) or 0 for entry in ledger)
        total_credits = sum(entry.get('credit_amount', 0) or 0 for entry in ledger)
        
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
    def get_balance_sheet(as_of_date: date) -> Dict[str, Any]:
        """Generate Balance Sheet as of a specific date"""
        all_accounts = AccountRepository.find_all()
        asset_accounts = [a for a in all_accounts if a.account_type == 'Asset' and a.is_active]
        liability_accounts = [a for a in all_accounts if a.account_type == 'Liability' and a.is_active]
        equity_accounts = [a for a in all_accounts if a.account_type == 'Equity' and a.is_active]

        def _balance(acc) -> float:
            b = AccountRepository.get_account_balance(acc.id, as_of_date)
            return float(b) if b is not None else 0.0

        def _item(acc):
            bal = _balance(acc)
            return {
                'account_id': acc.id,
                'account_number': acc.account_number,
                'account_name': acc.account_name,
                'account_type': acc.account_type,
                'sub_type': acc.sub_type,
                'balance': bal,
            }

        def _is_current_asset(a) -> bool:
            s = (a.sub_type or '') + (a.account_name or '')
            s = s.lower()
            return any(k in s for k in ('current', 'cash', 'bank', 'receivable', 'inventory'))

        def _is_fixed_asset(a) -> bool:
            s = (a.sub_type or '') + (a.account_name or '')
            s = s.lower()
            return any(k in s for k in ('fixed', 'property', 'equipment', 'depreciat'))

        def _is_current_liability(a) -> bool:
            s = (a.sub_type or '') + (a.account_name or '')
            s = s.lower()
            return any(k in s for k in ('current', 'payable', 'credit card'))

        def _is_long_term_liability(a) -> bool:
            s = (a.sub_type or '') + (a.account_name or '')
            s = s.lower()
            return any(k in s for k in ('long', 'term', 'loan', 'mortgage'))

        current_assets = [_item(a) for a in asset_accounts if _is_current_asset(a) and _balance(a) != 0]
        fixed_assets = [_item(a) for a in asset_accounts if _is_fixed_asset(a) and not _is_current_asset(a) and _balance(a) != 0]
        other_assets = [
            _item(a) for a in asset_accounts
            if not _is_current_asset(a) and not _is_fixed_asset(a) and _balance(a) != 0
        ]

        current_liabilities = [_item(a) for a in liability_accounts if _is_current_liability(a) and _balance(a) != 0]
        long_term_liabilities = [
            _item(a) for a in liability_accounts
            if _is_long_term_liability(a) and _balance(a) != 0
        ]
        other_liab = [
            _item(a) for a in liability_accounts
            if not _is_current_liability(a) and not _is_long_term_liability(a) and _balance(a) != 0
        ]
        current_liabilities = current_liabilities + other_liab

        total_current_assets = sum(x['balance'] for x in current_assets)
        total_fixed_assets = sum(x['balance'] for x in fixed_assets)
        total_other_assets = sum(x['balance'] for x in other_assets)
        total_assets = total_current_assets + total_fixed_assets + total_other_assets

        total_current_liabilities = sum(x['balance'] for x in current_liabilities)
        total_long_term_liabilities = sum(x['balance'] for x in long_term_liabilities)
        total_liabilities = total_current_liabilities + total_long_term_liabilities

        equity_items = [_item(a) for a in equity_accounts if _balance(a) != 0]
        retained_earnings = sum(x['balance'] for x in equity_items)

        year_start = date(as_of_date.year, 1, 1)
        pl = ReportService.get_profit_loss(year_start, as_of_date)
        current_year_earnings = pl['net_income']
        total_equity = retained_earnings + current_year_earnings

        balances = abs(total_assets - (total_liabilities + total_equity)) < 0.01

        return {
            'assets': {
                'current_assets': current_assets,
                'fixed_assets': fixed_assets,
                'other_assets': other_assets,
                'total_current_assets': total_current_assets,
                'total_fixed_assets': total_fixed_assets,
                'total_other_assets': total_other_assets,
                'total_assets': total_assets,
            },
            'liabilities': {
                'current_liabilities': current_liabilities,
                'long_term_liabilities': long_term_liabilities,
                'total_current_liabilities': total_current_liabilities,
                'total_long_term_liabilities': total_long_term_liabilities,
                'total_liabilities': total_liabilities,
            },
            'equity': {
                'equity_accounts': equity_items,
                'retained_earnings': retained_earnings,
                'current_year_earnings': current_year_earnings,
                'total_equity': total_equity,
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
        debits = sum(e.get('debit_amount') or 0 for e in ledger)
        credits = sum(e.get('credit_amount') or 0 for e in ledger)
        if balance_type == 'credit':
            return credits - debits
        return debits - credits

    @staticmethod
    def _cash_flow_adjustment(description: str, amount: float, account_id: Optional[int] = None) -> Dict[str, Any]:
        return {'description': description, 'amount': amount, 'account_id': account_id}

    @staticmethod
    def get_cash_flow(start_date: date, end_date: date) -> Dict[str, Any]:
        """Cash Flow Statement (indirect method) for period."""
        pl = ReportService.get_profit_loss(start_date, end_date)
        net_income = pl['net_income']

        prior = start_date - timedelta(days=1)
        beginning_cash = ReportService._get_cash_balance(prior)
        ending_cash = ReportService._get_cash_balance(end_date)

        all_accounts = AccountRepository.find_all()
        assets = [a for a in all_accounts if a.account_type == 'Asset' and a.is_active]
        liabilities = [a for a in all_accounts if a.account_type == 'Liability' and a.is_active]
        expenses = [a for a in all_accounts if a.account_type == 'Expense' and a.is_active]
        equity = [a for a in all_accounts if a.account_type == 'Equity' and a.is_active]

        def _is_cash(a) -> bool:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('cash', 'bank', 'checking', 'savings'))

        def _is_fixed(a) -> bool:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('fixed', 'property', 'equipment', 'depreciat'))

        def _is_current_asset_no_cash(a) -> bool:
            if _is_cash(a):
                return False
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('current', 'receivable', 'inventory', 'prepaid'))

        def _is_current_liability(a) -> bool:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('current', 'payable', 'credit card'))

        def _is_long_term_liability(a) -> bool:
            s = ((a.sub_type or '') + (a.account_name or '')).lower()
            return any(k in s for k in ('long', 'term', 'loan', 'mortgage', 'note'))

        adjustments: List[Dict[str, Any]] = []
        for a in expenses:
            s = (a.account_name or '').lower()
            if 'depreciation' in s or 'amortization' in s:
                bal = ReportService._period_activity(a.id, start_date, end_date, a.balance_type or 'debit')
                if abs(bal) > 1e-9:
                    adjustments.append(ReportService._cash_flow_adjustment(a.account_name, bal, a.id))

        working_capital: List[Dict[str, Any]] = []
        for a in assets:
            if not _is_current_asset_no_cash(a):
                continue
            beg = ReportService._balance_as_of(a.id, prior)
            end = ReportService._balance_as_of(a.id, end_date)
            ch = end - beg
            if abs(ch) > 1e-9:
                working_capital.append(
                    ReportService._cash_flow_adjustment(f'Change in {a.account_name}', -ch, a.id)
                )
        for a in liabilities:
            if not _is_current_liability(a):
                continue
            beg = ReportService._balance_as_of(a.id, prior)
            end = ReportService._balance_as_of(a.id, end_date)
            ch = end - beg
            if abs(ch) > 1e-9:
                working_capital.append(
                    ReportService._cash_flow_adjustment(f'Change in {a.account_name}', ch, a.id)
                )

        adj_total = sum(x['amount'] for x in adjustments)
        wc_total = sum(x['amount'] for x in working_capital)
        net_cash_operations = net_income + adj_total + wc_total

        investing: List[Dict[str, Any]] = []
        for a in assets:
            if not _is_fixed(a):
                continue
            ledger = TransactionRepository.get_general_ledger(a.id, start_date, end_date)
            purchases = sum(e.get('debit_amount') or 0 for e in ledger)
            sales = sum(e.get('credit_amount') or 0 for e in ledger)
            if purchases > 1e-9:
                investing.append(
                    ReportService._cash_flow_adjustment(f'Purchase of {a.account_name}', -purchases, a.id)
                )
            if sales > 1e-9:
                investing.append(
                    ReportService._cash_flow_adjustment(f'Sale of {a.account_name}', sales, a.id)
                )
        net_investing = sum(x['amount'] for x in investing)

        financing: List[Dict[str, Any]] = []
        for a in liabilities:
            if not _is_long_term_liability(a):
                continue
            ledger = TransactionRepository.get_general_ledger(a.id, start_date, end_date)
            borrow = sum(e.get('credit_amount') or 0 for e in ledger)
            pay = sum(e.get('debit_amount') or 0 for e in ledger)
            if borrow > 1e-9:
                financing.append(
                    ReportService._cash_flow_adjustment(f'Proceeds from {a.account_name}', borrow, a.id)
                )
            if pay > 1e-9:
                financing.append(
                    ReportService._cash_flow_adjustment(f'Payment on {a.account_name}', -pay, a.id)
                )
        total_contrib = 0.0
        total_draws = 0.0
        for a in equity:
            s = (a.account_name or '').lower()
            if 'retained' in s or 'earnings' in s:
                continue
            ledger = TransactionRepository.get_general_ledger(a.id, start_date, end_date)
            total_contrib += sum(e.get('credit_amount') or 0 for e in ledger)
            total_draws += sum(e.get('debit_amount') or 0 for e in ledger)
        if total_contrib > 1e-9:
            financing.append(
                ReportService._cash_flow_adjustment('Owner contributions', total_contrib, None)
            )
        if total_draws > 1e-9:
            financing.append(
                ReportService._cash_flow_adjustment('Owner draws', -total_draws, None)
            )
        net_financing = sum(x['amount'] for x in financing)

        net_change = net_cash_operations + net_investing + net_financing

        return {
            'operating_activities': {
                'net_income': net_income,
                'adjustments': adjustments,
                'working_capital_changes': working_capital,
                'net_cash_from_operations': net_cash_operations,
            },
            'investing_activities': {
                'items': investing,
                'net_cash_from_investing': net_investing,
            },
            'financing_activities': {
                'items': financing,
                'net_cash_from_financing': net_financing,
            },
            'beginning_cash': beginning_cash,
            'net_change_in_cash': net_change,
            'ending_cash': ending_cash,
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
