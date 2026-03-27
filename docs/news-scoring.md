# News Scoring Model

This repo uses a two-stage scoring model for the AI news digest:

1. Raw feed scoring in `vendor/blog_news/scripts/fetch_and_build.py`
2. Digest reranking in `scripts/generate_news_digest.py`

The goal is not to estimate "absolute quality". The score is a ranking signal that combines:

- source credibility
- freshness / time decay
- momentum / attention
- novelty / trend lift
- cross-source confirmation
- diversity at rerank time

## References

- Reddit hot / confidence ranking
  - `reddit-archive/reddit` source: `r2/r2/lib/db/_sorts.pyx`
  - Why it matters: ranking should combine engagement magnitude with time decay instead of raw counts.

- Altmetric Attention Score
  - Source weighting and modifier documentation from Altmetric
  - Why it matters: a mention from one source type is not equivalent to a mention from another.

- Google News recommendation papers
  - Personalized recommendation from click behavior / collaborative filtering
  - Why it matters: freshness alone is weak; corroboration across sources is a useful second signal.

- Maximal Marginal Relevance (MMR)
  - Carbonell and Goldstein, 1998
  - Why it matters: section ranking should avoid near-duplicates instead of only sorting by relevance.

- OpenAlex work metadata
  - Why it matters: papers need a long-term impact signal separate from short-term buzz.

## Stage 1: Raw Feed Score

Raw scoring is type-specific.

### Repo items

Signals:

- `trust`: source weight from `rules.json`
- `freshness`: continuous decay with a repo-oriented half-life
- `momentum`: GitHub star velocity and total stars
- `novelty`: keyword buzz + trend lift versus previous snapshot
- `confirmation`: how widely the same trend terms appear across distinct sources
- `spike`: recent-time bonus for breaking movement

### Paper items

Signals:

- `trust`: source weight from `rules.json`
- `freshness`: slower decay than repos/social
- `momentum`: citation-like or vote-like paper attention
- `artifact`: linked repo / implementation bonus
- `novelty`: keyword buzz + trend lift
- `confirmation`: cross-source support for the same research theme
- `spike`: recent-time bonus

### Social items

Signals:

- `trust`: lighter source weight plus source-specific credibility adjustment
- `freshness`: fastest decay
- `novelty`: hype and trend lift dominate
- `confirmation`: same theme showing up across multiple source types
- `spike`: recency bonus

## Stage 2: Digest Rerank

The digest layer should not recompute the whole score from scratch. It uses the raw feed score as the anchor, then adds:

- digest freshness adjustment
- rank / rank-delta adjustment
- section-specific refinements
  - repo: star velocity, total stars, AI fit
  - paper: upvotes/citations, implementation artifact, field fit
  - social: source credibility and confirmation carry-over

## Diversity Reranking

`select_diverse_items()` uses an MMR-like greedy selection:

- high local score still wins
- redundancy penalizes repeated source, topic, tags, and lexical overlap
- per-section caps still act as hard guards

This keeps sections from collapsing into a single repo family, paper cluster, or social thread.

## Tuning Guidelines

- Change `rules.json` source weights when source trust changes.
- Change raw feed component weights when the collector over/under-values a source class.
- Change digest-side bonuses when section presentation feels wrong even though the raw feed is reasonable.
- Do not tune all layers at once; adjust raw feed first, then rerank.
