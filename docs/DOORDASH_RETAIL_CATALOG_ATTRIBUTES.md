# DoorDash Retail: Catalog Management API – Supported Product Attributes

This document lists **supported product attributes** for the Catalog Management API (Item Management). Examples are not a complete list; if you have values or fields not captured here, share them via **product_attributes** in your payload.

Reference: [DOORDASH_RETAIL.md](./DOORDASH_RETAIL.md) (Catalog payload overview).

---

## Alcohol Properties

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| alcohol_vintage | number | Year the wine was produced | 2018, 2019, 2020 |
| alcohol_body | string | How the beverage feels (weight, texture, richness); Wine/Spirits | ALCOHOL_BODY_LIGHT_BODIED, ALCOHOL_BODY_MEDIUM_BODIED, ALCOHOL_BODY_FULL_BODIED |
| alcohol_by_volume | number | ABV % (e.g. 18% ABV = 36 Proof for spirits) | 5, 7, 13, 20 |
| alcohol_dry_sweetness_level | string | Residual sugar level (wine) | EXTRA DRY, DRY, OFF-DRY, SEMI-SWEET, SWEET, VERY SWEET |
| alcohol_style | string | Characteristics within category | Tannic, Soft, Mineral |
| alcohol_beer_segment | string | Beer segment | Lager, IPA, Stout, Pilsner |
| alcohol_food_pairing | string | Food that pairs well | BEEF, POULTRY, FISH, SHELLFISH, SOFT CHEESE, PORK, DESSERTS, LAMB, SEAFOOD, CHIPS, PASTA, VEGETABLES |
| alcohol_color | string | Wine color | Red, White, Orange, Rose |
| alcohol_age | string | Age statement | 10 Year, 15 Year, Reposado, VSOP |
| alcohol_edition | string | Special edition / limited run | Christmas, 100th Anniversary, Batch No. 24, Limited Edition |
| alcohol_region_of_origin | string | Country/state/city of production | (See DoorDash values) |
| alcohol_varietal | string | Single grape variety (e.g. 85%+ of named grape) | (See DoorDash values) |
| alcohol_accolade_rating | number | Rating value | 90 points, 4 stars |
| alcohol_accolade_reviewer | string | Body that gave accolade | Wine Enthusiast, James Beard Foundation |
| alcohol_accolades_text | string | Additional accolade info | Winner of Best New Product 2023 |
| alcohol_review_year | string | Year reviewed/rated | 2021, 2023 |
| alcohol_wine_style | string | Style of wine | WINE_STYLE_CRISP, WINE_STYLE_ELEGANT, WINE_STYLE_FRESH, WINE_STYLE_FRUITY, WINE_STYLE_REFINED, WINE_STYLE_COMPLEX, WINE_STYLE_RICH, etc. |
| alcohol_type | string | Type of alcohol | Vodka, Whiskey, Beer |
| alcohol_aging_vessel | string | Vessel used for aging | Oak Barrel, Stainless Steel, Clay Pot |
| alcohol_ibu | string | International bitterness units (beer) | 45, 70, 30 |
| alcohol_included_items | string | Additional items in set | USB cable, Remote Control |
| alcohol_tasting_notes | string | Aromas and taste | CARAMEL, CITRUS, PEAR, HOPPY, MALTY, OAK, SMOKE, VANILLA, CHOCOLATE, etc. |
| alcohol_distillation | string | Distillation method | Triple distilled, Pot distilled |

---

