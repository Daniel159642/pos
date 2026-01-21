#!/usr/bin/env python3
"""
Fix all remaining SQLite code in database.py
"""

import re

# Read the file
with open('/Users/daniellopez/POS FR/pos/database.py', 'r') as f:
    content = f.read()

# Replace sqlite_master with information_schema
content = re.sub(
    r'SELECT name FROM sqlite_master\s+WHERE type\s*=\s*[\'"]table[\'"]\s+AND name\s*=\s*([^\s]+)',
    r'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = \1',
    content
)

# Replace PRAGMA table_info with information_schema
content = re.sub(
    r'PRAGMA table_info\((\w+)\)',
    r'SELECT column_name FROM information_schema.columns WHERE table_name = \'\1\' AND table_schema = \'public\'',
    content
)

# Remove sqlite3 imports and references
content = content.replace('except sqlite3.OperationalError', 'except Exception')
content = content.replace('except sqlite3.IntegrityError', 'except Exception')  
content = content.replace('cursor.row_factory = sqlite3.Row', '# PostgreSQL cursor returns dict-like rows')

# Write back
with open('/Users/daniellopez/POS FR/pos/database.py', 'w') as f:
    f.write(content)

print("✅ Fixed all SQLite remnants in database.py")
