# Design critique — Play and Family (rebuilt)

Run with the `design-skills:design-critique` skill (Nielsen heuristics, UX laws,
Krug checks, content review), 2026-10-30.

## Context

- **Design:** Play tab (child) and Family dashboard (parent), rebuilt from the
  shared components — `play-built.png`, `family-built.png` (Dark · Navy · Light)
- **Fidelity:** live product (web build of the app)
- **Personas:** Play — a child aged 4–12 on the Free plan, some not yet
  reading. Family — a parent checking in for a few seconds, often one-handed.
- **Primary tasks:** Play — start a game. Family — see each child's day and
  act (pause, give time, change rules).
- **Posture:** both transient (seconds to a minute), so obvious UI and fast in/out.

## First impression (5-second scan)

| | Play | Family |
| --- | --- | --- |
| What is it about? | Games, with time left today | My child's day |
| Primary action | The featured game's Play button | Unclear — three equal buttons, plus an orange "Plus" badge pulls the eye |
| Where would I tap first? | The big Bubble Pop card | The orange Plus badge on "Add a child" |
| Confusing? | A wall of locks below the fold (Free plan) | "Rules" opens the whole child page, not rules |

Play: **clear**. Family: **mostly clear**.

## Findings

| # | Screen | Finding | Principle | Sev | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | Family | The **Plus badge is ember**, the loudest thing on the page, on a row that is not the main task. It also breaks "ember = do this". | Von Restorff · Visual hierarchy · Principle 1–2 | 2 | Badge `plus` tone becomes neutral with the sparkle icon. Ember stays for actions only. |
| 2 | Family | **"+15 min" grants time in one tap** with no way back. A parent can do it by mistake while scrolling. | H5 Error prevention · H3 User control | 2 | Keep the one tap (it's the common case) and add **Undo** to the toast. Same for **Pause**. |
| 3 | Family | **"Rules" opens the whole child page** (day, week, rules). The label promises less than it does, and the card tap already goes there. | H4 Consistency · Labels match destination | 2 | Rename to **"Details"**. One meaning: open this child. |
| 4 | Play | On Free, **6 of 10 games are locked**. Brain games and Puzzles become walls of locks and "Ask a parent", the first thing a child sees after Quick play. | H8 Minimalist · Goodwill · Serial position | 2 | Open games first in every section; locked ones after. |
| 5 | Family | The **live status is green next to the mint Kids badge**: two near-identical greens meaning different things (status vs age lane). | Law of Similarity · Principle 2 | 1 | Status text in `text2`; the live dot alone carries "now". |
| 6 | Family | **Subtitle is out of date**: "Tap someone to see their day and change their rules" describes the old list, not cards with buttons. | Content: useful · H2 | 1 | "Today at a glance. Tap a card for the full day." |
| 7 | Family | **Alerts row text is cut off** ("…Children…") right where it says children never get notifications, the privacy promise. | Content: responsible · Truncation | 1 | Let row sub-lines run to three lines. |
| 8 | Play | **Shelf tiles truncate** the lane line ("Tap the pals, skip the …"). | Overflow handled gracefully | 1 | Accept for now (name carries the meaning); revisit with a duration-only line when games expose duration. |

Severity: 0 none · 1 cosmetic/minor · 2 moderate · 3 major · 4 blocks the task.
Nothing at 3 or 4.

## What's working

- **One loud thing on Play.** The featured card and its single ember button are
  the clear entry (Von Restorff, Principle 1). The rest is tactile but quiet.
- **Shelves peek the next tile**, so horizontal scroll is discoverable (Jakob's law).
- **Family puts the number first.** "15 min of 1 h today" plus the bar answers the
  parent's question in one glance (Krug: self-evident). Actions sit on the card
  they affect (proximity, no navigational excise).
- **Same parts everywhere.** Cards, rows, buttons and badges are identical across
  both screens and all three themes (H4, Law of Similarity).
- **No prices on the child side.** Locked games say "Ask a parent" (goodwill,
  responsible content).

## Fix status

| # | Status |
| --- | --- |
| 1, 3–7 | Fixed in the same change as this report |
| 2 | Half fixed: **Pause** now has Undo on its toast. **+15 min** can't be undone yet — `grant_extra_time` only accepts 5–120 minutes and also posts "15 more minutes today" to the child, so an honest undo needs a new server function (`revoke_extra_time`) that removes both. |
| 8 | Deferred (needs a duration field per game) |
