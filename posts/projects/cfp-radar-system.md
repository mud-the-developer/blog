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
  <noscript data-project-demo="cfp-radar-system">
    <video controls playsinline muted loop preload="metadata">
      <source media="(max-width: 600px) and (prefers-color-scheme: dark)" src="/assets/media/cfp-radar-system-compact-dark.mp4?cut=3">
      <source media="(max-width: 600px)" src="/assets/media/cfp-radar-system-compact.mp4?cut=3">
      <source media="(prefers-color-scheme: dark)" src="/assets/media/cfp-radar-system-dark.mp4?cut=3">
      <source src="/assets/media/cfp-radar-system.mp4?cut=3">
    </video>
  </noscript>
  <figcaption>ICC 2027 extended its paper deadline from October 16 to October 30, 2026. The subscribed calendar moves the original event.</figcaption>
</figure>

## Architecture

- **Daily Discovery & Verification**: `mud-blog cfp update` scrapes configured official venue pages and validates deadline evidence before updating `data/cfp/` and `static/cfp/`.
- **Single-Snapshot Design**: Replaces one live dashboard without noisy archive clutter; unconfirmed or stale venues are flagged instead of silently injected into calendar feeds.
- **Calendar & Data Feeds**: Emits both machine-readable `/cfp/data/latest.json` and subscribable `/cfp/radar.ics` (`webcal://`) feeds.

## Automated Endpoints

- Page: [Call for Papers](/cfp/)
- JSON feed: [/cfp/data/latest.json](/cfp/data/latest.json)
- Calendar feed: [/cfp/radar.ics](/cfp/radar.ics)
