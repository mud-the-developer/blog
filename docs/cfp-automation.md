# Daily CFP dashboard

## Published views

- `/cfp/` and `/posts/cfp-radar/` show the same latest dashboard.
- `posts/cfp/cfp-radar.md` is replaced on every successful daily update. There are no dated CFP posts or weekly archive links. Git history retains previous revisions.
- `/cfp/data/latest.json` holds collection time, venue edition, detected date, verification state, fetch status, original verification time, and the evidence URL.
- `/cfp/radar.ics` and `/cfp/data/radar.ics` are identical feeds of confirmed open deadlines. Calendar identity uses venue, edition, and call type (plus journal topic), not a changeable source URL or deadline.

```bash
npm run cfp:daily       # collect, validate, build
npm run cfp:validate    # read-only checks
cargo run -- cfp render # re-render the existing snapshot; no network/AI calls
```

## Daily automation and health

`Update CFP Radar` runs every day at **15:30 UTC / 00:30 KST**. GitHub can delay scheduled jobs. Collection uses a Windows runner and Bash because ICC's server omits its GlobalSign intermediate certificate; Windows native TLS can complete the certificate chain without disabling verification. Deployment and its build/test/lint checks remain on Linux.

The collector validates before writing or publishing:

- At least **60%** of configured sources must fetch successfully.
- A drop of more than **20 percentage points** from the preceding collection rejects the update and preserves the previous snapshot. Exactly 20 points is allowed; the comparison uses integer ratios.
- Previously verified dates are usable for at most **7 days**. After that, the value and original evidence remain for inspection, but are marked stale and excluded from confirmed-open counts and calendars.
- Failed sources and stale records produce GitHub warning annotations and a visible dashboard warning. A green workflow is not a claim that every source fetched successfully.
- Dates, counters, source identity, official domains, submission evidence, and calendar/note consistency are checked. `cfp validate` never silently repairs artifacts.

A successful collection replaces the daily artifacts and triggers the existing Cloudflare Pages deployment workflow. The scheduler remains enabled on the default branch.

## Extraction and source identity

The HTML parser reads submission dates in their own table row, paragraph, list item, definition entry, or conference date block before falling back to text evidence. Paragraphs inside a record do not discard the enclosing label/date pair; containers of multiple nested records are skipped instead. Adjacent abstract, proposal, camera-ready, acceptance, or event dates must not be substituted. Deleted/struck-out dates and scripts are ignored. Journal topic/link/date triples stay together; explicitly extended/final dates take precedence over an earlier date in the same cell. Ambiguous multiple-date cells are not guessed.

The collector follows at most two official venue links (catalog → venue → CFP) before accepting an event-catalog date. Main papers and workshops remain separate. Candidate next editions must identify the edition and a plausible submission date. ICC uses its live symposium CFP; its ComSoc catalog template is only for discovering future editions.

Cache matching uses venue, edition, and call type, with journal topic identity as well. The source URL can change without discarding a confirmed date. Expiring date verification does not erase the discovered edition or official URL: repeated fetch failures retain that identity and the original evidence without making the stale deadline current again. `evidenceUrl` and `lastVerifiedAt` identify where and when the cached fact was checked; another edition or workshop cannot reuse it. A successful page that no longer contains valid dated submission evidence does not automatically keep a previous verified date.

HTTPS uses Rust TLS first and native TLS on connection failure; both verify certificates and official-domain redirects. HTTP 403/418 responses remain failures, not an excuse to disable verification. Optional Google Search assistance remains quota/target bounded and must return official-venue evidence matching its date.

## Display and mobile

The latest page recalculates dates, visible rows, and open/fresh/cached counts on entry, every minute, and when returning to the tab. Expired rows leave current lists; later rows fill the nearest-deadline and three-row previews. A snapshot older than **36 hours** shows a warning. Browser updates do not claim that sources have been fetched again. Calendar-add links are hidden for expired, stale, or unverified calls; the official CFP link stays available for rechecking.

Mobile displays **Venue and Deadline together without horizontal scrolling**. Full names, topics, field, event date, location, and official/calendar links are accessible through native keyboard/touch disclosure controls. Desktop retains the extra columns. Source-policy and evidence sections remain available, but there is no CFP archive or historical call table.

Dates remain date-only planning leads, not a guarantee of the exact cutoff timezone. Not every site/PDF can be parsed; check the linked official call before submitting. Future annual URL changes can still require source-config maintenance.
