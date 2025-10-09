import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X, Paperclip, Network, Shield } from 'lucide-react';
import QuestionService from 'features/tree/services/QuestionService';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import { upsertTreeNodes } from 'infrastructure/supabase/services/treeService';
import ChatMessageList from 'features/chat/components/ChatMessageList';
import { DEFAULT_CHAT_PANEL_STYLES } from 'features/chat/constants/panelStyles';
import EditableTitle, { EDITABLE_TITLE_ACTIVE_ATTR } from 'shared/ui/EditableTitle';
import AgentClient from 'infrastructure/ai/agentClient';
import Highlighter from 'web-highlighter';
import HighlightSelectionStore from 'features/tree/services/node-assistant/HighlightSelectionStore';
import { cn } from 'shared/utils';
import { useTheme } from 'shared/components/library/ThemeProvider';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputButton,
  PromptInputSubmit,
} from 'shared/ui/shadcn-io/ai/prompt-input';

const TYPING_INTERVAL_MS = 18;
const AGENT_RESPONSE_TIMEOUT_MS = 30000;

const withTimeout = (promise, timeoutMs = 0, timeoutMessage = 'AI 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.') => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || typeof window === 'undefined') {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.code = 'AGENT_TIMEOUT';
      reject(error);
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
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
  const [messages, setMessages] = useState([]);
  const [composerValue, setComposerValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isMultiQuestionMode, setIsMultiQuestionMode] = useState(() => {
    console.log('🎬 [상태 초기화] isMultiQuestionMode 초기값: false');
    return false;
  });
  const [attachments, setAttachments] = useState([]);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);

  const messageContainerRef = useRef(null);
  const highlighterRef = useRef(null);
  const highlightHandlersRef = useRef({ create: null, remove: null });
  const highlightStoreRef = useRef(new HighlightSelectionStore());
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
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
  const typingTimers = useRef([]);
  const messagesEndRef = useRef(null);

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

  // 타이핑 애니메이션을 위한 타이머 정리
  const clearTypingTimers = useCallback(() => {
    typingTimers.current.forEach(timer => clearTimeout(timer));
    typingTimers.current = [];
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => clearTypingTimers();
  }, [clearTypingTimers]);

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
    console.log('📨 [handleSendMessage] 호출됨');
    console.log('다중 질문 모드:', isMultiQuestionMode);
    const highlightTexts = isMultiQuestionMode ? highlightStoreRef.current.getTexts() : [];
    console.log('하이라이트된 텍스트 개수:', highlightTexts.length);
    console.log('하이라이트된 텍스트:', highlightTexts);
    const question = composerValue.trim();
    console.log('입력된 질문:', question);

    const attachmentSnapshot = attachments
      .filter((item) => item && typeof item === 'object' && typeof item.dataUrl === 'string' && item.dataUrl)
      .map((item) => ({ ...item }));
    const hasAttachmentSnapshot = attachmentSnapshot.length > 0;

    if (highlightTexts.length > 0 && hasAttachmentSnapshot) {
      setHighlightNotice({ type: 'warning', message: '다중 질문 모드에서는 이미지 첨부를 사용할 수 없습니다.' });
      return;
    }

    if (highlightTexts.length > 0 && !question) {
      console.log('✅ 플레이스홀더 생성 시작...');
      setComposerValue('');
      setIsProcessing(true);
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
        setIsProcessing(false);
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

    setComposerValue('');
    clearAttachments();
    setError(null);
    setIsProcessing(true);

    const timestamp = Date.now();
    const userId = `${timestamp}-user`;
    const assistantId = `${timestamp}-assistant`;

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

    const userMessage = {
      id: userId,
      role: 'user',
      content: question,
      text: question,
      timestamp,
      attachments: hasAttachments ? sanitizedAttachments : undefined,
    };

    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      text: '생각 중…',
      status: 'pending',
      timestamp: timestamp + 1,
    };

    const mapToOpenAIMessage = (msg) => {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';

      if (Array.isArray(msg.content)) {
        const normalizedContent = msg.content
          .map((item) => {
            if (!item || typeof item !== 'object') {
              return null;
            }
            if (item.type === 'input_text' || item.type === 'text') {
              const text = typeof item.text === 'string' ? item.text.trim() : '';
              return text ? { type: 'input_text', text } : null;
            }
            if (item.type === 'input_image' || item.type === 'image_url') {
              const urlCandidate = typeof item.image_url?.url === 'string'
                ? item.image_url.url
                : typeof item.url === 'string'
                  ? item.url
                  : typeof item.dataUrl === 'string'
                    ? item.dataUrl
                    : '';
              const url = urlCandidate.trim();
              return url ? { type: 'input_image', image_url: { url } } : null;
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
        contentParts.push({ type: 'input_text', text: trimmed });
      }

      const messageAttachments = Array.isArray(msg.attachments)
        ? msg.attachments.filter((item) => item && typeof item === 'object' && typeof item.dataUrl === 'string' && item.dataUrl)
        : [];

      messageAttachments.forEach((item) => {
        contentParts.push({
          type: 'input_image',
          image_url: { url: item.dataUrl },
        });
      });

      if (contentParts.length === 0) {
        return null;
      }

      if (contentParts.length === 1 && contentParts[0].type === 'input_text') {
        return { role, content: contentParts[0].text };
      }

      return { role, content: contentParts };
    };

    const previousMessages = Array.isArray(messages) ? messages : [];
    const isPlaceholderNode = selectedNode
      ? selectedNode.status === 'placeholder' || Boolean(selectedNode.placeholder)
      : false;
    const hasUserConversation = previousMessages.some((msg) => msg.role === 'user');

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

    if (isPlaceholderNode && !hasUserConversation && selectedNode) {
      const pendingMessages = [...previousMessages, userMessage, assistantMessage];
      setMessages(pendingMessages);

      const openaiMessages = pendingMessages
        .filter((msg) => msg.id !== assistantId)
        .map(mapToOpenAIMessage)
        .filter(Boolean);

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

      onNodeUpdate?.(pendingNode);
      onNodeSelect?.(pendingNode);

      try {
        const response = await withTimeout(
          invokeAgent('askRoot', {
            messages: openaiMessages,
            attachments: hasAttachments ? sanitizedAttachments : undefined,
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

        animateAssistantResponse(assistantId, answerText);

        const updatedMessages = pendingMessages.map((msg) =>
          msg.id === assistantId
            ? { ...msg, text: answerText, status: 'complete' }
            : msg,
        );

        const answeredNode = {
          ...pendingNode,
          conversation: updatedMessages,
          answer: answerText,
          status: 'answered',
          updatedAt: Date.now(),
        };

        await upsertTreeNodes({
          treeId: selectedTree.id,
          nodes: [answeredNode],
          userId: user.id,
        });

        onNodeUpdate?.(answeredNode);
        onNodeSelect?.(answeredNode);
      } catch (error) {
        console.error('질문 처리 실패:', error);
        const errorMessage = error.message || '질문 처리 중 오류가 발생했습니다.';
        setError(errorMessage);
        setComposerValue(question);
        if (hasAttachments) {
          setAttachments(sanitizedAttachments);
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, text: `오류: ${errorMessage}`, status: 'error' }
              : msg,
          ),
        );
      } finally {
        setIsProcessing(false);
      }
      return;
    }


    const newNodeId = `node_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    const keyword = question.split(' ').slice(0, 3).join(' ') || 'Q';
    const parentId = selectedNode?.id ?? null;
    const level = selectedNode ? (selectedNode.level || 0) + 1 : 0;

    const newNode = {
      id: newNodeId,
      keyword,
      question,
      answer: '',
      status: 'asking',
      createdAt: timestamp,
      updatedAt: timestamp,
      conversation: [userMessage, assistantMessage],
      parentId,
      level,
      treeId: selectedTree.id,
    };

    setMessages([userMessage, assistantMessage]);

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

    try {
      const openaiMessages = [...messages, userMessage]
        .map(mapToOpenAIMessage)
        .filter(Boolean);

      console.log('변환된 OpenAI 메시지:', openaiMessages);

      const response = await withTimeout(
        invokeAgent('askRoot', {
          messages: openaiMessages,
          attachments: hasAttachments ? sanitizedAttachments : undefined,
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

      animateAssistantResponse(assistantId, answerText);

      const updatedMessages = [userMessage, {
        ...assistantMessage,
        text: answerText,
        status: 'complete',
      }];

      const updatedNode = {
        ...newNode,
        conversation: updatedMessages,
        answer: answerText,
        status: 'answered',
        updatedAt: timestamp,
      };

      await upsertTreeNodes({
        treeId: selectedTree.id,
        nodes: [updatedNode],
        userId: user.id,
      });

      if (onNodeUpdate) {
        onNodeUpdate(updatedNode);
      }
      if (onNodeSelect) {
        onNodeSelect(updatedNode);
      }
    } catch (error) {
      console.error('질문 처리 실패:', error);
      const errorMessage = error.message || '질문 처리 중 오류가 발생했습니다.';
      setError(errorMessage);
      setComposerValue(question);
      if (hasAttachments) {
        setAttachments(sanitizedAttachments);
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, text: `오류: ${errorMessage}`, status: 'error' }
            : msg,
        ),
      );
    } finally {
      setIsProcessing(false);
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
    messages,
    onNewNodeCreated,
    onNodeUpdate,
    onLibraryIntroComplete,
    selectedNode,
    selectedTree,
    user,
  ]);

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
            endRef={messagesEndRef}
            className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
            onContainerRef={handleRegisterMessageContainer}
            isScrollable={false}
            theme={theme}
            panelStyles={chatPanelStyles}
          />
        )
      )}

      {error && (
        <div className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs text-red-500 shadow-sm">
          {error}
        </div>
      )}

      {attachments.length > 0 ? (
        <div
          className="flex w-full flex-wrap gap-3 rounded-xl border px-3 py-3"
          style={{
            pointerEvents: 'auto',
            borderColor: chatPanelStyles.borderColor,
            backgroundColor: isDarkTheme ? 'rgba(55, 55, 55, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          }}
          data-block-pan="true"
        >
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative h-24 w-32 overflow-hidden rounded-lg border"
              style={{
                borderColor: chatPanelStyles.borderColor,
                backgroundColor: isDarkTheme ? 'rgba(65, 65, 65, 0.75)' : 'rgba(15, 23, 42, 0.35)',
              }}
            >
              <img
                src={attachment.dataUrl}
                alt={attachment.label || attachment.name || '첨부 이미지'}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleAttachmentRemove(attachment.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs font-bold text-white transition hover:bg-black/80"
                aria-label="첨부 이미지 제거"
              >
                ×
              </button>
            </div>
          ))}
          {attachments.length > 1 ? (
            <button
              type="button"
              onClick={clearAttachments}
              className="flex h-10 items-center justify-center rounded-lg border border-dashed px-3 text-[11px] font-medium transition hover:bg-white/40"
              style={{ 
                borderColor: chatPanelStyles.borderColor,
                color: chatPanelStyles.textColor,
              }}
            >
              전체 제거
            </button>
          ) : null}
        </div>
      ) : null}

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
          VORAN API를 사용할 수 없습니다. Electron 환경에서 실행해주세요.
        </div>
      ) : (
        <PromptInput
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className={cn(
            isLibraryIntroActive && "mx-auto w-full max-w-2xl relative"
          )}
          style={{ zIndex: 10 }}
        >
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
          <PromptInputButton
            onClick={handleAttachmentButtonClick}
            disabled={isAttachmentUploading || isProcessing}
          >
            <Paperclip size={16} />
          </PromptInputButton>
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
        </PromptInput>
      )}
    </div>
  );
};

export default LibraryQAPanel;
