import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Highlighter from 'web-highlighter';
import { useSettings } from 'shared/hooks/SettingsContext';
import { useTheme } from 'shared/components/library/ThemeProvider';
import createClipboardBridge from 'infrastructure/electron/bridges/clipboardBridge';
import { useNodeAssistantConversation } from 'features/tree/hooks/useNodeAssistantConversation';
import NodeNavigationService from 'features/tree/services/node-assistant/NodeNavigationService';
import HighlightSelectionStore from 'features/tree/services/node-assistant/HighlightSelectionStore';
import { EDITABLE_TITLE_ACTIVE_ATTR } from 'shared/ui/EditableTitle';
import { useAIModelPreference } from 'shared/hooks/useAIModelPreference';
import selectAutoModel from 'shared/utils/aiModelSelector';

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
    case 'glass':
      return {
        background: 'rgba(0, 0, 0, 0.65)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        textColor: 'rgba(248, 250, 252, 0.98)',
        subtleTextColor: 'rgba(226, 232, 240, 0.88)',
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
  theme = 'glass',
  onSizeChange,
  onSecondQuestion,
  onPlaceholderCreate,
  questionService,
  initialConversation = [],
  onConversationChange = () => { },
  isRootNode = false,
  bootstrapMode = false,
  onBootstrapFirstSend,
  onRequestAnswer,
  onAnswerComplete,
  onAnswerError,
  onCloseNode = () => { },
  onPanZoomGesture,
  nodeScaleFactor = 1,
  treeNodes = [],
  treeLinks = [],
  onNodeSelect = () => { },
  disableNavigation = false,
  navigationService: injectedNavigationService,
  highlightStore: injectedHighlightStore,
  attachments = [],
  onAttachmentsChange = () => { },
}) => {
  const { autoPasteEnabled } = useSettings();

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
  const [isMultiQuestionMode, setIsMultiQuestionMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlightNotice, setHighlightNotice] = useState(null);
  const [hasFocusedComposer, setHasFocusedComposer] = useState(false);
  const [placeholderNotice, setPlaceholderNotice] = useState(null);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState(() => (
    Array.isArray(attachments) ? attachments : []
  ));
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const {
    provider: selectedProvider,
    model: selectedModel,
    modelOptions,
    setModel: setSelectedModel,
  } = useAIModelPreference();

  const [spinningMap, setSpinningMap] = useState({});

  const shouldFocusComposer = useCallback(() => {
    if (typeof document === 'undefined') {
      return true;
    }
    if (document.querySelector(`[${EDITABLE_TITLE_ACTIVE_ATTR}="true"]`)) {
      return false;
    }
    const activeElement = document.activeElement;
    if (!activeElement) {
      return true;
    }
    return !activeElement.closest(`[${EDITABLE_TITLE_ACTIVE_ATTR}="true"]`);
  }, []);

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
    lastAutoSelection,
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
      if (composerRef.current && !hasFocusedComposer && shouldFocusComposer()) {
        composerRef.current.focus();
        const length = composerRef.current.value.length;
        composerRef.current.setSelectionRange(length, length);
        setHasFocusedComposer(true);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [hasFocusedComposer, node, shouldFocusComposer]);

  useEffect(() => {
    composerValueRef.current = composerValue;
  }, [composerValue]);

  useEffect(() => {
    setDraftAttachments(Array.isArray(attachments) ? attachments : []);
  }, [attachments]);

  const updateAttachments = useCallback((next) => {
    const normalized = Array.isArray(next) ? next : [];
    setDraftAttachments(normalized);
    onAttachmentsChange(normalized);
  }, [onAttachmentsChange]);

  const handleAttachmentRemove = useCallback((attachmentId) => {
    updateAttachments(
      draftAttachments.filter((item) => item && item.id !== attachmentId),
    );
  }, [draftAttachments, updateAttachments]);

  const clearAttachments = useCallback(() => {
    updateAttachments([]);
  }, [updateAttachments]);

  const handleAttachmentFiles = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList).filter((file) => file.type?.startsWith('image/'));
    if (!files.length) {
      setPlaceholderNotice({ type: 'warning', message: '이미지 파일만 첨부할 수 있습니다.' });
      return;
    }

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    setIsAttachmentUploading(true);
    try {
      const nextAttachments = await Promise.all(files.map(async (file, index) => {
        const dataUrl = await readFileAsDataUrl(file);
        return {
          id: `upload-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`,
          type: 'image',
          mimeType: file.type,
          dataUrl,
          name: file.name,
          label: file.name,
          size: file.size,
          createdAt: Date.now(),
        };
      }));

      updateAttachments([...draftAttachments, ...nextAttachments]);
    } catch (error) {
      setPlaceholderNotice({ type: 'warning', message: '이미지 첨부 중 오류가 발생했습니다.' });
    } finally {
      setIsAttachmentUploading(false);
    }
  }, [draftAttachments, updateAttachments]);

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

  // 하이라이트 모드 비활성화
  const disableHighlightMode = useCallback(() => {
    console.log('🔧 [disableHighlightMode] 호출됨, highlighter 존재:', Boolean(highlighterRef.current));
    const instance = highlighterRef.current;
    const { create, remove } = highlightHandlersRef.current;

    if (instance) {
      console.log('🔧 highlighter 정리 시작...');
      if (create) {
        instance.off(Highlighter.event.CREATE, create);
      }
      if (remove) {
        instance.off(Highlighter.event.REMOVE, remove);
      }
      try {
        instance.dispose();
      } catch (error) {
        console.warn('🔧 dispose 실패:', error);
      }
      console.log('🔧 highlighter 정리 완료');
    } else {
      console.log('🔧 highlighter 없음, 정리 스킵');
    }

    highlighterRef.current = null;
    highlightHandlersRef.current = { create: null, remove: null };
    highlightStoreRef.current.clear();
  }, []);

  // 하이라이트 모드 활성화
  const enableHighlightMode = useCallback(() => {
    if (highlighterRef.current) {
      console.debug('[NodeAssistantPanel] highlight already active');
      return true;
    }

    const root = messageContainerRef.current;
    if (!root) {
      console.warn('[NodeAssistantPanel] messageContainerRef not available');
      return false;
    }

    try {
      const highlighter = new Highlighter({
        $root: root,
        exceptSelectors: ['textarea', 'button', 'input', '[data-block-pan="true"]'],
        style: { className: 'node-highlight-wrap' },
      });

      highlightStoreRef.current.clear();

      const createHandler = (hl) => highlightStoreRef.current.add(hl);
      const removeHandler = (hl) => highlightStoreRef.current.remove(hl);

      highlighter.on(Highlighter.event.CREATE, createHandler);
      highlighter.on(Highlighter.event.REMOVE, removeHandler);
      highlighter.run();

      highlighterRef.current = highlighter;
      highlightHandlersRef.current = { create: createHandler, remove: removeHandler };

      console.log('🔧 highlighter 활성화 완료');
      return true;
    } catch (error) {
      console.error('🔧 highlighter 활성화 실패:', error);
      return false;
    }
  }, []);

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
      if (shouldFocusComposer()) {
        composerRef.current?.focus?.();
      }
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
  }, [autoPasteEnabled, disableHighlightMode, shouldFocusComposer]);

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

  const autoSelectionPreview = useMemo(() => {
    if (selectedProvider !== 'auto') {
      return null;
    }
    return selectAutoModel({
      question: composerValue,
      attachments: draftAttachments,
    });
  }, [composerValue, draftAttachments, selectedProvider]);

  const handleSend = useCallback(async (textSnapshot, attachmentsSnapshot) => {
    const rawText = typeof textSnapshot === 'string' ? textSnapshot : '';
    const trimmed = rawText.trim();
    const hasText = trimmed.length > 0;
    const sanitizedAttachments = Array.isArray(attachmentsSnapshot)
      ? attachmentsSnapshot.filter((item) => item && typeof item === 'object')
      : [];
    const hasAttachments = sanitizedAttachments.length > 0;

    if (!hasText && !hasAttachments) {
      return;
    }

    let modelInfoHint = null;
    if (selectedProvider === 'auto') {
      modelInfoHint = selectAutoModel({
        question: trimmed,
        attachments: sanitizedAttachments,
      });
    } else {
      modelInfoHint = {
        provider: selectedProvider,
        model: selectedModel,
      };
    }

    const payload = {
      text: trimmed,
      attachments: hasAttachments
        ? sanitizedAttachments.map((item) => ({ ...item }))
        : undefined,
      modelInfoHint,
    };

    try {
      await submitMessage(payload);
      if (hasAttachments) {
        clearAttachments();
      }
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      throw error;
    }
  }, [clearAttachments, selectedModel, selectedProvider, submitMessage]);

  const triggerSend = useCallback(() => {
    const textSnapshot = composerValueRef.current;
    const attachmentsSnapshot = draftAttachments;
    const hasText = textSnapshot.trim().length > 0;
    const hasAttachments = attachmentsSnapshot.length > 0;

    if (!hasText && !hasAttachments) {
      return;
    }

    setComposerValue('');
    handleSend(textSnapshot, attachmentsSnapshot).catch(() => {
      setComposerValue(textSnapshot);
      updateAttachments(attachmentsSnapshot);
    });
  }, [draftAttachments, handleSend, updateAttachments]);

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
        if (!shouldFocusComposer()) {
          return;
        }
        composerRef.current?.focus();
      }, 100);
    }
  }, [node?.id, onNodeSelect, shouldFocusComposer]);

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
      navigator.clipboard.writeText(message.text).catch(() => undefined);
    }
  }, []);

  const handleRetryMessage = useCallback((message) => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = lastUser?.text || summary.label || node?.keyword || '';
    if (!question) return;
    if (message?.id) {
      setSpinningMap((prev) => ({ ...prev, [message.id]: true }));
    }
    sendResponse(question).finally(() => {
      if (message?.id) {
        window.setTimeout(() => {
          setSpinningMap((prev) => ({ ...prev, [message.id]: false }));
        }, 900);
      }
    });
  }, [messages, node?.keyword, sendResponse, summary?.label]);

  const handleRetryWithModel = useCallback((message, modelId) => {
    const normalizedModelId = typeof modelId === 'string' ? modelId : '';
    const modelOption = modelOptions.find((option) => option.id === normalizedModelId);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = lastUser?.text || summary.label || node?.keyword || '';
    if (!question || !modelOption) return;
    if (message?.id) {
      setSpinningMap((prev) => ({ ...prev, [message.id]: true }));
    }
    setSelectedModel(modelOption.id);
    const triggerResend = () => {
      sendResponse(question).finally(() => {
        if (message?.id) {
          window.setTimeout(() => {
            setSpinningMap((prev) => ({ ...prev, [message.id]: false }));
          }, 900);
        }
      });
    };
    if (typeof window !== 'undefined') {
      window.setTimeout(triggerResend, 0);
    } else {
      triggerResend();
    }
  }, [messages, node?.keyword, sendResponse, setSelectedModel, summary?.label, modelOptions]);

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

      triggerSend();
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      if (!isComposing && !isHighlightMode && composerValue === '' && !disableNavigation) {
        event.preventDefault();
        handleNodeNavigation(event.key);
      }
    }
  }, [
    attemptHighlightPlaceholderCreate,
    composerValue,
    disableNavigation,
    handleNodeNavigation,
    isComposing,
    isHighlightMode,
    triggerSend,
  ]);

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
      if (!composerRef.current || !shouldFocusComposer()) {
        return;
      }
      composerRef.current.focus();
      const length = composerRef.current.value.length;
      composerRef.current.setSelectionRange(length, length);
    }, 100);

    return () => clearTimeout(timer);
  }, [node, shouldFocusComposer]);

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
    triggerSend();
  }, [triggerSend]);

  const handleSendClick = useCallback((event) => {
    event.stopPropagation();
    triggerSend();
  }, [triggerSend]);

  const handleComposerChange = useCallback((event) => {
    setComposerValue(event.target.value);
  }, []);

  const handleComposerPaste = useCallback((event) => {
    setTimeout(() => {
      setComposerValue(event.target.value);
    }, 0);
  }, []);

  useEffect(() => {
    if (!node || typeof window === 'undefined') {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }

      const panelElement = panelRef.current;
      if (!panelElement) {
        onCloseNode();
        return;
      }

      const doc = typeof document !== 'undefined' ? document : null;
      const activeElement = doc?.activeElement ?? null;
      const isPanelFocused = !activeElement
        || activeElement === doc?.body
        || panelElement.contains(activeElement);

      if (!isPanelFocused) {
        return;
      }

      onCloseNode();
    };

    window.addEventListener('keydown', handleEscape, true);

    return () => {
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [node, onCloseNode]);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    console.log('🎬 [마운트] 컴포넌트 마운트됨');
    // 마운트 시에는 highlighter 정리하지 않음 (아직 없음)
    return () => {
      console.log('🎬 [언마운트] 컴포넌트 언마운트됨');
      // 언마운트 시에만 정리
      disableHighlightMode();
    };
  }, [disableHighlightMode]);

  // 노드 변경 시 다중 질문 모드 종료
  useEffect(() => {
    console.log('🔄 [useEffect] 노드 변경 감지 - selectedNode 변경됨');
    
    // 다중 질문 모드가 켜져있으면 끄기
    if (isMultiQuestionMode) {
      console.log('🔄 노드 변경으로 다중 질문 모드 종료');
      disableHighlightMode();
      setIsMultiQuestionMode(false);
      setHighlightNotice(null);
    }
  }, [node, isMultiQuestionMode, disableHighlightMode]);

  // 하이라이트 알림 자동 사라짐
  useEffect(() => {
    if (!highlightNotice) {
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }
    // 다중 질문 모드가 켜져있을 때는 안내 메시지 유지
    if (isMultiQuestionMode) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setHighlightNotice(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [highlightNotice, isMultiQuestionMode]);

  const isSendDisabled = isAttachmentUploading
    || (composerValue.trim().length === 0 && draftAttachments.length === 0);

  // 다중 질문 모드 토글
  const toggleMultiQuestionMode = useCallback(() => {
    console.log('=================================');
    console.log('🔥 [다중질문버튼] 클릭됨!');
    console.log('현재 모드:', isMultiQuestionMode ? '켜짐' : '꺼짐');
    console.log('메시지 컨테이너 존재:', Boolean(messageContainerRef.current));
    console.log('=================================');
    
    if (isMultiQuestionMode) {
      console.log('✅ 다중 질문 모드 종료 시작...');
      disableHighlightMode();
      console.log('⚙️ setIsMultiQuestionMode(false) 호출 전');
      setIsMultiQuestionMode(false);
      console.log('⚙️ setIsMultiQuestionMode(false) 호출 후');
      setHighlightNotice(null);
      console.log('✅ 다중 질문 모드 종료 완료');
      return;
    }
    
    console.log('🚀 다중 질문 모드 활성화 시작...');
    const enabled = enableHighlightMode();
    console.log('하이라이트 모드 활성화 결과:', enabled);
    console.log('메시지 컨테이너:', messageContainerRef.current);
    
    if (enabled) {
      console.log('⚙️ setIsMultiQuestionMode(true) 호출 전');
      setIsMultiQuestionMode(true);
      console.log('⚙️ setIsMultiQuestionMode(true) 호출 후');
      setHighlightNotice({ type: 'info', message: '다중 질문 모드: 텍스트를 드래그하면 하이라이트됩니다. 일반 복사는 불가능합니다.' });
      console.log('✅ 다중 질문 모드 활성화 완료');
    } else {
      console.error('❌ 다중 질문 모드 활성화 실패!');
    }
  }, [isMultiQuestionMode, disableHighlightMode, enableHighlightMode]);

  // 전체 화면 모드 토글
  const toggleFullscreen = useCallback(() => {
    console.log('🖥️ [전체화면버튼] 클릭됨!');
    console.log('현재 모드:', isFullscreen ? '전체화면' : '일반');
    setIsFullscreen(prev => !prev);
  }, [isFullscreen]);

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
    attachments: draftAttachments,
    onAttachmentRemove: handleAttachmentRemove,
    onClearAttachments: clearAttachments,
    handleRetryMessage,
    handleRetryWithModel,
    handleCopyMessage,
    availableModels: [],
    spinningMap,
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
    onAttachmentFiles: handleAttachmentFiles,
    isAttachmentUploading,
    selectedProvider,
    selectedModel,
    modelOptions,
    setSelectedModel,
    autoSelectionPreview,
    lastAutoSelection,
    isMultiQuestionMode,
    isFullscreen,
    highlightNotice,
    toggleMultiQuestionMode,
    toggleFullscreen,
  };
};

export { getScaledPanelSizes };
