# Phase 3: 점진적 코드 이식

> **이전 문서**: [WEB_MIGRATION_PLAN.md](./WEB_MIGRATION_PLAN.md)
> **목표**: 기존 기능을 새 아키텍처로 이식
> **예상 기간**: 2-3주
> **전제조건**: Phase 2 완료

---

## 작업 원칙

### 🔄 점진적 이식 전략

```
1. 한 번에 1개 기능씩
2. 이식 후 즉시 테스트
3. 테스트 통과 후 커밋
4. 문제 발생 시 즉시 롤백
```

### 📊 이식 우선순위

```
1순위: 인증 (Auth) ← 모든 기능의 전제
2순위: 라이브러리 (Library) ← 핵심 기능
3순위: 트리 시각화 (Tree) ← 대규모 파일 분할
4순위: AI 채팅 (Chat) ← 복잡한 상태 관리
```

---

## Task 3.1: 인증 기능 이식

**목표**: Supabase Auth 웹 환경 구성

### Subtask 3.1.1: Supabase Client 생성

**AI 실행 지시**:
```typescript
// src/infrastructure/supabase/client.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials not found. Please check your .env file.\n' +
    'Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export function createSupabaseClient(): SupabaseClient {
  return supabase;
}
```

**검증**:
```typescript
// src/infrastructure/supabase/__tests__/client.test.ts
import { describe, it, expect } from 'vitest';
import { supabase } from '../client';

describe('Supabase Client', () => {
  it('should create client instance', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
  });

  it('should have correct config', () => {
    // @ts-ignore (accessing private)
    const url = supabase.supabaseUrl;
    expect(url).toContain('.supabase.co');
  });
});
```

### Subtask 3.1.2: Auth Provider 작성

**AI 실행 지시**:
```typescript
// src/infrastructure/supabase/auth/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../client';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  signInWithOAuth: (provider: 'google' | 'kakao') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    // 초기 세션 가져오기
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      if (error) setError(error);
      setLoading(false);
    });

    // 세션 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithOAuth = async (provider: 'google' | 'kakao') => {
    setLoading(true);
    setError(null);

    const redirectUrl = import.meta.env.VITE_SUPABASE_REDIRECT_URL ||
      `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        queryParams: provider === 'google'
          ? { access_type: 'offline', prompt: 'select_account' }
          : { prompt: 'select_account' },
      },
    });

    if (error) {
      setError(error);
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error);
    } else {
      setSession(null);
    }

    setLoading(false);
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    error,
    signInWithOAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Subtask 3.1.3: Auth 컴포넌트 작성

**AI 실행 지시**:
```typescript
// src/features/auth/components/LoginPage.tsx
import React from 'react';
import { useAuth } from '@infrastructure/supabase/auth/AuthProvider';

export function LoginPage() {
  const { signInWithOAuth, loading, error } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            JARVIS
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            AI 기반 지식 관리 시스템
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => signInWithOAuth('google')}
            disabled={loading}
            className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              {/* Google Icon */}
            </svg>
            Google로 로그인
          </button>

          <button
            onClick={() => signInWithOAuth('kakao')}
            disabled={loading}
            className="w-full flex justify-center items-center px-4 py-3 border border-yellow-400 rounded-md shadow-sm text-sm font-medium text-gray-900 bg-yellow-300 hover:bg-yellow-400 disabled:opacity-50"
          >
            Kakao로 로그인
          </button>
        </div>

        {error && (
          <div className="text-red-600 text-sm text-center">
            로그인 중 오류가 발생했습니다: {error.message}
          </div>
        )}
      </div>
    </div>
  );
}

// src/features/auth/components/AuthCallback.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@infrastructure/supabase/auth/AuthProvider';

export function AuthCallback() {
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      // 로그인 성공 → 라이브러리로 이동
      navigate('/library');
    }
  }, [session, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  );
}

// src/features/auth/components/AuthGate.tsx
import React, { type ReactNode } from 'react';
import { useAuth } from '@infrastructure/supabase/auth/AuthProvider';
import { LoginPage } from './LoginPage';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
```

