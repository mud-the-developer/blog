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
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "vendor" / "blog_news" / "data" / "latest.json"
GENERATED_DIR = ROOT / "content" / "generated" / "news"
POSTS_DIR = ROOT / "content" / "posts" / "news"
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


@dataclass
class NewsItem:
    title: str
    url: str
    source: str
    tags: list[str]
    score: float
    published_hours_ago: int
    stars: int
    image_url: str
    badge: str
    deck: str
    meta: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the blog news digest artifacts.")
    parser.add_argument("--date", help="Issue date in YYYY-MM-DD. Defaults to current date in Asia/Seoul.")
    parser.add_argument("--limit", type=int, default=4, help="Cards per section in the digest post.")
    return parser.parse_args()


def issue_date_from_args(raw: str | None) -> datetime:
    if raw:
        return datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=KST)
    return datetime.now(tz=KST)


def load_source_feed() -> dict[str, Any]:
    return json.loads(SOURCE_PATH.read_text())


def ensure_dirs() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    POSTS_DIR.mkdir(parents=True, exist_ok=True)


def normalize_image(url: str) -> str:
    if url.startswith("/assets/"):
        return "/news/assets/" + url.removeprefix("/assets/")
    return url


def clean_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+-\s+(LinkedIn|x\.com)$", "", value)
    return value


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


def clamp_text(value: str, limit: int) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def deck_for(item: dict[str, Any], badge: str) -> str:
    hours = int(item.get("publishedHoursAgo") or 0)
    stars = int(item.get("stars") or 0)
    title = clean_title(item.get("title", ""))
    tags = [tag for tag in item.get("tags") or [] if tag.lower() != "other"]
    tag_text = ", ".join(tags[:3]).lower()
    if badge == "Repo":
        if " — " in title:
            _, repo_desc = title.split(" — ", 1)
            if repo_desc.strip():
                return clamp_text(repo_desc.strip(), 150)
        if stars > 0:
            return f"Fresh GitHub repo with {stars} stars and activity in the last {hours}h."
        return f"Fresh GitHub repo signal picked up within the last {hours}h."
    if badge == "Paper":
        if tag_text:
            return f"Fresh arXiv paper from the {tag_text} cluster, posted {hours}h ago."
        return f"Fresh arXiv paper posted {hours}h ago and surfacing in the current feed."
    if badge == "Social":
        return f"Community signal picked up on {source_label(item.get('source', ''))} about {hours}h ago."
    if badge == "Cross-domain":
        return f"Cross-domain signal bridging AI and telecom themes, surfaced about {hours}h ago."
    if badge == "vRAN":
        return f"vRAN-oriented signal that bubbled up in the last {hours}h."
    if tag_text:
        return f"Fresh {tag_text} signal ranked into the current issue within the last {hours}h."
    return f"Fresh signal ranked into the current issue within the last {hours}h."


def meta_for(item: dict[str, Any]) -> str:
    bits: list[str] = [source_label(item.get("source", ""))]
    stars = int(item.get("stars") or 0)
    hours = int(item.get("publishedHoursAgo") or 0)
    score = float(item.get("score") or 0.0)
    if stars > 0:
        bits.append(f"{stars} stars")
    bits.append(f"{hours}h ago")
    bits.append(f"score {score:.2f}")
    return " · ".join(bits)


def to_card(item: dict[str, Any]) -> NewsItem:
    badge = badge_for(item)
    return NewsItem(
        title=clean_title(item.get("title", "Untitled")),
        url=item.get("url", "#"),
        source=item.get("source", ""),
        tags=[tag for tag in list(item.get("tags") or []) if tag.lower() != "other"],
        score=float(item.get("score") or 0.0),
        published_hours_ago=int(item.get("publishedHoursAgo") or 0),
        stars=int(item.get("stars") or 0),
        image_url=normalize_image(item.get("image", "/news/assets/thumb-ai.svg")),
        badge=badge,
        deck=deck_for(item, badge),
        meta=meta_for(item),
    )


def unique_cards(raw_items: list[dict[str, Any]], limit: int) -> list[NewsItem]:
    cards: list[NewsItem] = []
    seen: set[str] = set()
    for item in raw_items:
        url = item.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        cards.append(to_card(item))
        if len(cards) >= limit:
            break
    return cards


