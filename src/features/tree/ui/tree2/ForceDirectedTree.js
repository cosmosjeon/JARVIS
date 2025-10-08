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

const DEFAULT_DIMENSIONS = { width: 954, height: 954 };
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const NODE_RADIUS = 2.6;
const sanitizeLabel = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
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
    node.y = node.depth * levelSpacing;
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
  onNodeClick = () => {},
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
  onConversationChange = () => {},
  onRequestAnswer,
  onAnswerComplete,
  onAnswerError,
  onSecondQuestion,
  onPlaceholderCreate,
  onPanZoomGesture,
  theme = 'light',
  hideAssistantPanel = false,
  attachmentsByNode = {},
  onNodeAttachmentsChange = () => {},
  isForceSimulationEnabled, // kept for compatibility
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
    const mappedHierarchy = DataTransformService.transformToHierarchy(
      nodesArray,
      linksArray,
    );
    return buildRadialLayout(mappedHierarchy, baseRadius, levelSpacing);
  }, [data, baseRadius, levelSpacing]);

  const effectiveRadius = Math.max(baseRadius, layout.requiredRadius + levelSpacing);
  const width = Math.max(baseWidth, effectiveRadius * 2 + 160);
  const height = Math.max(baseHeight, effectiveRadius * 2 + 160);
  const background = theme === 'dark' ? '#0f172a' : '#ffffff';

  const nodeMap = useMemo(() => {
    if (!Array.isArray(data?.nodes)) {
      return new Map();
    }
    return new Map(data.nodes.map((node) => [node.id, node]));
  }, [data?.nodes]);

  const [viewTransform, setViewTransform] = useState(d3.zoomIdentity);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const svgRef = useRef(null);
  const questionServiceRef = useRef(questionService || new QuestionService());

  useEffect(() => {
    if (questionService) {
      questionServiceRef.current = questionService;
    }
  }, [questionService]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const zoom = d3.zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .on('zoom', (event) => {
        setViewTransform(event.transform);
        if (typeof onPanZoomGesture === 'function') {
          onPanZoomGesture(event.transform);
        }
      });

    const selection = d3.select(svgElement);
    selection.call(zoom);
    selection.on('dblclick.zoom', null);

    return () => {
      selection.on('.zoom', null);
    };
  }, [onPanZoomGesture]);

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
    setSelectedNodeId(nodeId);
    onNodeClick({ id: nodeId, node: datum });
  }, [onNodeClick]);

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handlePanelNodeSelect = useCallback((target) => {
    if (!target) {
      return;
    }
    const targetId = target.id ?? target?.data?.id;
    if (!targetId) {
      return;
    }
    const original = nodeMap.get(targetId) || target;
    setSelectedNodeId(targetId);
    onNodeClick({ id: targetId, node: original });
  }, [nodeMap, onNodeClick]);

  const handleAttachmentsChange = useCallback((nodeId, next) => {
    if (typeof onNodeAttachmentsChange === 'function') {
      onNodeAttachmentsChange(nodeId, next);
    }
  }, [onNodeAttachmentsChange]);

  const nodeFill = useCallback((node) => resolveNodeColor(node), [resolveNodeColor]);

  const textFill = theme === 'dark' ? '#e2e8f0' : '#0f172a';
  const baseLinkColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.7)' : 'rgba(148, 163, 184, 0.8)';

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={[-width / 2, -height / 2, width, height].join(' ')}
        style={{ touchAction: 'pan-x pan-y pinch-zoom', cursor: 'grab' }}
      >
        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
          <g fill="none">
            {layout.links.map((link, index) => {
              const targetDepth = link.target.depth || 0;
              const strokeWidth = Math.max(0.55, 1.6 - targetDepth * 0.18);
              const strokeOpacity = Math.max(0.18, 0.58 - targetDepth * 0.06);
              return (
                <path
                  key={`link-${index}`}
                  d={radialLink(link)}
                  stroke={baseLinkColor}
                  strokeWidth={strokeWidth}
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
              const rotation = (node.x * 180) / Math.PI - 90;
              const translation = `translate(${node.y},0)`;
              const orientationFlip = node.x >= Math.PI;
              const textAnchor = node.x < Math.PI === isLeaf ? 'start' : 'end';
              const textOffset = node.x < Math.PI === isLeaf ? 8 : -8;
              const labelWidth = estimateLabelWidth(label);
              const isHovered = hoveredNodeId === nodeId;
              const underlineStart = textAnchor === 'start'
                ? textOffset
                : textOffset - labelWidth;
              const underlineEnd = textAnchor === 'start'
                ? textOffset + labelWidth
                : textOffset;

              return (
                <g
                  key={nodeId || `node-${node.x}-${node.y}`}
                  transform={`rotate(${rotation}) ${translation}`}
                  onMouseEnter={() => setHoveredNodeId(nodeId)}
                  onMouseLeave={() => setHoveredNodeId((current) => (current === nodeId ? null : current))}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNodeClick(node);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    fill={nodeFill(node)}
                    r={NODE_RADIUS}
                  />
                  {label ? (
                    <>
                      <text
                        dy="0.31em"
                        x={textOffset}
                        textAnchor={textAnchor}
                        transform={orientationFlip ? 'rotate(180)' : undefined}
                        fill={textFill}
                        style={{ fontFamily: 'sans-serif', fontSize: 11 }}
                      >
                        {label}
                      </text>
                      <line
                        x1={underlineStart}
                        x2={underlineEnd}
                        y1={orientationFlip ? -6 : 6}
                        y2={orientationFlip ? -6 : 6}
                        stroke={textFill}
                        strokeWidth={1}
                        strokeOpacity={isHovered ? 0.9 : 0.6}
                        strokeLinecap="round"
                        strokeDasharray={labelWidth}
                        strokeDashoffset={isHovered ? 0 : labelWidth}
                        style={{
                          transition: 'stroke-dashoffset 200ms ease',
                          opacity: isHovered ? 1 : 0.85,
                        }}
                      />
                    </>
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
            onSizeChange={() => {}}
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
            onBootstrapFirstSend={() => {}}
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
