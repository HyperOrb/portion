# Portion — Claude startup readiness

Assessment date: October 8, 2026. Repository evidence supports a working early-stage product. This local work improves presentation and reliability; it does not establish eligibility, production readiness, or approval. No production deployment or startup application has been submitted in this task.

## 1. Product overview

Portion is a mobile-friendly calorie and macronutrient journal developed by Ryann Chandiari. Users describe meals in Indonesian or English, review proposed portions and nutrition sources, and save confirmed entries. Public product domain: https://portion.my.id. Source: https://github.com/HyperOrb/portion.

## 2. Problem

Household portions and mixed dishes such as mie ayam or gado-gado can require several decisions before a useful food log can be saved. Portion makes those decisions visible: edible quantity, cooking state, recipe assumptions, and source selection. Limited coverage of a specific food remains unresolved instead of being portrayed as a verified match. Any broader market-size or competitor-performance claim needs independent evidence.

## 3. Intended market

Initial audience: people who eat Indonesian meals and want a simple daily food journal in Indonesian or English. Southeast Asian expansion is a potential direction, not demonstrated coverage. Founder confirmation needed: primary segment, customer interviews, acquisition plan, service regions, and whether a narrower student or young-adult focus is validated.

## 4. Differentiation

- Natural-language entry and familiar Indonesian household measures.
- Review-first workflow with visible assumptions.
- Distinct AI estimates, retrieved database records, and user-entered labels.
- Native g versus mL treatment and raw/cooked weighing-state checks.
- Focused daily journal, reusable meals, and backup portability.

These describe implemented behavior. They are not a claim that Portion is more accurate or faster than competitors.

## 5. Existing features

| Feature | Evidence | Limitation |
| --- | --- | --- |
| Natural-language meal estimates | `server/gemini.js`, `src/MealEditor.tsx` | Real model access/quality requires live validation |
| AI provenance, portion edits and assumptions | Shared validator, source blocks, `src/domain.ts` | Estimates may be nutritionally inaccurate |
| USDA and Open Food Facts searches | `server/nutrition.js` | Coverage and product quality vary |
| Package labels, usual meals, history | `src/App.tsx`, `src/domain.ts` | User must enter/review values correctly |
| Optional profile and editable targets | `src/OnboardingModal.tsx` | General estimates, not clinical recommendations |
| Supabase account sync | `src/cloud.ts`, `src/useJournal.ts`, SQL migration | Public SMTP and live project configuration still need verification |
| Owner isolation and revision checks | SQL migration; actual PostgreSQL tests | Deployed migration state is not audited |
| Backup export/restore and device import | App and cloud tests | Browser/origin-specific local storage |
| Public interactive walkthrough | `src/LandingPage.tsx`, `src/demo.ts` | Illustrative authored values, not live AI evidence |
| Prerendered website, privacy and beta terms | `scripts/prerender.ts`, `public/` | Owner must approve accuracy of operational disclosures |
| Optional Claude parsing adapter | `server/claude.js`, `server/parser.js` | Disabled by default, mocked tests only |

Not implemented or not promised: barcode scanning, voice recording, meal-photo interpretation, micronutrient tracking, PDF export, unlimited Claude breakdowns, a paid Pro plan, or preferential future pricing.

## 6. Architecture

React 19 + TypeScript + Vite client; native Node HTTP handler for local use; the same handler is exposed as Vercel API functions. Supabase provides auth and owner-protected structured JSON journals with revisions. A private SQL budget enforces a shared parse-attempt limit across functions. Device-only mode retains localStorage and backups. No new runtime dependency was added for this task. Current cloud snapshots are capped at 5 MB, and requests use shared limits; scalability has not been load-tested.

## 7. Current AI implementation

Gemini is the default provider. Code defaults are `gemini-3.5-flash-lite` and a `gemini-3.1-flash-lite` fallback on selected provider errors. These identifiers reflect the checkout, not a live verification of supported/free models. AI supplies model-based nutrition estimates as well as portions and recipe assumptions; USDA/Open Food Facts are optional alternative records, not hidden verification of the AI output. Keys are server-only. Raw text is forwarded only as the submitted description; body profile/targets are not automatically added. Provider policies apply to the submitted data.

## 8. Proposed Claude use case

Evaluate Claude for Indonesian/mixed-language meal identity, portion interpretation, material weighing-state questions, and clear nutritional uncertainty. The optional adapter uses the existing instruction, schema, validator, source identity, authenticated routes, and durable budget. No provider advantage is established. See [evaluation plan](claude-evaluation.md) for model selection, explicit spending enablement, synthetic cases, acceptance criteria, and privacy review. Do not describe it as a production Claude-powered app unless deployment and actual use support that claim.

## 9. Stage and business model

Early beta, currently presented as free access with bounded AI requests. Future paid plans are unfinalized. Founder confirmation needed: founding date, legal entity/business status, funding, business model, pricing validation, and launch stage. No revenue, funding or investors are inferred from the repository.

## 10. Traction and claims

No verified user count, retention, paying customers, revenue, funding, university partnership, or nutrition-accuracy benchmark was provided. Previous landing copy's angel/academic endorsement, quotation, 80% attrition statistic, 0.4-second parse, 5-second logging, and future Pro promises were removed. This does not establish that the affiliations are false; publish only after documentary evidence and permission to use names/quotes.

