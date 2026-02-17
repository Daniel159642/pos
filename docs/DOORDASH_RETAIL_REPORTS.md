# DoorDash Reporting API – Report column reference

This document lists **report types** and **column definitions** for **Marketplace (Merchant Pick)** and **Marketplace (Dasher Shop)** reports. Reports are returned as CSV files. For report groups and how to request reports, see [DOORDASH_RETAIL.md](./DOORDASH_RETAIL.md) section 11 (Reporting API).

**Merchant Pick:** Restaurants; merchants with Merchant Pick shopping (e.g. some convenience, hot + prepared, alcohol).  
**Dasher Shop:** Merchants with Dasher Shop shopping (e.g. grocery, retail, some convenience); report types use NV_* naming (e.g. NV_PAYMENTS_V3).

---

# Marketplace Merchant Pick reports

---

## AVOIDABLE_WAIT – Merchant Avoidable Wait

Orders that have merchant avoidable wait.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| order_delivered_date | date | Date when order was delivered | 2022-08-03 0:00:00 | 1 |
| order_delivered_time | varchar | Timestamp of order delivery | 11:54:48 | 1 |
| dd_order_id | varchar | DoorDash Order ID | fae261ba | 1 |
| client_order_id | varchar | Client Order ID | cef4d65b-09cc-427a-a4e4-efb3115c9e3e-doordash | 1 |
| merchant_supplied_id | varchar | Merchant's store identifier | 123-0 | 1 |
| store_name | varchar | Store name | Metro Pizza Main Street | 1 |
| was_asap | varchar | Scheduled vs ASAP (e.g. FALSE = future scheduled) | TRUE | 1 |
| confirmed_food_ready_time | boolean | Estimated time store took to prepare food | 2022-08-03 11:43:20 | 1 |
| dasher_arrival_time | timestamp | Local time when Dasher arrived at store | 2022-08-03 11:42:56 | 1 |
| order_pickup_time | timestamp | Time when Dasher picked up order | 2022-08-03 11:49:27 | 1 |
| minutes_late | timestamp | Time between food ready and pickup | 6 | 1 |
| delivered_at | number | Time when order was delivered | 2022-08-03 11:54:48 | 1 |
| total_delivery_time | timestamp | Order placed to delivered (minutes) | 24 | 1 |
| order_subtotal | number | Order subtotal | 35 | 1 |
| net_payout | number | Order payout | 26 | 1 |
| currency | varchar | Currency for transactions | USD | 1 |
| order_place_date | date | Order place date | 2022-08-03 | 2 |
| order_place_time | time | Order place time | 11:43:20 | 2 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 3 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 3 |

---

## CANCELLED_ORDERS – Canceled Orders

All canceled orders and cancellation reason.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| order_place_date | timestamp | Date when order was placed | 2022-08-02 0:00:00 | 1 |
| order_place_time | timestamp | Time when order was placed | 21:49:56 | 1 |
| store_name | varchar | Internal DoorDash Store Name | Metro Pizza Main Street | 1 |
| order_id | varchar | Unique order ID | ed74e64e | 1 |
| client_order_id | varchar | Client order ID from POS (Merchant-facing) | 69f2ccf2-...-doordash | 1 |
| merchant_supplied_id | varchar | Merchant's store identifier | 123-0 | 1 |
| channel | varchar | Order channel: marketplace, storefront, drive | MARKETPLACE | 1 |
| was_asap | boolean | Scheduled vs ASAP | TRUE | 1 |
| cancelled_at | timestamp | When order was canceled | 2022-08-02 22:12:24 | 1 |
| cancellation_category | varchar | Category of cancellation | Avoidable Store Operations | 1 |
| cancellation_category_desc | varchar | Detailed description | Store closed | 1 |
| is_paid | boolean | Whether order was paid | FALSE | 1 |
| mx_friendly_non_payment_reason | varchar | Reason if unpaid (e.g. Wrong Order Handed to Dasher, Order Not Prepared, Mx Did Not Confirm) | NULL | 1 |
| order_confirmation_time | timestamp | When order was confirmed | 2022-08-02 21:50:04 | 1 |
| minutes_to_confirm | number | Minutes to confirm | 1 | 1 |
| minutes_to_cancel | number | Minutes to cancel | 22.47 | 1 |
| order_subtotal | number | Order subtotal | 40 | 1 |
| net_payout | number | Order payout | 0 | 1 |
| currency | varchar | Currency | USD | 1 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 2 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 2 |

---

## CONSUMER_FEEDBACK – Consumer Feedback

All customer feedback (food_quality, menu_quality, order_quality, public_review).

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| created_at_date_local | timestamp | Feedback date (local time) | 2022-10-30 | 1 |
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| delivery_uuid | varchar | Unique delivery identifier | 1df0588a-711d-4fb6-8899-a49882e8822d | 4 |
| categories_list | varchar | Feedback category (e.g. Bad quality, Good quality, Wide selection) | (many categories) | 1 |
| comments | varchar | Customer feedback text | added no cheese to our salads... | 1 |
| review_type | varchar | food_quality, menu_quality, order_quality, public_review | public_review | 1 |
| freq_tag | varchar | New, Frequent, or Occasional (based on order history) | Occasional | 1 |
| merchant_rating | number | 1–5 | 5 | 2 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 3 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 3 |
| merchant_emoji_rating | string | liked, loved, disliked | loved | 5 |
| merchant_tags | varchar | Tags for emoji rating | Flavorful, Great packaging, ... | 5 |

---

## MENU_ITEM_ERROR – Menu Item Error

