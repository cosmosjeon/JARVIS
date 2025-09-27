import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, FolderTree as FolderIcon } from "lucide-react";

import { Button } from "components/ui/button";

import TreeCanvas from "./TreeCanvas";
import { useSupabaseAuth } from "hooks/useSupabaseAuth";
import { fetchTreesWithNodes, deleteTree } from "services/supabaseTrees";
import { createTreeForUser, openWidgetForTree } from "services/treeCreation";

const EmptyState = ({ message }) => (
  <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
    {message}
  </div>
);

const LibraryApp = () => {
  const { user, signOut } = useSupabaseAuth();
  const [trees, setTrees] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === selectedId) ?? null,
    [trees, selectedId]
  );

  const refreshLibrary = useCallback(async () => {
    if (!user) {
      setTrees([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fetchedTrees = await fetchTreesWithNodes(user.id);
      const mapped = fetchedTrees.map((tree) => ({
        id: tree.id,
        title: tree.title || "제목 없는 트리",
        treeData: tree.treeData,
        createdAt: tree.createdAt,
        updatedAt: tree.updatedAt,
      }));

      setTrees(mapped);
      setSelectedId((previousId) => {
        if (!mapped.length) return null;
        const exists = previousId && mapped.some((item) => item.id === previousId);
        return exists ? previousId : null;
      });
    } catch (err) {
      setError(err);
      setTrees([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.jarvisAPI?.onLibraryRefresh !== "function") {
      return () => {};
    }

    const unsubscribe = window.jarvisAPI.onLibraryRefresh(() => {
      refreshLibrary();
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [refreshLibrary]);

  const handleTreeOpen = useCallback(async (treeId) => {
    if (!treeId) {
      return;
    }

    try {
      await openWidgetForTree({ treeId, fresh: false });
    } catch (err) {
      setError(err);
      if (typeof window !== "undefined") {
        window.jarvisAPI?.log?.("error", "library_open_tree_failed", {
          treeId,
          message: err?.message,
        });
      }
    }
  }, [setError]);

  const handleTreeDelete = useCallback(async (treeId) => {
    if (!user || !treeId) {
      return;
    }

    let confirmed = true;
    if (typeof window !== "undefined" && window.confirm) {
      confirmed = window.confirm("선택한 지식 트리를 삭제할까요? 삭제하면 되돌릴 수 없습니다.");
    }
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteTree(treeId);
      await refreshLibrary();
      setSelectedId((prev) => (prev === treeId ? null : prev));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, refreshLibrary]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-64 flex-col border-r border-slate-900/60 bg-slate-950/80">
        <div className="border-b border-slate-900/60 px-4 py-4">
          <h1 className="text-base font-semibold">저장된 트리</h1>
          <p className="mt-1 text-xs text-slate-400">라이브러리에서 열 트리를 선택하세요.</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <EmptyState message="트리를 불러오는 중입니다." />
          ) : trees.length === 0 ? (
            <EmptyState message="아직 저장된 트리가 없습니다." />
          ) : (
            <nav className="flex flex-col gap-1 px-2 py-3">
              {trees.map((tree) => {
                const isActive = tree.id === selectedId;
                return (
                  <button
                    key={tree.id}
                    type="button"
                    onClick={() => setSelectedId(tree.id)}
                    onDoubleClick={() => { void handleTreeOpen(tree.id); }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      handleTreeDelete(tree.id);
                    }}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "bg-slate-800 text-slate-50"
                        : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                    }`}
                  >
                    <FolderIcon className="h-4 w-4" />
                    <span className="flex-1 truncate">{tree.title}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-900/60 bg-slate-950/60 px-6 py-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-100">라이브러리 뷰어</span>
            {user ? (
              <span className="text-xs text-slate-400">{user.email || user.user_metadata?.full_name || "로그인 계정"}</span>
            ) : (
              <span className="text-xs text-slate-500">로그인 필요</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshLibrary}
              disabled={loading}
            >
              {loading ? "새로고침 중" : "새로고침"}
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!user || loading}
              onClick={async () => {
                if (!user || typeof window === "undefined") {
                  return;
                }

                try {
                  const newTree = await createTreeForUser({ userId: user.id });

                  setTrees((previous) => {
                    const merged = new Map(previous.map((entry) => [entry.id, entry]));
                    merged.set(newTree.id, newTree);
                    const nextList = Array.from(merged.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    return nextList;
                  });

                  setSelectedId(newTree.id);

                  await openWidgetForTree({ treeId: newTree.id, fresh: true });
                  window.jarvisAPI?.requestLibraryRefresh?.();
                } catch (err) {
                  setError(err);
                }
              }}
            >
              새 트리 만들기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (typeof signOut === "function") {
                  signOut();
                }
              }}
            >
              로그아웃
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-300">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            불러오는 중입니다...
          </div>
        ) : !user ? (
          <EmptyState message="로그인 후 트리를 확인할 수 있습니다." />
        ) : error ? (
          <EmptyState message={error?.message || "트리를 불러오지 못했습니다."} />
        ) : (
          <TreeCanvas selectedMemo={selectedTree} />
        )}
      </main>
    </div>
  );
};

export default LibraryApp;
