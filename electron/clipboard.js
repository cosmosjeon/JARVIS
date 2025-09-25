const { clipboard } = require('electron');

const MAX_TEXT_LENGTH = 10 * 1024; // 10KB

const sanitizeText = (text) => {
  if (typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
};

const getText = () => {
  try {
    const raw = clipboard.readText();
    if (!raw) {
      return { success: false, error: { code: 'empty', message: 'Clipboard empty' } };
    }
    if (raw.length > MAX_TEXT_LENGTH) {
      return { success: false, error: { code: 'too_large', message: 'Clipboard text too large' } };
    }
    const sanitized = sanitizeText(raw);
    if (!sanitized) {
      return { success: false, error: { code: 'empty', message: 'Clipboard sanitized empty' } };
    }
    return { success: true, text: sanitized };
  } catch (error) {
    return { success: false, error: { code: 'error', message: error?.message } };
  }
};

module.exports = {
  MAX_TEXT_LENGTH,
  getText,
  sanitizeText,
};
