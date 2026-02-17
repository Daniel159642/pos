# DoorDash integration – setup

This guide covers the **Restaurant/Marketplace** integration (orders, menu, store status, dasher status, etc.). For **Retail** (Convenience, Alcohol, Grocery) with Catalog, Inventory/Pricing, Store hours, and Order API, see **[DOORDASH_RETAIL.md](./DOORDASH_RETAIL.md)**.

## Done for you

- **Migration** – `orders.external_order_id` and `orders.integration_experience` are in place so DoorDash order id and experience (Caviar/Storefront) are stored and used for ready/cancel.
- **Backend** – Webhook receives orders, creates them in POS and accounting, confirms to DoorDash; order ready and cancel are sent when you change status in POS.
- **Frontend** – Settings → Integrations → DoorDash has API key, Sync, Save, and webhook URL; Recent Orders shows DoorDash orders and “Mark ready”.

## What you need to do

1. **Settings → Integrations → DoorDash**
   - Enter your **API key** (from DoorDash / your partner). Required for confirming orders and sending “order ready” and cancel.
   - Click **Save**.

2. **Give DoorDash your webhook URLs**
   - **New orders:** `https://<your-public-domain>/api/webhooks/doordash/orders`
   - **Menu status** (after menu create/update): `https://<your-public-domain>/api/webhooks/doordash/menu-status`
   - **Auto Order Release (AOR)** (optional): `https://<your-public-domain>/api/webhooks/doordash/order-release` — DoorDash calls this when a dasher is near the store; we can set the order status to “being_made” so the kitchen can start prep. Contact DoorDash to configure the orders and AOR URLs.
   - **Order Adjustment** (integrated order updates): `https://<your-public-domain>/api/webhooks/doordash/order-adjustment` — DoorDash sends the updated order here after an adjustment is processed (async). Configure the "Order Adjustment" webhook subscription in the Developer Portal.
   - **Order Cancellation** (receive cancelled order info): `https://<your-public-domain>/api/webhooks/doordash/order-cancellation` — DoorDash notifies when an already-confirmed order is cancelled downstream (customer/dasher/in-store). Contact DoorDash to configure this webhook to your endpoint.
   - Replace `<your-public-domain>` with the URL where your POS backend is reachable from the internet.

2b. **Receiving orders**
   - Payload format: `{ "event": { "type": "OrderCreate", "status": "NEW" }, "order": <Order json> }`. We also accept a raw order object as the request body. We store the order’s `id` as `external_order_id` and `experience` (DOORDASH / Caviar / Storefront) on the POS order for ready/cancel.
   - **Sync confirmation:** We create the POS order and immediately PATCH DoorDash to confirm success or fail (with a `failure_reason`). Return 200 for success; non-2xx is treated as failure. We use DoorDash’s recommended failure reasons (e.g. `Store Unavailable - Connectivity Issue` when we cannot process).
   - **Notable fields** we use: `estimated_pickup_time` (as prepare-by), `merchant_tip_amount`, `consumer` (name, phone, email), `order_special_instructions` / `special_instructions` (in notes), `is_tax_remitted_by_doordash`, `delivery_short_code`, `fulfillment_type`, `experience`. `consumer.id` is supported as 64-bit. For **Self-Delivery** (store uses own fleet): `delivery_address` (street, city, state, zip_code, subpremise, address_instructions), top-level `address_instructions`, and `delivery_fee` (cents charged to customer); we set order type to **delivery** and store address + instructions + fee in the order.
   - **Order ready:** When you mark an order as **Ready** in the POS (order status → `ready`), we call DoorDash’s “order ready for pickup” event so dashers are notified.