### Subtask 3.1.4: App에 Auth 통합

**AI 실행 지시**:
```typescript
// src/App.tsx
import React from 'react';
import { AuthProvider } from '@infrastructure/supabase/auth/AuthProvider';
import { AuthGate } from '@features/auth/components/AuthGate';
import { LibraryApp } from '@features/library/components/LibraryApp';

function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <LibraryApp />
      </AuthGate>
    </AuthProvider>
  );
}

export default App;
```

### 검증 (수동)

```bash
npm run dev

# 브라우저 http://localhost:3000
□ 로그인 페이지 표시됨
□ Google 버튼 클릭 → Google OAuth 페이지로 이동
□ 로그인 완료 → /auth/callback으로 리다이렉트
□ AuthGate를 통과하여 LibraryApp 표시

# 세션 유지 확인
□ 새로고침해도 로그인 유지됨
```

**커밋**:
```bash
git add .
git commit -m "feat: implement auth with Supabase OAuth

- Add AuthProvider with session management
- Create LoginPage with Google/Kakao OAuth
- Add AuthCallback for OAuth redirect handling
- Implement AuthGate for protected routes
- Integrate auth into App
"
```

---

## Task 3.2: 라이브러리 기능 이식

**목표**: 트리 목록 관리 핵심 기능

### Subtask 3.2.1: Domain Entities 완성

**AI 실행 지시**:
```typescript
// src/domain/entities/Folder.ts
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

// src/domain/entities/User.ts
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

// src/domain/entities/index.ts
export type { Tree, TreeNode, TreeLink, TreeData } from './Tree';
export type { Folder } from './Folder';
export type { User } from './User';
export type { Message, Attachment } from './Message';
```

### Subtask 3.2.2: Repository 구현체 완성

**이전 Task 2.4에서 일부 작성했으므로 완성**

```typescript
// src/infrastructure/supabase/repositories/SupabaseFolderRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IFolderRepository } from '@domain/repositories/IFolderRepository';
import type { Folder } from '@domain/entities';

export class SupabaseFolderRepository implements IFolderRepository {
  constructor(private client: SupabaseClient) {}

  async findByUserId(userId: string): Promise<Folder[]> {
    const { data, error } = await this.client
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id || null,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async create(folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> {
    const now = Date.now();
    const { data, error } = await this.client
      .from('folders')
      .insert({
        name: folder.name,
        parent_id: folder.parentId,
        user_id: folder.userId,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      parentId: data.parent_id || null,
      userId: data.user_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // ... delete, update 구현
}
```

### Subtask 3.2.3: Zustand Store 완성

**이전 Task 2.5에서 작성한 libraryStore.ts 검증**

```bash
# 타입 체크
npm run type-check src/features/library/store/

# 스토어 테스트
npm run test libraryStore
```

### Subtask 3.2.4: Library Hooks 작성

**AI 실행 지시**:
```typescript
// src/features/library/hooks/useLibraryData.ts
import { useEffect } from 'react';
import { useAuth } from '@infrastructure/supabase/auth/AuthProvider';
import { useLibraryStore } from '../store/libraryStore';
import { container } from '@infrastructure/di/container';

export function useLibraryData() {
  const { user } = useAuth();
  const { setTrees, setFolders, setLoading, setError } = useLibraryStore();

  useEffect(() => {
    if (!user) {
      setTrees([]);
      setFolders([]);
      return;
    }

    setLoading(true);

    Promise.all([
      container.treeService.loadUserTrees(user.id),
      container.folderService.loadUserFolders(user.id),
    ])
      .then(([trees, folders]) => {
        setTrees(trees);
        setFolders(folders);
        setError(null);
      })
      .catch((error) => {
        console.error('Failed to load library data:', error);
        setError(error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);
}

// src/features/library/hooks/useTreeOperations.ts
import { useCallback } from 'react';
import { useAuth } from '@infrastructure/supabase/auth/AuthProvider';
import { useLibraryStore } from '../store/libraryStore';
import { container } from '@infrastructure/di/container';

export function useTreeOperations() {
  const { user } = useAuth();
  const { addTree, updateTree, removeTree, setLoading, setError } = useLibraryStore();

  const createTree = useCallback(async (title: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const tree = await container.treeService.createTree(user.id, title);
      addTree(tree);
      setError(null);
      return tree;
    } catch (error) {
      console.error('Failed to create tree:', error);
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, addTree, setLoading, setError]);

  const deleteTree = useCallback(async (treeId: string) => {
    setLoading(true);
    try {
      await container.treeService.deleteTree(treeId);
      removeTree(treeId);
      setError(null);
    } catch (error) {
      console.error('Failed to delete tree:', error);
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [removeTree, setLoading, setError]);

  const renameTree = useCallback(async (treeId: string, title: string) => {
    setLoading(true);
    try {
      const updated = await container.treeService.renameTree(treeId, title);
      updateTree(treeId, { title: updated.title, updatedAt: updated.updatedAt });
      setError(null);
    } catch (error) {
      console.error('Failed to rename tree:', error);
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [updateTree, setLoading, setError]);

  return {
    createTree,
    deleteTree,
    renameTree,
  };
}
```

