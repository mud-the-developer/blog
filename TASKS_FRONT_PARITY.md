# `blog/` Digital Garden Front 완전 동일화 Task 정리

## 목표

`blog/`를 Obsidian Digital Garden의 프론트(UI/UX/동작)와 최대한 동일하게 맞춘다.
기준은 "비슷함"이 아니라 "페이지 구조, 컴포넌트 동작, 스타일, 반응형, 기능 토글까지 동일"이다.

## 먼저 알아둘 점

- `obsidian-digital-garden`는 플러그인 저장소다.
- 실제 사이트 프론트 템플릿 기준은 `oleeskild/digitalgarden` 저장소다.
- "완전 동일" 목표면 기준 템플릿 commit hash를 고정해야 작업이 흔들리지 않는다.

## 현재 `blog/` 상태 요약 (코드 기준)

- 이미 있음: 기본 레이아웃/노트/태그, 다크모드 토글, 우측 고정 그래프(노드 라벨/zoom/pan), 백링크, 검색 인덱스 JSON 생성, 검색 API(`blog-dev`) + 라이브 검색 UI.
- 부족함: 파일트리, TOC, 링크 hover preview, 로컬 그래프, Note별 frontmatter UI 토글, 고급 렌더링 패리티(콜아웃/임베드/Dataview 등), 시각 회귀 자동화.
- 핵심 수정 파일:
  - `blog-core/src/lib.rs`
  - `blog-core/templates/base.html`
  - `blog-core/templates/index.html`
  - `blog-core/templates/post.html`
  - `blog-core/templates/tag.html`
  - `static/assets/style.css`
  - `static/assets/graph-view.js`
  - `blog-dev/src/main.rs`

## 성능 우선 원칙

- [x] 렌더 경량화: 그래프 유휴 시 시뮬레이션 자동 정지(auto-freeze) + 탭 비활성화 시 렌더 루프 중단.
- [x] 검색 비용 절감: 입력 debounce + API 실패 시 정적 인덱스 폴백(`search-index.json`).
- [ ] JS/CSS 번들 용량 예산 수치화(`P6-04`) 및 CI 경고 추가.
- [ ] 시각 패리티 작업 시 layout shift 최소화(이미지/임베드에 고정 크기 정책) 적용.

## Phase 0. 기준 고정/갭 분석

작업 파일: `TASKS.md` 또는 이 문서 유지

- [ ] `P0-01` 기준 템플릿 저장소와 commit hash 확정.
- [ ] `P0-02` 비교 대상 페이지 목록 확정: 홈, 노트 상세, 태그, 검색, 글로벌 그래프, 404.
- [ ] `P0-03` 기준 템플릿 CSS 변수/폰트/색상/간격 토큰 표 작성.
- [ ] `P0-04` 기준 템플릿 DOM 구조 스냅샷(섹션/클래스 단위) 작성.
- [ ] `P0-05` 기능 패리티 매트릭스 작성: 파일트리/검색/TOC/링크미리보기/로컬그래프/백링크.
- [ ] `P0-06` frontmatter 패리티 매트릭스 작성: `dg-*` 키별 지원/미지원/대체정책.
- [ ] `P0-07` 테스트용 노트 세트 확정: `obsidian-digital-garden/src/dg-testVault` 기반 샘플.
- [ ] `P0-08` 완료 정의(Definition of Done) 수치화: 시각 diff, 기능 체크, 성능, 접근성.

완료 기준:

1. 기준 템플릿 버전이 문서에 명시된다.
2. "무엇을 같게 만들지" 범위가 페이지/컴포넌트 단위로 고정된다.
3. 이후 작업이 체크리스트로 검증 가능하다.

## Phase 1. 레이아웃/스타일 골격 패리티

작업 파일: `blog-core/templates/base.html`, `static/assets/style.css`

- [ ] `P1-01` 전체 페이지 셸 구조를 기준 템플릿과 동일한 영역 분할로 재구성.
- [ ] `P1-02` 타이포그래피 체계 동일화: 폰트 패밀리, base line-height, 헤딩 스케일, 코드 폰트.
- [ ] `P1-03` 색상 시스템 동일화: 라이트/다크 토큰과 상태색(active/hover/muted).
- [ ] `P1-04` 간격/반경/테두리 스케일 토큰화(컴포넌트별 하드코딩 제거).
- [ ] `P1-05` 헤더/네비게이션 요소 순서, 라벨, 상호작용 동일화.
- [ ] `P1-06` 좌측 사이드바(파일트리 자리)와 우측 사이드바(그래프/백링크/TOC 자리) 구조 고정.
- [ ] `P1-07` 모바일/태블릿 브레이크포인트 기준값과 접힘 동작 동일화.
- [~] `P1-08` 다크모드 초기 결정 로직과 토글 UX 동일화.
- [~] `P1-09` 포커스 링/키보드 탭 순서/hover state 스타일 정합성 맞춤.
- [ ] `P1-10` 공통 컴포넌트 클래스 네이밍 정리.

