# 라이브러리 웹 앱 배포 계획

## 0. 현재 코드베이스 진단
- `src/App.js`: URL `mode` 파라미터 미지정 시 여전히 `widget`이 기본으로 로드되고 `HierarchicalForceTree`가 정적으로 import되어 웹 번들에 위젯 자산이 포함된다. `mode`별 기본 테마(`widget`은 `glass`, `library`는 `light`)만 분기할 뿐, 허용되지 않은 모드 값 정규화나 플랫폼 감지 로직은 없다.
- `src/features/library/ui/LibraryApp.js`: 상단 드래그 존과 `LibraryWindowTitleBar`가 항상 포함돼 있으며, 라이브러리 전역에서 `VoranBoxManager`, 트리 위젯 생성 메뉴 등 Electron 전용 기능을 노출한다.
- `src/shared/hooks/SettingsContext.js`: `createSettingsBridge`, `createSystemBridge`, `createTrayBridge` 등 Electron 브릿지를 기본 가정으로 초기화하며, 접근성 권한 확인·트레이 제어 등 데스크톱 기능이 웹에서도 호출된다.
- `src/shared/hooks/useSupabaseAuth.js`: Electron OAuth 브릿지를 우선 사용하고, 웹 환경 리다이렉트 URL이 동적으로 구성되지 않는다. 환경 분리나 도메인별 리다이렉트 매트릭스가 없다.
- `src/shared/components/library/ThemeProvider.js`: `mode`별 로컬 스토리지 키(`jarvis.theme.${mode}`)를 사용해 위젯과 라이브러리 테마가 분리돼 있지만, 플랫폼 감지와는 연동되지 않는다.
- `package.json` & `scripts/smoke`: Electron 중심 스크립트만 존재하며, 웹 전용 빌드(`build:web`), 미리보기(`preview:web`), 스모크(`smoke:web`) 및 환경 검증(`check:env`) 파이프라인이 정의돼 있지 않다.

## 1. 목표
- 공유 코드베이스를 유지하면서 `LibraryApp`을 브라우저 환경에서도 안정적으로 동작시키고 Electron 앱과 병행 운영한다.
- 웹 번들에서는 위젯 전용 UI, Electron 브릿지 호출, OS 의존 기능을 제거하거나 대체 UX를 제공한다.
- main 브랜치 기준으로 자동 빌드·배포 가능한 웹 파이프라인과 환경 변수 검증 절차를 구축한다.
- 플랫폼 가드, QA 체크리스트, 운영 문서를 통해 Electron/웹 간 회귀를 방지한다.

## 2. 범위
### 2.1 즉시 범위 (MVP)
- 플랫폼 감지 유틸을 도입해 웹 빌드 시 위젯 모듈이 번들되지 않도록 App 부트스트랩을 재구성한다.
- `SettingsProvider` 및 라이브러리 UI 전역에서 Electron 전용 기능을 조건부 처리하거나 브라우저 친화적 UX로 교체한다.
- Supabase 인증 흐름과 환경 변수 구성을 웹/데스크톱으로 분리하고 자동 검증 스크립트를 추가한다.
- `build:web`/`preview:web`/`smoke:web` 스크립트 및 Vercel 설정을 마련해 배포 자동화를 완성한다.
- QA 체크리스트와 운영 런북을 최신 상태로 작성해 릴리즈 프로세스를 표준화한다.

### 2.2 제외 범위
- PWA 지원, Lighthouse/SEO 고도화, 분석·모니터링 도입 등 장기 개선 과제
- 모바일/태블릿 최적화 및 위젯 신규 기능 개발

## 3. 추진 전략
### 3.1 앱 부트스트랩 & 플랫폼 감지
- `src/shared/utils/platform.js`를 신설해 `getRuntime()`, `isElectron()`, `isWeb()` 등을 중앙화한다.
- `src/App.js`를 `LibraryShell`과 `WidgetShell`로 분리하고 `React.lazy`/`Suspense`로 위젯 모듈을 감싸 웹 빌드에서 제외한다.
- 허용 모드 화이트리스트(`library`, `widget`)를 적용하고, 미지정·잘못된 값은 `?mode=library`로 정규화한다.
- `ThemeProvider`와 body 클래스 토글을 플랫폼 정보와 연계해 웹에서는 `widget-mode` 클래스를 비활성화한다.

