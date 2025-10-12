# 라이브러리 웹 앱 배포 계획

## 0. 현재 코드베이스 진단
- `src/App.js`: URL `mode` 파라미터 미지정 시 `widget`이 기본으로 로드되고, 잘못된 모드 값에 대한 정규화나 리다이렉트가 없어 웹 진입이 Electron 위젯 뷰에 종속됨.
- `src/features/library/ui/components/LibraryWindowTitleBar.jsx`: `window.jarvisAPI` 기반 Electron 전용 타이틀 바가 항상 렌더되어 웹에서 불필요한 공간과 `WebkitAppRegion` 스타일을 유발함.
- `src/shared/hooks/useSupabaseAuth.js`: Electron OAuth 브릿지를 기본값으로 사용하고 있으며, 웹 도메인별 리다이렉트 URL/환경 값 분리가 정의되어 있지 않음.
- `package.json` 및 `scripts/smoke`: 웹 빌드·검증 스크립트(`build:web`, 웹 smoke)가 존재하지 않아 수동 빌드에 의존하고, Electron 전용 smoke 스크립트만 제공됨.

## 1. 목표
- 라이브러리 모드를 웹 독립 서비스 형태로 MVP 수준 출시하여 데스크톱(Electron) 앱과 병행 운영
- 최소 변경으로 공유 코드베이스를 유지하되, 웹 환경에서 필수 UX 차별화 요소 확보
- main 브랜치 기준으로 자동 배포가 가능한 CI/CD 파이프라인을 확립하고 운영 메뉴얼을 제공
- 플랫폼 가드를 강화해 Electron/웹 간 회귀를 방지하고, 테스트 가능한 구조를 마련

## 2. 범위
### 2.1 MVP 필수 범위
- URL 파라미터 미지정 또는 비정상 값일 때 `src/App.js`에서 `mode=library`로 리다이렉트하고 허용 모드 화이트리스트를 적용
- `src/shared/utils/platform.js`(신규)에서 `REACT_APP_PLATFORM`과 런타임 감지를 통합한 `getPlatform()`/`isElectron()` 유틸 제공
- 웹 전용 헤더·사이드바 레이아웃 정비, 최소 1024px/768px 두 구간 반응형 대응, Electron 전용 UI는 조건부 처리
- 파일 접근, 클립보드 등 OS 의존 기능의 대체 UI/메시지 정책 정의와 라이브러리 기능 세트 명시
- `package.json`에 `npm run build:web`, `npm run preview:web`, `npm run check:env` 등 웹 파이프라인 스크립트 추가
- Supabase OAuth 리다이렉트 URL과 환경 변수 매트릭스(`.env.production`, `.env.electron`, `.env.local`) 분리 및 검증 체크리스트 작성
- 로그인, 트리 CRUD, 테마 전환, 반응형 동작에 대한 수동 QA 체크리스트와 Smoke 테스트 리포트 템플릿 작성

### 2.2 릴리즈 이후 확장 범위
- 디자인 토큰 정리 및 Figma 싱크, Lighthouse/SEO 최적화, `<Helmet>` 기반 메타데이터 정교화, 웹 분석·Sentry 모니터링 도입
- Playwright/Cypress 기반 자동화 테스트, PWA 및 모바일 최적화, 사용자 피드백 채널 구축
- 운영 대시보드, 데이터 로깅 고도화 및 실시간 알림 체계 등 장기 과제

## 3. 추진 전략
### 3.1 플랫폼 분리 & 라우팅
- `src/shared/utils/platform.js`와 `src/shared/utils/__tests__/platform.test.js`를 추가해 플랫폼 판별 로직을 중앙화하고, `LibraryWindowTitleBar`, `useSupabaseAuth`, `LibraryApp`에서 재사용
- `.env.production`, `.env.electron`, `.env.local`에 `REACT_APP_PLATFORM`과 필수 Supabase 키를 명시한 템플릿을 제공하고 CRA 빌드 시 환경 변수 노출을 검증
- `src/App.js`에서 허용 모드 화이트리스트(`library`, `widget`)를 정의해 잘못된 파라미터를 정규화하고, 미지정 시 `mode=library`로 강제 리다이렉트
- Electron 빌드(`npm run electron:smoke`)와 신규 웹 빌드 smoke(`npm run build:web && node scripts/smoke/run-web-smoke.js`)를 CI에서 병렬 실행해 회귀를 조기에 감지
- Redirect/리라이트 로직은 CRA 라우터 이전에 수행하고, 테스트 코드에서 `window.location` 모킹을 통해 검증

