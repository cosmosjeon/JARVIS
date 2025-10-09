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

const DRAG_ZONE_HEIGHT = 56;

const renderWithDragHandle = (content) => (
  <div className="relative h-full w-full">
    <div
      className="absolute left-0 right-0 top-0"
      style={{
        height: DRAG_ZONE_HEIGHT,
        WebkitAppRegion: 'drag',
        zIndex: 10,
      }}
    />
    <div
      className="h-full w-full"
      style={{
        WebkitAppRegion: 'no-drag',
        paddingTop: `${DRAG_ZONE_HEIGHT}px`,
        position: 'relative',
        zIndex: 0,
      }}
    >
      {content}
    </div>
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
  libraryIntroTreeId,
  isLibraryIntroActive,
  onLibraryIntroComplete,
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
    return renderWithDragHandle(
      <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        불러오는 중입니다...
      </div>,
    );
  }

  if (!user) {
    return renderWithDragHandle(
      <EmptyState message="로그인 후 트리를 확인할 수 있습니다." />,
    );
  }

  if (error) {
    return renderWithDragHandle(
      <EmptyState message={error?.message || '트리를 불러오지 못했습니다.'} />,
    );
  }

  const treeNodeCount = selectedTree?.treeData?.nodes?.length ?? 0;
  const isIntroMode = Boolean(
    isLibraryIntroActive && selectedTree && libraryIntroTreeId === selectedTree.id,
  );
  const isTreeEmpty = Boolean(selectedTree && treeNodeCount === 0);
  const shouldShowIntroLayout = Boolean(selectedTree && (isIntroMode || isTreeEmpty));

  if (shouldShowIntroLayout) {
    const introSelectedNode = selectedNode ?? {
      id: selectedTree.id,
      keyword: selectedTree.title || '새 트리',
      question: '',
      level: 0,
    };
    return renderWithDragHandle(
      <div className="flex h-full flex-col bg-gradient-to-b from-background via-background to-muted/30">
        <LibraryQAPanel
          selectedNode={introSelectedNode}
          selectedTree={selectedTree}
          onNodeUpdate={onNodeUpdate}
          onNewNodeCreated={onNewNodeCreated}
          onNodeSelect={onNodeSelect}
          onClose={onQAPanelClose}
          isLibraryIntroActive={isIntroMode || isTreeEmpty}
          onLibraryIntroComplete={onLibraryIntroComplete}
        />
      </div>,
    );
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
        <ResizablePanel defaultSize={70} minSize={30} className="min-h-0 bg-background">
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
        <ResizablePanel defaultSize={30} minSize={20} maxSize={80} className="bg-card">
          <LibraryQAPanel
            selectedNode={selectedNode}
            selectedTree={selectedTree}
            onNodeUpdate={onNodeUpdate}
            onNewNodeCreated={onNewNodeCreated}
            onNodeSelect={onNodeSelect}
            onClose={onQAPanelClose}
            isLibraryIntroActive={false}
            onLibraryIntroComplete={onLibraryIntroComplete}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  if (selectedFolderId) {
    const folderName = folders.find((folder) => folder.id === selectedFolderId)?.name || '폴더';

    return renderWithDragHandle(
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
      </div>,
    );
  }

  return renderWithDragHandle(
    <EmptyState message="트리나 폴더를 선택해주세요." />,
  );
};

export default LibraryContent;
