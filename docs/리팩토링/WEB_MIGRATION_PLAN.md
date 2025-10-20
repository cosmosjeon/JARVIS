# JARVIS 웹 전환 + 리팩토링 실행 계획서

> **작성일**: 2025-10-18
> **대상 브랜치**: `web`
> **예상 기간**: 6-10주
> **목표**: Electron 제거 + Clean Architecture 완전 준수 + TypeScript 전환

---

## 0. 실행 지휘 원칙

1. **순차 진행**: 모든 작업은 Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 순으로 수행하며, 각 Phase의 검증 체크리스트를 통과한 뒤에만 다음 단계로 이동한다.
2. **안전한 브랜치 전략**: 기본 작업 브랜치는 `web`이지만, AI는 항상 `web`에서 파생된 작업 브랜치(`web-migration/<phase-name>`)를 생성해 변경한다. 병합은 Phase별 검증 완료 후 수행한다.
3. **복구 가능성 유지**: `git reset --hard`, `git push --force` 등 히스토리를 파괴하는 명령은 금지한다. 롤백은 체크포인트 커밋에서 `git revert` 또는 새 브랜치로 복제하여 처리한다.
4. **명령 실행 전후 기록**: 주요 스크립트 실행 전후로 결과를 `docs/logs/phase-<n>-execution.md`에 append하여, 어떤 입력이 어떤 출력을 만들었는지 남긴다.
5. **자동화 우선**: 수동 지시가 포함된 항목은 반드시 주석으로 "Manual" 표시가 있으며, AI는 Manual 단계에서 중지하고 보고한다.
6. **검증 강제**: 모든 코드 변경 후에는 `npm run lint`, `npm run test`, `npm run type-check`, `npm run build` 순으로 실행하며, 실패 시 해당 Phase에서 작업을 멈추고 원인을 문서화한다.

## 📋 목차

