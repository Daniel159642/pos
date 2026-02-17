# DoorDash Retail: Third-Party Provider API integration

This document outlines how to build a **DoorDash Retail Marketplace** integration as a **Third-Party Provider** for non-restaurant merchants (Convenience, Alcohol, Grocery, Retail). It is separate from the **Restaurant/Marketplace** integration in [DOORDASH_SETUP.md](./DOORDASH_SETUP.md).

**Note:** API integration is required for Third-Party Providers to share item-specific and store-level data in near real time so DoorDash closely mirrors the in-store experience.

---

## Mission and shared goal

- **DoorDash mission:** Grow and empower local economies.
- **Shared goal:** Deliver value to Merchants with an integration that provides seamless order fulfillment, real-time catalog and inventory updates, and efficient store onboarding.

---

## Terminology

| Term | Definition |
|------|------------|
| **Store** | A single brick-and-mortar location that sells items. |
| **Business** | A single business entity that can have multiple stores and shares one **Catalog**. |
| **Catalog** | The comprehensive list of all items ever possibly available for sale (business-level). |
| **Inventory** | Stock status and pricing for items at a particular **Store**. |
| **Menu** | The customer-facing list of items for sale at a particular **Store**. |
| **Order** | The list of items a **Customer** ordered on one occasion. |
| **Provider** | Third-party entity that facilitates a Merchant’s integrated offering on DoorDash. |
| **Merchant** | A seller of items on DoorDash. |
| **Customer** | A buyer of items on DoorDash. |
| **Dasher** | A deliverer of items. |

---

## Retail vs Restaurant (this POS)

| Aspect | Restaurant (Marketplace) | Retail |
|--------|--------------------------|--------|
| **Primary use** | Restaurants: orders, menu, ready/cancel | Convenience, Alcohol, Grocery, Retail |
| **Catalog** | Menu (categories, items, modifiers) per store | **Catalog** = business-level (IDs, brand, size, images) |
| **Store-level data** | Menu push/pull, store status | **Inventory** = availability, pricing, balance, location |
| **Orders** | Webhook → POS → confirm → ready/cancel | Order API → POS/OMS; Dasher or self-delivery |
| **Store hours** | Store status API | **Store Management API** (hours PATCH + Store Hours Pull) |
| **Current POS** | Implemented (see DOORDASH_SETUP.md) | Not yet implemented; this doc is the build reference |

---

## Steps to start API integration

1. **Join the Developer Portal**  
   Create a Developer Portal account (or sign in with an existing DoorDash account). Add team members as needed.

2. **Add a Marketplace integration**  
   Reach out to your DoorDash Technical Account Manager (TAM) to add a Marketplace integration.

3. **Create a Provider**  
   Configure a sandbox provider (DoorDash guide).

4. **Create credentials**  
   Create sandbox credentials (DoorDash instructions).

5. **Configure JWT authentication**  
   Follow the DoorDash guide to configure JWT for API interaction.

6. **Test store setup**  
   Ask your TAM to have a test store added to the Developer Portal. Testing uses a Partner-provided test catalog; DoorDash builds a catalog for a test business and creates a test store you can use with your item IDs.

---

## Steps to build the integration

### 1. Build the Catalog API integration

- Send at least **100 items** (POST Catalog API).
- Notify your TAM for a “quick and dirty” catalog build for your test business; they will notify you when the test business catalog is ready.
- **Catalog Pull [REQUIRED]** for onboarding: expose an endpoint from which DoorDash can pull catalog data for individual businesses.

**Events to respond to:**

- **New item added** – When a new item is added in the POS, add it to the Merchant’s DoorDash catalog.
- **Item details changed** – When a merchant changes an item in the POS (supported product attributes), update that item in the Merchant’s DoorDash catalog (PATCH Catalog API).

**Resources:** Catalog Management API Documentation, Supported Product Attributes, Catalog Pull guide.

#### Catalog Management API (Item Management) – reference

The **Item Management API** (Catalog Management) lets partners manage item information at the **business level**. Each item is identified by a unique **Merchant Supplied Item ID (MSID)**.

**Endpoint:** `https://openapi.doordash.com/marketplace/api/v2/items`

- **POST** – Add **new** items to the catalog.
- **PATCH** – Update information for **existing** items.

**Authentication:** JWT (see DoorDash JWT authentication documentation).

**Success response (e.g. 200):**
```json
{
  "operation_id": "string",
  "operation_status": "SUCCESS",
  "message": "string"
}
```
`operation_status` possible values: **QUEUED**, **IN_PROGRESS**, **SUCCESS**, **FAILED**, **PARTIAL_SUCCESS**.

**Error responses:**

| Code | Code (body) | Message / notes |
|------|-------------|------------------|
| 400 | validation_error | One or more request values couldn't be validated; see field_errors.field / field_errors.error |
| 401 | authentication_error | e.g. JWT expired ([exp] in the past) |
| 403 | authorization_error | Credentials don't work |
| 404 | unknown_business_id | — |
| 422 / 429 | request_rate_limited | Rate limited |
| 500 | service_fault | Internal service failure; retry later |

**Verification:** After a successful call, share an example request payload with your DoorDash Technical Account Manager to verify.

**FAQ:**

- **business_id** – Provided by your DoorDash TAM for test and production.
- **SLA** – Current SLA for new items created or updated is **18 days**.
- **Fields** – You do not need to include every field in the payload; including more data and higher data quality can expedite item create/update.

**Catalog payload – overview of parameters**

| Parameter | Type | Description | Accepted values | Required |
|-----------|------|-------------|-----------------|----------|
| merchant_supplied_item_id | string | Unique item ID within business across all stores | — | Yes |
| name | string | Item name (plain) or as uploaded: brand > item name > size | — | Yes |
| description | string | HTML or plain text | — | No |
| product_traits | array of strings | Type of product | ALCOHOL, MEDICATION, WEIGHTED | No |
| other_identifiers | array of objects | Other IDs (e.g. UPC per SKU) | — | No |
| images | array of objects | Item images | — | Yes |
| size | object | Size of item | — | No |
| weighted_item_info | object | Attributes for items sold by weight | — | No |
| brand_info | object | Brand if applicable | — | No |
| item_categorizations | array of objects | Category path L1–L5; granular (e.g. Bronzer not just Makeup) | — | No |

*Dimensions, weight, and volume: max two decimal places.*

**Nested objects (summary)**

- **other_identifiers[]:** `identifier_type` (UPC, PLU), `identifier_value`
- **images[]:** `url` (required; JPG/PNG, min 1400×800, 16:9, max 2MB), `sort_id`
- **size:** `details` (dimensions, weight, volume, product_specific_size_definition), `pack_size_details` (count_per_pack, per_item_size_details). **dimensions:** length, width, height. **weight:** value, unit (lbs, gm). **volume:** value, unit (oz). **product_specific_size_definition:** value, description. **pack_size_details.per_item_size_details:** same shape as size.details.
- **weighted_item_info:** average_weight_per_each, average_weight_measurement_unit (ea, kg, lb, gm, oz), shop_by_measurement_unit, price_by_measurement_unit
- **brand_info:** name
- **item_categorizations[] (Category):** name, sub_category (recursive)

**Alcohol / CBD – recommended payload**

| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| Alcoholic item flag | array of strings | `"product_traits": ["ALCOHOL"]` | Required for alcohol |
| Item size and unit | object | e.g. `"size": {"details": {"product_specific_size_definition": {"value": "750", "description": "ml"}}}` | Required for alcohol |
| Container type (pack size) | object | `product_attributes`: attribute_name "item_count", attribute_value.multi_select_string e.g. ["6pk cans"] | Recommended |
| Pack size | object | `"size": {"pack_size_details": {"count_per_pack": 6}}` | Recommended |
| Product volume and unit (oz) | object | `"size": {"details": {"volume": {"value": 12, "unit": "oz"}}}` | Recommended |
| Bottle deposit fee eligible | boolean | `product_attributes`: attribute_name "is_package_fee_eligible", single_select_bool: true | Recommended |
| CBD flag | boolean | `product_attributes`: attribute_name "restriction_type", multi_select_string: ["CBD"] | Required for CBD |

**Supported product attributes (by category):** For the full list of attribute names, types, descriptions, and examples (Alcohol, Beauty/Cosmetics, Food & Drinks, General, Health, Nutritional Details, Package, Variant, Weighted Item, Apparel, Baby, Home Improvements, Household, Personal Care, Music, Electronics), see **[DOORDASH_RETAIL_CATALOG_ATTRIBUTES.md](./DOORDASH_RETAIL_CATALOG_ATTRIBUTES.md)**. Examples there are not exhaustive; you can send additional values in **product_attributes** as needed.

#### Set up Catalog Pull

Partners can implement an endpoint that allows DoorDash to **pull** all items sold at a store (the store’s **Catalog**). Catalog combines with Inventory to produce the customer-facing **menu**; without a Catalog, a store cannot go live on DoorDash Marketplace. Catalog Pull enables faster and more efficient store onboarding.

The response from this endpoint must match the **BatchAddOrUpdateItemRequest** request model.

**Step 1: Endpoint specification**

- **GET** `/{merchant_pull_endpoint}/{partner_business_id}`

`partner_business_id` is the unique ID configured for that **business** in the partner’s system. The endpoint returns the **full catalog for one business** per request. A **business** is a parent that can have one or more **stores**; all stores in the same business must share exactly the same Catalog.

**Simple test for “same business”:**

- If item XYZ at store A has ID 123 and item XYZ at store B has ID 789 → the two stores **do not** belong to the same business.
- If item XYZ at store A has ID 123, item XYZ at store B has ID 123, and store A and B have the same owners → the two stores **do** belong to the same business.

**Step 2: Response format**

The Catalog pull response must match **BatchAddOrUpdateItemRequest**. It should contain **all items** for the business. DoorDash upserts the items from the partner’s JSON to the business’ DoorDash Catalog when calling the pull job. If the response for any business will exceed **50,000 items**, inform your Technical Account Manager and request a limit increase.

**Expected response model:**

```json
{
  "scope": {
    "business_ids": ["string"]
  },
  "items": [
    {
      "merchant_supplied_item_id": "string",
      "name": "string",
      "description": "string",
      "product_traits": ["ALCOHOL"],
      "other_identifiers": [
        {
          "identifier_type": "UPC",
          "identifier_value": "string"
        }
      ],
      "images": [
        {
          "url": "string",
          "sort_id": 0
        }
      ],
      "size": {
        "details": {
          "dimensions": {
            "length": { "value": 0, "unit": "inch" },
            "width": { "value": 0, "unit": "inch" },
            "height": { "value": 0, "unit": "inch" }
          },
          "weight": { "value": 0, "unit": "lbs" },
          "volume": { "value": 0, "unit": "oz" },
          "product_specific_size_definition": { "value": "string", "description": "string" }
        },
        "pack_size_details": {
          "count_per_pack": 0,
          "per_item_size_details": {
            "dimensions": { "length": { "value": 0, "unit": "inch" }, "width": { "value": 0, "unit": "inch" }, "height": { "value": 0, "unit": "inch" } },
            "weight": { "value": 0, "unit": "lbs" },
            "volume": { "value": 0, "unit": "oz" },
            "product_specific_size_definition": { "value": "string", "description": "string" }
          }
        }
      },
      "weighted_item_info": {
        "average_weight_per_each": 0,
        "average_weight_measurement_unit": "ea",
        "shop_by_measurement_unit": "kg",
        "price_by_measurement_unit": "kg"
      },
      "brand_info": { "name": "string" },
      "program_eligibility": ["SNAP"],
      "item_categorizations": [
        {
          "category": {
            "name": "string",
            "sub_category": {}
          }
        }
      ],
      "product_attributes": [
        {
          "attribute_name": "string",
          "attribute_value": {
            "single_select_bool": true
          }
        }
      ]
    }
  ]
}
```

**Step 3: Enroll endpoint in Developer Portal**

1. Developer Portal → your **Marketplace integration** → **Webhook subscriptions** → **Configure endpoint**.
2. Select the appropriate provider type.
3. For **Event**, select **"Catalog Pull"**.
4. **URL:** Enter the **base URL only** (e.g. `https://{merchant_pull_endpoint}`). DoorDash appends `partner_business_id` to the URL on each request. Your endpoint must accept that path parameter and return catalog data only for the specified business.
5. Enter the authentication token if needed. DoorDash supports **static tokens** and **OAuth** for Catalog Pull.

**Catalog Pull self-serve enrollment** is available in the Developer Portal.

**Next steps:** To verify Catalog Pull, contact support via the Developer Portal or your Technical Account Manager (if applicable) to run tests.

---

### 2. Build the Inventory API integration

- Create a menu on your test store via **Inventory Push** or by triggering **Inventory Pull**.
- **Inventory Pull [REQUIRED]** for onboarding: expose an endpoint from which DoorDash can pull inventory for individual stores.
- **Nightly full menu refresh:** Every night, for every store, trigger an Inventory Pull to fully refresh inventory (in addition to real-time updates).

**Events to respond to:**

- **Pricing change** – Update price in DoorDash when changed in the POS.
- **Availability change** – When an item goes in or out of stock at a store, update availability in DoorDash.
- **New item added to store menu** – Add the item to the store’s DoorDash menu.

