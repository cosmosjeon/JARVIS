import { NODE_HEIGHT, NODE_WIDTH } from "./constants";

const FONT_FAMILY = "500 14px 'Inter', 'Segoe UI', sans-serif";
const SUBTEXT_FONT = "400 11px 'Inter', 'Segoe UI', sans-serif";

export default class CanvasRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.size = { width: 0, height: 0 };
    this.viewport = { left: 0, top: 0, width: 0, height: 0 };
    this.renderRegion = null;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.scale = 1;
  }

  attachCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    if (this.canvas) {
      this.canvas.style.willChange = "transform";
      this.canvas.style.transformOrigin = "0 0";
    }
  }

  prepareRegion(region, scale = 1) {
    if (!this.canvas) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.ceil(region.width * scale));
    const displayHeight = Math.max(1, Math.ceil(region.height * scale));
    const needsResize =
      this.size.width !== displayWidth ||
      this.size.height !== displayHeight ||
      this.pixelRatio !== pixelRatio ||
      this.scale !== scale;

    this.pixelRatio = pixelRatio;
    this.scale = scale;

    if (needsResize) {
      const bufferWidth = Math.floor(displayWidth * pixelRatio);
      const bufferHeight = Math.floor(displayHeight * pixelRatio);
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;
      this.canvas.style.width = `${Math.floor(displayWidth)}px`;
      this.canvas.style.height = `${Math.floor(displayHeight)}px`;
      if (this.ctx) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      this.size = { width: displayWidth, height: displayHeight };
    }

    const offsetX = Math.floor(region.left * scale);
    const offsetY = Math.floor(region.top * scale);
    this.canvas.style.left = `${offsetX}px`;
    this.canvas.style.top = `${offsetY}px`;
    this.canvas.style.transform = "";

    this.renderRegion = region;
  }

  beginFrame(region, scale = 1) {
    if (!this.ctx) return false;
    this.viewport = region;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const effectiveScale = scale;
    const ratio = this.pixelRatio;
    this.ctx.setTransform(
      effectiveScale * ratio,
      0,
      0,
      effectiveScale * ratio,
      -region.left * effectiveScale * ratio,
      -region.top * effectiveScale * ratio
    );
    return true;
  }

  endFrame() {
    if (!this.ctx) return;
    this.ctx.restore();
  }

  drawLinks(links, nodePositions) {
    if (!this.ctx || !Array.isArray(links) || !links.length) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
    ctx.lineWidth = 1.2;
    for (const link of links) {
      const source = nodePositions.get(link.source);
      const target = nodePositions.get(link.target);
      if (!source || !target) continue;
      ctx.beginPath();
      const startX = source.x + NODE_WIDTH;
      const startY = source.y + NODE_HEIGHT / 2;
      const endX = target.x;
      const endY = target.y + NODE_HEIGHT / 2;
      const midX = (startX + endX) / 2;
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawNodes(nodes, options = {}) {
    if (!this.ctx || !Array.isArray(nodes) || !nodes.length) return;
    const ctx = this.ctx;
    const {
      highlightIds = new Set(),
      placeholder = false,
    } = options;

    for (const node of nodes) {
      this._drawNode(ctx, node, highlightIds, placeholder);
    }
  }

  _drawNode(ctx, node, highlightIds, placeholder) {
    const baseX = node.x;
    const baseY = node.y;
    const width = NODE_WIDTH;
    const height = NODE_HEIGHT;

    ctx.save();
    const isHighlighted = highlightIds.has(node.id);
    ctx.fillStyle = placeholder
      ? "rgba(30, 41, 59, 0.35)"
      : isHighlighted
      ? "rgba(96, 165, 250, 0.18)"
      : "rgba(15, 23, 42, 0.55)";
    ctx.strokeStyle = isHighlighted ? "rgba(96, 165, 250, 0.9)" : "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = isHighlighted ? 2 : 1;

    this._roundedRect(ctx, baseX, baseY, width, height, 12);

    if (!placeholder) {
      ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
      ctx.font = FONT_FAMILY;
      ctx.textBaseline = "top";
      ctx.fillText(node.label || node.id, baseX + 16, baseY + 16, width - 24);

      if (node.raw && node.raw?.fullText) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = SUBTEXT_FONT;
        const snippet = String(node.raw.raw.fullText).slice(0, 50);
        ctx.fillText(snippet, baseX + 16, baseY + 38, width - 24);
      }
    }

    ctx.restore();
  }

  _roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
