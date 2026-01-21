# Admin PIN Setup Guide

This guide explains how to set up the admin PIN so it works across different computers and environments.

## Problem

The admin PIN is stored in the database, but when setting up on a new computer:
- The database might be empty or different
- The Clerk user ID needs to be linked to the admin account
- The PIN needs to be set

## Solution

Use the `setup_admin_pin.py` script to configure the admin account on any computer.

## Quick Setup

### 1. Find Your Clerk User ID

1. Open your browser and go to the login page
2. Open Developer Console (F12 or Cmd+Option+I)
3. Type: `window.Clerk?.user?.id`
4. Copy the user ID (starts with `user_`)

### 2. Run the Setup Script

```bash
# Show current admin status
python3 setup_admin_pin.py

# Link Clerk ID and auto-generate PIN
python3 setup_admin_pin.py user_2abc123def456

# Link Clerk ID and set specific PIN
python3 setup_admin_pin.py user_2abc123def456 123456
```

### 3. Use the PIN to Login

1. Authenticate with Clerk (email/password)
2. Enter your 6-digit PIN when prompted
3. You should now be logged in!

## For New Team Members

When setting up on a new computer:

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd pos
   ```

2. **Set up environment variables**
   ```bash
   # Backend
   cp .env.example .env
   # Edit .env and add your CLERK_SECRET_KEY
   
   # Frontend
   cd frontend
   cp .env.example .env
   # Edit .env and add your VITE_CLERK_PUBLISHABLE_KEY
   ```

3. **Install dependencies**
   ```bash
   # Backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   
   # Frontend
   cd frontend
   npm install
   ```

4. **Run migrations**
   ```bash
   python3 migrate_clerk_integration.py
   ```

5. **Set up admin PIN**
   ```bash
   python3 setup_admin_pin.py <your_clerk_user_id> [pin]
   ```

6. **Start servers**
   ```bash
   # Terminal 1 - Backend
   source venv/bin/activate
   python3 web_viewer.py
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

## Troubleshooting

### "No admin employee found"
- Run onboarding first, or
- Create an admin employee manually:
  ```bash
  python3 setup_admin_users.py
  ```

### "Invalid PIN" error
- Make sure you ran `setup_admin_pin.py` with your Clerk user ID
- Check that the PIN in the database matches what you're entering
- Verify your Clerk user ID is correct

### "No employee account found"
- Your Clerk user ID isn't linked to an employee account
- Run `setup_admin_pin.py` with your Clerk user ID

## Notes

- The PIN is stored in the database (not in .env files)
- Each computer needs to run the setup script once
- The PIN is 6 digits and can be any combination
- You can change your PIN anytime by running the setup script again
