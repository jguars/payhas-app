# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

One design ships on both Android and iOS. Android is built and tested first
(local release builds on a Xiaomi phone); iOS follows with the same design
language, not a per-OS adaptation.

## Users

**Primary: the parent.** One parent owns the household account. They pick the
app, set it up, hold the parent PIN, and decide what each child may watch,
when, and for how long. Product decisions optimize for the parent's trust and
control first.

**Inside the parent's limits: the family.** Every family member gets a profile
in an age lane: Little (0–6), Kids (7–12), Teen (13–17) or Adult (18+). Children
watch, play and browse inside what their lane and their parent allow. Adults in
the household use the same app in the Adult lane.

## Product Purpose

Payhas is a short-video app for the whole family. Every profile gets a
full-screen vertical feed, but what each one can reach is decided by its age
lane on the server, and the parent can see and steer it remotely.

It exists so a family can share one short-video app without handing children
an open, adult-tuned feed. Success means a parent can hand over the phone
without supervising each swipe, and children still want to open the app.

## Positioning

- **Lanes are enforced on the server.** A Little profile can never receive a
  video above its lane, whatever it taps. Filtering is not a client-side toggle.
- **One household account, live parent control.** The parent sees each child's
  live status, today's watch time against the limit, a 7-day history and top
  topics.
- **Remote actions land on the child's device in real time.** The parent can
  pause now, add 15 minutes, set the daily limit or bedtime and wake time,
  turn games off, or hide a video.
- **Turkmen first.** Payhas is built for Turkmenistan, with Turkmen as the
  lead language, which mainstream short-video apps do not serve.

## Operating Context

- **Market:** Turkmenistan first.
- **Languages:** Turkmen (lead), Russian, Turkish and English. The family picks
  one language and the whole app switches. Russian swaps in a Cyrillic font
  that loads at launch.
- **Setup flow:** language → parent sign-in → onboarding (family and children:
  name, birth month, which sets the lane, interests, learning mix, daily limit,
  quiet hours) → "Who's watching?" → the profile's app.
- **Shared device:** profiles switch on one phone. The last profile used
  reopens by itself. PIN-protected profiles ask for the PIN to enter.
- **Parent session:** the parent PIN opens a 15-minute parent dashboard
  session.
- **Parent alerts:** the parent's phone can opt in to push alerts, for example
  when a child asks for more time. Children never get notifications.
- **Content today:** curated stock clips imported through an automated
  pipeline (Pixabay, `tools/content/pixabay.py`). Each clip is reviewed,
  captioned in all four languages, assigned a lane and topics, and credited.

## Capabilities and Constraints

**Tabs (in every profile):**

| Tab | What it does |
| --- | --- |
| Home | Following / For you, switched by swiping |
| Discover | Search, topics, trending in your lane |
| Play | Lane-tuned mini-games: Bubble Pop, Memory Match |
| Inbox | Notes and notices for the profile |
| Me | Profile, time watched today, saved, taste, settings |

**Limits:** a daily limit and quiet hours block both videos and games. Game time
counts toward the limit. When the limit is reached, a *Time's up* screen offers
*Ask for more time* (which alerts the parent) or *Switch profile*.

**Feed ranking:** interests, learning mix, follows and freshness, with recently
watched clips pushed down. All of it is scoped to the lane.

**Terminology:** use these terms consistently: lane, profile, parent PIN,
parent dashboard, "Who's watching?", daily limit, quiet hours, learning mix.

**Hard constraints:**

- No microphone or camera permissions. This is a children's app.
- No AI-generated content.
- No identifiable children in imported content.
- Everything reachable from a child profile must pass the server-side lane check.
- Secrets stay out of the repo.

**Undecided:**

- **Creator uploads.** The upload flow and the safety classifier pipeline are
  not built. Today content is curated only.
- **Video hosting.** Clips currently sit in Supabase Storage at about 1 GB.
  Moving to Mux or Cloudflare Stream, or re-encoding at 720p, has not been
  decided.
- **Monetization.** Not decided.

## Brand Commitments

- **Name:** Payhas.
- **App icon:** a play triangle banded in the lane colours.
- **Lane colours** identify Little, Kids, Teen and Adult throughout the app and
  must stay distinct.
- **UI density:** keep the UI minimal. The video is the content, and chrome
  stays out of its way.
- **Illustration:** hand-drawn, product-specific icons and illustrations, not
  stock icon sets.
- **Motion:** playful motion is part of the product's character.

## Evidence on Hand

**Content:** about 120 published clips, captioned in four languages. Work files
are in `../content-work/`.

**Design references:**

- Mobbin reference screens in `../references/mobbin/`.
- `DESIGN_V2.md` maps each reference to a screen.
- The approved Feed direction is "Variant A" (ROADMAP.md).

**Flow and plan:** `APP_FLOW.md` describes the app flow and `ROADMAP.md` the
build plan.

**Not available yet:**

- No users, testimonials, usage metrics, press or pricing exist.
- Do not invent any of these.

## Product Principles

1. **The parent's trust comes first.** If a feature makes a child's experience
   richer but a parent's control weaker, rework it.
2. **Safety lives on the server.** Lane rules, limits and hidden videos are
   enforced in the database. The UI only reflects them.
3. **Grown-up for the parent, playful for the child.** Parent surfaces are
   clear and calm. Child surfaces earn delight through motion and hand-made
   detail.
4. **Native-language first.** Every string, caption and notice works in Turkmen
   first, then Russian, Turkish and English. Never hard-code copy.
5. **Minimal chrome.** Video and play are the content, so cut UI before
   adding it.

## Accessibility & Inclusion

**Users who can't read yet:** Little profiles (0–6) may not read. Their
surfaces need to work through icons, colour, motion and sound, with no text
required.

**Text length:** layouts must fit the longest of the four languages. Turkmen
and Russian strings often run longer than English.

**Touch and motion:**

- Touch targets are at least 48dp, for small hands.
- The system Back gesture works on every screen.
- Respect the OS reduce-motion setting.
