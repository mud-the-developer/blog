# Rust Obsidian Digital Garden (Static + Free-first)

Obsidian markdown notes are transformed into a static blog with:

- `maud`: post body composition (including backlinks section)
- `askama`: page templates/layout
- `axum`: local preview server
- Cloudflare Pages: static hosting (free-first)

## Features

- Obsidian-like frontmatter support: `dg-publish`, `dg-home`, `tags`, `aliases`, `draft`
- Wikilink support: `[[note]]`, `[[note|label]]`, `[[note#heading]]`
- Backlinks per note
- Static outputs: `sitemap.xml`, `rss.xml`, `robots.txt`, `graph.json`, `search-index.json`
- SEO metadata: canonical, OpenGraph, Twitter, JSON-LD
- Performance baseline: static HTML, lazy image attrs, lightweight CSS

## Project Layout

- `blog-core`: parsing/rendering/static generation engine
- `blog-build`: CLI to build `dist/`
- `blog-dev`: local axum preview server
- `content/posts`: markdown source notes
- `static`: copied as-is into `dist`

## Frontmatter Example

```yaml
---
title: My Note
description: Short summary
date: 2026-02-16
tags: [rust, garden]
aliases: [my-alias]
dg-publish: true
dg-home: false
draft: false
---
```

## Local Build

```bash
cargo run -p blog-build -- \
  --site-url https://your-domain.pages.dev \
  --title "My Garden" \
  --description "Connected notes"
```

## Local Preview (axum)

```bash
cargo run -p blog-dev -- \
  --site-url http://localhost:8788 \
  --title "My Garden"
```

- Preview: `http://127.0.0.1:8788`
- Manual rebuild after editing markdown:

```bash
curl -X POST http://127.0.0.1:8788/__rebuild
```

## GitHub Version Control

1. Create an empty GitHub repository (without README/license/gitignore).
2. Initialize and push this project:

```bash
git init -b main
git add .
git commit -m "Initial digital garden setup"
git remote add origin git@github.com:<your-username>/<your-repo>.git
git push -u origin main
```

If you prefer HTTPS remote:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
```

## Cloudflare Pages (Auto Deploy from GitHub Actions)

1. Create a Cloudflare Pages project in the dashboard once (project name only; this workflow deploys via API).
2. In GitHub repo settings, add secrets:

- `CLOUDFLARE_API_TOKEN`: API token with Pages edit permissions
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID

3. In GitHub repo settings, add variables:

- `CF_PAGES_PROJECT`: Cloudflare Pages project name
- `SITE_URL`: production URL (for canonical/sitemap), e.g. `https://<project>.pages.dev`
- `SITE_TITLE` (optional)
- `SITE_DESCRIPTION` (optional)
- `SITE_AUTHOR` (optional)
- `SITE_LANGUAGE` (optional, e.g. `en` or `ko`)

4. Push to `main`. Workflow `.github/workflows/deploy-cloudflare-pages.yml` will:

- build static files with `cargo run -p blog-build`
- deploy `dist/` using `wrangler pages deploy`

## Notes

- `blog-dev` is for local preview only.
- Production is fully static (`dist/`) for cost and performance.
- If Rust is not installed, install via rustup first.
