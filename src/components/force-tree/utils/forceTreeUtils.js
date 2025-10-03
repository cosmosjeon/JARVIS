import * as d3 from 'd3';

export const NODE_COLOR_PALETTE = (d3.schemeTableau10 && d3.schemeTableau10.length ? d3.schemeTableau10 : d3.schemeCategory10);

export const DEFAULT_CONTEXT_MENU_STATE = {
  open: false,
  x: 0,
  y: 0,
  nodeId: null,
  nodeType: null,
  sceneX: 0,
  sceneY: 0,
};

export const DEFAULT_NODE_SIZE_STATE = {
  isOpen: false,
  nodeId: null,
  sizeValue: 50, // 0-100 범위, 기본값 50
};

export const NODE_SHAPES = {
  RECTANGLE: 'rectangle',
  DOT: 'dot',
  ELLIPSE: 'ellipse',
  DIAMOND: 'diamond',
};

export const getNodeDatum = (node) => {
  if (!node) {
    return {};
  }

  const hierarchyPayload = node.data || {};
  if (hierarchyPayload && typeof hierarchyPayload === 'object' && hierarchyPayload.data) {
    return hierarchyPayload.data || {};
  }

  return hierarchyPayload;
};

export const getNodeId = (node) => {
  if (!node) return null;
  const hierarchyPayload = node.data || {};
  return hierarchyPayload.id || getNodeDatum(node).id || node.id || null;
};

export const sanitizeText = (value) => {
  if (typeof value !== 'string') {
    if (value === null || value === undefined) return '';
    return String(value);
  }
  return value;
};

export const extractNodeHoverText = (nodeData = {}) => {
  const memoTitle = sanitizeText(nodeData?.memo?.title).trim();
  if (memoTitle) {
    return memoTitle;
  }

  const memoContent = sanitizeText(nodeData?.memo?.content).trim();
  if (memoContent) {
    return memoContent;
  }

  const question = sanitizeText(nodeData?.questionData?.question).trim();
  if (question) {
    return question;
  }

  const keyword = sanitizeText(nodeData.keyword).trim();
  if (keyword) {
    return keyword;
  }

  const fullText = sanitizeText(nodeData.fullText).trim();
  if (fullText) {
    return fullText;
  }

  const name = sanitizeText(nodeData.name).trim();
  if (name) {
    return name;
  }

  const id = sanitizeText(nodeData.id).trim();
  if (id) {
    return id;
  }

  return '';
};

export const computeHoverLines = (text, maxCharsPerLine = 28, maxLines = 3) => {
  const normalized = sanitizeText(text).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const lines = [];
  let remaining = normalized;

  for (let i = 0; i < maxLines && remaining.length > 0; i += 1) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      remaining = '';
      break;
    }

    let sliceEnd = remaining.lastIndexOf(' ', maxCharsPerLine);
    if (sliceEnd <= 0) {
      sliceEnd = maxCharsPerLine;
    }

    const line = remaining.slice(0, sliceEnd).trim();
    if (line) {
      lines.push(line);
    }

    remaining = remaining.slice(sliceEnd).trim();
  }

  if (remaining.length > 0 && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${lines[lastIndex].replace(/[.…]*$/, '')}…`;
  }

  return lines;
};

export const computeTooltipDimensions = (lines) => {
  if (!lines || lines.length === 0) {
    return { width: 0, height: 0 };
  }

  const horizontalPadding = 28;
  const verticalPadding = 18;
  const charWidthEstimate = 9;
  const lineHeight = 18;

  const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const rawWidth = longestLineLength * charWidthEstimate + horizontalPadding;
  const width = Math.min(280, Math.max(140, rawWidth));
  const height = lines.length * lineHeight + verticalPadding;

  return { width, height };
};

export const normalizeLinkEndpoint = (endpoint) => {
  if (!endpoint) {
    return null;
  }

  if (typeof endpoint === 'string' || typeof endpoint === 'number') {
    return String(endpoint);
  }

  if (typeof endpoint === 'object') {
    if (endpoint.id) {
      return String(endpoint.id);
    }
    if (endpoint.data && endpoint.data.id) {
      return String(endpoint.data.id);
    }
  }

  return null;
};
