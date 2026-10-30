# Reviewer panel — Tab bar (round 1, on the built B)

Four independent reviewer agents, run in parallel on 2026-10-30 with the
before/after screenshots, both mockups, the code and DESIGN.md.

Before: `tabbar-before.png` · Options: `tabbar-mock-A.png`, `tabbar-mock-B.png`
(owner picked **B**) · Built: `tabbar-built.png`, `tabbar-built-bottom.png`,
`tabbar-langs-360.png`.

## Scores (before fixes)

| Reviewer | Score |
| --- | --- |
| Senior product designer (design-critique skill) | polish 7 |
| Child-UX + accessibility (accessibility-audit skill) | a11y 8 · child UX 6 |
| UX writer (ux-writing skill) | EN 9 · RU 7 · TR 6 · TK 5 |
| Devil's advocate | readiness 6 |

Builder's own checks: axe-core on the tablist **0 violations** in Dark, Navy
and Light; the selected tab is now exposed (`aria-selected`, `[selected]` in
the accessibility tree) — it wasn't before (TabTrigger props overrode it).

## Accepted and fixed

| From | Fix |
| --- | --- |
| Devil | **Bug:** Android 3-button nav buttons were light on the light bar. `NavigationBar` now follows the bar (dark buttons on a light bar) |
| Devil | **Bug:** Maestro tapped tabs by text — "Play" also matches the Discover hero's Play button. Tabs have `testID="tab-<kind>"`, the flow taps by id |
| Devil | **Bug:** the bar stayed dark under Home's time-up lock and the empty Following feed. Home now reports whether a video is really on screen (`useReportVideoUnderBar`) |
| Designer | **Bug:** any non-tab path lit Home's pill. Tabs match by prefix (`tabIndex`); off the tabs there is no pill |
| Designer, a11y | Bar cross-fades between page and video colours (`duration.fast`, off with reduce motion) instead of a one-frame flip |
| Designer, devil | Feed chrome had its own inset (`FEED_CHROME_BOTTOM` = `space.xl`); no hairline over video, so progress line and bar edge don't stack |
| Designer | Rhythm: bar 64 → 68, pill-to-label gap 2 → `space.xs` |
| Designer | Invented values removed: icon `iconSize.lg`, `spring.tabPill`, `tabStretch` tokens; stretch capped at 1.3 (was up to 1.55, sweeping over neighbours) |
| Designer | Selected label no longer changes weight (width jumped); selection = pill + filled icon + `text` colour |
| A11y | Unread dot ringed in the pill's ink when Inbox is selected (was 2.8:1 on the pill) |
| A11y (AADC nudge) | Unread dot is calm (no bounce) and hidden in the Little lane |
| A11y | Haptic on press, not press-in (cancelled presses no longer buzz) |
| A11y, designer, devil | Labels shrink to fit (`adjustsFontSizeToFit`, min 0.85) instead of cutting off at 1.3× text |
| Devil | Me had double bottom padding; Toast lifted 64 dp above nothing off the tabs — now only on tab routes |
| Writer | TK "Hatlar" (letters) → **Habarlar**, TK Discover **Gözle** (= page title), TR "Mesajlar" (implies chat) → **Bildirimler**, RU Play **Игры** (= page title); Inbox titles match the tabs; RU unread announcement names the noun |
| Designer | DESIGN.md: Elevation, Shapes and Navigation sections rewritten for the docked bar |

## Rejected (with reason)

| Suggestion | Why not |
| --- | --- |
| TK Home "Baş sahypa" → one word ("Öý") | "Baş sahypa" is the standard Turkmen term; it fits at 360 px and shrinks to fit at large text. "Öý" reads as "house". |
| RU Inbox "Почта" | "Входящие" fits and matches the page title. |
| Keep the video under the bar for immersion | The owner chose docked B with the trade-off shown in the mockups; content never hides behind chrome. |
| Raise the text-scale cap to 1.5 | Five labels share 72 px; 1.3 with shrink-to-fit keeps them whole. The screens themselves scale fully. |

## Deferred (tasks)

| Item | Where |
| --- | --- |
| Little lane: long-press a tab to hear its name; clearer Discover/Inbox icons for pre-readers | new task |
| TalkBack/VoiceOver pass ("Home, tab, 1 of 5, selected") | owner's phone test |
| Keyboard over Discover search: bar must not ride up | emulator run |
| iOS large-content viewer on tabs | new task |
