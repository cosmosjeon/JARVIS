import React, { useMemo, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  DEFAULT_CHAT_PANEL_STYLES,
  DEFAULT_CHAT_THEME,
  isLightLikeChatTheme,
} from 'features/chat/constants/panelStyles';

export default function ChatComposer({
  onSend,
  placeholder = '아이디어, 질문, 다음 액션을 입력하세요...',
  theme = DEFAULT_CHAT_THEME,
  panelStyles = DEFAULT_CHAT_PANEL_STYLES,
  isSending = false,
}) {
  const [value, setValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const resolvedPanelStyles = useMemo(
    () => ({ ...DEFAULT_CHAT_PANEL_STYLES, ...(panelStyles || {}) }),
    [panelStyles],
  );
  const resolvedTheme = theme || DEFAULT_CHAT_THEME;
  const isLightTheme = isLightLikeChatTheme(resolvedTheme);
  const trimmedValue = value.trim();
  const isSendDisabled = isSending || trimmedValue.length === 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSendDisabled) {
      return;
    }
    onSend?.(trimmedValue);
    setValue('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <form
      className="glass-surface flex flex-shrink-0 items-end gap-3 rounded-xl border px-3 py-2"
      onSubmit={handleSubmit}
      style={{
        pointerEvents: 'auto',
        backgroundColor: isLightTheme
          ? 'rgba(255, 255, 255, 0.8)'
          : 'rgba(64, 65, 79, 0.8)',
        borderColor: resolvedPanelStyles.borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={placeholder}
        className={`max-h-24 min-h-[40px] flex-1 resize-none border-none bg-transparent text-sm focus:outline-none ${
          isLightTheme ? 'placeholder:text-gray-500' : 'placeholder:text-gray-400'
        }`}
        style={{
          color: isLightTheme
            ? 'rgba(0, 0, 0, 0.9)'
            : 'rgba(255, 255, 255, 0.92)',
          fontFamily: 'inherit',
          pointerEvents: 'auto',
        }}
        autoComplete="off"
        spellCheck="false"
        rows={2}
      />
      <button
        type="submit"
        disabled={isSendDisabled}
        className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-opacity disabled:opacity-40"
        aria-label="메시지 전송"
        style={{
          pointerEvents: 'auto',
          backgroundColor: isLightTheme
            ? 'rgba(255, 255, 255, 0.85)'
            : 'rgba(64, 65, 79, 0.9)',
          color: resolvedPanelStyles.textColor,
          border: `1px solid ${resolvedPanelStyles.borderColor}`,
        }}
      >
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </form>
  );
}
