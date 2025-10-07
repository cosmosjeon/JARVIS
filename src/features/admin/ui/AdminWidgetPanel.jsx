import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import {
  loadRecentTrees as fetchRecentTrees,
  createAndOpenTree,
  showLibraryWindow,
  closePanel,
  logWarning,
} from 'features/admin/services/adminWidgetService';
import { useAdminWidgetState } from 'features/admin/state/useAdminWidgetState';
import AdminWidgetControlBar from 'shared/components/admin/AdminWidgetControlBar';
import adminWidgetLogo from 'assets/admin-widget/logo.svg';
import { createCaptureBridge } from 'infrastructure/electron/bridges';

const AdminWidgetPanel = () => {
  const { user, loading } = useSupabaseAuth();
  const {
    state: { creating, error },
    actions: {
      beginCreate,
      endCreate,
      setError,
      clearError,
      setRecentTrees,
      setLoadingTrees,
    },
  } = useAdminWidgetState();

  const captureBridge = useMemo(() => createCaptureBridge(), []);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      closePanel();
    }
  }, [loading, user]);

  // 최신 트리들 로드
  useEffect(() => {
    if (!user) {
      setRecentTrees([]);
      return;
    }

    let cancelled = false;

    const loadTrees = async () => {
      setLoadingTrees(true);
      try {
        const trees = await fetchRecentTrees({ userId: user.id, limit: 2 });
        if (!cancelled) {
          setRecentTrees(Array.isArray(trees) ? trees : []);
        }
      } catch (err) {
        if (!cancelled) {
          logWarning('admin_panel_recent_tree_load_failed', { message: err?.message });
        }
      } finally {
        if (!cancelled) {
          setLoadingTrees(false);
        }
      }
    };

    loadTrees();

    return () => {
      cancelled = true;
    };
  }, [user, setRecentTrees, setLoadingTrees]);

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

    beginCreate();
    try {
      await createAndOpenTree({ userId: user.id });
    } catch (err) {
      setError(err);
    } finally {
      endCreate();
    }
  }, [user, creating, beginCreate, endCreate, setError]);

  const handleCapture = useCallback(async () => {
    try {
      clearError();
      setCapturing(true);
      const response = await captureBridge.requestCapture();
      if (response?.success === false && response?.reason !== 'busy') {
        setCapturing(false);
        logWarning('admin_panel_capture_request_failed', { reason: response.reason });
      }
    } catch (error) {
      setCapturing(false);
      setError(error);
      logWarning('admin_panel_capture_request_failed', { message: error?.message });
    }
  }, [captureBridge, clearError, setError]);

  const handleShowLibrary = useCallback(async () => {
    try {
      clearError();
      await showLibraryWindow();
    } catch (err) {
      setError(err);
      logWarning('admin_panel_show_library_failed', { message: err?.message });
    }
  }, [clearError, setError]);

  // Voran 로고 클릭 - React Hierarchical Force Tree로 이동
  const handleVoranClick = useCallback(async () => {
    try {
      clearError();
      // React Hierarchical Force Tree로 이동하는 로직
      // 현재는 라이브러리를 열어서 트리 뷰어로 이동
      await showLibraryWindow();
    } catch (err) {
      setError(err);
      logWarning('admin_panel_voran_click_failed', { message: err?.message });
    }
  }, [clearError, setError]);

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

  useEffect(() => {
    const unsubscribes = [
      captureBridge.onCaptureCompleted(() => {
        setCapturing(false);
      }),
      captureBridge.onCaptureCancelled(() => {
        setCapturing(false);
      }),
      captureBridge.onCaptureFailed(() => {
        setCapturing(false);
      }),
    ];
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [captureBridge]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-2" style={{ WebkitAppRegion: 'drag' }}>
        <AdminWidgetControlBar
          logoSrc={adminWidgetLogo}
          onLogoClick={handleVoranClick}
          onCreateClick={handleCreateWidget}
          creating={creating}
          onCaptureClick={handleCapture}
          capturing={capturing}
        />
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
