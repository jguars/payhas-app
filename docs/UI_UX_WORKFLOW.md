# UI/UX Workflow — Payhas

> Instance of the ONKI template (`jguars/ONKI-Games-Projects` → `Mercury/ui-ux-workflow/UI_UX_WORKFLOW_TEMPLATE.md`). Claude ticks steps here as they're done.

A system-first design workflow for any app or site built with Claude Code.
Copy this file into a project as `docs/UI_UX_WORKFLOW.md`, fill in the header,
and work top to bottom. Claude ticks each step when it is done and links the
proof.

**Why this order:** products look cheap when screens are styled one by one.
Every screen looks fine alone, but nothing matches across screens. Here the
look is decided once (direction → system → components), checked visually
before code, and every screen is built from the same parts. Claude **looks at
screenshots** of every change, not just the code.

---

## Project header

| Field | Value |
| --- | --- |
| Project | Payhas — short videos and games for families |
| Platform | Android and iOS (phones; tablets later) |
| Stack | Expo SDK 57 + React Native, Expo Router, Supabase |
| Audience | Children in four age lanes (Little, Kids, Teen, Adult) and their parents, Turkmenistan first; EN / TK / TR / RU |
| Design owner (approves gates) | Guvanch |
| Where the system lives | `DESIGN.md`, `DESIGN_V2.md`, `src/theme/tokens.ts`, `src/components/ui/` |
| Started | 2026-10-30 |

## How ticking works

- `- [ ]` open · `- [x]` done · `- [~]` in progress · `- [-]` skipped on purpose (say why)
- Every tick has **evidence** after the em dash: a commit, file, screenshot
  board, Figma link or decision note. No evidence, no tick.
- **Gates (🚦)** need the design owner's approval in chat. Claude doesn't
  start the next phase until the gate is approved, and records who approved
  and when.
- Steps marked *(optional)* can be skipped with `[-]` and a reason.

## Toolbox

Name what's available in each project; strike out what isn't.

| Tool | Kind | Used for |
| --- | --- | --- |
| **Mobbin** | connector (MCP) | Real screens and flows from top apps: `search_screens`, `search_flows`, `search_sections`, collections |
| **Figma** | connector (MCP) + skills | Source of truth for tokens and components; design-to-code; code-to-design. Skills: `figma-use`, `figma-generate-library`, `figma-generate-design`, `figma-design-to-code`, `figma-code-connect` |
| **Superdesign** | skill `superdesign:superdesign` | Fast visual variants of a screen or flow, compared across models, using the design system |
| **Design skills** | skills `design-skills:*` | `ux-strategy`, `ux-research`, `design-systems`, `design-critique`, `interaction-design`, `accessibility-audit`, `ux-writing`, `journey-mapping`, `design-ops` |
| **Design plugin** | skills `design:*` | `user-research`, `research-synthesis`, `design-system`, `design-critique`, `accessibility-review`, `ux-copy`, `design-handoff` |
| **Asset generators** | connectors / skills | Illustrations, icons and empty-state art in one style: Layer.ai (trained style models, sprite sheets), Higgsfield (images, video), `image-generation` skill (prompting) |
| **Headless browser** | Playwright + Chromium (pre-installed in cloud sessions), `run` skill | Run the app (web build or simulator) and screenshot every screen, theme and state |
| **Review boards** | Artifact pages / Claude Docs | Side-by-side screenshot boards and decision records the owner can open on a phone |
| **Code quality** | skills `code-review`, `simplify`; repo lint rules | Enforce "components and tokens only" |
| **Marketing** *(later)* | Canva, Figma, Higgsfield | Store screenshots, social assets, brand checks (`canva:brand-check`) |

---

## Phase 0 — Kickoff

- [ ] **0.1 Fill in the project header** and list the available tools (connect
  missing connectors now) — _tools: claude.ai Settings → Connectors_
- [x] **0.2 Write the product brief in one page:** problem, audience, the
  three jobs users hire the app for, and constraints (platforms, languages,
  accessibility, brand). — _skills: `design-skills:ux-strategy`,
  `product-management:write-spec`_ — `docs/PRODUCT_DOCUMENTATION.md`, `PRODUCT.md`