### 3.2 웹 전용 UI/UX 커스터마이징
- `LibraryWindowTitleBar`를 `isElectron()` 기반 조건부 렌더링으로 변경하고, 웹에서는 드래그 존과 `WebkitAppRegion` 스타일을 제거
- `LibrarySidebar`, `LibraryContent`, `ThemeProvider`에서 `mode` 값을 전달받아 웹 전용 레이아웃/테마 토글(1024px/768px 브레이크포인트)을 구현
- 파일 시스템·클립보드·창 제어 등 Electron 의존 기능에는 버튼 비활성화, 대체 메시지, 가이드 모달을 제공하고 QA 체크리스트에 포함
- Tailwind 유틸 클래스 재사용을 유지하면서, 라이브러리 전용 색상/타이포그래피 토큰을 정리해 추후 디자인 토큰화 기반 마련

### 3.3 빌드 & 배포 파이프라인
- `package.json`에 `build:web`, `preview:web`, `status:web` 스크립트를 추가하고, `cross-env REACT_APP_PLATFORM=web` 설정으로 CRA 빌드를 수행
- `scripts/smoke`에 `run-web-smoke.js`를 추가해 빌드 산출물 기본 라우팅, OAuth 리다이렉트, 핵심 플로우를 실행하는 최소 검증을 자동화
- `vercel.json` 또는 Vercel Dashboard에서 `/?mode=library` 기본 경로 리다이렉트, 미지원 경로에 대한 SPA fallback 설정
- main 브랜치 자동 배포와 프리뷰 브랜치 배포 정책을 정의하고, QA 단계에서 프리뷰 URL과 환경 변수를 체크리스트로 검증

### 3.4 인증 & 환경 구성
- Supabase 프로젝트에 웹 도메인을 등록하고, `docs/env/supabase-matrix.md`(신규)에 `local`/`preview`/`production` 환경별 리다이렉트·키 값을 표 형태로 정리
- `src/shared/hooks/useSupabaseAuth.js`의 `buildRedirectUrl` 로직을 환경 매트릭스 기반으로 수정하고, Electron 브릿지 실패 시 graceful fallback을 구현
- `npm run check:env` 스크립트를 통해 필수 환경 변수 누락 시 CI를 중단하도록 하고, Vercel 환경 변수 관리 절차를 문서화
- 민감 정보는 `.env` 대신 Vercel 환경 변수로 관리하며, 운영/개발 권한 분리를 위한 액세스 정책을 정의

### 3.5 QA 및 운영 준비
- `docs/qa/library-smoke-checklist.md`(신규)에 로그인, 트리 CRUD, 반응형, Electron/Web 토글 등 체크리스트를 정리하고 배포 시마다 갱신
- Smoke 테스트는 Electron(`npm run electron:smoke`)과 웹(`npm run smoke:web`)을 모두 기록해 QA 리포트에 첨부
- 장애 대응 시나리오, 롤백 절차, On-call 연락처를 `docs/ops/library-web-runbook.md`에 문서화하고 주기적 리뷰 절차를 정의
- Sentry/분석 도입 일정은 포스트-MVP 백로그에 유지하되, 에러 로깅/콘솔 경고 기준을 선행 정의해 나중에 쉽게 통합

## 4. 일정 및 마일스톤
| 단계 | 기간(주) | 주요 산출물 | 병행 여부 |
| --- | --- | --- | --- |
| 1. 플랫폼/환경 기초 | 1 | `platform` 유틸·테스트, `.env` 템플릿, `App.js` 리다이렉트, 웹 smoke 스크립트 초안 | 단독 진행 |
| 2. UI/UX 커스터마이징 | 1 | 웹 전용 헤더·사이드바, 반응형 레이아웃, Electron 전용 UI 가드, 기능 제한 메시지 | 단계 1 완료 후 |
| 3. 배포 파이프라인 구축 | 0.5 | `build:web`/`preview:web` 스크립트, Vercel 리다이렉트 설정, 환경 변수 연동, web smoke 자동화 | 단계 2와 병행 가능 |
| 4. QA & 스모크 테스트 | 0.5 | 수동 QA 체크리스트, Electron/Web smoke 리포트, 회귀 이슈 트래킹 | 단계 2~3 산출물 기반 |
| 5. 문서화 & 릴리즈 | 0.5 | 배포 가이드, 환경 변수 매트릭스, 운영 절차 문서, 릴리즈 노트 | 최종 단계 |

