# Payhas — working to-do list

The live list of what's done, in progress and next, on the `plus` branch.
Updated 2026-10-30. Longer-range phases are in `ROADMAP.md`; the
per-screen UI tracker and decision log are in `docs/UI_UX_WORKFLOW.md`.

Rules that stay in force: mockups first, the owner approves, then build
(`.claude/skills/ui-screen`). Work happens on `plus`; it goes to `main` only
when the owner says so (merged 2026-10-30 on the owner's word).

## Needs the owner

- [ ] **Phone test** of the latest APK (and iPhone once TestFlight works).
- [ ] **TestFlight**: create the app record `com.onki.payhas` in App Store Connect, make an App Store Connect API key (App Manager), and add the repository secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`. The workflow `ios-testflight.yml` then uploads every push to `plus`.
- [ ] **APNs key** (Apple push) added to Firebase, so parent alerts reach iPhones. Until then the iPhone says "Alerts on iPhone are coming soon".
- [ ] Turn on leaked password protection (Supabase → Authentication → Providers → Email).
- [ ] Native-speaker check of the new Turkmen, Turkish and Russian texts (Welcome, language title, Paywall, iPhone alerts note).
- [ ] Before launch: turn Plus test mode off — `update private.settings set value = 'false' where key = 'plus_test_mode';`
- [ ] Decide whether iPads get a real layout (today: iPhone-only, iPad shows the iPhone app scaled).

## In progress

- [ ] **Family links backlog** — `docs/FAMILY_LINKS_BACKLOG.md` (Mum + 3 children first)

- [ ] **iPhone**: the simulator build passes; the walk-through on iPhone SE, iPhone 17 and 17 Pro Max is being made reliable (`ios-simulator.yml`, screenshots on the `ci-screens-ios` branch).
- [ ] Edit profile info and change avatar — built; `update_profile` applied to the live database (Oct 30); needs a phone test.
- [ ] Figma file for tokens and components — blocked by the Figma Starter plan's call limit; HTML mockups and the SVG app map are used instead.

## Done today (Oct 30)

- [x] Flow fixes: search hint clears on tap, creator opens the channel, short "Saved" toast
- [x] Me rebuilt as a list hub (owner's option D); Inbox moved inside Me
- [x] Paywall page; the 31st video on the free plan is locked and opens it
- [x] First run: Splash → Welcome (phone's language) → language with Continue
- [x] Android emulator test updated for the new first run
- [x] iPhone: layouts checked from the SE to the Pro Max (Welcome collage shrinks on short screens, Paywall centres on tall ones)
- [x] CI: iPhone simulator build with screenshots; TestFlight workflow ready

## Next (UI pipeline)

- [ ] Payhas Plus page: full UI pipeline
- [ ] Remaining screens (tracker in `docs/UI_UX_WORKFLOW.md`): Who's watching, Child page, Edit profile, Sign in, Saved, Following, Channel page, video sheets, Add a child, Interests, in-game screens, Creator studio
- [ ] Family: header scrolls under the status bar
- [ ] Play follow-ups from the reviewer panel
- [ ] Family follow-ups from the reviewer panel
- [ ] Poster art for every game (hero backdrop + still tiles)
- [ ] Little lane: spoken tab names and pre-reader icons
- [ ] Themes: Dark, Navy (gradient) and Calm light — finish and check every screen

## Next (product)

- [ ] Share sheet
- [ ] Long-press "Why this?" / "Not for me"
- [ ] "Why this?" chips and taste dials in the app (server side is ready)
- [ ] For You v2: embeddings with pgvector (around 1,000 clips)
- [ ] Real card payment with Halkbank, Senagat Bank and Rysgal Bank
- [ ] Where activation codes are sold; print the first batch
- [ ] Store kids-category requirements (App Store Kids, Google Play Families)
- [ ] Crash reporting and analytics that fit a children's app
- [ ] Delete the old video copies in Supabase Storage (about 1 GB)
- [ ] Creator uploads and the safety classifier pipeline
