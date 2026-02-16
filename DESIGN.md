# Hoshinoai - Rust Digital Garden 설계

내 Markdown 문서를 기반으로, `axum` + `maud` + `askama` 조합으로 Obsidian Digital Garden 수준의 기능을 제공하는 블로그/가든 시스템.

## 1. 최상위 요구사항

- 콘텐츠 소스는 로컬 Markdown(`.md`) 파일
- 백엔드는 `axum`
- Markdown -> HTML 변환/조합은 `maud` 중심 파이프라인
- 페이지 레이아웃/프론트 템플릿은 `askama`
- 배포는 Cloudflare 기반
- 기능 범위는 `obsidian-digital-garden`의 핵심 기능군 전체를 유지

기능 기준 소스(2026-02-15 확인):
- https://github.com/oleeskild/obsidian-digital-garden
- https://dg-docs.ole.dev/features/
- https://dg-docs.ole.dev/getting-started/03-note-settings/
- https://dg-docs.ole.dev/advanced/note-specific-settings/

## 2. 역할 분리 (충돌 방지)

### `axum` (Backend)

- 라우팅, 상태 관리, API, SSR 응답
- 캐시/동기화/검색 인덱스 오케스트레이션

### `maud` (HTML 조합 엔진)

- Markdown 파서 자체가 아니라 HTML 조합 레이어
- 파싱 결과(본문, 링크, 임베드, callout 등)를 구조화해 HTML 생성
- 재사용 가능한 본문 컴포넌트(TOC, backlinks, graph panel) 출력

### `askama` (Frontend 템플릿)

- 공통 레이아웃(base), 페이지 셸(index/note/tag/search)
- `maud`가 만든 안전한 본문 HTML을 페이지에 삽입

즉, "Markdown 파싱 -> 구조화 -> maud HTML 조합 -> askama 페이지 렌더" 순서로 처리한다.

## 3. 전체 아키텍처

```text
Markdown Vault
  -> Content Loader
  -> Frontmatter/Metadata Parser
  -> Obsidian Syntax Parser
  -> Render Pipeline (Markdown + Extensions)
  -> Sanitizer
  -> maud Component Builder
  -> askama Page Renderer
  -> axum Response + Cache Headers
  -> Cloudflare Edge Cache
```

## 4. 기능 패리티 매트릭스

아래는 `obsidian-digital-garden` 기준 기능군과 Hoshinoai 구현 목표.

### 4.1 Content Support

- Basic Markdown
- Wikilinks (`[[note]]`, `[[note#header]]`, `[[note#^block]]`, alias text)
- Code blocks / inline code
- Callouts/Admonitions (중첩/접힘 포함)
- MathJax/LaTeX
- Highlighted text (`==text==`)
- Footnotes
- Checkboxes
- Mermaid
- PlantUML
- Embedded/Transcluded notes
- Embedded images
- Embedded PDFs
- Excalidraw embed/transclusion
- Canvas publish
- Dataview blocks/inline/dataviewjs 호환 레이어

### 4.2 Navigation & Discovery

- Backlinks
- Local graph
- Global graph
- Filetree navigation
- Table of contents
- Link hover preview
- Global search + live preview

### 4.3 Customization & Control

- Obsidian theme 반영 경로
- Style settings 대응
- CSS variable 기반 커스터마이징
- Note icon
- Created/updated timestamp
- UI text 커스터마이징
- Regex custom filters

### 4.4 Publishing & SEO

- 선택적 게시(`dg-publish: true`)
- 홈 노트(`dg-home: true`)
- `dg-hide`, `dg-hide-in-graph`는 발견성 제어이며 접근 제어가 아님
- 비공개 초안은 반드시 `dg-publish: false` 사용
- Sitemap (`/sitemap.xml`)
- Feed (`/feed.xml`)

## 5. Frontmatter 호환 규칙

`obsidian-digital-garden`과 최대 호환을 위해 다음 키를 1차 지원 대상으로 둔다.

- `dg-publish`
- `dg-home`
- `title`
- `dg-permalink`
- `dg-path`
- `dg-pinned`
- `dg-hide`
- `dg-hide-in-graph`
- `dg-metatags`
- `dg-content-classes`
- `dg-note-icon`
- note setting override 예: `dg-enable-search`, `dg-show-local-graph`

주의:
- 미지원 키는 무시하지 말고 로그/리포트로 노출해 마이그레이션 가시성을 확보
- "모든 frontmatter 전달" 옵션은 보안/안정성 모드와 분리

