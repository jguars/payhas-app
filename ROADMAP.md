# Payhas build roadmap

Stack: Expo SDK 57 (React Native + TypeScript, Expo Router) · Supabase (auth, Postgres + pgvector, storage) · Mux or Cloudflare Stream for video (decided in Phase 3).
Design source: https://claude.ai/artifact/EEnQUr5xZXq3b8utWGQyA4 — Feed Variant A (simplified) is approved.

## Phase 0 — Foundations
- [x] Expo app scaffold, TypeScript strict, `@/` path alias
- [x] Design tokens (`src/theme/tokens.ts`), fonts, icon set
- [x] Lint config + CI (typecheck + lint on push, `.github/workflows/ci.yml`)

## Phase 1 — Core watching experience
- [x] Tab shell: Home · Discover · Create · Inbox · Me
- [x] Feed (Variant A): full-screen paging, autoplay active item only, tap to unmute/pause, progress bar
- [x] Action rail: follow, like, comment, save, share (local state)
- [x] Seed content: the three clips in `assets/videos`
- [x] Preload next video, double-tap to like with burst animation
- [ ] Comments sheet, share sheet, long-press "Why this?" / "Not for me"

## Phase 2 — Accounts & age lanes
- [x] Supabase project, auth, family + profiles schema (`supabase/migrations/`)
- [x] "Who's watching?" profile picker, parent PIN (5 tries → 15 min lockout)
- [x] Interest picker (cold start; lane-filtered, enforced by RLS)
- [x] Lane rules enforced server-side (RLS + `get_feed()` mirrors `passesLaneGate`)

## Phase 3 — Content safety pipeline
- [ ] Upload flow (record/pick, trim, caption, topic)
- [ ] Video hosting + transcoding
- [ ] Classifiers → safety score, lane, topics; human review queue for Little

## Phase 4 — Taste engine
- [ ] Watch-event logging
- [ ] Port `../algorithm/tasteEngine.ts` to a Supabase Edge Function; pgvector embeddings
- [ ] "Why this?" chips and taste dials

## Phase 5 — Remaining screens
- [x] Discover (search, shelf, trending, topics; Reanimated motion — presets in `src/theme/motion.ts`)
- [x] Inbox (welcome, new-for-you, family notices) and Me (stats, taste, daily limit + quiet hours behind the PIN) — needs `20261006210000_me_inbox.sql` applied

## Phase 5b — Play
- [x] Create tab → Play: Bubble Pop (lane-tuned: free play for Little, target rounds for Kids+) and Memory Match (2–8 pairs by lane, timed for Teen/Adult)
- [x] Game time counts toward the daily limit, quiet hours block games; best scores stay on the device — needs `20261007090000_play_time.sql` applied

## Phase 5c — Parent dashboard + remote control
- [x] One PIN opens a 15-minute parent session (`/parent`, from Me or "Who's watching?")
- [x] Per child: live status (watching / playing / last seen), today vs limit, 7-day chart (videos + games), top topics, recent videos, anything they flagged
- [x] Remote: pause now, +15 min today, daily limit, custom bedtime/wake, games on/off, hide a video — lands on the child's device over Realtime — needs `20261011090000_parent_dashboard.sql` applied

## Phase 5d — Parent alerts (push)
- [x] Firebase Cloud Messaging direct from the `push` Edge Function (secret `FIREBASE_SERVICE_ACCOUNT`); outbox `push_events` + pg_net trigger
- [x] Parents opt a phone in from the dashboard; children never get notifications
- [x] Alerts: limit reached (once a day), video flagged, "Ask for more time" (answered from the dashboard: +15 / +30 / Not today) — needs `20261012090000_push_notifications.sql` applied and `google-services.json` in the app folder

## Phase 5e — Onboarding + languages
- [x] First launch asks the language (Turkmen, Turkish, Russian, English); switch any time in Me
- [x] Onboarding: welcome → parent PIN → parent profile → per child: name, birth month (lane computed, not picked), interests, learning-vs-fun, daily limit + bedtime → family summary
- [x] For You ranked per profile (`get_for_you`): interests, learning mix, followed channels, freshness, recently watched pushed down; pages by exclusion
- [x] Every screen translated (`src/i18n/strings/*`, typed keys); server inbox notices translated client-side; captions carry `caption_i18n` (`tools/content/apply_captions.py`) — needs `20261015090000_onboarding_i18n.sql` applied
- [ ] Native-speaker review of Turkmen copy; a Cyrillic-capable display/body font pairing for Russian

## Phase 5f — UI polish, first run, iPhone (Oct 30)
- [x] Docked tab bar with labels: Home · Discover · Play · Me (Inbox moved inside Me)
- [x] Home, Discover and Me rebuilt through the mockup → approval → build pipeline (`docs/UI_UX_WORKFLOW.md`)
- [x] Home: pinch out for full display, pinch in to return; hold to hide
- [x] Free plan: the 31st video is locked and opens the Paywall page
- [x] First run: Splash → Welcome (phone's language) → language with Continue
- [x] iPhone: fits the SE to the Pro Max; simulator build with screenshots in CI (`docs/CI_WORKFLOWS.md`)
- [ ] TestFlight builds (workflow ready; waits on the App Store Connect key secrets)

## Phase 6 — Launch readiness
- [ ] COPPA / GDPR-K / UK Children's Code, store kids-category rules
- [ ] Analytics, crash reporting, performance budget (first frame < 1s, 60fps swipe)
- [ ] TestFlight / Play internal beta → store submission (working list: `docs/TODO.md`)

## Running it
```bash
npm install
npx expo start          # press i / a for simulators, or scan with a dev build
npm run typecheck
```
