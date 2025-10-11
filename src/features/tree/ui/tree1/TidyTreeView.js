import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { buildTidyTreeLayout } from 'shared/utils/tidyTreeLayout';
import DragStateManager from 'features/tree/services/drag/DragStateManager';
import InsertionCalculator from 'features/tree/services/drag/InsertionCalculator';

import PreviewLayoutCalculator from 'features/tree/services/drag/PreviewLayoutCalculator';
import SiblingReorderService from 'features/tree/services/drag/SiblingReorderService';
import { focusNodeToCenter as focusNodeToCenterUtil } from 'features/tree/ui/d3Renderer';
import { useSettings } from 'shared/hooks/SettingsContext';
import NodeContextMenu from 'features/tree/ui/components/NodeContextMenu';

const MIN_SCALE = 0.18;
const MAX_SCALE = 4;
const FOCUS_ANIMATION_DURATION = 620;
const VIRTUAL_ROOT_ID = '__virtual_root__';
const DEFAULT_TREE_KEY = '__default_tree__';
const VIEWPORT_STORAGE_PREFIX = 'tidyTreeView.viewTransform';
const DARK_LIKE_THEMES = new Set(["dark", "glass"]);
const normalizeThemeKey = (value) => {
  if (typeof value !== "string") {
    return "light";
  }
  return value.trim().toLowerCase();
};


const INPUT_MODES = Object.freeze({
  MOUSE: 'mouse',
  TRACKPAD: 'trackpad',
});
// 모드별 줌 감도 설정 (낮을수록 민감)
const MOUSE_ZOOM_DIVISOR = 220; // 마우스 모드 기본 감도
const TRACKPAD_ZOOM_DIVISOR = 100; // 트랙패드 모드 높은 감도
const UNIFIED_PAN_PIXEL_MULTIPLIER = 2.5; // 패닝 감도 향상 (딜레이 감소)
const UNIFIED_PAN_LINE_MULTIPLIER = 45; // 라인 모드 감도 향상
const UNIFIED_PAN_PAGE_MULTIPLIER = 800; // 페이지 모드 감도 향상

const clampFinite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

const getUnifiedPanMultiplier = (event) => {
  if (!event) {
    return UNIFIED_PAN_PIXEL_MULTIPLIER;
  }
  if (event.deltaMode === 1) {
    return UNIFIED_PAN_LINE_MULTIPLIER;
  }
  if (event.deltaMode === 2) {
    return UNIFIED_PAN_PAGE_MULTIPLIER;
  }
  return UNIFIED_PAN_PIXEL_MULTIPLIER;
};

const resolveUnifiedWheelModeFactor = (event) => {
  if (!event) {
    return 1;
  }
  if (event.deltaMode === 1) {
    return 0.45; // 트랙패드 감도 사용
  }
  if (event.deltaMode === 2) {
    return 48; // 트랙패드 감도 사용
  }
  return 1;
};

