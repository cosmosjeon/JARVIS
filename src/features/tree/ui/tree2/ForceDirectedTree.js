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

const DEFAULT_DIMENSIONS = { width: 954, height: 954 };
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 4;
const NODE_RADIUS = 2.6;
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
    console.log('[ForceDirectedTree] Layout calculation:', {
      nodesCount: nodesArray.length,
      linksCount: linksArray.length,
      firstNode: nodesArray[0]
    });
    const mappedHierarchy = DataTransformService.transformToHierarchy(
      nodesArray,
      linksArray,
    );
    const result = buildRadialLayout(mappedHierarchy, baseRadius, levelSpacing);
    console.log('[ForceDirectedTree] Layout result:', {
      layoutNodesCount: result.nodes.length,
      hasRoot: !!result.root
    });
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
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const questionServiceRef = useRef(questionService || new QuestionService());
  const hasInitializedViewRef = useRef(false);
  const lastViewTransformRef = useRef(d3.zoomIdentity);
  const lastFitSignatureRef = useRef(null);
  const viewStorageKeyRef = useRef(null);

  useEffect(() => {
    if (questionService) {
      questionServiceRef.current = questionService;
    }
  }, [questionService]);

  const resetToDefaultView = useCallback(() => {}, []);

  // Zoom behavior 설정
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const zoom = d3.zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
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

    zoomBehaviorRef.current = zoom;

    zoomBehaviorRef.current = zoom;

    return () => {
      selection.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
  }, [onPanZoomGesture, resetToDefaultView]);

  // 초기 로딩 시 전체 트리가 화면에 보이도록 설정
  useEffect(() => {
    const svgElement = svgRef.current;
    const zoom = zoomBehaviorRef.current;

    if (!svgElement || !zoom || !layout || layout.nodes.length === 0) {
      return;
    }

    const rect = svgElement.getBoundingClientRect();
    const viewportWidth = Number.isFinite(dimensions?.width) && dimensions.width > 0
      ? dimensions.width
      : (rect.width || baseWidth);
    const viewportHeight = Number.isFinite(dimensions?.height) && dimensions.height > 0
      ? dimensions.height
      : (rect.height || baseHeight);

    if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
      return;
    }

    const treeKey = typeof treeId === 'string' && treeId.trim().length > 0 ? treeId : 'default';
    const signature = [
      treeKey,
      viewportWidth.toFixed(2),
      viewportHeight.toFixed(2),
      layout.nodes.length,
      layout.links.length,
    ].join('|');

    const storageKey = buildViewStorageKey(treeKey);
    viewStorageKeyRef.current = storageKey;

    const storedTransform = readStoredViewTransform(storageKey);
    const storedZoom = toZoomTransform(storedTransform);

    if (!hasInitializedViewRef.current || lastFitSignatureRef.current !== signature) {
      let initialTransform = storedZoom;

      if (!initialTransform) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        layout.nodes.forEach(node => {
          const x = node.y * Math.cos(node.x - Math.PI / 2);
          const y = node.y * Math.sin(node.x - Math.PI / 2);
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        });

        const padding = 60;
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        const scale = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight, MAX_ZOOM);
        const finalScale = Math.max(scale, MIN_ZOOM);

        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;

        initialTransform = d3.zoomIdentity
          .translate(viewportWidth / 2 - contentCenterX * finalScale, viewportHeight / 2 - contentCenterY * finalScale)
          .scale(finalScale);
      }

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
  }, [layout, baseWidth, baseHeight, dimensions?.width, dimensions?.height, treeId, onPanZoomGesture]);

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

  const handleNodeClick = useCallback((node) => {
    const datum = resolveNodeDatum(node);
    const nodeId = datum?.id;
    if (!nodeId) {
      return;
    }
    if (externalSelectedNodeId === undefined) {
      setInternalSelectedNodeId(nodeId);
    }
    onNodeClick({ id: nodeId, node: datum });
  }, [onNodeClick, externalSelectedNodeId]);

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
    const original = nodeMap.get(targetId) || target;
    if (externalSelectedNodeId === undefined) {
      setInternalSelectedNodeId(targetId);
    }
    onNodeClick({ id: targetId, node: original });
  }, [nodeMap, onNodeClick, externalSelectedNodeId]);

  const handleAttachmentsChange = useCallback((nodeId, next) => {
    if (typeof onNodeAttachmentsChange === 'function') {
      onNodeAttachmentsChange(nodeId, next);
    }
  }, [onNodeAttachmentsChange]);

  const nodeFill = useCallback((node) => resolveNodeColor(node), [resolveNodeColor]);

  const textFill = theme === 'dark' ? '#e2e8f0' : '#0f172a';
  const baseLinkColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.95)' : 'rgba(100, 116, 139, 0.95)';
  
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
            // 더블 클릭 타이머가 있으면 더블 클릭으로 처리
            if (backgroundClickTimerRef.current) {
              clearTimeout(backgroundClickTimerRef.current);
              backgroundClickTimerRef.current = null;

              if (isChatPanelOpen) {
                // 채팅창이 열려있으면: 채팅창만 닫기 (줌 유지)
                setClickedNodeId(null);
                setHoveredNodeId(null);
                if (externalSelectedNodeId === undefined) {
                  setInternalSelectedNodeId(null);
                }
                if (typeof onBackgroundClick === 'function') {
                  onBackgroundClick();
                }
              } else {
                // 채팅창이 닫혀있으면: 줌 초기화
                const svgElement = svgRef.current;
                const zoom = zoomBehaviorRef.current;
                if (svgElement && zoom) {
                  d3.select(svgElement)
                    .transition()
                    .duration(600)
                    .ease(d3.easeCubicInOut)
                    .call(zoom.transform, d3.zoomIdentity);
                }
              }
            } else {
              // 싱글 클릭: 타이머 시작
              backgroundClickTimerRef.current = setTimeout(() => {
                const hasHighlight = clickedNodeId !== null;

                if (hasHighlight) {
                  // 하이라이트가 있으면 하이라이트만 해제 (채팅창과 테두리 유지)
                  setClickedNodeId(null);
                  setHoveredNodeId(null);
                  // 선택(테두리)은 유지, 채팅창도 유지
                } else {
                  // 하이라이트가 없으면 채팅창 닫기
                  setClickedNodeId(null);
                  setHoveredNodeId(null);
                  if (externalSelectedNodeId === undefined) {
                    setInternalSelectedNodeId(null);
                  }
                  if (typeof onBackgroundClick === 'function') {
                    onBackgroundClick();
                  }
                }
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
                  strokeWidth={1.2}
                  strokeOpacity={strokeOpacity}
                  strokeLinecap="round"
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
              const orientationFlip = !isRootNode && node.x >= Math.PI;
              const textAnchor = isRootNode ? 'middle' : (node.x < Math.PI === isLeaf ? 'start' : 'end');
              const textOffset = isRootNode ? 0 : (node.x < Math.PI === isLeaf ? 8 : -8);
              const isHovered = hoveredNodeId === nodeId;
              const isNodeHighlighted = nodeId ? highlightedAncestorIds.has(nodeId) : false;
              const nodeOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.18) : 1;
              const textOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.22) : 1;
              const circleOpacity = isHighlightMode ? (isNodeHighlighted ? 1 : 0.28) : 1;

              return (
                <g
                  key={nodeId || `node-${node.x}-${node.y}`}
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
    </div>
  );
};

export default ForceDirectedTree;
