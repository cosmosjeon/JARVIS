# 아키텍처 개선 계획

## 개요
- 대상: JARVIS Renderer (React + Electron + Supabase)
- 작성일: 2025-10-07
- 목적: 이후 기능 확장을 대비하여 구조적 부채를 제거하고 유지보수성을 확보

## 주요 이슈 요약
- `src/features/library/hooks/useLibraryAppViewModel.js`가 400+ 라인에서 UI, 도메인, DnD, 메모 CRUD를 혼재하여 SRP 위반 및 테스트 난해
- `electron/main/index.js`가 윈도우 관리, 핫키, 트레이, OAuth, IPC 등록을 동시에 처리하여 응집도 저하 및 회귀 위험 증가
- `src/infrastructure/supabase/repositories/treeRepository.js`가 레거시 서비스에 단순 위임하여 추상화 이득이 제한적이고 데이터 정합성 문제 추적이 어려움
- 테스트 커버리지 부족으로 구조 조정 시 회귀 감지 어려움

## 개선 목표
1. 핵심 컨트롤러/훅을 단일 책임 단위로 분리하여 가독성과 테스트 용이성을 확보한다.
2. Electron 메인 프로세스를 use-case 중심 모듈로 재구성해 사이드이펙트를 격리한다.
3. Supabase 데이터 접근 계층을 단일 진입점으로 정리해 도메인 일관성과 오류 대응력을 높인다.
4. 리팩터링된 모듈에 대한 회귀 테스트/스모크 체계를 마련한다.

## 단계별 실행 계획 (Sequential)

### 1단계: 라이브러리 뷰 모델 분해
- 범위 파일: `src/features/library/hooks/useLibraryAppViewModel.js`, `src/features/library/ui/LibraryApp.js`, `src/features/library/state/useLibraryState.js`
- 현황 문제: 상태 갱신/핸들러/브리지 호출이 하나의 훅에 집중되어 cyclomatic complexity 상승
- 완료 기준:
  - [x] 테마 제어, 메모 CRUD, 노드 업데이트, DnD, Modal/Dialogs 로직을 전담 훅/서비스로 분리
  - [x] `useLibraryAppViewModel` 길이를 200줄 이하로 축소하고, 각 서브 훅이 독립 테스트 가능
  - [x] 신규 훅에 대한 단위 테스트 또는 스토리 기반 스모크 작성
- 작업 단계:
  1. `useLibraryThemeController`, `useLibraryMemoController`, `useLibraryNodeController`, `useLibraryDragController`, `useLibraryDialogController` 초안을 생성하고 책임을 이전한다.
  2. `LibraryApp`과 관련 컴포넌트에서 신규 훅을 사용하도록 의존성 정리.
  3. 분리된 훅을 대상으로 최소 스모크 테스트 작성 (`src/__tests__` 또는 `features/library/.../__tests__`).
  4. 문서/주석 업데이트 및 회귀 점검.
- 리스크 & 완화:
  - 브리지 호출 시점 오류 → 각 훅에서 side effect를 `useEffect`로 격리하고, 기존 동작 대비 diff 확인.
  - 상태 공유 복잡도 증가 → 컨텍스트/상태 모듈을 그대로 재사용하며, 훅 간 계약을 명시 문서화.

### 2단계: Electron 메인 프로세스 모듈화
- 범위 파일: `electron/main/index.js`, `electron/main/hotkeys`, `electron/main/bootstrap`, `electron/main/ipc-handlers/*`
- 완료 기준:
  - [x] 핫키, 트레이, OAuth, 라이브러리/관리자 창 관리 모듈이 독립 초기화 함수를 제공
  - [x] `electron/main/index.js`는 앱 부트스트랩 순서만 정의하며 150줄 이하 유지
  - [~] 새로 분리된 모듈에 대해 최소 smoke 테스트 또는 로그 기반 검증 스크립트 작성 (추후 Electron 스모크 테스트 예정)
- 작업 단계:
  1. 핫키/트레이 초기화 로직을 `services` 디렉터리로 추출하고 인터페이스 정의.
  2. OAuth/Window 핸들러 초기화를 orchestrator 레이어로 이동.
  3. 부트스트랩 시퀀스를 단계별 함수 호출로 정렬 및 테스트 스크립트 추가.

### 3단계: Supabase 데이터 계층 정리
- 범위 파일: `src/infrastructure/supabase/repositories/*.js`, `src/infrastructure/supabase/services/treeService.js`, `domain/library/models/*`
- 완료 기준:
  - [x] Repository 레이어가 Supabase 쿼리를 직접 수행하고 서비스 계층 의존 제거
  - [x] 도메인 모델 변환이 repository 단계에서 일관되게 적용
  - [x] 주요 연산(load/save/delete)별 에러 핸들링 개선 및 로깅 조건부 적용 (추가 로깅 정책 TBD)
- 작업 단계:
  1. ✅ 레거시 `treeService`의 fetch/upsert/delete 로직을 repository로 이관
  2. ✅ 폴더/트리 repository에서 도메인 모델을 반환하도록 정비
  3. ✅ `features` 레이어에 영향을 주는 인터페이스 변경 사항 반영 및 테스트 (단위 테스트는 Supabase 의존으로 보류)

### 4단계: 검증 및 문서화
- 상기 단계 완료 후 회귀 테스트(React Testing Library, Playwright 스모크) 수행
- `docs/architecture-improvement-plan.md` 및 README에 진행 현황 업데이트
- 주요 변경 사항에 대한 기술 메모 추가

## 품질 및 테스트 전략
- 리팩터링된 훅/모듈마다 최소 1개의 단위 테스트 또는 통합 스모크 케이스 작성
- Electron 변경 사항은 `npm run electron:smoke` 전후 비교 및 로그 검증
- Supabase 변경 시 스테이징 DB 혹은 mock을 활용한 통합 테스트 추가

## 일정 및 우선순위
1. 1단계 (우선순위 매우 높음) – 예상 2~3 작업 세션
2. 2단계 (우선순위 높음) – 예상 2 작업 세션
3. 3단계 (우선순위 중간) – 예상 2 작업 세션
4. 4단계 – 각 단계 완료 시 연계 수행

## 후속 관리
- 각 단계 완료 후 PR 단위로 문서 상태 업데이트
- 릴리즈 노트에 구조 변경 요약 추가
- 기술 부채 레지스터에 남은 이슈 기록
