# JARVIS 라이브러리 앱 구현 계획서

## 개발 목표

### 주요 목표
- **이중 창 시스템 구현**: 위젯과 라이브러리 앱이 독립적으로 동작하는 시스템 구축
- **현대적 UI 구현**: shadcn/ui를 활용한 깔끔하고 사용자 친화적인 인터페이스
- **지식 관리 허브**: 위젯에서 생성된 지식 트리를 체계적으로 저장, 관리, 탐색할 수 있는 환경 제공
- **재사용 가능한 아키텍처**: 기존 위젯 컴포넌트를 최대한 재사용하여 개발 효율성 극대화

### 기술적 목표
- React 18 + shadcn/ui 기반의 컴포넌트 설계
- Electron 이중 창 관리 시스템 구현
- D3.js 기반 트리 시각화 재사용 및 최적화
- 더미 데이터를 활용한 프론트엔드 우선 개발

## 기대 상황

### 사용자 경험
1. **앱 시작 시**: 라이브러리 앱과 위젯이 동시에 실행되어 즉시 사용 가능
2. **위젯 독립성**: 라이브러리 앱을 종료해도 위젯은 백그라운드에서 계속 실행
3. **단축키 접근성**: `Cmd+1`로 위젯 토글, `Alt+\``로 위젯 호출
4. **데이터 동기화**: 위젯에서 생성한 트리가 라이브러리에 자동 저장
5. **효율적 관리**: 폴더 구조로 메모 정리, 검색으로 빠른 접근
6. **직관적 편집**: 트리 노드 클릭으로 바로 편집 모드 진입

### 개발 완료 후 상황
- 사용자는 학습이나 연구 중 언제든 위젯으로 질문하고 지식 트리 생성
- 생성된 모든 트리는 라이브러리에서 체계적으로 관리
- 과거 지식을 쉽게 찾아보고 이어서 확장 가능
- 폴더와 태그로 주제별 정리
- 전체 지식 지도를 한눈에 조망 가능

## 프로젝트 개요

### 목표
- 현재 위젯 앱과 함께 실행되는 라이브러리 데스크톱 앱 구현
- shadcn/ui를 사용한 현대적인 UI
- 더미 데이터를 활용한 프론트엔드 개발 (DB 연결은 추후)

### 기술 스택
- React 18.2.0 (기존 프로젝트 기반)
- shadcn/ui + Tailwind CSS
- Electron (기존 구조 활용)
- D3.js (기존 트리 시각화 재사용)

## Phase 1: 프로젝트 설정 (1-2일)

### 1.1 shadcn/ui 설정

**설치 및 초기화:**
```bash
# Tailwind CSS 업데이트
npm install -D tailwindcss@latest autoprefixer@latest

# shadcn/ui 수동 설정
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react
npm install @radix-ui/react-slot
npm install tailwindcss-animate
```

**파일 생성:**
```javascript
// src/lib/utils.js
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

**Tailwind 설정 업데이트:**
```javascript
// tailwind.config.js 수정
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

**경로 별칭 설정 (CRA 환경):**
```json
{
  "compilerOptions": {
    "baseUrl": "src",
    "paths": {
      "@/*": ["*"]
    }
  }
}
```
> CRA를 사용하는 만큼 `jsconfig.json`을 생성하거나 상대 경로를 사용해 `@/...` import 오류를 방지합니다.

**CSS 변수 추가:**
```css
/* src/index.css 에 추가 */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}
```

### 1.2 필요한 shadcn/ui 컴포넌트 설치

```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add scroll-area
npx shadcn@latest add resizable
npx shadcn@latest add context-menu
npx shadcn@latest add dialog
npx shadcn@latest add badge
npx shadcn@latest add card
npx shadcn@latest add select
npx shadcn@latest add label
npx shadcn@latest add toast
npx shadcn@latest add sheet
```

## Phase 2: 더미 데이터 및 기본 구조 (1일)

### 2.1 더미 데이터 생성