Orders with missing or incorrect item and the flagged item.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| timestamp_local_date | timestamp | Transaction date (local) | 2022-08-03 0:00:00 | 1 |
| timestamp_local_time | timestamp | Transaction time (local) | 2022-08-03 14:26:17 | 1 |
| timestamp_utc_date | timestamp | Transaction date (UTC) | 2022-08-03 0:00:00 | 1 |
| timestamp_utc_time | timestamp | Transaction time (UTC) | 2022-08-03 18:26:17 | 1 |
| dd_order_id | varchar | Unique order ID | f3706751 | 1 |
| merchant_order_id | varchar | Client order ID from POS | 800ec4b8-...-doordash | 1 |
| merchant_supplied_id | number | Merchant's store identifier | 123-0 | 1 |
| store_name | varchar | Internal DoorDash Store Name | Metro Pizza Main Street | 1 |
| error_category | varchar | Missing Item or Incorrect Item | ingredient_error | 1 |
| menu_category | varchar | Menu category of item (e.g. Main, Side) | BIGWAY® Series | 1 |
| item_name | varchar | Impacted menu item name | #10 All-American Club® | 1 |
| quantity | number | Quantity of impacted items | 1 | 1 |
| error_charge | number | Total error charge | 170 | 1 |
| customer_comments | varchar | Customer comment on error | NULL | 1 |
| modifier_detail | json | Order item details (extras, options) | {"item_extra_option":[...]} | 1 |
| order_link | varchar | URL of the order | https://www.doordash.com/merchant/... | 1 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 2 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 2 |

---

## MENU_OPEN_HOURS – Menu Open Hours

Menu hours for all stores.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| menu_id | number | DoorDash Menu ID | 12669534 | 1 |
| menu_name | varchar | Menu name | Metro Pizza - [ALL DAY][Metro Pizza 123-0][2.16.2025] | 1 |
| day_of_week | varchar | Day of week | Sun | 1 |
| day_index | number | 0=Mon, 1=Tue, ... | 6 | 1 |
| start_time | timestamp | When menu is available | 9:00:00 AM | 1 |
| end_time | timestamp | When menu ends | 8:00:00 PM | 1 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 2 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 2 |

---

## MENU_SPECIAL_HOURS – Menu Special Hours

Upcoming special hours for all stores.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| menu_id | number | DoorDash Menu ID | 12669534 | 1 |
| menu_name | varchar | Menu name | Metro Pizza - [ALL DAY][Metro Pizza 123-0][2.16.2025] | 1 |
| day | varchar | Date of special hours | Sun | 1 |
| start_time | timestamp | Start time | 9:00:00 AM | 1 |
| end_time | timestamp | End time | 8:00:00 PM | 1 |
| is_closed | boolean | Whether special hours represent closed/available | (varies) | 1 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 2 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 2 |

---

## ORDER_DETAIL – Order Details

All orders with items, modifiers, subtotal, Dashpass; merchant order number when applicable.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| active_date | timestamp | Order submitted date (UTC) | 2022-08-03 0:00:00 | 1 |
| active_date_utc | timestamp | Order submitted date UTC | 2022-08-03 0:00:00 | 1 |
| dd_order_number | number | DoorDash delivery UUID | 1df0588a-711d-4fb6-8899-a49882e8822d | 1 |
| mx_order_number | number | Merchant external order ID (POS); may be null | ab9ebc86-...-doordash | 1 |
| external_order_id | number | Merchant external order ID; may be null | ab9ebc86-df9b-4c2b-a4f4-6570f52886a0 | 1 |
| business_name | varchar | Business name | Metro Pizza | 1 |
| store_name | varchar | Store name | Metro Pizza Main Street | 1 |
| merchant_store_id | number | Merchant's store identifier | 123 | 1 |
| item_merchant_supplied_id | number | Item ID from merchant | 40246 | 1 |
| order_item_id | number | Item ID within order | 3000003058997073 | 1 |
| dd_item_id | number | DoorDash item ID | 2407118091 | 1 |
| item_name | varchar | Item name | Chocolate Chip (210 Cals) | 1 |
| category_name | varchar | Item category | Sides | 1 |
| menu_name | varchar | Menu name | Metro Pizza - [ALL DAY][Metro Pizza 123-0][2.01.2025] | 1 |
| timezone | varchar | Merchant timezone | US/Central | 1 |
| is_consumer_pickup | boolean | Is pickup order | FALSE | 1 |
| dashpass | boolean | Dashpass discount eligible | TRUE | 1 |
| original_item_price | number | Item price | 1 | 1 |
| unit_price | number | Item price | 1 | 1 |
| order_item_quantity | number | Item quantity | 2 | 1 |
| subtotal | number | Cart subtotal | 1 | 1 |
| order_place_date | date | Order place date | 2022-08-03 | 2 |
| order_place_time | varchar | Order place time | 0:00:00 | 2 |
| order_cart_id | number | Order cart ID | 30000097073 | 2 |
| created_at | timestamp | Order created at | 2022-08-03 0:00:00 | 2 |
| updated_at | timestamp | Order updated at | 2022-08-03 1:00:00 | 2 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 3 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 3 |

---

## PAYOUT_SUMMARY – Payout Summary

Summary of payouts completed in the requested time frame. **Report version 2 or earlier** has one column set; **version 3 and later** has an expanded set (e.g. staff_tip, courier_tip, bag_fee, bottle_deposit_fee, customer_discounts_from_marketing_funded_by_you/doordash/third_party, marketing_fees, error_charges, adjustments, snap_ebt_discount, tax_remitted_by_doordash fields, etc.). See DoorDash API Reference for the full v3+ column list.

Key columns (v1): business_id, store_id, transaction_start/end_local_date, transaction_start/end_utc_date, store_name, merchant_store_id, payout_date, currency, subtotal, tax_subtotal, commission, commission_tax, drive_charge, marketing_fee, tips, error_charges, adjustments, total_before_adjustments, net_payout, payout_id, payout_status, tax_remitted_by_doordash_to_state, discounts (v2).

---

## TEMPORARY_DEACTIVATION – Store Temporary Deactivations

Stores currently temporarily deactivated.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| created_at_time | timestamp | When deactivation was created | 8/11/2022 2:30:00 | 1 |
| end_time | timestamp | When deactivation ended | 8/11/2022 8:59:59 | 1 |
| notes | varchar | Notes on reason and how to resolve | Your store has been temporarily deactivated because... | 1 |
| reason | varchar | Reason for deactivation | Multiple Dashers reported your store as closed | 1 |
| scheduled_end_time | timestamp | Scheduled end of deactivation | 8/11/2022 8:59:59 | 1 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 2 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 2 |

---

## STORE_INFORMATION – Store Information

