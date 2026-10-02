# Gemini integration research

Verified against current official Google documentation on **October 1, 2026**. Recheck the linked pages when configuring a project: model availability, free quotas, and terms can change.

## Model and free tier

Use the stable **`gemini-3.8-flash`** model. Its [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash/) identifies a stable September 2026 release with structured outputs and `low`, `medium`, and `high` thinking levels. Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists Standard input and output tokens as free of charge under its Free Tier. The app pins that model and uses low thinking for a short extraction task. There is no model substitution, paid-service fallback, grounding, caching, batch processing, or automatic billing setup.

Google's [billing documentation](https://ai.google.dev/gemini-api/docs/billing) says new accounts start on Free Tier and linking an active billing account upgrades the project. **Use an API key from a project marked Free in AI Studio, with no active billing attached.** Do not set up billing or prepay credits for this app. The API key itself does not tell this server whether your project is free or paid; Google account and project settings determine charges. Selecting a free-tier-capable model cannot prevent charges if the same key belongs to a paid project.

## Real REST API and structured output

The [official generateContent structured-output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) shows the real REST endpoint:

```text
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent
x-goog-api-key: <server environment variable>
```

The app uses the [current REST reference's](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig) `generationConfig.responseMimeType: application/json` and `responseJsonSchema`. Google's Go example also uses these fields. The guide's newer `responseFormat.text` example spells its MIME value differently from the reference's enum, so this native REST integration uses the documented string MIME field instead. Generate Content remains documented as a legacy API supporting this model; no conversational state or retained interaction history is needed. The server validates the returned structure again. Its schema has food names, quantities, cooking state, brands, assumptions, and clarification questions; it has no nutrition fields. Household-to-gram guesses are discarded. Nutrition is subsequently selected from USDA records or a user-entered package label.

Native REST sends `thinkingConfig.thinkingLevel: "LOW"`, matching the [ThinkingLevel enum](https://ai.google.dev/api/generate-content#ThinkingLevel). The thinking guide's lowercase example conflicts with this reference. Live diagnostics on October 1 reproduced HTTP 400 `INVALID_ARGUMENT` with lowercase `low`; changing only that value to `LOW` cleared that rejection and reached a separate HTTP 503 capacity error. Keep the uppercase value covered by the transport regression test.

Every request includes Portion's NutriTrack ID system instruction before the meal text. It covers Indonesian/English vocabulary, local foods, cooking methods, culturally relevant extras, and brief clarification. It preserves composite dishes and uncertain household weights instead of inventing recipes or grams. Only the submitted meal text and extraction instruction are sent; personal measurements, daily targets/totals, and journal history are not appended. Friendly protein feedback and remaining targets are calculated locally from nutrition sources, so no extra Google request or model-generated nutrition is involved.

## Data terms

Meal descriptions leave the device and are sent to Google for parsing. The [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms), effective March 23, 2026, say unpaid submissions and responses may improve Google products and machine-learning services; human reviewers may process them. Avoid sensitive, confidential, or personal information. The terms specify adult users, supported regions, and developer professional/business purposes, and require Paid Services when making API clients available to users in the EEA, Switzerland, or UK. Separate paid-service data-use terms apply in those locations. Review eligibility before using this personal development app; this implementation never enables paid access.

The server retains no raw descriptions or responses on disk, performs no request logging, and sanitizes provider errors. Confirmed food entries, saved labels, targets, and usual meals live in browser storage. Google processes text according to its own terms; local-only food-log storage does not change that.

## Quotas and safeguards

Google's [rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits) describes project-level request/minute, input-token/minute and request/day limits. Actual limits depend on account, model, tier, and capacity; view the active limits in AI Studio. Google's daily quota resets at midnight Pacific time. Do not assume a fixed free quota from older examples.

The app adds an independent, configurable cap of **20 parsing attempts per UTC day**, a **3-second minimum interval**, and at most one active parsing request. Failed attempts count, and no automatic retries consume quota. `GEMINI_DAILY_LIMIT` accepts 0–1,000 (`0` disables parsing); `GEMINI_MIN_INTERVAL_SECONDS` accepts 0–3,600. These modest safeguards are for one personal server process; the in-memory counter resets when that process restarts. They are not billing controls. Meal-log dates separately follow the browser's local date.

The server accepts descriptions up to 4,000 characters, JSON requests up to 20,000 bytes, and applies a 25-second Gemini timeout. Quota/rate-limit errors return an explicit message without switching services. Missing or rejected keys return setup guidance instead of fabricated results. `.env` is server-only and ignored by Git. No key is embedded in the client or backups.

Invalid requests/project configuration (400), billing/credit errors (402), and temporary overload (503) have distinct fixed messages. Provider response bodies are never returned or logged. Overload offers a manual retry after a minute and does not cause automatic retries or a model change. After editing `.env`, fully restart `npm run dev`; a watched source restart can retain the watch process's previous environment.

## Verification

`node --test tests/server.test.js` checks missing configuration, input and origin validation, pacing, concurrency, UTC reset, failed-attempt counting, response validation, REST enum/request shape, quota/error handling, and static-file boundaries. The runtime always uses the real API. Tests inject controlled transport responses to exercise failures without spending quota. With a key configured locally, Google's model-list API accepted the key and listed this model. A live request through Vite and the Node endpoint reached Google's temporary overload response after the enum fix and a full dev-server restart; a completed structured parse was not yet verified while Google returned that capacity error. These probes used synthetic meal text and did not print the key or save provider responses.