```javascript
// src/data/dummyData.js
export const dummyLibraryData = {
  folders: [
    {
      id: "folder_1",
      name: "학습 자료",
      parentId: null,
      createdAt: Date.now() - 86400000 * 7,
      expanded: true
    },
    {
      id: "folder_2",
      name: "프로젝트",
      parentId: null,
      createdAt: Date.now() - 86400000 * 5,
      expanded: false
    },
    {
      id: "folder_3",
      name: "React",
      parentId: "folder_1",
      createdAt: Date.now() - 86400000 * 3,
      expanded: true
    },
    {
      id: "folder_4",
      name: "JavaScript",
      parentId: "folder_1",
      createdAt: Date.now() - 86400000 * 2,
      expanded: false
    }
  ],
  memos: [
    {
      id: "memo_1",
      title: "React Hooks 이해하기",
      folderId: "folder_3",
      treeData: {
        nodes: [
          {
            id: "root",
            keyword: "React Hooks",
            fullText: "React Hooks는 함수형 컴포넌트에서 상태와 생명주기 기능을 사용할 수 있게 해주는 기능입니다.",
            level: 0,
            size: 20,
            status: "answered"
          },
          {
            id: "node_1",
            keyword: "useState",
            fullText: "useState는 함수형 컴포넌트에서 상태를 관리할 수 있게 해주는 Hook입니다.",
            level: 1,
            size: 15,
            status: "answered"
          },
          {
            id: "node_2",
            keyword: "useEffect",
            fullText: "useEffect는 컴포넌트의 사이드 이펙트를 처리하는 Hook입니다.",
            level: 1,
            size: 15,
            status: "answered"
          }
        ],
        links: [
          { source: "root", target: "node_1", value: 1 },
          { source: "root", target: "node_2", value: 1 }
        ]
      },
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 3600000
    },
    {
      id: "memo_2",
      title: "JavaScript 비동기 처리",
      folderId: "folder_4",
      treeData: {
        nodes: [
          {
            id: "root",
            keyword: "비동기 처리",
            fullText: "JavaScript에서 비동기 처리는 Promise, async/await를 통해 구현됩니다.",
            level: 0,
            size: 20,
            status: "answered"
          },
          {
            id: "node_1",
            keyword: "Promise",
            fullText: "Promise는 비동기 작업의 완료 또는 실패를 나타내는 객체입니다.",
            level: 1,
            size: 15,
            status: "answered"
          }
        ],
        links: [
          { source: "root", target: "node_1", value: 1 }
        ]
      },
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 7200000
    },
    {
      id: "memo_3",
      title: "프로젝트 아이디어",
      folderId: "folder_2",
      treeData: {
        nodes: [
          {
            id: "root",
            keyword: "프로젝트 기획",
            fullText: "새로운 웹 애플리케이션 프로젝트를 기획해보자",
            level: 0,
            size: 20,
            status: "answered"
          }
        ],
        links: []
      },
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000
    }
  ]
};

// 헬퍼 함수들
export const getFolderChildren = (folderId) => {
  return dummyLibraryData.folders.filter(folder => folder.parentId === folderId);
};

export const getMemosByFolder = (folderId) => {
  return dummyLibraryData.memos.filter(memo => memo.folderId === folderId);
};

export const getRootFolders = () => {
  return dummyLibraryData.folders.filter(folder => folder.parentId === null);
};

export const getAllMemos = () => {
  return dummyLibraryData.memos;
};
```

### 2.2 App.js 모드 분기 로직

```javascript
// src/App.js 수정
import React from 'react';
import './App.css';
import './theme/glass.css';
import HierarchicalForceTree from './components/HierarchicalForceTree';
import LibraryApp from './components/library/LibraryApp';
import { SettingsProvider } from './hooks/SettingsContext';

function App() {
  // URL 파라미터에서 모드 확인
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'widget';

  return (
    <SettingsProvider>
      <div className="App">
        {mode === 'library' ? (
          <LibraryApp />
        ) : (
          <div className="App-content">
            <HierarchicalForceTree />
          </div>
        )}
      </div>
    </SettingsProvider>
  );
}

export default App;
```

## Phase 3: 라이브러리 앱 기본 레이아웃 (2일)

