import {
  BLOCK_DEFINITIONS,
} from 'features/tree/ui/tree2/editor/blockTypes';
import { getBlockAtPath } from 'features/tree/ui/tree2/editor/blockUtils';

export const sanitizeHtmlInput = (html) => {
  if (!html) return '';
  return html
    .replace(/<div><br><\/div>/g, '<br>')
    .replace(/<div>/g, '<br>')
    .replace(/<\/div>/g, '')
    .replace(/\u00a0/g, ' ');
};

export const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const decodeHtml = (value) => {
  if (!value) return '';
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return value
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }
  const div = document.createElement('div');
  div.innerHTML = value;
  return div.textContent || div.innerText || '';
};

const blocksToPlainTextInternal = (blocks, depth = 0) => {
  return blocks
    .map((block) => {
      const definition = BLOCK_DEFINITIONS[block.type];
      const indent = depth > 0 ? `${' '.repeat(depth * 2)}- ` : '';
      const text = stripHtml(block.html || '');
      const childrenText = block.children?.length
        ? `\n${blocksToPlainTextInternal(block.children, depth + 1)}`
        : '';
      return `${indent}${definition?.label || ''}${text ? `: ${text}` : ''}${childrenText}`;
    })
    .join('\n');
};

export const blocksToPlainText = (blocks) => blocksToPlainTextInternal(blocks);

export const findDeepestDescendantId = (block) => {
  if (!block?.children || block.children.length === 0) {
    return block?.id || null;
  }
  return findDeepestDescendantId(block.children[block.children.length - 1]);
};

export const getPreviousBlockId = (blocks, path) => {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }
  const index = path[path.length - 1];
  if (index > 0) {
    const prevPath = [...path];
    prevPath[prevPath.length - 1] = index - 1;
    let prevBlock = getBlockAtPath(blocks, prevPath);
    return findDeepestDescendantId(prevBlock);
  }
  if (path.length > 1) {
    return getPreviousBlockId(blocks, path.slice(0, -1));
  }
  return null;
};

export const getNextBlockId = (blocks, path) => {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }
  const index = path[path.length - 1];
  const nextPath = [...path];
  nextPath[nextPath.length - 1] = index + 1;
  const sibling = getBlockAtPath(blocks, nextPath);
  if (sibling) {
    return sibling.id;
  }
  if (path.length > 1) {
    return getNextBlockId(blocks, path.slice(0, -1));
  }
  return null;
};