Stores and their integration and merchant-supplied IDs tied to your Reporting API account.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| business_id | number | DoorDash Business ID | 185 | 1 |
| store_id | number | DoorDash Store ID | 24725 | 1 |
| store_name | varchar | Store name | Metro Pizza Main Street | 1 |
| integration_location_id | varchar | Partner integration location ID | 123-0 | 1 |
| merchant_supplied_id | varchar | Merchant's store identifier | 123 | 1 |
| store_address | varchar | Store address | 303 2nd St, San Francisco, CA 94107, USA | 1 |
| store_latitude | varchar | Store latitude | 45.45975 | 1 |
| store_longitude | varchar | Store longitude | -73.31065 | 1 |
| store_status | Boolean | Store available on DoorDash for ordering | TRUE | 1 |
| organization_franchise_id | varchar | Franchise org identifier | 20993520 | 2 |
| organization_franchise_name | varchar | DoorDash Franchise Name | Metro Pizza Franchise | 2 |

---

## TRANSACTION_DETAIL – Transaction Details

Payout and transaction data per order. **Version 3 and prior** and **version 4** have different column sets. Version 4 adds order_cart_id, doordash_transaction_id, Canadian tax columns, customer_delivery_fee, staff_tip, courier_tip, bag_fee, cup_fee, bottle_deposit_fee, commission, marketing/discount columns, credit/debit, tax_remitted columns, preadjusted_subtotal, historical reference columns, consumer_* (California), organization_franchise_* (v5). See DoorDash API Reference for full column lists per version.

Key columns (v1): business_id, store_id, timestamp_local/utc date/time, payout_date/time, store_name, merchant_store_id, transaction_type (DELIVERY, ADJUSTMENT, ERROR_CHARGE, Payout, Store Payment, etc.), transaction_id, doordash_order_id, merchant_delivery_id, external_id, description, final_order_status, currency, subtotal, tax_subtotal, commission, marketing_fee, tips, credit, debit, payout_id, tax_remitted_by_doordash_to_state, and others.

---

## STORE_DOWNTIME – Store Downtime

Daily summary by category of total minutes store was unavailable/temporarily deactivated during open hours.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| date | date | Date | 6/7/25 | 3 |
| store_id | number | DoorDash Store ID | 24725 | 3 |
| store_name | varchar | DoorDash Store | Metro Pizza Main Street | 3 |
| merchant_supplied_id | varchar | Merchant's store identifier | 123-0 | 3 |
| downtime_category | varchar | Downtime category code | Store Issue | 3 |
| downtime_category_description | varchar | Category description | Auto Pause - High Avoidable and/or POS Cancellation Rate | 3 |
| downtime_minutes | varchar | Total minutes of downtime for the day by category | 11:54:48 | 3 |

---

# Marketplace Dasher Shop reports

**Report group:** Merchants with Dasher Shop shopping (e.g. grocery, retail, some convenience). Report types use **NV_*** naming and V3 (or legacy) versions. Legacy report versions are documented separately in DoorDash’s API Reference.

---

## NV_PAYMENTS_V3 – Payout Summary (Dasher Shop)

Order-level details for all **direct deposit** payouts completed in the requested timeframe (store local time).

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| payout_date_utc | date | UTC date when payout was initiated (MM/DD/YYYY) | 07/03/2025 | 1 |
| payout_time_local | timestamp (ISO8601) | Local timestamp when payout was sent | 2025-07-03T01:12:13-05:00 | 1 |
| transaction_date_utc | date | UTC date (delivery or adjustment date) | 06/28/2025 | 1 |
| transaction_date_local | date | Local date (delivery or adjustment date) | 06/28/2025 | 1 |
| transaction_time_utc | timestamp (ISO8601 Z) | UTC transaction time | 2025-06-28T01:12:13Z | 1 |
| transaction_time_local | timestamp (ISO8601) | Local transaction time | 2025-06-27T19:12:13-05:00 | 1 |
| business_id | integer | DoorDash business ID | 11003456 | 1 |
| business_name | string | DoorDash business name | Markets USA | 1 |
| merchant_store_id | string | Merchant-supplied store ID | 301 | 1 |
| doordash_store_id | integer | DoorDash store ID | 33245635 | 1 |
| store_name | string | DoorDash store name | The Market (South Ave) | 1 |
| timezone | string | Store timezone (IANA) | US/Pacific, US/Eastern, US/Central | 1 |
| delivery_uuid | UUID | Unique DoorDash delivery identifier | UUID-string | 1 |
| client_order_id | string | DoorDash internal POS order ID | cef4d65b-...-doordash | 1 |
| external_order_uuid | UUID | Merchant external order ID (if POS) | UUID-string | 1 |
| transaction_type | string | DELIVERY, SWIPE, ADJUSTMENT | DELIVERY / SWIPE / ADJUSTMENT | 1 |
| transaction_notes | string | Notes or adjustment reason | Issue: 1 Advil... missing | 1 |
| shopping_protocol | string | MERCHANT_PICK or DASHER_PICK | DASHER_PICK / MERCHANT_PICK | 1 |
| is_dashpass | boolean | DashPass discount on order | TRUE / FALSE | 1 |
| is_consumer_pickup | boolean | Customer pickup order | TRUE / FALSE | 1 |
| currency_code | string | ISO 4217 (USD, CAD, AUD) | USD / CAD / AUD | 1 |
| order_marketing_fee_amount | decimal | Marketing fee (local currency) | 0.55 | 1 |
| dashpass_marketing_fee_amount | decimal | DashPass marketing fee | 2.05 | 1 |
| order_tip_amount | decimal | Tip to merchant (pickup) | 2.50 | 1 |
| platform_subtotal_amount | decimal | Subtotal on DoorDash platform | 20.29 | 1 |
| platform_tax_amount | decimal | Tax on platform | 3.19 | 1 |
| order_snap_ebt_amount | decimal | SNAP EBT amount (local currency) | 10.51 | 1 |
| store_charge_amount | decimal | Amount charged at physical store | 19.29 | 1 |
| store_refund_amount | decimal | Amount refunded at store | 2.01 | 1 |
| commission_rate | decimal | Commission % (e.g. 5.5 = 5.5%) | 5.50 | 1 |
| total_order_commission_amount | decimal | Commission deducted | 0.27 | 1 |
| total_commission_tax_amount | decimal | Tax on commission | 0.15 | 1 |
| tax_remitted_by_dd_amount | decimal | Tax DoorDash remits (MPF states) | 3.19 | 1 |
| total_payout_amount | decimal | Net paid to merchant | 25.29 | 1 |
| payout_transfer_id | integer | Bank transfer ID | 128950624 | 1 |

