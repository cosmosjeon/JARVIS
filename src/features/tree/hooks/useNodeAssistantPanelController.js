import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Highlighter from 'web-highlighter';
import { useSettings } from 'shared/hooks/SettingsContext';
import { useTheme } from 'shared/components/library/ThemeProvider';
import createClipboardBridge from 'infrastructure/electron/bridges/clipboardBridge';
import { useNodeAssistantConversation } from 'features/tree/hooks/useNodeAssistantConversation';
import NodeNavigationService from 'features/tree/services/node-assistant/NodeNavigationService';
import HighlightSelectionStore from 'features/tree/services/node-assistant/HighlightSelectionStore';

export const PANEL_SIZES = {
  compact: { width: 1600, height: 900 },
  expanded: { width: 1920, height: 1080 },
};

const getScaledPanelSizes = (scaleFactor = 1) => ({
  compact: {
    width: PANEL_SIZES.compact.width * scaleFactor,
    height: PANEL_SIZES.compact.height * scaleFactor,
  },
  expanded: {
    width: PANEL_SIZES.expanded.width * scaleFactor,
    height: PANEL_SIZES.expanded.height * scaleFactor,
  },
});

const buildPanelStyles = (theme) => {
  switch (theme) {
    case 'light':
      return {
        background: 'rgba(255, 255, 255, 0.9)',
        borderColor: 'rgba(0, 0, 0, 0.15)',
        textColor: 'rgba(0, 0, 0, 0.9)',
      };
    case 'dark':
      return {
        background: 'rgba(32, 33, 35, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textColor: 'rgba(255, 255, 255, 0.9)',
      };
    default:
      return {
        background: 'rgba(255, 255, 255, 0.85)',
        borderColor: 'rgba(0, 0, 0, 0.2)',
        textColor: 'rgba(0, 0, 0, 0.9)',
      };
  }
};

