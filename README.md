# Portion

A personal, mobile-friendly calorie and macro journal. Describe one meal, confirm the foods and their nutrition sources, adjust edible weights and cooking state, and save. Food logs, ingredient templates, package labels, and optional targets can stay on this device or sync through a private Supabase account. Vercel hosts the web app and server endpoints.

For accounts and free hosting, follow **[Supabase + Vercel setup](docs/hosting.md)**. Your existing device journal is preserved; export it before moving to the hosted address.

The personal deployment is live at **[portion-ashy.vercel.app](https://portion-ashy.vercel.app/)**. Create your own account using your Supabase organization email, confirm the email link, then sign in. Restore your existing journal backup under Settings if needed.

## Run locally

Requires Node.js **22.12+** (Node 24 LTS recommended) and npm.

```sh
npm install
# Only if .env does not already exist:
cp -n .env.example .env
```

Open `.env` in your editor. Set `GEMINI_API_KEY` to a key from [Google AI Studio](https://aistudio.google.com/apikey) belonging to a **project without active billing**. Do not paste the key into chat or the app. Google’s project/account billing settings determine whether use is actually free; a paid-project key can be charged even when the same model also offers a free tier. The app cannot detect billing status from an API key. Do not link billing for this app.

Optionally set `USDA_API_KEY` to your own **free** [FoodData Central/data.gov key](https://fdc.nal.usda.gov/api-key-signup). This is recommended for regular use. Without it, the server uses USDA’s real `DEMO_KEY`, limited to **30 requests/hour and 50/day per IP**. It returns actual database records, not canned results. A personal USDA key normally permits 1,000 requests/hour per IP.

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). This starts Vite and the Node API server together. Restart after changing `.env`. Missing Gemini configuration shows setup instructions; manual entry, saved labels, and usual meals remain usable.

To use a phone, keep the computer running and connect both devices to the same trusted Wi-Fi. Open the **Network URL printed by Vite**, such as `http://192.168.1.10:5173`, in the phone browser. Allow your OS firewall to accept the development server if needed. HTTP on a local IP is supported; the computer is serving the web app, not syncing food logs. The phone has its own browser storage.

For the built version:

```sh
npm run build
npm start
```

Open [http://localhost:3001](http://localhost:3001). `HOST=0.0.0.0` in the example environment allows a phone to use the computer’s local IP on port 3001. Keep this personal local server on a trusted network. `PORT` defaults to 3001; the Vite development proxy expects 3001. For a custom domain or HTTPS reverse proxy, set `APP_ORIGIN` to its full origin (e.g. `https://my.example.com`). Hosted API functions require sign-in and Supabase configuration; local device-only mode is for a trusted network.

## Estimation and review

- **Gemini 2.5 Flash-Lite** (`gemini-2.5-flash-lite`) is the working default configured in this project. `GEMINI_MODEL` is a server setting; it is preserved across the hosting change. Google’s [pricing](https://ai.google.dev/gemini-api/docs/pricing) lists a Standard Free Tier for it, verified October 2, 2026. It parses ingredients, quantities, weighing state, preparation, brands, assumptions, and possible missing extras. No automatic model switch or paid-service fallback is used.
- Gemini never supplies nutrition values. **USDA FoodData Central** supplies per-100-g calories, protein, carbohydrate, and fat. It has free API access, public-domain/CC0 data, and useful raw/cooked records. Each record includes a source link, ID, data type, and preparation description. Unlike a packaged-food-only database, it covers the chicken, rice, oil, and other common ingredients in natural-language meals. See the [official API guide](https://fdc.nal.usda.gov/api-guide/) and [source comparison](docs/nutrition-research.md).
- **Open Food Facts** adds international packaged foods and Indonesian snacks, with no API key or paid service. Automatic lookup uses it for brands, as-packaged foods, basreng, and pilus; everyday ingredients use USDA, with a package search when USDA has no complete candidates. The review lets you switch databases. Search keeps local names (`kacang pilus` → `pilus`) instead of substituting plain peanuts. Each package candidate is checked against a full product record with all four macros, valid units, a confirmed gram basis, and no reported data-quality errors. Community data can be wrong: confirm the exact brand, flavor, and label. Current basreng searches return no complete match, so a specific product or saved label is still needed. [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- Search returns candidates, not a claimed exact match. Select the record that actually fits the food, brand, and preparation. Uncertain matches stay unresolved. Records missing any of the four nutrition values are rejected, rather than filling in zero. Explicit database zero values remain valid.
- When raw/dry versus cooked weight matters, answer the short question with the **state when you weighed the food**. Changing that state invalidates the old source. Raw and cooked grams are not interchangeable; a packaged-food label applies to an as-packaged weight.
- Grams are edible weight. The app never guesses household weights or density: teaspoon, piece, serving, and ml entries need a measured gram weight or a source-backed database serving weight. Choosing a database serving uses exactly the displayed serving once; adjust grams for multiple servings. Check approximations and assumptions in review.
- Oil, butter, sauces, and dressings appear as a nonblocking reminder. Add them as separate foods when appropriate. A prepared-food record may already include fat or sauce; check its description to avoid counting it twice.
- For an unmatched brand, save its complete package label once (including the serving’s gram weight). Values are normalized to 100 g and reusable. The label remains explicitly identified as your package data. Volume-only labels need a measured serving weight; 1 ml is not assumed to weigh 1 g.
- Review totals are computed as `source value per 100 g × edible grams ÷ 100`, without rounding each ingredient first. All foods need a source, positive edible weight, and resolved clarification before saving.

The review can edit the meal name, log date, ingredient names, quantities, brand, preparation, and weighing state. You can add/remove foods and extras. Dates use the device’s calendar date, including past-day entry/edit/delete.

After saving, choose **Save as usual meal**. Usuals keep editable ingredient templates, sources, amounts, and assumptions. **Log meal** saves unchanged in one tap for the selected date. **Edit first** changes a one-time portion; **Edit template** changes the reusable usual.

## Indonesian food guidance

Portion has a server-side NutriTrack ID instruction for Indonesian/English meal descriptions. It understands Indonesian/English descriptions and local food names, distinguishes bakar/goreng/kukus/rebus, asks brief weighing-state questions in the meal’s language, and flags possible minyak, santan, tepung, or sauces. Named dishes such as nasi liwet and mie ayam stay intact unless you describe their ingredients; Gemini never invents a recipe or its nutrition. Basreng and pilus keep their local identities; portions and brands are never invented. An unfamiliar dish without a reliable database match still needs your correction or package data.

New journals start with **0 calories, protein, carbs, and fat as daily targets**. Zero or a blank field means no target; positive values enable progress and remaining amounts. Set your own goals in Settings. Existing saved targets and restored backups are preserved; **Settings → Reset targets to zero** clears them explicitly. Greetings and protein feedback work for everyone, without a fixed personal name.

The daily summary shows remaining amounts or how far above a target you are. A resolved meal review previews the balance **after saving**, including edits without counting the previous version twice. Protein feedback uses selected nutrition values and your current target on this device. If a meal has less than 20 g protein and the daily protein target is still unmet, it offers simple options such as eggs, tempe, chicken breast, or whey without assigning unsourced nutrition or logging anything automatically.

A new local calendar day starts with an empty daily total and full remaining targets. Earlier meals remain in their dated logs. The app checks while visible and when returning to it; intentionally browsing a past date stays on that date. Your age, body measurements, student profile, and daily totals are not added to Gemini requests. Text you choose to enter is still sent to Google under its API terms.

Open Food Facts data is attributed in each estimate and available under [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Searches use its full-text Search-a-licious API and check at most four product details per search. Its documented limits are 10 searches/minute/IP and 15 product reads/minute/IP; search is submitted explicitly, never on every keystroke. Selected nutrition stays with your ingredient templates and backups for reuse.

## Journal storage and backups

In device-only mode, data is stored in browser `localStorage`, scoped to the exact site origin. The same address/port is needed to return to a journal. Switching from localhost to a Wi-Fi IP, changing ports, or using a different browser/device creates separate storage. Clearing site data or private-browsing storage can remove the log.

Use **Settings → Export backup** to download meals, usual meals, labels, and targets as versioned JSON. **Restore backup** validates the complete file before showing a replacement confirmation. Export the current journal first if you need to preserve it. Invalid backups never overwrite data; corrupt existing storage is preserved and can be exported for recovery. Other tabs synchronize changes and stale writes are blocked.

With Supabase configured, sign-in opens your private cloud journal. Confirmed changes are saved to the database before success is shown; another device loads them when opened or refreshed. Old revisions cannot overwrite newer changes. Failed saves remain exportable and require reloading before further writes. Cloud saves need a connection. The existing device journal is not uploaded or deleted automatically: Settings offers an import with confirmation. Free-plan email setup, database security, and Vercel deployment are explained in [hosting instructions](docs/hosting.md).

Original natural-language meal descriptions are not saved in the journal or on the server. Structured food names, preparation, assumptions, and source nutrition are saved in the active device or account journal. Exports contain those fields. Backups include food information, so store them where you want to keep your journal.

## API privacy and free-tier limits

Meal text passes through `POST /api/parse` on the Node server to Google. The Gemini key stays in a server environment variable, is sent in an API header, and is never exposed in browser bundles or storage. The server has no request/body logging or raw-description disk storage. Account journals store only confirmed structured data in Supabase. Provider errors are sanitized rather than forwarding bodies that might echo submitted text. Food names, brands, and preparation state are sent to USDA or Open Food Facts for lookup. Google and the nutrition services process requests under their own terms.

Under Google’s current [Gemini API additional terms](https://ai.google.dev/gemini-api/terms), unpaid-service inputs and generated responses may be used to improve Google products, and human reviewers may process them. Avoid sensitive, confidential, or personal information in descriptions. Review the full terms: they also contain age (18+), supported-region, developer professional/business-purpose requirements, and Paid Services requirements for API clients made available to EEA, Switzerland, or UK users. This implementation never enables billing to work around those rules. The user’s region and actual project status determine applicable terms. Detailed official references are in [Gemini research](docs/gemini-research.md).

The local server imposes a configurable **20 parse attempts/day**, a **3-second minimum interval**, and one in-flight parse. Set `GEMINI_DAILY_LIMIT` and `GEMINI_MIN_INTERVAL_SECONDS` in `.env`; the daily limit can be zero to disable parsing. Attempts, including failed ones, count. The counter resets at midnight UTC and when the server restarts: it is a modest safeguard for one local process, not an enforceable account quota or billing detector. Google’s project/model quotas apply separately and may vary. Clear messages explain local limits and Google/USDA/Open Food Facts rate-limit errors. Usual meals and labels do not call Gemini. There is no paid fallback.

On Vercel, the authenticated API uses a **database-backed shared budget** with the same configurable daily cap and pacing. Counters survive cold starts and redeployments, and no Gemini request is sent when verification or the budget is unavailable. See [hosting instructions](docs/hosting.md).

`.env` and other real secret files are ignored by Git; `.env.example` has blank keys. Only the Supabase URL and **publishable** key use `VITE_*` variables; never give a Gemini, USDA, or Supabase secret key that prefix. Read [Google’s rate-limit guide](https://ai.google.dev/gemini-api/docs/rate-limits) and inspect your Free Tier project’s actual limits in AI Studio.

## Checks

```sh
npm test
npm run build
```

Tests also execute the real SQL migration in a WASM PostgreSQL database to check owner policies, revision conflicts, and budget permissions. Provider transports are mocked only in tests; a live hosted integration needs the actual Supabase project and deployment. Tests cover sourced nutrition math, missing data, cooking-state mismatches, package-label basis, backup validation and preservation, API trust boundaries, real Gemini request shape, quota safeguards, sanitized provider failures, and static-file boundaries. Mock transports exist only in tests. The application always uses real APIs; an actual Gemini parse requires your key and Free Tier access.

Stack: React + TypeScript + Vite; native Node HTTP handlers and built-in fetch; Supabase JS for authentication and private journal storage. Four native Vercel functions reuse the same server handler. No workout, weight, barcode, or photo tracking.
