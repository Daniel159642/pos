# POS Intelligent Search & Filter Chips

The POS supports **configurable filter chips** so you can type abbreviations and hit **space** to turn them into filters (size, topping, add-in, etc.). This works for any product type: pizza, drinks, bouquets, cafe orders, etc.

## How it works

1. **Search bar**: Type product name + space-separated abbreviations.
2. **Space = filter**: When you hit space after a word, the system looks up that word in your configured filters. If it matches (e.g. `sm` → Size: Small, `roni` → Topping: Pepperoni), it becomes a **chip** below the search bar and is removed from the search text.
3. **Product search**: Remaining text is used to search products (e.g. "pizza").
4. **Add to cart**: When you click a product, any chips are applied:
   - **Size chips** (with `variant_name`) select that variant (e.g. Small, Slice, 12").
   - **Other chips** (toppings, add-ins) become **notes** on the line item (e.g. "Pepperoni, ½ Peppers").
5. **Quantity prefix**: For toppings like "half peppers", type `1/2` then space, then `pep` then space. The first word becomes a quantity prefix for the next (e.g. "½ Peppers").

## Example

- Type: `pizza sm roni 1/2 pep` (with spaces after each token).
- Chips: **Small**, **Pepperoni**, **½ Peppers**.
- Search: "pizza".
- Click a pizza product → adds "Small [product] — Pepperoni, ½ Peppers" to cart with the Small variant and notes.

## Configuring filters (any product type)

Filters are stored per establishment and can be updated via API so you can tailor them for a **flower shop** (bouquet type, wrap, size), **cafe** (size, milk, temp), **pizza** (size, toppings), etc.

### GET current filters

```http
GET /api/pos-search-filters
```

Returns `{ "success": true, "data": { "filter_groups": [ ... ] } }`.

### POST to update filters

```http
POST /api/pos-search-filters
Content-Type: application/json

{
  "filter_groups": [
    {
      "id": "size",
      "label": "Size",
      "applies_to_categories": ["Pizza", "Drinks"],
      "options": [
        { "abbrevs": ["sm", "s"], "value": "Small", "variant_name": "Small" },
        { "abbrevs": ["lg", "l"], "value": "Large", "variant_name": "Large" }
      ]
    },
    {
      "id": "topping",
      "label": "Topping",
      "applies_to_categories": ["Pizza"],
      "options": [
        { "abbrevs": ["roni"], "value": "Pepperoni" },
        { "abbrevs": ["pep"], "value": "Peppers", "quantity_abbrevs": { "1/2": "½", "half": "½" } }
      ]
    }
  ]
}
```

- **variant_name**: When set, this option is treated as a size/variant and used to pick the product variant. Omit for modifiers (toppings, add-ins) that go into notes.
- **quantity_abbrevs**: Optional. Maps a prefix word (e.g. `1/2`) to a display label (e.g. `½`) for the next option (e.g. "½ Peppers").

## Database

- **order_items.notes**: Stores modifier text (e.g. "Pepperoni, ½ Peppers"). Add the column with `migrations/add_order_items_notes.sql` if not already applied.
- **product_variants**: Sizes/options with prices (see Product Variants doc).
- Filters are stored in **establishment settings** (`pos_search_filters`).

## Seed data (drinks & pizza)

To add sample drinks and pizzas with size variants:

```bash
python3 scripts/seed_drinks_and_pizza.py
```

Requires migrations `add_product_variants_and_ingredients.sql` and `add_order_items_notes.sql` (and `add_order_items_variant_id` if not already applied).
