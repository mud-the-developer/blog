# Jinhyuk Kim — Personal Site & Research Blog (v3)

Static-first personal site, research showcase, CV, CFP radar, and daily AI news digest built with Rust.

## Stack

- **Rust + Tokio + Axum + Askama** static site generator and local preview server (`mud-blog`).
- **`@chenglou/pretext`** browser text layout & typographic field engine.
- **Markdown content** under `posts/` (`projects/`, `cfp/`, `news/`), plus LaTeX CV assets in `cv/`.
- **Cloudflare Pages + Functions** deployment with edge news search / focused brief APIs.
- Restrained editorial glass UI: full-width `1240px` layouts, light/dark themes, zero neon/aurora blobs.

## Routes

- `/` — Personal overview, research clusters, selected work, and recent writing.
- `/projects/` — Interactive systems & research projects index.
- `/cv/` — Structured CV page and printable PDF (`/cv/jinhyuk-kim-cv.pdf`).
- `/writing/` — Full-width writing library with interactive folder tree.
- `/cfp/` — Automated wireless/networking Call-for-Papers radar + `.ics` calendar feed.
- `/news/` & `/news/search/` — Daily AI News Brief (rolling 60-day archive) and focused-issue search lab.
- `/posts/<slug>/` — Individual Markdown posts and digests.

## Commands

```bash
npm run build         # cargo run -- build -> dist/
npm test              # cargo test + python/node unit tests
npm run lint          # cargo fmt + clippy + state check + eslint + biome
npm run test:browser  # Playwright end-to-end & visual checks
npm run dev           # serves 0.0.0.0:4173
```

## Automation

- **Daily AI News Digest** (`.github/workflows/update-news-digest.yml`): fetches signals, generates `posts/news/YYYY-MM-DD-ai-news-digest.md`, refreshes `posts/news/news-digest-archive.md` and `data/news/latest.json`, and retains the most recent 60 days (`--retention-days 60`).
- **Daily CFP Radar** (`.github/workflows/update-cfp-radar.yml`): validates and refreshes tracked wireless/networking conference deadlines (`config/cfp_sources.json`), updates `posts/cfp/cfp-radar.md`, JSON feeds, and `static/cfp/radar.ics`. See [CFP automation](docs/cfp-automation.md).
- **Cloudflare Pages Deploy** (`.github/workflows/deploy-cloudflare-pages.yml`): runs build/test/lint, publishes `dist/`, and smoke-tests live v3 routes.

## Content

Add posts as Markdown files under `posts/<folder>/` with frontmatter:

```md
---
title: Example
date: 2026-11-25
tags: [research, systems]
accent: '#b87945'
---

Body...
```
