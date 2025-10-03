import { useCallback, useRef } from 'react';
import QuestionService from '../../../services/force-tree/QuestionService';
import { sanitizeConversationMessages } from '../../../services/supabaseTrees';

const useHierarchicalTreeAgents = ({
  dataApi,
  interactionsApi,
  parentByChild,
}) => {
  const {
    setData,
    dataRef,
    conversationStoreRef,
    setConversationForNode,
    createClientGeneratedId,
    setShowBootstrapChat,
    willCreateCycle,
    showLinkValidationMessage,
    conversationStoreBootstrapKey,
  } = dataApi;
  const { selectNode, expandNode } = interactionsApi;

  const questionService = useRef(new QuestionService());

  const extractImportantKeyword = useCallback(async (questionText) => {
    const trimmed = typeof questionText === 'string' ? questionText.trim() : '';
    const fallbackToken = trimmed.split(/\s+/).find(Boolean) || 'Q';
    const fallbackKeyword = fallbackToken.slice(0, 48);

    if (!trimmed) {
      return fallbackKeyword;
    }

    if (typeof window === 'undefined') {
      return fallbackKeyword;
    }

    const api = window.jarvisAPI;
    if (!api?.extractKeyword) {
      return fallbackKeyword;
    }

    try {
      const result = await api.extractKeyword({ question: trimmed });
      const candidate = typeof result?.keyword === 'string' ? result.keyword.trim() : '';
      if (result?.success && candidate) {
        const token = candidate.split(/\s+/).find(Boolean);
        if (token) {
          return token.slice(0, 48);
        }
      }

      const fallbackCandidate = candidate || (typeof result?.answer === 'string' ? result.answer : '');
      const fallbackWord = typeof fallbackCandidate === 'string'
        ? fallbackCandidate.trim().split(/\s+/).find(Boolean)
        : null;
      if (fallbackWord) {
        return fallbackWord.slice(0, 48);
      }
    } catch (error) {
      try {
        api?.log?.('warn', 'keyword_extraction_failed', { message: error?.message || 'unknown error' });
      } catch (loggingError) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('Keyword extraction logging failed', loggingError);
        }
      }
    }

    return fallbackKeyword;
  }, []);

  const buildContextMessages = useCallback((nodeId) => {
    if (!nodeId) return [];

    const chain = [];
    const guard = new Set();
    let current = nodeId;

    while (current) {
      if (guard.has(current)) break;
      guard.add(current);
      chain.unshift(current);
      current = parentByChild.get(current) || null;
    }

    const collected = [];
    chain.forEach((id) => {
      const history = conversationStoreRef.current.get(id) || [];
      history.forEach((entry) => {
        if (!entry || typeof entry.text !== 'string') {
          return;
        }
        const text = entry.text.trim();
        if (!text) {
          return;
        }
        const role = entry.role === 'assistant' ? 'assistant' : 'user';
        collected.push({ role, content: text });
      });
    });

    const MAX_HISTORY_MESSAGES = 12;
    return collected.length > MAX_HISTORY_MESSAGES
      ? collected.slice(collected.length - MAX_HISTORY_MESSAGES)
      : collected;
  }, [conversationStoreRef, parentByChild]);

  const invokeAgent = useCallback(async (channel, payload = {}) => {
    const api = window.jarvisAPI;
    if (!api || typeof api[channel] !== 'function') {
      throw new Error('AI 에이전트 브리지가 준비되지 않았습니다.');
    }
    const result = await api[channel](payload);
    if (!result?.success) {
      const message = result?.error?.message || 'AI 응답을 가져오지 못했습니다.';
      const code = result?.error?.code || 'agent_error';
      const error = new Error(message);
      error.code = code;
      throw error;
    }
    return result;
  }, []);

  const handleRequestAnswer = useCallback(
    async ({ node: targetNode, question, isRootNode }) => {
      const trimmedQuestion = (question || '').trim();
      if (!trimmedQuestion) {
        throw new Error('질문이 비어있습니다.');
      }

      const nodeId = targetNode?.id;
      const historyMessages = buildContextMessages(nodeId);

      const focusKeywordSet = new Set();
      const appendFocusKeyword = (value) => {
        if (typeof value !== 'string') {
          return;
        }
        const normalized = value.trim();
        if (!normalized) {
          return;
        }
        focusKeywordSet.add(normalized);
      };

      appendFocusKeyword(targetNode?.keyword);
      if (Array.isArray(targetNode?.keywords)) {
        targetNode.keywords.forEach(appendFocusKeyword);
      }
      if (typeof targetNode?.name === 'string') {
        appendFocusKeyword(targetNode.name);
      }
      if (Array.isArray(targetNode?.aliases)) {
        targetNode.aliases.forEach(appendFocusKeyword);
      }
      if (targetNode?.placeholder) {
        const { keyword: placeholderKeyword, keywords: placeholderKeywords, sourceText } = targetNode.placeholder;
        appendFocusKeyword(placeholderKeyword);
        appendFocusKeyword(sourceText);
        if (Array.isArray(placeholderKeywords)) {
          placeholderKeywords.forEach(appendFocusKeyword);
        }
      }

      const focusKeywords = Array.from(focusKeywordSet);

      const originalQuestion = typeof targetNode?.questionData?.question === 'string'
        ? targetNode.questionData.question.trim()
        : '';

      const contextPhrases = [];
      if (focusKeywords.length === 1) {
        contextPhrases.push(`현재 노드는 "${focusKeywords[0]}"라는 용어를 설명하기 위해 생성되었습니다. 사용자가 "이 단어" 혹은 "이 표현"이라고 말하면 이 용어를 지칭합니다.`);
      } else if (focusKeywords.length > 1) {
        const keywordList = focusKeywords.map((keyword) => `"${keyword}"`).join(', ');
        contextPhrases.push(`현재 노드는 ${keywordList} 등의 용어를 설명하기 위해 생성되었습니다. 사용자가 "이 단어" 혹은 "이 표현"이라고 말하면 이들 가운데 해당 맥락의 용어를 의미합니다.`);
      }

      if (originalQuestion) {
        contextPhrases.push(`이 노드는 처음에 "${originalQuestion}"이라는 질문으로 생성되었습니다.`);
      }

      const contextNote = contextPhrases.join(' ');
      const userMessageContent = contextNote
        ? `${contextNote}\n\n질문: ${trimmedQuestion}`
        : trimmedQuestion;

      const messages = [
        ...historyMessages,
        { role: 'user', content: userMessageContent },
      ];

      const payload = {
        question: trimmedQuestion,
        messages,
        nodeId,
        isRootNode,
      };

      if (focusKeywords.length > 0) {
        payload.focusKeywords = focusKeywords;
      }

      if (contextNote) {
        payload.questionContext = contextNote;
      }

      const response = await invokeAgent(isRootNode ? 'askRoot' : 'askChild', payload);

      return response;
    },
    [buildContextMessages, invokeAgent],
  );

  const handleBootstrapSubmit = useCallback(async (text) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
      return;
    }

    const timestamp = Date.now();

    setConversationForNode(conversationStoreBootstrapKey, [
      { id: `${timestamp}-user`, role: 'user', text: trimmed, timestamp },
      { id: `${timestamp}-assistant`, role: 'assistant', text: '생각 중…', status: 'pending', timestamp: Date.now() },
    ]);

    try {
      const response = await handleRequestAnswer({
        node: { id: conversationStoreBootstrapKey },
        question: trimmed,
        isRootNode: true,
      });

      const rootId = createClientGeneratedId('root');
      const answer = typeof response?.answer === 'string' ? response.answer.trim() : '';
      const keyword = await extractImportantKeyword(trimmed);

      const rawConversation = [
        { id: `${timestamp}-user`, role: 'user', text: trimmed, timestamp },
        { id: `${timestamp}-assistant`, role: 'assistant', text: answer, status: 'complete', metadata: response, timestamp },
      ];

      const sanitizedConversation = sanitizeConversationMessages(rawConversation);

      const rootNode = {
        id: rootId,
        keyword: keyword || trimmed,
        fullText: answer || trimmed,
        level: 0,
        size: 20,
        status: 'answered',
        question: trimmed,
        answer,
        createdAt: timestamp,
        updatedAt: timestamp,
        conversation: sanitizedConversation,
      };

      setData(() => {
        const nextState = { nodes: [rootNode], links: [] };
        dataRef.current = nextState;
        return nextState;
      });

      setConversationForNode(rootId, sanitizedConversation);
      conversationStoreRef.current.delete(conversationStoreBootstrapKey);

      questionService.current.setQuestionCount(rootId, 1);
      selectNode(rootId);
      expandNode(rootId);
      setShowBootstrapChat(false);
    } catch (error) {
      setConversationForNode(conversationStoreBootstrapKey, [
        { id: `${timestamp}-user`, role: 'user', text: trimmed, timestamp },
        { id: `${timestamp}-assistant`, role: 'assistant', text: '⚠️ 루트 노드 생성 중 오류가 발생했습니다.', status: 'error', timestamp: Date.now() },
      ]);

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('bootstrap_submit_failed', error);
      }
    }
  }, [conversationStoreBootstrapKey, conversationStoreRef, createClientGeneratedId, dataRef, expandNode, handleRequestAnswer, selectNode, setConversationForNode, setData, setShowBootstrapChat, extractImportantKeyword]);

  const handleSecondQuestion = useCallback(async (parentNodeId, question) => {
    const trimmedQuestion = typeof question === 'string' ? question.trim() : '';
    const latestData = dataRef.current;
    const parentNode = latestData.nodes.find((n) => n.id === parentNodeId);
    if (!parentNode) {
      return;
    }

    const keyword = await extractImportantKeyword(trimmedQuestion || question);

    const newNodeData = questionService.current.createSecondQuestionNode(
      parentNodeId,
      trimmedQuestion || question,
      '',
      latestData.nodes,
      { keyword },
    );

    if (willCreateCycle(parentNodeId, newNodeData.id)) {
      showLinkValidationMessage('사이클이 생기기 때문에 연결할 수 없습니다.');
      return;
    }

    const timestamp = Date.now();
    const initialConversation = [
      { id: `${timestamp}-user`, role: 'user', text: trimmedQuestion || question },
      { id: `${timestamp}-assistant`, role: 'assistant', text: '생각 중…', status: 'pending' },
    ];

    setConversationForNode(newNodeData.id, initialConversation);

    setData((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNodeData],
      links: [...prev.links, { source: parentNodeId, target: newNodeData.id, value: 1 }],
    }));

    questionService.current.setQuestionCount(parentNodeId, 1);
    selectNode(newNodeData.id);
    expandNode(newNodeData.id);

    try {
      const result = await handleRequestAnswer({
        node: newNodeData,
        question: trimmedQuestion,
        isRootNode: false,
      });

      const answerText = result?.answer ?? '';
      const answerMetadata = result || {};

      const updatedConversation = [
        { id: `${timestamp}-user`, role: 'user', text: trimmedQuestion || question },
        { id: `${timestamp}-assistant`, role: 'assistant', text: answerText, status: 'complete', metadata: answerMetadata },
      ];

      setConversationForNode(newNodeData.id, updatedConversation);
      setData((prev) => ({ ...prev }));
    } catch (error) {
      console.error('AI 답변 요청 실패:', error);
      const fallbackAnswer = `${parentNode.keyword || parentNode.id} 관련 질문 "${trimmedQuestion}"에 대한 답변입니다. 이는 ${parentNode.fullText || '관련된 내용'}과 연관되어 있습니다.`;

      const fallbackConversation = [
        { id: `${timestamp}-user`, role: 'user', text: trimmedQuestion || question },
        { id: `${timestamp}-assistant`, role: 'assistant', text: fallbackAnswer, status: 'complete' },
      ];

      setConversationForNode(newNodeData.id, fallbackConversation);
      setData((prev) => ({ ...prev }));
    }

    setTimeout(() => {
      const input = document.querySelector('textarea[placeholder="Ask anything..."]');
      if (input) {
        input.focus();
      }
    }, 50);
  }, [dataRef, expandNode, extractImportantKeyword, handleRequestAnswer, selectNode, setConversationForNode, setData, showLinkValidationMessage, willCreateCycle]);

  const handleAnswerComplete = useCallback(async (nodeId, payload = {}) => {
    if (!nodeId) return;

    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
    const nodeSnapshot = dataRef.current.nodes.find((n) => n.id === nodeId);

    if (!nodeSnapshot) {
      return;
    }

    const resolvedAnswer = answer || nodeSnapshot.answer || '';
    const fallbackToken = question ? question.split(/\s+/).find(Boolean) : '';

    const isPlaceholderNode = nodeSnapshot.status === 'placeholder';
    const rawSourceText = typeof nodeSnapshot.placeholder?.sourceText === 'string'
      ? nodeSnapshot.placeholder.sourceText.trim()
      : '';
    const shouldPreserveKeyword = isPlaceholderNode
      && rawSourceText.length > 0
      && !/^Placeholder\s+\d+$/i.test(rawSourceText);

    let resolvedKeyword = nodeSnapshot.keyword || '';
    if (isPlaceholderNode && question && !shouldPreserveKeyword) {
      const keywordOverride = await extractImportantKeyword(question);
      resolvedKeyword = keywordOverride || fallbackToken || resolvedKeyword;
    }

    setData((prev) => {
      const nextNodes = prev.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        return {
          ...node,
          keyword: (resolvedKeyword || node.keyword || '').slice(0, 48),
          fullText: resolvedAnswer || node.fullText || '',
          question: question || node.question || '',
          answer: resolvedAnswer || node.answer || '',
          status: 'answered',
          updatedAt: Date.now(),
        };
      });

      return {
        ...prev,
        nodes: nextNodes,
      };
    });
  }, [dataRef, extractImportantKeyword, setData]);

  const handleAnswerError = useCallback((nodeId, payload = {}) => {
    if (!nodeId) return;
    const message = payload?.error?.message || 'answer request failed';
    window.jarvisAPI?.log?.('warn', 'agent_answer_error', { nodeId, message });
  }, []);

  return {
    questionService,
    handleRequestAnswer,
    handleBootstrapSubmit,
    handleSecondQuestion,
    handleAnswerComplete,
    handleAnswerError,
  };
};

export default useHierarchicalTreeAgents;