**Recommended item availability logic (is_active):**

1. If the merchant’s balance-on-hand data is accurate, use **positive stock levels** to set `is_active = TRUE`.
2. If balance-on-hand is not accurate or not available:
   - If the merchant has **hidden the item from eCommerce** in the partner portal → `is_active = FALSE`.
   - If the item has been **created, restocked, or sold within the past 90 days** (doc also references 60 days in certification) → `is_active = TRUE`.
- Give merchants the ability to **mark items out of stock** in the order fulfillment module and PATCH inventory to DoorDash.

**Resources:** Inventory/Pricing API Documentation, Inventory Pull guide, CreateJobRequest / CreatePullStoreItemsJobParameters (Job Management API for triggering pulls).

#### Inventory/Pricing Management API (Retail) – reference

**Endpoint:** `https://openapi.doordash.com/marketplace/api/v2/stores/{store_location_id}/items`

- **POST** – Add inventory/pricing for **new** items at the store. **Important:** For a brand-new menu you must send at least **50 items**.
- **PATCH** – Update inventory/pricing for **existing** items at the store.

**Authentication:** JWT (see DoorDash JWT authentication documentation). Use the same auth for both POST and PATCH.

**Success response (e.g. 200):**
```json
{
  "operation_id": "string",
  "operation_status": "SUCCESS",
  "message": "string"
}
```

**Error responses:**

| Code | Code (body) | Message / notes |
|------|-------------|------------------|
| 400 | validation_error | One or more request values couldn't be validated; see field_errors.field / field_errors.error |
| 401 | authentication_error | e.g. JWT expired ([exp] in the past) |
| 403 | authorization_error | Credentials don't work |
| 404 | unknown_business_id | — |
| 422 / 429 | request_rate_limited | Rate limited |
| 500 | service_fault | Internal service failure; retry later |

**Verification:** Change inventory/pricing for a test store via the endpoint → check DoorDash Retail UI or integrated system; changes should appear within a few minutes. If issues, contact TAM with payload example and store details.

**Scenarios:** Use the API when new merchants/stores are onboarded or activated, and when inventory/pricing changes. Prefer **near-real-time** (intraday) updates. If not feasible, send **daily** batched updates (e.g. nightly).

**FAQ (summary):**

- **store_location_id** – Determined by the Partner; typically your internal store/location ID. Must be unique per store within a business.
- **Update speed** – Updates typically reflected within minutes.
- **Stock** – DoorDash uses **item_availability** to decide if an item is orderable, not `balance_on_hand`. If `balance_on_hand` is 0, the item is not automatically marked out of stock.
- **balance_on_hand / last_sold_date** – Used for predictive modeling and badging (e.g. “likely out of stock”) and to set customer expectations. DoorDash does not use them to restrict order quantity or for other purposes.
- **sale_price** – If you send both `base_price` and `sale_price`, DoorDash can show strikethrough pricing and add items to a “deals” category.
- **location object** – Recommended for **Dasher Shop & Deliver**; helps Dashers find items in-store and reduces delivery time.
- **Business level** – In DoorDash, “business” = banner/chain with one catalog; a parent company can have multiple businesses.
- **Price/tax format** – `base_price`, `sale_price`, `bottle_fee` in **cents** (e.g. $10.99 → 1099). `tax_rate` is a **double** as a percent (e.g. 8% → 8, 5.5% → 5.5).
- **First menu** – When creating a store’s very first menu (e.g. during onboarding), **POST or PATCH must include at least 50 items**, or use **Inventory Pull** to create the menu.

**Parameter details (Inventory/Pricing API)**

| Parameter | Type | Description | Possible values | POST | PATCH | PULL | Validation |
|-----------|------|-------------|-----------------|------|-------|------|-------------|
| merchant_supplied_item_id | string | MSID used in Item Management endpoint | — | Yes | Yes | Yes | Must not be blank or null |
| item_availability | string | Item availability status | ACTIVE, INACTIVE | Yes | No | Yes | Must be one of the enumerated values |
| balance_on_hand | integer | Current stock level | — | Recommended | No | Recommended | — |
| last_sold_datetime | string | When item was last sold at store | ISO8601 | Recommended | No | Recommended | — |
| price_info | object | Holds pricing parameters | — | Yes | No | Yes | — |
| price_info.base_price | integer | Standard price (cents) | — | Yes | No | Yes | 1–1000000 inclusive |
| price_info.sale_price | integer | Sale price (cents) | — | Recommended | No | Recommended | &lt; base_price; 1–1000000 inclusive |
| price_info.tax_rate | number | Tax rate as percent (e.g. 8.5% → 8.5) | — | No | No | No | 0–25 inclusive |
| price_info.bottle_fee_deposit | number | Fee per local legislation (cents) | — | No | No | No | 0–4000 inclusive |
| price_info.base_price_per_measurement_unit | number | Base price per unit (kg, lb) in cents | — | No | No | No | — |
| location | object | Default location of item in store | — | No | No | No | — |
| location.aisle | string | Aisle where item can be found | — | No | No | No | — |
| location.zone | string | Zone within aisle or store | — | No | No | No | — |
| location.shelf | string | Shelf within aisle | — | No | No | No | — |
| location.side | string | Side of aisle | — | No | No | No | — |
| location.additional_details | string | Additional location info | — | No | No | No | — |
| location.coordinates | object | Coordinates in store | — | No | No | No | — |
| location.coordinates.x | integer | X value | — | No | No | No | — |
| location.coordinates.y | integer | Y value | — | No | No | No | — |
| item_special_hours | object | Special hours when item is available | — | No | No | No | — |
| item_special_hours.day_index | string | Day of week | MON, TUE, WED, THU, FRI, SAT, SUN | No | No | No | — |
| item_special_hours.start_time | string | Start of special hours | HH:MM:SS | No | No | No | — |
| item_special_hours.end_time | string | End of special hours | HH:MM:SS | No | No | No | — |
| item_special_hours.start_date | string | Date when special hours start | — | No | No | No | — |
| item_special_hours.end_date | string | Date when special hours end | — | No | No | No | — |
| program_eligibility | array of strings | Program eligibility | SNAP, HSA, FSA | No | No | No | — |

#### Set up Inventory Pull

Partners implement an endpoint that allows DoorDash to **pull and replace** all StoreItems for a store location. This refreshes item availability and pricing for customers on DoorDash. The response must match the **BatchAddOrUpdateStoreItemRequest** model.

**Job types (DoorDash triggers the pull):**

- **PULL_STORE_ITEMS** – Use when you can return all items in **one** pull call for one store.
- **PULL_STORE_ITEMS_WITH_PAGINATION** – Use when you need to return data **page by page** for one store.

Job parameters use **CreatePullStoreItemsJobParameters**. DoorDash creates the job via **POST /api/v2/jobs** with a **CreateJob** request.

**Step 1: Endpoint specification**

- **Non-paginated:** `GET /{merchant_pull_endpoint}/{store_location_id}`
- **Paginated:** `GET /{merchant_pull_endpoint}/{store_location_id}?page_num={page_number}`

`store_location_id` is the unique Merchant Supplied ID for that store. The endpoint returns full inventory for **one location** per request. For paginated flow, DoorDash requests one page at a time. **Authentication:** DoorDash supports static tokens and OAuth when calling your pull endpoint; share OAuth details with your TAM if needed.

**Step 2: Response format**

Response must match **BatchAddOrUpdateStoreItemRequest**. DoorDash **replaces** all StoreItem attributes for the store with the data from this response.

**Sample response (non-paginated):**

```json
{
  "items": [
    {
      "merchant_supplied_item_id": "1",
      "item_availability": "ACTIVE",
      "price_info": {
        "base_price": 1099,
        "sale_price": 999
      }
    },
    {
      "merchant_supplied_item_id": "2",
      "item_availability": "INACTIVE",
      "price_info": {
        "base_price": 599,
        "sale_price": 599
      }
    }
  ]
}
```

**Paginated response:** Include a **meta** object:

```json
{
  "items": [ ... ],
  "meta": {
    "current_page": "1",
    "page_size": "500",
    "total_page": "100"
  }
}
```

**Step 3: Enroll endpoint in Developer Portal**

1. Developer Portal → your Marketplace integration → **Webhook subscriptions** → **Configure endpoint**.
2. Select the appropriate provider type.
3. For **Event**, select **"Full Inventory Pull"**.
4. **URL:** Enter the base URL with **%s** where the store ID goes: e.g. `https://{merchant_pull_endpoint}/%s`. DoorDash sends `partner_store_id` in place of `%s`; your endpoint must accept it and return inventory only for that store.
5. Enter the authentication token (if needed).

**Step 4: Trigger StoreItem pull (create job)**

DoorDash (or you, for testing) triggers a pull by calling **POST /api/v2/jobs** with a **CreateJob** request. **One location per request;** for multiple locations, send one request per location.

**Sample CreateJob – non-paginated:**

```json
{
  "job_type": "PULL_STORE_ITEMS",
  "job_parameters": {
    "store_location_id": "100",
    "pull_mode": "REPLACE"
  }
}
```

**Sample CreateJob – paginated:**

```json
{
  "job_type": "PULL_STORE_ITEMS_WITH_PAGINATION",
  "job_parameters": {
    "store_location_id": "100",
    "pull_mode": "REPLACE"
  }
}
```

**Next steps:** Test Inventory Pull with support via the Developer Portal or with your TAM.

---

### 3. Build the Store Hours integration

- **Merchant-triggered:** When a merchant changes store hours in the POS, update that store’s hours in DoorDash (PATCH Store Management).
- **Nightly:** Every night, update every store’s hours.
- **Store Hours Pull [REQUIRED]** for onboarding: expose an endpoint from which DoorDash can pull store hours for individual stores.

**Resources:** Store Management API Documentation, Store Hours Pull guide.

#### Store Management API – reference

The Store Management API lets partners manage **hours of operation** for individual stores and update **store availability for ordering**.

**Endpoint:** `https://openapi.doordash.com/marketplace/api/v2/stores/{store_location_id}`

- **PATCH** – Update individual store hours.

**Authentication:** JWT (see DoorDash JWT authentication documentation).

**Success response:** The response to a successful request is a **mirror of the payload** sent in the request.

**Fail response:** Same error codes and behavior as other Marketplace endpoints (e.g. 400 validation_error, 401 authentication_error, 403 authorization_error, 404, 422/429 rate limited, 500 service_fault). See Catalog or Promotion API reference tables for details.

**Verification:** In the **Merchant Portal**, open the store’s page and check the **Store Availability** section to confirm changes are reflected.

**Store Management API payload reference**

**Store Open Hours**

| Field | Description |
|-------|-------------|
| open_hours.start_time | Local start time when orders can be placed. |
| open_hours.end_time | Local end time when orders can be placed. |
| open_hours.day_index | Day of the week for these hours (e.g. MON, TUE, FRI). |

Considerations:

- Sending a **blank** `open_hours` array clears all existing hours and results in the store being **CLOSED** on the Marketplace until new hours are added: `"open_hours": []`
- DoorDash **deducts 20 minutes** from `open_hours.end_time` to determine ordering cutoff (time for Dashers to pick up before close).
- **“All Day”** on Marketplace: set `"start_time": "00:00:00"`, `"end_time": "23:59:59"`.
- Open hours are **date-specific per day**. If `end_time` < `start_time` within one day, the request fails. For **overnight** hours (e.g. open 8:00 AM Friday to 1:40 AM Saturday), use two entries:

```json
{ "day_index": "FRI", "start_time": "08:00:00", "end_time": "23:59:59" },
{ "day_index": "SAT", "start_time": "00:00:00", "end_time": "01:40:00" }
```

- **No overlapping** periods on the same day. The following is invalid (two FRI ranges overlap):

```json
{ "day_index": "FRI", "start_time": "08:00:00", "end_time": "12:00:00" },
{ "day_index": "FRI", "start_time": "10:00:00", "end_time": "22:00:00" }
```

**Store Special Hours**

Use special hours for a **specific date** that differs from regular hours (close, shorten, or extend).

| Field | Description |
|-------|-------------|
| special_hours.start_time | Local start time for orders (when not closed). |
| special_hours.end_time | Local end time for orders (when not closed). |
| special_hours.date | Date when these special hours apply (e.g. "2022-11-24"). |
| special_hours.closed | If true, store is closed on this date. |

Considerations:

- **Every PATCH rewrites special hours.** Include all desired special-hours periods in each request. Omitting `special_hours` or sending `[]` removes all previously set special hours; omitting a previously sent period removes that period.
- Special hours are **date-specific**. For **interday** special hours (e.g. 12:00 PM Nov 24 to 12:30 AM Nov 25), send two entries:

```json
"special_hours": [
  { "date": "2022-11-24", "closed": false, "start_time": "12:00:00", "end_time": "23:59:59" },
  { "date": "2022-11-25", "closed": false, "start_time": "00:00:00", "end_time": "00:30:00" }
]
```

**FAQ:**

