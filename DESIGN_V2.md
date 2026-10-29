# Payhas UI v2 — patterns from the Mobbin references

Reference images: `../references/mobbin/NN-*.jpg` (index: `../references/README.md`).
We borrow **patterns**, not brands. Keep Payhas' own identity:

- Ground `color.ink` #0A0A0F, surfaces `surface1/2`, hairline `line`.
- One action colour, `color.ember` #FF5A3C (always ink text on it).
- Lane colours carry meaning: Little #FFD25E, Kids #4FE3B0, Teen #78A6FF, Adult #C3A2FF.
- Type: `font.display` / `font.title` (Bricolage) for headings, Figtree for UI, `font.mono` for numbers.
- Motion presets in `src/theme/motion.ts`; entrances with `<Enter index>`; presses with `<PressScale>`; feedback with `fx.*`.
- Every visible string goes through `t()` (see `src/i18n`); add keys to the screen's namespace in all four languages.
- Keep it minimal (no explanatory chips/labels unless needed). Touch targets ≥ 44 px.

## Shared building blocks (already in `src/components/ui/`)

- **`<Avatar name avatar lane size locked ribbon />`** — flat animal face on the lane colour (replaces initials everywhere).
- **`<Chip label selected onPress emoji icon tint size />`** — chunky outlined chip with a hard ledge it presses into (Vocabulary 23, Duolingo ABC 19). Use for any "pick some" list.
- **`<IconCircle icon tint size />`** — filled colour circle with an ink icon (TikTok inbox 22).
- **`<SectionHeader title subtitle action onAction />`** — shelf title with a quiet "See all ›" (Hulu 05, Epidemic 11).

## Screen recipes

**Feed** (Sora 01, Character AI 02)
- Chrome nearly invisible: centred "For you / Following" text tabs, small; lane badge and search stay but quieter.
- Creator row (Avatar-style circle + name + verified) sits **above** the caption at bottom-left, Sora-style.
- Right rail: icon + count only, no background discs; like = filled ember heart when on.
- A horizontal **reaction chip row** under the caption (Character AI): the top 3 reactions with counts as small translucent pills, plus a "+" pill that opens the existing ReactionBar.

**Who's watching** (Paramount+ 07, Prime Video 09, Peacock 08)
- Big round `Avatar`s (≈104 px) in a 2-column grid, name under each; lane shown as the Avatar `ribbon` (KIDS-style), `locked` badge for PIN profiles.
- "Add" tile: dark circle with a plus. Footer: quiet "Parent dashboard" / "Sign out".

**Discover** (Roku 10, Netflix Kids 04, Epidemic 11, TikTok 12)
- Big title + large rounded search field at top.
- A hero card (Netflix): one featured video poster, rounded 24, gradient, caption, topic tags "A • B", a white "Play" pill.
- **Top 10 row** (Roku): posters with big outlined rank numerals overlapping their left edge.
- **Topic tiles** (Roku): 2-column tiles in tinted surfaces with a large line icon/emoji and the topic name.
- Shelves per channel with `SectionHeader` (Epidemic).

**Inbox** (TikTok 22, Substack 21)
- Top: category rows with `IconCircle` (New for you · Family · From parents) + chevron, each with a count.
- Below: activity cards on warm tinted backgrounds (lane/ember tint at ~12%), thumbnail on the right, inline action ("Watch").

**Me / Profile** (Sora 17, Plex 18)
- Centred big `Avatar`, name, lane pill; three stats in a row (Today · Saved · Following) with `font.mono` numbers.
- Tabs "Saved / Liked" with a 3-column poster grid below (rounded 12).
- Settings rows stay below, grouped in one card.

**Play** (Duolingo ABC 19, Brilliant 20)
- Game cards are chunky and tactile: big illustration area, 2 px ink outline, hard ledge shadow (like `Chip`), bold title, best score as a star row.
- One clear primary "Play" pill per card.

**Parent dashboard** (Whatnot 13, Jomo 14, Finch 16, Plex 15)
- Watch-time card per child: big number "30 min" + "of 60" + a slim progress bar with ember fill (Whatnot).
- Rule cards (Jomo): each control is its own rounded card with a title row, a status chip and the value on the right.
- "Latest" feed (Finch): rows with a small coloured `IconCircle`, "Hugo discovered **Space**", time ago.
- Age tiers explained in one line each when choosing a lane (Plex).

**Onboarding** (Vocabulary 23, X 25, Character AI 24)
- Interests: `Chip` (emoji + label), grouped under small headings when there are many; "Pick at least one" hint.
- Year/month pickers: `Chip`s too. Choice cards (learning mix): chunky outlined cards with the same ledge.