### Subtask 3.2.5: LibraryApp 컴포넌트 작성

**목표**: 기존 LibraryApp.js를 TypeScript로 재작성하되 분할

**AI 실행 지시**:
```typescript
// src/features/library/components/LibraryApp.tsx
import React from 'react';
import { useLibraryData } from '../hooks/useLibraryData';
import { LibrarySidebar } from './LibrarySidebar';
import { LibraryContent } from './LibraryContent';
import { useLibraryStore } from '../store/libraryStore';

export function LibraryApp() {
  useLibraryData(); // 데이터 로딩

  const isSidebarCollapsed = useLibraryStore(state => state.isSidebarCollapsed);
  const loading = useLibraryStore(state => state.loading);
  const error = useLibraryStore(state => state.error);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600">오류 발생</h2>
          <p className="text-gray-600 mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <LibrarySidebar collapsed={isSidebarCollapsed} />
      <LibraryContent />

      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-10 flex items-center justify-center pointer-events-none">
          <div className="bg-white px-6 py-4 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">로딩 중...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// src/features/library/components/LibrarySidebar.tsx
import React from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { useTreeOperations } from '../hooks/useTreeOperations';
import { FolderList } from './FolderList';
import { TreeList } from './TreeList';

interface LibrarySidebarProps {
  collapsed: boolean;
}

export function LibrarySidebar({ collapsed }: LibrarySidebarProps) {
  const folders = useLibraryStore(state => state.folders);
  const visibleTrees = useLibraryStore(state => state.visibleTrees());
  const { createTree } = useTreeOperations();

  const handleCreateTree = async () => {
    const title = prompt('새 트리 이름:');
    if (title) {
      await createTree(title);
    }
  };

  if (collapsed) {
    return (
      <div className="w-12 bg-gray-800 flex flex-col items-center py-4">
        {/* 축소된 사이드바 */}
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">JARVIS</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <button
            onClick={handleCreateTree}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
          >
            + 새 트리
          </button>
        </div>

        <FolderList folders={folders} />
        <TreeList trees={visibleTrees} />
      </div>
    </div>
  );
}

// src/features/library/components/LibraryContent.tsx
import React from 'react';
import { useLibraryStore } from '../store/libraryStore';

export function LibraryContent() {
  const selectedTree = useLibraryStore(state => state.selectedTree());

  if (!selectedTree) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <p className="text-lg">트리를 선택하세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white p-8">
      <h2 className="text-2xl font-bold mb-4">{selectedTree.title}</h2>
      <div className="text-gray-600">
        노드 수: {selectedTree.treeData.nodes.length}
      </div>
      {/* 트리 시각화는 Task 3.3에서 */}
    </div>
  );
}
```

### Subtask 3.2.6: 리스트 컴포넌트 작성

