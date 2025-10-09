import React from 'react';

const AssistantPanelHeader = ({
  summaryLabel,
  keyword,
  nodeId,
  disableNavigation,
  panelStyles,
  theme,
  bootstrapMode,
  onClose,
  onPanZoomGesture,
  showCloseButton = true,
}) => (
  <div
    className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 pb-2"
    data-pan-handle="true"
    style={{
      cursor: 'grab',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    }}
    onWheelCapture={(event) => {
      if (typeof onPanZoomGesture === 'function') {
        onPanZoomGesture(event);
      }
    }}
  >
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p
          className="truncate text-lg font-semibold"
          style={{ color: panelStyles.textColor }}
        >
          {summaryLabel || keyword || nodeId}
        </p>
        <div className="group relative">
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-full border bg-slate-100/10 text-xs font-medium hover:bg-slate-100/20 transition-colors"
            style={{
              borderColor: panelStyles.borderColor,
              color: panelStyles.textColor,
            }}
            data-block-pan="true"
          >
            ?
          </button>
          <div className="absolute left-full top-full ml-2 mt-1 hidden w-64 transform group-hover:block z-50">
            <div
              className="rounded-lg px-3 py-2 text-xs shadow-lg backdrop-blur-sm border"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(51, 65, 85, 0.95)',
                color: theme === 'dark' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(241, 245, 249, 0.95)',
                borderColor: theme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(148, 163, 184, 0.3)',
              }}
            >
              <p className="mb-1">이 영역을 드래그해서 트리 화면을 이동할 수 있습니다.</p>
              {!disableNavigation && (
                <p>↑↓ 부모/자식 노드 이동 | ←→ 형제 노드 이동</p>
              )}
            </div>
            <div className="absolute right-full top-2 h-0 w-0 transform border-t-4 border-b-4 border-r-4 border-transparent border-r-slate-600/30" />
          </div>
        </div>
      </div>
    </div>
    {!bootstrapMode && showCloseButton && (
      <div className="flex items-center gap-2" data-block-pan="true">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
          className="rounded-lg px-3 py-1 text-xs font-medium transition"
          style={{
            borderColor: panelStyles.borderColor,
            backgroundColor: panelStyles.background,
            borderWidth: '1px',
            borderStyle: 'solid',
            color: panelStyles.textColor,
          }}
          onMouseEnter={(event) => {
            event.target.style.backgroundColor = theme === 'dark'
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(event) => {
            event.target.style.backgroundColor = panelStyles.background;
          }}
        >
          닫기
        </button>
      </div>
    )}
  </div>
);

export default AssistantPanelHeader;
