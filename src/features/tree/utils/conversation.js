const MESSAGE_LIMIT = 48;

export const sanitizeConversationMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  const sanitized = [];
  messages.forEach((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (!text) {
      return;
    }

    const entry = { role, text };

    if (typeof message.status === 'string' && message.status.trim()) {
      entry.status = message.status.trim();
    }

    const tsCandidate = typeof message.timestamp === 'string'
      ? Number(message.timestamp)
      : Number(message.timestamp);
    if (Number.isFinite(tsCandidate) && tsCandidate > 0) {
      entry.timestamp = tsCandidate;
    }

    if (message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)) {
      entry.metadata = message.metadata;
    }

    sanitized.push(entry);
  });

  if (sanitized.length > MESSAGE_LIMIT) {
    return sanitized.slice(sanitized.length - MESSAGE_LIMIT);
  }

  return sanitized;
};

export const buildFallbackConversation = (question, answer) => {
  const conversation = [];
  if (typeof question === 'string' && question.trim()) {
    conversation.push({ role: 'user', text: question.trim() });
  }
  if (typeof answer === 'string' && answer.trim()) {
    conversation.push({ role: 'assistant', text: answer.trim() });
  }
  return conversation;
};

export default {
  sanitizeConversationMessages,
  buildFallbackConversation,
};
