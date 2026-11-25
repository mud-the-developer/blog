# Blog v3 Notes

Repository notes for `/home/mud/repo/blog`.

## Current Architecture

- Active development branch: `feat/v3-personal-site` (deploys from `main`).
- Content sources: `posts/projects/*.md`, `posts/cfp/cfp-radar.md`, `posts/news/*.md` (rolling 60-day retention), and `cv/`.
- Build and serve through Rust (`mud-blog`): Tokio runtime, Axum router, Askama templates, and `@chenglou/pretext` frontend layout.
- Avoid corny hero slogans; use structural UI labels.
- Avoid neon/aurora styling and round background blob motifs.
- Dev preview binds to `0.0.0.0:4173` for LAN/remote viewing.

## Verification Gates

```bash
npm run build
npm test
npm run lint
npm run test:browser
```