- **Timezone for start_time and end_time** – Use the **store’s timezone**.
- **Store open overnight** – See DoorDash **Hours Configuration Reference** for how to configure store hour fields.
- **Store open 24/7** – See DoorDash **Hours Configuration Reference** for how to configure store hour fields.
- **What causes a store hours update to fail?** DoorDash will fail the request if:
  - Hours span **multiple days**.
  - **Overlapping hours** within the same day(s).
  - **Start time = End time** and times are not in `HH:MM:SS` format.
  - **Store open hours** are less than **30 minutes**.
- **How to send hours when the store is closed?**
  - **Closed on a specific day (e.g. holiday):** Use **Store Special Hours** with `closed = true`.
  - **Always closed on a day of the week:** Use **Store Open Hours** and **omit** that `day_index` entirely.
  - **Temporarily closed on all days:** Use DoorDash **Store Availability** webhooks to deactivate the store (see Store Availability Webhooks documentation).
- **Store on DoorDash closing earlier than hours sent** – DoorDash **deducts 20 minutes** from `open_hours.end_time` so ordering stops before the stated close (buffer for Dasher pickup, food prep, etc.).
- **Item-level hours** – Hourly availability can be set at **item level** via the **Inventory/Pricing API** (item special hours). Store Hours remain the default availability when item-level hours are not defined. See DoorDash Inventory/Pricing and item-level hours documentation.

#### Set up Store Hours Pull

Partners can implement an endpoint that allows DoorDash to **pull** the opening hours for a store location. This refreshes when customers can order from the store. The response must match the **Store** request model.

**Step 1: Endpoint specification**

- **GET** `/{merchant_pull_endpoint}/{store_location_id}`

`store_location_id` is the unique Merchant Supplied ID for that store. The endpoint returns store hours for **one location** per request. This endpoint should be **separate** from the Inventory Pull endpoint.

**Step 2: Response format**

The Store Hours pull response must match the **Store** model. Include **all regular and special hours** for the store. DoorDash **replaces** the store’s current hours with the data from this response when the pull job runs.

**Expected response model:**

```json
{
  "merchant_supplied_store_id": "string",
  "open_hours": [
    {
      "day_index": "MON",
      "start_time": "string",
      "end_time": "string"
    }
  ],
  "special_hours": [
    {
      "date": "string",
      "start_time": "string",
      "end_time": "string",
      "closed": true
    }
  ]
}
```

**Step 3: Enroll endpoint in Developer Portal**

1. Developer Portal → your **Marketplace integration** → **Webhook subscriptions** → **Configure endpoint**.
2. Select the appropriate provider type.
3. For **Event**, select **"Store Hours Pull"**.
4. **URL:** Enter the **base URL only** (e.g. `https://{merchant_pull_endpoint}`). DoorDash appends `store_location_id` to the URL on each request. Your endpoint must accept that path parameter and return store hours only for the specified store.
5. Enter the authentication token if needed. DoorDash supports **static tokens** and **OAuth** for pull endpoints.

**Store Hours Pull self-serve enrollment** is available in the Developer Portal.

**Next steps:** To verify Store Hours Pull, contact support via the Developer Portal or your Technical Account Manager (if applicable) to test.

---

### 4. Build the Orders integration

*Note: If the Partner’s platform does not provide tools to pick and pack orders, an orders integration is not feasible.*

**Mandatory (Merchant Pick):**

- **Receive orders** from DoorDash and present them in the Partner’s order fulfillment system.
- **Auto-confirm orders** (instructions in DoorDash docs).
- **Order adjustments:** Implement merchant order adjustment, cancellation, and **receive updated order payloads** after adjustment.
  - Subscribe to **Order Adjustment** event in the Developer Portal.
  - After merchant submits an adjustment: show a loading state; when the **updated order payload** webhook arrives (typically within ~10 seconds), show success and update the order cart (e.g. show substituted item). If it does not arrive, show failure and option to retry or cancel the order.
- **“Ready for Pickup” signal** (instructions in DoorDash docs).
- **DoorDash order cancellations** – Consume cancellation webhooks when an order is cancelled downstream (Customer/Dasher/Merchant) and stop fulfilling.
- **Masked customer phone number** – Consume and surface so merchants can contact customers (e.g. for substitutions).
- **Order failure reason documentation** – Document failure reasons sent when confirming with `status: fail` for support.
- **Order notifications** – Make new orders clear and obvious to merchants.

**Optional:**

- **Dasher flows:** Send order pickup instructions to Dasher; Track Dashers (webhooks).
- **Self-delivery:** Send self-delivery order statuses (and courier tracking if applicable).
- **Receive Bag Fees** (instructions in DoorDash docs).
- **Customer substitution preferences** – Consume and surface when merchants substitute items.
- **Validate Merchant Tips** – Surface `merchant_tip_amount` in the merchant-facing portal.

**Sandbox note:** For order adjustment requests in sandbox, include header: `"dd-tenant-id": "doortest:default"`.

**Resources:** Order API Documentation, Order API guide.

**Limited access:** Marketplace Order APIs are not yet generally available; record interest in early access via DoorDash.

#### Order API – receiving and confirming orders

**Receiving orders**

DoorDash sends **new orders** via a webhook to a configured URL (same auth as other webhooks; URL can be same as menu or different—contact DoorDash to configure). Payload format:

```json
{
  "event": { "type": "OrderCreate", "status": "NEW" },
  "order": "<Order json object>"
}
```

The **Order** object is detailed in the API Reference and sample instances. Store the order **id** from the webhook—you need it to confirm the order. All incoming orders have status **NEW**.

**Notable fields on the order**

| Field | Description |
|-------|-------------|
| special_instructions | Optional; item-level customer instructions (store-level setting can block or limit length). |
| is_tax_remitted_by_doordash | In Marketplace Facilitator states, DoorDash remits tax; this flag indicates if tax was remitted by DoorDash. |
| tax_amount_remitted_by_doordash | If above is TRUE, this is the amount remitted. |
| estimated_pickup_time | DoorDash’s estimated Dasher arrival time; used when prep time is not sent in confirmation. |
| delivery_short_code | Short unique delivery ID for Dasher app pickup. |
| fulfillment_type | Dasher Delivery, Merchant Delivery (Self Delivery), or Customer Pickup (see Order model). |
| experience | Order placed on DoorDash, Caviar, or Storefront (see Order model). |
| merchant_tip_amount | Tip left for staff by the customer. |
| consumer.id | Must support **64-bit integer**. |

**Confirming orders**

**PATCH** `https://openapi.doordash.com/api/v1/orders/{id}` — Use the order **id** from the webhook. You can confirm **synchronously** or **asynchronously**.

- **Synchronous:** Respond to the order webhook with **200** for success; non-2xx = failure. Response body same as async confirmation payload. Timeout is >1 minute; if you regularly need >~20 seconds, use async.
- **Asynchronous:** Respond with **202** to accept the order, then call the confirmation endpoint later with success or failure. If you do not confirm within **3–8 minutes**, DoorDash treats the order as failed (confirmation timeout). The 3–8 minute window varies by order; ensure your system can meet this SLA or you will see high cancellations.

**Async confirmation response from DoorDash:**

| Status | Meaning |
|--------|--------|
| 202 | OK – confirmation accepted |
| 400 | Bad request; order already confirmed; or confirmation timeout |
| 404 | Order with provided ID does not exist |
| 500 | Error while processing merchant order confirmation |

**Confirmation payload – prep time**

- **prep_time** (optional): Datetime in **UTC** for when the order will be ready. Used as input to DoorDash’s pickup-time algorithm. Only use if you have separate logic for prep time. **Do not** echo back `estimated_pickup_time`—it will inflate prep estimates. For **scheduled orders**, Dasher assignment does not use prep times; pickup is targeted ~10 minutes before the quoted drop-off window.

**Option 1 – DoorDash model prep times (recommended):**

```json
{
  "merchant_supplied_id": "<merchant order id>",
  "order_status": "success",
  "failure_reason": "<string or omit when success>"
}
```

**Option 2 – Provider/merchant calculated prep times:**

```json
{
  "merchant_supplied_id": "<merchant order id>",
  "order_status": "success",
  "prep_time": "<datetime UTC when order will be ready>",
  "failure_reason": "<string or omit when success>"
}
```

**Sample order confirmation (reference)**

**Limited access:** Marketplace Order APIs are not yet generally available; record interest in early access via DoorDash.

The following is a **sample order confirmation** payload—the response you send to DoorDash after receiving an order. Refer to the DoorDash model for full field definitions.

**Example (failure):**

```json
{
  "merchant_supplied_id": "orderId123",
  "order_status": "fail",
  "prep_time": "2020-05-13T14:01:32.761934529Z",
  "failure_reason": "Salad Plate is currently unavailable"
}
```

For success, use `"order_status": "success"` and omit or leave empty `failure_reason`. Optionally include `prep_time` (UTC) when using provider/merchant-calculated prep times.

**Sample order (reference)**

**Limited access:** Marketplace Order APIs are not yet generally available; record interest in early access via DoorDash.

The following is a **sample order** payload (1 Burrito Scram-Bowl with Ketchup and Salt). Refer to the DoorDash Order model for full field definitions.

```json
{
  "id": "abc12345",
  "subtotal": 2000,
  "tax": 300,
  "estimated_pickup_time": "2019-08-24T14:15:22Z",
  "is_pickup": true,
  "order_special_instructions": "",
  "consumer": {
    "id": 0,
    "email": "support@doordash.com",
    "first_name": "Kelley",
    "last_name": "W.",
    "phone": "+18559731040"
  },
  "store": {
    "merchant_supplied_id": "abc12345",
    "provider_type": "eatsa"
  },
  "categories": [
    {
      "merchant_supplied_id": "Entree",
      "name": "Entree",
      "items": [
        {
          "merchant_supplied_id": "26d3fce0-efd2-46d3-832c-ced5bc956401",
          "name": "Burrito Scram-Bowl",
          "price": 0,
          "quantity": 1,
          "extras": [
            {
              "merchant_supplied_id": "INDIVIDUAL_SAUCES",
              "name": "Signature Sauces",
              "options": [
                {
                  "merchant_supplied_id": "ADD_KETCHUP_INDIVIDUAL",
                  "name": "KETCHUP",
                  "price": 0,
                  "quantity": 1,
                  "extra": [
                    {
                      "merchant_supplied_id": "BREAKFAST_CONDIMENTS",
                      "name": "Breakfast Condiments",
                      "options": [
                        {
                          "merchant_supplied_id": "ADD_SALT",
                          "name": "Salt",
                          "price": 0,
                          "quantity": 1
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "is_tax_remitted_by_doordash": true,
  "tax_amount_remitted_by_doordash": 0,
  "commission_type": "regular",
  "delivery_short_code": "string",
  "fulfillment_type": "dx_delivery",
  "merchant_tip_amount": 0,
  "experience": "DOORDASH",
  "is_plastic_ware_option_selected": true,
  "tip_amount": 0
}
```

**Auto Order Release (AOR)**

Merchants can use AOR to hold orders in staging until a Dasher is within a set proximity (e.g. 500 m). DoorDash then sends a **release** event to your endpoint to start preparation. When you confirm the order, send your internal order id in **merchant_supplied_id**; DoorDash stores it as **client_order_id** and includes it in the release payload, along with Dasher vehicle info (e.g. for curbside). See Reference tab: Sample auto order release event.

**Order event updates – ready for pickup**

When the order is ready for pickup, notify DoorDash via the **Order Ready Signal** (PATCH Order Events). This informs Dashers and improves pickup flow. See **Order Ready Signal** below for endpoint, payload, and rollout guidance.

**Post–order confirmation updates**

Merchants can **cancel orders that were already accepted** via the API instead of calling support. See **Merchant order cancellations** below for the cancel endpoint, allowlist, and payload.

#### Order failures – required failure reasons

When confirming with **order_status: "fail"**, always include **failure_reason**. Use the required reasons below where they apply; you can also send custom reasons for other cases.

**Store closed**

| Scenario | failure_reason |
|----------|-----------------|
| Store closed but wrong hours listed | Store Unavailable - Hours out of Sync |
| Store closed temporarily (early close, busy, weather, emergency, remodel) | Store Unavailable - Closed or Remodel |

**Store open but unavailable for POS orders**

| Scenario | failure_reason |
|----------|-----------------|
| POS offline / connectivity (e.g. 500, 504) | Store Unavailable - Connectivity Issue |
| Capacity throttling (e.g. max items per time window hit) | [Store Name] is experiencing high order volume and cannot prepare your order for [order placed time] |
| Pickup time no longer available | Pickup time sent in the order is no longer available. |
| Store self-disabled for online ordering | Store is disabled for online ordering. Store must be enabled to receive orders. |

**Item out of stock**

| Scenario | failure_reason |
|----------|-----------------|
| Item/option 86’d but not reflected on DoorDash | Item Unavailable - [Item Name] - [Item ID] - Out of stock |
| Item not available at this time (e.g. time-bound item) | Item Unavailable - [Item Name] - [Item ID] - This item is not being served at this time |

For item failures, include **merchant_supplied_id** and item/modifier name so DoorDash can take corrective action.

**Menu data mismatch / out of sync**

| Scenario | failure_reason |
|----------|-----------------|
| Missing item or option on menu | Item Missing - [Item Name] - [Item ID] - This item is no longer on the Menu |
| Price validation failure (partner validates prices) | Pricing Mismatch - [Item Name] - [Item ID] |
| Store misconfigured (wrong integration ID) | Store is misconfigured with incorrect integration ID |

