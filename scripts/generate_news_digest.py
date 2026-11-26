#!/usr/bin/env python3
"""Build blog-owned news digest artifacts from vendor/blog_news data.

Pipeline:
1. Read ranked raw feed data from vendor/blog_news/data/latest.json
2. Curate the sections used by the native /news/ page
3. Generate one daily markdown digest post under posts/news/
4. Generate one JSON payload for the native /news/ hub under data/news/
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from html import escape as html_escape
from html import unescape as html_unescape
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "vendor" / "blog_news" / "data" / "latest.json"
SNAPSHOT_PATH = ROOT / "static" / "news" / "data" / "latest.json"
GENERATED_DIR = ROOT / "data" / "news"
POSTS_DIR = ROOT / "posts" / "news"
TRANSLATION_CACHE_PATH = GENERATED_DIR / "translation-cache.json"
BETA_DIGEST_CACHE_PATH = GENERATED_DIR / "gemma-beta-cache.json"
# shortcut: modern KST dates only; use IANA timezone data for historical Korean dates.
KST = timezone(timedelta(hours=9), "KST")
ARCHIVE_STEM = "news-digest-archive"
ARCHIVE_URL = f"/posts/{ARCHIVE_STEM}/"
NEWS_ASSET_DIR = ROOT / "static" / "news" / "assets"
DEFAULT_GEMMA_REQUEST_TIMEOUT_SECONDS = 35.0
DEFAULT_GEMMA_REQUEST_ATTEMPTS = 2
RECENT_DIGEST_LOOKBACK_DAYS = 7
DEFAULT_MEMPALACE_PATH = Path.home() / ".mempalace" / "palace"
DEFAULT_MEMPALACE_LIMIT = 6
DEFAULT_RETENTION_DAYS = 60
DAILY_DIGEST_FILENAME_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-ai-news-(?:beta-)?digest\.md$")

SECTION_SPECS = [
    ("hot24", "Hot in 24 Hours", "The fastest-moving items across repos, papers, and community chatter."),
    ("repos", "Repository Momentum", "Fresh GitHub projects worth scanning before the feed turns over."),
    ("papers", "Fresh Papers", "New research worth bookmarking for a deeper read."),
    ("social", "Community Chatter", "Directional signals from discussion-heavy sources."),
]
PAPER_SOURCES = {"arxiv.org", "openreview.net", "paperswithcode.com", "huggingface.co"}
SECTION_MINIMUMS = {"repos": 10, "papers": 10, "social": 10}

SOURCE_LABELS = {
    "github.com": "GitHub",
    "arxiv.org": "arXiv",
    "huggingface.co": "HF Papers",
    "x.com": "X",
    "linkedin.com": "LinkedIn",
    "geeknews": "GeekNews",
    "endigest.dev": "Endigest",
}

SOURCE_MARKS = {
    "github.com": "GH",
    "arxiv.org": "ARX",
    "huggingface.co": "HF",
    "x.com": "X",
    "linkedin.com": "in",
    "geeknews": "GN",
    "endigest.dev": "ED",
}

SOCIAL_SOURCES = {"x.com", "linkedin.com", "geeknews", "endigest.dev"}

SOURCE_SCORE_BONUS = {
    "github.com": 0.34,
    "arxiv.org": 0.26,
    "huggingface.co": 0.22,
    "geeknews": 0.24,
    "x.com": 0.12,
    "linkedin.com": 0.08,
    "endigest.dev": -0.08,
}

SIGNAL_TERMS = (
    "agent",
    "agentic",
    "ai",
    "llm",
    "gpt",
    "openai",
    "anthropic",
    "claude",
    "gemini",
    "copilot",
    "codex",
    "rag",
    "reasoning",
    "multimodal",
    "benchmark",
    "inference",
    "quantization",
    "model",
    "mcp",
    "workflow",
    "orchestrator",
    "open source",
    "arxiv",
    "vran",
    "o-ran",
    "open ran",
    "ric",
    "xapp",
    "rapp",
    "ran",
)

TOPIC_BUCKETS = {
    "agents": ("agent", "agentic", "orchestrat", "multi-agent", "autonomous", "harness"),
    "coding": ("coding", "codex", "copilot", "opencode", "codebase", "ide", "swe-bench", "developer"),
    "models": ("model", "llm", "gpt", "claude", "gemini", "qwen", "llama", "deepseek", "moe", "frontier"),
    "reasoning": ("reasoning", "thinking", "trace", "benchmark", "eval", "rlvr", "verifier"),
    "distillation": ("distill", "post-train", "fine-tun", "lora", "grpo", "dpo", "alignment"),
    "inference": ("inference", "quantiz", "serving", "latency", "vllm", "kv cache", "speculative", "gpu", "kernel"),
    "rag": ("rag", "retrieval", "vector", "memory", "context", "knowledge graph", "search"),
    "multimodal": ("multimodal", "vision", "video", "audio", "speech", "image", "world model"),
    "embodied": ("robot", "embodied", "vla", "manipulation", "physical", "humanoid"),
    "mcp": ("mcp", "tool use", "function calling", "protocol", "gateway", "browser use"),
    "safety": ("safety", "jailbreak", "red team", "guardrail", "policy", "privacy", "security"),
    "openran": ("vran", "o-ran", "open ran", "ric", "xapp", "rapp", "6g", "5g", "beamforming", "ran"),
}

TOPIC_LABELS = {
    "agents": "Agentic Systems",
    "coding": "AI Coding & Dev",
    "models": "Frontier Models",
    "reasoning": "Reasoning & Evals",
    "distillation": "Post-Training & Distillation",
    "inference": "Inference & Systems",
    "rag": "Retrieval & Memory",
    "multimodal": "Multimodal & World Models",
    "embodied": "Robotics & Embodied AI",
    "mcp": "MCP & Tooling",
    "safety": "Safety & Governance",
    "openran": "AI-RAN & Wireless",
}


@dataclass
class NewsItem:
    headline: str
    title: str
    url: str
    source: str
    tags: list[str]
    score: float
    raw_score: float
    published_hours_ago: int
    stars: int
    image_url: str
    badge: str
    deck: str
    meta: str
    rank: int
    rank_delta: int | None


TRANSLATION_CACHE: dict[str, str] = {}
BETA_DIGEST_CACHE: dict[str, Any] = {}


@dataclass
class BetaDigest:
    title: str
    dek: str
    lead: str
    article_body: list[str]
    takeaways: list[str]
    section_titles: dict[str, str]
    section_bodies: dict[str, list[str]]
    closing: str


class GemmaRequestError(RuntimeError):
    """Raised when the optional Gemma beta layer fails after retries."""


@dataclass
class RecentDigestMemory:
    urls: Counter[str] = field(default_factory=Counter)
    canonical_keys: Counter[str] = field(default_factory=Counter)
    topics: Counter[str] = field(default_factory=Counter)
    sources: Counter[str] = field(default_factory=Counter)
    url_last_seen_days: dict[str, int] = field(default_factory=dict)
    key_last_seen_days: dict[str, int] = field(default_factory=dict)
    days_loaded: int = 0
    total_items: int = 0
RECENT_DIGEST_MEMORY = RecentDigestMemory()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the blog news digest artifacts.")
    parser.add_argument("--date", help="Issue date in YYYY-MM-DD. Defaults to current date in Asia/Seoul.")
    parser.add_argument("--limit", type=int, default=10, help="Target cards per section in the digest post.")
    parser.add_argument("--keyword", action="append", default=[], help="Focus the issue on one keyword. Can be passed multiple times.")
    parser.add_argument("--keywords", default="", help="Comma-separated keyword focus list for manual issue generation.")
    parser.add_argument("--mempalace-limit", type=int, default=DEFAULT_MEMPALACE_LIMIT, help="Maximum MemPalace drawers to pass into the Gemma planning payload.")
    parser.add_argument("--no-mempalace", action="store_true", help="Disable local MemPalace context enrichment for this run.")
    parser.add_argument("--retention-days", type=int, default=DEFAULT_RETENTION_DAYS, help="Number of recent calendar days of daily digest posts to keep (0 disables pruning).")
    parser.add_argument("--prune-only", action="store_true", help="Prune daily digest posts and caches older than --retention-days and refresh archive/hub metadata without fetching new feeds.")
    return parser.parse_args()


def issue_date_from_args(raw: str | None) -> datetime:
    if raw:
        return datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=KST)
    return datetime.now(tz=KST)


def normalize_keywords(values: list[str] | tuple[str, ...] | None) -> list[str]:
    keywords: list[str] = []
    seen: set[str] = set()
    for raw in values or []:
        for part in re.split(r"[,;]", str(raw)):
            keyword = collapse_whitespace(part).strip(" -_/\t")
            if not keyword:
                continue
            key = keyword.lower()
            if key in seen:
                continue
            seen.add(key)
            keywords.append(keyword)
    return keywords[:6]


def keywords_from_args(args: argparse.Namespace) -> list[str]:
    return normalize_keywords([*(args.keyword or []), args.keywords or ""])


def slugify_keyword(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "focus"


def digest_stem_for(issue_dt: datetime, keywords: list[str] | tuple[str, ...] | None = None) -> str:
    issue_date = issue_dt.strftime("%Y-%m-%d")
    normalized = normalize_keywords(list(keywords or []))
    if not normalized:
        return f"{issue_date}-ai-news-digest"
    focus_slug = "-".join(slugify_keyword(keyword) for keyword in normalized)
    focus_slug = re.sub(r"-+", "-", focus_slug).strip("-")[:80] or "focus"
    return f"{issue_date}-{focus_slug}-news-digest"


def google_ai_api_key() -> str:
    for name in ("GOOGLE_AI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"):
        value = (os.getenv(name) or "").strip()
        if value:
            return value
    return ""


def keyword_query_text(keywords: list[str] | tuple[str, ...] | None) -> str:
    return " ".join(normalize_keywords(list(keywords or []))).strip()


def mempalace_fts_query(keywords: list[str] | tuple[str, ...] | None) -> str:
    normalized = normalize_keywords(list(keywords or []))
    if not normalized:
        normalized = ["AI news", "blog research"]
    quoted: list[str] = []
    for keyword in normalized:
        safe_keyword = keyword.replace('"', '""')
        quoted.append(f'"{safe_keyword}"')
    return " OR ".join(quoted)


def load_mempalace_context(
    keywords: list[str] | tuple[str, ...] | None,
    *,
    palace_path: Path = DEFAULT_MEMPALACE_PATH,
    limit: int = DEFAULT_MEMPALACE_LIMIT,
) -> list[dict[str, str]]:
    query = mempalace_fts_query(keywords)
    db_path = palace_path / "chroma.sqlite3"
    if limit <= 0 or not db_path.exists():
        return []
    try:
        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        rows = con.execute(
            """
            select f.rowid as id, f.string_value as content,
                   coalesce(wing.string_value, '') as wing,
                   coalesce(room.string_value, '') as room,
                   coalesce(source.string_value, '') as source_file
            from embedding_fulltext_search f
            left join embedding_metadata wing on wing.id = f.rowid and wing.key = 'wing'
            left join embedding_metadata room on room.id = f.rowid and room.key = 'room'
            left join embedding_metadata source on source.id = f.rowid and source.key = 'source_file'
            where embedding_fulltext_search match ?
            order by bm25(embedding_fulltext_search)
            limit ?
            """,
            (query, max(1, min(limit, 20))),
        ).fetchall()
        con.close()
    except Exception as error:
        warn_digest(f"MemPalace context lookup skipped ({type(error).__name__}: {error}).")
        return []

    context: list[dict[str, str]] = []
    for row in rows:
        content = collapse_whitespace(str(row["content"] or ""))
        if not content:
            continue
        context.append(
            {
                "content": content[:1200],
                "wing": str(row["wing"] or ""),
                "room": str(row["room"] or ""),
                "source_file": str(row["source_file"] or ""),
            }
        )
    return context


def issue_date_label(issue_dt: datetime) -> str:
    return f"{issue_dt:%b} {issue_dt.day}, {issue_dt.year}"


def generated_timestamp_label(generated_at: datetime) -> str:
    hour = generated_at.hour % 12 or 12
    return f"{issue_date_label(generated_at)} · {hour}:{generated_at:%M %p} KST"


def recent_digest_paths(issue_dt: datetime, lookback_days: int = RECENT_DIGEST_LOOKBACK_DAYS) -> list[Path]:
    dated_paths: list[tuple[datetime, Path]] = []
    for path in POSTS_DIR.glob("*-ai-news-digest.md"):
        stem = path.stem.removesuffix("-ai-news-digest")
        try:
            entry_dt = datetime.strptime(stem, "%Y-%m-%d").replace(tzinfo=KST)
        except ValueError:
            continue
        delta_days = (issue_dt.date() - entry_dt.date()).days
        if 1 <= delta_days <= lookback_days:
            dated_paths.append((entry_dt, path))
    dated_paths.sort(reverse=True)
    return [path for _, path in dated_paths]


def read_json_object(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("expected a JSON object")
        return payload
    except (OSError, ValueError) as error:
        raise ValueError(f"Cannot load JSON object from {path}") from error


def load_source_feed() -> dict[str, Any]:
    for path in (SOURCE_PATH, SNAPSHOT_PATH):
        if path.exists():
            return read_json_object(path)
    raise FileNotFoundError(
        f"missing news source data at {SOURCE_PATH} and fallback snapshot at {SNAPSHOT_PATH}"
    )


def ensure_dirs() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    NEWS_ASSET_DIR.mkdir(parents=True, exist_ok=True)


def snapshot_feed_payload(payload: dict[str, Any]) -> dict[str, Any]:
    all_items = payload.get("all") or []
    source_counts = payload.get("sourceCounts") or {}
    paper_count = sum(1 for item in all_items if item_badge(item) == "Paper")

    return {
        "generatedAt": payload.get("generatedAt"),
        "errors": payload.get("errors") or [],
        "all": all_items,
        "sourceCounts": source_counts,
        "paperCount": paper_count,
    }


def write_source_snapshot(payload: dict[str, Any]) -> None:
    SNAPSHOT_PATH.write_text(
        json.dumps(snapshot_feed_payload(payload), ensure_ascii=False, separators=(",", ":"))
        + "\n", encoding="utf-8"
    )


def load_translation_cache() -> None:
    TRANSLATION_CACHE.clear()
    if TRANSLATION_CACHE_PATH.exists():
        TRANSLATION_CACHE.update(read_json_object(TRANSLATION_CACHE_PATH))


def save_translation_cache() -> None:
    TRANSLATION_CACHE_PATH.write_text(
        json.dumps(TRANSLATION_CACHE, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def load_beta_digest_cache() -> None:
    BETA_DIGEST_CACHE.clear()
    if BETA_DIGEST_CACHE_PATH.exists():
        BETA_DIGEST_CACHE.update(read_json_object(BETA_DIGEST_CACHE_PATH))


def save_beta_digest_cache() -> None:
    BETA_DIGEST_CACHE_PATH.write_text(
        json.dumps(BETA_DIGEST_CACHE, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def nvidia_api_key() -> str:
    return (os.getenv("NVIDIA_API_KEY") or "").strip()


def nvidia_model_name() -> str:
    return (os.getenv("NVIDIA_NIM_MODEL") or "").strip() or "nvidia/llama-3.3-nemotron-super-49b-v1"


def nvidia_api_url() -> str:
    base = (os.getenv("NVIDIA_NIM_BASE_URL") or "https://integrate.api.nvidia.com/v1").rstrip("/")
    return f"{base}/chat/completions"


def gemma_beta_enabled() -> bool:
    flag = (os.getenv("ENABLE_GEMMA_BETA_DIGEST") or "").strip().lower()
    if flag in {"0", "false", "no", "off"}:
        return False
    return bool(nvidia_api_key() or google_ai_api_key())


def gemma_model_name() -> str:
    model = (os.getenv("GOOGLE_AI_MODEL") or "").strip() or "models/gemma-4-31b-it"
    return model if model.startswith("models/") else f"models/{model}"


def gemma_api_url() -> str:
    return (
        f"https://generativelanguage.googleapis.com/v1beta/"
        f"{gemma_model_name()}:generateContent?key={google_ai_api_key()}"
    )


def gemma_request_timeout_seconds() -> float:
    raw = (os.getenv("GOOGLE_AI_TIMEOUT_SECONDS") or "").strip()
    if raw:
        try:
            return max(10.0, min(float(raw), 120.0))
        except ValueError:
            pass
    return DEFAULT_GEMMA_REQUEST_TIMEOUT_SECONDS


def gemma_request_attempts() -> int:
    raw = (os.getenv("GOOGLE_AI_MAX_ATTEMPTS") or "").strip()
    if raw:
        try:
            return max(1, min(int(raw), 4))
        except ValueError:
            pass
    return DEFAULT_GEMMA_REQUEST_ATTEMPTS


def warn_digest(message: str) -> None:
    print(f"[news-digest] {message}", file=sys.stderr)


def normalize_image(url: str) -> str:
    if url.startswith("/assets/"):
        return "/assets/news/" + url.removeprefix("/assets/")
    return url


def fallback_image_url(source: str, badge: str) -> str:
    if source == "github.com" or badge == "Repo":
        return "/assets/news/thumb-repo.svg"
    if source in PAPER_SOURCES or badge == "Paper":
        return "/assets/news/thumb-paper.svg"
    if badge == "vRAN":
        return "/assets/news/thumb-vran.svg"
    return "/assets/news/thumb-ai.svg"


def source_mark(source: str) -> str:
    return SOURCE_MARKS.get(source, "•")


def source_class_suffix_from_source(source: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", source.lower()).strip("-") or "source"


def meta_without_source(meta: str, source: str) -> str:
    prefix = f"{source_label(source)} · "
    if meta.startswith(prefix):
        return meta[len(prefix) :]
    return meta


def compact_count(value: int) -> str:
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M".rstrip("0").rstrip(".")
    if value >= 1_000:
        return f"{value / 1_000:.1f}k".rstrip("0").rstrip(".")
    return str(value)


def public_meta_without_score(card: NewsItem, *, limit: int = 3) -> str:
    bits = [bit.strip() for bit in meta_without_source(card.meta, card.source).split("·")]
    public_bits: list[str] = []
    for bit in bits:
        lowered = bit.lower()
        if not bit:
            continue
        if lowered.startswith("signal "):
            continue
        if re.fullmatch(r"(?:up|down)\s+\d+", lowered):
            continue
        if card.badge == "Repo" and re.fullmatch(r"[\d,]+\s+stars", lowered):
            continue
        if card.badge == "Paper" and lowered == relative_hours_label(card.published_hours_ago).lower():
            continue
        public_bits.append(bit)
    return " · ".join(public_bits[:limit])


def compact_metric_for(card: NewsItem) -> tuple[str, str]:
    if card.badge == "Repo" and card.stars > 0:
        return compact_count(card.stars), "stars"
    if card.badge == "Paper":
        return relative_hours_label(card.published_hours_ago), "paper"
    if card.badge == "Social":
        return "Community", "wire"
    return relative_hours_label(card.published_hours_ago), "fresh"


def clean_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+-\s+(LinkedIn|x\.com)$", "", value)
    return value


def looks_feed_artifact(title: str) -> bool:
    lowered = clean_title(title).lower()
    if not lowered:
        return True
    if lowered.startswith(("http://", "https://", "www.")):
        return True
    if re.fullmatch(r"[0-9a-f]{16,}", lowered):
        return True
    if re.fullmatch(r"[a-z0-9_-]{18,}", lowered):
        return True
    if lowered.startswith(("engineering.fb.com", "docs.cloud.google.com")):
        return True
    return "release notes" in lowered


def needs_translation(value: str) -> bool:
    return bool(re.search(r"[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\u3130-\u318f\uac00-\ud7af]", value))


def translate_to_english(value: str) -> str:
    value = value.strip()
    if not value or not needs_translation(value):
        return value
    cached = TRANSLATION_CACHE.get(value)
    if cached:
        return cached
    url = (
        "https://translate.googleapis.com/translate_a/single"
        f"?client=gtx&sl=auto&tl=en&dt=t&q={quote(value)}"
    )
    try:
        with urlopen(url, timeout=8) as response:  # noqa: S310 — fixed HTTPS Google endpoint
            payload = json.loads(response.read().decode("utf-8"))
        translated = "".join(part[0] for part in payload[0] if part and part[0]).strip()
        if translated:
            TRANSLATION_CACHE[value] = translated
            return translated
    except Exception as error:
        warn_digest(f"Translation skipped ({type(error).__name__}).")
    return value


def repo_name_from_title(title: str) -> str:
    if " — " in title:
        return title.split(" — ", 1)[0].strip()
    return ""


def repo_description_from_title(title: str) -> str:
    if " — " in title:
        return title.split(" — ", 1)[1].strip()
    return ""


def item_title(item: dict[str, Any]) -> str:
    cached = item.get("_title")
    if isinstance(cached, str) and cached:
        return cached
    return english_title_for(item)


def headline_for(item: dict[str, Any]) -> str:
    title = item_title(item)
    if item.get("source") == "github.com":
        repo_name = repo_name_from_title(title)
        if repo_name:
            return repo_name
    if item.get("source") in SOCIAL_SOURCES and len(title) > 96:
        sentences = re.split(r"(?<=[.!?])\s+", title)
        if sentences:
            candidate = sentences[0].strip()
            if len(candidate) < 42 and len(sentences) > 1:
                candidate = f"{candidate} {sentences[1].strip()}".strip()
            if candidate:
                title = candidate
    return clamp_text(title, 96)


def display_title_for(card: NewsItem) -> str:
    if card.badge == "Paper":
        return card.title or card.headline
    return card.headline or card.title


def ensure_terminal_punctuation(value: str) -> str:
    value = value.strip()
    if not value:
        return value
    if value.endswith((".", "!", "?", "…")):
        return value
    return value + "."


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def yaml_quote(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)

def yaml_inline_list(values: list[str]) -> str:
    cleaned = []
    seen: set[str] = set()
    for value in values:
        tag = re.sub(r"[^a-z0-9가-힣-]+", "-", str(value).lower()).strip("-")
        if not tag or tag in seen:
            continue
        seen.add(tag)
        cleaned.append(tag)
    return "[" + ", ".join(cleaned) + "]"



def english_title_for(item: dict[str, Any]) -> str:
    title = clean_title(item.get("title", "Untitled"))
    if not needs_translation(title):
        return title
    if item.get("source") == "github.com" and " — " in title:
        repo_name, repo_desc = title.split(" — ", 1)
        translated_desc = translate_to_english(repo_desc)
        return f"{repo_name.strip()} — {translated_desc.strip()}"
    return translate_to_english(title)


def source_label(source: str) -> str:
    return SOURCE_LABELS.get(source, source)


def badge_for(item: dict[str, Any]) -> str:
    categories = item.get("categories") or []
    source = item.get("source", "")
    tags = item.get("tags") or []
    if source == "github.com" or "repo" in categories:
        return "Repo"
    if source in PAPER_SOURCES:
        return "Paper"
    if "cross-domain" in tags:
        return "Cross-domain"
    if "vRAN" in tags:
        return "vRAN"
    if source in {"x.com", "linkedin.com", "geeknews", "endigest.dev"}:
        return "Social"
    return "Signal"


def item_badge(item: dict[str, Any]) -> str:
    cached = item.get("_badge")
    if isinstance(cached, str) and cached:
        return cached
    return badge_for(item)


def lower_tag_values(item: dict[str, Any]) -> list[str]:
    return [str(tag).strip().lower() for tag in item.get("tags") or [] if str(tag).strip()]


def lower_category_values(item: dict[str, Any]) -> list[str]:
    return [str(category).strip().lower() for category in item.get("categories") or [] if str(category).strip()]


def item_text(item: dict[str, Any]) -> str:
    parts = [
        item_title(item),
        str(item.get("summary") or "").strip(),
        str(item.get("url") or "").strip(),
        str(item.get("githubRepo") or "").strip(),
    ]
    parts.extend(str(keyword).strip() for keyword in (item.get("ai_keywords") or []) if str(keyword).strip())
    return " ".join(part for part in parts if part)


def relevance_hit_count(item: dict[str, Any]) -> int:
    cached = item.get("_relevance_hits")
    if isinstance(cached, int):
        return cached
    text = " ".join(
        [
            item_text(item).lower(),
            " ".join(lower_tag_values(item)),
            " ".join(lower_category_values(item)),
        ]
    )
    hits = {term for term in SIGNAL_TERMS if term in text}
    return len(hits)


def primary_topic(item: dict[str, Any]) -> str:
    cached = item.get("_topic")
    if isinstance(cached, str) and cached:
        return cached
    text = " ".join(
        [
            item_text(item).lower(),
            " ".join(lower_tag_values(item)),
            " ".join(lower_category_values(item)),
        ]
    )
    for topic, keywords in TOPIC_BUCKETS.items():
        if any(keyword in text for keyword in keywords):
            return topic
    return item_badge(item).lower()


def topic_from_text(text: str, *, fallback_badge: str = "signal") -> str:
    lowered = text.lower()
    for topic, keywords in TOPIC_BUCKETS.items():
        if any(keyword in lowered for keyword in keywords):
            return topic
    return fallback_badge.lower()


def canonical_key(item: dict[str, Any]) -> str:
    cached = item.get("_canonical_key")
    if isinstance(cached, str) and cached:
        return cached
    url = str(item.get("url") or "").strip().lower()
    if item.get("supplemental") or "#supp-" in url or "#rebalance-" in url:
        source = str(item.get("source") or "unknown").strip().lower()
        return f"supplemental::{source}::{url}"
    title = item_title(item)
    if item_badge(item) == "Repo":
        repo_name = repo_name_from_title(title)
        if repo_name:
            return f"repo::{repo_name.lower()}"
    normalized = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
    return " ".join(normalized.split()[:14])


def canonical_key_from_url_and_title(url: str, title: str) -> str:
    normalized_url = url.strip().lower()
    if "github.com/" in normalized_url:
        match = re.search(r"github\.com/([^/?#]+/[^/?#]+)", normalized_url)
        if match:
            return f"repo::{match.group(1).lower()}"
    normalized = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
    return " ".join(normalized.split()[:14])


def source_from_url(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if host == "news.hada.io":
        return "geeknews"
    return host or "unknown"


def load_recent_digest_memory(issue_dt: datetime) -> RecentDigestMemory:
    memory = RecentDigestMemory()
    anchor_pattern = re.compile(r'<a\b[^>]*\bhref="(https?://[^"]+)"[^>]*>(.*?)</a>', re.DOTALL | re.IGNORECASE)
    target_title_pattern = re.compile(
        r'<(?:h3|strong)\b[^>]*\bdata-pretext-target\b[^>]*>(.*?)</(?:h3|strong)>',
        re.DOTALL | re.IGNORECASE,
    )
    heading_pattern = re.compile(r'<(?:h3|strong)\b[^>]*>(.*?)</(?:h3|strong)>', re.DOTALL | re.IGNORECASE)
    issue_day = issue_dt.date()
    for path in recent_digest_paths(issue_dt):
        match = DAILY_DIGEST_FILENAME_RE.match(path.name)
        days_ago = 1
        if match:
            try:
                file_day = datetime.strptime(match.group(1), "%Y-%m-%d").date()
                days_ago = max(1, (issue_day - file_day).days)
            except ValueError:
                days_ago = 1
        raw = path.read_text(encoding="utf-8")
        memory.days_loaded += 1
        day_urls: set[str] = set()
        day_keys: set[str] = set()
        day_topics: Counter[str] = Counter()
        day_sources: set[str] = set()
        for url, inner_html in anchor_pattern.findall(raw):
            clean_url = html_unescape(url).strip()
            if not clean_url.startswith("http"):
                continue
            if urlparse(clean_url).netloc.lower().endswith("mud-blog.pages.dev"):
                continue
            title_match = target_title_pattern.search(inner_html)
            if title_match:
                title = collapse_whitespace(html_unescape(re.sub(r"<[^>]+>", " ", title_match.group(1))))
            else:
                candidates = [
                    collapse_whitespace(html_unescape(re.sub(r"<[^>]+>", " ", m.group(1))))
                    for m in heading_pattern.finditer(inner_html)
                ]
                long_candidates = [c for c in candidates if len(c) >= 3]
                if long_candidates:
                    title = max(long_candidates, key=len)
                else:
                    title = collapse_whitespace(html_unescape(re.sub(r"<[^>]+>", " ", inner_html)))
            full_text = collapse_whitespace(html_unescape(re.sub(r"<[^>]+>", " ", inner_html)))
            key = canonical_key_from_url_and_title(clean_url, title)
            day_urls.add(clean_url)
            if key:
                day_keys.add(key)
            lower_text = full_text.lower()
            matched_topics: list[tuple[int, str]] = []
            for bucket, terms in TOPIC_BUCKETS.items():
                hits = sum(1 for term in terms if term in lower_text)
                if hits > 0:
                    matched_topics.append((hits, bucket))
            matched_topics.sort(key=lambda pair: (-pair[0], pair[1]))
            for _, bucket in matched_topics[:2]:
                day_topics[bucket] += 1
            day_sources.add(source_from_url(clean_url))
        memory.urls.update(day_urls)
        memory.canonical_keys.update(day_keys)
        memory.topics.update(day_topics)
        memory.sources.update(day_sources)
        memory.total_items += len(day_keys) or len(day_urls)
        for clean_url in day_urls:
            prev = memory.url_last_seen_days.get(clean_url)
            if prev is None or days_ago < prev:
                memory.url_last_seen_days[clean_url] = days_ago
        for key in day_keys:
            prev = memory.key_last_seen_days.get(key)
            if prev is None or days_ago < prev:
                memory.key_last_seen_days[key] = days_ago
    return memory
def set_recent_digest_memory(issue_dt: datetime) -> None:
    global RECENT_DIGEST_MEMORY
    RECENT_DIGEST_MEMORY = load_recent_digest_memory(issue_dt)


def freshness_bonus(hours: int) -> float:
    if hours <= 6:
        return 1.15
    if hours <= 24:
        return 0.95
    if hours <= 48:
        return 0.72
    if hours <= 72:
        return 0.46
    return 0.14


def movement_bonus(rank_delta: int | None) -> float:
    if rank_delta is None:
        return 0.0
    if rank_delta > 0:
        return min(0.72, rank_delta * 0.045)
    if rank_delta < 0:
        return -min(0.32, abs(rank_delta) * 0.012)
    return 0.0


def rank_bonus(rank: int) -> float:
    if rank <= 0:
        return 0.0
    return max(0.0, (120 - min(rank, 120)) / 120 * 0.5)


def looks_low_signal_social(item: dict[str, Any]) -> bool:
    if item.get("source") not in SOCIAL_SOURCES:
        return False
    relevance = relevance_hit_count(item)
    source = item.get("source", "")
    title = item_title(item)
    hours = int(item.get("publishedHoursAgo") or 0)
    if looks_feed_artifact(title):
        return True
    if source == "endigest.dev":
        return True
    if source == "x.com" and (relevance < 3 or hours > 72):
        return True
    if source == "linkedin.com" and relevance < 3:
        return True
    if source == "geeknews" and relevance < 1:
        return True
    if source == "geeknews" and title.lower().startswith("show gn:") and relevance < 2:
        return True
    return source in {"x.com", "linkedin.com"} and len(title) > 220 and relevance < 4


def include_item(item: dict[str, Any]) -> bool:
    badge = item_badge(item)
    relevance = relevance_hit_count(item)
    categories = lower_category_values(item)
    tags = lower_tag_values(item)
    text = item_text(item).lower()
    title = item_title(item)

    if looks_feed_artifact(title):
        return False

    if badge == "Social":
        return not looks_low_signal_social(item)

    if badge == "Paper":
        if relevance > 0:
            return True
        paper_focus = any(
            keyword in text
            for keyword in (
                "llm",
                "language model",
                "agent",
                "reasoning",
                "rag",
                "benchmark",
                "inference",
                "multimodal",
                "vision",
                "training",
                "open ran",
                "o-ran",
                "ran",
            )
        )
        return paper_focus and any(
            category.startswith(prefix)
            for category in categories
            for prefix in ("cs.ai", "cs.cl", "cs.lg", "cs.ni", "eess.sp", "paper", "hf.daily")
        )

    if badge == "Repo":
        repo_focus = any(
            keyword in text
            for keyword in (
                "agent",
                "agentic",
                "ai",
                "llm",
                "rag",
                "copilot",
                "codex",
                "assistant",
                "mcp",
                "workflow",
                "orchestrator",
                "reasoning",
                "multimodal",
                "inference",
                "benchmark",
            )
        )
        if repo_focus:
            return True
        return "ai" in tags

    return relevance > 0


def relaxed_include_item(item: dict[str, Any]) -> bool:
    title = item_title(item)
    if looks_feed_artifact(title):
        return False
    badge = item_badge(item)
    source = item.get("source", "")
    hours = int(item.get("publishedHoursAgo") or 999)
    if badge == "Repo":
        return source == "github.com" and int(item.get("stars") or 0) >= 10
    if badge == "Paper":
        return source in PAPER_SOURCES and hours <= 24 * 14
    if badge == "Social":
        return source in SOCIAL_SOURCES and hours <= 24 * 14
    return relevance_hit_count(item) > 0


def local_base_score(item: dict[str, Any]) -> float:
    source = item.get("source", "")
    hours = int(item.get("publishedHoursAgo") or 0)
    rank = int(item.get("rank") or 999)
    rank_delta = item.get("rank_delta")
    raw_score = float(item.get("score") or 0.0)
    relevance = relevance_hit_count(item)
    score = raw_score * 1.08
    score += freshness_bonus(hours)
    score += SOURCE_SCORE_BONUS.get(source, 0.0)
    score += min(0.72, relevance * 0.10)
    score += rank_bonus(rank)
    score += movement_bonus(rank_delta if isinstance(rank_delta, int) else None)
    return score


def raw_component(item: dict[str, Any], key: str) -> float:
    why = item.get("why") or {}
    try:
        return float(why.get(key) or 0.0)
    except (TypeError, ValueError):
        return 0.0


def repo_local_bonus(item: dict[str, Any]) -> float:
    stars = int(item.get("stars") or 0)
    stars_per_day = float(item.get("starsPerDay") or 0.0)
    recent_7d = float(item.get("recentStars7d") or 0.0)
    age_days = float(item.get("repoAgeDays") or 365.0)
    pool = str(item.get("ghPool") or "").strip().lower()
    rel_velocity = recent_7d / max(stars + 400.0, 400.0)

    bonus = min(1.05, math.log1p(max(stars_per_day, 0.0)) * 0.30)
    bonus += min(2.4, math.log1p(max(rel_velocity, 0.0) * 100.0) * 1.05)
    bonus += min(0.24, math.log1p(max(stars, 0)) * 0.024)
    bonus += min(0.18, raw_component(item, "confirmation") * 0.30)
    if age_days <= 30:
        bonus += 2.2
    elif age_days <= 90:
        bonus += 1.4
    elif age_days <= 180:
        bonus += 0.7
    elif age_days > 365 and stars > 30000 and rel_velocity < 0.025:
        bonus -= 2.2
    if pool == "emerging":
        bonus += 1.15
    elif pool == "breakout":
        bonus += 0.65
    if "ai" in lower_tag_values(item):
        bonus += 0.12
    if lower_tag_values(item) == ["other"]:
        bonus -= 0.12
    return bonus

def paper_local_bonus(item: dict[str, Any]) -> float:
    citations = int(item.get("citations") or 0)
    upvotes = int(item.get("upvotes") or 0)
    paper_signal = max(citations, upvotes)
    bonus = min(0.26, math.log1p(max(paper_signal, 0)) * 0.22)
    bonus += min(0.22, raw_component(item, "confirmation") * 0.38)
    if item.get("githubRepo"):
        bonus += 0.10
    if any(category.startswith(("cs.ai", "cs.cl", "cs.lg")) for category in lower_category_values(item)):
        bonus += 0.08
    return bonus


def social_local_bonus(item: dict[str, Any]) -> float:
    source = item.get("source", "")
    bonus = {
        "geeknews": 0.18,
        "x.com": 0.08,
        "linkedin.com": 0.02,
        "endigest.dev": -0.14,
    }.get(source, 0.0)
    bonus += min(0.36, raw_component(item, "confirmation") * 0.62)
    if looks_low_signal_social(item):
        bonus -= 0.95
    return bonus


def local_signal_score(item: dict[str, Any]) -> float:
    cached = item.get("_signal_score")
    if isinstance(cached, (float, int)):
        return float(cached)

    badge = item_badge(item)
    title = item_title(item)
    score = local_base_score(item)

    if badge == "Repo":
        score += repo_local_bonus(item)
    elif badge == "Paper":
        score += paper_local_bonus(item)
    elif badge == "Social":
        score += social_local_bonus(item)

    if len(title) > 168:
        score -= 0.14
    if title.lower().startswith("www."):
        score -= 0.18

    return round(score, 3)


def recent_last_seen_days(item: dict[str, Any]) -> int | None:
    key = canonical_key(item)
    url = str(item.get("url") or "").strip()
    days = [
        value
        for value in (
            RECENT_DIGEST_MEMORY.key_last_seen_days.get(key),
            RECENT_DIGEST_MEMORY.url_last_seen_days.get(url),
        )
        if value is not None
    ]
    return min(days) if days else None


def recent_digest_penalty(item: dict[str, Any]) -> float:
    key = canonical_key(item)
    url = str(item.get("url") or "").strip()
    topic = primary_topic(item)
    source = str(item.get("source") or "").strip().lower()

    key_hits = RECENT_DIGEST_MEMORY.canonical_keys.get(key, 0)
    url_hits = RECENT_DIGEST_MEMORY.urls.get(url, 0)
    hits = max(key_hits, url_hits)
    last_seen = recent_last_seen_days(item)
    topic_hits = RECENT_DIGEST_MEMORY.topics.get(topic, 0)
    source_hits = RECENT_DIGEST_MEMORY.sources.get(source, 0)

    penalty = 0.0
    if hits > 0:
        if last_seen is not None and last_seen <= 1:
            penalty += 16.0
        elif last_seen is not None and last_seen <= 3:
            penalty += 11.5
        elif last_seen is not None and last_seen <= 5:
            penalty += 7.5
        else:
            penalty += 4.8
        penalty += max(0, hits - 1) * 3.5
    else:
        penalty -= 0.85

    penalty += max(0, topic_hits - 3) * 0.12
    penalty += max(0, source_hits - 4) * 0.05
    return round(penalty, 3)


def recent_repeat_count(item: dict[str, Any]) -> int:
    return max(
        RECENT_DIGEST_MEMORY.canonical_keys.get(canonical_key(item), 0),
        RECENT_DIGEST_MEMORY.urls.get(str(item.get("url") or "").strip(), 0),
    )


def selection_signal_score(item: dict[str, Any]) -> float:
    cached = item.get("_selection_score")
    if isinstance(cached, (float, int)):
        return float(cached)
    return round(local_signal_score(item) - recent_digest_penalty(item), 3)

def clamp_text(value: str, limit: int) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def safe_text(value: str) -> str:
    return html_escape(value, quote=True)


def badge_class_suffix(badge: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", badge.lower()).strip("-")
    return normalized or "signal"


def relative_hours_label(hours: int) -> str:
    if hours <= 0:
        return "<1h ago"
    if hours < 24:
        return f"{hours}h ago"
    days = max(1, round(hours / 24))
    return f"{days}d ago"


def repo_update_label(item: dict[str, Any]) -> str:
    hours = int(item.get("updatedHoursAgo") or item.get("publishedHoursAgo") or 0)
    if hours <= 0:
        return "updated <1h ago"
    if hours < 24:
        return f"updated {hours}h ago"
    days = max(1, round(hours / 24))
    return f"updated {days}d ago"


def repo_age_days(item: dict[str, Any]) -> float:
    try:
        return float(item.get("repoAgeDays") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def repo_age_label(item: dict[str, Any]) -> str:
    age_days = repo_age_days(item)
    if age_days <= 1.5:
        return "created today"
    if age_days < 14:
        return f"created {max(2, round(age_days))}d ago"
    return f"created {round(age_days)}d ago"


def repo_rate_label(item: dict[str, Any]) -> str | None:
    recent_7 = int(item.get("recentStars7d") or 0)
    recent_30 = int(item.get("recentStars30d") or 0)
    if recent_7 > 0:
        return f"+{recent_7}/7d"
    if recent_30 > 0:
        return f"+{recent_30}/30d"
    age_days = repo_age_days(item)
    stars_per_day = float(item.get("starsPerDay") or 0.0)
    if age_days < 14 or stars_per_day <= 0:
        return None
    return f"avg {stars_per_day:.1f}/day"


def render_digest_card_lines(
    card: NewsItem,
    *,
    extra_classes: str = "",
    lead_note: str | None = None,
) -> list[str]:
    card_classes = "news-digest-card"
    card_classes += f" news-digest-card--{badge_class_suffix(card.badge)}"
    if extra_classes:
        card_classes += f" {extra_classes}"

    badge_suffix = badge_class_suffix(card.badge)
    source_suffix = source_class_suffix_from_source(card.source)
    source_name = source_label(card.source)
    lines = [
        f'      <a class="{card_classes}" href="{safe_text(card.url)}" target="_blank" rel="noreferrer">',
        '        <div class="news-digest-card-copy">',
        '          <div class="news-digest-card-topline">',
        f'            <span class="news-digest-source-chip news-digest-source-chip--{source_suffix}">',
        f'              <span class="news-digest-source-mark" aria-hidden="true">{safe_text(source_mark(card.source))}</span>',
        f'              <span class="news-digest-source-label">{safe_text(source_name)}</span>',
        "            </span>",
        f'            <span class="news-digest-card-badge news-digest-card-badge--{badge_suffix}">{safe_text(card.badge)}</span>',
        "          </div>",
        '          <div class="news-digest-card-eyebrow">',
        f'            <span class="news-digest-card-meta">{safe_text(public_meta_without_score(card))}</span>',
        "          </div>",
    ]
    if lead_note:
        lines.append(f'          <p class="news-digest-card-note" data-pretext-target>{safe_text(lead_note)}</p>')
    lines.extend(
        [
            f'          <h3 data-pretext-target>{safe_text(display_title_for(card))}</h3>',
            f'          <p class="news-digest-card-deck" data-pretext-target>{safe_text(card.deck)}</p>',
            "        </div>",
            "      </a>",
        ]
    )
    return lines


def public_summary_text(value: str) -> str:
    value = re.sub(r";\s*biggest mover:\s*[^.;]+\(\+\d+\)", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    return ensure_terminal_punctuation(value) if value else ""


def description_from_post(path: Path) -> str:
    raw = path.read_text(encoding="utf-8")
    match = re.search(r'^description:\s*(.+)$', raw, flags=re.MULTILINE)
    if not match:
        return ""
    value = match.group(1).strip()
    if not value:
        return ""
    if value.startswith(('"', "'")):
        try:
            return public_summary_text(json.loads(value))
        except json.JSONDecodeError:
            return public_summary_text(value.strip("\"'"))
    return public_summary_text(value)


def deck_for(item: dict[str, Any], badge: str) -> str:
    hours = int(item.get("publishedHoursAgo") or 0)
    stars = int(item.get("stars") or 0)
    title = item_title(item)
    tags = [tag for tag in item.get("tags") or [] if tag.lower() != "other"]
    tag_text = ", ".join(tags[:3]).lower()
    movement = ""
    if badge == "Repo":
        repo_desc = repo_description_from_title(title)
        update_label = repo_update_label(item)
        age_label = repo_age_label(item)
        rate_label = repo_rate_label(item)
        if repo_desc:
            repo_desc = ensure_terminal_punctuation(repo_desc)
            freshness = f" {update_label.capitalize()}."
            if stars > 0 and rate_label:
                freshness += f" {stars} stars, {rate_label}, {age_label}."
            elif stars > 0:
                freshness += f" {stars} stars, {age_label}."
            else:
                freshness += "."
            return clamp_text(repo_desc + freshness + movement, 190)
        if stars > 0:
            return clamp_text(
                f"GitHub repo with {stars} stars, {age_label}, {update_label}.{movement}",
                190,
            )
        return clamp_text(f"GitHub repo signal picked up with {update_label}.{movement}", 190)
    if badge == "Paper":
        paper_source = source_label(item.get("source", ""))
        summary = str(item.get("summary") or "").strip()
        time_label = relative_hours_label(hours)
        if summary:
            return clamp_text(
                f"{ensure_terminal_punctuation(summary)} Surfaced via {paper_source} {time_label}.{movement}",
                190,
            )
        if tag_text:
            return clamp_text(
                f"Fresh {paper_source} paper from the {tag_text} cluster, posted {time_label}.{movement}",
                180,
            )
        return clamp_text(
            f"Fresh {paper_source} paper posted {time_label} and surfacing in the current feed.{movement}",
            180,
        )
    if badge == "Social":
        time_label = relative_hours_label(hours)
        return clamp_text(
            f"Community signal picked up on {source_label(item.get('source', ''))} {time_label}.{movement}",
            170,
        )
    if badge == "Cross-domain":
        return f"Cross-domain signal bridging AI and telecom themes, surfaced {relative_hours_label(hours)}.{movement}"
    if badge == "vRAN":
        return f"vRAN-oriented signal that bubbled up {relative_hours_label(hours)}.{movement}"
    if tag_text:
        return clamp_text(
            f"Fresh {tag_text} signal surfaced in the current issue {relative_hours_label(hours)}.{movement}",
            170,
        )
    return clamp_text(f"Fresh signal surfaced in the current issue {relative_hours_label(hours)}.{movement}", 170)


def meta_for(item: dict[str, Any]) -> str:
    bits: list[str] = [source_label(item.get("source", ""))]
    stars = int(item.get("stars") or 0)
    hours = int(item.get("publishedHoursAgo") or 0)
    score = local_signal_score(item)
    rank_delta = item.get("rank_delta")
    if stars > 0:
        bits.append(f"{stars} stars")
    if item_badge(item) == "Repo":
        rate_label = repo_rate_label(item)
        if rate_label:
            bits.append(rate_label)
        bits.append(repo_age_label(item))
        bits.append(repo_update_label(item))
    else:
        bits.append(relative_hours_label(hours))
    if isinstance(rank_delta, int) and rank_delta > 0:
        bits.append(f"up {rank_delta}")
    elif isinstance(rank_delta, int) and rank_delta < 0:
        bits.append(f"down {abs(rank_delta)}")
    bits.append(f"signal {score:.2f}")
    return " · ".join(bits)


def to_card(item: dict[str, Any]) -> NewsItem:
    badge = item_badge(item)
    title = item_title(item)
    return NewsItem(
        headline=headline_for(item),
        title=title,
        url=item.get("url", "#"),
        source=item.get("source", ""),
        tags=[tag for tag in list(item.get("tags") or []) if tag.lower() != "other"],
        score=local_signal_score(item),
        raw_score=float(item.get("score") or 0.0),
        published_hours_ago=int(item.get("publishedHoursAgo") or 0),
        stars=int(item.get("stars") or 0),
        image_url=normalize_image(item.get("image", "/assets/news/thumb-ai.svg")),
        badge=badge,
        deck=deck_for(item, badge),
        meta=meta_for(item),
        rank=int(item.get("rank") or 999),
        rank_delta=item.get("rank_delta") if isinstance(item.get("rank_delta"), int) else None,
    )


def payload_candidate_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for key in ("all", "repos", "papers", "social", "hot24"):
        values = payload.get(key) or []
        if isinstance(values, list):
            items.extend(value for value in values if isinstance(value, dict))
    by_source = payload.get("bySource") or {}
    if isinstance(by_source, dict):
        for values in by_source.values():
            if isinstance(values, list):
                items.extend(value for value in values if isinstance(value, dict))
    return items


def annotated_item(raw: dict[str, Any]) -> dict[str, Any]:
    item = dict(raw)
    item["_title"] = english_title_for(item)
    item["_badge"] = badge_for(item)
    item["_relevance_hits"] = relevance_hit_count(item)
    item["_topic"] = primary_topic(item)
    item["_canonical_key"] = canonical_key(item)
    item["_signal_score"] = local_signal_score(item)
    item["_selection_score"] = selection_signal_score(item)
    return item


def prepare_candidates(payload: dict[str, Any], *, relaxed: bool = False) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for raw in payload_candidate_items(payload):
        item = annotated_item(raw)
        if relaxed:
            if not relaxed_include_item(item):
                continue
        elif not include_item(item):
            continue
        key = canonical_key(item)
        current = deduped.get(key)
        if current is None or selection_signal_score(item) > selection_signal_score(current):
            deduped[key] = item
    return sorted(
        deduped.values(),
        key=lambda item: (
            -selection_signal_score(item),
            int(item.get("rank") or 999),
            int(item.get("publishedHoursAgo") or 999),
            item_title(item),
        ),
    )


def lexical_tokens(item: dict[str, Any]) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", item_title(item).lower()))


def item_similarity(left: dict[str, Any], right: dict[str, Any]) -> float:
    similarity = 0.0
    if item_badge(left) == item_badge(right):
        similarity += 0.12
    if left.get("source") == right.get("source"):
        similarity += 0.35
    if primary_topic(left) == primary_topic(right):
        similarity += 0.35
    shared_tags = set(lower_tag_values(left)) & set(lower_tag_values(right))
    similarity += min(0.18, len(shared_tags) * 0.06)
    left_tokens = lexical_tokens(left)
    right_tokens = lexical_tokens(right)
    if left_tokens and right_tokens:
        similarity += min(0.20, (len(left_tokens & right_tokens) / len(left_tokens | right_tokens)) * 0.35)
    return min(1.0, similarity)


def select_diverse_items(
    items: list[dict[str, Any]],
    limit: int,
    *,
    max_per_source: int | None = None,
    max_per_topic: int | None = None,
    max_per_badge: int | None = None,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()
    source_counts: Counter[str] = Counter()
    topic_counts: Counter[str] = Counter()
    badge_counts: Counter[str] = Counter()

    def best_candidate(source_limit: int | None, topic_limit: int | None, badge_limit: int | None) -> dict[str, Any] | None:
        winner: dict[str, Any] | None = None
        winner_score: float | None = None
        for item in items:
            key = canonical_key(item)
            if key in seen:
                continue
            source = item.get("source", "")
            topic = primary_topic(item)
            badge = item_badge(item)
            if source_limit is not None and source_counts[source] >= source_limit:
                continue
            if topic_limit is not None and topic_counts[topic] >= topic_limit:
                continue
            if badge_limit is not None and badge_counts[badge] >= badge_limit:
                continue
            redundancy = max((item_similarity(item, existing) for existing in selected), default=0.0)
            marginal = selection_signal_score(item) - (0.55 * redundancy)
            if winner_score is None or marginal > winner_score:
                winner = item
                winner_score = marginal
        return winner

    for source_limit, topic_limit, badge_limit in (
        (max_per_source, max_per_topic, max_per_badge),
        (None, max_per_topic, max_per_badge),
        (None, None, max_per_badge),
        (None, None, None),
    ):
        while len(selected) < limit:
            candidate = best_candidate(source_limit, topic_limit, badge_limit)
            if candidate is None:
                break
            key = canonical_key(candidate)
            seen.add(key)
            selected.append(candidate)
            source_counts[candidate.get("source", "")] += 1
            topic_counts[primary_topic(candidate)] += 1
            badge_counts[item_badge(candidate)] += 1

    return selected[:limit]


def sort_key(item: dict[str, Any]) -> tuple[float, int, int, str]:
    return (
        -selection_signal_score(item),
        int(item.get("rank") or 999),
        int(item.get("publishedHoursAgo") or 999),
        item_title(item),
    )


def prune_section_items(slug: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return []
    best_score = selection_signal_score(items[0])
    min_keep = {"hot24": 4, **SECTION_MINIMUMS}.get(slug, 3)
    floor = {
        "hot24": max(4.4, best_score - 2.4),
        "repos": max(5.45, best_score - 3.55),
        "papers": max(4.1, best_score - 1.9),
        "social": max(3.3, best_score - 2.1),
    }.get(slug, 0.0)
    filtered = [item for item in items if selection_signal_score(item) >= floor]
    if len(filtered) >= min_keep:
        return filtered
    return items[: min(min_keep, len(items))]


@dataclass
class DigestContext:
    summary: str
    top_cards: list[NewsItem]
    repo_scoreboard: list[NewsItem]
    sections: list[tuple[str, str, str, list[NewsItem]]]
    source_counts: list[dict[str, Any]]
    keywords: list[str] = field(default_factory=list)
    mempalace_context: list[dict[str, str]] = field(default_factory=list)
    trends: list[dict[str, Any]] = field(default_factory=list)


def item_topic_matches(item: dict[str, Any]) -> list[str]:
    text = item_text(item).lower()
    scored: list[tuple[int, str]] = []
    for bucket, terms in TOPIC_BUCKETS.items():
        hits = sum(1 for term in terms if term in text)
        if hits > 0:
            scored.append((hits, bucket))
    scored.sort(key=lambda pair: (-pair[0], pair[1]))
    return [bucket for _, bucket in scored[:2]]


def detect_trend_clusters(items: list[dict[str, Any]], *, limit: int = 4) -> list[dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_per_bucket: dict[str, set[str]] = defaultdict(set)
    for item in items:
        key = canonical_key(item)
        for bucket in item_topic_matches(item):
            if key in seen_per_bucket[bucket]:
                continue
            seen_per_bucket[bucket].add(key)
            buckets[bucket].append(item)

    total_today = max(1, len({canonical_key(item) for item in items}))
    has_baseline = RECENT_DIGEST_MEMORY.days_loaded > 0 and RECENT_DIGEST_MEMORY.total_items > 0
    ranked: list[tuple[float, dict[str, Any]]] = []
    for slug, cluster_items in buckets.items():
        if len(cluster_items) < 2:
            continue
        cluster_items.sort(key=sort_key)
        fresh_cluster = prefer_fresh_candidates(cluster_items, cooldown_days=3)
        sources = sorted({source_label(str(x.get("source") or "")) for x in cluster_items if x.get("source")})
        fresh_count = sum(1 for x in cluster_items if recent_repeat_count(x) == 0)
        today_share = len(cluster_items) / total_today
        if has_baseline:
            baseline_share = (RECENT_DIGEST_MEMORY.topics.get(slug, 0) + 1.5) / (RECENT_DIGEST_MEMORY.total_items + 12.0)
        else:
            baseline_share = 0.14
        burst_ratio = round(min(4.5, max(0.3, today_share / max(0.03, baseline_share))), 2)
        top_signal = sum(min(6.5, max(0.0, selection_signal_score(x))) for x in fresh_cluster[:3])
        trend_score = (
            len(sources) * 2.8
            + min(4.8, burst_ratio * 1.65)
            + min(3.5, fresh_count * 0.45)
            + top_signal * 0.38
        )
        if len(sources) >= 2 and burst_ratio >= 1.35:
            burst_label = f"{len(sources)} feeds · ↑{burst_ratio:.1f}x"
        elif len(sources) >= 2:
            burst_label = f"{len(sources)} feeds converging"
        elif burst_ratio >= 1.45:
            burst_label = f"↑{burst_ratio:.1f}x vs 7d share"
        else:
            burst_label = f"{fresh_count} fresh signals"
        lead = fresh_cluster[0]
        lead_source = source_label(str(lead.get("source") or ""))
        showcase = [lead]
        for candidate in fresh_cluster[1:]:
            if source_label(str(candidate.get("source") or "")) != lead_source:
                showcase.append(candidate)
                break
        if len(showcase) < 2 and len(fresh_cluster) > 1:
            showcase.append(fresh_cluster[1])
        ranked.append(
            (
                trend_score,
                {
                    "slug": slug,
                    "label": TOPIC_LABELS.get(slug, slug.title()),
                    "count": len(cluster_items),
                    "fresh_count": fresh_count,
                    "sources": sources,
                    "burst_ratio": burst_ratio,
                    "burst_label": burst_label,
                    "score": round(trend_score, 2),
                    "lead_title": headline_for(lead),
                    "lead_url": str(lead.get("url") or ""),
                    "lead_source": lead_source,
                    "items": [
                        {
                            "title": headline_for(x),
                            "url": str(x.get("url") or ""),
                            "source": source_label(str(x.get("source") or "")),
                        }
                        for x in showcase
                    ],
                },
            )
        )
    ranked.sort(key=lambda pair: (-pair[0], -pair[1]["count"], pair[1]["label"]))
    return [entry for _, entry in ranked[:limit]]

def prefer_fresh_candidates(items: list[dict[str, Any]], *, cooldown_days: int = 3) -> list[dict[str, Any]]:
    fresh = [
        item
        for item in items
        if (recent_last_seen_days(item) is None or (recent_last_seen_days(item) or 99) > cooldown_days)
    ]
    return fresh if fresh else items

def issue_summary(section_items: dict[str, list[dict[str, Any]]]) -> str:
    repos = section_items.get("repos") or []
    papers = section_items.get("papers") or []
    social = section_items.get("social") or []
    repo_item = repos[0] if repos else None
    paper_item = papers[0] if papers else None
    social_item = social[0] if social else None
    fragments: list[str] = []
    if repo_item:
        fragments.append(f"GitHub velocity is led by {headline_for(repo_item)}")
    if paper_item:
        fragments.append(f"paper attention is clustering around {headline_for(paper_item)}")
    if social_item:
        fragments.append(f"social attention is tilting toward {headline_for(social_item)}")
    lead = ensure_terminal_punctuation("; ".join(fragments)) if fragments else "Signals stayed active."
    return (
        f"{lead} "
        f"{len(repos)} repo signals, {len(papers)} paper picks, and {len(social)} community items made today's cut."
    )


def source_count_rows_from_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = Counter(item.get("source", "") for item in items if item.get("source"))
    rows = [{"label": source_label(source), "value": count} for source, count in counts.items()]
    rows.sort(key=lambda row: (-row["value"], row["label"]))
    return rows


def section_limit_for(slug: str, limit: int) -> int:
    return {
        "hot24": min(max(limit, 6), 8),
        "repos": max(limit, SECTION_MINIMUMS["repos"]),
        "papers": max(limit, SECTION_MINIMUMS["papers"]),
        "social": max(limit, SECTION_MINIMUMS["social"]),
    }.get(slug, limit)


def ensure_section_minimum(items: list[dict[str, Any]], pool: list[dict[str, Any]], minimum: int) -> list[dict[str, Any]]:
    if len(items) >= minimum:
        return items
    selected = list(items)
    seen = {canonical_key(item) for item in selected}
    for item in pool:
        key = canonical_key(item)
        if key in seen:
            continue
        selected.append(item)
        seen.add(key)
        if len(selected) >= minimum:
            break
    return sorted(selected, key=sort_key)


def item_matches_keywords(item: dict[str, Any], keywords: list[str] | tuple[str, ...] | None) -> bool:
    normalized = normalize_keywords(list(keywords or []))
    if not normalized:
        return True
    haystack = item_text(item).lower()
    return any(keyword.lower() in haystack for keyword in normalized)


def focus_candidates(items: list[dict[str, Any]], keywords: list[str]) -> list[dict[str, Any]]:
    if not keywords:
        return items
    focused = [item for item in items if item_matches_keywords(item, keywords)]
    return focused if len(focused) >= 6 else items


def build_digest_context(
    payload: dict[str, Any],
    limit: int,
    *,
    keywords: list[str] | tuple[str, ...] | None = None,
    mempalace_context: list[dict[str, str]] | None = None,
) -> DigestContext:
    normalized_keywords = normalize_keywords(list(keywords or []))
    candidates = focus_candidates(prepare_candidates(payload), normalized_keywords)
    relaxed_candidates = focus_candidates(prepare_candidates(payload, relaxed=True), normalized_keywords)
    section_items: dict[str, list[dict[str, Any]]] = {
        "repos": [item for item in candidates if item_badge(item) == "Repo"],
        "papers": [item for item in candidates if item_badge(item) == "Paper"],
        "social": [item for item in candidates if item_badge(item) == "Social"],
    }
    fallback_section_items: dict[str, list[dict[str, Any]]] = {
        "repos": [item for item in relaxed_candidates if item_badge(item) == "Repo"],
        "papers": [item for item in relaxed_candidates if item_badge(item) == "Paper"],
        "social": [item for item in relaxed_candidates if item_badge(item) == "Social"],
    }
    curated_raw: dict[str, list[dict[str, Any]]] = {}
    curated_raw["repos"] = ensure_section_minimum(
        prune_section_items(
            "repos",
            select_diverse_items(
                prefer_fresh_candidates(section_items["repos"]),
                section_limit_for("repos", limit),
                max_per_topic=3,
            ),
        ),
        section_items["repos"] + fallback_section_items["repos"],
        SECTION_MINIMUMS["repos"],
    )
    curated_raw["papers"] = ensure_section_minimum(
        prune_section_items(
            "papers",
            select_diverse_items(
                prefer_fresh_candidates(section_items["papers"]),
                section_limit_for("papers", limit),
                max_per_source=6,
                max_per_topic=4,
            ),
        ),
        section_items["papers"] + fallback_section_items["papers"],
        SECTION_MINIMUMS["papers"],
    )
    curated_raw["social"] = ensure_section_minimum(
        prune_section_items(
            "social",
            select_diverse_items(
                prefer_fresh_candidates(section_items["social"]),
                section_limit_for("social", limit),
                max_per_source=4,
                max_per_topic=4,
            ),
        ),
        section_items["social"] + fallback_section_items["social"],
        SECTION_MINIMUMS["social"],
    )
    hot_pool = sorted(
        [
            item
            for slug in ("repos", "papers", "social")
            for item in curated_raw[slug]
            if int(item.get("publishedHoursAgo") or 999) <= 72
        ],
        key=sort_key,
    )
    hot24_seed: list[dict[str, Any]] = []
    for slug in ("repos", "papers", "social"):
        if curated_raw[slug]:
            hot24_seed.append(curated_raw[slug][0])
    for item in select_diverse_items(
        hot_pool,
        section_limit_for("hot24", limit),
        max_per_source=2,
        max_per_topic=2,
        max_per_badge=3,
    ):
        key = canonical_key(item)
        if any(canonical_key(existing) == key for existing in hot24_seed):
            continue
        hot24_seed.append(item)
        if len(hot24_seed) >= section_limit_for("hot24", limit):
            break
    curated_raw["hot24"] = prune_section_items("hot24", sorted(hot24_seed, key=sort_key))
    for slug in curated_raw:
        curated_raw[slug] = sorted(curated_raw[slug], key=sort_key)

    featured_raw: list[dict[str, Any]] = []
    for slug in ("repos", "papers", "social"):
        if curated_raw[slug]:
            lead = next(
                (
                    item
                    for item in curated_raw[slug]
                    if recent_repeat_count(item) == 0
                    and (item_badge(item) != "Social" or local_signal_score(item) >= 4.0)
                ),
                curated_raw[slug][0],
            )
            if item_badge(lead) != "Social" or local_signal_score(lead) >= 4.0:
                featured_raw.append(lead)
    extras_pool_all = sorted(
        [
            item
            for slug in ("hot24", "repos", "papers", "social")
            for item in curated_raw[slug]
            if item_badge(item) != "Social" or local_signal_score(item) >= 4.2
        ],
        key=sort_key,
    )
    extras_pool = [item for item in extras_pool_all if recent_repeat_count(item) == 0]
    extras = select_diverse_items(extras_pool, 4, max_per_source=1, max_per_topic=1, max_per_badge=2)
    if len(extras) < 4:
        refill = select_diverse_items(extras_pool_all, 4, max_per_source=1, max_per_topic=1, max_per_badge=2)
        seen_extra = {canonical_key(item) for item in extras}
        for item in refill:
            key = canonical_key(item)
            if key in seen_extra:
                continue
            extras.append(item)
            seen_extra.add(key)
            if len(extras) >= 4:
                break
    for item in extras:
        key = canonical_key(item)
        if any(canonical_key(existing) == key for existing in featured_raw):
            continue
        featured_raw.append(item)
        if len(featured_raw) >= 4:
            break

    sections = [
        (slug, title, description, [to_card(item) for item in curated_raw[slug]])
        for slug, title, description in SECTION_SPECS
    ]
    summary = issue_summary(curated_raw)
    source_count_keys: dict[str, dict[str, Any]] = {}
    for item in [item for slug in ("repos", "papers", "social") for item in curated_raw[slug]]:
        source_count_keys.setdefault(canonical_key(item), item)
    source_counts = source_count_rows_from_items(list(source_count_keys.values()))
    trend_pool_map: dict[str, dict[str, Any]] = {}
    for item in candidates + relaxed_candidates:
        trend_pool_map.setdefault(canonical_key(item), item)
    trends = detect_trend_clusters(list(trend_pool_map.values()), limit=4)
    return DigestContext(
        summary=summary,
        top_cards=[to_card(item) for item in featured_raw[:4]],
        repo_scoreboard=[to_card(item) for item in curated_raw["repos"][:8]],
        sections=sections,
        source_counts=source_counts,
        keywords=normalized_keywords,
        mempalace_context=list(mempalace_context or []),
        trends=trends,
    )

def beta_digest_cache_key(issue_dt: datetime, context: DigestContext) -> str:
    raw = json.dumps(
        {
            "version": 5,
            "date": issue_dt.strftime("%Y-%m-%d"),
            "keywords": context.keywords,
            "mempalace_context": context.mempalace_context[:4],
            "summary": context.summary,
            "top_cards": [card.__dict__ for card in context.top_cards],
            "repo_scoreboard": [card.__dict__ for card in context.repo_scoreboard],
            "sections": [
                {
                    "slug": slug,
                    "title": title,
                    "description": description,
                    "items": [card.__dict__ for card in cards[:6]],
                }
                for slug, title, description, cards in context.sections
            ],
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_llm_json(text: str) -> dict[str, Any]:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    if not raw:
        raise ValueError("empty llm response")
    first_json = min([idx for idx in [raw.find("{"), raw.find("[")] if idx != -1], default=-1)
    if first_json > 0:
        raw = raw[first_json:]
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError("Invalid model JSON") from error
    if not isinstance(parsed, dict):
        raise ValueError("Model response must be a JSON object")
    return parsed


def join_phrases(parts: list[str]) -> str:
    cleaned = [part.strip() for part in parts if part and part.strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return f"{', '.join(cleaned[:-1])}, and {cleaned[-1]}"


def fallback_takeaways(context: DigestContext) -> list[str]:
    lines: list[str] = []
    for card in context.top_cards[:4]:
        meta_bits = [source_label(card.source)]
        if card.rank_delta is not None and card.rank_delta != 0:
            direction = "up" if card.rank_delta > 0 else "down"
            meta_bits.append(f"{direction} {abs(card.rank_delta)}")
        elif card.published_hours_ago >= 0:
            meta_bits.append(relative_hours_label(card.published_hours_ago))
        meta = join_phrases(meta_bits[:2])
        line = f"{card.badge}: {card.headline}"
        if meta:
            line += f" ({meta})"
        lines.append(line)
    return lines or [context.summary]


def fallback_section_story(
    heading: str,
    description: str,
    cards: list[NewsItem],
) -> tuple[str, list[str]]:
    if not cards:
        return heading, [description]

    lead_cards = cards[:3]
    lead_labels = join_phrases(
        [f"{card.headline} from {source_label(card.source)}" for card in lead_cards]
    )
    story = [ensure_terminal_punctuation(f"{description} {lead_labels} are setting the pace.")]

    followups: list[str] = []
    for card in lead_cards[:2]:
        followups.append(
            f"{card.headline} lands as a {card.badge.lower()} signal with {card.meta.lower()}."
        )
    if followups:
        story.append(ensure_terminal_punctuation(" ".join(followups)))

    return heading, story[:2]


def fallback_beta_digest(issue_dt: datetime, context: DigestContext) -> BetaDigest:
    takeaways = fallback_takeaways(context)
    section_titles: dict[str, str] = {}
    section_bodies: dict[str, list[str]] = {}

    for slug, heading, description, cards in context.sections:
        title, paragraphs = fallback_section_story(heading, description, cards)
        section_titles[slug] = title
        section_bodies[slug] = paragraphs

    repo_count = next((int(row["value"]) for row in context.source_counts if row["label"] == "GitHub"), 0)
    top_story_labels = join_phrases([card.headline for card in context.top_cards[:3]])
    article_body = [
        ensure_terminal_punctuation(context.summary),
        ensure_terminal_punctuation(
            f"The quickest scan starts with {top_story_labels or 'the top-ranked repo, paper, and community items'}, "
            f"while {repo_count} GitHub-led signals anchor the repo side of the brief."
        ),
        ensure_terminal_punctuation(
            "The sections below keep the longer tail available without crowding the lead read."
        ),
    ]
    lead = ensure_terminal_punctuation(
        f"{context.summary} The lead read pulls the strongest repo, paper, and community items into one skimmable pass."
    )
    return BetaDigest(
        title=f"AI News Brief — {issue_dt.strftime('%b %d')}",
        dek=context.summary,
        lead=lead,
        article_body=article_body,
        takeaways=takeaways,
        section_titles=section_titles,
        section_bodies=section_bodies,
        closing="The rest of the issue keeps the supporting links close at hand.",
    )


def is_retryable_gemma_error(error: Exception) -> bool:
    if isinstance(error, TimeoutError):
        return True
    if isinstance(error, urllib.error.HTTPError):
        return error.code in {408, 429, 500, 502, 503, 504}
    if isinstance(error, urllib.error.URLError):
        return True
    if isinstance(error, json.JSONDecodeError):
        return True
    return isinstance(error, ValueError)


def gemma_overview_payload(issue_dt: datetime, context: DigestContext) -> dict[str, Any]:
    return {
        "task": "Write the front matter for a newsroom-style daily AI beta brief in JSON.",
        "date": issue_dt.strftime("%Y-%m-%d"),
        "keyword_focus": context.keywords,
        "mempalace_context": context.mempalace_context[:6],
        "constraints": [
            "Treat this as a human-readable editorial briefing page, not a raw list or tweet thread.",
            "Use restrained newsroom language, not hype.",
            "Be concrete, compact, and readable at a glance.",
            "Do not invent facts, counts, or sources.",
            "Use keyword_focus and mempalace_context only as editorial preference/context, never as factual evidence unless a supplied card supports it.",
            "Do not mention ranking formulas or hidden scoring internals.",
            "The lead should read like the opening of a short article.",
            "Return strict JSON only.",
        ],
        "schema": {
            "title": "short editorial title",
            "dek": "1 sentence overview",
            "lead": "2-4 sentence opening brief",
            "article_body": ["3-5 fuller article paragraphs that explain the day end-to-end"],
            "takeaways": ["3-4 sharp takeaway lines"],
            "closing": "short closing note",
        },
        "digest": {
            "summary": context.summary,
            "source_counts": context.source_counts,
            "top_cards": [card.__dict__ for card in context.top_cards],
            "repo_scoreboard": [card.__dict__ for card in context.repo_scoreboard[:5]],
            "sections": [
                {
                    "slug": slug,
                    "title": title,
                    "description": description,
                    "items": [card.__dict__ for card in cards[:6]],
                }
                for slug, title, description, cards in context.sections
            ],
        },
    }


def gemma_section_payload(
    issue_dt: datetime,
    slug: str,
    heading: str,
    description: str,
    cards: list[NewsItem],
    overview: BetaDigest,
) -> dict[str, Any]:
    return {
        "task": "Write one short newsroom section for a daily AI beta brief in JSON.",
        "date": issue_dt.strftime("%Y-%m-%d"),
        "section": slug,
        "constraints": [
            "Write like a short article section, not a bullet list.",
            "Use 2 or 3 paragraphs.",
            "Keep the angle specific to the supplied cards.",
            "Do not invent facts, counts, or relationships that are not present.",
            "Return strict JSON only.",
        ],
        "schema": {
            "title": "tight editorial subhead, 3-8 words",
            "paragraphs": ["paragraph 1", "paragraph 2", "optional paragraph 3"],
        },
        "brief_context": {
            "title": overview.title,
            "dek": overview.dek,
            "lead": overview.lead,
            "takeaways": overview.takeaways,
        },
        "section_context": {
            "heading": heading,
            "description": description,
            "items": [card.__dict__ for card in cards[:4]],
        },
    }


def normalize_section_story(
    parsed: dict[str, Any],
    heading: str,
    description: str,
) -> tuple[str, list[str]]:
    title = str(parsed.get("title") or heading).strip() or heading
    raw_paragraphs = parsed.get("paragraphs") or []
    paragraphs: list[str] = []

    if isinstance(raw_paragraphs, list):
        paragraphs = [str(item).strip() for item in raw_paragraphs if str(item).strip()]
    elif isinstance(raw_paragraphs, str) and raw_paragraphs.strip():
        paragraphs = [raw_paragraphs.strip()]

    if not paragraphs:
        paragraphs = [description]

    return title, paragraphs[:3]


def overview_cache_key(issue_dt: datetime, context: DigestContext) -> str:
    return f"{beta_digest_cache_key(issue_dt, context)}::overview"


def section_cache_key(issue_dt: datetime, context: DigestContext, slug: str, cards: list[NewsItem]) -> str:
    raw = json.dumps(
        {
            "base": beta_digest_cache_key(issue_dt, context),
            "slug": slug,
            "cards": [card.__dict__ for card in cards[:4]],
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def gemma_json_request(cache_key: str, payload: dict[str, Any], *, temperature: float = 0.35) -> dict[str, Any]:
    cached = BETA_DIGEST_CACHE.get(cache_key)
    if isinstance(cached, dict):
        return cached

    providers: list[tuple[str, str, dict[str, str], dict[str, Any]]] = []
    prompt_text = json.dumps(payload, ensure_ascii=False)
    if nvidia_api_key():
        providers.append(
            (
                "NVIDIA NIM",
                nvidia_api_url(),
                {"Authorization": f"Bearer {nvidia_api_key()}", "Content-Type": "application/json", "User-Agent": "blog-news-digest/1.0"},
                {
                    "model": nvidia_model_name(),
                    "messages": [
                        {"role": "system", "content": "Return strict JSON only. Do not invent facts."},
                        {"role": "user", "content": prompt_text},
                    ],
                    "temperature": temperature,
                    "response_format": {"type": "json_object"},
                },
            )
        )
    if google_ai_api_key():
        providers.append(
            (
                "Gemini fallback",
                gemma_api_url(),
                {"Content-Type": "application/json", "User-Agent": "blog-news-digest/1.0"},
                {
                    "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
                    "generationConfig": {"temperature": temperature, "responseMimeType": "application/json"},
                },
            )
        )
    if not providers:
        raise GemmaRequestError("No NVIDIA NIM or Gemini API key is configured.")

    attempts = gemma_request_attempts()
    last_error: Exception | None = None
    for provider_name, endpoint, headers, request_body in providers:
        parsed_endpoint = urlparse(endpoint)
        if parsed_endpoint.scheme not in {"https", "http"} or not parsed_endpoint.hostname:
            raise GemmaRequestError("Model API endpoint must be an HTTP(S) URL.")
        req = urllib.request.Request(  # noqa: S310 — HTTP(S) endpoint validated above
            endpoint,
            data=json.dumps(request_body).encode("utf-8"),
            headers=headers,
        )
        for attempt in range(1, attempts + 1):
            try:
                with urllib.request.urlopen(req, timeout=gemma_request_timeout_seconds()) as response:  # noqa: S310 — validated request
                    api_payload = json.loads(response.read().decode("utf-8"))
                if provider_name == "NVIDIA NIM":
                    response_text = (((api_payload.get("choices") or [{}])[0].get("message") or {}).get("content") or "")
                else:
                    parts = (((api_payload.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
                    response_text = next((part.get("text", "") for part in parts if not part.get("thought") and part.get("text")), "")
                parsed = parse_llm_json(response_text)
                BETA_DIGEST_CACHE[cache_key] = parsed
                return parsed
            except Exception as error:
                last_error = error
                retryable = is_retryable_gemma_error(error)
                if attempt < attempts and retryable:
                    backoff_seconds = min(8.0, 1.5 * (2 ** (attempt - 1)))
                    warn_digest(f"{provider_name} attempt {attempt}/{attempts} failed ({type(error).__name__}); retrying in {backoff_seconds:.1f}s.")
                    time.sleep(backoff_seconds)
                    continue
                warn_digest(f"{provider_name} failed; trying the next configured provider.")
                break

    detail = f"{type(last_error).__name__}: {last_error}" if last_error else "unknown error"
    raise GemmaRequestError(f"NVIDIA NIM and Gemini requests failed: {detail}")


def normalize_overview(parsed: dict[str, Any], issue_dt: datetime, context: DigestContext) -> BetaDigest:
    raw_article_body = parsed.get("article_body") or []
    article_body: list[str] = []
    if isinstance(raw_article_body, list):
        article_body = [str(item).strip() for item in raw_article_body if str(item).strip()]
    elif isinstance(raw_article_body, str) and raw_article_body.strip():
        article_body = [raw_article_body.strip()]

    if not article_body:
        article_body = [str(parsed.get("lead") or context.summary).strip()]

    article_body = rebalance_article_paragraphs(article_body)

    return BetaDigest(
        title=str(parsed.get("title") or f"AI News Brief — {issue_dt.strftime('%Y-%m-%d')}").strip(),
        dek=str(parsed.get("dek") or context.summary).strip(),
        lead=str(parsed.get("lead") or context.summary).strip(),
        article_body=article_body[:5],
        takeaways=[str(item).strip() for item in (parsed.get("takeaways") or []) if str(item).strip()][:4],
        section_titles={},
        section_bodies={},
        closing=str(parsed.get("closing") or "").strip(),
    )


def rebalance_article_paragraphs(paragraphs: list[str]) -> list[str]:
    cleaned = [collapse_whitespace(paragraph) for paragraph in paragraphs if collapse_whitespace(paragraph)]
    if len(cleaned) >= 2:
        return cleaned[:5]

    if not cleaned:
        return []

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", cleaned[0])
        if sentence.strip()
    ]

    if len(sentences) <= 2:
        return cleaned[:5]

    buckets: list[list[str]] = [[] for _ in range(min(3, len(sentences)))]
    for index, sentence in enumerate(sentences):
        bucket_index = min(len(buckets) - 1, index // max(1, math.ceil(len(sentences) / len(buckets))))
        buckets[bucket_index].append(sentence)

    rebalanced = [" ".join(bucket).strip() for bucket in buckets if bucket]
    return rebalanced[:5] if rebalanced else cleaned[:5]


def choose_beta_reference_cards(
    cards: list[NewsItem],
    seen_urls: set[str],
    *,
    limit: int = 2,
) -> list[NewsItem]:
    selected: list[NewsItem] = []
    selected_urls: set[str] = set()
    selected_badges: set[str] = set()

    for card in cards:
        if card.url in seen_urls or card.url in selected_urls or card.badge in selected_badges:
            continue
        selected.append(card)
        selected_urls.add(card.url)
        selected_badges.add(card.badge)
        if len(selected) >= limit:
            return selected

    for card in cards:
        if card.url in seen_urls or card.url in selected_urls:
            continue
        selected.append(card)
        selected_urls.add(card.url)
        if len(selected) >= limit:
            return selected

    for card in cards:
        if card.url in selected_urls:
            continue
        selected.append(card)
        selected_urls.add(card.url)
        if len(selected) >= limit:
            break

    return selected


def render_beta_bar_value(value: float, max_value: float) -> str:
    if max_value <= 0:
        return "24.0%"
    width = max(24.0, min(100.0, round((value / max_value) * 100.0, 1)))
    return f"{width:.1f}%"


def render_beta_source_mix(rows: list[dict[str, Any]]) -> list[str]:
    max_value = max((int(row["value"]) for row in rows[:5]), default=1)
    lines = [
        '      <section class="news-digest-beta-visual-card" aria-label="Source mix">',
        '        <p class="section-kicker">Source mix</p>',
        '        <div class="news-digest-beta-bars">',
    ]
    for row in rows[:5]:
        label = str(row["label"])
        value = int(row["value"])
        lines.extend(
            [
                '          <div class="news-digest-beta-bar-row">',
                f'            <span class="news-digest-beta-bar-label" data-pretext-target>{safe_text(label)}</span>',
                '            <span class="news-digest-beta-bar-track" aria-hidden="true">',
                f'              <span style="width: {render_beta_bar_value(value, max_value)}"></span>',
                "            </span>",
                f'            <strong>{value}</strong>',
                "          </div>",
            ]
        )
    lines.extend(["        </div>", "      </section>"])
    return lines


def render_beta_section_mix(sections: list[tuple[str, str, str, list[NewsItem]]]) -> list[str]:
    max_value = max((len(cards) for _slug, _heading, _description, cards in sections), default=1)
    lines = [
        '      <section class="news-digest-beta-visual-card" aria-label="Section mix">',
        '        <p class="section-kicker">Section load</p>',
        '        <div class="news-digest-beta-bars">',
    ]
    for _slug, heading, _description, cards in sections:
        value = len(cards)
        lines.extend(
            [
                '          <div class="news-digest-beta-bar-row">',
                f'            <span class="news-digest-beta-bar-label" data-pretext-target>{safe_text(heading)}</span>',
                '            <span class="news-digest-beta-bar-track" aria-hidden="true">',
                f'              <span style="width: {render_beta_bar_value(value, max_value)}"></span>',
                "            </span>",
                f'            <strong>{value}</strong>',
                "          </div>",
            ]
        )
    lines.extend(["        </div>", "      </section>"])
    return lines


def render_beta_signal_map(context: DigestContext) -> list[str]:
    max_signal = max((card.score for card in context.repo_scoreboard[:4]), default=1.0)
    lines = [
        '  <section class="news-digest-section news-digest-beta-signal-map">',
        '    <header class="news-digest-section-head">',
        '      <p class="section-kicker">Signal map</p>',
        '      <h2>How today breaks down</h2>',
        '    </header>',
        '    <div class="news-digest-beta-visual-grid">',
        *render_beta_source_mix(context.source_counts),
        *render_beta_section_mix(context.sections),
        '      <section class="news-digest-beta-visual-card" aria-label="Top repo signals">',
        '        <p class="section-kicker">Top repo signals</p>',
        '        <div class="news-digest-beta-bars">',
    ]
    for card in context.repo_scoreboard[:4]:
        lines.extend(
            [
                '          <div class="news-digest-beta-bar-row">',
                f'            <span class="news-digest-beta-bar-label" data-pretext-target>{safe_text(display_title_for(card))}</span>',
                '            <span class="news-digest-beta-bar-track" aria-hidden="true">',
                f'              <span style="width: {render_beta_bar_value(card.score, max_signal)}"></span>',
                "            </span>",
                f'            <strong>{card.score:.1f}</strong>',
                "          </div>",
            ]
        )
    lines.extend(["        </div>", "      </section>", "    </div>", "  </section>"])
    return lines


def render_beta_remaining_signals(context: DigestContext, used_urls: set[str], structured_url: str) -> list[str]:
    remaining: list[NewsItem] = []
    seen_urls: set[str] = set()
    for _slug, _heading, _description, cards in context.sections:
        for card in cards:
            if card.url in used_urls or card.url in seen_urls:
                continue
            remaining.append(card)
            seen_urls.add(card.url)
    if not remaining:
        return []

    lines = [
        '  <section class="news-digest-section news-digest-beta-tail" id="beta-more-signals">',
        '    <header class="news-digest-section-head">',
        '      <p class="section-kicker">More signals</p>',
        '      <h2>Everything else on the wire</h2>',
        '      <p class="news-digest-section-description" data-pretext-target>These are the remaining repo, paper, and community items that made the cut but did not drive the main article narrative.</p>',
        '    </header>',
        '    <div class="news-digest-grid news-digest-grid--tail">',
    ]
    for card in remaining:
        lines.extend(render_digest_card_lines(card, extra_classes="news-digest-tail-card"))
    lines.extend(
        [
            "    </div>",
            '    <div class="news-digest-actions" role="group" aria-label="Remaining signal actions">',
            f'      <a class="post-cta-link" href="{safe_text(structured_url)}">Open structured digest</a>',
            f'      <a class="post-cta-link" href="{safe_text(ARCHIVE_URL)}">Browse digest archive</a>',
            "    </div>",
            "  </section>",
        ]
    )
    return lines


def generate_gemma_beta_digest(issue_dt: datetime, context: DigestContext) -> BetaDigest | None:
    if not gemma_beta_enabled():
        return None
    cache_key = beta_digest_cache_key(issue_dt, context)
    cached = BETA_DIGEST_CACHE.get(cache_key)
    if isinstance(cached, dict):
        try:
            return BetaDigest(**cached)
        except TypeError:
            pass

    try:
        overview = normalize_overview(
            gemma_json_request(
                overview_cache_key(issue_dt, context),
                gemma_overview_payload(issue_dt, context),
                temperature=0.42,
            ),
            issue_dt,
            context,
        )
    except GemmaRequestError as error:
        warn_digest(f"Gemma overview failed; using deterministic beta fallback. {error}")
        return fallback_beta_digest(issue_dt, context)

    beta = BetaDigest(
        title=overview.title,
        dek=overview.dek,
        lead=overview.lead,
        article_body=overview.article_body,
        takeaways=overview.takeaways,
        section_titles={},
        section_bodies={},
        closing=overview.closing,
    )
    BETA_DIGEST_CACHE[cache_key] = beta.__dict__
    return beta


def render_beta_markdown(issue_dt: datetime, generated_dt: datetime, context: DigestContext, beta: BetaDigest) -> tuple[str, str]:
    stem = f"{issue_dt.strftime('%Y-%m-%d')}-ai-news-beta-digest"
    structured_url = f"/posts/{issue_dt.strftime('%Y-%m-%d')}-ai-news-digest/"
    title = beta.title or f"AI News Brief — {issue_dt.strftime('%Y-%m-%d')}"
    frontmatter = "\n".join(
        [
            "---",
            f"title: {yaml_quote(title)}",
            f"description: {yaml_quote(beta.dek or context.summary)}",
            f"date: {issue_dt.strftime('%Y-%m-%d')}",
            "tags: [news, news-digest, ai, beta]",
            "publish: true",
            "content-classes: [news-digest-note, news-digest-beta-note]",
            "---",
            "",
        ]
    )
    source_pills = [
        "      <div class=\"news-digest-beta-source-pills\" aria-label=\"Source mix\">",
        *[
            (
                "        <span class=\"news-digest-beta-source-pill\">"
                f"<span>{safe_text(str(row['label']))}</span><strong>{int(row['value'])}</strong></span>"
            )
            for row in context.source_counts[:5]
        ],
        "      </div>",
    ]
    body = [
        '<div class="news-digest-shell news-digest-beta-shell">',
        '  <section class="news-digest-hero">',
        '    <div class="news-digest-hero-copy">',
        '      <p class="section-kicker">Beta Brief</p>',
        f'      <h1 data-pretext-target>{safe_text(title)}</h1>',
        f'      <p class="news-digest-lead" data-pretext-target>{safe_text(beta.dek)}</p>',
        f'      <p class="news-digest-section-description" data-pretext-target>{safe_text(beta.lead)}</p>',
        '      <div class="news-digest-actions" role="group" aria-label="Beta digest actions">',
        f'        <a class="post-cta-link" href="{safe_text(structured_url)}">Open structured digest</a>',
        '        <a class="post-cta-link" href="/news/data/latest.json" target="_blank" rel="noreferrer">Source data</a>',
        "      </div>",
        "    </div>",
        '    <div class="news-digest-meta-grid">',
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Issue date</span>',
        f'        <strong><time datetime="{issue_dt.strftime("%Y-%m-%d")}">{safe_text(issue_date_label(issue_dt))}</time></strong>',
        "      </div>",
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Generated</span>',
        f'        <strong><time datetime="{generated_dt.isoformat()}">{safe_text(generated_timestamp_label(generated_dt))}</time></strong>',
        "      </div>",
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Mode</span>',
        "        <strong>Gemma 4 beta</strong>",
        "      </div>",
        "    </div>",
        "  </section>",
    ]
    beta_used_urls: set[str] = set()
    if beta.takeaways:
        body.extend(
            [
                '  <section class="news-digest-section news-digest-beta-standfirst">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Morning line</p>',
                '      <h2>What to scan first</h2>',
                '    </header>',
                '    <div class="news-digest-beta-wire-grid">',
                '      <div class="news-digest-archive-list news-digest-beta-bullets">',
            ]
            )
        for item in beta.takeaways:
            body.extend(
                [
                    '      <div class="news-digest-archive-item">',
                    f'        <strong data-pretext-target>{safe_text(item)}</strong>',
                    "      </div>",
                ]
            )
        body.extend(["      </div>", *source_pills, "    </div>", "  </section>"])
    if beta.article_body:
        overview_copy = " ".join(paragraph.strip() for paragraph in beta.article_body if paragraph.strip())
        body.extend(
            [
                '  <section class="news-digest-section news-digest-beta-overview">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Today in AI</p>',
                '      <h2>The day in one pass</h2>',
                '    </header>',
                '    <div class="note-flow-layout news-digest-beta-overview-layout" data-note-flow>',
                '      <div class="note-flow-body news-digest-beta-story-body" data-note-flow-body>',
                f'        <p class="news-digest-beta-story-copy news-digest-beta-overview-copy" data-pretext-target>{safe_text(overview_copy)}</p>',
                "      </div>",
                '      <aside class="note-aside-card note-aside-card--beta" data-note-flow-rail aria-label="Brief takeaways">',
                '        <p class="section-kicker">Key takeaways</p>',
                '        <ul class="note-aside-list">',
            ]
        )
        for item in beta.takeaways[:2]:
            body.append(f'          <li data-pretext-target>{safe_text(item)}</li>')
        body.extend(
            [
                "        </ul>",
                "      </aside>",
                "    </div>",
                "  </section>",
            ]
        )
    body.extend(render_beta_signal_map(context))
    for slug, heading, _description, cards in context.sections:
        story_heading = beta.section_titles.get(slug) or heading
        story_paragraphs = beta.section_bodies.get(slug) or []
        card_subset = choose_beta_reference_cards(cards, beta_used_urls, limit=2)
        beta_used_urls.update(card.url for card in card_subset)
        body.extend(
            [
                f'  <section class="news-digest-section news-digest-beta-story" id="beta-{safe_text(slug)}">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Section</p>',
                f'      <h2>{safe_text(story_heading)}</h2>',
                '    </header>',
                '    <div class="note-flow-layout news-digest-beta-story-layout" data-note-flow>',
                '      <div class="note-flow-body news-digest-beta-story-body" data-note-flow-body>',
            ]
        )
        for paragraph in story_paragraphs:
            body.append(f'        <p class="news-digest-beta-story-copy">{safe_text(paragraph)}</p>')
        body.append("      </div>")
        if card_subset:
            body.append('      <aside class="news-digest-beta-story-rail" aria-label="Referenced items" data-note-flow-rail>')
            for index, card in enumerate(card_subset):
                body.extend(
                    render_digest_card_lines(
                        card,
                        extra_classes=(
                            "news-digest-inline-card"
                            + (" news-digest-inline-card--primary" if index == 0 else "")
                        ),
                    )
                )
            body.append("      </aside>")
        body.extend(["    </div>", "  </section>"])
    if beta.closing:
        body.extend(
            [
                '  <section class="news-digest-archive">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Closing</p>',
                '      <h2 data-pretext-target>Editor note</h2>',
                '    </header>',
                f'    <p class="news-digest-section-description" data-pretext-target>{safe_text(beta.closing)}</p>',
                "  </section>",
            ]
        )
    body.extend(render_beta_remaining_signals(context, beta_used_urls, structured_url))
    body.extend(["</div>", ""])
    return frontmatter + "\n".join(body), stem


def write_beta_post(issue_dt: datetime, generated_dt: datetime, context: DigestContext) -> str | None:
    beta = generate_gemma_beta_digest(issue_dt, context)
    if beta is None:
        return None
    markdown, stem = render_beta_markdown(issue_dt, generated_dt, context, beta)
    (POSTS_DIR / f"{stem}.md").write_text(markdown, encoding="utf-8")
    return stem


def archive_entries(current_stem: str, current_summary: str) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for path in sorted(POSTS_DIR.glob("*-ai-news-digest.md"), reverse=True):
        stem = path.stem
        date_label = stem.removesuffix("-ai-news-digest")
        title = f"AI News Brief — {date_label}"
        entries.append(
            {
                "title": title,
                "url": f"/posts/{stem}/",
                "date_label": date_label,
                "description": description_from_post(path),
            }
        )
    if not any(entry["url"].endswith(f"/{current_stem}/") for entry in entries):
        date_label = current_stem.removesuffix("-ai-news-digest")
        entries.insert(
            0,
            {
                "title": f"AI News Brief — {date_label}",
                "url": f"/posts/{current_stem}/",
                "date_label": date_label,
                "description": current_summary,
            },
        )
    return entries


def prune_old_digests(
    issue_dt: datetime,
    retention_days: int = DEFAULT_RETENTION_DAYS,
    posts_dir: Path | None = None,
) -> list[Path]:
    if retention_days <= 0:
        return []
    target_dir = posts_dir or POSTS_DIR
    cutoff_date = issue_dt.date() - timedelta(days=retention_days - 1)
    removed: list[Path] = []
    for path in sorted(target_dir.glob("*-ai-news-*digest.md")):
        match = DAILY_DIGEST_FILENAME_RE.match(path.name)
        if not match:
            continue
        file_date = datetime.strptime(match.group(1), "%Y-%m-%d").date()
        if file_date < cutoff_date:
            path.unlink()
            removed.append(path)
    return removed


def prune_caches_to_retained_digests(posts_dir: Path | None = None) -> tuple[int, int]:
    target_dir = posts_dir or POSTS_DIR
    corpus_chunks = [
        html_unescape(path.read_text(encoding="utf-8"))
        for path in sorted(target_dir.glob("*-ai-news-*digest.md"))
    ]
    corpus = "\n".join(corpus_chunks)
    if not corpus:
        return 0, 0

    keep_beta_bases: set[str] = set()
    for key, value in BETA_DIGEST_CACHE.items():
        if not isinstance(value, dict):
            continue
        title = collapse_whitespace(str(value.get("title", "")))
        lead = collapse_whitespace(str(value.get("lead", "")))
        if (title and title in corpus) or (lead and lead in corpus):
            keep_beta_bases.add(key.removesuffix("::overview"))
    stale_beta_keys = [
        key for key in list(BETA_DIGEST_CACHE.keys()) if key.removesuffix("::overview") not in keep_beta_bases
    ]
    for key in stale_beta_keys:
        BETA_DIGEST_CACHE.pop(key, None)

    stale_translation_keys = [
        key
        for key, translated in list(TRANSLATION_CACHE.items())
        if (not isinstance(translated, str) or len(translated.strip()) < 4 or translated not in corpus)
        and key not in corpus
    ]
    for key in stale_translation_keys:
        TRANSLATION_CACHE.pop(key, None)

    return len(stale_beta_keys), len(stale_translation_keys)


def recent_archive_entries(current_stem: str, current_summary: str, limit: int = 8) -> list[dict[str, str]]:
    return archive_entries(current_stem, current_summary)[:limit]


def grouped_archive_entries(entries: list[dict[str, str]]) -> list[tuple[str, str, list[dict[str, str]]]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    labels: dict[str, str] = {}
    for entry in entries:
        dt = datetime.strptime(entry["date_label"], "%Y-%m-%d")
        month_key = dt.strftime("%Y-%m")
        labels[month_key] = dt.strftime("%B %Y")
        grouped[month_key].append(entry)
    return [(month_key, labels[month_key], grouped[month_key]) for month_key in sorted(grouped.keys(), reverse=True)]


def render_top_inventory_list(cards: list[NewsItem], *, compact: bool = False) -> list[str]:
    lines = ['    <div class="news-digest-top-grid">']
    card_class = "news-digest-top-card"
    if compact:
        card_class += " news-digest-top-card--compact"
    for card in cards:
        lines.extend(render_digest_card_lines(card, extra_classes=card_class))
    lines.append("    </div>")
    return lines


def cards_for_section(
    sections: list[tuple[str, str, str, list[NewsItem]]],
    slug: str,
) -> tuple[str, str, list[NewsItem]]:
    for section_slug, title, description, cards in sections:
        if section_slug == slug:
            return title, description, cards
    return slug, "", []


def source_ledger_width(value: int, max_value: int) -> str:
    if max_value <= 0:
        return "18%"
    width = max(18.0, min(100.0, round((value / max_value) * 100.0, 1)))
    return f"{width:.1f}%"


def render_compact_signal_rows(cards: list[NewsItem], *, limit: int = 6) -> list[str]:
    lines = ['      <div class="news-digest-compact-list">']
    for card in cards[:limit]:
        badge_suffix = badge_class_suffix(card.badge)
        source_suffix = source_class_suffix_from_source(card.source)
        metric_value, metric_label = compact_metric_for(card)
        meta = public_meta_without_score(card)
        lines.extend(
            [
                f'        <a class="news-digest-compact-row news-digest-compact-row--{badge_suffix}" href="{safe_text(card.url)}" target="_blank" rel="noreferrer">',
                f'          <span class="news-digest-row-visual news-digest-row-visual--{source_suffix}" aria-hidden="true">',
                f'            <strong>{safe_text(source_mark(card.source))}</strong>',
                f'            <em>{safe_text(card.badge)}</em>',
                '          </span>',
                '          <span class="news-digest-compact-copy">',
                f'            <span class="news-digest-source-chip news-digest-source-chip--{source_suffix}">',
                f'              <span class="news-digest-source-mark" aria-hidden="true">{safe_text(source_mark(card.source))}</span>',
                f'              <span class="news-digest-source-label">{safe_text(source_label(card.source))}</span>',
                '            </span>',
                f'            <strong data-pretext-target>{safe_text(display_title_for(card))}</strong>',
                f'            <span data-pretext-target>{safe_text(card.deck)}</span>',
                '          </span>',
                '          <span class="news-digest-row-metric">',
                f'            <strong>{safe_text(metric_value)}</strong>',
                f'            <em>{safe_text(metric_label)}</em>',
                f'            <span>{safe_text(meta)}</span>',
                '          </span>',
                '        </a>',
            ]
        )
    lines.append('      </div>')
    return lines


def render_signal_lead_strip(context: DigestContext, brief: BetaDigest) -> list[str]:
    lead_cards = context.top_cards[:3]
    lines = [
        '    <div class="news-digest-lead-strip" aria-label="Lead signals">',
        '      <article class="news-digest-lead-story">',
    ]
    if context.trends:
        lines.extend(
            [
                '        <p class="section-kicker">Trend radar</p>',
                '        <h3 data-pretext-target>Cross-source clusters today</h3>',
                '        <ul class="news-trend-inline-list">',
            ]
        )
        for trend in context.trends[:4]:
            sources_txt = " + ".join(trend.get("sources") or [])
            lines.append(
                '          <li class="news-trend-inline-item">'
                f'<a href="{safe_text(str(trend.get("lead_url") or "#"))}" target="_blank" rel="noreferrer">'
                f'<strong>{safe_text(str(trend.get("label") or ""))}</strong>'
                f'<span>{safe_text(str(trend.get("burst_label") or ""))} · {safe_text(sources_txt)}</span>'
                '</a></li>'
            )
        lines.append('        </ul>')
    else:
        takeaways = [t.strip() for t in (brief.takeaways or []) if t.strip()][:3]
        lines.extend(
            [
                '        <p class="section-kicker">Key takeaways</p>',
                f'        <h3 data-pretext-target>{safe_text(brief.title or "Today’s signal brief")}</h3>',
            ]
        )
        if takeaways:
            lines.append('        <ul class="news-trend-inline-list">')
            for item in takeaways:
                lines.append(f'          <li class="news-trend-inline-item"><span>{safe_text(item)}</span></li>')
            lines.append('        </ul>')
        else:
            lines.append(f'        <p data-pretext-target>{safe_text(brief.lead or brief.dek or context.summary)}</p>')
    lines.extend(
        [
            '      </article>',
            '      <div class="news-digest-lead-cards">',
        ]
    )
    for card in lead_cards:
        metric_value, metric_label = compact_metric_for(card)
        lines.extend(
            [
                f'        <a class="news-digest-lead-card news-digest-lead-card--{badge_class_suffix(card.badge)}" href="{safe_text(card.url)}" target="_blank" rel="noreferrer">',
                f'          <span class="news-digest-lead-index">{safe_text(source_mark(card.source))}</span>',
                f'          <strong data-pretext-target>{safe_text(display_title_for(card))}</strong>',
                f'          <em>{safe_text(source_label(card.source))} · {safe_text(metric_value)} {safe_text(metric_label)}</em>',
                '        </a>',
            ]
        )
    lines.extend(['      </div>', '    </div>'])
    return lines


def render_source_ledger(rows: list[dict[str, Any]]) -> list[str]:
    max_value = max((int(row.get("value") or 0) for row in rows[:6]), default=1)
    lines = [
        '    <aside class="news-digest-source-ledger" aria-label="Source mix">',
        '      <p class="section-kicker">Source mix</p>',
        '      <div class="news-digest-source-ledger-list">',
    ]
    for row in rows[:6]:
        label = str(row.get("label") or "Source")
        value = int(row.get("value") or 0)
        lines.extend(
            [
                '        <div class="news-digest-source-ledger-row">',
                f'          <span>{safe_text(label)}</span>',
                '          <span class="news-digest-source-ledger-track" aria-hidden="true">',
                f'            <span style="width: {source_ledger_width(value, max_value)}"></span>',
                '          </span>',
                f'          <strong>{value}</strong>',
                '        </div>',
            ]
        )
    lines.extend(['      </div>', '    </aside>'])
    return lines


def render_digest_visual_summary(
    context: DigestContext,
    issue_date: str,
    repo_count: int,
    paper_count: int,
    social_count: int,
) -> list[str]:
    bar_rows: list[tuple[str, int, int, str]] = []
    for trend in (context.trends or [])[:4]:
        label = str(trend.get("label") or "").strip()
        count = int(trend.get("count") or 0)
        if not label or count <= 0:
            continue
        fresh = int(trend.get("fresh_count") or 0)
        fresh = min(fresh, count) if fresh > 0 else count
        feeds = max(1, len(trend.get("sources") or []))
        burst = float(trend.get("burst_ratio") or 0.0)
        meta = f"{feeds} feeds · {burst:.1f}×" if burst > 0 else f"{feeds} feeds"
        bar_rows.append((label, count, fresh, meta))

    is_trend_bars = bool(bar_rows)
    if not bar_rows:
        fallback = [
            ("Repositories", repo_count, repo_count, "GitHub"),
            ("Papers", paper_count, paper_count, "arXiv · HF"),
            ("Community Wire", social_count, social_count, "HN · X · GN"),
        ]
        bar_rows = [row for row in fallback if row[1] > 0]

    source_rows = [
        (str(row.get("label") or "").strip(), int(row.get("value") or 0))
        for row in (context.source_counts or [])[:6]
        if str(row.get("label") or "").strip() and int(row.get("value") or 0) > 0
    ]
    if not bar_rows and not source_rows:
        return []

    lines = ['    <div class="news-digest-visual-brief" data-news-visual-summary aria-label="Issue signal charts and pipeline">']

    if bar_rows:
        max_count = max(row[1] for row in bar_rows)
        axis_max = max(10, ((max_count + 9) // 10) * 10)
        axis_mid = axis_max // 2
        total_signals = sum(row[1] for row in bar_rows)
        total_fresh = sum(row[2] for row in bar_rows)
        head_kicker = "Signal radar" if is_trend_bars else "Section volume"
        head_stat = (
            f"{total_signals} signals · {total_fresh} fresh (24h)"
            if is_trend_bars
            else f"{total_signals} curated signals"
        )
        lines.extend(
            [
                '      <article class="news-visual-card">',
                '        <div class="news-visual-head">',
                f'          <span>{head_kicker}</span>',
                f'          <strong>{safe_text(head_stat)}</strong>',
                '        </div>',
                '        <svg class="news-visual-svg" viewBox="0 0 540 220" role="img" aria-label="Topic convergence and freshness bar chart">',
                '          <g font-family="var(--font-mono)" font-size="10" fill="var(--muted)">',
                '            <text x="154" y="22" text-anchor="middle">0</text>',
                f'            <text x="262" y="22" text-anchor="middle">{axis_mid}</text>',
                f'            <text x="370" y="22" text-anchor="middle">{axis_max}</text>',
                '          </g>',
                '          <g stroke="var(--line)" stroke-width="1">',
                '            <line x1="154" y1="30" x2="154" y2="184" />',
                '            <line x1="262" y1="30" x2="262" y2="184" stroke-dasharray="3 3" />',
                '            <line x1="370" y1="30" x2="370" y2="184" stroke-dasharray="3 3" />',
                '          </g>',
            ]
        )
        for idx, (label, count, fresh, meta) in enumerate(bar_rows):
            row_y = 50 + idx * 38
            bar_y = row_y - 10
            total_w = max(6.0, min(216.0, (count / axis_max) * 216.0))
            fresh_w = max(4.0, min(total_w, (fresh / axis_max) * 216.0))
            color = "var(--accent)" if idx % 2 == 0 else "var(--accent-2)"
            lines.extend(
                [
                    '          <g>',
                    f'            <text x="144" y="{row_y + 3}" text-anchor="end" font-family="var(--font-display)" font-size="12.5" font-weight="600" fill="var(--ink)">{safe_text(label)}</text>',
                    f'            <rect x="154" y="{bar_y}" width="216" height="18" rx="4" fill="var(--paper-2)" stroke="var(--line)" stroke-width="1" />',
                    f'            <rect x="154" y="{bar_y}" width="{total_w:.1f}" height="18" rx="4" fill="{color}" fill-opacity="0.2" stroke="{color}" stroke-width="1" stroke-dasharray="3 2" />',
                    f'            <rect x="154" y="{bar_y}" width="{fresh_w:.1f}" height="18" rx="4" fill="{color}" />',
                    f'            <text x="380" y="{row_y + 3}" font-family="var(--font-mono)" font-size="12.5" font-weight="700" fill="var(--ink)">{count}</text>',
                    f'            <text x="412" y="{row_y + 3}" font-family="var(--font-mono)" font-size="10.5" fill="var(--muted)">{safe_text(meta)}</text>',
                    '          </g>',
                ]
            )
        lines.extend(
            [
                '          <g font-family="var(--font-mono)" font-size="10.5" fill="var(--muted)">',
                '            <rect x="154" y="197" width="12" height="8" rx="2" fill="var(--accent)" />',
                '            <text x="172" y="205">Fresh 24h</text>',
                '            <rect x="246" y="197" width="12" height="8" rx="2" fill="var(--accent)" fill-opacity="0.2" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 1.5" />',
                '            <text x="264" y="205">Total (7d window)</text>',
                '            <text x="532" y="205" text-anchor="end">Relative velocity</text>',
                '          </g>',
                '        </svg>',
                '      </article>',
            ]
        )

    if source_rows:
        curated_total = sum(val for _, val in source_rows)
        circumference = 2.0 * math.pi * 44.0
        palette = [
            ("var(--accent)", "1", "circle"),
            ("var(--accent-2)", "1", "square"),
            ("var(--accent)", "0.58", "diamond"),
            ("var(--accent-2)", "0.58", "triangle"),
            ("var(--ink)", "0.48", "ring"),
            ("var(--muted)", "0.62", "pill"),
        ]
        gap = 2.0 if len(source_rows) > 1 else 0.0
        acc = 0.0
        lines.extend(
            [
                '      <article class="news-visual-card">',
                '        <div class="news-visual-head">',
                '          <span>Source mix &amp; pipeline</span>',
                f'          <strong>{curated_total} curated · {len(source_rows)} feeds</strong>',
                '        </div>',
                '        <svg class="news-visual-svg" viewBox="0 0 380 220" role="img" aria-label="Curated source mix donut chart and daily news pipeline">',
                '          <circle cx="68" cy="74" r="44" fill="none" stroke="var(--line)" stroke-width="15" />',
            ]
        )
        legend_lines: list[str] = []
        for idx, (label, val) in enumerate(source_rows):
            share = val / curated_total if curated_total > 0 else 0.0
            seg = share * circumference
            dash_len = max(1.5, seg - gap)
            color, opacity, shape = palette[idx % len(palette)]
            lines.append(
                f'          <circle cx="68" cy="74" r="44" fill="none" stroke="{color}" stroke-opacity="{opacity}" stroke-width="15" stroke-dasharray="{dash_len:.1f} {circumference:.1f}" stroke-dashoffset="{-acc:.1f}" transform="rotate(-90 68 74)" />'
            )
            acc += seg
            ly = 26 + idx * 20
            pct = round(share * 100)
            if shape == "circle":
                marker = f'<circle cx="144" cy="{ly - 3}" r="4" fill="{color}" fill-opacity="{opacity}" />'
            elif shape == "square":
                marker = f'<rect x="140" y="{ly - 7}" width="8" height="8" rx="1.5" fill="{color}" fill-opacity="{opacity}" />'
            elif shape == "diamond":
                marker = f'<rect x="140.5" y="{ly - 6.5}" width="7" height="7" transform="rotate(45 144 {ly - 3})" fill="{color}" fill-opacity="{opacity}" />'
            elif shape == "triangle":
                marker = f'<polygon points="144,{ly - 7} 148,{ly + 1} 140,{ly + 1}" fill="{color}" fill-opacity="{opacity}" />'
            elif shape == "ring":
                marker = f'<circle cx="144" cy="{ly - 3}" r="3.5" fill="none" stroke="{color}" stroke-opacity="{opacity}" stroke-width="2" />'
            else:
                marker = f'<rect x="139" y="{ly - 5}" width="10" height="4" rx="2" fill="{color}" fill-opacity="{opacity}" />'
            legend_lines.extend(
                [
                    '          <g>',
                    f'            {marker}',
                    f'            <text x="158" y="{ly}" font-family="var(--font-display)" font-size="11.5" font-weight="550" fill="var(--ink)">{safe_text(label)}</text>',
                    f'            <text x="370" y="{ly}" text-anchor="end" font-family="var(--font-mono)" font-size="11" fill="var(--muted)"><tspan fill="var(--ink)" font-weight="700">{val}</tspan> · {pct}%</text>',
                    '          </g>',
                ]
            )
        lines.extend(
            [
                f'          <text x="68" y="72" text-anchor="middle" font-family="var(--font-mono)" font-size="22" font-weight="700" fill="var(--ink)">{curated_total}</text>',
                '          <text x="68" y="88" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" font-weight="600" letter-spacing="0.08em" fill="var(--muted)">SIGNALS</text>',
                *legend_lines,
                '          <line x1="8" y1="146" x2="372" y2="146" stroke="var(--line)" stroke-width="1" />',
                '          <g>',
                '            <rect x="8" y="160" width="104" height="46" rx="9" fill="var(--paper-2)" stroke="var(--line)" stroke-width="1" />',
                f'            <text x="60" y="179" text-anchor="middle" font-family="var(--font-mono)" font-size="10" font-weight="700" fill="var(--ink)">{len(source_rows)} FEEDS</text>',
                '            <text x="60" y="195" text-anchor="middle" font-family="var(--font-display)" font-size="9.5" fill="var(--muted)">GitHub · Papers</text>',
                '            <line x1="115" y1="183" x2="131" y2="183" stroke="var(--muted)" stroke-width="1.2" />',
                '            <polygon points="135,183 129,179.5 129,186.5" fill="var(--muted)" />',
                '            <rect x="138" y="160" width="104" height="46" rx="9" fill="var(--paper-2)" stroke="var(--line)" stroke-width="1" />',
                '            <text x="190" y="179" text-anchor="middle" font-family="var(--font-mono)" font-size="10" font-weight="700" fill="var(--ink)">7D COOLDOWN</text>',
                '            <text x="190" y="195" text-anchor="middle" font-family="var(--font-display)" font-size="9.5" fill="var(--muted)">Velocity rank</text>',
                '            <line x1="245" y1="183" x2="261" y2="183" stroke="var(--muted)" stroke-width="1.2" />',
                '            <polygon points="265,183 259,179.5 259,186.5" fill="var(--muted)" />',
                '            <rect x="268" y="160" width="104" height="46" rx="9" fill="var(--paper)" stroke="var(--accent)" stroke-width="1.4" />',
                '            <text x="320" y="179" text-anchor="middle" font-family="var(--font-mono)" font-size="10" font-weight="700" fill="var(--accent)">DAILY BRIEF</text>',
                f'            <text x="320" y="195" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" fill="var(--muted)">{safe_text(issue_date or "Daily")}</text>',
                '          </g>',
                '        </svg>',
                '      </article>',
            ]
        )
    lines.append('    </div>')
    return lines


def render_signal_brief_section(
    context: DigestContext,
    brief: BetaDigest,
    issue_date: str,
    repo_title: str,
    repo_description: str,
    repo_cards: list[NewsItem],
    paper_title: str,
    paper_description: str,
    paper_cards: list[NewsItem],
    social_cards: list[NewsItem],
) -> list[str]:
    total_signals = len(repo_cards) + len(paper_cards) + len(social_cards)
    note = brief.takeaways[0] if brief.takeaways else context.summary
    lines = [
        '  <section class="news-digest-signal-brief" data-digest-layout="editorial-signal" aria-label="Daily signal brief">',
        '    <header class="news-digest-section-head">',
        '      <p class="section-kicker">Daily Brief</p>',
        '      <h2 data-pretext-target>Today’s read list</h2>',
        '    </header>',
        *render_digest_visual_summary(context, issue_date, len(repo_cards), len(paper_cards), len(social_cards)),
        *render_signal_lead_strip(context, brief),
        '    <div class="news-digest-signal-board">',
        '      <section class="news-digest-signal-column">',
        '        <p class="section-kicker">Repo momentum</p>',
        f'        <h3 data-pretext-target>{safe_text(repo_title or "Repository velocity")}</h3>',
        f'        <p data-pretext-target>{safe_text(repo_description or "Open-source projects with enough traction to skim first.")}</p>',
        *render_compact_signal_rows(repo_cards, limit=6),
        '      </section>',
        '      <section class="news-digest-signal-column">',
        '        <p class="section-kicker">Paper queue</p>',
        f'        <h3 data-pretext-target>{safe_text(paper_title or "Paper queue")}</h3>',
        f'        <p data-pretext-target>{safe_text(paper_description or "Research picks worth bookmarking for a deeper read.")}</p>',
        *render_compact_signal_rows(paper_cards, limit=6),
        '      </section>',
        '    </div>',
        '    <div class="news-digest-interrupt-note">',
        '      <p class="section-kicker">Editor note</p>',
        f'      <strong data-pretext-target>{safe_text(note)}</strong>',
        f'      <span>{total_signals} curated items made this issue; the source mix below shows where today’s brief came from.</span>',
        '    </div>',
        *render_source_ledger(context.source_counts),
        '  </section>',
        '',
    ]
    return lines


def render_markdown(
    issue_dt: datetime,
    generated_dt: datetime,
    context: DigestContext,
    brief: BetaDigest,
    archives: list[dict[str, str]],
) -> tuple[str, str]:
    issue_date = issue_dt.strftime("%Y-%m-%d")
    stem = digest_stem_for(issue_dt, context.keywords)
    focus_label = ", ".join(context.keywords)
    title = brief.title or (f"AI News Brief — {focus_label} — {issue_date}" if focus_label else f"AI News Brief — {issue_date}")
    issue_label = issue_date_label(issue_dt)
    generated_label = generated_timestamp_label(generated_dt)
    repo_title, repo_description, repo_cards = cards_for_section(context.sections, "repos")
    paper_title, paper_description, paper_cards = cards_for_section(context.sections, "papers")
    social_title, social_description, social_cards = cards_for_section(context.sections, "social")
    article_paragraphs = [paragraph.strip() for paragraph in brief.article_body if paragraph.strip()][:4]
    if not article_paragraphs:
        article_paragraphs = [context.summary]
    frontmatter = "\n".join(
        [
            "---",
            f"title: {yaml_quote(title)}",
            f"description: {yaml_quote(brief.dek or context.summary)}",
            f"date: {issue_date}",
            f"tags: {yaml_inline_list(['news', 'news-brief', 'ai', 'radar', *context.keywords])}",
            "publish: true",
            "content-classes: [news-digest-note]",
            "---",
            "",
        ]
    )
    body = [
        '<div class="news-digest-shell">',
        '  <section class="news-digest-hero">',
        '    <div class="news-digest-hero-copy">',
        '      <p class="section-kicker">Daily Signal Brief</p>',
        f'      <h1 data-pretext-target>{safe_text(title)}</h1>',
        f'      <p class="news-digest-lead" data-pretext-target>{safe_text(brief.dek or brief.lead or context.summary)}</p>',
        '      <div class="news-digest-actions" role="group" aria-label="News actions">',
        '        <a class="post-cta-link" href="/news/data/latest.json" target="_blank" rel="noreferrer">Source data</a>',
        '        <a class="post-cta-link" href="#digest-archive">Digest archive</a>',
        f'        <a class="post-cta-link" href="{safe_text(ARCHIVE_URL)}">Monthly archive</a>',
        "      </div>",
        "    </div>",
        '    <div class="news-digest-meta-grid">',
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Issue date</span>',
        f'        <strong><time datetime="{issue_date}">{safe_text(issue_label)}</time></strong>',
        "      </div>",
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Top trend</span>',
        f'        <strong>{safe_text(str(context.trends[0]["label"]) if context.trends else generated_label)}</strong>',
        "      </div>",
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Signals</span>',
        f"        <strong>{len(repo_cards)} repos · {len(paper_cards)} papers</strong>",
        "      </div>",
        "    </div>",
        "  </section>",
        "",
    ]

    if repo_cards or paper_cards:
        body.extend(
            render_signal_brief_section(
                context,
                brief,
                issue_date,
                repo_title,
                repo_description,
                repo_cards,
                paper_title,
                paper_description,
                paper_cards,
                social_cards,
            )
        )

    body.extend(
        [
            '  <section class="news-digest-section news-digest-beta-overview">',
            '    <header class="news-digest-section-head">',
            '      <p class="section-kicker">Today in AI</p>',
            '      <h2>The day in one pass</h2>',
            '    </header>',
            f'    <p class="news-digest-section-description" data-pretext-target>{safe_text(article_paragraphs[0])}</p>',
        ]
    )
    if len(article_paragraphs) > 1:
        extra_count = len(article_paragraphs) - 1
        body.append(
            f'    <details class="news-digest-prose-more"><summary>Read full editorial notes (+{extra_count})</summary>'
        )
        for paragraph in article_paragraphs[1:]:
            body.append(
                f'      <p class="news-digest-section-description" data-pretext-target>{safe_text(paragraph)}</p>'
            )
        body.append("    </details>")
    body.extend(["  </section>", ""])
    if social_cards:
        body.extend(
            [
                '  <section id="digest-social" class="news-digest-section">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Wire</p>',
                f'      <h2 data-pretext-target>{safe_text(social_title)}</h2>',
                "    </header>",
                f'    <p class="news-digest-section-description" data-pretext-target>{safe_text(social_description)}</p>',
                '    <div class="news-digest-grid">',
            ]
        )
        for card in social_cards:
            body.extend(render_digest_card_lines(card))
        body.extend(["    </div>", "  </section>", ""])

    body.extend(
        [
            '  <section id="digest-archive" class="news-digest-archive">',
            '    <header class="news-digest-section-head">',
            '      <p class="section-kicker">Archive</p>',
            '      <h2 data-pretext-target>Recent issues</h2>',
            "    </header>",
            '    <div class="news-digest-archive-list">',
        ]
    )
    for item in archives:
        body.extend(
            [
                f'      <a class="news-digest-archive-item" href="{safe_text(item["url"])}">',
                f'        <span class="news-digest-archive-date">{safe_text(item["date_label"])}</span>',
                f'        <strong>{safe_text(item["title"])}</strong>',
            ]
        )
        if item.get("description", "").strip():
            body.append(
                f'        <span>{safe_text(item["description"])}</span>'
            )
        body.append("      </a>")
    body.extend(
        [
            "    </div>",
            f'    <a class="post-cta-link news-digest-archive-link" href="{safe_text(ARCHIVE_URL)}">Browse the monthly archive</a>',
            "  </section>",
            "",
            f'  <p class="news-digest-footnote">Generated from the curated feed for {safe_text(issue_label)} as one daily issue.</p>',
            "</div>",
            "",
        ]
    )
    return frontmatter + "\n".join(body), stem


def render_archive_markdown(
    issue_dt: datetime,
    generated_dt: datetime,
    current_summary: str,
    entries: list[dict[str, str]],
) -> str:
    title = "Daily AI News Archive"
    issue_label = issue_date_label(issue_dt)
    generated_label = generated_timestamp_label(generated_dt)
    grouped = grouped_archive_entries(entries)
    latest_digest_url = entries[0]["url"] if entries else f"/posts/{issue_dt.strftime('%Y-%m-%d')}-ai-news-digest/"
    frontmatter = "\n".join(
        [
            "---",
            f"title: {yaml_quote(title)}",
            f"description: {yaml_quote('Monthly archive of every daily AI news issue.')}",
            f"date: {issue_dt.strftime('%Y-%m-%d')}",
            "tags: [news, news-digest, ai, archive]",
            "publish: true",
            "content-classes: [news-digest-note, news-digest-archive-note]",
            "---",
            "",
        ]
    )
    body = [
        '<div class="news-digest-shell news-digest-archive-shell">',
        '  <section class="news-digest-hero">',
        '    <div class="news-digest-hero-copy">',
        '      <p class="section-kicker">News Archive</p>',
        f"      <h1>{safe_text(title)}</h1>",
        '      <p class="news-digest-lead">Every daily AI news issue, grouped by month so older runs stay skimmable.</p>',
        '      <div class="news-digest-actions" role="group" aria-label="Archive actions">',
        f'        <a class="post-cta-link" href="{safe_text(latest_digest_url)}">Latest issue</a>',
        '        <a class="post-cta-link" href="/news/data/latest.json" target="_blank" rel="noreferrer">Source data</a>',
        "      </div>",
        "    </div>",
        '    <div class="news-digest-meta-grid">',
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Updated</span>',
        f'        <strong><time datetime="{generated_dt.isoformat()}">{safe_text(generated_label)}</time></strong>',
        "      </div>",
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Issues</span>',
        f"        <strong>{len(entries)}</strong>",
        "      </div>",
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Latest issue</span>',
        f'        <strong><time datetime="{issue_dt.strftime("%Y-%m-%d")}">{safe_text(issue_label)}</time></strong>',
        "      </div>",
        "    </div>",
        "  </section>",
        '  <section class="news-digest-archive news-digest-archive-months">',
        '    <header class="news-digest-section-head">',
        '      <p class="section-kicker">Monthly View</p>',
        "      <h2>Digest archive</h2>",
        f'      <p class="news-digest-section-description">{safe_text(current_summary)}</p>',
        "    </header>",
        '    <div class="news-digest-month-groups">',
    ]
    for index, (_month_key, month_label, month_entries) in enumerate(grouped):
        open_attr = " open" if index == 0 else ""
        body.extend(
            [
                f'      <details class="news-digest-month-group"{open_attr}>',
                f'        <summary class="news-digest-month-summary"><span>{safe_text(month_label)}</span><span class="news-digest-month-count">{len(month_entries)} digests</span></summary>',
                '        <div class="news-digest-month-list">',
            ]
        )
        for item in month_entries:
            body.extend(
                [
                    f'          <a class="news-digest-archive-item" href="{safe_text(item["url"])}">',
                    f'            <span class="news-digest-archive-date">{safe_text(item["date_label"])}</span>',
                    f'            <strong>{safe_text(item["title"])}</strong>',
                ]
            )
            if item.get("description", "").strip():
                body.append(f'            <span>{safe_text(item["description"])}</span>')
            body.append("          </a>")
        body.extend(["        </div>", "      </details>"])
    body.extend(["    </div>", "  </section>", "</div>", ""])
    return frontmatter + "\n".join(body)


def write_post(issue_dt: datetime, generated_dt: datetime, context: DigestContext, beta_stem: str | None = None) -> str:
    stem = f"{issue_dt.strftime('%Y-%m-%d')}-ai-news-digest"
    archives = recent_archive_entries(stem, context.summary)
    brief = generate_gemma_beta_digest(issue_dt, context) or fallback_beta_digest(issue_dt, context)
    markdown, stem = render_markdown(issue_dt, generated_dt, context, brief, archives)
    target = POSTS_DIR / f"{stem}.md"
    target.write_text(markdown, encoding="utf-8")
    return stem


def write_archive_post(
    issue_dt: datetime,
    generated_dt: datetime,
    current_summary: str,
    digest_stem: str,
) -> None:
    entries = archive_entries(digest_stem, current_summary)
    markdown = render_archive_markdown(issue_dt, generated_dt, current_summary, entries)
    (POSTS_DIR / f"{ARCHIVE_STEM}.md").write_text(markdown, encoding="utf-8")


def write_hub_json(issue_dt: datetime, generated_dt: datetime, context: DigestContext, digest_stem: str) -> None:
    generated_at = generated_dt.isoformat()
    sections = [
        {
            "slug": slug,
            "title": title,
            "description": description,
            "items": [card.__dict__ for card in cards],
        }
        for slug, title, description, cards in context.sections
    ]
    hub = {
        "generated_at": generated_at,
        "generated_label": generated_timestamp_label(generated_dt),
        "issue_date": issue_dt.strftime("%Y-%m-%d"),
        "issue_label": issue_date_label(issue_dt),
        "summary": context.summary,
        "keywords": context.keywords,
        "trends": context.trends,
        "top_cards": [card.__dict__ for card in context.top_cards],
        "repo_scoreboard": [card.__dict__ for card in context.repo_scoreboard],
        "sections": sections,
        "source_counts": context.source_counts,
        "digest": {
            "title": f"AI News Brief — {issue_dt.strftime('%Y-%m-%d')}",
            "url": f"/posts/{digest_stem}/",
            "description": context.summary,
        },
        "structured_digest": {
            "title": f"AI News Brief — {issue_dt.strftime('%Y-%m-%d')}",
            "url": f"/posts/{digest_stem}/",
            "description": context.summary,
        },
        "beta_digest": None,
        "archive_url": ARCHIVE_URL,
        "archives": recent_archive_entries(digest_stem, context.summary),
    }
    target_name = "latest.json" if not context.keywords else f"{digest_stem}.json"
    (GENERATED_DIR / target_name).write_text(json.dumps(hub, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    ensure_dirs()
    load_translation_cache()
    load_beta_digest_cache()
    issue_dt = issue_date_from_args(args.date)
    generated_dt = datetime.now(tz=KST)
    if args.prune_only:
        removed_posts = prune_old_digests(issue_dt, args.retention_days)
        remaining_posts = sorted(POSTS_DIR.glob("*-ai-news-digest.md"), reverse=True)
        if remaining_posts:
            latest_post = remaining_posts[0]
            latest_stem = latest_post.stem
            latest_summary = description_from_post(latest_post)
            write_archive_post(issue_dt, generated_dt, latest_summary, latest_stem)
            hub_path = GENERATED_DIR / "latest.json"
            if hub_path.exists():
                hub = read_json_object(hub_path)
                hub["archives"] = recent_archive_entries(latest_stem, latest_summary)
                hub_path.write_text(json.dumps(hub, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        removed_beta, removed_translations = prune_caches_to_retained_digests()
        save_translation_cache()
        save_beta_digest_cache()
        print(
            f"Pruned {len(removed_posts)} news digest post(s), "
            f"{removed_beta} beta cache entr(y/ies), "
            f"and {removed_translations} translation cache entr(y/ies) "
            f"(retention={args.retention_days}d)."
        )
        return
    keywords = keywords_from_args(args)
    payload = load_source_feed()
    write_source_snapshot(payload)
    set_recent_digest_memory(issue_dt)
    mempalace_context = [] if args.no_mempalace else load_mempalace_context(keywords, limit=args.mempalace_limit)
    context = build_digest_context(payload, args.limit, keywords=keywords, mempalace_context=mempalace_context)
    digest_stem = write_post(issue_dt, generated_dt, context)
    removed_posts: list[Path] = []
    if not keywords:
        removed_posts = prune_old_digests(issue_dt, args.retention_days)
        write_archive_post(issue_dt, generated_dt, context.summary, digest_stem)
    write_hub_json(issue_dt, generated_dt, context, digest_stem)
    if not keywords and args.retention_days > 0:
        prune_caches_to_retained_digests()
    save_translation_cache()
    save_beta_digest_cache()
    print(f"Generated news digest post: posts/news/{digest_stem}.md")
    if removed_posts:
        print(f"Pruned {len(removed_posts)} news digest post(s) older than {args.retention_days} days.")
    if not keywords:
        print(f"Generated archive post: posts/news/{ARCHIVE_STEM}.md")
    else:
        print(f"Generated keyword-focused digest for: {', '.join(keywords)}")
    hub_target = "latest.json" if not keywords else f"{digest_stem}.json"
    print(f"Generated hub data: data/news/{hub_target}")
    print("Updated raw feed snapshot: static/news/data/latest.json")

if __name__ == "__main__":
    main()