### 3.1 LibraryApp 컴포넌트

```javascript
// src/components/library/LibraryApp.js
import React, { useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import Sidebar from './Sidebar';
import TreeCanvas from './TreeCanvas';
import { dummyLibraryData } from '@/data/dummyData';

const LibraryApp = () => {
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [libraryData, setLibraryData] = useState(dummyLibraryData);

  const handleMemoSelect = (memo) => {
    setSelectedMemo(memo);
  };

  const handleFolderCreate = (name, parentId = null) => {
    const newFolder = {
      id: `folder_${Date.now()}`,
      name,
      parentId,
      createdAt: Date.now(),
      expanded: true
    };

    setLibraryData(prev => ({
      ...prev,
      folders: [...prev.folders, newFolder]
    }));
  };

  const handleMemoCreate = (title, folderId) => {
    const newMemo = {
      id: `memo_${Date.now()}`,
      title,
      folderId,
      treeData: { nodes: [], links: [] },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setLibraryData(prev => ({
      ...prev,
      memos: [...prev.memos, newMemo]
    }));
  };

  return (
    <div className="h-screen bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <Sidebar
            data={libraryData}
            selectedMemo={selectedMemo}
            onMemoSelect={handleMemoSelect}
            onFolderCreate={handleFolderCreate}
            onMemoCreate={handleMemoCreate}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={75}>
          <TreeCanvas
            selectedMemo={selectedMemo}
            onMemoUpdate={(updatedMemo) => {
              setLibraryData(prev => ({
                ...prev,
                memos: prev.memos.map(memo =>
                  memo.id === updatedMemo.id ? updatedMemo : memo
                )
              }));
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default LibraryApp;
```

### 3.2 Sidebar 컴포넌트

```javascript
// src/components/library/Sidebar.js
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Folder, FileText } from 'lucide-react';
import FolderTree from './FolderTree';
import CreateDialog from './CreateDialog';

const Sidebar = ({
  data,
  selectedMemo,
  onMemoSelect,
  onFolderCreate,
  onMemoCreate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState('memo'); // 'memo' | 'folder'

  const filteredMemos = data.memos.filter(memo =>
    memo.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full border-r bg-card flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b space-y-3">
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateType('memo');
              setShowCreateDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            새 메모
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateType('folder');
              setShowCreateDialog(true);
            }}
          >
            <Folder className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="메모 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 폴더 트리 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <FolderTree
            folders={data.folders}
            memos={filteredMemos}
            selectedMemo={selectedMemo}
            onMemoSelect={onMemoSelect}
          />
        </div>
      </ScrollArea>

      {/* 다이얼로그 */}
      <CreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        type={createType}
        folders={data.folders}
        onFolderCreate={onFolderCreate}
        onMemoCreate={onMemoCreate}
      />
    </div>
  );
};

export default Sidebar;
```

### 3.3 FolderTree 컴포넌트

