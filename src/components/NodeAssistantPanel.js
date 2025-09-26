import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Highlighter from 'web-highlighter';
import QuestionService from '../services/QuestionService';
import { useSettings } from '../hooks/SettingsContext';

export const PANEL_SIZES = {
  compact: { width: 360, height: 180 },
  expanded: { width: 600, height: 640 },
};

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

const parseMarkdownBlocks = (text) => {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let currentList = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      currentList = null;
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!currentList) {
        currentList = { type: 'list', items: [] };
        blocks.push(currentList);
      }
      currentList.items.push(trimmed.replace(/^[-*]\s+/, '').trim());
      return;
    }

    currentList = null;
    blocks.push({ type: 'paragraph', content: trimmed });
  });

  return blocks;
};

const MarkdownMessage = ({ text }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);

  if (!blocks.length) {
    return null;
  }

  return (
    <div className="markdown-body">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'list') {
          return (
            <ul key={`md-list-${blockIndex}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`md-list-item-${blockIndex}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`md-paragraph-${blockIndex}`}>
            {block.content}
          </p>
        );
      })}
    </div>
  );
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
  const { autoPasteEnabled } = useSettings();
  const [placeholderNotice, setPlaceholderNotice] = useState(null);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const typingTimers = useRef([]);
  const questionServiceRef = useRef(externalQuestionService ?? new QuestionService());
  const isHydratingRef = useRef(true);
  const hasBootstrappedRef = useRef(false);
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

  useEffect(() => {
    if (!placeholderNotice) return undefined;
    const timeoutId = window.setTimeout(() => setPlaceholderNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [placeholderNotice]);

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
    setComposerValue('');
    isHydratingRef.current = true;
    hasBootstrappedRef.current = false;
  }, [clearTypingTimers, normalizedInitialConversation]);

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

  const sendResponse = useCallback(
    (question, { skipSecondQuestionCheck = false, overrideAnswerText } = {}) => {
      clearTypingTimers();

      const resolvedIsRootNode = isRootNodeProp;

      // 동작 복원: 루트 노드는 2번째 질문일 때만 생성, 그 외 노드는 즉시 생성
      let shouldCreateChild = false;
      if (!skipSecondQuestionCheck) {
        shouldCreateChild = resolvedIsRootNode
          ? questionServiceRef.current.incrementQuestionCount(node.id)
          : true;
      }

      if (shouldCreateChild && onSecondQuestion) {
        onSecondQuestion(node.id, question);
      }

      const responseText = overrideAnswerText ?? buildAnswerText(summary, question);
      const timestamp = Date.now();
      const userId = `${timestamp}-user`;
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', text: question },
      ]);

      const characters = Array.from(responseText);
      const assistantId = `${timestamp}-assistant`;

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', text: '', status: 'typing' },
      ]);

      if (!characters.length) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, status: 'complete' } : message,
          ),
        );
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
        }
      }, TYPING_INTERVAL_MS);

      typingTimers.current.push(intervalId);
    },
    [clearTypingTimers, summary, node.id, onSecondQuestion, isRootNodeProp],
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

  const handleSend = useCallback(() => {
    const trimmed = composerValue.trim();
    if (!trimmed) return;

    if (bootstrapMode) {
      const hasAnyUser = messages.some((m) => m.role === 'user');
      if (!hasAnyUser && typeof onBootstrapFirstSend === 'function') {
        onBootstrapFirstSend(trimmed);
        setComposerValue('');
        return;
      }
    }

    sendResponse(trimmed);
    setComposerValue('');
  }, [composerValue, sendResponse]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
        event.preventDefault();
        if (isHighlightMode) {
          const created = attemptHighlightPlaceholderCreate();
          if (!created) {
            return;
          }
          return;
        }
        handleSend();
      }
    },
    [attemptHighlightPlaceholderCreate, handleSend, isComposing, isHighlightMode],
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

  return (
    <div
      ref={panelRef}
      className="glass-shell relative flex h-full w-full flex-col rounded-[28px] p-6"
      style={{
        fontFamily: 'Arial, sans-serif',
        borderColor: 'rgba(255,255,255,0.25)',
        position: 'relative',
        zIndex: 1001,
        pointerEvents: 'auto',
      }}
      data-interactive-zone="true"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-white/10 opacity-40 mix-blend-screen" />
      <div className="relative flex flex-1 flex-col gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 min-h-0 backdrop-blur-md">
        <div
          ref={highlightRootRef}
          className="glass-scrollbar flex-1 overflow-y-auto overflow-x-hidden pr-1 min-h-0"
        >
          <div className="flex h-full flex-col gap-3">
            {messages.map((message) => {
              const isAssistant = message.role === 'assistant';

              return (
                <div
                  key={message.id}
                  className={`flex ${isAssistant ? 'justify-center' : 'justify-end'}`}
                  data-testid={isAssistant ? 'assistant-message' : 'user-message'}
                  data-status={message.status || 'complete'}
                >
                  <div
                    className={
                      isAssistant
                        ? 'glass-surface w-full max-w-[520px] break-words rounded-3xl border border-white/10 px-6 py-4 text-sm leading-relaxed text-slate-50 shadow-2xl'
                        : 'max-w-[240px] break-all rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100 shadow-lg backdrop-blur-sm'
                    }
                  >
                    {isAssistant ? (
                      <MarkdownMessage text={message.text} />
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form
          className="glass-surface flex items-end gap-3 rounded-xl border border-white/15 px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
          style={{ pointerEvents: 'auto', zIndex: 1002 }}
        >
          <button
            type="button"
            aria-label="하이라이트 모드"
            aria-pressed={isHighlightMode}
            onClick={handleHighlightToggle}
            className={`glass-chip flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200/60 ${
              isHighlightMode ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10 text-slate-100 hover:bg-white/20'
            }`}
          >
            🖍
          </button>
          <textarea
            ref={composerRef}
            value={composerValue}
            onChange={(event) => setComposerValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Ask anything..."
            className="glass-text-primary max-h-24 min-h-[40px] flex-1 resize-none border-none bg-transparent text-sm placeholder:text-slate-200 focus:outline-none"
            style={{ pointerEvents: 'auto' }}
            autoFocus={false}
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
            className="glass-chip flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg transition-opacity disabled:opacity-40"
            aria-label="메시지 전송"
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => {
              e.stopPropagation();
              handleSend();
            }}
          >
            ↗
          </button>
        </form>
      </div>
    </div>
  );
};

export default NodeAssistantPanel;
