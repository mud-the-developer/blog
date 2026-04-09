#!/usr/bin/env python3
"""Build blog-owned news digest artifacts from vendor/blog_news data.

Pipeline:
1. Read ranked raw feed data from vendor/blog_news/data/latest.json
2. Curate the sections used by the native /news/ page
3. Generate one daily markdown digest post under content/posts/news/
4. Generate one JSON payload for the native /news/ hub under content/generated/news/
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from html import escape as html_escape
from pathlib import Path
from typing import Any
from urllib.parse import quote
import urllib.request
from urllib.request import urlopen
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "vendor" / "blog_news" / "data" / "latest.json"
SNAPSHOT_PATH = ROOT / "static" / "news" / "data" / "latest.json"
GENERATED_DIR = ROOT / "content" / "generated" / "news"
POSTS_DIR = ROOT / "content" / "posts" / "news"
TRANSLATION_CACHE_PATH = GENERATED_DIR / "translation-cache.json"
BETA_DIGEST_CACHE_PATH = GENERATED_DIR / "gemma-beta-cache.json"
KST = ZoneInfo("Asia/Seoul")
ARCHIVE_STEM = "news-digest-archive"
ARCHIVE_URL = f"/notes/news/{ARCHIVE_STEM}/"
NEWS_ASSET_DIR = ROOT / "static" / "news" / "assets"

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
    "huggingface.co": "Hugging Face Papers",
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
    "agents": ("agent", "agentic", "copilot", "codex", "assistant"),
    "models": ("model", "llm", "gpt", "claude", "gemini", "phi"),
    "reasoning": ("reasoning", "thinking", "trace", "benchmark", "eval"),
    "rag": ("rag", "retrieval", "vector", "database", "search"),
    "multimodal": ("multimodal", "vision", "video", "audio"),
    "inference": ("inference", "quantization", "serving", "latency"),
    "openran": ("vran", "o-ran", "open ran", "ric", "xapp", "rapp", "ran"),
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
    takeaways: list[str]
    section_titles: dict[str, str]
    section_bodies: dict[str, list[str]]
    closing: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the blog news digest artifacts.")
    parser.add_argument("--date", help="Issue date in YYYY-MM-DD. Defaults to current date in Asia/Seoul.")
    parser.add_argument("--limit", type=int, default=10, help="Target cards per section in the digest post.")
    return parser.parse_args()


def issue_date_from_args(raw: str | None) -> datetime:
    if raw:
        return datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=KST)
    return datetime.now(tz=KST)


def issue_date_label(issue_dt: datetime) -> str:
    return issue_dt.strftime("%b %-d, %Y")


def generated_timestamp_label(generated_at: datetime) -> str:
    return generated_at.strftime("%b %-d, %Y · %-I:%M %p KST")


def load_source_feed() -> dict[str, Any]:
    for path in (SOURCE_PATH, SNAPSHOT_PATH):
        if path.exists():
            return json.loads(path.read_text())
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
        + "\n"
    )


def load_translation_cache() -> None:
    TRANSLATION_CACHE.clear()
    if TRANSLATION_CACHE_PATH.exists():
        TRANSLATION_CACHE.update(json.loads(TRANSLATION_CACHE_PATH.read_text()))


def save_translation_cache() -> None:
    TRANSLATION_CACHE_PATH.write_text(
        json.dumps(TRANSLATION_CACHE, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )


def load_beta_digest_cache() -> None:
    BETA_DIGEST_CACHE.clear()
    if BETA_DIGEST_CACHE_PATH.exists():
        BETA_DIGEST_CACHE.update(json.loads(BETA_DIGEST_CACHE_PATH.read_text()))


def save_beta_digest_cache() -> None:
    BETA_DIGEST_CACHE_PATH.write_text(
        json.dumps(BETA_DIGEST_CACHE, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )


def gemma_beta_enabled() -> bool:
    flag = (os.getenv("ENABLE_GEMMA_BETA_DIGEST") or "").strip().lower()
    if flag in {"0", "false", "no", "off"}:
        return False
    return bool(os.getenv("GOOGLE_AI_API_KEY", "").strip())


def gemma_model_name() -> str:
    model = (os.getenv("GOOGLE_AI_MODEL") or "").strip() or "models/gemma-4-31b-it"
    return model if model.startswith("models/") else f"models/{model}"


def gemma_api_url() -> str:
    return (
        f"https://generativelanguage.googleapis.com/v1beta/"
        f"{gemma_model_name()}:generateContent?key={os.getenv('GOOGLE_AI_API_KEY','').strip()}"
    )


def normalize_image(url: str) -> str:
    if url.startswith("/assets/"):
        return "/news/assets/" + url.removeprefix("/assets/")
    return url


def fallback_image_url(source: str, badge: str) -> str:
    if source == "github.com" or badge == "Repo":
        return "/news/assets/thumb-repo.svg"
    if source in PAPER_SOURCES or badge == "Paper":
        return "/news/assets/thumb-paper.svg"
    if badge == "vRAN":
        return "/news/assets/thumb-vran.svg"
    return "/news/assets/thumb-ai.svg"


def source_mark(source: str) -> str:
    return SOURCE_MARKS.get(source, "•")


def source_class_suffix_from_source(source: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", source.lower()).strip("-") or "source"


def meta_without_source(meta: str, source: str) -> str:
    prefix = f"{source_label(source)} · "
    if meta.startswith(prefix):
        return meta[len(prefix) :]
    return meta


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
    if "release notes" in lowered:
        return True
    return False


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
        with urlopen(url, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
        translated = "".join(part[0] for part in payload[0] if part and part[0]).strip()
        if translated:
            TRANSLATION_CACHE[value] = translated
            return translated
    except Exception:
        pass
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


def ensure_terminal_punctuation(value: str) -> str:
    value = value.strip()
    if not value:
        return value
    if value.endswith((".", "!", "?", "…")):
        return value
    return value + "."


def yaml_quote(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


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
    if source in {"x.com", "linkedin.com"} and len(title) > 220 and relevance < 4:
        return True
    return False


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
    bonus = min(1.0, math.log1p(max(stars_per_day, 0.0)) * 0.32)
    bonus += min(0.38, math.log1p(max(stars, 0)) * 0.05)
    bonus += min(0.18, raw_component(item, "confirmation") * 0.30)
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
        f'            <span class="news-digest-card-meta">{safe_text(meta_without_source(card.meta, card.source))}</span>',
        "          </div>",
    ]
    if lead_note:
        lines.append(f'          <p class="news-digest-card-note" data-pretext-target>{safe_text(lead_note)}</p>')
    lines.extend(
        [
            f'          <h3 data-pretext-target>{safe_text(card.headline or card.title)}</h3>',
            f'          <p class="news-digest-card-deck" data-pretext-target>{safe_text(card.deck)}</p>',
            "        </div>",
            "      </a>",
        ]
    )
    return lines


def description_from_post(path: Path) -> str:
    raw = path.read_text()
    match = re.search(r'^description:\s*(.+)$', raw, flags=re.MULTILINE)
    if not match:
        return ""
    value = match.group(1).strip()
    if not value:
        return ""
    if value.startswith(('"', "'")):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value.strip("\"'")
    return value


def deck_for(item: dict[str, Any], badge: str) -> str:
    hours = int(item.get("publishedHoursAgo") or 0)
    stars = int(item.get("stars") or 0)
    stars_per_day = float(item.get("starsPerDay") or 0.0)
    title = item_title(item)
    rank_delta = item.get("rank_delta")
    tags = [tag for tag in item.get("tags") or [] if tag.lower() != "other"]
    tag_text = ", ".join(tags[:3]).lower()
    movement = ""
    if isinstance(rank_delta, int) and rank_delta > 0:
        movement = f" Up {rank_delta} spots from the previous run."
    elif isinstance(rank_delta, int) and rank_delta < 0:
        movement = f" Down {abs(rank_delta)} spots from the previous run."
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
            f"Fresh {tag_text} signal ranked into the current issue {relative_hours_label(hours)}.{movement}",
            170,
        )
    return clamp_text(f"Fresh signal ranked into the current issue {relative_hours_label(hours)}.{movement}", 170)


def meta_for(item: dict[str, Any]) -> str:
    bits: list[str] = [source_label(item.get("source", ""))]
    stars = int(item.get("stars") or 0)
    stars_per_day = float(item.get("starsPerDay") or 0.0)
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
        image_url=normalize_image(item.get("image", "/news/assets/thumb-ai.svg")),
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
        if current is None or local_signal_score(item) > local_signal_score(current):
            deduped[key] = item
    return sorted(
        deduped.values(),
        key=lambda item: (
            -local_signal_score(item),
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
            marginal = local_signal_score(item) - (0.55 * redundancy)
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
        -local_signal_score(item),
        int(item.get("rank") or 999),
        int(item.get("publishedHoursAgo") or 999),
        item_title(item),
    )


def prune_section_items(slug: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return []
    best_score = local_signal_score(items[0])
    min_keep = {"hot24": 4, **SECTION_MINIMUMS}.get(slug, 3)
    floor = {
        "hot24": max(4.4, best_score - 2.4),
        "repos": max(5.45, best_score - 3.55),
        "papers": max(4.1, best_score - 1.9),
        "social": max(3.3, best_score - 2.1),
    }.get(slug, 0.0)
    filtered = [item for item in items if local_signal_score(item) >= floor]
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
    movers = sorted(
        (
            item
            for group in section_items.values()
            for item in group
            if isinstance(item.get("rank_delta"), int) and item.get("rank_delta", 0) > 0
        ),
        key=lambda item: (int(item.get("rank_delta") or 0), local_signal_score(item)),
        reverse=True,
    )
    if movers:
        mover = movers[0]
        fragments.append(f"biggest mover: {headline_for(mover)} (+{int(mover['rank_delta'])})")
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


def build_digest_context(payload: dict[str, Any], limit: int) -> DigestContext:
    candidates = prepare_candidates(payload)
    relaxed_candidates = prepare_candidates(payload, relaxed=True)
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
            select_diverse_items(section_items["repos"], section_limit_for("repos", limit), max_per_topic=3),
        ),
        fallback_section_items["repos"],
        SECTION_MINIMUMS["repos"],
    )
    curated_raw["papers"] = ensure_section_minimum(
        prune_section_items(
            "papers",
            select_diverse_items(
                section_items["papers"],
                section_limit_for("papers", limit),
                max_per_source=6,
                max_per_topic=4,
            ),
        ),
        fallback_section_items["papers"],
        SECTION_MINIMUMS["papers"],
    )
    curated_raw["social"] = ensure_section_minimum(
        prune_section_items(
            "social",
            select_diverse_items(
                section_items["social"],
                section_limit_for("social", limit),
                max_per_source=4,
                max_per_topic=4,
            ),
        ),
        fallback_section_items["social"],
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
            lead = curated_raw[slug][0]
            if item_badge(lead) != "Social" or local_signal_score(lead) >= 4.0:
                featured_raw.append(lead)
    extras_pool = sorted(
        [
            item
            for slug in ("hot24", "repos", "papers", "social")
            for item in curated_raw[slug]
            if item_badge(item) != "Social" or local_signal_score(item) >= 4.2
        ],
        key=sort_key,
    )
    extras = select_diverse_items(
        extras_pool,
        4,
        max_per_source=1,
        max_per_topic=1,
        max_per_badge=2,
    )
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
    return DigestContext(
        summary=summary,
        top_cards=[to_card(item) for item in featured_raw[:4]],
        repo_scoreboard=[to_card(item) for item in curated_raw["repos"][:8]],
        sections=sections,
        source_counts=source_counts,
    )


def beta_digest_cache_key(issue_dt: datetime, context: DigestContext) -> str:
    raw = json.dumps(
        {
            "version": 4,
            "date": issue_dt.strftime("%Y-%m-%d"),
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
    return json.loads(raw)


def gemma_overview_payload(issue_dt: datetime, context: DigestContext) -> dict[str, Any]:
    return {
        "task": "Write the front matter for a newsroom-style daily AI beta brief in JSON.",
        "date": issue_dt.strftime("%Y-%m-%d"),
        "constraints": [
            "Treat this as a human-readable editorial briefing page, not a raw list or tweet thread.",
            "Use restrained newsroom language, not hype.",
            "Be concrete, compact, and readable at a glance.",
            "Do not invent facts, counts, or sources.",
            "Do not mention ranking formulas or hidden scoring internals.",
            "The lead should read like the opening of a short article.",
            "Return strict JSON only.",
        ],
        "schema": {
            "title": "short editorial title",
            "dek": "1 sentence overview",
            "lead": "2-4 sentence opening brief",
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

    request_body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": json.dumps(payload, ensure_ascii=False)}],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        gemma_api_url(),
        data=json.dumps(request_body).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "blog-news-digest/1.0"},
    )
    with urllib.request.urlopen(req, timeout=45) as response:
        api_payload = json.loads(response.read().decode("utf-8"))
    parts = (((api_payload.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
    response_text = ""
    for part in parts:
        if part.get("thought"):
            continue
        response_text = part.get("text", "")
        if response_text:
            break
    parsed = parse_llm_json(response_text)
    BETA_DIGEST_CACHE[cache_key] = parsed
    return parsed


def normalize_overview(parsed: dict[str, Any], issue_dt: datetime, context: DigestContext) -> BetaDigest:
    return BetaDigest(
        title=str(parsed.get("title") or f"AI News Brief — {issue_dt.strftime('%Y-%m-%d')}").strip(),
        dek=str(parsed.get("dek") or context.summary).strip(),
        lead=str(parsed.get("lead") or context.summary).strip(),
        takeaways=[str(item).strip() for item in (parsed.get("takeaways") or []) if str(item).strip()][:4],
        section_titles={},
        section_bodies={},
        closing=str(parsed.get("closing") or "").strip(),
    )


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
    for slug, heading, _description, cards in sections:
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
        '      <h2 data-pretext-target>How today breaks down</h2>',
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
                f'            <span class="news-digest-beta-bar-label" data-pretext-target>{safe_text(card.headline or card.title)}</span>',
                '            <span class="news-digest-beta-bar-track" aria-hidden="true">',
                f'              <span style="width: {render_beta_bar_value(card.score, max_signal)}"></span>',
                "            </span>",
                f'            <strong>{card.score:.1f}</strong>',
                "          </div>",
            ]
        )
    lines.extend(["        </div>", "      </section>", "    </div>", "  </section>"])
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

    overview = normalize_overview(
        gemma_json_request(overview_cache_key(issue_dt, context), gemma_overview_payload(issue_dt, context), temperature=0.42),
        issue_dt,
        context,
    )

    section_titles: dict[str, str] = {}
    section_bodies: dict[str, list[str]] = {}
    for slug, heading, description, cards in context.sections:
        parsed = gemma_json_request(
            section_cache_key(issue_dt, context, slug, cards),
            gemma_section_payload(issue_dt, slug, heading, description, cards, overview),
            temperature=0.5,
        )
        section_title, paragraphs = normalize_section_story(parsed, heading, description)
        section_titles[slug] = section_title
        section_bodies[slug] = paragraphs

    beta = BetaDigest(
        title=overview.title,
        dek=overview.dek,
        lead=overview.lead,
        takeaways=overview.takeaways,
        section_titles=section_titles,
        section_bodies=section_bodies,
        closing=overview.closing,
    )
    BETA_DIGEST_CACHE[cache_key] = beta.__dict__
    return beta


def render_beta_markdown(issue_dt: datetime, generated_dt: datetime, context: DigestContext, beta: BetaDigest) -> tuple[str, str]:
    stem = f"{issue_dt.strftime('%Y-%m-%d')}-ai-news-beta-digest"
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
        f'        <a class="post-cta-link" href="/notes/news/{issue_dt.strftime("%Y-%m-%d")}-ai-news-digest/">Open structured digest</a>',
        '        <a class="post-cta-link" href="/news/data/latest.json" target="_blank" rel="noreferrer">Raw feed JSON</a>',
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
                '      <h2 data-pretext-target>What to scan first</h2>',
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
                f'      <h2 data-pretext-target>{safe_text(story_heading)}</h2>',
                '    </header>',
                '    <div class="news-digest-beta-story-layout">',
                '      <div class="news-digest-beta-story-body">',
            ]
        )
        for paragraph in story_paragraphs:
            body.append(f'        <p class="news-digest-beta-story-copy" data-pretext-target>{safe_text(paragraph)}</p>')
        body.append("      </div>")
        if card_subset:
            body.append('      <aside class="news-digest-beta-story-rail" aria-label="Referenced items">')
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
    body.extend(["</div>", ""])
    return frontmatter + "\n".join(body), stem


def write_beta_post(issue_dt: datetime, generated_dt: datetime, context: DigestContext) -> str | None:
    beta = generate_gemma_beta_digest(issue_dt, context)
    if beta is None:
        return None
    markdown, stem = render_beta_markdown(issue_dt, generated_dt, context, beta)
    (POSTS_DIR / f"{stem}.md").write_text(markdown)
    return stem


def archive_entries(current_stem: str, current_summary: str) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for path in sorted(POSTS_DIR.glob("*-ai-news-digest.md"), reverse=True):
        stem = path.stem
        date_label = stem.removesuffix("-ai-news-digest")
        title = f"Daily AI News Digest — {date_label}"
        entries.append(
            {
                "title": title,
                "url": f"/notes/news/{stem}/",
                "date_label": date_label,
                "description": description_from_post(path),
            }
        )
    if not any(entry["url"].endswith(f"/{current_stem}/") for entry in entries):
        date_label = current_stem.removesuffix("-ai-news-digest")
        entries.insert(
            0,
            {
                "title": f"Daily AI News Digest — {date_label}",
                "url": f"/notes/news/{current_stem}/",
                "date_label": date_label,
                "description": current_summary,
            },
        )
    return entries


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


def render_markdown(
    issue_dt: datetime,
    generated_dt: datetime,
    summary: str,
    top_cards: list[NewsItem],
    repo_scoreboard: list[NewsItem],
    sections: list[tuple[str, str, str, list[NewsItem]]],
    archives: list[dict[str, str]],
    beta_stem: str | None = None,
) -> tuple[str, str]:
    issue_date = issue_dt.strftime("%Y-%m-%d")
    stem = f"{issue_date}-ai-news-digest"
    title = f"Daily AI News Digest — {issue_date}"
    issue_label = issue_date_label(issue_dt)
    generated_label = generated_timestamp_label(generated_dt)
    frontmatter = "\n".join(
        [
            "---",
            f"title: {yaml_quote(title)}",
            f"description: {yaml_quote(summary)}",
            f"date: {issue_date}",
            "tags: [news, news-digest, ai, radar]",
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
        '      <p class="section-kicker">News</p>',
        f'      <h1 data-pretext-target>{safe_text(title)}</h1>',
        f'      <p class="news-digest-lead" data-pretext-target>{safe_text(summary)}</p>',
        '      <div class="news-digest-actions" role="group" aria-label="News actions">',
        '        <a class="post-cta-link" href="/news/data/latest.json" target="_blank" rel="noreferrer">Raw feed JSON</a>',
        '        <a class="post-cta-link" href="#digest-archive">Digest archive</a>',
        f'        <a class="post-cta-link" href="{safe_text(ARCHIVE_URL)}">Monthly archive</a>',
        *( [f'        <a class="post-cta-link" href="/notes/news/{beta_stem}/">Open beta brief</a>'] if beta_stem else [] ),
        "      </div>",
        "    </div>",
        '    <div class="news-digest-meta-grid">',
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Issue date</span>',
        f'        <strong><time datetime="{issue_date}">{safe_text(issue_label)}</time></strong>',
        "      </div>",
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Generated</span>',
        f'        <strong><time datetime="{generated_dt.isoformat()}">{safe_text(generated_label)}</time></strong>',
        "      </div>",
        '      <div class="news-digest-meta-card">',
        '        <span class="news-digest-meta-label">Sections</span>',
        f"        <strong>{len(sections)}</strong>",
        "      </div>",
        "    </div>",
        "  </section>",
        "",
    ]
    if repo_scoreboard:
        max_score = max(card.score for card in repo_scoreboard) or 1.0
        body.extend(
            [
                '  <section class="news-digest-score-shell" aria-label="Repository momentum board">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Signal Board</p>',
                '      <h2 data-pretext-target>Repo momentum board</h2>',
                "    </header>",
                '    <p class="news-digest-section-description" data-pretext-target>Local signal score blends freshness, feed rank, keyword relevance, and GitHub star velocity.</p>',
                '    <div class="news-digest-scoreboard">',
            ]
        )
        for index, card in enumerate(repo_scoreboard, start=1):
            fill = max(18.0, min(100.0, round((card.score / max_score) * 100.0, 1)))
            body.extend(
                [
                    f'      <a class="news-digest-score-row" href="{safe_text(card.url)}" target="_blank" rel="noreferrer">',
                    '        <div class="news-digest-score-copy">',
                    f'          <span class="news-digest-score-rank">{index:02d}</span>',
                    f'          <strong>{safe_text(card.headline or card.title)}</strong>',
                    f'          <span>{safe_text(card.meta)}</span>',
                    "        </div>",
                    '        <div class="news-digest-score-bar" aria-hidden="true">',
                    f'          <span style="width: {fill:.1f}%"></span>',
                    "        </div>",
                    f'        <strong class="news-digest-score-value">{card.score:.2f}</strong>',
                    "      </a>",
                ]
            )
        body.extend(["    </div>", "  </section>", ""])

    if top_cards:
        body.extend(
            [
                '  <section class="news-digest-top-shell" aria-label="Top signals">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Highlights</p>',
                '      <h2 data-pretext-target>Top signals</h2>',
                "    </header>",
                '    <div class="news-digest-top-grid">',
            ]
        )
        for card in top_cards:
            body.extend(render_digest_card_lines(card, extra_classes="news-digest-top-card"))
        body.extend(["    </div>", "  </section>", ""])

    for slug, heading, description, cards in sections:
        body.extend(
            [
                f'  <section id="digest-{safe_text(slug)}" class="news-digest-section">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Section</p>',
                f'      <h2 data-pretext-target>{safe_text(heading)}</h2>',
                "    </header>",
                f'    <p class="news-digest-section-description" data-pretext-target>{safe_text(description)}</p>',
                '    <div class="news-digest-grid">',
            ]
        )
        for card in cards:
            body.extend(render_digest_card_lines(card))
        body.extend(["    </div>", "  </section>", ""])

    body.extend(
        [
            '  <section id="digest-archive" class="news-digest-archive">',
            '    <header class="news-digest-section-head">',
            '      <p class="section-kicker">Archive</p>',
            '      <h2 data-pretext-target>Recent Digest Posts</h2>',
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
            f'  <p class="news-digest-footnote">Generated from the ranked feed for {safe_text(issue_label)}.</p>',
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
    latest_url = entries[0]["url"] if entries else f"/notes/news/{issue_dt.strftime('%Y-%m-%d')}-ai-news-digest/"
    frontmatter = "\n".join(
        [
            "---",
            f"title: {yaml_quote(title)}",
            f"description: {yaml_quote('Monthly archive of every Daily AI News Digest post.')}",
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
        '      <p class="news-digest-lead">Every Daily AI News Digest, grouped by month so older issues stay skimmable.</p>',
        '      <div class="news-digest-actions" role="group" aria-label="Archive actions">',
        f'        <a class="post-cta-link" href="{safe_text(latest_url)}">Latest digest</a>',
        '        <a class="post-cta-link" href="/news/data/latest.json" target="_blank" rel="noreferrer">Raw feed JSON</a>',
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
    markdown, stem = render_markdown(
        issue_dt,
        generated_dt,
        context.summary,
        context.top_cards,
        context.repo_scoreboard,
        context.sections,
        archives,
        beta_stem,
    )
    target = POSTS_DIR / f"{stem}.md"
    target.write_text(markdown)
    return stem


def write_archive_post(issue_dt: datetime, generated_dt: datetime, current_summary: str, digest_stem: str) -> None:
    entries = archive_entries(digest_stem, current_summary)
    markdown = render_archive_markdown(issue_dt, generated_dt, current_summary, entries)
    (POSTS_DIR / f"{ARCHIVE_STEM}.md").write_text(markdown)


def write_hub_json(issue_dt: datetime, generated_dt: datetime, context: DigestContext, digest_stem: str, beta_stem: str | None) -> None:
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
        "top_cards": [card.__dict__ for card in context.top_cards],
        "repo_scoreboard": [card.__dict__ for card in context.repo_scoreboard],
        "sections": sections,
        "source_counts": context.source_counts,
        "digest": {
            "title": f"Daily AI News Digest — {issue_dt.strftime('%Y-%m-%d')}",
            "url": f"/notes/news/{digest_stem}/",
            "description": context.summary,
        },
        "beta_digest": (
            {
                "title": f"AI News Brief — {issue_dt.strftime('%Y-%m-%d')}",
                "url": f"/notes/news/{beta_stem}/",
            }
            if beta_stem
            else None
        ),
        "archive_url": ARCHIVE_URL,
        "archives": recent_archive_entries(digest_stem, context.summary),
    }
    (GENERATED_DIR / "latest.json").write_text(json.dumps(hub, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    args = parse_args()
    ensure_dirs()
    load_translation_cache()
    load_beta_digest_cache()
    issue_dt = issue_date_from_args(args.date)
    payload = load_source_feed()
    write_source_snapshot(payload)
    generated_dt = datetime.now(tz=KST)
    context = build_digest_context(payload, args.limit)
    beta_stem = write_beta_post(issue_dt, generated_dt, context)
    digest_stem = write_post(issue_dt, generated_dt, context, beta_stem)
    write_archive_post(issue_dt, generated_dt, context.summary, digest_stem)
    write_hub_json(issue_dt, generated_dt, context, digest_stem, beta_stem)
    save_translation_cache()
    save_beta_digest_cache()
    print(f"Generated news digest post: content/posts/news/{digest_stem}.md")
    if beta_stem:
        print(f"Generated beta digest post: content/posts/news/{beta_stem}.md")
    print(f"Generated archive post: content/posts/news/{ARCHIVE_STEM}.md")
    print("Generated hub data: content/generated/news/latest.json")
    print("Updated raw feed snapshot: static/news/data/latest.json")


if __name__ == "__main__":
    main()
