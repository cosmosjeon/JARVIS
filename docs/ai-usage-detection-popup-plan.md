# AI 도메인 감지 기반 위젯 전환 계획

## 1. 배경 및 목표
- 경쟁 서비스(https://chatgpt.com, https://gemini.google.com, https://claude.ai) 접속을 실시간으로 탐지해 JARVIS 트리 위젯 사용을 유도.
- 감지 시 즉시 팝업을 띄워 `새 트리 열기` 액션을 제공하고, 클릭 순간 `createAndOpenTree` → `openWidget` 플로우로 전환.
- 운영자/사용자 설정에 따라 감지 기능 토글, 쿨다운, 도메인 확장/차단을 제어할 수 있도록 설계.

## 2. 범위 정의
### 2.1 감지 대상
- 기본 도메인: `chatgpt.com/*`, `gemini.google.com/*`, `claude.ai/*`
- 브라우저: Chrome/Chromium 계열 1순위, Safari(macOS) 2순위. 기타 브라우저는 후속 백로그로 관리.

### 2.2 제외 범위
- 모바일 브라우저, iOS/Android 앱 감지는 본 계획에서 제외.
- 브라우저별 확장 스토어 등록/배포 절차는 후속 운영 문서에서 다룸.

## 3. 추진 전략 요약
- **브라우저 감지 확장**: Manifest v3 기반 확장 + Native Messaging 호스트로 URL 이벤트 수집.
- **Electron 서비스 연동**: 감지 결과를 메인 프로세스에서 수신 후 IPC로 렌더러에 브로드캐스트.
- **팝업 UX**: 위젯/관리자 패널 공용 Provider를 통해 팝업 상태 관리, `새 트리 열기` 액션 연결.
- **설정/쿨다운**: `settingsManager`와 연동해 감지 토글, 도메인 목록, 쿨다운 분 단위 설정 제공.
- **QA/로깅**: 자동/수동 테스트 시나리오 확보, 감지 성공·거부 로그 수집.

## 4. 모듈별 세부 작업

### 4.1 Browser Activity Monitoring Service
#### 목표
- 브라우저 탭 URL이 감지 대상 도메인과 일치할 경우 즉시 Electron으로 알림을 전송한다.

#### 선행 조건
- Native Messaging 호스트 실행 권한 및 설치 경로 확보.
- 사용자에게 확장 설치 및 접근성 권한을 안내할 초기 온보딩 문구 준비.

#### 작업(Task)
1. **Manifest 정의**  
   - 감지 URL 패턴(`*://chatgpt.com/*` 등) 등록.  
   - `tabs` 권한, `activeTab`, `nativeMessaging` 권한 선언.
2. **Background Service Worker 구현**  
   - 탭 업데이트/활성화 이벤트 리스너에서 URL 필터링 후 디바운싱 처리.  
   - Native Messaging 포트 연결 관리(재시도, 예외 로깅).
3. **Native Messaging 호스트 스크립트** (`electron/native-messaging/host.js`)  
   - URL 이벤트를 JSON으로 수신해 Electron main 프로세스로 전달.  
   - 호스트 설치 스크립트(macOS plist, Windows 레지스트리) 작성.
4. **macOS Safari 보조 플랜**  
   - AppleScript + Accessibility API 조합으로 활성 탭 URL 조회.  
   - 2초 주기 폴링, 성공 시 동일 이벤트 포맷으로 전송.
5. **서비스 관리자** (`electron/services/browser-activity-service.js`)  
   - 확장/스크립트 프로세스 실행, 상태 모니터링, 실패 시 재기동.  
   - 감지 이벤트 디바운싱(기본 5분), 쿨다운 값은 설정에서 읽어온다.

#### 산출물
- 확장 번들 + 설치 가이드
- Native Messaging 호스트 실행 바이너리/스크립트
- 서비스 상태 로깅(`browser_activity` 채널)

#### 담당
- 인프라 & 플랫폼 엔지니어 (브라우저 확장, 호스트)
- macOS 클라이언트 엔지니어 (Safari 보조 로직)

### 4.2 Native Messaging & IPC Bridge
#### 목표
- 감지 서비스에서 발생한 이벤트를 안전하게 Electron 렌더러들에 브로드캐스트한다.

#### 작업(Task)
1. **메인 프로세스 수신 로직** (`electron/main/bootstrap/appBootstrap.js`)  
   - `createBrowserActivityService()` 초기화, 상태 변경 시 로거 연동.
2. **IPC 채널 추가** (`electron/main/bootstrap/ipc.js`)  
   - `registerDetectionHandlers` 신규 작성.  
   - 이벤트명: `activity:detection`, 페이로드에 도메인, URL, 감지 시각 포함.
3. **Renderer 브리지** (`src/infrastructure/electron/bridges/detectionBridge.js`)  
   - `onDetection`/`ackDetection` 핸들러 구현.  
   - tree widget, admin panel 양쪽에서 동일하게 사용할 수 있도록 export.
4. **디바운싱/쿨다운 공유 상태**  
   - 메인 프로세스에서 마지막 감지 시각, 무시 설정을 저장해 중복 방송을 차단.
5. **에러 복구 및 로깅**  
   - 호스트 연결 끊김 감지 시 재연결, 실패 횟수 제한 초과 시 사용자에게 경고 팝업 요청.

#### 산출물
- IPC 핸들러/브리지 코드
- 로깅 스키마(감지 성공/실패/무시)

### 4.3 Detection Popup UX
#### 목표
- 감지 이벤트 도착 시 사용자에게 “우리 앱을 사용하세요” 팝업을 제공하고 즉시 트리 위젯으로 연결한다.

#### 작업(Task)
1. **상태 Provider** (`src/shared/state/DetectionProvider.jsx`)  
   - 감지 이벤트 큐 관리, 쿨다운/무시 상태 저장.  
   - 설정 값(`cooldownMinutes`, `dismissForever`) 반영.
2. **팝업 컴포넌트** (`src/shared/components/detection/DetectionPrompt.jsx`)  
   - 메시지: “AI 회의 도중이신가요? JARVIS 트리 위젯으로 회의록을 시작해 보세요.”  
   - CTA 버튼: `새 트리 열기` → `createAndOpenTree({ userId })` 호출 후 `openWidget`.  
   - 보조 버튼: `나중에`, `이번 세션에는 보지 않기`.
3. **애니메이션 & 테마**  
   - `framer-motion`으로 float-in/out, 다크/라이트 테마 지원.  
   - 접근성: 키보드 포커스 순서, ARIA 라벨 지정.
4. **위젯/패널 통합**  
   - `App.js`에서 Provider 래핑, `HierarchicalForceTree` 및 `AdminWidgetPanel`에서 팝업 표시.
5. **i18n 및 문자열 관리**  
   - 다국어 확장 대비 `shared/i18n` 사용 혹은 문자열 상수 분리.

#### 산출물
- 팝업 UI/상태 컴포넌트
- 사용자 액션 플로우 도식
- 접근성 검사 체크리스트

### 4.4 Settings & Persistence
#### 목표
- 감지 기능에 관한 사용자 설정을 저장·적용하고 Native 서비스와 동기화한다.

#### 작업(Task)
1. **설정 스키마 확장**  
   - `settingsManager`: `detection.enabled`, `detection.cooldownMinutes`, `detection.dismissedDomains`, `detection.neverShow` 추가.
2. **설정 UI** (`AdminWidgetPanel` 또는 별도 설정 페이지)  
   - 토글 스위치, 도메인 목록 관리, 쿨다운 입력(분 단위), “다시 보이기” 버튼.
3. **IPC 연동**  
   - Renderer에서 설정 변경 시 메인 프로세스로 전송 → 감지 서비스 재구성.
4. **로컬 캐시**  
   - 팝업에서 “이번 세션 무시” 선택 시 세션 스토리지로 기록.  
   - “다시는 보지 않기”는 settingsManager를 통해 영구 저장.
5. **설정 로딩/초기화**  
   - 앱 시작 시 설정 브로드캐스트, 감지 서비스가 이를 반영하도록 구현.

#### 산출물
- 설정 스키마 및 마이그레이션 문서
- UI 스크린샷 및 사용자 안내

### 4.5 QA & Telemetry
#### 목표
- 감지 기능의 정확성과 사용자 반응을 측정하고 장애 대응을 준비한다.

#### 작업(Task)
1. **자동 테스트**  
   - Native Messaging 호스트 단위 테스트.  
   - 감지 이벤트 모킹 → 팝업 노출 → CTA 액션 E2E 테스트(Playwright).
2. **수동 체크리스트**  
   - 브라우저별 감지 성공/실패 케이스, 권한 거부 시나리오 문서화.  
   - 팝업 UI/접근성 점검 항목 정의.
3. **로깅/분석**  
   - 감지 발생, 사용자 선택(CTA, 무시), 에러 로그를 LLM/분석 시스템으로 전송.  
   - 성공률/거부율 일간 리포트 포맷 정의.
4. **릴리즈 준비**  
   - 확장 업데이트 절차, Native Messaging 배포 체크리스트, 롤백 플로우 마련.

#### 산출물
- QA 체크리스트 및 테스트 스크립트
- 로그 이벤트 명세 및 대시보드 요구사항
- 릴리즈/롤백 가이드

## 5. 일정 및 마일스톤 (예시)
| 단계 | 기간(주) | 주요 산출물 | 병행 가능 여부 |
| --- | --- | --- | --- |
| 1. 감지 서비스 프로토타입 | 1 | Chrome 확장 + Native 호스트, 이벤트 로그 | 단독 진행 |
| 2. IPC & 팝업 통합 | 1 | IPC 브리지, Detection Provider/팝업 UI | 단계 1 완료 후 |
| 3. 설정 연동 & QA | 1 | 설정 UI/스키마, 자동/수동 테스트 | 단계 2와 부분 병행 |
| 4. 운영 준비 & 문서화 | 0.5 | 설치 가이드, 로그/대시보드, 릴리즈 체크리스트 | 최종 단계 |

## 6. 리스크 및 대응
- **브라우저 권한 거부/확장 비활성화** → 확장 상태 모니터링, 사용자 알림 팝업, 대체 폴백(UI에서 직접 활성화 안내).  
- **Native Messaging 설치 난이도** → OS별 설치 스크립트 및 자동 업데이트 절차 마련.  
- **과도한 팝업 노출로 인한 UX 저하** → 기본 쿨다운(5분) + 사용자 설정 + “다시는 보지 않기” 옵션 제공.  
- **다중 모니터/브라우저 프로필** → 이벤트 페이로드에 윈도우/프로필 식별자 포함, 중복 감지 방지.  
- **트리 생성 실패** → CTA 실행 시 예외 처리(토스트/재시도)와 오류 로깅.

## 7. 후속 백로그
- Edge, Firefox 등 추가 브라우저 지원.
- 모바일/태블릿 감지(별도 앱 또는 딥링크 전략) 연구.
- 팝업에서 추천 템플릿 제안, 자동 회의록 시작 워크플로우 연동.
- 사용자 세그먼트별 감지 도메인 커스터마이징 정책.

