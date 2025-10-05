# JARVIS Refactor Plan

> 이 문서는 AI가 리팩터링을 수행할 때 따라야 할 **세부 체크리스트**입니다. 각 작업은 최대 30~45분 분량으로 쪼개며, 매 작업 종료 시 사용자에게 **사용자 점검 가이드**를 전달하여 직접 검증을 진행합니다.

## 공통 워크플로우
- [ ] AI: 해당 작업(슬라이스/서브슬라이스)의 목표와 영향을 주는 파일 목록을 명시한다.
- [ ] AI: 코드 수정 후 `npm run electron:dev`(또는 적합한 명령) 실행 가능 여부를 확인한다.
- [ ] AI: 사용자에게 전달할 **사용자 점검 가이드**를 작성한다 (해당 작업에서 변화한 기능 위주, 체크박스 형식).
- [ ] 사용자: 안내받은 체크리스트에 따라 UI/기능을 직접 확인하고 결과를 회신한다.
- [ ] AI: 사용자 피드백을 반영하거나 별도 수정 계획을 세운 뒤 다음 작업으로 이동한다.
> 사용자 점검 가이드를 작성할 때는 각 체크 항목 옆에 "오류 가능 구간"을 함께 명시한다. 예: "[ ] 트리 저장 후 재접속 시 데이터 유지 확인 (오류 가능: Supabase upsert 실패)"처럼 사용자가 어떤 유형의 문제를 살펴봐야 하는지 구체적으로 안내한다.

### 사용자 점검 가이드 템플릿
- [ ] 앱이 실행되고 관련 화면이 정상적으로 렌더링되는지 확인
- [ ] 이번 작업에서 영향을 받은 주요 플로우(예: 트리 노드 CRUD)가 오류 없이 동작하는지 확인
- [ ] 변경 사항이 저장/동기화되는지 확인 (Supabase/Electron 등)
- [ ] 콘솔 및 Electron 로그에 경고/에러가 없는지 확인

> AI는 매 작업을 끝낸 뒤 위 템플릿을 기반으로, 실제 수정된 기능에 맞춘 세부 항목을 제공해야 합니다.

---

## 단계 0: 사전 준비
### 작업 0-1 – 문서/환경 점검
- [x] AI: `docs/architecture.md`, `docs/refactor-plan.md`, `vooster-docs/step-by-step.md`을 읽고 핵심 원칙을 요약한다.
- [x] AI: 현재 빌드 체인이 JavaScript/JSX 기반이며 TypeScript 빌드 파이프라인이 아직 없다는 점을 기록한다.
- [x] AI: 수정 금지 영역(예: 민감 스크립트, 배포 구성)을 문서화한다.
- [x] 사용자: `.env`에 필수 키(OpenAI, Supabase 등)가 있는지 확인하고 미설정 시 알려준다.

### 작업 0-2 – 스크립트 가동성 확인
- [x] AI: `npm run electron:dev`를 실행해 앱이 기동되는지, 빌드 오류가 없는지 확인한다.
- [x] AI: `npm run electron:smoke`(또는 실행 가능한 대체 스크립트)를 시도해 실패 시 원인과 회피 방법을 기록한다.
- [x] 사용자: 앱 실행 중 눈에 띄는 오류가 있으면 공유한다.

---

## 단계 1: 트리 기능 슬라이스
### 작업 1A-1 – 데이터 소스 훅 초안 작성
- [x] AI: `src/components/HierarchicalForceTree.js`에서 Supabase 관련 로직을 탐색하여 호출 지점을 정리한다.
- [x] AI: 기존 `src/features/treeCanvas` 모듈과 겹치는 로직이 없는지 확인하고, 재사용 가능한 부분을 새 구조로 옮길 계획을 세운다.
- [x] AI: `src/features/tree/services/useTreeDataSource.js`(신규 파일) 생성, 이미 존재하는 `fetchTreesWithNodes`, `upsertTreeNodes` 호출을 래핑한다.
- [x] AI: 폴더 구조가 없다면 `src/features/tree/services` 디렉터리를 생성하고 barrel 파일 유무를 점검한다.
- [x] AI: `upsertTreeNodes({ treeId, nodes, userId })` 형태로 호출하도록 컴포넌트 코드를 수정한다.
- [x] AI: 기존 서비스(`supabaseTrees.js`)에서 재사용 가능한 함수 목록을 표로 정리해 주석/문서에 남긴다.
- [x] 사용자 점검: 트리 불러오기/노드 추가 후 새로고침, 저장 유지 여부, 에러 로그 확인.

