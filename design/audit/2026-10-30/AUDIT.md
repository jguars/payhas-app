# Design audit — 2026-10-30 (Phase 1)

Web export (`npx expo export --platform web`, env from `.env.local`) served by
`scripts/audit/serve.js` and shot with `scripts/audit/shoot.js` at 390×844 @2x.

**Coverage so far:** signed-out screens only (language, sign-in) in Dark, Navy
and Light, plus Russian. The cloud session's network blocks
`qlaqljpwcwyunffyrfdt.supabase.co`, so nothing behind sign-in can load yet.
Board: `board1.png`.

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

## Still to capture (needs network access)

Onboarding + consent, Who's watching, Home feed, Discover, Play, Me, Family
dashboard, child page, Plus, Edit profile, sheets, empty / locked / error
states — each in three themes.
