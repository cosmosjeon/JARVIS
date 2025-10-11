import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, FileText } from 'lucide-react';

import ForceDirectedTree from 'features/tree/ui/tree2/ForceDirectedTree';
import TidyTreeView from 'features/tree/ui/tree1/TidyTreeView';
import TreeWorkspaceToolbar from 'features/tree/ui/components/TreeWorkspaceToolbar';
import WidgetTreeView from 'features/treeCanvas/WidgetTreeView';
import EditableTitle from 'shared/ui/EditableTitle';
import { useTheme } from 'shared/components/library/ThemeProvider';
import { resolveTreeBackground } from 'features/tree/constants/themeBackgrounds';

const LIGHTWEIGHT_THRESHOLD = 250;

const TreeCanvas = ({
  selectedMemo,
  onNodeSelect,
  onNodeRemove,
  onNodeUpdate,
  onNewNodeCreated,
  onTreeRename,
}) => {
  const { theme } = useTheme();
  const treeBackground = useMemo(() => resolveTreeBackground(theme), [theme]);
  const headerStyle = useMemo(
    () => ({ WebkitAppRegion: 'drag' }),
    [],
  );
  const headerInteractiveStyle = useMemo(
    () => ({ WebkitAppRegion: 'no-drag' }),
    [],
  );

  const nodeCount = useMemo(
    () => selectedMemo?.treeData?.nodes?.length ?? 0,
    [selectedMemo]
  );

  const containerRef = useRef(null);
  const userOverrideRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [useLightweightRenderer, setUseLightweightRenderer] = useState(false);
  const [autoLightweight, setAutoLightweight] = useState(false);
  const [viewMode, setViewMode] = useState('tree2'); // 'tree1' | 'tree2'

  useEffect(() => {
    if (userOverrideRef.current) {
      return;
    }
    const shouldUseLightweight = nodeCount >= LIGHTWEIGHT_THRESHOLD;
    setUseLightweightRenderer(shouldUseLightweight);
    setAutoLightweight(shouldUseLightweight);
  }, [nodeCount]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setDimensions({
        width: rect.width || 800,
        height: rect.height || 600,
      });
    };
    updateSize();
    const ro = new ResizeObserver(() => {
      // 약간의 지연을 두어 ResizablePanel 크기 변화가 완전히 적용된 후 감지
      setTimeout(updateSize, 10);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const formatDate = (value) =>
    new Date(value).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleRendererToggle = () => {
    userOverrideRef.current = true;
    setUseLightweightRenderer((prev) => !prev);
    setAutoLightweight(false);
  };

  const nodesById = useMemo(() => {
    const nodes = selectedMemo?.treeData?.nodes ?? [];
    return nodes.reduce((acc, node) => {
      if (node?.id) {
        acc.set(node.id, node);
      }
      return acc;
    }, new Map());
  }, [selectedMemo?.treeData?.nodes]);

  const resolveNodeCandidate = useCallback((candidate) => {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === 'string') {
      return nodesById.get(candidate) ?? null;
    }
    if (candidate?.id && nodesById.has(candidate.id)) {
      return nodesById.get(candidate.id);
    }
    if (candidate?.node) {
      const inner = candidate.node;
      if (inner?.id && nodesById.has(inner.id)) {
        return nodesById.get(inner.id);
      }
      return inner;
    }
    if (candidate?.raw) {
      const raw = candidate.raw;
      if (raw?.id && nodesById.has(raw.id)) {
        return nodesById.get(raw.id);
      }
      return raw;
    }
    if (candidate?.id) {
      return nodesById.get(candidate.id) ?? candidate;
    }
    return candidate;
  }, [nodesById]);

  const handleNodeSelect = useCallback((payload) => {
    if (!onNodeSelect) {
      return;
    }
    const resolved = resolveNodeCandidate(payload);
    onNodeSelect(resolved ?? null);
  }, [onNodeSelect, resolveNodeCandidate]);

  if (!selectedMemo) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/10">
        <div className="space-y-3 text-center text-muted-foreground">
          <FileText className="mx-auto h-14 w-14" />
          <p className="text-sm">메모를 선택하면 트리가 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: treeBackground }}>
      <header className="tree-canvas-header relative z-10 mt-4 mx-4 mb-0" style={headerStyle}>
        <div className="rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur-sm">
          <div className="flex flex-col gap-2 px-4 py-6">
            <div className="flex items-center justify-between gap-3 relative">
              <div className="flex-1 min-w-0 no-drag" style={headerInteractiveStyle}>
                <EditableTitle
                  title={selectedMemo.title}
                  onUpdate={(newTitle) => {
                    if (onTreeRename && selectedMemo.id) {
                      onTreeRename(selectedMemo.id, newTitle);
                    }
                  }}
                />
              </div>
              <div className="shrink-0 no-drag" style={headerInteractiveStyle}>
                <TreeWorkspaceToolbar
                  viewMode={viewMode}
                  onChange={(mode) => setViewMode(mode)}
                  variant="library"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> 생성 {formatDate(selectedMemo.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> 수정 {formatDate(selectedMemo.updatedAt)}
              </span>
              <span>{nodeCount}개 노드</span>
            </div>
            {/* 경량화 배지/설명 숨김 */}
          </div>
        </div>
      </header>

      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {nodeCount > 0 ? (
          <div className="relative z-0 h-full w-full overflow-hidden">
            {viewMode === 'tree1'
              ? (
                  <TidyTreeView
                    key={`tidy-${selectedMemo.id}`}
                    data={selectedMemo.treeData}
                    dimensions={dimensions}
                    theme={theme}
                    background={treeBackground}
                    onNodeClick={handleNodeSelect}
                    selectedNodeId={null}
                    activeTreeId={selectedMemo.id}
                    onBackgroundClick={() => {}}
                    onReorderSiblings={() => {}}
                  />
              )
              : useLightweightRenderer
                ? (
                  <WidgetTreeView
                    key={`light-${selectedMemo.id}`}
                    treeData={selectedMemo.treeData}
                    onNodeClick={handleNodeSelect}
                    className="h-full w-full"
                  />
                )
                : (
                  <ForceDirectedTree
                    key={selectedMemo.id}
                    data={selectedMemo.treeData}
                    dimensions={dimensions}
                    theme={theme}
                    background={treeBackground}
                    onNodeClick={handleNodeSelect}
                    onNodeRemove={onNodeRemove}
                    onNodeUpdate={onNodeUpdate}
                    onNodeCreate={(newNode) => onNewNodeCreated?.(newNode, null)}
                    onLinkCreate={(newLink) => onNewNodeCreated?.(null, newLink)}
                    onRootCreate={({ position }) => {
                      const id = `node_${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2, 9)}`;
                      const newRootNode = {
                        id,
                        keyword: "New Root",
                        x: position?.x ?? dimensions.width / 2,
                        y: position?.y ?? dimensions.height / 2,
                        level: 0,
                      };
                      onNewNodeCreated?.(newRootNode, null);
                      return id;
                    }}
                    treeId={selectedMemo.id}
                    userId={selectedMemo.userId}
                    hideAssistantPanel
                  />
                )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            표시할 노드가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default TreeCanvas;
