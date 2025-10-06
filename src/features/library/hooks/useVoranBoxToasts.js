import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from 'lucide-react';

const useVoranBoxToasts = () => {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef(new Map());

  const toastVisuals = useMemo(() => ({
    success: {
      container: 'bg-emerald-500/10 border border-emerald-400/40 text-emerald-100',
      iconClass: 'text-emerald-300',
      Icon: CheckCircle2,
    },
    info: {
      container: 'bg-blue-500/10 border border-blue-400/40 text-blue-100',
      iconClass: 'text-blue-300',
      Icon: Info,
    },
    warning: {
      container: 'bg-amber-500/10 border border-amber-400/40 text-amber-100',
      iconClass: 'text-amber-300',
      Icon: AlertTriangle,
    },
    error: {
      container: 'bg-red-500/10 border border-red-400/40 text-red-100',
      iconClass: 'text-red-300',
      Icon: XCircle,
    },
    default: {
      container: 'bg-muted/70 border border-border/40 text-card-foreground',
      iconClass: 'text-card-foreground',
      Icon: Info,
    },
  }), []);

  const removeToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({
    type = 'default',
    message,
    duration = 2000,
    actionLabel,
    onAction,
  } = {}) => {
    if (!message) {
      return null;
    }
    const nextId = toastIdRef.current + 1;
    toastIdRef.current = nextId;
    const toast = {
      id: nextId,
      type,
      message,
      actionLabel,
      onAction,
    };
    setToasts((prev) => [...prev, toast]);
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(nextId), duration);
      toastTimersRef.current.set(nextId, timer);
    }
    return nextId;
  }, [removeToast]);

  const handleToastAction = useCallback(async (toast) => {
    if (!toast) {
      return;
    }
    removeToast(toast.id);
    if (toast.onAction) {
      try {
        await toast.onAction();
        showToast({ type: 'info', message: '이동을 되돌렸습니다.', duration: 2000 });
      } catch (error) {
        console.error('Undo action failed', error);
        showToast({ type: 'error', message: error?.message || '되돌리기에 실패했습니다.', duration: 3000 });
      }
    }
  }, [removeToast, showToast]);

  useEffect(() => () => {
    toastTimersRef.current.forEach((timer) => clearTimeout(timer));
    toastTimersRef.current.clear();
  }, []);

  return {
    toasts,
    toastVisuals,
    showToast,
    removeToast,
    handleToastAction,
  };
};

export default useVoranBoxToasts;