```javascript
// src/components/library/FolderTree.js
import React, { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRootFolders, getFolderChildren, getMemosByFolder } from '../../data/dummyData';

const FolderItem = ({ folder, folders, memos, level = 0, selectedMemo, onMemoSelect }) => {
  const [isExpanded, setIsExpanded] = useState(folder.expanded || false);
  const children = getFolderChildren(folder.id);
  const folderMemos = getMemosByFolder(folder.id);
  const hasChildren = children.length > 0 || folderMemos.length > 0;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              "flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer",
              "transition-colors duration-200"
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {hasChildren && (
              <button className="hover:bg-accent-foreground/10 rounded p-0.5">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}

            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-500" />
            ) : (
              <Folder className="h-4 w-4 text-blue-500" />
            )}

            <span className="flex-1 text-sm font-medium">{folder.name}</span>

            {folderMemos.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {folderMemos.length}
              </Badge>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>새 메모</ContextMenuItem>
          <ContextMenuItem>새 폴더</ContextMenuItem>
          <ContextMenuItem>이름 변경</ContextMenuItem>
          <ContextMenuItem className="text-destructive">삭제</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && (
        <div>
          {/* 자식 폴더들 */}
          {children.map(childFolder => (
            <FolderItem
              key={childFolder.id}
              folder={childFolder}
              folders={folders}
              memos={memos}
              level={level + 1}
              selectedMemo={selectedMemo}
              onMemoSelect={onMemoSelect}
            />
          ))}

          {/* 메모들 */}
          {folderMemos.map(memo => (
            <MemoItem
              key={memo.id}
              memo={memo}
              level={level + 1}
              isSelected={selectedMemo?.id === memo.id}
              onSelect={() => onMemoSelect(memo)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MemoItem = ({ memo, level, isSelected, onSelect }) => {
  const nodeCount = memo.treeData?.nodes?.length || 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer",
            "transition-colors duration-200",
            isSelected && "bg-accent border-l-2 border-primary"
          )}
          style={{ paddingLeft: `${level * 16 + 28}px` }}
          onClick={onSelect}
        >
          <FileText className="h-4 w-4 text-green-500" />
          <span className="flex-1 text-sm truncate">{memo.title}</span>
          {nodeCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {nodeCount}개
            </Badge>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>이름 변경</ContextMenuItem>
        <ContextMenuItem>복제</ContextMenuItem>
        <ContextMenuItem className="text-destructive">삭제</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const FolderTree = ({ folders, memos, selectedMemo, onMemoSelect }) => {
  const rootFolders = getRootFolders();

  return (
    <div className="space-y-1">
      {rootFolders.map(folder => (
        <FolderItem
          key={folder.id}
          folder={folder}
          folders={folders}
          memos={memos}
          selectedMemo={selectedMemo}
          onMemoSelect={onMemoSelect}
        />
      ))}
    </div>
  );
};

export default FolderTree;
```
> 컨텍스트 메뉴의 새 메모/폴더/삭제 액션은 Phase 5에서 구체적인 상태 업데이트 로직으로 연결합니다.

## Phase 4: 트리 캔버스 및 편집 기능 (2-3일)

### 4.1 TreeCanvas 컴포넌트

```javascript
// src/components/library/TreeCanvas.js
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Edit3 } from 'lucide-react';
import LibraryTreeVisualization from './LibraryTreeVisualization';

const TreeCanvas = ({ selectedMemo, onMemoUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const nodeCount = useMemo(() => {
    return selectedMemo?.treeData?.nodes?.length || 0;
  }, [selectedMemo]);

  if (!selectedMemo) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-4">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-muted-foreground">
              메모를 선택해주세요
            </h3>
            <p className="text-sm text-muted-foreground">
              사이드바에서 메모를 클릭하면 지식 트리를 볼 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 헤더 */}
      <div className="border-b bg-card">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">{selectedMemo.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  생성: {formatDate(selectedMemo.createdAt)}
                </div>
                <div className="flex items-center gap-1">
                  <Edit3 className="h-4 w-4" />
                  수정: {formatDate(selectedMemo.updatedAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline">
                {nodeCount}개 노드
              </Badge>
              <Button
                variant={isEditMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditMode(!isEditMode)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {isEditMode ? "보기 모드" : "편집 모드"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 트리 시각화 영역 */}
      <div className="flex-1 relative">
        {nodeCount > 0 ? (
          <LibraryTreeVisualization
            treeData={selectedMemo.treeData}
            isEditMode={isEditMode}
            onTreeUpdate={(updatedTreeData) => {
              const updatedMemo = {
                ...selectedMemo,
                treeData: updatedTreeData,
                updatedAt: Date.now()
              };
              onMemoUpdate(updatedMemo);
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <Card className="w-96">
              <CardHeader>
                <CardTitle className="text-center">빈 메모</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  이 메모는 아직 내용이 없습니다.
                </p>
                <Button onClick={() => setIsEditMode(true)}>
                  편집 시작하기
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreeCanvas;
```

### 4.2 LibraryTreeVisualization 컴포넌트

