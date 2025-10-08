import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { buildTidyTreeLayout } from 'shared/utils/tidyTreeLayout';
import DragStateManager from 'features/tree/services/drag/DragStateManager';
import InsertionCalculator from 'features/tree/services/drag/InsertionCalculator';
import PreviewLayoutCalculator from 'features/tree/services/drag/PreviewLayoutCalculator';
import SiblingReorderService from 'features/tree/services/drag/SiblingReorderService';

const MIN_SCALE = 0.18;
const MAX_SCALE = 2.6;
const VIRTUAL_ROOT_ID = '__virtual_root__';
const DEFAULT_TREE_KEY = '__default_tree__';
const VIEWPORT_STORAGE_PREFIX = 'tidyTreeView.viewTransform';

const buildTransformStorageKey = (treeKey) => `${VIEWPORT_STORAGE_PREFIX}.${treeKey}`;

const readStoredTransform = (storageKey) => {
  if (typeof window === 'undefined' || !storageKey) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y) || !Number.isFinite(parsed?.k)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
};

const persistTransform = (storageKey, transform) => {
  if (typeof window === 'undefined' || !storageKey || !transform) {
    return;
  }
  try {
    const payload = JSON.stringify({ x: transform.x, y: transform.y, k: transform.k });
    window.localStorage.setItem(storageKey, payload);
  } catch (error) {
    // ignore persistence failures
  }
};

const toZoomTransform = (rawTransform) => {
  if (!rawTransform || !Number.isFinite(rawTransform.x) || !Number.isFinite(rawTransform.y) || !Number.isFinite(rawTransform.k)) {
    return null;
  }
  return d3.zoomIdentity.translate(rawTransform.x, rawTransform.y).scale(rawTransform.k);
};

// Calculate a zoom transform that fits the entire hierarchy snugly inside the viewport
// while keeping the tree centered.
const computeDefaultTransform = (layout, viewportDimensions) => {
  if (!layout || !Array.isArray(layout.nodes) || layout.nodes.length === 0) {
    return null;
  }

  const nodes = layout.nodes.filter((node) => {
    if (!node) return false;
    const nodeId = node.data?.id;
    if (nodeId === VIRTUAL_ROOT_ID) {
      return false;
    }
    return true;
  });
  if (nodes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const { x, y } = node;
    if (Number.isFinite(x)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    if (Number.isFinite(y)) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null;
  }

  const viewportWidth = Number.isFinite(viewportDimensions?.width)
    ? Math.max(1, viewportDimensions.width)
    : Math.max(1, layout?.width || 0);
  const viewportHeight = Number.isFinite(viewportDimensions?.height)
    ? Math.max(1, viewportDimensions.height)
    : Math.max(1, layout?.height || 0);

  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }

  const horizontalPadding = Number.isFinite(layout?.dy) ? layout.dy * 1.2 : 80;
  const verticalPadding = Number.isFinite(layout?.dx) ? layout.dx * 1.2 : 80;

  const contentWidth = Math.max(1, (maxY - minY) + horizontalPadding * 2);
  const contentHeight = Math.max(1, (maxX - minX) + verticalPadding * 2);

  const scaleX = viewportWidth / contentWidth;
  const scaleY = viewportHeight / contentHeight;
  const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)));

  // 바운딩 박스 중심 기준 기본 이동값 계산
  const rootNode = nodes.find((node) => node.depth === 0) || null;
  const rootX = Number.isFinite(rootNode?.y) ? rootNode.y : (minY + maxY) / 2;
  const rootY = Number.isFinite(rootNode?.x) ? rootNode.x : (minX + maxX) / 2;

  const translateX = viewportWidth / 2 - rootX * targetScale;
  const translateY = viewportHeight / 2 - rootY * targetScale;

  if (!Number.isFinite(translateX) || !Number.isFinite(translateY) || !Number.isFinite(targetScale)) {
    return null;
  }

  return d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);
};

const estimateLabelWidth = (label) => {
  if (typeof label !== "string") {
    return 48;
  }
  const length = label.trim().length;
  if (length === 0) {
    return 48;
  }
  return Math.min(240, Math.max(48, length * 6.8));
};