## Beauty / Cosmetics Properties

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| benefits | string | How the product helps the consumer | (See DoorDash values) |
| finish | string | How makeup appears on skin | FINISH_RADIANT, FINISH_SHIMMER, FINISH_MATTE, FINISH_SATIN, FINISH_DEWY, etc. |
| coverage | string | Pigment concentration (foundation) | COVERAGE_SHEER, COVERAGE_LIGHT, COVERAGE_MEDIUM, COVERAGE_FULL, COVERAGE_BUILDABLE |
| skin_types | string | Skin type | SKIN_TYPE_OILY, SKIN_TYPE_SENSITIVE, SKIN_TYPE_NORMAL, SKIN_TYPE_COMBINATION, SKIN_TYPE_DRY, etc. |
| spf | string | SPF amount | SPF_4, SPF_15, SPF_30, SPF_60, SPF_ABOVE_30, SPF_BELOW_30, SPF_NO_SPF |
| fragrance_family | string | Fragrance family | FRAGRANCE_FAMILY_FLORAL, FRAGRANCE_FAMILY_FRESH, FRAGRANCE_FAMILY_WOODY_AND_EARTHY, etc. |
| fragrance_type | string | Fragrance/scent | (See DoorDash values) |
| formulation | string | Item form/formulation | (See DoorDash values) |
| hair_type | string | Hair thickness | HAIR_TYPE_FINE_HAIR, HAIR_TYPE_MEDIUM_HAIR, HAIR_TYPE_THICK_HAIR, HAIR_TYPE_MULTI_CULTURAL |
| hair_texture | string | Hair texture | HAIR_TEXTURE_WAVY_HAIR, HAIR_TEXTURE_CURLY_HAIR, HAIR_TEXTURE_STRAIGHT_HAIR, HAIR_TEXTURE_COILY_HAIR |
| cosmetic_ingredients | string | Ingredients | (See DoorDash values) |
| concerns | string | Consumer concerns product addresses | (See DoorDash values) |
| gender | string | Marketed gender | GENDER_MEN, GENDER_WOMEN, GENDER_UNISEX |
| scent | string | Fragrance/aroma | Lavender, Unscented, Citrus |
| cosmetics_brush_type | string | Brush type (hair/makeup) | (See DoorDash values) |
| cosmetics_age_range | string | Age range | 3-5 years, 18+, All ages |
| cosmetic_hair_length | string | Hair length | Short, Medium, Long |
| cosmetics_false_hair_and_wig_type | string | False hair/wig type | (See DoorDash values) |
| cosmetics_color_permanence | string | How long hair color lasts | Semi-permanent, Permanent, Temporary |
| cosmetics_eyelash_type | string | Eyelash type | Mink, Synthetic, Magnetic |
| cosmetics_eyelash_style | string | Eyelash style | Natural, Dramatic, Wispy |
| cosmetics_application_method | string | How product is applied | Apply with brush, Roll-on, Spray |
| cosmetics_polish_type | string | Nail polish type | Gel, Matte, Glossy |
| cosmetics_nail_type | string | Fake nail type | Acrylic, Press-on, Gel |
| cosmetics_nail_length | string | Nail length | Short, Medium, Long |
| cosmetics_shade_range | string | Shade range for skin-colored makeup | Light Beige, Deep Chocolate, Tan |
| cosmetics_body_area | string | Body area product is for | Face, Hands, Legs |
| cosmetics_bristle_material | string | Bristle material | Synthetic, Boar Hair, Nylon |
| cosmetics_comb_type | string | Comb type | Wide-Tooth, Fine-Tooth, Rat-tail |
| cosmetics_curler_and_roller_type | string | Curler/roller type | Heated Rollers, Foam Rollers, Ceramic Curlers |
| cosmetics_mounting_options | string | Mirror mounting | Wall-mounted, Tabletop, Freestanding |
| cosmetics_hold | string | Hold strength | Light hold, Medium hold, Strong hold |
| cosmetics_barrel_size | string | Curling barrel diameter | 1 inch, 1.5 inches, 2 inches |
| cosmetics_wattage | string | Electrical power | 1200W, 1800W, 2400W |
| cosmetics_included_items | string | Included accessories | Travel case, Charger, Instruction manual |
| cosmetics_care_maintenance | string | Care instructions | Hand wash, Machine washable, Wipe with a damp cloth |
| cosmetics_reusability | string | Single use or reusable | Single-use, Reusable |
| cosmetics_undertone | string | Skin undertone for matching | Warm, Cool, Neutral |
| cosmetics_closure_type | string | Bag/box closure | Zipper, Velcro, Magnetic snap |
| cosmetics_handle_material | string | Brush handle material | Wood, Plastic, Metal |
| cosmetics_frame_material | string | Mirror frame material | Aluminum, Wood, Plastic |
| cosmetics_power_source | string | Power source | Battery, USB, Solar-powered |

---

## Food & Drinks Properties

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| allergen_info | string | Allergy info | Produced in a facility with Soy, Fish, Shellfish, Peanuts |
| certification_and_production_details | string | Certifications/production methods | Free-Range, USDA Organic, Certified Humane |
| drinks_pulp_level | string | Pulp in juice | No pulp, Some pulp, High pulp |
| drinks_protein_type | string | Protein type in drinks | Whey, Soy, Collagen |
| drinks_tea_type | string | Tea type | Green Tea, Black Tea, Herbal Tea |
| drinks_coffee_bean_type | string | Coffee bean type | Arabica, Robusta, Liberica |
| drinks_roast_level | string | Coffee roast | Medium roast, Dark roast, Light roast |
| drinks_water_source | string | Water source | Spring Water, Glacier Water, Artesian Well |
| drinks_caffeine_content | string | Caffeine amount | 50mg per serving, Decaffeinated, 120mg per can |
| drinks_form | string | Form | Liquid, Powder |
| dietary_tags | string | Dietary restrictions/content | (See DoorDash values) |
| fat_content | string | Fat content | (See DoorDash values) |
| food_source | string | Geographic origin | California, Peru, Texas |
| ingredient_statement | string | Ingredients list | Organic Whole Grain Rolled Oats, Organic Cane Sugar, ... |
| is_combo_item | bool | Part of combo meal/package | Yes, No |
| item_count | string | Count in pack/multi-pack | 24 pieces, 10 bags, 6 cans |
| non_numerical_size | string | Physical size | Mini, Jumbo, Medium |
| nutritional_facts | string | Nutritional content | (See DoorDash values) |
| service_counter | bool | Sold behind meat/deli counter | TRUE, FALSE |
| shape_and_cut | string | Shape/cut of food | Diced, Sliced, Whole |
| side_component | string | Side served with main | with fries, with ketchup, with BBQ sauce |
| species | string | Animal species | Pink Salmon, Alaskan Cod, Chicken |

