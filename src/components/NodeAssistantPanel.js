import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Highlighter from 'web-highlighter';
import QuestionService from '../services/QuestionService';
import NodeNavigationService from '../services/NodeNavigationService';
import { useSettings } from '../hooks/SettingsContext';
import { useTheme } from './library/ThemeProvider';
import { Response } from './ui/shadcn-io/ai/response';
import { Copy as CopyIcon, RefreshCcw as RefreshCcwIcon } from 'lucide-react';
import { Actions, Action } from './ui/shadcn-io/ai/actions';
import { Conversation, ConversationContent, ConversationScrollButton } from './ui/shadcn-io/ai/conversation';

export const PANEL_SIZES = {
  compact: { width: 1600, height: 900 },
  expanded: { width: 1920, height: 1080 },
};

// 노드 스케일 팩터를 적용한 패널 크기 계산
const getScaledPanelSizes = (scaleFactor = 1) => ({
  compact: {
    width: PANEL_SIZES.compact.width * scaleFactor,
    height: PANEL_SIZES.compact.height * scaleFactor
  },
  expanded: {
    width: PANEL_SIZES.expanded.width * scaleFactor,
    height: PANEL_SIZES.expanded.height * scaleFactor
  },
});

const TYPING_INTERVAL_MS = 18;

const buildAnswerText = (summary, question) => {
  const bulletSource = Array.isArray(summary?.bullets) ? summary.bullets : [];
  const bulletText = bulletSource.map((item) => `- ${item}`).join('\n');
  const intro = question
    ? `${summary.label} 관련 질문을 받았습니다.`
    : `${summary.label} 개요입니다.`;
  const detail = `${summary.intro}`;
  const body = [detail, bulletText].filter(Boolean).join('\n\n');
  return `${intro}\n\n${body}`.trim();
};

