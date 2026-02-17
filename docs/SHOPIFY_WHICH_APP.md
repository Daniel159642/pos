# Why "redirect_uri is not whitelisted" — you have TWO apps

Your repo and .env point at **one** Shopify app, but the app you edit in the dashboard may be a **different** one.

## What the POS uses (from .env)

- **Client ID:** `adbc3619701b075ebb8f9882030ee370`
- **Redirect URI:** `http://localhost:5001/api/integrations/shopify/callback`

So every "Connect with Shopify" request goes to the app with Client ID **adbc3619701b075ebb8f9882030ee370**.  
The redirect URL **must** be whitelisted on **that** app. If you've been adding it to another app, Shopify will still say "not whitelisted".

## Check which app you're editing

1. In **Shopify Developer dashboard**, open **Apps** → **Swiftly** (the one where you create versions).
2. Go to **Settings** or **Configuration** or **API credentials**.
3. Find **Client ID** (or **Client key** / **API key**).

- If it shows **`2939ff18b3c4976da5f549bfc1bcee94`**  
  → You're editing a **different** app. The POS is still calling **`adbc3619...`**, so your redirect URL is on the wrong app.

- If it shows **`adbc3619701b075ebb8f9882030ee370`**  
  → You're on the right app. Then the redirect URL and "Embed" settings for **this** app must be correct (see below).

## Fix A: Use the app you're already editing (easiest)

If the dashboard app has Client ID **`2939ff18b3c4976da5f549bfc1bcee94`**:

1. In that app, get **Client ID** and **Client secret** (Configuration / API credentials).
2. In your project **.env** set:
   ```env
   SHOPIFY_CLIENT_ID=2939ff18b3c4976da5f549bfc1bcee94
   SHOPIFY_CLIENT_SECRET=<that app's client secret>
   ```
3. In that same app, create a version with:
   - Redirect URLs: `http://localhost:5001/api/integrations/shopify/callback`
   - App URL: `http://localhost:5001`
   - **Embed app in Shopify admin:** OFF
4. Restart the POS backend and try Connect again.

Then the POS and the app you're editing are the same app, and the redirect URL you added will be used.

## Fix B: Edit the app the POS actually uses

If you want to keep using **`adbc3619701b075ebb8f9882030ee370`**:

1. In the dashboard, find the app whose Client ID is **exactly** `adbc3619701b075ebb8f9882030ee370` (might be another "Swiftly" or an older/unlisted app).
2. In **that** app, add the redirect URL and set App URL / Embed as above, then create a version.
3. Leave .env as is (SHOPIFY_CLIENT_ID=adbc3619701b075ebb8f9882030ee370).

Summary: either point .env at the app you're editing (Fix A), or add the redirect URL to the app your .env is already using (Fix B).