### 3.2 설정 & 선호도 가드
- `SettingsProvider`에서 Electron 브릿지 생성과 접근성/트레이 관련 사이드 이펙트를 플랫폼 가드로 감싸고, 웹에서는 noop 또는 대체 메시지를 제공한다.
- Supabase 동기화(`upsertUserSettings`)는 공통으로 유지하되, 웹에서 제공하지 않는 설정은 저장/표시하지 않도록 도메인 분리를 도입한다.
- 라이브러리 테마가 웹 기본 테마(`light`)와 충돌하지 않도록 `ThemeProvider` 저장 키와 설정 동기화 로직을 점검한다.

### 3.3 라이브러리 UI 웹 정비
- `LibraryWindowTitleBar`와 상단 드래그 존을 플랫폼 조건부 렌더링으로 전환하고, 웹에서는 브라우저 UI에 맞는 헤더/패딩을 적용한다.
- `LibrarySidebar`, `LibraryActionToolbar`, `VoranBoxManager` 등에서 위젯 생성·Voran 관련 메뉴를 숨기거나 비활성화하고, 브라우저 전용 안내를 제공한다.
- Electron 전용 서비스(파일 시스템, 클립보드, 창 제어 등)를 호출하는 부분에 가드와 대체 안내 모달을 추가한다.
- 1024px/768px 기준 레이아웃과 포커스 이동, 키보드 네비게이션 등 접근성 요구사항을 재검토한다.

### 3.4 인증 & 환경 구성
- `useSupabaseAuth`에서 플랫폼 유틸을 사용해 Electron OAuth 브릿지를 조건부 초기화하고, 웹에서는 Supabase 호스티드 리다이렉트를 사용한다.
- `buildRedirectUrl`을 환경 행렬 기반으로 재작성해 `local`/`preview`/`production` URL을 명시적으로 선택한다.
- `.env.web.example`, `.env.electron.example`, `docs/env/supabase-matrix.md`를 작성해 환경 변수 관리와 검증 절차를 문서화한다.
- `npm run check:env` 스크립트를 도입해 필수 환경 변수 미설정 시 CI를 중단한다.

### 3.5 빌드 & 배포 파이프라인
- `package.json`에 `start:web`, `build:web`, `preview:web`, `smoke:web` 스크립트를 추가하고 `cross-env REACT_APP_PLATFORM=web`을 사용한다.
- `scripts/smoke/run-web-smoke.js`를 작성해 정적 빌드 산출물의 라우팅, OAuth 리다이렉트, 주요 플로우를 검증한다.
- `vercel.json`에 `/?mode=library` 기본 엔트리와 SPA fallback을 정의하고, main/프리뷰 브랜치 배포 정책을 명확히 한다.
- CI에서 Electron smoke(`npm run electron:smoke`)와 웹 smoke를 병렬 실행해 플랫폼별 회귀를 조기에 감지한다.

### 3.6 QA & 운영 준비
- `docs/qa/library-smoke-checklist.md`를 작성해 로그인, 트리 CRUD, 테마 토글, 접근성 검증 등 웹 전용 시나리오를 정의한다.
- `docs/ops/library-web-runbook.md`에 배포 플로우, 롤백 절차, 온콜 연락망을 문서화한다.
- 번들 분석 리포트(예: `source-map-explorer`)로 웹 빌드에서 위젯 청크가 제외됐는지 확인하고 결과를 QA 단계에서 검증한다.
- 기본 모니터링(콘솔 에러 수집, 사용자 문의 채널) 체계를 마련하고 향후 Sentry/분석 도입 여지를 남긴다.

## 4. 일정 및 마일스톤
| 단계 | 기간(주) | 주요 산출물 | 병행 여부 |
| --- | --- | --- | --- |
| 1. 플랫폼 & 설정 가드 | 1 | `platform` 유틸, `App.js` 모드 정규화, 위젯 lazy 로딩, `SettingsProvider` 웹 가드 | 단독 진행 |
| 2. 라이브러리 UI 웹 정비 | 1 | 웹 전용 헤더/레이아웃, 위젯 메뉴 비활성화, Electron 기능 가드, 접근성 점검 | 단계 1 완료 후 |
| 3. 인증 & 배포 파이프라인 | 0.5 | `useSupabaseAuth` 개편, `.env` 템플릿, `build:web`/`smoke:web`, `vercel.json` | 단계 1~2 산출물 기반 |
| 4. QA & 릴리즈 준비 | 0.5 | QA 체크리스트, 운영 런북, 번들 검증, 최종 스모크 테스트 리포트 | 단계 2~3 후 |

