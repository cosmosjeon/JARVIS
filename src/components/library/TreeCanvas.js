import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { Calendar, Edit3, FileText } from "lucide-react";

import LibraryTreeVisualization from "./LibraryTreeVisualization";
import LibraryConversationPanel from "./LibraryConversationPanel";

const TreeCanvas = ({ selectedMemo, onMemoUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeNode, setActiveNode] = useState(null);

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
        <div className="space-y-4 text-center">
          <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-medium text-muted-foreground">메모를 선택해주세요</h3>
            <p className="text-sm text-muted-foreground">
              사이드바에서 메모를 클릭하면 지식 트리를 볼 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    setIsEditMode(false);
    setActiveNode(null);
  }, [selectedMemo?.id]);

  const handleNodeSelect = useCallback((node) => {
    if (!node) {
      setActiveNode(null);
      return;
    }

    const cloned = {
      ...node,
      conversation: Array.isArray(node.conversation)
        ? node.conversation.map((message) => ({ ...message }))
        : [],
    };
    setActiveNode(cloned);
  }, []);

  const handleTreeUpdate = useCallback((updatedTreeData) => {
    if (typeof onMemoUpdate === "function" && selectedMemo) {
      onMemoUpdate({
        ...selectedMemo,
        treeData: updatedTreeData,
        updatedAt: Date.now(),
      });
    }

    if (activeNode) {
      const nextNode = updatedTreeData.nodes.find((node) => node.id === activeNode.id);
      if (nextNode) {
        setActiveNode({
          ...nextNode,
          conversation: Array.isArray(nextNode.conversation)
            ? nextNode.conversation.map((message) => ({ ...message }))
            : [],
        });
      } else {
        setActiveNode(null);
      }
    }
  }, [activeNode, onMemoUpdate, selectedMemo]);

  return (
    <div className="flex h-full flex-col bg-background">
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
              <Badge variant="outline">{nodeCount}개 노드</Badge>
              <Button
                variant={isEditMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditMode((prev) => !prev)}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                {isEditMode ? "보기 모드" : "편집 모드"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 border-r border-muted/40 bg-muted/5">
          {nodeCount > 0 ? (
            <LibraryTreeVisualization
              key={selectedMemo.id}
              treeData={selectedMemo.treeData}
              isEditMode={isEditMode}
              onTreeUpdate={handleTreeUpdate}
              onNodeSelect={handleNodeSelect}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Card className="w-96">
                <CardHeader>
                  <CardTitle className="text-center">빈 메모</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                  <p className="text-muted-foreground">이 메모는 아직 내용이 없습니다.</p>
                  <Button onClick={() => setIsEditMode(true)}>편집 시작하기</Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        <div className="hidden w-[360px] border-l border-muted/40 bg-card/60 lg:block">
          <LibraryConversationPanel node={activeNode} />
        </div>
      </div>
      <div className="border-t border-muted/40 bg-card/60 lg:hidden">
        <LibraryConversationPanel node={activeNode} />
      </div>
    </div>
  );
};

export default TreeCanvas;