---

## NV_TRANSACTIONS_V3 – Transaction Details (Dasher Shop)

Order-level details for **red card / in-store card** transactions in the requested timeframe (store local time).

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| transaction_date_utc | date | Red card swipe date (UTC) MM/DD/YYYY | 12/24/2025 | 1 |
| transaction_date_local | date | Red card swipe date (local) | 12/24/2025 | 1 |
| actual_delivery_date_utc | date | Delivery date (UTC) | 12/25/2025 | 1 |
| transaction_time_utc | ISO8601 | Red card swipe time (UTC) | 2025-12-25 1:12:13 | 1 |
| transaction_time_local | ISO8601 | Red card swipe time (local) | 2024-12-24 20:12:23 | 1 |
| actual_delivery_time_utc | ISO8601 | Delivery time (UTC) | 2025-12-25 1:30:13 | 1 |
| actual_delivery_time_local | ISO8601 | Delivery time (local) | 2024-12-24 20:30:23 | 1 |
| order_received_time_local | ISO8601 | Order received at store (local) | 2024-12-24 19:50:55 | 1 |
| store_confirmed_time_local | ISO8601 | Store confirmed order (local) | 2024-12-24 19:45:55 | 1 |
| order_scheduled_time_local | ISO8601 | Quoted delivery time (local) | 2024-12-24 19:45:55 | 1 |
| dasher_arrived_at_store_time_local | ISO8601 | Dasher arrived at store (local) | 2024-12-24 19:48:55 | 1 |
| pickup_time_local | ISO8601 | Dasher marked picked up (local) | 2024-12-24 19:46:00 | 1 |
| timezone | string | Store timezone | US/Pacific \| US/Eastern \| US/Central | 1 |
| business_id | integer | DoorDash business ID | 11003456 | 1 |
| business_name | string | DoorDash business name | Markets USA | 1 |
| merchant_store_id | string | Merchant store ID | 301 | 1 |
| doordash_store_id | integer | DoorDash store ID | 33245635 | 1 |
| store_name | string | DoorDash store name | The Market (South Ave) | 1 |
| store_street_address | string | Store street address | 123 South Avenue | 1 |
| delivery_zip_code | string | Customer delivery zip | 10011 | 1 |
| delivery_uuid | UUID | Unique delivery ID | UUID-String | 1 |
| delivery_created_time_local | ISO8601 | Consumer created order (local) | 2024-12-24 19:50:30 | 2 |
| external_order_uuid | UUID | Merchant external order ID (POS); null for Dasher Pick | UUID-String | 1 |
| order_cart_id | integer | Cart ID for Fiserv reconciliation | 30000100000000 | 1 |
| receipt_barcode | string | Receipt barcode (Dasher Pick) | 4422120222030040091990800 | 1 |
| hashed_consumer_id | string | Hashed DoorDash consumer ID | sdfasfa1341-asfax | 1 |
| is_dashpass | boolean | DashPass on order | TRUE / FALSE | 1 |
| is_consumer_pickup | boolean | Customer pickup | TRUE / FALSE | 1 |
| is_drive_delivery | boolean | Drive delivery | TRUE / FALSE | 1 |
| is_doubledash | boolean | DoubleDash delivery | TRUE / FALSE | 1 |
| is_scheduled_order | boolean | Scheduled in advance | TRUE / FALSE | 1 |
| is_contains_alcohol | boolean | Order contained alcohol | TRUE / FALSE | 1 |
| is_cancelled | boolean | Order cancelled | TRUE / FALSE | 1 |
| cancelled_at_time_local | ISO8601 | Local cancel time | 2024-12-24 19:46:00 | 1 |
| cancellation_category | string | Cancellation reason category | order_taking_too_long | 1 |
| final_order_status | string | Delivered / Cancelled | Delivered / Cancelled | 1 |
| is_order_invoiceable | boolean | Can be invoiced in monthly invoice | TRUE / FALSE | 1 |
| submit_platform | string | Customer platform | iOS / Android / desktop / mobile web | 1 |
| shopping_protocol | string | DASHER_PICK / MERCHANT_PICK | DASHER_PICK / MERCHANT_PICK | 1 |
| payment_protocol | string | dasher_red_card / direct_deposit | dasher_red_card / direct_deposit | 1 |
| currency_code | string | ISO 4217; amounts in local currency, 2 decimals | USD / CAD / AUS | 1 |
| bag_fee_amount | decimal | Bag fee | 0.75 | 1 |
| bag_fee_tax_amount | decimal | Bag fee tax | 0.12 | 1 |
| bottle_deposit_fee_amount | decimal | Bottle deposit fee | 0.51 | 1 |
| bottle_deposit_fee_tax_amount | decimal | Bottle deposit tax | 0.09 | 1 |
| cup_fee_amount | decimal | Cup fee | 0.35 | 1 |
| cup_fee_tax_amount | decimal | Cup fee tax | 0.05 | 1 |
| eco_fee_amount | decimal | Eco fee (null until Q4 2025) | 0.11 | 1 |
| eco_fee_tax_amount | decimal | Eco fee tax | 0.01 | 1 |
| state_province_tax_amount | decimal | Provincial tax (Canada) | 4.03 | 1 |
| card_pos_total_amount | decimal | Total swiped in-store including tax | 151.12 | 1 |
| order_snap_ebt_amount | decimal | SNAP EBT total | 51.12 | 1 |
| order_return_snap_ebt_amount | decimal | SNAP EBT refund if returned | 12.52 | 1 |
| card_merchant_name | string | Merchant name from red card processor | MARKET #1234 | 1 |
| card_fulfillment_store_id | integer | Store ID from POS/Red Card | 1234 | 1 |
| card_approval_code | string | 5–6 digit auth code on receipt | A93795 | 1 |
| card_system_trace_audit_number | string | Marqeta/Stripe trace code | AB3456 | 2 |
| card_network_reference_id | string | Red card processor transaction ID | MPWSKT30B0621 | 1 |
| card_allowance_uuid | UUID | Allowance UUID for red card transaction | string-UUID | 1 |
| card_first_six | integer | First 6 digits of card BIN | 447478 | 1 |
| card_last_four | integer | Last 4 digits of card | 5720 | 1 |
| card_transaction_status | string | settled / reversed transaction / declined | settled / reversed / declined | 1 |