const TidyTreeView = ({
  data,
  dimensions,
  theme = "glass",
  background,
  onNodeClick,
  selectedNodeId,
  activeTreeId,
  onBackgroundClick,
  onReorderSiblings,
  disableAutoFocus = false,
}) => {
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const isInitialMountRef = useRef(true);
  const [viewTransform, setViewTransform] = useState(() => d3.zoomIdentity);
  const [isZooming, setIsZooming] = useState(false);
  const textMeasureCacheRef = useRef(new Map());
  const nodesGroupRef = useRef(null);
  const linksGroupRef = useRef(null);
  const previousLayoutRef = useRef(null);
  const lastViewTransformRef = useRef(null);
  const lastAppliedTreeIdRef = useRef(null);
  const storageKeyRef = useRef(null);

  // 드래그 관련 서비스 인스턴스
  const dragStateManager = useRef(new DragStateManager()).current;
  const insertionCalculator = useRef(new InsertionCalculator()).current;
  const previewLayoutCalculator = useRef(new PreviewLayoutCalculator()).current;
  const siblingReorderService = useRef(new SiblingReorderService()).current;

  // 드래그 미리보기 상태
  const [dragPreview, setDragPreview] = useState(null);
  
  // 호버 상태
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

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
    ctx.font = "11px sans-serif";
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

  // 부모 관계 맵 생성
  const parentById = useMemo(() => {
    const map = new Map();
    if (!layout?.nodes) return map;
    layout.nodes.forEach((node) => {
      if (node.parent) {
        map.set(node.data.id, node.parent.data.id);
      }
    });
    return map;
  }, [layout?.nodes]);

  // 호버된 노드의 조상 체인 계산
  const hoveredAncestorIds = useMemo(() => {
    if (!hoveredNodeId) {
      return new Set();
    }
    const result = new Set();
    let currentId = hoveredNodeId;
    while (currentId) {
      result.add(currentId);
      currentId = parentById.get(currentId);
    }
    return result;
  }, [hoveredNodeId, parentById]);
  
  const isHighlightMode = hoveredAncestorIds.size > 0;

  // 컴포넌트 언마운트 시 드래그 상태 정리
  useEffect(() => {
    return () => {
      if (dragStateManager.isDragging()) {
        dragStateManager.endDrag();
        setDragPreview(null);
      }
    };
  }, [dragStateManager]);

  // D3 transition으로 노드와 링크 애니메이션
  useLayoutEffect(() => {
    if (!layout || !nodesGroupRef.current || !linksGroupRef.current) {
      return;
    }

    // 드래그 중에는 CSS transition 사용, D3 transition 비활성화
    if (dragPreview?.active) {
      return;
    }

    const ANIMATION_DURATION = 300;
    const previousLayout = previousLayoutRef.current;
    const shouldAnimate = previousLayout !== null && !isInitialMountRef.current;

    if (shouldAnimate) {
      // 1단계: 이전 위치로 즉시 되돌림 (브라우저 paint 전)
      d3.select(linksGroupRef.current)
        .selectAll('path')
        .each(function () {
          const key = d3.select(this).attr('data-link-key');
          if (!key) return;

          const prevLink = previousLayout.links.find(l =>
            `${l.source.data.id}->${l.target.data.id}` === key
          );
          if (prevLink) {
            d3.select(this).attr('d', linkGenerator(prevLink));
          }
        });

      d3.select(nodesGroupRef.current)
        .selectAll('g[data-node-id]')
        .each(function () {
          const nodeId = d3.select(this).attr('data-node-id');
          if (!nodeId) return;

          const prevNode = previousLayout.nodes.find(n => n.data.id === nodeId);
          if (prevNode) {
            d3.select(this).attr('transform', `translate(${prevNode.y},${prevNode.x})`);
          }
        });

      // 2단계: 새 위치로 transition
      d3.select(linksGroupRef.current)
        .selectAll('path')
        .transition()
        .duration(ANIMATION_DURATION)
        .ease(d3.easeCubicInOut)
        .attr('d', function () {
          const key = d3.select(this).attr('data-link-key');
          if (!key) return d3.select(this).attr('d');

          const link = layout.links.find(l =>
            `${l.source.data.id}->${l.target.data.id}` === key
          );
          return link ? linkGenerator(link) : d3.select(this).attr('d');
        });

      d3.select(nodesGroupRef.current)
        .selectAll('g[data-node-id]')
        .transition()
        .duration(ANIMATION_DURATION)
        .ease(d3.easeCubicInOut)
        .attr('transform', function () {
          const nodeId = d3.select(this).attr('data-node-id');
          if (!nodeId) return d3.select(this).attr('transform');

          const node = layout.nodes.find(n => n.data.id === nodeId);
          if (!node) return d3.select(this).attr('transform');

          return `translate(${node.y},${node.x})`;
        });
    }

    previousLayoutRef.current = layout;
  }, [layout, linkGenerator, dragPreview]);

  // 기본 뷰포트로 복원하는 함수
  const resetToDefaultView = () => {};

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
        if (dragStateManager.isDragging()) return false;
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
        lastViewTransformRef.current = event.transform;
        const storageKey = storageKeyRef.current;
        if (storageKey) {
          persistTransform(storageKey, event.transform);
        }
      })
      .on("end", () => setIsZooming(false));

    selection.call(zoom);

    const treeKey = typeof activeTreeId === "string" && activeTreeId.trim().length > 0
      ? activeTreeId
      : DEFAULT_TREE_KEY;
    const storageKey = buildTransformStorageKey(treeKey);
    storageKeyRef.current = storageKey;

    const defaultTransform = computeDefaultTransform(layout, dimensions) || d3.zoomIdentity;
    const storedTransform = readStoredTransform(storageKey);
    const storedZoom = toZoomTransform(storedTransform);
    const initialTransform = storedZoom || lastViewTransformRef.current || defaultTransform;
    lastViewTransformRef.current = initialTransform;

    zoomBehaviorRef.current = zoom;

    const shouldApplyInitial = isInitialMountRef.current || lastAppliedTreeIdRef.current !== treeKey;

    if (shouldApplyInitial) {
      selection.call(zoom.transform, initialTransform);
      lastAppliedTreeIdRef.current = treeKey;
      isInitialMountRef.current = false;
      if (!storedZoom && storageKey) {
        persistTransform(storageKey, initialTransform);
      }
    }

    return () => {
      selection.on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, [layout, dragStateManager, activeTreeId, dimensions?.width, dimensions?.height]);

  const isLightTheme = theme === "light";
  const linkStroke = isLightTheme ? "rgba(100, 116, 139, 0.95)" : "rgba(148, 163, 184, 0.95)";
  const labelColor = isLightTheme ? "#0f172a" : "#e2e8f0";
  const labelStroke = isLightTheme ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.7)";
  const parentFill = isLightTheme ? "rgba(59, 130, 246, 0.88)" : "rgba(125, 211, 252, 0.95)";
  const leafFill = isLightTheme ? "rgba(148, 163, 184, 0.88)" : "rgba(148, 163, 184, 0.92)";
  const baseStroke = isLightTheme ? "rgba(59, 130, 246, 0.3)" : "rgba(125, 211, 252, 0.3)";
  const selectionStroke = isLightTheme ? "rgba(37, 99, 235, 0.9)" : "rgba(125, 211, 252, 0.9)";

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
          font: "11px sans-serif",
          cursor: isZooming ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onClick={(event) => {
          // SVG 배경 클릭 (노드나 링크가 아닌 경우)
          const target = event.target;
          if (target === svgRef.current || target.tagName === 'g') {
            if (typeof onBackgroundClick === "function") {
              onBackgroundClick();
            }
          }
        }}
      >
        <defs>
          <style>
            {`
              @keyframes pulse {
                0%, 100% {
                  opacity: 0.6;
                  transform: scale(1);
                }
                50% {
                  opacity: 0.3;
                  transform: scale(1.15);
                }
              }
            `}
          </style>
        </defs>
        <g transform={transformString}>
          <g
            ref={linksGroupRef}
            fill="none"
          >
            {layout.links.map((link) => {
              const linkKey = `${link.source.data.id}->${link.target.data.id}`;
              const linkSourceId = link.source.data.id;
              const linkTargetId = link.target.data.id;
              const isHighlightedLink = !isHighlightMode
                || (hoveredAncestorIds.has(linkTargetId)
                  && parentById.get(linkTargetId) === linkSourceId);
              const linkOpacity = isHighlightedLink ? 1 : 0.15;
              
              return (
                <path
                  key={linkKey}
                  data-link-key={linkKey}
                  d={linkGenerator(link)}
                  stroke={linkStroke}
                  strokeOpacity={linkOpacity}
                  strokeWidth={1.8}
                  vectorEffect="non-scaling-stroke"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNodeActivate(link.target);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    handleNodeActivate(link.target);
                  }}
                  style={{ 
                    cursor: "pointer",
                    transition: "stroke-opacity 120ms ease",
                  }}
                />
              );
            })}
          </g>
          <g
            ref={nodesGroupRef}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          >
            {layout.nodes.map((node) => {
              // 미리보기 상태 확인
              const previewNode = dragPreview?.nodes?.find((p) => p.id === node.data.id);

              // 미리보기가 있으면 미리보기 위치와 투명도 사용
              // 트리1: node.y = 실제 X좌표, node.x = 실제 Y좌표
              // previewNode.x = 미리보기 X좌표, previewNode.y = 미리보기 Y좌표
              const displayX = previewNode ? previewNode.x : node.y; // SVG X (가로)
              const displayY = previewNode ? previewNode.y : node.x; // SVG Y (세로)
              const opacity = previewNode ? previewNode.opacity : 1.0;

              const hasChildren = Array.isArray(node.children) && node.children.length > 0;
              const isRootNode = node.depth === 0;
              const isSelected = selectedNodeId && node.data.id === selectedNodeId;
              const isHovered = hoveredNodeId === node.data.id;
              const isNodeHighlighted = node.data.id ? hoveredAncestorIds.has(node.data.id) : false;
              const nodeOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.18) : 1;
              const textOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.22) : 1;
              
              const labelText = typeof node.data?.name === "string" ? node.data.name : "";
              const measuredWidth = getTextWidth(labelText);
              const hitboxPaddingY = 6;
              const baseRadius = isSelected ? 4 : (isHovered ? 4.2 : 3);
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
                  data-node-id={node.data.id}
                  transform={`translate(${displayX},${displayY})`}
                  opacity={opacity * nodeOpacity}
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
                  onMouseEnter={() => setHoveredNodeId(node.data.id)}
                  onMouseLeave={() => setHoveredNodeId((current) => (current === node.data.id ? null : current))}
                  style={{
                    cursor: onNodeClick ? "pointer" : "default",
                    transition: previewNode
                      ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out"
                      : "opacity 120ms ease",
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
                  {isHovered && (
                    <circle
                      fill="none"
                      stroke={hasChildren ? parentFill : leafFill}
                      strokeWidth={1.2}
                      r={baseRadius + 3.5}
                      strokeOpacity={0.6}
                      vectorEffect="non-scaling-stroke"
                      style={{
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  )}
                  {isHovered && (
                    <circle
                      fill={hasChildren ? parentFill : leafFill}
                      r={baseRadius + 1.5}
                      fillOpacity={0.3}
                      vectorEffect="non-scaling-stroke"
                      style={{
                        transition: 'all 200ms ease',
                      }}
                    />
                  )}
                  <circle
                    fill={hasChildren ? parentFill : leafFill}
                    r={baseRadius}
                    stroke={isSelected ? selectionStroke : baseStroke}
                    strokeWidth={isSelected ? 2 : 1}
                    vectorEffect="non-scaling-stroke"
                    style={{
                      transition: 'all 200ms ease',
                    }}
                  />
                  <text
                    dy="0.31em"
                    x={hasChildren ? -8 : 8}
                    textAnchor={hasChildren ? "end" : "start"}
                    fill={labelColor}
                    fillOpacity={isHovered ? 1 : textOpacity}
                    style={{
                      fontFamily: 'sans-serif',
                      fontSize: isRootNode ? 13 : (isHovered ? 12 : 11),
                      fontWeight: isRootNode ? 700 : (isHovered ? 600 : 400),
                      transition: 'all 200ms ease',
                    }}
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
