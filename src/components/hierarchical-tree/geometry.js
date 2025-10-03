export const WINDOW_CHROME_HEIGHT = 48;

export const DOM_DELTA_PIXEL = 0;
export const DOM_DELTA_LINE = 1;
export const DOM_DELTA_PAGE = 2;

const ORTHO_PATH_DEFAULTS = {
  cornerRadius: 20,
  nodePadding: 18,
};

export const buildRoundedPath = (rawPoints, radius) => {
  if (!Array.isArray(rawPoints) || rawPoints.length < 2) {
    return '';
  }

  const points = rawPoints.map((point) => ({
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  }));

  let command = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const current = { ...points[index] };
    const previous = points[index - 1];

    if (index === points.length - 1) {
      command += ` L ${current.x} ${current.y}`;
      continue;
    }

    const next = points[index + 1];
    const prevVector = { x: current.x - previous.x, y: current.y - previous.y };
    const nextVector = { x: next.x - current.x, y: next.y - current.y };
    const prevLength = Math.hypot(prevVector.x, prevVector.y);
    const nextLength = Math.hypot(nextVector.x, nextVector.y);

    if (prevLength === 0 || nextLength === 0) {
      command += ` L ${current.x} ${current.y}`;
      continue;
    }

    const corner = Math.min(radius, prevLength / 2, nextLength / 2);

    if (corner <= 0) {
      command += ` L ${current.x} ${current.y}`;
      continue;
    }

    const startX = current.x - (prevVector.x / prevLength) * corner;
    const startY = current.y - (prevVector.y / prevLength) * corner;
    const endX = current.x + (nextVector.x / nextLength) * corner;
    const endY = current.y + (nextVector.y / nextLength) * corner;

    command += ` L ${startX} ${startY}`;
    command += ` Q ${current.x} ${current.y} ${endX} ${endY}`;

    points[index] = { x: endX, y: endY };
  }

  return command;
};

export const buildOrthogonalPath = (source, target, orientation = 'vertical', overrides = {}) => {
  if (!source || !target) {
    return '';
  }

  const { cornerRadius, nodePadding } = { ...ORTHO_PATH_DEFAULTS, ...overrides };
  const resolvedPadding = Math.min(Math.max(nodePadding, 16), 20);
  const baseMargin = resolvedPadding;

  const sx = Number(source.x) || 0;
  const sy = Number(source.y) || 0;
  const tx = Number(target.x) || 0;
  const ty = Number(target.y) || 0;

  const dx = tx - sx;
  const dy = ty - sy;

  const isHorizontal = orientation === 'horizontal';
  const primaryDistance = isHorizontal ? Math.abs(dx) : Math.abs(dy);
  const secondaryDistance = isHorizontal ? Math.abs(dy) : Math.abs(dx);

  const primaryDirection = (isHorizontal ? dx : dy) >= 0 ? 1 : -1;
  const secondaryDirection = (isHorizontal ? dy : dx) >= 0 ? 1 : -1;

  let points;

  if (primaryDistance < baseMargin * 2) {
    const lateralOffset = Math.max(baseMargin * 1.35, secondaryDistance / 2 || baseMargin * 1.35);
    const advanceOffset = baseMargin;

    if (isHorizontal) {
      points = [
        { x: sx, y: sy },
        { x: sx + primaryDirection * advanceOffset, y: sy },
        { x: sx + primaryDirection * advanceOffset, y: sy + secondaryDirection * lateralOffset },
        { x: tx - primaryDirection * advanceOffset, y: sy + secondaryDirection * lateralOffset },
        { x: tx - primaryDirection * advanceOffset, y: ty },
        { x: tx, y: ty },
      ];
    } else {
      points = [
        { x: sx, y: sy },
        { x: sx, y: sy + primaryDirection * advanceOffset },
        { x: sx + secondaryDirection * lateralOffset, y: sy + primaryDirection * advanceOffset },
        { x: sx + secondaryDirection * lateralOffset, y: ty - primaryDirection * advanceOffset },
        { x: tx, y: ty - primaryDirection * advanceOffset },
        { x: tx, y: ty },
      ];
    }
  } else if (isHorizontal) {
    let midX = sx + dx / 2;
    if (Math.abs(midX - sx) < baseMargin) {
      midX = sx + primaryDirection * baseMargin;
    }
    if (Math.abs(tx - midX) < baseMargin) {
      midX = tx - primaryDirection * baseMargin;
    }

    points = [
      { x: sx, y: sy },
      { x: midX, y: sy },
      { x: midX, y: ty },
      { x: tx, y: ty },
    ];
  } else {
    let midY = sy + dy / 2;
    if (Math.abs(midY - sy) < baseMargin) {
      midY = sy + primaryDirection * baseMargin;
    }
    if (Math.abs(ty - midY) < baseMargin) {
      midY = ty - primaryDirection * baseMargin;
    }

    points = [
      { x: sx, y: sy },
      { x: sx, y: midY },
      { x: tx, y: midY },
      { x: tx, y: ty },
    ];
  }

  return buildRoundedPath(points, cornerRadius);
};

export const normalizeWheelDelta = (value, mode) => {
  if (!Number.isFinite(value)) return 0;
  if (mode === DOM_DELTA_LINE) return value * 16;
  if (mode === DOM_DELTA_PAGE) return value * 120;
  return value;
};

export const getViewportDimensions = () => {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 720 - WINDOW_CHROME_HEIGHT };
  }

  return {
    width: window.innerWidth,
    height: Math.max(window.innerHeight - WINDOW_CHROME_HEIGHT, 0),
  };
};

export const calculateNodeScaleFactor = (dimensions) => {
  const BASE_WIDTH = 1024;
  const BASE_HEIGHT = 720 - WINDOW_CHROME_HEIGHT;

  const currentWidth = dimensions.width || BASE_WIDTH;
  const currentHeight = dimensions.height || BASE_HEIGHT;

  const widthScale = currentWidth / BASE_WIDTH;
  const heightScale = currentHeight / BASE_HEIGHT;
  const scaleFactor = Math.min(widthScale, heightScale);

  return Math.max(0.4, Math.min(2.0, scaleFactor));
};
