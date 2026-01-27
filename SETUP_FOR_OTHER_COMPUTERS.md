# Setup Guide for Other Computers

This guide will help you set up the POS system on another computer so someone can log in.

## Prerequisites

1. **PostgreSQL installed** on the computer
2. **Python 3.9+** installed
3. **Node.js and npm** installed (for frontend)

## Step 1: Clone the Repository

```bash
git clone https://github.com/Daniel159642/pos.git
cd pos
git checkout develop
```

## Step 2: Install PostgreSQL

### macOS
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Linux
```bash
sudo apt-get install postgresql
sudo systemctl start postgresql
```

### Windows
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

## Step 3: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE pos_db;

# Exit
\q
```

## Step 4: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and update with your PostgreSQL credentials
# Default (if using postgres user):
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos_db
```

**Note:** If your PostgreSQL user is different, update the connection string accordingly.

## Step 5: Run Complete Database Setup (RECOMMENDED)

**Easiest way - runs everything automatically:**
```bash
python3 setup_complete_database.py
```

This script will:
- Create the database if needed
- Run all schemas (main, accounting, returns)
- Run all migrations
- Create admin account (ADMIN001 / 123456)
- Initialize permissions

**OR manually step by step:**

### Step 5a: Run Main Schema
```bash
psql -U postgres -d pos_db -f schema_postgres.sql
```

### Step 5b: Run Accounting Schema
```bash
psql -U postgres -d pos_db -f accounting_schema.sql
```

### Step 5c: Run Returns Schema
```bash
psql -U postgres -d pos_db -f returns_schema.sql
```

### Step 5d: Run Migrations
```bash
for file in migrations/*.sql; do 
    psql -U postgres -d pos_db -f "$file"
done
```

## Step 6: Create Admin Account

```bash
# Run the admin account creation script
python3 create_admin_account.py
```

Follow the prompts:
- Employee Code: `ADMIN001` (or your choice)
- First Name: `Admin` (or your name)
- Last Name: `User` (or your name)
- Password: `123456` (or your choice - remember this!)

## Step 7: Initialize Admin Permissions (CRITICAL!)

```bash
# This sets up roles and permissions - REQUIRED for admin to have access
python3 init_admin_permissions.py
```

**⚠️ IMPORTANT:** Without running this script, the admin account won't have permissions to:
- Access accounting features
- Process payments
- Manage settings
- And other admin functions

This script:
- Creates default roles (Admin, Manager, Cashier, etc.)
- Sets up all permissions
- Assigns Admin role to your admin account

## Step 8: Install Python Dependencies

```bash
pip3 install -r requirements.txt
```

## Step 9: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

## Step 10: Verify Setup

```bash
# Test database connection
python3 check_postgres_connection.py

# Should show: ✓ All checks passed!
```

## Step 11: Start the Application

### Terminal 1 - Backend
```bash
cd /path/to/pos
python3 web_viewer.py
```

You should see:
```
✓ Connected to local PostgreSQL database
Starting web viewer...
Open your browser to: http://localhost:5001
```

### Terminal 2 - Frontend
```bash
cd /path/to/pos/frontend
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3000/
```

## Step 12: Log In

1. Open browser to: **http://localhost:3000**
2. Select employee: **ADMIN001** (or the code you created)
3. Enter password: **123456** (or the password you set)
4. Click Login

## Default Admin Account

If you used the default values:
- **Employee Code:** ADMIN001
- **Password:** 123456

⚠️ **Change the password after first login!**

## Troubleshooting

### Database Connection Fails
- Check PostgreSQL is running: `brew services list | grep postgresql` (macOS)
- Verify connection string in `.env` file
- Test connection: `python3 check_postgres_connection.py`

### No Employees in Dropdown
- Verify admin account exists: `psql -U postgres -d pos_db -c "SELECT * FROM employees;"`
- Check backend is running on port 5001
- Check browser console for errors

### Login Fails
- Verify password is correct
- Check employee is active: `SELECT active FROM employees WHERE employee_code = 'ADMIN001';`
- Check backend logs for error messages

## Creating Additional Accounts

To create more employee accounts:

```bash
python3 create_admin_account.py
```

Or use the Employee Management interface in the web app (after logging in as admin).

## Notes

- Each computer needs its own local PostgreSQL database
- Data is stored locally on each computer (not synced)
- The `.env` file is NOT committed to git (for security)
- Database connection info is in `.env.example` (template only)
