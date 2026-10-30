# Design direction — Phase 2 (2026-10-30)

References are saved in the private Mobbin collection **"Payhas — design
direction"** (21 screens):
https://mobbin.com/collections/b5eb3b41-4b7a-444c-866a-ea44cea149f1

Boards (low-res Mobbin previews): `A-playroom.png`, `B-calm.png`,
`C-cinema.png`.

## The three candidate directions

### A · Playroom — chunky, tactile, illustrated
*Duolingo, Duolingo ABC, Finch, Spotify Kids*

- **Take:** thick "ledge" buttons and cards that look pressable; one big
  rounded display face; illustrated characters doing the emotional work;
  bright section colours on a calm base; badges and progress as rewards.
- **Watch out:** easy to tip into noise; needs strict rules (one accent per
  screen, colour = meaning) or it becomes the problem we have now.
- **Fit for Payhas:** strong for the child side (Play, Me, onboarding).
  Payhas already has the ledge and the animal avatars, so this is closest to
  its DNA.

### B · Calm studio — warm, soft, quiet, trustworthy
*Headspace, GoHenry, Greenlight, YouTube time-watched, Whatnot controls*

- **Take:** warm off-white or soft surfaces, generous spacing, plain list
  rows with clear values on the right, one friendly accent, illustration as
  small spots rather than full scenes, charts that are simple bars.
- **Watch out:** can feel adult and flat for a 4–8-year-old.
- **Fit for Payhas:** ideal for everything a parent sees (dashboard, child
  page, Plus, consent, settings) — it reads "safe, in control".

### C · Cinema night — dark, content-first, chrome disappears
*Paramount+, HBO Max, Prime Video, Opal, Tubi*

- **Take:** dark stage, the content art is the colour, UI chrome is quiet
  (white text, grey secondary, one accent), profile picker as big round
  avatars, nothing competes with the video.
- **Watch out:** on its own, generic streaming-app look; low warmth.
- **Fit for Payhas:** right for the Home video feed and the profile picker
  (both already like this).

## Recommendation: one system, two volumes

Not three looks — **one component set with the same tokens**, turned up or
down by context:

| Context | Volume | Borrow from |
| --- | --- | --- |
| Video feed, Who's watching | Low — the content leads | C |
| Child areas: Play, Discover, Me, Inbox, child onboarding | High — tactile, playful, illustrated | A |
| Parent areas: dashboard, child page, Plus, consent, settings | Medium — calm lists, clear numbers | B |

The same Button, Card, ListRow, Chip and Header everywhere; only density,
illustration and how much colour is allowed change. This keeps Payhas
recognisable on every screen (the audit's #1 problem) while letting kids'
screens feel like a playroom and parents' screens feel like a control room.

Proposed feeling words: **warm · playful · safe · calm**.

## Draft principles (for step 2.4, to confirm)

1. **One loud thing per screen.** One ember action; everything else quiet.
2. **Colour means something.** Ember = do this. Lane colours = who and how
   old (avatars, lane badges only). Status colours = state. Nothing is
   coloured for decoration — including the tab bar.
3. **Same thing, same look.** One selected style, one input style, one
   button family, one header pattern per screen type.
4. **Content and characters carry the joy, not the chrome.** Thumbnails,
   animal avatars and illustrations bring colour; UI stays calm.
5. **Numbers in words, not code.** Rounded UI face for numbers; one duration
   format ("45 min", "1 h 15 min").
6. **Kids see things, parents read things.** Child screens: big targets,
   pictures, few words. Parent screens: lists, labels, values on the right.
