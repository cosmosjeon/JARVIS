# Tree & Library Refactor Roadmap

## Overview
트리 시각화 및 라이브러리 관리 기능은 단일 파일에 과도한 책임이 집중되어 유지보수가 어렵습니다. 아래 계획은 기능별, 책임별로 모듈을 분리해 복잡도를 줄이고 테스트 가능성을 높이는 것을 목표로 합니다.

---

## ForceDirectedTree (src/features/tree/ui/tree2/ForceDirectedTree.js)
- **주요 문제**
  - 2,300+줄 컴포넌트로 시뮬레이션, 이벤트, UI 상태를 모두 처리
  - 뷰포트 저장/복원, 컨텍스트 메뉴, 메모 패널 등 집중
- **리팩터링 전략**
  1. `useForceSimulation` 훅을 작성해 D3 시뮬레이션 설정, tick 업데이트, force 구성 로직 분리
  2. `useTreeViewportState` 훅으로 줌/팬 동기화와 Supabase 퍼시스턴스 캡슐화
  3. 컨텍스트 메뉴/노드 패널 UI를 `TreeContextMenu`, `TreeNodePanels`와 같은 프레젠테이션 컴포넌트로 이동
  4. 렌더 트리(노드/링크) 계산을 작은 유틸(`buildNodeRenderModel`, `buildLinkPaths`)로 추출
- **세부 작업**
  - 컴포넌트 내부 상태 목록화 후 책임별 그룹화
  - 훅·컴포넌트 간 props 계약 정의 및 타입 작성
  - 기존 Storybook 케이스 또는 개발 툴에서 회귀 검증 스크립트 마련
- **리스크 & 완화**
  - D3 tick에서의 this 바인딩: 훅 내부에서 ref 사용, effect cleanup 검증
  - Supabase 저장 실패 시 복구 경로: 에러 핸들링 서비스로 위임

## HierarchicalForceTree (src/features/tree/ui/HierarchicalForceTree.js)
- **주요 문제**
  - 계층형/force 모드 전환, 에이전트 호출, 뷰포트, 제스처 처리 등 모든 오케스트레이션 집중
- **현재 진행 상황**
  - ✅ `useTreeDataController` 훅을 도입해 트리 로딩·세션 복원·초기화 로직 분리
  - ✅ 트리 위젯 브리지 이벤트 처리와 초기 트리 선택 로직을 훅 내부로 이동해 컴포넌트 책임 축소
- **리팩터링 전략 (잔여)**
  1. ✅ 뷰 모드 전환과 툴바 상호작용을 `useTreeViewModeController`(실제 구현: `useTreeViewController`)로 이동
  2. Agent 대화 흐름, theme 토글 등 부가 기능을 컨테이너 컴포넌트에서 분리
  3. D3 제스처 관련 유틸(`applyPanZoomGesture`, `createNodeDragHandler`)을 모듈 별도 파일로 이전하고 테스트 추가
- **세부 작업**
  - 기능별 이벤트 흐름 다이어그램 작성 후 인터페이스 정의
  - Electron bridge 의존성 주입 방식 설계 (테스트 대체용 목업 제공)
  - 각 뷰 모드 전환에 대한 시나리오 테스트 혹은 e2e 스크립트 보강

## useMemoEditorController (src/features/tree/ui/tree2/hooks/useMemoEditorController.js)
- **주요 문제**
  - 블록 CRUD, 단축키, Slash 메뉴, 테마 계산이 하나의 훅에 존재
- **리팩터링 전략**
  1. `memoBlockRepository` 유틸을 만들어 직렬화/역직렬화/블록 탐색 로직 이동
  2. 키보드 이벤트 처리 전용 훅 `useMemoEditorShortcuts` 구성 (핫키 매핑 선언적 관리)
  3. Slash 메뉴 상태를 `useSlashPalette` 훅으로 추출 (최근 항목 persistence 포함)
  4. 테마 기반 스타일 파생값은 memoized selector 유틸로 이동
- **세부 작업**
  - 현재 훅 상태/dispatch 패턴을 시그널 다이어그램으로 기록
  - 새 훅 출력값 타입 정의 후 기존 컴포넌트와 연결
  - 블록 유틸에 대해 단위 테스트 작성 (생성/indent/outdent/transform 등)

## useVoranBoxManagerState (src/features/library/hooks/useVoranBoxManagerState.js)
- **주요 문제**
  - 드래그 앤 드롭, 토스트, 네비게이션, 선택 상태 관리가 혼잡
- **리팩터링 전략**
  1. 드래그 관련 로직을 `useVoranBoxDrag` 훅으로 이동 (프리뷰, hover timer, vibrate 관리)
  2. 키보드 네비게이션/접근성은 `useVoranBoxKeyboardNav`로 추출
  3. 토스트/모달 관리는 뷰 모델 레이어(`useVoranBoxUIState`)로 나눔
  4. 선택 상태는 `useSelectableList` 제네릭 훅을 도입해 재사용성 확보
- **세부 작업**
  - UX 요구사항 정리 및 사용자 시나리오 정의
  - 새 훅간 의존성 그래프 작성 후 순환 참조 검증
  - 드래그 & 드롭 동작에 대한 테스트 케이스 문서화

## TreeNode (src/features/tree/ui/components/TreeNode.js)
- **주요 문제**
  - 노드 카드/어시스턴트 패널/드래그/네비게이션 모두 단일 컴포넌트에 집중
- **리팩터링 전략**
  1. 어시스턴트 패널 연동을 컨테이너 `TreeNodeAssistantContainer`로 이동
  2. 노드 텍스트 래핑/스타일 계산을 유틸(`buildNodeDisplayProps`)로 정리
  3. 드래그/포커스/호버 상태는 `useTreeNodeInteractions` 훅으로 추출
  4. JSX 구조를 프레젠테이션 컴포넌트(`TreeNodeCard`)와 컨테이너로 분리
- **세부 작업**
  - props 목록 재정의 및 필요 필드만 남기도록 정리
  - 컨테이너 <-> 프레젠테이션 간 이벤트 계약 테스트 (jest + testing-library)
  - Storybook에서 주요 상태(기본/hover/expanded)를 시각적으로 검증할 시나리오 추가

## 공통 작업 스트림
- **타임라인 제안**: 파일 당 2~3일, 전체 3주 내 단계적 머지
- **테스트 전략**: 단위 테스트 추가 + 기존 e2e 스텝 재실행, 회귀 스냅샷 업데이트
- **릴리즈 전략**: 기능별 feature flag / 배치 단위 릴리즈로 위험 감소
- **성공 지표**
  - 해당 파일 LOC 60% 이하 감소
  - 주요 기능 시나리오 자동화 테스트 통과율 100%
  - 코드 리뷰에서 평균 2회 미만 수정 요청

---

## 다음 단계
1. 각 모듈별 상세 설계 문서(인터페이스, 데이터 흐름) 작성 후 팀 리뷰 진행
2. 리팩터링 브랜치 생성(`refactor/tree-modularization`) 후 기능별 PR로 분할
3. 성능/회귀 체크리스트 기반 QA 세션 계획 수립
