#!/bin/bash
# Install hybrid categorization system (K-Means + Mistral LLM)

echo "========================================="
echo "Installing Hybrid Categorization System"
echo "========================================="
echo ""
echo "This installs:"
echo "  1. Ollama (local LLM server)"
echo "  2. Mistral model (~4.1GB download)"
echo "  3. Python ollama package"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "⚠ Ollama not found. Installing Ollama..."
    echo ""
    echo "Please install Ollama first:"
    echo "  macOS: brew install ollama"
    echo "  Linux: curl -fsSL https://ollama.ai/install.sh | sh"
    echo "  Or download from: https://ollama.ai/download"
    echo ""
    read -p "Press Enter after installing Ollama, or Ctrl+C to cancel..."
else
    echo "✓ Ollama is installed"
fi

# Start Ollama service (if not running)
echo ""
echo "Checking Ollama service..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✓ Ollama service is running"
else
    echo "⚠ Ollama service not running. Start it with: ollama serve"
    echo "   (Run this in a separate terminal and keep it running)"
    read -p "Press Enter after starting Ollama service, or Ctrl+C to cancel..."
fi

# Pull Mistral model
echo ""
echo "Downloading Mistral model (~4.1GB, this may take a while)..."
ollama pull mistral

if [ $? -eq 0 ]; then
    echo "✓ Mistral model downloaded"
else
    echo "⚠ Failed to download Mistral model"
    exit 1
fi

# Install Python package
echo ""
echo "Installing Python ollama package..."
pip3 install ollama

if [ $? -eq 0 ]; then
    echo "✓ Python ollama package installed"
else
    echo "⚠ Failed to install ollama package"
    exit 1
fi

# Verify installation
echo ""
echo "Verifying installation..."
python3 -c "import ollama; print('✓ Ollama Python package works')" 2>/dev/null || echo "⚠ Ollama Python package import failed"

echo ""
echo "========================================="
echo "✓ Hybrid System Installation Complete!"
echo "========================================="
echo ""
echo "The system will now:"
echo "  - Use K-Means for fast, accurate clustering"
echo "  - Use Mistral LLM for natural category names"
echo ""
echo "Run categorization:"
echo "  python3 -c \"from metadata_extraction import FreeMetadataSystem; ms = FreeMetadataSystem(); ms.auto_categorize_products_kmeans()\""
echo ""








