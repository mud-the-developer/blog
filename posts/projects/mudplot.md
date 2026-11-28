---
title: mudplot — Perceptually Uniform Scientific Plotting
slug: mudplot
date: 2026-11-26
period: 2025 – Present
role: Creator · Python + Rust Editor
category: project
status: active
featured: false
themes: [systems]
stack: [Python, Matplotlib, Rust, Axum, Askama, LCH Color Engine]
repo: https://github.com/mud-the-developer/mudplot
demo_url: https://mud-the-developer.github.io/mudplot/
tags: [project, oss, visualization, python, rust]
description: LCH-based perceptually uniform, colourblind-aware scientific plotting library on Matplotlib with a declarative FigureSpec core and Rust/Askama local editor.
publish: true
---

## Overview

**mudplot** is a Python plotting library built on Matplotlib for publication figures, paired with a local Rust (`Axum + Askama`) figure editor. Its core goal is to make multi-series research figures stay distinguishable under greyscale printing and colour-vision deficiency without sacrificing explicit, serializable figure state.

<figure class="v3-demo-figure">
  <noscript data-project-demo="mudplot">
    <video controls playsinline muted loop preload="metadata" src="/assets/media/mudplot.mp4" poster="/assets/media/mudplot-poster.png"></video>
  </noscript>
  <figcaption>60-second Remotion summary · CIELAB LCH palette synthesis, CIEDE2000 colour-vision deficiency checks, declarative FigureSpec reducer, and Rust/Askama local editor workflow.</figcaption>
</figure>

## LCH Perceptual Colour Engine
Instead of picking arbitrary RGB palettes, `mudplot` synthesizes palettes in cylindrical CIELAB ($L^* C^* h^\circ$) space and evaluates worst-case perceptual separation using CIEDE2000 ($\Delta E_{00}$):

$$
\Delta E_{\min}(P) = \min_{i \neq j} \min_{v \in \{\text{normal},\,\text{protan},\,\text{deutan}\}} \Delta E_{00}\!\left(c_i^{(v)}, c_j^{(v)}\right)
$$

- **Fixed lightness ($L^*$)**: keeps series fair when printed in black and white.
- **Colour-vision deficiency checks**: simulates protanopia and deuteranopia via Machado (2009) matrices and reports measurable contrast through `Palette.report()`.
- **Redundant non-colour encoding**: grouped bar, box, and violin fills cycle finite hatch patterns for greyscale readability.

## Spec-Centric Architecture

Every figure is stored as a declarative, JSON-serializable `FigureSpec` (`.mplot.json`). State transitions go through a side-effect-free reducer before Matplotlib renders PNG/PDF/SVG output:

```python
import mudplot as mp

fig = (
    mp.figure(size=(3.5, 2.4), dpi=300)
      .palette("ieee-okabe", colorblind_check=True)
      .line(x=epochs, y=baseline, label="Baseline")
      .line(x=epochs, y=proposed, label="Proposed")
      .save("ablation.pdf", layout_policy="smart")
)
```

- **Functional core / imperative shell**: `reduce(state, action) -> state'` keeps undo/redo, JSON snapshots, and validation deterministic across CLI and editor workflows.
- **Opt-in visual linting**: `lint(visual=True)` checks legend/data collisions and scale readability at target publication dimensions.
- **Rust editor bridge**: the `mudplot-editor` interface shares the same declarative action/JSON schema while delegating canonical rendering to Matplotlib.

## Links

- [Documentation & Visual Quality Review](https://mud-the-developer.github.io/mudplot/)
- [GitHub Repository](https://github.com/mud-the-developer/mudplot)
