# 랜딩 → 로그인 → 라이브러리 플로우 구현 계획

## 1. 배경 및 사용자 여정
- 현재 웹 배포 준비 단계에서 기본 플로우를 **랜딩 페이지 → 로그인 화면 → 라이브러리 메인**으로 단순화하려고 함.
- 기획 기준 화면 레퍼런스  
  - 랜딩: `/Users/cosmos/Documents/dev/JARVIS/cap/스크린샷 2025-10-16 오전 5.57.13.png`  
  - 로그인: `/Users/cosmos/Documents/dev/JARVIS/cap/스크린샷 2025-10-16 오전 5.58.14.png`
- 랜딩에서 `Login` 또는 `Start for Free` 버튼을 누르면 동일한 로그인 화면으로 이동하도록 한다.

## 2. 목표
1. 랜딩 화면을 웹 엔트리(`/`)에 노출하고 CTA가 `/login` 경로를 호출하도록 구성한다.
2. 로그인 화면에서는 Supabase OAuth 기반 세션을 처리하고 성공 시 `/app` (라이브러리)로 라우팅한다.
3. 인증되지 않은 사용자가 `/app`에 접근하면 `/login`으로 리다이렉트되어 로그인 프로세스를 강제한다.
4. 기존 Electron/위젯 모드(`mode` 쿼리)와 충돌하지 않도록 웹 전용 라우팅과 런타임 분기 전략을 정립한다.

## 3. 주요 산출물
- `react-router-dom`을 도입한 웹용 라우팅 뼈대(`/, /login, /app, /auth/callback`).
- 외부 프로젝트에서 가져온 랜딩 컴포넌트를 현재 코드베이스 구조(`src/views` 또는 `features/landing`)에 맞게 리팩터링한 모듈.
- 로그인 화면(`SupabaseAuthGate` 기반)과 라이브러리 진입 가드를 포함한 `/login`, `/app` 라우트 구성.
- Supabase OAuth 리다이렉트 URL 및 환경 변수 매핑 가이드 문서 업데이트.
- QA 체크리스트(랜딩 CTA → 로그인 → 라이브러리, 직접 URL 접근, 세션 만료, 오류 처리).

## 4. 구현 단계
### 4.1 라우팅 기반 마련
- `react-router-dom`을 설치하고 `App` 또는 `WebApp` 엔트리에서 `BrowserRouter`로 감싼다.
- `/`는 랜딩, `/login`은 로그인 화면, `/app`은 라이브러리, `/auth/callback`은 Supabase OAuth 콜백을 담당하도록 선언한다.
- Electron/위젯 모드가 필요한 경우, 런타임에 따라 기존 `mode` 쿼리 전략과 라우팅 전략을 병행(웹은 라우트 우선, Electron은 기존 로직 유지)한다.

### 4.2 랜딩 페이지 통합
- 외부 프로젝트 랜딩 컴포넌트를 `src/features/landing` (또는 `src/views/LandingPage`)로 이동하고 에셋 경로를 정리한다.
- CTA 버튼이 `useNavigate` 혹은 `<Link to="/login">`를 사용해 로그인 화면으로 이동하도록 수정한다.
- SEO/OG 메타태그가 필요하다면 `public/index.html` 또는 추후 Next.js 전환 시점을 고려해 TODO로 남긴다(현재 범위 제외).

### 4.3 로그인 화면 구성
- `/login` 경로에서 `SupabaseAuthGate`를 `mode="library"`로 렌더링해 기존 인증 컴포넌트를 재사용한다.
- 로그인 성공 시 `navigate("/app", { replace: true })` 형태로 라이브러리 화면으로 이동하도록 `SupabaseAuthGate` 혹은 상위 래퍼 컴포넌트에서 후처리한다.
- 오류/로딩 상태는 현재 컴포넌트 UI를 유지하되, 필요 시 랜딩과 톤앤매너를 맞추도록 스타일링 조정한다.

### 4.4 라이브러리 접근 제어
- `/app` 라우트에서 `SupabaseAuthGate`를 가드로 사용해 세션이 없으면 `/login`으로 이동시키는 로직을 추가한다.
- `useSupabaseAuth` 훅에서 OAuth 콜백 후 `from_oauth`, `mode` 등을 정리하고 올바른 라우트로 리다이렉트되도록 확인한다.
- 세션 만료 시나리오에서 `/app` 접근 → `/login` 리다이렉트가 확실히 동작하도록 `onAuthStateChange` 처리 흐름을 점검한다.

### 4.5 환경 변수 및 배포 설정
- Supabase 리다이렉트 URL 환경 변수(`REACT_APP_SUPABASE_REDIRECT_URL_<ENV>`)를 `https://<도메인>/auth/callback` 형태로 업데이트하고 문서화한다.
- `build:web` 스크립트 실행 시 위 라우팅이 정상 작동하는지 로컬 검증하고, Preview/QA 환경 주소를 정리한다.

## 5. 리스크 및 대응
- **Electron 영향도**: 기존 Electron 모드가 라우팅 도입으로 영향을 받을 수 있으므로, `isElectron()` 가드를 통해 웹 전용 라우트를 분기한다.
- **OAuth 콜백 중복 처리**: `useSupabaseAuth`의 콜백 정리 로직이 라우터 도입 이후에도 의도대로 동작하는지 통합 테스트 필요.
- **정적 자산 경로**: 랜딩 페이지 이미지/아이콘이 CRA 빌드 시 public 경로에 맞게 배치되어야 함.

## 6. 검증 계획
- 시나리오 테스트
  1. `/` 접속 → CTA 클릭 → `/login` 전환 → Google/Kakao 로그인 → `/app` 진입.
  2. 로그인 상태에서 `/` 또는 `/login` 접근 시 `/app`으로 리다이렉트(또는 안내).
  3. 비로그인 상태 `/app` 직접 접속 → `/login` 리다이렉트.
  4. OAuth 콜백 URL 직접 호출(`/auth/callback?code=...`) → 세션 설정 후 `/app` 이동.
- 자동화 고려: Playwright 스모크 테스트에 랜딩→로그인→라이브러리 플로우를 추가하는 것을 차기 작업으로 검토한다.

## 7. 일정 및 역할 제안
1. **Day 1**: 라우팅 뼈대 구축, 랜딩 컴포넌트 이관.
2. **Day 2**: 로그인 페이지 라우트 및 라이브러리 가드 로직 구현, 환경 변수 정리.
3. **Day 3**: 통합 테스트, QA 체크리스트 작성, 산출물 리뷰 및 배포 준비.

## 8. 후속 조치
- 디자인/UX 팀과 랜딩-로그인 간 톤앤매너 검토.
- Supabase 콘솔에서 리다이렉트 URL 등록 확인.
- 배포 후 사용자 피드백 수집 및 A/B 테스트(추후 과제로 분리).