**AI 실행 지시**:
```typescript
// src/features/library/components/TreeList.tsx
import React from 'react';
import type { Tree } from '@domain/entities';
import { useLibraryStore } from '../store/libraryStore';
import { useTreeOperations } from '../hooks/useTreeOperations';

interface TreeListProps {
  trees: Tree[];
}

export function TreeList({ trees }: TreeListProps) {
  const selectedTreeId = useLibraryStore(state => state.selectedTreeId);
  const selectTree = useLibraryStore(state => state.selectTree);
  const { deleteTree, renameTree } = useTreeOperations();

  const handleDelete = async (treeId: string, title: string) => {
    if (confirm(`"${title}" 트리를 삭제하시겠습니까?`)) {
      await deleteTree(treeId);
    }
  };

  const handleRename = async (treeId: string) => {
    const newTitle = prompt('새 이름:');
    if (newTitle) {
      await renameTree(treeId, newTitle);
    }
  };

  return (
    <div className="px-4 py-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
        트리
      </h3>
      <div className="space-y-1">
        {trees.map(tree => (
          <div
            key={tree.id}
            className={`
              px-3 py-2 rounded-md cursor-pointer group
              ${selectedTreeId === tree.id
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-700 text-gray-300'
              }
            `}
            onClick={() => selectTree(tree.id)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm truncate">{tree.title}</span>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename(tree.id);
                  }}
                  className="p-1 hover:bg-gray-600 rounded"
                  title="이름 변경"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(tree.id, tree.title);
                  }}
                  className="p-1 hover:bg-red-600 rounded"
                  title="삭제"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// src/features/library/components/FolderList.tsx
import React from 'react';
import type { Folder } from '@domain/entities';
import { useLibraryStore } from '../store/libraryStore';

interface FolderListProps {
  folders: Folder[];
}

export function FolderList({ folders }: FolderListProps) {
  const selectedFolderId = useLibraryStore(state => state.selectedFolderId);
  const expandedFolderIds = useLibraryStore(state => state.expandedFolderIds);
  const selectFolder = useLibraryStore(state => state.selectFolder);
  const toggleFolder = useLibraryStore(state => state.toggleFolder);

  // 루트 폴더만 (parentId가 null)
  const rootFolders = folders.filter(f => !f.parentId);

  return (
    <div className="px-4 py-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
        폴더
      </h3>
      <div className="space-y-1">
        {rootFolders.map(folder => (
          <FolderItem
            key={folder.id}
            folder={folder}
            allFolders={folders}
            selectedFolderId={selectedFolderId}
            expandedFolderIds={expandedFolderIds}
            selectFolder={selectFolder}
            toggleFolder={toggleFolder}
          />
        ))}
      </div>
    </div>
  );
}

// 재귀 컴포넌트
function FolderItem({
  folder,
  allFolders,
  selectedFolderId,
  expandedFolderIds,
  selectFolder,
  toggleFolder,
}: {
  folder: Folder;
  allFolders: Folder[];
  selectedFolderId: string | null;
  expandedFolderIds: Set<string>;
  selectFolder: (id: string | null) => void;
  toggleFolder: (id: string) => void;
}) {
  const children = allFolders.filter(f => f.parentId === folder.id);
  const isExpanded = expandedFolderIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <div
        className={`
          px-3 py-2 rounded-md cursor-pointer flex items-center justify-between
          ${isSelected
            ? 'bg-blue-600 text-white'
            : 'hover:bg-gray-700 text-gray-300'
          }
        `}
        onClick={() => selectFolder(folder.id)}
      >
        <div className="flex items-center gap-2">
          {children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="w-4 h-4"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <span className="text-sm">{folder.name}</span>
        </div>
      </div>

      {isExpanded && children.length > 0 && (
        <div className="ml-4">
          {children.map(child => (
            <FolderItem
              key={child.id}
              folder={child}
              allFolders={allFolders}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              selectFolder={selectFolder}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 검증 (수동)

```bash
npm run dev

# 브라우저에서 확인
□ 로그인 후 LibraryApp 표시
□ 사이드바에 "새 트리" 버튼 표시
□ 새 트리 클릭 → 이름 입력 → 트리 생성
□ 트리 목록에 새 트리 표시
□ 트리 클릭 → LibraryContent에 트리 정보 표시
□ 트리 hover → 이름변경/삭제 버튼 표시
□ 폴더가 있으면 폴더 목록 표시
```

**커밋**:
```bash
git add .
git commit -m "feat: implement library core features

