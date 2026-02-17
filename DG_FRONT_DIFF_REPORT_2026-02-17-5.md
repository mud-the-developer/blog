# Digital Garden Front 차이 리포트 (재비교, pull 이후)

작성일: 2026-02-17 11:02 KST  
대상: `/home/mud/repo/blog`  
비교 기준: `obsidian-digital-garden` 기능 목록 (`/home/mud/repo/blog_temp/obsidian-digital-garden/README.md:24`)

## 요약

현재 구현은 Digital Garden 프론트와 거의 동등한 수준입니다.  
이전 리포트에서 남아 있던 주요 갭(미발행 링크 UX, 커스텀 필터, 테마/스타일세팅, UI 텍스트 외부화, updated 표시)이 대부분 반영되었습니다.

## 이번 재비교에서 확인된 반영 사항

1. 미발행 링크 UX
- unresolved wikilink가 placeholder 경로로 링크됨: `blog-core/src/lib.rs:1791`
- missing note 페이지 실제 생성: `blog-core/src/lib.rs:1013`, `blog-core/templates/missing-note.html:1`

2. 커스텀 regex 필터
- `static/regex-filters.json` 로딩 및 적용: `blog-core/src/lib.rs:1507`, `blog-core/src/lib.rs:1541`

3. 테마/스타일세팅 계층
- `obsidian-theme.css`, `style-settings.css`, `user-overrides.css` 자동 링크: `blog-core/src/lib.rs:1552`, `blog-core/templates/base.html:56`
- `style-settings.json` 기반 CSS 변수 인라인 생성: `blog-core/src/lib.rs:1569`, `blog-core/src/lib.rs:1594`

4. UI 텍스트 커스터마이징
- `SiteText` 도입 (search/toc/backlinks 문구): `blog-core/src/lib.rs:116`, `blog-core/src/lib.rs:123`
- CLI 인자로 문구 설정 가능: `blog-build/src/main.rs:25`, `blog-dev/src/main.rs:57`
- 템플릿 실제 주입: `blog-core/templates/base.html:101`, `blog-core/src/lib.rs:2774`

5. Dataview 확장
- inline dataview 일부 지원: `blog-core/src/lib.rs:2106`
- block query 옵션 확장 (`WHERE/SORT/LIMIT`): `blog-core/src/lib.rs:2164`
- dataviewjs 안전모드(`tag-pages`) 지원: `blog-core/src/lib.rs:2320`, `blog-build/src/main.rs:35`

6. 타임스탬프 표시 강화
- 카드/포스트/태그 목록에 `updated` 병기: `blog-core/src/lib.rs:2887`, `blog-core/templates/post.html:7`, `blog-core/templates/index.html:25`, `blog-core/templates/tag.html:13`

7. 선택적 게시 정책
- 기본 정책 `dg-opt-in` 유지 (`dg-publish: true`만 게시): `blog-core/src/lib.rs:612`, `blog-core/src/lib.rs:187`, `blog-build/src/main.rs:37`

## 현재 남은 차이점 (실질)

### 1) Dataview / DataviewJS는 여전히 "부분 호환"
- `dataviewjs`는 임의 JS 실행이 아니라 안전모드/폴백 중심: `blog-core/src/lib.rs:2320`
- dataview inline도 특정 패턴(`this.file.*`, `dv.pages(...).length`) 중심으로 제한됨: `blog-core/src/lib.rs:2130`
- 즉, DG의 "광범위한 Dataview/DataviewJS 표현식"과는 아직 차이가 남음

### 2) Math 엔진 구현 차이
- DG 문서는 MathJax를 명시 (`README.md:37`)하지만,
- 현재 구현은 KaTeX 렌더러 사용: `static/assets/math-render.js:2`
- 대부분 수식은 동작하겠지만, 일부 문법/렌더 차이는 발생 가능

### 3) 테마/스타일세팅의 완전 자동 연동은 아님
- 현재는 정적 자산 파일을 두면 로드하는 방식(수동/파일 기반 연동): `blog-core/src/lib.rs:1552`
- Obsidian 플러그인 설정과의 실시간 동기화 계층은 코드상 보이지 않음

## 결론

현재 기준으로 DG 프론트의 핵심 UX/기능은 대부분 맞춰졌습니다.  
남은 작업은 "미구현 대형 기능"이라기보다, **Dataview 고급 호환성**과 **테마/수식 엔진의 완전한 동작 일치** 같은 정밀 호환 영역입니다.
