# 라이브러리 웹 앱 배포 계획

## 0. 현재 코드베이스 진단
- `src/App.js`: URL `mode` 파라미터가 없으면 기본적으로 `widget` 모드가 로드되며, 라이브러리 진입은 쿼리 문자열에 의존한다. `HierarchicalForceTree`가 정적으로 import되어 웹 번들에서도 위젯 자산이 포함되고, 허용되지 않은 모드 값에 대한 정규화/리다이렉트가 없다.
- `src/features/library/ui/LibraryApp.js`: 상단 드래그 존과 `LibraryWindowTitleBar` 등 Electron 창 제어 전용 UI가 항상 포함돼 있으며, `VoranBoxManager`/`LibrarySettingsDialog`가 `window.jarvisAPI` 브릿지 동작을 전제로 한다.
- `src/features/library/ui/components/LibrarySidebar.js`: 위젯 생성(`onCreateTreeWidget`), Voran 박스 관리, Electron 전용 드래그/드롭 힌트를 노출하고 있어 웹 배포 시 비활성화 분기나 대체 UX가 필요하다.
- `src/shared/hooks/useSupabaseAuth.js`: `createOAuthBridge` 기반 Electron OAuth 흐름을 기본값으로 사용하며, `buildRedirectUrl`이 로컬호스트 경로로 고정돼 있어 웹 도메인별 리다이렉트 URL/환경 변수를 분리하지 못한다.
- `src/shared/components/library/ThemeProvider.js`: `mode`별로 로컬 스토리지 키를 분리하는 구조라 웹 전용 모드로 통합 시 키 정리와 기본 테마 정책을 재검토해야 한다.
- `package.json` & `scripts/smoke`: Electron 빌드/검증 스크립트만 존재하며, 웹 전용 `build`/`preview`/`smoke` 파이프라인과 Vercel 설정, 환경 변수 체커가 없다.

## 1. 목표
- 기존 Electron 공유 코드베이스를 유지하면서 `LibraryApp`을 웹 독립 서비스로 출시한다.
- 웹 번들에서는 위젯 관련 UI·브릿지를 모두 제거하고, 브라우저에 맞는 레이아웃/동작을 제공한다.
- main 브랜치 기준 자동 빌드·배포 가능한 웹 파이프라인과 환경 변수 검증 절차를 마련한다.
- Electron/웹 간 회귀를 방지할 수 있도록 플랫폼 가드, QA 체크리스트, 문서를 정비한다.

## 2. 범위
### 2.1 즉시 범위 (MVP)
- 플랫폼 감지 유틸과 앱 부트스트랩을 재구성해 웹 모드에서 위젯 모듈이 번들되지 않도록 한다.
- 라이브러리 UI 전역에서 Electron 전용 요소를 조건부 처리하거나 대체 UX로 교체한다.
- Supabase 인증 흐름과 환경 변수 구성을 웹/데스크톱으로 분리하고 자동 검증 스크립트를 추가한다.
- `build:web`/`preview:web`/`smoke:web` 스크립트 및 Vercel 리다이렉트 설정을 마련해 배포를 자동화한다.
- QA 체크리스트와 운영 런북을 최신 상태로 작성해 릴리즈 준비 과정을 표준화한다.

### 2.2 제외 범위
- PWA, Lighthouse/SEO 고도화, 분석·모니터링 도입 등 장기 개선 과제
- 모바일/태블릿 레이아웃 최적화 및 위젯 신규 기능 개발

## 3. 추진 전략
### 3.1 앱 부트스트랩 & 라우팅
- `src/shared/utils/platform.js`를 신설해 `REACT_APP_PLATFORM`, `window.jarvisAPI`, UA 기반으로 `getRuntime()`, `isElectron()`, `isWeb()`을 노출한다.
- `src/App.js`를 `LibraryShell`과 `WidgetShell`로 분리하고, `React.lazy` 기반 동적 import로 위젯 모듈을 감싸 `REACT_APP_PLATFORM=web` 빌드에서 번들 제외를 유도한다.
- 허용 모드 화이트리스트(`library`, `widget`)를 적용하고, 미지정/잘못된 값은 `?mode=library`로 정규화한다.
- `ThemeProvider`와 바디 클래스 토글을 플랫폼 정보로 제어해 웹 모드에서는 `widget-mode` 클래스가 적용되지 않도록 한다.

