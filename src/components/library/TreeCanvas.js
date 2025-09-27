import React, { useMemo } from "react";
import { Calendar, FileText } from "lucide-react";

import WidgetTreeViewer from "./WidgetTreeViewer";

const TreeCanvas = ({ selectedMemo, onNodeSelect, onNodeRemove }) => {
  const nodeCount = useMemo(() => selectedMemo?.treeData?.nodes?.length ?? 0, [selectedMemo]);

  const formatDate = (value) =>
    new Date(value).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

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
          <h1 className="text-lg font-semibold text-foreground">{selectedMemo.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> 생성 {formatDate(selectedMemo.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> 수정 {formatDate(selectedMemo.updatedAt)}
            </span>
            <span>{nodeCount}개 노드</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden bg-slate-900/40">
        {nodeCount > 0 ? (
          <WidgetTreeViewer
            key={selectedMemo.id}
            treeData={selectedMemo.treeData}
            onNodeSelect={onNodeSelect}
            onRemoveNode={onNodeRemove}
          />
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
