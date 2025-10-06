# Renderer & Supabase Refactor Status (2025-10-06)

---
### 진행 요약
- Stage 6A-1 ~ 6A-3 완료 (트리 파일 구조 개편 + Supabase 서비스 이동)
- Stage 6A-4 수동 테스트 가이드 초안 작성 완료, 사용자 검증 대기
- Stage 6B-1 ~ 6B-2 완료 (라이브러리 UI/서비스 `features/library` 재배치 + ThemeProvider 공유화)
- Stage 6B-3 이후 ~ 6F 미착수

### 현재 구조
- `src/features/tree/ui|services|state|utils` : 트리 UI/상태/서비스 통합
- `src/features/library/ui|services|state` : 라이브러리 화면/서비스 재배치 완료
- `src/features/admin/ui|services|state` : Admin 패널 UI/상태/서비스 통합
- `src/shared/components/admin/AdminWidgetControlBar.jsx` : 공용 Admin UI 유지
- `src/infrastructure/supabase/services/treeService.js` : Supabase 쿼리/트리 저장 로직

### 남은 작업 (Stage 6 Roadmap)
1. **6C** : 관리자 기능 구조 재정비
2. **6D** : shared/infrastructure 통합 (drag utils 등)
3. **6E** : Domain 계층 승격 검토 (선택)
4. **6F** : 문서 업데이트, README/CHANGELOG 갱신, 최종 검증

### 라이브러리 구조 변경 메모 (2025-10-07)
- `LibraryApp` 및 주요 서브 컴포넌트를 `src/features/library/ui/**`로 이동 완료
- `ThemeProvider`를 `src/shared/components/library/ThemeProvider.js`로 이전하여 트리/라이브러리 공용 컨텍스트 통합
- Legacy `src/components/library` 디렉터리 제거 (미사용 Sidebar/Widget 뷰 포함)
- `TreeCanvas`가 `features/treeCanvas/WidgetTreeView`를 직접 참조하도록 경로 정리

### 기타 변경 메모 (2025-10-07)
- 미사용 실험용 `SettingsPanel` 컴포넌트를 삭제하여 노출되지 않는 설정 UI 잔재 제거
- `AdminWidgetPanel`을 `src/features/admin/ui`로 이동해 Stage 6C 구조 정비 착수
- `MarkdownMessage`를 `src/shared/components/markdown`으로 이동하고 사용되지 않는 공용 UI(HotkeyRecorderModal, AccessibilityPermissionBanner, ChatWindow) 제거

### Admin 브리지/구조 점검 메모 (2025-10-07)
- `createAdminBridge` ↔ `electron/preload/channels/admin.js` ↔ `electron/main/ipc-handlers/admin.js`가 `admin-panel:ensure/close` 경로로 연결됨
- `electron/main/admin-panel.js`가 `ensureAdminPanelWindow`/`closeAdminPanelWindow`를 제공하고 App 라우팅(`mode=admin-panel`)이 `features/admin/ui/AdminWidgetPanel`을 로드함
- `features/admin/services/adminWidgetService.js`가 `jarvisAPI.openAdminPanel/closeAdminPanel`을 통해 창 토글을 요청

### Shared/Infrastructure 정리 메모 (2025-10-07)
- `MarkdownMessage`를 `shared/components/markdown`으로 승격하고 legacy 공용 컴포넌트 제거
- tree 드래그 관련 서비스(`DragStateManager` 등)를 `features/tree/services/drag`로 이동해 `src/services` 잔재 제거
- AI 브리지 클라이언트(`agentClient`)를 `infrastructure/ai/agentClient.js`로 이동해 Electron 연동 코드를 infrastructure 계층으로 통합

### Domain 후보 메모 (2025-10-07)
- Tree 계산/레이아웃 로직: `features/tree/services/{DataTransformService,TreeLayoutService,TreeSummaryService,NodeNavigationService}` → `domain/tree` 이동 검토
- 대화 정규화: `features/tree/utils/conversation.js` → Stage 7에서 도메인화하거나 공용 util로 재구성 예정
- 라이브러리 도메인 모델(`domain/library/models/*`)은 Stage 7 이후 트리 도메인과 일관성 맞춰 확장 필요

