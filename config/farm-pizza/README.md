# Farm Pizza — client config

Placeholder assets (`hero.svg`, `og.svg`, `logo.svg`) are stand-ins. Replace with real files and update
`brand.logo / brand.og / brand.hero` in `client.json`. Real JPG/PNG files are preferred for `og` and `hero`.

Verified from public listings (Sept 2026) and already in `client.json`: addresses, phone numbers, opening hours, delivery areas → postcode districts, pizza sizes (7"/10"/13"/15"), and the Summer Meal / Party Meal deal structures. Confirm with the owner: Grays closing times (listings show 2am / 3am), whether SS12 and CM11 are really covered from Basildon, and delivery fee / minimum per shop.

Inputs still needed from the owner:

- Menu prices and the full item list (sizes and deal structures are in place; all prices in `menu.json` are placeholders)
- Delivery postcodes and fees per shop
- Opening hours per shop
- Logo (SVG/PNG) and 6–10 food photos
- Stripe connected account id (or bank details for us to set up)
- Google Business Profile review link → `contact.reviewUrl`
- Allergen sheet
- Who receives kitchen orders → `notifications.kitchenEmail / kitchenSms / printerWebhook`