2c. **Order Ready Signal (ORS)**
   - **What it is:** A timestamp/signal to DoorDash when an order is complete and ready for pickup by the Dasher (delivery) or Customer (pickup). DoorDash uses it to dispatch the nearest Dasher and reduce late arrivals.
   - **How we implement it:** We send the signal automatically when staff mark an order as **Ready** in Recent Orders (the same “Mark ready” button or status change to `ready`). No separate DoorDash-only action is required.
   - **Endpoint:** `PATCH https://openapi.doordash.com/marketplace/api/v1/orders/{id}/events/order_ready_for_pickup` with body `{ "merchant_supplied_id": "<POS order id>" }`. We use the DoorDash order `id` from the webhook (stored as `external_order_id`) and the `merchant_supplied_id` we sent when we confirmed the order (our order_id or order_number). Success is **202**.
   - **Where to mark ready:** Any flow that sets order status to **Ready** triggers the signal for DoorDash orders (e.g. Recent Orders → “Mark ready”, or KDS/pos order completion that sets status to `ready`). Recommended: mark ready at the end of cooking/bagging when the order is ready to hand off.
   - **Auth:** We use the same API key (Bearer) as for order confirmation. If DoorDash requires JWT for this endpoint in your setup, you can extend the integration config to supply a JWT.

   **Post-confirmation cancel:** When you **void** a DoorDash order in the POS, we call DoorDash’s cancellation endpoint (cancel_reason `OTHER`; optional `doordash_marketplace_base_url` in config, default `https://openapi.doordash.com`). **Optional prep_time:** Order confirmation supports an optional `prep_time` (ISO datetime UTC) in config/code if you use provider-calculated prep times; do not echo `estimated_pickup_time`.

2d. **Merchant order adjustment**
   - **What it is:** Adjust an already-accepted DoorDash order at the line level (change quantity, remove item, substitute item) instead of cancelling the whole order. Requires allowlist from your DoorDash technical account manager.
   - **Endpoint:** `PATCH https://openapi.doordash.com/marketplace/api/v1/orders/{id}/adjustment` (we use DoorDash order UUID from `external_order_id`; we do not use merchant_supplied_id for the URL).
   - **Storing line IDs:** When we create an order from the webhook, we store DoorDash’s `line_item_id` and `line_option_id` from the order payload in `doordash_order_lines` (run migration `add_doordash_order_lines.sql` via **Run migrations**). You must use these IDs in adjustment requests; DoorDash does not accept merchant_supplied_id for adjustments.
   - **API:** `GET /api/orders/<order_id>/doordash-lines` returns the stored lines for that order (for building payloads). `POST /api/orders/<order_id>/doordash-adjustment` sends the adjustment; body: `{ "items": [ { "line_item_id": "...", "adjustment_type": "ITEM_UPDATE"|"ITEM_REMOVE"|"ITEM_SUBSTITUTE", "quantity"?: n, "options"?: [ { "line_option_id": "...", "adjustment_type": "ITEM_UPDATE", "quantity": n } ], "substituted_item"?: { "name", "merchant_supplied_id", "price" (cents), "quantity" } } ] }`. Success is **202**. Substitution uses `adjustment_type: "ITEM_SUBSTITUTE"` and `substituted_item`. To remove an item use `ITEM_REMOVE` (no quantity). To adjust the only item to 0 quantity use the order cancellation endpoint instead.

2e. **Integrated order updates (Order Adjustment webhook)**
   - After you send an adjustment (ITEM_UPDATE, ITEM_REMOVE, or ITEM_SUBSTITUTE), DoorDash processes it and sends an async update to the **Order Adjustment** webhook URL (typically within a few seconds, max ~10 seconds). Payload: `{ "event": { "type": "OrderAdjustment", "event_timestamp": "..." }, "order": <full order>, "order_adjustment_metadata": { "adjustment_source", "adjustment_timestamp", "adjusted_order_items": [...] } }`.
   - We handle it by: (1) finding the POS order by `order.id` (external_order_id), (2) replacing stored `doordash_order_lines` with the line IDs from the updated order so future adjustments use the correct IDs, (3) updating the order’s subtotal, tax_amount, and total from `order.subtotal` and `order.tax` (cents). Tip is preserved. Configure the "Order Adjustment" webhook subscription in the DoorDash Developer Portal to point to this URL.

