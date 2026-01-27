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

## Step 5: Run Database Schema

```bash
# Run the schema to create all tables
psql -U postgres -d pos_db -f schema_supabase.sql

# Or if using a different user:
psql -U your_username -d pos_db -f schema_supabase.sql
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

## Step 7: Install Python Dependencies

```bash
pip3 install -r requirements.txt
```

## Step 8: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

## Step 9: Verify Setup

```bash
# Test database connection
python3 check_postgres_connection.py

# Should show: ✓ All checks passed!
```

## Step 10: Start the Application

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

## Step 11: Log In

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
