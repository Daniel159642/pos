# Shopify integration setup

Use the **official Shopify app configuration** so the POS “Connect with Shopify” OAuth flow works and redirect URLs are whitelisted. You can configure the app in the **Partners dashboard** or with the **Shopify CLI** (recommended).

---

## 1. Configure with Shopify CLI

Use the CLI to link your app, edit config in code, and push it to Shopify.

**Requirements:** [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) 3.0+, a dev store, and a Partner account. Install: `npm install -g @shopify/cli @shopify/app`.

**Note:** This POS repo does not include a `shopify.app.toml`. Run the CLI from your **Shopify app project** (e.g. Swiftly). The app’s client ID, secret, and redirect URLs must match what you put in this POS’s `.env`.

### Link or create the app

From the **root of your Shopify app project** (or an empty dir if creating a new app):

```bash
shopify app config link
```

- Creates or links to an existing app in your Partner account.
- Generates `shopify.app.toml` (or `shopify.app.{name}.toml` for multiple configs).

### Edit the config file

Open `shopify.app.toml` and set at least:

```toml
name = "Swiftly"
client_id = "your_client_id"
application_url = "http://localhost:5001"

[access_scopes]
scopes = "read_orders,read_products,write_products"
# Optional if you get redirect issues:
# use_legacy_install_flow = true

[auth]
redirect_urls = [
  "http://localhost:5001/api/integrations/shopify/callback",
  "https://your-pos-domain.com/api/integrations/shopify/callback"
]
```

- **Redirect URLs** must match exactly what the POS uses (see table in §2). Get the live value from:  
  `http://localhost:5001/api/integrations/shopify/debug-redirect-uri`
- **application_url** is your app’s base URL (e.g. `http://localhost:5001` for local).

### Push config to Shopify

```bash
shopify app deploy
```

- Applies your TOML (redirect URLs, scopes, App URL, etc.) to the app in Partners.
- For a specific config file: `shopify app deploy --config myconfig`
- Local dev: `shopify app dev` can auto-update URLs when using a tunnel.

**Docs:** [Manage app config files](https://shopify.dev/docs/apps/build/cli-for-apps/manage-app-config-files), [app deploy](https://shopify.dev/docs/api/shopify-cli/app/app-deploy).

---

## 2. Official config references

- **App configuration (TOML / Dev Dashboard)**  
  https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration  

- **Manage app config (CLI)**  
  https://shopify.dev/docs/apps/build/cli-for-apps/manage-app-config-files  

- **OAuth / redirect URLs**  
  https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant  

- **Partners dashboard**  
  https://partners.shopify.com → **Apps** → your app (e.g. Swiftly) → **Configuration**  

- **Dev Dashboard** (if using Shopify CLI)  
  https://shopify.dev/docs/apps/build/dev-dashboard  

---

## 3. Required app configuration

Configure your app so these match what the POS sends.

### Redirect URLs (allowed redirection URL(s))

The **exact** URL the POS uses for the OAuth callback must be in your app’s allowed list.

| Environment | Redirect URI to add in Shopify |
|-------------|--------------------------------|
| Local (backend on 5001) | `http://localhost:5001/api/integrations/shopify/callback` |
| Local (backend on 5000) | `http://localhost:5000/api/integrations/shopify/callback` |
| Production | `https://your-pos-domain.com/api/integrations/shopify/callback` |

- **Where to add**
  - **Partners:** Apps → your app → **Configuration** → **Redirect URLs** (or “Allowed redirection URL(s)”).
  - **TOML:** In `shopify.app.toml`, under `[auth]`:
    ```toml
    [auth]
    redirect_urls = [
      "http://localhost:5001/api/integrations/shopify/callback",
      "https://your-pos-domain.com/api/integrations/shopify/callback"
    ]
    ```
- **Rules:** No trailing slash, no spaces. Add **every** URL you use (e.g. both localhost and production).

**Check what the POS is using:**  
With the backend running, open:

`http://localhost:5001/api/integrations/shopify/debug-redirect-uri`

Use the `copy_paste` (or `redirect_uri`) value and add that **exact** string in Shopify.

### Application URL (App URL)

- **Partners:** Configuration → **App URL**.
- Should be the base URL of your app (e.g. `http://localhost:5001` for local, `https://your-pos-domain.com` for production).
- For local OAuth, `http://localhost:5001` is typical.

### Scopes

The POS needs at least:

- `read_orders`
- `read_products`
- `write_products` (for product sync)

**Where:** Configuration → **Scopes** (or in TOML under `[access_scopes]`).

### Optional: “Use legacy install flow”

If you get redirect or “redirect_uri not whitelisted” issues with the default flow:

- **Partners:** Configuration → set **Use legacy install flow** to **true**.
- **TOML:** In `[access_scopes]`: `use_legacy_install_flow = true`.

This makes Shopify redirect directly to your `redirect_uri` with `code` and `shop` in the URL.

### Optional: Embedded

- **Partners:** Configuration → **embedded** (true/false).
- If OAuth works better when Shopify sends the user to your **App URL** first, keep embedded as you need; the POS handles both “root URL with code” and “callback URL with code”.

---

## 4. POS `.env` (must match Shopify)

Set these so the POS uses the same redirect URI you whitelisted:

```env
# From Partners → your app → Configuration → API credentials
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret

# Must match EXACTLY one of the Redirect URLs in Shopify (see table above)
SHOPIFY_REDIRECT_URI=http://localhost:5001/api/integrations/shopify/callback
```

After changing `.env`, restart the backend.

---

## 5. Quick checklist

- [ ] **Shopify:** Redirect URLs include the **exact** callback URL (from debug endpoint or table above).
- [ ] **Shopify:** App URL matches how you open the POS (e.g. `http://localhost:5001` for local).
- [ ] **Shopify:** Scopes include `read_orders`, `read_products`, `write_products`.
- [ ] **POS:** `.env` has `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, and `SHOPIFY_REDIRECT_URI` matching Shopify.
- [ ] Backend restarted after `.env` changes.
- [ ] “Connect with Shopify” in POS Settings → Integrations works (no “redirect_uri is not whitelisted”).

---

## 6. Webhooks (optional, for instant orders)

To receive new orders without “Sync orders now”:

- **Shopify:** Settings → Notifications → Webhooks → **Order creation** → URL:
  `https://your-pos-domain.com/api/webhooks/shopify/orders`
- **POS:** Settings → Integrations → Shopify → **Webhook secret** = the secret Shopify shows when you create the webhook.

For local testing you need a public URL (e.g. ngrok) and that URL in the webhook and in your app config if required.
