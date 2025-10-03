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

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const selection = d3.select(svgElement);
    const zoom = d3
      .zoom()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .wheelDelta((event) => {
        const modeFactor = event.deltaMode === 1 ? 0.33 : event.deltaMode ? 33 : 1;
        // Increase wheel sensitivity a bit more.
        return (-event.deltaY * modeFactor) / 600;
      })
      .on("start", () => setIsZooming(true))
      .on("zoom", (event) => {
        setViewTransform(event.transform);
      })
      .on("end", () => setIsZooming(false));

    selection.call(zoom);
    selection.on("dblclick.zoom", null);
    zoomBehaviorRef.current = zoom;

    return () => {
      selection.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!layout) {
      return;
    }

    const svgElement = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svgElement || !zoom) {
      return;
    }

    const selection = d3.select(svgElement);
    const identity = d3.zoomIdentity;
    selection.call(zoom.transform, identity);
    setViewTransform(identity);
  }, [layout]);

  const isLightTheme = theme === "light";
  const linkStroke = isLightTheme ? "rgba(71, 85, 105, 0.45)" : "rgba(148, 163, 184, 0.55)";
  const labelColor = isLightTheme ? "#0f172a" : "rgba(248, 250, 252, 0.92)";
  const labelStroke = isLightTheme ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.7)";
  const parentFill = isLightTheme ? "#1f2937" : "rgba(226, 232, 240, 0.85)";
  const leafFill = isLightTheme ? "#64748b" : "rgba(148, 163, 184, 0.82)";
  const baseStroke = isLightTheme ? "rgba(15, 23, 42, 0.3)" : "rgba(255, 255, 255, 0.25)";
  const selectedHighlight = isLightTheme ? "#f97316" : "#facc15";

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
        preserveAspectRatio="xMinYMin meet"
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
              />
            ))}
          </g>
          <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}>
            {layout.nodes.map((node) => {
              const hasChildren = Array.isArray(node.children) && node.children.length > 0;
              const isSelected = selectedNodeId && node.data.id === selectedNodeId;
              const labelText = typeof node.data?.name === "string" ? node.data.name : "";
              const estimatedWidth = estimateLabelWidth(labelText);
              const hitboxPaddingX = 14;
              const hitboxPaddingY = 12;
              const hitboxWidth = estimatedWidth + hitboxPaddingX * 2 + 8;
              const hitboxHeight = 18 + hitboxPaddingY;
              const hitboxX = hasChildren ? -hitboxWidth + hitboxPaddingX : -hitboxPaddingX;
              const hitboxY = -hitboxHeight / 2;
              const hitboxStroke = isSelected ? selectedHighlight : "transparent";

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
                    fill={hasChildren ? parentFill : leafFill}
                    r={isSelected ? 4 : 3}
                    stroke={isSelected ? selectedHighlight : baseStroke}
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
                    style={{ pointerEvents: "none" }}
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

