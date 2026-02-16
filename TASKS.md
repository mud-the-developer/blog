# Hoshinoai - 작업 목록 (Digital Garden Full Feature)

## Phase 0: 스펙 고정 (0.5일)

- [x] 기준 스펙을 `obsidian-digital-garden`으로 고정
- [x] 콘텐츠 루트 확정 (`content/`)
- [x] 슬러그 정책 확정 (`slug` > `dg-path` > `dg-permalink` > 파일 상대경로, 공백은 `-`)
- [ ] Cloudflare 배포안 확정 (A: Cloudflare+Origin 권장)
- [x] 성능/보안 기본선 확정(캐시 TTL, sanitize 정책)

## Phase 1: 프로젝트 골격 (1일)

- [x] Cargo 프로젝트 초기화
- [x] `axum` 라우터 및 `AppState` 구성
- [x] `askama` 템플릿 기본 레이아웃 생성
- [x] `maud` 렌더 모듈 스켈레톤 생성
- [x] `static/`, `assets/` 서빙 설정
- [x] 에러 모델/헬스체크/기본 로깅 구축

## Phase 2: Markdown + Obsidian 파서 코어 (2일)

- [x] `.md` 재귀 스캔 + frontmatter 분리
- [x] `dg-publish`, `dg-home`, `title`, `dg-permalink`, `dg-path` 처리
- [x] Wikilink 파싱 (`[[note]]`, `#header`, `#^block`, alias)
- [x] 일반 Markdown 렌더(코드블록/리스트/표 등)
- [x] sanitize 파이프라인 추가
- [x] 본문 HTML을 `maud` 컴포넌트로 조합
- [ ] 미지원 frontmatter 키 로그/리포트 노출(마이그레이션 가시성)

## Phase 3: 링크/탐색 핵심 기능 (2일)

- [x] outlinks/backlinks 인덱스 생성
- [x] 태그 인덱스 및 태그 페이지
- [ ] TOC 생성
- [ ] 파일트리 네비게이션
- [ ] 링크 호버 프리뷰
- [ ] 노트 간 임베드/트랜스클루전

## Phase 4: 검색/그래프 기능 (2일)

- [ ] 전역 검색 인덱스(제목/본문/태그)
- [ ] 검색 API + 라이브 프리뷰 UI
- [ ] 글로벌 그래프 데이터 생성
- [ ] 로컬 그래프 데이터 생성
- [ ] 그래프 페이지 + 인터랙션(zoom/pan/focus)

## Phase 5: 고급 콘텐츠 포맷 (3일)

- [ ] Callouts/Admonitions(중첩/접힘)
- [ ] MathJax/LaTeX
- [ ] Footnotes
- [ ] Checkboxes
- [ ] Mermaid
- [ ] PlantUML
- [ ] Embedded PDFs
- [ ] Excalidraw embed/transclusion
- [ ] Canvas publish
- [ ] Dataview blocks/inline
- [ ] DataviewJS 호환 전략 구현(제한 또는 샌드박스)

## Phase 6: 커스터마이징/설정 호환 (2일)

- [ ] Note specific settings 처리
- [ ] `dg-enable-search`, `dg-show-local-graph` override 처리
- [ ] `dg-hide`, `dg-hide-in-graph`, `dg-pinned` 처리
- [ ] `dg-metatags`, `dg-content-classes`, `dg-note-icon` 처리
- [ ] 생성일/수정일 표시
- [ ] UI 텍스트 커스터마이징
- [ ] regex custom filters

## Phase 7: SEO/출력 아티팩트 (1일)

- [ ] `sitemap.xml` 생성
- [ ] `feed.xml` 생성
- [ ] OpenGraph/메타태그 정리
- [ ] canonical URL 규칙 적용

## Phase 8: Cloudflare 배포 (1일)

### A안 (권장): Cloudflare + Axum Origin

- [ ] Axum 서비스 배포(Fly/Railway/VM)
- [ ] Cloudflare DNS 프록시/TLS Full(Strict)
- [ ] 캐시 룰(HTML 짧게, static 길게)
- [ ] WAF/rate limiting 기본 적용
- [ ] 콘텐츠 변경 시 purge 경로 구성

### B안: Cloudflare Pages + 정적 빌드

- [ ] 정적 생성 파이프라인 구축
- [ ] Pages 연결 및 재배포 트리거
- [ ] 동적 기능 보완(Worker/API) 설계

## Phase 9: 안정화/검증 (1-2일)

- [ ] 대형 vault 성능 테스트
- [ ] 링크 깨짐/순환 링크 케이스 테스트
- [ ] sanitize/XSS/경로 우회 테스트
- [ ] 캐시 일관성 테스트
- [ ] 장애 대응(runbook) 문서화

## 패리티 체크리스트 (릴리즈 게이트)

- [ ] Content support 기능군 모두 동작
- [ ] Navigation/search/graph 기능군 모두 동작
- [ ] Frontmatter 핵심 키 호환
- [ ] SEO 산출물(sitemap/feed) 생성
- [ ] Cloudflare 배포/캐시/보안 정책 적용

## 즉시 다음 액션

1. Phase 0의 5개 항목 확정
2. Phase 1~3 구현으로 "기본 가든" 가동
3. Phase 4~6으로 기능 패리티 완료
4. Phase 7~9로 배포/안정화 완료
