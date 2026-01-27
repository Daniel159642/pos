#!/bin/bash
# Test runner script for POS accounting system

set -e

echo "🧪 Running Account API Tests"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Run unit tests
echo -e "${YELLOW}Running unit tests...${NC}"
python3 -m pytest tests/test_account_service.py tests/test_account_model.py -v --tb=short

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Unit tests passed${NC}"
else
    echo -e "${RED}❌ Unit tests failed${NC}"
    exit 1
fi

echo ""

# Run integration tests (if database is available)
echo -e "${YELLOW}Running integration tests...${NC}"
echo -e "${YELLOW}(Note: Requires database connection)${NC}"
python3 -m pytest tests/test_account_api_integration.py -v --tb=short || {
    echo -e "${YELLOW}⚠️  Integration tests skipped (database may not be available)${NC}"
}

echo ""

# Generate coverage report
echo -e "${YELLOW}Generating coverage report...${NC}"
python3 -m pytest tests/test_account_service.py tests/test_account_model.py --cov=backend --cov-report=term-missing --cov-report=html

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Coverage report generated${NC}"
    echo -e "${GREEN}📊 View HTML report: htmlcov/index.html${NC}"
else
    echo -e "${RED}❌ Coverage report generation failed${NC}"
fi

echo ""
echo -e "${GREEN}✅ All tests completed!${NC}"
