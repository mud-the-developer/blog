---
title: "Obsidian Blog Helper 설치 가이드"
date: 2026-02-21 16:05
lastmod: 2026-02-21 16:05
publish: true
draft: false
tags: [blog, obsidian, setup]
description: "Obsidian + Git 블로그 환경을 빠르게 설치하고 연동하는 방법"
---

# Obsidian Blog Helper 설치 가이드

이 글은 `obsidian-blog-helper-init`로 블로그 Vault와 Obsidian 플러그인을 한 번에 세팅하는 방법을 정리합니다.

## 1) 준비물

- Git
- Obsidian Desktop
- Node.js(npx) 또는 Bun(bunx)

확인:

```bash
git --version
node -v
bun --version
```

## 2) 설치 (가장 쉬운 방법)

### npx

```bash
npx -y obsidian-blog-helper-init
```

### bunx

```bash
bunx -y obsidian-blog-helper-init
```

기본값:

- repo: `https://github.com/mud-the-developer/blog.git`
- vault: `~/Sync/ObsidianBlog`

커스텀:

```bash
obsidian-blog-helper-init <blog_git_url> <vault_path>
```

## 3) Obsidian에서 활성화

1. Vault 열기 (`~/Sync/ObsidianBlog`)
2. `Settings → Community plugins`
3. `Reload plugins`
4. `Blog Helper` 활성화

## 4) 주요 명령

- `Blog Helper: New Post (Published)`
- `Blog Helper: New Post (Draft)`
- `Blog Helper: Update Lastmod`

## 5) Git 연동 권장

현재 구성은 서버 자동 push(timer) 기준이므로,

- Obsidian Git 자동 commit/push는 OFF
- 작성만 Obsidian에서 하고 push는 서버에 맡기기

## 6) 트러블슈팅 (UTF-8 에러)

`stream did not contain valid UTF-8`가 뜨면 macOS 메타 파일(`._*`)이 원인일 가능성이 큽니다.

```bash
find . -type f -name '._*' -delete
echo '._*' >> .gitignore
echo '.DS_Store' >> .gitignore
```

## 7) 마무리

이제 Obsidian에서 글 작성 → 서버 자동 push → 블로그 반영 흐름으로 운영하면 됩니다.