def issue_summary(payload: dict[str, Any]) -> str:
    hot = payload.get("hot24") or []
    repos = payload.get("repos") or []
    papers = payload.get("papers") or []
    social = payload.get("social") or []
    hot_repo = next((item for item in hot if item.get("source") == "github.com"), None)
    top_repo = clean_title(hot_repo.get("title", "")) if hot_repo else ""
    if " — " in top_repo:
        top_repo = top_repo.split(" — ", 1)[0]
    repo_fragment = f"Top repo momentum is led by {top_repo}." if top_repo else "Top repo momentum stayed active."
    return (
        f"{repo_fragment} "
        f"{len(repos[:4])} repo signals, {len(papers[:4])} paper picks, and {len(social[:4])} community items made today's cut."
    )


def archive_entries(current_stem: str) -> list[dict[str, str]]:
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
            },
        )
    return entries[:8]


def render_markdown(issue_dt: datetime, summary: str, sections: list[tuple[str, str, list[NewsItem]]]) -> str:
    issue_date = issue_dt.strftime("%Y-%m-%d")
    stem = f"{issue_date}-ai-news-digest"
    title = f"Daily AI News Digest — {issue_date}"
    frontmatter = "\n".join(
        [
            "---",
            f"title: {title}",
            f"description: {summary}",
            f"date: {issue_date} 00:00",
            "tags: [news, news-digest, ai, radar]",
            "publish: true",
            "content-classes: [news-digest-note]",
            "---",
            "",
        ]
    )
    body = [
        "[[home]]",
        f"# {title}",
        "",
        summary,
        "",
        "Hub: [/news/](/news/) · Raw feed: [/news/data/latest.json](/news/data/latest.json)",
        "",
    ]
    for _, heading, cards in sections:
        body.append(f"## {heading}")
        body.append("")
        body.append('<div class="news-digest-grid">')
        for card in cards:
            tags = "".join(
                f'<span class="news-digest-chip">#{tag}</span>' for tag in card.tags[:3]
            )
            body.extend(
                [
                    f'  <a class="news-digest-card" href="{card.url}" target="_blank" rel="noreferrer">',
                    f'    <span class="news-digest-badge">{card.badge}</span>',
                    f'    <h3>{card.title}</h3>',
                    f'    <p>{card.deck}</p>',
                    f'    <div class="news-digest-chip-row">{tags}</div>' if tags else '    <div class="news-digest-chip-row"></div>',
                    f'    <p class="news-digest-meta">{card.meta}</p>',
                    "  </a>",
                ]
            )
        body.append("</div>")
        body.append("")
    body.append(f"_Generated from the ranked feed for {issue_date}._")
    body.append("")
    return frontmatter + "\n".join(body), stem


def write_post(issue_dt: datetime, summary: str, payload: dict[str, Any], limit: int) -> str:
    sections = [
        (slug, title, unique_cards(payload.get(slug, []), limit))
        for slug, title, _ in SECTION_SPECS
    ]
    markdown, stem = render_markdown(issue_dt, summary, sections)
    target = POSTS_DIR / f"{stem}.md"
    target.write_text(markdown)
    return stem


def source_count_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    counts = payload.get("sourceCounts") or {}
    for key, value in counts.items():
        rows.append({"label": source_label(key), "value": int(value)})
    rows.sort(key=lambda row: (-row["value"], row["label"]))
    return rows


def write_hub_json(issue_dt: datetime, payload: dict[str, Any], summary: str, digest_stem: str) -> None:
    generated_at = datetime.now(tz=KST).isoformat()
    top_cards = unique_cards(payload.get("hot24", []), 4)
    sections = []
    for slug, title, description in SECTION_SPECS:
        sections.append(
            {
                "slug": slug,
                "title": title,
                "description": description,
                "items": [card.__dict__ for card in unique_cards(payload.get(slug, []), 8)],
            }
        )
    hub = {
        "generated_at": generated_at,
        "issue_date": issue_dt.strftime("%Y-%m-%d"),
        "summary": summary,
        "top_cards": [card.__dict__ for card in top_cards],
        "sections": sections,
        "source_counts": source_count_rows(payload),
        "digest": {
            "title": f"Daily AI News Digest — {issue_dt.strftime('%Y-%m-%d')}",
            "url": f"/notes/news/{digest_stem}/",
            "description": summary,
        },
        "archives": archive_entries(digest_stem),
    }
    (GENERATED_DIR / "latest.json").write_text(json.dumps(hub, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    args = parse_args()
    ensure_dirs()
    issue_dt = issue_date_from_args(args.date)
    payload = load_source_feed()
    summary = issue_summary(payload)
    digest_stem = write_post(issue_dt, summary, payload, args.limit)
    write_hub_json(issue_dt, payload, summary, digest_stem)
    print(f"Generated news digest post: content/posts/news/{digest_stem}.md")
    print("Generated hub data: content/generated/news/latest.json")


if __name__ == "__main__":
    main()
