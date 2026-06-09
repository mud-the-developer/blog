---
title: Second Brain Architecture
description: How this static blog is built with Rust.
date: 2026-02-15
tags: [rust, architecture]
aliases: [brain-arch]
publish: true
---

# Second Brain Architecture

This note explains the pipeline:

1. Parse frontmatter (`publish`, `home`, tags).
2. Rewrite Obsidian wikilinks.
3. Render markdown.
4. Generate static HTML pages.

See also [[home]] and [[seo-performance-guide|SEO and Performance Guide]].
