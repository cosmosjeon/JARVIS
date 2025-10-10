import { useCallback, useEffect, useRef, useState } from 'react';

const hasFileData = (dataTransfer) => {
  if (!dataTransfer) {
    return false;
  }

  if (dataTransfer.types && Array.from(dataTransfer.types).includes('Files')) {
    return true;
  }

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) => item && item.kind === 'file');
  }

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return true;
  }

  return false;
};

const extractFiles = (dataTransfer) => {
  if (!dataTransfer || !dataTransfer.files) {
    return [];
  }
  return Array.from(dataTransfer.files);
};

export const useFileDropZone = ({
  onDropFiles,
  isDisabled = false,
  shouldAccept = null,
} = {}) => {
  const dragCounterRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const canHandleEvent = useCallback((event) => {
    if (isDisabled) {
      return false;
    }

    const dataTransfer = event?.dataTransfer;
    if (!hasFileData(dataTransfer)) {
      return false;
    }

    if (typeof shouldAccept === 'function') {
      const files = extractFiles(dataTransfer);
      return shouldAccept(files);
    }

    return true;
  }, [isDisabled, shouldAccept]);

  const resetDragState = useCallback(() => {
    dragCounterRef.current = 0;
    setIsDragOver(false);
  }, []);

  const handleDragEnter = useCallback((event) => {
    if (!canHandleEvent(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  }, [canHandleEvent]);

  const handleDragOver = useCallback((event) => {
    if (!canHandleEvent(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }, [canHandleEvent]);

  const handleDragLeave = useCallback((event) => {
    if (!hasFileData(event?.dataTransfer)) {
      resetDragState();
      return;
    }

    if (!canHandleEvent(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, [canHandleEvent, resetDragState]);

  const handleDrop = useCallback(async (event) => {
    if (!canHandleEvent(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const files = event?.dataTransfer?.files;
    resetDragState();

    if (typeof onDropFiles === 'function' && files && files.length > 0) {
      onDropFiles(files);
    }
  }, [canHandleEvent, onDropFiles, resetDragState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleWindowDragEnd = () => resetDragState();

    window.addEventListener('dragend', handleWindowDragEnd);
    window.addEventListener('drop', handleWindowDragEnd);

    return () => {
      window.removeEventListener('dragend', handleWindowDragEnd);
      window.removeEventListener('drop', handleWindowDragEnd);
    };
  }, [resetDragState]);

  useEffect(() => {
    if (isDisabled) {
      resetDragState();
    }
  }, [isDisabled, resetDragState]);

  return {
    isDragOver,
    eventHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
};

export default useFileDropZone;
