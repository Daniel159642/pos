# DoorDash Retail: Merchant Onboarding Requirements (API-Integrated Stores)

This document is the **Merchant Onboarding** spec for DoorDash Retail (API-integrated stores). It complements [DOORDASH_RETAIL.md](./DOORDASH_RETAIL.md).

---

## Overview

Building an onboarding process that meets these requirements delivers a fast and smooth experience.

**Onboarding SLA:** Partner will onboard the Merchant to data delivery within **2 business days** of gaining access to the Merchant's data. For Merchants new to the Partner's platform, SLA is provided by Partner to DoorDash during Onboarding Process Build.

---

## Flow

### Initiation

- Merchant starts from **external Partner environment** (Provider portal).
- Merchant initiates (e.g. "Add the DoorDash integration").
- Ask: **"Are you new to DoorDash Marketplace?"**
  - **Yes** → New Merchant Signup
  - **No** → Onboarding

### New Merchant Signup

- Partner presents merchant with a **DoorDash-provided sales sign-up form**.
- Form should be **business-scoped**: if a merchant has more than one location, they fill the form out once.
- Surface a list of the merchant's locations and instruct them to indicate which locations to include (default to "All Locations").
- DoorDash sales staff will contact the merchant and present a contract.
- After the merchant completes the sign-up form, instruct them to **return to the DoorDash integration sign-up in the Partner portal after they've signed their contract with DoorDash**.

### Onboarding

1. Partner surfaces a **form** to collect information for the **Store Onboarding Webhook**. Pre-populate with all information the Provider knows (e.g. store address). Allow the Merchant to override any value that will be sent in the webhook.
2. **Important:** Include the **"DoorDash Store ID"** field. Optional; used as a last resort to rescue an onboarding blocked because the webhook doesn't match an existing DoorDash store. If the merchant enters their DoorDash Store ID, it is sent in the webhook to guarantee match.
3. Partner enables **Catalog Pull**, **Inventory Pull**, and **Store Hours Pull** for the store(s) so DoorDash can launch them.
4. Partner **sends Store Onboarding Webhook** (one webhook per location; no multiple stores in one call).
   - **200** → Onboarding successfully initiated. Proceed to step 5.
   - **Non-200** → Review errors, fix, resend. If unresolvable, Developer Portal support or direct merchants to DoorDash support. Most common failure: merchant not yet signed contract → New Merchant Signup. Often: address mismatch → direct merchants to DoorDash support.
5. Partner **listens for Store Onboarding Status webhooks**.
   - **INTEGRATION_ACTIVATED** → Store successfully onboarded. Enroll the store in regular inventory, catalog, store hours, and orders (if applicable).
   - **ABANDONED**, **MENU_BLOCK**, **ACTIVATION_BLOCK** → Surface status and details to the merchant in the Partner portal (see status and exclusion tables below). Usually direct merchants to DoorDash support.

Meanwhile DoorDash will: configure business and store(s); Pull catalog and build it; finish configuring store(s); onboard store(s) to the partner's integration; Ingest inventory via Inventory Pull to generate menu(s); Update store hours via Store Hours Pull; Review menu quality. If QA passes (hours present, menu not empty, etc.), DoorDash enables the integration. If QA does not pass, DoorDash emails merchant and partner with exclusion details; DoorDash works with the merchant to activate.

### Contact DoorDash Support

Instruct merchants: "Please reach out to DoorDash Support at https://help.doordash.com/merchants/s/merchant-support?language=en_US."

---

## Store Onboarding Webhook (send)

**Note:** One webhook per location. For multiple stores, send one call per location. Bulk onboarding via Developer Portal CSV upload is only available by exception; work with your TAM.

**Endpoint:** `POST https://openapi.doordash.com/webhooks/stores/onboarding`

**Example payload:**

```json
{
  "partner_store_id": "abc123_456def",
  "partner_business_id": "ghi789_101jkl",
  "doordash_store_id": 123456,
  "doordash_business_id": 78910,
  "partner_store_name": "Empanada Empire",
  "partner_location_name": "Candler",
  "provider_type": "api_provider",
  "address_line_1": "101 DoorDash St.",
  "address_line_2": "Suite #5",
  "address_city": "Atlanta",
  "address_state": "GA",
  "address_zip": "30312",
  "requestor_first_name": "James",
  "requestor_last_name": "Walnut",
  "requestor_email": "james.walnut@api_provider.com",
  "requestor_phone": "+14124818894",
  "expected_go_live_date": "2022-07-22",
  "merchant_decision_maker_email": "manager@empanadaempire.com"
}
```

