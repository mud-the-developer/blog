# Digital Garden Front 차이 분석 (재재비교)

작성일: 2026-02-17  
대상 프로젝트: `/home/mud/repo/blog`  
비교 기준: `obsidian-digital-garden` 기능 선언 (`/home/mud/repo/blog_temp/obsidian-digital-garden/README.md:24`)

## 핵심 결론

- 현재 `blog`는 이전보다 많이 따라왔고, 특히 **파일트리**, **TOC**, **링크 hover preview**, **로컬 그래프**, **글로벌 그래프 페이지**가 들어왔다.
- 하지만 "완전 동일" 기준으로는 여전히 큰 갭이 남아 있다: **고급 렌더러 계층, note-level frontmatter 제어**.
- 따라서 현재 상태는 "Digital Garden 스타일 구현"에 가깝고, "Digital Garden 프론트 패리티"는 아직 미완료다.

## 지난 리포트 대비 변경점 (이번 재비교에서 새로 확인)

### 개선된 점

1. 파일트리 데이터 생성 및 렌더링 추가
- `filetree.json` 생성: `blog-core/src/lib.rs:296`, `blog-core/src/lib.rs:548`
- 파일트리 UI 초기화: `blog-core/templates/base.html:446`
- 파일트리 스크립트: `static/assets/filetree.js:1`

2. TOC(목차) 추출 + 현재 섹션 추적 추가
- TOC 추출: `blog-core/src/lib.rs:918`
- 포스트 레이아웃에 TOC 주입: `blog-core/src/lib.rs:464`, `blog-core/src/lib.rs:1053`
- TOC 패널 렌더: `blog-core/templates/base.html:111`
- 스크롤 기반 활성 섹션 추적: `static/assets/toc-tracker.js:1`, `blog-core/templates/base.html:453`

3. 링크 hover preview 추가
- 내부 노트 링크 미리보기 카드: `static/assets/link-preview.js:1`
- 레이아웃/스타일: `static/assets/style.css:185`
- 템플릿 초기화 연결: `blog-core/templates/base.html:453`

4. 로컬 그래프 추가 (note 기준 2-hop)
- 노트별 그래프 데이터 생성: `blog-core/src/lib.rs:702`
- 산출물 경로: `dist/local-graph/{slug}.json`
- 노트 페이지 우측 그래프 연결: `blog-core/templates/base.html:469`

5. 글로벌 그래프 페이지 복원 + 상호작용 강화
- 글로벌 그래프 전용 페이지 생성: `blog-core/src/lib.rs:558`, `blog-core/templates/graph.html:1`
- `/graph/` 출력 경로: `dist/graph/index.html`
- 검색 Enter 포커스/뷰포트 이동: `static/assets/graph-view.js:589`

6. 백링크 UX 개선
- 정렬 기준(최신순) 적용: `blog-core/src/lib.rs:1173`
- empty 상태/미리보기/날짜 표시: `blog-core/src/lib.rs:1127`, `static/assets/style.css:568`

7. 검색 접근성/상호작용 강화 유지
- 검색 API + fallback + 키보드 탐색은 유지: `blog-core/templates/base.html:287`, `blog-dev/src/main.rs:90`

8. Note-level sidebar 토글 일부 지원
- `dg-enable-search`, `dg-show-local-graph` 지원: `blog-core/src/lib.rs:88`, `blog-core/templates/base.html:71`

### 여전히 미구현/부족

- 고급 콘텐츠 렌더러군 부재(아래 상세 표 참조)
- frontmatter 확장 키 다수 미지원

## 기능 매트릭스 (DG 기준 대비)

### 1) Content Support

| 항목 | 상태 | 근거 |
|---|---|---|
| Basic Markdown | 구현 | `blog-core/src/lib.rs:870` 근처 markdown 파이프라인 |
| Wiki link | 구현 | `blog-core/src/lib.rs:684` |
| Code blocks / Footnotes / Tasklist / Tables | 구현 | `blog-core/src/lib.rs:876`~`879` |
| 이미지 lazy 처리 | 부분 구현 | `blog-core/src/lib.rs:885` |
| 노트 Transclusion | 미구현(임베드도 링크화) | `blog-core/src/lib.rs:705` |
| Callouts/Admonitions | 미구현 | 관련 파서/렌더 없음 |
| MathJax | 미구현 | 관련 처리 없음 |
| Mermaid / PlantUML | 미구현 | 관련 처리 없음 |
| Dataview / DataviewJS | 미구현 | 관련 처리 없음 |
| Canvas / Excalidraw / PDF embed | 미구현 | 관련 처리 없음 |

