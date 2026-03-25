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
import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from html import escape as html_escape
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import urlopen
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "vendor" / "blog_news" / "data" / "latest.json"
SNAPSHOT_PATH = ROOT / "static" / "news" / "data" / "latest.json"
GENERATED_DIR = ROOT / "content" / "generated" / "news"
POSTS_DIR = ROOT / "content" / "posts" / "news"
TRANSLATION_CACHE_PATH = GENERATED_DIR / "translation-cache.json"
KST = ZoneInfo("Asia/Seoul")

SECTION_SPECS = [
    ("hot24", "Hot in 24 Hours", "The fastest-moving items across repos, papers, and community chatter."),
    ("repos", "Repository Momentum", "Fresh GitHub projects worth scanning before the feed turns over."),
    ("papers", "Fresh Papers", "New research worth bookmarking for a deeper read."),
    ("social", "Community Chatter", "Directional signals from discussion-heavy sources."),
]

SOURCE_LABELS = {
    "github.com": "GitHub",
    "arxiv.org": "arXiv",
    "x.com": "X",
    "linkedin.com": "LinkedIn",
    "geeknews": "GeekNews",
    "endigest.dev": "Endigest",
}

SOCIAL_SOURCES = {"x.com", "linkedin.com", "geeknews", "endigest.dev"}