2f. **Merchant order cancellation**
   - **What it is:** Cancel a previously accepted DoorDash order from the POS (e.g. item out of stock, store closed, kitchen at capacity) without calling DoorDash support. Requires allowlist: ask your DoorDash technical account manager to add you to **Merchant Induced Order Cancellations**.
   - **DoorDash endpoint:** `PATCH https://openapi.doordash.com/marketplace/api/v1/orders/{id}/cancellation` with body `{ "cancel_reason": "ITEM_OUT_OF_STOCK"|"STORE_CLOSED"|"KITCHEN_BUSY"|"OTHER", "cancel_details": "optional string" }`. DoorDash returns **202** when the cancellation is accepted.
   - **Deactivation:** Using `STORE_CLOSED` temporarily deactivates the store for **12 hours**; `KITCHEN_BUSY` for **15 minutes**. Use accordingly.
   - **API:** `POST /api/orders/<order_id>/doordash-cancel` with body `{ "cancel_reason": "ITEM_OUT_OF_STOCK"|"STORE_CLOSED"|"KITCHEN_BUSY"|"OTHER", "cancel_details": "optional" }`. Order must be a DoorDash order with `external_order_id`; we send the request to DoorDash and return 200 with `{ "success": true, "status_code": 202 }` on success, or 400/404/500 with message and DoorDash’s status_code when applicable.
   - **Void in POS:** When you **void** a DoorDash order in the POS, we automatically call cancellation with reason `OTHER` and details "Voided in POS" (no separate API call needed for that flow).
   - **Reimbursement:** Per DoorDash policy, merchants are not reimbursed for cancellations they initiate. High cancellation volume may result in temporary store deactivation to protect the customer experience.

2g. **Receive cancelled order information (Order Cancellation webhook)**
   - **What it is:** DoorDash sends a notification to your endpoint when an order that was already confirmed by the merchant is cancelled downstream in the DoorDash ecosystem (e.g. customer self-cancel, dasher cancel due to in-store issues). Orders that were never successfully confirmed (declined at POS) do not trigger this webhook.
   - **Payload:** `{ "external_order_id": "<DoorDash order UUID>", "client_order_id": "<merchant_supplied_id you sent on confirm>", "store": { "provider_type", "merchant_supplied_id" }, "is_asap": true }`. DoorDash does not send cancellation reasons in this message; check the Merchant Portal for details if needed.
   - **Implementation:** We find the POS order by `external_order_id` (or by `client_order_id` if you use your order id as `merchant_supplied_id` on confirm), then set the order’s status to **voided** so the POS reflects that the order was cancelled. We always return 200 so DoorDash does not retry.
   - **Setup:** Once your endpoint is ready, notify DoorDash and they will configure the Order Cancellation webhook to send to `https://<your-public-domain>/api/webhooks/doordash/order-cancellation`. Marketplace APIs are limited access; request early access if needed.

2h. **Self-Delivery (in-house fleet)**
   - **What it is:** Stores can be featured on DoorDash but fulfill delivery with their own drivers. Self-Delivery is configured at the store level in DoorDash. When enabled, DoorDash sends extra fields on the order payload so the merchant has everything needed to deliver.
   - **Fields we use:** `delivery_address` (object: street, city, state, zip_code, country_code, subpremise, address_instructions, lat, lng), optional top-level `address_instructions`, and `delivery_fee` (cents charged to the customer). We set `order_type` to **delivery** (using `is_pickup` false) so the POS treats the order as delivery.
   - **Implementation:** We format the delivery address into a single line and pass it as the order’s customer/address snapshot (so it appears in order details and on the customer record for delivery orders). We append delivery-level instructions and the delivery fee to the order **notes** (e.g. “Delivery instructions: Leave at my door…”, “Delivery fee (charged to customer): $2.99”). No extra configuration is required in the POS; once the store is set to Self-Delivery in DoorDash, orders will include these fields.

2i. **Integrated Promotions**
   - **What it is:** DoorDash sends merchant-funded and co-funded promotion data in the order payload so you can reconcile promotional spend in your POS and accounting. Supports order-level promos, item-level promos, and stacked promotions (multiple promos per order). Fully DoorDash-funded promos are not sent.
   - **Enable:** Configure campaigns in DoorDash Campaign Manager, provide `external_campaign_id` to your DoorDash Account Owner, and have DoorDash Engineering enable Promotions in the OpenAPI Order Service (one-time).
   - **Fields we use:** Order-level `applied_discounts_details` (array of promo_id, promo_code, external_campaign_id, total_discount_amount, merchant_funded_discount_amount, doordash_funded_discount_amount); item-level `applied_item_discount_details` on each item; order-level `total_merchant_funded_discount_amount`; `subtotal_for_tax` and `subtotal_tax_amount` for tax-after-discount when present.
   - **Implementation:** We parse order- and item-level promo details, sum total discount and apply it as the order **discount** so totals match. We store the full breakdown in `orders.doordash_promo_details` (JSONB) and totals in `doordash_total_merchant_funded_discount_cents` and `doordash_total_doordash_funded_discount_cents` for reconciliation and reporting. Run migration **add_doordash_promotions.sql** via **Run migrations** in DoorDash integration.
   - **Failure reason:** If a promotion causes order validation to fail, return a clear reason to DoorDash so they can surface it to the customer. Use `failure_reason` like: `"Promo {external_campaign_id} failed validation"` or `"Promo {promo_id} failed validation"`. The constants `FAILURE_REASON_PROMO` and `FAILURE_REASON_PROMO_BY_ID` are available in `doordash_service` for formatting.

