# Critique — Family dashboard (C) and Payhas Plus (B)

Built from on-device captures (Xiaomi, Navy theme, 2026-10-31), reviewed with
`design-skills:design-critique` (heuristics + UX laws) and `impeccable polish`.
Parent-facing, Operate mode, one-handed.

| # | Screen | Finding | Severity | Principle | Fix | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Family | Today card never says whose day it is; once the avatars scroll away the numbers have no owner, and two avatars can look alike | 3 | Working memory, H6 recognition | Child's name (title) + lane badge head the card | Fixed |
| F2 | Family | Week total in the mono face beside "0 min" in the display face — two number styles for one unit | 2 | H4 consistency, Similarity | Week total in display/heading, average in body text2 (also on the child page) | Fixed |
| F3 | Family | Chart always scaled to the daily limit: a light week is an empty box with a red dashed line | 2 | Prägnanz, H8 | Scale to the week; limit line and its scale appear once a day reaches half the limit | Fixed |
| F4 | Family | Status line truncates beside name + lane badge in TK/RU | 2 | Localization expansion | Status row wraps instead of truncating | Fixed |
| P1 | Plus | A family already on Plus sees a sales page: "Pick what fits your family", Free first, status at the bottom | 3 | H1 visibility of status | On Plus: subtitle "Payhas Plus is on until {date}", Plus card first | Fixed |
| P2 | Plus | "Have an activation code?" was bold text floating on the page; didn't read as tappable | 2 | Affordance, Jakob's law | A list row with icon and chevron, like every other row | Fixed |
| P3 | Plus | Ember outline stayed on the Plus card when there's nothing to buy (ember = actions, DESIGN.md) | 1 | System rule | Outline only while Plus is the plan to buy | Fixed |
| F5 | Family | "This week" is an overline inside its card; "Recently watched" is a section header outside — two levels for siblings | 1 | H4 | WeekChart is shared with the child page; revisit with it | Deferred |
