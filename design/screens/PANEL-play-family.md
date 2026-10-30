# Reviewer panel — Play and Family (round 1)

Four independent reviewer agents, run in parallel on 2026-10-30 with the
screenshots, code and DESIGN.md (not the builder's own conclusions). Each
scored, ranked findings and pushed back. Owner decisions on the three
product questions they raised were taken the same day.

## Scores (round 1, before fixes)

| Reviewer | Play | Family |
| --- | --- | --- |
| Senior product designer (polish) | 5.5 | 7 |
| Child-UX + accessibility + safety | 4 (child) · 5 (a11y) | 7 (parent) · 5 (a11y) |
| Multilingual UX writer | EN 7 · TK 6.5 · TR 6 · RU 7 (copy across both) | |
| Devil's advocate | 10 objections, 2 real bugs | |

## Owner decisions

| Question | Decision |
| --- | --- |
| Locked games shown to children on Free ("pester power") | **One quiet "More games" tile**; kids see only playable games; no locks, no price |
| Time's up for games offered "Watch videos" | **"Done for now"** — ends the session, never nudges to videos |
| Third button on the child card | **Two wide buttons** (Pause, +15 min); card header opens the child's page |

## Accepted and fixed

| From | Fix |
| --- | --- |
| Devil | **Bug:** a pending time request and the card's +15 disagreed — +15 now answers the request when one is pending |
| Devil | **Bug:** limit 0 showed "No daily limit" + a broken bar — now "No time today", no bar |
| Devil | **Bug:** a failed load left the skeleton forever — error card with Try again |
| Devil | Frozen clock — request ages and the 24 h flag window refresh with the 20 s poll |
| Devil, child-UX | Over the limit now says "15 min over" in danger; Paused is a badge |
| Child-UX, devil, designer | Free plan: locked games removed from the child's view; one quiet tile and a friendly sheet ("A parent can turn on more games for you") |
| Child-UX | Time's up for games: "Done for now" |
| Child-UX | Time bar counts **down** (time left), warning in the last 15 % |
| Child-UX | Switch off-track at 3:1 (`text3`) |
| Child-UX | Undo toast stays 7 s (was 2.6 s; WCAG 2.2.1) |
| Child-UX | Shelf tile is one TalkBack stop (name + stars inside the control) |
| Child-UX | PressScale and Toggle honour reduce-motion |
| Designer | Play button 48 (new `Button` size `md`); hero name one step up (`heading`); hero stage 184 → 200 |
| Designer | Grid cards end level (two-line sub kept); grid foot padding lg; sections under 3 games are grids |
| Designer | Child card: two buttons fill the row at 48 |
| Designer, devil | Subtitle back to the date (as approved in B); Turkmen date formatter added (no Intl data for tk) |
| Designer | Delete family account is now the quietest thing on the page (text3 link); trust line above it |
| Designer | Account title flush with the page; icon tiles 40 so labels align with avatars; Alerts icon no longer a paper plane |
| Child-UX | Trust line: "Locks itself after 15 min. Your child can't open this without your PIN." |
| Writer | 25 string changes across EN/TK/TR/RU (Plus row "Free plan", Ce-e Dostlar, "Anne-babana sor", RU gender brackets removed, TK "Hasapdan çyk", spoken label "Add 15 minutes for Aylar", alerts copy shortened, consistent "flag" and "alert" terms) |
| Writer, devil | Play time uses the one duration formatter ("1 h left today") |
| Devil | DESIGN.md contradictions removed (mono for stats, per-tab colours) |
| Devil | Lint now also flags raw widths/heights (drift metric 416 → 677 counted honestly); both screens at 0 |

## Rejected (with reason)

| From | Suggestion | Why not |
| --- | --- | --- |
| Child-UX | Only the hero scene animates | Tried: the game scenes draw their characters only while running, so still tiles were blank. Every tile animates; games already honour reduce-motion. |
| Designer | Remove the time bar on Play | Kids who can't read need a picture of time left; kept, now counting down. |
| Child-UX | Move "Add a child" into Account | Adding a child belongs with the children; it's one quiet row with a neutral Plus badge. |
| Writer | Keep "45s" | The writer accepted it only because shelf text truncated; shelves no longer show it — moved to a deferred task instead. |

## Deferred (tasks)

| Item | Task |
| --- | --- |
| Undo for +15 min (needs `revoke_extra_time` on the server) | #34 |
| Featured game = last- or most-played open game | new |
| Game lines "45s" → "45 sec" in all games and languages | new |
| Bigger characters in the hero scene (Scene scale prop) | new |
| One font-scale cap token; spelled-out units in spoken labels ("1 hour") | new |
| Little lane (0–6): reduced Play with voice prompts | new |
| "Updated 20 s ago" on Family | new |

## Round 2 (on the fixed build)

| Reviewer | Play | Family |
| --- | --- | --- |
| Designer polish | 6.5 | 8 |
| Child-UX / parent usability | 6.5 | 7.5 |
| Accessibility | 6.5 (both) | |
| UX writer | EN 7.5 · TK 6.5 · TR 7 · RU 7 | |
| Devil (ready?) | 5 | |

All round-1 fixes that could be checked were **verified** in code or on screen,
except the Alerts copy (still 3 lines) and the shelf tile label (stars not spoken).

### Fixed after round 2

| From | Fix |
| --- | --- |
| Devil | **Bug:** games counted as open until the plan loaded — Free kids saw locked games flash in, and a failed load unlocked everything. Now nothing is open until the plan loads; Play shows a skeleton |
| Devil | **Bug:** a failed Undo left the wrong state on screen — Undo now starts from the current state and says "Couldn't undo" if it fails |
| Devil | **Bug:** +15 could fire twice — one action at a time per card |
| Devil | Limit 0 handled on Me and Play too ("No playtime today", no bar); the stop screen says "That's today's screen time" |
| Devil | Error state: retry shows loading; a failed refresh says "showing the last update"; `failed` resets on lock; help icon instead of a close X |
| Devil | Nothing-open state designed (kind message, no lock, no price); sheet no longer repeats its title |
| Devil | Layout no longer shifts when the featured game rotates (grid/shelf decided on the whole section); the featured day re-reads on every visit |
| Devil, designer | "45s" → "45 sec" in every game line |
| Designer, child-UX | +15 now has **Undo without a server change**: nothing is sent until the Undo window passes (toast `onDismiss`) |
| Child-UX | Toast: two-line safe (min height 48), Undo hit area 48, stays 30 s with a screen reader on; Undo no longer ember on inverse (it failed contrast in every theme) |
| Child-UX | The time bar is hidden from screen readers (the subtitle already says it) |
| Child-UX | Shelf and grid tiles speak their name **and** best score; empty stars at 3:1 |
| Designer | Child card status on its own line (no truncation in TK); Play button aligned with the name |
| Writer | Children see durations in full words ("1 hour left today", "Şu gün 1 sagat galdy"); 15 more string fixes (TK "şu günki çäk: …", TR "bugünkü sınır: …", RU declension-safe "{name}: +15 мин", "Häzir onlaýn", "Başga oýunlar", TR child side "Anne-baban", "{n} min ago", capitalised dates, shorter Alerts line) |

### Still disagreed / deferred

| Item | Status |
| --- | --- |
| Hero art reads empty between animation frames | Deferred to a dedicated task: proper poster art per game (image-generation / Layer.ai), shown when a scene isn't running and as the hero backdrop. Patching ten scenes' first frames would be a stopgap. |
| Every tile animates at once (WCAG 2.2.2, attention) | Deferred with the poster task: once posters exist, shelf/grid tiles show the poster and only the hero animates. Today, stopping scenes leaves blank tiles. |

Round 3 runs on this build.