### 작업 1A-2 – Electron 브리지 어댑터 도입
- [x] AI: `src/infrastructure/electron/bridges/treeWidgetBridge.js` 생성, `window.jarvisAPI` 의존을 이 파일로 감싼다.
- [x] AI: 디렉터리가 비어 있으면 `src/infrastructure/electron/bridges`와 `src/infrastructure/electron` 구조를 생성한다.
- [x] AI: `HierarchicalForceTree`와 서비스 훅에서 직접 `window.jarvisAPI` 호출을 제거하고 브리지를 주입한다.
- [x] AI: 브리지 타입 정의를 `src/infrastructure/electron/types.js`에 추가한다.
- [x] 사용자 점검: 트리 위젯 열기/닫기, 위젯에서 openWidget 핸들링 시 오류 여부 확인.

### 작업 1B-1 – 상태 관리 레이어 추출
- [x] AI: `src/features/tree/state/useTreeState.js` 생성, 기존 컴포넌트의 React `useState` 블록을 이전한다.
- [x] AI: 상태 훅이 반환하는 API(`nodes`, `links`, `setActiveTreeId`, `loadTree`)를 명시한다.
- [x] AI: 컴포넌트는 상태 훅과 데이터 훅을 조합하여 UI 로직만 담당하도록 리팩터링한다.
- [x] 사용자 점검: 트리 모드 전환, 노드 선택/삭제, 상태가 정상적으로 유지되는지 확인.

### 작업 1B-2 – D3 렌더 함수 분리
- [x] AI: D3 관련 함수를 `src/features/tree/ui/d3Renderer.js`와 같은 파일로 이동하고 pure 함수화한다.
- [x] AI: 이동 시 필요한 파라미터/반환 타입을 정의하고, 부수 효과(예: DOM 접근)를 최소화한다.
- [x] AI: 테스트 추가가 필요 없더라도, 새 모듈에 JSDoc/주석으로 사용법을 명시한다.
- [x] 사용자 점검: 줌/패닝, 반응성(윈도우 리사이즈)에 이상이 없는지 확인.

---

## 단계 2: 라이브러리 기능 슬라이스
### 작업 2A-1 – 라이브러리 리포지토리 구축
- [x] AI: `src/features/library/services/libraryRepository.js` 생성하여 폴더/트리 CRUD, 뷰포트 저장, 메모 관리 함수를 이식한다.
- [x] AI: 디렉터리가 없다면 `src/features/library/services` 구조를 먼저 만든다.
- [x] AI: `src/infrastructure/supabase/repositories/treeRepository.js` 등 하위 레벨 모듈로 실제 Supabase 호출을 위임한다.
- [x] AI: `LibraryApp`에서 직접 `supabaseTrees`를 호출하던 부분을 새 서비스 모듈로 교체한다.
- [x] 사용자 점검: 폴더 생성/삭제, 트리 이동 후 새로고침했을 때 데이터 일치 여부 확인.

### 작업 2A-2 – 도메인 모델 정의
- [x] AI: `src/domain/library/models/tree.js`, `folder.js`를 생성하고 공통 타입 정의를 이동한다.
- [x] AI: `src/domain/library/models` 경로가 없다면 먼저 디렉터리를 만든다.
- [x] AI: 서비스/컴포넌트에서 해당 타입을 import하도록 업데이트한다.
- [x] AI: 타입 변경에 따른 런타임 영향(예: undefined 허용 여부)을 검토하여 방어적 코드를 추가한다.
- [x] 사용자 점검: 라이브러리 화면 전반에서 타입 오류로 인한 UI 깨짐이 없는지 확인.

### 작업 2B-1 – 상태 훅 & 컨텍스트 분리
- [x] AI: `LibraryApp`의 로컬 상태를 `src/features/library/state/useLibraryState.js`로 추출한다.
- [x] AI: 디렉터리가 없다면 `src/features/library/state` 폴더를 생성한다.
- [x] AI: 컨텍스트/프로바이더가 필요하다면 `LibraryStateProvider`를 만들고 앱 루트에 연결한다.
- [x] AI: 컴포넌트는 상태 훅에서 제공하는 데이터를 활용하도록 수정한다.
- [x] 사용자 점검: 라이브러리 필터/정렬/선택 상태가 화면 간 이동 후에도 유지되는지 확인.

### 작업 2B-2 – UI 컴포넌트 세분화
- [x] AI: `LibraryApp` 내부 UI를 `TreeList`, `FolderSidebar`, `ActionToolbar` 등 작은 컴포넌트로 분해한다.
- [x] AI: 공통 UI는 `src/shared/components/library/` 아래로 승격시키고 스타일/프롭스를 문서화한다.
- [x] AI: 중복 CSS/스타일을 정리하면서 tailwind-merge와의 호환성을 확인한다.
- [x] 사용자 점검: 리스트 렌더링, 드래그/드롭, 다중 선택 등의 UI가 기존과 동일하게 동작하는지 확인.

---

