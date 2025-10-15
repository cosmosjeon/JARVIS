import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X, Paperclip, Network, Shield } from 'lucide-react';
import QuestionService from 'features/tree/services/QuestionService';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import { useFileDropZone } from 'shared/hooks/useFileDropZone';
import { upsertTreeNodes } from 'infrastructure/supabase/services/treeService';
import ChatMessageList from 'features/chat/components/ChatMessageList';
import ChatAttachmentPreviewList from 'features/chat/components/ChatAttachmentPreviewList';
import ProviderDropdown from 'features/chat/components/ProviderDropdown';
import { DEFAULT_CHAT_PANEL_STYLES } from 'features/chat/constants/panelStyles';
import EditableTitle, { EDITABLE_TITLE_ACTIVE_ATTR } from 'shared/ui/EditableTitle';
import { AttachmentDropOverlay } from 'shared/ui/AttachmentDropOverlay';
import AgentClient, { isAgentHttpBridgeAvailable } from 'infrastructure/ai/agentClient';
import Highlighter from 'web-highlighter';
import HighlightSelectionStore from 'features/tree/services/node-assistant/HighlightSelectionStore';
import { cn } from 'shared/utils';
import { useTheme } from 'shared/components/library/ThemeProvider';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputToolbar,
} from 'shared/ui/shadcn-io/ai/prompt-input';
import { useAIModelPreference, resolveModelForProvider } from 'shared/hooks/useAIModelPreference';
import selectAutoModel from 'shared/utils/aiModelSelector';
import {
  DEFAULT_AGENT_RESPONSE_TIMEOUT_MS,
  LONG_RESPONSE_NOTICE_DELAY_MS,
  LONG_RESPONSE_REMINDER_DELAY_MS,
} from 'shared/constants/agentTimeouts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'shared/ui/tooltip';
import collectAncestorConversationMessages from 'features/tree/utils/assistantContext';

const TYPING_INTERVAL_MS = 16;
const MAX_TYPING_DURATION_MS = 1200;
const MAX_TYPING_WORD_COUNT = 400;
const AGENT_RESPONSE_TIMEOUT_MS = DEFAULT_AGENT_RESPONSE_TIMEOUT_MS;
const SLOW_RESPONSE_FIRST_HINT = 'AI가 답변을 준비 중입니다. 잠시만 기다려 주세요.';
const SLOW_RESPONSE_SECOND_HINT = '아직 계산 중이에요. 최대 2분 정도 더 걸릴 수 있습니다.';
const TIMEOUT_MESSAGE = 'AI 응답이 지연되고 있습니다. 잠시 후 다시 시도하거나 다른 모델을 선택해 주세요.';

const MODEL_LABELS = {
  'gpt-5': 'GPT-5',
  'gpt-5-mini': 'GPT-5 mini',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-3-5-haiku-latest': 'Claude 3.5 Haiku',
};

const formatModelLabel = (value) => {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  const mapped = MODEL_LABELS[value] || MODEL_LABELS[normalized];
  if (mapped) {
    return mapped;
  }
  if (normalized.startsWith('gpt-5')) return 'GPT-5';
  if (normalized.includes('gemini')) return 'Gemini';
  if (normalized.includes('claude')) return 'Claude';
  return value;
};

const formatProviderLabel = (value) => {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'openai') return 'GPT';
  if (normalized === 'gemini') return 'Gemini';
  if (normalized === 'claude') return 'Claude';
  return value.replace(/^[a-z]/, (char) => char.toUpperCase());
};

const withTimeout = (promise, timeoutMs = 0, timeoutMessage = TIMEOUT_MESSAGE, abortController) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || typeof window === 'undefined') {
    return promise;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (abortController && typeof abortController.abort === 'function' && !abortController.signal?.aborted) {
        abortController.abort();
      }
      const error = new Error(timeoutMessage);
      error.code = 'AGENT_TIMEOUT';
      settled = true;
      reject(error);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) {
          return;
        }
        window.clearTimeout(timer);
        settled = true;
        resolve(value);
      })
      .catch((error) => {
        if (settled) {
          return;
        }
        window.clearTimeout(timer);
        settled = true;
        reject(error);
      });
  });
};