---

## General Information

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| sub_brand | string | Sub-brand or product line | Applegate Organic, Starbucks' Teavana |
| restriction_types | string | ID verification (18+/21+) and other restrictions | (See DoorDash values) |
| chocolate_type | string | Chocolate type | Dark Chocolate, Milk Chocolate, White Chocolate |
| item_limit | number | Max quantity per customer | 5 per customer, 10 max |
| manufacturer | string | Manufacturer (for Ads) | Procter & Gamble, Nestle, Samsung |
| is_private_label | bool | Merchant private label brand | TRUE, FALSE |
| return_eligibility | bool | SKU can be returned | TRUE, FALSE |
| is_waterproof | bool | Waterproof | TRUE, FALSE |
| days_of_return | number | Days eligible for return | 30, 60, 90 |
| warranty | string | Warranty length | 1 year, 2 years, Lifetime, None, 30 days, etc. |
| surface | string | Surface type product is for | Exterior, Interior, Metal, Wood, Concrete, Glass, etc. |
| theme | string | Theme (toys, costumes, books, apparel, decorations) | (See DoorDash values) |
| occasion | string | Event/situation | SUPERBOWL, VALENTINES_DAY, HALLOWEEN, CHRISTMAS, etc. |
| exclusive | string | Exclusive to store/seller | Walmart Exclusive, Amazon Exclusive |
| compatibility | string | Model/platform compatibility | Apple Watch, Most Strollers, Nespresso Vertuo Line, etc. |
| product_form | string | Product form (generic) | Aerosol, Capsule, Cream, Gel, Liquid, Powder, Tablet, etc. |
| target_group | string | Intended user | Adult, Women, Men, Kids, Baby, Toddler, etc. |
| texture | string | Mouth feel | Creamy, Crunchy, Smooth |
| container_type | string | Container | Bottle, Can, Box, Keg |
| shopping_preference | string | Preferred purchase method/class | (See DoorDash values) |
| external_scan_strategy | string | Dasher barcode scan during pick | SINGLE_SCAN, SKIP_SCAN |

---

## Health Properties

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| limited_edition | string | Limited edition run | Limited Edition, Holiday Edition, Anniversary Edition |
| pregnancy_test_type | string | Type of test | Ovulation Tests, Pregnancy Tests |
| certification_tag | string | Certifications/labels | Organic, Non-GMO, Fair Trade Certified, FDA Approved |

---

## Nutritional Details (JSON)

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| ingredients | JSON | Full ingredients list | (See DoorDash format) |
| nutrition_annotation | JSON | Note on dietary reference for nutrient calc | This is based on a 2000 calorie diet |
| serving_size | JSON | One serving (weight/volume) | 1 (368 grams) |
| servings_per_container | JSON | Servings in package | 1 |
| nutrients | JSON | Nutrients with amounts, % Daily Value, subcategories | [{"label":"Calories","total":"490",...}, {"label":"Total Fat","total":"18g","pct_daily_value":"23%","subcategories":[...]}] |
| disclaimer | JSON | Legal/regulatory statement for % Daily Values | Percent Daily Values are based on a 2,000 calorie diet. |

---

## Package Information

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| package_type | string | How item is packaged / value deal | Value Pack, Mega Pack, Family Pack, Twin Pack, Pack, Bundle, Gift Set, Kit, etc. |

---

## Variant

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| product_group | string | Merchant unique ID for items with multiple variations (e.g. colors/sizes) | One product_group for 4 colors × 3 sizes = 12 sku-ids |
| color_family | string | Basic color family | Black, Multi, Pink, White, Red, Blue, etc. |
| color_name | string | Branded color name | Whirl, Vanilla, 001, NC2 |
| hex_code | string | 6-digit hex for color/swatches | 603638, E96187, BF1790 |
| flavor | string | Flavor | Vanilla, Lemon, Chocolate, Strawberry |
| swatch_image_url | string | Swatch image URL or 6-digit hex | 603638, E96187 |

