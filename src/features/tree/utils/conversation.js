const MESSAGE_LIMIT = 48;

const generateId = (prefix) => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (error) {
    // ignore crypto errors and use fallback
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
};

const normalizeTextFromContent = (content) => {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const parts = content
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }
      if (typeof item.text === 'string') {
        return item.text.trim();
      }
      if (typeof item.content === 'string') {
        return item.content.trim();
      }
      if (typeof item.value === 'string') {
        return item.value.trim();
      }
      return '';
    })
    .filter(Boolean);
  return parts.join('\n').trim();
};

const extractText = (message) => {
  const direct = typeof message.text === 'string' ? message.text.trim() : '';
  if (direct) {
    return direct;
  }
  const fromContent = normalizeTextFromContent(message.content);
  if (fromContent) {
    return fromContent;
  }
  if (typeof message.content === 'object' && message.content !== null) {
    const fallback = normalizeTextFromContent(message.content.content || message.content.value);
    if (fallback) {
      return fallback;
    }
  }
  if (typeof message.markdown === 'string') {
    return message.markdown.trim();
  }
  return '';
};

const normalizeAttachment = (attachment, fallbackId) => {
  if (!attachment || typeof attachment !== 'object') {
    return null;
  }
  const rawId = typeof attachment.id === 'string' && attachment.id.trim()
    ? attachment.id.trim()
    : null;
  const id = rawId || fallbackId;
  const dataUrl = typeof attachment.dataUrl === 'string' && attachment.dataUrl.trim()
    ? attachment.dataUrl.trim()
    : typeof attachment.url === 'string' && attachment.url.trim()
      ? attachment.url.trim()
      : typeof attachment.image_url === 'object' && attachment.image_url !== null
        && typeof attachment.image_url.url === 'string'
        ? attachment.image_url.url.trim()
        : '';
  if (!id || !dataUrl) {
    return null;
  }
  return {
    id,
    type: attachment.type || attachment.kind || 'image',
    mimeType: attachment.mimeType || attachment.mediaType || null,
    dataUrl,
    width: attachment.width,
    height: attachment.height,
    label: attachment.label || attachment.name || null,
    createdAt: attachment.createdAt ?? null,
  };
};

const extractAttachments = (message) => {
  const normalized = [];
  const seen = new Set();
  const append = (candidate) => {
    if (!candidate) {
      return;
    }
    if (seen.has(candidate.id)) {
      return;
    }
    normalized.push(candidate);
    seen.add(candidate.id);
  };

  if (Array.isArray(message.attachments)) {
    message.attachments
      .filter((item) => item && typeof item === 'object')
      .forEach((item) => {
        const normalizedAttachment = normalizeAttachment(item, generateId('attachment'));
        if (normalizedAttachment) {
          append(normalizedAttachment);
        }
      });
  }

  if (Array.isArray(message.content)) {
    message.content.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      if (item.type === 'input_image' || item.type === 'image_url') {
        const attachment = normalizeAttachment(item, generateId(`content_attachment_${index}`));
        if (attachment) {
          append(attachment);
        }
      }
    });
  }

  return normalized;
};

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
    const text = extractText(message);
    const attachments = extractAttachments(message);

    if (!text && attachments.length === 0) {
      return;
    }

    const entry = {
      role,
      text,
      content: typeof message.content === 'string' && message.content.trim()
        ? message.content.trim()
        : text,
    };

    if (attachments.length) {
      entry.attachments = attachments;
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
