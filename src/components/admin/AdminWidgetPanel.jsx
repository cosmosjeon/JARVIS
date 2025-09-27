import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Folder, GripVertical } from 'lucide-react';
import { useSupabaseAuth } from 'hooks/useSupabaseAuth';
import { createTreeForUser, openWidgetForTree } from 'services/treeCreation';
import { fetchTreesWithNodes } from 'services/supabaseTrees';
import adminWidgetLogo from 'assets/admin-widget/logo.svg';

const AdminWidgetPanel = () => {
  const { user, loading } = useSupabaseAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [recentTrees, setRecentTrees] = useState([]);
  const [loadingTrees, setLoadingTrees] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      window.jarvisAPI?.closeAdminPanel?.();
    }
  }, [loading, user]);

  // 최신 트리들 로드
  useEffect(() => {
    const loadRecentTrees = async () => {
      if (!user) return;
      
      setLoadingTrees(true);
      try {
        const trees = await fetchTreesWithNodes(user.id);
        setRecentTrees(trees.slice(0, 2)); // 최신 2개만 표시
      } catch (err) {
        console.error('Failed to load recent trees:', err);
      } finally {
        setLoadingTrees(false);
      }
    };

    loadRecentTrees();
  }, [user]);

  const statusText = useMemo(() => {
    if (loading) {
      return '세션 정보를 불러오는 중...';
    }
    if (!user) {
      return '로그인이 필요합니다.';
    }
    if (creating) {
      return '새 위젯을 준비 중입니다...';
    }
    return null;
  }, [loading, user, creating]);

  const handleCreateWidget = useCallback(async () => {
    if (!user || creating) {
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const newTree = await createTreeForUser({ userId: user.id });
      await openWidgetForTree({ treeId: newTree.id, fresh: true });
      window.jarvisAPI?.requestLibraryRefresh?.();
    } catch (err) {
      setError(err);
    } finally {
      setCreating(false);
    }
  }, [user, creating]);

  const handleShowLibrary = useCallback(async () => {
    try {
      await window.jarvisAPI?.showLibrary?.();
    } catch (err) {
      setError(err);
      window.jarvisAPI?.log?.('warn', 'admin_panel_show_library_failed', { message: err?.message });
    }
  }, []);

  // Voran 로고 클릭 - React Hierarchical Force Tree로 이동
  const handleVoranClick = useCallback(async () => {
    try {
      // React Hierarchical Force Tree로 이동하는 로직
      // 현재는 라이브러리를 열어서 트리 뷰어로 이동
      await window.jarvisAPI?.showLibrary?.();
    } catch (err) {
      setError(err);
      window.jarvisAPI?.log?.('warn', 'admin_panel_voran_click_failed', { message: err?.message });
    }
  }, []);

  // 폴더 아이콘 클릭 - 해당 트리 열기
  const handleFolderClick = useCallback(async (tree) => {
    try {
      await openWidgetForTree({ treeId: tree.id, fresh: false });
    } catch (err) {
      setError(err);
      window.jarvisAPI?.log?.('warn', 'admin_panel_folder_click_failed', { message: err?.message });
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent">
        <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-5 py-3 text-xs text-slate-200 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          {statusText}
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-2" style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex h-12 items-center gap-2 rounded-full bg-slate-900/80 px-3 py-2 ring-1 ring-slate-800/50 backdrop-blur-xl">
          {/* Voran 로고 */}
          <button
            type="button"
            onClick={handleVoranClick}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/70"
            style={{ 
              WebkitAppRegion: 'no-drag',
              boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
            }}
          >
            <img src={adminWidgetLogo} alt="Voran" className="h-6 w-6" draggable={false} />
          </button>

          {/* NEW 버튼 */}
          <button
            type="button"
            onClick={handleCreateWidget}
            disabled={creating}
            className={`flex h-8 items-center justify-center rounded-full px-4 text-xs font-semibold tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              creating
                ? 'bg-sky-600/60 text-slate-200'
                : 'bg-[#1f8ab5] text-white hover:bg-[#2ba5d3] active:bg-[#1978a0]'
            }`}
            style={{ 
              WebkitAppRegion: 'no-drag',
              boxShadow: creating 
                ? '2px 2px 4px rgba(0, 0, 0, 0.2), -2px -2px 4px rgba(255, 255, 255, 0.05)'
                : '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
            }}
          >
            NEW
          </button>

          {/* 폴더 아이콘들 */}
          {recentTrees.map((tree, index) => (
            <button
              key={tree.id}
              type="button"
              onClick={() => handleFolderClick(tree)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d2f36] text-cyan-400 transition hover:bg-[#3a3d45] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              style={{ 
                WebkitAppRegion: 'no-drag',
                boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
              }}
              title={tree.title}
            >
              <Folder className="h-4 w-4" />
            </button>
          ))}

          {/* 빈 폴더 아이콘 (트리가 2개 미만일 때) */}
          {recentTrees.length < 2 && (
            <div 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d2f36] text-slate-500"
              style={{
                boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
              }}
            >
              <Folder className="h-4 w-4" />
            </div>
          )}

          {/* 드래그 핸들 */}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d2f36] text-slate-400 transition hover:bg-[#3a3d45] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/70"
            style={{ 
              WebkitAppRegion: 'drag',
              boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
            }}
            title="위젯 이동"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        {statusText && (
          <div className="text-xs font-medium text-slate-200/85">
            {statusText}
          </div>
        )}
        {error ? (
          <div className="text-xs text-rose-300/90">
            액션을 실행하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminWidgetPanel;