완료 기준:

1. 주요 페이지를 비교했을 때 레이아웃 구조가 동일하다.
2. viewport 3종(모바일/태블릿/데스크톱)에서 깨짐이 없다.
3. 라이트/다크 전환 시 대비와 계층이 기준과 유사하다.

## Phase 2. 페이지별 UI 패리티

작업 파일: `blog-core/templates/index.html`, `blog-core/templates/post.html`, `blog-core/templates/tag.html`, `blog-core/templates/graph.html`, `static/assets/style.css`

- [ ] `P2-01` 홈 카드/리스트 정렬, 메타정보 위치, 태그 배지 스타일 동일화.
- [ ] `P2-02` 노트 상세 헤더 구성 동일화: 제목/날짜/수정일/태그/아이콘 위치.
- [ ] `P2-03` 본문 컨테이너 폭, 문단 간격, 코드블록/표/인용구 스타일 미세조정.
- [ ] `P2-04` 태그 목록/태그 상세 페이지 UI를 동일한 정보 밀도로 맞춤.
- [ ] `P2-05` 그래프 전용 페이지 또는 동등한 전역 그래프 뷰 구조 패리티 확정 후 적용.
- [ ] `P2-06` 404/미발행 노트/빈 상태 UI 패리티 추가.
- [ ] `P2-07` 페이지별 메타태그 출력 구조(OG/Twitter/canonical) 점검.
- [ ] `P2-08` 페이지 전환 시 active 상태 표시 정합성 맞춤.
- [ ] `P2-09` 긴 제목/긴 태그/긴 경로에서 줄바꿈 및 overflow 처리.
- [ ] `P2-10` 한국어/영문 혼용 텍스트 렌더링(자간, 줄바꿈) 확인.

완료 기준:

1. 홈/노트/태그/그래프/에러 페이지 시각 구조가 기준과 일치한다.
2. 긴 콘텐츠 케이스에서도 UI 붕괴가 없다.
3. 공통 컴포넌트가 페이지마다 일관된 동작을 한다.

## Phase 3. 탐색 기능 패리티 (프론트 핵심)

작업 파일: `blog-core/src/lib.rs`, `blog-core/templates/base.html`, `blog-core/templates/post.html`, `static/assets/search.js`(신규), `static/assets/filetree.js`(신규), `static/assets/graph-view.js`, `static/assets/style.css`

- [ ] `P3-01` 파일트리 데이터 생성기 구현: 노트 경로 기반 트리 JSON 출력.
- [ ] `P3-02` 파일트리 UI 구현: 폴더 펼침/접힘, 현재 노트 강조, 스크롤 위치 유지.
- [x] `P3-03` 검색 UI 구현: 검색 입력, 결과 목록, 키보드 탐색(↑↓ Enter Esc).
- [x] `P3-04` 검색 라이브 프리뷰 구현: 제목/요약/태그 하이라이트.
- [ ] `P3-05` TOC 생성 및 우측 패널 표시: 헤딩 계층/현재 섹션 추적.
- [ ] `P3-06` 링크 hover preview 구현: 내부 링크 카드 미리보기.
- [ ] `P3-07` 로컬 그래프 데이터 생성: 현재 노트 주변 n-hop 관계.
- [ ] `P3-08` 로컬 그래프 위젯 구현: 노트 페이지 우측 패널 연결.
- [~] `P3-09` 글로벌 그래프 상호작용 정교화: 포커스/필터/검색 연동.
- [ ] `P3-10` 백링크 섹션 UX 개선: 정렬 기준/미리보기/빈 상태 처리.
- [ ] `P3-11` 사이드바 모듈 표시/숨김을 설정값과 frontmatter로 제어.
- [~] `P3-12` JS 실패 시 폴백 UI 제공(no-JS 최소 동작 보장).

완료 기준:

1. 파일트리/검색/TOC/로컬그래프/글로벌그래프/백링크가 모두 동작한다.
2. 키보드 중심 사용자도 탐색 가능하다.
3. 동작 실패 케이스에서 빈 화면이 아닌 안내가 나온다.

## Phase 4. 콘텐츠 렌더링 패리티 (프론트 체감 큰 부분)

작업 파일: `blog-core/src/lib.rs`, `static/assets/style.css`, 필요시 `static/assets/*.js` 신규

- [ ] `P4-01` Callout/Admonition 파싱 및 스타일 패리티.
- [ ] `P4-02` 하이라이트 문법(`==text==`) 스타일 적용.
- [ ] `P4-03` 각주/체크박스 렌더링 스타일 정합성 개선.
- [ ] `P4-04` 수식(MathJax/KaTeX) 렌더 경로 확정 및 적용.
- [ ] `P4-05` Mermaid 렌더 경로 확정 및 테마 동기화.
- [ ] `P4-06` PlantUML 렌더 전략 확정(서버/클라이언트) 및 구현.
- [ ] `P4-07` 노트 임베드/트랜스클루전 렌더링 구현.
- [ ] `P4-08` 이미지 임베드(alt/caption/size 클래스) 패리티.
- [ ] `P4-09` PDF 임베드 UI/로딩/fallback 구현.
- [ ] `P4-10` Excalidraw 임베드/트랜스클루전 지원.
- [ ] `P4-11` Canvas 게시 뷰어 또는 정적 미리보기 지원.
- [ ] `P4-12` Dataview 블록/inline 최소 호환 범위 구현.

