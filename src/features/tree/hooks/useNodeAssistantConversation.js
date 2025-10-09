import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QuestionService from 'features/tree/services/QuestionService';

const TYPING_INTERVAL_MS = 18;

const cloneConversation = (conversation = []) => (
  Array.isArray(conversation)
    ? conversation.map((message) => ({ ...message }))
    : []
);

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

const mapError = (error) => (
  error instanceof Error ? error : new Error(error?.message || '요청 처리 중 오류가 발생했습니다.')
);

export const useNodeAssistantConversation = ({
  node,
  summary,
  initialConversation,
  isRootNode,
  bootstrapMode,
  questionService: externalQuestionService,
  onConversationChange,
  onSecondQuestion,
  onRequestAnswer,
  onAnswerComplete,
  onAnswerError,
  onBootstrapFirstSend,
  onCloseNode,
}) => {
  const normalizedInitialConversation = useMemo(
    () => cloneConversation(initialConversation),
    [initialConversation],
  );

  const [messages, setMessages] = useState(() => normalizedInitialConversation);
  const questionServiceRef = useRef(externalQuestionService ?? new QuestionService());
  const typingTimersRef = useRef([]);
  const isHydratingRef = useRef(true);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    if (externalQuestionService) {
      questionServiceRef.current = externalQuestionService;
    }
  }, [externalQuestionService]);

  useEffect(() => {
    setMessages(normalizedInitialConversation);
  }, [normalizedInitialConversation]);

  const clearTypingTimers = useCallback(() => {
    typingTimersRef.current.forEach((timerId) => clearInterval(timerId));
    typingTimersRef.current = [];
  }, []);

  useEffect(() => clearTypingTimers, [clearTypingTimers]);

  const animateAssistantResponse = useCallback((assistantId, answerText, context = {}) => {
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
        typingTimersRef.current = typingTimersRef.current.filter((timer) => timer !== intervalId);
        onAnswerComplete?.(node.id, { ...context, answer: typedText });
      }
    }, TYPING_INTERVAL_MS);

    typingTimersRef.current.push(intervalId);
  }, [node.id, onAnswerComplete]);

  const sendResponse = useCallback(async (question, {
    skipSecondQuestionCheck = false,
    overrideAnswerText,
    attachments = [],
  } = {}) => {
    clearTypingTimers();

    const resolvedIsRootNode = isRootNode;
    const normalizedQuestion = typeof question === 'string' ? question.trim() : '';
    const questionText = normalizedQuestion || (typeof question === 'string' ? question : '');
    const sanitizedAttachments = Array.isArray(attachments)
      ? attachments.filter((item) => item && typeof item === 'object' && item.id)
      : [];

    const isPlaceholderNode = node?.status === 'placeholder' || Boolean(node?.placeholder);
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[useNodeAssistantConversation] sendResponse', {
        nodeId: node?.id,
        nodeStatus: node?.status,
        hasPlaceholderMeta: Boolean(node?.placeholder),
        isPlaceholderNode,
        messageCount: messages.length,
      });
    }

    let shouldCreateChild = false;
    if (!skipSecondQuestionCheck) {
      if (isPlaceholderNode) {
        shouldCreateChild = false;
      } else if (resolvedIsRootNode) {
        shouldCreateChild = questionServiceRef.current.incrementQuestionCount(node.id);
      } else {
        shouldCreateChild = true;
      }
    }

    const timestamp = Date.now();
    const userId = `${timestamp}-user`;
    const assistantId = `${timestamp}-assistant`;

    const isFirstQuestion = !messages.some((m) => m.role === 'user');

    if (isFirstQuestion || isPlaceholderNode) {
      // 첫 질문이거나 플레이스홀더 상태에서는 현재 노드에서 답변을 받는다.
      // (플레이스홀더 노드는 첫 답변 완료 후 상태가 갱신되며 이후 질문부터 자식 노드를 생성한다)
      setMessages((prev) => [
        ...prev,
        {
          id: userId,
          role: 'user',
          text: questionText,
          attachments: sanitizedAttachments.length ? sanitizedAttachments : undefined,
        },
        { id: assistantId, role: 'assistant', text: '생각 중…', status: 'pending' },
      ]);
    } else {
      if (shouldCreateChild && onSecondQuestion) {
        onCloseNode?.();
        await onSecondQuestion(node.id, question, '', {});
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: userId,
          role: 'user',
          text: questionText,
          attachments: sanitizedAttachments.length ? sanitizedAttachments : undefined,
        },
      ]);
      return;
    }

    try {
      let answerText = overrideAnswerText ?? '';
      let metadata = null;

      if (!answerText) {
        if (typeof onRequestAnswer === 'function') {
          const result = await onRequestAnswer({
            node,
            question,
            isRootNode: resolvedIsRootNode,
            shouldCreateChild: false,
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
        shouldCreateChild: false,
        isRootNode: resolvedIsRootNode,
      });
    } catch (rawError) {
      const error = mapError(rawError);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, text: `⚠️ ${error.message}`, status: 'error' }
            : message,
        ),
      );
      onAnswerError?.(node.id, {
        question,
        error,
        shouldCreateChild: false,
        isRootNode: resolvedIsRootNode,
      });
      throw error;
    }
  }, [
    animateAssistantResponse,
    clearTypingTimers,
    isRootNode,
    messages,
    node,
    onAnswerError,
    onCloseNode,
    onRequestAnswer,
    onSecondQuestion,
    summary,
  ]);

  const submitMessage = useCallback(async (input) => {
    const payload = typeof input === 'string'
      ? { text: input }
      : (input || {});

    const text = typeof payload.text === 'string' ? payload.text : '';
    const attachments = Array.isArray(payload.attachments)
      ? payload.attachments.filter((item) => item && typeof item === 'object' && item.id)
      : [];

    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) {
      return;
    }

    if (bootstrapMode) {
      const hasAnyUser = messages.some((m) => m.role === 'user');
      if (!hasAnyUser && typeof onBootstrapFirstSend === 'function') {
        const timestamp = Date.now();
        const userId = `${timestamp}-user`;
        const assistantId = `${timestamp}-assistant`;

        setMessages((prev) => [
          ...prev,
          {
            id: userId,
            role: 'user',
            text: trimmed,
            attachments: attachments.length ? attachments : undefined,
          },
          { id: assistantId, role: 'assistant', text: '생각 중…', status: 'pending' },
        ]);

        try {
          await onBootstrapFirstSend(trimmed, attachments);
        } catch (rawError) {
          const error = mapError(rawError);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                  ...message,
                  text: `⚠️ ${error.message || '루트 노드 생성 중 오류가 발생했습니다.'}`,
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

    await sendResponse(trimmed, { attachments });
  }, [bootstrapMode, messages, onBootstrapFirstSend, sendResponse]);

  useEffect(() => {
    if (!node.questionData) return;
    if (normalizedInitialConversation.length > 0) return;
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    sendResponse(node.questionData.question, {
      skipSecondQuestionCheck: true,
      overrideAnswerText: node.questionData.answer,
    }).catch(() => undefined);
  }, [node.questionData, normalizedInitialConversation.length, sendResponse]);

  useEffect(() => {
    if (isHydratingRef.current) {
      isHydratingRef.current = false;
      return;
    }
    onConversationChange?.(messages.map((message) => ({ ...message })));
  }, [messages, onConversationChange]);

  const assistantMessageCount = useMemo(
    () => messages.filter((message) => message.role === 'assistant').length,
    [messages],
  );

  const isTyping = useMemo(
    () => messages.some((message) => message.status === 'typing' || message.status === 'pending'),
    [messages],
  );

  return {
    messages,
    assistantMessageCount,
    isTyping,
    submitMessage,
    sendResponse,
  };
};

export default useNodeAssistantConversation;