### 라이브러리 브리지 점검 메모 (2025-10-07)
- `electron/preload/channels/library.js` ↔ `electron/main/ipc-handlers/library.js` 간 `library:show`, `library:request-refresh`, `library:refresh` IPC 경로 확인
- Renderer(`src/features/library/ui/LibraryApp.js`)에서 `libraryBridge.onLibraryRefresh` 구독이 존재하고 refresh 요청 시 `refreshLibrary` 실행됨
- 설정 변경 브로드캐스트: `SettingsContext`가 `createSettingsBridge.onSettings`를 통해 `settings:changed` 이벤트를 수신하고, 메인 프로세스(`electron/main/index.js`)가 라이브러리/위젯 창으로 동일 이벤트 전달함
- 결론: Stage 6B-3 요구사항(IPC 계약 및 설정 방송 검증) 충족

### 트리 기능 사용자 점검 가이드 (2025-10-07)
- [ ] 앱 실행 후 트리 화면이 로드되고 기존 트리 목록이 표시되는지 확인 (오류 가능: `fetchTreesWithNodes` 호출 실패 또는 Supabase 인증 만료)
- [ ] 기존 트리에서 노드를 추가/수정/삭제한 뒤 저장 버튼 또는 자동 저장이 정상적으로 동작하는지 확인 (오류 가능: `upsertTreeNodes` 실패, 네트워크 타임아웃)
- [ ] 새 트리를 생성하거나 빈 트리로 전환 후 노드를 작성하고 창을 닫았다가 재접속했을 때 데이터가 유지되는지 확인 (오류 가능: 빈 트리 추적 `treeCreation` 상태 미동기화)
- [ ] 트리 노드 대화를 열었을 때 최근 메시지가 보존되고 폴백 대화가 적절히 표시되는지 확인 (오류 가능: `sanitizeConversationMessages`가 비정상 메시지를 제거하거나 로컬 스토어 동기화 실패)
- [ ] 트리 보기 모드 전환(Force/Tidy) 및 테마 변경 시 UI가 정상적으로 반응하고 콘솔에 에러가 없는지 확인 (오류 가능: D3 렌더러 상태 불일치, 테마 상태 컨텍스트 누락)

### 라이브러리 사용자 점검 가이드 (2025-10-07)
- [ ] 라이브러리 모드로 진입 시 화면이 정상 로드되고 ThemeProvider 적용으로 다크/라이트/글래스 테마 전환이 가능한지 확인 (오류 가능: `ThemeProvider` 로컬스토리지 키 충돌)
- [ ] 트리 목록/폴더 목록이 표시되고 폴더 확장·축소, 트리 선택이 정상적으로 반응하는지 확인 (오류 가능: `useLibraryState` 상태 동기화 실패)
- [ ] 트리 세부 화면에서 Force/Widget 뷰 전환 및 노드 클릭이 유지되는지, 삭제/갱신 시 오류가 없는지 확인 (오류 가능: `TreeCanvas` 경로 변경으로 위젯 렌더 실패)
- [ ] Voran Box Manager 열기/닫기, 드래그 앤 드롭 이동/폴더 생성 기능이 정상 동작하는지 확인 (오류 가능: `VoranBoxManager` 재배치 후 테스트 미조정)
- [ ] 새 폴더/트리 생성 다이얼로그가 열리고 저장 후 목록이 즉시 갱신되는지 확인 (오류 가능: `CreateDialog` 폴더 경로 변경에 따른 imports 오류)

### 관리자 패널 사용자 점검 가이드 (2025-10-07)
- [ ] 앱을 `?mode=admin-panel`로 실행했을 때 패널이 상단 우측에 표시되고 최근 트리 목록이 2건까지 로드되는지 확인 (오류 가능: `loadRecentTrees`에서 Supabase 호출 실패)
- [ ] “NEW” 버튼 클릭 시 새 트리가 생성되고 위젯이 열리며 라이브러리 목록이 새로고침되는지 확인 (오류 가능: `createAndOpenTree` / `requestLibraryRefresh` IPC 실패)
- [ ] “라이브러리 열기” 버튼 및 로고 클릭이 라이브러리 창을 정상적으로 표시하는지 확인 (오류 가능: `showLibraryWindow` IPC 실패)
- [ ] 패널을 닫거나 로그인 세션이 끊겼을 때 `closeAdminPanel`이 호출되어 창이 닫히는지 확인 (오류 가능: `admin-panel:close` IPC 실패)
- [ ] 아이템이 없는 계정으로 로그인 시 오류 없이 빈 상태가 유지되는지, 실패 시 로그에 `admin_panel_recent_tree_load_failed` 이벤트가 남는지 확인

### 환경 메모
- `.env` : 프로젝트 루트에 위치, Electron 메인에서 `..` → `../..` 로드 수정 완료
- OpenAI 키 로딩 정상 (fallback 메시지 제거됨)
- Supabase URL/키는 `.env`의 `REACT_APP_SUPABASE_URL/ANON_KEY`

