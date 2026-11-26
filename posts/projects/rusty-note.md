---
title: Rusty Note — Native Rust Markdown Sticky Notes
slug: rusty-note
date: 2026-10-16
period: 2026
role: Creator · Native Windows Utility
category: project
status: active
featured: false
themes: [systems]
stack: [Rust, Win32, Cached Pretext Layout, Markdown]
repo: https://github.com/mud-the-developer/rusty-note
demo_url: https://github.com/mud-the-developer/rusty-note/releases/latest
tags: [project, oss, rust, desktop, markdown]
description: Native Windows editable Markdown sticky note in Rust with cached Pretext layout and event-driven rendering—no Electron, WebView, or JavaScript runtime.
publish: true
---

## Overview

**Rusty Note** (`v1.0.1`) is a lightweight, native **editable Markdown sticky note** for Windows 10/11 x64 written in Rust. It ships as a portable single executable with zero browser engine, WebView, Electron, or JavaScript runtime.

## Core Design

- **Edit where you read**: clicking paragraphs, ATX headings, or list/task items opens in-place editing while surrounding blocks remain rendered. Unedited bytes, structural prefixes, and line endings stay intact on save.
- **Cached Pretext-inspired layout**: font advances are measured and reused across window resizes so text reflow remains smooth under event-driven rendering.
- **Explicit save discipline**: task checkbox toggles and block edits feed a bounded undo/redo stack (`Ctrl+Z`/`Ctrl+Y`) and only commit on explicit `Ctrl+S`—external file updates reload clean drafts without silently clobbering dirty edits.
- **Owned local image viewer**: clicking an embedded local image opens a native zoom/pan window (`Home`/`Space` fit, `Esc` closes only the viewer).

## Quick Usage

```powershell
# Open an existing Markdown note directly
.\rusty-note.exe "C:\path\note.md"
```

- **Pin above windows**: press `P` to keep active notes visible during debugging or paper reading.
- **Theme switch**: press `T` to toggle between warm-paper and charcoal palettes.
- **Zoom & search**: `Ctrl++`/`Ctrl+-`/`Ctrl+0` scales document text between 80% and 160%; `Ctrl+F` runs bounded ASCII-case-insensitive search.

## Links

- [Portable Windows Releases & SHA256SUMS](https://github.com/mud-the-developer/rusty-note/releases/latest)
- [GitHub Repository](https://github.com/mud-the-developer/rusty-note)
