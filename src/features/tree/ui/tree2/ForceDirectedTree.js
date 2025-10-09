import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import DataTransformService from 'features/tree/services/DataTransformService';
import QuestionService from 'features/tree/services/QuestionService';
import NodeAssistantPanel from 'features/tree/ui/components/NodeAssistantPanel';
import { resolveTreeBackground } from 'features/tree/constants/themeBackgrounds';
import { motion, useAnimationControls } from 'framer-motion';
import { useSettings } from 'shared/hooks/SettingsContext';
import NodeContextMenu from 'features/tree/ui/components/NodeContextMenu';

const DEFAULT_DIMENSIONS = { width: 954, height: 954 };
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 4;
const NODE_RADIUS = 2.6;
const FULL_ROTATION = Math.PI * 2;
const FORCE_ROTATION_DURATION = 360;
const TEXT_COLOR_BY_THEME = Object.freeze({
  dark: '#e2e8f0',
  glass: '#f8fafc',
});
const DARK_LIKE_THEMES = new Set(['dark', 'glass']);
const normalizeThemeKey = (value) => {
  if (typeof value !== 'string') {
    return 'light';
  }
  return value.trim().toLowerCase();
};

const normalizeAngle = (angle) => {
  if (!Number.isFinite(angle)) {
    return 0;
  }
  const normalized = angle % FULL_ROTATION;
  return normalized < 0 ? normalized + FULL_ROTATION : normalized;
};

const toCartesianFromRadial = (node) => {
  const angle = (Number.isFinite(node?.x) ? node.x : 0) - Math.PI / 2;
  const radius = Number.isFinite(node?.y) ? node.y : 0;
  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  ];
};
const sanitizeLabel = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const VIEWPORT_STORAGE_PREFIX = 'forceTreeView.viewTransform';

const buildViewStorageKey = (treeKey) => `${VIEWPORT_STORAGE_PREFIX}.${treeKey}`;

const readStoredViewTransform = (storageKey) => {
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

const persistViewTransform = (storageKey, transform) => {
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

const resolveNodeDatum = (node) => {
  if (!node) return null;
  if (node.data && node.data.data) {
    return node.data.data;
  }
  return node.data || null;
};

const resolveNodeId = (node) => {
  const datum = resolveNodeDatum(node);
  if (!datum) return null;
  return datum.id ?? null;
};

const estimateLabelWidth = (label) => {
  if (!label) return 0;
  return Math.max(24, label.length * 6.2);
};

// 모든 노드가 화면에 들어가도록 transform 계산 (간단하고 명확한 방식)
const computeFitToScreenTransform = (layoutNodes, viewportWidth, viewportHeight) => {
  if (!Array.isArray(layoutNodes) || layoutNodes.length === 0) {
    return null;
  }
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return null;
  }

  // 1. 모든 노드의 실제 좌표(cartesian) 계산
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  layoutNodes.forEach((node) => {
    const [x, y] = toCartesianFromRadial(node);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null;
  }

  // 2. 컨텐츠 크기 계산
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);

  // 3. 패딩 적용 (여유 공간)
  const padding = 100;
  const scaleX = (viewportWidth - padding * 2) / contentWidth;
  const scaleY = (viewportHeight - padding * 2) / contentHeight;
  const targetScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));

  // 4. 컨텐츠 중심을 화면 중앙(0, 0)에 배치 (viewBox가 중앙 정렬되어 있으므로)
  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;

  // translate: 컨텐츠 중심을 원점으로 이동
  const translateX = -contentCenterX * targetScale;
  const translateY = -contentCenterY * targetScale;

  return d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);
};
const buildRadialLayout = (data, baseRadius, levelSpacing = 96) => {
  if (!data) {
    return {
      root: null,
      nodes: [],
      links: [],
      maxDepth: 0,
      requiredRadius: 0,
      levelSpacing,
    };
  }

  const root = d3.hierarchy(data);
  root.sort((a, b) => d3.ascending(a.data?.name, b.data?.name));

  const maxDepth = Math.max(1, root.height);
  const clusterRadius = Math.max(baseRadius, levelSpacing * maxDepth);

  d3.cluster()
    .size([2 * Math.PI, clusterRadius])(root);

  root.each((node) => {
    if (node.depth === 0) {
      node.y = 0;
    } else if (node.depth === 1) {
      node.y = levelSpacing * 1.8;
    } else {
      node.y = levelSpacing * 1.8 + (node.depth - 1) * levelSpacing;
    }
  });

  return {
    root,
    nodes: root.descendants(),
    links: root.links(),
    maxDepth,
    requiredRadius: levelSpacing * maxDepth,
    levelSpacing,
  };
};

