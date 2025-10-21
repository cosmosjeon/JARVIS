import {
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_PDF_TEXT_LENGTH,
  PDF_SUMMARY_PREVIEW_LENGTH,
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_PDF_MIME_TYPES,
  PROVIDER_CAPABILITIES,
} from 'shared/constants/attachment';
import { extractTextFromPdf } from './pdfUtils';

const trimString = (candidate) => (
  typeof candidate === 'string' ? candidate.trim() : ''
);

export const isSupportedImageMime = (mimeType = '') => (
  SUPPORTED_IMAGE_MIME_TYPES.includes((mimeType || '').toLowerCase())
);

export const isSupportedPdfMime = (mimeType = '') => (
  SUPPORTED_PDF_MIME_TYPES.includes((mimeType || '').toLowerCase())
);

export const isSupportedFile = (file) => {
  if (!file) {
    return false;
  }
  const { type, size } = file;
  if (size > MAX_ATTACHMENT_SIZE_BYTES) {
    return false;
  }
  return isSupportedImageMime(type) || isSupportedPdfMime(type);
};

export const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(file);
});

export const extractBase64FromDataUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string') {
    return { mimeType: '', base64: '' };
  }
  const matches = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!matches || matches.length < 3) {
    return { mimeType: '', base64: '' };
  }
  return {
    mimeType: trimString(matches[1]),
    base64: matches[2],
  };
};

export const buildBaseAttachment = (file, overrides = {}) => ({
  id: `upload-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  name: trimString(file?.name) || 'attachment',
  label: trimString(file?.name) || '첨부 파일',
  size: file?.size ?? 0,
  mimeType: trimString(file?.type),
  createdAt: Date.now(),
  ...overrides,
});

export const createImageAttachment = async (file) => {
  const dataUrl = await readFileAsDataUrl(file);
  return buildBaseAttachment(file, {
    type: ATTACHMENT_TYPES.IMAGE,
    dataUrl,
    ...extractBase64FromDataUrl(dataUrl),
  });
};

const normalizePdfText = (text) => {
  const trimmed = trimString(text);
  if (!trimmed) {
    return '';
  }
  if (trimmed.length <= MAX_PDF_TEXT_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_PDF_TEXT_LENGTH)}…`;
};

const buildPdfPreview = (text) => {
  const normalized = trimString(text);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= PDF_SUMMARY_PREVIEW_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, PDF_SUMMARY_PREVIEW_LENGTH)}…`;
};

export const createPdfAttachment = async (file) => {
  const [arrayBuffer, dataUrl] = await Promise.all([
    readFileAsArrayBuffer(file),
    readFileAsDataUrl(file),
  ]);
  const { textContent, pageCount } = await extractTextFromPdf(arrayBuffer);

  const normalizedText = normalizePdfText(textContent);
  return buildBaseAttachment(file, {
    type: ATTACHMENT_TYPES.PDF,
    textContent: normalizedText,
    pageCount,
    preview: buildPdfPreview(normalizedText),
    dataUrl,
    ...extractBase64FromDataUrl(dataUrl),
  });
};

export const partitionFilesBySupport = (files = []) => {
  const supported = [];
  const unsupported = [];

  files.forEach((file) => {
    if (!file) {
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES || (!isSupportedImageMime(file.type) && !isSupportedPdfMime(file.type))) {
      unsupported.push(file);
      return;
    }
    supported.push(file);
  });

  return { supported, unsupported };
};

/**
 * Provider별 첨부 파일 검증
 * @param {Object} attachment - 첨부 파일 객체
 * @param {string} provider - Provider 이름 (openai 전용)
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateAttachmentForProvider = (attachment, provider) => {
  if (!attachment || !provider) {
    return { valid: true };
  }

  const normalizedProvider = (provider || '').toLowerCase();
  const capabilities = PROVIDER_CAPABILITIES[normalizedProvider];

  if (!capabilities) {
    // Provider 정보가 없으면 기본적으로 허용
    return { valid: true };
  }

  const { type, mimeType, size, pageCount } = attachment;

  if (type === ATTACHMENT_TYPES.IMAGE || type === 'image') {
    // 이미지 형식 검증
    if (!capabilities.images.includes(mimeType)) {
      return {
        valid: false,
        error: `${provider}는 ${mimeType} 이미지 형식을 지원하지 않습니다. 지원 형식: ${capabilities.images.join(', ')}`,
      };
    }

    // 이미지 크기 검증
    if (size && size > capabilities.maxImageSize) {
      const maxSizeMB = (capabilities.maxImageSize / 1024 / 1024).toFixed(1);
      return {
        valid: false,
        error: `이미지 크기가 너무 큽니다. ${provider}는 최대 ${maxSizeMB}MB까지 지원합니다.`,
      };
    }
  } else if (type === ATTACHMENT_TYPES.PDF || type === 'pdf') {
    // PDF 형식 검증
    if (!capabilities.documents || !capabilities.documents.includes(mimeType || 'application/pdf')) {
      return {
        valid: false,
        error: `${provider}는 PDF 파일을 지원하지 않습니다.`,
      };
    }

    // PDF 크기 검증
    if (size && size > capabilities.maxDocumentSize) {
      const maxSizeMB = (capabilities.maxDocumentSize / 1024 / 1024).toFixed(1);
      return {
        valid: false,
        error: `PDF 크기가 너무 큽니다. ${provider}는 최대 ${maxSizeMB}MB까지 지원합니다.`,
      };
    }

    // PDF 페이지 수 검증
    if (pageCount && capabilities.maxDocumentPages && pageCount > capabilities.maxDocumentPages) {
      return {
        valid: false,
        error: `PDF 페이지 수가 너무 많습니다. ${provider}는 최대 ${capabilities.maxDocumentPages}페이지까지 지원합니다.`,
      };
    }
  }

  return { valid: true };
};

/**
 * 여러 첨부 파일을 Provider별로 검증
 * @param {Array} attachments - 첨부 파일 배열
 * @param {string} provider - Provider 이름
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateAttachmentsForProvider = (attachments = [], provider) => {
  const errors = [];

  attachments.forEach((attachment, index) => {
    const result = validateAttachmentForProvider(attachment, provider);
    if (!result.valid && result.error) {
      errors.push(`첨부 파일 ${index + 1}: ${result.error}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};
