# Development Environment Setup Checklist
## POS Accounting System - Step 2

Use this checklist to verify your development environment is properly set up.

## ✅ Installation Checklist

### Required Software
- [ ] **Python 3.8+** installed and verified
  ```bash
  python3 --version
  ```
- [ ] **Node.js 18+** installed and verified
  ```bash
  node --version
  npm --version
  ```
- [ ] **PostgreSQL 14+** installed and running
  ```bash
  psql --version
  # Check if running:
  brew services list  # macOS
  # or
  sudo systemctl status postgresql  # Linux
  ```
- [ ] **Git** installed and configured
  ```bash
  git --version
  git config --global user.name "Your Name"
  git config --global user.email "your.email@example.com"
  ```
- [ ] **VS Code** (or preferred editor) installed
- [ ] **VS Code Extensions** installed:
  - [ ] Python (Microsoft)
  - [ ] ESLint
  - [ ] Prettier
  - [ ] GitLens
  - [ ] PostgreSQL
  - [ ] Thunder Client
- [ ] **Database GUI Tool** installed (pgAdmin/DBeaver/TablePlus)
- [ ] **API Testing Tool** installed (Postman/Insomnia/Thunder Client)

---

## ✅ Database Setup Checklist

- [ ] **PostgreSQL service** is running
- [ ] **Database created** (`pos_db`)
  ```bash
  psql postgres -c "CREATE DATABASE pos_db;"
  ```
- [ ] **Database user created** (`pos_user`)
  ```bash
  psql postgres -c "CREATE USER pos_user WITH ENCRYPTED PASSWORD 'your_password';"
  ```
- [ ] **Privileges granted**
  ```bash
  psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE pos_db TO pos_user;"
  ```
- [ ] **Schema files executed:**
  - [ ] `accounting_schema.sql`
  - [ ] `accounting_triggers.sql`
  - [ ] `accounting_functions.sql`
  - [ ] `accounting_seed_data.sql`
- [ ] **Can connect to database** from command line
  ```bash
  psql -U pos_user -d pos_db
  ```
- [ ] **Can view tables** in GUI tool
- [ ] **Test connection script** runs successfully
  ```bash
  python3 check_postgres_connection.py
  ```

---

## ✅ Backend Setup Checklist

- [ ] **Project directory** structure exists
- [ ] **Python virtual environment** created
  ```bash
  python3 -m venv venv
  source venv/bin/activate  # macOS/Linux
  ```
- [ ] **Dependencies installed**
  ```bash
  pip install -r requirements.txt
  ```
- [ ] **Environment variables** configured (`.env` file)
  - [ ] Database connection string
  - [ ] Database credentials
  - [ ] Flask configuration
- [ ] **Database connection** working
  ```bash
  python3 -c "from database_postgres import get_connection; conn = get_connection(); print('✅ Connected!'); conn.close()"
  ```
- [ ] **Test script** runs successfully
  ```bash
  python3 check_postgres_connection.py
  ```
- [ ] **Flask server** starts without errors
  ```bash
  python3 web_viewer.py
  ```
- [ ] **Health check endpoint** works (if available)
  ```bash
  curl http://localhost:5000/api/health
  # or
  curl http://localhost:5000
  ```
- [ ] **Can make API calls** from Postman/Thunder Client

---

## ✅ Frontend Setup Checklist

- [ ] **React project** structure exists
- [ ] **Dependencies installed**
  ```bash
  cd frontend
  npm install
  ```
- [ ] **Development server** runs
  ```bash
  npm run dev
  ```
- [ ] **App opens in browser** (http://localhost:5173)
- [ ] **Hot reload working** (make a change, see it update)
- [ ] **No console errors** in browser
- [ ] **Can navigate** to different pages
- [ ] **API calls work** from frontend (check Network tab)

---

## ✅ Version Control Checklist

- [ ] **Git repository** initialized
  ```bash
  git status
  ```
- [ ] **`.gitignore`** configured correctly
  - [ ] `.env` is ignored
  - [ ] `venv/` is ignored
  - [ ] `node_modules/` is ignored
  - [ ] `__pycache__/` is ignored
- [ ] **Initial commit** made (if new project)
- [ ] **Remote repository** connected (GitHub/GitLab)
  ```bash
  git remote -v
  ```
- [ ] **Development branch** exists
  ```bash
  git branch
  ```
- [ ] **README files** created and documented

---

## ✅ Documentation Checklist

- [ ] **README.md** with setup instructions
- [ ] **DEVELOPMENT_SETUP.md** created
- [ ] **PROJECT_STRUCTURE.md** created
- [ ] **Database connection** instructions documented
- [ ] **Environment variables** documented
- [ ] **Project structure** documented
- [ ] **Development workflow** documented

---

## ✅ Code Quality Checklist

### Python
- [ ] **Code formatter** configured (black, autopep8)
- [ ] **Linter** configured (pylint, flake8)
- [ ] **Type checking** available (mypy) - optional
- [ ] **Tests** can run
  ```bash
  python3 -m pytest tests/
  ```

### JavaScript/React
- [ ] **ESLint** configured
- [ ] **Prettier** configured
- [ ] **Code formatting** works
  ```bash
  cd frontend
  npm run format  # if configured
  ```

---

## ✅ Integration Tests

- [ ] **Backend running** on port 5000
- [ ] **Frontend running** on port 5173 (or configured port)
- [ ] **No CORS errors** in browser console
- [ ] **Can call API** from frontend
  ```javascript
  // Test in browser console:
  fetch('http://localhost:5000/api/accounting/accounts')
    .then(r => r.json())
    .then(console.log)
  ```
- [ ] **Login works** (if authentication is set up)
- [ ] **Accounting tab loads** correctly
- [ ] **All tabs** in Accounting page work

---

## ✅ Final Verification

Run these tests to verify everything works:

### Test 1: Database Connection
```bash
python3 check_postgres_connection.py
```
**Expected:** ✅ Connection successful, tables listed

### Test 2: Backend Server
```bash
python3 web_viewer.py
```
**Expected:** Server starts without errors, accessible at http://localhost:5000

### Test 3: API Health Check
```bash
curl http://localhost:5000/api/health
# or
curl http://localhost:5000
```
**Expected:** JSON response or HTML page

### Test 4: Frontend App
```bash
cd frontend
npm run dev
```
**Expected:** App opens in browser, displays login page or dashboard

### Test 5: Full Stack Connection
- Backend running on port 5000
- Frontend running on port 5173
- No CORS errors
- Can call API from frontend

---

## 🎯 Success Criteria

Step 2 is complete when:

- ✅ All software installed and verified
- ✅ Database created and seeded with data
- ✅ Backend server runs without errors
- ✅ Frontend app runs without errors
- ✅ Can connect to database from backend
- ✅ API endpoints respond correctly
- ✅ Git repository set up and working
- ✅ All configuration files in place
- ✅ Environment variables configured
- ✅ Documentation complete

---

## 📝 Notes

- If any item is unchecked, refer to `DEVELOPMENT_SETUP.md` for detailed instructions
- For troubleshooting, see the Troubleshooting section in `DEVELOPMENT_SETUP.md`
- All setup scripts should be run from the project root directory

---

**Setup Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

Date Completed: _______________