2j. **Bag fees**
   - **What it is:** Some jurisdictions require merchants to charge a bag fee at checkout. The merchant provides the list of stores and bag fee to DoorDash Merchant Support for manual configuration. DoorDash then includes the fee in the order payload so the POS can reflect it.
   - **Payload:** `custom_fee` is an array; when bag fee is enabled, it contains an object with `type: "BAG_FEE"`, `price` (cents, e.g. 30 = $0.30), and `tax` (cents for tax on the fee). One bag fee per order regardless of cart size.
   - **Implementation:** We read `custom_fee`, find the `BAG_FEE` entry, and add a **Bag Fee** line item to the order (product "Bag Fee", quantity 1, unit_price = price/100) so the order subtotal and receipt include it. When `tax` is present we append "Bag fee tax: $X.XX" to the order notes for visibility. DoorDash’s order-level tax may already include bag fee tax; financial reports in DoorDash Report Builder include bag fee and bag fee tax fields.

2k. **Plasticware toggle**
   - **What it is:** Customers can opt in or out of single-use accessories (utensils, straws, napkins, etc.) at checkout. DoorDash sends a boolean **`is_plastic_ware_option_selected`** on the order payload. The feature must be enabled at the store/business level by a DoorDash Technical Account Manager; the Orders webhook subscription must be in place.
   - **Implementation:** When the field is **true**, we append **"Include plasticware / utensils (customer requested)"** to the order notes so the kitchen and receipts show that accessories should be included. When **false**, we append **"No plasticware"** so the ticket is explicit. Notes appear in order details (Recent Orders) and on printed receipts, so store operators and KDS can see the selection without extra POS programming.

2l. **Masked customer phone number**
   - **What it is:** DoorDash can provide a masked customer phone number so store operators can call the customer during fulfillment (e.g. to clarify an order) without going through DoorDash support. The number is passed in **`consumer.phone`** in the order payload (e.g. `+11231230000` with country code). Request the feature via the Developer Portal (Support); specify whether it should be enabled for all stores or specific stores.
   - **Requirements:** The phone number **from which the store originates the call** must match the store phone number configured in DoorDash (the value shared during store onboarding). Store and customer must use the same international country codes. The masked number is valid from when the order is accepted until **30 minutes after** delivery is completed or canceled. If DoorDash cannot generate a masked number, the value may be the DoorDash support number.
   - **Implementation:** We already pass **consumer.phone** into the order as the customer phone (stored on the order snapshot and customer record). In **Recent Orders**, when you expand an order we show **Customer** and **Customer phone** when present; for DoorDash orders the phone is shown with a “(masked; call from store number)” hint and is clickable (`tel:` link) so the operator can call from the store phone. Ensure the store’s configured number in DoorDash is the number staff will use to call.

