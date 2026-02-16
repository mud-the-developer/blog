# Digital Garden Front 차이 분석 (최신 재비교)

작성일: 2026-02-17  
대상: `/home/mud/repo/blog`  
비교 기준: `obsidian-digital-garden` 기능 목록 (`/home/mud/repo/blog_temp/obsidian-digital-garden/README.md:24`)

## 요약

이번 수정으로 DG 프론트와의 갭이 다시 줄었습니다. 특히 `dg-*` frontmatter 확장, 그래프 페이지, 로컬 그래프, 링크 프리뷰, TOC 추적, note icon/메타태그/content classes까지 연결된 상태입니다.  
현재 남은 큰 차이는 고급 콘텐츠 렌더링 계층(Dataview/Canvas/Excalidraw/PDF/Callout/Math/Mermaid/PlantUML)과 일부 정책/커스터마이징 영역입니다.

## 이번에 확인된 핵심 반영 사항

1. Graph 기능
- 글로벌 그래프 페이지 렌더: `blog-core/src/lib.rs:661`, `blog-core/templates/graph.html:1`
- 글로벌 그래프 JSON: `blog-core/src/lib.rs:796`
- 로컬 그래프 JSON 생성: `blog-core/src/lib.rs:838`
- 노트 페이지에서 로컬 그래프 data URL 연결: `blog-core/src/lib.rs:580`, `blog-core/templates/base.html:541`

2. Navigation & Discovery
- 파일트리 생성/렌더: `blog-core/src/lib.rs:711`, `blog-core/templates/base.html:96`, `static/assets/filetree.js:1`
- TOC 추출/렌더/active 추적: `blog-core/src/lib.rs:1268`, `blog-core/templates/base.html:127`, `static/assets/toc-tracker.js:1`
- 링크 hover preview: `blog-core/templates/base.html:147`, `static/assets/link-preview.js:1`
- 검색 라이브 프리뷰 + API fallback: `blog-core/templates/base.html:200`, `blog-dev/src/main.rs:90`

3. Frontmatter 확장
- 신규 키 지원: `dg-path`, `dg-permalink`, `dg-pinned`, `dg-hide`, `dg-hide-in-graph`, `dg-note-icon`, `dg-metatags`, `dg-content-classes`, `dg-enable-search`, `dg-show-local-graph`
- 근거: `blog-core/src/lib.rs:85`

4. Note-level UI 반영
- note icon 렌더: `blog-core/templates/base.html:100`, `blog-core/templates/post.html:6`, `blog-core/templates/index.html:24`
- 메타태그 주입: `blog-core/templates/base.html:30`, `blog-core/src/lib.rs:1957`
- content classes 주입: `blog-core/templates/post.html:4`, `blog-core/src/lib.rs:593`
- highlight 문법(`==text==`) 처리: `blog-core/src/lib.rs:1186`, `blog-core/src/lib.rs:1204`

5. Discovery 제어
- `dg-hide`는 index/tag/filetree/search/backlinks/page-tabs에서 숨김 처리됨
  - index: `blog-core/src/lib.rs:545`
  - tag: `blog-core/src/lib.rs:611`
  - search-index: `blog-core/src/lib.rs:697`
  - filetree: `blog-core/src/lib.rs:721`
  - page-tabs: `blog-core/src/lib.rs:1476`
- `dg-hide-in-graph`는 global/local graph에서 제외
  - global: `blog-core/src/lib.rs:809`
  - local: `blog-core/src/lib.rs:867`

## DG 기준 대비 현재 차이 (남은 갭)

### 1) Content Support

미구현 또는 부분 구현:
- Dataview / DataviewJS
- Canvas
- Excalidraw embed/transclusion
- Embedded PDF
- Callouts/Admonitions
- MathJax
- Mermaid
- PlantUML
- 실제 note transclusion (`![[note]]` 본문 삽입)

근거:
- `![[...]]`는 현재 링크 문자열 처리(`(embedded)`) 수준: `blog-core/src/lib.rs:1166`
- 관련 전용 파서/렌더 함수 없음 (`blog-core/src/lib.rs` 전체 기준)

### 2) Customization

미구현 또는 제한적:
- Obsidian Theme 반영
- Style Settings plugin 호환
- Regex custom filters
- UI 텍스트 커스터마이징(placeholder/라벨 외부화)

근거:
- 텍스트 하드코딩 예: `blog-core/templates/base.html:78`, `blog-core/templates/base.html:128`

### 3) 정책 차이 (중요)

DG 문서의 핵심 메시지는 "`dg-publish: true`만 게시"인데, 현재 코드는 기본적으로 `draft != true`이면 게시됩니다.

- 현재 publish 조건: `dg_publish.unwrap_or(!draft)`
- 근거: `blog-core/src/lib.rs:387`
- DG 기준 설명: `/home/mud/repo/blog_temp/obsidian-digital-garden/README.md:62`

즉, 기본 공개 정책은 아직 DG와 완전 동일하지 않습니다.

### 4) `dg-enable-search` 동작 범위

현재 구현은 note 페이지에서 검색 UI 표시 토글에는 반영되지만, 검색 인덱스 제외 정책으로는 쓰이지 않습니다.

- UI 토글 반영: `blog-core/src/lib.rs:578`, `blog-core/templates/base.html:75`
- search-index 생성은 `hidden`만 필터: `blog-core/src/lib.rs:697`

## 결론

현재 상태는 DG 프론트의 탐색/그래프/메타 제어 측면에서 상당히 근접했습니다.  
남은 실질적 차이는 고급 콘텐츠 렌더링 계층과 일부 정책(기본 publish 동작), 그리고 테마/플러그인 연동형 커스터마이징입니다.
