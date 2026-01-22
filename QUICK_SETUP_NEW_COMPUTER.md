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

## 5. Run Schema

```bash
psql -U postgres -d pos_db -f schema_supabase.sql
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

## 7. Install Dependencies

```bash
# Python dependencies
pip3 install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..
```

## 8. Start Application

**Terminal 1 - Backend:**
```bash
python3 web_viewer.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 9. Log In

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
