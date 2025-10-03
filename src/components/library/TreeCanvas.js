import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, FileText } from "lucide-react";

import ForceDirectedTree from "../tree2/ForceDirectedTree";
import WidgetTreeView from "../../features/treeCanvas/WidgetTreeView";

const LIGHTWEIGHT_THRESHOLD = 250;

const TreeCanvas = ({
  selectedMemo,
  onNodeSelect,
  onNodeRemove,
  onNodeUpdate,
  onNewNodeCreated,
  onMemoCreate,
  onMemoUpdate,
  onMemoRemove,
}) => {
  const nodeCount = useMemo(
    () => selectedMemo?.treeData?.nodes?.length ?? 0,
    [selectedMemo]
  );

  const containerRef = useRef(null);
  const userOverrideRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [useLightweightRenderer, setUseLightweightRenderer] = useState(false);
  const [autoLightweight, setAutoLightweight] = useState(false);

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
      setDimensions({
        width: el.clientWidth || 800,
        height: el.clientHeight || 600,
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
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

  if (!selectedMemo) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/10">
        <div className="space-y-3 text-center text-muted-foreground">
          <FileText className="mx-auto h-14 w-14" />
          <p className="text-sm">좌측 목록에서 트리를 선택하면 내용이 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border/40 bg-card/80">
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-foreground">
              {selectedMemo.title}
            </h1>
            {nodeCount > 0 && (
              <button
                type="button"
                onClick={handleRendererToggle}
                className="rounded border border-slate-600/60 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-400 hover:bg-slate-800/60"
              >
                {useLightweightRenderer ? "전체 기능 모드" : "간소화 모드"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> 생성 {formatDate(selectedMemo.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> 수정 {formatDate(selectedMemo.updatedAt)}
            </span>
            <span>{nodeCount}개 노드</span>
            {useLightweightRenderer && (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                {autoLightweight ? "자동 간소화" : "간소화 활성"}
              </span>
            )}
          </div>
          {useLightweightRenderer && (
            <p className="text-[11px] text-slate-300/80">
              노드 수가 많아 렌더링 지연을 줄이기 위해 캔버스를 단순화했습니다. 필요한 경우 상단 버튼으로 전체 기능 모드로 전환할 수 있습니다.
            </p>
          )}
        </div>
      </header>

      <div ref={containerRef} className="flex flex-1 overflow-hidden bg-slate-900/40">
        {nodeCount > 0 ? (
          useLightweightRenderer ? (
            <WidgetTreeView
              key={`light-${selectedMemo.id}`}
              treeData={selectedMemo.treeData}
              onNodeClick={onNodeSelect}
              className="h-full w-full"
            />
          ) : (
            <ForceDirectedTree
              key={selectedMemo.id}
              data={selectedMemo.treeData}
              dimensions={dimensions}
              onNodeClick={onNodeSelect}
              onNodeRemove={onNodeRemove}
              onNodeUpdate={onNodeUpdate}
              onMemoCreate={onMemoCreate}
              onMemoUpdate={onMemoUpdate}
              onMemoRemove={onMemoRemove}
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
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            아직 노드가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default TreeCanvas;