---

## Weighted Item Properties

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| preparation_method | string | How snack was prepared | Roasted, Grilled, Boiled |

---

## Apparel Properties

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| activity | string | Activity product is for | Basketball, Golf, Running, Yoga & Studio, etc. |
| shoe_size | string | Shoe size | 5, 5.5, 6, … 14, 14.5 |
| shoe_width | string | Shoe width | Narrow, Standard, Wide |
| neck_style | string | Neck style | Boat Neck, Crew Neck, V Neck, Scoop Neck, etc. |
| sleeve_length | string | Sleeve length | Short Sleeve, Long Sleeve, Sleeveless, 3/4 Sleeve, etc. |
| silhouette | string | Apparel silhouette | A-line, Bodycon, Fit and Flare, Sheath, etc. |
| heel_type | string | Heel type | Block, Stiletto, Wedge, Platform |
| heel_height | string | Heel height | (See DoorDash values) |
| apparel_type | string | Type of apparel | Tops, Bottoms, Dresses, Footwear, Activewear, etc. |
| waist_type | string | Waist type | Drop, Empire, Natural, No Waist |
| skirt_type | string | Skirt type | Asymmetric, Plain, Tiered, etc. |
| train_type | string | Has train | Train, No Train |
| apparel_style | string | Style | (See DoorDash values) |
| waistline | string | Waistline | Natural, Empire, Basque, Drop |

---

## Baby

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| baby_formula_stage | string | Formula type | Powdered, Liquid, Liquid Concentrate |
| baby_weight_capacity | number | Weight capacity (cribs, car seats) | (numeric) |
| baby_learning_skill | string | Learning skills | Animals, Coding, Fine Motor Skills, Math, Reading, etc. |
| diaper_size | string | Diaper size | Size 1 (8 to 14 Lbs), Size 2 (12 to 18 Lbs), … Size 7 (Over 41 Lbs), 46+ lbs |
| baby_weight | string | Ideal baby weight for product | (See DoorDash values) |

---

## Home Improvements

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| home_style | string | Style of home | American, Contemporary, Farmhouse, Modern, Traditional, etc. |
| home_room_type | string | Room item is for | Bathroom, Bedroom, Kitchen, Living_Room, Outdoor, etc. |
| indoor_outdoor_use | string | Indoor/outdoor | Indoor, Outdoor, Indoor & Outdoor |
| home_sheen | string | Sheen | Matte, Gloss, Semi-gloss, Flat, Flat-Matte |

---

## Household

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| household_ingredients | string | Health-relevant fact | Alkaline-free, Chlorine-free, Contains Fluoride, Dye-free |
| closure_type | string | Fastener/closure | Drawstring, Zipper, Snap, Button, etc. |
| power_type | string | Power source | Battery, Electric, Corded Electric, Gas, Solar, Manual |
| absorbency | string | Absorbency (diapers/tampons) | Light, Regular, Super, Super Plus, Ultra |

---

## Personal Care

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| body_part | string | Body part product is for | Face, Hair, Hand, Lips, Skin, Whole Body, etc. |

---

## Music

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| instrument_type | string | Instrument type | bass, guitar, keyboard, drum & percussion, brass, woodwind, etc. |
| performance_level | string | Musician level | professional, intermediate, beginner |

---

## Electronics

| Attribute Name | Type | Description | Examples |
|----------------|------|-------------|----------|
| electronic_type | string | Device type | Phones, Tablets, Laptops, Headphones, Televisions, etc. |
| display_type | string | Display type | OLED, QLED, LED |
| battery_life | string | Battery life | (See DoorDash values) |
| electronic_format | string | Format | Physical, VINYL, CD, Digital Download, DVD, etc. |
| esrb_rating | string | Age restriction | Mature 17+, Teen 13+, Everyone 10+, Rating Pending |
| refresh_rate | string | Native refresh rate | 120Hz, 144Hz, 60Hz |
| voltage | string | Power needed | (See DoorDash values) |
| connector_type | string | Connector type | USB-C, HDMI, 3.5mm Jack, Apple Lightning, etc. |
| resolution | string | Screen resolution | 2K, 4K, 8K, HD, 1080p, 720p, QHD |
| battery_included | bool | Batteries included | TRUE, FALSE |
| battery_required | bool | Batteries required to operate | TRUE, FALSE |
| battery_size | string | Battery size | AA, AAA, 9 Volt, D, C, CR2032, etc. |
