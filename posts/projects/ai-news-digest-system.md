---
title: AI News Digest & Interactive Source Search Desk
slug: ai-news-digest-system
date: 2026-06-09
period: 2026 – Present
role: Blog Automation · Python + Rust + Cloudflare Functions
category: system
status: active
featured: true
themes: [hybrid-llm, systems]
stack: [Python, Rust, Cloudflare Functions, Askama]
demo_url: /news/
repo: https://github.com/mud-the-developer/blog
tags: [project, system, llm, news, cloudflare]
description: Automated daily AI/research signal brief paired with an interactive multi-source candidate search and draft exporter running on Cloudflare Pages Functions.
publish: true
---

## Overview

An automated research signal desk that aggregates arXiv papers, GitHub repositories, and technical sources into daily structured digests while providing an interactive search-and-draft tool for custom topics.

<figure class="v3-demo-figure">
  <noscript data-project-demo="ai-news-digest-system">
    <video controls playsinline muted loop preload="metadata">
      <source media="(max-width: 600px) and (prefers-color-scheme: dark)" src="/assets/media/ai-news-digest-system-compact-dark.mp4?cut=3">
      <source media="(max-width: 600px)" src="/assets/media/ai-news-digest-system-compact.mp4?cut=3">
      <source media="(prefers-color-scheme: dark)" src="/assets/media/ai-news-digest-system-dark.mp4?cut=3">
      <source src="/assets/media/ai-news-digest-system.mp4?cut=3">
    </video>
  </noscript>
  <figcaption>Uncheck one paper. Only the two selected sources appear in the draft.</figcaption>
</figure>

## Architecture

- **Daily Digest Generator**: Scheduled GitHub Actions workflow runs `scripts/generate_news_digest.py` to rank sources, synthesize summaries, and publish daily markdown briefs under `/news/`.
- **Interactive Search Desk**: Cloudflare Pages Functions (`/api/news-search`, `/api/focused-issue`) allow filtering across sources, inspecting cards, and exporting reviewable Markdown or print-isolated PDF drafts.
- **Static + Edge Hybrid**: Core archives are statically compiled with Rust/Askama for fast loads while interactive queries execute on the edge.

## Automated Endpoints

- Daily Desk: [AI News Digest](/news/)
- Interactive Search: [News Search](/news/search/)
