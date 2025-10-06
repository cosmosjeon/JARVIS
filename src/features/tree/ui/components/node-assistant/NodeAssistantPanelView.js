import React from 'react';
import AssistantPanelHeader from 'features/tree/ui/components/node-assistant/AssistantPanelHeader';
import AssistantMessageList from 'features/tree/ui/components/node-assistant/AssistantMessageList';

const NodeAssistantPanelView = ({
  panelRef,
  panelStyles,
  theme,
  summary,
  node,
  bootstrapMode,
  disableNavigation,
  onCloseNode,
  onPanZoomGesture,
  registerMessageContainer,
  messages,
  handleRetryMessage,
  handleCopyMessage,
  spinningMap,
  copiedMap,
  handleHighlightToggle,
  isHighlightMode,
  placeholderNotice,
  composerRef,
  composerValue,
  onComposerChange,
  onComposerPaste,
  handleKeyDown,
  handleCompositionStart,
  handleCompositionEnd,
  handleFormSubmit,
  handleSendClick,
  panelWheelHandler,
  isSendDisabled,
}) => (
  <div
    ref={panelRef}
    className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden rounded-2xl p-6 backdrop-blur-3xl"
    style={{
      fontFamily: '"Spoqa Han Sans Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      zIndex: 1001,
      pointerEvents: 'auto',
      WebkitAppRegion: 'no-drag',
      background: panelStyles.background,
      borderColor: panelStyles.borderColor,
      borderWidth: '1px',
      borderStyle: 'solid',
      color: panelStyles.textColor,
    }}
    data-interactive-zone="true"
    onWheelCapture={panelWheelHandler}
  >
    <AssistantPanelHeader
      summaryLabel={summary.label}
      keyword={node.keyword}
      nodeId={node.id}
      disableNavigation={disableNavigation}
      panelStyles={panelStyles}
      theme={theme}
      bootstrapMode={bootstrapMode}
      onClose={onCloseNode}
      onPanZoomGesture={onPanZoomGesture}
    />

    <div
      ref={registerMessageContainer}
      className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
    >
      <AssistantMessageList
        messages={messages}
        panelStyles={panelStyles}
        theme={theme}
        onRetry={handleRetryMessage}
        onCopy={handleCopyMessage}
        spinningMap={spinningMap}
        copiedMap={copiedMap}
      />
    </div>

    <div className="flex -mb-2 flex-shrink-0 justify-start" data-block-pan="true">
      <button
        type="button"
        onClick={handleHighlightToggle}
        aria-pressed={isHighlightMode}
        aria-label="하이라이트 모드"
        className={`px-3 py-1 rounded-xl border text-xs font-medium transition-all duration-200 ${isHighlightMode
          ? 'bg-emerald-500/60 text-emerald-100 border-emerald-400/60'
          : 'hover:bg-white/20'
        }`}
        style={{
          backgroundColor: isHighlightMode
            ? 'rgba(16, 185, 129, 0.6)'
            : theme === 'dark'
              ? 'rgba(64, 65, 79, 0.8)'
              : 'rgba(255, 255, 255, 0.8)',
          borderColor: isHighlightMode
            ? 'rgba(16, 185, 129, 0.6)'
            : panelStyles.borderColor,
          borderWidth: '1px',
          borderStyle: 'solid',
          color: panelStyles.textColor,
        }}
      >
        다중 질문
      </button>
    </div>

    <form
      className="glass-surface flex flex-shrink-0 items-end gap-3 rounded-xl border px-3 py-2"
      onSubmit={handleFormSubmit}
      style={{
        pointerEvents: 'auto',
        zIndex: 1002,
        backgroundColor: theme === 'dark'
          ? 'rgba(64, 65, 79, 0.8)'
          : 'rgba(255, 255, 255, 0.8)',
        borderColor: panelStyles.borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <textarea
        ref={composerRef}
        value={composerValue}
        onChange={onComposerChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={onComposerPaste}
        placeholder="Ask anything..."
        className={`max-h-24 min-h-[40px] flex-1 resize-none border-none bg-transparent text-sm focus:outline-none ${
          theme === 'light' || theme === 'glass'
            ? 'placeholder:text-gray-500'
            : 'placeholder:text-gray-400'
        }`}
        style={{
          pointerEvents: 'auto',
          color: theme === 'light' || theme === 'glass'
            ? 'rgba(0, 0, 0, 0.9)'
            : 'rgba(255, 255, 255, 0.9)',
          fontFamily: 'inherit',
          outline: 'none',
          border: 'none',
          resize: 'none',
        }}
        autoFocus={false}
        autoComplete="off"
        spellCheck="false"
      />
      {placeholderNotice && (
        <span
          className={`text-xs ${placeholderNotice.type === 'success' ? 'text-emerald-200' : 'text-amber-200'} whitespace-nowrap`}
        >
          {placeholderNotice.message}
        </span>
      )}
      <button
        type="submit"
        disabled={isSendDisabled}
        className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-opacity disabled:opacity-40"
        aria-label="메시지 전송"
        style={{
          pointerEvents: 'auto',
          backgroundColor: theme === 'dark'
            ? 'rgba(64, 65, 79, 0.9)'
            : 'rgba(255, 255, 255, 0.8)',
          color: panelStyles.textColor,
          border: `1px solid ${panelStyles.borderColor}`,
        }}
        onClick={handleSendClick}
      >
        ↗
      </button>
    </form>
  </div>
);

export default NodeAssistantPanelView;
