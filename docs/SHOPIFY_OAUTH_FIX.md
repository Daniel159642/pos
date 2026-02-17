# Fix: "redirect_uri is not whitelisted" (app adbc3619701b075ebb8f9882030ee370)

Shopify requires **Application URL** and **redirect_uri** to use the **same scheme and host**. If App URL is `https://localhost:5001` but we send `http://localhost:5001/...`, the redirect can be rejected.

## Do these in order

### 0. Set Embedded to false (important)

- In the same app, find **embedded** (or **App embed** / similar).
- Set it to **false**.  
  Our POS is not an app embedded in Shopify Admin; we only need OAuth to get a token. With **embedded: true**, Shopify uses a different redirect flow and can reject our redirect_uri even when it’s in the list.

### 1. Set Application URL to HTTP (not HTTPS)

- In **Partners** → **Apps** → open the app whose **Client ID** is `adbc3619701b075ebb8f9882030ee370`.
- Go to **Configuration** (or **App setup** → **URLs**).
- Set **Application URL** (or **App URL**) to exactly:
  ```text
  http://localhost:5001
  ```
- Do **not** use `https://localhost:5001`. Use **http**.
- Save.

### 2. Set Redirect URLs

- In the same app, find **Redirect URLs** / **Allowed redirection URL(s)**.
- Ensure this exact entry is in the list (no trailing slash, no spaces):
  ```text
  http://localhost:5001/api/integrations/shopify/callback
  ```
- Save.

### 3. Push config from this repo (so Shopify matches our files)

In the project root:

```bash
npx shopify app config link --client-id adbc3619701b075ebb8f9882030ee370
```

When prompted, log in and choose the app that has Client ID `adbc3619701b075ebb8f9882030ee370`. That links this repo to that app.

Then:

```bash
npm run shopify:deploy
```

Confirm release when asked. That pushes `shopify.app.toml` (including `application_url` and `redirect_urls`) to that app.

### 4. Try Connect again

In the POS: **Settings** → **Integrations** → enter store → **Connect with Shopify**.

---

**If it still fails:**

1. **Use manual token (no OAuth):** In POS Settings → Integrations → Shopify, leave the store URL (e.g. swiftly-9876.myshopify.com), then in **Shopify Admin** go to Settings → Apps and sales channels → **Develop apps** → **Create an app** → **Configure Admin API** → enable `read_orders`, `read_products`, `write_products` → **Install app** → **Reveal token once**. Copy that token and paste it in the POS field **"Or paste API token manually"**. Save. Sync will work without OAuth.

2. **Test page:** Open **http://localhost:5001/shopify-connect-test** in the browser (so the request hits the backend directly). Click "Open Shopify OAuth". If you still get "redirect_uri is not whitelisted", the problem is in Shopify’s config for app `adbc3619701b075ebb8f9882030ee370`; use manual token above.

3. **Compare with debug:** Open http://localhost:5001/api/integrations/shopify/debug-oauth and compare `redirect_uri_raw` and `client_id` with the app in Partners. Application URL in Partners must be **http**://localhost:5001.
