# Put Portion online with accounts

Use **Vercel Hobby** for the React site and Node API functions, and **Supabase Free** for email/password accounts and the database. The code is ready for these services; no project, billing plan, or paid service is created automatically.

## Current personal deployment — October 2, 2026

[Portion is live](https://portion-ashy.vercel.app/) on Vercel Hobby, connected to `HyperOrb/portion` with `master` as its production branch. The Supabase Free project has the journal migration applied. Production variables, private server keys, and exact production/localhost authentication redirects are configured. Email confirmation remains enabled. Choose your own password through the site's **Create an account** form, using your Supabase organization email for the default mailer's delivery restrictions.

Supabase's GitHub connection is present, but automatic database deployment and paid preview branching remain off. The initial migration was applied through the SQL Editor; it has not been registered in CLI migration history. Before enabling automatic migrations, record it as already applied with `supabase migration repair 202610020001 --status applied` after linking the CLI to this project; see the [official migration repair instructions](https://supabase.com/docs/reference/cli/supabase-migration-repair). Do not rerun that initial SQL on the existing database. Website commits to `master` deploy through Vercel.

The original localhost journal is preserved. To move data to the hosted address, sign in and restore the backup you exported from the browser that contains your meals. Your account password and email confirmation are the remaining personal setup steps. Signed-in saves and real provider calls still need a live account check; the deployed sign-in screen, configuration, anonymous-access restrictions, and browser bundle were verified.

## 1. Preserve your existing journal

On the current localhost app, go to **Settings → Export backup**. Keep that JSON file. Browser storage is specific to an address: your Vercel site cannot read the journal at localhost. After signing in locally you can use **Review device import**; on the new hosted address you can use **Restore backup**. Restoring replaces that account’s journal after confirmation.

## 2. Create the Supabase project

1. Sign in or create an account at [Supabase](https://supabase.com/dashboard). Create an organization on the **Free** plan and a new project called Portion. Pick a nearby available region. Choose a database password in the dashboard; Portion does not need that password. Do not upgrade the plan or add paid services.
2. Open the project’s **SQL Editor**. Paste and run [202610020001_portion.sql](../supabase/migrations/202610020001_portion.sql) once. It creates the journal table, owner-only row policies, automatic revision checks, and the private Gemini usage budget. The migration is transactional; rerunning after a successful run is unnecessary.
3. In the project’s **Connect** dialog, find its HTTPS project URL and **publishable** key (`sb_publishable_…`). Under **Settings → API Keys**, find or create a **secret** key (`sb_secret_…`). These keys must all belong to the same project. Copy them directly into your local `.env` and Vercel settings, never into chat or a committed file.

| Variable | Value | Browser exposure |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase HTTPS project URL | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` key | Public, protected by user authentication and row policies |
| `SUPABASE_URL` | Same project URL | Server configuration |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` key | **Server only**, bypasses row security |
| `GEMINI_API_KEY` | Existing AI Studio key from a project without active billing | **Server only** |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` (your working choice) | Model name only |
| `GEMINI_DAILY_LIMIT` | `20` | Shared maximum attempts per UTC day |
| `GEMINI_MIN_INTERVAL_SECONDS` | `3` | Minimum spacing between attempts |
| `USDA_API_KEY` | Optional free FoodData Central key | **Server only** |
| `APP_ORIGIN` | Your exact production origin, such as `https://your-portion.vercel.app` | Public address |

Never prefix a Gemini, USDA, or Supabase **secret** key with `VITE_`. Vite includes `VITE_` values in the browser bundle. The build rejects browser-prefixed secrets and accepts only a publishable key in `VITE_SUPABASE_PUBLISHABLE_KEY`. The server has its own client for token verification and budget RPCs; browser journal writes use the publishable key and signed-in user session.

## 3. Enable your personal sign-in

Email/password sign-in is enabled by default. Keep email confirmation enabled.

Supabase’s default mailer currently sends **only to project organization team addresses**, with a **2 emails/hour** limit and no delivery guarantee. For your personal app, register with the same email address you used for your Supabase account. Alternatively, create your own confirmed user under **Authentication → Users → Add user → Create new user**, with an email/password you choose and Auto Confirm enabled; this avoids sending a signup confirmation email. That dashboard action is for your own account. Do not put a default password or an admin signup endpoint in the application.

Password-reset emails have the same delivery restrictions. Opening the reset link brings up the new-password form before opening the journal. For other users or dependable production email delivery, configure your own SMTP provider in Supabase. No SMTP service is added or billed by this app. See [Supabase SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp) and [password authentication](https://supabase.com/docs/guides/auth/passwords).

Under **Authentication → URL Configuration**, add `http://localhost:5173/` to allowed redirect URLs for local testing. Once the Vercel address is known, set **Site URL** to `https://your-portion.vercel.app/` and add that exact URL to the redirect list. Use the same address when signing up or requesting a reset. Preview URLs need their own redirects if you want to test email links on previews.

## 4. Test locally

Edit your existing `.env` to add the Supabase variables above; keep your working Gemini key and model. If `.env` does not exist, copy `.env.example` first. Restart the development server after changing environment variables:

```sh
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173), sign in, and save a target or meal. Refresh to confirm it loads from the account. In **Settings → Your account**, use **Review device import** to bring in the previous browser journal. Imports add missing IDs; existing account copies win for duplicates. Targets are imported when the account has no meals, usuals, or labels. The device original is kept intact.

Leaving all Supabase variables blank retains the original device-only local mode. Any partial cloud configuration shows a setup error; hosted API functions require cloud authentication even if configuration is incomplete.

## 5. Deploy on your Vercel Hobby account

The Vercel CLI is already installed on this computer. From the project folder:

```sh
vercel login
vercel link
```

Select your **Hobby** scope and create/link the Portion project. Do not select a paid team. Keep the framework preset **Vite**, the root directory at this project, the build command `npm run build`, and output directory `dist`. Use Node **24.x** in project settings (the package’s supported range also permits Node 24).

In [Vercel](https://vercel.com/dashboard), open the project’s **Settings → Environment Variables** and add the variables in the table for **Production**. Add them to **Preview** too only if you want preview deployments to access that same project. Your local `.env` is excluded from uploads; its secrets are not copied automatically. Do not use `PORT` or `HOST` on Vercel. Enable Vercel system environment variables so the API recognizes its deployment hostname.

Set `APP_ORIGIN` to the production domain shown by Vercel. Supabase’s Site URL and redirect URL must match it. Then deploy:

```sh
vercel --prod
```

`vercel.json` builds the Vite frontend and four native Node functions: config, meal parsing, food search, and food detail. Function duration is capped at 45 seconds. The app’s navigation uses hashes, so no catch-all rewrite is needed. Do not rewrite `/api/*` to `index.html`.

Changing `VITE_` values requires a fresh build; changing server variables also requires redeployment. A deployed site without Supabase configuration displays a setup screen and cannot make public Gemini calls.

## 6. Confirm the live setup

1. Open the production address on your phone. Sign in and restore the exported localhost backup if needed.
2. Save a target or a meal. Open the same address on another device, sign in, and confirm it appears. Use **Refresh journal** when a device is already open; this version does not stream live updates or queue offline writes.
3. Describe a meal and review it. Gemini remains your configured model. The real USDA source matching and package labels work as before.
4. Sign out. Meals are hidden; other accounts see their own journal. The browser never has the Supabase secret or Gemini key.
5. Keep exported backups. Free Supabase projects do not include automatic database backups.

## Storage, limits, and privacy

Confirmed structured meals, ingredient templates, labels, and targets live in one JSON journal row per user. RLS restricts reads, inserts, updates, and deletes to the authenticated owner. Revisions prevent one old tab from overwriting another device’s changes. The app confirms a cloud write before reporting success. After an unconfirmed save it preserves an exportable version and requires a fresh cloud read before further writes. Journals are limited to 5 MB each; the whole-snapshot approach is intended for a small personal food log.

Cloud mode needs a network connection. A server or database outage leaves existing data intact. Signing out clears the on-screen journal; Supabase manages its browser session, while the original device journal remains stored separately. Exported backups contain food information.

All hosted parsing and USDA endpoints verify the user’s bearer token with Supabase. Parsing additionally reserves an attempt in the database before contacting Google. The **global**, configurable daily cap and spacing apply across users, functions, cold starts, and redeployments. Failed Gemini attempts count. Daily limits reset at midnight UTC; an abandoned in-flight lease expires after 60 seconds. If verification or the budget cannot be checked, no Google request is made. The budget stores counts and times, never meal text. Local device-only development still uses the original process counter.

Portion does not persist or log raw meal descriptions on its server or in Supabase. Meal text is sent to Google for parsing, and nutrition queries go to USDA. Supabase receives authentication information and the confirmed structured journal; Vercel runs the site/API. Google’s unpaid-service data terms and project billing settings still apply. Keep the Gemini project without active billing. The app cannot detect billing status from the key and never enables billing or switches to a paid fallback.

Current official free-plan terms, checked October 2, 2026:

- [Vercel Hobby](https://vercel.com/docs/plans/hobby) is for personal, non-commercial use. It has usage limits; most exhausted quotas require waiting for the allowance to return.
- [Supabase Free](https://supabase.com/pricing) includes 500 MB database storage and 50,000 monthly active users; it permits two active free projects. Projects pause after one week of inactivity. Export backups regularly.
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) distinguishes public publishable keys from server-only secret keys. [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) describes owner policies.
- [Vercel Vite hosting](https://vercel.com/docs/frameworks/frontend/vite), [Node functions](https://vercel.com/docs/functions/runtimes/node-js), and [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) document this deployment layout.
- [Google pricing](https://ai.google.dev/gemini-api/docs/pricing) lists a Standard free tier for the configured Gemini 2.5 Flash-Lite. [Google terms](https://ai.google.dev/gemini-api/terms) explain unpaid-service data use and regional restrictions.

For a new installation, complete the account setup steps above before checking its live deployment. This personal deployment's completed checks are recorded in [verification](verification.md).