export const useNodeAssistantPanelController = ({
  node,
  summary,
  onSizeChange,
  onSecondQuestion,
  onPlaceholderCreate,
  questionService,
  initialConversation = [],
  onConversationChange = () => {},
  isRootNode = false,
  bootstrapMode = false,
  onBootstrapFirstSend,
  onRequestAnswer,
  onAnswerComplete,
  onAnswerError,
  onCloseNode = () => {},
  onPanZoomGesture,
  nodeScaleFactor = 1,
  treeNodes = [],
  treeLinks = [],
  onNodeSelect = () => {},
  disableNavigation = false,
  navigationService: injectedNavigationService,
  highlightStore: injectedHighlightStore,
}) => {
  const { autoPasteEnabled } = useSettings();
  const { theme } = useTheme();

  const navigationServiceRef = useRef(injectedNavigationService ?? new NodeNavigationService());
  const highlightStoreRef = useRef(injectedHighlightStore ?? new HighlightSelectionStore());
  const highlighterRef = useRef(null);
  const highlightHandlersRef = useRef({ create: null, remove: null });
  const composerRef = useRef(null);
  const panelRef = useRef(null);
  const messageContainerRef = useRef(null);
  const composerValueRef = useRef('');

  const [composerValue, setComposerValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [hasFocusedComposer, setHasFocusedComposer] = useState(false);
  const [placeholderNotice, setPlaceholderNotice] = useState(null);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [copiedMap, setCopiedMap] = useState({});
  const [spinningMap, setSpinningMap] = useState({});

  const scaledPanelSizes = useMemo(
    () => getScaledPanelSizes(nodeScaleFactor),
    [nodeScaleFactor],
  );

  const {
    messages,
    assistantMessageCount,
    isTyping,
    submitMessage,
    sendResponse,
  } = useNodeAssistantConversation({
    node,
    summary,
    initialConversation,
    isRootNode,
    bootstrapMode,
    questionService,
    onConversationChange,
    onSecondQuestion,
    onRequestAnswer,
    onAnswerComplete,
    onAnswerError,
    onBootstrapFirstSend,
    onCloseNode,
  });

  useEffect(() => {
    navigationServiceRef.current.setTreeData(treeNodes, treeLinks);
  }, [treeNodes, treeLinks]);

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (composerRef.current && !hasFocusedComposer) {
        composerRef.current.focus();
        const length = composerRef.current.value.length;
        composerRef.current.setSelectionRange(length, length);
        setHasFocusedComposer(true);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [node, hasFocusedComposer]);

  useEffect(() => {
    composerValueRef.current = composerValue;
  }, [composerValue]);

  const getHighlightTexts = useCallback(() => highlightStoreRef.current.getTexts(), []);

  const clearHighlightSelections = useCallback(() => {
    highlightStoreRef.current.clear();
    if (highlighterRef.current) {
      try {
        highlighterRef.current.removeAll();
      } catch (error) {
        // cleanup 오류는 사용자 경험에 영향을 주지 않으므로 무시
      }
    }
  }, []);

  const disableHighlightMode = useCallback(() => {
    const instance = highlighterRef.current;
    const { create, remove } = highlightHandlersRef.current;

    if (instance) {
      if (create) {
        instance.off(Highlighter.event.CREATE, create);
      }
      if (remove) {
        instance.off(Highlighter.event.REMOVE, remove);
      }
      try {
        instance.removeAll();
      } catch (error) {
        // removeAll 실패는 무시
      }
      instance.dispose();
    }

    highlighterRef.current = null;
    highlightHandlersRef.current = { create: null, remove: null };
    highlightStoreRef.current.clear();
  }, []);

  const handleHighlighterCreate = useCallback(({ sources = [] }) => {
    const { added, size } = highlightStoreRef.current.addSources(sources);
    if (!added) return;

    setPlaceholderNotice({
      type: 'info',
      message: `${size}개의 텍스트가 하이라이트되었습니다.`,
    });
  }, []);

  const handleHighlighterRemove = useCallback(({ ids = [] }) => {
    const { removed, size } = highlightStoreRef.current.removeByIds(ids);
    if (!removed) return;

    setPlaceholderNotice({
      type: 'info',
      message: size === 0
        ? '하이라이트된 텍스트가 없습니다.'
        : `${size}개의 텍스트가 하이라이트되었습니다.`,
    });
  }, []);

  const enableHighlightMode = useCallback(() => {
    if (highlighterRef.current) {
      return true;
    }

    if (typeof window === 'undefined') {
      return false;
    }

    const root = messageContainerRef.current;
    if (!root) {
      setPlaceholderNotice({ type: 'warning', message: '하이라이트 영역을 찾을 수 없습니다.' });
      return false;
    }

    try {
      const highlighter = new Highlighter({
        $root: root,
        exceptSelectors: ['textarea', 'button', '[contenteditable="true"]'],
        style: { className: 'node-highlight-wrap' },
      });

      highlightStoreRef.current.clear();
      const createHandler = (payload) => handleHighlighterCreate(payload);
      const removeHandler = (payload) => handleHighlighterRemove(payload);

      highlighter.on(Highlighter.event.CREATE, createHandler);
      highlighter.on(Highlighter.event.REMOVE, removeHandler);
      highlighter.run();

      highlighterRef.current = highlighter;
      highlightHandlersRef.current = { create: createHandler, remove: removeHandler };

      setPlaceholderNotice({ type: 'info', message: '하이라이트 모드가 활성화되었습니다.' });
      return true;
    } catch (error) {
      setPlaceholderNotice({ type: 'warning', message: '하이라이트 초기화에 실패했습니다.' });
      return false;
    }
  }, [handleHighlighterCreate, handleHighlighterRemove]);

  useEffect(() => () => disableHighlightMode(), [disableHighlightMode]);

  useEffect(() => {
    const clipboardBridge = createClipboardBridge();

    const unsubscribeClipboard = clipboardBridge.onClipboard((payload = {}) => {
      if (!autoPasteEnabled) {
        setPlaceholderNotice({ type: 'info', message: '자동 붙여넣기 비활성화 상태입니다.' });
        return;
      }

      const rawText = typeof payload.text === 'string' ? payload.text : '';
      const trimmed = rawText.trim();
      if (!trimmed) {
        setPlaceholderNotice({ type: 'warning', message: '클립보드에서 텍스트를 찾을 수 없습니다. 복사 후 다시 시도하세요.' });
        return;
      }

      setIsHighlightMode((prev) => {
        if (prev) {
          disableHighlightMode();
        }
        return false;
      });

      setComposerValue(trimmed);
      composerRef.current?.focus?.();
      setPlaceholderNotice({ type: 'info', message: '클립보드 텍스트가 입력창에 채워졌습니다.' });
    });

    const unsubscribeError = clipboardBridge.onClipboardError((payload = {}) => {
      const code = payload?.error?.code;
      let message = '클립보드 읽기에 실패했습니다. 다시 시도해주세요.';
      if (code === 'empty') {
        message = '클립보드에 텍스트가 없습니다. 복사 후 다시 시도하세요.';
      } else if (code === 'too_large') {
        message = '클립보드 텍스트가 너무 깁니다. 10KB 이하로 줄여주세요.';
      }

      disableHighlightMode();
      setIsHighlightMode(false);
      setComposerValue('');
      setPlaceholderNotice({ type: 'warning', message });
    });

    return () => {
      unsubscribeClipboard?.();
      unsubscribeError?.();
    };
  }, [autoPasteEnabled, disableHighlightMode]);

  const handleHighlightToggle = useCallback(() => {
    setIsHighlightMode((prev) => {
      if (prev) {
        disableHighlightMode();
        setPlaceholderNotice({ type: 'info', message: '하이라이트 모드가 비활성화되었습니다.' });
        return false;
      }
      const enabled = enableHighlightMode();
      if (!enabled) {
        return false;
      }
      return true;
    });
  }, [disableHighlightMode, enableHighlightMode]);

  const attemptHighlightPlaceholderCreate = useCallback(() => {
    if (!isHighlightMode) return false;
    const highlightTexts = getHighlightTexts();
    if (!highlightTexts.length) {
      setPlaceholderNotice({
        type: 'warning',
        message: '하이라이트된 텍스트가 없습니다. 단어를 하이라이트한 뒤 Enter를 눌러주세요.',
      });
      return false;
    }

    onPlaceholderCreate?.(node.id, highlightTexts);
    clearHighlightSelections();
    setPlaceholderNotice({ type: 'success', message: `${highlightTexts.length}개의 플레이스홀더가 생성되었습니다.` });
    setComposerValue('');
    return true;
  }, [clearHighlightSelections, getHighlightTexts, isHighlightMode, node?.id, onPlaceholderCreate]);

  useEffect(() => {
    if (!placeholderNotice) return undefined;
    const timeoutId = window.setTimeout(() => setPlaceholderNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [placeholderNotice]);

  useEffect(() => {
    setHasFocusedComposer(false);
  }, [node?.id]);

  const handleSend = useCallback(async () => {
    const trimmed = composerValue.trim();
    if (!trimmed) return;

    try {
      await submitMessage(trimmed);
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      throw error;
    }
  }, [composerValue, submitMessage]);

  useEffect(() => {
    if (!onSizeChange) {
      return;
    }
    const nextSize = assistantMessageCount > 0 ? scaledPanelSizes.expanded : scaledPanelSizes.compact;
    onSizeChange(nextSize);
  }, [assistantMessageCount, onSizeChange, scaledPanelSizes]);

  const handleNodeNavigation = useCallback((direction) => {
    if (!node?.id || !onNodeSelect) {
      return;
    }

    const targetNode = navigationServiceRef.current.navigate(node.id, direction);
    if (targetNode) {
      onNodeSelect(targetNode);
      setTimeout(() => {
        composerRef.current?.focus();
      }, 100);
    }
  }, [node?.id, onNodeSelect]);

  useEffect(() => {
    if (isTyping && messageContainerRef.current) {
      const container = messageContainerRef.current;
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages, isTyping]);

  const handleCopyMessage = useCallback((message) => {
    if (!message?.text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message.text).then(() => {
        setCopiedMap((prev) => ({ ...prev, [message.id]: true }));
        window.setTimeout(() => setCopiedMap((prev) => ({ ...prev, [message.id]: false })), 1600);
      }).catch(() => undefined);
    }
  }, []);

  const handleRetryMessage = useCallback((message) => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = lastUser?.text || summary.label || node?.keyword || '';
    if (!question) return;
    setSpinningMap((prev) => ({ ...prev, [message.id]: true }));
    sendResponse(question).finally(() => {
      window.setTimeout(() => setSpinningMap((prev) => ({ ...prev, [message.id]: false })), 900);
    });
  }, [messages, node?.keyword, sendResponse, summary?.label]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();

      if (isHighlightMode) {
        const created = attemptHighlightPlaceholderCreate();
        if (!created) {
          return;
        }
        return;
      }

      if (composerValue.trim()) {
        setComposerValue('');
        const latestValue = composerValueRef.current;
        handleSend().catch(() => {
          setComposerValue(latestValue);
        });
      }
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      if (!isComposing && !isHighlightMode && composerValue === '' && !disableNavigation) {
        event.preventDefault();
        handleNodeNavigation(event.key);
      }
    }
  }, [attemptHighlightPlaceholderCreate, composerValue, disableNavigation, handleNodeNavigation, handleSend, isComposing, isHighlightMode]);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  useEffect(() => {
    if (!onPlaceholderCreate || !isHighlightMode) return undefined;

    const handleGlobalEnter = (event) => {
      if (event.key !== 'Enter' || event.shiftKey || isComposing) return;
      if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
      event.preventDefault();
      attemptHighlightPlaceholderCreate();
    };

    window.addEventListener('keydown', handleGlobalEnter, true);
    return () => window.removeEventListener('keydown', handleGlobalEnter, true);
  }, [attemptHighlightPlaceholderCreate, isComposing, isHighlightMode, onPlaceholderCreate]);

  useEffect(() => {
    if (!node) return;

    const timer = setTimeout(() => {
      if (composerRef.current) {
        composerRef.current.focus();
        const length = composerRef.current.value.length;
        composerRef.current.setSelectionRange(length, length);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [node]);

  const panelStyles = useMemo(() => buildPanelStyles(theme), [theme]);

  const registerMessageContainer = useCallback((element) => {
    messageContainerRef.current = element;
  }, []);

  const panelWheelHandler = useCallback((event) => {
    if ((event.ctrlKey || event.metaKey) && typeof onPanZoomGesture === 'function') {
      onPanZoomGesture(event);
    }
  }, [onPanZoomGesture]);

  const handleFormSubmit = useCallback((event) => {
    event.preventDefault();
    if (composerValue.trim()) {
      setComposerValue('');
      const latestValue = composerValueRef.current;
      handleSend().catch(() => {
        setComposerValue(latestValue);
      });
    }
  }, [composerValue, handleSend]);

  const handleSendClick = useCallback((event) => {
    event.stopPropagation();
    if (composerValue.trim()) {
      setComposerValue('');
      const latestValue = composerValueRef.current;
      handleSend().catch(() => {
        setComposerValue(latestValue);
      });
    }
  }, [composerValue, handleSend]);

  const handleComposerChange = useCallback((event) => {
    setComposerValue(event.target.value);
  }, []);

  const handleComposerPaste = useCallback((event) => {
    setTimeout(() => {
      setComposerValue(event.target.value);
    }, 0);
  }, []);

  const isSendDisabled = composerValue.trim().length === 0;

  return {
    panelRef,
    panelStyles,
    theme,
    summary,
    node,
    bootstrapMode,
    disableNavigation,
    onCloseNode,
    onPanZoomGesture,
    messages,
    spinningMap,
    copiedMap,
    handleRetryMessage,
    handleCopyMessage,
    registerMessageContainer,
    handleHighlightToggle,
    isHighlightMode,
    placeholderNotice,
    composerRef,
    composerValue,
    onComposerChange: handleComposerChange,
    onComposerPaste: handleComposerPaste,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    handleFormSubmit,
    handleSendClick,
    panelWheelHandler,
    isSendDisabled,
  };
};

export { getScaledPanelSizes };
