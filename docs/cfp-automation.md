# CFP automation

## Published views

- `/cfp/` and `/posts/cfp-radar/`: the latest dashboard.
- `posts/cfp/YYYY-MM-DD-cfp-radar.md`: one note per KST week, keyed by Monday. Daily refreshes update the current week's note; earlier weeks remain unchanged. `/cfp/` links the weekly archive.
- `/cfp/data/latest.json`: the source snapshot, including edition, date verification, fetch status, and last verification time.
- `/cfp/radar.ics` and `/cfp/data/radar.ics`: identical feeds of confirmed, open submission deadlines. Event IDs do not change when a deadline is extended.

## Run locally

```bash
npm run cfp:update
npm run cfp:validate
npm run build
```

Validation is read-only. It rejects stale snapshots, inconsistent dates/counts, unsafe source URLs, missing evidence, and mismatched calendar or note artifacts. Failed validation must not be treated as successful publication.

The GitHub `Update CFP Radar` workflow runs daily at 15:30 UTC (00:30 KST; GitHub can delay scheduled runs). It refreshes, validates, builds, tests, and lints before committing all CFP artifacts. A successful run triggers the existing Cloudflare Pages deployment workflow. Enable Actions and retain the workflow on the default branch.

## Conference editions

For year-bearing official URLs, the crawler probes the next applicable edition. A guessed URL is only a candidate: the response must identify that edition and contain a submission deadline in the expected year range. Redirects to unsafe domains, missing pages, registration-only dates, and old-edition pages do not replace the current source.

Use optional `edition` and `editionUrlTemplate` settings when the venue's URL is irregular or the conference site blocks crawling. For example, ICC uses the official ComSoc event catalog:

```json
{
  "edition": 2027,
  "editionUrlTemplate": "https://www.comsoc.org/conferences-events/ieee-international-conference-communications-{year}"
}
```

The last resolved edition is retained in `latest.json`, so subsequent refreshes do not revert to the old configured URL. Sources without a predictable year URL, an official template, or readable evidence still require a source-config update; no model or crawler can guarantee discovery of unpublished CFPs.

## Deadlines and journal calls

Officially detected deadlines take priority over configured dates. A configured date without official evidence is labelled unverified and stays out of the deadline radar/calendar. Fetch failures preserve the last confirmed date and verification time, with a cached warning. Dates are submission leads, not a guarantee: verify the official page and its cutoff timezone before submitting.

Journal tables and dated list entries are split into separate calls with their topic, individual link, and deadline. Publication dates are not used as submission dates. HTML comments and scripts are ignored.

The existing Google Search-assisted fallback remains optional and bounded by `CFP_AI_MAX_REQUESTS` and `CFP_AI_TARGETS`. Local verification does not require an AI API key. Official-domain validation and quoted-date checks also apply to AI findings.