### Request fields

| Name | Type | Required | Details |
|------|------|----------|---------|
| partner_store_id | string | Yes | Unique identifier of the store in the Provider's system; will be location_id in API calls |
| partner_business_id | string | Yes | Unique identifier of the parent business in the Provider's system |
| doordash_store_id | integer | No | Unique identifier of the store in DoorDash's system (rescue match) |
| doordash_business_id | integer | No | Unique identifier of the parent business in DoorDash's system |
| partner_store_name | string | Yes | Customer-facing name of the store (e.g. "Burger Shack") |
| partner_location_name | string | No | Location-specific context (e.g. "Burger Shack - Las Vegas") |
| provider_type | string | Yes | Partner identifier (see Provider Type in DoorDash docs) |
| address_line_1 | string | Yes | — |
| address_line_2 | string | No | — |
| address_city | string | Yes | — |
| address_state | string | Yes | — |
| address_zip | string | Yes | — |
| requestor_first_name | string | Yes | First name of user on Provider side initiating the request |
| requestor_last_name | string | Yes | Last name of user on Provider side initiating the request |
| requestor_email | string | Yes | Email for requestor and for receiving status updates |
| requestor_phone | string | No | Phone for requestor |
| expected_go_live_date | string | No | YYYY-MM-DD; activations team will attempt to honor if provided |
| merchant_decision_maker_email | string | Yes | Email of merchant being onboarded; must be Business Admin in DoorDash Merchant Portal; receives merchant consent email to authenticate the request |

### Response

- **200:** `{ "message": "OK" }`
- **400:** Validation/malformed – e.g. `{ "message": "INVALID_ARGUMENT: X is required" }`

---

## Store Onboarding Status (receive)

### [REQUIRED] Subscribe to webhook events

- Register a subscription for event type **"Onboarding status"** in the DoorDash Developer Portal.
- DoorDash sends webhooks to your endpoint when status changes. Failed webhooks are retried 3 times.

**Status webhook payload:**

```json
{
  "onboarding_id": "9154103a-be82-48fc-978d-792171f7ee32",
  "location_id": "xdDJSnx",
  "doordash_store_uuid": "f1c7f43b-64ca-4586-b990-171aaafbca2d",
  "status": "ABANDONED",
  "exclusion_code": "DUPLICATE_LOCATION_ID",
  "details": "",
  "menus": [
    {
      "menu_uuid": "949e6d70-371a-4250-8fe7-2d13b141e07g",
      "menu_preview_link": "https://doordash.com/menu/1234",
      "menu_error": "reason why menu failed to be pulled"
    }
  ]
}
```

### [Optional] GET onboarding status

- **GET** `https://openapi.doordash.com/marketplace/api/v2/store_onboarding/<onboarding_id>`
- Headers: `Authorization: Bearer <Partner JWT>`, `auth-version: v2`, `User-Agent: <Partner User Agent>`
- Returns same structure as the webhook. **Subscribing to webhooks is mandatory;** GET is an optional enhancement and not a replacement.

### Possible onboarding status values

| Status | Details |
|--------|---------|
| INTEGRATION_REQUESTED | DoorDash business/store configuration and catalog build in process |
| STORE_CONNECTED | Store successfully matched to a DoorDash store |
| BUSINESS_ID_MAPPED | External business ID (partner_business_id) mapped to DoorDash business ID |
| CATALOG_REQUESTED | Catalog requested from Provider via Catalog Pull (or hourly check for 7 days if no Catalog Pull) |
| CATALOG_DATA_RECEIVED | Catalog data receipt confirmed |
| CATALOG_PULL_FAILED | Catalog Pull failed or no data received; remains until catalog PUSHed or received (hourly check 7 days if no Pull) |
| MENU_REQUESTED | Menu creation webhook sent; POS menus imported for this onboarding |
| MENU_IMPORTED | Menu ingestion validated; POS menu job completed |
| HOURS_SET | Store hours validated for all menus |
| MENU_AUDIT | Menu passed blank menu validation; auto QA in progress |
| MENU_BLOCK | Menu ingestion failed or validation failed; new menu ingestion needed |
| MENU_QUALIFIED | Menu passed auto QA; ready for activation |
| INTEGRATION_ACTIVATED | POS integration activated for this store (success) |
| ACTIVATION_BLOCK | POS activation attempt failed |
| ABANDONED | Onboarding abandoned (validation or internal error); see exclusion_code |

