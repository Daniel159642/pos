# Hybrid Categorization System

## Overview

The system now uses a **hybrid approach** that combines the best of both worlds:

1. **K-Means Clustering** (scikit-learn) - Fast, accurate product grouping
2. **Mistral LLM** (via Ollama) - Natural, human-readable category names

## How It Works

### Process Flow

```
1. Extract keywords from products (spaCy NLP)
   ↓
2. Convert to TF-IDF vectors
   ↓
3. K-Means clustering groups similar products
   ↓
4. For each cluster:
   a. Try LLM (Mistral) to generate category name
   b. If LLM unavailable, use keyword-based name
   ↓
5. Assign categories to products
```

### Example

**Without LLM (fallback):**
- Products: ["Cucumbers - English", "Tomatoes - Cherry", "Onions - Yellow"]
- Category: "Cucumbers Tomatoes Onions" (keyword mashup)

**With LLM (hybrid):**
- Products: ["Cucumbers - English", "Tomatoes - Cherry", "Onions - Yellow"]
- Category: "Fresh Vegetables" (natural, readable)

## Installation

### Quick Install

```bash
./install_hybrid_system.sh
```

### Manual Install

1. **Install Ollama:**
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Start Ollama service:**
   ```bash
   ollama serve
   # Keep this running in a terminal
   ```

3. **Download Mistral model:**
   ```bash
   ollama pull mistral
   # Downloads ~4.1GB model
   ```

4. **Install Python package:**
   ```bash
   pip3 install ollama
   ```

## Usage

The system automatically uses LLM if available:

```python
from metadata_extraction import FreeMetadataSystem

ms = FreeMetadataSystem()
ms.auto_categorize_products_kmeans()
```

If Ollama/Mistral is not available, it automatically falls back to keyword-based naming. No configuration needed!

## Benefits

✅ **Fast clustering** - K-Means is still used (milliseconds)  
✅ **Natural names** - LLM generates readable category names  
✅ **Graceful fallback** - Works without LLM (uses keywords)  
✅ **Free & local** - No API costs, runs on your machine  
✅ **Privacy** - All processing happens locally  

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| K-Means clustering | ~0.1s | Fast, unchanged |
| LLM category naming | ~2-5s per category | First run slower, then cached |
| Fallback (keywords) | Instant | When LLM unavailable |
| Memory usage | ~4-8GB RAM | For Mistral model |

## Configuration

### Change LLM Model

Edit `metadata_extraction.py`, find `_generate_category_name_with_llm`:

```python
response = ollama.generate(
    model='mistral',  # Change to 'llama3', 'llama3.1', etc.
    ...
)
```

Available models:
- `mistral` - 7B parameters, good balance
- `llama3` - Smaller, faster
- `llama3.1` - Newer, better quality
- `codellama` - Code-focused

### Adjust LLM Temperature

Lower = more deterministic, higher = more creative:

```python
options={
    'temperature': 0.3,  # Default: 0.3 (balanced)
    'num_predict': 20    # Length of response
}
```

## Troubleshooting

### Ollama Not Found

```bash
# Check installation
which ollama

# If not installed
brew install ollama  # macOS
# or download from https://ollama.ai
```

### Ollama Service Not Running

```bash
# Check if running
curl http://localhost:11434/api/tags

# Start service
ollama serve
```

### Model Not Found

```bash
# List available models
ollama list

# Pull Mistral
ollama pull mistral
```

### Python Package Import Error

```bash
pip3 install ollama
```

### LLM Generation Fails Silently

The system automatically falls back to keyword-based naming if LLM fails. Check:
1. Ollama service is running
2. Mistral model is downloaded (`ollama list`)
3. Enough memory available (4GB+)

## Code Structure

- `_generate_category_name_with_llm()` - Generates category name using LLM
- `auto_categorize_products_kmeans()` - Main clustering function (calls LLM)
- Falls back to keyword-based naming if LLM unavailable

## Next Steps

After installing Ollama and Mistral:

1. Run categorization:
   ```bash
   python3 -c "from metadata_extraction import FreeMetadataSystem; ms = FreeMetadataSystem(); ms.auto_categorize_products_kmeans()"
   ```

2. Sync categories to inventory:
   ```bash
   python3 sync_categories_to_inventory.py
   ```

3. Refresh your frontend to see improved category names!

## Comparison

| Feature | Without LLM | With LLM (Hybrid) |
|---------|-------------|-------------------|
| Category names | "Cucumbers Tomatoes Onions" | "Fresh Vegetables" |
| Clustering speed | Fast ✓ | Fast ✓ (unchanged) |
| Name quality | Keyword mashup | Natural language |
| Setup complexity | Simple | Requires Ollama |
| Resource usage | Low | Medium (4-8GB RAM) |

The hybrid approach gives you the best of both worlds! 🚀