## 5. 작업 테스크 상세
### 5.1 플랫폼 & 라우팅 (MVP)
- [ ] `src/shared/utils/platform.js` 및 `__tests__/platform.test.js` 작성으로 플랫폼 감지 로직 중앙화
- [ ] `.env.production`, `.env.electron`, `.env.local`에 `REACT_APP_PLATFORM`/Supabase 키 기본값 템플릿 추가
- [ ] `src/App.js`에서 허용 모드 화이트리스트, `mode=library` 기본화, body 클래스 토글 로직 분리
- [ ] 모드/플랫폼 전환 단위 테스트 및 `npm run electron:smoke`·웹 smoke 스크립트 병행 실행 확인

### 5.2 UI/UX 커스터마이징 (MVP)
- [ ] `LibraryWindowTitleBar` 조건부 렌더링 및 웹 전용 헤더/드래그 존 제거
- [ ] `LibrarySidebar`, `LibraryContent`, `ThemeProvider`에 웹 전용 브레이크포인트/테마 토글 반영
- [ ] 파일 시스템·클립보드·창 제어 등 미지원 기능에 비활성화/대체 메시지 처리 및 QA 항목 추가
- [ ] `<Helmet>` 기반 타이틀/메타 태그 구성, 키보드 네비게이션·포커스 이동 점검

### 5.3 배포 & 호스팅 (MVP)
- [ ] `package.json`에 `build:web`, `preview:web`, `status:web`, `smoke:web` 스크립트 추가
- [ ] `scripts/smoke/run-web-smoke.js` 작성 및 CI 파이프라인에 Electron smoke와 병렬 실행 구성
- [ ] Vercel 프로젝트 생성, main/프리뷰 브랜치 연동, `vercel.json` 리라이트/리다이렉트 설정
- [ ] 웹 배포 상태 확인용 헬스체크 엔드포인트 또는 문서화 완료

### 5.4 인증 & 환경 (MVP)
- [ ] Supabase OAuth 리다이렉트 URL에 웹 도메인(`local`/`preview`/`prod`) 추가 등록
- [ ] `docs/env/supabase-matrix.md`에 환경 변수 매트릭스 및 확인 절차 문서화
- [ ] `npm run check:env` 스크립트 구현으로 필수 환경 변수 누락 시 CI 실패 처리
- [ ] `useSupabaseAuth` 리팩터링으로 플랫폼별 OAuth 플로우 및 fallback 처리 강화

### 5.5 QA & 운영 (MVP)
- [ ] `docs/qa/library-smoke-checklist.md` 수동 QA 템플릿 작성 및 저장소 위치 명시
- [ ] Electron/Web smoke 테스트 실행 후 결과 기록(스크린샷/로그 포함) 공용 위치에 저장
- [ ] `docs/ops/library-web-runbook.md` 운영 가이드(장애 대응, 롤백, 연락체계) 초안 작성

### 5.6 후속 과제 (포스트 MVP)
- [ ] 디자인 토큰 정리 및 Figma 싱크, Tailwind 커스텀 토큰화
- [ ] Lighthouse/SEO 최적화, 웹 성능 지표 자동 수집 파이프라인 구축
- [ ] Sentry/분석 도입 및 알림 정책 설정
- [ ] Playwright/Cypress 기반 자동화 테스트 확대, PWA 및 모바일 최적화
- [ ] 사용자 피드백 채널 구축, 운영 대시보드/데이터 로깅 고도화

## 6. 리스크 및 대응
- **플랫폼 전용 코드 잔존** → `platform` 유틸 기반 가드와 단위 테스트, Electron/Web smoke 병행으로 회귀 차단
- **OAuth/환경 변수 누락** → 환경 변수 매트릭스와 `npm run check:env`로 릴리즈 전 자동/수동 검증
- **배포 설정 오류** → Vercel 프로덕션/프리뷰 분리, 배포 전 `build:web` + `smoke:web` 결과를 QA가 확인하도록 절차화
- **웹 접근성/반응형 이슈** → 1024px/768px QA 시나리오, 키보드 네비게이션 체크리스트로 사전 검증

## 7. 후속 과제
- PWA 및 모바일 최적화, 사용자 피드백 수집 채널 구축, 자동화 테스트 확대 등은 포스트 MVP 백로그에서 관리
- Sentry/분석 도구 도입, 디자인 토큰 정리는 완료 시 운영 문서에 업데이트
- 성능·접근성 지표를 릴리즈 후 지속 측정해 다음 사이클 계획에 반영하고, 실시간 알림·모니터링 체계를 순차 도입
