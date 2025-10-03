import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { buildTidyTreeLayout } from "../../utils/tidyTreeLayout";

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.6;

const estimateLabelWidth = (label) => {
  if (typeof label !== "string") {
    return 48;
  }
  const length = label.trim().length;
  if (length === 0) {
    return 48;
  }
  return Math.min(240, Math.max(48, length * 6.2));
};

const TidyTreeView = ({
  data,
  dimensions,
  theme = "glass",
  background,
  onNodeClick,
  selectedNodeId,
}) => {
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const [viewTransform, setViewTransform] = useState(() => d3.zoomIdentity);
  const [isZooming, setIsZooming] = useState(false);
  const textMeasureCacheRef = useRef(new Map());

  // Measure text width using canvas (fallback to estimate when unavailable)
  const getTextWidth = (text) => {
    if (typeof text !== "string") {
      return 0;
    }
    const cache = textMeasureCacheRef.current;
    if (cache.has(text)) {
      return cache.get(text);
    }
    if (!getTextWidth.ctx) {
      const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
      getTextWidth.ctx = canvas ? canvas.getContext("2d") : null;
    }
    const ctx = getTextWidth.ctx;
    if (!ctx) {
      const approx = estimateLabelWidth(text);
      cache.set(text, approx);
      return approx;
    }
    // Keep in sync with SVG font style below
    ctx.font = "10px sans-serif";
    const measured = Math.ceil(ctx.measureText(text).width);
    cache.set(text, measured);
    return measured;
  };

  const normalizedData = useMemo(
    () => ({
      nodes: Array.isArray(data?.nodes) ? data.nodes : [],
      links: Array.isArray(data?.links) ? data.links : [],
    }),
    [data],
  );

  const layout = useMemo(
    () =>
      buildTidyTreeLayout(normalizedData, {
        width: Math.max(640, Math.min(dimensions?.width || 928, 1920)),
        nodeVerticalSpacing: 20,
      }),
    [normalizedData, dimensions?.width],
  );

  const linkGenerator = useMemo(
    () => d3.linkHorizontal().x((point) => point.y).y((point) => point.x),
    [],
  );

  // Zoom behavior 초기화 및 관리
  useEffect(() => {
    const svgElement = svgRef.current;

    // SVG와 layout이 모두 준비될 때까지 대기
    if (!svgElement || !layout) {
      return;
    }

    const selection = d3.select(svgElement);
    const zoom = d3
      .zoom()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .wheelDelta((event) => {
        const modeFactor = event.deltaMode === 1 ? 0.33 : event.deltaMode ? 33 : 1;
        return (-event.deltaY * modeFactor) / 600;
      })
      .on("start", () => setIsZooming(true))
      .on("zoom", (event) => {
        setViewTransform(event.transform);
      })
      .on("end", () => setIsZooming(false));

    // Zoom behavior 적용
    selection.call(zoom);
    selection.on("dblclick.zoom", null);
    zoomBehaviorRef.current = zoom;

    // Layout 변경 시 transform을 identity로 리셋
    const identity = d3.zoomIdentity;
    selection.call(zoom.transform, identity);
    setViewTransform(identity);

    return () => {
      selection.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, [layout]);

  const isLightTheme = theme === "light";
  const linkStroke = isLightTheme ? "rgba(71, 85, 105, 0.45)" : "rgba(148, 163, 184, 0.55)";
  const labelColor = isLightTheme ? "#0f172a" : "rgba(248, 250, 252, 0.92)";
  const labelStroke = isLightTheme ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.7)";
  const parentFill = isLightTheme ? "#1f2937" : "rgba(226, 232, 240, 0.85)";
  const leafFill = isLightTheme ? "#64748b" : "rgba(148, 163, 184, 0.82)";
  const baseStroke = isLightTheme ? "rgba(15, 23, 42, 0.3)" : "rgba(255, 255, 255, 0.25)";
  const selectionStroke = isLightTheme ? "rgba(30, 64, 175, 0.7)" : "rgba(226, 232, 240, 0.75)";

  const handleNodeActivate = (node) => {
    if (typeof onNodeClick === "function" && node?.data?.id) {
      onNodeClick({ id: node.data.id, source: "tidy-tree" });
    }
  };

  if (!layout) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm"
        style={{ color: labelColor, background: background || "transparent" }}
      >
        No hierarchical nodes to display.
      </div>
    );
  }

  const transformString = `translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`;

  return (
    <div
      className="absolute inset-0"
      data-interactive-zone="true"
      style={{ background: background || "transparent" }}
    >
      <svg
        ref={svgRef}
        width={layout.width}
        height={layout.height}
        viewBox={`${layout.viewBox[0]} ${layout.viewBox[1]} ${layout.viewBox[2]} ${layout.viewBox[3]}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          font: "10px sans-serif",
          cursor: isZooming ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <g transform={transformString}>
          <g fill="none" stroke={linkStroke} strokeOpacity={0.6} strokeWidth={1.5}>
            {layout.links.map((link) => (
              <path
                key={`${link.source.data.id}->${link.target.data.id}`}
                d={linkGenerator(link)}
                vectorEffect="non-scaling-stroke"
                onClick={(event) => {
                  event.stopPropagation();
                  handleNodeActivate(link.target);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  handleNodeActivate(link.target);
                }}
                style={{ cursor: "pointer" }}
              />
            ))}
          </g>
          <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}>
            {layout.nodes.map((node) => {
              const hasChildren = Array.isArray(node.children) && node.children.length > 0;
              const isSelected = selectedNodeId && node.data.id === selectedNodeId;
              const labelText = typeof node.data?.name === "string" ? node.data.name : "";
              const measuredWidth = getTextWidth(labelText);
              const hitboxPaddingY = 6;
              const baseRadius = isSelected ? 4 : 3;
              const interactiveRadius = baseRadius + 3;
              const labelSpacing = 8;
              const textWidth = Math.max(0, measuredWidth);
              const leftExtent = hasChildren
                ? -(textWidth + labelSpacing + interactiveRadius)
                : -interactiveRadius;
              const rightExtent = hasChildren
                ? interactiveRadius
                : textWidth + labelSpacing + interactiveRadius;
              const hitboxWidth = Math.max(interactiveRadius * 2, rightExtent - leftExtent);
              const hitboxHeight = (baseRadius + hitboxPaddingY) * 2;
              const hitboxX = leftExtent;
              const hitboxY = -(hitboxHeight / 2);
              const hitboxStroke = isSelected ? selectionStroke : "transparent";

              return (
                <g
                  key={node.data.id}
                  transform={`translate(${node.y},${node.x})`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNodeActivate(node);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    handleNodeActivate(node);
                  }}
                  style={{ cursor: onNodeClick ? "pointer" : "default" }}
                >
                  <rect
                    x={hitboxX}
                    y={hitboxY}
                    width={hitboxWidth}
                    height={hitboxHeight}
                    rx={6}
                    ry={6}
                    fill="transparent"
                    stroke={hitboxStroke}
                    strokeWidth={isSelected ? 1.5 : 0}
                    style={{ pointerEvents: "all" }}
                  />
                  <circle
                    r={interactiveRadius}
                    fill="transparent"
                    stroke="transparent"
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: "all" }}
                  />
                  <circle
                    fill={hasChildren ? parentFill : leafFill}
                    r={baseRadius}
                    stroke={isSelected ? selectionStroke : baseStroke}
                    strokeWidth={isSelected ? 2 : 1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    dy="0.31em"
                    x={hasChildren ? -8 : 8}
                    textAnchor={hasChildren ? "end" : "start"}
                    fill={labelColor}
                    stroke={labelStroke}
                    strokeWidth={2}
                    paintOrder="stroke"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
};

export default TidyTreeView;

