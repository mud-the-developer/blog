# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-02-19

### Added
- Obsidian-like markdown pipeline with frontmatter, wikilinks, transclusion, callouts, and embeds.
- Interactive graph view with zoom/pan/reset, node highlighting, and mobile touch controls.
- Search index and API endpoints for local and deployed note search.
- SEO outputs and metadata: `sitemap.xml`, `rss.xml`, `robots.txt`, canonical/OG/Twitter/JSON-LD.
- Theme preset system with persisted mode/preset preferences.

### Changed
- Stabilized mobile graph interactions and node navigation behavior.
- Updated search result panel styling to render as an opaque surface.
- Reduced mobile initial render overhead by removing external search runtime dependency and trimming heavy visual effects on coarse-pointer layouts.

### Performance
- Maintained asset budgets for JS/CSS/JSON and preserved static-site-first delivery.
- Reduced mobile paint complexity through lighter mobile-only visual rendering.

### Notes
- This marks the first stable baseline release for the current architecture.
