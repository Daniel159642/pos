#!/usr/bin/env python3
"""
Report Service Layer
Business logic for generating financial reports (P&L, Balance Sheet, etc.)
"""

from typing import Dict, Any, List, Optional
from datetime import date, datetime
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


# Singleton instance
report_service = ReportService()