```javascript
// src/components/library/LibraryTreeVisualization.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import TreeNode from '../TreeNode';
import NodeAssistantPanel from '../NodeAssistantPanel';
import TreeAnimationService from '../../services/TreeAnimationService';
import QuestionService from '../../services/QuestionService';

const LibraryTreeVisualization = ({ treeData, isEditMode, onTreeUpdate }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });

  const treeAnimationService = useRef(new TreeAnimationService());
  const questionService = useRef(new QuestionService());
  const animationRef = useRef(null);

  // 컨테이너 크기 감지
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // 트리 데이터가 변경될 때 노드/링크 업데이트
  useEffect(() => {
    if (!treeData || !treeData.nodes) return;

    // 기존 애니메이션 정리
    if (animationRef.current) {
      animationRef.current.stop();
    }

    // Tree layout과 애니메이션을 사용하여 노드 위치 계산
    const animation = treeAnimationService.current.calculateTreeLayoutWithAnimation(
      nodes, // 현재 노드 위치
      treeData.nodes,
      treeData.links,
      dimensions,
      (animatedNodes, animatedLinks) => {
        setNodes(animatedNodes);
        setLinks(animatedLinks);
      }
    );

    animationRef.current = animation;

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [treeData, dimensions]);

  // 줌/팬 기능 설정
  useEffect(() => {
    if (!svgRef.current) return;

    const svgSelection = d3.select(svgRef.current);

    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        setViewTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k
        });
      });

    svgSelection.call(zoomBehavior);

    return () => {
      svgSelection.on('.zoom', null);
    };
  }, []);

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback((nodeId) => {
    if (isEditMode) {
      setExpandedNodeId(expandedNodeId === nodeId ? null : nodeId);
    }
    setSelectedNodeId(nodeId);
  }, [isEditMode, expandedNodeId]);

  // 트리 업데이트 핸들러
  const handleTreeDataUpdate = useCallback((updatedData) => {
    onTreeUpdate(updatedData);
  }, [onTreeUpdate]);

  const colorScheme = d3.scaleOrdinal(d3.schemeCategory10);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      >
        <defs>
          <marker
            id="arrowhead-library"
            viewBox="0 -5 10 10"
            refX={8}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="rgba(148,163,184,0.7)" />
          </marker>
        </defs>

        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
          {/* Links */}
          <g className="links">
            <AnimatePresence>
              {links.map((link, index) => {
                const sourceNode = nodes.find(n => n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target);

                if (!sourceNode || !targetNode) return null;

                const pathString = `M ${sourceNode.x} ${sourceNode.y + 20} L ${targetNode.x} ${targetNode.y - 20}`;

                return (
                  <motion.path
                    key={`${link.source}-${link.target}`}
                    d={pathString}
                    stroke="rgba(148, 163, 184, 0.7)"
                    strokeWidth={2}
                    fill="none"
                    markerEnd="url(#arrowhead-library)"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  />
                );
              })}
            </AnimatePresence>
          </g>

          {/* Nodes */}
          <g className="nodes">
            {nodes.map((node, index) => (
              <motion.g
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1, type: "spring" }}
              >
                <TreeNode
                  node={node}
                  position={{ x: node.x || 0, y: node.y || 0 }}
                  color={colorScheme(node.level || 0)}
                  onNodeClick={() => handleNodeClick(node.id)}
                  isExpanded={expandedNodeId === node.id}
                  isSelected={selectedNodeId === node.id}
                  isEditMode={isEditMode}
                />
              </motion.g>
            ))}
          </g>
        </g>
      </svg>

      {/* 편집 모드에서 노드 어시스턴트 패널 */}
      {isEditMode && expandedNodeId && (
        <div className="absolute top-4 right-4 w-96 max-h-[calc(100%-2rem)] overflow-hidden">
          <NodeAssistantPanel
            node={nodes.find(n => n.id === expandedNodeId)}
            onClose={() => setExpandedNodeId(null)}
            onUpdate={handleTreeDataUpdate}
            questionService={questionService.current}
          />
        </div>
      )}
    </div>
  );
};

export default LibraryTreeVisualization;
```

## Phase 5: 대화상자 및 유틸리티 (1일)

### 5.1 CreateDialog 컴포넌트