const NodeAssistantPanel = ({
  node,
  color,
  onSizeChange,
  onSecondQuestion,
  onPlaceholderCreate,
  questionService: externalQuestionService,
  initialConversation = [],
  onConversationChange = () => { },
  nodeSummary,
  isRootNode: isRootNodeProp = false,
  bootstrapMode = false,
  onBootstrapFirstSend,
  onRequestAnswer,
  onAnswerComplete,
  onAnswerError,
  onCloseNode = () => { },
  onPanZoomGesture,
  nodeScaleFactor = 1,
  // 노드 네비게이션을 위한 새로운 props
  treeNodes = [],
  treeLinks = [],
  onNodeSelect = () => { },
  disableNavigation = false, // 메모 모드에서 네비게이션 비활성화
}) => {
  const summary = useMemo(() => {
    // 새로 생성된 노드인 경우 (questionData가 있는 경우) 특별 처리
    if (node.questionData) {
      return {
        label: node.keyword || node.id,
        intro: node.fullText || `${node.keyword || node.id}에 대한 질문과 답변입니다.`,
        bullets: [
          `질문: ${node.questionData.question}`,
          `답변: ${node.questionData.answer}`,
          `부모 노드: ${node.questionData.parentNodeId}`
        ]
      };
    }
    if (nodeSummary) {
      return nodeSummary;
    }
    const label = node.keyword || node.id;
    return {
      label,
      intro: node.fullText ? `${label}은(는) ${node.fullText}` : `${label} 개요입니다.`,
      bullets: [],
    };
  }, [node, nodeSummary]);
  const normalizedInitialConversation = useMemo(() => {
    if (!Array.isArray(initialConversation)) return [];
    return initialConversation.map((message) => ({ ...message }));
  }, [initialConversation]);

  const [messages, setMessages] = useState(() => normalizedInitialConversation);
  const [composerValue, setComposerValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [hasFocusedComposer, setHasFocusedComposer] = useState(false);
  const { autoPasteEnabled } = useSettings();
  const [placeholderNotice, setPlaceholderNotice] = useState(null);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const { theme } = useTheme();
  const typingTimers = useRef([]);
  const questionServiceRef = useRef(externalQuestionService ?? new QuestionService());
  const navigationServiceRef = useRef(new NodeNavigationService());
  const isHydratingRef = useRef(true);
  const hasBootstrappedRef = useRef(false);
  const composerValueRef = useRef('');

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

  // initialConversation이 변경되면 messages 업데이트
  useEffect(() => {
    setMessages(normalizedInitialConversation);
  }, [normalizedInitialConversation]);
  useEffect(() => {
    composerValueRef.current = composerValue;
  }, [composerValue]);
  const panelRef = useRef(null);
  const highlightRootRef = useRef(null);
  const highlighterRef = useRef(null);
  const composerRef = useRef(null);
  const highlightHandlersRef = useRef({ create: null, remove: null });
  const highlightSourceMapRef = useRef(new Map());

  useEffect(() => {
    if (externalQuestionService) {
      questionServiceRef.current = externalQuestionService;
    }
  }, [externalQuestionService]);

  // 노드 네비게이션 서비스에 트리 데이터 설정
  useEffect(() => {
    navigationServiceRef.current.setTreeData(treeNodes, treeLinks);
  }, [treeNodes, treeLinks]);

  useEffect(() => {
    if (!placeholderNotice) return undefined;
    const timeoutId = window.setTimeout(() => setPlaceholderNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [placeholderNotice]);

  // 노드가 선택되거나 변경되면 입력창에 포커스
  useEffect(() => {
    if (node && composerRef.current) {
      // 약간의 지연을 두어 DOM이 업데이트된 후 포커스
      const timer = setTimeout(() => {
        if (composerRef.current) {
          composerRef.current.focus();
          // 커서를 텍스트 끝으로 이동
          const length = composerRef.current.value.length;
          composerRef.current.setSelectionRange(length, length);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [node]);

  const getHighlightTexts = useCallback(() => {
    const uniqueTexts = new Set();
    highlightSourceMapRef.current.forEach((text) => {
      if (typeof text === 'string') {
        const trimmed = text.trim();
        if (trimmed) {
          uniqueTexts.add(trimmed);
        }
      }
    });
    return Array.from(uniqueTexts.values());
  }, []);

  const clearHighlightSelections = useCallback(() => {
    highlightSourceMapRef.current.clear();
    if (highlighterRef.current) {
      try {
        highlighterRef.current.removeAll();
      } catch (error) {
        // 하이라이터 정리 과정에서의 오류는 사용자 흐름과 직접 관련이 없으므로 무시
      }
    }
  }, []);

  const handleHighlighterCreate = useCallback(({ sources = [] }) => {
    if (!Array.isArray(sources) || sources.length === 0) return;
    let added = false;
    sources.forEach((source) => {
      if (!source) return;
      const { id, text } = source;
      if (typeof text !== 'string') return;
      const normalized = text.trim();
      if (!normalized) return;
      const sourceId = id || `${normalized}-${Math.random().toString(36).slice(2, 10)}`;
      highlightSourceMapRef.current.set(sourceId, normalized);
      added = true;
    });
    if (added) {
      const size = getHighlightTexts().length;
      setPlaceholderNotice({ type: 'info', message: `${size}개의 텍스트가 하이라이트되었습니다.` });
    }
  }, [getHighlightTexts]);

  const handleHighlighterRemove = useCallback(({ ids = [] }) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    let removed = false;
    ids.forEach((id) => {
      if (highlightSourceMapRef.current.delete(id)) {
        removed = true;
      }
    });
    if (removed) {
      const remaining = getHighlightTexts().length;
      if (remaining === 0) {
        setPlaceholderNotice({ type: 'info', message: '하이라이트된 텍스트가 없습니다.' });
      } else {
        setPlaceholderNotice({ type: 'info', message: `${remaining}개의 텍스트가 하이라이트되었습니다.` });
      }
    }
  }, [getHighlightTexts]);

  const enableHighlightMode = useCallback(() => {
    if (highlighterRef.current) {
      return true;
    }
    if (typeof window === 'undefined') {
      return false;
    }
    const root = highlightRootRef.current;
    if (!root) {
      setPlaceholderNotice({ type: 'warning', message: '하이라이트 영역을 찾을 수 없습니다.' });
      return false;
    }
    try {
      const highlighter = new Highlighter({
        $root: root,
        exceptSelectors: ['textarea', 'button', '[contenteditable="true"]'],
        style: {
          className: 'node-highlight-wrap',
        },
      });
      highlightSourceMapRef.current.clear();
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
    highlightSourceMapRef.current.clear();
  }, []);

  useEffect(() => () => disableHighlightMode(), [disableHighlightMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const api = window.jarvisAPI;
    if (!api?.onClipboard) {
      return undefined;
    }

    const unsubscribeClipboard = api.onClipboard((payload = {}) => {
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

    const unsubscribeError = api.onClipboardError?.((payload = {}) => {
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
  }, [disableHighlightMode, autoPasteEnabled]);

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
      setPlaceholderNotice({ type: 'warning', message: '하이라이트된 텍스트가 없습니다. 단어를 하이라이트한 뒤 Enter를 눌러주세요.' });
      return false;
    }

    onPlaceholderCreate?.(node.id, highlightTexts);
    clearHighlightSelections();
    setPlaceholderNotice({ type: 'success', message: `${highlightTexts.length}개의 플레이스홀더가 생성되었습니다.` });
    setComposerValue('');
    return true;
  }, [clearHighlightSelections, getHighlightTexts, isHighlightMode, node.id, onPlaceholderCreate]);

  const clearTypingTimers = useCallback(() => {
    typingTimers.current.forEach(clearInterval);
    typingTimers.current = [];
  }, []);

  useEffect(() => () => clearTypingTimers(), [clearTypingTimers]);

  useEffect(() => {
    clearTypingTimers();
    setMessages(normalizedInitialConversation);
    if (!composerValueRef.current || composerValueRef.current.length === 0) {
      setComposerValue('');
    }
    isHydratingRef.current = true;
    hasBootstrappedRef.current = false;
  }, [clearTypingTimers, normalizedInitialConversation]);

  useEffect(() => {
    setHasFocusedComposer(false);
  }, [node?.id]);

  const assistantMessageCount = useMemo(
    () => messages.filter((message) => message.role === 'assistant').length,
    [messages],
  );

  useEffect(() => {
    if (!onSizeChange) return;
    const nextSize = assistantMessageCount > 0 ? PANEL_SIZES.expanded : PANEL_SIZES.compact;
    onSizeChange(nextSize);
  }, [assistantMessageCount, onSizeChange]);

  useEffect(() => {
    if (isHydratingRef.current) {
      isHydratingRef.current = false;
      return;
    }
    onConversationChange(messages.map((message) => ({ ...message })));
  }, [messages, onConversationChange]);

  const animateAssistantResponse = useCallback(
    (assistantId, answerText, context = {}) => {
      const characters = Array.from(answerText || '');

      if (characters.length === 0) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, text: '', status: 'complete' }
              : message,
          ),
        );
        onAnswerComplete?.(node.id, { ...context, answer: '' });
        return;
      }

      let index = 0;
      const intervalId = setInterval(() => {
        index += 1;
        const typedText = characters.slice(0, index).join('');
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id !== assistantId) return message;
            const isDone = index >= characters.length;
            return {
              ...message,
              text: typedText,
              status: isDone ? 'complete' : 'typing',
            };
          }),
        );

        if (index >= characters.length) {
          clearInterval(intervalId);
          typingTimers.current = typingTimers.current.filter((timer) => timer !== intervalId);
          onAnswerComplete?.(node.id, { ...context, answer: typedText });
        }
      }, TYPING_INTERVAL_MS);

      typingTimers.current.push(intervalId);
    },
    [node.id, onAnswerComplete],
  );

  const sendResponse = useCallback(
    async (question, { skipSecondQuestionCheck = false, overrideAnswerText } = {}) => {
      clearTypingTimers();

      const resolvedIsRootNode = isRootNodeProp;
      const normalizedQuestion = typeof question === 'string' ? question.trim() : '';
      const questionText = normalizedQuestion || (typeof question === 'string' ? question : '');

      let shouldCreateChild = false;
      if (!skipSecondQuestionCheck) {
        shouldCreateChild = resolvedIsRootNode
          ? questionServiceRef.current.incrementQuestionCount(node.id)
          : true;
      }

      const timestamp = Date.now();
      const userId = `${timestamp}-user`;
      const assistantId = `${timestamp}-assistant`;

      // 첫 번째 사용자 질문만 기존 노드에 추가, 이후에는 새 노드로 생성
      const isFirstQuestion = !messages.some((m) => m.role === 'user');

      if (isFirstQuestion) {
        // 첫 번째 질문: 기존 노드에 추가
        setMessages((prev) => [
          ...prev,
          { id: userId, role: 'user', text: question },
          { id: assistantId, role: 'assistant', text: '생각 중…', status: 'pending' },
        ]);
      } else {
        // 두 번째 질문부터: 질문 입력 즉시 기존 노드 닫고 새 노드 생성
        if (shouldCreateChild && onSecondQuestion) {
          // 질문 입력 즉시 기존 노드 닫기
          onCloseNode();

          // 즉시 새 노드 생성
          await onSecondQuestion(node.id, question, '', {});

          return; // 새 노드로 생성했으므로 여기서 종료
        }
      }

      // 첫 번째 질문일 때만 답변 생성
      if (isFirstQuestion) {
        try {
          let answerText = overrideAnswerText ?? '';
          let metadata = null;

          if (!answerText) {
            if (typeof onRequestAnswer === 'function') {
              const result = await onRequestAnswer({
                node,
                question,
                isRootNode: resolvedIsRootNode,
                shouldCreateChild: false, // 첫 번째 질문이므로 자식 노드 생성하지 않음
              });
              answerText = result?.answer ?? '';
              metadata = result || {};
            } else {
              answerText = buildAnswerText(summary, question);
            }
          }

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, text: '', status: 'typing' }
                : message,
            ),
          );

          animateAssistantResponse(assistantId, answerText, {
            question,
            metadata,
            shouldCreateChild: false, // 첫 번째 질문이므로 자식 노드 생성하지 않음
            isRootNode: resolvedIsRootNode,
          });
        } catch (error) {
          const messageText = error?.message || '요청 처리 중 오류가 발생했습니다.';
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, text: `⚠️ ${messageText}`, status: 'error' }
                : message,
            ),
          );
          onAnswerError?.(node.id, {
            question,
            error,
            shouldCreateChild: false,
            isRootNode: resolvedIsRootNode,
          });
        }
      }
    },
    [
      animateAssistantResponse,
      clearTypingTimers,
      isRootNodeProp,
      node,
      onAnswerError,
      onRequestAnswer,
      onSecondQuestion,
      questionServiceRef,
      summary,
    ],
  );

  useEffect(() => {
    if (!node.questionData) return;
    if (normalizedInitialConversation.length > 0) return;
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    sendResponse(node.questionData.question, {
      skipSecondQuestionCheck: true,
      overrideAnswerText: node.questionData.answer,
    });
  }, [node.questionData, normalizedInitialConversation.length, sendResponse]);

  const handleSend = useCallback(async () => {
    const trimmed = composerValue.trim();
    if (!trimmed) return;

    if (bootstrapMode) {
      const hasAnyUser = messages.some((m) => m.role === 'user');
      if (!hasAnyUser && typeof onBootstrapFirstSend === 'function') {
        const timestamp = Date.now();
        const userId = `${timestamp}-user`;
        const assistantId = `${timestamp}-assistant`;

        // Bootstrap 모드에서는 첫 번째 질문만 기존 노드에 추가
        setMessages((prev) => [
          ...prev,
          { id: userId, role: 'user', text: trimmed },
          { id: assistantId, role: 'assistant', text: '생각 중…', status: 'pending' },
        ]);

        try {
          await onBootstrapFirstSend(trimmed);
        } catch (error) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                  ...message,
                  text: `⚠️ ${error?.message || '루트 노드 생성 중 오류가 발생했습니다.'}`,
                  status: 'error',
                }
                : message,
            ),
          );
          throw error;
        }
        return;
      }
    }

    try {
      await sendResponse(trimmed);
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      // 오류 발생 시 사용자에게 알림 (이미 setComposerValue에서 처리됨)
      throw error;
    }
  }, [bootstrapMode, composerValue, messages, onBootstrapFirstSend, sendResponse]);

  // 노드 네비게이션 핸들러
  const handleNodeNavigation = useCallback((direction) => {
    if (!node?.id || !onNodeSelect) {
      return;
    }

    const targetNode = navigationServiceRef.current.navigate(node.id, direction);

    if (targetNode) {
      onNodeSelect(targetNode);
      // 입력창에 포커스를 유지
      setTimeout(() => {
        composerRef.current?.focus();
      }, 100);
    }
  }, [node?.id, onNodeSelect]);

  const [copiedMap, setCopiedMap] = useState({});
  const [spinningMap, setSpinningMap] = useState({});
  const scrollContainerRef = useRef(null);
  const isTyping = useMemo(() => messages.some(m => m.status === 'typing' || m.status === 'pending'), [messages]);

  // 타이핑 중일 때만 자동 스크롤 (메시지 변경될 때마다)
  useEffect(() => {
    if (isTyping && scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      // 다음 프레임에서 스크롤 (DOM 업데이트 후)
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
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
    // 마지막 사용자 메시지로 재요청, 없으면 현재 노드 라벨을 질문으로 사용
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = lastUser?.text || summary.label || node.keyword || '';
    if (!question) return;
    setSpinningMap((prev) => ({ ...prev, [message.id]: true }));
    sendResponse(question).finally(() => {
      window.setTimeout(() => setSpinningMap((prev) => ({ ...prev, [message.id]: false })), 900);
    });
  }, [messages, sendResponse, summary.label, node.keyword]);

  const handleKeyDown = useCallback(
    (event) => {
      // Enter 키 처리
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
        
        // 텍스트가 있을 때만 전송
        if (composerValue.trim()) {
          // 입력창 즉시 비우기
          setComposerValue('');
          const latestValue = composerValueRef.current;
          handleSend().catch(() => {
            // 오류 발생 시 입력값 복원
            setComposerValue(latestValue);
          });
        }
        return;
      }

      // 방향키 네비게이션 처리 (텍스트 입력 중이 아닐 때만)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        if (!isComposing && !isHighlightMode && composerValue === '' && !disableNavigation) {
          event.preventDefault();
          handleNodeNavigation(event.key);
          return;
        }
      }
    },
    [attemptHighlightPlaceholderCreate, handleSend, isComposing, isHighlightMode, handleNodeNavigation, composerValue, disableNavigation],
  );

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

  // 테마별 색상 설정 - 테마에 맞는 색상 적용
  const panelStyles = useMemo(() => {
    switch (theme) {
      case 'light':
        return {
          background: 'rgba(255, 255, 255, 0.9)',
          borderColor: 'rgba(0, 0, 0, 0.15)',
          textColor: 'rgba(0, 0, 0, 0.9)',
        };
      case 'dark':
        return {
          background: 'rgba(32, 33, 35, 0.95)', // GPT 다크모드 색상
          borderColor: 'rgba(255, 255, 255, 0.1)',
          textColor: 'rgba(255, 255, 255, 0.9)',
        };
      default: // glass
        return {
          background: 'rgba(255, 255, 255, 0.85)',
          borderColor: 'rgba(0, 0, 0, 0.2)',
          textColor: 'rgba(0, 0, 0, 0.9)',
        };
    }
  }, [theme]);

  return (
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
      onWheelCapture={(event) => {
        if ((event.ctrlKey || event.metaKey) && typeof onPanZoomGesture === 'function') {
          onPanZoomGesture(event);
        }
      }}
    >

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
              {summary.label || node.keyword || node.id}
            </p>
            <div className="group relative">
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300/20 bg-slate-100/10 text-xs font-medium text-slate-300 hover:bg-slate-100/20 transition-colors"
                data-block-pan="true"
              >
                ?
              </button>
              <div className="absolute left-full top-full ml-2 mt-1 hidden w-64 transform group-hover:block z-50">
                <div className="rounded-lg bg-slate-800/95 px-3 py-2 text-xs text-slate-100 shadow-lg backdrop-blur-sm border border-slate-600/30">
                  <p className="mb-1">이 영역을 드래그해서 트리 화면을 이동할 수 있습니다.</p>
                  {!disableNavigation && (
                    <p>↑↓ 부모/자식 노드 이동 | ←→ 형제 노드 이동</p>
                  )}
                </div>
                <div className="absolute right-full top-2 h-0 w-0 transform border-t-4 border-b-4 border-r-4 border-transparent border-r-slate-600/30"></div>
              </div>
            </div>
          </div>
        </div>
        {!bootstrapMode && (
          <div className="flex items-center gap-2" data-block-pan="true">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onCloseNode();
              }}
              className="rounded-lg px-3 py-1 text-xs font-medium transition"
              style={{
                borderColor: panelStyles.borderColor,
                backgroundColor: panelStyles.background,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: panelStyles.textColor,
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = theme === 'dark' 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = panelStyles.background;
              }}
            >
              닫기
            </button>
          </div>
        )}
      </div>

      <div
        ref={(el) => {
          highlightRootRef.current = el;
          scrollContainerRef.current = el;
        }}
        className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
      >
        <div className="flex flex-col gap-6">
          {messages.map((message) => {
            const isAssistant = message.role === 'assistant';

            return (
              <div
                key={message.id}
                className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                data-testid={isAssistant ? 'assistant-message' : 'user-message'}
                data-status={message.status || 'complete'}
              >
                {isAssistant ? (
                  <div className="w-full">
                    <Response className="w-full text-base leading-7" style={{ color: panelStyles.textColor }}>
                      {message.text}
                    </Response>
                    <Actions className="mt-2">
                      <Action 
                        tooltip="Regenerate response"
                        label="Retry"
                        onClick={() => handleRetryMessage(message)}
                      >
                        <RefreshCcwIcon className={`h-4 w-4 ${spinningMap[message.id] ? 'animate-spin' : ''}`} />
                      </Action>
                      <Action 
                        tooltip="Copy to clipboard"
                        label="Copy"
                        onClick={() => handleCopyMessage(message)}
                      >
                        {copiedMap[message.id] ? (
                          <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </Action>
                    </Actions>
                  </div>
                ) : (
                  <div
                    className="max-w-[240px] break-all rounded-2xl px-4 py-3 text-sm shadow-lg backdrop-blur-sm"
                    style={{
                      borderColor: panelStyles.borderColor,
                      backgroundColor: theme === 'light' || theme === 'glass'
                        ? 'rgba(0, 0, 0, 0.05)' // 흰색 배경일 때는 어두운 배경 사용
                        : 'rgba(255, 255, 255, 0.1)', // 다크모드일 때는 밝은 배경 사용
                      borderWidth: '1px',
                      borderStyle: 'solid',
                    }}
                  >
                    <p
                      className="whitespace-pre-wrap leading-relaxed"
                      style={{ 
                        color: theme === 'light' || theme === 'glass'
                          ? 'rgba(0, 0, 0, 0.9)' // 흰색 배경일 때는 어두운 텍스트
                          : 'rgba(255, 255, 255, 0.9)' // 다크모드일 때는 밝은 텍스트
                      }}
                    >
                      {message.text}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 다중 질문 버튼 */}
      <div className="flex -mb-2 flex-shrink-0 justify-start" data-block-pan="true">
        <button
          type="button"
          onClick={handleHighlightToggle}
          className={`px-3 py-1 rounded-xl border text-xs font-medium transition-all duration-200 ${isHighlightMode
            ? 'bg-emerald-500/60 text-emerald-100 border-emerald-400/60'
            : 'hover:bg-white/20'
            }`}
          style={{
            backgroundColor: isHighlightMode 
              ? 'rgba(16, 185, 129, 0.6)' 
              : theme === 'dark' 
                ? 'rgba(64, 65, 79, 0.8)' // GPT 다크모드 버튼 색상
                : 'rgba(255, 255, 255, 0.8)',
            borderColor: isHighlightMode 
              ? 'rgba(16, 185, 129, 0.6)' 
              : panelStyles.borderColor,
            borderWidth: '1px',
            borderStyle: 'solid',
            color: panelStyles.textColor
          }}
        >
          다중 질문
        </button>
      </div>

      <form
        className="glass-surface flex flex-shrink-0 items-end gap-3 rounded-xl border px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          // 입력창 즉시 비우기
          if (composerValue.trim()) {
            setComposerValue('');
            const latestValue = composerValueRef.current;
            handleSend().catch(() => {
              // 오류 발생 시 입력값 복원
              setComposerValue(latestValue);
            });
          }
        }}
        style={{ 
          pointerEvents: 'auto', 
          zIndex: 1002,
          backgroundColor: theme === 'dark' 
            ? 'rgba(64, 65, 79, 0.8)' // GPT 다크모드 입력창 색상
            : 'rgba(255, 255, 255, 0.8)',
          borderColor: panelStyles.borderColor,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
      >
        <textarea
          ref={composerRef}
          value={composerValue}
          onChange={(event) => {
            setComposerValue(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={(event) => {
            // 붙여넣기 시에도 정상적으로 처리
            setTimeout(() => {
              setComposerValue(event.target.value);
            }, 0);
          }}
          placeholder="Ask anything..."
          className={`max-h-24 min-h-[40px] flex-1 resize-none border-none bg-transparent text-sm focus:outline-none ${
            theme === 'light' || theme === 'glass'
              ? 'placeholder:text-gray-500'
              : 'placeholder:text-gray-400'
          }`}
          style={{
            pointerEvents: 'auto',
            color: theme === 'light' || theme === 'glass'
              ? 'rgba(0, 0, 0, 0.9)' // 흰색 배경일 때는 어두운 텍스트
              : 'rgba(255, 255, 255, 0.9)', // 다크모드일 때는 밝은 텍스트
            fontFamily: 'inherit',
            outline: 'none',
            border: 'none',
            resize: 'none'
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
          disabled={!composerValue.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-opacity disabled:opacity-40"
          aria-label="메시지 전송"
          style={{ 
            pointerEvents: 'auto',
            backgroundColor: theme === 'dark' 
              ? 'rgba(64, 65, 79, 0.9)' // GPT 다크모드 전송 버튼 색상
              : 'rgba(255, 255, 255, 0.8)',
            color: panelStyles.textColor,
            border: `1px solid ${panelStyles.borderColor}`
          }}
          onClick={(e) => {
            e.stopPropagation();
            // 입력창 즉시 비우기
            if (composerValue.trim()) {
              setComposerValue('');
              const latestValue = composerValueRef.current;
              handleSend().catch(() => {
                // 오류 발생 시 입력값 복원
                setComposerValue(latestValue);
              });
            }
          }}
        >
          ↗
        </button>
      </form>
    </div>
  );
};

export default NodeAssistantPanel;
