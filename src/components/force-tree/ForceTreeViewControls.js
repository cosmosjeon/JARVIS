import React, { useState } from 'react';
import { VIEW_MODES, ORIENTATIONS } from '../../hooks/force-tree/useTreeViewOptions';

const ForceTreeViewControls = ({
  viewMode,
  onChangeViewMode,
  layoutOrientation,
  onChangeLayoutOrientation,
  theme,
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  const isLight = theme === 'light';
  const layoutButtonBase = isLight ? 'text-gray-900 hover:bg-gray-100' : 'text-white/90 hover:bg-white/10';

  return (
    <div
      className="absolute top-12 left-1/2 z-[1300] -translate-x-1/2"
      style={{ pointerEvents: 'none' }}
    >
      <div className="pointer-events-auto flex gap-2 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-xs font-medium text-white/80 shadow-lg backdrop-blur-sm">
        <div
          className="relative"
          onMouseEnter={() => setShowLayoutMenu(true)}
          onMouseLeave={() => setShowLayoutMenu(false)}
        >
          <button
            type="button"
            onClick={() => onChangeViewMode(VIEW_MODES.TREE)}
            className={`rounded-full px-3 py-1 transition ${viewMode === VIEW_MODES.TREE ? 'bg-blue-400/90 text-black shadow-lg' : 'hover:bg-white/10 hover:text-white'}`}
            aria-pressed={viewMode === VIEW_MODES.TREE}
          >
            트리1
          </button>

          {showLayoutMenu && (
            <div
              className="absolute top-full left-0 w-28 z-[1400]"
              style={{ paddingTop: '8px' }}
              onMouseEnter={() => setShowLayoutMenu(true)}
              onMouseLeave={() => setShowLayoutMenu(false)}
            >
              <div
                className="rounded-lg shadow-2xl backdrop-blur-md border overflow-hidden"
                style={{
                  background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.85)',
                  borderColor: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.12)',
                }}
              >
                <button
                  className={`w-full px-3 py-2 text-left text-[13px] transition ${layoutButtonBase} ${layoutOrientation === ORIENTATIONS.VERTICAL ? 'font-semibold' : ''}`}
                  onClick={() => {
                    onChangeViewMode(VIEW_MODES.TREE);
                    onChangeLayoutOrientation(ORIENTATIONS.VERTICAL);
                    setShowLayoutMenu(false);
                  }}
                >
                  아래로
                </button>
                <div className={`h-px w-full ${isLight ? 'bg-gray-200' : 'bg-white/10'}`} />
                <button
                  className={`w-full px-3 py-2 text-left text-[13px] transition ${layoutButtonBase} ${layoutOrientation === ORIENTATIONS.HORIZONTAL ? 'font-semibold' : ''}`}
                  onClick={() => {
                    onChangeViewMode(VIEW_MODES.TREE);
                    onChangeLayoutOrientation(ORIENTATIONS.HORIZONTAL);
                    setShowLayoutMenu(false);
                  }}
                >
                  오른쪽
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onChangeViewMode(VIEW_MODES.FORCE)}
          className={`rounded-full px-3 py-1 transition ${viewMode === VIEW_MODES.FORCE ? 'bg-purple-400/90 text-black shadow-lg' : 'hover:bg-white/10 hover:text-white'}`}
          aria-pressed={viewMode === VIEW_MODES.FORCE}
        >
          트리2
        </button>

        <button
          type="button"
          onClick={() => onChangeViewMode(VIEW_MODES.CHART)}
          className={`rounded-full px-3 py-1 transition ${viewMode === VIEW_MODES.CHART ? 'bg-emerald-400/90 text-black shadow-lg' : 'hover:bg-white/10 hover:text-white'}`}
          aria-pressed={viewMode === VIEW_MODES.CHART}
        >
          차트
        </button>
      </div>
    </div>
  );
};

export default ForceTreeViewControls;
