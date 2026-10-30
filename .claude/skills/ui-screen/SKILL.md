---
name: ui-screen
description: The mandatory pipeline for any Payhas screen or UI change — references, copy, mockups, owner gate, build, screenshots, design critique, accessibility audit, an independent reviewer-agent panel, emulator check and the tracker tick. Use it whenever you design, rebuild or polish a screen, sheet or component.
---

# UI screen pipeline (Payhas)

Every screen goes through **all** steps below, in order. A step may be
skipped only by writing *why* in the tracker row (`docs/UI_UX_WORKFLOW.md`,
Phase 5 table) — "ran out of time" is not a reason. Create one task per step
for the screen before starting, and tick each only with evidence (a file,
commit, screenshot or report).

The system it builds on: `DESIGN.md` (principles, tokens, components),
`src/theme/tokens.ts`, `src/components/ui/`, `/gallery`.

## 1. References — Mobbin connector
- `mcp__Mobbin__search_screens` / `search_flows` (platform ios) for this
  screen's patterns; 6–12 screens from best-in-class apps.
- Save the ones you use to the collection "Payhas — design direction"
  (`b5eb3b41-4b7a-444c-866a-ea44cea149f1`) with `save_content`.
- Write one line per reference: what to take.

## 2. Copy — `design-skills:ux-writing` skill
- Invoke the skill. Write every string the screen shows (titles, labels,
  empty/error/locked states, toasts, accessibility labels) in **EN, TK, TR,
  RU** (`src/i18n/strings/*.ts`). Durations: "45 min", "1 h", "1 h 15 min".
- Child screens: short, concrete, readable aloud. Never a price on a child
  screen.

## 3. Mockups — `superdesign:superdesign` skill (or the Figma connector)
- Invoke Superdesign first for 2–3 variants using the Payhas tokens and
  components. If it fails, record the exact error, then try the Figma
  connector (`mcp__Figma__*`); last resort, HTML mockups rendered with
  Playwright (`design/direction/mockups/src/`).
- Variants differ in layout, never in the system (same tokens/components).

## 4. 🚦 Owner gate
- Show the variants (Dark + Light) and a recommendation. Build nothing until
  the owner picks. Record the decision in the decision log.

## 5. Build — components and tokens only
- Only `src/components/ui/*`, `Segmented`, `LaneBadge`, `BottomSheet` and
  tokens. Missing piece → add it to the system (tokens + DESIGN.md + gallery)
  first.
- `npx tsc --noEmit` clean; `npx expo lint` adds no warnings (the design
  rule flags raw numbers and hex colours).

## 6. Screenshots
- `npx expo export --platform web`, serve with `scripts/audit/serve.js`,
  shoot with Playwright at 390×844 @2x in **Dark, Navy, Light**, plus the
  longest language (TK) and every state (empty, loading, locked, error,
  many items). Save to `design/screens/<screen>-built.png`. Look at every
  image before going on.

## 7. Critique — `design-skills:design-critique` skill
- Invoke it on the screenshots. Report: `design/screens/CRITIQUE-<screen>.md`
  (findings, severity, principle, fix, status).

## 8. Accessibility — `design-skills:accessibility-audit` skill
- Invoke it. Run axe-core on the web build (Dark + Light) — target **0
  violations** — and read the accessibility tree (Playwright `ariaSnapshot`).
  Report: `design/screens/A11Y-<screen>.md`.

## 9. Reviewer panel — independent subagents that push back
Spawn in parallel (Agent tool, background), each with the screenshots, the
code paths and DESIGN.md — **not** your own conclusions:
1. **Senior product designer** — polish, hierarchy, craft vs Mobbin refs; scores 1–10.
2. **Child-UX + accessibility + safety** — pre-readers, parents one-handed, TalkBack, dark patterns.
3. **Multilingual UX writer** (EN/TK/TR/RU, uses the ux-writing skill) — concrete string changes.
4. **Devil's advocate** — unfixed audit problems, undesigned states, distrust.

Every reviewer must give scores, ranked findings with exact fixes, and
explicit push-back. Synthesize into `design/screens/PANEL-<screen>.md`:
accepted / rejected (with a reason) / deferred (with a task). Fix the
accepted ones. If a reviewer scored below 8, run the panel again on the
fixed build.

## 10. Verify on Android
- Re-run steps 6 and 8 on the fixed build.
- Emulator: the GitHub Actions emulator job (Maestro flows) screenshots the
  APK; review those images. This container has no KVM — never claim an
  emulator run that didn't happen.
- The owner's phone test is the final check.

## 11. Tick
- Update the screen's tracker row with evidence links and the decision log.
  Commit with what changed and why; push to `plus` (it builds the APK).
