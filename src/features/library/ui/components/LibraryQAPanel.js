import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import QuestionService from 'features/tree/services/QuestionService';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import { upsertTreeNodes } from 'infrastructure/supabase/services/treeService';
import ChatMessageList from 'features/chat/components/ChatMessageList';
import { DEFAULT_CHAT_PANEL_STYLES } from 'features/chat/constants/panelStyles';
import EditableTitle, { EDITABLE_TITLE_ACTIVE_ATTR } from 'shared/ui/EditableTitle';
import AgentClient from 'infrastructure/ai/agentClient';
import Highlighter from 'web-highlighter';
import HighlightSelectionStore from 'features/tree/services/node-assistant/HighlightSelectionStore';

const TYPING_INTERVAL_MS = 18;

const LibraryQAPanel = ({
  selectedNode,
  selectedTree,
  onNodeUpdate,
  onNewNodeCreated,
  onNodeSelect,
}) => {
  const { user } = useSupabaseAuth();
  const [messages, setMessages] = useState([]);
  const [composerValue, setComposerValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isMultiQuestionMode, setIsMultiQuestionMode] = useState(false);

  const messageContainerRef = useRef(null);
  const highlighterRef = useRef(null);
  const highlightHandlersRef = useRef({ create: null, remove: null });
  const highlightStoreRef = useRef(new HighlightSelectionStore());
  const [highlightNotice, setHighlightNotice] = useState(null);

  const handleRegisterMessageContainer = useCallback((element) => {
    messageContainerRef.current = element;
    console.debug('[LibraryQAPanel] message container registered', element);
  }, []);

  const isEditableTitleActive = useCallback(() => {
    if (typeof document === 'undefined') {
      return false;
    }
    if (document.querySelector(`[${EDITABLE_TITLE_ACTIVE_ATTR}="true"]`)) {
      return true;
    }
    const activeElement = document.activeElement;
    return Boolean(
      activeElement && activeElement.closest(`[${EDITABLE_TITLE_ACTIVE_ATTR}="true"]`),
    );
  }, []);

  const handleHighlighterCreate = useCallback(({ sources = [] }) => {
    const { added, size } = highlightStoreRef.current.addSources(sources);
    if (!added) {
      return;
    }
    setHighlightNotice({ type: 'info', message: `${size}개의 텍스트가 선택되었습니다.` });
  }, []);

  const handleHighlighterRemove = useCallback(({ ids = [] }) => {
    const { removed, size } = highlightStoreRef.current.removeByIds(ids);
    if (!removed) {
      return;
    }
    setHighlightNotice({
      type: 'info',
      message: size === 0 ? '선택된 텍스트가 없습니다.' : `${size}개의 텍스트가 선택되었습니다.`,
    });
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
        // cleanup failure does not impact user experience
      }
      instance.dispose();
    }

    highlighterRef.current = null;
    highlightHandlersRef.current = { create: null, remove: null };
    highlightStoreRef.current.clear();
  }, []);

  const enableHighlightMode = useCallback(() => {
    if (highlighterRef.current) {
      console.debug('[LibraryQAPanel] highlight already active');
      return true;
    }

    if (typeof window === 'undefined') {
      console.debug('[LibraryQAPanel] enableHighlightMode skipped: no window');
      return false;
    }

    const root = messageContainerRef.current;
    if (!root) {
      console.debug('[LibraryQAPanel] enableHighlightMode failed: no root');
      setHighlightNotice({ type: 'warning', message: '메시지 영역을 찾을 수 없습니다.' });
      return false;
    }

    try {
      const highlighter = new Highlighter({
        $root: root,
        exceptSelectors: ['textarea', 'button', 'input', '[data-block-pan="true"]'],
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

      setHighlightNotice({ type: 'info', message: '질문으로 만들 텍스트를 드래그해 선택하세요.' });
      return true;
    } catch (error) {
      console.error('[LibraryQAPanel] enableHighlightMode error', error);
      setHighlightNotice({ type: 'warning', message: '하이라이트 모드 초기화에 실패했습니다.' });
      return false;
    }
  }, [handleHighlighterCreate, handleHighlighterRemove]);

  const panelStyle = useMemo(() => ({
    fontFamily: '"Spoqa Han Sans Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative',
    zIndex: 1001,
    pointerEvents: 'auto',
    WebkitAppRegion: 'no-drag',
    background: DEFAULT_CHAT_PANEL_STYLES.background,
    borderColor: DEFAULT_CHAT_PANEL_STYLES.borderColor,
    borderWidth: '1px',
    borderStyle: 'solid',
    color: DEFAULT_CHAT_PANEL_STYLES.textColor,
  }), []);
  const subtleTextColor = DEFAULT_CHAT_PANEL_STYLES.subtleTextColor;

  const handleNodeTitleUpdate = useCallback(async (nextTitle) => {
    if (!selectedNode || !selectedTree) {
      return;
    }
    const trimmed = (nextTitle ?? '').trim();
    const currentTitle = (selectedNode.keyword || '').trim();
    if (!trimmed || trimmed === currentTitle) {
      return;
    }

    const nextUpdatedAt = Date.now();
    const previousQuestion = selectedNode.question || '';
    const updatedNode = {
      ...selectedNode,
      keyword: trimmed,
      question: !previousQuestion || previousQuestion === currentTitle ? trimmed : previousQuestion,
      updatedAt: nextUpdatedAt,
    };

    // Optimistic update so UI reflects changes immediately
    onNodeUpdate?.(updatedNode);
    onNodeSelect?.(updatedNode);
    setError(null);

    if (!user) {
      return;
    }

    try {
      await upsertTreeNodes({
        treeId: selectedTree.id,
        nodes: [updatedNode],
        userId: user.id,
      });
    } catch (renameError) {
      console.error('노드 제목 변경 실패:', renameError);
      setError('노드 제목을 저장하지 못했습니다.');
      onNodeUpdate?.(selectedNode);
      onNodeSelect?.(selectedNode);
    }
  }, [onNodeSelect, onNodeUpdate, selectedNode, selectedTree, setError, user]);

  const createPlaceholderNodes = useCallback(async (keywords) => {
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return;
    }
    if (!selectedNode || !selectedTree || !user) {
      throw new Error('노드를 선택하거나 사용자 정보를 확인할 수 없습니다.');
    }

    const parentId = selectedNode.id;
    const baseLevel = (selectedNode.level || 0) + 1;
    const timestamp = Date.now();

    const placeholders = keywords.map((keyword, index) => {
      const raw = typeof keyword === 'string' ? keyword.trim() : '';
      const label = raw || `Placeholder ${index + 1}`;
      const id = `placeholder_${timestamp}_${index}_${Math.random().toString(36).slice(2, 10)}`;

      return {
        id,
        keyword: label,
        question: label,
        answer: '',
        status: 'placeholder',
        createdAt: timestamp + index,
        updatedAt: timestamp + index,
        conversation: [],
        parentId,
        level: baseLevel,
        placeholder: {
          parentNodeId: parentId,
          createdAt: timestamp,
          sourceText: label,
        },
      };
    });

    placeholders.forEach((node) => {
      onNewNodeCreated?.(node, {
        source: parentId,
        target: node.id,
        value: 1,
      }, { select: false });
    });

    await upsertTreeNodes({
      treeId: selectedTree.id,
      nodes: placeholders,
      userId: user.id,
    });

    onNodeSelect?.(selectedNode);
  }, [onNewNodeCreated, onNodeSelect, selectedNode, selectedTree, user]);

  const toggleMultiQuestionMode = useCallback(() => {
    console.debug('[LibraryQAPanel] toggleMultiQuestionMode click', {
      isMultiQuestionMode,
      containerExists: Boolean(messageContainerRef.current),
    });
    if (isMultiQuestionMode) {
      disableHighlightMode();
      setIsMultiQuestionMode(false);
      setHighlightNotice({ type: 'info', message: '다중 질문 모드를 종료했습니다.' });
      return;
    }
    const enabled = enableHighlightMode();
    console.debug('[LibraryQAPanel] enableHighlightMode invoked', { container: messageContainerRef.current, button: document.querySelector('button[aria-label="하이라이트 모드"]') });
    console.debug('[LibraryQAPanel] enableHighlightMode result', enabled, {
      container: messageContainerRef.current,
    });
    if (enabled) {
      setIsMultiQuestionMode(true);
    }
  }, [disableHighlightMode, enableHighlightMode, isMultiQuestionMode]);

  const questionServiceRef = useRef(new QuestionService());
  const typingTimers = useRef([]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const isApiAvailable = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const ua = window.navigator?.userAgent || '';
    const hasElectron = /Electron/i.test(ua) || Boolean(window.process?.versions?.electron);
    const hasFallbackKey = Boolean(process.env.REACT_APP_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    return hasElectron || hasFallbackKey;
  }, []);

  // 선택된 노드가 변경될 때 메시지 초기화
  useEffect(() => {
    if (selectedNode) {
      const initialMessages = Array.isArray(selectedNode.conversation)
        ? selectedNode.conversation.map(msg => ({
          ...msg,
          content: msg.content || msg.text || ''
        }))
        : [];
      setMessages(initialMessages);
    } else {
      setMessages([]);
    }
    setComposerValue('');
    setError(null);
    disableHighlightMode();
    highlightStoreRef.current.clear();
    setHighlightNotice(null);
    if (isMultiQuestionMode) {
      setIsMultiQuestionMode(false);
    }
  }, [disableHighlightMode, isMultiQuestionMode, selectedNode]);

  // 메시지가 변경될 때 스크롤을 맨 아래로
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 노드가 선택되거나 변경되면 입력창에 포커스
  useEffect(() => {
    if (selectedNode && textareaRef.current) {
      const timer = setTimeout(() => {
        if (!textareaRef.current || isProcessing || isComposing) {
          return;
        }
        if (isEditableTitleActive()) {
          return;
        }
        textareaRef.current.focus();
        const length = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(length, length);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isComposing, isEditableTitleActive, isProcessing, selectedNode]);

  // 타이핑 애니메이션을 위한 타이머 정리
  const clearTypingTimers = useCallback(() => {
    typingTimers.current.forEach(timer => clearTimeout(timer));
    typingTimers.current = [];
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => clearTypingTimers();
  }, [clearTypingTimers]);

  useEffect(() => () => disableHighlightMode(), [disableHighlightMode]);

  useEffect(() => {
    if (!highlightNotice) {
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setHighlightNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [highlightNotice]);

  // LLM API 호출
  const invokeAgent = useCallback(async (channel, payload = {}) => {
    if (channel === 'askRoot') return AgentClient.askRoot(payload);
    if (channel === 'askChild') return AgentClient.askChild(payload);
    throw new Error(`지원하지 않는 채널: ${channel}`);
  }, []);

  // 답변 생성 및 타이핑 애니메이션
  const animateAssistantResponse = useCallback((assistantId, answerText, context = {}) => {
    clearTypingTimers();

    let currentText = '';
    const words = answerText.split(' ');
    let wordIndex = 0;

    const typeNextWord = () => {
      if (wordIndex < words.length) {
        currentText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
        wordIndex++;

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, text: currentText }
              : msg
          )
        );

        const timer = setTimeout(typeNextWord, TYPING_INTERVAL_MS);
        typingTimers.current.push(timer);
      } else {
        // 타이핑 완료
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, status: 'complete' }
              : msg
          )
        );
        setIsProcessing(false);
      }
    };

    typeNextWord();
  }, [clearTypingTimers]);

  // 질문 전송 처리
  const handleSendMessage = useCallback(async () => {
    const highlightTexts = isMultiQuestionMode ? highlightStoreRef.current.getTexts() : [];
    const question = composerValue.trim();

    if (highlightTexts.length > 0 && !question) {
      setComposerValue('');
      setIsProcessing(true);
      try {
        await createPlaceholderNodes(highlightTexts);
        setHighlightNotice({ type: 'success', message: `${highlightTexts.length}개의 플레이스홀더를 생성했습니다.` });
      } catch (placeholderError) {
        console.error('플레이스홀더 생성 실패:', placeholderError);
        const message = placeholderError.message || '다중 질문 플레이스홀더 생성 중 오류가 발생했습니다.';
        setError(message);
        setHighlightNotice({ type: 'warning', message });
      } finally {
        setIsProcessing(false);
        disableHighlightMode();
        setIsMultiQuestionMode(false);
        highlightStoreRef.current.clear();
      }
      return;
    }

    if (!question || isProcessing || !selectedNode || !selectedTree || !user) {
      return;
    }

    setComposerValue('');
    setError(null);
    setIsProcessing(true);

    const timestamp = Date.now();
    const userId = `${timestamp}-user`;
    const assistantId = `${timestamp}-assistant`;

    const userMessage = {
      id: userId,
      role: 'user',
      content: question,
      text: question,
      timestamp
    };

    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      text: '생각 중…',
      status: 'pending',
      timestamp: timestamp + 1
    };

    const newNodeId = `node_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    const keyword = question.split(' ').slice(0, 3).join(' ') || 'Q';

    const newNode = {
      id: newNodeId,
      keyword: keyword,
      question: question,
      answer: '',
      status: 'asking',
      createdAt: timestamp,
      updatedAt: timestamp,
      conversation: [userMessage, assistantMessage],
      parentId: selectedNode.id,
      level: (selectedNode.level || 0) + 1
    };

    setMessages([userMessage, assistantMessage]);

    if (onNewNodeCreated) {
      onNewNodeCreated(newNode, {
        source: newNode.parentId,
        target: newNode.id,
        value: 1
      });
    }

    try {
      const openaiMessages = [...messages, userMessage]
        .map(msg => ({
          role: msg.role,
          content: msg.content || msg.text || ''
        }))
        .filter(msg => msg.content && msg.content.trim());

      console.log('변환된 OpenAI 메시지:', openaiMessages);

      const response = await invokeAgent('askRoot', {
        messages: openaiMessages
      });

      if (!response.answer) {
        throw new Error('답변을 받지 못했습니다.');
      }

      animateAssistantResponse(assistantId, response.answer);

      const updatedMessages = [userMessage, {
        ...assistantMessage,
        text: response.answer,
        status: 'complete'
      }];

      const updatedNode = {
        ...newNode,
        conversation: updatedMessages,
        answer: response.answer,
        status: 'answered',
        updatedAt: timestamp
      };

      await upsertTreeNodes({
        treeId: selectedTree.id,
        nodes: [updatedNode],
        userId: user.id
      });

      if (onNodeUpdate) {
        onNodeUpdate(updatedNode);
      }

    } catch (error) {
      console.error('질문 처리 실패:', error);
      const errorMessage = error.message || '질문 처리 중 오류가 발생했습니다.';
      setError(errorMessage);

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, text: `오류: ${errorMessage}`, status: 'error' }
            : msg
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, [animateAssistantResponse, composerValue, createPlaceholderNodes, disableHighlightMode, invokeAgent, isMultiQuestionMode, isProcessing, messages, onNodeUpdate, selectedNode, selectedTree, user]);

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // 컴포저 포커스 처리
  const handleComposerFocus = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleComposerBlur = useCallback(() => {
    setIsComposing(false);
  }, []);

  if (!selectedNode) {
    return (
      <div
        className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden rounded-2xl p-6 backdrop-blur-3xl"
        style={panelStyle}
        data-interactive-zone="true"
      >
        <div
          className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 pb-2"
          data-pan-handle="true"
          style={{ cursor: 'grab', userSelect: 'none' }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-semibold" style={{ color: DEFAULT_CHAT_PANEL_STYLES.textColor }}>
                질문 답변
              </p>
            </div>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: subtleTextColor }}>
              노드를 선택하면 질문 답변을 시작할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden rounded-2xl p-6 backdrop-blur-3xl"
      style={panelStyle}
      data-interactive-zone="true"
    >
      <div
        className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 pb-2"
        data-pan-handle="true"
        style={{ cursor: 'grab', userSelect: 'none' }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className="min-w-0 flex-1"
              style={{ color: DEFAULT_CHAT_PANEL_STYLES.textColor }}
            >
              <EditableTitle
                title={(selectedNode.keyword && selectedNode.keyword.trim()) || selectedNode.id || '질문 답변'}
                onUpdate={handleNodeTitleUpdate}
                className="truncate text-lg font-semibold"
                placeholder="노드 제목을 입력하세요"
              />
            </div>
          </div>
          <p className="mt-1 text-xs" style={{ color: subtleTextColor }}>
            {selectedNode.question || selectedNode.keyword || '대화를 시작해보세요.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium" style={{ color: subtleTextColor }}>
          {isProcessing && (
            <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/5 px-2 py-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              처리 중…
            </span>
          )}
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
          <div className="text-center text-sm py-8" style={{ color: subtleTextColor }}>
            질문을 입력해보세요.
          </div>
        </div>
      ) : (
        <ChatMessageList
          title="Assistant"
          messages={messages}
          endRef={messagesEndRef}
          className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
          onContainerRef={handleRegisterMessageContainer}
          isScrollable={false}
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs text-red-500 shadow-sm">
          {error}
        </div>
      )}

      <div
        className="flex -mb-2 flex-shrink-0 justify-start"
        data-block-pan="true"
        style={{ position: 'relative', zIndex: 2 }}
      >
        <button
          type="button"
          onClick={toggleMultiQuestionMode}
          aria-pressed={isMultiQuestionMode}
          aria-label="하이라이트 모드"
          className="px-3 py-1 rounded-xl border text-xs font-medium transition-all duration-200"
          style={{
            backgroundColor: isMultiQuestionMode ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isMultiQuestionMode ? 'rgba(16, 185, 129, 0.6)' : DEFAULT_CHAT_PANEL_STYLES.borderColor,
            borderWidth: '1px',
            borderStyle: 'solid',
            color: DEFAULT_CHAT_PANEL_STYLES.textColor,
          }}
        >
          다중 질문
        </button>
      </div>

      {highlightNotice && (
        <div
          className="text-xs"
          style={{
            color: highlightNotice.type === 'warning'
              ? 'rgba(180, 83, 9, 0.9)'
              : highlightNotice.type === 'success'
                ? 'rgba(16, 185, 129, 0.9)'
                : subtleTextColor,
          }}
        >
          {highlightNotice.message}
        </div>
      )}

      {!isApiAvailable ? (
        <div className="text-center text-sm text-red-500 bg-red-50/80 px-3 py-2 rounded-xl border border-red-300/60">
          VORAN API를 사용할 수 없습니다. Electron 환경에서 실행해주세요.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="glass-surface flex flex-shrink-0 items-end gap-3 rounded-xl border px-3 py-2"
          style={{
            pointerEvents: 'auto',
            zIndex: 1002,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderColor: DEFAULT_CHAT_PANEL_STYLES.borderColor,
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          <div className="flex w-full items-end gap-2">
            <textarea
              ref={textareaRef}
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleComposerFocus}
              onBlur={handleComposerBlur}
              placeholder="질문을 입력하세요... (Enter로 전송)"
              className="max-h-24 min-h-[40px] flex-1 resize-none border-none bg-transparent text-sm focus:outline-none placeholder:text-gray-500"
              disabled={isProcessing}
              rows={2}
              autoComplete="off"
              spellCheck="false"
              style={{
                pointerEvents: 'auto',
                color: DEFAULT_CHAT_PANEL_STYLES.textColor,
                fontFamily: 'inherit',
                outline: 'none',
                border: 'none',
                resize: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!composerValue.trim() || isProcessing}
            className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-opacity disabled:opacity-40"
            style={{
              pointerEvents: 'auto',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              color: DEFAULT_CHAT_PANEL_STYLES.textColor,
              border: '1px solid ' + DEFAULT_CHAT_PANEL_STYLES.borderColor,
            }}
            aria-label="메시지 전송"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      )}
    </div>
  );
};

export default LibraryQAPanel;