### 5.1 Slug/URL 결정 규칙

- slug 결정 우선순위: `slug` > `dg-path` > `dg-permalink` > 파일 상대경로
- 정규화 규칙: 양끝 `/` 제거, 경로 segment 유지, 공백은 `-`로 변환
- canonical 노트 경로는 `/notes/{slug}` 로 고정

## 6. 렌더링/파싱 상세

### 6.1 파이프라인

1. 파일 스캔 및 frontmatter 분리
2. 게시 대상 필터(`dg-publish`)
3. Obsidian 확장 토큰화(Wikilink, embed, callout, tag)
4. Markdown 본문 렌더
5. 확장 기능 후처리(links, transclusion, toc, backlinks)
6. HTML sanitize
7. `maud`로 본문 컴포넌트 조립
8. `askama` 페이지 렌더

### 6.2 난이도 높은 기능 전략

- Dataview: 초기엔 query subset(`list/table from ...`) + inline 지원, `dataviewjs`는 sandbox 실행기(후속)
- Canvas/Excalidraw/PDF: 파일 타입별 렌더 어댑터 분리
- PlantUML/Mermaid: 렌더러를 추상화해 서버/클라이언트 전략 교체 가능

## 7. 라우트 설계

- `GET /` 홈
- `GET /notes/:slug` 노트
- `GET /tags` 태그 목록
- `GET /tags/:tag` 태그 상세
- `GET /search?q=` 검색
- `GET /graph` 글로벌 그래프 페이지
- `GET /api/graph/global`
- `GET /api/graph/local/:slug`
- `GET /sitemap.xml`
- `GET /feed.xml`
- `GET /health`
- `GET /assets/*`
- `GET /static/*`

## 8. 데이터 모델(요약)

```rust
pub struct Note {
    pub slug: String,
    pub title: String,
    pub markdown: String,
    pub html: String,
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    pub outlinks: Vec<String>,
    pub backlinks: Vec<String>,
    pub is_published: bool,
    pub is_home: bool,
    pub frontmatter: serde_json::Value,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub struct GardenSettings {
    pub enable_search: bool,
    pub show_local_graph: bool,
    pub show_global_graph: bool,
    pub show_backlinks: bool,
    pub show_toc: bool,
    pub show_filetree: bool,
    pub show_link_preview: bool,
}
```

## 9. Cloudflare 배포 아키텍처

### 권장안 A: Cloudflare + Axum Origin

```text
Client
  -> Cloudflare (DNS/TLS/WAF/CDN)
  -> Axum Origin (Fly/Railway/VM)
```

적합 이유:
- Axum 서버 기능(검색/그래프/API) 유지가 쉬움
- Digital Garden 풀기능 유지 시 운영 단순

### 대안 B: Cloudflare Pages + 정적 빌드

- 콘텐츠를 빌드 시점에 정적 HTML로 생성
- 동적 기능은 축소 또는 Worker API 추가 필요

## 10. 캐시/무효화 전략

- HTML: 짧은 edge cache (`s-maxage`) + `stale-while-revalidate`
- 정적 리소스: fingerprint + 장기 캐시
- 노트 변경 시 purge by tag(예: `note:{slug}`)
- 검색/그래프 API는 짧은 TTL 또는 bypass

## 11. 보안 기본선

- sanitize 되지 않은 HTML은 절대 `safe` 출력 금지
- 경로 탐색(`..`) 차단
- webhook/관리 API는 서명 검증
- rate limiting + request size 제한
- Cloudflare WAF 기본 룰 활성화

## 12. 구현 단계 (기능 전체 유지 전제)

1. 콘텐츠/파서/기본 노트 렌더
2. 링크/백링크/태그/TOC
3. 파일트리/검색/링크 프리뷰
4. 로컬/글로벌 그래프
5. 고급 포맷(mermaid/plantuml/excalidraw/canvas/dataview)
6. 테마/스타일/아이콘/메타태그
7. sitemap/feed/Cloudflare 최적화

## 13. 핵심 의사결정 포인트

- DataviewJS를 어디까지 호환할지(완전 실행 vs 제한 실행)
- PlantUML 렌더를 서버에서 할지 클라이언트에서 할지
- 슬러그 정책(ASCII slugify vs 원문 유지) 기본값
- Cloudflare A안(권장) 확정 여부
