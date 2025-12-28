# Hybrid Categorization Setup Guide

## Overview

The system now uses a **hybrid approach**:
- **K-Means Clustering** (fast, accurate grouping) - Required
- **Mistral LLM** (natural category names) - Optional but recommended

## Installation Steps

### 1. Install Ollama

**macOS:**
```bash
brew install ollama
# Or download from https://ollama.ai/download
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download

### 2. Start Ollama Service

```bash
ollama serve
```

Keep this running in a terminal, or run it as a background service.

### 3. Pull Mistral Model

```bash
ollama pull mistral
```

This downloads the Mistral model (~4.1GB). Alternative models:
- `ollama pull llama3` - Llama 3 (smaller, faster)
- `ollama pull llama3.1` - Llama 3.1 (newer, better)
- `ollama pull codellama` - Code-focused model

### 4. Install Python Ollama Package

```bash
pip3 install ollama
```

### 5. Verify Installation

```bash
python3 -c "import ollama; print('Ollama available!')"
ollama list  # Should show mistral
```

## How It Works

### Without LLM (Fallback)
- Uses K-Means clustering ✓
- Generates category names from keywords (e.g., "Cucumbers Tomatoes Onions")

### With LLM (Hybrid)
- Uses K-Means clustering ✓ (unchanged - still fast and accurate)
- Generates natural category names using Mistral (e.g., "Fresh Vegetables")

## Usage

The system automatically uses LLM if available:

```python
from metadata_extraction import FreeMetadataSystem

ms = FreeMetadataSystem()
ms.auto_categorize_products_kmeans()
```

If Ollama/Mistral is not available, it falls back to keyword-based naming automatically.

## Benefits

✅ **Best of both worlds:**
- Fast clustering (K-Means)
- Natural category names (LLM)
- Graceful fallback (works without LLM)

✅ **Free and local:**
- No API costs
- No data leaves your machine
- Runs entirely on your hardware

## Performance

- **With LLM**: ~2-5 seconds per category (first time slower, then cached)
- **Without LLM**: Instant (keyword-based)
- **Memory**: Mistral uses ~4-8GB RAM

## Troubleshooting

### Ollama not found
```bash
# Check if Ollama is installed
which ollama

# Check if service is running
curl http://localhost:11434/api/tags
```

### Model not found
```bash
ollama pull mistral
```

### Slow generation
- Try a smaller model: `ollama pull llama3`
- Reduce `num_predict` in the code
- Use GPU if available

## Advanced Configuration

Edit `metadata_extraction.py` to customize:

```python
# Change model
response = ollama.generate(model='llama3', ...)

# Adjust temperature (lower = more deterministic)
options={'temperature': 0.2, ...}
```