### 2) Navigation & Discovery

| 항목 | 상태 | 근거 |
|---|---|---|
| Fast search + live preview | 구현 | `base.html:287`, `blog-dev/src/main.rs:90` |
| Filetree navigation | 구현(신규) | `base.html:87`, `base.html:446`, `filetree.js:1` |
| Backlinks | 구현(개선) | `blog-core/src/lib.rs:1127` |
| TOC | 구현(신규) | `blog-core/src/lib.rs:918`, `base.html:111` |
| Global graph data (`graph.json`) | 구현 | `blog-core/src/lib.rs:630` |
| Global graph 전용 페이지(`/graph`) | 구현(신규) | `blog-core/src/lib.rs:558`, `graph.html:1` |
| Local graph | 구현(신규) | `blog-core/src/lib.rs:702`, `base.html:469` |
| Link hover preview | 구현(신규) | `base.html:453`, `static/assets/link-preview.js:1` |

### 3) Customization

| 항목 | 상태 | 근거 |
|---|---|---|
| CSS 변수 기반 테마 | 구현 | `static/assets/style.css:1` |
| 다크모드 토글/저장 | 구현 | `base.html:33`, `base.html:156` |
| UI 텍스트 사용자 설정 | 미구현 | placeholder/문구 하드코딩 (`base.html:76`, `base.html:113`) |
| Note icon | 미구현 | 템플릿/메타 반영 없음 |
| Created/Updated 상세 노출 제어 | 부분 구현 | 데이터는 있으나 UI는 최소(`post.html:7`) |
| Obsidian Theme / Style Settings plugin 호환 | 미구현 | 관련 계층 없음 |
| Regex custom filters | 미구현 | 관련 파이프라인 없음 |

### 4) Frontmatter 호환

현재 지원 키:
- `title`, `description`, `slug`, `date`, `updated`, `tags`, `aliases`, `draft`, `dg-publish`, `dg-home`, `dg-enable-search`, `dg-show-local-graph`
- 근거: `blog-core/src/lib.rs:82`

미지원/갭 키 (DG 패리티 핵심):
- `dg-path`, `dg-permalink`
- `dg-pinned`, `dg-hide`, `dg-hide-in-graph`
- `dg-note-icon`, `dg-content-classes`, `dg-metatags`
- 나머지 note-level UI override

## 구조/UX 관점 차이

1. 좌측 패널
- 기존 "페이지 탭"에서 실제 파일트리 렌더로 진화했지만, DG와 동일한 모든 탐색/정렬 규칙까지는 아직 아님.
- 근거: `base.html:87`, `filetree.js:39`

2. 우측 패널
- 그래프 프리뷰 + TOC는 존재하고, 노트 페이지는 local graph로 전환된다.
- 근거: `base.html:101`, `base.html:111`, `base.html:469`

3. 그래프
- 인터랙션(줌/팬/드래그)은 강함.
- `/graph` 전용 페이지가 복원되었고 검색/포커스 연동이 가능하다.
- 근거: `static/assets/graph-view.js:1`, `blog-core/templates/graph.html:1`

4. 헤더/내비
- 현재 상단 내비에 특정 노트 링크가 하드코딩(`Jinhyuk Kim`)되어 있어, 템플릿 일반화 관점에서 DG 기본 구조와 차이.
- 근거: `base.html:62`

## 우선순위 제안 (차이 축소용)

1. frontmatter 확장 (`dg-path`, `dg-permalink`, `dg-hide*`, `dg-note-icon`, note override)
2. 고급 렌더러 추가 (callout/math/mermaid/plantuml/transclusion/PDF)

## 결론

이번 재재비교 기준으로 `blog`는 이전 대비 확실히 진전됐고, 특히 탐색 UX에서 파일트리/TOC/링크 프리뷰/로컬·글로벌 그래프가 추가된 점이 크다. 다만 Digital Garden 프론트와 "완전 동일"을 목표로 보면 핵심 잔여 작업은 아직 분명하며, 특히 frontmatter 확장과 고급 렌더러 계층이 다음 병목이다.
