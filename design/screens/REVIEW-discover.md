# Self-review — Discover (build of mockup B)

Owner chose **B: tabs, cleaner** (`discover-mock-B.png`). Built:
`discover-built.png` — For you (top, scrolled), Channels, Topics (Light),
search with nothing found, Turkmen. Reviewed with the design-critique,
accessibility-audit and ux-writing skills plus a devil's-advocate pass.

## What changed
- **For you** opens first (it used to open on Channels). Today's video card
  is calmer — "TODAY · ANIMALS", the caption, one white Play button; the
  pulsing ember ring and equalizer are gone; the fade is SVG so it renders on
  every platform. Under it, a row of video posters per topic with "See all"
  (opens that topic). **Top 10 is gone** (a popularity ranking for children).
- **Channels** is one list: channel face, name, "54 videos · Animals,
  Nature", and a follow disc (+ / ✓). The row opens the channel; the disc is
  its own button (no button inside a button).
- **Topics**: tiles with their own tints (`topicTints`, no longer the lane
  colours), no counts.
- **Search with nothing found**: "No videos about “pen” yet — Try one of
  these:" with topic chips that have videos; the "Results" heading hides.
- System: `layout.poster`, `topicTints`, `MediaFade`, `VideoShelf`,
  `Chip.leading`, `EmptyState` children; SectionHeader centres "See all"
  with its title and uses tokens.

## Checks
- tsc clean; lint 654 (was 699 before Discover).
- axe: 0 in Dark and Light on For you, Channels, Topics and the empty search
  after fixes (segmented control now exposes `aria-checked`, decorative
  posters hidden, search clear button has a role). The only flag left is the
  search placeholder's rolling word mid-fade (transient; passes at rest).

## Scores
| Lens | Score |
| --- | --- |
| Design critique | 8 |
| Accessibility | 8.5 |
| UX writing | 8 |
| Devil's advocate | 7.5 — test family's lane has few videos, so For you shows 2 rows |

## Deferred
| Item | Where |
| --- | --- |
| More rows (New this week, channels you follow) once there's more content | Discover pass 2 |
| Rolling placeholder: honour reduce motion | next pass |
| Emulator + phone check | #32 / phone test |