## 11. Eligibility and founder checklist

According to the [Claude Startups page](https://claude.com/programs/startups), checked October 8, 2026, applicants need a Console account, company email matching their website domain, and a short product description. The page states startups founded within five years or funded within two years can apply; VC backing is not required. Benefits and eligibility can change. [Official terms](https://www.anthropic.com/startup-program-official-terms) leave approval to Anthropic and mention traction, funding, and Claude usage among evaluation factors. No published requirement guarantees acceptance for having a landing page.

Before another application:

- [ ] Confirm the company's founding date, genuine operator, and applicable supportability/eligibility requirements.
- [ ] Confirm ownership of `portion.my.id` and a functioning domain-matching inbox such as `contact@portion.my.id`. The source contains an address; delivery has not been proven.
- [ ] Use the correct company Claude Console account and consistent company/domain identity.
- [ ] Review founder identity, privacy contact/deletion handling, and public disclosures against actual operations.
- [ ] Deploy and inspect the improved site only after founder approval.
- [ ] Verify signup from a non-team email address; configure Supabase custom SMTP and confirmation/password-reset redirects.
- [ ] Verify the real deployed SQL migration, authentication, RLS and cloud save/reload; local SQL tests cannot certify a hosted project's state.
- [ ] Run a genuine own-account Indonesian-meal demonstration, review source/units, save, edit, and reload. Record a short product walkthrough with private account details concealed.
- [ ] Check the selected Gemini model/fallback and actual quota/billing terms. Keep request limits modest.
- [ ] If pursuing Claude evaluation, approve a staging budget and provider terms first; record measured results. Keep public/app provider descriptions synchronized.
- [ ] Gather legitimate user feedback/usage evidence. Report traction accurately, even if pre-revenue or no verified users.
- [ ] Check previous rejection notices for a specific verification problem. Website work alone cannot identify the reason.

## 12. Application draft

> Portion is an early-stage calorie and macronutrient journal focused on everyday Indonesian meals. Users describe what they ate in Indonesian or English, review ingredient and portion assumptions, and save meals to a daily journal. The product includes reusable meals, package-label entry, editable targets, and optional Supabase account sync. Nutrition sources remain visible: Gemini estimates are clearly distinguished from retrieved USDA FoodData Central records, Open Food Facts product records, and user-entered package labels.
>
> We want to evaluate Claude for mixed-language meal interpretation, household portion extraction, and clearer handling of uncertain recipes and weighing state. An optional server-side Claude adapter is prepared behind explicit enablement and shared request safeguards. It has not yet been evaluated against Gemini or enabled as the production default. We will use structured outputs and the existing unit/provenance validation, then assess parsing errors, review quality, latency, and cost on representative Indonesian meal descriptions before deciding whether to adopt it.

Use this draft only after confirming its current deployment status. Add truthful founding date, operating location, company identity, launch stage, traction, and business model wherever the form asks. Do not claim funding, customers or institutional backing unless substantiated.

## 13. Audit and remaining risks

| Priority | Initial finding | Local resolution / remaining action |
| --- | --- | --- |
| P1 | Authored demo portrayed as live and database-verified | Explicit sample disclosure, source labels, isolated editable portions |
| P1 | Unsubstantiated backing, quotation, metrics, pricing and future features | Removed from public page; founder evidence required to restore |
| P1 | Public website hidden by account/API failure | Public page and sample survive account-service failure; static prerender added |
| P1 | Modal lacked native focus containment; sign-in/signup mode reuse | Native dialog, unique title IDs, keyed mode, focus return and busy guards |
| P1 | www origin accepted different protocol or port | Origin validation fixed and regression-tested |
| P1 | README contradicted AI nutrition and runtime model/fallback | README/settings/setup corrected against code |
| P1 external | Public signup may be restricted by default email service | Needs actual SMTP, redirect and external-user verification |
| P1 external | Deployment/eligibility/business facts unverified | Founder actions above |
| P2 | No public privacy/terms or crawler-readable product proof | Static pages and prerendered product content added; operator review needed |
| P2 | Claude use case had no evaluation implementation or criteria | Disabled adapter, synthetic test matrix and comparative plan added |
| P2 external | No live comparative or nutrition ground-truth results | Requires approved API evaluation and independently verified recipes |
| P2 external | No self-service account deletion; snapshot/limit ceilings | Disclosed existing manual process; operator must support requests |

Decision: ready for local review and staging validation. **Do not mark the application ready for resubmission until the founder checklist's deployment, contact, eligibility, and real-user-flow items are resolved.** Approval remains Anthropic's decision.

## Verification record

Baseline: 46 tests passed. Updated suite: 53 tests passed, including Claude gating/auth/budget/input filtering, transport/provenance, errors, backup round-trips, origin protocol/port, and sample drink scaling. Production build and public prerender passed. A synthetic Claude-labelled drink saved, doubled from 240 mL / 132 kcal to 480 mL / 264 kcal, and retained its units and provenance after reload. Browser and deployment observations are recorded in [verification](verification.md).
