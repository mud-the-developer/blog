---
title: Rust Rendering Notes
description: Why this project mixes Askama templates with Maud sections.
date: 2026-02-11
tags: [rust, templates, architecture]
publish: true
---

# Rust Rendering Notes

This stack uses Askama for page skeletons and Maud for assembled fragments.

## Why Split Rendering

- Askama: predictable layout and metadata templates
- Maud: ergonomic generation of backlink sections and composed HTML blocks

Related notes:

- [[second-brain]]
- [[obsidian-linking-habits|Linking habits]]
- [[github-cloudflare-pipeline]]