- [ ] **0.3 List every screen and state** (a screen inventory: empty,
  loading, error, locked and success states included). — _skills:
  `design-skills:journey-mapping`; output: `docs/screens.md`_
- 🚦 **Gate 0:** the owner approves the brief and the screen inventory.

## Phase 1 — Audit (skip for a brand-new product)

- [~] **1.1 Make screenshots possible:** get the app rendering in a headless
  browser (web build) or simulator. Write a script that opens every screen.
  — _tools: Playwright, `run` skill; output: `scripts/screens.(ts|js)`_ — web export + `scripts/audit/serve.js`, `shoot.js`; test family `payhas-audit@example.com`; videos blocked (media host not allowed yet)
- [~] **1.2 Screenshot every screen** in every theme, language with the
  longest strings, and key state. — _output: `design/audit/<date>/`_ — 5 boards in `design/audit/2026-10-30/`; still missing videos, sheets, locked states, other lanes
- [x] **1.3 Build the audit board:** all screens on one page, grouped by
  pattern (headers, cards, lists, buttons, sheets, empty states). —
  _tools: Artifact page_ — `board-*.png` in `design/audit/2026-10-30/`
- [x] **1.4 Count the drift:** distinct colours, font sizes and weights,
  spacing values, radii, shadows, button styles and icon styles in the code.
  — _tools: grep script; skill: `design-skills:design-systems` (audit)_ — `design/audit/2026-10-30/AUDIT.md` (33 radii, 26 raw spacings, 57 heights, 33 hand-built buttons)
- [x] **1.5 Run a heuristic critique** of the board: the top 10 problems,
  ranked. — _skills: `design-skills:design-critique`,
  `design-skills:accessibility-audit`_ — top 10 in `AUDIT.md`
- 🚦 **Gate 1:** the owner agrees on what's wrong. — ✅ approved by Guvanch, 2026-10-30 ("start Phase 2")

## Phase 2 — Direction

