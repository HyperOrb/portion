# Nutrition source research

Checked against current primary documentation on October 1, 2026.

## Decision: USDA FoodData Central

Use FoodData Central for generic ingredients and supported branded foods, with saved package-label data as the fallback. It offers Foundation, SR Legacy and dietary-survey foods with preparation descriptions, plus manufacturer label records. These cover this app's ingredient-based review better than a database focused exclusively on packaged products. This is an implementation judgment; database coverage is not a promise of an exact match. [USDA data type documentation](https://fdc.nal.usda.gov/data-documentation/)

The REST base is `https://api.nal.usda.gov/fdc/v1`. `POST /foods/search` searches, `GET /food/{fdcId}` retrieves a record, and `POST /foods` retrieves multiple records. A free data.gov key is required for regular use; `DEMO_KEY` is an officially supported exploration key using the same live database. Registered access defaults to 1,000 requests/hour/IP; the shared key is limited to 30/hour/IP and 50/day/IP. Exceeding limits produces HTTP 429. The data is public domain under CC0; USDA requests source attribution. API keys should remain private. [USDA API guide](https://fdc.nal.usda.gov/api-guide/), [API specification](https://fdc.nal.usda.gov/api-spec/fdc_api.html)

Two live requests using `DEMO_KEY` successfully returned a food search and record details during implementation. The shared quota is restrictive; configure a personal free `USDA_API_KEY` for daily use.

## Basis and missing values

Generic food values are per 100 g of edible food. A portion's nutrient amount is its database value multiplied by edible grams divided by 100. USDA portions can supply gram weights for named measures, but a teaspoon's weight is food-specific. The app exposes these measures only when the chosen record supplies them. Energy values are taken directly from USDA, supporting nutrient IDs 2048 (specific Atwater), 2047 (general Atwater), and 1008 (older energy). The app never calculates an invented energy value from model output. Raw and cooked entries are separate records; there is no automatic raw-to-cooked mass conversion. [USDA Foundation documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/)

Branded nutrients may be standardized to either 100 g or 100 ml. This implementation accepts only branded records with an explicit gram serving basis; it does not assume fluid density. Missing nutrients do not mean zero. Manufacturer labels may be rounded, including reported zeroes. The app retains a source-reported zero but rejects any record missing calories, protein, carbohydrate or fat. Branded search results are checked against full records in one batch before use. [USDA branded food documentation](https://fdc.nal.usda.gov/GBFPD_Documentation/)

Search produces candidates for explicit user selection. Preparation labels, source record names, per-100-g nutrition, and assumptions remain visible for review. Foods without a suitable complete match require a correction or a complete package label. Database preparation descriptions may include cooking fat or sauce; those are flagged to help prevent double counting. USDA's documented required-word search operator narrows candidates without claiming an exact match. [USDA search help](https://fdc.nal.usda.gov/help/)

## Alternative considered: Open Food Facts

Open Food Facts offers free public reads without login, requires an identifying custom User-Agent, and publishes its database under ODbL. It is useful for international packaged foods but does not replace generic ingredient composition records. Its current API docs state 15 read-product requests/minute/IP and 10 search requests/minute/IP. Structured searches use v2; v2 does not support plain-text search and v3 has no search endpoint, with legacy full-text search and Search-a-licious described separately. Adding another service and attribution/license integration was unnecessary for this focused version: local reusable package labels handle unsupported brands without assuming a match. [Official API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/), [Official API conditions](https://support.openfoodfacts.org/help/en-gb/12-donnees-api/94-y-a-t-il-des-conditions-pour-utiliser-l-api)

## Privacy and operation

Nutrition lookup sends ingredient search words and requested database IDs to USDA, separately from Gemini parsing. The server does not save food logs or log upstream response bodies. Transport errors are replaced by clear messages so URLs containing API keys are not exposed. HTTP requests time out after 15 seconds. No paid nutrition service or runtime fixture is used.

`tests/nutrition.test.js` checks source-reported zero versus missing data, nutrient units and energy IDs, branded gram/ml distinctions, preparation filtering, source-backed portions, batch verification, sanitized failure messages, and boundary validation. Its mocked transport is only a test fixture; runtime searches always use the real USDA endpoint.
