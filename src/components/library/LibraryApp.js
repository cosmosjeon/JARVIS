import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "components/ui/resizable";

import Sidebar from "./Sidebar";
import TreeCanvas from "./TreeCanvas";
import { Button } from "components/ui/button";
import { useSupabaseAuth } from "hooks/useSupabaseAuth";
import { fetchTreesWithNodes, upsertTreeMetadata, upsertTreeNodes } from "services/supabaseTrees";
import { Card, CardContent } from "components/ui/card";

const LibraryApp = () => {
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [libraryData, setLibraryData] = useState({ folders: [], memos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncingTreeId, setSyncingTreeId] = useState(null);
  const { user, signOut } = useSupabaseAuth();

  const handleMemoSelect = (memo) => {
    setSelectedMemo(memo);
  };

  const baseFolders = useMemo(() => [
    {
      id: "folder_root",
      name: "모든 트리",
      parentId: null,
      createdAt: Date.now(),
      expanded: true,
    },
  ], []);

  const refreshLibrary = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const trees = await fetchTreesWithNodes(user.id);
      const mappedMemos = trees.map((tree) => ({
        id: tree.id,
        title: tree.title || "제목 없는 트리",
        folderId: "folder_root",
        treeData: tree.treeData,
        createdAt: tree.createdAt,
        updatedAt: tree.updatedAt,
      }));

      setLibraryData({
        folders: baseFolders,
        memos: mappedMemos,
      });

      if (mappedMemos.length === 0) {
        setSelectedMemo(null);
      } else if (!mappedMemos.some((memo) => memo.id === selectedMemo?.id)) {
        setSelectedMemo(mappedMemos[0]);
      } else {
        const current = mappedMemos.find((memo) => memo.id === selectedMemo?.id);
        setSelectedMemo(current ?? mappedMemos[0]);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, baseFolders, selectedMemo?.id]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleFocus = () => {
      refreshLibrary();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshLibrary]);

  const persistMemo = useCallback(async (memo) => {
    if (!user) return;
    setSyncingTreeId(memo.id);
    try {
      await upsertTreeMetadata({
        treeId: memo.id,
        title: memo.title,
        userId: user.id,
      });

      const parentByChild = memo.treeData.links.reduce((acc, link) => {
        acc.set(link.target, link.source);
        return acc;
      }, new Map());

      const normalizedNodes = memo.treeData.nodes.map((node) => ({
        ...node,
        parentId: parentByChild.get(node.id) || null,
        createdAt: node.createdAt || memo.createdAt || Date.now(),
      }));

      await upsertTreeNodes({
        treeId: memo.id,
        nodes: normalizedNodes,
        userId: user.id,
      });

      await refreshLibrary();
    } catch (err) {
      setError(err);
      setLoading(false);
    } finally {
      setSyncingTreeId(null);
    }
  }, [refreshLibrary, user]);

  const handleOpenWidget = useCallback(async () => {
    if (typeof window === "undefined" || !user) return;

    const resolveClientId = () => {
      try {
        if (typeof window.crypto?.randomUUID === "function") {
          return `tree_${window.crypto.randomUUID()}`;
        }
      } catch (error) {
        // ignore and fallback
      }
      return `tree_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    };

    let targetTreeId = selectedMemo?.id ?? null;
    const creatingNewTree = !targetTreeId;

    if (creatingNewTree) {
      const newTreeId = resolveClientId();
      try {
        const record = await upsertTreeMetadata({
          treeId: newTreeId,
          title: "새 지식 트리",
          userId: user.id,
        });
        targetTreeId = record?.id || newTreeId;
      } catch (err) {
        setError(err);
        return;
      }
      await refreshLibrary();
    }

    const payload = {
      treeId: targetTreeId,
      reusePrimary: false,
      fresh: creatingNewTree,
    };

    try {
      if (window.jarvisAPI?.openWidget) {
        await window.jarvisAPI.openWidget(payload);
        return;
      }

      if (window.jarvisAPI?.toggleWindow) {
        window.jarvisAPI.toggleWindow();
        return;
      }

      const url = new URL(window.location.href);
      url.searchParams.set("mode", "widget");
      if (payload.treeId) {
        url.searchParams.set("treeId", payload.treeId);
      }
      window.open(url.toString(), "_blank");
    } catch (err) {
      const fallbackUrl = new URL(window.location.href);
      if (payload.treeId) {
        fallbackUrl.searchParams.set("treeId", payload.treeId);
      }
      window.open(fallbackUrl.toString(), "_blank");
    }
  }, [refreshLibrary, selectedMemo?.id, upsertTreeMetadata, user]);

  return (
    <div className="h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">JARVIS 라이브러리</h1>
          <p className="text-sm text-slate-400">위젯에서 만든 모든 트리를 여기에서 볼 수 있어요.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refreshLibrary} disabled={loading}>
            {loading ? "새로고침 중" : "새로고침"}
          </Button>
          {user ? (
            <span className="text-sm text-slate-300 max-w-48 truncate" title={user.email || user.user_metadata?.full_name}>
              {user.email || user.user_metadata?.full_name || "로그인 계정"}
            </span>
          ) : null}
          <Button variant="secondary" onClick={handleOpenWidget}>
            위젯 열기
          </Button>
          <Button variant="ghost" onClick={signOut}>
            로그아웃
          </Button>
        </div>
      </header>
      <ResizablePanelGroup direction="horizontal" className="h-[calc(100%-88px)]">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="border-r border-slate-900">
          <Sidebar
            data={libraryData}
            selectedMemo={selectedMemo}
            onMemoSelect={handleMemoSelect}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={75}>
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Card className="w-80 bg-slate-900 border-slate-800">
                <CardContent className="py-8 text-center space-y-2 text-slate-200">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                  <p className="text-sm">트리를 불러오는 중입니다...</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <TreeCanvas
              selectedMemo={selectedMemo ? {
                ...selectedMemo,
                syncing: selectedMemo.id === syncingTreeId,
              } : null}
              onMemoUpdate={(updatedMemo) => {
                setLibraryData((prev) => ({
                  ...prev,
                  memos: prev.memos.map((memo) =>
                    memo.id === updatedMemo.id ? updatedMemo : memo
                  ),
                }));
                setSelectedMemo(updatedMemo);
                persistMemo(updatedMemo);
              }}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
      {error ? (
        <div className="absolute bottom-4 right-4 max-w-md rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100 shadow-lg">
          <p className="font-medium">동기화 중 오류가 발생했습니다.</p>
          <p className="text-xs opacity-80">{error.message || '자세한 내용은 콘솔을 확인하세요.'}</p>
        </div>
      ) : null}
    </div>
  );
};

export default LibraryApp;