- Add LibraryApp with sidebar and content area
- Implement tree CRUD operations
- Add folder display with hierarchy
- Connect Zustand store to UI
- Load trees and folders from Supabase

Features:
- Create, rename, delete trees
- Select tree/folder
- Display tree list with actions
"
```

---

## Task 3.3: 트리 시각화 기능 이식 (거대 파일 분할)

**목표**: HierarchicalForceTree.js (3,795줄) → 15개 파일로 분할

### 분할 전략

```
HierarchicalForceTree.js (3,795줄)
↓
components/ (6개 파일, 1,100줄)
├── TreeCanvas.tsx (250줄)
├── TreeNode.tsx (150줄)
├── TreeLink.tsx (100줄)
├── TreeControls.tsx (150줄)
├── TreeLegend.tsx (80줄)
└── TreeTooltip.tsx (100줄)

hooks/ (4개 파일, 900줄)
├── useTreeSimulation.ts (300줄)
├── useTreeZoom.ts (200줄)
├── useTreeDrag.ts (250줄)
└── useTreeSelection.ts (150줄)

services/ (3개 파일, 750줄)
├── TreeLayoutService.ts (300줄)
├── TreeAnimationService.ts (250줄)
└── TreeCollisionService.ts (200줄)

domain/services/ (2개 파일, 700줄)
├── TreeForceCalculator.ts (400줄)
└── TreeHierarchyBuilder.ts (300줄)
```

### Subtask 3.3.1: Domain 서비스 작성 (순수 로직)

**AI 실행 지시**:
```typescript
// src/domain/services/TreeForceCalculator.ts
import type { TreeNode } from '../entities';

export interface ForceConfig {
  linkDistance: number;
  chargeStrength: number;
  collisionRadius: number;
  centerStrength: number;
}

export class TreeForceCalculator {
  /**
   * 레벨별 노드 간 거리 계산
   */
  static calculateLinkDistance(sourceLevel: number, targetLevel: number): number {
    const baseDistance = 100;
    const levelDiff = Math.abs(targetLevel - sourceLevel);
    return baseDistance + (levelDiff * 20);
  }

  /**
   * 노드 크기에 따른 충돌 반경 계산
   */
  static calculateCollisionRadius(node: TreeNode): number {
    const baseRadius = 20;
    const sizeMultiplier = node.level === 0 ? 1.5 : 1;
    return baseRadius * sizeMultiplier;
  }

  /**
   * 중심 힘 강도 계산 (루트 노드는 중심 고정)
   */
  static calculateCenterStrength(node: TreeNode): number {
    return node.level === 0 ? 1 : 0.1;
  }

  /**
   * 전하 힘 계산 (노드 간 밀어내는 힘)
   */
  static calculateChargeStrength(node: TreeNode): number {
    const baseStrength = -300;
    const levelMultiplier = node.level === 0 ? 2 : 1;
    return baseStrength * levelMultiplier;
  }
}

// src/domain/services/TreeHierarchyBuilder.ts
import type { TreeNode, TreeLink } from '../entities';

export interface TreeHierarchy {
  nodes: TreeNode[];
  links: TreeLink[];
  maxLevel: number;
  root: TreeNode | null;
}

export class TreeHierarchyBuilder {
  /**
   * 노드 배열에서 계층 구조 생성
   */
  static build(nodes: TreeNode[], links: TreeLink[]): TreeHierarchy {
    // 레벨 계산
    const nodesWithLevel = this.calculateLevels(nodes, links);

    // 루트 찾기
    const root = nodesWithLevel.find(n => n.level === 0) || null;

    // 최대 레벨
    const maxLevel = Math.max(...nodesWithLevel.map(n => n.level), 0);

    return {
      nodes: nodesWithLevel,
      links,
      maxLevel,
      root,
    };
  }

