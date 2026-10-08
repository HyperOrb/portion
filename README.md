# Portion

An everyday calorie and macro journal for meal descriptions in Indonesian or English. Describe a meal, review editable portions and nutrition sources, then save. Confirmed meals, usual meals, package labels, and optional targets can stay on your device or sync through a Supabase account.

Product domain: [portion.my.id](https://portion.my.id). Source: [HyperOrb/portion](https://github.com/HyperOrb/portion). Local changes do not update production until deployed.

## Run locally

Requires Node 22.12+ and npm.

```sh
npm install
cp -n .env.example .env
npm run dev
```

Open [localhost:5173](http://localhost:5173). The development command starts Vite and the Node API together. Device-only mode is retained when all Supabase variables are empty. To preview the public landing page locally, open [localhost:5173/?page=home](http://localhost:5173/?page=home).

Set `GEMINI_API_KEY` only in the server environment. Use a Google AI Studio project whose billing and regional terms you have checked; the application cannot detect billing status from the key. Never put server keys in `VITE_*` variables, source files, or chat. Restart after environment changes. Missing AI configuration leaves manual entry, labels, and usual meals available.

For accounts and hosting, follow [Supabase + Vercel setup](docs/hosting.md). Export your device journal before moving to a new address. Browser storage is specific to the site origin. Supabase public variables use a publishable key; server credentials must remain private.

For a built local app:

```sh
npm run build
npm start
```

Open [localhost:3001](http://localhost:3001). `HOST=0.0.0.0` allows devices on the same trusted network; their browser storage is independent. Set `APP_ORIGIN` for HTTPS/custom-domain hosting. Hosted APIs require verified Supabase sign-in.

## Estimation and review

- **AI estimates:** `server/gemini.js` currently defaults to `gemini-3.5-flash-lite`, with `gemini-3.1-flash-lite` as its configured fallback on 404, 429, or 503. These are current code defaults, not a live verification of model availability or free-tier eligibility. Override them with supported model IDs for your project. Gemini provides proposed portions, preparation, recipe assumptions, and per-100-unit nutrition from model knowledge. Every estimate is labeled **Gemini AI estimate**, has no database URL, and needs review.
- **USDA FoodData Central:** optional searches retrieve actual ingredient records with all four nutrient values, source ID/link, and preparation. Candidates require user selection. Missing values are rejected rather than changed to zero. Without `USDA_API_KEY`, the server uses the real shared `DEMO_KEY`; get a personal free [data.gov key](https://fdc.nal.usda.gov/api-key-signup) for regular use.
- **Open Food Facts:** optional international product searches preserve local snack names and known brands. The server checks complete product records, gram basis, and data-quality flags. Community data can be wrong; match the exact product and package. Unsupported or incomplete results stay unresolved.
- **Package labels:** enter the actual printed serving size and four nutrient values. Labels retain their identity as user-entered package data and can be reused.
- **Units and state:** solids use g/per-100-g; drinks use mL/per-100-mL. No assumed 1 mL = 1 g conversion. Raw/dry and cooked weights are not interchangeable. Material weighing-state questions must be resolved before saving.

Household portions receive visible assumptions; they are not measured weights. Named composite dishes stay intact unless the user lists ingredients. Potential extras are reminders, not claims of consumption. Nutrition totals are calculated locally from the reviewed quantities and stored per-100-unit values.

An optional Claude adapter is included for evaluation, **disabled by default**. It shares the same review, validation, unit rules, authenticated APIs, and request safeguard. It has no automatic provider fallback. No superiority, cost, or live reliability has been established. See [Claude evaluation](docs/claude-evaluation.md) before approving any API spend or changing providers.

## Journal and data

Daily totals follow the device’s local calendar date. Past meals stay in their dated logs. Targets are optional and editable. The body-profile calculator is a general estimate; it does not replace professional advice. Profile measurements and daily totals are not automatically added to provider requests.

Cloud journals use owner-only row policies and revision checks so an older device cannot silently overwrite a newer save. A failed save keeps an exportable unsaved version. Device imports preserve existing account entries and deduplicate reimports. Cloud snapshots are capped at 5 MB; do not treat the current architecture as proof of large-scale capacity.

Export and restore backups in Settings. Validation rejects malformed/unknown fields, duplicates, unresolved sources, and invalid units before saving. Account deletion currently requires contacting the operator; signing out does not delete stored journals.

## Safeguards and privacy

The local handler defaults to 20 parse attempts/day, a three-second minimum interval, and one in-flight request. Configure `GEMINI_DAILY_LIMIT` / `GEMINI_MIN_INTERVAL_SECONDS`, or provider-neutral `AI_DAILY_LIMIT` / `AI_MIN_INTERVAL_SECONDS`. A zero cap disables parsing. Failed attempts count. Local counts reset at midnight UTC and on restart; hosted counters use a durable private SQL budget shared across users and functions. Provider quotas and billing apply independently.

Keys stay on the server. Provider error bodies and raw descriptions are not logged or forwarded. Confirmed structured data goes to Supabase in account mode. Searches send food names/brands/preparation to nutrition providers. Google’s unpaid-service terms can permit input/output use for improvement and human review; check regional, age, billing, and business-use requirements. See [privacy notice](public/privacy.html), [beta terms](public/terms.html), and [historical Gemini research](docs/gemini-research.md).

## Public website

The landing page has a public, editable sample walkthrough. Its authored nutrition values are labeled illustrative and do not call AI, retrieve database records, write browser journals, or access user data. It uses the real journal calculation function to demonstrate portion editing.

The build prerenders public product content into `dist/index.html` for readers without JavaScript and crawlers. Privacy and beta terms are static public pages. No invented funding, academic backing, testimonials, traction, performance metrics, future pricing, or unimplemented Pro features are advertised.

## Verification and application preparation

```sh
npm test
npm run build
```

Tests cover actual SQL owner isolation/revisions/budget permissions, nutrition math, unit/state rules, backup preservation, HTTP origins/authentication, provider transport shapes, gated Claude selection, quotas, and private failures. Provider requests in tests are mocked. Real provider accuracy, latency, and account signup/email delivery need separate live verification.

See [Claude startup readiness](docs/CLAUDE_STARTUP_READINESS.md), [brand direction](docs/brand-guidelines.md), and [verification](docs/verification.md).
