import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { buildTidyTreeLayout } from "../../utils/tidyTreeLayout";
import DragStateManager from "../../services/drag/DragStateManager";
import InsertionCalculator from "../../services/drag/InsertionCalculator";
import PreviewLayoutCalculator from "../../services/drag/PreviewLayoutCalculator";
import SiblingReorderService from "../../services/drag/SiblingReorderService";

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.6;
const VIRTUAL_ROOT_ID = '__virtual_root__';

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
  onReorderSiblings,
}) => {
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const isInitialMountRef = useRef(true);
  const [viewTransform, setViewTransform] = useState(() => d3.zoomIdentity);
  const [isZooming, setIsZooming] = useState(false);
  const textMeasureCacheRef = useRef(new Map());

  // 드래그 관련 서비스 인스턴스
  const dragStateManager = useRef(new DragStateManager()).current;
  const insertionCalculator = useRef(new InsertionCalculator()).current;
  const previewLayoutCalculator = useRef(new PreviewLayoutCalculator()).current;
  const siblingReorderService = useRef(new SiblingReorderService()).current;

  // 드래그 미리보기 상태
  const [dragPreview, setDragPreview] = useState(null);

  // Measure text width using canvas
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

  // 컴포넌트 언마운트 시 드래그 상태 정리
  useEffect(() => {
    return () => {
      if (dragStateManager.isDragging()) {
        dragStateManager.endDrag();
        setDragPreview(null);
      }
    };
  }, [dragStateManager]);

  // Zoom behavior 초기화 및 관리
  useEffect(() => {
    const svgElement = svgRef.current;

    if (!svgElement || !layout) {
      return;
    }

    const selection = d3.select(svgElement);
    const zoom = d3
      .zoom()
      .filter((event) => {
        // 노드 드래그 중에는 줌/팬 비활성화
        if (dragStateManager.isDragging()) return false;
        // 노드 영역에서 시작된 이벤트면 줌/팬 비활성화
        const t = event?.target;
        if (t && typeof t.closest === "function") {
          if (t.closest('g[data-node-interactive="true"]')) return false;
        }
        return !event.ctrlKey && event.button !== 2;
      })
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

    selection.call(zoom);
    selection.on("dblclick.zoom", null);
    zoomBehaviorRef.current = zoom;

    // 초기 마운트 시에만 identity로 리셋 (이후 layout 변경 시에는 현재 transform 유지)
    if (isInitialMountRef.current) {
      const identity = d3.zoomIdentity;
      selection.call(zoom.transform, identity);
      setViewTransform(identity);
      isInitialMountRef.current = false;
    }

    return () => {
      selection.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, [layout, dragStateManager]);

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

  // 드래그 시작
  const beginDrag = (event, node) => {
    event.preventDefault();
    event.stopPropagation();

    const parent = node.parent;

    // 부모가 없으면 드래그 불가
    if (!parent) {
      return;
    }

    // 형제노드가 없으면 드래그 불가 (단일 루트 포함)
    if (!Array.isArray(parent.children) || parent.children.length <= 1) {
      return;
    }

    // 부모가 가상 루트이거나 일반 노드인 경우 모두 드래그 가능
    dragStateManager.startDrag(node, event.clientX, event.clientY, parent);

    // 전역 마우스 이벤트 리스너 추가
    const handleGlobalMouseMove = (e) => handleDragMove(e);
    const handleGlobalMouseUp = (e) => {
      endDrag(e);
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);
  };

  // 브라우저 좌표를 SVG 좌표로 변환
  const clientToSvgY = (clientY) => {
    const svg = svgRef.current;
    if (!svg) return clientY;

    const pt = svg.createSVGPoint();
    pt.x = 0;
    pt.y = clientY;

    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

    // viewTransform 적용 (zoom/pan 고려)
    const transformedY = (svgP.y - viewTransform.y) / viewTransform.k;

    return transformedY;
  };

  // 드래그 중
  const handleDragMove = (event) => {
    const dragState = dragStateManager.getDragState();
    if (!dragState) return;

    event.preventDefault();
    event.stopPropagation();

    const { node, parentNode } = dragState;
    const siblings = parentNode.children || [];

    // 브라우저 좌표를 SVG 좌표로 변환
    const svgY = clientToSvgY(event.clientY);

    // 삽입 위치 계산
    const { insertIndex, isValidDrop } = insertionCalculator.calculateInsertPosition(
      siblings,
      node,
      svgY,
    );

    if (!isValidDrop) {
      setDragPreview(null);
      return;
    }

    // 미리보기 레이아웃 계산
    const { previewNodes } = previewLayoutCalculator.calculatePreviewLayout(
      siblings,
      node,
      insertIndex,
    );

    setDragPreview({
      active: true,
      nodes: previewNodes,
    });
  };

  // 드래그 종료
  const endDrag = (event) => {
    const dragState = dragStateManager.getDragState();
    if (!dragState) return;

    const { node, parentNode } = dragState;
    const siblings = parentNode.children || [];

    // 브라우저 좌표를 SVG 좌표로 변환
    const svgY = clientToSvgY(event.clientY);

    // 삽입 위치 계산
    const { insertIndex, isValidDrop } = insertionCalculator.calculateInsertPosition(
      siblings,
      node,
      svgY,
    );

    // 유효한 드롭이면 순서 변경
    if (isValidDrop && typeof onReorderSiblings === "function") {
      const sorted = siblings
        .map((s, i) => ({ node: s, index: i, y: s.x }))
        .sort((a, b) => a.y - b.y);

      const currentIndex = sorted.findIndex((s) => s.node === node);

      if (currentIndex !== -1) {
        const orderedIds = siblingReorderService.reorder(siblings, currentIndex, insertIndex);
        onReorderSiblings(parentNode.data.id, orderedIds);
      }
    }

    // 드래그 상태 초기화
    dragStateManager.endDrag();
    setDragPreview(null);
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
              // 미리보기 상태 확인
              const previewNode = dragPreview?.nodes?.find((p) => p.id === node.data.id);

              // 미리보기가 있으면 미리보기 위치와 투명도 사용
              // 트리1: node.y = 실제 X좌표, node.x = 실제 Y좌표
              // previewNode.x = 미리보기 X좌표, previewNode.y = 미리보기 Y좌표
              const displayX = previewNode ? previewNode.x : node.y; // SVG X (가로)
              const displayY = previewNode ? previewNode.y : node.x; // SVG Y (세로)
              const opacity = previewNode ? previewNode.opacity : 1.0;
              const isDragged = previewNode?.isDragged || false;

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
                  transform={`translate(${displayX},${displayY})`}
                  opacity={opacity}
                  data-node-interactive="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNodeActivate(node);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    handleNodeActivate(node);
                  }}
                  onMouseDown={(event) => beginDrag(event, node)}
                  style={{
                    cursor: onNodeClick ? "pointer" : "default",
                    transition: previewNode
                      ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out"
                      : "none",
                  }}
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
