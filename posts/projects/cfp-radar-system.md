---
title: Call for Papers — Automated Deadline Pipeline
slug: cfp-radar-system
date: 2026-06-10
period: 2026 – Present
role: Blog Automation · Rust + GitHub Actions + Cloudflare Pages
category: system
status: active
featured: true
themes: [ai-ran, systems]
stack: [Rust, Tokio, Askama, iCalendar, Cloudflare Pages]
demo_url: /cfp/
repo: https://github.com/mud-the-developer/blog
tags: [project, system, rust, cfp, automation]
description: Daily Rust pipeline that tracks official calls for papers across wireless communications, AI/systems, and networking, emitting verified JSON and .ics calendar feeds.
publish: true
---

## Overview

**Call for Papers (CFP)** is an automated static-plus-data pipeline built in Rust that monitors official conference, workshop, and journal special issue calls across wireless communications, AI-RAN, networking, and ML systems.

<figure class="v3-demo-figure">
  <video controls playsinline muted loop preload="metadata" poster="/assets/media/cfp-radar-system-poster.png">
    <source src="/assets/media/cfp-radar-system.mp4" type="video/mp4" />
  </video>
  <figcaption>45-second Remotion summary · Daily Rust CFP pipeline, official domain evidence gate, separate milestone parsing with stable iCalendar UIDs, and live endpoints.</figcaption>
</figure>

## Architecture

- **Daily Discovery & Verification**: `mud-blog cfp update` scrapes configured official venue pages and validates deadline evidence before updating `data/cfp/` and `static/cfp/`.
- **Single-Snapshot Design**: Replaces one live dashboard without noisy archive clutter; unconfirmed or stale venues are flagged instead of silently injected into calendar feeds.
- **Calendar & Data Feeds**: Emits both machine-readable `/cfp/data/latest.json` and subscribable `/cfp/radar.ics` (`webcal://`) feeds.

## Automated Endpoints

- Page: [Call for Papers](/cfp/)
- JSON feed: [/cfp/data/latest.json](/cfp/data/latest.json)
- Calendar feed: [/cfp/radar.ics](/cfp/radar.ics)
