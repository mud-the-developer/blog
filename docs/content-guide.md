# Content Guide: Projects, Writing, CV, and Feeds

This site is statically built with Rust (`Tokio + Askama`) from Markdown posts under `posts/`, your LaTeX CV under `cv/`, and cached Scholar metrics under `data/scholar/publications.json`.

## 1. Adding a New Project

Create a Markdown file in `posts/projects/<your-slug>.md` with this frontmatter:

```markdown
---
title: Project Title
slug: project-slug
date: 2026-11-26
period: Sep. 2026 – Present
role: Author · RAMO Lab / Personal
category: project        # demo | system | paper | project
status: active           # active | exhibited | published | archived
featured: true           # true shows in the homepage Selected Work grid
themes: [ai-ran, hybrid-llm]  # ai-ran | hybrid-llm | semantic-comm | quantum-ai | systems
stack: [Rust, PyTorch, O-RAN]
repo: https://github.com/mud-the-developer/your-repo
demo_url: https://example.com
paper_url: https://arxiv.org/abs/xxxx.xxxxx
tags: [project, systems]
lang: en                 # optional; auto-detected (en / ko) if omitted
description: Concise one-line technical summary shown on cards and social previews.
publish: true
---

## Overview

Write the project overview, architecture, experiments, code blocks, or math here.
```

Then run `npm run build` (or push to `main` when ready) — the project automatically appears on:
- `/projects/` full project directory
- `/` homepage Selected Work grid (when `featured: true`)
- `/posts/<slug>/` full case-study page with TOC, syntax highlighting, code copy buttons, MathML equations, and prev/next navigation
- Command palette (`Cmd/Ctrl+K`), `/rss.xml`, and `/sitemap.xml` (with `<lastmod>`)

### Project demo videos

Render both appearances from the same Remotion composition. From the repository root:

```bash
npm --prefix video run render:mudplot          # one project, both themes
npm --prefix video run render:all -- dark      # all projects, dark only
```

Each command writes a 1080p MP4 and a frame-90 PNG poster to `static/media/` for each selected theme. Light uses `<slug>.mp4` and `<slug>-poster.png`; dark uses `<slug>-dark.mp4` and `<slug>-dark-poster.png`. After changing a demo's timing or content, render both themes so switching during playback stays on the same frame.

For a new demo, follow [`posts/projects/mudplot.md`](../posts/projects/mudplot.md): put the light player inside `<noscript data-project-demo="<slug>">` in the figure and keep its caption outside. With JavaScript enabled the site loads just the active theme’s video and poster. Without it, the light player works with native controls.

## 2. Writing Notes, Code & Math

- **Writing archive (`/writing/`)**: Place long-form essays in `posts/blog/*.md` and paper notes in `posts/papers/*.md`.
- **Syntax highlighting**: Fenced code blocks (`rust`, `python`, `js`/`ts`, `bash`, `powershell`, `go`, `cpp`, `json`, `yaml`, `toml`, `latex`, `html`, `css`) are highlighted at build time with a copy button and zero client-side highlighter payload.
- **LaTeX math**: Inline (`$...$`) and display (`$$...$$`) equations are rendered to static MathML Core at build time (zero CDN dependencies, CSP-safe).
- **RSS feeds**: `/rss.xml` syndicates projects, writing, and CFP updates; `/news/rss.xml` syndicates daily AI news briefs.

## 3. Updating Your CV & Scholar Metrics

Your LaTeX CV source lives in `cv/`:

- `cv/resume.tex` — header metadata (name, title, affiliation, email, links)
- `cv/resume/summary.tex` — research summary
- `cv/resume/education.tex` — degrees
- `cv/resume/experience.tex` — lab, visiting research, and internship roles
- `cv/resume/publications.tex` — published papers (commented `%` entries stay hidden)
- `cv/resume/programs.tex` — demonstrations and programs
- `cv/figures/` — organization emblems

Google Scholar citation counts are read offline from `data/scholar/publications.json`, synced from the companion `vercel_google_scholar_publications` cache:

```bash
npm run scholar:sync  # refreshes data/scholar/publications.json (keeps existing cache on network failure)
npm run cv:pdf        # compiles cv/resume.pdf via tectonic (or xelatex if configured)
npm run build         # re-parses cv/resume/*.tex + Scholar cache into /cv/, /, and /cv/jinhyuk-kim-cv.pdf
```

The web `/cv/` page, homepage publications summary, BibTeX copy snippets, citation metrics, and downloadable PDF stay synchronized from the same sources.
