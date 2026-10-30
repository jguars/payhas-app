---
name: Payhas
description: A family short-video app with age lanes — dark, calm, and alive to the touch.
colors:
  ink: "#0A0A0F"
  surface-1: "#14141B"
  surface-2: "#1D1D26"
  line: "#2A2A35"
  text: "#F4F3EF"
  text-2: "#B3B2BD"
  text-3: "#8C8B97"
  ember: "#FF5A3C"
  ember-edge: "#9E3825"
  verified: "#78A6FF"
  lane-little: "#FFD25E"
  lane-kids: "#4FE3B0"
  lane-teen: "#78A6FF"
  lane-adult: "#C3A2FF"
  success: "#4FE3B0"
  warning: "#FFD25E"
  danger: "#FF8A73"
  info: "#78A6FF"
  reward: "#FFD25E"
typography:
  display:
    fontFamily: "Bricolage Grotesque"
    fontSize: "34px"
    fontWeight: 800
    letterSpacing: "-1px"
  headline:
    fontFamily: "Bricolage Grotesque"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: "36px"
    letterSpacing: "-0.6px"
  title:
    fontFamily: "Bricolage Grotesque"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-0.3px"
  body:
    fontFamily: "Figtree"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "21px"
  label:
    fontFamily: "Figtree"
    fontSize: "15px"
    fontWeight: 700
  caption:
    fontFamily: "Figtree"
    fontSize: "13px"
    fontWeight: 500
  numeric:
    fontFamily: "JetBrains Mono"
    fontWeight: 500
rounded:
  chip: "12px"
  control: "16px"
  card: "20px"
  video: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "56px"
  button-secondary:
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    height: "44px"
  chip:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 14px"
  chip-selected:
    backgroundColor: "{colors.lane-kids}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.card}"
    padding: "16px"
  nav-bar:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.pill}"
    height: "64px"
  nav-pill-active:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    width: "54px"
    height: "42px"
  icon-circle:
    backgroundColor: "{colors.lane-teen}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
---

# Design System: Payhas

## Direction and principles (approved 2026-10-30)

**Feeling:** warm · playful · safe · calm.

**One system, two volumes.** The same tokens and components on every screen;
only density, illustration and how much colour is allowed change:

| Context | Volume | Like |
| --- | --- | --- |
| Video feed, Who's watching | Low — the content leads | Cinema-night streaming apps |
| Child areas: Play, Discover, Me, Inbox, child onboarding | High — tactile, playful, illustrated | Duolingo, Finch, Spotify Kids |
| Parent areas: dashboard, child page, Plus, consent, settings | Medium — calm lists, clear numbers | Headspace, GoHenry |

**Principles** (they settle arguments):

1. **One loud thing per screen.** One ember action; everything else quiet.
2. **Colour means something.** Ember = do this. Lane colours = who and how
   old (avatars and lane badges only). Status colours = state. Nothing is
   coloured for decoration — including the tab bar.
3. **Same thing, same look.** One selected style, one input style, one
   button family, one header pattern per screen type.
4. **Content and characters carry the joy, not the chrome.** Thumbnails,
   animal avatars and illustrations bring colour; UI stays calm.
5. **Numbers in words, not code.** The UI face for numbers; one duration
   format ("45 min", "1 h 15 min").
6. **Kids see things, parents read things.** Child screens: big targets,
   pictures, few words. Parent screens: lists, labels, values on the right.

## Tokens (Phase 3, 2026-10-30) — the only allowed values

Source of truth: `src/theme/tokens.ts` and `src/theme/motion.ts`. Board:
`design/tokens-board.png`. Anything not listed here is not allowed in a
screen; if a screen needs something new, add it here first.

