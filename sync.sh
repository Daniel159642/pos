#!/bin/bash

# Sync script - pulls latest changes and merges into current branch
# Usage: ./sync.sh

set -e

echo "🔄 Syncing with remote repository..."

# Get current branch name
CURRENT_BRANCH=$(git branch --show-current)

if [ -z "$CURRENT_BRANCH" ]; then
    echo "❌ Error: Not in a git repository or no branch checked out"
    exit 1
fi

echo "📍 Current branch: $CURRENT_BRANCH"

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes!"
    echo "   Stashing them temporarily..."
    git stash
    STASHED=true
else
    STASHED=false
fi

# Fetch latest from remote
echo "📥 Fetching latest from remote..."
git fetch origin

# If on develop, just pull
if [ "$CURRENT_BRANCH" = "develop" ] || [ "$CURRENT_BRANCH" = "main" ]; then
    echo "🔄 Pulling latest $CURRENT_BRANCH..."
    git pull origin "$CURRENT_BRANCH"
else
    # If on feature branch, merge develop into it
    echo "🔄 Merging develop into $CURRENT_BRANCH..."
    
    # Make sure develop is up to date
    git checkout develop
    git pull origin develop
    git checkout "$CURRENT_BRANCH"
    
    # Merge develop into current branch
    if git merge develop --no-edit; then
        echo "✅ Successfully merged develop into $CURRENT_BRANCH"
    else
        echo "⚠️  Merge conflicts detected!"
        echo "   Please resolve conflicts manually:"
        echo "   1. Open the conflicted files"
        echo "   2. Resolve the conflicts"
        echo "   3. Run: git add . && git commit"
        echo ""
        echo "   Conflicted files:"
        git diff --name-only --diff-filter=U
        exit 1
    fi
fi

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo "📦 Restoring stashed changes..."
    git stash pop || true
fi

echo ""
echo "✅ Sync complete!"
echo "📍 You're on branch: $CURRENT_BRANCH"
echo ""
echo "Next steps:"
if [ "$CURRENT_BRANCH" != "develop" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    echo "  - Continue working on your feature"
    echo "  - Commit your changes: git add . && git commit -m 'Your message'"
    echo "  - Push when ready: git push origin $CURRENT_BRANCH"
else
    echo "  - You're on $CURRENT_BRANCH branch"
    echo "  - Create a feature branch: git checkout -b feature/your-feature"
fi