완료 기준:

1. 대표 문서 샘플에서 렌더 깨짐 없이 출력된다.
2. 다크모드에서도 코드/수식/다이어그램 대비가 유지된다.
3. 미지원 문법은 명확한 fallback을 제공한다.

## Phase 5. Note 설정/개인화 패리티

작업 파일: `blog-core/src/lib.rs`, `blog-core/templates/*.html`, `static/assets/style.css`

- [ ] `P5-01` `dg-enable-search`, `dg-show-local-graph` 등 note override 처리.
- [ ] `P5-02` `dg-hide`, `dg-hide-in-graph`, `dg-pinned` 반영.
- [ ] `P5-03` `dg-metatags`, `dg-content-classes`, `dg-note-icon` 반영.
- [ ] `P5-04` `dg-path`, `dg-permalink` URL 정책 정합화.
- [ ] `P5-05` 생성일/수정일 표시 규칙 통일.
- [ ] `P5-06` UI 텍스트 커스터마이징(placeholder, 섹션 타이틀) 지원.
- [ ] `P5-07` 사용자 CSS 변수 override 훅 제공.
- [ ] `P5-08` 미지원 frontmatter 경고 리포트 생성(빌드 로그/요약 파일).

완료 기준:

1. frontmatter 변경이 UI에 즉시 반영된다.
2. 문서별 UI 토글이 전역 설정보다 우선한다.
3. 마이그레이션 중 누락 키를 추적할 수 있다.

## Phase 6. 품질/검증 자동화

작업 파일: `blog/` 루트 테스트 설정, 시각 회귀 스크립트 신규

- [ ] `P6-01` 골든 스크린샷 기반 시각 회귀 테스트 도입(핵심 페이지).
- [ ] `P6-02` 기능 E2E 시나리오 작성: 검색, 파일트리, 링크 프리뷰, 그래프.
- [ ] `P6-03` 접근성 점검: 랜드마크, aria, 대비, 키보드 포커스.
- [ ] `P6-04` 성능 예산 설정: LCP, JS 용량, CSS 용량.
- [ ] `P6-05` HTML/링크 무결성 검사(깨진 내부 링크 탐지).
- [ ] `P6-06` 다국어 텍스트 및 폰트 fallback 점검.
- [ ] `P6-07` 라이트/다크 모드별 회귀 테스트.
- [ ] `P6-08` 브라우저 매트릭스 테스트(Chrome/Safari/Firefox).

완료 기준:

1. 릴리즈 전 자동 테스트로 회귀를 잡을 수 있다.
2. 수동 확인 없이 기본 품질선을 통과한다.
3. 패리티 실패가 수치로 드러난다.

## Phase 7. 배포/운영 마무리

작업 파일: `.github/workflows/*`, `README.md`, 운영 문서

- [ ] `P7-01` 빌드 아티팩트에 신규 JS/CSS/data 파일 포함 확인.
- [ ] `P7-02` 캐시 정책 정리: HTML 짧게, 정적파일 fingerprint 장기 캐시.
- [ ] `P7-03` `sitemap.xml`, `rss.xml`, `robots.txt` 최종 검증.
- [ ] `P7-04` 릴리즈 노트 작성: 패리티 범위/미지원 항목/우회 방법.
- [ ] `P7-05` 운영 체크리스트 작성: 장애 대응, 롤백, 재빌드 플로우.

완료 기준:

1. 배포 후 기능 누락 없이 동일 동작한다.
2. 캐시로 인한 구버전 잔존 이슈가 통제된다.
3. 운영 문서만으로 재현 가능한 상태가 된다.

## 우선순위 (실행 순서)

1. `P0 -> P1 -> P3` 먼저 진행.
2. 다음 `P2 -> P5 -> P4`.
3. 마지막 `P6 -> P7`로 품질/배포 고정.

## 이번 주에 바로 시작할 10개

- [ ] 기준 템플릿 commit hash 고정.
- [ ] 페이지 DOM 구조 비교표 작성.
- [ ] CSS 토큰 매핑표 작성.
- [ ] `base.html` 영역 구조 재정렬.
- [ ] `style.css` 토큰 정리 및 브레이크포인트 통일.
- [ ] 파일트리 JSON 생성기 추가.
- [ ] 파일트리 UI 추가.
- [ ] 검색 UI + 키보드 탐색 추가.
- [ ] TOC 생성 및 노트 페이지 연결.
- [ ] 시각 회귀 테스트 최소 3페이지 도입.