const LibraryQAPanel = ({
  selectedNode,
  selectedTree,
  onNodeUpdate,
  onNewNodeCreated,
  onNodeSelect,
  onClose,
  isLibraryIntroActive = false,
  onLibraryIntroComplete,
}) => {
  const { user } = useSupabaseAuth();
  const { theme } = useTheme();
  const {
    provider: selectedProvider,
    model: selectedModel,
    temperature: preferredTemperature,
    modelOptions,
    setModel: setSelectedModel,
  } = useAIModelPreference();
  const [messages, setMessages] = useState([]);
  const [composerValue, setComposerValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [globalProcessing, setGlobalProcessing] = useState(false);
  const processingMapRef = useRef(new Map());
  const [processingVersion, setProcessingVersion] = useState(0);
  const [error, setError] = useState(null);
  const [isMultiQuestionMode, setIsMultiQuestionMode] = useState(() => {
    console.log('🎬 [상태 초기화] isMultiQuestionMode 초기값: false');
    return false;
  });
  const [attachments, setAttachments] = useState([]);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [lastAutoSelection, setLastAutoSelection] = useState(null);
  const [slowResponseNotice, setSlowResponseNotice] = useState(null);
  const [spinningMap, setSpinningMap] = useState({});

  const messageContainerRef = useRef(null);
  const highlighterRef = useRef(null);
  const highlightHandlersRef = useRef({ create: null, remove: null });
  const highlightStoreRef = useRef(new HighlightSelectionStore());
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [highlightNotice, setHighlightNotice] = useState(null);
  const latestSelectedNodeRef = useRef(selectedNode);
  const requestAbortControllerRef = useRef(null);
  const streamingStateRef = useRef({ assistantId: null, hasStreamed: false });
  const typingTimersRef = useRef([]);

  const clearTypingTimers = useCallback(() => {
    typingTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    typingTimersRef.current = [];
  }, []);

  const shouldAnimateTyping = useCallback((answerText) => {
    if (streamingStateRef.current.hasStreamed) {
      return false;
    }
    const trimmed = typeof answerText === 'string' ? answerText.trim() : '';
    if (!trimmed) {
      return false;
    }
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount === 0 || wordCount > MAX_TYPING_WORD_COUNT) {
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    latestSelectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => () => clearTypingTimers(), [clearTypingTimers]);

  const handleRegisterMessageContainer = useCallback((element) => {
    messageContainerRef.current = element;
    console.debug('[LibraryQAPanel] message container registered', element);
  }, []);

  const handleCopyMessage = useCallback((message) => {
    if (!message?.text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message.text).catch(() => undefined);
    }
  }, []);


  const resolveProcessingKey = useCallback((nodeId, introActive, treeId) => {
    if (nodeId) {
      return `node:${nodeId}`;
    }
    if (introActive) {
      return '__intro__';
    }
    if (treeId) {
      return `tree:${treeId}`;
    }
    return '__panel__';
  }, []);

  const startNodeProcessing = useCallback((key) => {
    if (!key) {
      return;
    }
    const map = processingMapRef.current;
    const nextCount = (map.get(key) || 0) + 1;
    map.set(key, nextCount);
    setProcessingVersion((prev) => prev + 1);
  }, []);

  const stopNodeProcessing = useCallback((key) => {
    if (!key) {
      return;
    }
    const map = processingMapRef.current;
    if (!map.has(key)) {
      return;
    }
    const nextCount = map.get(key) - 1;
    if (nextCount <= 0) {
      map.delete(key);
    } else {
      map.set(key, nextCount);
    }
    setProcessingVersion((prev) => prev + 1);
  }, []);

  const activeProcessingKey = useMemo(
    () => resolveProcessingKey(selectedNode?.id, isLibraryIntroActive, selectedTree?.id),
    [resolveProcessingKey, selectedNode?.id, selectedTree?.id, isLibraryIntroActive],
  );

  const isProcessing = useMemo(
    () => {
      if (globalProcessing) {
        return true;
      }
      if (!activeProcessingKey) {
        return false;
      }
      const count = processingMapRef.current.get(activeProcessingKey);
      return typeof count === 'number' && count > 0;
    },
    [activeProcessingKey, globalProcessing, processingVersion],
  );

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
        instance.removeAll();
      } catch (error) {
        console.warn('🔧 removeAll 실패:', error);
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

  const handleAttachmentButtonClick = useCallback(() => {
    fileInputRef.current?.click?.();
  }, []);

  const handleAttachmentFiles = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList).filter((file) => file.type?.startsWith('image/'));
    if (!files.length) {
      setHighlightNotice({ type: 'warning', message: '이미지 파일만 첨부할 수 있습니다.' });
      return;
    }

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const baseTimestamp = Date.now();
    setIsAttachmentUploading(true);
    try {
      const nextAttachments = await Promise.all(
        files.map(async (file, index) => {
          const dataUrl = await readFileAsDataUrl(file);
          return {
            id: `upload-${baseTimestamp}-${index}-${Math.random().toString(16).slice(2, 8)}`,
            type: 'image',
            mimeType: file.type,
            dataUrl,
            name: file.name,
            label: file.name,
            size: file.size,
            createdAt: baseTimestamp,
          };
        }),
      );
      setAttachments((prev) => [...prev, ...nextAttachments]);
    } catch (uploadError) {
      console.error('이미지 첨부 중 오류 발생:', uploadError);
      setHighlightNotice({ type: 'warning', message: '이미지 첨부에 실패했습니다.' });
    } finally {
      setIsAttachmentUploading(false);
    }
  }, []);

  const {
    isDragOver: isAttachmentDragOver,
    eventHandlers: attachmentDropHandlers,
  } = useFileDropZone({
    onDropFiles: handleAttachmentFiles,
    isDisabled: isAttachmentUploading || isProcessing,
  });

  const autoSelectionPreview = useMemo(() => {
    if (selectedProvider !== 'auto') {
      return null;
    }
    return selectAutoModel({
      question: composerValue,
      attachments,
    });
  }, [attachments, composerValue, selectedProvider]);

  useEffect(() => {
    if (!isProcessing) {
      setSlowResponseNotice(null);
      return undefined;
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    const timers = [];
    timers.push(
      window.setTimeout(
        () => setSlowResponseNotice(SLOW_RESPONSE_FIRST_HINT),
        LONG_RESPONSE_NOTICE_DELAY_MS,
      ),
    );

    if (LONG_RESPONSE_REMINDER_DELAY_MS > LONG_RESPONSE_NOTICE_DELAY_MS) {
      timers.push(
        window.setTimeout(
          () => setSlowResponseNotice(SLOW_RESPONSE_SECOND_HINT),
          LONG_RESPONSE_REMINDER_DELAY_MS,
        ),
      );
    }

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [isProcessing]);

  const handleAttachmentRemove = useCallback((attachmentId) => {
    setAttachments((prev) => prev.filter((item) => item && item.id !== attachmentId));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const isDarkTheme = theme === 'dark';
  
  const chatPanelStyles = useMemo(() => ({
    ...DEFAULT_CHAT_PANEL_STYLES,
    background: isDarkTheme ? 'rgba(45, 45, 45, 0.85)' : DEFAULT_CHAT_PANEL_STYLES.background,
    borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : DEFAULT_CHAT_PANEL_STYLES.borderColor,
    textColor: isDarkTheme ? 'rgba(255, 255, 255, 0.92)' : DEFAULT_CHAT_PANEL_STYLES.textColor,
    subtleTextColor: isDarkTheme ? 'rgba(255, 255, 255, 0.7)' : DEFAULT_CHAT_PANEL_STYLES.subtleTextColor,
  }), [isDarkTheme]);

  const panelStyle = useMemo(() => {
    const baseStyle = {
      fontFamily: '"Spoqa Han Sans Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      zIndex: 1001,
      color: chatPanelStyles.textColor,
    };

    if (isLibraryIntroActive) {
      return {
        ...baseStyle,
        background: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        borderStyle: 'none',
      };
    }

    return {
      ...baseStyle,
      background: chatPanelStyles.background,
    };
  }, [isLibraryIntroActive, chatPanelStyles]);
  
  const subtleTextColor = chatPanelStyles.subtleTextColor;

  const containerClassName = useMemo(() => cn(
    'relative flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden p-6 backdrop-blur-3xl',
    isLibraryIntroActive && 'justify-center gap-6 rounded-none border-none bg-transparent p-0 backdrop-blur-0 shadow-none'
  ), [isLibraryIntroActive]);

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
        question: '',
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
        treeId: selectedTree.id,
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
  }, [disableHighlightMode, enableHighlightMode, isMultiQuestionMode]);

  const questionServiceRef = useRef(new QuestionService());
  const messagesEndRef = useRef(null);

  const isApiAvailable = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const ua = window.navigator?.userAgent || '';
    const hasElectron = /Electron/i.test(ua) || Boolean(window.process?.versions?.electron);
    const hasFallbackKey = Boolean(process.env.REACT_APP_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    const hasHttpBridge = isAgentHttpBridgeAvailable();
    return hasElectron || hasFallbackKey || hasHttpBridge;
  }, []);

  // 선택된 노드가 변경될 때 메시지 초기화
  useEffect(() => {
    console.log('🔄 [useEffect] 노드 변경 감지 - selectedNode 변경됨');
    
    // 다중 질문 모드가 켜져있으면 끄기
    if (isMultiQuestionMode) {
      console.log('🔄 노드 변경으로 다중 질문 모드 종료');
      disableHighlightMode();
      setIsMultiQuestionMode(false);
    }
    
    if (selectedNode) {
      const initialMessages = Array.isArray(selectedNode.conversation)
        ? selectedNode.conversation.map((msg) => {
          const fallbackText = typeof msg.text === 'string' && msg.text.trim()
            ? msg.text
            : typeof msg.content === 'string'
              ? msg.content
              : '';
          return {
            ...msg,
            text: fallbackText,
            content: msg.content || fallbackText,
          };
        })
        : [];
      setMessages(initialMessages);
    } else {
      setMessages([]);
    }
    setComposerValue('');
    setError(null);
    highlightStoreRef.current.clear();
    setHighlightNotice(null);
  }, [selectedNode, disableHighlightMode]); // isMultiQuestionMode 제거!

  // 메시지가 변경될 때 스크롤을 맨 아래로
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 노드가 선택되거나 변경되면 입력창에 포커스 (선택 중이 아닐 때만)
  useEffect(() => {
    if (selectedNode && textareaRef.current) {
      const timer = setTimeout(() => {
        if (!textareaRef.current || isProcessing || isComposing) {
          return;
        }
        if (isEditableTitleActive()) {
          return;
        }
        // 사용자가 텍스트를 선택 중이면 포커스하지 않음
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          console.log('⚠️ 텍스트 선택 중이므로 포커스 스킵');
          return;
        }
        textareaRef.current.focus();
        const length = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(length, length);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isComposing, isEditableTitleActive, isProcessing, selectedNode]);

  // 상태 변경 감지
  useEffect(() => {
    console.log('📊 [상태 변경] isMultiQuestionMode:', isMultiQuestionMode);
  }, [isMultiQuestionMode]);

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
    const timeoutId = window.setTimeout(() => setHighlightNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [highlightNotice, isMultiQuestionMode]);

  // LLM API 호출
  const invokeAgent = useCallback(async (channel, payload = {}) => {
    const {
      provider: providerOverride,
      model: modelOverride,
      abortSignal,
      onStreamChunk,
      ...restPayload
    } = payload;

    const effectiveProvider = providerOverride || selectedProvider;
    const effectiveModel = modelOverride || selectedModel;

    const requestPayload = {
      ...restPayload,
      provider: effectiveProvider,
    };

    if (effectiveProvider !== 'auto' && !requestPayload.model) {
      requestPayload.model = effectiveModel;
    }

    if (restPayload.autoSelectionHint && effectiveProvider === 'auto') {
      requestPayload.autoSelectionHint = restPayload.autoSelectionHint;
    }

    if (abortSignal) {
      requestPayload.abortSignal = abortSignal;
    }

    if (typeof onStreamChunk === 'function') {
      requestPayload.onStreamChunk = onStreamChunk;
    }

    const hasPreferredTemperature = typeof preferredTemperature === 'number' && Number.isFinite(preferredTemperature);
    if ((!Number.isFinite(requestPayload.temperature)) && hasPreferredTemperature) {
      requestPayload.temperature = preferredTemperature;
    }

    if (channel === 'askRoot') return AgentClient.askRoot(requestPayload);
    if (channel === 'askChild') return AgentClient.askChild(requestPayload);
    throw new Error(`지원하지 않는 채널: ${channel}`);
  }, [preferredTemperature, selectedModel, selectedProvider]);

  // 답변 생성 처리(타이핑 애니메이션 포함)
  const animateAssistantResponse = useCallback((assistantId, answerText, context = {}) => {
    clearTypingTimers();

    let finalModelInfo = null;

    const applyFinalContext = (message, finalText, status) => {
      const baseInfo = {
        ...(message.modelInfo || {}),
        ...(context.autoSelection || {}),
      };

      if (context.provider) {
        baseInfo.provider = context.provider;
      }
      if (context.model) {
        baseInfo.model = context.model;
      }
      if (context.autoSelection?.explanation) {
        baseInfo.explanation = context.autoSelection.explanation;
      }

      const next = {
        ...message,
        text: finalText,
        status,
      };

      if (Object.keys(baseInfo).length) {
        next.modelInfo = baseInfo;
      }
      finalModelInfo = next.modelInfo || finalModelInfo;
      if (context.reasoning) {
        next.reasoning = context.reasoning;
      }
      if (context.usage) {
        next.usage = context.usage;
      }
      if (context.latencyMs !== undefined) {
        next.latencyMs = context.latencyMs;
      }
      if (context.citations) {
        next.citations = context.citations;
      }
      return next;
    };
    const safeAnswer = typeof answerText === 'string' ? answerText : '';
    const shouldAnimate = shouldAnimateTyping(safeAnswer);

    if (!shouldAnimate) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? applyFinalContext(msg, safeAnswer, 'complete')
            : msg,
        ),
      );

      if (context.autoSelection || context.model || context.provider) {
        setLastAutoSelection(context.autoSelection || finalModelInfo || {
          provider: context.provider,
          model: context.model,
          explanation: context.autoSelection?.explanation,
        });
      }
      return;
    }

    const words = safeAnswer.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? applyFinalContext(msg, '', 'complete')
            : msg,
        ),
      );
      return;
    }

    const maxSteps = Math.max(1, Math.floor(MAX_TYPING_DURATION_MS / TYPING_INTERVAL_MS));
    const chunkSize = Math.max(1, Math.ceil(words.length / maxSteps));
    let currentText = '';
    let wordIndex = 0;

    if (typeof window === 'undefined') {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? applyFinalContext(msg, safeAnswer, 'complete')
            : msg,
        ),
      );
      if (context.autoSelection || context.model || context.provider) {
        setLastAutoSelection(context.autoSelection || finalModelInfo || {
          provider: context.provider,
          model: context.model,
          explanation: context.autoSelection?.explanation,
        });
      }
      return;
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, status: 'typing' }
          : msg,
      ),
    );

    const typeNextChunk = () => {
      const chunkWords = words.slice(wordIndex, wordIndex + chunkSize);
      const chunkText = chunkWords.join(' ');
      currentText = currentText ? `${currentText} ${chunkText}` : chunkText;
      wordIndex += chunkSize;

      const isComplete = wordIndex >= words.length;

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== assistantId) {
            return msg;
          }
          if (isComplete) {
            return applyFinalContext(msg, currentText, 'complete');
          }
          return {
            ...msg,
            text: currentText,
            status: 'typing',
          };
        }),
      );

      if (isComplete) {
        if (context.autoSelection || context.model || context.provider) {
          setLastAutoSelection(context.autoSelection || finalModelInfo || {
            provider: context.provider,
            model: context.model,
            explanation: context.autoSelection?.explanation,
          });
        }
        return;
      }

      const timerId = window.setTimeout(typeNextChunk, TYPING_INTERVAL_MS);
      typingTimersRef.current.push(timerId);
    };

    const timerId = window.setTimeout(typeNextChunk, TYPING_INTERVAL_MS);
    typingTimersRef.current.push(timerId);
  }, [clearTypingTimers, setLastAutoSelection, shouldAnimateTyping]);

  const updateAssistantMessage = useCallback((assistantId, transformer) => {
    if (typeof transformer !== 'function') {
      return;
    }
    setMessages((prev) =>
      prev.map((message) => (message.id === assistantId ? transformer(message) : message)),
    );
  }, []);

  const handleStreamingChunk = useCallback((assistantId, chunk) => {
    if (!assistantId || !chunk) {
      return;
    }

    if (!streamingStateRef.current.hasStreamed) {
      clearTypingTimers();
    }

    const {
      text = '',
      delta = '',
      isFinal = false,
      provider,
      model,
      autoSelection,
      usage,
      latencyMs,
      citations,
      reasoning,
    } = chunk;

    streamingStateRef.current = {
      assistantId,
      hasStreamed: true,
      finalChunk: isFinal ? chunk : streamingStateRef.current.finalChunk,
    };

    updateAssistantMessage(assistantId, (message) => {
      const next = {
        ...message,
        text,
        status: isFinal ? 'complete' : 'streaming',
      };

      const baseInfo = {
        ...(message.modelInfo || {}),
        ...(autoSelection || {}),
      };

      if (provider) {
        baseInfo.provider = provider;
      }
      if (model) {
        baseInfo.model = model;
      }
      if (autoSelection?.explanation) {
        baseInfo.explanation = autoSelection.explanation;
      }

      if (Object.keys(baseInfo).length > 0) {
        next.modelInfo = baseInfo;
      }

      if (isFinal) {
        if (usage) {
          next.usage = usage;
        }
        if (latencyMs !== undefined) {
          next.latencyMs = latencyMs;
        }
        if (citations) {
          next.citations = citations;
        }
        if (reasoning) {
          next.reasoning = reasoning;
        }
      }

      if (!isFinal && message.usage) {
        next.usage = message.usage;
      }

      return next;
    });

    if (isFinal && (autoSelection || provider || model)) {
      setLastAutoSelection(autoSelection || {
        provider,
        model,
        explanation: autoSelection?.explanation,
      });
    }

    if (delta && process.env.NODE_ENV === 'development') {
      console.debug('[LibraryQAPanel] streaming delta', { assistantId, delta });
    }
  }, [clearTypingTimers, setLastAutoSelection, updateAssistantMessage]);

  const pickAnswerText = useCallback((payload) => {
    if (!payload || typeof payload !== 'object') {
      return '';
    }
    const candidates = [
      payload.answer,
      payload.data?.answer,
      payload.result?.answer,
      payload.message?.answer,
    ];
    const resolved = candidates.find((text) => typeof text === 'string' && text.trim().length > 0);
    return resolved ? resolved.trim() : '';
  }, []);

  const captureStreamingSnapshot = useCallback((assistantId) => {
    const snapshot = streamingStateRef.current;
    if (!snapshot || snapshot.assistantId !== assistantId || !snapshot.hasStreamed) {
      return { hasStreamed: false, finalChunk: null };
    }
    return {
      hasStreamed: true,
      finalChunk: snapshot.finalChunk || null,
    };
  }, []);

  const resetStreamingState = useCallback(() => {
    streamingStateRef.current = { assistantId: null, hasStreamed: false, finalChunk: null };
  }, []);

  useEffect(() => {
    return () => {
      requestAbortControllerRef.current?.abort();
      resetStreamingState();
    };
  }, [resetStreamingState]);

  const executeAgentCall = useCallback(async (channel, assistantId, payload = {}) => {
    requestAbortControllerRef.current?.abort();
    const controller = new AbortController();
    requestAbortControllerRef.current = controller;
    streamingStateRef.current = { assistantId, hasStreamed: false, finalChunk: null };

    const invocationPayload = {
      ...payload,
      abortSignal: controller.signal,
      onStreamChunk: (chunk) => handleStreamingChunk(assistantId, chunk),
    };

    try {
      const response = await withTimeout(
        invokeAgent(channel, invocationPayload),
        AGENT_RESPONSE_TIMEOUT_MS,
        TIMEOUT_MESSAGE,
        controller,
      );
      return response;
    } finally {
      if (requestAbortControllerRef.current === controller) {
        requestAbortControllerRef.current = null;
      }
    }
  }, [handleStreamingChunk, invokeAgent]);

  // 질문 전송 처리
  const handleSendMessage = useCallback(async (overrideQuestion, options = {}) => {
    const {
      attachmentsOverride,
      providerOverride,
      modelOverride,
      retryMessage,
    } = options;

    const isOverride = typeof overrideQuestion === 'string';
    const reuseCurrentNode = Boolean(options.reuseCurrentNode || isOverride);
    const baseQuestion = isOverride ? overrideQuestion : composerValue;
    const question = (typeof baseQuestion === 'string' ? baseQuestion : '').trim();

    const highlightTexts = !isOverride && isMultiQuestionMode
      ? highlightStoreRef.current.getTexts()
      : [];

    const attachmentSource = attachmentsOverride !== undefined ? attachmentsOverride : attachments;
    const attachmentSnapshot = (Array.isArray(attachmentSource) ? attachmentSource : [])
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => {
        const dataUrlRaw = typeof item.dataUrl === 'string'
          ? item.dataUrl
          : typeof item.url === 'string'
            ? item.url
            : undefined;
        const dataUrl = typeof dataUrlRaw === 'string' ? dataUrlRaw.trim() : '';
        return {
          ...item,
          id: item.id || `override-attachment-${index}`,
          dataUrl,
        };
      })
      .filter((item) => typeof item.dataUrl === 'string' && item.dataUrl);

    const hasAttachmentSnapshot = attachmentSnapshot.length > 0;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const isRetryFlow = Boolean(reuseCurrentNode && retryMessage && lastUser);

    if (!isOverride) {
      console.log('📨 [handleSendMessage] 호출됨');
      console.log('다중 질문 모드:', isMultiQuestionMode);
      console.log('하이라이트된 텍스트 개수:', highlightTexts.length);
      if (highlightTexts.length) {
        console.log('하이라이트된 텍스트:', highlightTexts);
      }
      console.log('입력된 질문:', question);
    }

    if (!isOverride && highlightTexts.length > 0 && hasAttachmentSnapshot) {
      setHighlightNotice({ type: 'warning', message: '다중 질문 모드에서는 이미지 첨부를 사용할 수 없습니다.' });
      return;
    }

    if (!isOverride && highlightTexts.length > 0 && !question) {
      console.log('✅ 플레이스홀더 생성 시작...');
      setComposerValue('');
      setSlowResponseNotice(null);
      setGlobalProcessing(true);
      try {
        await createPlaceholderNodes(highlightTexts);
        console.log('✅ 플레이스홀더 생성 완료');
        setHighlightNotice({ type: 'success', message: `${highlightTexts.length}개의 플레이스홀더를 생성했습니다.` });
      } catch (placeholderError) {
        console.error('❌ 플레이스홀더 생성 실패:', placeholderError);
        const message = placeholderError.message || '다중 질문 플레이스홀더 생성 중 오류가 발생했습니다.';
        setError(message);
        setHighlightNotice({ type: 'warning', message });
      } finally {
        setGlobalProcessing(false);
        disableHighlightMode();
        setIsMultiQuestionMode(false);
        highlightStoreRef.current.clear();
      }
      return;
    }

    if ((question.length === 0 && !hasAttachmentSnapshot) || isProcessing || !selectedTree || !user) {
      return;
    }

    if (!selectedNode && !isLibraryIntroActive) {
      return;
    }

    if (!isApiAvailable) {
      setError('AI 응답을 사용할 수 없습니다. 환경 설정을 확인한 뒤 다시 시도해주세요.');
      return;
    }

    if (!isOverride) {
      setComposerValue('');
      clearAttachments();
    }
    setError(null);
    setSlowResponseNotice(null);

    const originalProcessingKey = resolveProcessingKey(selectedNode?.id, isLibraryIntroActive, selectedTree?.id);
    let currentProcessingKey = originalProcessingKey;
    const switchProcessingKey = (nextKey) => {
      if (!nextKey || nextKey === currentProcessingKey) {
        return;
      }
      // 이전 키를 중단하지 않음 - finally에서 한 번에 정리
      currentProcessingKey = nextKey;
      startNodeProcessing(currentProcessingKey);
    };

    startNodeProcessing(originalProcessingKey);

    const timestamp = Date.now();

    const sanitizedAttachments = attachmentSnapshot.map((item, index) => ({
      id: item.id || `attachment-${timestamp}-${index}`,
      type: item.type || 'image',
      mimeType: item.mimeType,
      dataUrl: item.dataUrl,
      name: item.name,
      label: item.label || item.name || `첨부 이미지 ${index + 1}`,
      size: item.size,
      createdAt: item.createdAt || timestamp,
    }));
    const hasAttachments = sanitizedAttachments.length > 0;

    const effectiveProvider = providerOverride || selectedProvider;
    const effectiveModelBase = providerOverride
      ? resolveModelForProvider(providerOverride)
      : selectedModel;
    const effectiveModel = modelOverride || effectiveModelBase;

    const activeAutoSelection = effectiveProvider === 'auto'
      ? selectAutoModel({
        question,
        attachments: sanitizedAttachments,
      })
      : null;

    const pendingModelInfo = effectiveProvider === 'auto'
      ? activeAutoSelection
      : {
        provider: effectiveProvider,
        model: effectiveModel,
      };

    const previousMessages = Array.isArray(messages) ? messages : [];
    const isPlaceholderNode = selectedNode
      ? selectedNode.status === 'placeholder' || Boolean(selectedNode.placeholder)
      : false;
    const hasUserConversation = previousMessages.some((msg) => msg.role === 'user');
    const useExistingNode = Boolean(selectedNode)
      && (reuseCurrentNode || (isPlaceholderNode && !hasUserConversation));

    let userMessage;
    let assistantMessage;
    let assistantId;

    if (isRetryFlow) {
      userMessage = { ...lastUser };
      assistantMessage = {
        ...retryMessage,
        text: '',
        status: 'pending',
        modelInfo: pendingModelInfo || retryMessage.modelInfo,
        timestamp: Date.now(),
      };
      assistantId = assistantMessage.id;
    } else {
      const userId = `${timestamp}-user`;
      assistantId = `${timestamp}-assistant`;
      userMessage = {
        id: userId,
        role: 'user',
        content: question,
        text: question,
        timestamp,
        attachments: hasAttachments ? sanitizedAttachments : undefined,
      };

      assistantMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        status: 'pending',
        modelInfo: pendingModelInfo || undefined,
        timestamp: timestamp + 1,
      };

      setMessages((prev) => [
        ...prev,
        userMessage,
        assistantMessage,
      ]);
    }

    if (pendingModelInfo) {
      setLastAutoSelection(pendingModelInfo);
    }

    const mapToOpenAIMessage = (msg) => {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      const textType = role === 'assistant' ? 'output_text' : 'input_text';
      const imageType = role === 'assistant' ? 'output_image' : 'input_image';

      if (Array.isArray(msg.content)) {
        const normalizedContent = msg.content
          .map((item) => {
            if (!item || typeof item !== 'object') {
              return null;
            }
            if (item.type === 'input_text' || item.type === 'text') {
              const text = typeof item.text === 'string' ? item.text.trim() : '';
              return text ? { type: textType, text } : null;
            }
            if (item.type === 'input_image' || item.type === 'image_url' || item.type === 'image') {
              const urlCandidate = typeof item.image_url === 'string'
                ? item.image_url
                : typeof item.image_url?.url === 'string'
                  ? item.image_url.url
                  : typeof item.url === 'string'
                    ? item.url
                    : typeof item.dataUrl === 'string'
                      ? item.dataUrl
                      : '';
              const url = urlCandidate.trim();
              return url ? { type: imageType, image_url: url } : null;
            }
            return null;
          })
          .filter(Boolean);
        if (normalizedContent.length) {
          return { role, content: normalizedContent };
        }
      }

      const textCandidate = typeof msg.content === 'string'
        ? msg.content
        : typeof msg.text === 'string'
          ? msg.text
          : '';
      const trimmed = textCandidate.trim();
      const contentParts = [];

      if (trimmed) {
        contentParts.push({ type: textType, text: trimmed });
      }

      const messageAttachments = Array.isArray(msg.attachments)
        ? msg.attachments.filter((item) => item && typeof item === 'object' && typeof item.dataUrl === 'string' && item.dataUrl)
        : [];

      messageAttachments.forEach((item) => {
        contentParts.push({
          type: imageType,
          image_url: item.dataUrl,
        });
      });

      if (contentParts.length === 0) {
        return null;
      }

      if (contentParts.length === 1 && contentParts[0].type === textType) {
        return { role, content: contentParts[0].text };
      }

      return { role, content: contentParts };
    };

    let pendingMessages;
    if (isRetryFlow) {
      pendingMessages = previousMessages.map((msg) =>
        msg.id === assistantMessage.id
          ? assistantMessage
          : msg,
      );
      setMessages(pendingMessages);
    } else if (useExistingNode && selectedNode) {
      pendingMessages = [...previousMessages, userMessage, assistantMessage];
      setMessages(pendingMessages);
    } else {
      pendingMessages = [userMessage, assistantMessage];
      setMessages(pendingMessages);
    }

    // 조상 노드의 대화 문맥 수집
    const allNodes = selectedTree?.treeData?.nodes || [];
    const parentByChild = new Map();
    allNodes.forEach((node) => {
      if (node.parentId) {
        parentByChild.set(node.id, node.parentId);
      }
    });

    const getConversation = (nodeId) => {
      const node = allNodes.find((n) => n.id === nodeId);
      return node?.conversation || [];
    };

    const ancestorMessages = selectedNode?.id
      ? collectAncestorConversationMessages({
          nodeId: selectedNode.id,
          parentByChild,
          getConversation,
          maxMessages: 12,
        })
      : [];

    console.log('[LibraryQAPanel] 조상 문맥 메시지 수집:', {
      selectedNodeId: selectedNode?.id,
      ancestorMessagesCount: ancestorMessages.length,
      ancestorMessages
    });

    const requestMessages = [
      ...ancestorMessages,
      ...pendingMessages
        .filter((msg) => msg.id !== assistantId)
        .map(mapToOpenAIMessage)
        .filter(Boolean),
    ];

    if (requestMessages.length === 0 && question) {
      requestMessages.push({ role: 'user', content: question });
    }

    console.log('[LibraryQAPanel] 최종 요청 메시지:', {
      ancestorCount: ancestorMessages.length,
      currentNodeCount: pendingMessages.length - 1,
      totalCount: requestMessages.length,
      requestMessages
    });

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[LibraryQAPanel] send question', {
        nodeId: selectedNode?.id,
        status: selectedNode?.status,
        hasPlaceholderMeta: Boolean(selectedNode?.placeholder),
        isPlaceholderNode,
        hasUserConversation,
        previousMessagesCount: previousMessages.length,
      });
    }

    if (useExistingNode && selectedNode) {
    const pendingNode = {
      ...selectedNode,
      question: selectedNode.question || question,
      conversation: pendingMessages,
      status: 'asking',
      updatedAt: timestamp,
      answer: '',
    };

      if (hasAttachments) {
        pendingNode.attachments = sanitizedAttachments;
      }
      if (pendingModelInfo) {
        pendingNode.modelInfo = pendingModelInfo;
      }

    onNodeUpdate?.(pendingNode);
    const pendingNodeId = pendingNode.id;
    const maintainFocusDuringRequest = latestSelectedNodeRef.current?.id === pendingNodeId;
    if (maintainFocusDuringRequest) {
      onNodeSelect?.(pendingNode);
    }

      try {
        const response = await executeAgentCall('askRoot', assistantId, {
          messages: requestMessages,
          attachments: hasAttachments ? sanitizedAttachments : undefined,
          autoSelectionHint: effectiveProvider === 'auto' ? activeAutoSelection : undefined,
          question,
          provider: effectiveProvider,
          model: effectiveModel,
        });

        if (response?.success === false && response?.error?.message) {
          throw new Error(response.error.message);
        }

        const streamingSnapshot = captureStreamingSnapshot(assistantId);
        const finalChunk = streamingSnapshot.finalChunk;
        const answerText = finalChunk?.text?.trim()
          ? finalChunk.text.trim()
          : pickAnswerText(response);

        if (!answerText) {
          throw new Error('답변을 받지 못했습니다.');
        }

        const providerFromResponse = finalChunk?.provider || response?.provider;
        const modelFromResponse = finalChunk?.model || response?.model;
        const autoSelectionFromResponse = finalChunk?.autoSelection
          || response?.autoSelection
          || activeAutoSelection;
        const usageFromResponse = finalChunk?.usage || response?.usage;
        const latencyFromResponse = finalChunk?.latencyMs ?? response?.latencyMs;
        const citationsFromResponse = finalChunk?.citations || response?.citations;
        const reasoningFromResponse = finalChunk?.reasoning || response?.reasoning;

        if (!streamingSnapshot.hasStreamed) {
          animateAssistantResponse(assistantId, answerText, {
            provider: providerFromResponse,
            model: modelFromResponse,
            autoSelection: autoSelectionFromResponse,
            usage: usageFromResponse,
            latencyMs: latencyFromResponse,
            citations: citationsFromResponse,
            reasoning: reasoningFromResponse,
          });
        } else {
          updateAssistantMessage(assistantId, (message) => {
            const baseInfo = {
              ...(message.modelInfo || {}),
              ...(autoSelectionFromResponse || {}),
            };
            if (providerFromResponse) {
              baseInfo.provider = providerFromResponse;
            }
            if (modelFromResponse) {
              baseInfo.model = modelFromResponse;
            }
            if (autoSelectionFromResponse?.explanation) {
              baseInfo.explanation = autoSelectionFromResponse.explanation;
            }
            const next = {
              ...message,
              text: answerText,
              status: 'complete',
            };
            if (Object.keys(baseInfo).length > 0) {
              next.modelInfo = baseInfo;
            }
            if (usageFromResponse) {
              next.usage = usageFromResponse;
            }
            if (latencyFromResponse !== undefined) {
              next.latencyMs = latencyFromResponse;
            }
            if (citationsFromResponse) {
              next.citations = citationsFromResponse;
            }
            if (reasoningFromResponse) {
              next.reasoning = reasoningFromResponse;
            }
            return next;
          });
          if (autoSelectionFromResponse || providerFromResponse || modelFromResponse) {
            setLastAutoSelection(autoSelectionFromResponse || {
              provider: providerFromResponse,
              model: modelFromResponse,
              explanation: autoSelectionFromResponse?.explanation,
            });
          }
        }

        const finalModelInfo = autoSelectionFromResponse || pendingModelInfo;
        const updatedMessages = pendingMessages.map((msg) => {
          if (msg.id !== assistantId) {
            return msg;
          }
          const mergedModel = finalModelInfo
            ? {
              ...(msg.modelInfo || {}),
              ...finalModelInfo,
              provider: providerFromResponse || finalModelInfo.provider,
              model: modelFromResponse || finalModelInfo.model,
              explanation: finalModelInfo.explanation || msg.modelInfo?.explanation,
            }
            : msg.modelInfo;
          const next = {
            ...msg,
            text: answerText,
            status: 'complete',
          };
          if (mergedModel) {
            next.modelInfo = mergedModel;
          }
          if (usageFromResponse) {
            next.usage = usageFromResponse;
          }
          if (latencyFromResponse !== undefined) {
            next.latencyMs = latencyFromResponse;
          }
          if (citationsFromResponse) {
            next.citations = citationsFromResponse;
          }
          if (reasoningFromResponse) {
            next.reasoning = reasoningFromResponse;
          }
          return next;
        });

        const answeredNode = {
          ...pendingNode,
          conversation: updatedMessages,
          answer: answerText,
          status: 'answered',
          updatedAt: Date.now(),
        };
        if (finalModelInfo) {
          answeredNode.modelInfo = finalModelInfo;
        }
        if (reasoningFromResponse) {
          answeredNode.reasoning = reasoningFromResponse;
        }
        if (usageFromResponse) {
          answeredNode.usage = usageFromResponse;
        }

        await upsertTreeNodes({
          treeId: selectedTree.id,
          nodes: [answeredNode],
          userId: user.id,
        });

        onNodeUpdate?.(answeredNode);
        const shouldRestoreFocus = latestSelectedNodeRef.current?.id === pendingNodeId;
        if (shouldRestoreFocus) {
          onNodeSelect?.(answeredNode);
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          console.info('[LibraryQAPanel] LLM 요청이 취소되었습니다.', error);
          return;
        }
        console.error('질문 처리 실패:', error);
        const errorMessage = error?.code === 'AGENT_TIMEOUT'
          ? TIMEOUT_MESSAGE
          : error?.message || '질문 처리 중 오류가 발생했습니다.';
        setError(errorMessage);
        if (!isOverride) {
          setComposerValue(question);
          if (hasAttachments) {
            setAttachments(sanitizedAttachments);
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, text: `오류: ${errorMessage}`, status: 'error' }
              : msg,
          ),
        );
      } finally {
        resetStreamingState();
        stopNodeProcessing(originalProcessingKey);
        if (currentProcessingKey !== originalProcessingKey) {
          stopNodeProcessing(currentProcessingKey);
        }
      }
      return;
    }

    if (isRetryFlow && !selectedNode) {
      try {
        const response = await executeAgentCall('askRoot', assistantId, {
          messages: requestMessages,
          attachments: hasAttachments ? sanitizedAttachments : undefined,
          autoSelectionHint: effectiveProvider === 'auto' ? activeAutoSelection : undefined,
          question,
          provider: effectiveProvider,
          model: effectiveModel,
        });

        if (response?.success === false && response?.error?.message) {
          throw new Error(response.error.message);
        }

        const streamingSnapshot = captureStreamingSnapshot(assistantId);
        const finalChunk = streamingSnapshot.finalChunk;
        const answerText = finalChunk?.text?.trim()
          ? finalChunk.text.trim()
          : pickAnswerText(response);

        if (!answerText) {
          throw new Error('답변을 받지 못했습니다.');
        }

        const providerFromResponse = finalChunk?.provider || response?.provider;
        const modelFromResponse = finalChunk?.model || response?.model;
        const autoSelectionFromResponse = finalChunk?.autoSelection
          || response?.autoSelection
          || activeAutoSelection;
        const usageFromResponse = finalChunk?.usage || response?.usage;
        const latencyFromResponse = finalChunk?.latencyMs ?? response?.latencyMs;
        const citationsFromResponse = finalChunk?.citations || response?.citations;
        const reasoningFromResponse = finalChunk?.reasoning || response?.reasoning;

        if (!streamingSnapshot.hasStreamed) {
          animateAssistantResponse(assistantId, answerText, {
            provider: providerFromResponse,
            model: modelFromResponse,
            autoSelection: autoSelectionFromResponse,
            usage: usageFromResponse,
            latencyMs: latencyFromResponse,
            citations: citationsFromResponse,
            reasoning: reasoningFromResponse,
          });
        } else {
          updateAssistantMessage(assistantId, (message) => {
            const baseInfo = {
              ...(message.modelInfo || {}),
              ...(autoSelectionFromResponse || {}),
            };
            if (providerFromResponse) {
              baseInfo.provider = providerFromResponse;
            }
            if (modelFromResponse) {
              baseInfo.model = modelFromResponse;
            }
            if (autoSelectionFromResponse?.explanation) {
              baseInfo.explanation = autoSelectionFromResponse.explanation;
            }
            const next = {
              ...message,
              text: answerText,
              status: 'complete',
            };
            if (Object.keys(baseInfo).length > 0) {
              next.modelInfo = baseInfo;
            }
            if (usageFromResponse) {
              next.usage = usageFromResponse;
            }
            if (latencyFromResponse !== undefined) {
              next.latencyMs = latencyFromResponse;
            }
            if (citationsFromResponse) {
              next.citations = citationsFromResponse;
            }
            if (reasoningFromResponse) {
              next.reasoning = reasoningFromResponse;
            }
            return next;
          });
          if (autoSelectionFromResponse || providerFromResponse || modelFromResponse) {
            setLastAutoSelection(autoSelectionFromResponse || {
              provider: providerFromResponse,
              model: modelFromResponse,
              explanation: autoSelectionFromResponse?.explanation,
            });
          }
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          console.info('[LibraryQAPanel] LLM 요청이 취소되었습니다.', error);
          return;
        }
        console.error('질문 처리 실패:', error);
        const errorMessage = error?.code === 'AGENT_TIMEOUT'
          ? TIMEOUT_MESSAGE
          : error?.message || '질문 처리 중 오류가 발생했습니다.';
        setError(errorMessage);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, text: `오류: ${errorMessage}`, status: 'error' }
              : msg,
          ),
        );
      } finally {
        resetStreamingState();
        stopNodeProcessing(originalProcessingKey);
        if (currentProcessingKey !== originalProcessingKey) {
          stopNodeProcessing(currentProcessingKey);
        }
      }
      return;
    }


    const newNodeId = `node_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    const keyword = question.split(' ').slice(0, 3).join(' ') || 'Q';
    const parentId = selectedNode?.id ?? null;
    const level = selectedNode ? (selectedNode.level || 0) + 1 : 0;

    switchProcessingKey(resolveProcessingKey(newNodeId, false, selectedTree?.id));

    const newNode = {
      id: newNodeId,
      keyword,
      question,
      answer: '',
      status: 'asking',
      createdAt: timestamp,
      updatedAt: timestamp,
      conversation: pendingMessages,
      parentId,
      level,
      treeId: selectedTree.id,
    };
    if (pendingModelInfo) {
      newNode.modelInfo = pendingModelInfo;
    }

    if (onNewNodeCreated) {
      onNewNodeCreated(newNode, {
        source: newNode.parentId,
        target: newNode.id,
        value: 1,
      });
    }

    if (isLibraryIntroActive && onLibraryIntroComplete) {
      onLibraryIntroComplete(selectedTree.id);
    }
    const shouldAutoSelectNewNode = !latestSelectedNodeRef.current;

    try {
      console.log('변환된 OpenAI 메시지:', requestMessages);

      const response = await withTimeout(
        invokeAgent('askRoot', {
          messages: requestMessages,
          attachments: hasAttachments ? sanitizedAttachments : undefined,
          autoSelectionHint: effectiveProvider === 'auto' ? activeAutoSelection : undefined,
          question,
          provider: effectiveProvider,
          model: effectiveModel,
        }),
        AGENT_RESPONSE_TIMEOUT_MS,
      );

      if (response?.success === false && response?.error?.message) {
        throw new Error(response.error.message);
      }

      const answerText = response?.answer
        || response?.data?.answer
        || response?.result?.answer
        || response?.message?.answer
        || '';

      if (!answerText) {
        throw new Error('답변을 받지 못했습니다.');
      }

      animateAssistantResponse(assistantId, answerText, {
        provider: response.provider,
        model: response.model,
        autoSelection: response.autoSelection || activeAutoSelection,
        usage: response.usage,
        latencyMs: response.latencyMs,
      });

      const finalModelInfo = response.autoSelection || activeAutoSelection || pendingModelInfo;
      const updatedMessages = pendingMessages.map((msg) => {
        if (msg.id !== assistantId) {
          return msg;
        }
        return {
          ...msg,
          text: answerText,
          status: 'complete',
          modelInfo: finalModelInfo
            ? {
              ...(msg.modelInfo || {}),
              ...finalModelInfo,
              provider: response.provider || finalModelInfo.provider,
              model: response.model || finalModelInfo.model,
              explanation: finalModelInfo.explanation || msg.modelInfo?.explanation,
            }
            : msg.modelInfo,
          reasoning: response.reasoning || msg.reasoning,
          usage: response.usage || msg.usage,
          latencyMs: response.latencyMs !== undefined ? response.latencyMs : msg.latencyMs,
        };
      });

      const updatedNode = {
        ...newNode,
        conversation: updatedMessages,
        answer: answerText,
        status: 'answered',
        updatedAt: timestamp,
      };
      if (finalModelInfo) {
        updatedNode.modelInfo = finalModelInfo;
      }
      if (response.reasoning) {
        updatedNode.reasoning = response.reasoning;
      }
      if (response.usage) {
        updatedNode.usage = response.usage;
      }

      await upsertTreeNodes({
        treeId: selectedTree.id,
        nodes: [updatedNode],
        userId: user.id,
      });

      if (onNodeUpdate) {
        onNodeUpdate(updatedNode);
      }
      const shouldSelectUpdated = shouldAutoSelectNewNode || latestSelectedNodeRef.current?.id === newNodeId;
      if (shouldSelectUpdated && onNodeSelect) {
        onNodeSelect(updatedNode);
      }
    } catch (error) {
      console.error('질문 처리 실패:', error);
      const errorMessage = error.message || '질문 처리 중 오류가 발생했습니다.';
      setError(errorMessage);
      if (!isOverride) {
        setComposerValue(question);
        if (hasAttachments) {
          setAttachments(sanitizedAttachments);
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, text: `오류: ${errorMessage}`, status: 'error' }
            : msg,
        ),
      );
    } finally {
      stopNodeProcessing(originalProcessingKey);
      if (currentProcessingKey !== originalProcessingKey) {
        stopNodeProcessing(currentProcessingKey);
      }
    }
  }, [
    animateAssistantResponse,
    attachments,
    clearAttachments,
    composerValue,
    createPlaceholderNodes,
    disableHighlightMode,
    invokeAgent,
    isMultiQuestionMode,
    isProcessing,
    isLibraryIntroActive,
    isApiAvailable,
    messages,
    onNewNodeCreated,
    onNodeUpdate,
    onLibraryIntroComplete,
    selectedNode,
    selectedProvider,
    selectedModel,
    selectedTree,
    setAttachments,
    setError,
    setHighlightNotice,
    setLastAutoSelection,
    setSlowResponseNotice,
    setGlobalProcessing,
    resolveProcessingKey,
    startNodeProcessing,
    stopNodeProcessing,
    resolveModelForProvider,
    user,
  ]);

  const handleRetryMessage = useCallback((message) => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = lastUser?.text || selectedNode?.question || selectedNode?.keyword || '';
    if (!question) return;

    const attachmentsOverride = Array.isArray(lastUser?.attachments) ? lastUser.attachments : undefined;
    if (message?.id) {
      setSpinningMap((prev) => ({ ...prev, [message.id]: true }));
    }

    const modelOverride = selectedProvider === 'auto'
      ? undefined
      : resolveModelForProvider(selectedProvider);

    Promise.resolve(handleSendMessage(question, {
      attachmentsOverride,
      providerOverride: selectedProvider,
      modelOverride,
      retryMessage: message,
      reuseCurrentNode: true,
    }))
      .catch(() => undefined)
      .finally(() => {
        if (message?.id) {
          const clearSpinner = () => {
            setSpinningMap((prev) => ({ ...prev, [message.id]: false }));
          };
          if (typeof window !== 'undefined') {
            window.setTimeout(clearSpinner, 900);
          } else {
            clearSpinner();
          }
        }
      });
  }, [handleSendMessage, messages, selectedNode, selectedProvider, resolveModelForProvider]);

  const handleRetryWithModel = useCallback((message, modelId) => {
    const normalizedModelId = typeof modelId === 'string' ? modelId : '';
    const modelOption = modelOptions.find((option) => option.id === normalizedModelId);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = lastUser?.text || selectedNode?.question || selectedNode?.keyword || '';
    if (!question || !modelOption) return;

    const attachmentsOverride = Array.isArray(lastUser?.attachments) ? lastUser.attachments : undefined;
    const nextModel = modelOption.id;
    const nextProvider = modelOption.provider;

    if (message?.id) {
      setSpinningMap((prev) => ({ ...prev, [message.id]: true }));
    }

    setSelectedModel(nextModel);

    Promise.resolve(handleSendMessage(question, {
      attachmentsOverride,
      providerOverride: nextProvider,
      modelOverride: nextModel,
      retryMessage: message,
      reuseCurrentNode: true,
    }))
      .catch(() => undefined)
      .finally(() => {
        if (message?.id) {
          const clearSpinner = () => {
            setSpinningMap((prev) => ({ ...prev, [message.id]: false }));
          };
          if (typeof window !== 'undefined') {
            window.setTimeout(clearSpinner, 900);
          } else {
            clearSpinner();
          }
        }
      });
  }, [handleSendMessage, messages, modelOptions, selectedNode, setSelectedModel]);

  // 다중 질문 모드에서 전역 키보드 이벤트 감지
  useEffect(() => {
    if (!isMultiQuestionMode) return;
    
    const handleGlobalKeyDown = (e) => {
      console.log('⌨️ [글로벌] 키 입력:', e.key, '다중 질문 모드:', isMultiQuestionMode);
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log('✅ 다중 질문 모드에서 Enter 감지');
        e.preventDefault();
        const highlightTexts = highlightStoreRef.current.getTexts();
        console.log('하이라이트된 텍스트:', highlightTexts);
        if (highlightTexts.length > 0) {
          handleSendMessage();
        }
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    console.log('👂 전역 키보드 리스너 등록됨');
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      console.log('👂 전역 키보드 리스너 제거됨');
    };
  }, [isMultiQuestionMode, handleSendMessage]);

  // 컴포저 포커스 처리
  const handleComposerFocus = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleComposerBlur = useCallback(() => {
    setIsComposing(false);
  }, []);

  if (!selectedNode && !isLibraryIntroActive) {
    return (
      <div
        className={containerClassName}
        style={panelStyle}
        data-interactive-zone="true"
        {...attachmentDropHandlers}
      >
        <div
          className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 pb-2"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-semibold" style={{ color: chatPanelStyles.textColor }}>
                질문 답변
              </p>
            </div>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: subtleTextColor }}>
              노드를 선택하면 질문 답변을 시작할 수 있습니다.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
              style={{ color: chatPanelStyles.textColor }}
              aria-label="AI 패널 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={containerClassName}
      style={{
        ...panelStyle, 
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text',
      }}
      data-interactive-zone="true"
      {...attachmentDropHandlers}
      onMouseDown={(e) => {
        console.log('🖱️ [패널] mouseDown 이벤트', {
          target: e.target,
          button: e.button,
          defaultPrevented: e.defaultPrevented,
        });
      }}
      onSelectStart={(e) => {
        console.log('🖱️ [패널] selectStart 이벤트', {
          target: e.target,
          defaultPrevented: e.defaultPrevented,
        });
      }}
      onDoubleClick={(e) => {
        console.log('🖱️ [패널] doubleClick 이벤트', {
          target: e.target,
          targetTag: e.target.tagName,
          defaultPrevented: e.defaultPrevented,
        });
      }}
      onSelect={(e) => {
        const selection = window.getSelection();
        console.log('🖱️ [패널] select 이벤트', {
          selection: selection.toString(),
          rangeCount: selection.rangeCount,
        });
      }}
      onMouseUp={(e) => {
        const selection = window.getSelection();
        console.log('🖱️ [패널] mouseUp 이벤트', {
          selection: selection.toString(),
          rangeCount: selection.rangeCount,
        });
        // 선택이 사라지는지 추적
        setTimeout(() => {
          const laterSelection = window.getSelection();
          console.log('⏱️ [100ms 후] selection:', {
            selection: laterSelection.toString(),
            rangeCount: laterSelection.rangeCount,
            cleared: laterSelection.toString() === '' && selection.toString() !== '',
          });
        }, 100);
      }}
    >
      {!isLibraryIntroActive && (
        <div
          className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 pb-2"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div
                className="min-w-0 flex-1"
                style={{ color: chatPanelStyles.textColor }}
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
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                style={{ color: chatPanelStyles.textColor }}
                aria-label="AI 패널 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {!isLibraryIntroActive && (
        messages.length === 0 ? (
          <div className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
            <div className="py-8 text-center text-sm" style={{ color: subtleTextColor }}>
              질문을 입력해보세요.
            </div>
          </div>
        ) : (
          <ChatMessageList
            title="Assistant"
            messages={messages}
            onRetry={handleRetryMessage}
            onRetryWithModel={handleRetryWithModel}
            onCopy={handleCopyMessage}
            availableModels={modelOptions}
            endRef={messagesEndRef}
            className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
            onContainerRef={handleRegisterMessageContainer}
            isScrollable={false}
            theme={theme}
            panelStyles={chatPanelStyles}
            retryingMessageMap={spinningMap}
          />
        )
      )}

      {error && (
        <div className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs text-red-500 shadow-sm">
          {error}
        </div>
      )}

      <ChatAttachmentPreviewList
        attachments={attachments}
        onRemove={handleAttachmentRemove}
        onClear={clearAttachments}
        panelStyles={chatPanelStyles}
        isDarkTheme={isDarkTheme}
      />

      {slowResponseNotice && (
        <div className="rounded-lg border border-amber-200/60 bg-amber-50/90 px-3 py-2 text-xs text-amber-700 shadow-sm">
          {slowResponseNotice}
        </div>
      )}

      {!isLibraryIntroActive && (
        <div
          className="flex -mb-2 flex-shrink-0 items-center gap-2"
          style={{ position: 'relative', zIndex: 1002, pointerEvents: 'auto' }}
        >
          <button
            type="button"
            onClick={(e) => {
              console.log('🖱️ [버튼 DOM] onClick 이벤트 발생!', e);
              console.log('이벤트 타겟:', e.target);
              console.log('현재 타겟:', e.currentTarget);
              toggleMultiQuestionMode();
            }}
            onMouseDown={(e) => {
              console.log('🖱️ [버튼 DOM] onMouseDown 이벤트 발생!');
            }}
            aria-pressed={isMultiQuestionMode}
            aria-label="하이라이트 모드"
            className="rounded-xl border px-3 py-1 text-xs font-medium transition-all duration-200"
            style={{
              cursor: 'pointer',
              pointerEvents: 'auto',
              backgroundColor: isMultiQuestionMode 
                ? 'rgba(16, 185, 129, 0.6)' 
                : isDarkTheme 
                  ? 'rgba(65, 65, 65, 0.8)' 
                  : 'rgba(255, 255, 255, 0.8)',
              borderColor: isMultiQuestionMode ? 'rgba(16, 185, 129, 0.6)' : chatPanelStyles.borderColor,
              borderWidth: '1px',
              borderStyle: 'solid',
              color: chatPanelStyles.textColor,
            }}
          >
            다중 질문
          </button>

          {highlightNotice && (
            <div
              className="rounded px-2 py-1 text-xs"
              style={{
                color: highlightNotice.type === 'warning'
                  ? 'rgba(180, 83, 9, 0.9)'
                  : highlightNotice.type === 'success'
                    ? 'rgba(16, 185, 129, 0.9)'
                    : subtleTextColor,
                backgroundColor: highlightNotice.type === 'warning'
                  ? 'rgba(254, 243, 199, 0.5)'
                  : highlightNotice.type === 'success'
                    ? 'rgba(209, 250, 229, 0.5)'
                    : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {highlightNotice.message}
            </div>
          )}
        </div>
      )}

      {isLibraryIntroActive && (
        <div className="flex flex-col items-center justify-center gap-6 text-center max-w-md mx-auto px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm">
            <Network className="h-8 w-8 text-violet-600" strokeWidth={2} />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: chatPanelStyles.textColor }}>
              첫 트리를 시작하세요
            </h2>
            <p className="text-base leading-relaxed" style={{ color: subtleTextColor }}>
              궁금한 것을 질문하거나 탐구하고 싶은 주제를 입력해보세요
            </p>
          </div>
          <div 
            className="relative w-full rounded-xl border px-4 py-3 backdrop-blur-sm"
            style={{
              backgroundColor: isDarkTheme ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.08)',
              borderColor: isDarkTheme ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
              zIndex: 1,
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Shield className="h-5 w-5 text-violet-600" strokeWidth={2} />
              </div>
              <div className="flex flex-col gap-1 text-left text-sm leading-relaxed" style={{ color: subtleTextColor }}>
                <p className="font-medium" style={{ color: chatPanelStyles.textColor }}>
                  각 대화는 독립된 문맥을 가집니다
                </p>
                <p className="text-xs">
                  수많은 질문을 해도 문맥이 오염되지 않습니다
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isApiAvailable ? (
        <div className="text-center text-sm text-red-500 bg-red-50/80 px-3 py-2 rounded-xl border border-red-300/60">
          VORAN API를 사용할 수 없습니다. Electron 환경에서 실행하거나 서버 프록시(REACT_APP_AGENT_HTTP_ENDPOINT)를 설정해주세요.
        </div>
      ) : (
        <PromptInput
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className={cn(
            'relative flex-col items-stretch gap-2 transition-colors',
            isAttachmentDragOver && 'border-dashed border-primary/60 bg-primary/10 ring-1 ring-primary/30',
            isLibraryIntroActive && 'mx-auto w-full max-w-2xl relative',
          )}
          style={{ zIndex: 10 }}
          {...attachmentDropHandlers}
        >
          {isAttachmentDragOver ? (
            <AttachmentDropOverlay />
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              handleAttachmentFiles(event.target.files);
              event.target.value = '';
            }}
          />

          <PromptInputToolbar className="flex items-center justify-between px-1 gap-2">
            <ProviderDropdown
              options={modelOptions}
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={isProcessing}
              align="start"
            />
            <div className="flex flex-1 items-center justify-end gap-2">
              <TooltipProvider delayDuration={300}>
                <div className="flex items-center gap-1 relative z-10">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative z-10">
                        <PromptInputButton
                          onClick={handleAttachmentButtonClick}
                          disabled={isAttachmentUploading || isProcessing}
                          variant="ghost"
                          className="rounded-full p-2 hover:bg-gray-100 text-gray-500 relative z-10"
                        >
                          <Paperclip className="h-4 w-4" />
                        </PromptInputButton>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>파일첨부</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </PromptInputToolbar>

          <div className="flex w-full items-end gap-2">
            <PromptInputTextarea
              ref={textareaRef}
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onFocus={handleComposerFocus}
              onBlur={handleComposerBlur}
              placeholder="질문을 입력하세요... (Enter로 전송)"
              disabled={isProcessing}
              minHeight={40}
              maxHeight={164}
            />
            <PromptInputSubmit
              disabled={(composerValue.trim().length === 0 && attachments.length === 0) || isProcessing}
              status={isProcessing ? 'streaming' : 'ready'}
            />
          </div>
        </PromptInput>
      )}
    </div>
  );
};

export default LibraryQAPanel;