---

## NV_ORDER_ITEMS_V3 – Order Item (Dasher Shop)

Item-level details: fulfillment status, financial data, Dasher operation data (store local time).

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| transaction_date_utc | date | Red card swipe date (UTC) | 12/24/2025 | 1 |
| transaction_date_local | date | Red card swipe date (local) | 12/24/2025 | 1 |
| actual_delivery_date_utc | date | Delivery date (UTC) | 12/25/2025 | 1 |
| transaction_time_utc | ISO8601 | Red card swipe time (UTC) | 2025-12-25 1:12:13 | 1 |
| transaction_time_local | ISO8601 | Red card swipe time (local) | 2025-12-25 1:12:13 | 1 |
| actual_delivery_time_utc | ISO8601 | Delivery time (UTC) | 2025-12-25 1:30:13 | 1 |
| timezone | string | Store timezone | US/Pacific \| US/Eastern \| US/Central | 1 |
| business_id | integer | DoorDash business ID | 11003456 | 1 |
| business_name | string | DoorDash business name | Markets USA | 1 |
| merchant_store_id | integer | Merchant store ID | 301 | 1 |
| doordash_store_id | integer | DoorDash store ID | 33245635 | 1 |
| store_name | string | DoorDash store name | The Market (South Ave) | 1 |
| shopping_protocol | string | DASHER_PICK / MERCHANT_PICK | DASHER_PICK / MERCHANT_PICK | 1 |
| dasher_id | integer | Dasher who fulfilled order | 1307479 | 1 |
| delivery_uuid | UUID | Delivery identifier | UUID-string | 1 |
| delivery_created_time_local | ISO8601 | Order created (local) | 2024-12-24 19:50:30 | 2 |
| is_doubledash | boolean | Item part of DoubleDash | TRUE / FALSE | 1 |
| is_missing_incorrect | boolean | Marked missing/incorrect by customer/support | TRUE / FALSE | 1 |
| is_cancelled | boolean | Whole delivery cancelled | TRUE / FALSE | 1 |
| cancelled_at_time_local | ISO8601 | Cancel time (local) | 2024-12-24 19:46:00 | 1 |
| cancellation_category | string | Cancellation category | order_taking_too_long | 1 |
| is_item_delivered | boolean | Item successfully delivered | TRUE / FALSE | 1 |
| was_delivery_returned | boolean | Delivery returned (same day) | TRUE / FALSE | 1 |
| was_item_returned | boolean | Item returned (same day) | TRUE / FALSE | 1 |
| shop_start_time_local | ISO8601 | Dasher start shopping (local) | 2025-12-25 13:20:55 | 1 |
| item_pick_start_time_local | ISO8601 | Dasher start picking this item (local) | 2025-12-25 14:20:55 | 1 |
| item_pick_end_time_local | ISO8601 | Dasher end picking this item (local) | 2025-12-25 14:22:55 | 1 |
| item_pick_duration_seconds | integer | Seconds to pick this item | 120 | 1 |
| not_found_at_local | ISO8601 | Item marked not found (local) | 2025-12-25 14:01:55 | 1 |
| picked_at_local | ISO8601 | Item marked picked (local) | 2025-12-25 14:01:55 | 1 |
| shop_end_time_local | ISO8601 | Dasher finish shopping (local) | 2025-12-25 15:20:55 | 1 |
| item_name | string | Item name | Advil Ibuprofen Coated Tablets 200 mg (24 ct) | 1 |
| item_id | integer | DoorDash item ID | 6778833695 | 1 |
| item_merchant_supplied_id | string | Merchant item ID | 302898-0-1 | 1 |
| item_uuid | UUID | Item UUID in order | UUID-string | 1 |
| catalog_upc_id | string | UPC from DoorDash catalog | ["028029196443",...] | 1 |
| scanned_upc_id | string | UPC scanned by Dasher (can be null) | 28029196443 | 1 |
| brand | string | Item brand | Advil | 1 |
| category | string | DoorDash product category | Medicine | 1 |
| aisle_name_l1 | string | Primary in-store classification | Snacks | 1 |
| aisle_name_l2 | string | Secondary in-store classification | Chips | 1 |
| is_alcohol | boolean | Alcoholic product | TRUE / FALSE | 1 |
| is_snap_eligible | boolean | SNAP EBT eligible | TRUE / FALSE | 1 |
| is_weighted_item | boolean | Sold by weight | TRUE / FALSE | 1 |
| measurement_unit | string | Unit (each, lb, kg, oz) | each / lb / kg / oz | 1 |
| quantity_requested | decimal | Units requested by customer | 2.5 | 1 |
| quantity_delivered | decimal | Units delivered | 2 | 1 |
| weighted_quantity_delivered | decimal | Delivered quantity by weight | 1.23 | 1 |
| currency_code | string | ISO 4217; amounts local, 2 decimals | USD / CAD / AUS | 1 |
| inventory_item_price_amount | decimal | Unit price from merchant inventory | 1.21 | 1 |
| platform_item_price_amount | decimal | Unit price on DoorDash | 1.31 | 1 |
| total_item_inventory_amount | decimal | inventory price × quantity_delivered | 2.42 | 1 |
| total_item_platform_amount | decimal | Platform total with quantity | 2.62 | 1 |
| item_tax_rate | decimal | Tax rate for item | 5 | 1 |
| item_tax_amount | decimal | Tax on item | 0.13 | 1 |
| unadjusted_item_tax_rate | decimal | Tax rate if no EBT | 6.5 | 1 |
| unadjusted_item_tax_amount | decimal | Tax without EBT | 0.15 | 1 |
| item_credit_card_amount | decimal | Amount paid by credit card | 2.01 | 1 |
| item_snap_ebt_amount | decimal | SNAP EBT amount | 0.51 | 1 |
| item_snap_return_amount | decimal | SNAP refund if returned | 0.25 | 1 |
| was_requested | boolean | Original order item (not sub) | TRUE / FALSE | 1 |
| was_found | boolean | Dasher found in store | TRUE / FALSE | 1 |
| was_missing | boolean | Missing from store | TRUE / FALSE | 1 |
| was_subbed | boolean | Substituted | TRUE / FALSE | 1 |
| was_refunded | boolean | Refunded | TRUE / FALSE | 1 |
| is_substitute_item | boolean | This row is the substitute | TRUE / FALSE | 1 |
| requested_item_id | integer | Original requested item ID (if substitute) | 7236397626 | 1 |
| requested_item_name | string | Original requested item name | Advil Ibuprofen... 100 mg (24 ct) | 1 |
| requested_item_merchant_supplied_id | string | Merchant ID for requested item | 302898-0-1 | 1 |
| substituted_item_merchant_supplied_id | string | Merchant ID for substituted item | 19200780339 | 1 |
| substitution_preference | string | refund / no_preference_selected / chooose_sub / contact_me | (varies) | 1 |
| substitution_rating | string | 0 = bad, 1 = good | 0 / 1 | 1 |
| substitution_rating_time_utc | ISO8601 | When customer gave sub feedback (UTC) | 2025-12-25 13:20:55 | 1 |
| substitution_rating_tag | string | Tags for substitution rating | ["SUBS_RATING_TAG_OTHER"] | 1 |
| consumer_comment | string | Customer free-text on item | "standard substitution comment" | 1 |

