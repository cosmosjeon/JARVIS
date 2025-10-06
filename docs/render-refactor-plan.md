# Renderer 구조 재정비 계획 (Stage 6)

> 목표: `src/`를 목표 아키텍처(Feature-first + Shared/Infrastructure 분리)에 맞춰 정리하고, 남아있는 레거시 디렉터리를 단계적으로 마이그레이션한다.

## 가이드라인 복습
- Feature slice 우선: `src/features/<domain>`에 UI/상태/서비스를 모은다
- Shared 계층은 진입점(디자인 시스템/공용 유틸)만 담당
- Infrastructure는 Electron/Supabase 등 외부 연동을 캡슐화
- Domain은 UI-독립 로직이 충분할 때만 승격
- 단계별 작업 시간은 30~45분 이내로 쪼갠다 (기존 refactor-plan 정책 유지)

## Stage 6 개요
1. **정리 대상 조사**  
   - `/src/components`, `/src/controllers`, `/src/services`, `/src/views`, `/src/assets` 등 기존 구조 목록화  
   - Feature별로 이미 이전된 모듈 파악 (`features/tree`, `features/library`, `features/admin` 등)  
   - Electron 브리지 사용 경로 재확인 (settings/logs/window 등 IPC 의존성)

2. **마이그레이션 원칙**  
   - 기능 단위(예: 트리, 라이브러리, 관리자)로 나누어 진행  
   - 공유 UI/유틸은 `src/shared`로 승격  
   - Supabase/Electron 호출은 `src/infrastructure`로 이동 후 feature 서비스에서 의존성 주입  
   - 기존 폴더 삭제 전 테스트/문서 업데이트 수행

3. **검증 루프**  
   - 각 서브슬라이스 종료 시 `npm run electron:dev`로 기능 확인  
   - 사용자 점검 가이드: 영향 기능 중심(트리 CRUD, 라이브러리 필터, Admin 패널 등)  
   - 문서 업데이트: `docs/architecture.md` Stage 6 섹션 추가, `docs/refactor-plan.md` Stage 6 항목 등록

## Stage 6 세부 계획

### 작업 6A – Tree Feature 정리
- [x] **6A-1 파일 매핑**: `src/components/HierarchicalForceTree`, `src/controllers/tree`, `src/services/tree` 등 트리 관련 파일 목록화 및 의존성 다이어그램 작성
- [x] **6A-2 기능 이전**: 트리 관련 UI/상태/서비스를 `src/features/tree/*` 구조로 이동 (`ui`, `state`, `services` 디렉터리 통일)
- [x] **6A-3 인프라/도메인 분리**: Supabase/Electron 의존 코드 `src/infrastructure`로 이동, 순수 로직은 `src/domain/tree`로 승격 여부 판단 *(2025-10-07 검토 완료, 순수 로직 승격은 Stage 7에서 세분화 예정)*
- [x] **6A-4 테스트/문서**: 영향 함수 수동 검증, `docs/refactor-plan.md` 체크리스트 갱신 *(2025-10-07 사용자 점검 가이드 초안 작성 완료)*

### 작업 6B – Library Feature 정리
- [x] **6B-1 파일 매핑**: `src/components/library`, `src/views/LibraryApp` 등 조사 *(2025-10-07 Legacy 컴포넌트 의존성 정리)*
- [x] **6B-2 기능 이전**: 라이브러리 관련 모듈을 `src/features/library`로 재배치, 중복 UI `src/shared/components/library`로 정리 *(LibraryApp, TreeCanvas, VoranBoxManager 등 이동 완료)*
- [x] **6B-3 계약 확인**: 라이브러리와 Electron 브리지(`libraryBridge`) 간 채널, 설정 방송(`settings:changed`) 동작 검증 *(2025-10-07 preload/main IPC 채널/renderer 구독 로직 점검 완료)*
- [x] **6B-4 사용자 점검**: 필터/정렬/동기화 흐름 체크, 문서 업데이트 *(사용자 검증 완료 보고)*

### 작업 6C – Admin Feature 정리
- [x] **6C-1 파일 매핑**: `src/components/admin`, `src/services/admin` 현황 조사 *(2025-10-07 AdminWidgetPanel 종속성/브리지 파악 완료)*
- [x] **6C-2 기능 이전**: Admin UI/상태/서비스를 `src/features/admin`으로 통합, 공용 UI는 `src/shared/components/admin` 유지 *(AdminWidgetPanel 이동 및 ui/index 배럴 추가)*
- [x] **6C-3 IPC 계약 검토**: `adminBridge.openAdminPanel`, `adminBridge.closeAdminPanel` 등이 Stage 4 구조와 일치하는지 확인 *(preload/main handlers/adminWidgetService 호출 경로 점검 완료)*
- [x] **6C-4 QA**: 관리자 패널 기능 수동 확인, 문서 갱신 *(사용자 검증 완료 보고)*

