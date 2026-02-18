---
title: README Post Template
description: Reusable README-style post template for this blog.
date: 2026-02-18
tags: [template, readme, blog]
publish: true
---
[[home]]
# README Post Template

Use this file as a starter when you want to publish a README-style project post.

## TL;DR

- What this project does in one sentence.
- Who it is for.
- Why it exists.

## Project Snapshot

- Status: `active` / `prototype` / `archived`
- Stack: `rust`, `askama`, `maud`, `axum`
- Deploy: `Cloudflare Pages`
- Repo: `<your-repo-url>`

## Problem

Describe the pain point this project solves.

## Solution

Describe your approach and key design decisions.

## Core Features

- Feature 1: short description
- Feature 2: short description
- Feature 3: short description

## Architecture

```text
content/posts -> parser -> renderer -> dist/
```

## Frontmatter Example

```yaml
---
title: My Note
description: Short summary
date: 2026-02-18
tags: [rust, notes]
publish: true
---
```

## Obsidian Syntax Examples

Note: keep the backslashes below only if you want to show syntax as plain text.

- Wikilink: `\[\[second-brain\]\]`
- Aliased wikilink: `\[\[second-brain|Second Brain\]\]`
- Embed: `!\[\[attachments/spec.pdf|Spec PDF\]\]`

## Local Build

```bash
cargo run -p blog-build -- \
  --site-url https://your-domain.pages.dev \
  --title "My Garden" \
  --description "Connected notes"
```

## Local Preview

```bash
cargo run -p blog-dev -- --site-url http://localhost:8788
```

## Deployment

1. Push to `main`
2. GitHub Actions builds `dist/`
3. Deploy to Cloudflare Pages

## Trade-offs

- Trade-off 1 and why you accepted it
- Trade-off 2 and future mitigation plan

## Next Steps

- [ ] Add feature X
- [ ] Improve performance for Y
- [ ] Write follow-up post

## Related Notes

- Replace with your internal links once ready
- Example: `\[\[rust-rendering-notes\]\]`
- Example: `\[\[github-cloudflare-pipeline\]\]`
