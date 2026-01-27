#!/usr/bin/env python3
"""
Error handling middleware
"""

from flask import jsonify
from typing import Any


class AppError(Exception):
    """Custom application error"""
    
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def handle_error(error: Any) -> tuple:
    """Handle application errors"""
    print(f"Error: {error}")
    
    # Handle custom AppError
    if isinstance(error, AppError):
        return jsonify({
            'success': False,
            'message': error.message
        }), error.status_code
    
    # Handle ValueError (validation errors)
    if isinstance(error, ValueError):
        error_msg = str(error)
        
        # Check for common database errors
        if 'duplicate key' in error_msg.lower() or 'already exists' in error_msg.lower():
            return jsonify({
                'success': False,
                'message': 'A record with this information already exists'
            }), 409
        
        if 'not found' in error_msg.lower():
            return jsonify({
                'success': False,
                'message': error_msg
            }), 404
        
        if 'cannot delete' in error_msg.lower() or 'cannot modify' in error_msg.lower():
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        return jsonify({
            'success': False,
            'message': error_msg
        }), 400
    
    # Handle database connection errors
    if 'connection' in str(error).lower() or 'database' in str(error).lower():
        return jsonify({
            'success': False,
            'message': 'Database connection error'
        }), 500
    
    # Default error handler
    import traceback
    traceback.print_exc()
    
    return jsonify({
        'success': False,
        'message': 'Internal server error'
    }), 500
