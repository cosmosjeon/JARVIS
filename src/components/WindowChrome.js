import React, { useEffect, useState } from 'react';
import { createWindowControlsBridge } from '../infrastructure/electron/bridges';

const DEFAULT_WINDOW_STATE = {
  maximized: false,
  fullscreen: false,
};

const WindowChrome = () => {
  const [windowState, setWindowState] = useState(DEFAULT_WINDOW_STATE);

  useEffect(() => {
    const bridge = createWindowControlsBridge();
    const detachListener = bridge.onStateChange((payload = {}) => {
      setWindowState((prev) => ({
        ...prev,
        ...payload,
      }));
    });

    const stateResult = bridge.getState?.();
    if (stateResult && typeof stateResult.then === 'function') {
      stateResult
        .then((response) => {
          if (response?.success && response.state) {
            setWindowState((prev) => ({
              ...prev,
              ...response.state,
            }));
          }
        })
        .catch(() => {});
    } else if (stateResult?.state) {
      setWindowState((prev) => ({
        ...prev,
        ...stateResult.state,
      }));
    }

    return () => {
      detachListener?.();
    };
  }, []);

  return (
    <header className="window-chrome" data-interactive-zone="true" data-window-chrome="true">
      <div className="window-chrome__drag" data-interactive-zone="true">
      </div>
      {/* controls removed */}
    </header>
  );
};

export default WindowChrome;