2m. **Live Order Manager for POS (webview / iframe)**
   - **What it is:** DoorDash’s Live Order Manager lets merchants manage live orders from the POS (call customer/Dasher, rate/block Dasher, track Dasher on map, refund/replace items, adjust prep time, mark ready) without a companion tablet. Requires a certified or approved Marketplace integration and **credentials from DoorDash** (JWT secret for the plugin; contact Developer Portal Support).
   - **URL format:** `https://www.doordash.com/merchant/live-order-management/v2?id=<orderId>#t=<JWT>`. The **orderId** is the DoorDash order ID (our `external_order_id`). The JWT is generated with your secret (iss, kid, iat, exp; we use 15‑minute expiration).
   - **Setup:** In **Settings → Integrations → DoorDash**, set **Order Manager JWT secret** (from DoorDash support). Optional: in config you can set **order_manager_iss** and **order_manager_kid** if DoorDash provides them; otherwise we use defaults. DoorDash must **allowlist your domain(s)** for iframe embedding.
   - **Usage:** In **Recent Orders**, for a DoorDash order that is not voided, click **Order Manager**. The app fetches a signed URL and opens the DoorDash Order Manager in a modal iframe so staff can manage that order (call, prep time, refunds, etc.). If the JWT secret is not configured, the button returns a clear error. Adjustments made in the plugin can trigger the **Order Adjustment** webhook so the POS stays in sync.
   - **Error handling:** If the iframe fails to load or the feature is unavailable, we show: “Order Manager is unavailable at this time. Please reach out to support to update this order.”

2n. **Pickup instructions for Dasher**
   - **What it is:** DoorDash allows merchants to send **order-level pickup instructions** to the Dasher via the order confirmation PATCH. The Dasher sees them when they first receive the order and when they arrive at the store. They do not overwrite store-level instructions set in the Merchant Portal; all types are shown together.
   - **Endpoint:** Same as order confirmation: **PATCH .../marketplace/api/v1/orders/{id}** with body including **pickup_instructions** (string).
   - **Implementation:** We include **pickup_instructions** in the confirm payload when present. Set **Default pickup instructions for Dasher** in **Settings → Integrations → DoorDash**; that value is sent with every successful order confirmation. Use it for e.g. short codes, "pick up at counter", "use side door", or "handle with care" for hot items.

2o. **Track your Dashers (Dasher Status webhook)**
   - **What it is:** DoorDash sends **Dasher Status** events when the Dasher’s status changes: `dasher_confirmed`, `arriving_at_store`, `arrived_at_store`, `dasher_out_for_delivery`, `dropoff`. This gives merchants visibility into the order lifecycle (e.g. add final touches when the Dasher is arriving, prioritize orders, improve handoff).
   - **Subscription:** In the DoorDash Developer Portal, subscribe to the **"Dasher Status Updates"** event type and set your webhook URL to: `https://<your-domain>/api/webhooks/doordash/dasher-status`. Provide any authorization details required by DoorDash.
   - **Payload:** Each event includes `event.type` = `dasher_status_update`, `delivery.external_order_id`, `delivery.client_order_id` (merchant_supplied_id from order confirmation), `delivery.dasher_status`, `delivery.dasher` (masked phone_number, first_name, last_name, vehicle make/model). We store the latest status and dasher info on the order and return **200** so DoorDash does not retry.
   - **In the POS:** **Recent Orders** shows the current Dasher status and optional Dasher name/vehicle for DoorDash orders (card view and expanded details). Use **Run migrations** in Settings → Integrations → DoorDash to add the `dasher_status`, `dasher_status_at`, and `dasher_info` columns if needed.
   - **Note:** `arriving_at_store` is triggered when the Dasher is about 400m from the store. This webhook is informational and separate from Auto Order Release (AOR).

2p. **Store status (activation / deactivation)**
   - **What it is:** DoorDash’s Store activation status API lets you deactivate or reactivate the store from the POS. **PUT** `api/v1/stores/{merchant_supplied_id}/status` with payload `is_active` (true/false). For deactivation you must also send **reason** (one of: `out_of_business`, `delete_store`, `payment_issue`, `operational_issues`, `store_self_disabled_in_their_POS_portal`, `store_pos_connectivity_issues`) and **notes** (detail for internal records). Optional **end_time** (ISO) or **duration_in_hours** / **duration_in_secs** for temporary deactivation. If no end time is set, the store deactivates for 2 weeks then auto-reactivates. To reactivate, send only `is_active: true`; DoorDash may return 400 if e.g. banking info or active menu is missing.
   - **In the POS:** **Settings → Integrations → DoorDash** has **Deactivate store** (opens a modal with reason, notes, optional end time) and **Reactivate store**. We call **POST /api/integrations/doordash/store-status** with the same API key and base URL as Store info/Menu info.
   - **Store info / Menu info:** The **Store info** and **Menu info** buttons use **GET** `api/v1/stores/{merchant_supplied_id}/store_details` and **GET** `api/v1/stores/{merchant_supplied_id}/menu_details` to download live store-level and menu-level information (order protocol, is_active, deactivations, AOR, menu IDs, last update, hours, etc.).

