# Agent Guide: News RSS Refactor

This document is the operational handoff for refactoring the current auto-generated news pipeline.

Use it before changing news source ingestion, digest generation, RSS exposure, or downstream delivery.

## 1. Current Architecture

The news system is split across two repositories.

### A. Source repo: `mud-the-developer/blog_news`

Responsibilities:

- fetch external inputs
- rank raw items
- publish source payloads under `data/` and `site/data/`

Primary files:

- `.github/workflows/update-news-source.yml`
- `scripts/fetch_and_build.py`
- `scripts/validate_source_health.py`
- `data/latest.json`

Key facts:

- The source refresh workflow runs on a schedule and via `workflow_dispatch`.
- The remote `blog_news` workflow is authoritative for automation behavior; do not assume the vendored copy in this repo is always the latest remote commit.
- It uses `github.token` as `GITHUB_TOKEN` for GitHub API access during source fetch.
- Current repo-quality gate: GitHub repo items below `50` stars are dropped upstream.

### B. Site repo: `mud-the-developer/blog`

Responsibilities:

- consume the ranked source payload
- generate daily digest posts
- generate archive post
- publish hub JSON and snapshot data
- build and deploy the static site

Primary files:

- `.github/workflows/update-news-digest.yml`
- `.github/workflows/deploy-cloudflare-pages.yml`
- `scripts/generate_news_digest.py`
- `blog-core/src/lib.rs`
- `content/generated/news/latest.json`
- `content/posts/news/*.md`
- `static/news/data/latest.json`

## 2. E2E Data Flow

### Step 1. Source refresh

`blog_news/.github/workflows/update-news-source.yml`

- runs `scripts/fetch_and_build.py`
- validates `data/latest.json`
- commits refreshed `data/` and `site/`

Operational note:

- Recent source-repo fixes for push-race handling may live in the remote `blog_news` repository before they are reflected in the vendored submodule pointer inside `blog`.
- If the current refactor depends on source automation internals, check both:
  - the vendored file in this workspace
  - the latest remote `blog_news` workflow state

Output contract in `data/latest.json`:

- `generatedAt`
- `errors`
- `all`
- `repos`
- `papers`
- `social`
- `hot24`
- `sourceCounts`
- `bySource`

### Step 2. Digest refresh

`blog/.github/workflows/update-news-digest.yml`

- clones `vendor/blog_news` if `NEWS_REPO_TOKEN` is present
- otherwise falls back to `static/news/data/latest.json`
- validates source freshness and source health
- runs `scripts/generate_news_digest.py`
- commits generated digest artifacts
- dispatches deploy workflow

Important:

- `NEWS_REPO_TOKEN` is currently required for reliable E2E automation because `mud-the-developer/blog_news` is private.
- Without that secret, the workflow falls back to the committed snapshot and may fail freshness validation if the snapshot contains GitHub fetch errors.
- In other words: source refresh can be healthy while site digest generation is still broken if `NEWS_REPO_TOKEN` is missing.

### Step 3. Deploy

`blog/.github/workflows/deploy-cloudflare-pages.yml`

- builds the site with `cargo run -p blog-build`
- runs performance/responsive/link checks
- deploys `dist/` to Cloudflare Pages

## 3. News Outputs in the Site Repo

`scripts/generate_news_digest.py` currently writes all of these:

- daily digest post:
  - `content/posts/news/YYYY-MM-DD-ai-news-digest.md`
- monthly archive post:
  - `content/posts/news/news-digest-archive.md`
- hub JSON:
  - `content/generated/news/latest.json`
- source snapshot fallback:
  - `static/news/data/latest.json`

The archive post is regenerated every time the digest script runs.

## 4. RSS State Today

There is currently only one RSS feed in the site repo:

- `/rss.xml`

It is generated in `blog-core/src/lib.rs` by `write_rss()`.

Current behavior:

- RSS includes the latest non-hidden posts from the whole site
- news digest posts are included because they are normal published posts
- there is no dedicated `/news/rss.xml` or `/feeds/news.xml` yet
- the archive post is also just a normal published post unless explicitly filtered

Implication:

- If a refactor says “news RSS”, confirm whether that means:
  - keep using the global `/rss.xml`
  - add a dedicated news-only feed
  - emit both

Do not assume a dedicated news feed already exists.

## 5. Current Digest Semantics

### Selection / ranking

`scripts/generate_news_digest.py`

- curates four sections:
  - `hot24`
  - `repos`
  - `papers`
  - `social`
- keeps minimum section sizes for:
  - `repos = 10`
  - `papers = 10`
  - `social = 10`