### 3.2 라이브러리 UI 웹 정비
- `LibraryApp` 상단 드래그 존과 `LibraryWindowTitleBar`를 플랫폼 가드로 감싸고, 웹에서는 브라우저 친화적 헤더/여백으로 대체한다.
- `LibrarySidebar`, `LibraryActionToolbar`, `VoranBoxManager` 등에서 위젯 관련 메뉴·단축키·드래그 동작을 웹 빌드 시 숨기거나 disabled 메시지를 제공한다.
- 파일 시스템, 클립보드, 창 제어 등 Electron 전용 핸들러 호출부에 가드와 대체 안내 모달을 추가해 런타임 오류를 차단한다.
- 웹 전용 최소 너비/높이(1024px/768px) 레이아웃과 포커스 이동, 키보드 내비게이션을 재검토해 접근성을 확보한다.

### 3.3 인증 & 환경 구성
- `useSupabaseAuth`에서 `platform` 유틸을 활용해 Electron OAuth 브릿지는 Electron에서만 초기화하고, 웹에서는 Supabase 호스티드 리다이렉트를 사용한다.
- `buildRedirectUrl`을 환경 매트릭스 기반으로 재작성해 `local`/`preview`/`production` URL을 명시적으로 선택한다.
- `.env.web.example`, `.env.electron.example` 템플릿을 추가하고, `npm run check:env` 스크립트로 필수 키 누락 시 CI를 중단한다.
- `docs/env/supabase-matrix.md`에 각 환경별 리다이렉트 URL, 키, 책임자를 표 형식으로 정리한다.

### 3.4 빌드 & 배포 파이프라인
- `package.json`에 `start:web`, `build:web`, `preview:web`, `smoke:web` 스크립트를 추가하고 `cross-env REACT_APP_PLATFORM=web`을 사용해 CRA 빌드를 수행한다.
- `scripts/smoke/run-web-smoke.js`를 작성해 정적 빌드 산출물의 기본 라우팅, OAuth 리다이렉트, 주요 플로우 호출을 검증한다.
- `vercel.json`에 `/?mode=library` 기본 엔트리와 SPA fallback을 정의하고, main 브랜치 자동 배포/프리뷰 정책을 정리한다.
- CI에서 Electron smoke(`npm run electron:smoke`)와 웹 smoke를 병렬 실행해 플랫폼별 회귀를 조기에 감지한다.

### 3.5 QA & 운영 준비
- `docs/qa/library-smoke-checklist.md`에 로그인, 트리 CRUD, 테마 토글, 접근성 검증 등 웹 전용 체크리스트를 기록한다.
- `docs/ops/library-web-runbook.md`를 작성해 배포 플로우, 롤백 절차, 온콜 연락망을 정의한다.
- 번들 분석 리포트(예: `source-map-explorer`)를 통해 웹 빌드에서 위젯 관련 청크가 제외됐는지 확인하고 결과를 QA 단계에서 검증한다.

## 4. 일정 및 마일스톤
| 단계 | 기간(주) | 주요 산출물 | 병행 여부 |
| --- | --- | --- | --- |
| 1. 플랫폼/부트스트랩 재구성 | 0.5 | `platform` 유틸, `App.js` 모드 정규화, 위젯 lazy 로딩, 테마/바디 클래스 가드 | 단독 진행 |
| 2. 라이브러리 UI 웹 정비 | 1 | 웹 전용 헤더·레이아웃, 위젯 메뉴 비활성화, Electron 기능 가드, 접근성 점검 | 단계 1 완료 후 |
| 3. 인증 & 배포 파이프라인 | 0.5 | `useSupabaseAuth` 개편, `.env` 템플릿, `build:web`/`smoke:web`, `vercel.json` | 단계 1~2 산출물 기반 |
| 4. QA & 릴리즈 준비 | 0.5 | QA 체크리스트, 운영 런북, 번들 검증, 최종 스모크 테스트 리포트 | 단계 2~3 후 |

