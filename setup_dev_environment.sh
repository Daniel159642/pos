#!/bin/bash
# Development Environment Setup Script
# POS Accounting System - Step 2

set -e  # Exit on error

echo "🚀 Setting up POS Accounting System Development Environment"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking Prerequisites..."
echo ""

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_success "Python $PYTHON_VERSION found"
else
    print_error "Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION found"
else
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_success "npm $NPM_VERSION found"
else
    print_error "npm not found. Please install npm"
    exit 1
fi

# Check PostgreSQL
if command_exists psql; then
    PSQL_VERSION=$(psql --version | cut -d' ' -f3)
    print_success "PostgreSQL $PSQL_VERSION found"
else
    print_warning "PostgreSQL not found. Please install PostgreSQL 14+"
    echo "  macOS: brew install postgresql@14"
    echo "  Linux: sudo apt-get install postgresql-14"
fi

# Check Git
if command_exists git; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    print_success "Git $GIT_VERSION found"
else
    print_error "Git not found. Please install Git"
    exit 1
fi

echo ""
echo "📦 Setting up Python Environment..."
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_success "Creating Python virtual environment..."
    python3 -m venv venv
else
    print_success "Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
print_success "Upgrading pip..."
pip install --upgrade pip --quiet

# Install Python dependencies
if [ -f "requirements.txt" ]; then
    print_success "Installing Python dependencies..."
    pip install -r requirements.txt --quiet
    print_success "Python dependencies installed"
else
    print_warning "requirements.txt not found"
fi

echo ""
echo "📦 Setting up Frontend Environment..."
echo ""

# Install frontend dependencies
if [ -d "frontend" ]; then
    cd frontend
    
    if [ -f "package.json" ]; then
        print_success "Installing frontend dependencies..."
        npm install --silent
        print_success "Frontend dependencies installed"
    else
        print_warning "package.json not found in frontend directory"
    fi
    
    cd ..
else
    print_warning "frontend directory not found"
fi

echo ""
echo "🗄️  Database Setup..."
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your database credentials"
    else
        print_warning ".env file not found. Please create it manually"
    fi
else
    print_success ".env file exists"
fi

# Check PostgreSQL connection
if command_exists psql; then
    print_success "PostgreSQL is installed"
    echo ""
    echo "To set up the database, run:"
    echo "  psql postgres"
    echo "  CREATE DATABASE pos_db;"
    echo "  CREATE USER pos_user WITH ENCRYPTED PASSWORD 'your_password';"
    echo "  GRANT ALL PRIVILEGES ON DATABASE pos_db TO pos_user;"
    echo ""
    echo "Then run the schema files:"
    echo "  psql -U pos_user -d pos_db -f accounting_schema.sql"
    echo "  psql -U pos_user -d pos_db -f accounting_triggers.sql"
    echo "  psql -U pos_user -d pos_db -f accounting_functions.sql"
    echo "  psql -U pos_user -d pos_db -f accounting_seed_data.sql"
else
    print_warning "PostgreSQL not found. Please install and set up database manually"
fi

echo ""
echo "✅ Development Environment Setup Complete!"
echo ""
echo "Next Steps:"
echo "1. Edit .env file with your database credentials"
echo "2. Set up PostgreSQL database (see instructions above)"
echo "3. Run database schema files"
echo "4. Start backend: python3 web_viewer.py"
echo "5. Start frontend: cd frontend && npm run dev"
echo ""
echo "For detailed instructions, see DEVELOPMENT_SETUP.md"
echo ""
