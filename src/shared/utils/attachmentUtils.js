import {
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_PDF_TEXT_LENGTH,
  PDF_SUMMARY_PREVIEW_LENGTH,
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_PDF_MIME_TYPES,
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