### 작업 6D – Shared / Infrastructure 통합
- [x] **6D-1 Shared UI**: `src/components` 및 `src/shared/ui` 중복 컴포넌트 정비, shadcn 기반 공통 컴포넌트는 `src/shared/ui`로 집약 *(MarkdownMessage 이동, 미사용 UI 제거)*
- [x] **6D-2 Shared Hooks/Utils**: 중복 훅/유틸을 `src/shared/hooks`, `src/shared/utils`로 이동하고 배럴 파일 업데이트 *(drag 서비스 `features/tree/services/drag`로 이동, 공용 utils 정돈)*
- [x] **6D-3 Infrastructure**: Electron/Supabase 연동이 흩어져 있는 경우 `src/infrastructure/<system>`으로 재배치, 명시적 의존성 주입 문서화 *(agentClient를 `infrastructure/ai`로 이동, legacy `src/services` 제거)*

### 작업 6E – Domain 계층 정리 (선택적)
- [x] **6E-1 로직 선별**: 트리 계산, 정렬, 데이터 머지 등 UI와 독립된 로직 후보 목록 작성 *(2025-10-07 Domain 후보 메모 작성)*
- [ ] **6E-2 Domain 모듈화**: 후보 로직을 `src/domain/<feature>`로 이동하고 JSDoc 타입 문서화
- [ ] **6E-3 테스트**: 해당 로직 단위 테스트 보강(필요 시)

### 작업 6F – 마무리 & 문서
- [x] **6F-1 문서 업데이트**: `docs/architecture.md`에 Stage 6 결과 반영 (레이어별 책임, 디렉터리 스냅샷)
- [x] **6F-2 README/CHANGELOG**: 핵심 변경 요약 추가 *(README Stage 6 구조 반영)*
- [x] **6F-3 사용자 점검**: 전체 흐름(위젯, 라이브러리, Admin) 및 설정/로그 기능 재확인 *(사용자 검증 완료 보고)*
- [x] **6F-4 TODO 리스트**: 남은 이슈/테크빚 문서화 *(Stage 6 TODO 메모 작성)*

## Dependencies & Risks
- Supabase 키/환경 설정이 필요하므로 사용자 환경을 미리 확인
- Renderer 빌드(CRA) 관련 WARN (rehype-harden 소스맵) 지속 → Stage 6D에서 해결 여부 검토
- Stage 6 작업 중 Electron IPC 계약 변경 시 문서 및 브리지 타입 업데이트 필수

## Acceptance Criteria
- [ ] `src/` 최상위에 legacy 폴더(`components`, `controllers`, `services`, `views`)가 비어 있거나 제거됨
- [ ] 모든 기능이 `src/features` 또는 `src/shared`/`src/infrastructure`를 통해 재구조화됨
- [ ] Electron 브리지 계약, IPC 채널 이름, 사용자 점검 가이드가 최신 상태로 유지됨
- [ ] `docs/architecture.md` Stage 6 섹션과 `docs/refactor-plan.md` Stage 6 체크리스트가 완료됨

---
이 문서는 Stage 6 진행 전에 반드시 읽고, 각 서브슬라이스 종료 시 업데이트된 진척을 `docs/refactor-plan.md`에 반영합니다.

---

# Stage 7: UI 모듈 세분화 & 책임 분리 계획

> 목표: 초대형 컴포넌트와 훅을 기능별·관심사별로 분리해 유지보수성과 기능 확장성을 확보한다.

## Stage 7 세부 계획

### 작업 7A – Library UI 분리
- [x] **7A-1 구조 진단**: `src/features/library/ui/LibraryApp.js`, `components/VoranBoxManager.js`, `components/TreeCanvas.js`의 책임 목록화 및 의존 그래프 작성 *(2025-10-07 구조 분석 및 Stage 7A-1 메모 작성)*
- [x] **7A-2 커스텀 훅 추출**: `useLibraryData`, `useLibraryDialogs`, `useLibraryDrag` 등 커스텀 훅 초안 작성, API 호출과 브리지 통신을 훅으로 이동
- [ ] **7A-3 프리젠테이션 분리**: `LibraryApp`은 레이아웃 중심으로 단순화, VoranBox/TreeCanvas 내부 UI를 하위 컴포넌트로 분해 *(2025-10-08 VoranBoxManager 토스트 로직/프리젠테이션 분리, 핵심 뷰 분할 진행 중)*
- [x] **7A-4 테스트/문서**: 새 훅 인터페이스에 대한 단위 테스트 또는 스토리북/문서 초안 작성, `docs/render-refactor-status.md` 업데이트 *(2025-10-08 `useLibraryDialogs`/`useLibraryDrag` 테스트 추가)*
- [ ] **7A-5 사용자 점검**: 라이브러리 주요 플로우 회귀 테스트 진행 *(스토리/회귀 시나리오 미검증, 후속 점검 필요)*