### Possible exclusion code values

| Category | Exclusion code | Details (for merchant/support) |
|----------|----------------|--------------------------------|
| ABANDONED | DUPLICATE_LOCATION_ID | This location_id/provider_type is already used on another POS store. Contact DoorDash Support if incorrect. |
| ABANDONED | VIRTUAL_BRAND_DETECTED | Store is a virtual concept; integration may not support shared location_id. Contact DoorDash Support. |
| ABANDONED | SELF_DELIVERY_DETECTED | Store is Self Delivery but integration doesn't support it. Contact DoorDash Support to disable. |
| ABANDONED | DOORDASH_DRIVE_STORE | DoorDash Drive stores cannot be onboarded to Marketplace. |
| ABANDONED | STORE_LIVE_ON_REQUESTED_POS_PROVIDER | Store is already live on this POS with this location_id. |
| ABANDONED | SFDC_ACCOUNT_RECORD_NOT_FOUND | No DoorDash account found; contact DoorDash support. |
| MENU_BLOCK | MENU_PULLING_REQUEST_FAILURE | Menu job failed (internal). Retry menu ingestion. |
| MENU_BLOCK | STORE_HOURS_NOT_POPULATED_FAILURE | Missing menu hours. Ensure valid hours and retry. |
| MENU_BLOCK | MENU_BLANK_FAILURE | Menu has no items. Add content and retry. |
| MENU_BLOCK | MENU_JOB_FAILURE | Menu job failed (contents, null names, etc.). Fix and retry. |

DoorDash Integration Onboarding team monitors exclusions and may email merchants/partners to unblock (e.g. DUPLICATE_LOCATION_ID, STORE_LIVE_ON_REQUESTED_POS_PROVIDER, STORE_HOURS_NOT_POPULATED_FAILURE, MENU_JOB_FAILURE, MENU_BLANK_FAILURE).

---

## Prerequisites and requirements

| Type | Requirement |
|------|-------------|
| Prerequisite | Developer Portal sign-up (DoorDash may contact Provider for onboarding issues). |
| Prerequisite | **Catalog Pull** – Required for onboarding and rescue path. |
| Prerequisite | **Inventory Pull** – Required for onboarding and rescue path. |
| Prerequisite | **Store Hours Pull** – Required for onboarding and rescue path. |
| Requirement | **Webhook content source** – Required fields must be **programmatically** populated from your system (not manual entry). Optional fields may be manual. |
| Requirement | **Webhook cadence** – Real-time (merchant-triggered) or **once per day** if batch. Not less than daily. |
| Requirement | **Webhook prerequisites** – Ensure merchant's menu is ready to be pulled before sending the webhook. |
| Requirement | **Stakeholder enablement** – Public, Partner-hosted help doc (web page or PDF) with end-to-end flow and how to trigger the Store Onboarding Webhook. Must be publicly accessible (no login). Middleware must provide; single-merchant/direct-to-brand may be exempt. |
| Requirement | **Real-time inventory updates** – Support inventory push in real or near-real time so blocked menu validation cases can be fixed and activation can proceed with minimal delay. |
| FYI | **Virtual brands** – If merchants have unique location_id per virtual concept, they can onboard those concepts. If they do **not** have unique location_id per concept, DoorDash will block those virtual concepts (no multiple stores sharing same provider_type/location_id). |

---

## Certification: E2E test store activation

When your Store Onboarding Webhook implementation is dev-complete, coordinate with your TAM to schedule a **live certification** and review of the implementation. This ensures API best practices, no missing pieces, and gives DoorDash context on how onboarding works in your environment.

---

## Terminology (onboarding)

- **POS** – Point of Sale order protocol.
- **Merchant (Mx)** – Restaurant or brand fulfilling orders on DoorDash Marketplace. In SSIO the user should be the business admin for the business on DoorDash (DoorDash Merchant Portal permission set).
- **Partner/Provider (Px)** – Third party that integrates with DoorDash to reach the merchant's POS. The merchant must have an active account on the Provider side.
- **Provider Portal** – The Partner's portal where store status and onboarding are managed. Onboarding happens in the Provider portal, not the DoorDash portal.