| Group | Tokens | Rules |
| --- | --- | --- |
| Colour | `bg`, `surface1`, `surface2`, `line`, `text`, `text2`, `text3`, `ember`, `emberText`, `emberEdge`, `inverse`/`onInverse`, `success`, `warning`, `danger`, `info`, `ink` | Every text/background pair passes AA (4.5:1) in all three themes. `ember` is a fill (ink text on it); `emberText` is ember as text. Errors are `danger`, never ember. Time used / progress is `success`. |
| Lanes | `lane[x].color` (fill), `lane[x].text` (text) | Fills are the same bright four in every theme and always carry ink. Use `.text` when a lane colour is text. Only avatars, lane badges and lane text — never decoration, never the tab bar. |
| States | selected = `inverse` fill + `onInverse` text · disabled = `surface2` fill + `text3` text · pressed = scale 0.97 (PressScale) | One selected style everywhere (chips, segmented, tabs, pickers). No opacity-faded buttons. |
| Type | `type.caption … type.hero` (size + line height + tracking) with `font.*` | Bricolage for headings and big numbers, Figtree for everything read or tapped (numbers too), Mono only for codes. |
| Spacing | `space.xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48`, `layout.gutter 16`, `layout.section 24` | No raw padding, margin or gap. |
| Radius | `radius.sm 12 · md 20 · lg 28 · pill` | sm: chips, tiles, inputs · md: cards, row groups · lg: heroes, video, sheets · pill: buttons, tab bar, badges. |
| Border | `border.hairline 1 · strong 2` | Dividers and quiet outlines / focus and selection. |
| Control height | `control.sm 40 · md 48 · lg 56` | md is also the minimum touch target. |
| Icons | `iconSize.sm 16 · md 20 · lg 24 · xl 32`, `iconStroke(size)` | One glyph family (`Icon`); stroke from the size, not per screen. Emoji are not icons. |
| Depth | `elevation.ledge 4` (child cards), `elevation.ledgeButton 3` (primary), `elevation.float` (tab bar, toasts, sheets) | Tonal layers first. |
| Motion | `spring.snappy/smooth/bouncy`, `STAGGER_MS 45`, `duration.fast 150 · base 250 · slow 400` | Everything off under reduce-motion. |

References: `design/direction/` and the Mobbin collection "Payhas — design
direction". Workflow: `docs/UI_UX_WORKFLOW.md`.

## Overview

**Creative North Star: "The Night-Light Playroom"**

Payhas is a dark, calm room. The ground is near-black ink, the surfaces are a
step or two lighter, and nothing glows unless it means something. The glow
comes from two places only: one warm ember for "do this", and the four lane
colours, which tell you who and how old. A parent picks the phone up at night
and it feels quiet and trustworthy. A child touches it and it comes alive.

That second half is the component doctrine: **quiet chrome, loud touch.** At
rest the interface nearly disappears. Feed chrome is small text over video,
the tab bar is a dim floating capsule, and the icons are outlines. Under a
finger, everything answers. Chips press down into a hard ledge, tiles dip and
spring back, the active tab's pill jelly-slides to its new home, and each nav
icon does its own little move. Expression lives in the response, not in the
resting state.

Illustration is hand-made. Topic stickers, nav icons and animal avatars are
drawn for Payhas with a bold ink outline, a fill in the tile or lane colour and
white highlights. They are never pulled from a stock icon set. The world is
never light-mode and never pastel. Colour arrives saturated, against the dark.

**Key Characteristics:**
- Dark ink ground with tonal surfaces. Colour is rare and always means something.
- One action colour (ember), always with ink text on it.
- Four lane colours as identity, never decoration.
- Quiet at rest, playful under touch. Spring physics, not timed easing.
- Hand-drawn stickers and icons with an ink outline, colour fill and white glint.
- Rounded, soft, chunky geometry. Nothing sharp.

## Colors

A night palette: ink and graphite neutrals, lit by one warm ember and four
saturated lane lights.

