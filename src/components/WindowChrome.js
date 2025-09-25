import React, { useEffect, useState } from 'react';

const DEFAULT_WINDOW_STATE = {
  maximized: false,
  fullscreen: false,
};

const WindowChrome = () => {
  const [windowState, setWindowState] = useState(DEFAULT_WINDOW_STATE);

  useEffect(() => {
    const api = window.jarvisAPI?.windowControls;
    if (!api) {
      return undefined;
    }

    let detachListener = () => {};

    if (typeof api.onStateChange === 'function') {
      detachListener = api.onStateChange((payload = {}) => {
        setWindowState((prev) => ({
          ...prev,
          ...payload,
        }));
      });
    }

    if (typeof api.getState === 'function') {
      api.getState().then((response) => {
        if (response?.success && response.state) {
          setWindowState((prev) => ({
            ...prev,
            ...response.state,
          }));
        }
      }).catch(() => {});
    }

    return () => {
      detachListener?.();
    };
  }, []);

  return (
    <header className="window-chrome" data-interactive-zone="true" data-window-chrome="true">
      <div className="window-chrome__drag" data-interactive-zone="true">
        <span className="window-chrome__title">JARVIS Widget</span>
      </div>
      {/* controls removed */}
    </header>
  );
};

export default WindowChrome;