---

## NV_OPERATIONS_CONSUMER_FEEDBACK – Operations and Consumer Feedback

Operational metrics (shop time, missing & incorrect, SNAP, etc.) and all customer feedback (item/store reviews).

| Column | Data type | Definition | Example |
|--------|-----------|------------|---------|
| active_date | date | Delivery completed time (local) | 02/28/2021 |
| created_at | timestamp | Delivery created (UTC) | 10/19/2024 23:35:36 |
| delivery_uuid | string | DoorDash delivery UUID | UUID-string |
| store_id | integer | DoorDash Store ID | 345 |
| store_name | string | DoorDash store name | 301 |
| business_id | integer | DoorDash Business ID | UUID-string |
| external_order_reference | string | Merchant order ID (if provided) | The Market |
| pos_delivery_id | integer | POS order ID (if POS integration) | 5486816 |
| d2r_minutes | integer | Dasher accept → reach merchant geo fence (min) | 1 |
| r2c_minutes | integer | Picked up → delivered (min) | 1 |
| shop_time | integer | Dasher pick & shop time (min) | 1 |
| is_asap | integer | 1 = ASAP, 0 = scheduled | 1 \| 0 |
| lateness_mins | integer | Minutes late (negative = early) | 11 |
| is_store_eligible_for_snapebt | boolean | Store eligible for SNAP/EBT | TRUE |
| snap_ebt_amount | integer | SNAP EBT amount (cents) | 20.29 |
| cx_platform | string | Customer OS: iOS, Android, Web | ios |
| cancellation_category | string | Cancellation category (if cancelled) | 1 \| 0 |
| fulfillment_item_count | integer | Items fulfilled | 1 |
| is_all_filled | boolean | All requested items fulfilled | TRUE |
| is_missing_incorrect | boolean | Any missing/incorrect items | TRUE |
| not_found_before_subs_item_coun | integer | Original items missing before subs | 2 |
| is_poor_food_quality | boolean | Poor food quality (customer) | TRUE |
| merchant_rating | integer | Customer merchant rating | 5 |
| merchant_comments | string | Customer comments on merchant | comments |

---

# Marketplace Dasher Shop reports (Legacy)

Legacy report types **NV_PAYMENTS**, **NV_TRANSACTIONS**, and **NV_ORDER_ITEMS** (no _V3 suffix). Use the V3 versions (above) for new integrations when available. Column sets differ from V3; key columns are summarized below.

---

## NV_PAYMENTS (Legacy) – Payout Summary

Order-level details for payouts completed in the requested timeframe.

| Column | Data type | Definition | Example |
|--------|-----------|------------|---------|
| transaction_date_utc | string | Charge date UTC (MM/DD/YYYY) | 02/28/2021 |
| transaction_date_local | string | Charge date store timezone (MM/DD/YYYY) | 02/29/2021 |
| transaction_timestamp_utc | timestamp | Charge time UTC (YYYY-MM-DD HH24:MI:SS) | 02/28/2021 |
| transaction_timestamp_local | timestamp | Charge time store timezone | 02/28/2021 |
| timezone | string | Store timezone | US/Pacific |
| merchant_store_id | integer | Merchant store identifier | 301 |
| store_name | string | Store name | The Market |
| business_name | string | Business name | Market USA |
| delivery_uuid | string | DoorDash delivery UUID | UUID-string |
| client_order_id | integer | Client order ID in POS | 5486816 |
| external_id | string | Merchant (external) POS order ID (when relevant) | UUID-string |
| shopping_protocol | string | From MDS store table | shopperdasher merchant |
| dashpass | integer | DashPass on order | 1 \| 0 |
| is_consumer_pickup | integer | Pickup order | 1 \| 0 |
| order_received_time_local | timestamp | Order place time store timezone | 03/11/2021 |
| order_status | string | Order status | delivered |
| transaction_type | ENUM | DELIVERY \| ADJUSTMENT | DELIVERY \| ADJUSTMENT |
| currency | string | Cart currency ISO 4217 | USD |
| order_subtotal_dollar | decimal | Cart subtotal | 20.29 |
| order_tax_amount_dollar | decimal | Total tax paid by consumer | 3.19 |
| commission_rate | decimal | Commission rate | 0.05 |
| order_commission_dollar | decimal | DoorDash commission | 2.23 |
| commission_tax_dollar | decimal | Commission tax | 0.01 |
| order_marketing_fee_dollar | decimal | Marketing commission | 0 |
| dashpass_marketing_fee_dollar | decimal | DashPass flat fee | 2 |
| tax_remitted_by_dd_dollar | decimal | Tax DoorDash remits (merchant of record states) | 0.19 |
| order_merchant_tip_amount_dollar | decimal | Merchant tip (pickup) | 3.71 |
| store_charge_dollar | decimal | Amount charged to merchant | -2.19 |
| store_refund_dollar | decimal | Amount refunded to merchant | 1.1 |
| payout_amount_dollar | decimal | Amount paid in transfer | 25.19 |
| transaction_notes | string | Error charges / adjustments description | Issue: 1 Advil... missing |
| payout_transfer_id | integer | DoorDash bank transfer ID | 128950624 |
| payout_timestamp | timestamp | Charge sent (ISO 8601 with timezone) | 03/11/2021 |

