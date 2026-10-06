# Payhas build roadmap

Stack: Expo SDK 57 (React Native + TypeScript, Expo Router) · Supabase (auth, Postgres + pgvector, storage) · Mux or Cloudflare Stream for video (decided in Phase 3).
Design source: https://claude.ai/artifact/EEnQUr5xZXq3b8utWGQyA4 — Feed Variant A (simplified) is approved.

## Phase 0 — Foundations
- [x] Expo app scaffold, TypeScript strict, `@/` path alias
- [x] Design tokens (`src/theme/tokens.ts`), fonts, icon set
- [ ] Lint config + CI (typecheck + lint on push)

## Phase 1 — Core watching experience
- [x] Tab shell: Home · Discover · Create · Inbox · Me
- [x] Feed (Variant A): full-screen paging, autoplay active item only, tap to unmute/pause, progress bar
- [x] Action rail: follow, like, comment, save, share (local state)
- [x] Seed content: the three clips in `assets/videos`
- [ ] Preload next video, double-tap to like with burst animation
- [ ] Comments sheet, share sheet, long-press "Why this?" / "Not for me"

## Phase 2 — Accounts & age lanes
- [ ] Supabase project, auth, family + profiles schema
- [ ] "Who's watching?" profile picker, parent PIN
- [ ] Interest picker (cold start)
- [ ] Lane rules enforced server-side (RLS)

## Phase 3 — Content safety pipeline
- [ ] Upload flow (record/pick, trim, caption, topic)
- [ ] Video hosting + transcoding
- [ ] Classifiers → safety score, lane, topics; human review queue for Little

## Phase 4 — Taste engine
- [ ] Watch-event logging
- [ ] Port `../algorithm/tasteEngine.ts` to a Supabase Edge Function; pgvector embeddings
- [ ] "Why this?" chips and taste dials

## Phase 5 — Remaining screens
- [ ] Discover, Inbox, Me (taste + family controls)

## Phase 6 — Launch readiness
- [ ] COPPA / GDPR-K / UK Children's Code, store kids-category rules
- [ ] Analytics, crash reporting, performance budget (first frame < 1s, 60fps swipe)
- [ ] TestFlight / Play internal beta → store submission

## Running it
```bash
npm install
npx expo start          # press i / a for simulators, or scan with a dev build
npm run typecheck
```
