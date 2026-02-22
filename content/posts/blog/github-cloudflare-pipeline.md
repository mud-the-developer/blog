---
title: GitHub to Cloudflare Pipeline
description: Reliable publishing flow from notes to production.
date: 2026-02-13
tags:
  - github
  - cloudflare
  - ops
aliases:
  - publish-pipeline
publish: true
---

# GitHub to Cloudflare Pipeline

This note documents how markdown updates move to production.

## Build Artifacts

`blog-build` compiles notes into static files under `dist/`.

- Source: `content/posts`
- Static assets: `static`
- Outputs: `index.html`, `sitemap.xml`, `rss.xml`, `graph.json`

## Deploy Trigger

Pushing to `main` runs the deployment workflow and publishes `dist/`.

Related:

- [[second-brain|Second Brain Architecture]]
- [[seo-performance-guide|SEO and Performance Guide]]
- [[home#Mud's Blog|Home intro]]