- [x] **2.1 Choose the feeling in three to five words** (e.g. "calm, warm,
  playful, trustworthy") and 2–3 apps it should sit next to. — _owner +
  Claude, `design-skills:ux-strategy`_ — warm · playful · safe · calm; one system, two volumes (Cinema-night feed, Playroom child areas, Calm-studio parent areas); approved 2026-10-30
- [x] **2.2 Collect references per pattern, not per screen:** 20–40 screens
  across onboarding, home, lists, cards, detail, settings, paywall, empty
  states, sheets and forms. Save them to a Mobbin collection named after the
  project. — _Mobbin: `search_screens`, `search_flows`,
  `create_collection`, `save_content`_ — Mobbin collection "Payhas — design direction" (21 screens): https://mobbin.com/collections/b5eb3b41-4b7a-444c-866a-ea44cea149f1
- [x] **2.3 Build the mood board:** references side by side with one line
  each on *what to take*. — _Artifact page or Figma board_ — `design/direction/{A-playroom,B-calm,C-cinema}.png` + `DIRECTION.md`
- [x] **2.4 Write the design principles:** 4–6 rules that settle arguments
  (e.g. "one primary action per screen", "colour means identity, never
  decoration"). — _skills: `design-skills:design-critique`,
  `design-skills:ux-strategy`; output: top of `DESIGN.md`_ — "Night-Light Playroom" in `DESIGN.md`; 6 principles approved, top of `DESIGN.md`
- [~] **2.5 Explore 2–3 visual directions** on the same 2 key screens. —
  _skill: `superdesign:superdesign` (variants across models) or Figma_ — direction chosen first (2.1), so 2 variants of it on Play and Family: `design/direction/mockups/` (HTML in `src/`, real fonts and art, Dark + Light). Figma not used: its connector can't connect from this session. Superdesign not tried (no skill invoked; mockups hand-built in HTML instead). Awaiting Gate 2
- 🚦 **Gate 2:** the owner picks one direction. — ✅ Guvanch, 2026-10-30: Play B (featured game + shelves) with Brain games as a grid, Family B (child cards) — `design/direction/mockups/play-approved.png`

## Phase 3 — Design system: foundations (tokens)

Everything here is written once, in code **and** in Figma if Figma is used,
with the same names.

- [x] **3.1 Colour:** semantic tokens (bg, surface 1–3, line, text 1–3,
  primary, on-primary, success, warning, danger, info), one set per theme,
  with AA contrast checked for every text/background pair. — _skills:
  `design-skills:design-systems`, `design-skills:accessibility-audit`_ — AA check of every text/background pair in 3 themes; fixed Navy text3, Light text3/status colours, added `emberText`, split lane fill/text — `design/tokens-board.png`
- [x] **3.2 Type:** at most 2–3 families and 4–6 faces; one size scale of
  about 8–9 steps, with a line height per step; letter-spacing per step,
  not per screen; Cyrillic/CJK fallbacks if needed. — _output:
  `theme/tokens` `font`, `size`, `leading`, `tracking`_ — `0dc04e4` (3 families, 6 faces, 9 sizes) + `leading`, `tracking`, `type.*` presets; Mono limited to codes
- [x] **3.3 Spacing:** one 4- or 8-point scale (e.g. 4 8 12 16 24 32 48),
  plus screen gutters and section gaps. — _`space` tokens_ — `layout.gutter`, `layout.section` added; screens move onto it in Phase 4–7
- [x] **3.4 Shape:** at most 3–4 radii (small, medium, large, pill) and
  border widths. — _`radius`, `border` tokens_ — `radius.sm/md/lg/pill`, `border.hairline/strong`, `control.sm/md/lg`
- [x] **3.5 Elevation:** tonal layers first; 1–2 shadows at most, named. —
  _`elevation` tokens_ — `elevation.ledge`, `ledgeButton`, `float`
- [x] **3.6 Motion:** 2–3 durations, 2–3 springs/easings, stagger, and the
  reduce-motion rule. — _skill: `design-skills:interaction-design`;
  `motion` tokens_ — `duration.fast/base/slow` added to `motion.ts`
- [x] **3.7 Iconography:** one icon set or one drawing style (stroke width,
  corners, grid size), with sizes taken from the type scale. — _tools: Layer.ai
  or Higgsfield for custom sets; `image-generation` skill_ — `iconSize`, `iconStroke()`; audit found 21 sizes and 21 stroke widths; emoji interests to be replaced in 7.4
- [-] **3.8 Mirror the tokens in Figma** as variables with modes per theme
  *(optional if no Figma)*. — _skills: `figma-use`,
  `figma-generate-library`_ — Figma connector can't connect from this session
- [x] **3.9 Write `DESIGN.md`:** principles, every token with its use, and
  do/don't examples. — _skill: `design:design-system`_ — Tokens section in `DESIGN.md`
- 🚦 **Gate 3:** the owner approves the tokens from a token board (swatches,
  type ramp, spacing, radii on one page). — ✅ Guvanch, 2026-10-30

## Phase 4 — Design system: components

- [x] **4.1 List the core components** from the screen inventory. A typical
  set: Button (primary / secondary / quiet / destructive), IconButton, Card,
  ListRow, SectionHeader, Badge/Chip, Input, Toggle, SegmentedControl,
  Sheet, Dialog, Toast, ScreenHeader, TabBar, Avatar, EmptyState,
  Skeleton. — _skill: `design-skills:design-systems`_ — 15 components listed in `DESIGN.md` → Components
- [x] **4.2 Specify each component:** anatomy, variants, sizes, states
  (default, pressed, focused, disabled, loading, error), and tokens used. —
  _skill: `design:design-handoff`_ — variants, states and rules table in `DESIGN.md` → Components
- [x] **4.3 Build them in code**, using tokens only, in one folder
  (`components/ui/`). — _Claude Code_ — new: Button, IconButton, Card, ListGroup/ListRow, Badge, TextField, ProgressBar, PageHeader, EmptyState; updated to tokens: Chip (inverse selected), Segmented (inverse pill, no mono), Toggle (white knob), LaneBadge (filled/media), tab bar (neutral, inverse active), error text → danger
- [x] **4.4 Build a component gallery screen** (dev-only route) that shows
  every component in every variant and state, in all themes. — _Claude Code_ — `src/app/gallery.tsx` (route `/gallery`)
- [x] **4.5 Screenshot the gallery** in each theme and review it. — _Playwright;
  skills: `design-skills:design-critique`, `design-skills:accessibility-audit`_ — `design/components-gallery.png`, Dark · Navy · Light
- [-] **4.6 Build them in Figma** too and link code ↔ Figma *(optional)*. —
  _skills: `figma-generate-library`, `figma-code-connect`_ — Figma connector can't connect from this session
- [x] **4.7 Enforce the system:** lint rules ban raw colours, font sizes,
  spacing and radii outside `theme/` and `components/ui/`, and ban
  hand-built buttons and cards. Add a rule to `CLAUDE.md`/`AGENTS.md`: "screens
  use components and tokens only". — _eslint `no-restricted-syntax`;
  skill: `code-review`_ — `no-restricted-syntax` in `eslint.config.js` flags raw sizes/spacing/radii/hex on screens (434 warnings = drift to remove in Phases 6–7, then error); rule added to `AGENTS.md`
- 🚦 **Gate 4:** the owner approves the component gallery. — ✅ Guvanch, 2026-10-30

## Phase 5 — Screens: design before code

> Per screen, Phases 5–6 run as the **`ui-screen` skill** (`.claude/skills/ui-screen/SKILL.md`):
> every step is a task, every skill and connector is used, and an independent
> reviewer-agent panel (designer, child-UX/a11y, UX writer, devil's advocate)
> judges the build and pushes back before it is ticked.

Repeat for each screen or flow, starting with the 4–6 that matter most.

- [ ] **5.1 Pull references** for this screen's patterns from the project
  collection (add more if needed). — _Mobbin_
- [ ] **5.2 Write the copy first:** headings, labels, empty/error text, in
  every language. — _skills: `design-skills:ux-writing`, `design:ux-copy`_
- [ ] **5.3 Mock up 2–3 variants** using only system components. — _skill:
  `superdesign:superdesign`, or Figma (`figma-generate-design`)_
- [ ] **5.4 Critique the variants** against the principles and pick one. —
  _skill: `design-skills:design-critique`_
- 🚦 **Gate 5 (per screen):** the owner approves the mockup.

Per-screen tracker (copy a row per screen). Built screens: `design/screens/*-built.png` (Dark · Navy · Light); reviews: `design/screens/CRITIQUE-*.md` (`design-skills:design-critique`), `design/screens/A11Y-*.md` (`design-skills:accessibility-audit` + axe-core).

| Screen | Refs | Copy | Mockup | 🚦 | Built | QA | Shipped |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tab bar | [x] | [x] | [x] HTML (Figma limit) | [x] B | [x] | [x] critique + a11y (axe 0) + panel ×4, fixes in | [ ] emulator + phone test |
| Home (feed) | [x] | [x] | [x] HTML | [x] A | [x] | [x] self-review (skills), axe 0 | [ ] emulator + phone test |
| Discover | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Play (games) | [x] | [x] | [x] | [x] Gate 2 | [x] | [x] critique + a11y (axe 0) + panel ×4 (beta: yes) | [ ] phone test |
| Me | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Who's watching | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Family dashboard | [x] | [x] | [x] | [x] Gate 2 | [x] | [x] critique + a11y (axe 0) + panel ×4 (beta: yes) | [ ] phone test |
| Child page | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Payhas Plus | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Edit profile | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Onboarding + consent | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Sign in / Language | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Phase 6 — Build and visual QA loop

- [ ] **6.1 Build the screen from components only** (no new one-off
  styles; if something is missing, add it to the system first). — _Claude
  Code; skill: `figma-design-to-code` if built from Figma_
- [ ] **6.2 Screenshot it** in every theme, the longest language, small and
  large phone, large system font, and each state. — _Playwright / `run`_
- [ ] **6.3 Compare with the approved mockup** and fix differences until it
  matches. — _Claude reads the screenshots_
- [ ] **6.4 Accessibility pass:** contrast, touch targets ≥ 44–48 pt, labels
  and roles, focus order, reduce motion, dynamic type. — _skills:
  `design-skills:accessibility-audit`, `design:accessibility-review`_
- [ ] **6.5 Code review:** tokens only, no duplicated components. — _skills:
  `code-review`, `simplify`; lint clean_
- [ ] **6.6 Device test:** the owner tests a build on a real phone and
  approves. — _test build / TestFlight / APK_

## Phase 7 — Sweep and polish

- [ ] **7.1 Move every remaining screen** onto the components (use the
  tracker above). — _Claude Code_
- [ ] **7.2 Delete dead styles** and one-off components; drift count from
  1.4 should be close to the token counts. — _grep script, `simplify`_
- [ ] **7.3 Motion and micro-interactions:** press states, transitions,
  loading and success feedback, all from motion tokens. — _skill:
  `design-skills:interaction-design`_
- [ ] **7.4 Illustrations and empty states** in one style. — _Layer.ai /
  Higgsfield, `image-generation` skill_
- [ ] **7.5 Final audit board:** re-run 1.2–1.3 and put it beside the
  original. — _Playwright, Artifact page_
- 🚦 **Gate 7:** the owner signs off the before/after.

## Phase 8 — Keep it consistent (ongoing)

- [ ] **8.1 Every new feature** starts at Phase 5 (refs → copy → mockup → 🚦)
  and uses existing components first.
- [ ] **8.2 Change the system, not the screen:** a new pattern is added to
  tokens/components and `DESIGN.md` first, then used.
- [ ] **8.3 Screenshot regression:** re-run the screen script before each
  release and compare it with the last approved set. — _Playwright_
- [ ] **8.4 Quarterly design review:** critique, accessibility audit, update
  references. — _design skills, Mobbin_
- [ ] **8.5 Store and marketing assets** come from the same system. —
  _Canva / Figma / Higgsfield, `canva:brand-check`_

---

## Decision log

| Date | Decision | Why | Approved by |
| --- | --- | --- | --- |
| 2026-10-29 | Three themes: Dark (default), Navy, calm Light | Owner request; less eye strain than pure black or white | Guvanch |
| 2026-10-29 | Type: 3 families, 6 faces, 9 sizes | Font audit found 22 sizes and 7 faces | Guvanch (asked for it) |
| 2026-10-30 | Adopt this system-first workflow for all UI work | Screens looked inconsistent ("AI slop") | Guvanch |
| 2026-10-30 | Home A: quiet icon column, no counts for children, Follow pill + toast | Familiar layout, more picture; numbers are a nudge for kids | Guvanch |
| 2026-10-30 | No subagents; mockup approval before any build | Owner: little help from helpers | Guvanch |
| 2026-10-30 | Tab bar B: docked, labelled, dark over video on Home | Content slid under the floating pill; no words for parents; Light turned it pale over video | Guvanch |
| 2026-10-30 | Gate 2: Play B with Brain games grid, Family B | Clear single action for kids; parents act without opening a screen | Guvanch |
| 2026-10-30 | Tokens: AA everywhere, one selected style (inverse), disabled = surface2 + text3, errors = danger, Mono only for codes | Audit problems 1, 3, 5 | Guvanch (Gate 3) |
| 2026-10-30 | Direction: one system, mixed volumes; feeling warm · playful · safe · calm; 6 principles | `design/direction/DIRECTION.md` | Guvanch |
| 2026-10-30 | Gate 1: audit findings accepted | Top 10 in `design/audit/2026-10-30/AUDIT.md` | Guvanch |

## Rules Claude follows in this workflow

1. **No screen code before its mockup is approved** (except Phase 1 audit
   scripts and Phase 4 components).
2. **Never invent a value.** If a colour, size, spacing or radius isn't a
   token, stop and propose adding it to the system.
3. **Look before reporting.** Every UI change is screenshotted and checked
   before it's called done.
4. **One primary action per screen**, unless the principles say otherwise.
5. **Tick only with evidence**, and keep the per-screen tracker current.