2q. **Receive notices for temporary store deactivations**
   - **What it is:** DoorDash can send a webhook whenever a store on your integration is **temporarily deactivated** (e.g. self-pause in Merchant Portal, or auto deactivation for quality — dasher reported closed, high cancels, etc.). Payload includes `store.doordash_store_id`, `store.merchant_supplied_id`, `event.type` = "Store Temporarily Deactivated", `reason_id`, `reason`, `notes`, `start_time`, `end_time` (UTC).
   - **Subscription:** Configure the webhook in the DoorDash Developer Portal and set the URL to: `https://<your-domain>/api/webhooks/doordash/store-temporarily-deactivated`. Return **200** to acknowledge receipt.
   - **In the POS:** We store each event in `doordash_store_deactivation_events`. **Settings → Integrations → DoorDash** shows the **latest** temporary deactivation notice (reason, end time, notes) when present. Run **Run migrations** to create the table if needed.
   - **API:** **GET /api/integrations/doordash/latest-store-deactivation** returns the most recent event for the current establishment (for display).

3. **Menu Push (recommended)**  
   - Push your current POS menu to DoorDash so updates (e.g. after editing inventory) go live without waiting for DoorDash to pull. In **Settings → Integrations → DoorDash**, click **Push menu**. The first time we **POST** to create the menu; after DoorDash sends the menu id in the Menu Status webhook we **PATCH** to update. DoorDash will call your Menu Status webhook when the job finishes. Use the same API key as for orders; optional **Marketplace base URL** in config (default `https://openapi.doordash.com`).

4. **Get DoorDash menu**  
   - To see what’s currently active on DoorDash (reconcile with your POS), use **Get menu** in Settings → Integrations → DoorDash. This calls DoorDash’s Integrated Get Menu endpoint (`GET .../stores/{merchant_supplied_id}/store_menu`) and downloads the response as `doordash-store-menu.json`. For SSIO onboarding, you can call `GET /api/integrations/doordash/store-menu?onboarding_id=<id>` to use the Onboarding Get Menu endpoint.

4b. **Get store and menu information**  
   - **Store info** calls `GET api/v1/stores/{merchant_supplied_id}/store_details` and downloads `doordash-store-details.json` (order protocol, is_active, current_deactivations, auto_release, special_instructions_max_length, etc.).  
   - **Menu info** calls `GET api/v1/stores/{merchant_supplied_id}/menu_details` and downloads `doordash-menu-details.json` (menus with menu_id, is_active, is_pos_menu, url, latest_menu_update, last_successful_menu_update_at, open_hours, special_hours). Both use the same API key and base URL as orders; rate limits apply.

5. **Menu Pull (for onboarding / menu sync)**
   - DoorDash can pull your menu from: `GET https://<your-public-domain>/api/integrations/doordash/menu/<location_id>`
   - Use your **establishment_id** as `<location_id>` (e.g. `1` for the first store). The response is built from your POS inventory (products with sell_at_pos enabled), grouped by category, and returns `menus` as an array with `open_hours`, `special_hours`, `reference`, and (after first ingestion) `id` (Menu UUID from DoorDash).
   - **open_hours** come from your store location settings (Store hours). If not set, we use 00:00–23:59 every day.
   - After DoorDash creates/updates the menu, they call the **Menu Status** webhook with `menu.id`. We store that UUID and return it in future Menu Pull responses so **Menu Update (Pull)** works when DoorDash calls with `?ids=<external_menu_id>`.
   - Optional: In DoorDash integration config you can set **provider_type** (default `pos`) to match your DoorDash provider type.

6. **Item images (POS Integrated Images)**
   - To send item photos to DoorDash with your menu, set **Public base URL (for item images)** in DoorDash integration to your store’s public URL (e.g. `https://your-store.com`). Each inventory item that has a **photo** (path or URL) is sent as `original_image_url` in the menu payload. DoorDash requires: http/https, no query parameters, URL ends in .jpg/.jpeg/.png, publicly accessible; 16:9 aspect ratio and max 2MB recommended for auto-approval. If photo is a relative path (e.g. `uploads/product_photos/foo.jpg`), we turn it into an absolute URL using the public base URL. Menu Pull uses that base URL or the request host if not set.

