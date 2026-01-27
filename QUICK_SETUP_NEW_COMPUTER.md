# Quick Setup for New Computer

Follow these steps to get the POS system running on a new computer.

## 1. Clone and Setup

```bash
git clone https://github.com/Daniel159642/pos.git
cd pos
git checkout develop
```

## 2. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux:**
```bash
sudo apt-get install postgresql
sudo systemctl start postgresql
```

## 3. Create Database

```bash
psql postgres
CREATE DATABASE pos_db;
\q
```

## 4. Configure Database Connection

```bash
# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos_db
EOF
```

**Note:** Update the connection string if your PostgreSQL user/password is different.

## 5. Run Complete Database Setup (RECOMMENDED)

**Easiest way - runs everything automatically:**
```bash
python3 setup_complete_database.py
```

This script will:
- Create the database if needed
- Run all schemas (main, accounting, returns)
- Run all migrations
- Create admin account
- Initialize permissions

**OR manually:**

### 5a. Run Main Schema
```bash
psql -U postgres -d pos_db -f schema_postgres.sql
```

### 5b. Run Accounting Schema
```bash
psql -U postgres -d pos_db -f accounting_schema.sql
```

### 5c. Run Returns Schema
```bash
psql -U postgres -d pos_db -f returns_schema.sql
```

### 5d. Run Migrations
```bash
for file in migrations/*.sql; do psql -U postgres -d pos_db -f "$file"; done
```

## 6. Create Admin Account

```bash
python3 create_admin_account.py
```

Enter:
- Employee Code: `ADMIN001`
- First Name: `Admin`
- Last Name: `User`
- Password: `123456` (or your choice)

## 7. Initialize Admin Permissions (REQUIRED!)

```bash
python3 init_admin_permissions.py
```

**⚠️ CRITICAL:** Without this step, admin won't have permissions to access features like payments, accounting, etc.

## 8. Install Dependencies

```bash
# Python dependencies
pip3 install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..
```

## 9. Start Application

**Terminal 1 - Backend:**
```bash
python3 web_viewer.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 10. Log In

1. Open: http://localhost:3000
2. Select: **ADMIN001**
3. Password: **123456**
4. Click Login

## Default Login

- **Employee Code:** ADMIN001
- **Password:** 123456

⚠️ **Change password after first login!**

## Troubleshooting

- **No employees in dropdown?** Check backend is running on port 5001
- **Connection error?** Run: `python3 check_postgres_connection.py`
- **Login fails?** Verify admin account exists: `psql -U postgres -d pos_db -c "SELECT * FROM employees;"`

For detailed setup, see `SETUP_FOR_OTHER_COMPUTERS.md`
