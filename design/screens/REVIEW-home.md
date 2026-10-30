# Self-review — Home feed (build of mockup A)

Owner approved **A: quiet icon column** (`home-mock-AB.png`). Built:
`home-built.png` (Dark, Follow toast, Light, Turkmen). Reviewed by the
builder with the design-critique, accessibility-audit and ux-writing skills
plus a devil's-advocate pass (owner asked for no subagents).

## What changed
- Counts (likes, saves, shares, reactions) hidden from every child lane;
  adults see them only when above zero.
- Follow is a labelled pill next to the creator ("Follow" / "Following"),
  confirmed with a toast "Following {name}" (4 languages); the tiny "+" badge
  on the avatar is gone. Avatar + name are one 48 px button.
- "A grown-up checked it's OK for {lane}" is on screen under the caption.
- Screen readers: no more "double tap to like" hints; the video exposes
  Like and More options as actions; it has a button role; the blurred
  backdrop and Following posters are hidden from screen readers.
- Saved is a filled white bookmark (was a lane colour as decoration).
- Every icon over video is pinned to `media` colours — in Light, send/more
  and the react pill used to take the page's dark text colour.
- Tokens only: `iconSize.feed` (28) added for the four actions; spacing,
  control and border tokens throughout.

## Scores
| Lens | Score | Notes |
| --- | --- | --- |
| Design critique | 8 | Matches A; one deviation below |
| Accessibility | 8.5 | axe 0 (Dark, Light); all actions 48×48 |
| UX writing | 8 | Toast copy gender-neutral in RU ("Теперь ты следишь за …") |
| Devil's advocate | 7.5 | see deferred |

## Deviation from the mockup (kept on purpose)
- The ☺+ react button stays under the caption: reactions are a live feature
  and the mockup didn't show where it would go. For children it shows no
  numbers.

## Deferred
| Item | Where |
| --- | --- |
| "Can't watch" line, clearer report icons, report reason "It's for older kids" | share/options sheets (#4, #5) |
| Lane chip at the top is 28 px tall (passes 24 px AA, below 48) | Home top bar, next pass |
| Unfollow has no Undo | next pass |
| Emulator + phone check of the feed | #32 / phone test |

## Round 2 — owner feedback (mockup `home-mock-v2.png`, approved)

| Owner point | Built |
| --- | --- |
| 1. Reaction to the right | ☺ is the 2nd action in the rail (under the heart); shows your emoji once you react; the picker opens beside the rail. The reaction pills under the caption are gone |
| 2. Remove "A grown-up checked…" | Removed from the feed (still in "Why this?") |
| 3. Icon instead of "Following" | After Follow, the pill becomes a tick; screen readers hear "Unfollow {name}" |
| 4. Icons never get lost | Bottom fade, rail glow and top fade redrawn in SVG (CSS gradients drew nothing on web) and tuned on a **pure white frame**: heart 3.7:1, react 5.4, save 6.5, send 7.0, more 7.5, caption 6.7, top tabs 5.4 (`home-built-v2.png`, last frame). Icons also carry a shape-following shadow (iOS layer shadow; drop-shadow filter on Android/web) |
| 5. Full size without UI | **Press and hold**: everything on the video and Home's top bar hide while held; release brings them back (Instagram Reels). The options menu lives on ••• only (screen readers keep it as an action) |

Checks: tsc clean, lint 699 (was 708), axe 0 in Dark and Light.

## Round 3 — full display (owner request)

Mockup `home-mock-fulldisplay.png`; owner chose **pinch** (one tap stays
mute / unmute): spread two fingers apart = full display, pinch them together
= the buttons come back. Built (`home-fulldisplay-built.png`):

- Full display hides every overlay, Home's top bar and the tab bar's
  contents (the bar keeps its dark place so the video doesn't jump). It stays
  on while swiping between videos; one tap still mutes / unmutes.
- A hint "Pinch in to bring the buttons back" shows for 2.5 s (4 languages).
- The list stops scrolling while two fingers are down, so a pinch doesn't
  drag the feed.
- Screen readers get a "Full display" / "Show buttons" action on the video.
- No new native module: the pinch is read from the view's own touch events.
- Press and hold still hides everything only while held.

Checks: tsc clean; pinch tested on the web build with real two-finger touch
events (out → full display, in → back).
