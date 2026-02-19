# Version 1 Summary

## Release
- Version: `1.0.0`
- Date: `2026-02-19`
- Baseline branch: `main`

## Scope Included
- Static blog build and local preview workflow (`blog-build`, `blog-dev`).
- Obsidian-style content features (wikilinks, embeds, dataview subset, backlinks).
- Graph visualization for global and side panels.
- Local/API-backed search and generated `search-index.json`.
- SEO-friendly static output and Cloudflare Pages deployment pipeline.

## Stability Baseline
- Mobile graph touch interactions and node navigation stabilized.
- Search dropdown visual consistency improved (opaque panel).
- Mobile rendering cost reduced for first paint paths.

## Operational Checklist
1. Build static output:
   `cargo run -p blog-build -- --site-url <url> --title <title>`
2. Run local preview:
   `cargo run -p blog-dev -- --site-url http://localhost:8788 --title <title>`
3. Verify asset budgets:
   `scripts/check-performance-budget.sh dist`
4. Verify link integrity:
   `scripts/check-html-links.sh dist`
5. Deploy via GitHub Actions workflow to Cloudflare Pages.

## Next Version Candidates (v1.x)
- Lighthouse CI gating for mobile metrics regression.
- Graph lite mode for lower-end mobile devices.
- Improved search query syntax (`tag:`, `path:` filters).
