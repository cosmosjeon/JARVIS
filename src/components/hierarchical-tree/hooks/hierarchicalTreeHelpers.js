export const hydrateConversationStore = (
  conversationStoreRef,
  incomingNodes = [],
  sanitizeConversationMessages,
  buildFallbackConversation,
) => {
  conversationStoreRef.current.clear();

  incomingNodes.forEach((node) => {
    if (!node || !node.id) {
      return;
    }

    const baseConversation = sanitizeConversationMessages(node.conversation);
    const fallbackConversation = baseConversation.length
      ? baseConversation
      : buildFallbackConversation(
        node.question || node.questionData?.question,
        node.answer || node.questionData?.answer || node.fullText,
      );

    conversationStoreRef.current.set(node.id, fallbackConversation);
  });
};

export const toggleWindowMousePassthrough = (shouldIgnore = true, isIgnoringMouseRef) => {
  if (typeof window === 'undefined') {
    return;
  }

  const api = window.jarvisAPI;
  if (!api || typeof api.setMousePassthrough !== 'function') {
    return;
  }

  if (isIgnoringMouseRef.current === shouldIgnore) {
    return;
  }

  try {
    const result = api.setMousePassthrough({ ignore: shouldIgnore, forward: true });
    isIgnoringMouseRef.current = shouldIgnore;
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        isIgnoringMouseRef.current = !shouldIgnore;
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('마우스 패스스루 설정 실패:', error);
    }
  }
};
