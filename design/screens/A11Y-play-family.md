# Accessibility audit — Play and Family (rebuilt)

Run with the `design-skills:accessibility-audit` skill, 2026-10-30. Target:
WCAG 2.2 AA, mobile. Method adapted to a React Native app: the web build is
what can be scanned here; on the phone, TalkBack/VoiceOver use the same
accessibility props.

## Layers run

| Layer | How | Result |
| --- | --- | --- |
| 1 Automated | axe-core 4.10 (wcag2a/aa, 2.1aa, 2.2aa) on the web build, Dark and Light | 5 rules failing → **0** after fixes |
| 2 Keyboard | Not applicable on phones; web tab order follows reading order | — |
| 3 Screen reader | Browser accessibility tree (what a screen reader announces) | 4 problems → fixed |
| 4 Visual | Token contrast (all text pairs AA, checked in Phase 3); touch targets | Pass; small buttons hit-slop to 48 |
| 5 Flow | Pause/undo, locked games, time limits | See notes |
| On device | TalkBack on the test APK | **Not done yet** — needs the phone |

## Findings and fixes

| # | Issue | WCAG | Severity | Fix |
| --- | --- | --- | --- | --- |
| 1 | Progress bars had no name | 1.1.1, 4.1.2 (A) | High | `ProgressBar` now requires `label` ("60 min left today", "Aylar: 15 min of 1 h today") |
| 2 | Switch had no state (`aria-checked`) and a second unnamed switch inside the row | 4.1.2 (A) | Critical | Row carries role, name and `aria-checked`; the drawn `Toggle` is hidden from assistive tech |
| 3 | Tabs outside a tab list | 1.3.1, 4.1.2 (A) | Critical (axe) | Tab bar is `tablist` |
| 4 | Buttons nested inside pressable cards (featured game, child card) | 4.1.2 (A) | High | Child card: the header row is the link, the buttons stand alone. Featured: the art stays a big tap target but is hidden from screen readers; the Play button is the one control |
| 5 | Game scenes read aloud as emoji ("🐸 🐥 🐼 🦊") | 1.1.1 (A) | Moderate | Scenes are decorative and hidden; tiles carry the name |
| 6 | Every heading was level 1 | 1.3.1 (A) | Moderate | Section and group titles are level 2 |
| 7 | Lane badge on the card announced as a disabled "Switch profile" button | 4.1.2 (A) | Moderate | Badge is a button only when it does something |
| 8 | Card buttons named "15 min", "Pause" with no child | 2.4.6 (AA) | Moderate | Names include the child: "Pause: Aylar", "+15 min for Aylar today", "Details: Aylar" |

## Notes

- Contrast: every text/background token pair passes 4.5:1 in all three themes
  (Phase 3); axe found no contrast failures.
- Switch off-state track is close to the card colour; the white knob's
  position carries the state (non-text contrast of the knob is high).
- Motion: entrances and the live dot honour reduce-motion.
- Still to do: TalkBack pass on the APK; check text at 200 % system font size.