1. [프로젝트 현황 분석](#1-프로젝트-현황-분석)
2. [주요 문제점 상세](#2-주요-문제점-상세)
3. [목표 상태 구체적 정의](#3-목표-상태-구체적-정의)
4. [아키텍처 설계 상세](#4-아키텍처-설계-상세)
5. [Phase 0: 레거시 코드 검토 및 삭제](#phase-0-레거시-코드-검토-및-삭제)
6. [Phase 1: 프로젝트 기반 구축](#phase-1-프로젝트-기반-구축)
7. [Phase 2: 아키텍처 재정비](#phase-2-아키텍처-재정비)
8. [Phase 3: 점진적 코드 이식](#phase-3-점진적-코드-이식)
9. [Phase 4: 품질 향상 및 배포](#phase-4-품질-향상-및-배포)
10. [오류 시나리오 및 대응 방안](#오류-시나리오-및-대응-방안)
11. [검증 프로세스](#검증-프로세스)
12. [수동 설정 항목](#수동-설정-항목)
13. [체크포인트 및 롤백 전략](#체크포인트-및-롤백-전략)

---

## 1. 프로젝트 현황 분석

### 1.1 코드베이스 통계

```
총 파일 수: 183개 (JS/JSX)
총 코드 라인: ~34,370줄
테스트 파일: 0개 (기존 jest 테스트 제거됨)
코드 크기: 1.5MB

최대 파일:
- HierarchicalForceTree.js: 3,795줄
- LibraryQAPanel.js: 2,795줄
- providerClient.js: 2,158줄
- TidyTreeView.js: 1,684줄
```

### 1.2 현재 기술 스택

```
런타임: Electron 31.2.0
프레임워크: React 18.2.0 (CRA)
언어: JavaScript (100%)
상태 관리: useReducer (수동)
백엔드: Supabase
인증: Supabase Auth (Google, Kakao OAuth)
AI: Anthropic Claude, Google Gemini, OpenAI
UI: Radix UI + Tailwind CSS
시각화: D3.js
```

### 1.3 디렉토리 구조

```
src/
├── domain/          ← 2개 파일 (Tree, Folder 모델만)
├── infrastructure/  ← 5개 파일 (Supabase, Electron)
├── features/        ← 주요 기능 (library, tree, chat)
├── shared/          ← 역할 불명확 (8개 하위 디렉토리)
├── components/      ← WindowChrome (Electron 전용)
├── views/           ← OAuthCallbackPage
└── App.js           ← 메인 앱
```

### 1.4 주요 기능 목록

**현재 동작 중인 기능:**
1. **인증**: Google/Kakao OAuth 로그인
2. **라이브러리**: 트리 목록 관리, 폴더 구조
3. **트리 시각화**: D3 기반 계층형 포스 다이어그램
4. **노드 관리**: 노드 생성/수정/삭제
5. **AI 채팅**: 노드별 Q&A 패널
6. **검색**: 트리/노드 검색
7. **테마**: Light/Dark/Glass 모드

**Electron 전용 기능 (삭제 대상):**
1. 위젯 모드 (별도 창)
2. 트레이 아이콘
3. 윈도우 타이틀바 (WindowChrome)
4. IPC 통신
5. 로컬 파일 시스템 접근

---

## 2. 주요 문제점 상세

### 2.1 단일 책임 원칙 심각 위반 (3/10점)

**문제:**
- 하나의 파일이 2,000-4,000줄
- 하나의 컴포넌트가 10개 이상의 책임 수행
- 함수가 100-200줄

**구체적 예시:**

```javascript
// HierarchicalForceTree.js (3,795줄)
// 포함 책임:
// 1. D3 시뮬레이션
// 2. 캔버스 렌더링
// 3. 노드 드래그
// 4. 줌/팬
// 5. 노드 선택
// 6. 충돌 검사
// 7. 애니메이션
// 8. 이벤트 핸들링
// 9. 레이아웃 계산
// 10. 상태 관리
// ... (더 많음)
```

**영향:**
- 버그 수정 시 side effect 예측 불가
- 코드 리뷰 1파일에 2시간 소요
- 신규 개발자 온보딩 3배 지연

### 2.2 Clean Architecture 의존성 규칙 위반 (3.5/10점)

**치명적 위반 사례:**

```javascript
// ❌ infrastructure → features 역방향 의존
// infrastructure/supabase/mappers/libraryTreeMapper.js:4
import {
  sanitizeConversationMessages,
  buildFallbackConversation,
} from 'features/tree/utils/conversation';

// ❌ shared → infrastructure 의존 (레이어 불명확)
// shared/hooks/useSupabaseAuth.js:3
import { createOAuthBridge } from 'infrastructure/electron/bridges';
```

**결과:**
- 순환 의존성 발생 가능성
- 모듈 재사용 불가
- 테스트 불가능

### 2.3 테스트 커버리지 치명적 (1/10점)

```
전체: 183개 파일
테스트: 0개 파일 (baseline)
커버리지: N/A

미테스트 영역:
- 전체 코드 (테스트 미작성 상태)
```

**결과:**
- 리팩토링 시 회귀 버그 보장 못함
- 배포 시 불안정성 극대화
- 수동 테스트만 의존

### 2.4 TypeScript 부재 (0/10점)

```javascript
// 타입 에러 런타임에만 발견
function loadTrees(userId) {
  // userId가 null이면? undefined면? 숫자면?
  // 알 수 없음
  return fetch(`/trees/${userId}`);
}

// 리팩토링 시 실수
tree.treeData.nodes  // OK
tree.treedata.nodes  // 오타, 런타임 에러
```

### 2.5 Prop Drilling 심각 (4/10점)

```javascript
// 30개 props가 5단계 전달
<LibraryApp>
  <LibrarySidebar
    collapsed={state.isSidebarCollapsed}
    folders={state.folders}
    trees={state.trees}
    // ... 30개 이상
  >
    <FolderList>
      <FolderItem>
        <TreeList>
          {/* 여기서도 모든 props 필요 */}
        </TreeList>
      </FolderItem>
    </FolderList>
  </LibrarySidebar>
</LibraryApp>
```

**결과:**
- 중간 컴포넌트 불필요한 리렌더링
- 코드 가독성 저하
- 유지보수 어려움

---

## 3. 목표 상태 구체적 정의

### 3.1 기술 스택 목표

```
런타임: 브라우저 (Electron 완전 제거)
빌드 툴: Vite 6.x
프레임워크: React 18.2.0
언어: TypeScript 5.x (100%)
상태 관리: Zustand 4.x
백엔드: Supabase (유지)
인증: Supabase Auth (유지)
AI: Anthropic, Google, OpenAI (유지)
UI: Radix UI + Tailwind CSS (유지)
시각화: D3.js (유지)
테스트: Vitest + React Testing Library
배포: Vercel
```

### 3.2 코드 품질 목표

```
파일 크기: 최대 300줄
함수 크기: 최대 50줄 (권장 20줄)
테스트 커버리지: 80%+
TypeScript 적용: 100%
ESLint 에러: 0개
Lighthouse 점수: 90+
번들 크기: < 1MB (gzipped)
빌드 시간: < 30초
```

### 3.3 Clean Architecture 목표

```
의존성 규칙 준수: 100%
Domain 순수성: 100% (외부 의존 0)
Interface 정의율: 100% (모든 Repository, Service)
DI 적용률: 100% (모든 Service)
레이어 분리: 명확
```

### 3.4 성능 목표

```
First Contentful Paint: < 1.5s
Largest Contentful Paint: < 2.5s
Time to Interactive: < 3s
Total Blocking Time: < 200ms
Cumulative Layout Shift: < 0.1
```

### 3.5 배포 목표

```
배포 플랫폼: Vercel
배포 자동화: Git push → 자동 배포
환경: Production, Preview
도메인: jarvis.vercel.app (예시)
HTTPS: 자동 (Let's Encrypt)
CDN: Vercel Edge Network
모니터링: Vercel Analytics
```

---

## 4. 아키텍처 설계 상세

### 4.1 Clean Architecture 레이어 정의

```
┌─────────────────────────────────────────────────┐
│                  features/                       │ ← UI Layer (가장 바깥)
│  - React 컴포넌트                                 │
│  - Hooks (UI 로직만)                             │
│  - Zustand stores                                │
│  - Pages/Routes                                  │
│                                                  │
│  의존: infrastructure, domain                     │
├─────────────────────────────────────────────────┤
│              infrastructure/                     │ ← Adapter Layer (중간)
│  - Supabase repositories (구현체)                │
│  - AI clients (구현체)                           │
│  - HTTP clients                                  │
│  - 외부 라이브러리 래퍼                            │
│                                                  │
│  의존: domain만                                   │
├─────────────────────────────────────────────────┤
│                  domain/                         │ ← Core Layer (가장 안쪽)
│  - Entities (타입 정의)                          │
│  - Services (비즈니스 로직)                       │
│  - Repositories (인터페이스만)                    │
│  - Use Cases                                     │
│  - Utils (순수 함수)                             │
│                                                  │
│  의존: 없음 (완전 순수)                           │
└─────────────────────────────────────────────────┘

의존성 규칙:
→ features → infrastructure → domain
✅ 바깥에서 안쪽으로만
❌ 안쪽에서 바깥으로 절대 불가
```

### 4.2 디렉토리 구조 상세

```
src/
├── domain/                          ← 핵심 비즈니스 로직
│   ├── entities/                    ← 타입 정의
│   │   ├── Tree.ts                  ← interface Tree, TreeNode, TreeLink
│   │   ├── Folder.ts                ← interface Folder
│   │   ├── User.ts                  ← interface User
│   │   ├── Message.ts               ← interface Message, Attachment
│   │   └── index.ts                 ← 재export
│   │
│   ├── services/                    ← 비즈니스 로직
│   │   ├── TreeService.ts           ← 트리 생성/수정/삭제 로직
│   │   ├── FolderService.ts         ← 폴더 관리 로직
│   │   ├── ConversationService.ts   ← 대화 정제 로직
│   │   ├── SearchService.ts         ← 검색 로직
│   │   └── index.ts
│   │
│   ├── repositories/                ← 인터페이스만 (구현 X)
│   │   ├── ITreeRepository.ts       ← interface
│   │   ├── IFolderRepository.ts
│   │   ├── IUserRepository.ts
│   │   └── index.ts
│   │
│   ├── use-cases/                   ← 유스케이스 (선택)
│   │   ├── CreateTreeUseCase.ts
│   │   ├── DeleteTreeUseCase.ts
│   │   └── index.ts
│   │
│   └── utils/                       ← 순수 유틸리티
│       ├── dateUtils.ts             ← 날짜 포맷팅
│       ├── stringUtils.ts           ← 문자열 처리
│       ├── idGenerator.ts           ← ID 생성
│       └── index.ts
│
├── infrastructure/                  ← 외부 시스템 연동
│   ├── supabase/
│   │   ├── client.ts                ← Supabase 클라이언트 초기화
│   │   ├── types.ts                 ← Supabase DB 타입
│   │   │
│   │   ├── repositories/            ← Repository 구현
│   │   │   ├── SupabaseTreeRepository.ts
│   │   │   ├── SupabaseFolderRepository.ts
│   │   │   ├── SupabaseUserRepository.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── mappers/                 ← DB ↔ Domain 변환
│   │   │   ├── TreeMapper.ts        ← DB row → Tree entity
│   │   │   ├── FolderMapper.ts
│   │   │   └── index.ts
│   │   │
│   │   └── auth/
│   │       ├── AuthProvider.tsx     ← Context Provider
│   │       ├── useAuth.ts           ← Auth hook
│   │       └── index.ts
│   │
│   ├── ai/
│   │   ├── AnthropicClient.ts       ← Claude API
│   │   ├── GoogleClient.ts          ← Gemini API
│   │   ├── OpenAIClient.ts          ← GPT API
│   │   ├── types.ts                 ← AI 공통 타입
│   │   └── index.ts
│   │
│   └── http/
│       ├── httpClient.ts            ← Fetch wrapper
│       └── index.ts
│
├── features/                        ← 기능별 UI
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginPage.tsx        ← 로그인 페이지
│   │   │   ├── AuthCallback.tsx     ← OAuth 콜백
│   │   │   └── AuthGate.tsx         ← 인증 게이트
│   │   │
│   │   ├── hooks/
│   │   │   └── useAuthHandlers.ts   ← 로그인/로그아웃 핸들러
│   │   │
│   │   └── index.ts
│   │
│   ├── library/
│   │   ├── components/
│   │   │   ├── LibraryApp.tsx       ← 메인 (150줄 이하)
│   │   │   ├── LibrarySidebar.tsx   ← 사이드바 (200줄)
│   │   │   ├── LibraryContent.tsx   ← 컨텐츠 영역 (200줄)
│   │   │   ├── TreeList.tsx         ← 트리 목록 (150줄)
│   │   │   ├── FolderList.tsx       ← 폴더 목록 (150줄)
│   │   │   ├── LibraryToolbar.tsx   ← 툴바 (100줄)
│   │   │   ├── LibrarySettings.tsx  ← 설정 (200줄)
│   │   │   └── index.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useLibraryData.ts    ← 데이터 로딩 (UI 로직만)
│   │   │   ├── useTreeOperations.ts ← 트리 CRUD 핸들러
│   │   │   ├── useFolderOperations.ts
│   │   │   ├── useLibrarySearch.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── store/
│   │   │   └── libraryStore.ts      ← Zustand 스토어
│   │   │
│   │   └── index.ts
│   │
│   ├── tree/
│   │   ├── components/
│   │   │   ├── TreeVisualization/   ← 시각화 컴포넌트 분할
│   │   │   │   ├── TreeCanvas.tsx   ← 캔버스 (250줄)
│   │   │   │   ├── TreeNode.tsx     ← 노드 (150줄)
│   │   │   │   ├── TreeLink.tsx     ← 링크 (100줄)
│   │   │   │   ├── TreeControls.tsx ← 컨트롤 (150줄)
│   │   │   │   ├── TreeLegend.tsx   ← 범례 (80줄)
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── NodeAssistant/       ← AI 채팅 컴포넌트 분할
│   │   │       ├── AssistantPanel.tsx  (200줄)
│   │   │       ├── MessageList.tsx     (200줄)
│   │   │       ├── MessageInput.tsx    (150줄)
│   │   │       ├── AttachmentViewer.tsx (150줄)
│   │   │       └── index.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useTreeSimulation.ts ← D3 시뮬레이션 (300줄)
│   │   │   ├── useTreeZoom.ts       ← 줌/팬 (200줄)
│   │   │   ├── useTreeDrag.ts       ← 드래그 (250줄)
│   │   │   ├── useTreeSelection.ts  ← 선택 (150줄)
│   │   │   ├── useNodeAssistant.ts  ← AI 채팅 (200줄)
│   │   │   └── index.ts
│   │   │
│   │   ├── services/
│   │   │   ├── TreeLayoutService.ts    ← 레이아웃 계산 (300줄)
│   │   │   ├── TreeAnimationService.ts ← 애니메이션 (250줄)
│   │   │   ├── TreeCollisionService.ts ← 충돌 검사 (200줄)
│   │   │   └── index.ts
│   │   │
│   │   ├── store/
│   │   │   └── treeStore.ts         ← Zustand
│   │   │
│   │   └── index.ts
│   │
│   ├── chat/
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useChat.ts
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts
│   │
│   └── shared/                      ← 공통 UI
│       ├── components/
│       │   ├── Button.tsx           ← 버튼 컴포넌트
│       │   ├── Dialog.tsx           ← 다이얼로그
│       │   ├── Input.tsx            ← 입력
│       │   ├── Select.tsx           ← 선택
│       │   ├── ThemeProvider.tsx    ← 테마 관리
│       │   ├── ErrorBoundary.tsx    ← 에러 바운더리
│       │   └── index.ts
│       │
│       └── hooks/
│           ├── useTheme.ts          ← 테마 훅
│           ├── useSettings.ts       ← 설정 훅
│           └── index.ts
│
├── App.tsx                          ← 앱 엔트리
├── main.tsx                         ← React 엔트리
├── router.tsx                       ← 라우팅 (필요시)
└── vite-env.d.ts                    ← Vite 타입
```

### 4.3 의존성 주입 (DI) 패턴

```typescript
// 1. 인터페이스 정의 (domain/)
export interface ITreeRepository {
  findByUserId(userId: string): Promise<Tree[]>;
  save(tree: Tree): Promise<Tree>;
  delete(treeId: string): Promise<void>;
}

// 2. 구현체 (infrastructure/)
export class SupabaseTreeRepository implements ITreeRepository {
  constructor(private client: SupabaseClient) {}

  async findByUserId(userId: string): Promise<Tree[]> {
    const { data } = await this.client
      .from('trees')
      .select('*')
      .eq('user_id', userId);

    return data.map(TreeMapper.toDomain);
  }

  // ...
}

// 3. 서비스 (domain/)
export class TreeService {
  constructor(private repository: ITreeRepository) {}

  async loadUserTrees(userId: string): Promise<Tree[]> {
    const trees = await this.repository.findByUserId(userId);

    return trees
      .filter(tree => !tree.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

// 4. DI Container (infrastructure/di/)
export const container = {
  // Clients
  supabaseClient: createSupabaseClient(),

  // Repositories
  treeRepository: new SupabaseTreeRepository(container.supabaseClient),
  folderRepository: new SupabaseFolderRepository(container.supabaseClient),

  // Services
  treeService: new TreeService(container.treeRepository),
  folderService: new FolderService(container.folderRepository),
};

// 5. 사용 (features/)
export function useLibraryData() {
  const { user } = useAuth();
  const [trees, setTrees] = useState<Tree[]>([]);

  useEffect(() => {
    if (!user) return;

    // DI로 주입된 서비스 사용
    container.treeService
      .loadUserTrees(user.id)
      .then(setTrees);
  }, [user]);

  return { trees };
}
```

### 4.4 Zustand 상태 관리 구조

```typescript
// features/library/store/libraryStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface LibraryState {
  // State
  trees: Tree[];
  folders: Folder[];
  selectedTreeId: string | null;
  selectedFolderId: string | null;
  expandedFolderIds: Set<string>;
  loading: boolean;
  error: Error | null;

  // Actions
  setTrees: (trees: Tree[]) => void;
  setFolders: (folders: Folder[]) => void;
  selectTree: (id: string | null) => void;
  selectFolder: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  // Computed
  selectedTree: Tree | null;
  selectedFolder: Folder | null;
  visibleTrees: Tree[];
}

export const useLibraryStore = create<LibraryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      trees: [],
      folders: [],
      selectedTreeId: null,
      selectedFolderId: null,
      expandedFolderIds: new Set(),
      loading: false,
      error: null,

      // Actions
      setTrees: (trees) => set({ trees }),
      setFolders: (folders) => set({ folders }),
      selectTree: (id) => set({ selectedTreeId: id }),
      selectFolder: (id) => set({ selectedFolderId: id }),

      toggleFolder: (id) => set((state) => {
        const newSet = new Set(state.expandedFolderIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return { expandedFolderIds: newSet };
      }),

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // Computed (getter)
      get selectedTree() {
        const state = get();
        return state.trees.find(t => t.id === state.selectedTreeId) ?? null;
      },

      get selectedFolder() {
        const state = get();
        return state.folders.find(f => f.id === state.selectedFolderId) ?? null;
      },

      get visibleTrees() {
        const state = get();
        if (state.selectedFolderId) {
          return state.trees.filter(t => t.folderId === state.selectedFolderId);
        }
        return state.trees.filter(t => !t.folderId);
      },
    }),
    { name: 'LibraryStore' }
  )
);
```

### 4.5 테스트 전략

```typescript
// domain/services/__tests__/TreeService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeService } from '../TreeService';
import type { ITreeRepository } from '../../repositories/ITreeRepository';

describe('TreeService', () => {
  let service: TreeService;
  let mockRepository: ITreeRepository;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      findByUserId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    service = new TreeService(mockRepository);
  });

  describe('loadUserTrees', () => {
    it('should load and filter deleted trees', async () => {
      // Arrange
      mockRepository.findByUserId = vi.fn().mockResolvedValue([
        { id: '1', title: 'Tree 1', deletedAt: null, updatedAt: 100 },
        { id: '2', title: 'Tree 2', deletedAt: 12345, updatedAt: 200 },
        { id: '3', title: 'Tree 3', deletedAt: null, updatedAt: 300 },
      ]);

      // Act
      const result = await service.loadUserTrees('user123');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('3'); // 최신순
      expect(result[1].id).toBe('1');
      expect(mockRepository.findByUserId).toHaveBeenCalledWith('user123');
    });
  });
});

// features/library/__tests__/useLibraryData.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLibraryData } from '../hooks/useLibraryData';

vi.mock('@/infrastructure/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user123' } }),
}));

describe('useLibraryData', () => {
  it('should load trees on mount', async () => {
    const { result } = renderHook(() => useLibraryData());

    await waitFor(() => {
      expect(result.current.trees).toHaveLength(2);
    });
  });
});
```

---

## Phase 0: 레거시 코드 검토 및 삭제

> **목표**: 죽은 코드 제거, Electron 전용 코드 식별
> **예상 기간**: 3-5일
> **중요도**: ★★★★★ (필수)

### Task 0.1: 사용하지 않는 export 검색

**목적**: Import되지 않는 함수/컴포넌트 찾기

**실행 명령**:
```bash
# 1. 모든 export 추출
grep -r "export.*function\|export.*class\|export.*const" src/ \
  --include="*.js" --include="*.jsx" > exports.txt

# 2. 각 export가 import되는지 확인
# (스크립트 작성 필요)
```

**AI 실행 지시**:
```
1. src/ 디렉토리의 모든 JS/JSX 파일 스캔
2. export된 심볼 목록 추출
3. 각 심볼이 import되는 곳 검색
4. 1곳도 import되지 않으면 "사용 안 함" 표시
5. 결과를 docs/dead-code-report.md에 저장
```

**검증 방법**:
- [ ] exports.txt 파일 생성 확인
- [ ] dead-code-report.md 생성 확인
- [ ] 리포트에 파일명, 심볼명, 사용처 표시 확인

**예상 결과**:
```markdown
# 사용하지 않는 Export

## src/features/tree/utils/oldHelper.js
- `formatOldDate` - 사용처: 0곳 (삭제 추천)
- `parseOldFormat` - 사용처: 0곳 (삭제 추천)

## src/shared/utils/deprecated.js
- 전체 파일 미사용 (삭제 가능)
```

**오류 대응**:
- 실제 사용 중인데 false positive로 나올 수 있음
- 동적 import(`import()`) 체크 필요
- 주의: JSX 컴포넌트는 `<Component />` 형태로도 사용

### Task 0.2: Electron 전용 코드 식별

**목적**: 웹 전환 시 삭제할 코드 명확히

**실행 명령**:
```bash
# Electron 키워드 검색
grep -r "electron\|ipcRenderer\|remote\|desktopCapturer" src/ \
  --include="*.js" --include="*.jsx" -n > electron-code.txt
```

**AI 실행 지시**:
```
1. 다음 키워드 포함 파일 찾기:
   - electron
   - ipcRenderer
   - window.api (preload)
   - process.platform
   - isElectron()
   - RUNTIME_ELECTRON

2. 각 파일별로 분류:
   - 완전 삭제 가능 (100% Electron 전용)
   - 조건부 삭제 (if (isElectron) {...} 부분만)
   - 웹 대체 필요 (기능은 유지, 구현 변경)

3. docs/electron-removal-plan.md 작성
```

**검증 방법**:
- [ ] electron-code.txt 생성
- [ ] electron-removal-plan.md 생성
- [ ] 삭제/수정/대체 분류 완료

**예상 삭제 대상**:
```
완전 삭제:
- electron/ 디렉토리 전체
- src/infrastructure/electron/
- src/components/WindowChrome.js
- src/features/treeCanvas/ (위젯 모드)

조건부 수정:
- src/App.js (Electron 분기 제거)
- src/shared/utils/platform.js (isElectron 제거)

웹 대체 필요:
- OAuth 콜백 (Electron IPC → 브라우저 리다이렉트)
```

### Task 0.3: 렌더링되지 않는 컴포넌트 검색

**목적**: App.js에서 도달 불가능한 컴포넌트 찾기

**AI 실행 지시**:
```
1. src/App.js에서 시작하여 컴포넌트 트리 추적
2. 렌더링 경로 맵핑:
   App → LibraryApp → LibraryContent → ...
   App → WidgetShell → ...

3. 경로에 없는 컴포넌트 찾기:
   - components/ 디렉토리 스캔
   - features/ 내 컴포넌트 스캔
   - import되지만 JSX에 없는 것

4. docs/unreachable-components.md 작성
```

**수동 검증 필요**:
```
□ 로그인 전 화면에서 각 기능 클릭
□ 로그인 후 모든 메뉴/버튼 클릭
□ 도달하지 못한 화면 기록
```

**예상 결과**:
```markdown
# 렌더링되지 않는 컴포넌트

## 완전 미사용
- OldTreeView.js (구버전, 삭제 가능)
- DeprecatedPanel.js

## 조건부 사용 (Electron 전용)
- WindowChrome.js (위젯 모드만)
- TrayIcon.js

## 확인 필요
- ExperimentalFeature.js (개발 중?)
```

### Task 0.4: 레거시 코드 안전 삭제

**목적**: 죽은 코드 제거로 코드베이스 정리

**실행 순서**:
```
1. Git 커밋 생성 (복구 지점)
   git switch -c web-migration/phase0
   git add .
   git commit -m "checkpoint: before legacy code removal"

2. 완전 미사용 파일 삭제
   - 한 번에 1개씩 삭제하고 `npm run lint` → `npm run test -- --runTestsByPath <파일>` → `npm run build` 순으로 검증
   - 각 삭제 결과를 docs/logs/phase-0-execution.md에 기록

3. 조건부 코드 제거 (Electron 분기)
   - if (isElectron) 블록 제거 후 잔여 분기 여부 확인
   - 사용하지 않는 import 정리
   - 변경 후 즉시 검증 스크립트 반복 실행

4. 최종 검증
   npm run lint
   npm run test
   npm run type-check
   npm run build

5. 커밋
   git add .
   git commit -m "chore: remove legacy and dead code"
```

**AI 실행 지시**:
```
Task 0.1~0.3 결과를 바탕으로:

1. "완전 미사용" 파일만 삭제
   - 한 번에 최대 5개
   - 삭제 후 npm run build 확인

2. Electron 조건부 코드 제거
   - isElectron() 체크 제거
   - Electron 분기 삭제
   - 웹 분기만 유지

3. Import 정리
   - 사용하지 않는 import 제거
   - ESLint 실행

파일 삭제 시 주의사항:
- package.json은 수정하지 말 것 (Phase 1에서)
- .env 파일은 유지
- public/ 디렉토리는 유지
```

**검증 체크리스트**:
- [ ] npm run build 성공
- [ ] npm run dev 실행되는지 확인
- [ ] 브라우저에서 로그인 페이지 보이는지
- [ ] 콘솔 에러 없는지 확인
- [ ] Git에 커밋 완료

**롤백 방법**:
```bash
# 문제 발생 시
git switch web
git branch -D web-migration/phase0        # 브랜치 전체 폐기 (미병합 전제)
# 이미 병합 후라면 해당 커밋을 지정하여 git revert <commit_hash>
```

**예상 삭제량**:
- 파일: 10-20개
- 코드 라인: 500-1000줄

---

## Phase 1: 프로젝트 기반 구축

> **목표**: Vite + TypeScript + Zustand 프로젝트 생성
> **예상 기간**: 1-2주
> **전제조건**: Phase 0 완료

### Task 1.1: 백업 및 브랜치 준비

**목적**: 안전한 작업 환경 확보

**실행 명령**:
```bash
# 최신 상태 반영
git switch web
git pull --ff-only

# 작업 브랜치 생성
git switch -c web-migration/phase1

# 현재 상태 커밋
git add .
git commit -m "checkpoint: before vite migration"

# 기준 브랜치 확인(Manual)
git branch --show-current   # Manual: 출력이 web-migration/phase1인지 확인 필요

# 백업 태그 생성 (선택)
git tag backup-before-vite-$(date +%Y%m%d)
```

**검증**:
- [ ] 모든 변경사항 커밋됨
- [ ] web 브랜치 확인
- [ ] 백업 태그 생성됨

### Task 1.2: Vite 프로젝트 초기화

**목적**: Vite + React + TypeScript 프로젝트 생성

**수동 작업 필요** ⚠️:
```bash
# 1. 별도 디렉토리에 새 프로젝트 생성
cd /Users/cosmos/Documents/dev/
npm create vite@latest jarvis-vite -- --template react-ts

# 2. 생성된 프로젝트 확인
cd jarvis-vite
ls -la
# package.json, vite.config.ts, tsconfig.json 확인

# 3. 의존성 설치
npm install
npm run dev
# http://localhost:5173 접속 확인
```

**AI 실행 불가 사유**:
- 대화형 CLI 도구 (vite 템플릿 선택)
- 사용자가 직접 실행 필요

**AI가 수행할 후속 작업**:
```
1. jarvis-vite/의 설정 파일 JARVIS/로 복사
   - vite.config.ts
   - tsconfig.json
   - tsconfig.node.json

2. package.json 병합
   - 기존 dependencies 유지
   - Vite 관련 devDependencies 추가

3. index.html 수정 (Vite 방식)

4. src/main.tsx 생성 (엔트리포인트)
```

### Task 1.3: 필수 라이브러리 설치

**목적**: 프로젝트에 필요한 모든 의존성 설치

**AI 실행 지시**:
```
package.json에 다음 의존성 추가 및 설치:

1. 상태 관리
   - zustand@4.x

2. UI (기존 유지)
   - @radix-ui/* (기존 버전 유지)
   - framer-motion
   - lucide-react
   - tailwindcss, postcss, autoprefixer

3. Supabase (기존 유지)
   - @supabase/supabase-js

4. AI (기존 유지)
   - @anthropic-ai/sdk
   - @google/generative-ai
   - openai
   - ai

5. 시각화 (기존 유지)
   - d3

6. 마크다운 (기존 유지)
   - react-markdown
   - remark-gfm
   - rehype-katex

7. 테스트 (신규)
   - vitest
   - @testing-library/react
   - @testing-library/user-event
   - @vitest/ui
   - jsdom

8. 제거 예정 의존성 (Vite 전환 안정화 후 제거)
   - react-scripts
   - electron
   - electron-builder
   - concurrently
   - wait-on

> ⚠️ 위 패키지는 Vite 빌드가 동일 기능을 보장하고 `npm run dev`·`npm run build`가 모두 성공한 이후 단계에서만 제거한다.

명령어 실행 순서:

1. 신규 의존성 설치
   ```bash
   npm install zustand
   npm install -D vitest @testing-library/react @testing-library/user-event @vitest/ui jsdom
   ```

2. 설치 후 검증
   ```bash
   npm run lint
   npm run test
   ```

3. Vite 구성이 완료되고 `npm run dev`가 성공적으로 동작하는 것이 확인된 **이후**에만 기존 CRA/Electron 패키지를 제거한다.
   ```bash
   npm uninstall react-scripts electron electron-builder concurrently wait-on
   ```

4. 제거 후 전체 검증
   ```bash
   npm run lint
   npm run test
   npm run type-check
   npm run build
   ```
```

**검증**:
```bash
# package.json 확인
cat package.json | grep -A 20 "dependencies"

# node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# 설치 성공 확인
npm list zustand
npm list vitest
```

**예상 결과**:
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.58.0",
    "zustand": "^4.5.0",
    "react": "^18.2.0",
    // ... 기존 유지
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0",
    // ... 테스트 도구
  }
}
```

### Task 1.4: TypeScript 설정

**목적**: Path alias, 엄격한 타입 체크 설정

**AI 실행 지시**:
```
tsconfig.json 수정:

{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",

    // 엄격한 타입 체크
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Path alias
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@domain/*": ["src/domain/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@features/*": ["src/features/*"]
    },

    // 기타
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "build"]
}
```

**검증**:
```bash
# TypeScript 컴파일 체크
npx tsc --noEmit

# Path alias 테스트
# src/test.ts 생성
echo "import { test } from '@domain/test';" > src/test.ts
npx tsc --noEmit
# 에러 없으면 성공
rm src/test.ts
```

### Task 1.5: Vite 설정

**목적**: Path alias, 테스트, 빌드 최적화

**AI 실행 지시**:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@features': path.resolve(__dirname, 'src/features'),
    },
  },

  server: {
    port: 3000,
    open: true,
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'd3-vendor': ['d3'],
        },
      },
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
      ],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

**검증**:
```bash
# 빌드 테스트
npm run build
# dist/ 디렉토리 생성 확인
ls -la dist/

# 개발 서버 실행
npm run dev
# http://localhost:3000 접속
```

### Task 1.6: 환경 변수 설정

**목적**: Supabase 연결 정보 설정

**AI 실행 지시**:
```
1. .env.example 생성:

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback

2. 기존 .env에서 값 복사:
   - REACT_APP_SUPABASE_URL → VITE_SUPABASE_URL
   - REACT_APP_SUPABASE_ANON_KEY → VITE_SUPABASE_ANON_KEY

3. .env 파일 업데이트 (기존 값 유지하며 VITE_ prefix로 변경)

주의사항:
- REACT_APP_* → VITE_* 로 prefix 변경
- .env 파일은 Git에 커밋하지 말 것
- .gitignore에 .env 추가 확인
```

**수동 검증 필요** ⚠️:
```bash
# .env 파일 확인
cat .env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 있는지 확인

# 환경 변수 로드 테스트
# src/test-env.ts 생성
echo "console.log(import.meta.env.VITE_SUPABASE_URL);" > src/test-env.ts

npm run dev
# 콘솔에 Supabase URL 출력되는지 확인
```

### Task 1.7: 테스트 환경 설정

**목적**: Vitest + React Testing Library 구성

**AI 실행 지시**:
```typescript
// src/setupTests.ts
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as any;
```

**첫 테스트 작성**:
```typescript
// src/__tests__/example.test.ts
import { describe, it, expect } from 'vitest';

describe('Example Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**검증**:
```bash
# 테스트 실행
npm run test

# 출력:
# ✓ src/__tests__/example.test.ts (1)
#   ✓ Example Test
#     ✓ should pass

# Test Files  1 passed (1)
#      Tests  1 passed (1)
```

### Task 1.8: package.json 스크립트 업데이트

**AI 실행 지시**:
```json
// package.json scripts 섹션 교체:
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit",

    // 제거할 스크립트 (주석 처리)
    // "start": "react-scripts start",
    // "electron:*": "...",
  }
}
```

**검증**:
```bash
# 각 스크립트 동작 확인
npm run dev           # 개발 서버 실행
npm run build         # 빌드 성공
npm run preview       # 프리뷰 서버 실행
npm run test          # 테스트 실행
npm run type-check    # 타입 체크
```

### Task 1.9: Clean Architecture 디렉토리 생성

**목적**: 빈 폴더 구조 먼저 생성

**AI 실행 지시**:
```bash
# 디렉토리 생성
mkdir -p src/domain/{entities,services,repositories,use-cases,utils}
mkdir -p src/infrastructure/{supabase,ai,http}
mkdir -p src/infrastructure/supabase/{repositories,mappers,auth}
mkdir -p src/infrastructure/ai
mkdir -p src/features/{auth,library,tree,chat,shared}
mkdir -p src/features/auth/{components,hooks}
mkdir -p src/features/library/{components,hooks,store}
mkdir -p src/features/tree/{components,hooks,services,store}
mkdir -p src/features/chat/{components,hooks}
mkdir -p src/features/shared/{components,hooks}

# index.ts 파일 생성 (빈 export)
find src/domain src/infrastructure src/features -type d -exec touch {}/index.ts \;
```

**검증**:
```bash
# 디렉토리 구조 확인
tree src/ -L 3 -d

# 예상 출력:
# src/
# ├── domain
# │   ├── entities
# │   ├── repositories
# │   ├── services
# │   ├── use-cases
# │   └── utils
# ├── infrastructure
# │   ├── ai
# │   ├── http
# │   └── supabase
# │       ├── auth
# │       ├── mappers
# │       └── repositories
# └── features
#     ├── auth
#     ├── chat
#     ├── library
#     ├── shared
#     └── tree
```

### Task 1.10: 첫 TypeScript 파일 작성 및 테스트

**목적**: 설정이 제대로 작동하는지 검증

**AI 실행 지시**:
```typescript
// src/domain/entities/Tree.ts
export interface TreeNode {
  id: string;
  keyword: string;
  parentId: string | null;
  level: number;
}

export interface TreeLink {
  source: string;
  target: string;
}

export interface TreeData {
  nodes: TreeNode[];
  links: TreeLink[];
}

export interface Tree {
  id: string;
  title: string;
  userId: string;
  treeData: TreeData;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// src/domain/entities/index.ts
export type { Tree, TreeNode, TreeLink, TreeData } from './Tree';

// src/domain/services/TreeService.ts
import type { Tree } from '../entities';

export class TreeService {
  filterDeletedTrees(trees: Tree[]): Tree[] {
    return trees.filter(tree => tree.deletedAt === null);
  }

  sortByUpdatedDate(trees: Tree[]): Tree[] {
    return [...trees].sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

// src/domain/services/__tests__/TreeService.test.ts
import { describe, it, expect } from 'vitest';
import { TreeService } from '../TreeService';
import type { Tree } from '../../entities';

describe('TreeService', () => {
  const service = new TreeService();

  const mockTrees: Tree[] = [
    {
      id: '1',
      title: 'Tree 1',
      userId: 'user1',
      treeData: { nodes: [], links: [] },
      folderId: null,
      createdAt: 100,
      updatedAt: 100,
      deletedAt: null,
    },
    {
      id: '2',
      title: 'Tree 2',
      userId: 'user1',
      treeData: { nodes: [], links: [] },
      folderId: null,
      createdAt: 200,
      updatedAt: 300,
      deletedAt: null,
    },
    {
      id: '3',
      title: 'Deleted',
      userId: 'user1',
      treeData: { nodes: [], links: [] },
      folderId: null,
      createdAt: 150,
      updatedAt: 200,
      deletedAt: 250,
    },
  ];

  describe('filterDeletedTrees', () => {
    it('should filter out deleted trees', () => {
      const result = service.filterDeletedTrees(mockTrees);
      expect(result).toHaveLength(2);
      expect(result.find(t => t.id === '3')).toBeUndefined();
    });
  });

  describe('sortByUpdatedDate', () => {
    it('should sort trees by updated date descending', () => {
      const filtered = service.filterDeletedTrees(mockTrees);
      const result = service.sortByUpdatedDate(filtered);

      expect(result[0].id).toBe('2'); // updatedAt: 300
      expect(result[1].id).toBe('1'); // updatedAt: 100
    });
  });
});
```

**검증**:
```bash
# 타입 체크
npm run type-check
# 에러 없어야 함

# 테스트 실행
npm run test
# ✓ TreeService 테스트 통과해야 함

# Path alias 동작 확인
# src/test-import.ts
echo "import { Tree } from '@domain/entities';" > src/test-import.ts
npm run type-check
# 에러 없으면 alias 동작
rm src/test-import.ts
```

**성공 기준**:
- [ ] TypeScript 컴파일 성공
- [ ] 테스트 2개 모두 통과
- [ ] Path alias (@domain) 동작
- [ ] import 체인 정상 작동

### Task 1.11: 최소 React App 구성

**목적**: Vite 환경에서 React 렌더링 확인

**AI 실행 지시**:
```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// src/App.tsx
import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-gray-800">
          JARVIS Web Migration
        </h1>
        <p className="text-gray-600 mt-2">
          Vite + React + TypeScript 환경 구축 완료
        </p>
        <div className="mt-4 text-sm text-gray-500">
          Phase 1 완료 ✓
        </div>
      </div>
    </div>
  );
}

export default App;

// src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

// index.html (root 수정)
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JARVIS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**검증** (수동):
```bash
npm run dev

# 브라우저 http://localhost:3000 접속
# "JARVIS Web Migration" 화면 보여야 함
# Tailwind CSS 스타일 적용 확인
# 콘솔 에러 없어야 함
```

**스크린샷 확인 항목**:
- [ ] 흰색 카드가 중앙에 표시됨
- [ ] "JARVIS Web Migration" 제목 보임
- [ ] Tailwind 스타일 (shadow, rounded) 적용됨
- [ ] 콘솔에 에러 없음

### Task 1.12: Phase 1 체크포인트

**목적**: Phase 1 완료 확인 및 커밋

**검증 체크리스트**:
```
□ Vite 프로젝트 생성 완료
□ TypeScript 설정 완료 (tsconfig.json)
□ Path alias 동작 (@domain, @infrastructure, @features)
□ Zustand 설치 완료
□ Vitest 테스트 환경 구축
□ 첫 테스트 통과 (TreeService)
□ 환경 변수 설정 (.env)
□ Clean Architecture 디렉토리 구조 생성
□ npm run dev 정상 동작
□ npm run build 성공
□ npm run test 통과
```

**커밋**:
```bash
git add .
git commit -m "feat: Phase 1 complete - Vite + TypeScript + Zustand setup

- Initialize Vite project with React + TypeScript
- Set up path aliases (@domain, @infrastructure, @features)
- Install Zustand for state management
- Configure Vitest for testing
- Create Clean Architecture directory structure
- Add first domain entity (Tree) and service (TreeService)
- Pass initial tests (TreeService)
- Remove Electron dependencies

Breaking changes:
- Replace CRA with Vite
- Replace REACT_APP_* with VITE_* env variables
- Remove all Electron-related code
"

git push origin web
```

**Phase 1 완료 확인**:
```bash
# 모든 스크립트 동작 확인
npm run dev          # ✓ 개발 서버 실행
npm run build        # ✓ 빌드 성공
npm run test         # ✓ 테스트 통과
npm run type-check   # ✓ 타입 에러 없음

# 디렉토리 구조 확인
tree src/ -L 2 -I "node_modules"

# 환경 변수 확인
grep VITE_ .env
```

**다음 단계**: Phase 2 (아키텍처 재정비)

---

## Phase 2: 아키텍처 재정비

> **목표**: Clean Architecture 의존성 규칙 완전 준수
> **예상 기간**: 2-3주
> **전제조건**: Phase 1 완료

### Task 2.1: Infrastructure → Features 의존성 제거

**목적**: 치명적 위반 사항 해결

**문제 코드**:
```javascript
// ❌ infrastructure/supabase/mappers/libraryTreeMapper.js:4
import {
  sanitizeConversationMessages,
  buildFallbackConversation,
} from 'features/tree/utils/conversation';
```

**해결 방법**:
```
1. features/tree/utils/conversation.js 분석
2. 순수 비즈니스 로직 추출
3. domain/services/ConversationService.ts로 이동
4. infrastructure에서 domain import로 변경
```

**AI 실행 지시**:
```
Step 1: ConversationService 생성

// src/domain/entities/Message.ts
export interface Attachment {
  id: string;
  type: 'image' | 'document' | 'other';
  mimeType: string | null;
  dataUrl: string;
  label: string | null;
  textContent: string | null;
}

export interface Message {
  role: 'user' | 'assistant';
  text: string;
  content: string;
  attachments?: Attachment[];
  timestamp?: number;
  metadata?: Record<string, any>;
}

// src/domain/services/ConversationService.ts
import type { Message, Attachment } from '../entities/Message';

export class ConversationService {
  private static readonly MESSAGE_LIMIT = 48;

  /**
   * 대화 메시지 정제 (순수 함수)
   */
  static sanitizeMessages(messages: any[]): Message[] {
    if (!Array.isArray(messages)) {
      return [];
    }

    const sanitized: Message[] = [];

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') continue;

      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      const text = this.extractText(msg);
      const attachments = this.extractAttachments(msg);

      if (!text && attachments.length === 0) continue;

      sanitized.push({
        role,
        text,
        content: typeof msg.content === 'string' ? msg.content : text,
        attachments: attachments.length > 0 ? attachments : undefined,
        timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : undefined,
        metadata: msg.metadata,
      });
    }

    // 최대 메시지 수 제한
    if (sanitized.length > this.MESSAGE_LIMIT) {
      return sanitized.slice(-this.MESSAGE_LIMIT);
    }

    return sanitized;
  }

  /**
   * Fallback 대화 생성
   */
  static buildFallback(question?: string, answer?: string): Message[] {
    const conversation: Message[] = [];

    if (question && question.trim()) {
      conversation.push({
        role: 'user',
        text: question.trim(),
        content: question.trim(),
      });
    }

    if (answer && answer.trim()) {
      conversation.push({
        role: 'assistant',
        text: answer.trim(),
        content: answer.trim(),
      });
    }

    return conversation;
  }

  private static extractText(message: any): string {
    // features/tree/utils/conversation.js의 로직 복사
    // (생략: 구현 동일)
  }

  private static extractAttachments(message: any): Attachment[] {
    // features/tree/utils/conversation.js의 로직 복사
    // (생략: 구현 동일)
  }
}

Step 2: infrastructure에서 사용

// src/infrastructure/supabase/mappers/TreeMapper.ts
import { ConversationService } from '@domain/services/ConversationService';
import type { Tree } from '@domain/entities';

export class TreeMapper {
  static toDomain(row: any, nodeRows: any[]): Tree {
    // 대화 정제
    const conversation = ConversationService.sanitizeMessages(
      row.conversation || []
    );

    // Tree 객체 생성
    return {
      id: row.id,
      title: row.title,
      treeData: {
        nodes: nodeRows.map(n => ({
          ...n,
          conversation: ConversationService.sanitizeMessages(n.conversation),
        })),
        links: [],
      },
      // ...
    };
  }
}

Step 3: 기존 코드 제거

1. features/tree/utils/conversation.js 삭제
   (또는 domain/services/ConversationService.ts 래퍼로 변경)

2. infrastructure/supabase/mappers/libraryTreeMapper.js 수정
   - features import 제거
   - @domain import 추가
```

**테스트 작성**:
```typescript
// src/domain/services/__tests__/ConversationService.test.ts
import { describe, it, expect } from 'vitest';
import { ConversationService } from '../ConversationService';

describe('ConversationService', () => {
  describe('sanitizeMessages', () => {
    it('should sanitize valid messages', () => {
      const raw = [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there' },
      ];

      const result = ConversationService.sanitizeMessages(raw);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[0].text).toBe('Hello');
    });

    it('should filter out empty messages', () => {
      const raw = [
        { role: 'user', text: '' },
        { role: 'assistant', text: 'Hi' },
      ];

      const result = ConversationService.sanitizeMessages(raw);

      expect(result).toHaveLength(1);
    });

    it('should limit to 48 messages', () => {
      const raw = Array(100).fill(null).map((_, i) => ({
        role: 'user',
        text: `Message ${i}`,
      }));

      const result = ConversationService.sanitizeMessages(raw);

      expect(result).toHaveLength(48);
      expect(result[0].text).toBe('Message 52'); // 최신 48개
    });
  });

  describe('buildFallback', () => {
    it('should build conversation from Q&A', () => {
      const result = ConversationService.buildFallback(
        'What is AI?',
        'AI is artificial intelligence.'
      );

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });
  });
});
```

**검증**:
```bash
# 테스트 실행
npm run test ConversationService

# 의존성 체크
grep -r "from.*features" src/infrastructure/
# 결과: 0개 (없어야 함)

# 빌드 확인
npm run build
```

### Task 2.2: Shared 레이어 해체 및 재분류

**목적**: 레이어 경계 명확화

**현재 shared/ 분석**:
```
src/shared/
├── components/         → features/shared/components/
├── hooks/              → features/shared/hooks/ (React 의존)
├── lib/                → infrastructure/
├── utils/              → domain/utils/ (순수 유틸만)
├── ui/                 → features/shared/components/
└── constants/          → 용도에 따라 분류
```

**AI 실행 지시**:
```
Step 1: 순수 유틸리티 → domain/utils/

이동 대상 (React 의존 없는 것):
- shared/utils/dateUtils.js → domain/utils/dateUtils.ts
- shared/utils/stringUtils.js → domain/utils/stringUtils.ts
- shared/constants/agentTimeouts.js → domain/utils/timeoutConstants.ts

변환 예시:
// src/domain/utils/dateUtils.ts
export class DateUtils {
  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString('ko-KR');
  }

  static isRecent(timestamp: number, hoursAgo: number = 24): boolean {
    const now = Date.now();
    const diff = now - timestamp;
    return diff < hoursAgo * 60 * 60 * 1000;
  }
}

Step 2: UI 컴포넌트 → features/shared/components/

이동 대상:
- shared/components/library/ThemeProvider.js
  → features/shared/components/ThemeProvider.tsx

- shared/ui/*.jsx
  → features/shared/components/*.tsx

Step 3: React Hooks → features/shared/hooks/

이동 대상:
- shared/hooks/useSupabaseAuth.js
  → infrastructure/supabase/auth/useAuth.ts

- shared/hooks/SettingsContext.js
  → features/shared/hooks/useSettings.ts

Step 4: Infrastructure 코드 → infrastructure/

이동 대상:
- shared/lib/supabaseClient.js
  → infrastructure/supabase/client.ts

Step 5: shared/ 디렉토리 삭제

rm -rf src/shared/
```

**이동 스크립트**:
```bash
# 순수 유틸
git mv src/shared/utils/dateUtils.js src/domain/utils/dateUtils.ts
git mv src/shared/utils/stringUtils.js src/domain/utils/stringUtils.ts

# UI 컴포넌트
mkdir -p src/features/shared/components
git mv src/shared/components/* src/features/shared/components/
git mv src/shared/ui/* src/features/shared/components/

# Hooks
mkdir -p src/features/shared/hooks
git mv src/shared/hooks/SettingsContext.js src/features/shared/hooks/useSettings.ts

# Infrastructure
git mv src/shared/lib/supabaseClient.js src/infrastructure/supabase/client.ts
git mv src/shared/hooks/useSupabaseAuth.js src/infrastructure/supabase/auth/useAuth.ts

# shared 삭제
rm -rf src/shared/
```

**import 경로 자동 수정**:
```bash
# 모든 파일에서 import 경로 업데이트
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's|shared/utils/dateUtils|@domain/utils/dateUtils|g' \
  -e 's|shared/components|@features/shared/components|g' \
  -e 's|shared/hooks/useSupabaseAuth|@infrastructure/supabase/auth/useAuth|g' \
  {} +
```

**검증**:
```bash
# shared 디렉토리 존재 확인 (없어야 함)
ls src/shared/
# ls: src/shared/: No such file or directory

# import 에러 확인
npm run type-check

# 빌드 확인
npm run build
```

### Task 2.3: Domain 비즈니스 로직 이동

**목적**: Features의 비즈니스 로직을 Domain으로

**현재 문제**:
```typescript
// ❌ features/library/hooks/useLibraryData.js
const loadTrees = async (userId) => {
  const trees = await libraryRepository.loadTrees(userId);

  // 비즈니스 로직이 UI 훅에 있음!
  return trees
    .filter(tree => !tree.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt);
};
```

**해결 방법**:
```typescript
// ✅ domain/services/TreeService.ts
export class TreeService {
  constructor(private repository: ITreeRepository) {}

  async loadUserTrees(userId: string): Promise<Tree[]> {
    const trees = await this.repository.findByUserId(userId);

    // 비즈니스 로직은 여기!
    return trees
      .filter(tree => tree.deletedAt === null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async createTree(userId: string, title: string): Promise<Tree> {
    const tree: Tree = {
      id: crypto.randomUUID(),
      title: title.trim() || '제목 없는 트리',
      userId,
      treeData: { nodes: [], links: [] },
      folderId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    };

    return this.repository.save(tree);
  }

  async deleteTree(treeId: string): Promise<void> {
    // Soft delete
    await this.repository.softDelete(treeId);
  }
}

// ✅ features/library/hooks/useLibraryData.ts (UI 로직만)
export function useLibraryData() {
  const { user } = useAuth();
  const setTrees = useLibraryStore(state => state.setTrees);
  const setLoading = useLibraryStore(state => state.setLoading);

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Service만 호출
    container.treeService
      .loadUserTrees(user.id)
      .then(setTrees)
      .finally(() => setLoading(false));
  }, [user]);
}
```

**AI 실행 지시**:
```
Step 1: TreeService 구현

// src/domain/repositories/ITreeRepository.ts
export interface ITreeRepository {
  findByUserId(userId: string): Promise<Tree[]>;
  findById(treeId: string): Promise<Tree | null>;
  save(tree: Tree): Promise<Tree>;
  softDelete(treeId: string): Promise<void>;
  moveToFolder(treeId: string, folderId: string | null): Promise<void>;
}

// src/domain/services/TreeService.ts
(위 코드 구현)

Step 2: FolderService 구현

// src/domain/services/FolderService.ts
export class FolderService {
  constructor(private repository: IFolderRepository) {}

  async loadUserFolders(userId: string): Promise<Folder[]> {
    const folders = await this.repository.findByUserId(userId);
    return this.buildHierarchy(folders);
  }

  private buildHierarchy(folders: Folder[]): Folder[] {
    // 계층 구조 생성 로직
    // (부모-자식 관계 정렬)
  }
}

Step 3: DI Container 구성

// src/infrastructure/di/container.ts
import { createSupabaseClient } from '../supabase/client';
import { SupabaseTreeRepository } from '../supabase/repositories/SupabaseTreeRepository';
import { SupabaseFolderRepository } from '../supabase/repositories/SupabaseFolderRepository';
import { TreeService } from '@domain/services/TreeService';
import { FolderService } from '@domain/services/FolderService';

const supabaseClient = createSupabaseClient();

const treeRepository = new SupabaseTreeRepository(supabaseClient);
const folderRepository = new SupabaseFolderRepository(supabaseClient);

export const container = {
  // Services
  treeService: new TreeService(treeRepository),
  folderService: new FolderService(folderRepository),

  // Repositories (테스트용)
  treeRepository,
  folderRepository,
};

Step 4: Features에서 사용

// src/features/library/hooks/useLibraryData.ts
import { container } from '@infrastructure/di/container';

export function useLibraryData() {
  // container.treeService 사용
}
```

**테스트**:
```typescript
// src/domain/services/__tests__/TreeService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreeService } from '../TreeService';
import type { ITreeRepository } from '../../repositories/ITreeRepository';

describe('TreeService', () => {
  let service: TreeService;
  let mockRepo: ITreeRepository;

  beforeEach(() => {
    mockRepo = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
      softDelete: vi.fn(),
      moveToFolder: vi.fn(),
    };

    service = new TreeService(mockRepo);
  });

  it('should create tree with default title', async () => {
    mockRepo.save = vi.fn().mockResolvedValue({
      id: '123',
      title: '제목 없는 트리',
    });

    const result = await service.createTree('user1', '');

    expect(result.title).toBe('제목 없는 트리');
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
```

### Task 2.4: Repository 인터페이스 및 구현체 작성

**목적**: DIP (Dependency Inversion Principle) 적용

**AI 실행 지시**:
```typescript
// src/domain/repositories/ITreeRepository.ts
import type { Tree } from '../entities';

export interface ITreeRepository {
  findByUserId(userId: string): Promise<Tree[]>;
  findById(treeId: string): Promise<Tree | null>;
  save(tree: Tree): Promise<Tree>;
  softDelete(treeId: string): Promise<void>;
  moveToFolder(treeId: string, folderId: string | null): Promise<void>;
}

// src/infrastructure/supabase/repositories/SupabaseTreeRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ITreeRepository } from '@domain/repositories/ITreeRepository';
import type { Tree } from '@domain/entities';
import { TreeMapper } from '../mappers/TreeMapper';

export class SupabaseTreeRepository implements ITreeRepository {
  constructor(private client: SupabaseClient) {}

  async findByUserId(userId: string): Promise<Tree[]> {
    // 1. Trees 조회
    const { data: treeRows, error: treeError } = await this.client
      .from('trees')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (treeError) throw treeError;
    if (!treeRows?.length) return [];

    // 2. Nodes 조회
    const treeIds = treeRows.map(t => t.id);
    const { data: nodeRows, error: nodeError } = await this.client
      .from('nodes')
      .select('*')
      .in('tree_id', treeIds)
      .is('deleted_at', null);

    if (nodeError) throw nodeError;

    // 3. Mapper로 Domain 객체 변환
    return treeRows.map(treeRow =>
      TreeMapper.toDomain(treeRow, nodeRows || [])
    );
  }

  async findById(treeId: string): Promise<Tree | null> {
    const { data, error } = await this.client
      .from('trees')
      .select('*')
      .eq('id', treeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    // Nodes 조회 생략 (필요시 추가)
    return TreeMapper.toDomain(data, []);
  }

  async save(tree: Tree): Promise<Tree> {
    const row = TreeMapper.fromDomain(tree);

    const { data, error } = await this.client
      .from('trees')
      .upsert(row)
      .select()
      .single();

    if (error) throw error;

    return TreeMapper.toDomain(data, []);
  }

  async softDelete(treeId: string): Promise<void> {
    const { error } = await this.client
      .from('trees')
      .update({
        deleted_at: Date.now(),
        updated_at: Date.now()
      })
      .eq('id', treeId);

    if (error) throw error;
  }

  async moveToFolder(treeId: string, folderId: string | null): Promise<void> {
    const { error } = await this.client
      .from('trees')
      .update({
        folder_id: folderId,
        updated_at: Date.now()
      })
      .eq('id', treeId);

    if (error) throw error;
  }
}

// src/infrastructure/supabase/mappers/TreeMapper.ts
import type { Tree, TreeNode } from '@domain/entities';
import { ConversationService } from '@domain/services/ConversationService';

export class TreeMapper {
  static toDomain(row: any, nodeRows: any[]): Tree {
    const nodes: TreeNode[] = nodeRows
      .filter(n => n.tree_id === row.id)
      .map(n => ({
        id: n.id,
        keyword: n.keyword || n.question || '신규 노드',
        parentId: n.parent_id || null,
        level: 0, // 계산 필요
        fullText: n.answer || '',
        conversation: ConversationService.sanitizeMessages(n.conversation || []),
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      }));

    return {
      id: row.id,
      title: row.title,
      userId: row.user_id,
      treeData: {
        nodes,
        links: this.buildLinks(nodes),
      },
      folderId: row.folder_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at || null,
    };
  }

  static fromDomain(tree: Tree): any {
    return {
      id: tree.id,
      title: tree.title,
      user_id: tree.userId,
      folder_id: tree.folderId,
      created_at: tree.createdAt,
      updated_at: tree.updatedAt,
      deleted_at: tree.deletedAt,
    };
  }

  private static buildLinks(nodes: TreeNode[]) {
    return nodes
      .filter(n => n.parentId)
      .map(n => ({
        source: n.parentId!,
        target: n.id,
      }));
  }
}
```

**검증**:
```bash
# 타입 체크
npm run type-check

# 테스트 (Mock Supabase)
npm run test SupabaseTreeRepository
```

### Task 2.5: Zustand 스토어 구성

**목적**: Prop drilling 제거, 중앙 상태 관리

**AI 실행 지시**:
```typescript
// src/features/library/store/libraryStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Tree, Folder } from '@domain/entities';

interface LibraryState {
  // Data
  trees: Tree[];
  folders: Folder[];

  // Selection
  selectedTreeId: string | null;
  selectedFolderId: string | null;
  selectedNodeId: string | null;

  // UI State
  expandedFolderIds: Set<string>;
  isSidebarCollapsed: boolean;
  isQAPanelVisible: boolean;
  isQAPanelFullscreen: boolean;

  // Loading & Error
  loading: boolean;
  error: Error | null;

  // Actions - Data
  setTrees: (trees: Tree[]) => void;
  setFolders: (folders: Folder[]) => void;
  addTree: (tree: Tree) => void;
  updateTree: (treeId: string, updates: Partial<Tree>) => void;
  removeTree: (treeId: string) => void;

  // Actions - Selection
  selectTree: (treeId: string | null) => void;
  selectFolder: (folderId: string | null) => void;
  selectNode: (nodeId: string | null) => void;

  // Actions - UI
  toggleFolder: (folderId: string) => void;
  toggleSidebar: () => void;
  showQAPanel: (nodeId: string) => void;
  hideQAPanel: () => void;
  toggleQAPanelFullscreen: () => void;

  // Actions - Loading
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  // Computed (getters)
  selectedTree: () => Tree | null;
  selectedFolder: () => Folder | null;
  visibleTrees: () => Tree[];
}

export const useLibraryStore = create<LibraryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      trees: [],
      folders: [],
      selectedTreeId: null,
      selectedFolderId: null,
      selectedNodeId: null,
      expandedFolderIds: new Set(),
      isSidebarCollapsed: false,
      isQAPanelVisible: false,
      isQAPanelFullscreen: false,
      loading: false,
      error: null,

      // Actions - Data
      setTrees: (trees) => set({ trees }),
      setFolders: (folders) => set({ folders }),

      addTree: (tree) => set((state) => ({
        trees: [tree, ...state.trees],
      })),

      updateTree: (treeId, updates) => set((state) => ({
        trees: state.trees.map(t =>
          t.id === treeId ? { ...t, ...updates } : t
        ),
      })),

      removeTree: (treeId) => set((state) => ({
        trees: state.trees.filter(t => t.id !== treeId),
        selectedTreeId: state.selectedTreeId === treeId
          ? null
          : state.selectedTreeId,
      })),

      // Actions - Selection
      selectTree: (treeId) => set({
        selectedTreeId: treeId,
        selectedFolderId: null,
      }),

      selectFolder: (folderId) => set({
        selectedFolderId: folderId,
        selectedTreeId: null,
      }),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      // Actions - UI
      toggleFolder: (folderId) => set((state) => {
        const newSet = new Set(state.expandedFolderIds);
        if (newSet.has(folderId)) {
          newSet.delete(folderId);
        } else {
          newSet.add(folderId);
        }
        return { expandedFolderIds: newSet };
      }),

      toggleSidebar: () => set((state) => ({
        isSidebarCollapsed: !state.isSidebarCollapsed,
      })),

      showQAPanel: (nodeId) => set({
        selectedNodeId: nodeId,
        isQAPanelVisible: true,
      }),

      hideQAPanel: () => set({
        isQAPanelVisible: false,
        isQAPanelFullscreen: false,
        selectedNodeId: null,
      }),

      toggleQAPanelFullscreen: () => set((state) => ({
        isQAPanelFullscreen: !state.isQAPanelFullscreen,
      })),

      // Actions - Loading
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // Computed
      selectedTree: () => {
        const state = get();
        return state.trees.find(t => t.id === state.selectedTreeId) ?? null;
      },

      selectedFolder: () => {
        const state = get();
        return state.folders.find(f => f.id === state.selectedFolderId) ?? null;
      },

      visibleTrees: () => {
        const state = get();
        if (state.selectedFolderId) {
          return state.trees.filter(t => t.folderId === state.selectedFolderId);
        }
        return state.trees.filter(t => !t.folderId);
      },
    }),
    { name: 'LibraryStore' }
  )
);
```

**사용 예시**:
```typescript
// 컴포넌트에서 사용
function LibraryApp() {
  const trees = useLibraryStore(state => state.trees);
  const selectTree = useLibraryStore(state => state.selectTree);
  const loading = useLibraryStore(state => state.loading);

  return (
    <div>
      {loading && <div>Loading...</div>}
      {trees.map(tree => (
        <div key={tree.id} onClick={() => selectTree(tree.id)}>
          {tree.title}
        </div>
      ))}
    </div>
  );
}
```

### Task 2.6: Phase 2 체크포인트

**검증 체크리스트**:
```
□ Infrastructure → Features 의존성 0개
□ Shared 레이어 완전 제거
□ Domain에 비즈니스 로직 집중
□ Repository 인터페이스 정의 완료
□ Repository 구현체 작성 완료
□ DI Container 구성 완료
□ Zustand 스토어 작성 완료
□ 모든 테스트 통과
□ npm run type-check 에러 없음
□ npm run build 성공
```

**의존성 검증 스크립트**:
```bash
# Infrastructure → Features 체크
grep -r "from.*features" src/infrastructure/
# 출력: (empty) ← 없어야 함

# Domain → 외부 의존성 체크
grep -r "from.*infrastructure\|from.*features\|from.*react" src/domain/
# 출력: (empty) ← 없어야 함

# Shared 존재 체크
ls src/shared/
# 출력: ls: src/shared/: No such file or directory
```

**커밋**:
```bash
git add .
git commit -m "refactor: Phase 2 complete - Clean Architecture restructure\n\n- Remove Infrastructure → Features dependency\n- Move ConversationService to domain layer\n- Dissolve shared layer and reclassify files\n- Move business logic from features to domain services\n- Implement Repository pattern with DI\n- Add Zustand for state management\n- Achieve 100% Clean Architecture compliance\n\nArchitecture:\n- Domain: Pure business logic (0 external dependencies)\n- Infrastructure: External integrations (depends on domain only)\n- Features: UI layer (depends on both)\n\nBreaking changes:\n- Removed shared/ directory\n- Changed import paths for utilities and components\n"

# Manual: git push origin web-migration/phase2 (인간 검토 후 진행)
```

---

## Phase 3: 점진적 코드 이식

> **목표**: Electron 레이어에 남아 있는 기능을 브라우저 환경으로 단계적으로 이전하고 Clean Architecture 구조에 맞춰 재배치한다.
> **전제조건**: Phase 2 체크리스트 통과, `npm run build` 성공본 존재, Supabase 스테이징 자격 증명 준비.
> **작업 브랜치**: `web-migration/phase3`

### Task 3.0: Phase 3 준비 점검

**AI 실행 지시**:
```
1. git switch web
2. git pull --ff-only
3. git switch -c web-migration/phase3
4. Phase 2 산출물에서 다음 파일이 존재하는지 확인
   - src/domain/** (TypeScript 기반)
   - src/infrastructure/**
   - src/features/**
5. docs/logs/phase-2-execution.md 요약 후 Phase 3 계획에 반영
```

**검증**:
- [ ] `git status` → clean
- [ ] Phase 2 로그 상 미해결 TODO 없음
- [ ] 브라우저 개발 서버(`npm run dev`) 기동 확인 (Manual)

### Task 3.1: Domain 유스케이스 이전

**목적**: 트리·폴더·대화 관련 핵심 로직을 TypeScript 기반 Domain 레이어로 완성

**AI 실행 지시**:
```
1. src/domain/entities/Tree.ts, Folder.ts, Message.ts에 누락된 필드를 보강하고 주석으로 데이터 출처(Supabase 스키마) 명시
2. 기존 JS use-case가 남아 있는 경우 src/domain/use-cases/**로 이동하면서 TypeScript화
3. Domain 함수는 외부 라이브러리에 의존하지 않도록 순수 함수인지 검사
4. vitest 기반 단위 테스트를 src/domain/**/__tests__에 작성 (AAA 패턴)
```

**검증**:
- [ ] `npm run test domain` 통과
- [ ] `rg "from 'react'" src/domain` 결과 없음
- [ ] docs/logs/phase-3-execution.md에 테스트 요약 추가

### Task 3.2: Infrastructure Adapter 브라우저화

**목적**: Supabase, AI 클라이언트를 Electron context에서 브라우저 context로 전환

**AI 실행 지시**:
```
1. src/infrastructure/supabase/client.ts에서 Electron preload 의존성을 제거하고 Supabase JS SDK 브라우저 초기화 코드로 대체
2. OAuth 리다이렉트 URL을 환경 변수 `VITE_SUPABASE_REDIRECT_URL`로 주입하고 .env 템플릿 업데이트 (Manual)
3. AI 클라이언트 파일에서 fs, path 등 Node 전용 모듈 사용 여부 검사 후 대체 (예: fetch 기반 호출)
4. infrastructure/di/container.ts에서 브라우저 환경에서 필요한 클라이언트만 등록
5. Vitest + msw로 Supabase/AI 모킹 테스트 작성
```

**검증**:
- [ ] `npm run type-check` 통과
- [ ] `rg "ipcRenderer" src/infrastructure` 결과 없음
- [ ] Auth flow 수동 테스트: Supabase 스테이징에서 OAuth 로그인 성공 여부 (Manual)

### Task 3.3: Feature 레이어 React 컴포넌트 이식

**목적**: 주요 UI 기능을 Vite + TSX 기반 컴포넌트로 교체하며 Prop drilling 해소

**AI 실행 지시**:
```
1. src/features/library/components/**를 TSX로 변환하며, 각 파일은 200줄 이하로 분리
2. 라이브러리/트리/채팅 기능별 route를 React Router v6 기반으로 정의
3. Zustand store를 hooks(useStoreSelectors)와 함께 연동, 기존 useReducer 제거
4. D3 시각화 코드는 Canvas/DOM 분리 후 TreeVisualization 폴더에 세분화
5. 공통 UI 컴포넌트는 features/shared/components로 이동하고 스토리북 문서를 병행 작성 (Manual 옵션)
```

**검증**:
- [ ] `npm run lint` 통과
- [ ] `npm run test features/library` 통과
- [ ] Lighthouse CLI(Manual)로 LCP < 2.5s, CLS < 0.1 확인

### Task 3.4: 라우팅 및 상태 전환 스모크 테스트

**목적**: 주요 사용자 흐름이 웹 환경에서 동작하는지 확인

**AI 실행 지시**:
```
1. Playwright 또는 Cypress로 로그인 → 라이브러리 탐색 → 노드 선택 → AI 응답 조회 시나리오 스크립트 작성
2. `npm run test:e2e` 명령을 package.json에 등록하고 CI에서 사용할 수 있도록 출력 경로 지정
3. 테스트 결과를 docs/test-results/phase-3-e2e.md에 저장
```

**검증**:
- [ ] e2e 스크립트 최소 1개 성공
- [ ] 실패 시 스냅샷/스크린샷 docs/test-results에 첨부

### Task 3.5: 브라우저 전용 빌드 산출

**AI 실행 지시**:
```
1. npm run build
2. build/ 디렉토리 사이즈 및 번들 분석 (`npx vite-bundle-visualizer`)
3. netlify/vite preview 등 브라우저 서버로 로컬 검증 (Manual)
4. 산출물을 docs/artifacts/phase-3-build.md에 기록 (번들 크기, 빌드 시간, 경고 목록)
```

**검증 체크리스트**:
```
□ npm run build 성공
□ 번들 gzipped < 1MB (초과 시 최적화 태스크 생성)
□ .env.sample에 Vite용 변수 정의 완료
□ Supabase와 AI 호출이 브라우저에서 정상 동작
```

**커밋**:
```bash
git add .
git commit -m "feat: migrate features to browser-first architecture"

# Manual: git push origin web-migration/phase3
```

---

## Phase 4: 품질 향상 및 배포

> **목표**: 테스트 커버리지 확대, 성능 최적화, 브라우저 배포 자동화 구축
> **전제조건**: Phase 3 산출물 빌드 성공 및 주요 흐름 e2e 통과
> **작업 브랜치**: `web-migration/phase4`

### Task 4.1: 테스트 커버리지 80% 달성

**AI 실행 지시**:
```
1. git switch web
2. git pull --ff-only
3. git switch -c web-migration/phase4
4. vitest --coverage 실행, 보고서를 coverage/lcov-report로 저장
5. 커버리지 미달 파일에 대해 우선순위별 테스트 추가 (domain → infrastructure → features 순)
6. 중요 시나리오 회귀 테스트를 e2e에 추가
```

**검증**:
- [ ] `coverage/coverage-summary.json`에서 statements/branches/functions/lines ≥ 80%
- [ ] 실패 테스트 0

### Task 4.2: 성능 및 접근성 튜닝

**AI 실행 지시**:
```
1. `npm run build && npm run preview`
2. Lighthouse CI(`npx @lighthouse/cli`)로 성능/접근성/베스트 프랙티스/SEO 측정
3. 90점 미만 항목은 개선 PR 작성 (예: 코드 splitting, 이미지 최적화)
4. Tailwind JIT 설정을 점검해 사용되지 않는 CSS 제거 (Manual)
```

**검증**:
- [ ] FCP < 1.5s, LCP < 2.5s, CLS < 0.1
- [ ] 접근성 점수 ≥ 95

### Task 4.3: 배포 파이프라인 구축

**AI 실행 지시**:
```
1. Vercel CLI를 devDependency로 설치 (`npm install -D vercel`)
2. vercel.json 템플릿을 생성하여 환경 변수 매핑 (Manual: 실제 값 입력)
3. GitHub Actions (`.github/workflows/deploy.yml`) 작성
   - lint → test → type-check → build → vercel deploy --prebuilt 순
4. 프리뷰/프로덕션 브랜치 정책 문서화 (docs/ops/deployment.md)
```

**검증**:
- [ ] GitHub Actions에서 워크플로우 성공 로그
- [ ] Vercel 프리뷰 URL 접속 (Manual)

### Task 4.4: 운영 이관 및 모니터링

**AI 실행 지시**:
```
1. Sentry 또는 Vercel Analytics 설정 (Manual: API 키 필요)
2. docs/ops/runbook.md에 장애 대응 절차 작성
3. 알림 채널(Slack/Webhook) 구성 코드 또는 문서화
4. 구 Electron 앱 유지보수 계획(종료 일정, 사용자 공지 초안) 문서화
```

**검증**:
- [ ] 모니터링 대시보드 URL 기록
- [ ] 운영 체크리스트 상 TODO 없음

**커밋**:
```bash
git add .
git commit -m "chore: harden web release pipeline"

# Manual: git push origin web-migration/phase4
```

---

## 오류 시나리오 및 대응 방안

| 시나리오 | 감지 방법 | 즉각 대응 | 장기 해결 |
| --- | --- | --- | --- |
| Supabase 인증 콜백 404 | OAuth Redirect 후 404 로그 | `.env`의 `VITE_SUPABASE_REDIRECT_URL` 검증, Preview 링크 확인 | Supabase 콘솔 Redirect URL 갱신 및 자동 테스트 추가 |
| AI API 429 (Rate Limit) | API 응답 코드 모니터링 | exponential backoff 적용, 사용자 피드백 안내 | 요청 캐싱 및 프롬프트 최적화, 백엔드 큐 도입 검토 |
| 빌드 시 Vite 메모리 오류 | CI 로그에서 FATAL error | `NODE_OPTIONS=--max_old_space_size=4096` 설정 후 재빌드 | D3 번들 분할, 코드 스플리팅 적용 |
| e2e 테스트 불안정 | 테스트 로그에서 flake 발생 | flaky 테스트 격리, `--retries 2` 적용 | Mock 데이터 고정, 시간 의존성 제거 |
| 배포 후 빈 화면 (White Screen) | 브라우저 콘솔 에러 | `npm run preview`로 재현, sourcemap으로 오류 위치 확인 | Suspense fallback 추가, 오류 경계 컴포넌트 강화 |

---

## 검증 프로세스

1. **로컬 파이프라인**: `npm run lint` → `npm run test` → `npm run type-check` → `npm run build`
2. **커버리지 보고**: `npm run test -- --coverage` 실행 후 coverage CI 업로드
3. **E2E**: `npm run test:e2e` (Playwright/Cypress)
4. **CI**: GitHub Actions에서 위 순서 자동화, 실패 시 즉시 중단
5. **로그 기록**: 각 Phase 실행 후 `docs/logs/phase-<n>-execution.md` 업데이트

> 주석: `npm run test`는 현재 `--watch=false --passWithNoTests` 옵션을 적용하여 테스트가 없더라도 단발성으로 종료된다. 개발 중 실시간 감시가 필요하면 `npm run test:watch`를 사용해라.

---

## 수동 설정 항목

- Supabase OAuth Redirect URL 등록 (콘솔 접속 필요)
- Vercel 프로젝트 생성 및 환경 변수 입력
- AI Provider API Key 발급 및 `.env` 작성
- Slack/Webhook 알림 채널 생성
- Storybook 배포 여부 결정 및 설정

모든 Manual 항목은 처리 후 `docs/ops/manual-checklist.md`에 체크 표시한다.

---

## 체크포인트 및 롤백 전략

| Phase | 체크포인트 커밋 메시지 | 롤백 방법 |
| --- | --- | --- |
| Phase 0 | `chore: remove legacy and dead code` | `git revert <commit>` 또는 `git switch web && git branch -D web-migration/phase0` |
| Phase 1 | `build: scaffold vite typescript foundation` | 해당 브랜치 삭제 후 Phase 0 커밋으로부터 재시작 |
| Phase 2 | `refactor: Phase 2 complete - Clean Architecture restructure` | `git revert`로 되돌린 뒤 보완 작업 브랜치 생성 |
| Phase 3 | `feat: migrate features to browser-first architecture` | 브랜치 삭제 후 Phase 2 커밋에서 신규 브랜치 생성 |
| Phase 4 | `chore: harden web release pipeline` | `git revert` + 배포 파이프라인 비활성화 (Manual) |

추가적으로, 각 Phase 완료 시 `git tag phase-<n>-complete-YYYYMMDD`를 생성해 이정표를 남긴다 (Manual).
