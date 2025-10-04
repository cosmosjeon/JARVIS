const DEFAULT_CORNER_RADIUS = 20;
const DEFAULT_NODE_PADDING = 18;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const normalizePoint = (point = {}) => ({
  x: Number(point.x) || 0,
  y: Number(point.y) || 0,
});

export const buildRoundedPath = (points, radius = DEFAULT_CORNER_RADIUS) => {
  if (!Array.isArray(points) || points.length < 2) {
    return '';
  }

  const normalized = points.map((point) => normalizePoint(point));
  let command = `M ${normalized[0].x} ${normalized[0].y}`;

  for (let index = 1; index < normalized.length; index += 1) {
    const current = { ...normalized[index] };
    const previous = normalized[index - 1];

    if (index === normalized.length - 1) {
      command += ` L ${current.x} ${current.y}`;
      continue;
    }

    const next = normalized[index + 1];
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

    normalized[index] = { x: endX, y: endY };
  }

  return command;
};

export const buildOrthogonalPath = (
  source,
  target,
  orientation = 'vertical',
  overrides = {},
) => {
  if (!source || !target) {
    return '';
  }

  const cornerRadius = overrides.cornerRadius ?? DEFAULT_CORNER_RADIUS;
  const nodePadding = overrides.nodePadding ?? DEFAULT_NODE_PADDING;
  const resolvedPadding = clamp(nodePadding, 16, 20);
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

    points = isHorizontal
      ? [
        { x: sx, y: sy },
        { x: sx + primaryDirection * advanceOffset, y: sy },
        { x: sx + primaryDirection * advanceOffset, y: sy + secondaryDirection * lateralOffset },
        { x: tx - primaryDirection * advanceOffset, y: sy + secondaryDirection * lateralOffset },
        { x: tx - primaryDirection * advanceOffset, y: ty },
        { x: tx, y: ty },
      ]
      : [
        { x: sx, y: sy },
        { x: sx, y: sy + primaryDirection * advanceOffset },
        { x: sx + secondaryDirection * lateralOffset, y: sy + primaryDirection * advanceOffset },
        { x: sx + secondaryDirection * lateralOffset, y: ty - primaryDirection * advanceOffset },
        { x: tx, y: ty - primaryDirection * advanceOffset },
        { x: tx, y: ty },
      ];
  } else {
    if (isHorizontal) {
      let midX = sx + dx / 2;
      if (Math.abs(midX - sx) < baseMargin) midX = sx + primaryDirection * baseMargin;
      if (Math.abs(tx - midX) < baseMargin) midX = tx - primaryDirection * baseMargin;

      points = [
        { x: sx, y: sy },
        { x: midX, y: sy },
        { x: midX, y: ty },
        { x: tx, y: ty },
      ];
    } else {
      let midY = sy + dy / 2;
      if (Math.abs(midY - sy) < baseMargin) midY = sy + primaryDirection * baseMargin;
      if (Math.abs(ty - midY) < baseMargin) midY = ty - primaryDirection * baseMargin;

      points = [
        { x: sx, y: sy },
        { x: sx, y: midY },
        { x: tx, y: midY },
        { x: tx, y: ty },
      ];
    }
  }

  return buildRoundedPath(points, cornerRadius);
};

export default {
  buildRoundedPath,
  buildOrthogonalPath,
};