### Primary
- **Ember** (#FF5A3C): marks the one thing to do: primary buttons, the
  Home-tab pill, liked hearts, progress fills, unread dots. Text on ember is
  always ink, never white.
- **Ember Edge** (#9E3825): the darker ledge under a selected ember control,
  such as a chosen language row.

### Secondary: the Lane Lights
- **Little Sun** (#FFD25E): the Little lane (0–6).
- **Kids Mint** (#4FE3B0): the Kids lane (7–12).
- **Teen Sky** (#78A6FF): the Teen lane (13–17). The same value is used as
  the verified mark.
- **Adult Lilac** (#C3A2FF): the Adult lane (18+).

Lane colours fill avatars, ribbons, lane chips and the badge, tint topic
tiles, and carry the tab-pill colours for the non-Home tabs.

### Tertiary: Status
- **Success Mint** (#4FE3B0), **Waiting Gold** (#FFD25E), **Problem Coral** (#FF8A73)
  and **Info Sky** (#78A6FF): approved and published, pending, rejected and
  flagged, exploring. **Reward Gold** (#FFD25E) marks stars, sparks and
  best-score badges. Status hues borrow lane hues, so keep them on parent,
  creator and system surfaces, and pair them with an icon or word. Use
  `alpha(token, a)` for translucent tints; never type `rgba()` by hand.

### Neutral
- **Ink** (#0A0A0F): the ground of every screen, and the text colour on any
  coloured fill.
- **Night Surface** (#14141B): cards, rows, chips at rest, the tab bar (at 94%).
- **Raised Surface** (#1D1D26): nested surfaces, progress tracks, pressed wells.
- **Hairline** (#2A2A35): 1–2px borders, dividers, the ledge under an
  unselected chip.
- **Bone** (#F4F3EF): primary text. Warm off-white, never pure #FFF for text.
- **Mist** (#B3B2BD): secondary text, hints, quiet buttons.
- **Dusk** (#8C8B97): tertiary text, resting icon strokes, metadata.

### Named Rules
**The One Ember Rule.** Ember is the only action colour, and a screen has at
most one ember call to action. Text on ember is ink.

**The Lanes Mean Age Rule.** Lane colours identify an age lane or a profile.
Never use one as a generic accent where it could be read as the wrong lane.

**The Night-Only Rule.** There is no light theme. Surfaces step up from ink
in tone. They never go pale or pastel.

## Typography

**Display Font:** Bricolage Grotesque, ExtraBold 800 and Bold 700.
**Body Font:** Figtree, 400 to 700.
**Numeric Font:** JetBrains Mono 500.
**Cyrillic:** when the language is Russian, Onest loads under the Bricolage
and Figtree names, so every role keeps its weight.

**Character:** Bricolage is a characterful, slightly quirky grotesque. It
gives screen titles a hand-made warmth at tight tracking. Figtree is a clean,
friendly UI sans that stays legible at 12–15px. Counts, timers and stats use
mono so numbers don't jitter as they change.

### Hierarchy
- **Display** (Bricolage 800, 34px, −1 tracking): screen titles on tab roots
  (Discover, Play, Me).
- **Headline** (Bricolage 800, 30px/36px, −0.6 tracking): onboarding step
  titles and game card names. Goes up to 38px for welcome moments.
- **Title** (Bricolage 700, 20px, −0.3 tracking): shelf and section headers,
  language names.
- **Body** (Figtree 500, 15px/21px): hints, captions and descriptions. Figtree
  400 is used for long text.
- **Label** (Figtree 700, 15px; 17px on primary buttons): chips, buttons and
  row titles.
- **Caption** (Figtree 500, 13px; 12px minimum for tags): metadata, counts, credits.
- **Numeric** (JetBrains Mono 500): stats, timers, counts.

### Named Rules
**The Tight Headline Rule.** Bricolage always runs with negative tracking
(−0.3 to −1px, scaling with size). Figtree never gets negative tracking.

**The Four-Language Rule.** Every text box must fit the longest of Turkmen,
Russian, Turkish and English. Size layouts for the longest string, not the
English one.

## Layout

This is a single-column phone layout on a 4px base scale: 4, 8, 12, 16, 24,
32, 48.
- **Margins:** screens use 16px side margins, 24px for onboarding content.
- **Gaps:** groups within a section are 12px apart; sections are 24–32px apart.
- **Feed:** full-bleed edge to edge. Video that isn't the screen's aspect
  ratio is centred and contained over a blurred copy of its poster, never
  cropped to fill.
- **Tab bar:** a floating capsule 64px tall, inset 16px from each side and
  10px above the bottom inset. Scrolling screens reserve that space so the
  last item clears it.
- **Touch targets:** at least 48dp. Smaller visuals (steppers, close buttons)
  extend their hit area with `hitSlop` to reach 48.

## Elevation & Depth

Depth is tonal first: ink, then Night Surface, then Raised Surface, with
hairline borders separating them. Only two floating things cast real
shadows. Tactile controls get physical depth from a hard **ledge**, not
from a shadow.

### Shadow Vocabulary
- **Float** (`shadowColor #000, opacity 0.45, radius 18, offset 0/8; Android
  elevation 14`): the floating tab bar, so it lifts off video and cards.
- **Toast** (`elevation 10`, similar soft black): transient toasts above the
  tab bar.
- **Ledge** (a solid block of Hairline, or a 62%-darker shade of the fill,
  offset 3–4px below the control): chips, language rows and game cards. On
  press the face drops into it.

### Named Rules
**The Ledge, Not Shadow Rule.** Tactile controls show depth with a hard
offset ledge they press into, never a blurred drop shadow. Blurred shadows
are reserved for things that float over content.

## Shapes

Everything is soft and rounded, with no sharp corners anywhere.
- **Chips and controls:** 12–16px radius.
- **Cards and rows:** 20px radius.
- **Video and hero posters:** 28px radius.
- **Buttons, the tab bar and lane pills:** full pill (999px).
- **Avatars:** circles, with the animal face drawn in a 64-unit box.
- **Borders:** 1px on floating chrome, 2px on tactile controls, where the
  border turns ember or a darker tint when the control is selected.
- **Sticker illustrations:** a 2.6-unit ink outline in a 64-unit box, round
  caps and joins.

## Components

### Buttons
Confident and singular.
- **Shape:** full pill, 56px tall.
- **Primary:** ember fill with an ink Figtree Bold label at 17px. One per
  screen.
- **Secondary:** a 44px text button in Mist, Figtree SemiBold at 15px, with
  no fill or border.
- **Press:** a spring dip to 0.92–0.96 scale (`PressScale`), plus a haptic
  through `fx.tap()`.

### Chips
The signature tactile control.
- **Style:** Night Surface fill, a 2px Hairline border and a 16px radius,
  44px tall (52px for the `lg` size). The label is Figtree Bold 15px, with an
  optional emoji or icon.
- **Ledge:** sits 3px below the chip. On press the chip translates down 3px
  into it.
- **Selected:** filled with its tint (a lane colour or Bone). The border and
  ledge become a 62% shade of the tint and the label turns ink.

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** Night Surface, with Raised Surface for nested wells.
  Activity cards use a lane or ember tint at about 12%.
- **Shadow Strategy:** none; depth is tonal. Game cards use the ledge.
- **Border:** an optional 1–2px hairline.
- **Internal Padding:** 16px, or 24px for hero cards.

### Navigation
- **Tab bar:** a floating pill capsule at 94% opacity, with five equal tabs:
  Home, Discover, Play, Inbox, Me.
- **Resting icons:** hand-drawn outline icons in Dusk at 1.9 stroke.
- **Active pill:** a 54×42 pill with a 16px radius slides between tabs on a
  spring, stretching and squashing as it travels. It blends through the
  per-tab colours: Home is ember; Discover, Play, Inbox and Me use the Teen,
  Kids, Little and Adult lane colours.
- **Active icon:** white-filled with ink lines on the pill, and it plays its
  own move. Home hops, the compass spins, the controller wiggles, the bell
  rings and the person pops.
- **Even weighting:** no tab, Play included, is visually promoted over the
  others.

### Feed chrome
- **Top tabs:** Following and For you, as small centred text tabs. The
  underline tracks a swipe live and stretches mid-swipe.
- **Bottom-left block:** a creator row, then a caption that stays collapsed
  until tapped, which expands to show the credit and source.
- **Right rail:** icon plus count, with no discs behind them.

### Topic stickers (signature)
- **Art:** hand-drawn SVG per interest, with an ink outline, the tile's colour
  as the fill and a white glint.
- **Tiles:** sit in tinted 2-column tiles on Discover.
- **Fallback:** an unknown topic shows its emoji instead.

### Avatars (signature)
- **Art:** six flat animal faces on the profile's lane colour.
- **Ribbon:** an optional lane ribbon.
- **Lock:** a lock badge marks PIN-protected profiles.

### Motion
Physics over curves.
- **Springs:** use the `spring.snappy`, `spring.smooth` and `spring.bouncy`
  presets.
- **Entrances:** lists enter with `<Enter index>` at a 45ms stagger.
- **Reduce motion:** respect the OS setting. Flourishes are skipped and on
  first paint nothing flourishes.

## Do's and Don'ts

### Do:
- **Do** keep ink (#0A0A0F) as the ground of every screen and build depth
  with surface tones.
- **Do** put ink text on every coloured fill, whether ember or lane.
- **Do** draw new icons and illustrations as Payhas stickers: an ink outline,
  a colour fill and a white glint, with round caps.
- **Do** give every touchable element a spring response: press dip, ledge
  drop or flourish.
- **Do** use the motion presets and the `<Enter>` stagger instead of
  inventing timings.
- **Do** run Bricolage headings with negative tracking, and put numbers in
  JetBrains Mono.

### Don't:
- **Don't** use generic stock icon sets (Lucide or Material line icons) where
  a hand-made Payhas icon belongs.
- **Don't** introduce a light theme, pale surfaces, or the pastel candy look
  typical of children's apps.
- **Don't** use more than one ember call to action on a screen, or use ember
  for decoration.
- **Don't** use a lane colour where it could be mistaken for a different lane.
- **Don't** give tactile controls blurred drop shadows. Use the ledge.
- **Don't** let chrome compete with video. Feed overlays stay small and quiet
  until touched.