6b. **Modifier (option) images (Integrated Modifier Images)**  
   - Run migration `add_product_variants_photo.sql` (via **Run migrations** in DoorDash integration). Product variants (sizes/options) are sent as menu extras; each variant can have a **photo** (path or URL). Update a variant via **PUT /api/inventory/variants/:id** with `{ "photo": "uploads/.../x.jpg" }` or a full URL. Same URL rules as item images. DoorDash links these to modifier options when enabled (allowlist); requires integrated item images to be in use.

7. **Item-level hours (optional)**  
   - Run migration `migrations/add_inventory_item_special_hours.sql` to add `inventory.item_special_hours` (JSONB). Then you can set per-item availability (e.g. breakfast 5am–5pm, LTO dates). Format: array of objects with optional `day_index` (MON–SUN), `start_time`, `end_time` (HH:MM or HH:MM:SS), `start_date`, `end_date` (YYYY-MM-DD). Menu Pull and Menu Push include `item_special_hours` when set; options inside extras can use `item_extra_option_special_hours` (same format) when you send modifiers. Store hours remain the default when item hours are not defined; DoorDash uses the lesser of store and item hours.

7b. **Recipes (default options / quantity_info)**  
   - Run migration `migrations/add_doordash_recipe_fields.sql` (via **Run migrations** in DoorDash integration). This adds:
     - **inventory.doordash_operation_context** (JSONB) – e.g. `["RECIPE"]` to mark an item as recipe-based so DoorDash sends orders with `removed_options` and `chargeable_quantity` instead of listing every included modifier.
     - **product_variants**: `doordash_default_quantity`, `doordash_charge_above`, `doordash_recipe_default` – for each size/option, set default quantity included in the item price and the quantity above which extra units are charged (`charge_above`); set one option as default per modifier group with `doordash_recipe_default: true`.
   - Menu Pull: items with `doordash_operation_context` get `operation_context: ["RECIPE"]`; variant options with `doordash_default_quantity` get `operation_context: ["RECIPE"]`, `quantity_info: { default_quantity, charge_above }`, and `default: true/false`. Menu Push copies these fields so the pushed menu matches the recipe contract.
   - Orders: when DoorDash sends a recipe-based order, we use **chargeable_quantity** (when present) for modifier line pricing so only the charged quantity is billed; **removed_options** are collected and added to the order **notes** (e.g. “Removed: Mocha Sauce”) so the kitchen sees what was removed from the recipe. Order notes are passed into the POS order and shown on tickets.

7c. **Nutritional and dietary information**  
   - Run migration `migrations/add_doordash_nutritional_info.sql` (via **Run migrations** in DoorDash integration). This adds:
     - **inventory**: `doordash_calorific_display_type` (e.g. `cal`), `doordash_calorific_lower_range`, `doordash_calorific_higher_range` (calories), `doordash_classification_tags` (JSONB array of dietary tags).
     - **product_variants**: same four columns for modifier-level nutrition.
   - **Dietary tags** (only these are supported by DoorDash): `TAG_KEY_DIETARY_VEGETARIAN`, `TAG_KEY_DIETARY_VEGAN`, `TAG_KEY_DIETARY_GLUTEN_FREE`. Set `doordash_classification_tags` to e.g. `["TAG_KEY_DIETARY_VEGETARIAN"]`.
   - **Calorific info**: set `display_type` (e.g. `cal`), `lower_range` and `higher_range` (numbers). Menu Pull and Menu Push include `dish_info` (with `nutritional_info.calorific_info`) and `classification_info` (with `classification_tags`) on items and options when set. Push the menu to DoorDash and validate in their UI.

8. **Optional**
   - **Price multiplier** – Use if you need to adjust line prices (e.g. 1.05 for 5%).
   - **Marketplace base URL** – Only if DoorDash gives you a different base URL for “order ready” and “cancel”; default is `https://openapi.doordash.com`.

After that, when a customer places a DoorDash order, it will show up in Recent Orders, in accounting, and you can mark it “Mark ready” so the driver is notified.
