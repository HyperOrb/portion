# Portion brand and website direction

Portion is an early-stage food journal for people who describe everyday meals in Indonesian or English. Its promise is an understandable review of portions and nutrition sources before saving, not guaranteed nutritional accuracy.

Voice: practical, friendly, specific. Say “Review an AI estimate” and “Choose a database match.” Avoid “verified macros,” “auto-weighed,” speed promises, institutional endorsements without evidence, and health-outcome promises. Current functionality and possible future features must be distinguished.

## Reference lock

Direct-build target: the existing Portion journal and its `docs/design.md` lock. Preserve system sans typography, white surfaces, forest-green actions, quiet borders, and labeled nutrient colors. No new visual identity or external font is necessary.

Research: [Cronometer](https://cronometer.com/) for making the actual food-log workflow visible; [Linear features](https://linear.app/features) for a clear product-led hierarchy. Refero's bundled craft-details and copywriting references supply keyboard focus, native controls, explicit demo labels, and concrete action copy. UI UX Pro Max's “keyboard focus modal” search supports visible, unobscured focus; it supplements interaction implementation only.

| Decision | Source / role | Application |
| --- | --- | --- |
| Forest green, system sans, white canvas | Existing Portion design lock | Preserve the app's recognizable identity; green identifies primary actions |
| Asymmetric hero with product workflow | User brief; Linear product hierarchy | Explain the product alongside an honest sample, without ornamental stickers |
| Editable sample portions and macro totals | User brief; Cronometer food-log emphasis | Show the review task with g and mL, using Portion's existing calculation logic |
| Disclosure above and inside the walkthrough | Refero copywriting: conditions and proof | Samples are illustrative, never live AI or retrieved database records |
| Source explanation before signup | User brief: external reviewer access | Explain AI estimates, database records, and package labels without login |
| Native dialog and labeled input | Refero craft; UI UX accessibility search | Keyboard focus stays inside the dialog and returns on close |

Tokens: existing `--green`, `--green-dark`, `--green-light`, `--border`, `--muted`, `--protein`, `--carbs`, `--fat` remain semantic tokens. Marketing adds named canvas/ink/spacing primitives and component aliases in its scoped stylesheet. Accent color is for actions and selected states; nutrient colors remain nutrient-only. 44px minimum controls; responsive 320px–1440px. Media is code-native product UI, clearly labeled as sample. Reject looping gradients, ambient glows, emoji stickers, fabricated product screenshots, and unsupported social proof.

Visual review on October 8, 2026: the desktop hero, mobile hero, editable walkthrough, and account reset screen were inspected against this lock. Landing widths of 320, 390, 768, and 1440px had no horizontal overflow. Keyboard focus containment and return were checked in the native account dialog. This is a local visual/interaction review; production email delivery and real-provider accuracy remain separate checks.