  private static calculateLevels(
    nodes: TreeNode[],
    links: TreeLink[]
  ): TreeNode[] {
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]));
    const childrenMap = new Map<string, string[]>();

    // 부모-자식 관계 맵핑
    for (const link of links) {
      const parentId = typeof link.source === 'string' ? link.source : link.source.id;
      const childId = typeof link.target === 'string' ? link.target : link.target.id;

      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(childId);
    }

    // 레벨 계산 (BFS)
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = [];

    // 루트 노드 찾기 (부모 없는 노드)
    const roots = nodes.filter(n => !n.parentId);
    for (const root of roots) {
      queue.push({ id: root.id, level: 0 });
    }

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodeMap.get(id);
      if (node) {
        node.level = level;
      }

      // 자식 노드 큐에 추가
      const children = childrenMap.get(id) || [];
      for (const childId of children) {
        queue.push({ id: childId, level: level + 1 });
      }
    }

    return Array.from(nodeMap.values());
  }
}
```

### Subtask 3.3.2: Feature 서비스 작성 (D3 래핑)

**AI 실행 지시**:
```typescript
// src/features/tree/services/TreeLayoutService.ts
import * as d3 from 'd3';
import type { TreeNode, TreeLink } from '@domain/entities';
import { TreeForceCalculator } from '@domain/services/TreeForceCalculator';

export interface D3Node extends d3.SimulationNodeDatum, TreeNode {
  x: number;
  y: number;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node>, TreeLink {}

export class TreeLayoutService {
  private simulation: d3.Simulation<D3Node, D3Link> | null = null;

  /**
   * D3 Force Simulation 생성
   */
  createSimulation(
    nodes: TreeNode[],
    links: TreeLink[],
    width: number,
    height: number
  ): d3.Simulation<D3Node, D3Link> {
    // D3 노드로 변환
    const d3Nodes: D3Node[] = nodes.map(n => ({ ...n, x: width / 2, y: height / 2 }));
    const d3Links: D3Link[] = links.map(l => ({ ...l }));

    this.simulation = d3.forceSimulation(d3Nodes)
      .force(
        'link',
        d3.forceLink<D3Node, D3Link>(d3Links)
          .id(d => d.id)
          .distance(link => {
            const source = link.source as D3Node;
            const target = link.target as D3Node;
            return TreeForceCalculator.calculateLinkDistance(
              source.level,
              target.level
            );
          })
      )
      .force(
        'charge',
        d3.forceManyBody<D3Node>()
          .strength(node => TreeForceCalculator.calculateChargeStrength(node))
      )
      .force(
        'collision',
        d3.forceCollide<D3Node>()
          .radius(node => TreeForceCalculator.calculateCollisionRadius(node))
      )
      .force(
        'center',
        d3.forceCenter<D3Node>(width / 2, height / 2)
          .strength(node => TreeForceCalculator.calculateCenterStrength(node))
      );

    return this.simulation;
  }

  /**
   * Simulation 업데이트
   */
  updateSimulation(nodes: TreeNode[], links: TreeLink[]): void {
    if (!this.simulation) return;

    const d3Nodes: D3Node[] = nodes.map(n => ({ ...n, x: 0, y: 0 }));
    const d3Links: D3Link[] = links.map(l => ({ ...l }));

    this.simulation.nodes(d3Nodes);
    this.simulation.force<d3.ForceLink<D3Node, D3Link>>('link')?.links(d3Links);
    this.simulation.alpha(0.3).restart();
  }

  /**
   * Simulation 중지
   */
  stop(): void {
    this.simulation?.stop();
  }