- repo fallback currently requires `50+` stars
- images may come from external GitHub/Hugging Face URLs, but rendered cards now include local fallback thumbs via `onerror`

### Archive

`news-digest-archive.md`

- grouped by month
- rendered with folded `details/summary`
- linked from digest pages and hub JSON via `archive_url`

### Graph behavior

`blog-core/src/lib.rs`

- news digest/archive posts are excluded from graph generation
- global graph excludes them
- local graph payloads for news pages are empty

## 6. Secrets and External Dependencies

### In `blog_news`

- relies on `github.token` as `GITHUB_TOKEN`
- external fetches:
  - GitHub Search API
  - arXiv
  - Hugging Face daily papers
  - Google News RSS
  - GeekNews feed
  - Endigest

### In `blog`

- `NEWS_REPO_TOKEN`
  - required to clone private `mud-the-developer/blog_news`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 7. Known Failure Modes

### Source repo

- GitHub Search API can return `403` / rate-limit style failures
- push race used to cause non-fast-forward failures
  - fixed in `blog_news` workflow by syncing to latest remote before committing generated artifacts

### Site repo

- if `NEWS_REPO_TOKEN` is missing:
  - private clone is skipped
  - fallback snapshot is used
  - freshness validation may fail on stale/error snapshots
- deploy is separate from digest generation
  - digest workflow dispatches deploy explicitly after pushing content

### Rendering

- GitHub Open Graph thumbnails can return `429`
- digest card images now fall back to local thumbs when external image fetch fails

## 8. Safe Refactor Boundaries

### Safe to change independently

- digest card layout / copy in `scripts/generate_news_digest.py`
- archive page structure in `scripts/generate_news_digest.py`
- archive styling in `static/assets/style-note-core.css`
- source ranking heuristics in `vendor/blog_news/scripts/fetch_and_build.py`

### Requires extra care

- anything touching:
  - `NEWS_REPO_TOKEN` behavior
  - workflow commit/push logic
  - `write_rss()` in `blog-core/src/lib.rs`
  - post slug conventions under `content/posts/news/`
  - graph filtering rules

### Do not break

- `content/posts/news/YYYY-MM-DD-ai-news-digest.md` naming
- archive slug: `news/news-digest-archive`
- hub JSON shape expected by `/news/`
- local fallback snapshot path: `static/news/data/latest.json`

## 9. Agent Checklist Before Refactoring

1. Decide whether the target is:
   - source ranking
   - digest rendering
   - RSS feed shape
   - Discord/other downstream delivery
2. Decide whether the change belongs in:
   - `blog_news`
   - `blog`
   - both
3. Check current workflow health:
   - `gh run list -R mud-the-developer/blog_news -w "Update News Source"`
   - `gh run list -R mud-the-developer/blog -w "Update News Digest"`
   - `gh run list -R mud-the-developer/blog -w "Deploy Cloudflare Pages"`
4. If touching source ranking:
   - run `python3 vendor/blog_news/scripts/fetch_and_build.py`
5. If touching digest generation:
   - run `python3 scripts/generate_news_digest.py --date YYYY-MM-DD`
   - usually rerun for the latest one or two digest dates
6. Rebuild the site:
   - `cargo run -p blog-build -- --site-url https://example.test --title "Mud's Blog" --description "Connected notes"`
7. Run link checks:
   - `./scripts/check-html-links.sh dist`

## 10. If the Refactor Goal Is “News RSS”

Ask and resolve these first:

- Do we want a dedicated feed or reuse `/rss.xml`?
- Should the feed include only daily digest posts, or also the archive post?
- Should the feed item description use:
  - digest summary
  - excerpt
  - section summaries
  - raw hub JSON metadata
- Is Discord consuming:
  - the site RSS
  - a news-only RSS
  - direct JSON/webhook payloads

Recommended minimal path:

1. add a dedicated news-only RSS feed
2. keep `/rss.xml` unchanged
3. reuse digest posts as feed items
4. do not feed the archive post itself into Discord

## 11. Agent Handoff Rules

If you are the next agent touching this system:

- Treat `content/generated/news/latest.json` as the current hub contract.
- Treat `content/posts/news/YYYY-MM-DD-ai-news-digest.md` as the canonical daily news artifact.
- Treat `content/posts/news/news-digest-archive.md` as navigation only, not as a content item for downstream delivery.
- If you add a news-only RSS feed, make its membership rule:
  - include daily digest posts
  - exclude the archive post
  - exclude hidden posts
- Before changing workflow logic, check the latest remote Actions runs, not just the vendored workflow file.
