# Farm Pizza — client config

Placeholder assets (`hero.svg`, `og.svg`, `logo.svg`) are stand-ins. Replace with real files and update
`brand.logo / brand.og / brand.hero` in `client.json`. Real JPG/PNG files are preferred for `og` and `hero`.

Inputs still needed from the owner:

- Menu with prices and sizes (or fill `products.csv`, see `products.csv.example`)
- Delivery postcodes and fees per shop
- Opening hours per shop
- Logo (SVG/PNG) and 6–10 food photos
- Stripe connected account id (or bank details for us to set up)
- Google Business Profile review link → `contact.reviewUrl`
- Allergen sheet
- Who receives kitchen orders → `notifications.kitchenEmail / kitchenSms / printerWebhook`
