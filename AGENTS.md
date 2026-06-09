# Blog rebuild notes

This branch is a from-scratch rebuild of `/home/mud/repo/blog`.

Current direction:

- Keep the reset isolated on `rebuild/pretext-from-scratch-20260608-120652` unless the user asks otherwise.
- Source posts from `posts/*.md`.
- Build and serve through Rust: Tokio runtime, Askama templates, HTMX fragments.
- Avoid corny hero slogans. Use structural UI labels instead.
- Avoid neon/aurora styling and round background blob motifs.
- Dev preview should bind to `0.0.0.0:4173` for remote viewing.

Verification gates:

```bash
npm run build
npm test
npm run lint
npm run test:browser
```
