# Mud's Blog

From-scratch fast blog rebuild for Jinhyuk Kim.

## Stack

- **Tokio** runtime for build/serve IO.
- **Askama** templates for full pages and HTMX fragments.
- **HTMX** for lightweight fragment refresh/navigation affordances.
- Markdown posts in `posts/*.md`.
- A restrained text-field visual system: no round background blobs, no neon aurora layer.

## Commands

```bash
npm run build       # cargo run -- build -> dist/
npm test            # cargo test
npm run lint        # fmt + clippy + JS syntax checks
npm run test:browser
npm run dev         # serves 0.0.0.0:4173
```

## Content

Add posts as Markdown files under `posts/` with frontmatter:

```md
---
title: Example
date: 2026-06-08
tags: [research, systems]
accent: '#b87945'
---

Body...
```
