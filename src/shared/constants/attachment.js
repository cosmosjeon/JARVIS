export const SUPPORTED_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const SUPPORTED_PDF_MIME_TYPES = Object.freeze([
  'application/pdf',
]);

export const SUPPORTED_FILE_EXTENSIONS = Object.freeze([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.pdf',
]);

export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_PDF_TEXT_LENGTH = 60_000;
export const PDF_SUMMARY_PREVIEW_LENGTH = 400;

export const ATTACHMENT_TYPES = Object.freeze({
  IMAGE: 'image',
  PDF: 'pdf',
});

export const ATTACHMENT_ERROR_MESSAGES = Object.freeze({
  unsupportedType: '지원되지 않는 파일 형식입니다. 이미지 또는 PDF 파일을 첨부해 주세요.',
  fileTooLarge: '파일 용량이 너무 큽니다. 15MB 이하의 파일만 첨부할 수 있습니다.',
  pdfParseFailed: 'PDF 내용을 읽는 중 오류가 발생했습니다.',
});

// Provider별 첨부 파일 지원 매트릭스
export const PROVIDER_CAPABILITIES = Object.freeze({
  openai: {
    images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    documents: ['application/pdf'], // GPT-5/4o는 PDF 직접 지원
    maxImageSize: 20 * 1024 * 1024, // 20MB
    maxDocumentSize: 32 * 1024 * 1024, // 32MB
    maxDocumentPages: 100,
  },
});