const getCartesianFromTidyNode = (node) => ({
  x: Number.isFinite(node?.y) ? node.y : 0,
  y: Number.isFinite(node?.x) ? node.x : 0,
});

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

  // 실제 컨텐츠의 너비/높이 계산 (패딩 제외)
  const actualContentWidth = Math.max(1, maxY - minY);
  const actualContentHeight = Math.max(1, maxX - minX);

  // 패딩을 고려한 스케일 계산
  const horizontalPadding = Number.isFinite(layout?.dy) ? layout.dy * 1.2 : 80;
  const verticalPadding = Number.isFinite(layout?.dx) ? layout.dx * 1.2 : 80;

  const scaleX = (viewportWidth - horizontalPadding * 2) / actualContentWidth;
  const scaleY = (viewportHeight - verticalPadding * 2) / actualContentHeight;
  const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)));

  // 실제 컨텐츠 중심을 화면 중앙에 배치
  const contentCenterX = (minY + maxY) / 2;
  const contentCenterY = (minX + maxX) / 2;

  const translateX = viewportWidth / 2 - contentCenterX * targetScale;
  const translateY = viewportHeight / 2 - contentCenterY * targetScale;

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
  isChatPanelOpen = false,
  onNodeDelete,
  onNodeUpdate,
}) => {
  const { zoomOnClickEnabled, inputMode = INPUT_MODES.MOUSE } = useSettings();
  const isTrackpadMode = inputMode === INPUT_MODES.TRACKPAD;

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
  const [clickedNodeId, setClickedNodeId] = useState(null);
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState(null);
  const clickTimerRef = useRef(null);
  const backgroundClickTimerRef = useRef(null);
  const recentDragEndRef = useRef(false);
  const hasDragMovedRef = useRef(false);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState({ open: false, node: null, x: 0, y: 0 });

  // 외부에서 selectedNodeId가 제공되면 사용, 아니면 내부 상태 사용
  // null이 아닌 값이 제공되거나, undefined가 아니고 null인 경우에는 외부 값 사용
  const effectiveSelectedNodeId = selectedNodeId !== undefined && selectedNodeId !== null
    ? selectedNodeId
    : internalSelectedNodeId;

  // Measure text width using canvas (size/weight aware for accurate hitbox)
  const getTextWidth = (text, { fontSize = 11, fontWeight = 400 } = {}) => {
    if (typeof text !== "string") {
      return 0;
    }
    const cacheKey = `${fontWeight}-${fontSize}-${text}`;
    const cache = textMeasureCacheRef.current;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    if (!getTextWidth.ctx) {
      const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
      getTextWidth.ctx = canvas ? canvas.getContext("2d") : null;
    }
    const ctx = getTextWidth.ctx;
    if (!ctx) {
      const approx = estimateLabelWidth(text);
      cache.set(cacheKey, approx);
      return approx;
    }
    ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
    const measured = Math.ceil(ctx.measureText(text).width);
    cache.set(cacheKey, measured);
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

  const layoutNodeById = useMemo(() => {
    const map = new Map();
    if (!layout?.nodes) {
      return map;
    }
    layout.nodes.forEach((node) => {
      if (node?.data?.id) {
        map.set(node.data.id, node);
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

  // 클릭이나 호버가 있으면 하이라이트 모드
  const isHighlightMode = clickedAncestorIds.size > 0 || hoveredAncestorIds.size > 0;

  // 통합된 조상 체인 (클릭 또는 호버)
  const highlightedAncestorIds = useMemo(() => {
    const combined = new Set();
    clickedAncestorIds.forEach(id => combined.add(id));
    hoveredAncestorIds.forEach(id => combined.add(id));
    return combined;
  }, [clickedAncestorIds, hoveredAncestorIds]);

  const viewportDimensions = useMemo(() => ({
    width: Number.isFinite(dimensions?.width)
      ? dimensions.width
      : (Number.isFinite(layout?.width) ? layout.width : 0),
    height: Number.isFinite(dimensions?.height)
      ? dimensions.height
      : (Number.isFinite(layout?.height) ? layout.height : 0),
  }), [dimensions?.width, dimensions?.height, layout?.width, layout?.height]);

  const focusNodeById = useCallback((nodeId, options = {}) => {
    if (!nodeId) {
      return;
    }
    const layoutNode = layoutNodeById.get(nodeId);
    const svgElement = svgRef.current;
    const zoom = zoomBehaviorRef.current;

    if (!layoutNode || !svgElement || !zoom) {
      return;
    }

    const { x, y } = getCartesianFromTidyNode(layoutNode);
    const baseTransform = lastViewTransformRef.current || viewTransform;
    const currentTransform = {
      x: Number.isFinite(baseTransform?.x) ? baseTransform.x : viewTransform.x,
      y: Number.isFinite(baseTransform?.y) ? baseTransform.y : viewTransform.y,
      k: Number.isFinite(baseTransform?.k) ? baseTransform.k : viewTransform.k,
    };

    const DEFAULT_TIDY_SCALE = 2.6;
    const requestedScale = Number.isFinite(options.scale) ? options.scale : DEFAULT_TIDY_SCALE;
    const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, requestedScale));

    const baseOffset = viewportDimensions.height
      ? viewportDimensions.height * 0.52
      : 300;
    const clampedOffset = Math.min(Math.max(baseOffset, 260), 620);
    const verticalOffset = -clampedOffset;

    if (process.env.NODE_ENV !== "production") {
      const debugNode = layoutNode?.data ?? null;
      const logPayload = {
        phase: "tidy-focus",
        nodeId,
        cartesian: { x, y },
        layout: { x: layoutNode?.x, y: layoutNode?.y },
        transformBefore: currentTransform,
        requestedScale: options.scale,
        appliedScale: targetScale,
        nodeKeyword: debugNode?.keyword ?? debugNode?.name ?? null,
        offset: { x: 0, y: verticalOffset },
        viewport: viewportDimensions,
      };

      try {
        const element = svgElement.querySelector?.(`[data-node-id="${nodeId}"]`);
        if (element) {
          const rect = element.getBoundingClientRect();
          logPayload.boundingRect = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
          const domMatrix = element.getCTM();
          if (domMatrix) {
            logPayload.ctm = {
              e: domMatrix.e,
              f: domMatrix.f,
              a: domMatrix.a,
              d: domMatrix.d,
            };
          }
        }
        const svgRect = svgElement.getBoundingClientRect?.();
        if (svgRect) {
          logPayload.svgRect = {
            x: svgRect.x,
            y: svgRect.y,
            width: svgRect.width,
            height: svgRect.height,
          };
        }
      } catch (error) {
        logPayload.error = error?.message;
      }

      // eslint-disable-next-line no-console
      console.debug("[FocusDebug] tidy", logPayload);
    }

    focusNodeToCenterUtil({
      node: { x, y },
      svgElement,
      zoomBehaviour: zoom,
      dimensions: viewportDimensions,
      viewTransform: currentTransform,
      setViewTransform,
      duration: Number.isFinite(options.duration) ? options.duration : FOCUS_ANIMATION_DURATION,
      scale: Number.isFinite(options.scale) ? options.scale : targetScale,
      offset: { x: 0, y: verticalOffset },
      allowScaleOverride: false,
    }).catch(() => undefined);
  }, [
    layoutNodeById,
    viewportDimensions,
    viewTransform.x,
    viewTransform.y,
    viewTransform.k,
    setViewTransform,
  ]);

  // 컴포넌트 언마운트 시 드래그 상태 정리
  useEffect(() => {
    return () => {
      if (dragStateManager.isDragging()) {
        dragStateManager.endDrag();
        setDragPreview(null);
      }
    };
  }, [dragStateManager]);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!contextMenu.open) return;

    const handleClickOutside = (event) => {
      // 약간의 딜레이 후에 이벤트 리스너 등록 (컨텍스트 메뉴 열기 이벤트와 분리)
      setTimeout(() => {
        setContextMenu({ open: false, node: null, x: 0, y: 0 });
      }, 0);
    };

    // 다음 이벤트 루프에서 리스너 등록
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside, { once: true });
    }, 0);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.open]);

  // D3 transition으로 노드와 링크 애니메이션 (부모 위치에서 자라나는 효과)
  useLayoutEffect(() => {
    if (!layout || !nodesGroupRef.current || !linksGroupRef.current) {
      return;
    }

    // 드래그 중에는 CSS transition 사용, D3 transition 비활성화
    if (dragPreview?.active) {
      return;
    }

    const ANIMATION_DURATION = 600;
    const previousLayout = previousLayoutRef.current;
    const shouldAnimate = previousLayout !== null && !isInitialMountRef.current;

    if (shouldAnimate) {
      const previousNodeIds = new Set(previousLayout.nodes.map(n => n.data.id));

      // 1단계: 이전 위치로 즉시 되돌림 + 새 노드는 부모 위치에서 시작
      d3.select(nodesGroupRef.current)
        .selectAll('g[data-node-id]')
        .each(function () {
          const nodeId = d3.select(this).attr('data-node-id');
          if (!nodeId) return;

          const currentNode = layout.nodes.find(n => n.data.id === nodeId);
          if (!currentNode) return;

          // 새로 추가된 노드인지 확인
          const isNewNode = !previousNodeIds.has(nodeId);

          if (isNewNode && currentNode.parent) {
            // 새 노드는 부모의 위치에서 시작
            d3.select(this)
              .attr('transform', `translate(${currentNode.parent.y},${currentNode.parent.x})`)
              .style('opacity', 0);
          } else {
            // 기존 노드는 이전 위치로
            const prevNode = previousLayout.nodes.find(n => n.data.id === nodeId);
            if (prevNode) {
              d3.select(this).attr('transform', `translate(${prevNode.y},${prevNode.x})`);
            }
          }
        });

      d3.select(linksGroupRef.current)
        .selectAll('path')
        .each(function () {
          const key = d3.select(this).attr('data-link-key');
          if (!key) return;

          const link = layout.links.find(l => `${l.source.data.id}->${l.target.data.id}` === key);
          if (!link) return;

          // 새 링크는 부모 위치의 점에서 시작
          const prevLink = previousLayout.links.find(l =>
            `${l.source.data.id}->${l.target.data.id}` === key
          );

          if (!prevLink && link.source) {
            // 새 링크: 부모 위치의 점에서 시작
            const parentPoint = { x: link.source.x, y: link.source.y };
            d3.select(this)
              .attr('d', linkGenerator({ source: parentPoint, target: parentPoint }))
              .style('opacity', 0);
          } else if (prevLink) {
            // 기존 링크: 이전 위치
            d3.select(this).attr('d', linkGenerator(prevLink));
          }
        });

      // 2단계: 새 위치로 transition
      d3.select(nodesGroupRef.current)
        .selectAll('g[data-node-id]')
        .transition()
        .duration(ANIMATION_DURATION)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1)
        .attr('transform', function () {
          const nodeId = d3.select(this).attr('data-node-id');
          if (!nodeId) return d3.select(this).attr('transform');

          const node = layout.nodes.find(n => n.data.id === nodeId);
          if (!node) return d3.select(this).attr('transform');

          return `translate(${node.y},${node.x})`;
        });

      d3.select(linksGroupRef.current)
        .selectAll('path')
        .transition()
        .duration(ANIMATION_DURATION)
        .ease(d3.easeCubicInOut)
        .style('opacity', 1)
        .attr('d', function () {
          const key = d3.select(this).attr('data-link-key');
          if (!key) return d3.select(this).attr('d');

          const link = layout.links.find(l =>
            `${l.source.data.id}->${l.target.data.id}` === key
          );
          return link ? linkGenerator(link) : d3.select(this).attr('d');
        });
    }

    previousLayoutRef.current = layout;
  }, [layout, linkGenerator, dragPreview]);

  // 기본 뷰포트로 복원하는 함수 (viewBox가 이미 중앙 정렬되어 있으므로 identity transform으로 리셋)
  const resetToDefaultView = useCallback(() => {
    const svgElement = svgRef.current;
    const zoom = zoomBehaviorRef.current;

    if (!svgElement || !zoom || !layout) {
      return;
    }

    d3.select(svgElement)
      .transition()
      .duration(600)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, d3.zoomIdentity);
  }, [layout]);

  // Zoom behavior 초기화 및 관리
  useEffect(() => {
    const svgElement = svgRef.current;

    if (!svgElement || !layout) {
      return;
    }

    const selection = d3.select(svgElement);
    const zoom = d3.zoom();

    const applyUnifiedPan = (event) => {
      const transform = lastViewTransformRef.current || d3.zoomIdentity;
      const scale = Number.isFinite(transform?.k) ? transform.k : 1;
      const multiplier = getUnifiedPanMultiplier(event) / Math.max(scale, 0.1); // 최소 스케일 값 증가로 반응성 향상
      const deltaX = clampFinite(event?.deltaX);
      const deltaY = clampFinite(event?.deltaY);
      if (deltaX !== 0 || deltaY !== 0) {
        // 즉시 반응하도록 interrupt 제거하고 직접 translateBy 호출
        selection.interrupt();
        selection.call(zoom.translateBy, -deltaX * multiplier, -deltaY * multiplier);
      }
    };

    zoom
      .filter((event) => {
        // 드래그 중이면 차단
        if (dragStateManager.isDragging()) return false;

        if (event.type === 'wheel') {
          // 모든 모드에서 트랙패드 스타일 동작 적용 - 노드 위에서도 패닝 유지
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          if (typeof event.stopPropagation === 'function') {
            event.stopPropagation();
          }
          if (!event.ctrlKey && !event.metaKey) {
            applyUnifiedPan(event);
            return false;
          }
          return true;
        }

        // 노드 위에서는 차단
        const t = event?.target;
        if (t && typeof t.closest === "function") {
          if (t.closest('g[data-node-interactive="true"]')) return false;
        }

        // 우클릭은 차단
        if (event.button === 2) return false;

        // 마우스 드래그 이동: 휠 클릭(button 1) 또는 좌클릭 허용 (트랙패드 스타일)
        if (event.type === 'mousedown' || event.type === 'mousemove') {
          return event.button === 1 || event.button === 0;
        }

        // 터치/트랙패드 제스처는 기본 허용 (두 손가락 드래그, 핀치 줌)
        if (event.type === 'touchstart' || event.type === 'touchmove' || event.type === 'touchend') {
          return true;
        }

        return true;
      })
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .wheelDelta((event) => {
        if (!(event.ctrlKey || event.metaKey)) {
          return 0;
        }
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        const modeFactor = resolveUnifiedWheelModeFactor(event);
        const divisor = isTrackpadMode ? TRACKPAD_ZOOM_DIVISOR : MOUSE_ZOOM_DIVISOR;
        return (-clampFinite(event?.deltaY) * modeFactor) / divisor;
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

    // d3의 기본 더블클릭 줌 동작 비활성화 (배경 더블클릭은 onClick에서 처리)
    selection.on("dblclick.zoom", null);

    const treeKey = typeof activeTreeId === "string" && activeTreeId.trim().length > 0
      ? activeTreeId
      : DEFAULT_TREE_KEY;
    const storageKey = buildTransformStorageKey(treeKey);
    storageKeyRef.current = storageKey;

    // viewBox가 이미 중앙 정렬되어 있으므로 기본 transform은 identity
    const defaultTransform = d3.zoomIdentity;
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
  }, [layout, dragStateManager, activeTreeId, dimensions?.width, dimensions?.height, isTrackpadMode]);

  const isDarkTheme = theme === "dark";
  const isGlassTheme = theme === "glass";
  const linkStroke = (() => {
    if (isDarkTheme) {
      return "rgba(148, 197, 253, 0.95)";
    }
    if (isGlassTheme) {
      return "rgba(147, 197, 253, 0.96)";
    }
    return "rgba(100, 116, 139, 0.95)";
  })();
  const linkGlowFilter = (() => {
    if (isDarkTheme) {
      return "drop-shadow(0 0 6px rgba(125, 211, 252, 0.45))";
    }
    // glass 테마 빛나는 효과 제거
    // if (isGlassTheme) {
    //   return "drop-shadow(0 0 9px rgba(125, 211, 252, 0.65))";
    // }
    return undefined;
  })();
  const linkStrokeWidth = isGlassTheme ? 1.6 : 1.2;
  const labelColor = isDarkTheme ? "#f8fafc" : (isGlassTheme ? "rgba(248, 250, 252, 0.96)" : "#000000");
  const labelStroke = isDarkTheme ? "rgba(15, 23, 42, 0.7)" : "rgba(255, 255, 255, 0.9)";
  const parentFill = isDarkTheme ? "rgba(125, 211, 252, 0.95)" : "rgba(59, 130, 246, 0.88)";
  const leafFill = isDarkTheme ? "rgba(148, 163, 184, 0.92)" : "rgba(148, 163, 184, 0.88)";
  const baseStroke = isDarkTheme ? "rgba(125, 211, 252, 0.3)" : "rgba(59, 130, 246, 0.3)";
  const selectionStroke = isDarkTheme ? "rgba(125, 211, 252, 0.9)" : "rgba(37, 99, 235, 0.9)";

  const handleNodeActivate = useCallback((node) => {
    const nodeId = node?.data?.id;
    if (!nodeId) {
      return;
    }
    const coordinates = getCartesianFromTidyNode(node);

    // 설정이 켜져있을 때만 확대
    if (zoomOnClickEnabled) {
      focusNodeById(nodeId);
    }

    if (typeof onNodeClick === "function") {
      onNodeClick({
        id: nodeId,
        source: "tidy-tree",
        position: coordinates,
      });
    }
  }, [focusNodeById, onNodeClick, zoomOnClickEnabled]);

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

    // 드래그 임계값 설정 (5px 이상 움직여야 드래그 시작)
    const DRAG_THRESHOLD = 5;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;

    // 드래그 이동 플래그 초기화
    hasDragMovedRef.current = false;

    // 전역 마우스 이벤트 리스너 추가
    const handleGlobalMouseMove = (e) => {
      const deltaX = Math.abs(e.clientX - startX);
      const deltaY = Math.abs(e.clientY - startY);

      // 임계값을 넘으면 실제 드래그 시작
      if (!dragStarted && (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)) {
        dragStarted = true;
        dragStateManager.startDrag(node, startX, startY, parent);
        setHoveredNodeId(null);
      }

      if (dragStarted) {
        handleDragMove(e);
      }
    };

    const handleGlobalMouseUp = (e) => {
      if (dragStarted) {
        endDrag(e);
      }
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

    // 실제로 드래그 이동이 발생했음을 표시
    hasDragMovedRef.current = true;

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

    // 원래 자리로 돌아가는 경우에도 애니메이션 적용
    // 미리보기 레이아웃 계산 (원래 위치든 새 위치든 항상 계산)
    const { previewNodes } = previewLayoutCalculator.calculatePreviewLayout(
      siblings,
      node,
      insertIndex,
    );

    setDragPreview({
      active: true,
      nodes: previewNodes,
      isValidDrop, // 유효한 드롭인지 표시 (드롭 시 사용)
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

    // 실제로 드래그 이동이 발생했을 때만 클릭 이벤트 방지
    if (hasDragMovedRef.current) {
      recentDragEndRef.current = true;
      setTimeout(() => {
        recentDragEndRef.current = false;
      }, 100);
    }

    hasDragMovedRef.current = false;
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
            // 하이라이트 즉시 해제
            const hasHighlight = clickedNodeId !== null;
            setClickedNodeId(null);
            setHoveredNodeId(null);

            // 더블 클릭 타이머가 있으면 더블 클릭으로 처리
            if (backgroundClickTimerRef.current) {
              clearTimeout(backgroundClickTimerRef.current);
              backgroundClickTimerRef.current = null;

              if (isChatPanelOpen) {
                // 채팅창이 열려있으면: 채팅창만 닫기 (줌 유지)
                setInternalSelectedNodeId(null);
                if (typeof onBackgroundClick === "function") {
                  onBackgroundClick();
                }
              } else {
                // 채팅창이 닫혀있으면: 줌 초기화
                resetToDefaultView();
              }
            } else {
              // 싱글 클릭: 타이머 시작
              backgroundClickTimerRef.current = setTimeout(() => {
                if (!hasHighlight) {
                  // 하이라이트가 없었으면 채팅창 닫기
                  setInternalSelectedNodeId(null);
                  if (typeof onBackgroundClick === "function") {
                    onBackgroundClick();
                  }
                }
                // 하이라이트가 있었으면 하이라이트만 해제 (이미 위에서 처리됨)
                backgroundClickTimerRef.current = null;
              }, 250);
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
                || (highlightedAncestorIds.has(linkTargetId)
                  && parentById.get(linkTargetId) === linkSourceId);
              const linkOpacity = isHighlightedLink ? 0.7 : 0.18;

              return (
                <path
                  key={linkKey}
                  data-link-key={linkKey}
                  d={linkGenerator(link)}
                  stroke={linkStroke}
                  strokeOpacity={linkOpacity}
                  strokeWidth={linkStrokeWidth}
                  strokeLinecap="round"
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
                    filter: linkGlowFilter,
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
              const isNodeHighlighted = node.data.id ? highlightedAncestorIds.has(node.data.id) : false;
              const nodeOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.18) : 1;
              const textOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.22) : 1;

              const labelText = typeof node.data?.name === "string" ? node.data.name : "";
              // Measure width according to current visual style to avoid overflow
              const currentFontSize = isHovered ? 13 : 11;
              const currentFontWeight = isHovered ? 700 : 400;
              const measuredWidth = getTextWidth(labelText, { fontSize: currentFontSize, fontWeight: currentFontWeight }) + 2; // small safety padding
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

                    // 드래그 직후에는 클릭 이벤트 무시
                    if (recentDragEndRef.current) {
                      return;
                    }

                    // 싱글 클릭으로 채팅창 열기/전환
                    setClickedNodeId(node.data.id);
                    setHoveredNodeId(node.data.id);
                    handleNodeActivate(node);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu({
                      open: true,
                      node: node.data,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  onMouseDown={(event) => {
                    // 우클릭은 드래그 시작하지 않음
                    if (event.button === 2) return;
                    beginDrag(event, node);
                  }}
                  onMouseEnter={() => {
                    // 드래그 중에는 호버 상태 변경 안 함
                    if (!dragPreview?.active) {
                      setHoveredNodeId(node.data.id);
                    }
                  }}
                  onMouseLeave={() => {
                    // 드래그 중에는 호버 상태 변경 안 함
                    if (dragPreview?.active) {
                      return;
                    }
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
                    r={isHovered ? baseRadius * 1.4 : baseRadius}
                    stroke={isSelected ? selectionStroke : (isHovered ? 'rgba(59, 130, 246, 0.6)' : baseStroke)}
                    strokeWidth={isSelected ? 2 : (isHovered ? 1.5 : 1)}
                    vectorEffect="non-scaling-stroke"
                    style={{
                      transition: 'all 200ms ease',
                      filter: isHovered ? 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.4))' : 'none',
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
                      fontSize: isHovered ? 13 : 11,
                      fontWeight: isHovered ? 700 : 400,
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

      {/* 노드 컨텍스트 메뉴 */}
      <NodeContextMenu
        isOpen={contextMenu.open}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        node={contextMenu.node}
        theme={theme}
        onClose={() => setContextMenu({ open: false, node: null, x: 0, y: 0 })}
        onDelete={(nodeId) => {
          if (onNodeDelete) {
            onNodeDelete(nodeId);
          }
        }}
        onRename={(nodeId, newName) => {
          if (onNodeUpdate) {
            onNodeUpdate(nodeId, { name: newName });
          }
        }}
      />
    </div>
  );
};

export default TidyTreeView;
