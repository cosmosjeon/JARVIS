import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth } from 'hooks/useSupabaseAuth';
import { createTreeForUser, openWidgetForTree } from 'services/treeCreation';
import adminWidgetLogo from 'assets/admin-widget/logo.svg';

const AdminWidgetPanel = () => {
  const { user, loading } = useSupabaseAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && !user) {
      window.jarvisAPI?.closeAdminPanel?.();
    }
  }, [loading, user]);

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
        <div className="flex h-16 min-w-[320px] max-w-[420px] items-center justify-between rounded-full bg-gradient-to-br from-[#111827] via-[#1f2937] to-[#0f172a] px-2 py-2 shadow-2xl ring-1 ring-slate-800/70 backdrop-blur-md">
          <button
            type="button"
            onClick={handleCreateWidget}
            disabled={creating}
            className={`flex h-full flex-1 items-center justify-center rounded-full px-8 text-base font-semibold tracking-[0.18em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              creating
                ? 'bg-sky-600/60 text-slate-200'
                : 'bg-[#1f8ab5] text-white hover:bg-[#2ba5d3] active:bg-[#1978a0]'
            }`}
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            NEW WIDGET
          </button>

          <button
            type="button"
            onClick={handleShowLibrary}
            className="group ml-3 flex h-full min-w-[120px] flex-none items-center justify-center gap-2 rounded-full bg-[#2d2f36] px-4 text-left text-xs font-semibold tracking-[0.35em] text-slate-200 transition hover:bg-[#3a3d45] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/70"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-900 shadow-inner">
              <img src={adminWidgetLogo} alt="Voran" className="h-6 w-6" draggable={false} />
            </span>
            <span className="uppercase opacity-80 group-hover:opacity-100">Voran</span>
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
