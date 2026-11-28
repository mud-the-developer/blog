---
title: HWP Editor — Local HWPX Live Preview & OMP Workspace
slug: hwp-editor-public
date: 2026-11-25
period: 2026
role: Creator · Windows Desktop App & Document Workflow
category: project
status: active
featured: false
themes: [systems, hybrid-llm]
stack: [Python, WPF (.NET 10), WebView2, @rhwp/core, HWPX, oh-my-pi]
repo: https://github.com/mud-the-developer/hwp-editor-public
demo_url: https://github.com/mud-the-developer/hwp-editor-public/releases
tags: [project, oss, hwpx, windows, desktop, agent]
description: Local-first Windows HWPX document editor pairing an @rhwp/core live preview pane with an embedded oh-my-pi (OMP) terminal, original preservation, and checkpoint history.
publish: true
---

## Overview

**HWP Editor** (`1.0.0-rc.4`, AGPL-3.0-only) is a local-first Windows desktop application for authoring and reviewing Korean `.hwpx` documents and forms without giving up file ownership or layout fidelity. The workspace splits cleanly into a **live HWPX preview** on the left (rendered locally via `@rhwp/core 0.8.7`) and an embedded **oh-my-pi (OMP) terminal** on the right.

<figure class="v3-demo-figure">
  <noscript data-project-demo="hwp-editor-public">
    <video controls playsinline muted loop preload="metadata">
      <source media="(max-width: 600px) and (prefers-color-scheme: dark)" src="/assets/media/hwp-editor-public-compact-dark.mp4?cut=3">
      <source media="(max-width: 600px)" src="/assets/media/hwp-editor-public-compact.mp4?cut=3">
      <source media="(prefers-color-scheme: dark)" src="/assets/media/hwp-editor-public-dark.mp4?cut=3">
      <source src="/assets/media/hwp-editor-public.mp4?cut=3">
    </video>
  </noscript>
  <figcaption>Double-click a paragraph to copy its text and locator into the local OMP draft. Nothing is sent.</figcaption>
</figure>

## Core Workflow & Guardrails

- **Split preview + terminal loop**: open a working directory (`Ctrl+O`), pick an `.hwpx` file or create a blank one (`Ctrl+N`), and edit from either Hancom Office or OMP—every save refreshes the preview automatically.
- **Originals and automatic checkpoints**: the untouched first copy is retained under `.hwpreview/originals/`, while incremental revisions are recorded under `.hwpreview/history/` and browsable/restorable from the `Ctrl+B` drawer before exporting a clean copy.
- **Explicit human-in-the-loop AI**: AI actions are strictly opt-in (`/login`, `/model` inside OMP). Double-clicking a paragraph copies its structural locator and excerpt to the composer or clipboard without auto-sending document text to any model.
- **No silent degradation**: unsupported tables, figures, control objects, or mixed runs are never stripped or flattened into plain text.

## Packaging & Isolated Runtime

```powershell
# Launch development checkout (auto-creates .venv and builds WPF UI)
.\start-desktop.cmd
```

- **Isolated tool prefix**: packaged builds pin Bun and OMP strictly under `%LOCALAPPDATA%\HWPReview\Dependencies\Bun-1.4.4-OMP-18.15.0` without touching or mutating the user's global `.bun` installation.
- **Consent-gated Hancom automation**: when a compatible 32-bit Hancom Office installation is present, the setup wizard verifies the official HTTPS security module archive and registers it for the current user only after explicit consent—never installing Hancom Office itself or overwriting damaged registrations.
- **Legacy `.hwp` tool isolation**: older binary `.hwp` files run in a separate desktop window with explicit approval and verification steps while blocking schema-2 or arbitrary write operations.

## Links

- [GitHub Repository (AGPL-3.0-only)](https://github.com/mud-the-developer/hwp-editor-public)
- [Pre-release Windows Kits & Source Archives](https://github.com/mud-the-developer/hwp-editor-public/releases)