## 5. 작업 테스크 상세
### 5.1 앱 부트스트랩 & 플랫폼
- [ ] `src/shared/utils/platform.js` 작성 및 단위 테스트 추가
- [ ] `src/App.js`를 `LibraryShell`/`WidgetShell` 구조로 리팩터링하고 `React.lazy` 적용
- [ ] `src/App.js`에 허용 모드 화이트리스트와 `?mode=library` 리다이렉트 로직 구현
- [ ] `ThemeProvider`와 body 클래스 토글을 플랫폼 감지 결과와 연동
- [ ] `src/features/tree/ui/HierarchicalForceTree` 진입점을 동적 import로 변경해 웹 번들 제외 확인

### 5.2 설정 & 선호도 가드
- [ ] `SettingsProvider`에서 Electron 브릿지 초기화를 플랫폼 조건부로 변경하고 웹에서는 noop 핸들러 제공
- [ ] 접근성 권한/트레이 상태 갱신 호출을 웹에서 생략하거나 대체 안내 메시지로 교체
- [ ] 라이브러리·위젯 테마 동기화 로직을 플랫폼별로 분기해 불필요한 저장 항목 제거
- [ ] 웹 모드에서 저장하지 않을 설정을 UI/DB 모두에서 숨김 처리

### 5.3 라이브러리 UI 정비
- [ ] `LibraryApp` 드래그 존/`LibraryWindowTitleBar`를 플랫폼 조건부 렌더링으로 전환하고 웹 헤더 적용
- [ ] `LibrarySidebar`/`LibraryActionToolbar`에서 위젯·Voran 관련 항목 숨김 및 대체 메시지 처리
- [ ] Electron 전용 서비스 호출부에 가드 및 안내 모달 추가
- [ ] 1024px/768px 반응형 레이아웃, 포커스 이동, 키보드 네비게이션 QA 수행

### 5.4 인증 & 환경
- [ ] `useSupabaseAuth`가 `platform` 유틸을 사용하도록 리팩터링하고 Electron 브릿지 초기화를 조건부 적용
- [ ] `buildRedirectUrl`을 환경 매트릭스 기반으로 재작성하고 단위 테스트 추가
- [ ] `.env.web.example`, `.env.electron.example`, `docs/env/supabase-matrix.md` 작성
- [ ] `npm run check:env` 스크립트 구현 및 CI 파이프라인에 추가
- [ ] Supabase 콘솔에 웹 도메인 리다이렉트 URL 등록 및 검증

### 5.5 빌드 & 배포
- [ ] `package.json`에 `start:web`, `build:web`, `preview:web`, `smoke:web` 스크립트 추가
- [ ] `scripts/smoke/run-web-smoke.js` 구현 및 핵심 플로우 시나리오 작성
- [ ] `vercel.json` 기본 라우팅/SPA fallback/헤더 설정 추가 및 문서화
- [ ] CI에서 Electron + 웹 smoke 병렬 실행 구성, 빌드 아티팩트 업로드
- [ ] 배포 가이드(릴리즈 노트, 체크포인트)를 `docs/ops/library-web-runbook.md`에 통합

### 5.6 QA & 운영
- [ ] `docs/qa/library-smoke-checklist.md` 작성 및 유지 절차 정의
- [ ] 빌드 산출물 번들 분석 리포트 생성 및 QA 단계에서 검토
- [ ] 장애 대응/롤백/온콜 절차를 운영 런북에 명시
- [ ] 기본 모니터링 지표(콘솔 에러, 사용자 문의 채널) 정의 및 공유 위치 마련
- [ ] 최종 배포 리허설 후 `smoke:web`/`electron:smoke` 결과 아카이브

## 6. 리스크 및 대응
- **플랫폼 감지 미비** → `platform` 유틸과 단위 테스트, QA 체크리스트에서 Electron/Web 가드를 검증한다.
- **설정 브릿지 호출 실패** → `SettingsProvider`를 플랫폼 조건부로 리팩터링하고, 브라우저에서 noop 처리 여부를 테스트한다.
- **OAuth 리다이렉트 설정 오류** → 환경 매트릭스와 `npm run check:env`를 통해 릴리즈 전 자동/수동 검증을 수행한다.
- **위젯 코드가 웹 번들에 포함되는 회귀** → lazy import와 `smoke:web` 번들 분석으로 검출하고, CI에 번들 크기 경고를 추가한다.
- **빌드/배포 파이프라인 불일치** → Electron과 웹 smoke를 병렬 실행해 회귀를 조기에 발견하고, 실패 시 배포를 중단한다.
