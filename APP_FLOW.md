# How Payhas works — the app flow in plain language

One family account per household. A parent owns it; everyone in the family
gets their own **profile**, and each profile sits in an **age lane**:
Little (0–6), Kids (7–12), Teen (13–17) or Adult (18+). The lane decides what
that profile can see and do. One **parent PIN** guards everything a child
shouldn't change.

---

## 1. Opening the app

1. **Signed out →** *Parent sign in.* Enter email and password, or tap
   "Create an account". New accounts confirm by email first.
2. **Signed in, first time →** *Set a parent PIN* (4 digits). This happens
   once per family, before anything else.
3. **Signed in, no profile open →** *Who's watching?* A grid of the family's
   profiles. Tap one to open it.
   - Profiles with a shield need the parent PIN (usually the Adult profiles).
   - **Add** creates a new profile: name + lane, confirmed with the parent PIN.
   - At the bottom: **Parent dashboard · Sign out** (PIN required).
4. **The profile has never picked interests →** *Pick what you love.* Choose a
   few topics; only topics allowed in that lane are offered. This seeds the
   feed. Skipped automatically next time. Wrong profile? *Not Oraz? Switch
   profile* goes back to *Who's watching?*.
5. **Otherwise →** straight into the app, on the Home feed. The last profile
   used reopens by itself next time.

## 2. Inside a profile — the five tabs

| Tab | What it's for |
|---|---|
| **Home** | Full-screen videos, swipe up for the next. Tap to pause / unmute. Right side: follow, like, comments, save, share. Top: the lane badge (tap it to switch profile), *Following* / *For you*, search. |
| **Discover** | Search, a featured shelf, trending in your lane, browse by topic. |
| **Play** (centre) | Two games — Bubble Pop and Memory Match — tuned to the lane. |
| **Inbox** | Welcome notes, new videos picked for you, family notices (e.g. "your parent gave you 15 more minutes"). |
| **Me** | Name and lane, time watched today, saved and following, your taste (what the feed thinks you like, with Reset), sound and vibration, **Switch profile**, **Sign out**. |

Everything shown has already passed the lane check on the server — a child
can never receive a video above their lane, whatever they tap.

## 3. Leaving a profile or the account

- **Switch profile** — Me → *Switch profile*, or tap the lane badge on Home.
  Back to *Who's watching?*. No PIN needed to leave; PIN-protected profiles
  still ask for it to enter.
- **Sign out (switch family account)**
  - In an **Adult** profile: Me → *Sign out*. Signs out immediately.
  - In a **Little / Kids / Teen** profile: Me → *Sign out* opens the parent
    dashboard → enter PIN → *Sign out* at the bottom → confirm.
  - From *Who's watching?*: *Parent dashboard · Sign out* → PIN → *Sign out*.
  - After signing out you land on *Parent sign in*, ready for another account.
- **Back buttons** always go somewhere: the previous screen if there is one,
  otherwise Home (inside a profile) or *Who's watching?* (outside one).

## 4. Limits and quiet time (children's profiles)

- **Daily limit reached →** a *Time's up* screen covers the app. Options:
  *Ask for more time* (sends the parent an alert) or *Switch profile*.
- **Quiet hours (bedtime → wake-up) →** videos and games are blocked until
  morning.
- **Paused by a parent →** everything stops until the parent un-pauses.
- **Games turned off →** Play shows "Games are off"; videos still work.
- Game time counts toward the daily limit.

## 5. The parent dashboard

Opened from Me (the sliders icon, or *Sign out* in a child's profile) or from
*Who's watching?*. Needs the parent PIN; stays unlocked for 15 minutes.

1. Pick a child at the top.
2. **Live status:** watching, playing or last seen; today's time vs the limit.
3. **Remote controls, applied on the child's phone within seconds:**
   pause now, +15 minutes today, daily limit, quiet hours with bedtime and
   wake-up, games on/off.
4. **Requests:** "Ask for more time" → answer +15, +30 or Not today.
5. **This week:** a 7-day chart, top topics, recent videos — hide any video
   from that child.
6. **Alerts:** turn on push notifications for this phone (limit reached,
   a video flagged, a time request). Children never get notifications.
7. **Lock dashboard** or **Sign out**.

Five wrong PIN tries lock PIN entry for 15 minutes.

## 6. Creators and moderators (Adult profiles only)

- **Creator studio** (Me) — upload a video: pick it, write a caption, choose
  topics and the youngest lane it suits. It goes to review; the creator hears
  back in Inbox.
- **Review** (Me, moderators) — approve, reject or set the lane and topics for
  new uploads; handle reports from viewers. Nothing reaches a child's feed
  until a moderator approves it, and Little-lane videos always get a human
  check.

## 7. How the feed learns

Every swipe teaches it: finishing, rewatching, liking, saving and sharing
pull similar videos in; skipping fast or "Not for me" pushes them away. A
share of each session is deliberately new topics so the feed doesn't narrow.
Each profile learns on its own — a parent's viewing never leaks into a
child's feed. Taste can be reset from Me.