## 단계 3: Admin & 공통 기능 슬라이스
### 작업 3A-1 – Admin 서비스 모듈화
- [x] AI: `src/features/admin/services/adminWidgetService.js` 생성, Supabase/IPC 호출을 모듈화한다.
- [x] AI: 디렉터리가 없다면 `src/features/admin/services` 구조를 생성한다.
- [x] AI: `AdminWidgetPanel.jsx`는 서비스/상태 훅만 호출하도록 단순화한다.
- [x] AI: 오류 처리/로그 출력을 중앙 모듈로 이동하고, 로그 키를 정리한다.
- [x] 사용자 점검: Admin 패널을 열어 NEW 버튼, 최근 트리 열기, 닫기 기능을 검증한다.

### 작업 3A-2 – Admin 상태/뷰 분리
- [x] AI: `src/features/admin/state/useAdminWidgetState.js`에서 사용자 세션, 로딩 상태, 최근 트리를 관리한다.
- [x] AI: 디렉터리가 없다면 `src/features/admin/state`와 `src/shared/components/admin` 폴더를 생성한다.
- [x] AI: Admin UI를 버튼/배지 등 재사용 가능한 컴포넌트를 분해하고 `shared/components/admin/`에 배치한다.
- [x] 사용자 점검: Admin 패널 UI의 스타일/애니메이션이 기존과 동일한지 확인.

### 작업 3B-1 – 공용 UI 정비
- [x] AI: `shared/ui` 구조를 유지하면서 중복된 shadcn 컴포넌트가 없는지 주기적으로 점검한다.
- [x] AI: 공용 UI 변경 시 `shared/ui` barrel(`index.js`)을 업데이트하고 import 경로가 일관적인지 확인한다.
- [x] 사용자 점검: 위젯/라이브러리/Admin 화면에서 공통 UI 요소가 정상 스타일로 렌더링되는지 확인.

### 작업 3B-2 – 공용 훅/유틸 통합
- [x] AI: `src/hooks`, `src/utils`, `src/lib` 등 분산된 유틸을 `shared/hooks`, `shared/utils`, `shared/lib`로 이동시킨다.
- [x] AI: 디렉터리가 없다면 `src/shared/hooks`, `src/shared/utils`, `src/shared/lib`를 생성한다.
- [x] AI: 이동 과정에서 순환 의존성이 생기지 않도록 import 순서를 조정한다.
- [x] 사용자 점검: 해당 유틸을 사용하는 화면이 모두 정상 동작하는지 샘플링한다 (예: Supabase Auth, Theme 토글 등).

---

## 단계 4: Electron 경계 재정비
- [x] AI: `electron/preload/index.js`로 모듈을 분리하고, 아직 TypeScript 환경이 준비되지 않았음을 문서화한다.
- [x] AI: 디렉터리가 없다면 `electron/preload`와 `electron/preload/channels` 구조를 생성한다.
- [x] AI: 경로 별칭이나 공통 타입 선언이 필요하면 `jsconfig.json` 또는 Electron 번들 스크립트를 업데이트한다.
- [x] AI: 기존 `preload.js`에서 채널 정의를 모듈별로 이동한다 (`channels/settings.js`, `channels/agent.js` 등).
- [x] 사용자 점검: Electron 빌드가 성공하는지, 앱 실행 시 브리지 노출이 정상인지 확인한다.

### 작업 4A-2 – Renderer 브리지 치환
- [x] AI: 트리 도메인 컴포넌트/서비스(`src/services/treeCreation.js`, `src/components/NodeAssistantPanel.js`, `src/components/WindowChrome.js`)에서 `window.jarvisAPI` 호출을 `treeWidgetBridge` 또는 신규 브리지 주입 방식으로 교체한다.
- [x] AI: 라이브러리 화면(`src/components/library/LibraryApp.js`, `src/components/library/LibraryQAPanel.js`)의 IPC 사용을 `src/infrastructure/electron/bridges/libraryBridge.js`(신규)와 상태 훅을 통해 주입형 구조로 전환한다.
- [x] AI: Admin/에이전트/트레이 흐름(`src/services/agentClient.js`, `src/views/DebugDashboard.js`, `src/components/TrayDebugButton.js`)을 `agentBridge`, `trayBridge`, `loggerBridge` 등 전용 브리지로 감싸고 renderer에서는 해당 브리지만 의존하도록 정리한다.
- [x] AI: 인증/설정 훅(`src/shared/hooks/useSupabaseAuth.js`, `src/shared/hooks/SettingsContext.js`)과 오류 대응 UI(`src/components/ErrorRecoveryCard.js`)에서 직접 브라우저 전역 접근을 제거하고 필요한 브리지/서비스로 대체한다.
- [x] AI: `src/infrastructure/electron/types.js`에 신규 브리지 타입을 추가하고 각 브리지 파일에 JSDoc 시그니처를 작성한다.
- [x] AI: 브리지 모듈을 묶는 barrel(`src/infrastructure/electron/bridges/index.js`)을 도입해 import 경로를 통일하고 테스트 시 대체 주입이 가능하도록 한다.
- [x] AI: 전역 검색으로 남은 `window.jarvisAPI` 호출을 점검하고 치환이 어려운 케이스는 문서화 후 후속 작업으로 남긴다.
- [x] AI: 필요 시 Jest mock 또는 수동 목을 제공하여 테스트/개발 환경이 문제없이 돌아가게 한다.
- [ ] 사용자 점검: 핫키, 트레이 메뉴, OAuth 리다이렉션 등 IPC 기반 기능을 실행해 오류 여부 확인.

