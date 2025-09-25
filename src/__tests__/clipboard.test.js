const clipboard = require('../../electron/clipboard');

describe('clipboard.sanitizeText', () => {
  it('trims whitespace and collapses empty lines', () => {
    const raw = '  첫 줄  \r\n\r\n  두 번째 줄  \n   \n세 번째 줄   ';
    const sanitized = clipboard.sanitizeText(raw);
    expect(sanitized).toBe('첫 줄\n두 번째 줄\n세 번째 줄');
  });

  it('returns empty string for non-string input', () => {
    expect(clipboard.sanitizeText(null)).toBe('');
    expect(clipboard.sanitizeText(undefined)).toBe('');
    expect(clipboard.sanitizeText(123)).toBe('');
  });
});

describe('clipboard.getText', () => {
  let readTextSpy;

  beforeEach(() => {
    readTextSpy = jest.spyOn(require('electron').clipboard, 'readText');
  });

  afterEach(() => {
    readTextSpy.mockRestore();
  });

  it('returns success with sanitized text when clipboard has content', () => {
    readTextSpy.mockReturnValue('  Alpha \n Beta  ');
    const result = clipboard.getText();
    expect(result).toEqual({ success: true, text: 'Alpha\nBeta' });
  });

  it('returns empty error when clipboard is blank after sanitize', () => {
    readTextSpy.mockReturnValue('   ');
    const result = clipboard.getText();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('empty');
  });

  it('returns too_large error when text exceeds limit', () => {
    readTextSpy.mockReturnValue('x'.repeat(clipboard.MAX_TEXT_LENGTH + 1));
    const result = clipboard.getText();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('too_large');
  });

  it('returns error code when readText throws', () => {
    readTextSpy.mockImplementation(() => {
      throw new Error('boom');
    });
    const result = clipboard.getText();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('error');
  });
});
