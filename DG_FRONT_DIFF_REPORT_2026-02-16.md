# Digital Garden Front 차이 분석 (재비교)

작성일: 2026-02-16  
대상 프로젝트: `/home/mud/repo/blog`  
비교 기준: `/home/mud/repo/blog_temp/obsidian-digital-garden/README.md`의 기능 목록 + 현재 구현 코드

> 업데이트 메모 (2026-02-16): 이 리포트 작성 이후 `filetree.json` + 좌측 파일트리 UI, 우측 TOC 패널(기본)이 구현되었으므로,
> 현재 진행 기준에서는 Navigation 갭에서 `Filetree navigation`은 완료, `TOC`는 부분 완료로 본다.

## 요약

- 현재 `blog`는 **기본 렌더링, 위키링크, 백링크, 태그, 사이드 그래프, 검색 드롭다운**까지는 구현됨.
- 하지만 Digital Garden 프론트 기준으로는 **파일트리, 로컬 그래프, 글로벌 그래프 전용 페이지, TOC, 링크 hover preview, 고급 렌더러, note별 UI 제어 frontmatter**가 비어 있음.
- 지난 점검 대비 개선점: **검색 UX/API가 강화됨**.
- 지난 점검 대비 주의점: 현재 코드 기준으로는 **`/graph` 전용 페이지가 제거된 상태**.

## 비교 기준과 한계

- 이 문서는 `obsidian-digital-garden` 플러그인 README의 공개 기능 약속을 기준으로 비교함.
- 실제 사이트 템플릿의 최종 기준은 `oleeskild/digitalgarden` 레포이므로, 픽셀 단위 완전 동일화는 추가 비교가 필요함.

## 근거 코드 (현재 구현)

- Frontmatter 지원 키: `blog-core/src/lib.rs:77`
- 빌드 산출물(검색/그래프/sitemap/rss): `blog-core/src/lib.rs:245`
- 위키링크 변환/마크다운 옵션/백링크 렌더: `blog-core/src/lib.rs:684`
- 레이아웃(검색/페이지탭/사이드그래프): `blog-core/templates/base.html:54`
- 검색 UI 동작 + API fallback: `blog-core/templates/base.html:155`
- 프리뷰 서버 검색 API: `blog-dev/src/main.rs:89`
- 스타일 토큰/검색 스타일/3열 레이아웃: `static/assets/style.css:1`
- DG 기능 기준 목록: `blog_temp/obsidian-digital-garden/README.md:24`

## 1) Content Support 차이

| 기능 | Digital Garden 기준 | 현재 상태 | 근거 |
|---|---|---|---|
| Basic Markdown | 지원 | 지원 | `blog-core/src/lib.rs:724` |
| Note 링크 | 지원 | 지원 (`[[...]]`) | `blog-core/src/lib.rs:684` |
| Code Blocks | 지원 | 지원 | `blog-core/src/lib.rs:724` |
| Footnotes | 지원 | 지원 | `blog-core/src/lib.rs:729` |
| Embedded Images | 지원 | 부분 지원 (일반 이미지 + lazy) | `blog-core/src/lib.rs:735` |
| Transclusion(노트 임베드) | 지원 | 미지원 (임베드도 링크 치환) | `blog-core/src/lib.rs:705` |
| Dataview/dataviewjs | 지원 | 미지원 | 미구현 |
| Canvas | 지원 | 미지원 | 미구현 |
| Excalidraw 임베드 | 지원 | 미지원 | 미구현 |
| PDF 임베드 | 지원 | 미지원 | 미구현 |
| Callouts/Admonitions | 지원 | 미지원 | 미구현 |
| MathJax | 지원 | 미지원 | 미구현 |
| Highlight (`==text==`) | 지원 | 미지원 | 미구현 |
| Mermaid | 지원 | 미지원 | 미구현 |
| PlantUML | 지원 | 미지원 | 미구현 |

## 2) Navigation & Discovery 차이

