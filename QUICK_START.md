# Quick Start Guide

## Login Credentials

**Employee Code:** `TAX001`  
**Password:** `test123`

## Starting the Application

### 1. Start the Backend Server (Flask)

Open a terminal and run:
```bash
cd /Users/danielbudnyatsky/pos
python3 web_viewer.py
```

You should see:
```
Starting web viewer...
Open your browser to: http://localhost:5001
 * Running on http://0.0.0.0:5001
```

### 2. Start the Frontend Server (React/Vite)

Open a **new terminal** and run:
```bash
cd /Users/danielbudnyatsky/pos/frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### 3. Access the Application

Open your browser to: **http://localhost:3000**

### 4. Login

Use the credentials above:
- Employee Code: `TAX001`
- Password: `test123`

## Troubleshooting

### Error: "Failed to load resource: 404"
- Make sure the backend server is running on port 5001
- Check that `python3 web_viewer.py` is running

### Error: "Failed to load resource: 500"
- Check the backend terminal for error messages
- Make sure the database exists: `python3 init_database.py`

### Error: "Connection error"
- Verify both servers are running
- Backend should be on port 5001
- Frontend should be on port 3000
- Check that the Vite proxy is configured correctly

### Error: "Cannot import name..."
- Make sure you're in the correct directory
- Try: `python3 -c "from database import employee_login; print('OK')"`

## Creating New Employees

To create additional login accounts:

```python
from database import add_employee

add_employee(
    employee_code="EMP001",
    first_name="John",
    last_name="Doe",
    position="cashier",
    date_started="2024-01-01",
    password="yourpassword"
)
```

## Ports

- **Backend (Flask):** http://localhost:5001
- **Frontend (Vite):** http://localhost:3000
- **API Proxy:** Frontend proxies `/api/*` to backend

