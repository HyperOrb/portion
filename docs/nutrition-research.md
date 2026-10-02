# Nutrition source research

Checked against current primary documentation on October 1–2, 2026.

## Decision: USDA FoodData Central + Open Food Facts

Use FoodData Central for generic ingredients and supported branded foods, with Open Food Facts for international packaged foods and saved package-label data when no reliable complete match exists. It offers Foundation, SR Legacy and dietary-survey foods with preparation descriptions, plus manufacturer label records. These cover this app's ingredient-based review better than a database focused exclusively on packaged products. This is an implementation judgment; database coverage is not a promise of an exact match. [USDA data type documentation](https://fdc.nal.usda.gov/data-documentation/)

The REST base is `https://api.nal.usda.gov/fdc/v1`. `POST /foods/search` searches, `GET /food/{fdcId}` retrieves a record, and `POST /foods` retrieves multiple records. A free data.gov key is required for regular use; `DEMO_KEY` is an officially supported exploration key using the same live database. Registered access defaults to 1,000 requests/hour/IP; the shared key is limited to 30/hour/IP and 50/day/IP. Exceeding limits produces HTTP 429. The data is public domain under CC0; USDA requests source attribution. API keys should remain private. [USDA API guide](https://fdc.nal.usda.gov/api-guide/), [API specification](https://fdc.nal.usda.gov/api-spec/fdc_api.html)

Two live requests using `DEMO_KEY` successfully returned a food search and record details during implementation. The shared quota is restrictive; configure a personal free `USDA_API_KEY` for daily use.

## Basis and missing values

Generic food values are per 100 g of edible food. A portion's nutrient amount is its database value multiplied by edible grams divided by 100. USDA portions can supply gram weights for named measures, but a teaspoon's weight is food-specific. The app exposes these measures only when the chosen record supplies them. Energy values are taken directly from USDA, supporting nutrient IDs 2048 (specific Atwater), 2047 (general Atwater), and 1008 (older energy). The app never calculates an invented energy value from model output. Raw and cooked entries are separate records; there is no automatic raw-to-cooked mass conversion. [USDA Foundation documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/)

Branded nutrients may be standardized to either 100 g or 100 ml. This implementation accepts only branded records with an explicit gram serving basis; it does not assume fluid density. Missing nutrients do not mean zero. Manufacturer labels may be rounded, including reported zeroes. The app retains a source-reported zero but rejects any record missing calories, protein, carbohydrate or fat. Branded search results are checked against full records in one batch before use. [USDA branded food documentation](https://fdc.nal.usda.gov/GBFPD_Documentation/)

Search produces candidates for explicit user selection. Preparation labels, source record names, per-100-g nutrition, and assumptions remain visible for review. Foods without a suitable complete match require a correction or a complete package label. Database preparation descriptions may include cooking fat or sauce; those are flagged to help prevent double counting. USDA's documented required-word search operator narrows candidates without claiming an exact match. [USDA search help](https://fdc.nal.usda.gov/help/)

## Open Food Facts for packaged and local snacks

The earlier USDA-only search missed Indonesian snacks. Open Food Facts has public reads without authentication or an API key, requires an identifying User-Agent, and publishes data under ODbL with attribution and share-alike terms. Portion displays the source and product link, retains that provenance in backups, and links the license in Settings. It does not publish a combined nutrition catalog or upload journal data to Open Food Facts. Review its license before redistributing a database. [API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/), [License guidance](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/)

`POST https://search.openfoodfacts.org/search` supplies full-text lookup with Indonesian/English languages and local food names. Search-a-licious returns product identifiers; Portion checks at most four full records through the supported v2 product API. That endpoint retains the legacy `nutriments` fields and units needed by this adapter; a live v3.6 request omits those legacy fields, so changing versions needs a new nutrition-schema adapter. No deprecated v2 full-text search is used. [Search-a-licious reference](https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/), [API versions](https://openfoodfacts.github.io/openfoodfacts-server/api/)

The API introduction currently lists 10 search requests/minute/IP and 15 product reads/minute/IP. There is one initial lookup per ingredient and explicit subsequent searches, never search-as-you-type. There is no paid fallback. Rate-limit and outage messages point to retry or saved labels. Selected sources remain in usual meals and backups, so reuse does not fetch them again.

Community records are candidates, not verified manufacturer facts. All four `_100g` nutrients must be explicit finite numbers with kcal/g units. Reported zero remains zero. The adapter requires an explicit gram package quantity or gram serving, rejects volume nutrition and missing basis, excludes reported data-quality errors, and uses only as-sold values. It never assumes 1 ml = 1 g or replaces missing protein with zero. The user must confirm product and flavor. Full details are rechecked when selected.

Live checks on October 2 found complete Garuda pilus records, including product `8992775211434`. A plain pilus search found these; quoting an unqualified term caused Search-a-licious to search an unsuitable wildcard field and return no hits, so the implementation uses sanitized plain-text identity words. Basreng returned no complete candidate. The real Gemini request recognized both snacks and kept weights unresolved when no quantities were given. Basreng cannot inherit ordinary meatball values, and pilus cannot inherit plain peanut values.

## Privacy and operation

Nutrition lookup sends ingredient search words and requested database IDs to USDA or Open Food Facts, separately from Gemini parsing. The server does not save food logs or log upstream response bodies. Transport errors are replaced by clear messages so URLs containing API keys are not exposed. HTTP requests time out after 15 seconds. No paid nutrition service or runtime fixture is used.

`tests/nutrition.test.js` checks source-reported zero versus missing data, nutrient units and energy IDs, branded gram/ml distinctions, preparation filtering, source-backed portions, batch verification, sanitized failure messages, and boundary validation. Its mocked transport is only a test fixture; runtime searches always use the real USDA and Open Food Facts endpoints.
