# NodeAssistantPanel 의존성 감사 (Sprint 1)

## 직접 import 의존성
| 항목 | 유형 | 용도 | 트리 결합도 | 비고 |
| --- | --- | --- | --- | --- |
| `web-highlighter` | 외부 라이브러리 | 하이라이트 모드 DOM 마킹 | 낮음 | Electron 환경에서 `document`/`window` 필요, 서버사이드 렌더링 불가 |
| `../services/TreeSummaryService` | 로컬 서비스 | 부모/자식/동료 경로 기반 요약 | 낮음 | 트리 전용 구현을 어댑터로 분리, 대체 서비스로 교체 가능 |
| `../services/QuestionService` | 로컬 서비스 | 2단계 질문 카운트 관리 및 응답 포맷 | 중간 | 서비스 인스턴스를 내부에서 생성, 주입 가능하지만 기본값이 Tree 컨텍스트 가정 |

## prop 및 콜백 의존성
| prop | 필요 여부 | 설명 | 트리 결합도 | 끊어내기 아이디어 |
| --- | --- | --- | --- | --- |
| `node` | 필수 | `id`, `keyword`, `fullText`, `questionData` 필요 | 매우 높음 | 인터페이스 `NodeSummary` 정의 후 데이터 공급자 주입 |
| `color` | 선택 | 스타일링 용 | 낮음 | Electron 위젯에서도 재사용 가능 |
| `onSizeChange` | 선택 | 패널 크기 변경 시 컨테이너 조정 | 낮음 | 크기 계산 로직을 외부 훅으로 이동 고려 |
| `onSecondQuestion` | 선택 | 루트 노드 질문 제한 처리 | 높음 | 트리 전용 기능 → 어댑터에서 기본 no-op 처리 |
| `onPlaceholderCreate` | 선택 | 플레이스홀더 노드 추가 | 높음 | 트리에서만 쓰므로 위젯용 핸들러를 별도 서비스로 추상화 |
| `questionService` | 선택 | 커스텀 질문 서비스 주입 | 중간 | Electron 위젯에서 전역 IPC 서비스로 대체 가능 |
| `initialConversation` | 선택 | 기존 기록 재생성 | 낮음 | 로컬 저장소/IPC 기반 상태 공급자로 대체 |
| `onConversationChange` | 선택 | 대화 상태 외부 동기화 | 낮음 | 위젯 스토리지와 연동 예정 |

## 트리 결합 포인트
1. **요약 생성** (`buildSummary`, `buildChain`, `getDirectReports`, `getPeers`): `treeData` 전체 구조에 직접 접근.
2. **루트 노드 특수 처리** (`node.id === 'CEO'`): 조직 트리 도메인을 하드코딩.
3. **플레이스홀더 생성** (`onPlaceholderCreate(node.id, highlightTexts)`): 트리 상에 자식 노드를 추가한다는 가정.
4. **QuestionService 기본 인스턴스**: 트리 질문 흐름(2단계) 로직이 묶여 있음.

## 어댑터 초안
- `NodeContextAdapter`
  - 입력: `NodeDescriptor { id, label, fullText, parentId?, childrenIds?, peers? }`
  - 책임: `treeData` 대신 외부에서 노드 메타데이터 공급, 요약 텍스트 생성 도우미 제공
- `ConversationBridge`
  - 입력/출력: `messages[]`, `onChange(messages)`
  - 책임: Electron IPC 또는 스토리지와 동기화, 패널에서는 배열만 사용
- `HighlightBridge`
  - 책임: DOM 의존성이 있을 경우 Web/Electron 모두에서 동작 가능한 래퍼 제공, 서버 환경에서는 no-op
- `QuestionServiceAdapter`
  - 책임: 2단계 질문 로직을 서비스 인터페이스로 추상화, Electron에서는 IPC 기반 질문 처리기로 교체
- `PlaceholderHandler`
  - 책임: 트리에서는 자식 생성, 위젯에서는 텍스트 저장 또는 다른 액션 수행. 기본 구현은 no-op

## 분리 전략 요약
1. `TreeSummaryService` 기본 구현을 유지하면서, 패널에는 `nodeSummary`를 prop으로 주입.
2. `node.id === 'CEO'` 같은 도메인 상수 제거 → 프로퍼티 기반 플래그(`isRootNode`) 사용.
3. 플레이스홀더 로직을 `PlaceholderHandler` 인터페이스로 추상화하여 Electron 위젯에서 다른 동작 연결.
4. `QuestionService`를 필수 prop으로 승격하여 내부 `new` 호출 제거.
5. 하이라이트 라이브러리를 감싸는 `useHighlightManager` 훅 분리로 환경별 구현 가능.
