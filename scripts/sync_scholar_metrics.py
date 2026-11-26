#!/usr/bin/env python3
"""Sync cached Google Scholar publication metrics from the companion repo.

Fetches the already-scraped JSON cache published by
`mud-the-developer/vercel_google_scholar_publications` so blog builds stay
offline-safe and never scrape Google Scholar directly.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "data" / "scholar" / "publications.json"
DEFAULT_SCHOLAR_ID = "-Uiul2AAAAAJ"
DEFAULT_URL_TEMPLATE = (
    "https://raw.githubusercontent.com/mud-the-developer/"
    "vercel_google_scholar_publications/main/data/{scholar_id}.json"
)


def validate_entries(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, list) or not payload:
        raise ValueError("Scholar payload must be a non-empty JSON array.")
    cleaned: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        if not title:
            continue
        raw_cites = item.get("citationCount", 0)
        try:
            cites = max(0, int(raw_cites))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid citationCount for {title!r}: {raw_cites!r}") from exc
        entry: dict[str, Any] = {
            "title": title,
            "authors": str(item.get("authors", "")).strip(),
            "citationCount": cites,
        }
        if isinstance(item.get("year"), int):
            entry["year"] = item["year"]
        for opt_key in ("scholarUrl", "venue", "role", "citationUpdatedAt"):
            val = item.get(opt_key)
            if isinstance(val, str) and val.strip():
                entry[opt_key] = val.strip()
        cleaned.append(entry)
    if not cleaned:
        raise ValueError("Scholar payload contained no valid publication entries.")
    return cleaned


def fetch_scholar_json(url: str, timeout: float = 15.0) -> list[dict[str, Any]]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "mud-blog-scholar-sync/1.0 (+https://mud-blog.pages.dev)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
    return validate_entries(json.loads(raw))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync cached Scholar publication JSON.")
    parser.add_argument("--scholar-id", default=DEFAULT_SCHOLAR_ID)
    parser.add_argument("--url", default="")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--strict", action="store_true", help="Exit non-zero if fetch fails.")
    args = parser.parse_args(argv)

    url = args.url or DEFAULT_URL_TEMPLATE.format(scholar_id=args.scholar_id)
    try:
        entries = fetch_scholar_json(url)
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        if args.output.exists() and not args.strict:
            print(f"warning: keeping existing Scholar cache ({args.output}): {exc}", file=sys.stderr)
            return 0
        print(f"error: failed to sync Scholar cache: {exc}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(entries, ensure_ascii=False, indent=2) + "\n"
    if args.output.exists() and args.output.read_text(encoding="utf-8") == rendered:
        print(f"Scholar cache unchanged ({len(entries)} entries, {sum(e['citationCount'] for e in entries)} citations).")
        return 0
    args.output.write_text(rendered, encoding="utf-8")
    print(f"Updated {args.output} ({len(entries)} entries, {sum(e['citationCount'] for e in entries)} citations).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
