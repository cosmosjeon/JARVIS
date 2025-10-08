import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { buildTidyTreeLayout } from 'shared/utils/tidyTreeLayout';
import DragStateManager from 'features/tree/services/drag/DragStateManager';
import InsertionCalculator from 'features/tree/services/drag/InsertionCalculator';
import PreviewLayoutCalculator from 'features/tree/services/drag/PreviewLayoutCalculator';
import SiblingReorderService from 'features/tree/services/drag/SiblingReorderService';

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
  const defaultViewTransformRef = useRef(null);

  // 드래그 관련 서비스 인스턴스
  const dragStateManager = useRef(new DragStateManager()).current;
  const insertionCalculator = useRef(new InsertionCalculator()).current;
  const previewLayoutCalculator = useRef(new PreviewLayoutCalculator()).current;
  const siblingReorderService = useRef(new SiblingReorderService()).current;

  // 드래그 미리보기 상태
  const [dragPreview, setDragPreview] = useState(null);

  // 호버 상태
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [clickedNodeId, setClickedNodeId] = useState(null);
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState(null);
  const clickTimerRef = useRef(null);

  // 외부에서 selectedNodeId가 제공되면 사용, 아니면 내부 상태 사용
  // null이 아닌 값이 제공되거나, undefined가 아니고 null인 경우에는 외부 값 사용
  const effectiveSelectedNodeId = selectedNodeId !== undefined && selectedNodeId !== null
    ? selectedNodeId
    : internalSelectedNodeId;

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

  // 클릭된 노드의 조상 체인 계산 (부모 노드들 연결 하이라이트용)
  const clickedAncestorIds = useMemo(() => {
    if (!clickedNodeId) {
      return new Set();
    }
    const result = new Set();
    let currentId = clickedNodeId;
    while (currentId) {
      result.add(currentId);
      currentId = parentById.get(currentId);
    }
    return result;
  }, [clickedNodeId, parentById]);

  const isHighlightMode = clickedAncestorIds.size > 0;

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
  const resetToDefaultView = () => {
    const svgElement = svgRef.current;
    const zoom = zoomBehaviorRef.current;

    if (!svgElement || !zoom || !defaultViewTransformRef.current) {
      return;
    }

    const selection = d3.select(svgElement);

    // 부드러운 transition으로 기본 뷰포트로 복귀
    selection
      .transition()
      .duration(600)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, defaultViewTransformRef.current);
  };

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

    // 더블클릭 시 기본 뷰포트로 복원
    selection.on("dblclick.zoom", (event) => {
      event.preventDefault();
      event.stopPropagation();

      // 노드 영역 더블클릭은 무시 (노드 활성화 우선)
      const target = event?.target;
      if (target && typeof target.closest === "function") {
        if (target.closest('g[data-node-interactive="true"]')) {
          return;
        }
      }

      resetToDefaultView();
    });

    zoomBehaviorRef.current = zoom;

    // 초기 마운트 시에만 identity로 리셋 (이후 layout 변경 시에는 현재 transform 유지)
    if (isInitialMountRef.current) {
      const identity = d3.zoomIdentity;
      selection.call(zoom.transform, identity);
      setViewTransform(identity);

      // 기본 뷰포트 저장
      defaultViewTransformRef.current = identity;

      isInitialMountRef.current = false;
    }

    return () => {
      selection.on(".zoom", null);
      selection.on("dblclick.zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, [layout, dragStateManager]);

  // 탭 전환 시 기본 화면으로 복귀
  useEffect(() => {
    // 초기 마운트는 제외 (위의 zoom behavior useEffect에서 이미 처리함)
    if (isInitialMountRef.current) {
      return;
    }

    // activeTreeId가 변경되면 기본 뷰포트로 복귀
    if (activeTreeId && defaultViewTransformRef.current) {
      resetToDefaultView();
    }
  }, [activeTreeId]);

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
            setClickedNodeId(null);
            setHoveredNodeId(null);
            setInternalSelectedNodeId(null);
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
                || (clickedAncestorIds.has(linkTargetId)
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
              const isSelected = effectiveSelectedNodeId && node.data.id === effectiveSelectedNodeId;
              const isHovered = hoveredNodeId === node.data.id;
              const isNodeHighlighted = node.data.id ? clickedAncestorIds.has(node.data.id) : false;
              const nodeOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.18) : 1;
              const textOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.22) : 1;

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
                  data-node-id={node.data.id}
                  transform={`translate(${displayX},${displayY})`}
                  opacity={opacity * nodeOpacity}
                  data-node-interactive="true"
                  onClick={(event) => {
                    event.stopPropagation();

                    // 더블 클릭 타이머가 있으면 더블 클릭으로 처리
                    if (clickTimerRef.current) {
                      clearTimeout(clickTimerRef.current);
                      clickTimerRef.current = null;
                      // 더블 클릭: 채팅창 열기
                      setHoveredNodeId(node.data.id);
                      handleNodeActivate(node);
                    } else {
                      // 싱글 클릭: 타이머 시작
                      clickTimerRef.current = setTimeout(() => {
                        const isCurrentlyClicked = clickedNodeId === node.data.id;

                        // 싱글 클릭: 부모 체인 하이라이트 + 호버 효과 + 테두리 표시 (채팅창은 열지 않음)
                        setClickedNodeId(isCurrentlyClicked ? null : node.data.id);
                        setHoveredNodeId(isCurrentlyClicked ? null : node.data.id);
                        // 내부 선택 상태 업데이트 (테두리 표시용) - 토글
                        setInternalSelectedNodeId(isCurrentlyClicked ? null : node.data.id);
                        clickTimerRef.current = null;
                      }, 250);
                    }
                  }}
                  onMouseDown={(event) => beginDrag(event, node)}
                  onMouseEnter={() => setHoveredNodeId(node.data.id)}
                  onMouseLeave={() => {
                    // 클릭된 노드는 호버 효과 유지
                    if (clickedNodeId !== node.data.id) {
                      setHoveredNodeId((current) => (current === node.data.id ? null : current));
                    }
                  }}
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
                  <circle
                    fill={hasChildren ? parentFill : leafFill}
                    fillOpacity={isHovered ? 1 : 0.9}
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
