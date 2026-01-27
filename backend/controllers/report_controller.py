#!/usr/bin/env python3
"""
Report Controller
Handles HTTP requests and responses for report endpoints
"""

from flask import request, jsonify
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.services.report_service import report_service
from backend.middleware.error_handler import AppError


class ReportController:
    """Controller for report-related endpoints"""
    
    @staticmethod
    def get_profit_loss() -> tuple:
        """Get Profit & Loss statement"""
        try:
            start_date_str = request.args.get('start_date')
            end_date_str = request.args.get('end_date')
            
            if not start_date_str or not end_date_str:
                # Default to current year
                today = datetime.now().date()
                start_date = datetime(today.year, 1, 1).date()
                end_date = today
            else:
                start_date = datetime.fromisoformat(start_date_str.split('T')[0]).date()
                end_date = datetime.fromisoformat(end_date_str.split('T')[0]).date()
            
            report = report_service.get_profit_loss(start_date, end_date)
            
            return jsonify({
                'success': True,
                'data': report
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)
    
    @staticmethod
    def get_comparative_profit_loss() -> tuple:
        """Get comparative Profit & Loss statement"""
        try:
            current_start_str = request.args.get('current_start')
            current_end_str = request.args.get('current_end')
            prior_start_str = request.args.get('prior_start')
            prior_end_str = request.args.get('prior_end')
            
            if not all([current_start_str, current_end_str, prior_start_str, prior_end_str]):
                raise AppError('All date parameters are required for comparative report', 400)
            
            current_start = datetime.fromisoformat(current_start_str.split('T')[0]).date()
            current_end = datetime.fromisoformat(current_end_str.split('T')[0]).date()
            prior_start = datetime.fromisoformat(prior_start_str.split('T')[0]).date()
            prior_end = datetime.fromisoformat(prior_end_str.split('T')[0]).date()
            
            report = report_service.get_comparative_profit_loss(
                current_start,
                current_end,
                prior_start,
                prior_end
            )
            
            return jsonify({
                'success': True,
                'data': report
            }), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_balance_sheet() -> tuple:
        """Get Balance Sheet as of date"""
        try:
            as_of_str = request.args.get('as_of_date')
            if not as_of_str:
                as_of = datetime.now().date()
            else:
                as_of = datetime.fromisoformat(as_of_str.split('T')[0]).date()
            report = report_service.get_balance_sheet(as_of)
            return jsonify({'success': True, 'data': report}), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_comparative_balance_sheet() -> tuple:
        """Get comparative Balance Sheet"""
        try:
            current_str = request.args.get('current_date')
            prior_str = request.args.get('prior_date')
            if not current_str or not prior_str:
                raise AppError('current_date and prior_date are required', 400)
            current_date = datetime.fromisoformat(current_str.split('T')[0]).date()
            prior_date = datetime.fromisoformat(prior_str.split('T')[0]).date()
            report = report_service.get_comparative_balance_sheet(current_date, prior_date)
            return jsonify({'success': True, 'data': report}), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_cash_flow() -> tuple:
        """Get Cash Flow statement"""
        try:
            start_str = request.args.get('start_date')
            end_str = request.args.get('end_date')
            if not start_str or not end_str:
                today = datetime.now().date()
                start_date = datetime(today.year, 1, 1).date()
                end_date = today
            else:
                start_date = datetime.fromisoformat(start_str.split('T')[0]).date()
                end_date = datetime.fromisoformat(end_str.split('T')[0]).date()
            report = report_service.get_cash_flow(start_date, end_date)
            return jsonify({'success': True, 'data': report}), 200
        except Exception as e:
            raise AppError(str(e), 500)

    @staticmethod
    def get_comparative_cash_flow() -> tuple:
        """Get comparative Cash Flow"""
        try:
            current_start = request.args.get('current_start')
            current_end = request.args.get('current_end')
            prior_start = request.args.get('prior_start')
            prior_end = request.args.get('prior_end')
            if not all([current_start, current_end, prior_start, prior_end]):
                raise AppError('current_start, current_end, prior_start, prior_end required', 400)
            cs = datetime.fromisoformat(current_start.split('T')[0]).date()
            ce = datetime.fromisoformat(current_end.split('T')[0]).date()
            ps = datetime.fromisoformat(prior_start.split('T')[0]).date()
            pe = datetime.fromisoformat(prior_end.split('T')[0]).date()
            report = report_service.get_comparative_cash_flow(cs, ce, ps, pe)
            return jsonify({'success': True, 'data': report}), 200
        except Exception as e:
            raise AppError(str(e), 500)


# Singleton instance
report_controller = ReportController()