```javascript
// src/components/library/CreateDialog.js
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getRootFolders, getFolderChildren } from '../../data/dummyData';

const CreateDialog = ({
  open,
  onOpenChange,
  type,
  folders,
  onFolderCreate,
  onMemoCreate
}) => {
  const [name, setName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;

    if (type === 'folder') {
      onFolderCreate(name.trim(), selectedFolderId || null);
    } else {
      onMemoCreate(name.trim(), selectedFolderId || folders[0]?.id);
    }

    setName('');
    setSelectedFolderId('');
    onOpenChange(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // 폴더 옵션들을 계층적으로 표시
  const getFolderOptions = () => {
    const options = [];

    const addFolderOption = (folder, level = 0) => {
      const prefix = '　'.repeat(level);
      options.push({
        value: folder.id,
        label: `${prefix}${folder.name}`
      });

      // 자식 폴더들 추가
      const children = getFolderChildren(folder.id);
      children.forEach(child => addFolderOption(child, level + 1));
    };

    getRootFolders().forEach(folder => addFolderOption(folder));

    return options;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {type === 'folder' ? '새 폴더 만들기' : '새 메모 만들기'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">
              {type === 'folder' ? '폴더 이름' : '메모 제목'}
            </Label>
            <Input
              id="name"
              placeholder={type === 'folder' ? '폴더 이름을 입력하세요' : '메모 제목을 입력하세요'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="folder">
              {type === 'folder' ? '상위 폴더' : '저장할 폴더'}
            </Label>
            <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
              <SelectTrigger>
                <SelectValue placeholder={
                  type === 'folder'
                    ? '상위 폴더 선택 (선택사항)'
                    : '폴더를 선택하세요'
                } />
              </SelectTrigger>
              <SelectContent>
                {type === 'folder' && (
                  <SelectItem value="">루트 폴더</SelectItem>
                )}
                {getFolderOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            만들기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDialog;
```

## Phase 6: Electron Main Process 수정 (1일)

### 6.1 이중 창 구조 구현

```javascript
// electron/main.js 주요 부분 수정

let widgetWindow = null;
let libraryWindow = null;

const createWidgetWindow = () => {
  widgetWindow = new BrowserWindow({
    // 기존 위젯 설정 유지
    width: 1024,
    height: 720,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true, // 첫 시작시 표시
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const widgetUrl = isDev
    ? 'http://localhost:3000?mode=widget'
    : `file://${path.join(__dirname, '..', 'build', 'index.html')}?mode=widget`;

  widgetWindow.loadURL(widgetUrl);

  // 위젯은 닫기 시 숨김 처리
  widgetWindow.on('close', (event) => {
    event.preventDefault();
    widgetWindow.hide();
  });
};

const createLibraryWindow = () => {
  if (libraryWindow) {
    libraryWindow.focus();
    return;
  }

  libraryWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    show: true,
    title: 'JARVIS Library',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const libraryUrl = isDev
    ? 'http://localhost:3000?mode=library'
    : `file://${path.join(__dirname, '..', 'build', 'index.html')}?mode=library`;

  libraryWindow.loadURL(libraryUrl);

  // 라이브러리는 정상적으로 닫기 가능
  libraryWindow.on('closed', () => {
    libraryWindow = null;
  });
};

// 위젯 토글 단축키 (Cmd+1)
const registerWidgetToggle = () => {
  const success = globalShortcut.register('CommandOrControl+1', () => {
    if (!widgetWindow) {
      createWidgetWindow();
      return;
    }

    if (widgetWindow.isVisible()) {
      widgetWindow.hide();
    } else {
      widgetWindow.show();
      widgetWindow.focus();
    }
  });

  if (success) {
    logger?.info('Widget toggle shortcut registered (Cmd+1)');
  }
};

app.whenReady().then(() => {
  // 1. 위젯 창 생성 (표시됨)
  createWidgetWindow();

  // 2. 라이브러리 창 생성 (표시됨)
  createLibraryWindow();

  // 3. 단축키 등록
  registerWidgetToggle();
  registerPassThroughShortcut(); // 기존 Cmd+2 유지

  // 기존 핫키 관리
  applyHotkeySettings();
  applyTraySettings();
});

