# Digital Garden Front 기능 차이 리포트 (재비교)

작성일: 2026-02-17  
대상: `/home/mud/repo/blog`  
비교 기준: `obsidian-digital-garden` 프론트 기능 목록 (`/home/mud/repo/blog_temp/obsidian-digital-garden/README.md:24`)

## 요약

현재 구현은 Digital Garden 프론트의 핵심 영역(검색/파일트리/백링크/로컬·글로벌 그래프/TOC/링크 프리뷰/대부분의 콘텐츠 렌더링)을 거의 충족합니다.  
이번 재비교 기준으로 남은 갭은 **"Dataview 고급 동작" + "커스터마이징 계층" + "미발행 링크 처리 UX"**가 핵심입니다.

## 이번 재비교에서 확인된 동등/근접 구현

- 선택적 게시 정책 기본값 일치
  - 기본값 `DgOptIn`: `blog-core/src/lib.rs:125`
  - CLI 기본값 `dg-opt-in`: `blog-build/src/main.rs:25`, `blog-dev/src/main.rs:57`
- 탐색 기능 일치(검색/파일트리/백링크/로컬·글로벌 그래프/TOC/링크 프리뷰)
  - 빌드 파이프라인: `blog-core/src/lib.rs:437`
  - 검색 인덱스: `blog-core/src/lib.rs:828`
  - 파일트리: `blog-core/src/lib.rs:845`
  - 글로벌 그래프: `blog-core/src/lib.rs:771`, `blog-core/src/lib.rs:930`
  - 로컬 그래프: `blog-core/src/lib.rs:972`
  - TOC/링크 프리뷰 스크립트 로드: `blog-core/templates/base.html:516`, `blog-core/templates/base.html:531`
- 콘텐츠 지원 대폭 반영
  - 노트 트랜스클루전: `blog-core/src/lib.rs:1371`, `blog-core/src/lib.rs:1418`
  - PDF/Excalidraw/Canvas/Image embed: `blog-core/src/lib.rs:1390`, `blog-core/src/lib.rs:1393`, `blog-core/src/lib.rs:1396`, `blog-core/src/lib.rs:1399`
  - Callout/PlantUML/Highlight/Footnote: `blog-core/src/lib.rs:1932`, `blog-core/src/lib.rs:1840`, `blog-core/src/lib.rs:1901`, `blog-core/src/lib.rs:1827`
  - Mermaid/Math 렌더 스크립트: `blog-core/templates/base.html:547`, `blog-core/templates/base.html:553`

## 남은 차이점 (핵심)

### 1) Dataview는 "부분 구현" 상태

DG 기준은 Dataview를 codeblock/inline/dataviewjs까지 폭넓게 지원하지만, 현재는 범위가 제한됩니다.

- 현재 구현
  - `dataview` fenced block 파싱: `blog-core/src/lib.rs:1599`
  - 지원 쿼리: `LIST FROM #tag`, `TABLE FROM #tag`, `TASK FROM #tag` 패턴 중심: `blog-core/src/lib.rs:1635`
  - `dataviewjs`는 실행하지 않고 안내 fallback: `blog-core/src/lib.rs:1728`
- 남은 작업
  - inline dataview 처리
  - Dataview 쿼리 문법 범위 확장(정렬/where/필드 선택 등)
  - dataviewjs 실행 전략(보안/성능 정책 포함)

### 2) 미발행/미존재 위키링크 UX 차이

DG는 미발행 링크도 "존재하지 않는 노트 페이지"로 안내하는 흐름이 있는데, 현재는 코드 텍스트로 남깁니다.

- 현재 구현
  - 미해결 wikilink를 `` `[[...]]` ``로 렌더: `blog-core/src/lib.rs:1407`
- DG 기준 설명
  - 미발행 링크는 "노트 없음" 페이지 안내: `/home/mud/repo/blog_temp/obsidian-digital-garden/README.md:115`
- 남은 작업
  - unresolved wikilink를 `/notes/<slug>/` 또는 전용 fallback 라우트로 연결
  - 404/placeholder note UX를 DG 동작과 유사하게 정리

### 3) 커스터마이징 계층 차이 (테마/스타일세팅/문구)

#### 3-1) Obsidian Theme / Style Settings plugin 호환
- 현재 상태
  - 자체 light/dark 토글 + CSS 변수 기반 테마: `blog-core/templates/base.html:37`, `blog-core/templates/base.html:67`, `static/assets/style.css:2`
- 남은 작업
  - Obsidian theme 자산 직접 반영 경로
  - Style Settings 플러그인 스키마/설정 반영 레이어

#### 3-2) 사용자 정의 Regex 필터
- 현재 상태
  - 정규식 기반 변환은 코드 내 고정 로직(하이라이트/콜아웃 등) 중심: `blog-core/src/lib.rs:1901`, `blog-core/src/lib.rs:1932`
- 남은 작업
  - 사용자 정의 rule(설정파일/프론트매터) 로딩
  - rule 순서/충돌/안전성 정책

#### 3-3) UI 텍스트 외부화
- 현재 상태
  - 주요 UI 문구 하드코딩
  - 예: `Search notes...`/`Pages`/`On This Page`: `blog-core/templates/base.html:80`, `blog-core/templates/base.html:91`, `blog-core/templates/base.html:126`
  - 예: 백링크 헤더 문구: `blog-core/src/lib.rs:2125`
- 남은 작업
  - 사이트 설정 또는 locale 파일 기반 문자열 주입

### 4) Timestamp 표시는 "부분 충족"

- 현재 상태
  - `date`/`updated` 파싱 및 메타 반영: `blog-core/src/lib.rs:148`, `blog-core/src/lib.rs:184`, `blog-core/src/lib.rs:685`, `blog-core/templates/base.html:26`, `blog-core/src/lib.rs:2322`
  - 하지만 카드/본문 헤더는 `date` 위주 표기: `blog-core/src/lib.rs:2227`, `blog-core/templates/post.html:7`
- 남은 작업
  - 포스트 헤더/리스트에서 `updated` 병기 여부를 DG UX에 맞춰 결정

## 우선순위 제안 (남은 작업)

1. 미해결 위키링크를 DG 방식(노트 없음 페이지)으로 연결
2. Dataview 범위 확장(최소 inline + 쿼리 문법 일부)
3. UI 텍스트 외부화(검색/백링크/TOC 라벨)
4. Theme/Style Settings 호환 레이어 설계

## 결론

현재 상태는 "DG 프론트 핵심 기능은 대부분 구현 완료"로 판단됩니다.  
실제 남은 갭은 다수 기능 미구현이 아니라, **고급 Dataview·커스터마이징·링크 fallback UX** 같은 완성도 영역입니다.