  /**
   * Simulation 재시작
   */
  restart(): void {
    this.simulation?.alpha(0.3).restart();
  }
}
```

### Subtask 3.3.3: React Hooks 작성

**AI 실행 지시**:
```typescript
// src/features/tree/hooks/useTreeSimulation.ts
import { useEffect, useRef, useState } from 'react';
import type { TreeNode, TreeLink } from '@domain/entities';
import { TreeLayoutService, type D3Node } from '../services/TreeLayoutService';

export function useTreeSimulation(
  nodes: TreeNode[],
  links: TreeLink[],
  width: number,
  height: number
) {
  const serviceRef = useRef(new TreeLayoutService());
  const [simulationNodes, setSimulationNodes] = useState<D3Node[]>([]);

  useEffect(() => {
    const service = serviceRef.current;
    const simulation = service.createSimulation(nodes, links, width, height);

    simulation.on('tick', () => {
      setSimulationNodes([...simulation.nodes()]);
    });

    return () => {
      service.stop();
    };
  }, [nodes, links, width, height]);

  return {
    nodes: simulationNodes,
    restart: () => serviceRef.current.restart(),
    stop: () => serviceRef.current.stop(),
  };
}

// src/features/tree/hooks/useTreeZoom.ts
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export function useTreeZoom(
  svgRef: React.RefObject<SVGSVGElement>,
  containerRef: React.RefObject<SVGGElement>
) {
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = d3.select(containerRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    return () => {
      svg.on('.zoom', null);
    };
  }, [svgRef, containerRef]);

  const resetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;

    d3.select(svgRef.current)
      .transition()
      .duration(750)
      .call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity
      );
  };

  return { resetZoom };
}

// src/features/tree/hooks/useTreeDrag.ts
import { useRef } from 'react';
import * as d3 from 'd3';
import type { D3Node } from '../services/TreeLayoutService';

export function useTreeDrag(
  onDragStart?: (node: D3Node) => void,
  onDragEnd?: (node: D3Node) => void
) {
  const simulationRef = useRef<d3.Simulation<D3Node, any>>();

  const dragBehavior = d3.drag<SVGCircleElement, D3Node>()
    .on('start', (event, d) => {
      if (!event.active && simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
      onDragStart?.(d);
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active && simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
      d.fx = null;
      d.fy = null;
      onDragEnd?.(d);
    });

  return {
    dragBehavior,
    setSimulation: (simulation: d3.Simulation<D3Node, any>) => {
      simulationRef.current = simulation;
    },
  };
}

// src/features/tree/hooks/useTreeSelection.ts
import { useState, useCallback } from 'react';
import type { TreeNode } from '@domain/entities';

export function useTreeSelection() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const isSelected = useCallback((nodeId: string): boolean => {
    return selectedNodeId === nodeId;
  }, [selectedNodeId]);

  return {
    selectedNodeId,
    selectNode,
    isSelected,
  };
}
```

### Subtask 3.3.4: 컴포넌트 작성

**AI 실행 지시**:
```typescript
// src/features/tree/components/TreeVisualization/TreeCanvas.tsx
import React, { useRef, useEffect } from 'react';
import type { TreeNode, TreeLink } from '@domain/entities';
import { useTreeSimulation } from '../../hooks/useTreeSimulation';
import { useTreeZoom } from '../../hooks/useTreeZoom';
import { TreeNodeComponent } from './TreeNode';
import { TreeLinkComponent } from './TreeLink';

interface TreeCanvasProps {
  nodes: TreeNode[];
  links: TreeLink[];
  width: number;
  height: number;
  onNodeClick?: (node: TreeNode) => void;
}

export function TreeCanvas({
  nodes,
  links,
  width,
  height,
  onNodeClick,
}: TreeCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement>(null);

  const { nodes: simulationNodes } = useTreeSimulation(nodes, links, width, height);
  const { resetZoom } = useTreeZoom(svgRef, containerRef);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-300"
      >
        <g ref={containerRef}>
          {/* Links */}
          {links.map((link, i) => (
            <TreeLinkComponent
              key={`link-${i}`}
              link={link}
              nodes={simulationNodes}
            />
          ))}

          {/* Nodes */}
          {simulationNodes.map(node => (
            <TreeNodeComponent
              key={node.id}
              node={node}
              onClick={() => onNodeClick?.(node)}
            />
          ))}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-white shadow-md rounded-md p-2">
        <button
          onClick={resetZoom}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Reset Zoom
        </button>
      </div>
    </div>
  );
}

// src/features/tree/components/TreeVisualization/TreeNode.tsx
import React from 'react';
import type { D3Node } from '../../services/TreeLayoutService';

