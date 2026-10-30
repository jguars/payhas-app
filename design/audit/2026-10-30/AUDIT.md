# Design audit — 2026-10-30 (Phase 1)

Web export (`npx expo export --platform web`, env from `.env.local`) served by
`scripts/audit/serve.js` and shot with Playwright at 390×844 @2x, signed in as
the test family `payhas-audit@example.com` (parent Guvanch + child Aylar, Kids
lane, Free plan).

**Boards**

| Board | What |
| --- | --- |
| `board-signed-out.png` | Language, sign-in — Dark, Navy, Light, Russian |
| `board-onboarding.png` | Welcome → PIN → name → consent → child (name, birth, interests, mix, time) → review |
| `board-app-dark.png` | Who's watching, Home, Discover, Play, Inbox, Me |
| `board-themes.png` | Me and Discover in all three themes, Family dashboard Dark/Light, Home in Light |
| `board-parent.png` | PIN, Family dashboard, child page, Plus (top + payment), Edit profile — Dark and Light |

**Limits of this pass:** videos and thumbnails are empty because the media
host (`payhas-media.guvanch-site.workers.dev`) is still blocked for this
session. Emoji glyph errors and the missing Navy page gradient may be
web-only — confirm on the phone.

## Drift in the code (step 1.4)

Counted outside `src/theme/`:

| Property | Distinct values | Uses | Should be |
| --- | --- | --- | --- |
| Corner radius | 33 | 167 | 4 (`radius` has 12 / 20 / 28 / pill) |
| Raw padding / margin / gap | 26 | 257 | 0 — the `space` scale (7 steps) |
| Height / minHeight | 57 | 231 | 3–4 control heights (e.g. 44 / 48 / 56) |
| Letter-spacing | 18 | 52 | one per type step |
| Line height | 13 | 33 | one per type step |
| Border width | 6 | 108 | 2 (hairline, emphasis) |
| Raw font sizes (games, avatars) | 12 | 24 | computed only, documented |
| Raw colours (hex + rgba) | 16 | 21 | tokens with alpha |
| Hand-built ember buttons / fills | — | 33 | one `Button` component |
| UI components in `components/ui/` | 6 (Avatar, Chip, IconCircle, NavIcon, SectionHeader, TopicIcon) | — | ~15: no Button, Card, ListRow, Input, Badge, EmptyState |

**Reading:** the tokens exist, but screens bypass them. Every screen builds
its own buttons, cards and rows, so no two match exactly. That is the
"cheap" feeling.

## Top 10 problems (step 1.5, ranked by impact)

1. **No shared components, so nothing matches.** Every screen builds its own buttons, cards, rows and pickers. There are at least **five different "selected" styles**: ember border + ledge (language), white fill (year/month chips), lane-colour fill (learning-or-fun), dark fill (segmented controls), ember fill (avatar ring). A user can't learn what "selected" looks like.
2. **The tab bar changes colour on every tab** (ember, blue, mint, yellow, purple). It reads as random and breaks our own rule that lane colours mean *age lane*, nothing else.
3. **The mono font is everywhere** — stats, durations, card fields and placeholders, "Free", limit chips, times — so the app feels technical, not warm. Durations are also written five ways: `0m of 1h 0m`, `60 min`, `0 / 60 min today`, `1h 0m left`, `8pm–7am`.
4. **Light theme has broken spots:** a hard-coded dark band behind the Me header (lane pill and "Joined" unreadable), a white tab bar over the dark Home feed, a black switch knob.
5. **Disabled primary buttons are unreadable** (maroon on dark, salmon on light) on every Continue, Sign in and Pay.
6. **Five header patterns:** big left title (Discover, Play, Inbox, Family), small centred title (Plus, Edit profile), no title (Me, Who's watching), question title (onboarding), wordmark (sign-in). The back button appears on some onboarding steps and not others.
7. **Three text-input styles** — borderless giant text with a browser outline (onboarding names), filled box (sign-in, Edit profile), mono boxes (card payment) — and the **CVC field overflows** the Plus page card.
8. **Brand isn't fixed:** "Payhas" vs "payhas", lane bars used as decoration on some screens only, the Plus hero has its own look.
9. **Mixed icon languages:** emoji interests (broken glyphs on web), line icons, filled channel icons, and DESIGN.md's hand-drawn stickers — four styles.
10. **Layout slips:** Plus comparison values wrap to three lines; "Add a child" shows a truncated limit note but still looks tappable; "Who's watching" offers "Add profile" at the limit; the "Pause now" pill hugs its text; Discover hero name truncates ("Payhas ...").

## Seen on the signed-out screens

1. **Two different wordmarks.** Language screen: "Payhas", left-aligned,
   with lane bars. Sign-in: "payhas" lowercase, centred, no bars. The brand
   should look the same everywhere.
2. **Two different screen layouts.** Language is top-aligned; sign-in floats
   in the vertical centre with large empty space above and below.
3. **Disabled primary button is unreadable.** Ember at 40 % opacity turns
   maroon on Dark/Navy and salmon on Light; the ink label nearly disappears.
   Needs a real disabled style (surface fill and muted text).
4. **Russian falls back to a serif font** when the app isn't in Russian
   ("Русский", "Выберите язык" on the language screen). Onest is only loaded
   when the app starts in Russian. Same on phones.
5. **Navy gradient not visible on web.** Probably web-only
   (`experimental_backgroundImage`); confirm on the phone.
6. **Three card styles on two screens:** language cards (ledge, 2 px border,
   radius ~16), inputs (1 px border, radius ~12), pill button.

## Still to capture

Video playback and thumbnails (media host blocked), games in play, bottom
sheets (theme, language, creator), locked / time's-up / quiet-hours states,
Teen and Little lanes, Plus on.
