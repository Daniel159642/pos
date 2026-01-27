# Development Environment Setup Guide
## POS Accounting System - Step 2

This guide will help you set up a complete development environment for the POS Accounting System.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Technology Stack](#technology-stack)
3. [Installation Steps](#installation-steps)
4. [Database Setup](#database-setup)
5. [Backend Setup](#backend-setup)
6. [Frontend Setup](#frontend-setup)
7. [Development Workflow](#development-workflow)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

#### 1. Python 3.8+
```bash
# Check Python version
python3 --version
# Should be 3.8 or higher

# If not installed, download from python.org
# Or use Homebrew (macOS):
brew install python@3.11
```

#### 2. Node.js 18+ LTS
```bash
# Check Node.js version
node --version
# Should be 18.x or higher

# If not installed:
# macOS: brew install node
# Or download from nodejs.org
```

#### 3. PostgreSQL 14+
```bash
# Check PostgreSQL version
psql --version
# Should be 14.x or higher

# If not installed:
# macOS: brew install postgresql@14
# Linux: sudo apt-get install postgresql-14
# Windows: Download from postgresql.org
```

#### 4. Git
```bash
# Check Git version
git --version

# Configure Git (if not already done)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### 5. Code Editor
**Recommended: Visual Studio Code**

Install VS Code extensions:
- Python (Microsoft)
- ESLint
- Prettier
- GitLens
- PostgreSQL (for database management)
- Thunder Client (for API testing)
- Python Docstring Generator

#### 6. Database GUI Tool (Optional but Recommended)
- **pgAdmin** (comes with PostgreSQL)
- **DBeaver** (free, cross-platform)
- **TablePlus** (paid, excellent UX)

#### 7. API Testing Tool
- **Postman** (free, full-featured)
- **Insomnia** (alternative)
- **Thunder Client** (VS Code extension)

---

## Technology Stack

### Backend
- **Framework**: Flask (Python)
- **Database**: PostgreSQL 14+
- **ORM**: psycopg2 (direct SQL)
- **Authentication**: Session-based (employee login)
- **API**: RESTful

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: React Context + useState
- **Styling**: CSS with theme support

### Database
- **Type**: PostgreSQL
- **Connection**: psycopg2-binary
- **Schema**: Double-entry bookkeeping system

---

## Installation Steps

### Step 1: Clone Repository (if not already done)
```bash
cd ~/projects  # or your preferred directory
git clone <repository-url> pos
cd pos
```

### Step 2: Set Up Python Virtual Environment
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip
```

### Step 3: Install Python Dependencies
```bash
# Install all dependencies
pip install -r requirements.txt

# Verify installation
pip list
```

### Step 4: Set Up Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### Step 5: Configure Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your database credentials
# See Database Setup section below
```

---

## Database Setup

### Step 1: Start PostgreSQL
```bash
# macOS (Homebrew):
brew services start postgresql@14

# Linux:
sudo systemctl start postgresql

# Windows: Start PostgreSQL service from Services
```

### Step 2: Create Database and User
```bash
# Connect to PostgreSQL
psql postgres

# Run these commands in psql:
CREATE DATABASE pos_db;
CREATE USER pos_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE pos_db TO pos_user;

# Connect to the database
\c pos_db

# Grant schema privileges
GRANT ALL ON SCHEMA public TO pos_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pos_user;

# Exit psql
\q
```

### Step 3: Run Database Schema
```bash
# Run accounting schema (from Step 1)
psql -U pos_user -d pos_db -f accounting_schema.sql
psql -U pos_user -d pos_db -f accounting_triggers.sql
psql -U pos_user -d pos_db -f accounting_functions.sql
psql -U pos_user -d pos_db -f accounting_seed_data.sql

# Run existing POS schema (if needed)
psql -U pos_user -d pos_db -f schema_supabase.sql
```

### Step 4: Configure .env File
Edit `.env` file with your database credentials:
```env
# Database Configuration
DATABASE_URL=postgresql://pos_user:your_secure_password@localhost:5432/pos_db
# OR use individual components:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pos_db
DB_USER=pos_user
DB_PASSWORD=your_secure_password
```

### Step 5: Test Database Connection
```bash
# Run connection test script
python3 check_postgres_connection.py

# Or test manually:
python3 -c "from database_postgres import get_connection; conn = get_connection(); print('✅ Connected!'); conn.close()"
```

---

## Backend Setup

### Project Structure
```
pos/
├── web_viewer.py          # Main Flask application
├── database.py            # Database abstraction layer
├── database_postgres.py   # PostgreSQL connection
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables
├── config/                # Configuration files (create if needed)
├── tests/                 # Test files
└── scripts/               # Utility scripts
```

### Start Backend Server
```bash
# Make sure virtual environment is activated
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Start Flask server
python3 web_viewer.py

# Server should start on http://localhost:5000
```

### Verify Backend
```bash
# Test health endpoint (if available)
curl http://localhost:5000/api/health

# Or open in browser:
# http://localhost:5000
```

---

## Frontend Setup

### Project Structure
```
frontend/
├── src/
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── contexts/          # React contexts
│   ├── App.jsx            # Main app component
│   └── main.jsx           # Entry point
├── public/                # Static files
├── package.json           # Node dependencies
└── vite.config.js         # Vite configuration
```

### Start Frontend Development Server
```bash
cd frontend

# Start development server
npm run dev

# Server should start on http://localhost:5173 (Vite default)
# Or check the output for the actual port
```

### Verify Frontend
- Open browser to http://localhost:5173
- You should see the login page or dashboard

---

## Development Workflow

### Daily Development

1. **Start Database**
   ```bash
   brew services start postgresql@14  # macOS
   ```

2. **Activate Python Environment**
   ```bash
   source venv/bin/activate
   ```

3. **Start Backend**
   ```bash
   python3 web_viewer.py
   ```

4. **Start Frontend** (in separate terminal)
   ```bash
   cd frontend
   npm run dev
   ```

5. **Make Changes**
   - Backend: Changes auto-reload with Flask debug mode
   - Frontend: Hot module replacement (HMR) with Vite

### Code Quality

#### Python
```bash
# Format code (install black first: pip install black)
black web_viewer.py database.py

# Lint code (install pylint first: pip install pylint)
pylint web_viewer.py

# Type checking (install mypy first: pip install mypy)
mypy web_viewer.py
```

#### JavaScript/React
```bash
cd frontend

# Format code
npm run format  # if configured

# Lint code
npm run lint    # if configured
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Description of changes"

# Push to remote
git push origin feature/your-feature-name

# Create pull request on GitHub
```

---

## Testing

### Backend Tests
```bash
# Run all tests
python3 -m pytest tests/

# Run specific test file
python3 -m pytest tests/test_accounting_system.py

# Run with coverage
pip install pytest-cov
python3 -m pytest tests/ --cov=. --cov-report=html
```

### Frontend Tests
```bash
cd frontend

# Install testing dependencies (if not already)
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest

# Run tests (if configured)
npm test
```

### Manual Testing

1. **Database Connection Test**
   ```bash
   python3 check_postgres_connection.py
   ```

2. **API Endpoints Test**
   - Use Postman or Thunder Client
   - Test endpoints like:
     - `GET /api/accounting/accounts`
     - `GET /api/accounting/trial-balance`
     - `POST /api/login`

3. **Frontend Integration Test**
   - Login to the application
   - Navigate to Accounting tab
   - Verify all tabs load correctly

---

## Troubleshooting

### Database Connection Issues

**Error: "could not connect to server"**
```bash
# Check if PostgreSQL is running
brew services list  # macOS
# or
sudo systemctl status postgresql  # Linux

# Start PostgreSQL if not running
brew services start postgresql@14
```

**Error: "password authentication failed"**
- Check `.env` file has correct password
- Verify user exists: `psql -U postgres -c "\du"`
- Reset password: `ALTER USER pos_user WITH PASSWORD 'new_password';`

**Error: "database does not exist"**
```bash
# Create database
createdb pos_db
# Or connect to postgres and create:
psql postgres -c "CREATE DATABASE pos_db;"
```

### Backend Issues

**Error: "Module not found"**
```bash
# Reinstall dependencies
pip install -r requirements.txt

# Check virtual environment is activated
which python  # Should show venv path
```

**Error: "Port already in use"**
```bash
# Find process using port 5000
lsof -i :5000  # macOS/Linux
# Kill process
kill -9 <PID>
```

### Frontend Issues

**Error: "Cannot find module"**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Error: "Port already in use"**
- Vite will automatically use next available port
- Or specify port in `vite.config.js`

**CORS Errors**
- Make sure backend CORS is configured
- Check `flask-cors` is installed
- Verify frontend URL is in allowed origins

---

## Next Steps

After completing this setup:

1. ✅ Verify all services are running
2. ✅ Test database connection
3. ✅ Test API endpoints
4. ✅ Test frontend application
5. ✅ Review project structure
6. ✅ Set up your IDE/editor
7. ✅ Configure Git hooks (optional)
8. ✅ Set up CI/CD (optional)

---

## Additional Resources

- [Flask Documentation](https://flask.palletsprojects.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Vite Documentation](https://vitejs.dev/)

---

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Review error messages carefully
3. Check logs in terminal
4. Verify all prerequisites are installed
5. Check GitHub issues (if applicable)

---

**Setup Complete!** 🎉

You're now ready to start developing the POS Accounting System.