---

## NV_TRANSACTIONS (Legacy) – Transaction Details

Red card transaction details for financial reconciliation.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| transaction_date_utc | date | Charge date UTC (MM/DD/YYYY) | 02/28/2021 | 1 |
| transaction_date_local | date | Charge date store timezone | 02/29/2021 | 1 |
| transaction_timestamp_utc | timestamp | Charge time UTC | 2021-02-28 17:41:12 | 1 |
| transaction_timestamp_local | timestamp | Charge time store timezone | 2021-02-28 12:41:12 | 1 |
| timezone | string | Store timezone | US/Pacific | 1 |
| amount_captured | decimal | In-store transaction amount (no markup) | 5.19 | 1 |
| currency | string | ISO 4217 | USD | 1 |
| merchant_store_id | string | Merchant store identifier | 301 | 1 |
| store_name | string | Store name | The Market | 1 |
| business_id | integer | Business ID | 11003456 | 1 |
| business_name | string | Business name | Markets USA | 1 |
| delivery_uuid | string | DoorDash delivery UUID | UUID-string | 1 |
| external_id | string | Merchant external order ID (POS); null for Dasher Shop | UUID-string | 1 |
| shopping_protocol | string | shopper \| dasher merchant | shopper \| dasher merchant | 1 |
| is_consumer_pickup | boolean | Pickup order | TRUE \| FALSE | 1 |
| approval_code | string | 5–6 digit authorization ID (on receipt) | 93795 | 1 |
| allowance_id | string | Allowance ID (Marqeta) | UUID-string | 1 |
| network_reference_id | string | Network transaction ID (Marqeta) | (varies) | 1 |
| acting_card_first_six | integer | DoorDash BIN (e.g. 539186) | 539186 | 1 |
| acting_card_last_four | integer | Last 4 of red card PAN | 9887 | 1 |
| marqeta_merchant_name | string | Merchant name from payment network | MARKET #1234 | 1 |
| marqeta_store_id | string | Store ID from Marqeta | 1234 | 1 |
| is_settled | boolean | Marqeta transaction settled | TRUE | 1 |
| order_marketing_fee_dollar | decimal | Marketing fee | (varies) | 1 |
| crc_barcode | string | CRC barcode | (varies) | 1 |
| dashpass | boolean | Subscription discount applied | TRUE | 1 |
| store_refund_dollar | decimal | Refund amount | 5.12 | 1 |
| store_charge_dollar | decimal | Charge amount | 6.12 | 1 |
| client_order_id | string | Client order ID | UUID-string | 1 |
| store_street_address | string | Store street address | 123 South Avenue | 1 |
| is_scheduled_order | boolean | Scheduled for delivery | TRUE \| FALSE | 1 |
| order_received_time_local | timestamp | Order place time (local) | 2021-02-28 17:41:12 | 1 |
| order_scheduled_time_local | timestamp | Scheduled time | 2021-01-22 17:44:47 | 1 |
| store_confirmed_time_local | timestamp | Store confirmed time | 2021-01-22 17:44:47 | 1 |
| dasher_arrived_at_store_time_local | timestamp | Dasher arrived at store | 2021-04-20 17:08:05 | 1 |
| pickup_time_local | timestamp | Dasher started pickup | 2021-04-20 17:08:05 | 1 |
| payment_protocol | string | Payment protocol (e.g. red card) | (varies) | 1 |
| bag_fee | decimal | Bag fee total | 0.12 | 1 |
| bag_fee_tax_amount | decimal | Bag fee tax | 0.01 | 1 |
| is_doubledash | boolean | DoubleDash delivery | TRUE | 1 |
| bottle_deposit_fee | integer | Bottle deposit fee | 12 | 1 |
| receipt_barcode | string | Receipt barcode | xdda | 1 |
| submit_platform | string | Customer platform (iOS, desktop, Android, mobile web) | android | 1 |
| hashed_consumer_id | string | Hashed consumer ID | sdfasfa1341-asfax | 2 |
| total_snap_ebt_amount | decimal | SNAP EBT amount | 0 | 3 |
| total_return_snap_ebt_amount | decimal | SNAP refund on return | 0 | 3 |
| order_cart_id | integer | Cart ID for Fiserv reconciliation | 12345678899383738 | 3 |
| cup_fee_amount | decimal | Cup fee | 0 | 3 |
| cup_fee_tax_amount | decimal | Cup fee tax | 0 | 3 |
| bottle_deposit_fee_tax_amount | decimal | Bottle deposit tax | 0 | 3 |
| state_province_tax_amount | decimal | State/province tax | 0 | 3 |
| cancellation_category | string | Cancellation reason category | order_taking_too_long | 4 |
| active_date_local | date | Delivery completed date (local) MM/DD/YYYY | 12/24/2025 | 4 |
| actual_delivery_time_local | date | Delivery date/time (local) | 2024-12-24 19:50:55 | 4 |

---

## NV_ORDER_ITEMS (Legacy) – Order Item

Item-level details: picked, not found, substituted items.