interface TreeNodeProps {
  node: D3Node;
  onClick?: () => void;
}

export function TreeNodeComponent({ node, onClick }: TreeNodeProps) {
  const radius = node.level === 0 ? 20 : 14;
  const fillColor = node.level === 0 ? '#3b82f6' : '#60a5fa';

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onClick={onClick}
      className="cursor-pointer"
    >
      <circle
        r={radius}
        fill={fillColor}
        stroke="#1e40af"
        strokeWidth={2}
        className="hover:stroke-4 transition-all"
      />
      <text
        dy=".35em"
        textAnchor="middle"
        fontSize={10}
        fill="white"
        pointerEvents="none"
      >
        {node.keyword.substring(0, 10)}
      </text>
    </g>
  );
}

// src/features/tree/components/TreeVisualization/TreeLink.tsx
import React from 'react';
import type { TreeLink } from '@domain/entities';
import type { D3Node } from '../../services/TreeLayoutService';

interface TreeLinkProps {
  link: TreeLink;
  nodes: D3Node[];
}

export function TreeLinkComponent({ link, nodes }: TreeLinkProps) {
  const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
  const targetId = typeof link.target === 'string' ? link.target : link.target.id;

  const source = nodes.find(n => n.id === sourceId);
  const target = nodes.find(n => n.id === targetId);

  if (!source || !target) return null;

  return (
    <line
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      stroke="#cbd5e1"
      strokeWidth={2}
    />
  );
}
```

### Subtask 3.3.5: LibraryContent에 트리 시각화 통합

**AI 실행 지시**:
```typescript
// src/features/library/components/LibraryContent.tsx (수정)
import React from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { TreeCanvas } from '@features/tree/components/TreeVisualization/TreeCanvas';

export function LibraryContent() {
  const selectedTree = useLibraryStore(state => state.selectedTree());
  const showQAPanel = useLibraryStore(state => state.showQAPanel);

  if (!selectedTree) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <p className="text-lg">트리를 선택하세요</p>
        </div>
      </div>
    );
  }

  const handleNodeClick = (node: any) => {
    showQAPanel(node.id);
  };

  return (
    <div className="flex-1 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold">{selectedTree.title}</h2>
        <div className="text-sm text-gray-600 mt-1">
          노드 수: {selectedTree.treeData.nodes.length}
        </div>
      </div>

      <div className="flex-1">
        <TreeCanvas
          nodes={selectedTree.treeData.nodes}
          links={selectedTree.treeData.links}
          width={1200}
          height={800}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
}
```

### 검증 (수동)

```bash
npm run dev

# 브라우저에서 확인
□ 트리 선택 → 시각화 표시됨
□ 노드가 Force Simulation으로 배치됨
□ 노드 드래그 가능
□ 줌/팬 동작
□ "Reset Zoom" 버튼 동작
□ 노드 클릭 → QA 패널 표시 (Task 3.4에서)
```

**파일 크기 확인**:
```bash
# 각 파일이 300줄 이하인지 확인
wc -l src/features/tree/components/TreeVisualization/*.tsx
wc -l src/features/tree/hooks/*.ts
wc -l src/features/tree/services/*.ts
wc -l src/domain/services/Tree*.ts

# 전부 300줄 이하여야 함
```

**커밋**:
```bash
git add .
git commit -m "feat: implement tree visualization with D3

- Split HierarchicalForceTree (3,795 lines) into 15 files
- Add TreeForceCalculator and TreeHierarchyBuilder in domain
- Implement TreeLayoutService for D3 force simulation
- Create React hooks for simulation, zoom, drag
- Add TreeCanvas, TreeNode, TreeLink components
- Integrate tree visualization into LibraryContent

File sizes:
- All components < 250 lines
- All hooks < 300 lines
- All services < 400 lines
"
```

---

**(계속됩니다...)**

다음 내용:
- Task 3.4: AI 채팅 기능 이식
- Task 3.5: 나머지 기능 이식
- Phase 3 체크포인트

문서가 매우 길어서 다른 파일로 분리하겠습니다. 계속 작성할까요?