## 5. 작업 테스크 상세
### 5.1 앱 부트스트랩 & 라우팅 (MVP)
- [ ] `src/shared/utils/platform.js` 작성 및 단위 테스트 추가
- [ ] `src/App.js`를 `LibraryShell`/`WidgetShell` 구조로 리팩터링하고 `React.lazy` 적용
- [ ] `src/App.js`에 허용 모드 화이트리스트와 `?mode=library` 리다이렉트 로직 구현
- [ ] `ThemeProvider`와 전역 바디 클래스 토글을 플랫폼 기반으로 조정
- [ ] `src/features/tree/ui/HierarchicalForceTree` 진입점을 동적 import로 변경해 웹 빌드 제외 확인

### 5.2 라이브러리 UI 정비 (MVP)
- [ ] `LibraryApp` 드래그 존/`LibraryWindowTitleBar`를 플랫폼 조건부 렌더링으로 전환
- [ ] 웹 전용 헤더/상단 툴바 컴포넌트를 추가해 Electron 전용 UI를 대체
- [ ] `LibrarySidebar`/`LibraryActionToolbar`에서 위젯·Voran 관련 항목 숨김 및 대체 메시지 처리
- [ ] Electron 전용 서비스 호출부(`VoranBoxManager`, 파일/창 제어 등)에 가드 및 안내 모달 추가
- [ ] 1024px/768px 반응형 레이아웃, 포커스 이동, 키보드 네비게이션 QA 수행

### 5.3 인증 & 환경 (MVP)
- [ ] `useSupabaseAuth`가 `platform` 유틸을 사용하도록 리팩터링하고 Electron 브릿지 초기화를 조건부 적용
- [ ] `buildRedirectUrl`을 환경 매트릭스 기반으로 재작성하고 단위 테스트 추가
- [ ] `.env.web.example`, `.env.electron.example`, `docs/env/supabase-matrix.md` 작성
- [ ] `npm run check:env` 스크립트 구현 및 CI 파이프라인에 추가
- [ ] Supabase 콘솔에 웹 도메인 리다이렉트 URL 등록 및 검증

### 5.4 빌드 & 배포 파이프라인 (MVP)
- [ ] `package.json`에 `start:web`, `build:web`, `preview:web`, `smoke:web` 스크립트 추가
- [ ] `scripts/smoke/run-web-smoke.js` 구현 및 핵심 플로우 시나리오 작성
- [ ] `vercel.json` 기본 라우팅/SPA fallback/헤더 설정 추가 및 문서화
- [ ] CI에서 Electron + 웹 smoke 병렬 실행 구성, 빌드 아티팩트 업로드
- [ ] 배포 가이드(릴리즈 노트, 체크포인트)를 `docs/ops/library-web-runbook.md`에 통합

### 5.5 QA & 운영 (MVP)
- [ ] `docs/qa/library-smoke-checklist.md` 작성 및 유지 절차 정의
- [ ] 빌드 산출물 번들 분석 리포트 생성 및 QA 단계에서 검토
- [ ] 장애 대응/롤백/온콜 절차를 운영 런북에 명시
- [ ] 메트릭 및 로그 수집 최소 기준(콘솔 에러, 사용자 문의 채널) 정의
- [ ] 최종 배포 리허설 후 smoke 결과 아카이브

## 6. 리스크 및 대응
- **플랫폼 감지 미비** → `platform` 유틸과 단위 테스트, QA 체크리스트에서 Electron/Web 가드를 검증한다.
- **OAuth 리다이렉트 설정 오류** → 환경 매트릭스와 `npm run check:env`를 사용해 릴리즈 전 자동/수동 검증을 수행한다.
- **위젯 코드가 웹 번들에 포함되는 회귀** → lazy import와 `smoke:web` 번들 분석으로 검출하고, CI에 번들 크기 경고를 추가한다.
- **빌드/배포 파이프라인 불일치** → Electron과 웹 smoke를 병렬 실행해 회귀를 조기에 발견하고, 실패 시 배포를 중단한다.