| Column | Data type | Definition | Example | Since |
|--------|-----------|------------|---------|-------|
| delivery_uuid | string | Delivery UUID | 8be22d51-b630-4053-872f-9455fd8beba7 | 1 |
| delivery_created_at | timestamp | Delivery created date/time | 01/23/2023 | 1 |
| store_id | integer | Store ID | 984803 | 1 |
| store_name | string | Store name | The Market | 1 |
| merchant_store_id | string | Merchant store identifier | 10/27/1900 | 1 |
| business_id | integer | Business ID | 412816 | 1 |
| business_name | string | Business name | Markets USA | 1 |
| shopping_protocol | string | DASHER_PICK \| MERCHANT_PICK | DASHER_PICK \| MERCHANT_PICK | 1 |
| dasher_id | integer | Dasher ID | 1307479 | 1 |
| item_id | integer | Item ID | 6778833695 | 1 |
| item_merchant_supplied_id | string | Merchant item ID | 302898-0-1 | 1 |
| item_name | string | Item name | Advil Ibuprofen Coated Tablets 200 mg (24 ct) | 1 |
| substitution_preference | string | Substitution preference | substitute | 1 |
| was_requested | integer | Item in original order | 1 \| 0 | 1 |
| was_found | integer | Found in store | 1 \| 1 | 1 |
| was_missing | integer | Missing from store | 1 \| 2 | 1 |
| was_subbed | integer | Substituted | 1 \| 3 | 1 |
| was_refunded | integer | Refunded | 1 \| 4 | 1 |
| sub | integer | Is substitute item | 1 \| 5 | 1 |
| requested_item_id | integer | Requested item ID | 7236397626 | 1 |
| requested_item_merchant_supplied_id | string | Requested item merchant ID | 19200780339 | 1 |
| requested_item_name | string | Requested item name | Advil Ibuprofen... 100 mg (24 ct) | 1 |
| picked_at | timestamp | When item picked | 01/23/2023 | 1 |
| not_found_at | timestamp | When marked not found | 01/23/2023 | 1 |
| shop_start_time | timestamp | Dasher start shopping | 01/23/2023 | 1 |
| shop_end_time | timestamp | Dasher end shopping | 01/23/2023 | 1 |
| is_alcohol | boolean | Alcohol product | TRUE | 1 |
| quantity | integer | Quantity delivered | 12 | 1 |
| weighted_quantity | decimal | Total weight delivered | (varies) | 1 |
| quantity_requested | integer | Quantity requested | 11 | 1 |
| upc_id | string | UPC ID | 07/08/3415 | 1 |
| measurement_unit | string | Unit (e.g. each) | each | 1 |
| is_weighted_item | integer | Sold by weight | TRUE | 1 |
| item_price | integer | Unit price (cents) | 549 | 1 |
| item_price_dollar | decimal | Unit price (dollar) | (varies) | 1 |
| total_item_price_dollar | decimal | Total price (dollar) | (varies) | 1 |
| item_tax_amount_dollar | decimal | Item tax (dollar) | (varies) | 1 |
| is_delivered | boolean | Item delivered (not removed) | TRUE | 1 |
| delivery_zip_code | string | Delivery zip | 02/09/2022 | 1 |
| substituted_for_item_merchant_supplied_id | string | Substituted item merchant ID | 12/16/48887 | 1 |
| delivery_created_date_utc | date | Delivery created (UTC) | 01/23/2023 | 1 |
| delivery_created_timestamp_utc | timestamp | Delivery created timestamp (UTC) | 01/23/2023 | 1 |
| store_transaction_date_utc | date | Store transaction date (UTC) | 01/23/2023 | 1 |
| store_transaction_timestamp_utc | timestamp | Store transaction time (UTC) | 01/23/2023 | 1 |
| item_price_no_markup_dollar | decimal | Item price without markup | (varies) | 1 |
| aisle_name_l1 | string | Aisle category 1 | Snacks | 1 |
| aisle_name_l2 | string | Aisle category 2 | Chips | 1 |
| brand | string | Brand | Advil | 1 |
| total_item_price | integer | Total price (cents) | 2780 | 1 |
| tax_rate | integer | Tax rate | 7 | 1 |
| tax_amount | integer | Tax (cents) | 202 | 1 |
| category | string | Category | Medicine | 1 |
| delivery_fraud_rule_ind | integer | Fraud rule fired | 0 | 1 |
| delivery_cr_category | string | CR category when fraud rule fired | no_cr_issued | 1 |
| sub_rating | integer | Substitution rating 0/1 | 1 | 1 |
| sub_rating_timestamp | timestamp | Sub rating time | 03/25/2023 | 1 |
| tags_selected | variant | Tags for sub rating | ["SUBS_RATING_TAG_OTHER"] | 1 |
| comment | variant | Comment on sub rating | standard substitution comment | 1 |
| item_uuid | string | Item UUID | 9526bda5-d722-4904-b5b3-af072d771c40 | 1 |
| item_pick_start_time | timestamp | Item pick start | 01/04/2022 | 1 |
| item_pick_end_time | timestamp | Item pick end | 01/04/2022 | 1 |
| item_pick_duration_seconds | integer | Pick duration (seconds) | 356 | 1 |
| cancelled_at | timestamp | Cancel time (UTC) | 09/05/2021 | 1 |
| is_missing_incorrect | boolean | M&I by customer/support | FALSE | 1 |
| is_from_store_to_us | boolean | Drive delivery | FALSE | 1 |
| is_cancelled | boolean | Delivery cancelled | FALSE | 1 |
| is_snap_eligible | boolean | SNAP EBT eligible | FALSE | 1 |
| snap_ebt_amount | integer | SNAP EBT amount | 0 | 1 |
| credit_card_amount | integer | Credit card amount | 499 | 1 |
| etl_load_at | timestamp | ETL insert time | 04/17/2023 | 1 |
| item_price_local | integer | Unit price local currency | 499 | 1 |
| total_item_price_local | integer | Total price local currency | 499 | 1 |
| is_doubledash | boolean | DoubleDash | TRUE | 1 |
| item_price_no_markup_total_dollar | decimal | Item total no markup (dollar) | 4.99 | 1 |
| item_was_returned | boolean | Item returned | TRUE | 2 |
| return_delivery_uuid | string | Return delivery UUID | 8be22d51-... | 2 |
| return_timestamp_utc | timestamp | Return time UTC | 2021-04-20 17:08:05 | 2 |
| return_timestamp_local | timestamp | Return time local | 2021-04-20 17:08:05 | 2 |
| delivery_was_returned | boolean | All items returned | FALSE | 2 |
| snap_return_amount | decimal | SNAP refund on item return | 0 | 3 |
| unadj_item_tax_rate | decimal | Tax rate without EBT | 1.6 | 3 |
| unadj_item_tax_amount_dollar | decimal | Tax if non-EBT | 0.09 | 3 |
| order_cart_id | integer | Cart ID for Fiserv | 12345678899383738 | 3 |
| item_price_local_dollar | decimal | Unit price local (dollar) | 10.01 | 4 |
| total_item_price_local_dollar | decimal | Total price local (dollar) | 20.02 | 4 |
| tax_amount_local | decimal | Tax local currency | 5.01 | 4 |
| item_tax_amount_local_dollar | decimal | Item tax local (dollar) | 10.02 | 4 |

---

For **Merchant Pick** report version–specific column sets (e.g. PAYOUT_SUMMARY v3, TRANSACTION_DETAIL v4), see the DoorDash Reporting API Reference and Available Reports guide.
