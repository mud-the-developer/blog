# Rust Obsidian-style Blog (Static)

Obsidian markdown notes are transformed into a static blog with:

- `maud`: post body composition (including backlinks section)
- `askama`: page templates/layout
- `axum`: local preview server
- Cloudflare Pages: static hosting

## Version

- Current stable version: `v1.0.0` (`2026-02-19`)
- Version file: `VERSION`
- Changelog: `CHANGELOG.md`
- Release summary: `docs/v1-summary.md`

## Features

- Obsidian-like frontmatter support: `publish`, `home`, `tags`, `aliases`, `draft`, `enable-search`
- Wikilink support: `[[note]]`, `[[note|label]]`, `[[note#heading]]`
- Note transclusion support: `![[note]]`, `![[note#heading]]`
- Unresolved note links resolve to generated placeholder note pages (`/notes/<slug>/`)
- Callout/Admonition support: `> [!tip]`, `> [!warning]-`
- Mermaid block support: fenced ` ```mermaid ` diagrams rendered client-side
- PlantUML block support: fenced ` ```plantuml ` diagrams via PlantUML server URL
- Math support: KaTeX auto-render for `$...$` and `$$...$$`
- PDF embed support: `![[...pdf]]`
- Excalidraw/Canvas JSON mini-preview: `![[...excalidraw]]`, `![[...canvas]]`
- Dataview subset support: fenced `dataview` with `LIST/TABLE/TASK FROM #tag`, `FROM "folder"`, `FROM [[note]]`
- Dataview query options: `WHERE` (`contains`/`startswith`/`=` with `AND`), `SORT` (`title`, `file.name`, `file.path`, `file.folder`), `LIMIT`
- Dataview table column subset: `TABLE file.link, file.path, file.tags ...` with optional `AS "Alias"`
- DataviewJS safe subset mode (`--dataviewjs-mode tag-pages`): static render for `dv.pages(...)` + subset `where/sort/limit` with `dv.list/dv.table/dv.taskList`
- Custom regex filters via `static/regex-filters.json` (sequential markdown rewrite rules)
- Backlinks per note
- Persistent side graph with zoom/pan and node labels (source data: `graph.json`)
- Global search API (`/api/search`) and htmx search fragment endpoint (`/api/search/view`) on `blog-dev`
- `enable-search: false` excludes that note from `search-index.json` and API search
- Theme system: 40 presets (20 light / 20 dark), `System/Light/Dark` mode, random preset, reset, and persisted settings
- Static outputs: `sitemap.xml`, `rss.xml`, `robots.txt`, `graph.json`, `search-index.json`, `frontmatter-report.json`
- Build-time unsupported frontmatter key report (`frontmatter-report.json`) for migration visibility
- Generated `404.html` page for unknown routes
- SEO metadata: canonical, OpenGraph, Twitter, JSON-LD
- Performance baseline: static HTML, lazy image attrs, lightweight CSS

## Project Layout

- `blog-core`: parsing/rendering/static generation engine
- `blog-build`: CLI to build `dist/`
- `blog-dev`: local axum preview server
- `content/posts`: markdown source notes
- `static`: copied as-is into `dist`
- non-markdown files in `content/posts`: copied to `dist/content` for media embeds

## Frontmatter Example

```yaml
---
title: My Note
description: Short summary
date: 2026-02-16
tags: [rust, blog]
aliases: [my-alias]
publish: true
home: false
enable-search: true
draft: false
---
```

## Local Build

```bash
cargo run -p blog-build -- \
  --site-url https://your-domain.pages.dev \
  --title "My Blog" \
  --description "Connected notes"
```

- Default publish policy is opt-in (`publish: true` required).
- Optional legacy mode:

```bash
cargo run -p blog-build -- --publish-policy permissive
```

## Local Preview (axum)

```bash
cargo run -p blog-dev -- \
  --site-url http://localhost:8788 \
  --title "My Blog"
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
git commit -m "Initial blog setup"
git remote add origin git@github.com:<your-username>/<your-repo>.git
git push -u origin main
```

If you prefer HTTPS remote:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
```

## Cloudflare Pages (GitHub Actions Deploy)

Use GitHub Actions to build Rust artifacts, then deploy `dist/` to Cloudflare Pages.

1. Create a Cloudflare Pages project once in the dashboard (project name only).
2. In GitHub repository settings, add secrets:

- `CLOUDFLARE_API_TOKEN`: token with Cloudflare Pages edit permissions
- `CLOUDFLARE_ACCOUNT_ID`: 32-character Cloudflare Account ID (not Zone ID)

Token scope minimum:

- `Account` -> `Cloudflare Pages` -> `Edit`
- `Account` -> `Account Settings` -> `Read`

3. In GitHub repository settings, add variables:

- `CF_PAGES_PROJECT`: Cloudflare Pages project name
- `SITE_URL`: `https://mud-blog.pages.dev` (or your custom domain)
- `SITE_TITLE` (optional)
- `SITE_DESCRIPTION` (optional)
- `SITE_AUTHOR` (optional)
- `SITE_LANGUAGE` (optional, e.g. `ko`)
- `SITE_SOCIAL_IMAGE` (optional, e.g. `/og-image.png` or full `https://...`)

4. Push to `main`.

- Workflow: `.github/workflows/deploy-cloudflare-pages.yml`
- Action:
  - build with `cargo run -p blog-build`
  - check frontend asset size budgets (`scripts/check-performance-budget.sh`)
  - check broken internal links (`scripts/check-html-links.sh`)
  - deploy `dist/` with `wrangler pages deploy`

## Deployment Mode

- This repository is configured for GitHub Actions deploy to Cloudflare Pages.
- Disable Cloudflare Pages Git direct deploy to avoid duplicate deployments.
- If SEO audit reports `x-robots-tag: noindex`, check Cloudflare Pages project setting:
  `Settings > SEO indexing > Allow search engines`.

## Notes

- `blog-dev` is for local preview only.
- Production is fully static (`dist/`) for cost and performance.
- If Rust is not installed, install via rustup first.
- Optional UI text overrides are available via CLI flags:
  - `--search-placeholder`
  - `--pages-heading`
  - `--toc-heading`
  - `--backlinks-heading`
  - `--backlinks-empty`
- Link preview thumbnail override:
  - `--social-image /og-image.png` (default)
  - supports absolute URL (`https://...`) or site-relative path
- DataviewJS execution policy is configurable:
  - `--dataviewjs-mode disabled` (default)
  - `--dataviewjs-mode tag-pages` (safe static subset with filtered `dv.pages(...)` rendering)
- Optional custom regex filters:
  - Place `static/regex-filters.json` with objects like `{"pattern":"Old","replace":"New"}`
- Optional theme/style hooks:
  - `static/obsidian-theme.css`
  - `static/style-settings.css`
  - `static/user-overrides.css`
  - `static/style-settings.json` (`root`/`light`/`dark` CSS variable maps)
- Social preview image:
  - default file path is `static/og-image.png` (copied to `/og-image.png`)