### 참고 문서
- 진행 계획: `docs/render-refactor-plan.md`
- 상태 개요: `docs/refactor-plan.md`, `docs/render-refactor-status.md`
- 앱 실행: `npm run electron:dev`
- 로그: `~/Library/Application Support/hierarchical-force-tree-react/logs/app.log`

- ### Stage 6 사용자 점검 요약 (2025-10-07)
- ✅ 라이브러리 사용자 가이드 5개 항목 확인 (사용자 수동 검증 완료)
- ✅ 관리자 패널 사용자 가이드 5개 항목 확인 (사용자 수동 검증 완료)
- ✅ 트리 기능 사용자 가이드 5개 항목 확인 (사용자 수동 검증 완료)
- ✅ 전체 Electron 앱 smoke 수행 (사용자 보고)

### Stage 6 이후 TODO 메모
- Stage 6C-4, 6F-3: 사용자 점검 결과 수집 후 문서에 반영
- Stage 6E-2, 6E-3: 트리 도메인 로직(`TreeLayoutService` 등)을 `domain/tree`로 승격하고 단위 테스트 보강 (Stage 7 병행 고려)
- Stage 7: 초대형 컴포넌트 분해(`useLibraryData`, `useTreeViewport`, `useConversationStore` 등) 및 도메인 추출
- Stage 8 제안: Admin/Library 문서화, QA 자동화(선택)

### Stage 7A-1 구조 진단 (2025-10-07)
- **LibraryApp (1085 lines)**
  - 책임: Supabase CRUD, Electron bridge 연동, empty-tree 정리, 테마/모달 상태 관리, 드래그/폴더 조작 이벤트 처리
  - 주요 의존성: `useLibraryState`, `createLibraryBridge`, `createTreeForUser`, `useTheme`, Supabase repository 함수
  - 개선 포인트: 데이터 로딩/저장 로직을 `useLibraryData` 훅으로, 드래그/네비게이션 로직을 `useLibraryDrag`, 모달/대화 상자 제어를 `useLibraryDialogs` 등으로 분리 필요
  - Stage 7A-2 준비: `features/library/hooks/{useLibraryData,useLibraryDialogs,useLibraryDrag}.js` 초안 추가
- **VoranBoxManager (1357 lines)**
  - 책임: 로컬 선택/드래그 상태, 드래그 미리보기 DOM, 폴더/트리 컨텍스트 메뉴, 토스트/알림, 키보드 네비게이션
  - 주요 의존성: `shared/ui` 버튼/입력, `trees`/`folders` prop, 내부 toasts/drag utils
  - 개선 포인트: 드래그 상태/미리보기 로직을 훅(`useVoranDragPreview`), 토스트 관리(`useToastQueue`), 리스트 네비게이션(`useFolderNavigation`) 등으로 분리
- **TreeCanvas (≈150 lines)**
  - 책임: ForceDirectedTree vs WidgetTreeView 렌더 스위칭, 리사이즈 관찰, 날짜 포매팅, 새 루트 생성 콜백
  - 주요 의존성: `features/tree/ui/tree2/ForceDirectedTree`, `features/treeCanvas/WidgetTreeView`, `lucide-react` 아이콘
  - 개선 포인트: 뷰어 선택 로직과 렌더 컴포넌트를 분리(`TreeCanvasViewSwitcher`), 날짜 포맷/노드 메타 표시를 별도 프레젠테이션 컴포넌트로 이동
- **공통 위험 요소**: 브리지 호출(`libraryBridge`, `treeCreation`), Supabase 저장, 드래그 처리 등 부수효과가 UI 컴포넌트 내부에 혼재 → Stage 7A-2에서 커스텀 훅으로 추출 필요

### Stage 7A-2 커스텀 훅 적용 (2025-10-07)
- `LibraryApp`가 `useLibraryData` 훅을 통해 Supabase/Electron 연동·빈 트리 정리·생성/삭제/이름변경 로직을 캡슐화
- UI 컴포넌트에서는 확인/선택과 같은 프리젠테이션 로직만 수행하며, 훅은 `setTrees`/`setFolders`/`setLoading` 등 상태 갱신을 담당
- 노드 삭제 시 훅의 `handleNodesRemove`를 통해 Supabase 연동을 추상화하고, 실패 시 사용자에게만 경고하도록 처리
- Voran Box, 드래그, 모달 로직은 Stage 7A-3에서 추가 분리 예정

업데이트: 2025-10-06 17:20 KST
---
