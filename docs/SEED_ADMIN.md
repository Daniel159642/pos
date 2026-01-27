# Seed Admin User for Login

Creates a default establishment and **admin** employee so you can sign in from the login page.

## Quick run

```bash
# From project root
python3 scripts/seed_admin.py
```

**Credentials:**
- **Username / Employee code:** `admin`
- **Password:** `123456`

Then open the app, select **Admin User (admin)** in the dropdown, enter `123456`, and sign in.

---

## If you get `500` on `/api/employees` or "role postgres does not exist"

Your Postgres is likely using your **macOS username** as the default role, not `postgres`.

1. **Set DB config in `.env`** (project root):

   ```
   DB_USER=your_mac_username
   DB_PASSWORD=
   DB_NAME=pos_db
   DB_HOST=localhost
   DB_PORT=5432
   ```

   Or use a single URL:

   ```
   DATABASE_URL=postgresql://your_mac_username@localhost:5432/pos_db
   ```

2. **Create the database** (if needed):

   ```bash
   createdb pos_db
   ```

3. **Apply the schema** (if you haven’t yet):

   ```bash
   psql pos_db -f schema_supabase.sql
   ```

4. **Seed admin:**

   ```bash
   python3 scripts/seed_admin.py
   ```

5. **Restart the backend** and reload the login page. You should see **Admin User (admin)** in the dropdown.

---

## Troubleshooting

- **No employees in dropdown:** Backend returns 500 → fix Postgres connection (see above) and ensure `employees` table exists.
- **"Invalid credentials":** Use exactly `admin` / `123456`. If you changed the password, re-run the seed script (it will skip if admin already exists; delete the admin row first to recreate).
- **Admin already exists:** The script will report that and exit. Use `admin` / `123456` to sign in.