const ForceDirectedTree = ({
  data,
  dimensions = DEFAULT_DIMENSIONS,
  onNodeClick = () => { },
  onNodeRemove,
  onNodeUpdate,
  onMemoCreate,
  onMemoUpdate,
  onMemoRemove,
  onNodeCreate,
  onLinkCreate,
  onRootCreate,
  treeId,
  userId,
  questionService,
  getInitialConversation,
  onConversationChange = () => { },
  onRequestAnswer,
  onAnswerComplete,
  onAnswerError,
  onSecondQuestion,
  onPlaceholderCreate,
  onPanZoomGesture,
  theme = 'light',
  background,
  hideAssistantPanel = false,
  attachmentsByNode = {},
  onNodeAttachmentsChange = () => { },
  isForceSimulationEnabled, // kept for compatibility
  selectedNodeId: externalSelectedNodeId,
  onBackgroundClick,
  isChatPanelOpen = false,
}) => {
  const { zoomOnClickEnabled } = useSettings();
  const normalizedTheme = normalizeThemeKey(theme);
  const isDarkLikeTheme = DARK_LIKE_THEMES.has(normalizedTheme);

  const baseWidth = Number.isFinite(dimensions?.width)
    ? dimensions.width
    : DEFAULT_DIMENSIONS.width;
  const baseHeight = Number.isFinite(dimensions?.height)
    ? dimensions.height
    : DEFAULT_DIMENSIONS.height;
  const levelSpacing = 96;
  const baseRadius = Math.max(0, Math.min(baseWidth, baseHeight) / 2 - 80);

  const layout = useMemo(() => {
    const nodesArray = Array.isArray(data?.nodes) ? data.nodes : [];
    const linksArray = Array.isArray(data?.links) ? data.links : [];
    const mappedHierarchy = DataTransformService.transformToHierarchy(
      nodesArray,
      linksArray,
    );
    const result = buildRadialLayout(mappedHierarchy, baseRadius, levelSpacing);
    return result;
  }, [data, baseRadius, levelSpacing]);

  const effectiveRadius = Math.max(baseRadius, layout.requiredRadius + levelSpacing);
  const width = Math.max(baseWidth, effectiveRadius * 2 + 160);
  const height = Math.max(baseHeight, effectiveRadius * 2 + 160);
  const resolvedBackground = background || resolveTreeBackground(theme);

  const nodeMap = useMemo(() => {
    if (!Array.isArray(data?.nodes)) {
      return new Map();
    }
    return new Map(data.nodes.map((node) => [node.id, node]));
  }, [data?.nodes]);

  const layoutNodeById = useMemo(() => {
    const map = new Map();
    layout.nodes.forEach((node) => {
      const id = resolveNodeId(node);
      if (id) {
        map.set(id, node);
      }
    });
    return map;
  }, [layout.nodes]);

  const parentById = useMemo(() => {
    const map = new Map();
    layout.nodes.forEach((node) => {
      const id = resolveNodeId(node);
      if (!id) return;
      const parentId = node.parent ? resolveNodeId(node.parent) : null;
      map.set(id, parentId);
    });
    return map;
  }, [layout.nodes]);

  const [viewTransform, setViewTransform] = useState(d3.zoomIdentity);
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState(null);
  const selectedNodeId = externalSelectedNodeId !== undefined ? externalSelectedNodeId : internalSelectedNodeId;
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [clickedNodeId, setClickedNodeId] = useState(null);
  const clickTimerRef = useRef(null);
  const backgroundClickTimerRef = useRef(null);
  const [contextMenu, setContextMenu] = useState({ open: false, node: null, x: 0, y: 0 });

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!contextMenu.open) return;

    const handleClickOutside = (event) => {
      setTimeout(() => {
        setContextMenu({ open: false, node: null, x: 0, y: 0 });
      }, 0);
    };

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside, { once: true });
    }, 0);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.open]);
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const questionServiceRef = useRef(questionService || new QuestionService());
  const hasInitializedViewRef = useRef(false);
  const lastViewTransformRef = useRef(d3.zoomIdentity);
  const lastFitSignatureRef = useRef(null);
  const viewStorageKeyRef = useRef(null);
  const [globalRotationDeg, setGlobalRotationDeg] = useState(0);
  const globalRotationRad = useMemo(() => (globalRotationDeg * Math.PI) / 180, [globalRotationDeg]);
  const rotationControls = useAnimationControls();

  useEffect(() => {
    setGlobalRotationDeg(0);
    rotationControls.set({ rotate: 0 });
  }, [treeId, rotationControls]);

  useEffect(() => {
    if (questionService) {
      questionServiceRef.current = questionService;
    }
  }, [questionService]);

  const viewportDimensions = useMemo(() => ({
    width: Number.isFinite(dimensions?.width) ? dimensions.width : width,
    height: Number.isFinite(dimensions?.height) ? dimensions.height : height,
  }), [dimensions?.width, dimensions?.height, width, height]);

  // 모든 노드가 화면에 보이도록 fit-to-screen
  const fitToScreen = useCallback((options = {}) => {
    const svgElement = svgRef.current;
    const zoom = zoomBehaviorRef.current;

    if (!svgElement || !zoom || !layout || layout.nodes.length === 0) {
      return;
    }

    const fitTransform = computeFitToScreenTransform(
      layout.nodes,
      viewportDimensions.width,
      viewportDimensions.height
    );

    if (!fitTransform) {
      return;
    }

    const duration = Number.isFinite(options.duration) ? options.duration : 600;

    // Transform 적용
    d3.select(svgElement)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, fitTransform);

    // 회전 초기화
    setGlobalRotationDeg(0);
    rotationControls.stop();
    rotationControls.start({
      rotate: 0,
      transition: {
        duration: duration / 1000,
        ease: [0.4, 0, 0.2, 1]
      }
    });
  }, [layout, viewportDimensions, rotationControls]);

  // 기본 뷰포트로 복원하는 함수
  const resetToDefaultView = useCallback(() => {
    fitToScreen();
  }, [fitToScreen]);

  // Zoom behavior 설정
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const zoom = d3.zoom()
      .filter((event) => {
        if (!event) {
          return false;
        }

        if (event.type === 'mousedown' || event.type === 'pointerdown') {
          if (event.ctrlKey) {
            return false;
          }
          return event.button !== 2;
        }

        return !event.ctrlKey;
      })
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .filter((event) => {
        // 우클릭은 차단
        if (event.button === 2) return false;

        // 휠 이벤트: Ctrl 키를 누른 상태에서만 확대/축소 허용
        if (event.type === 'wheel') {
          return event.ctrlKey || event.metaKey;
        }

        // 마우스 드래그 이동: 휠 클릭(button 1) 또는 Ctrl + 좌클릭만 허용
        if (event.type === 'mousedown' || event.type === 'mousemove') {
          return event.button === 1 || (event.ctrlKey && event.button === 0);
        }

        // 터치/트랙패드 제스처는 기본 허용 (두 손가락 드래그, 핀치 줌)
        if (event.type === 'touchstart' || event.type === 'touchmove' || event.type === 'touchend') {
          return true;
        }

        return true;
      })
      .wheelDelta((event) => {
        // Ctrl 키를 누른 상태에서만 확대/축소
        if (!event.ctrlKey && !event.metaKey) {
          return 0;
        }
        const modeFactor = event.deltaMode === 1 ? 0.33 : event.deltaMode ? 33 : 1;
        return (-event.deltaY * modeFactor) / 600;
      })
      .on('zoom', (event) => {
        setViewTransform(event.transform);
        lastViewTransformRef.current = event.transform;
        if (typeof onPanZoomGesture === 'function') {
          onPanZoomGesture(event.transform);
        }
        const storageKey = viewStorageKeyRef.current;
        if (storageKey) {
          persistViewTransform(storageKey, event.transform);
        }
      });

    const selection = d3.select(svgElement);
    selection.call(zoom);

    // d3의 기본 더블클릭 줌 동작 비활성화 (배경 더블클릭은 onClick에서 처리)
    selection.on("dblclick.zoom", null);

    zoomBehaviorRef.current = zoom;

    return () => {
      selection.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, [onPanZoomGesture]);

  // 초기 로딩 시 viewBox가 이미 중앙 정렬되어 있으므로 identity transform 사용
  useEffect(() => {
    const svgElement = svgRef.current;
    const zoom = zoomBehaviorRef.current;

    if (!svgElement || !zoom || !layout || layout.nodes.length === 0) {
      return;
    }

    const treeKey = typeof treeId === 'string' && treeId.trim().length > 0 ? treeId : 'default';
    const signature = `${treeKey}|${layout.nodes.length}|${layout.links.length}`;

    const storageKey = buildViewStorageKey(treeKey);
    viewStorageKeyRef.current = storageKey;

    const storedTransform = readStoredViewTransform(storageKey);
    const storedZoom = toZoomTransform(storedTransform);

    if (!hasInitializedViewRef.current || lastFitSignatureRef.current !== signature) {
      // viewBox가 이미 중앙 정렬되어 있으므로 기본은 identity transform
      const initialTransform = storedZoom || d3.zoomIdentity;

      const selection = d3.select(svgElement);
      selection
        .transition()
        .duration(0)
        .call(zoom.transform, initialTransform);

      setViewTransform(initialTransform);
      lastViewTransformRef.current = initialTransform;
      hasInitializedViewRef.current = true;
      lastFitSignatureRef.current = signature;
      if (!storedZoom && storageKey) {
        persistViewTransform(storageKey, initialTransform);
      }
    }
  }, [layout, treeId]);

  const radialLink = useMemo(
    () => d3.linkRadial()
      .angle((point) => point.x)
      .radius((point) => point.y),
    [],
  );

  const selectedHierarchyNode = useMemo(
    () => layout.nodes.find((node) => resolveNodeId(node) === selectedNodeId) || null,
    [layout.nodes, selectedNodeId],
  );

  const selectedNodeDatum = selectedHierarchyNode
    ? resolveNodeDatum(selectedHierarchyNode)
    : null;

  const resolveNodeColor = useCallback((node) => {
    if (!node) {
      return theme === 'dark' ? '#38bdf8' : '#2563eb';
    }
    const isLeaf = !node.children;
    if (theme === 'dark') {
      return isLeaf ? 'rgba(148, 163, 184, 0.92)' : 'rgba(125, 211, 252, 0.95)';
    }
    return isLeaf ? 'rgba(148, 163, 184, 0.88)' : 'rgba(59, 130, 246, 0.88)';
  }, [theme]);

  const selectedColor = selectedHierarchyNode
    ? resolveNodeColor(selectedHierarchyNode)
    : (theme === 'dark' ? '#38bdf8' : '#2563eb');

  const focusNodeById = useCallback((nodeId) => {
    if (!nodeId) {
      return;
    }
    const layoutNode = layoutNodeById.get(nodeId);
    if (!layoutNode) {
      return;
    }
    const nodeAngleDeg = Number.isFinite(layoutNode?.x)
      ? (layoutNode.x * 180) / Math.PI
      : 90;
    const targetRotationDeg = 90 - nodeAngleDeg;
    setGlobalRotationDeg(targetRotationDeg);
    rotationControls.stop();
    rotationControls
      .start({
        rotate: targetRotationDeg,
        transition: {
          duration: FORCE_ROTATION_DURATION / 1000,
          ease: [0.4, 0, 0.2, 1],
        },
      })
      .catch(() => undefined);
  }, [layoutNodeById, setGlobalRotationDeg, rotationControls]);

  const handleNodeClick = useCallback((node) => {
    const datum = resolveNodeDatum(node);
    const nodeId = datum?.id;
    if (!nodeId) {
      return;
    }
    const [cartesianX, cartesianY] = toCartesianFromRadial(layoutNodeById.get(nodeId) || node);

    // 설정이 켜져있을 때만 확대
    if (zoomOnClickEnabled) {
      focusNodeById(nodeId);
    }

    if (externalSelectedNodeId === undefined) {
      setInternalSelectedNodeId(nodeId);
    }
    onNodeClick({
      id: nodeId,
      node: datum,
      position: { x: cartesianX, y: cartesianY },
    });
  }, [focusNodeById, onNodeClick, externalSelectedNodeId, layoutNodeById, zoomOnClickEnabled]);

  const handleClosePanel = useCallback(() => {
    if (externalSelectedNodeId === undefined) {
      setInternalSelectedNodeId(null);
    }
    if (typeof onBackgroundClick === 'function') {
      onBackgroundClick();
    }
  }, [externalSelectedNodeId, onBackgroundClick]);

  const handlePanelNodeSelect = useCallback((target) => {
    if (!target) {
      return;
    }
    const targetId = target.id ?? target?.data?.id;
    if (!targetId) {
      return;
    }
    const layoutNode = layoutNodeById.get(targetId);
    const original = nodeMap.get(targetId) || target;
    const [cartesianX, cartesianY] = toCartesianFromRadial(layoutNode);
    focusNodeById(targetId);
    if (externalSelectedNodeId === undefined) {
      setInternalSelectedNodeId(targetId);
    }
    onNodeClick({
      id: targetId,
      node: original,
      position: { x: cartesianX, y: cartesianY },
    });
  }, [nodeMap, layoutNodeById, focusNodeById, onNodeClick, externalSelectedNodeId]);

  const handleAttachmentsChange = useCallback((nodeId, next) => {
    if (typeof onNodeAttachmentsChange === 'function') {
      onNodeAttachmentsChange(nodeId, next);
    }
  }, [onNodeAttachmentsChange]);

  const nodeFill = useCallback((node) => resolveNodeColor(node), [resolveNodeColor]);

  const isGlassTheme = theme === 'glass';
  const textFill = (() => {
    if (theme === 'dark') {
      return '#e2e8f0';
    }
    if (isGlassTheme) {
      return 'rgba(248, 250, 252, 0.96)';
    }
    return '#0f172a';
  })();
  const baseLinkColor = (() => {
    if (theme === 'dark') {
      return 'rgba(148, 197, 253, 0.9)';
    }
    if (isGlassTheme) {
      return 'rgba(147, 197, 253, 0.9)';
    }
    return 'rgba(100, 116, 139, 0.95)';
  })();
  const linkGlowFilter = (() => {
    if (theme === 'dark') {
      return 'drop-shadow(0 0 6px rgba(96, 165, 250, 0.45))';
    }
    if (isGlassTheme) {
      return 'drop-shadow(0 0 9px rgba(125, 211, 252, 0.65))';
    }
    return undefined;
  })();
  const linkStrokeWidth = isGlassTheme ? 1.6 : 1.2;

  // 클릭된 노드의 조상 체인 계산
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

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: resolvedBackground }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={[-width / 2, -height / 2, width, height].join(' ')}
        style={{ touchAction: 'pan-x pan-y pinch-zoom', cursor: 'grab' }}
        onClick={(event) => {
          // 배경 클릭 처리
          if (event.target === event.currentTarget || event.target.tagName === 'svg') {
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
                if (externalSelectedNodeId === undefined) {
                  setInternalSelectedNodeId(null);
                }
                if (typeof onBackgroundClick === 'function') {
                  onBackgroundClick();
                }
              } else {
                // 채팅창이 닫혀있으면: 모든 노드가 보이도록 fit-to-screen
                fitToScreen();
              }
            } else {
              // 싱글 클릭: 타이머 시작
              backgroundClickTimerRef.current = setTimeout(() => {
                if (!hasHighlight) {
                  // 하이라이트가 없었으면 채팅창 닫기
                  if (externalSelectedNodeId === undefined) {
                    setInternalSelectedNodeId(null);
                  }
                  if (typeof onBackgroundClick === 'function') {
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
        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
          <motion.g
            initial={false}
            animate={rotationControls}
            style={{ transformOrigin: '0px 0px' }}
          >
            <g fill="none">
              {layout.links.map((link, index) => {
                const linkSourceId = resolveNodeId(link.source);
                const linkTargetId = resolveNodeId(link.target);
                const isHighlightedLink = !isHighlightMode
                  || (highlightedAncestorIds.has(linkTargetId)
                    && parentById.get(linkTargetId) === linkSourceId);
                const strokeOpacity = isHighlightedLink ? 0.7 : 0.18;
                return (
                  <path
                    key={`link-${index}`}
                    d={radialLink(link)}
                    stroke={baseLinkColor}
                    strokeWidth={linkStrokeWidth}
                    strokeOpacity={strokeOpacity}
                    strokeLinecap="round"
                    style={{
                      filter: linkGlowFilter,
                      transition: 'stroke-opacity 160ms ease',
                    }}
                  />
                );
              })}
            </g>

            <g strokeLinejoin="round" strokeWidth={3}>
              {layout.nodes.map((node) => {
                const datum = resolveNodeDatum(node);
                const nodeId = datum?.id;
                const label = sanitizeLabel(
                  datum?.name
                  || datum?.keyword
                  || datum?.memo?.title
                  || datum?.id,
                );
                const isLeaf = !node.children;
                const isRootNode = node.depth === 0;
                const rotation = isRootNode ? 0 : (node.x * 180) / Math.PI - 90;
                const translation = isRootNode ? 'translate(0,0)' : `translate(${node.y},0)`;
                const adjustedAngle = normalizeAngle(node.x + globalRotationRad);
                const orientationFlip = !isRootNode && adjustedAngle >= Math.PI;
                const isFrontSide = adjustedAngle < Math.PI;
                const textAnchor = isRootNode ? 'middle' : (isFrontSide === isLeaf ? 'start' : 'end');
                const textOffset = isRootNode ? 0 : (isFrontSide === isLeaf ? 8 : -8);
                const isHovered = hoveredNodeId === nodeId;
                const isNodeHighlighted = nodeId ? highlightedAncestorIds.has(nodeId) : false;
                const nodeOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.18) : 1;
                const textOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.22) : 1;
                const circleOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.28) : 1;

                return (
                  <g
                    key={nodeId || `node-${node.x}-${node.y}`}
                    data-node-id={nodeId || undefined}
                    transform={`rotate(${rotation}) ${translation}`}
                    onMouseEnter={() => setHoveredNodeId(nodeId)}
                    onMouseLeave={() => {
                      // 클릭된 노드는 호버 효과 유지
                      if (clickedNodeId !== nodeId) {
                        setHoveredNodeId((current) => (current === nodeId ? null : current));
                      }
                    }}
                    onClick={(event) => {
                      event.stopPropagation();

                      // 싱글 클릭으로 채팅창 열기/전환
                      setClickedNodeId(nodeId);
                      setHoveredNodeId(nodeId);
                      handleNodeClick(node);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setContextMenu({
                        open: true,
                        node: datum,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                    style={{
                      cursor: 'pointer',
                      opacity: nodeOpacity,
                      transition: 'opacity 120ms ease',
                    }}
                  >
                    <circle
                      fill={nodeFill(node)}
                      r={isHovered ? NODE_RADIUS * 1.6 : NODE_RADIUS}
                      fillOpacity={isHovered ? 1 : circleOpacity}
                      stroke={isHovered ? 'rgba(59, 130, 246, 0.6)' : 'transparent'}
                      strokeWidth={isHovered ? 1.2 : 0}
                      style={{
                        transition: 'all 200ms ease',
                        filter: isHovered ? 'drop-shadow(0 0 3px rgba(59, 130, 246, 0.5))' : 'none',
                      }}
                    />
                    {label ? (
                      <text
                        dy={isRootNode ? '1.5em' : '0.31em'}
                        x={textOffset}
                        textAnchor={textAnchor}
                        transform={orientationFlip ? 'rotate(180)' : undefined}
                        fill={textFill}
                        fillOpacity={isHovered ? 1 : textOpacity}
                        style={{
                          fontFamily: 'sans-serif',
                          fontSize: isHovered ? 13 : 11,
                          fontWeight: isHovered ? 700 : 400,
                          transition: 'all 200ms ease',
                        }}
                      >
                        {label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </motion.g>
        </g>
      </svg>

      {!hideAssistantPanel && selectedNodeDatum ? (
        <div className="pointer-events-auto absolute inset-y-4 right-4 z-[1000] flex max-w-[420px] min-w-[320px] rounded-lg shadow-2xl">
          <NodeAssistantPanel
            node={selectedNodeDatum}
            color={selectedColor}
            theme={theme}
            onSizeChange={() => { }}
            onSecondQuestion={onSecondQuestion}
            onPlaceholderCreate={onPlaceholderCreate}
            questionService={questionServiceRef.current}
            initialConversation={
              typeof getInitialConversation === 'function'
                ? getInitialConversation(selectedNodeDatum.id)
                : []
            }
            onConversationChange={(messages) => {
              onConversationChange(selectedNodeDatum.id, messages);
            }}
            nodeSummary={null}
            isRootNode={selectedHierarchyNode?.depth === 0}
            bootstrapMode={false}
            onBootstrapFirstSend={() => { }}
            onPanZoomGesture={onPanZoomGesture}
            nodeScaleFactor={1}
            treeNodes={Array.isArray(data?.nodes) ? data.nodes : []}
            treeLinks={Array.isArray(data?.links) ? data.links : []}
            onNodeSelect={handlePanelNodeSelect}
            disableNavigation={false}
            attachments={attachmentsByNode?.[selectedNodeDatum.id] || []}
            onAttachmentsChange={(next) => handleAttachmentsChange(selectedNodeDatum.id, next)}
            onRequestAnswer={onRequestAnswer}
            onAnswerComplete={onAnswerComplete}
            onAnswerError={onAnswerError}
            onCloseNode={handleClosePanel}
            showHeaderControls
          />
        </div>
      ) : null}

      {/* 노드 컨텍스트 메뉴 */}
      <NodeContextMenu
        isOpen={contextMenu.open}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        node={contextMenu.node}
        theme={theme}
        onClose={() => setContextMenu({ open: false, node: null, x: 0, y: 0 })}
        onDelete={(nodeId) => {
          if (onNodeRemove) {
            onNodeRemove(nodeId);
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

export default ForceDirectedTree;
