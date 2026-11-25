# Content Guide: Projects, Writing, and CV Updates

This site is statically built with Rust (`Tokio + Askama`) from Markdown posts under `posts/` and your LaTeX CV under `cv/`.

## 1. Adding a New Project

Create a Markdown file in `posts/projects/<your-slug>.md` with this frontmatter:

```markdown
---
title: Project Title
slug: project-slug
date: 2026-11-25
period: Sep. 2026 – Present
role: Author · RAMO Lab / Personal
category: project        # demo | system | paper | project
status: active           # active | exhibited | published | archived
featured: true           # true shows on the homepage + interactive map
themes: [ai-ran, hybrid-llm]  # ai-ran | hybrid-llm | semantic-comm | quantum-ai | systems
stack: [Rust, PyTorch, O-RAN]
repo: https://github.com/mud-the-developer/your-repo
demo_url: https://example.com
paper_url: https://arxiv.org/abs/xxxx.xxxxx
tags: [project, systems]
description: Concise one-line technical summary shown on cards and the homepage map.
publish: true
---

## Overview

Write the project overview, architecture, experiments, or screenshots here.
```

Then run `npm run build` (or push to `main` when ready) — the project automatically appears on:
- `/projects/` (with category & theme filtering)
- `/` homepage (when `featured: true`) and the interactive Research Cluster map
- `/posts/<slug>/` full case-study page
- Command palette (`Cmd/Ctrl+K`) and `sitemap.xml`

## 2. Updating Your CV

Your LaTeX CV source lives in `cv/`:

- `cv/resume.tex` — header metadata (name, title, affiliation, email, links)
- `cv/resume/summary.tex` — research summary
- `cv/resume/education.tex` — degrees
- `cv/resume/experience.tex` — lab, visiting research, and internship roles
- `cv/resume/publications.tex` — published papers (commented `%` entries stay hidden)
- `cv/resume/programs.tex` — demonstrations and programs
- `cv/figures/` — organization emblems

After editing any `.tex` file:

```bash
npm run cv:pdf   # compiles cv/resume.pdf via tectonic (or xelatex if configured)
npm run build    # re-parses cv/resume/*.tex into /cv/, /, and copies /cv/jinhyuk-kim-cv.pdf
```

The web `/cv/` page, homepage experience/publications summary, BibTeX copy snippets, and downloadable PDF stay synchronized from the same `.tex` source.