#### Order Ready Signal

**What it is**

**Order Ready Signal (ORS)** is a timestamp partners send to DoorDash when an order is **complete and ready for pickup** by the Dasher (delivery) or the Customer (pickup). It can be mapped to existing signals (e.g. “Order Ready” button, KDS bump or swipe complete). DoorDash can help define an easy way to pass the signal if needed.

**Why implement**

- Reduces **late Dasher arrivals** (a top merchant pain point).
- If the order is ready **earlier than expected**, ORS triggers DoorDash to assign the nearest Dasher sooner → faster pickup and delivery.
- Low implementation effort; leverage existing endpoints.

**Benefits (examples)**

- **Merchants:** Fewer remakes and refunds; some partners report order volume increase up to ~0.2%.
- **Customers:** Faster deliveries, better food quality. Partner case study: ~6% fewer late Dasher arrivals, ~22s faster delivery, ~2.3% fewer food-quality issues.

**Who should implement**

Recommended for all restaurant partners on DoorDash Menu and Orders APIs (POS providers, aggregators, directly integrated merchants).

**Technical implementation**

- **Authentication:** JWT.
- **Endpoint:** **PATCH** `https://openapi.doordash.com/marketplace/api/v1/orders/{id}/events/order_ready_for_pickup`
  - **id** – DoorDash order id from the order object (same id used to confirm the order).
  - **event_type** – `order_ready_for_pickup` (in URL path).
- **When to send:** When in-store staff have finished preparing the order and it is ready for handoff to the Dasher or Customer.

**Request body:**

```json
{
  "merchant_supplied_id": "1dfa934a-190c-43a9-b2e0-449e5b8cccde"
}
```

`merchant_supplied_id` is the value you sent to DoorDash when confirming the order (typically your internal POS order ID).

**Response codes**

| Status | Meaning |
|--------|--------|
| 202 | OK – request accepted |
| 400 | Order has expired |
| 401 | Unauthenticated |
| 403 | Access denied |
| 404 | Order with provided ID does not exist |
| 429 | Rate limited |
| 500 | Internal server error |

**Testing**

1. Place a pickup test order (e.g. via Developer Portal).
2. Confirm the order (use the order **id** from the webhook and **merchant_supplied_id** in the confirmation payload).
3. Send **PATCH** to `.../orders/{id}/events/order_ready_for_pickup` with the same **merchant_supplied_id** in the body.
4. Expect **202**. In order tracking, status should change from “Preparing your order” to **“Ready for pickup”.**

**User experience and rollout**

- **Permissions:** All staff who touch the order (operators, expediters, cashiers, line cooks, managers) should be able to mark the order ready.
- **When it matters most:** At the **end of cooking and bagging**, when the order is ready to hand off (e.g. Dasher arriving late → sending ORS can prompt DoorDash to dispatch the nearest Dasher).
- **Best practice:** Use or extend an **existing** “order ready” / “complete” action (KDS swipe, POS “order ready” button, “order complete?” popup) to send the signal to DoorDash instead of building a DoorDash-only flow. Default ORS to **on** at business/store level where possible.
- **Launch:** Treat as self-serve; no need to contact DoorDash to enable. Consider announcing ~1 week before go-live and publishing a short help article for merchants. For implementation support, use DoorDash Developer Portal support.

**FAQ**

- **Support:** DoorDash Developer Portal support.
- **Best practice:** If you already have a way to mark orders ready, extend it to send ORS to DoorDash rather than creating a separate flow for DoorDash.
- **Enablement:** Feature is self-serve; follow this guide; no need to contact DoorDash to enable.

#### Merchant order cancellations

Merchants can **cancel orders they had already accepted** via the API (no support call). Use the DoorDash order **id** from the order webhook and a JSON body with the cancellation reason.

**Prerequisites**

- Reach out to your **Technical Account Manager** to be added to the **allowlist for Merchant Induced Order Cancellations**.

**Endpoint**

**PATCH** `https://openapi.doordash.com/marketplace/api/v1/orders/{id}/cancellation`

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| cancel_reason | string | Yes | One of: **ITEM_OUT_OF_STOCK**, **STORE_CLOSED**, **KITCHEN_BUSY**, **OTHER**. |
| cancel_details | string | No | Additional context (e.g. "Store closed due to low capacity"). |

**Temporary store deactivation:** DoorDash may temporarily deactivate the store when these reasons are used:

- **STORE_CLOSED** → 12 hours
- **KITCHEN_BUSY** → 15 minutes

**Example payload:**

```json
{
  "cancel_reason": "ITEM_OUT_OF_STOCK",
  "cancel_details": "anything"
}
```

**Response and error codes**

| Status | Meaning |
|--------|--------|
| 202 | Request received successfully; cancellation in progress |
| 400 | Bad request; order not confirmed; or order already cancelled |
| 404 | Order not found |
| 500 | Other server error |

**FAQ**

- **Reimbursement** – Per DoorDash policy, merchants are **not reimbursed** for cancellations they initiate.
- **Punishment** – There is no direct punishment for canceling orders; if a **high volume** of merchant-induced cancellations is detected, the store may be **temporarily deactivated** to protect the customer experience.

#### Merchant order adjustments

Merchants can **adjust** orders they had already accepted (e.g. change quantities, remove items, substitute items) via the API instead of cancelling the whole order. This reduces full cancellations and gives more flexibility. Use the **DoorDash order UUID** (from the order webhook) in the URL and a JSON body with line-level adjustments.

**Prerequisites**

- Reach out to your **Technical Account Manager** to be added to the **allowlist for Merchant Induced Order Adjustments**.

**Endpoint**

**PATCH** `https://openapi.doordash.com/marketplace/api/v1/orders/{id}/adjustment`

**Request fields**

| Field | Description |
|-------|-------------|
| external_id | DoorDash order UUID — use in the URL path `{id}`. |
| adjustment_type | **ITEM_UPDATE** (change quantity) or **ITEM_REMOVE** (remove line). For substitutions, use **ITEM_SUBSTITUTE** (see below). |
| line_item_id | UUID for the line item in the order JSON (from the order payload). |
| line_option_id | UUID for a specific option/modifier in the order JSON (used with options under a line item). |
| quantity | New quantity for the line (for ITEM_UPDATE). |

**Important:** Use DoorDash’s **line_item_id** and **line_option_id** from the order payload — not your system’s order id or merchant_supplied_id. Partners must maintain these line-level IDs to reference the correct product.

**Example payloads**

**Adjust item quantity:**

```json
{
  "items": [
    {
      "line_item_id": "c45b3754-03b2-4da6-ae7f-164d5f8f587b",
      "adjustment_type": "ITEM_UPDATE",
      "quantity": 3
    }
  ]
}
```

**Adjust item option quantity:**

```json
{
  "items": [
    {
      "line_item_id": "c45b3754-03b2-4da6-ae7f-164d5f8f587b",
      "adjustment_type": "ITEM_UPDATE",
      "options": [
        {
          "line_option_id": "5Cef3fg-7bb2-43fb-8c13-fcf564223910",
          "adjustment_type": "ITEM_UPDATE",
          "quantity": 1
        }
      ]
    }
  ]
}
```

**Remove (cancel) item:**

```json
{
  "items": [
    {
      "line_item_id": "c45b3754-03b2-4da6-ae7f-164d5f8f587b",
      "adjustment_type": "ITEM_REMOVE"
    }
  ]
}
```

**Response and error codes**

| Status | Meaning |
|--------|--------|
| 202 | Request received successfully; adjustment in progress |
| 400 | Bad request; order not confirmed; order already cancelled; or syntax error |
| 404 | Order not found |
| 500 | Other error; e.g. line_item_id or line_option_id does not match the order JSON |

**Substitution adjustment**

When the original item is unavailable during picking, merchants can send a **substitution** so the customer and receipt reflect the replacement. Use the same adjustment endpoint with **adjustment_type: ITEM_SUBSTITUTE** and a **substituted_item** object.

| Field | Description |
|-------|-------------|
| line_item_id | Line item being replaced. |
| adjustment_type | **ITEM_SUBSTITUTE** |
| substituted_item.name | Name of the substitute item. |
| substituted_item.merchant_supplied_id | Your internal item ID for the substitute. |
| substituted_item.price | Price of the substitute (e.g. cents). |
| substituted_item.quantity | Quantity. |

**Example substitution payload:**

```json
{
  "items": [
    {
      "line_item_id": "94b653e4-e394-4330-a714-43e764abe843",
      "adjustment_type": "ITEM_SUBSTITUTE",
      "substituted_item": {
        "name": "Diet Coke",
        "merchant_supplied_id": "179",
        "price": 179,
        "quantity": 1
      }
    }
  ]
}
```

Customers are notified of adjustments (including substitutions) via **email**.

**FAQ**

- **Reimbursement / punishment** – Same as merchant-induced cancellations: no reimbursement; high volume of issues may lead to temporary store deactivation.
- **Can I use my system’s unique identifier (from order confirmation)?** No. Adjustments must use the **DoorDash order UUID** in the URL.
- **Can I use merchant_supplied_id for items/modifiers?** No. You must use DoorDash’s **line_item_id** and **line_option_id** from the order JSON. Maintain these IDs in your integration to reference the correct line/option.
- **How are customers notified?** Via **email**.
- **Can I set the quantity of the only item in the cart to 0?** You may receive 200 OK, but the cart will not be updated. Use the **order cancellation** endpoint instead to cancel the order.

#### Dasher Status Webhooks (Track your Dashers)

**Limited access:** Record interest in early access via DoorDash; Marketplace APIs are not generally available yet.

**Prerequisites**

- DoorDash sends **Dasher Status** events to an endpoint you provide. Give your **Technical Account Manager** your webhook URL and authorization details to subscribe.

**Overview**

The **Dasher Status** webhook includes a status value, the order reference, and Dasher details. DoorDash sends an event **each time** a Dasher reaches a given status, so **multiple events per order** are normal. This gives merchants visibility into the full order lifecycle and helps them:

- Add final touches (e.g. bagging, pulling items) just before the Dasher arrives while keeping quality.
- See current order status without calling support.
- Prioritize in-progress orders (e.g. by earliest arriving Dasher).
- Improve handoff with Dasher details (name, vehicle, masked phone).

**Step 1: Webhook subscription**

- In the Developer Portal, subscribe using the **"Dasher Status Updates"** event type and configure your endpoint and auth.

**Step 2: Webhook fields**

| Field | Description |
|-------|-------------|
| dasher_status | Current Dasher status. Values: **dasher_confirmed**, **arriving_at_store**, **arrived_at_store**, **dasher_out_for_delivery**, **dropoff**. |
| external_order_id | DoorDash’s unique UUID for the order (sent to the merchant). |
| client_order_id | Value of **merchant_supplied_id** from your order confirmation payload. If you did not send it on confirm, this will be null. |
| created_at | Timestamp of the Dasher status event. |
| location_id | Your merchant-supplied store identifier. |
| phone_number (in dasher) | Masked Dasher phone number. The Dasher can only be reached if the call is made **from the store phone number**. |

**Step 3: Sample payload**

```json
{
  "event": {
    "type": "dasher_status_update",
    "status": "<SUCCESS> OR <FAILURE>",
    "reference": "<reference_uuid>"
  },
  "created_at": "2021-06-02T17:41:29.996321Z",
  "delivery": {
    "external_order_id": "7424215690108_2",
    "client_order_id": "12321444",
    "location_id": "123852",
    "dasher_status": "arrived_at_store",
    "dasher": {
      "phone_number": "(586) 381-6148",
      "first_name": "Jude",
      "last_name": "D.",
      "vehicle": {
        "color": "",
        "make": "Dodge",
        "model": "Dakota"
      }
    }
  }
}
```

**Step 4: Response codes**

Your endpoint should return:

| Status | Meaning |
|--------|--------|
| 200 | Data received successfully |
| 401 | Unauthorized — DoorDash has no auth token for this endpoint |
| 403 | Forbidden — DoorDash does not have access to this endpoint |
| 500 | Internal server error on merchant side |
| 503 | Service unavailable — merchant endpoint partially or fully down |

**Next steps:** Make sure store operators know this feature exists and how to use it so they get the full benefit.

**FAQ**

- **When is `arriving_at_store` sent?** When the Dasher is **400 meters** from the store. This distance is not configurable.
- **What if a Dasher is unassigned?** The **dasher_assigned** (or equivalent) notification can be sent **twice** in that scenario.
- **How is this different from Auto Order Release (AOR)?** Dasher Status is **informational** to improve Merchant–Dasher handoff. AOR is for Quick Service Restaurants and is tied to DoorDash’s Dasher assignment and release logic (e.g. release when Dasher is near).

#### Masked customer phone number

**Prerequisites**

- The **phone number the call is made from** must match the number DoorDash has configured for the store. The provider must contact **Support via the Developer Portal** to have this feature enabled for their integration.

**Overview**

During fulfillment, merchants sometimes need to contact the customer (e.g. substitutions, questions). Previously they had to go through DoorDash support. The **masked customer phone number** lets store operators call the customer directly. Requirements and notes:

- The **originating** phone number (the one the store uses to place the call) must match the number configured in DoorDash for that store.
- The store phone number in DoorDash is the value provided during **store onboarding**.
- Store and customer must use the **same international country code**.
- The masked number is **valid** from when the order is accepted by the store until **30 minutes after** the delivery is completed or canceled.
- If DoorDash cannot generate a masked number, the value will default to the **DoorDash support number**.

**Step 1: Store phone number**

- Ensure the phone number configured in DoorDash for each store matches the number the store operator will use to **originate** the call. If it is wrong or needs updating, contact your **DoorDash Partnership Manager** to verify and update the store phone number.

**Step 2: Surface the field to store operators**

- Expose **consumer.phone** from the order payload so store operators can use it to call the customer. It appears under the **consumer** object:

```json
{
  "consumer": {
    "id": 000000000,
    "first_name": "Halle",
    "last_name": "D",
    "email": "support@doordash.com",
    "phone": "+11231230000"
  }
}
```

**Step 3: Enable the feature**

- Contact **Support via the Developer Portal** to request the feature be enabled. Specify whether it should be enabled for **all stores** or only **specific store(s)** in your integration.

**Verification**

- After DoorDash confirms the feature is enabled, place a test order. In the order payload, confirm that **consumer.phone** is present and formatted as a number starting with **+** and the **country code** (e.g. `+11231230000`).

**Next steps**

- Explain to merchants how to use the masked number and the **requirements** for a successful call (matching store phone, country code, validity window).

#### DoorDash order cancellations (receive cancelled order information)

**Limited access:** Record interest in early access via DoorDash; Marketplace APIs are not yet generally available.

**Overview**

DoorDash sends an **order cancellation webhook** whenever an **already confirmed** order is cancelled **downstream** in the DoorDash ecosystem. Integrators and merchants should consume this webhook and stop fulfilling the order. Typical triggers include:

- Customer self-initiated cancellation
- Dasher-initiated cancellation (e.g. in-store issues, closures, item availability)

If the merchant **never confirmed** the order (e.g. declined at POS during original submission), DoorDash does **not** send this webhook, since the POS has already declined it.

**Identifiers**

- When the merchant confirms an order, they can send their internal order id in **merchant_supplied_id**; DoorDash stores it as **client_order_id** and returns it in the cancellation payload. Use this to match the cancellation to your system.
- DoorDash does **not** include a cancellation reason in the webhook. For the reason, check the order in the **Merchant Portal**.

**Setup**

- This is a **manual** configuration: prepare your endpoint, then **notify DoorDash** so they can configure the webhook to send cancellation events to your endpoint. Full payload details: see API Reference for the Order Cancellation Notification object.

**Sample cancellation payload**

```json
{
  "external_order_id": "0da8b530-7c4c-4925-8785-cd843b797d64",
  "client_order_id": "321",
  "store": {
    "provider_type": "provider_a",
    "merchant_supplied_id": "location1"
  },
  "is_asap": true
}
```

| Field | Description |
|-------|-------------|
| external_order_id | DoorDash’s unique order identifier. |
| client_order_id | Your **merchant_supplied_id** from order confirmation (null if not sent). |
| store.provider_type | Provider type. |
| store.merchant_supplied_id | Your store/location identifier. |
| is_asap | Whether the order was ASAP (vs scheduled). |

**Action:** On receipt, stop fulfilling the order and update your POS/OMS so the order is marked cancelled.

#### Receive bag fees

**Prerequisites**

- DoorDash supports **bag fee** and related **tax** in the Open API Order payload so merchants can comply with jurisdiction-specific requirements (e.g. mandatory bag charges).

**Overview**

Some regions require merchants to charge a bag fee at checkout. This feature lets merchants receive the bag fee (and any tax) in the order payload so they can comply and account for it correctly.

**Step 1: Enable bag fee at checkout**

- The **merchant** provides DoorDash **Merchant Support** with a list of stores and the bag fee amount per store. DoorDash **manually configures** the bag fee for those stores.

**Step 2: Order payload – custom_fee**

- When a store has bag fee enabled, the **order** payload includes a **custom_fee** array with a single object:

| Field | Description |
|-------|-------------|
| custom_fee[].type | **"BAG_FEE"** |
| custom_fee[].price | Non-decimal currency (e.g. 30 = $0.30), matching the value configured for the store. |
| custom_fee[].tax | Non-decimal currency for bag-fee tax based on the store’s location and tax rules. |

**Example:**

```json
{
  "custom_fee": [
    {
      "type": "BAG_FEE",
      "price": 30,
      "tax": 5
    }
  ]
}
```

**Verification**

- Place a test order at a store with bag fee enabled. Confirm the order payload contains **custom_fee** populated with the BAG_FEE object.

**FAQ**

- **Does the bag fee or quantity change with cart size?** No. The customer is charged for a **single bag** regardless of cart size.
- **How does the customer see the fee?** The bag fee appears as a **separate fee line item** during checkout in the DoorDash app.
- **Can I see bag fees collected?** Yes. DoorDash adds a **bag fee** field in **Report Builder** (Financial reports).
- **How do I update the bag fee if laws change?** Contact **DoorDash Support** to have the fee updated.
- **Tax on bag fees (MPF vs non-MPF states)?** Bag fee tax is enabled for all merchants in the US/Canada that charge bag fees. Once tax is enabled, both **Bag fee** and **Bag fee tax** appear in financial reports.

#### Send pickup instructions

**Prerequisites**

- Pickup instructions must be implemented on the **Provider** side; the value is then sent to DoorDash in the **order confirmation** payload.

**Overview**

DoorDash supports a **pickup_instructions** field in the order confirmation so merchants can send a **per-order** message to the Dasher. The Dasher sees instructions at two times: when they **first receive** the order and when they **arrive at the store**.

**Types of pickup instructions (all can be used together)**

- **Default store-level** – Set in the Merchant Portal.
- **Arrival store-level** – Set in the Merchant Portal (shown when Dasher arrives).
- **Order-level** – Sent via the API (this integration).
- **Dynamic store-level** – Set in the Merchant Portal.

No type overwrites another; if multiple are set, **all** are shown to the Dasher in the app.

**Step 1: Endpoint**

- Use the **order confirmation** endpoint: **PATCH** `https://openapi.doordash.com/marketplace/api/v1/orders/{id}`

**Step 2: Add pickup_instructions to the confirmation body**

- Include **pickup_instructions** (string) in the PATCH body along with your other confirmation fields.

**Example confirmation body:**

```json
{
  "merchant_supplied_id": "string",
  "order_status": "success",
  "failure_reason": "string",
  "prep_time": "2021-10-13T17:32:59Z",
  "pickup_instructions": "string"
}
```

**Step 3: Implement in the POS**

- Provide a way for **merchants** to enter or select pickup instructions in the POS (e.g. per order or from templates). Pass that value into **pickup_instructions** when calling the order confirmation endpoint so it is shared with the Dasher.

**Verification**

1. Place and receive a test order.
2. Confirm the order and include **pickup_instructions** in the confirmation PATCH body.
3. Confirm the request succeeds and that the instructions are visible to the Dasher (e.g. in the Dasher app for that order).

**Next steps – share with merchants**

- **Short codes** – Merchants can use pickup instructions to send a short code (e.g. order ID or retrieval code) so the Dasher can quickly identify the order in-store.
- **Item-specific handling** – Instructions for proper handling during fulfillment (e.g. “Hot – handle with care”, “Retrieve from pickup rack via side door”).

#### Substitution preferences and item instructions

**Overview**

Merchants integrated via the **Order API** can receive **customer** and **DoorDash-recommended** substitution preferences per line item, plus **item-level special instructions**. Customers set preferences on the item details page (before checkout) and in a post-checkout substitution hub.

**Customer experience and timing**

- Customers can add **substitution preferences** and **item instructions** on the item details page (before checkout) and in a **post-checkout substitution hub**.
- Customers have **1–2 minutes** after checkout to save substitution preferences; then a **consolidated order payload** with all saved preferences is sent to the merchant.
- DoorDash may **implicitly** set **out_of_stock_preference** to `"substitute"` and provide **substitution_choices** for some items (e.g. via ML).
- Preferences and item instructions are **saved** for future orders and across locations under the same business.

**New fields in the order payload (per item)**

| Field | Type | Can be empty/null? | Description |
|-------|------|---------------------|-------------|
| special_instructions | string | Yes | Item-level instructions from the customer. Max length 150 characters. |
| substitution_preferences | object | Yes | Preference block for this order item. |
| substitution_preferences.out_of_stock_preference | string | Yes | If item is out of stock: **"refund"**, **"substitute"**, **"contact"**, or **"generic_category"** (DoorDash sends a generic set of substitution options). |
| substitution_preferences.substitution_choices | list | Yes | List of substitution options when preference is **"substitute"** or **"generic_category"**. Empty or absent if **"refund"**. Each choice: **name**, **price**, **merchant_supplied_id**, **quantity**. |

**Payload structure (item-level)**

Each item in **categories[].items[]** (and options in **extras[].options[]** where applicable) can include:

- **special_instructions** – Customer’s item-level instructions.
- **substitution_preferences** – **out_of_stock_preference** and, when applicable, **substitution_choices** array with **name**, **price**, **merchant_supplied_id**, **quantity**.

If the customer does **not** save a preference for an item, DoorDash sends **out_of_stock_preference** = **"contact"** and no recommendations.

**Example – items with substitution preferences**

```json
{
  "name": "Dr Pepper Soda Bottle (20 oz)",
  "quantity": 1,
  "price": 309,
  "merchant_supplied_id": "240745-0-1",
  "special_instructions": "I love Dr. Pepper",
  "line_item_id": "abef72d9-d541-4dee-a713-e52432eadd8b",
  "substitution_preferences": {
    "out_of_stock_preference": "refund"
  }
}
```

```json
{
  "name": "Kit Kat Milk Chocolate Wafer King Size Candy Bar (3 oz)",
  "quantity": 1,
  "price": 359,
  "merchant_supplied_id": "140025-0-1",
  "special_instructions": "Make sure it is not melted",
  "line_item_id": "6134e84c-d627-476b-8057-88cc3721a08a",
  "substitution_preferences": {
    "out_of_stock_preference": "substitute",
    "substitution_choices": [
      {
        "name": "Kit Kat some other chocolate",
        "price": 499,
        "merchant_supplied_id": "140025-0-2",
        "quantity": 2
      }
    ]
  }
}
```

**FAQ (summary)**

- **Substitution choice invalid or unavailable?** Merchant can ignore it, refund the line item, or contact the customer for an alternate.
- **How to substitute an item?** Use the **Adjust Order (adjustment)** API: refund/substitute/update quantity as documented in Merchant order adjustments.
- **Modifiers?** Substitution preferences are **not** supported for item modifiers.
- **Customer notification of substitution?** Today the customer is not proactively notified; they see the updated receipt in their account.
- **Pricing guardrails?** Guardrails exist for **customer-selected** substitution choices (e.g. price, alcohol). **Merchant adjustments** have no price guardrails (only that the substituted item is active).
- **Final receipt confirmation?** DoorDash sends confirmation when adjustments are made; pulling the final receipt via API may be supported in the future.
- **"Any similar item" vs "substitute"?** "Any similar item" (generic_category) is shown only for certain item categories; DoorDash sends up to 3 recommendations. "Substitute" lets the customer pick specific choices; DoorDash sends selected recommendation(s).
- **Customer must choose per item?** Yes; each item must be explicitly saved. Saved preferences and item instructions are remembered for future orders (and across locations in the same business).
- **No preference saved for an item?** DoorDash sends **out_of_stock_preference** = **"contact"** and no substitution_choices.
- **"Any similar item" – when does customer see what was picked?** At the end of the order (when shopper has picked).
- **Time to pick substitutes?** **1–2 minutes** after checkout before the full payload is sent to the merchant.

#### SNAP/EBT order data

**Overview**

DoorDash sends a new **item-level** parameter in the order payload for **SNAP/EBT** transactions. This gives merchants the monetary transaction details needed to accept SNAP/EBT payments on DoorDash for **program-eligible** items. For **tax calculation** with SNAP, use DoorDash’s **Merchant Tax Calculation** (see DoorDash documentation when available).

**New parameter: snap_amount**

- On each **order item** (in **categories[].items[]**), DoorDash may include **snap_amount** (integer, cents): the amount paid with SNAP/EBT for that line item.
- **snap_amount** is present only for items (or portions of items) paid with SNAP/EBT; it may be 0 for ineligible items or items paid with other methods on the same order.

**Example – single item with SNAP**

```json
{
  "name": "Blackberries (6 oz)",
  "quantity": 1,
  "price": 439,
  "merchant_supplied_id": "850003027005",
  "consumer_name": "Amrita",
  "extras": [],
  "special_instructions": "",
  "line_item_id": "9bd40f9f-bb1e-4206-973f-fcbf73aa47b2",
  "snap_amount": 439
}
```

**Example – quantity > 1**

When **quantity** is greater than 1, **snap_amount** is the **total** SNAP/EBT amount paid for that item across all units:

