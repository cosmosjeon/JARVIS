import React, { useMemo } from 'react';
import {
  NODE_SHAPES,
  getNodeDatum,
  getNodeId,
} from '../utils/forceTreeUtils';

const ForceTreeContextMenu = ({ controller, theme }) => {
  const {
    contextMenuState,
    simulatedNodes,
    handleMenuAddConnection,
    handleMenuAddRoot,
    handleMenuAddMemo,
    handleMenuRemoveNode,
    handleNodeShapeChange,
    handleSizeSliderChange,
    handleSizeSliderComplete,
    canAddLink,
    canAddMemo,
    isBackgroundContext,
    contextMenuCoordinates,
  } = controller;

  const activeNode = useMemo(() => {
    if (!contextMenuState.nodeId) {
      return null;
    }
    return simulatedNodes.find((node) => getNodeId(node) === contextMenuState.nodeId) || null;
  }, [contextMenuState.nodeId, simulatedNodes]);

  const activeDatum = activeNode ? getNodeDatum(activeNode) : null;
  const currentSizeValue = activeDatum?.sizeValue ?? 50;
  const currentShape = activeDatum?.nodeShape ?? NODE_SHAPES.RECTANGLE;

  const sliderBackground = useMemo(() => {
    const clampedValue = Math.max(5, Math.min(100, currentSizeValue));
    if (theme === 'light') {
      return `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${clampedValue}%, #e5e7eb ${clampedValue}%, #e5e7eb 100%)`;
    }
    return `linear-gradient(to right, #60a5fa 0%, #60a5fa ${clampedValue}%, #374151 ${clampedValue}%, #374151 100%)`;
  }, [currentSizeValue, theme]);

  if (!contextMenuState.open || !contextMenuCoordinates) {
    return null;
  }

  return (
    <div
      data-force-tree-context-menu="true"
      className={`absolute z-20 w-44 overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm ${theme === 'light'
        ? 'border-gray-200 bg-white/95'
        : 'border-white/10 bg-slate-900/80'
      }`}
      style={{
        left: contextMenuCoordinates.x,
        top: contextMenuCoordinates.y,
      }}
    >
      {isBackgroundContext ? (
        <>
          <button
            type="button"
            className={`w-full px-3 py-2 text-left text-[13px] transition ${theme === 'light'
              ? 'text-gray-900 hover:bg-gray-100'
              : 'text-white/90 hover:bg-white/10'
            }`}
            onClick={handleMenuAddRoot}
          >
            루트 노드 추가
          </button>
          <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <div className="px-3 py-2">
            <div className={`mb-1.5 text-[12px] font-medium uppercase tracking-wide ${theme === 'light' ? 'text-gray-400' : 'text-white/40'}`}>
              배경 동작
            </div>
            <div className={`text-[12px] leading-relaxed ${theme === 'light' ? 'text-gray-500' : 'text-white/40'}`}>
              빈 공간에서 마우스 오른쪽 버튼을 눌러 신규 루트 노드를 추가할 수 있습니다.
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={`px-3 py-2 ${theme === 'light' ? 'bg-gray-50/80' : 'bg-white/5'}`}>
            <div className={`text-[12px] font-semibold uppercase tracking-wide ${theme === 'light' ? 'text-gray-500' : 'text-white/50'}`}>
              노드 옵션
            </div>
            <div className={`text-[13px] ${theme === 'light' ? 'text-gray-700' : 'text-white/70'}`}>
              {activeDatum?.keyword || activeDatum?.name || activeDatum?.id || '선택된 노드'}
            </div>
          </div>
          <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <button
            type="button"
            className={`w-full px-3 py-2 text-left text-[13px] transition ${theme === 'light'
              ? (canAddLink ? 'text-gray-900 hover:bg-gray-100' : 'cursor-not-allowed text-gray-400')
              : (canAddLink ? 'text-white/90 hover:bg-white/10' : 'cursor-not-allowed text-white/35')
            }`}
            disabled={!canAddLink}
            onClick={() => {
              if (!canAddLink) return;
              handleMenuAddConnection();
            }}
          >
            연결선 추가
          </button>
          <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <button
            type="button"
            className={`w-full px-3 py-2 text-left text-[13px] transition ${theme === 'light'
              ? (canAddMemo ? 'text-gray-900 hover:bg-gray-100' : 'cursor-not-allowed text-gray-400')
              : (canAddMemo ? 'text-white/90 hover:bg-white/10' : 'cursor-not-allowed text-white/35')
            }`}
            disabled={!canAddMemo}
            onClick={() => {
              if (!canAddMemo) return;
              handleMenuAddMemo();
            }}
          >
            메모 추가
          </button>
          <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <div className="px-3 py-2">
            <div className={`mb-2 text-[13px] font-medium ${theme === 'light' ? 'text-gray-700' : 'text-white/80'}`}>
              노드 모양
            </div>
            <div className="mb-3 grid grid-cols-2 gap-1">
              {[
                { key: NODE_SHAPES.RECTANGLE, label: '사각형', icon: '⬜' },
                { key: NODE_SHAPES.DOT, label: '닷', icon: '●' },
                { key: NODE_SHAPES.ELLIPSE, label: '타원', icon: '○' },
                { key: NODE_SHAPES.DIAMOND, label: '마름모', icon: '◆' },
              ].map(({ key, label, icon }) => {
                const isSelected = currentShape === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleNodeShapeChange(key)}
                    className={`flex items-center justify-center space-x-1 rounded px-2 py-1.5 text-[11px] transition ${isSelected
                      ? (theme === 'light'
                        ? 'border border-blue-200 bg-blue-100 text-blue-700'
                        : 'border border-blue-400/30 bg-blue-500/20 text-blue-300')
                      : (theme === 'light'
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-white/70 hover:bg-white/10')
                    }`}
                  >
                    <span className="text-[10px]">{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <div className="px-3 py-2">
            <div className={`mb-2 text-[13px] font-medium ${theme === 'light' ? 'text-gray-700' : 'text-white/80'}`}>
              노드 크기 조절
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="5"
                max="100"
                value={currentSizeValue}
                onChange={handleSizeSliderChange}
                onMouseUp={handleSizeSliderComplete}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg"
                style={{
                  background: sliderBackground,
                  outline: 'none',
                  WebkitAppearance: 'none',
                }}
              />
              <span className={`min-w-[30px] text-[11px] font-mono ${theme === 'light' ? 'text-gray-500' : 'text-white/60'}`}>
                {currentSizeValue}
              </span>
            </div>
          </div>
          <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
          <button
            type="button"
            className={`w-full px-3 py-2 text-left text-[13px] transition ${theme === 'light'
              ? 'text-red-600 hover:bg-red-50'
              : 'text-red-300 hover:bg-red-500/20'
            }`}
            onClick={handleMenuRemoveNode}
          >
            노드 삭제
          </button>
        </>
      )}
    </div>
  );
};

export default ForceTreeContextMenu;
