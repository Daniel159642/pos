# Performance on Free Tier (e.g. Supabase)

This app uses a **Flask backend + PostgreSQL** (Supabase or any Postgres). Data is fetched via our API, not a Supabase client in the browser. The tips below are adapted for this setup.

## What’s Already Done

- **Connection pooling** – Backend reuses DB connections (`database_postgres.py`).
- **Pool warming** – A couple of connections are opened at startup so the first request isn’t slow.
- **DB keep-alive** – A background thread runs `SELECT 1` every 4 minutes so free-tier DBs (e.g. Supabase) don’t pause; first request after idle stays fast.
- **Single bootstrap endpoints** – POS and Settings load with one API call each (`/api/pos-bootstrap`, `/api/settings-bootstrap`) instead of many.

## If It’s Still Slow

### 1. Confirm cold start vs data size

- **Cold start:** First request after 5+ min idle is 10–30s, next request is fast → keep-alive should help; if not, check that the backend process is actually running (e.g. no restarts that kill the thread).
- **Too much data:** First request is always slow and returns a lot of rows → add limits/pagination and only select needed columns (see below).

### 2. Limit rows and columns on the backend

We already use one request per screen; make sure each endpoint returns only what’s needed:

- **POS bootstrap** – Limit inventory (e.g. first 500 products or only active); avoid `SELECT *` if you only need a few columns.
- **Settings bootstrap** – Already one response; ensure each section doesn’t pull huge blobs.
- **Inventory/Orders/Customers** – Prefer pagination (e.g. `LIMIT 50 OFFSET ...`) and columns like `id, name, sku, price, quantity` instead of full rows.

### 3. Add indexes (Supabase SQL Editor or migrations)

Useful for filters and sorts:

```sql
CREATE INDEX IF NOT EXISTS idx_inventory_archived ON inventory(archived);
CREATE INDEX IF NOT EXISTS idx_products_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(customer_name);
```

### 4. Frontend caching (optional)

To make repeat visits feel instant, cache API responses in the frontend:

- **Option A – React Query**  
  - Install: `npm install @tanstack/react-query`  
  - Wrap the app in `QueryClientProvider` and use `useQuery` for `/api/pos-bootstrap`, `/api/settings-bootstrap`, etc.  
  - Set a `staleTime` (e.g. 2–5 minutes) so the same tab doesn’t refetch every time.

- **Option B – Simple in-memory cache**  
  - For a given URL, store `{ data, timestamp }` and reuse until e.g. 2 minutes old or until the user refreshes.

### 5. Preload critical data

- On app load (e.g. in your root layout or after login), call `/api/pos-bootstrap` or the main endpoint once in the background so that when the user opens POS or Settings, data is already in cache or in flight.

## Quick checks

- **Keep-alive:** Backend logs should show no long gaps; first request after idle should be &lt; a few seconds if keep-alive is running.
- **Payload size:** In browser DevTools → Network, check response sizes for `/api/pos-bootstrap` and `/api/settings-bootstrap`; if they’re large (e.g. 1MB+), trim columns or add limits.
- **DB region:** If the DB is far from the server (or from users), latency will stay high; moving the app or DB closer helps.

## Summary

| Issue              | Fix in this project                          |
|--------------------|-----------------------------------------------|
| Cold start         | Backend keep-alive (every 4 min) – implemented |
| Too many requests  | Bootstrap endpoints – implemented            |
| Too much data      | Limits + pagination + select only needed cols |
| Slow filters/sorts | Indexes on filtered/sorted columns            |
| Repeat visits slow | React Query or simple response cache          |
