# Digital Garden Front 차이 분석 (추가 재비교)

작성일: 2026-02-17  
대상: `/home/mud/repo/blog`  
비교 기준: `obsidian-digital-garden` 기능 목록 (`/home/mud/repo/blog_temp/obsidian-digital-garden/README.md:24`)

## 이번 재비교 핵심

- 지난 리포트 이후 큰 진전이 있었다.
- 현재는 `filetree`, `TOC`, `link preview`, `global graph page`, `local graph`가 모두 코드에 연결되어 있다.
- 다만 "완전 동일" 기준에서는 고급 콘텐츠 렌더러와 frontmatter 호환, 기본 공개 정책에서 여전히 차이가 남아 있다.

## 지난 리포트 대비 달라진 점

1. 글로벌 그래프 페이지 복구
- `/graph/` 페이지 생성 로직 존재: `blog-core/src/lib.rs:578`
- 템플릿 존재: `blog-core/templates/graph.html:1`
- 전용 검색/리셋/일시정지 UI 존재: `blog-core/templates/graph.html:10`

2. 로컬 그래프 구현
- 노트별 `local-graph/{slug}.json` 생성: `blog-core/src/lib.rs:745`
- BFS 기반 n-hop 선택 로직 존재: `blog-core/src/lib.rs:766`
- 포스트 페이지에서 로컬 그래프 data URL 사용: `blog-core/templates/base.html:507`

3. 링크 Hover Preview 구현
- 프리뷰 스크립트 추가: `static/assets/link-preview.js:1`
- 내부 `/notes/` 링크에 호버 카드 렌더: `static/assets/link-preview.js:45`
- 스타일 추가: `static/assets/style.css:185`

4. TOC 추적 UI 강화
- TOC 항목 추출: `blog-core/src/lib.rs:1138`
- 스크롤 active 추적: `static/assets/toc-tracker.js:1`
- active 스타일 존재: `static/assets/style.css:479`

5. note-level 설정 일부 추가
- `dg-enable-search`, `dg-show-local-graph` 지원: `blog-core/src/lib.rs:95`
- 포스트 렌더 시 `show_search`, `show_graph_module` 반영: `blog-core/src/lib.rs:488`

## 기능 매트릭스 (현재 상태)

### 1) Content Support

| 기능 | 상태 | 근거 |
|---|---|---|
| Basic Markdown / 코드블록 / 테이블 / 체크리스트 / 각주 | 구현 | `blog-core/src/lib.rs:1088` |
| Wikilink | 구현 | `blog-core/src/lib.rs:1047` |
| 이미지 lazy 처리 | 부분 구현 | `blog-core/src/lib.rs:1098` |
| Transclusion(임베드 노트 본문 포함) | 미구현 | 임베드를 링크 텍스트로 변환 (`(embedded)`): `blog-core/src/lib.rs:1068` |
| Dataview / DataviewJS | 미구현 | 관련 파서/렌더 없음 |
| Canvas / Excalidraw / PDF 임베드 | 미구현 | 관련 처리 없음 |
| Callouts / Admonitions | 미구현 | 관련 처리 없음 |
| MathJax | 미구현 | 관련 처리 없음 |
| Mermaid / PlantUML | 미구현 | 관련 처리 없음 |
| Highlight(`==text==`) | 미구현 | 관련 처리 없음 |

### 2) Navigation & Discovery

| 기능 | 상태 | 근거 |
|---|---|---|
| Fast search + live preview | 구현 | `blog-core/templates/base.html:186`, `blog-dev/src/main.rs:90` |
| Filetree navigation | 구현 | `blog-core/templates/base.html:93`, `static/assets/filetree.js:1`, `blog-core/src/lib.rs:626` |
| Backlinks | 구현 (정렬/메타 강화) | `blog-core/src/lib.rs:1174`, `blog-core/src/lib.rs:1217` |
| TOC | 구현 | `blog-core/templates/base.html:121`, `static/assets/toc-tracker.js:1` |
| Link preview on hover | 구현 | `static/assets/link-preview.js:45` |
| Global graph | 구현 | `blog-core/src/lib.rs:578`, `blog-core/templates/graph.html:23` |
| Local graph | 구현 | `blog-core/src/lib.rs:745`, `blog-core/templates/base.html:501` |

### 3) Customization

| 기능 | 상태 | 근거 |
|---|---|---|
| CSS 변수 기반 커스터마이징 | 구현 | `static/assets/style.css:1` |
| 다크/라이트 토글 | 구현 | `blog-core/templates/base.html:30`, `blog-core/templates/base.html:168` |
| UI 문구 커스터마이징 | 미구현 | placeholder/텍스트 하드코딩 (`base.html:78`, `base.html:122`) |
| Note icon | 미구현 | frontmatter/렌더 경로 없음 |
| Obsidian Theme 반영 | 미구현 | 관련 계층 없음 |
| Style Settings plugin 지원 | 미구현 | 관련 계층 없음 |
| Regex custom filters | 미구현 | 관련 파이프라인 없음 |

### 4) Privacy & Control / Frontmatter

현재 지원 키:
- `title`, `description`, `slug`, `date`, `updated`, `tags`, `aliases`, `draft`, `dg-publish`, `dg-home`, `dg-enable-search`, `dg-show-local-graph`
- 근거: `blog-core/src/lib.rs:82`

미지원 핵심 키:
- `dg-path`, `dg-permalink`, `dg-pinned`, `dg-hide`, `dg-hide-in-graph`, `dg-metatags`, `dg-content-classes`, `dg-note-icon` 등

중요 정책 차이:
- DG README는 "`dg-publish: true`인 노트만 게시"를 강조함: `/home/mud/repo/blog_temp/obsidian-digital-garden/README.md:62`
- 현재 코드는 `dg-publish`가 없으면 `draft`가 false일 때 기본 게시됨: `blog-core/src/lib.rs:345`
- 즉, 기본 공개 정책이 DG와 다름.

## 현재 가장 큰 차이 5개

1. 고급 콘텐츠 렌더러 공백
- Dataview/Canvas/Excalidraw/PDF/Callout/Math/Mermaid/PlantUML 미지원

2. frontmatter 호환 범위 부족
- DG에서 자주 쓰는 `dg-path`, `dg-permalink`, `dg-hide*`, `dg-note-icon` 계열 미지원

3. 공개 기본 정책 차이
- DG: opt-in(`dg-publish: true`) 중심
- 현재: 사실상 opt-out(`draft: true` 아니면 게시)

4. 내비 구조의 템플릿 하드코딩 요소
- 상단 내비에 특정 노트 링크 하드코딩 존재: `blog-core/templates/base.html:62`

5. 임베드/트랜스클루전의 동작 차이
- `![[note]]`가 실제 본문 임베드가 아닌 링크 표시로 처리됨: `blog-core/src/lib.rs:1068`

## 결론

지금 상태는 탐색 UX 기준으로는 DG에 매우 근접했다. 특히 글로벌/로컬 그래프와 링크 프리뷰까지 들어오면서 핵심 사용감은 크게 개선됐다.  
남은 차이는 주로 "콘텐츠 확장 렌더링"과 "frontmatter 완전 호환", 그리고 "기본 공개 정책"에 집중되어 있다.