### 작업 7B – Tree UI 분리
- [x] **7B-1 책임 구획** (2025-10-07 분석 메모 반영): `HierarchicalForceTree.js`, `NodeAssistantPanel.js`, `MemoEditor.js`의 기능 블록(뷰포트, 대화, LLM 처리, 저장/동기화) 목록화
- [ ] **7B-2 상태/뷰포트 훅**: `useTreeViewport`, `useTreePersistence`, `useConversationStore` 등을 도입해 렌더/상태 로직 분리 *(useTreeViewport/useTreePersistence 초안 도입, conversation 훅 진행 예정)*
- [x] **7B-3 서비스 추출**: LLM 연동/메시지 정규화/폴백 생성 로직을 `features/tree/services` 또는 `features/tree/utils` 하위로 이동, 테스트 추가 *(useNodeAssistantConversation 훅 도입으로 NodeAssistantPanel의 대화/LLM 책임을 분리 완료 — MemoEditor 관련 후속 정리·테스트는 7B-4/7C-2에서 계속 진행)*
- [ ] **7B-4 UI 컴포넌트 정리**: 패널/에디터를 프리젠테이션 컴포넌트와 컨테이너로 분리, props 인터페이스 문서화
- [ ] **7B-5 사용자 점검**: 트리 편집/저장/대화 플로우 회귀 검증 및 Electron 브리지 로그 확인


#### Stage 7B-1 책임 구획 메모 (2025-10-07)
- `HierarchicalForceTree`는 viewport/D3 시뮬레이션, Electron 브리지 호출, Supabase 동기화, 대화/노드 CRUD, LLM 요청까지 모두 담고 있어 "viewport 관리", "데이터 동기화", "대화/LLM 흐름", "UI 상태/테마" 네 가지 관심사를 분리 필요
- `NodeAssistantPanel`은 하이라이트, 대화 타이핑, 클립보드, 노드 네비게이션을 모두 처리하므로 "대화 상태 관리", "LLM 요청/재시도", "하이라이트" 모듈, "키바인딩/네비게이션"으로 분할 예정
- `MemoEditor`는 블록 모델, 슬래시 커맨드, 포커스/키보드 제어가 한 파일에 뭉쳐 있으며, 데이터를 순수 변환 util(`blockUtils`)과 UI 컨트롤러 레이어로 나눌 필요 존재
- 공통적으로 Electron/Supabase 연동은 `features/tree/services` 단계에서 래핑하고 UI는 커스텀 훅을 통해 의존성 주입하도록 재구성한다

### 작업 7C – 공통 유틸/테스트 강화
- [ ] **7C-1 공통 유틸 정리**: 드래그, 토스트, 타이핑 애니메이션 등 중복 로직을 `shared/utils` 또는 `shared/hooks`로 승격
- [ ] **7C-2 테스트 보강**: 라이브러리/트리 주요 훅에 대한 단위 테스트 추가, 브리지 모킹 패턴 정립
- [ ] **7C-3 문서 업데이트**: Stage 7 진행 상황을 `docs/render-refactor-status.md`, `docs/architecture.md`에 반영, 회귀 테스트 체크리스트 갱신
- [ ] **7C-4 사용자 점검**: 전체 앱 스모크 테스트 + 회귀 체크리스트 수행

## Stage 7 Acceptance Criteria
- [ ] `LibraryApp`, `VoranBoxManager`, `HierarchicalForceTree`, `NodeAssistantPanel`, `MemoEditor`가 400라인 이하로 축소되거나 역할별로 분리된 서브모듈로 대체됨
- [ ] 데이터 로드/브리지 통신/LLM 호출 등 비즈니스 로직이 커스텀 훅·서비스 계층으로 이전되고, 프리젠테이션 컴포넌트는 UI 책임에 집중
- [ ] 새 훅/서비스에 대한 단위 테스트 또는 명세 문서가 존재해 회귀 리스크 감소
- [ ] 사용자 점검 가이드가 Stage 7 변경 사항을 반영하고 각 플로우에서 회귀 없음이 확인됨

---
Stage 7 완료 후, 필요 시 Stage 8 (Admin/UI 통합 최적화 등)을 정의하여 후속 리팩터링을 계획합니다.
