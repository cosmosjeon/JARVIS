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
    const attachments = Array.isArray(message.attachments)
      ? message.attachments.filter((item) => item && typeof item === 'object' && item.id)
      : [];

    if (!text && attachments.length === 0) {
      return;
    }

    const entry = { role, text };

    if (attachments.length) {
      entry.attachments = attachments.map((item) => ({
        id: item.id,
        type: item.type || 'image',
        mimeType: item.mimeType,
        dataUrl: item.dataUrl,
        width: item.width,
        height: item.height,
        label: item.label,
        createdAt: item.createdAt,
      }));
    }

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
