import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from 'shared/ui/card';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from 'shared/ui/resizable';
import TreeCanvas from './components/TreeCanvas';
import LibraryQAPanel from './components/LibraryQAPanel';

const EmptyState = ({ message }) => (
  <div className="flex h-full items-center justify-center px-6 text-sm text-foreground/70">
    {message}
  </div>
);

const LibraryContent = ({
  loading,
  user,
  error,
  selectedTree,
  selectedFolderId,
  folders,
  selectedNode,
  isQAPanelVisible,
  onNodeSelect,
  onNodeRemove,
  onNodeUpdate,
  onNewNodeCreated,
  onMemoCreate,
  onMemoUpdate,
  onMemoRemove,
  onTreeRename,
  onQAPanelClose,
}) => {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        불러오는 중입니다...
      </div>
    );
  }

  if (!user) {
    return <EmptyState message="로그인 후 트리를 확인할 수 있습니다." />;
  }

  if (error) {
    return <EmptyState message={error?.message || '트리를 불러오지 못했습니다.'} />;
  }

  if (selectedTree) {
    // isQAPanelVisible이 명시적으로 false일 때만 패널을 숨김 (undefined는 true로 처리)
    if (isQAPanelVisible === false) {
      return (
        <TreeCanvas
          selectedMemo={selectedTree}
          onNodeSelect={onNodeSelect}
          onNodeRemove={onNodeRemove}
          onNodeUpdate={onNodeUpdate}
          onNewNodeCreated={onNewNodeCreated}
          onMemoCreate={onMemoCreate}
          onMemoUpdate={onMemoUpdate}
          onMemoRemove={onMemoRemove}
          onTreeRename={onTreeRename}
        />
      );
    }

    return (
      <ResizablePanelGroup direction="horizontal" className="h-full overflow-hidden">
        <ResizablePanel defaultSize={70} minSize={30} className="min-h-0 bg-background overflow-hidden">
          <TreeCanvas
            selectedMemo={selectedTree}
            onNodeSelect={onNodeSelect}
            onNodeRemove={onNodeRemove}
            onNodeUpdate={onNodeUpdate}
            onNewNodeCreated={onNewNodeCreated}
            onMemoCreate={onMemoCreate}
            onMemoUpdate={onMemoUpdate}
            onMemoRemove={onMemoRemove}
            onTreeRename={onTreeRename}
          />
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-border/80 hover:bg-border" />
        <ResizablePanel defaultSize={30} minSize={20} maxSize={80} className="bg-card overflow-hidden">
          <LibraryQAPanel
            selectedNode={selectedNode}
            selectedTree={selectedTree}
            onNodeUpdate={onNodeUpdate}
            onNewNodeCreated={onNewNodeCreated}
            onNodeSelect={onNodeSelect}
            onClose={onQAPanelClose}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  if (selectedFolderId) {
    const folderName = folders.find((folder) => folder.id === selectedFolderId)?.name || '폴더';

    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-sm bg-card text-card-foreground">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg font-semibold">{folderName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>이 폴더에 트리를 추가하거나 트리를 선택해주세요.</p>
            <p className="text-xs text-muted-foreground/80">
              BOX에서 트리를 이 폴더로 이동할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <EmptyState message="트리나 폴더를 선택해주세요." />;
};

export default LibraryContent;
