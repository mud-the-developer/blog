# CFP review — 2026-10-15

Scope: the CFP path from configured sources through parsing, validation, Markdown/Askama rendering, weekly notes, and calendar feeds. Home/news receive regression checks; this is not a full review of every blog subsystem.

## Found and fixed

1. Venue names repeated the full institution name and acronym. A JSAC quick-view row reached about 321 px on desktop and 523 px on mobile. Tables now start with compact acronym/edition labels; full names and topics remain available through native keyboard/touch disclosure. The topic summary itself is about 63 px tall in both tested viewports.
2. The mobile calendar subscription button was clipped by styles inherited from the news metrics strip. CFP actions now use their own wrapping container and shorter labels.
3. Quick previews placed an unverified Computer Networks date before confirmed journal calls, and could include expired calls. Confirmed current calls now take priority; expired calls stay in the closed section.
4. MobiHoc AI-RAN and ML4NxtGNet schedules had struck-out submission/acceptance/camera-ready dates and a remaining November 26 event date. The parser had incorrectly promoted the event date to a verified submission date. It now stops at milestone boundaries and rejects this evidence; neither event date enters the calendar.
5. IEEE S&P's October 16 camera-ready date and SenSys's October 29 abstract-registration date had been treated as paper deadlines. Checked official schedules show November 17 and November 5 paper deadlines respectively. Generic unlabelled deadline matching and whitespace-truncated context caused the confusion; fixtures now cover these cases.
6. The shared XML block helper matched tag prefixes (`s` could match `span`/`script`). It now requires the actual tag boundary before removing withdrawn text.
7. Verification previously required only a nonempty evidence list. It now checks that the stored date occurs in recognised submission evidence, including when reusing cached dates.

## Evidence and coverage

- Entire configured set: 67 source identities and 135 stored entries, not just the visible preview rows. Validate source domains, duplicate identities/entries, dates, counters, evidence, cache flags, all three calendar copies, and current weekly/latest notes.
- Official content cross-checks in this review include ICC, ICNC, IEEE S&P, SenSys, both MobiHoc workshop pages, and the VTC schedule. Source snapshots/short excerpts support the regression fixtures. This does **not** mean every original page or every linked PDF was manually reviewed.
- After collecting again with AI disabled, the snapshot contains 41 verified open calls; the two incorrectly included workshop event dates are no longer open submission events. HTTP failures remain visible rather than being reported as successful verification.
- Browser checks cover desktop (1440 px), mobile (390 px), keyboard expansion, unclipped calendar actions, contained horizontal scrolling, and browser console errors. Before/after screenshots are local under `target/cfp-review/`.
- Presentation re-rendering is separately available with `cfp render`; it does not invent a new collection timestamp or make network/AI requests. Regression tests check that re-rendering preserves snapshot and calendar contents.

## Limits

- Not every venue/PDF's deadline or cutoff timezone has been manually confirmed. Calendar entries remain date-only planning leads, not proof of the exact submission cutoff time.
- A source can block collection or change markup. Cached information is labelled and its original verification time is retained; failed crawling does not prove that no newer extension exists.
- This report does not itself claim a new production deployment or a successful future scheduled workflow run.
