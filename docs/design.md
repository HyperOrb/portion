# Interface reference lock

Brief: a personal, phone-browser food journal. The primary task is describe → clarify → select sourced food → review → save. Direct build is requested; no visual exploration gate.

Live Refero tools were unavailable. References: bundled Refero typography, color, craft-details and visual-workflow; [Cronometer](https://cronometer.com/) for visible macro summaries and custom-food reuse; [Linear](https://linear.app/features) for restrained product hierarchy. Adapt selected traits; do not reproduce either product.

| Decision | Reference / role | Application |
| --- | --- | --- |
| One system sans family, compact scale, tabular numbers | Refero typography: work interfaces prioritize scanning | Readable totals, no decorative display type |
| White surfaces, cool pale canvas, fine borders | Refero color: neutrals carry most of UI | Calm functional journal with lightly separated sections |
| Forest green primary action | Refero color: one accent serves actions | Meal review/save buttons and calorie progress |
| Three distinct macro colors | Brief requires three macro totals; Cronometer macro summaries | Protein teal, carbs amber, fat violet; used only in nutrient indicators |
| Entry is prominent, daily totals precede details | Brief and Cronometer food-log task | Summary → entry → meal list; usual meals secondary |
| Inline unresolved questions and source candidates | Brief review/clarification requirements | No interruptive clarification wizard; saving blocked until resolved |
| Native date input, 44px targets, visible focus | Refero craft-details | Phone touch, keyboard, screen-reader support |

Preserve: neutral canvas, clear hierarchy, one action accent, generous input, compact data. Borrow only food-log hierarchy from Cronometer and restrained borders from Linear. Media strategy: native SVG functional icons only; this is a work interface without imagery requirements. Reject: dashboard clutter, invented sample meals, decorative hero, scorekeeping or gym features.

Tokens: canvas #f5f7f6; surface white; text #202d27; secondary #626f68; accent #257457; border #e1e7e3; 12–20px radii, minimal shadows. Summary numbers carry visual weight; calorie track is the recurring recognizable detail.

## Rendered quality check

Compared the implementation with the reference lock at 1440px desktop and 390px/320px phone widths. The result preserves the neutral canvas, compact system type, source-first review, green action roles, and three nutrient indicators. Screenshots are in the ignored `output/playwright/` folder. Automated browser checks found no horizontal overflow at 320, 390, 768, and 1440px. Phone review fields, daily log, native date control, labels, backup confirmation, and usual-meal buttons remained usable. No unresolved P0/P1/P2 visual findings.

## Personal guidance extension

The existing interface is the direct-build target for this small extension. Refero's bundled copywriting guidance keeps labels and balances descriptive; the user's NutriTrack ID brief supplies a short Indonesian greeting, mixed-language entry guidance, and a protein nudge. Preserve the same neutral surfaces, type, touch controls, macro colors, and review flow. Add remaining macro amounts under their current targets, a quiet protein note below entry, and projected balances in the existing review sidebar. No new chat screen, avatar, imagery, or navigation is needed. The preset belongs beside the existing target form; all arithmetic and feedback use saved source data.

## Account extension

The existing Portion interface remains the direct-build target. Reuse its panels, system font, green actions, and native labeled inputs for a single centered sign-in form. Account management and device import belong in Settings; the primary meal flow and three-link navigation stay intact. Show explicit connection and save states using the existing notices. Preserve journal privacy on sign-out and surface stale-save conflicts with export/reload actions. Phone sign-in was rendered and inspected at 390px, with overflow checks at 320, 390, 768, and 1440px. Cloud Settings uses the existing stacked mobile panels.

## Shared-use and local-food extension

The current Portion interface is the direct-build reference. Refero copywriting guidance calls for orientation, status, and the next action. Remove the fixed user's name and personal preset; explain zero targets in the existing Settings form, with a reset action. Use the existing native select for the nutrition database and existing candidate buttons for package results. Each candidate names its source and product; an empty result asks for the exact product or a reusable label. Preserve the current canvas, typography, input sizes, and review/save sequence. No new navigation, images, or account profile form.