```json
{
  "name": "Blackberries (6 oz)",
  "quantity": 2,
  "price": 439,
  "merchant_supplied_id": "850003027005",
  "line_item_id": "517c03c3-75eb-4868-b3ad-e6ca16cf94dd",
  "snap_amount": 878
}
```

**FAQ**

- **How do I start accepting SNAP/EBT at my stores?** Stores must be on the **Retail UI** to accept SNAP/EBT. Contact your **DoorDash Partnership Manager** to start the contract and approval process.
- **How does DoorDash decide which items are eligible?** DoorDash uses an **eligibility flag** that **merchants** send for program-eligible items, via the **Catalog** update process or **Catalog API**.
- **How are taxes reflected when SNAP/EBT is used for part of the order?** SNAP payments are **not taxed**. Tax is calculated only on the portion paid with standard payment methods.
- **Why is snap_amount less than the item price for some items?** SNAP is applied to eligible items in the order the customer added them to the cart. Some items may be **partially** funded depending on remaining SNAP balance (e.g. snap_amount 191 on a 443-cent item).
- **If quantity > 1, does snap_amount cover the total for that item?** Yes. **snap_amount** is the full amount paid with SNAP/EBT for that line item (all units).

---

### 5. Useful additional features

- **Store temporary deactivation** – Let merchants pause their DoorDash storefront (busy periods, outages, etc.). Use **temporary** deactivation (set end date/duration) so stores don’t lose revenue. (Our Restaurant integration already supports this; see DOORDASH_SETUP.md.)
- **Item-level promotions [RECOMMENDED]** – Add/update promotions at store level; send integrated promotion data in Inventory; receive integrated promotion data in orders. See **Promotion Management API** below. Resources: Promotion Creation API, Sending/Receiving promotion data.

#### Promotion Management API – reference

The Promotion Management API lets partners manage **item-level promotions** for existing items at the **store level** (add and update promotions).

**Endpoint:** `https://openapi.doordash.com/marketplace/api/v2/promotions/stores/{store_location_id}`

- **POST** – Create a new promotion for the store.
- **PATCH** – Update promotions in the store.

**Authentication:** JWT (see DoorDash JWT authentication documentation). Use the same provider type as other Marketplace endpoints.

**Success response (e.g. 200):**
```json
{
  "operation_id": "string",
  "operation_status": "SUCCESS",
  "message": "string"
}
```

**Error responses:**

| Response code | Code (body) | Message / notes | field_errors.field | field_errors.error |
|---------------|--------------|------------------|--------------------|---------------------|
| 400 | validation_error | One or more request values couldn't be validated | Name of field that couldn't be validated | Error encountered validating the value |
| 401 | authentication_error | Default: The [exp] is in the past; the JWT is expired | — | — |
| 403 | authorization_error | Default: Credentials provided don't work | — | — |
| 404 | unknown_business_id | — | — | — |
| 422 | request_rate_limited | — | — | — |
| 429 | request_rate_limited | — | — | — |
| 500 | service_fault | Default: Internal service failure; try again later | — | — |

**Verification:** After a successful call, share an example request payload with your DoorDash Technical Account Manager to verify.

**FAQ:**

- **Provider type** – Use the same OpenAPI provider type as other endpoints.
- **SLA** – Creating or updating a promotion may take up to **30 minutes** to reflect.
- **PATCH a promotion that doesn’t exist** – If the request format is correct, DoorDash may return **202 Accepted** but drop the promotion during async validation; additional feedback may be provided in the future.
- **Remove a promotion intra-day** – Send a **PATCH** request to remove the promotion.
- **Multiple promos per item** – Only **one** promotion per item is supported.

#### Receive integrated promo data (order payload)

**Prerequisites**

- DoorDash sends **comprehensive promotion data** in the order payload: merchant-funded and co-funded discounts, plus **stacked** promotions (multiple promos on one order). Partners must build to the **new API fields** below to use integrated promo functionality.

**Overview**

When a customer redeems a promotion configured in DoorDash Campaign Manager, the order payload includes **discount funding breakdowns** so merchants can reconcile promotional spend in the POS. Merchants get:

- **Merchant-funded:** exact merchant-funded discount amount.
- **Co-funded:** exact merchant-funded **and** DoorDash-funded amounts.
- **Stacked promotions:** multiple promotions on a single order.

**Important:** DoorDash does **not** send data for **fully DoorDash-funded** promotions. Orders with no promo or only a fully DoorDash-funded discount will have **no** promotion fields in the payload.

**Why implement**

- Easier end-of-month reconciliation; POS as source of truth for accounting.
- Reduces manual reconciliation and supports scaling promotions.

**Successful implementation**

- **Receive and ingest:** merchant-funded, co-funded, and multiple promos per order.
- **Validate:** if a promo causes an order to fail, return a **clear failure_reason** (e.g. `"failure_reason": "Promo DD-BOGO-123 failed validation"`).
- **Transmit** promo data to downstream reconciliation and reporting.
- **Document** validation logic and campaign configuration process for store operators.

**How to enable**

1. Configure an eligible campaign in **DoorDash Campaign Manager**.
2. Provide **external_campaign_id** to your **DoorDash Account Owner** (required for every promo).
3. DoorDash Engineering enables Promotions in the OpenAPI Order Service (**one-time**). After that, the order payload includes the promotion-related fields below.

**New fields (order-level)**

| Field | Description |
|-------|-------------|
| applied_discounts_details | Array of all promotions on the order (replaces deprecated applied_discounts). Can be more than one (stacked). |
| total_discount_amount | Promotional value applied (cents). Replaces discount_amount. |
| promo_id | DoorDash campaign identifier. |
| promo_code | (Optional) Code entered by customer. |
| external_campaign_id | Merchant-defined campaign reference; required for every promo. |
| merchant_funded_discount_amount | Merchant-funded portion (cents). |
| doordash_funded_discount_amount | DoorDash-funded portion (cents). |
| subtotal_for_tax | Taxable amount after discounts (sales tax logic). |
| subtotal_tax_amount | Tax after discounts (excludes delivery/service fees). |
| total_merchant_funded_discount_amount | Total merchant-funded discount on the order (cents). |

**New fields (item-level)**

| Field | Description |
|-------|-------------|
| applied_item_discount_details | Array of promotions on the item (replaces applied_item_discounts). **One** promotion per item. |
| total_discount_amount | Promotional value on item (cents). |
| promo_id, promo_code, external_campaign_id | Same as order-level. |
| promo_quantity | (Optional) free_item_promo_quantity, discount_item_promo_quantity, free_option_promo_quantity, discount_option_promo_quantity. |
| merchant_funded_discount_amount | Merchant-funded portion (cents). |
| doordash_funded_discount_amount | DoorDash-funded portion (cents). |
| subtotal_for_tax, subtotal_tax_amount | Same semantics as order-level. |
| total_merchant_funded_discount_amount | Total merchant-funded on order (cents). |

**Deprecated (use new fields by 4/30/2026)**

- **applied_discount** → use **applied_discounts_details**
- **applied_item_discount** → use **applied_item_discount_details**
- **subtotal_discount_funding_source** → use **merchant_funded_discount_amount** and **doordash_funded_discount_amount** to determine funding.

**Example – order-level applied_discounts_details (merchant-funded)**

```json
"applied_discounts_details": [
  {
    "total_discount_amount": 400,
    "promo_id": "2f1225a2-8570-47cd-8819-8f8e0a362630",
    "promo_code": "20% off",
    "external_campaign_id": "PLU-123789",
    "doordash_funded_discount_amount": 0,
    "merchant_funded_discount_amount": 400
  }
],
"total_merchant_funded_discount_amount": 600
```

Co-funded entries have non-zero **doordash_funded_discount_amount** and **merchant_funded_discount_amount**. Stacked promos have multiple objects in **applied_discounts_details**. Item-level promos appear in **applied_item_discount_details** on each item. See DoorDash API Reference for full order and item-level examples.

**Common issues**

| Issue | Best practice |
|-------|----------------|
| Promo misconfigured in POS → order failures | Provide merchant guides on promotion configuration; share POS promo setup with DoorDash. |
| Item MSIDs change while item-level promo is live → promo not applied / failures | Guide merchants; coordinate with DoorDash before menu changes during live promos. |
| Promo misconfigured in Campaign Manager | Verify external_campaign_id, item MSIDs when building promos. Test in staging before launch; share enablement guides with merchants. |

**FAQ**

- **Do subtotal and tax reflect the promotion?** Yes. Use **subtotal_for_tax** for taxable amount after promos.
- **Which promotions are eligible?** All subtotal and item-based discounts, including co-funded. **Fully DoorDash-funded** promos are **not** sent in the payload.
- **Promos on item options/extras?** Yes; supported at item, option, or combined level.
- **Who funded the promotion?** Use **merchant_funded_discount_amount** and **doordash_funded_discount_amount** (do not use deprecated subtotal_discount_funding_source).
- **Multiple promotions?** Yes at order and item level; a **single item** can have only **one** applicable promotion.
- **Order with no discount or only fully DoorDash-funded discount?** No promotion fields are included in the payload.

#### Enable self-delivery

**Prerequisites**

- Some merchants use an **in-house delivery fleet** and want to be featured on DoorDash but fulfill orders with their own drivers. Self-Delivery supports that model.

**Overview**

**Self-Delivery** lets restaurants be featured on doordash.com while fulfilling orders with their **own** delivery fleet. DoorDash sends **additional fields** on the order payload so the merchant has what they need to complete the delivery.

**How it works**

- Self-Delivery is configured **at the store level** in DoorDash. When a store is enabled for Self-Delivery, the **order payload** includes extra fields:

| Field | Description |
|-------|-------------|
| address_instructions | Delivery-level instructions from the customer (e.g. gate code, “Leave at my door: Building 23”). |
| delivery_address | Customer delivery address (street, city, state, zip_code, country_code, lat, lng, subpremise, etc.). |
| delivery_fee | Delivery fee charged to the customer (e.g. cents). |

- **Order type:** Some POS systems expect orders to be marked as **delivery** (not **pickup**). If the merchant requires it, aggregators/integrations should send the order to the POS with type **delivery** so routing and fulfillment work correctly.
- **is_pickup:** In the payload, self-delivery orders have **is_pickup: false**.

**Example – self-delivery order (key fields)**

```json
{
  "order": {
    "id": "6db24d02-e25f-4acb-aeb0-e387b1335791",
    "is_pickup": false,
    "delivery_address": {
      "street": "1234 May Ave SE",
      "subpremise": "205",
      "city": "Atlanta",
      "state": "GA",
      "zip_code": "30316",
      "country_code": "US",
      "lat": "42.1234567",
      "lng": "-83.1234567",
      "address_instructions": "Leave at my door: Building 23 Red doormat"
    },
    "delivery_fee": 299,
    "delivery_short_code": "897176",
    "consumer": { ... },
    "store": { ... },
    "categories": [ ... ]
  }
}
```

**Sample self-delivery order (reference)**

**Limited access:** Marketplace Order APIs are not yet generally available; record interest in early access via DoorDash.

The following is a **sample self-delivery order** payload—data DoorDash sends after order placement for a store that delivers with its own fleet. Refer to the DoorDash Order model for full field definitions.

```json
{
  "id": "0nb24d02-e25f-4acb-aeb0-e387b1335791",
  "tax": 94,
  "subtotal": 1564,
  "estimated_pickup_time": "2020-12-16T13:00:04.261429+00:00",
  "is_pickup": false,
  "tip_amount": 100,
  "order_special_instructions": "",
  "delivery_address": {
    "city": "Atlanta",
    "subpremise": "205",
    "address_instructions": "Leave at my door:Building 23 Red doormat",
    "state": "GA",
    "street": "1234 May Ave SE",
    "lat": "42.1234567",
    "lng": "-83.1234567",
    "zip_code": "30316",
    "country_code": "US"
  },
  "consumer": {
    "id": 42298631,
    "first_name": "Kelley",
    "last_name": "B",
    "email": "support@doordash.com",
    "phone": "1231234567"
  },
  "store": {
    "merchant_supplied_id": "601135",
    "provider_type": "posprovider_1",
    "timezone": "US/Eastern"
  },
  "categories": [
    {
      "merchant_supplied_id": "10033",
      "name": "Breakfast",
      "items": [
        {
          "name": "Plain Bagel",
          "quantity": 1,
          "price": 149,
          "merchant_supplied_id": "780709",
          "consumer_name": "Kelley",
          "extras": [
            {
              "merchant_supplied_id": "Toast & Slice",
              "name": "Toast & Slice",
              "options": [
                {
                  "name": "Sliced & Toasted",
                  "quantity": 1,
                  "price": 0,
                  "merchant_supplied_id": "780471",
                  "extras": []
                }
              ]
            }
          ],
          "special_instructions": ""
        }
      ]
    }
  ],
  "delivery_short_code": "897176",
  "tax_transaction_id": "6db24d02-e25f-4acb-aeb0-e387b1335791",
  "delivery_fee": 299,
  "taxes_on_fees": 18,
  "extra_cart_order_fee": 0,
  "commission_type": "dashpass",
  "is_tax_remitted_by_doordash": true,
  "tax_amount_remitted_by_doordash": 94,
  "fulfillment_type": "mx_fleet_delivery"
}
```

