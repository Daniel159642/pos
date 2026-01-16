# Collaboration Guide

This guide helps multiple developers work on different parts of the codebase simultaneously without conflicts.

## Branch Strategy

### Main Branches
- **`main`** - Production-ready code. Only merge from `develop` after testing.
- **`develop`** - Integration branch. All feature work merges here first.

### Feature Branches
- **`feature/your-feature-name`** - Work on new features
- **`fix/bug-description`** - Fix bugs
- **`refactor/what-you-refactoring`** - Code refactoring

## Daily Workflow

### Starting Work (Morning)
```bash
# 1. Make sure you're on develop
git checkout develop

# 2. Pull latest changes
git pull origin develop

# 3. Create a feature branch for your work
git checkout -b feature/your-feature-name

# OR if working on a bug
git checkout -b fix/bug-description
```

### During Work
```bash
# Work on your changes...
# Commit frequently with clear messages
git add .
git commit -m "Add: description of what you added"
git commit -m "Fix: description of what you fixed"
git commit -m "Update: description of what you updated"
```

### Syncing with Team (Multiple times per day)
```bash
# 1. Commit your current work
git add .
git commit -m "Your commit message"

# 2. Switch to develop and pull latest
git checkout develop
git pull origin develop

# 3. Go back to your feature branch
git checkout feature/your-feature-name

# 4. Merge develop into your branch to get latest changes
git merge develop

# 5. Resolve any conflicts if they occur (see Conflict Resolution below)
# 6. Push your branch
git push origin feature/your-feature-name
```

### Finishing Your Work
```bash
# 1. Make sure all your changes are committed
git status

# 2. Sync with develop one last time
git checkout develop
git pull origin develop
git checkout feature/your-feature-name
git merge develop

# 3. Push your branch
git push origin feature/your-feature-name

# 4. Create a Pull Request on GitHub (or merge locally if you have permission)
# Merge feature/your-feature-name into develop
```

## Conflict Resolution

### If you get conflicts during merge:

1. **Git will show you which files have conflicts:**
   ```
   Auto-merging file.py
   CONFLICT (content): Merge conflict in file.py
   ```

2. **Open the conflicted file(s)** - you'll see markers like:
   ```python
   <<<<<<< HEAD
   # Your changes
   =======
   # Their changes
   >>>>>>> develop
   ```

3. **Resolve by:**
   - Keep your changes (delete their section)
   - Keep their changes (delete your section)
   - Combine both (keep both sections, remove markers)
   - Write new code (replace everything)

4. **After resolving:**
   ```bash
   git add resolved-file.py
   git commit -m "Resolve merge conflicts in file.py"
   ```

## Quick Sync Script

Use the `sync.sh` script for easy syncing:
```bash
./sync.sh
```

This will:
- Pull latest from develop
- Merge into your current branch
- Show you any conflicts to resolve

## Best Practices

### 1. Work on Separate Files When Possible
- **Frontend**: Work in `frontend/src/pages/` - different pages = different files
- **Backend**: Work in different modules/files when possible
- **Database**: Coordinate schema changes - use migrations

### 2. Communicate Before Big Changes
- Database schema changes
- Major refactoring
- Adding new dependencies
- Changing shared utilities

### 3. Commit Often
- Small, focused commits are easier to merge
- Clear commit messages help others understand changes

### 4. Pull Before Push
- Always pull latest changes before pushing
- Use the sync workflow above

### 5. Test Before Merging
- Test your changes locally
- Make sure the app still runs
- Check for obvious errors

## File Ownership Strategy

To minimize conflicts, consider assigning areas:
- **Frontend Pages**: Each person works on different pages/components
- **Backend Routes**: Different API endpoints
- **Database Functions**: Different modules (database.py has many functions)

## Emergency: Someone Broke Main/Develop

If develop is broken and you need to work:

```bash
# Create a branch from the last known good commit
git log  # Find a good commit hash
git checkout -b feature/your-work <good-commit-hash>
# Work on your branch, fix develop separately
```

## Common Commands Cheat Sheet

```bash
# See what branch you're on
git branch

# See what files changed
git status

# See recent commits
git log --oneline -10

# Discard local changes (CAREFUL!)
git restore file.py

# Stash changes temporarily
git stash
git stash pop

# See differences
git diff
git diff file.py
```

## Questions?

If you're unsure about something:
1. Check this guide
2. Ask the team
3. Test in a feature branch first
4. Don't force push to main/develop
