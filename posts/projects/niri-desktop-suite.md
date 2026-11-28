---
title: Niri Wayland Companion Suite — Notch Daemon & Hermes Control Center
slug: niri-desktop-suite
date: 2026-09-08
period: 2026
role: Creator · Rust Wayland Daemon & Keyboard Control Center
category: project
status: active
featured: false
themes: [systems, hybrid-llm]
stack: [Rust, GTK3, gtk-layer-shell, Niri, Wayland, Wofi, Bash, Hermes Agent]
repo: https://github.com/mud-the-developer/niri-notch-rs
tags: [project, oss, rust, wayland, niri, desktop, agent]
description: Paired Wayland companion tools for the Niri compositor: a Rust Dynamic Island-style layer-shell notch daemon (niri-notch-rs) integrated with a Wofi + Hermes Agent keyboard control center.
publish: true
---

## Overview

A two-part desktop companion stack built for the [Niri](https://github.com/YaLTeR/niri) scrollable-tiling Wayland compositor: **`niri-notch-rs`**, a native Rust top-center companion notch running on GTK3 + `gtk-layer-shell`, paired with **`niri-hermes-control-center`**, a hackable Wofi + Bash command palette integrating local window management with Hermes Agent and Codex workflows.

<figure class="v3-demo-figure">
  <noscript data-project-demo="niri-desktop-suite">
    <video controls playsinline muted loop preload="metadata" src="/assets/media/niri-desktop-suite.mp4" poster="/assets/media/niri-desktop-suite-poster.png"></video>
  </noscript>
  <figcaption>60-second Remotion summary · niri-notch-rs pure-reducer GTK layer-shell daemon, niri-hermes-control-center Wofi/Hermes workflow, pointer & keyboard choreography, and installation gates.</figcaption>
</figure>

## 1. `niri-notch-rs` — Layer-Shell Companion Daemon

`niri-notch-rs` runs out-of-process as a standalone GTK3 + `gtk-layer-shell` overlay surface rather than an in-process compositor plugin, keeping Waybar as left/right companion rails and owning the center Dynamic Island surface.

- **Pure reducer internals**: `src/core.rs` handles all state transitions (`reduce(AppState, AppEvent) -> (AppState, Vec<Effect>)`) with zero I/O; `src/install.rs` performs idempotent managed-block edits on `~/.config/niri/config.kdl` with timestamped backups; `src/main.rs` owns GTK rendering and process effects.
- **Live desktop awareness**: tracks Niri workspaces and focused-window titles, intercepts `mako` notifications (auto-expanding with a chip and dismissing duplicate cards), and falls back to `playerctl` media status.
- **Direct pointer choreography**: hover expands with damped spring sizing, left-click clears notifications or toggles media, wheel scroll switches Niri workspaces, and **right-click opens the Niri Control Center**.

```bash
niri-notch-rs doctor --json
niri-notch-rs install --user --dry-run
niri-notch-rs install --user
```

## 2. `niri-hermes-control-center` — Wofi + Hermes Agent Palette

Built as transparent, dependency-light Bash scripts styled with an emerald/cyan glass Wofi theme under `~/.config/niri-control-center/`.

- **Structured command vocabulary (`ALT+SPACE`)**: exposes `Niri ·`, `Wayland ·`, `AI ·`, `System ·`, and `App ·` actions with `auto`/`ko`/`en` localization and Spotlight-style fallback (`wofi --show drun --search <text>`).
- **Hermes & Codex integration**: launches interactive `hermes --tui chat` in a real PTY terminal, runs one-shot `hermes chat -q` prompts from Wofi, forwards focused Niri window context to Hermes, and triggers `codex exec` tasks with completion notifications.
- **Everyday Wayland ergonomics**: floating scratch terminal (`MOD+SHIFT+ENTER`), focused-window HUD (`MOD+I`), confirmation-gated power/session menu (`MOD+ALT+P`), and `awww` wallpaper fade transitions (`MOD+CTRL+W`).

## Links

- [niri-notch-rs — GitHub Repository (Rust)](https://github.com/mud-the-developer/niri-notch-rs)
- [niri-hermes-control-center — GitHub Repository (Shell / Wofi)](https://github.com/mud-the-developer/niri-hermes-control-center)