### 작업 4B-1 – Main 모듈 분리
- [ ] AI: 기존 `electron/main.js`에서 BrowserWindow 생성/포커스/토글 로직을 `electron/main/app-window/index.js`로 이전하고 `createMainWindow`, `ensureWindowFocus` 등 함수 단위로 재구성한다.
- [ ] AI: 디렉터리가 없다면 `electron/main/app-window`, `electron/main/ipc-handlers`, `electron/main/bootstrap` 등을 생성하고 기존 `electron/hotkeys`, `electron/tray`, `electron/accessibility` 모듈의 내보내기를 정리한다.
- [ ] AI: `electron/main/ipc-handlers/agent.js`, `electron/main/ipc-handlers/settings.js`, `electron/main/ipc-handlers/logs.js` 등으로 IPC 등록을 나누고 `registerXHandlers` 패턴을 적용한다.
- [ ] AI: `electron/main/auth/index.js`를 도입해 OAuth 서버, 딥링크 처리, `pendingOAuthCallbacks` 관리를 캡슐화한다.
- [ ] AI: `electron/main/index.js`는 앱 생명주기 초기화와 모듈 주입만 담당하도록 단순화하고 각 모듈에 필요한 의존성을 명시적으로 전달한다.
- [ ] AI: 새로운 구조와 맞물려 preload/renderer에서 기대하는 채널 이름이나 초기 데이터가 변경되지 않았음을 검증하고 문서에 반영한다.
- [ ] 사용자 점검: 앱 기동/종료, 창 토글, OAuth 콜백, 에이전트 호출 흐름을 점검한다.

### 작업 4B-2 – 로깅/설정 모듈화
- [ ] AI: `electron/logger.js`와 `electron/settings.js`를 각각 `electron/main/logger.js`, `electron/main/settings.js`로 이동시키고 의존성 주입 함수(`createLogBridge`, `createSettingsStore`)를 분리한다.
- [ ] AI: 로깅 모듈에서 파일 경로/보존 정책 상수를 `electron/main/logger/constants.js` 등의 구조로 분리하고 JSDoc으로 외부 API를 문서화한다.
- [ ] AI: 설정 모듈에서 IPC 핸들러와 preload 브리지가 기대하는 메서드 시그니처(`getSettings`, `updateSettings`, `onSettings`)를 명확히 하고 단위 테스트 또는 수동 검증 스크립트를 준비한다.
- [ ] AI: renderer 브리지(`settingsBridge`, `logsBridge`)와 main 모듈 간 계약 변경 사항을 `docs/architecture.md` 혹은 해당 섹션에 기록한다.
- [ ] AI: 로그/설정 경로가 운영 환경에서 올바르게 동작하는지 수동 테스트 지침을 포함한다.
- [ ] 사용자 점검: 로그 내보내기, 설정 저장/로드 기능을 실행해 결과 파일과 로그를 확인한다.

---

## 단계 5: 안정화 & 문서화
### 작업 5-1 – 문서 싱크업
- [ ] AI: 리팩터링 진행 중 발견한 변경 사항을 `docs/architecture.md`, `docs/refactor-plan.md`에 반영했는지 확인한다.
- [ ] AI: README 또는 CHANGELOG에 리팩터링 진행 상황과 주요 변경을 기록한다.
- [ ] 사용자 점검: 문서 업데이트 내용을 확인하고 추가로 필요한 안내가 있는지 피드백한다.

### 작업 5-2 – 최종 검증
- [ ] AI: `npm run electron:smoke`(가능 시)와 핵심 기능 수동 체크리스트를 수행한다.
- [ ] 사용자: 전체 앱 시연(위젯, 라이브러리, Admin, OAuth, 로그)을 진행하고 최종 동작 여부를 확정한다.
- [ ] AI: 남은 이슈/테크빚을 TODO 리스트로 정리해 저장한다.

---
**주의**: 각 작업 사이에 새로운 의존성이나 예상치 못한 문제를 발견하면, 반드시 사용자의 확인을 받고 작업 순서를 조정하거나 범위를 축소하십시오.