**FAQ**

- **How is delivery radius set?** The merchant sets it for the store: a **circular radius** around the store or a **custom delivery zone** (DoorDash needs a **KML file** for custom zones).
- **Can merchants switch between in-house and DoorDash fulfillment?** Currently the store must complete **100%** of deliveries with one model (all in-house or all DoorDash). Rule-based toggle (e.g. by time or distance) was planned for future releases; confirm current behavior with DoorDash.
- **If the store cannot deliver an order?** The store can request a DoorDash driver via the **web-based Drive Form** or cancel the order (cancellation is discouraged).
- **Orders outside the store’s radius – delivered by DoorDash?** No. There is no automatic handoff to DoorDash for out-of-radius orders; rule-based logic (e.g. assign orders outside X miles to DoorDash) was planned for a future release.
- **What is rule-based logic?** (Planned) Rules to assign orders to in-house vs DoorDash automatically—e.g. by **time** (in-house 10am–6pm, DoorDash 6pm–10pm) or **distance** (in-house within 5 miles, DoorDash outside 5 miles). Confirm availability with DoorDash.

---

### 6. Merchant onboarding (Store Onboarding)

**Full flow, webhook spec, status/exclusion codes, and prerequisites:** **[DOORDASH_RETAIL_ONBOARDING.md](./DOORDASH_RETAIL_ONBOARDING.md)**. DoorDash reference: [Merchant Onboarding Requirements for API-Integrated Retail Stores](https://developer.doordash.com/en-US/docs/marketplace/retail/how_to/retail_sow_v2).

**Summary:** Initiation in Partner portal → "Are you new to DoorDash?" → New Merchant Signup (sales form, contract, return to Partner) or Onboarding (form pre-populated, optional DoorDash Store ID, enable Catalog/Inventory/Store Hours Pull, send **POST** `https://openapi.doordash.com/webhooks/stores/onboarding` **one store per call**, listen for **Onboarding status** webhooks). **INTEGRATION_ACTIVATED** = success; **ABANDONED** / **MENU_BLOCK** / **ACTIVATION_BLOCK** = surface details and direct merchant to DoorDash support. SLA: onboard to data delivery within 2 business days of gaining access to merchant data. Prerequisites: Catalog Pull, Inventory Pull, Store Hours Pull; webhook fields programmatic; cadence real-time or daily; public help doc; real-time inventory updates.

- **Catalog Pull** – Required; work with TAM to test.
- **Inventory Pull** – Required; test via Job Management API (trigger Inventory Pull job).
- **Store Hours Pull** – Required; work with TAM to test.
- **Send Store Onboarding webhooks** – Test independently; confirm in Developer Portal Event Logs.
- **Receive Store Onboarding Status webhooks** – Required for onboarding; work with TAM to test. Use them to know when to enroll a store in regular integrated updates. Surface blocked statuses with guidance to merchants (or Partner support queue for Partner-owned issues).

**Onboarding requirements (certification):**

- “Integrate with DoorDash” button in Partner portal.
- “Live on DoorDash already?” question for merchants.
- Sales referral form link.
- Store Onboarding request with correct `location_id`, address, etc.
- Real-time webhook cadence (no delay between merchant requesting integration and webhook sent).
- Webhook contents sourced **programmatically** from merchant data in the Partner environment (not manually entered).
- Error handling: surface Merchant-owned issues to the merchant; Partner-owned issues to Partner support queue.
- Subscription to Store Onboarding Status webhooks; handle blocked statuses with details and guidance.

---

### 7. Testing

- Request a test store from DoorDash. TAM configures it and notifies you when ready.
- Test catalog: deliver via your catalog integration; DoorDash builds a catalog and test store with your item IDs.
- **Testing orders:** After test store has menu and hours, follow DoorDash testing instructions (include `dd-tenant-id` for adjustment in sandbox).

---

### 8. Merchant enablement material

Produce merchant-facing help content (hosted on your help center) per DoorDash’s guide. Certification requires:

- **Overview** – Brief description of the integration.
- **Get started** – How net-new merchants sign up; links/videos; onboarding checklist and time estimates.
- **Add or Enable the DoorDash integration** – How to prepare (software/hardware, steps before integration); video or detailed screenshots.
- **Inventory management** – How to create/edit inventory for ingestion and manage it after go-live.
- **Order management** (Merchant Pick) – How merchants manage orders via the integration.

---

### 9. Certification and launch

- **Prepare for certification** – Ensure all required items are ready; notify your TAM.
- **Certification** – TAM runs a 1–2 hour live session; each checklist item is reviewed. Share screen and demonstrate merchant behavior and integration in real time. Failed items must be fixed and re-certified.
- **Prepare for launch** – Get the system ready for live merchants.
- **Pilot** – Select 10–20 motivated merchants; guide them through onboarding and monitor performance.
- **Launch to all merchants** – After pilot success, launch more broadly.

---

### 10. Inventory Feed integration (SFTP / flat-file)

**Introduction**

An **Inventory Feed** integration is an alternative to the API-based flow. It uses **flat files** transferred over **SFTP** so partners can send inventory and catalog data to DoorDash without building against the Catalog and Inventory APIs. Use this path if you prefer file-based delivery or if DoorDash has directed you to the Inventory Feed.

**How it works**

Merchants (or their partners) **create and upload** inventory and catalog data files. DoorDash **transforms and ingests** the data so your offerings stay up to date on the DoorDash platform. A workflow graphic in DoorDash’s documentation shows the preferred integration flow; it may not apply to every case—confirm with your TAM.

**Key details**

- Data is shared via **Secure File Transfer Protocol (SFTP)**.
- Data can include **Inventory Feed** and **Product Catalog** files.
- File transfer includes **store-level** pricing, taxes, and availability.
- Data is transferred **at least once per day**.
- The integration supports **three options** to fulfill orders (details in DoorDash docs).

**Requirements to begin**

- **Security credentials** for SFTP connectivity.
- **Up to 10 OpenSSH public keys** to authenticate as the provisioned user account.
- **Sample Inventory Feed** data file.
- **Comprehensive Product Catalog** data file.

**Materials required for kick-off**

Before starting, provide the following to your DoorDash contact:

1. **OpenSSH public key(s)** – Up to 10 keys for SFTP authentication. See **Connectivity – SSH key generation** below. DoorDash guide: creating an OpenSSH public key.
2. **Sample inventory feed data file** – Follow the Inventory File Overview; work with your **Technical Account Manager (TAM)** to agree on format (format is relatively flexible).
3. **Comprehensive product catalog data file** – Follow the Catalog File Overview. Catalog quality is critical; align with your TAM if you have questions.

**Connectivity – SSH key generation**

DoorDash uses an SFTP server (AWS Transfer) for file sharing. To onboard your user account you must provide:

- **IP address(es) / CIDR** that will access the SFTP server. DoorDash adds these to the firewall to grant access.
- **Up to 10 SSH public keys** for the provisioned user account.

**OpenSSH format (required):** Keys must be in **OpenSSH** format for AWS Transfer. **SSH2** keys are not accepted. Verify your public key has:

- **ssh-rsa** prefix
- **AAAA** lead-in after the prefix
- Your local/creator identifier at the end

**Generate a key pair** (example; use a passphrase and secure storage for the private key):

```bash
ssh-keygen -t rsa -P "your_pass_phrase" -m PEM -f your_key_name
```

- **Send the public key** to DoorDash (email, Slack, etc.). The public key is not sensitive.
- **Do not share the private key** with DoorDash or anyone else. Store the private key in the **.ssh** directory of the user account on the machine that will run the scheduled file delivery.

**Sample OpenSSH public key structure:** `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC4O+... {CREATOR_LOCAL_EMAIL}`

**Your team**

| Role | Contact for | Responsibilities |
|------|-------------|------------------|
| **Account Owner (AO)** | Business and operational needs | Project management for integration launch; operational aspects of launch; ongoing partner relationship and business growth strategy. |
| **Technical Account Manager (TAM)** | Technical questions and issues | SFTP connectivity setup; data review and mapping; building the Inventory Feed integration; ongoing integration quality and technical issues. |

**Reporting**

Reporting is important for integration success and efficiency. See DoorDash’s reporting documentation for how to create and use reports.

**SFTP setup**

After DoorDash receives your public key(s) and IP/CIDR, they provision a dedicated SFTP server:

| Setting | Value |
|--------|--------|
| Hostname | `sftp.static-edge.doordash.com` |
| Port | 22 |
| Username | Provided by DoorDash after SFTP setup |
| Authentication | **Private key** (pair to the public key you shared). DoorDash does **not** support password-based SFTP. |
| Static IP (if required) | `172.65.205.234` |

**Test:** Upload an inventory file to **/daily_feed/v1** and confirm receipt with your TAM.

**File delivery – paths and cadence**

| Content | File type | Naming | Transfer path | Cadence |
|---------|------------|--------|----------------|---------|
| **Inventory** | CSV | `inventory_{yyyy}{mm}{dd}{hh}{MM}.csv` | `daily_feed/v1/{yyyy}{mm}{dd}` | **Minimum daily** (availability & pricing). Automated, set schedule. At least once per day. |
| **Catalog** | CSV | `catalog_{yyyy}{mm}{dd}{hh}{mm}.csv` | `catalog/v1` | At least **monthly**; daily or weekly encouraged. |
| **Partial inventory** | CSV | `partialinventory{yyyy}{mm}{dd}{hh}{MM}.csv` | `partial_feed/v1/{yyyy}{mm}{dd}` | Max every **1 hour**. Discuss limitations with your TAM. Optional – confirm with TAM if partial updates are right for you. |
| **Raw images** | — | — | `images/v1` | Discuss with TAM if required. |

**Inventory Feed file – overview**

The **Inventory Feed** file is a **store-level** data export with **pricing and availability** for each sellable item. DoorDash uses it to create or update the store’s menu on the Marketplace (visible items, prices, and taxes). Data is shared **at least daily** (max **3x per day**). When a new file is detected, an **ETL transformation** runs automatically to align the file with DoorDash’s standard format; when ETL completes, a webhook triggers the **Menu update**. The process usually takes **2–4 hours** (can be longer for large files).

**Sample file requirements**

To start the integration, DoorDash requires a **sample** of the file you will use as the Inventory Feed. Ideally the format matches the **Inventory Feed Setup** and **Inventory file fields** below; if not, work with your **TAM** to agree on a format. DoorDash builds the ETL from this sample—ensure your **production** file matches it.

**Inventory Feed setup (recap)**

- **File type:** Flat file (CSV)
- **Naming:** `inventory_{yyyy}{mm}{dd}{hh}{MM}.csv`
- **Transfer path:** `daily_feed/v1/{yyyy}{mm}{dd}`
- **Cadence:** Minimum **daily** (availability & pricing). Automated, on a set schedule.

**Inventory file fields**

| Field name | Description | Required/Optional | Format |
|------------|-------------|-------------------|--------|
| store_id | Merchant store ID | Required | string |
| sku_id | Merchant SKU ID | Required | string |
| upc | Universal Product Code (prefer GTIN-14) | Optional | string |
| category | Item category | Optional | string |
| name | Item name | Required | string |
| description | Item description | Optional | string |
| price | Item price per sellable unit | Required | number, 2 decimal |
| sale_price | Sale or promotional price | Required* | number, 2 decimal |
| loyalty_price | Price for loyalty club members | Required* | number, 2 decimal |
| bottle_deposit_fee | CRV fee amount | Required* | number, 2 decimal |
| tax_rate | Local tax rate for item | Required | number, 4 decimal |
| is_active | Item in stock at store | Required | True/False |
| balance_on_hand | Quantity available | Optional | number |
| last_sold_date | Date item was last sold | Optional | string |
| is_alcohol | Item is alcoholic | Required* | True/False |
| is_weighted_item | Sold by weight | Required* | string |
| approximate_sold_as_quantity | For weighted items – approx. weight of one sellable unit | Required* | string (decimal) |
| item_location | Location identifier (e.g. aisle) | Optional | string |
| snap_eligible | SNAP/food stamps eligible | Optional | boolean |

*Required* = Required in certain situations (e.g. alcohol, weighted items, promotions). Confirm with your TAM.

Additional columns (e.g. **promotion_type**, **promotion_purchase_quantity**, **promotion_quantity**, **promotion_total_price**, **promotion_percentage**, **promotion_price_off**, **promotion_quantity_limit_per_cart**, **promotion_start_time**, **promotion_end_time**) may be used for promotional pricing—align with your TAM.

**Inventory sample (example rows)**

| store_id | sku_id | upc | category | name | price | sale_price | tax_rate | is_active | last_sold_date | is_alcohol | is_weighted_item | approximate_sold_as_quantity |
|----------|--------|-----|----------|------|-------|------------|----------|-----------|----------------|------------|------------------|------------------------------|
| 2705977 | 012000001291-0 | | Drinks | Pepsi Soft Drink Cola Bottle (20 oz) | 2.55 | 1.99 | 7.5000 | TRUE | 1/5/2024 | FALSE | FALSE | |
| 2705977 | 044500201819-0 | | Produce | Bananas (Bunch) | 2.75 | | 4.0000 | FALSE | 1/5/2024 | FALSE | TRUE | 3.5 |
| 2705977 | 012332434235-0 | | Produce | Bananas (Each) | 3 | | 4.0000 | TRUE | 1/2/2024 | FALSE | FALSE | 1 |

Include all columns required for your integration (description, loyalty_price, bottle_deposit_fee, balance_on_hand, item_location, snap_eligible, promotion_* as agreed). See DoorDash Inventory File Overview for full spec.

**Integration timeline**

- Start file setup and delivery as early as possible for testing and a smooth go-live.
- DoorDash requires **automated file transfer** to be in place at least **3 weeks before launch**. Plan with your technical team for this dependency.

**Enablement requirements (third-party partners)**

If you are a third-party integration partner, you must share **merchant-facing enablement materials** during certification to onboard locations after pilot. DoorDash provides a form for this. Include:

- **Supported systems** – List of systems (and version requirements if any) that the integration supports.
- **Merchant portal** – URL where merchants log in to manage the integration.
- **Help: preparation** – URL to a help article on steps merchants must complete to prepare for the integration.
- **Help: inventory and availability** – URL to a help article on inventory and store availability management after integration.

**Support**

For issues or questions at any stage, contact your **Technical Account Manager (TAM)**.

---

### 11. Reporting API

**Limited access:** Reporting APIs are not yet generally available. Record interest in early access via the link provided by DoorDash.

**About**

DoorDash’s **Reporting API** lets integration partners **download** **Financial**, **Operations**, **Menu**, and **Feedback** reports. With merchants selling across multiple channels, access to this data in a usable format supports decision-making and day-to-day operations. DoorDash provides Merchants and Authorized Partners a streamlined way to use data collected on DoorDash to run their business.

**Get started**

- **Indicate interest** in Reporting API access using the link provided by DoorDash. The access team will review your request and notify you **by email** when approved.

**Integration milestones (after approval)**

| Week | Milestone |
|------|-----------|
| **Week 1** | **Create a Developer Portal account** – Sign up and request a **Reports** integration using the **invite link** from the DoorDash team. Wait for the **approval email** (sent when your account moves from **In Review** to **Approved**). Approved status means all stores associated with your business are linked to your Developer Portal account. |
| **Week 2** | **Generate JWT and pull a report** – Generate your JWT token (see DoorDash **Generate your JWT Token** guide). Pull your first report (see **Getting your first report** guide). Use the **API reference** and **Available Reports** guide to see which reports you can generate. Use the **FAQ** for data availability SLAs and Reporting API limitations. |

**Resources**

- Generate your JWT Token guide  
- Getting your first report guide  
- API reference and Available Reports guide  
- Reporting API FAQ (SLAs, limitations)

**Generate a JWT**

Reporting API requests use **token-based authentication**. The JWT is built from your **access key** (developer_id, key_id, signing_secret from the DoorDash Developer Portal).

- **Python (this codebase):** PyJWT is already in `requirements.txt`. Use the helper in `doordash_service`:

```python
from doordash_service import generate_doordash_reporting_jwt

access_key = {
    "developer_id": "YOUR_DEVELOPER_ID",
    "key_id": "YOUR_KEY_ID",
    "signing_secret": "YOUR_BASE64_SIGNING_SECRET",
}
token = generate_doordash_reporting_jwt(access_key)  # 5 min validity by default
# Use in header: Authorization: Bearer <token>
```

- **Node.js:** The project includes `jsonwebtoken` as a devDependency. From repo root run `npm install`, then either use the script or the snippet below:

```bash
# Optional: script that reads from env DOORDASH_DEVELOPER_ID, DOORDASH_KEY_ID, DOORDASH_SIGNING_SECRET
node scripts/doordash-reporting-jwt.js
```

```javascript
const jwt = require('jsonwebtoken');

const accessKey = {
  developer_id: 'YOUR_DEVELOPER_ID',
  key_id: 'YOUR_KEY_ID',
  signing_secret: 'YOUR_BASE64_SIGNING_SECRET',
};

const data = {
  aud: 'doordash',
  iss: accessKey.developer_id,
  kid: accessKey.key_id,
  exp: Math.floor(Date.now() / 1000 + 300),
  iat: Math.floor(Date.now() / 1000),
};

const headers = { algorithm: 'HS256', header: { 'dd-ver': 'DD-JWT-V1' } };

const token = jwt.sign(
  data,
  Buffer.from(accessKey.signing_secret, 'base64'),
  headers,
);

console.log(token);
```

**Reporting API flow**

The Reporting API has two endpoints and one optional webhook. Use them in this order:

| Step | Action |
|------|--------|
| **1** | **POST Create Reports** – Request report generation; receive a `report_id`. |
| **2** | **(Optional)** Wait for **Report Ready Webhook** – DoorDash notifies when the report is ready (status `SUCCEEDED` or `FAILED`). |
| **3** | **GET Report Link** – Use `report_id` to get the download link; if status is `PENDING`, poll until `SUCCEEDED`. |

- **Step 1 – POST Create Reports**  
  `POST https://openapi.doordash.com/dataexchange/v1/reports`  
  Body: `business_ids`, `store_ids` (optional; if both empty, all stores for the partner are included), `start_date`, `end_date`, `report_type`, `report_version`.  
  Response `202`: `{ "report_id": "uuid" }`.  
  All IDs in `business_ids` and `store_ids` must be valid and approved via the Data Exchange Request process; otherwise the request returns 403.

  Example request body:

  ```json
  {
    "business_ids": [239487234, 293139],
    "store_ids": [],
    "start_date": "2022-08-01",
    "end_date": "2022-08-03",
    "report_type": "ORDER_DETAIL",
    "report_version": 1
  }
  ```

  Example response:

  ```json
  { "report_id": "f2a99881-5505-448a-a341-5bfc53b7c754" }
  ```

- **Step 2 – Report Ready Webhook (optional)**  
  When report generation completes, DoorDash can send a webhook with status `SUCCEEDED` or `FAILED`. Use it to trigger the GET Report request.  
  **Token-based auth:** Provide your TAM with a token (min 64 characters); DoorDash stores it and sends it in the auth header on webhook requests.  
  **Signature-based auth:** Alternatively use the signature-based method per DoorDash’s docs.

- **Step 3 – GET Report Link**  
  `GET https://openapi.doordash.com/dataexchange/v1/reports/{report_id}/reportlink`  
  Returns the status of the report and, when ready, a link to download. If status is `PENDING`, retry until the report is ready.  
  - Time from POST to report ready can be **up to 5 minutes**.  
  - The download link is **valid for 20 seconds** after first access.  
  - The file is a **ZIP containing CSV** file(s).  
  - If you do **not** use the Report Ready webhook, **poll this endpoint about every 2 minutes** until the link is returned.

**Available reports**

Reports are generated as **Comma Separated (.csv)** files. Use the table below to see which **report group** your business uses:

| Report group | Report users |
|--------------|--------------|
| **Marketplace (Merchant Pick) Reports** | Restaurants; merchants with Merchant Pick shopping (e.g. some convenience, hot + prepared, alcohol). |
| **Marketplace (Dasher Shop) Reports** | Merchants with Dasher Shop shopping (e.g. grocery, retail, some convenience). |

**Marketplace – Merchant Pick reports**

| Report | Report_Type value | Description |
|--------|-------------------|-------------|
| Merchant Avoidable Wait | AVOIDABLE_WAIT | Orders with merchant avoidable wait. |
| Canceled Orders | CANCELLED_ORDERS | All canceled orders (any reason). |
| Consumer Feedback | CONSUMER_FEEDBACK | All customer feedback (item-level and store-level reviews). |
| Menu Item Error | MENU_ITEM_ERROR | Orders with missing or incorrect item and the flagged item. |
| Menu Open Hours | MENU_OPEN_HOURS | Menu hours for all stores. |
| Menu Special Hours | MENU_SPECIAL_HOURS | Upcoming special hours for all stores. |
| Order Details | ORDER_DETAIL | All orders with items, modifiers, subtotal, Dashpass usage; merchant order number (Merchant POS Order ID) when applicable. |
| Payout Summary | PAYOUT_SUMMARY | Summary of all payouts completed in the requested time frame. |
| Store Temporary Deactivations | TEMPORARY_DEACTIVATION | Stores currently temporarily deactivated. |
| Store Information | STORE_INFORMATION | Stores and their integration and merchant-supplied IDs tied to your Reporting API account. |
| Transaction Details | TRANSACTION_DETAIL | Payout and transaction data per order. |

**Marketplace – Dasher Shop reports**

| Report | Report_Type value | Description |
|--------|-------------------|-------------|
| Payout Summary | NV_PAYMENTS | Order-level payout details for completed payouts in the requested time frame. |
| Transaction Details | NV_TRANSACTIONS | Transaction details for financial reconciliation of RedCard transactions. |
| Order Item | NV_ORDER_ITEMS | Item-level order details: picked, not found, and substituted items. |
| Operations and Consumer Feedback | NV_OPERATIONS_CONSUMER_FEEDBACK | Operational metrics (shop time, missing & incorrect, SNAP data, etc.) and all customer feedback (item and store reviews). |

**Report column reference (Merchant Pick):** For detailed **column definitions** (column name, data type, definition, example, since report version) for Marketplace Merchant Pick reports (AVOIDABLE_WAIT, CANCELLED_ORDERS, CONSUMER_FEEDBACK, MENU_ITEM_ERROR, MENU_OPEN_HOURS, MENU_SPECIAL_HOURS, ORDER_DETAIL, PAYOUT_SUMMARY, TEMPORARY_DEACTIVATION, STORE_INFORMATION, TRANSACTION_DETAIL, STORE_DOWNTIME), see **[DOORDASH_RETAIL_REPORTS.md](./DOORDASH_RETAIL_REPORTS.md)**. For version-specific payloads (e.g. PAYOUT_SUMMARY v3, TRANSACTION_DETAIL v4) and Dasher Shop report columns, use the DoorDash API Reference and Available Reports guide.

---

## Certification checklist (summary)

| Phase | Requirement | Mandatory |
|-------|-------------|-----------|
| **CATALOG** | Catalog API – Create (POST), Update (PATCH); Catalog Pull endpoint | Required |
| **CATALOG** | Age-restricted tagging (alcohol, CBD, OTC); Item categorization (e.g. Liquor >> Whiskey); SNAP tagging | Recommended / Optional |
| **INVENTORY** | Item availability (inactive↔active, with/without price change); item removed from catalog → unavailable; Item price update; Inventory Pull endpoint | Required |
| **INVENTORY** | Item-level hours; Item location (aisles) for Dasher pick; Modifiers / 86’ing | Dasher Pick / Optional |
| **STORE HOURS** | Standard and special store hours (PATCH); Store hours pull endpoint | Required |
| **PROMOTIONS** | Strikethrough pricing (base_price + sale_price); Item promotions POST/PATCH; Redemption cap | Recommended / Optional |
| **ORDERS** | Order receipt (200/202); Async confirm success/fail; Cancellation (DD→Partner, Partner→DD); Order adjustment (substitution, delete item, quantity); Updated order payloads; Masked phone; Ready for pickup; Order failure reason doc; Order notifications | Merchant Pick Required |
| **ORDERS** | Store temporary deactivation (deactivate + reactivate); Customer substitution preferences; Dasher status webhooks; Self-delivery | Recommended / Optional |
| **TOOLING** | Item availability logic (balance on hand or 90/60-day + hidden-from-eCommerce); Out-of-stock button; Support escalation path | Required / Recommended |
| **ONBOARDING** | “Integrate with DoorDash” button; “Live on DoorDash already?”; Sales referral form; Store Onboarding request; Real-time webhooks; Programmatic webhook contents; Error handling; Store Onboarding Status webhooks; Catalog/Inventory/Store hours pull | Required |
| **MERCHANT ENABLEMENT** | Overview; Get started; Add/Enable integration; Inventory management; Order management (Merchant Pick) | Required |

*(Mandatory = Required, or “Merchant Pick Required” where Merchant Pick is used. See DoorDash’s full checklist for exact wording.)*

---

## API endpoint call patterns (Retail)

| API | Batch size | Rate limit |
|-----|------------|------------|
| Inventory/Pricing POST | 10k | 5–10 QPS |
| Inventory/Pricing PATCH | 10k | 5–10 QPS |
| Inventory PULL | 10k | 5–10 QPS |
| Catalog POST | 1k | 5–10 QPS |
| Catalog PATCH | 1k | 5–10 QPS |
| PROMOTION POST | 1k | 5–10 QPS |
| Store hours PATCH | N/A | 5–10 QPS |

---

## Current POS support

- **Restaurant/Marketplace** integration is implemented: orders webhook, confirm, ready, cancel, menu push/pull, store status, dasher status, pickup instructions, store temporarily deactivated webhook. See [DOORDASH_SETUP.md](./DOORDASH_SETUP.md).
- **Retail** (Catalog API, Inventory/Pricing API, Store Hours API, Order API, Store Onboarding, Pull endpoints) is **not yet implemented**. This doc is the reference for building the Retail integration and passing Third-Party Provider certification.

**See also:** [DOORDASH_RX_DEEPLINK.md](./DOORDASH_RX_DEEPLINK.md) – Rx (prescription) deeplink format and signature (separate product).