SOURCE_SCORE_BONUS = {
    "github.com": 0.34,
    "arxiv.org": 0.26,
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the blog news digest artifacts.")
    parser.add_argument("--date", help="Issue date in YYYY-MM-DD. Defaults to current date in Asia/Seoul.")
    parser.add_argument("--limit", type=int, default=8, help="Cards per section in the digest post.")
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


def write_source_snapshot(payload: dict[str, Any]) -> None:
    SNAPSHOT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def load_translation_cache() -> None:
    TRANSLATION_CACHE.clear()
    if TRANSLATION_CACHE_PATH.exists():
        TRANSLATION_CACHE.update(json.loads(TRANSLATION_CACHE_PATH.read_text()))


def save_translation_cache() -> None:
    TRANSLATION_CACHE_PATH.write_text(
        json.dumps(TRANSLATION_CACHE, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )


def normalize_image(url: str) -> str:
    if url.startswith("/assets/"):
        return "/news/assets/" + url.removeprefix("/assets/")
    return url


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
    if source == "arxiv.org":
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


def relevance_hit_count(item: dict[str, Any]) -> int:
    cached = item.get("_relevance_hits")
    if isinstance(cached, int):
        return cached
    text = " ".join(
        [
            item_title(item).lower(),
            " ".join(lower_tag_values(item)),
            " ".join(lower_category_values(item)),
            str(item.get("url", "")).lower(),
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
            item_title(item).lower(),
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
    title = item_title(item)

    if looks_feed_artifact(title):
        return False

    if badge == "Social":
        return not looks_low_signal_social(item)

    if badge == "Paper":
        if relevance > 0:
            return True
        paper_focus = any(
            keyword in title.lower()
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
            for prefix in ("cs.ai", "cs.cl", "cs.lg", "cs.ni", "eess.sp")
        )

    if badge == "Repo":
        repo_focus = any(
            keyword in title.lower()
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


def local_signal_score(item: dict[str, Any]) -> float:
    cached = item.get("_signal_score")
    if isinstance(cached, (float, int)):
        return float(cached)

    badge = item_badge(item)
    source = item.get("source", "")
    hours = int(item.get("publishedHoursAgo") or 0)
    stars = int(item.get("stars") or 0)
    stars_per_day = float(item.get("starsPerDay") or 0.0)
    citations = int(item.get("citations") or 0)
    rank = int(item.get("rank") or 999)
    rank_delta = item.get("rank_delta")
    raw_score = float(item.get("score") or 0.0)
    relevance = relevance_hit_count(item)
    title = item_title(item)

    score = raw_score * 1.12
    score += freshness_bonus(hours)
    score += SOURCE_SCORE_BONUS.get(source, 0.0)
    score += min(0.72, relevance * 0.12)
    score += rank_bonus(rank)
    score += movement_bonus(rank_delta if isinstance(rank_delta, int) else None)

    if badge == "Repo":
        score += min(1.05, math.log1p(max(stars_per_day, 0.0)) * 0.34)
        score += min(0.42, math.log1p(max(stars, 0)) * 0.055)
        if "ai" in lower_tag_values(item):
            score += 0.12
        if lower_tag_values(item) == ["other"]:
            score -= 0.12
    elif badge == "Paper":
        score += min(0.28, math.log1p(max(citations, 0)) * 0.24)
        if any(category.startswith(("cs.ai", "cs.cl", "cs.lg")) for category in lower_category_values(item)):
            score += 0.08
    elif badge == "Social":
        if source == "geeknews":
            score += 0.16
        elif source == "x.com":
            score += 0.06
        elif source == "linkedin.com":
            score -= 0.02
        elif source == "endigest.dev":
            score -= 0.14
        if looks_low_signal_social(item):
            score -= 0.95

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
        if repo_desc:
            repo_desc = ensure_terminal_punctuation(repo_desc)
            freshness = f" Surfaced {hours}h ago"
            if stars > 0 and stars_per_day > 0:
                freshness += f" with {stars} stars and {stars_per_day:.0f}/day momentum."
            elif stars > 0:
                freshness += f" with {stars} stars."
            else:
                freshness += "."
            return clamp_text(repo_desc + freshness + movement, 190)
        if stars > 0:
            return clamp_text(
                f"Fresh GitHub repo with {stars} stars and {stars_per_day:.0f}/day activity in the last {hours}h.{movement}",
                190,
            )
        return clamp_text(f"Fresh GitHub repo signal picked up within the last {hours}h.{movement}", 190)
    if badge == "Paper":
        if tag_text:
            return clamp_text(
                f"Fresh arXiv paper from the {tag_text} cluster, posted {hours}h ago.{movement}",
                180,
            )
        return clamp_text(
            f"Fresh arXiv paper posted {hours}h ago and surfacing in the current feed.{movement}",
            180,
        )
    if badge == "Social":
        return clamp_text(
            f"Community signal picked up on {source_label(item.get('source', ''))} about {hours}h ago.{movement}",
            170,
        )
    if badge == "Cross-domain":
        return f"Cross-domain signal bridging AI and telecom themes, surfaced about {hours}h ago.{movement}"
    if badge == "vRAN":
        return f"vRAN-oriented signal that bubbled up in the last {hours}h.{movement}"
    if tag_text:
        return clamp_text(
            f"Fresh {tag_text} signal ranked into the current issue within the last {hours}h.{movement}",
            170,
        )
    return clamp_text(f"Fresh signal ranked into the current issue within the last {hours}h.{movement}", 170)


def meta_for(item: dict[str, Any]) -> str:
    bits: list[str] = [source_label(item.get("source", ""))]
    stars = int(item.get("stars") or 0)
    stars_per_day = float(item.get("starsPerDay") or 0.0)
    hours = int(item.get("publishedHoursAgo") or 0)
    score = local_signal_score(item)
    rank_delta = item.get("rank_delta")
    if stars > 0:
        bits.append(f"{stars} stars")
    if item_badge(item) == "Repo" and stars_per_day > 0:
        bits.append(f"{stars_per_day:.0f}/day")
    bits.append(f"{hours}h ago")
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


def prepare_candidates(payload: dict[str, Any]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for raw in payload.get("all", []):
        item = dict(raw)
        item["_title"] = english_title_for(item)
        item["_badge"] = badge_for(item)
        item["_relevance_hits"] = relevance_hit_count(item)
        item["_topic"] = primary_topic(item)
        item["_canonical_key"] = canonical_key(item)
        item["_signal_score"] = local_signal_score(item)
        if not include_item(item):
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

    def take(source_limit: int | None, topic_limit: int | None, badge_limit: int | None) -> None:
        for item in items:
            if len(selected) >= limit:
                return
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
            seen.add(key)
            selected.append(item)
            source_counts[source] += 1
            topic_counts[topic] += 1
            badge_counts[badge] += 1

    for source_limit, topic_limit, badge_limit in (
        (max_per_source, max_per_topic, max_per_badge),
        (None, max_per_topic, max_per_badge),
        (None, None, max_per_badge),
        (None, None, None),
    ):
        if len(selected) >= limit:
            break
        take(source_limit, topic_limit, badge_limit)

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
    min_keep = {"hot24": 4, "repos": 6, "papers": 4, "social": 2}.get(slug, 3)
    floor = {
        "hot24": max(4.4, best_score - 2.4),
        "repos": max(5.85, best_score - 3.35),
        "papers": max(4.35, best_score - 1.45),
        "social": max(3.75, best_score - 1.7),
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
        "hot24": min(limit, 6),
        "repos": max(limit, 8),
        "papers": min(limit, 6),
        "social": min(limit, 3),
    }.get(slug, limit)


def build_digest_context(payload: dict[str, Any], limit: int) -> DigestContext:
    candidates = prepare_candidates(payload)
    section_items: dict[str, list[dict[str, Any]]] = {
        "repos": [item for item in candidates if item_badge(item) == "Repo"],
        "papers": [item for item in candidates if item_badge(item) == "Paper"],
        "social": [item for item in candidates if item_badge(item) == "Social"],
    }
    curated_raw: dict[str, list[dict[str, Any]]] = {
        "repos": prune_section_items(
            "repos",
            select_diverse_items(section_items["repos"], section_limit_for("repos", limit), max_per_topic=2),
        ),
        "papers": prune_section_items(
            "papers",
            select_diverse_items(section_items["papers"], section_limit_for("papers", limit), max_per_topic=2),
        ),
        "social": prune_section_items(
            "social",
            select_diverse_items(
                section_items["social"],
                section_limit_for("social", limit),
                max_per_source=2,
                max_per_topic=2,
            ),
        ),
    }
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
        repo_scoreboard=[to_card(item) for item in curated_raw["repos"][:6]],
        sections=sections,
        source_counts=source_counts,
    )


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
    return entries[:8]


def render_markdown(
    issue_dt: datetime,
    generated_dt: datetime,
    summary: str,
    top_cards: list[NewsItem],
    repo_scoreboard: list[NewsItem],
    sections: list[tuple[str, str, str, list[NewsItem]]],
    archives: list[dict[str, str]],
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
        '      <p class="section-kicker">News Radar</p>',
        f"      <h1>{safe_text(title)}</h1>",
        f'      <p class="news-digest-lead">{safe_text(summary)}</p>',
        '      <div class="news-digest-actions" role="group" aria-label="News actions">',
        '        <a class="post-cta-link" href="/news/data/latest.json" target="_blank" rel="noreferrer">Raw feed JSON</a>',
        '        <a class="post-cta-link" href="#digest-archive">Digest archive</a>',
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
                "      <h2>Repo momentum board</h2>",
                "    </header>",
                '    <p class="news-digest-section-description">Local signal score blends freshness, feed rank, keyword relevance, and GitHub star velocity.</p>',
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
                "      <h2>Top signals</h2>",
                "    </header>",
                '    <div class="news-digest-top-grid">',
            ]
        )
        for card in top_cards:
            body.extend(
                [
                    f'      <a class="news-digest-card news-digest-top-card" href="{safe_text(card.url)}" target="_blank" rel="noreferrer">',
                    f'        <img class="news-digest-image" src="{safe_text(card.image_url)}" alt="{safe_text(card.title)}" width="1200" height="675" loading="lazy" decoding="async" />',
                    '        <div class="news-digest-card-copy">',
                    f"          <h3>{safe_text(card.headline or card.title)}</h3>",
                    "        </div>",
                    "      </a>",
                ]
            )
        body.extend(["    </div>", "  </section>", ""])

    for slug, heading, description, cards in sections:
        body.extend(
            [
                f'  <section id="digest-{safe_text(slug)}" class="news-digest-section">',
                '    <header class="news-digest-section-head">',
                '      <p class="section-kicker">Section</p>',
                f"      <h2>{safe_text(heading)}</h2>",
                "    </header>",
                f'    <p class="news-digest-section-description">{safe_text(description)}</p>',
                '    <div class="news-digest-grid">',
            ]
        )
        for card in cards:
            body.extend(
                [
                    f'      <a class="news-digest-card" href="{safe_text(card.url)}" target="_blank" rel="noreferrer">',
                    f'        <img class="news-digest-image" src="{safe_text(card.image_url)}" alt="{safe_text(card.title)}" width="1200" height="675" loading="lazy" decoding="async" />',
                    '        <div class="news-digest-card-copy">',
                    f"          <h3>{safe_text(card.headline or card.title)}</h3>",
                    "        </div>",
                    "      </a>",
                ]
            )
        body.extend(["    </div>", "  </section>", ""])

    body.extend(
        [
            '  <section id="digest-archive" class="news-digest-archive">',
            '    <header class="news-digest-section-head">',
            '      <p class="section-kicker">Archive</p>',
            "      <h2>Digest Posts</h2>",
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
            "  </section>",
            "",
            f'  <p class="news-digest-footnote">Generated from the ranked feed for {safe_text(issue_label)}.</p>',
            "</div>",
            "",
        ]
    )
    return frontmatter + "\n".join(body), stem


def write_post(issue_dt: datetime, generated_dt: datetime, context: DigestContext) -> str:
    stem = f"{issue_dt.strftime('%Y-%m-%d')}-ai-news-digest"
    archives = archive_entries(stem, context.summary)
    markdown, stem = render_markdown(
        issue_dt,
        generated_dt,
        context.summary,
        context.top_cards,
        context.repo_scoreboard,
        context.sections,
        archives,
    )
    target = POSTS_DIR / f"{stem}.md"
    target.write_text(markdown)
    return stem


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
        "top_cards": [card.__dict__ for card in context.top_cards],
        "repo_scoreboard": [card.__dict__ for card in context.repo_scoreboard],
        "sections": sections,
        "source_counts": context.source_counts,
        "digest": {
            "title": f"Daily AI News Digest — {issue_dt.strftime('%Y-%m-%d')}",
            "url": f"/notes/news/{digest_stem}/",
            "description": context.summary,
        },
        "archives": archive_entries(digest_stem, context.summary),
    }
    (GENERATED_DIR / "latest.json").write_text(json.dumps(hub, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    args = parse_args()
    ensure_dirs()
    load_translation_cache()
    issue_dt = issue_date_from_args(args.date)
    payload = load_source_feed()
    write_source_snapshot(payload)
    generated_dt = datetime.now(tz=KST)
    context = build_digest_context(payload, args.limit)
    digest_stem = write_post(issue_dt, generated_dt, context)
    write_hub_json(issue_dt, generated_dt, context, digest_stem)
    save_translation_cache()
    print(f"Generated news digest post: content/posts/news/{digest_stem}.md")
    print("Generated hub data: content/generated/news/latest.json")
    print("Updated raw feed snapshot: static/news/data/latest.json")


if __name__ == "__main__":
    main()