app.on('activate', () => {
  // macOS에서 Dock 아이콘 클릭시 라이브러리 창만 활성화
  if (!libraryWindow) {
    createLibraryWindow();
  } else {
    libraryWindow.focus();
  }
});
```

## Phase 7: 스타일링 및 폴리시 (1-2일)

### 7.1 CSS 커스텀 스타일

```css
/* src/components/library/library.css */
.library-app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.folder-item-hover {
  transition: all 0.15s ease-in-out;
}

.folder-item-hover:hover {
  background-color: rgba(59, 130, 246, 0.1);
  border-radius: 6px;
}

.memo-item-selected {
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%);
  border-left: 3px solid rgb(59, 130, 246);
}

.tree-canvas-container {
  background:
    radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.05) 0%, transparent 50%);
}

.resizable-handle {
  background-color: rgba(148, 163, 184, 0.3);
  transition: background-color 0.2s ease;
}

.resizable-handle:hover {
  background-color: rgba(59, 130, 246, 0.5);
}
```

### 7.2 다크 모드 지원

```javascript
// src/components/library/ThemeProvider.js
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (newTheme) => {
      root.classList.remove('light', 'dark');

      if (newTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(newTheme);
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

## 최종 구조 및 파일 트리

```
src/
├── components/
│   ├── library/
│   │   ├── LibraryApp.js
│   │   ├── Sidebar.js
│   │   ├── FolderTree.js
│   │   ├── TreeCanvas.js
│   │   ├── LibraryTreeVisualization.js
│   │   ├── CreateDialog.js
│   │   ├── ThemeProvider.js
│   │   └── library.css
│   ├── ui/ (shadcn/ui 컴포넌트들)
│   │   ├── button.jsx
│   │   ├── input.jsx
│   │   ├── scroll-area.jsx
│   │   ├── resizable.jsx
│   │   ├── context-menu.jsx
│   │   ├── dialog.jsx
│   │   ├── badge.jsx
│   │   ├── card.jsx
│   │   └── ...
│   ├── TreeNode.js (기존 재사용)
│   ├── NodeAssistantPanel.js (기존 재사용)
│   └── HierarchicalForceTree.js (기존)
├── data/
│   └── dummyData.js
├── lib/
│   └── utils.js
├── services/ (기존)
│   ├── QuestionService.js
│   ├── TreeAnimationService.js
│   └── ...
└── App.js (수정)
```

## 개발 순서 요약

1. **Phase 1**: shadcn/ui 설정 및 패키지 설치 (1-2일)
2. **Phase 2**: 더미 데이터 구조 및 App.js 모드 분기 (1일)
3. **Phase 3**: LibraryApp, Sidebar, FolderTree 기본 구조 (2일)
4. **Phase 4**: TreeCanvas, LibraryTreeVisualization 트리 표시 (2-3일)
5. **Phase 5**: CreateDialog, 상호작용 기능 (1일)
6. **Phase 6**: Electron main.js 이중 창 구조 (1일)
7. **Phase 7**: 스타일링, 다크모드, 폴리시 (1-2일)

**예상 개발 기간**: 8-12일 (약 2-2.5주)

## 성공 지표

### 기능적 지표
- [ ] 위젯과 라이브러리 앱이 동시에 실행
- [ ] `Cmd+1`로 위젯 토글 기능 동작
- [ ] 사이드바에서 폴더/메모 관리 기능
- [ ] 메모 선택 시 트리 시각화 표시
- [ ] 편집 모드에서 노드 클릭으로 질문 추가
- [ ] 더미 데이터 기반 완전한 프론트엔드 동작

### 사용자 경험 지표
- [ ] 직관적인 폴더 구조 탐색
- [ ] 빠른 메모 검색 및 접근
- [ ] 부드러운 애니메이션과 전환 효과
- [ ] 반응형 레이아웃 (사이드바 크기 조절)
- [ ] 다크/라이트 모드 지원

이 계획을 바탕으로 단계별 구현을 진행하면 완성도 높은 라이브러리 앱을 구축할 수 있습니다.