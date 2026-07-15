# News automation

The blog keeps a daily AI news digest and supports keyword-focused manual issues.

## Interactive search-backed issue drafting

The public `/news/` page includes an interactive news desk. It does **not** expose a Google API key to the browser. The browser first posts a query and the user-selected source IDs to:

```text
POST /api/news-search
```

The search route fetches candidate cards from selected sources such as Google News RSS, GitHub repositories, and arXiv papers, then normalizes/deduplicates/ranks them. The user reviews and selects candidates before the browser sends those selected cards to:

```text
POST /api/focused-issue
```

The function uses selected searched candidates first, adds deployed blog assets (`/archive.json` and `/news/data/latest.json`) only as context/fallback, then calls Gemma 4 server-side. The response contains a reviewable markdown draft and ranked source list that the frontend renders as a polished generated-news card. Publishing still requires an explicit repo edit/commit so an unreviewed browser click cannot silently publish. Local `npm run dev` sources `~/.zshrc` before starting Rust preview, so local smoke tests use `GOOGLE_AI_API_KEY`, `GOOGLE_API_KEY`, or `GEMINI_API_KEY` when present; otherwise the local route falls back to deterministic ranked-source text.

## Daily issue

GitHub Actions runs `.github/workflows/update-news-digest.yml` every day at `20 15 * * *` UTC, which is 00:20 KST. The scheduled run:

1. refreshes the private `blog_news` source when `NEWS_REPO_TOKEN` is available,
2. validates source freshness and coverage,
3. runs `python3 scripts/generate_news_digest.py`,
4. writes `posts/news/<YYYY-MM-DD>-ai-news-digest.md`, `posts/news/news-digest-archive.md`, `data/news/latest.json`, and the raw source snapshot,
5. commits the changed news artifacts to `main`; the Cloudflare Pages workflow then runs from the completed news workflow (`workflow_run`) and deploys after its build/test/lint gates pass. This extra trigger is required because GitHub suppresses normal `push` workflow triggers for commits created with the default `GITHUB_TOKEN`.

The freshness/coverage gate is intentionally kept before generation: source data must be under 36 hours old, must not include GitHub/rate-limit hard errors, and must include at least 8 GitHub items plus 8 paper items.

Local equivalent:

```bash
npm run news:daily
# or
python3 scripts/generate_news_digest.py
```

## Keyword + date issue

Use this when you want a focused issue for a specific topic/date without replacing the daily `latest.json` hub.

```bash
npm run news:keyword -- --date 2026-04-14 --keywords "open RAN, Gemma 4"
# or multiple flags
python3 scripts/generate_news_digest.py --date 2026-04-14 --keyword "open RAN" --keyword "Gemma 4"
```

This writes:

- `posts/news/2026-04-14-open-ran-gemma-4-news-digest.md`
- `data/news/2026-04-14-open-ran-gemma-4-news-digest.json`

The monthly archive is only regenerated for normal daily runs, so one-off keyword issues do not pollute the default daily archive.

## NVIDIA NIM with Gemini fallback

The generator tries NVIDIA NIM first through its OpenAI-compatible API. If NIM is unavailable, errors, or returns invalid JSON, it tries Gemma/Gemini through the Google Generative Language API.

NIM variables:

- `NVIDIA_API_KEY`
- `NVIDIA_NIM_MODEL` (default: `nvidia/llama-3.3-nemotron-super-49b-v1`)
- `NVIDIA_NIM_BASE_URL` (default: `https://integrate.api.nvidia.com/v1`)

Gemini fallback variables:

- `GOOGLE_AI_API_KEY`
- `GOOGLE_API_KEY`
- `GEMINI_API_KEY`

The CFP deadline analyzer continues to use Gemini when Google Search grounding is required; NIM is not asked to hallucinate web browsing. Its official-source and evidence validation remains unchanged.

Optional variables:
```bash
export ENABLE_GEMMA_BETA_DIGEST=1
export GOOGLE_AI_MODEL=gemma-4-31b-it
export GEMMA_REQUEST_TIMEOUT_SECONDS=45
export GEMMA_REQUEST_ATTEMPTS=2
```

If no key is available, the generator falls back to deterministic editorial text so the daily automation still produces a post.

## MemPalace context

Local runs enrich the Gemma planning payload from the native MemPalace Chroma store at:

```text
~/.mempalace/palace/chroma.sqlite3
```

The lookup uses the requested keywords as an FTS query and passes up to six matching drawers as editorial context. This context is treated as preference/background only; Gemma is instructed not to invent facts unless supplied news cards support them.

Controls:

```bash
python3 scripts/generate_news_digest.py --keywords "O-RAN" --mempalace-limit 10
python3 scripts/generate_news_digest.py --keywords "O-RAN" --no-mempalace
```

GitHub-hosted scheduled runs usually do not have the local MemPalace directory, so they simply proceed with an empty context list. Local/Hermes runs get the richer context automatically.
