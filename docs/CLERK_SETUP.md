# Clerk Authentication Setup Guide

This application uses Clerk for master authentication. After authenticating with Clerk (email/password), users can then log in with their employee PIN.

## Setup Steps

### 1. Create a Clerk Account

1. Go to [https://clerk.com/](https://clerk.com/)
2. Sign up for a free account
3. Create a new application

### 2. Get Your API Keys

1. In your Clerk dashboard, go to **API Keys**
2. Copy the **Publishable Key** (starts with `pk_test_` for development or `pk_live_` for production)
3. Copy the **Secret Key** (starts with `sk_test_` for development or `sk_live_` for production)

### 3. Configure Environment Variables

#### Frontend Environment (.env file in `frontend/` directory)

Create a `.env` file in the `frontend/` directory and add:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
```

#### Backend Environment

Set the Clerk secret key as an environment variable:

```bash
export CLERK_SECRET_KEY=sk_test_your_actual_secret_key_here
```

Or add it to your system's environment configuration.

### 4. Install Dependencies

Install the Clerk Backend SDK:

```bash
pip install clerk-backend-api
```

### 5. Restart Servers

After adding the environment variables, restart both servers:

**Frontend:**
```bash
cd frontend
npm run dev
```

**Backend:**
```bash
python3 web_viewer.py
```

## Authentication Flow

### Admin Onboarding
1. Admin creates a Clerk account during onboarding
2. Admin generates a PIN
3. Admin completes store setup

### Employee Account Types

When adding employees, admins can choose between two account types:

1. **PIN-Only Account**:
   - Employee can only access when admin logs in through master login
   - Employee is assigned a 6-digit PIN
   - Employee appears in the employee selection list after master login

2. **Clerk Master Login Account**:
   - Employee gets their own Clerk account
   - Employee receives an invitation email with onboarding link
   - Employee completes Clerk signup and sets up their PIN
   - Employee can log in independently using their Clerk account and PIN

### Login Flow

1. **Master Login**: Users authenticate with Clerk using email and password
2. **PIN Login**: After Clerk authentication, users enter their 6-digit PIN
3. **Dashboard Access**: Once both authentications are complete, users can access the dashboard

## Employee Onboarding

For employees with Clerk master login accounts:
1. Employee receives invitation email from Clerk
2. Employee clicks link and completes Clerk signup
3. Employee is redirected to `/employee-onboarding`
4. Employee sets up their 6-digit PIN
5. PIN is linked to their employee account
6. Employee can now log in using their Clerk account and PIN

## Notes

- The Clerk publishable key is public and safe to include in frontend code
- The Clerk secret key must be kept secure and only used on the backend
- For production, use the live keys (`pk_live_...` and `sk_live_...`)
- Clerk handles password hashing, security, and session management
- Employee PINs are stored securely in the database