| 기능 | Digital Garden 기준 | 현재 상태 | 근거 |
|---|---|---|---|
| Fast search + live preview | 지원 | 지원 (API + fallback + 키보드 탐색) | `base.html:155`, `blog-dev/src/main.rs:89` |
| Filetree navigation | 지원 | 미지원 (현재는 페이지 탭 목록) | `base.html:74` |
| Backlinks | 지원 | 지원 | `blog-core/src/lib.rs:775` |
| Local graph | 지원 | 미지원 | 미구현 |
| Global graph page | 지원 | 미지원 (`graph.json`만 존재, 페이지 없음) | `blog-core/src/lib.rs:249`, `blog-core/src/lib.rs:1644` |
| TOC | 지원 | 미지원 | 미구현 |
| Link hover preview | 지원 | 미지원 | 미구현 |

## 3) Customization 차이

| 기능 | Digital Garden 기준 | 현재 상태 | 근거 |
|---|---|---|---|
| CSS variables 커스터마이징 | 지원 | 지원 | `static/assets/style.css:1` |
| Obsidian Theme 반영 | 지원 | 미지원 | 미구현 |
| Style Settings plugin 지원 | 지원 | 미지원 | 미구현 |
| Custom regex filters | 지원 | 미지원 | 미구현 |
| Note icon | 지원 | 미지원 | 미구현 |
| Created/Updated timestamps | 지원 | 부분 지원 (데이터는 있으나 UI 표시는 제한적) | `blog-core/src/lib.rs:82`, `post.html:6` |
| UI 텍스트 커스터마이징 | 지원 | 미지원 (문구 하드코딩) | `base.html:62`, `base.html:287` |

## 4) Frontmatter 호환 차이

### 현재 지원

- `title`, `description`, `slug`, `date`, `updated`, `tags`, `aliases`, `draft`, `dg-publish`, `dg-home`
- 근거: `blog-core/src/lib.rs:77`

### 미지원/부족 (DG 프론트 패리티 핵심)

- `dg-path`
- `dg-permalink`
- `dg-pinned`
- `dg-hide`
- `dg-hide-in-graph`
- `dg-metatags`
- `dg-content-classes`
- `dg-note-icon`
- `dg-enable-search`
- `dg-show-local-graph`
- 기타 note별 UI override

## 5) 구조/레이아웃 차이

- 현재 레이아웃은 3열(`페이지 탭 + 본문 + 그래프`) 구조이며, 좌측이 **파일트리**가 아니라 **전체 페이지 탭**임.
  - 근거: `base.html:73`, `base.html:74`
- 우측은 사이드 그래프만 있고 상세 그래프 페이지로 이동하는 기본 UX가 없음.
  - 근거: `base.html:93`, `blog-core/src/lib.rs:1644`
- 검색은 헤더 드롭다운형으로 구현되어 있으나, DG 기준의 전체 탐색 UX(파일트리/TOC/링크 미리보기)와 결합되지는 않음.
  - 근거: `base.html:155`

## 6) 이번 재비교에서 확인된 변화

### 개선됨

- 검색이 단순 정적 인덱스 소비를 넘어, `/api/search` + 클라이언트 fallback + 하이라이트/키보드 탐색까지 확장됨.
  - 근거: `blog-dev/src/main.rs:89`, `base.html:267`, `base.html:364`

### 여전히 큰 갭

- 콘텐츠 확장 렌더러(콜아웃/수식/다이어그램/임베드 계열) 공백.
- 파일트리/TOC/로컬그래프/링크 hover preview 공백.
- note별 frontmatter UI 제어 공백.

### 주의할 점

- 코드/테스트 기준으로는 `graph/index.html` 생성이 비활성 상태임.
  - 근거: `blog-core/src/lib.rs:1644`

## 7) 우선순위 갭 (Front 패리티 기준)

1. **탐색 4종 복구**: 파일트리, TOC, 링크 hover preview, 로컬 그래프
2. **글로벌 그래프 페이지 복원**: `/graph/` 전용 화면 + 상호작용
3. **frontmatter 확장**: `dg-path`, `dg-permalink`, `dg-hide*`, `dg-note-icon`, note별 override
4. **콘텐츠 렌더러 확장**: callout/math/mermaid/plantuml/transclusion/PDF
5. **UI 커스터마이징 레이어**: 문자열/토큰/노트별 표시 정책

## 8) 결론

현재 상태는 "Digital Garden 스타일의 정적 노트 블로그"로는 충분히 동작하지만, "Digital Garden 프론트와 완전 동일" 기준에서는 핵심 탐색 UX와 확장 렌더링, frontmatter 제어 계층이 아직 많이 부족하다.
