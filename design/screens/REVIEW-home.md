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
