# Family links backlog

Bugs in how a family's phones and profiles connect. Scope for now: **one
parent (Mum) and three children**. Tablet (shared phone) and co-parent bugs
are parked below until we come back to them. Tick an item only when it's
fixed *and* checked; note how.

## How it works (Mum + 3 children)

- A **profile** is a person (Mum + 3 children = 4, the Plus limit; Free is 2).
  A **phone** is just a screen someone watches on.
- Time limits belong to the child, summed over every phone they use.
- A child watches either on **Mum's phone** (Who's watching?) or on **their
  own phone**: Family → the child's card → Link phone → the code on the
  child's phone → Mum taps Allow. Their own phone opens straight into them.
- A child's own phone is linked and removed on that child's card in Family.

## Open

- [ ] **1. A child could escape control from their own phone.** "Sign out of
  this phone" needed no PIN; signed out, a child could sign up a family of
  their own with no limits. → Now asks for the parent PIN, like "Delete my
  account" (`leave_family_phone(p_pin)`, `delete-me?leave=1`).
  *Built 2026-10-31; migration live (checked: `leave_family_phone(p_pin)`). Needs the phone check.*
- [ ] **4. Linking happened in two places.** A child's phone was linked on the
  dashboard card but removed only in Settings. → The child's card now has
  Link and Remove; Settings lists only phones that aren't one child's.
  *Built 2026-10-31; needs a phone check.*
- [ ] **5. Leftover logins on the server.** Deleting a child or the whole
  family left the phone's login behind. → A trigger deletes a linked phone's
  login whenever its link goes, however it goes. Live database checked
  2026-10-31: no leftovers today, so the cleanup line removes nothing.
  *Built 2026-10-31; migration live (checked: trigger `family_devices_drop_login` on, 0 leftover logins). Needs a real removal to confirm the login goes.*
- [ ] **9. Join request limits are off for testing.** `private.settings`
  `join_request_limits = false` (migration `…170000_join_requests_no_limits.sql`).
  Turn back on before launch: `update private.settings set value = 'true' where key = 'join_request_limits';`
- [ ] **6. Any child can sign up their own family.** Test mode: `0000` works
  for every number. Closes when real SMS codes replace `PHONE_TEST_CODE`
  (before launch).

- [x] **7. "Join my family" was hidden behind "I have an account".** A
  child's phone had to pretend to have an account to find it. → Welcome now
  has a third button, Join my family: language, then straight to the code.
  *Checked 2026-10-31 on a POCO C71 (fresh install → Join my family → language → code screen).*

- [x] **8. Only the parent could start a link.** → A child's phone can ask:
  Join my family → Ask my parent → the parent's number → a 2-digit match
  number on both phones. The parent's phone gets a sheet (only in the parent's
  own profile or on parent screens; Who's watching? shows a dot on the parent;
  Android push), picks the child, and allows with the PIN. "Later" leaves a
  row on the dashboard. The code stays as "I have a code". The parent
  needn't add the child first: **New child** holds the request (30 min) while
  they set the child up, then the new child gets the phone
  (`hold_join_request`, `assign_join_request`; migration `…160000_join_requests_new_child.sql`).
  Server: `private.join_requests`, `ask-family` edge function (deployed),
  migration `20261031150000_join_requests.sql`. Unknown numbers get the same
  reply; 3 asks/hour per phone and IP, 5/day per number, 2 declines → a day.
  Adding the child from a request asks only name and birth month (age
  defaults; the child picks interests on their phone). No "Later" button.
  *Checked 2026-10-31: Android child asked → iPhone 12 parent added the child → phone opened into them. iOS push later.*

## Parked — tablet (shared phone)

- [ ] T1. Mum's profile shows on the tablet with no PIN by default: a child
  gets the adult lane with no limit, and can sign the tablet out from it.
- [ ] T2. The tablet shows "Add profile" and "Dashboard", which can never work
  there (only Mum's phone opens the dashboard); the PIN pad shows an unclear error.

## Parked — co-parent

- [ ] C1. A second parent who already signed up gets "number already in use"
  when invited, with no way forward.
- [ ] C2. A co-parent's "Delete account" says it deletes the family; it only
  removes them.
- [ ] C3. Co-parents have no profile of their own; unclear whether they count
  toward the 4.
- [ ] C4. Deleting Mum's account stranded the co-parent's login (their number
  could never sign in again). Fixed by 5: the login now goes with the family.
- [ ] C5. Phones and co-parents aren't limited by plan.
