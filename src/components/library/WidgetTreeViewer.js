import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { AnimatePresence, motion } from "framer-motion";
import TreeNode from 'features/tree/ui/components/TreeNode';
import TreeAnimationService from 'features/tree/services/TreeAnimationService';
import WidgetTidyTreeChart from "./WidgetTidyTreeChart";
import QuestionService from "services/QuestionService";
import { markNewLinks } from "utils/linkAnimationUtils";

const DEFAULT_DIMENSIONS = { width: 800, height: 600 };

const normalizeTreeData = (treeData) => {
  if (!treeData) {
    return { nodes: [], links: [] };
  }

  const rawNodes = Array.isArray(treeData.nodes) ? treeData.nodes : [];
  const rawLinks = Array.isArray(treeData.links) ? treeData.links : [];

  // 먼저 링크를 정규화
  const links = rawLinks.map((link) => {
    const source = typeof link.source === "object" ? link.source?.id : link.source;
    const target = typeof link.target === "object" ? link.target?.id : link.target;
    return {
      source,
      target,
      value: link.value ?? 1,
    };
  }).filter((link) => link.source && link.target);

  // 부모-자식 관계를 맵으로 생성
  const parentMap = new Map();
  links.forEach(link => {
    parentMap.set(link.target, link.source);
  });

  const nodes = rawNodes.map((node) => ({
    id: node.id,
    keyword: node.keyword || node.question || node.answer || node.id,
    fullText: node.fullText || node.answer || "",
    status: node.status || "answered",
    createdAt: node.createdAt || node.created_at || Date.now(),
    updatedAt: node.updatedAt || node.updated_at || Date.now(),
    level: node.level ?? 0,
    conversation: node.conversation || [],
    questionData: node.questionData,
    parentId: parentMap.get(node.id) || null, // 부모 ID 추가
  })).filter((node) => typeof node.id === "string" && node.id.trim().length > 0);

  return { nodes, links };
};

const WidgetTreeViewer = ({ treeData, onNodeSelect, onRemoveNode }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const overlayRef = useRef(null);
  const animationServiceRef = useRef(null);
  const questionServiceRef = useRef(null);
  const animationRef = useRef(null);
  const linkKeysRef = useRef(new Set());
  const currentNodesRef = useRef([]);
  const colorScaleRef = useRef(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());
  const [dimensions, setDimensions] = useState(DEFAULT_DIMENSIONS);
  const [layoutNodes, setLayoutNodes] = useState([]);
  const [layoutLinks, setLayoutLinks] = useState([]);
  const [isForceSimulationEnabled, setIsForceSimulationEnabled] = useState(true);
  const [showTidyView, setShowTidyView] = useState(false);

  // 접힘 토글 함수
  const toggleCollapse = (nodeId) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // 특정 노드를 중앙으로 이동하는 함수
  const focusOnNode = useCallback((targetNode) => {
    if (!targetNode || !svgRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // 노드 위치
    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;

    // 화면 중앙에 노드가 오도록 계산
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    // 적당한 줌 레벨 (1.5배 확대)
    const targetScale = 1.5;

    // 새로운 transform 계산
    const translateX = centerX - (nodeX * targetScale);
    const translateY = centerY - (nodeY * targetScale);

    const newTransform = d3.zoomIdentity.translate(translateX, translateY).scale(targetScale);

    if (svgRef.current) {
      const svgSelection = d3.select(svgRef.current);

      const newZoomBehavior = d3.zoom()
        .scaleExtent([0.3, 4])
        .wheelDelta((event) => event.deltaY * -0.0003)
        .filter((event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target && target.closest('foreignObject')) return false;
          if (target && target.closest('[data-node-id]')) return false;
          if (event.type === 'dblclick') return false;
          // 휠 줌만 수정키 필요, 드래그 패닝은 허용
          if (event.type === 'wheel') return event.ctrlKey || event.metaKey;
          if (event.type === 'mousedown' && event.button === 1) return true;
          return true;
        })
        .on('zoom', (event) => {
          setViewTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
        });

      // 부드러운 애니메이션으로 이동
      svgSelection
        .transition()
        .duration(500)
        .call(newZoomBehavior.transform, newTransform);
    }
  }, []);

  // 전체 뷰로 이동하는 함수
  const fitToView = useCallback(() => {
    if (!layoutNodes.length || !svgRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    // 노드들의 경계 계산
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    layoutNodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    // 노드 크기 고려 (대략적인 반지름 30px)
    const padding = 60;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const nodeWidth = maxX - minX;
    const nodeHeight = maxY - minY;
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // 스케일 계산 (여백 포함)
    const scaleX = containerWidth / nodeWidth;
    const scaleY = containerHeight / nodeHeight;
    const scale = Math.min(scaleX, scaleY, 1); // 최대 1배까지만 확대

    // 중앙 정렬을 위한 변위 계산
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const translateX = (containerWidth / 2) - (centerX * scale);
    const translateY = (containerHeight / 2) - (centerY * scale);

    // 새로운 transform 생성
    const newTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

    // 부드러운 애니메이션으로 이동
    if (svgRef.current) {
      const svgSelection = d3.select(svgRef.current);

      // 현재 transform 가져오기
      const currentTransform = d3.zoomTransform(svgRef.current);

      // 새로운 zoom behavior 생성하여 부드러운 애니메이션 실행
      const newZoomBehavior = d3.zoom()
        .scaleExtent([0.3, 4])
        .wheelDelta((event) => event.deltaY * -0.0003) // 민감도 더 낮춤 (기본값의 1/2000)
        .filter((event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target && target.closest('foreignObject')) return false;
          if (target && target.closest('[data-node-id]')) return false;
          if (event.type === 'dblclick') return false;
          // 휠 줌만 수정키 필요, 드래그 패닝은 허용
          if (event.type === 'wheel') return event.ctrlKey || event.metaKey;
          if (event.type === 'mousedown' && event.button === 1) return true;
          return true;
        })
        .on('zoom', (event) => {
          setViewTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
        });

      // 부드러운 애니메이션으로 transform 적용
      svgSelection
        .transition()
        .duration(750)
        .call(newZoomBehavior.transform, newTransform)
        .on('end', () => {
          // 애니메이션 완료 후 더블클릭 이벤트 다시 등록
          svgSelection.on('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.target === svgRef.current || event.target.tagName === 'g') {
              fitToView();
            }
          });
        });
    }
  }, [layoutNodes]);

  // Lazy instantiate services
  if (!animationServiceRef.current) {
    animationServiceRef.current = new TreeAnimationService();
  }
  if (!questionServiceRef.current) {
    questionServiceRef.current = new QuestionService();
  }
  if (!colorScaleRef.current) {
    colorScaleRef.current = d3.scaleOrdinal(d3.schemeCategory10);
  }

  useEffect(() => {
    if (!containerRef.current) {
      return () => { };
    }

    const element = containerRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== element) continue;
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 320),
          height: Math.max(height, 320),
        });
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  const normalizedData = useMemo(() => normalizeTreeData(treeData), [treeData]);
  const childMap = useMemo(() => {
    const map = new Map();
    normalizedData.links.forEach((link) => {
      if (!map.has(link.source)) {
        map.set(link.source, new Set());
      }
      map.get(link.source).add(link.target);
    });
    return map;
  }, [normalizedData]);

  // 접힌 노드들을 고려한 필터링된 데이터
  const filteredData = useMemo(() => {
    if (!normalizedData.nodes.length) {
      return { nodes: [], links: [] };
    }

    // 루트 노드 찾기 (부모가 없는 노드)
    const rootNodes = normalizedData.nodes.filter(node => !node.parentId);
    if (rootNodes.length === 0) {
      return { nodes: [], links: [] };
    }

    const visible = new Set();
    const stack = [...rootNodes.map(node => node.id)];

    while (stack.length > 0) {
      const current = stack.pop();
      if (visible.has(current)) continue;
      visible.add(current);

      // 접힌 노드라면 하위 노드들을 스택에 추가하지 않음
      if (collapsedNodeIds.has(current)) continue;

      const children = childMap.get(current) || [];
      for (const child of children) {
        stack.push(child);
      }
    }

    const filteredNodes = normalizedData.nodes.filter(node => visible.has(node.id));
    const filteredLinks = normalizedData.links.filter(link => {
      const sourceId = link.source;
      const targetId = link.target;
      return visible.has(sourceId) && visible.has(targetId) && !collapsedNodeIds.has(sourceId);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [normalizedData, collapsedNodeIds, childMap]);

  useEffect(() => {
    currentNodesRef.current = layoutNodes;
  }, [layoutNodes]);

  useEffect(() => {
    if (!filteredData.nodes.length) {
      setLayoutNodes([]);
      setLayoutLinks([]);
      return () => { };
    }

    if (animationRef.current) {
      animationRef.current.stop();
    }

    const animation = animationServiceRef.current.calculateTreeLayoutWithAnimation(
      currentNodesRef.current,
      filteredData.nodes,
      filteredData.links,
      dimensions,
      (nextNodes, nextLinks) => {
        setLayoutNodes(nextNodes);
        const { annotatedLinks, nextKeys } = markNewLinks(linkKeysRef.current, nextLinks);
        linkKeysRef.current = nextKeys;
        setLayoutLinks(annotatedLinks);
      },
      { enableForceSimulation: isForceSimulationEnabled }
    );

    animationRef.current = animation;

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [filteredData, dimensions, isForceSimulationEnabled]);

  useEffect(() => () => {
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationServiceRef.current?.cleanup?.();
  }, []);

  // D3 zoom behavior 설정
  useEffect(() => {
    if (!svgRef.current) return undefined;

    const svgSelection = d3.select(svgRef.current);
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.3, 4])
      .wheelDelta((event) => event.deltaY * -0.003) // 민감도 더 낮춤 (기본값의 1/2000)
      .filter((event) => {
        // 노드나 foreignObject 내부에서는 zoom 비활성화
        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('foreignObject')) return false;
        if (target && target.closest('[data-node-id]')) return false;
        // 더블클릭 이벤트는 비활성화
        if (event.type === 'dblclick') return false;
        // 휠 줌만 수정키 필요, 드래그 패닝은 허용
        if (event.type === 'wheel') return event.ctrlKey || event.metaKey;
        if (event.type === 'mousedown' && event.button === 1) return true;
        return true;
      })
      .on('zoom', (event) => {
        setViewTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });

    // 더블클릭 이벤트 등록
    svgSelection.on('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      // 빈공간(배경)을 더블클릭한 경우에만 전체 뷰로 이동
      if (event.target === svgRef.current || event.target.tagName === 'g') {
        fitToView();
      }
    });

    // zoom behavior 적용
    svgSelection
      .style('touch-action', 'none')
      .call(zoomBehavior);

    return () => {
      svgSelection.on('.zoom', null);
      svgSelection.on('dblclick', null);
    };
  }, [fitToView]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/* 더블클릭 안내 메시지 */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none">
        <div className="bg-white text-gray-800 text-sm px-3 py-1 rounded-full shadow-lg">
          더블클릭으로 한눈에 보기
        </div>
      </div>

      {/* Force Simulation 토글 버튼 */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setIsForceSimulationEnabled(!isForceSimulationEnabled)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${isForceSimulationEnabled
              ? 'bg-blue-500 text-white shadow-lg hover:bg-blue-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          title={isForceSimulationEnabled ? '유기적 작용 끄기' : '유기적 작용 켜기'}
        >
          {isForceSimulationEnabled ? '유기적 작용 ON' : '유기적 작용 OFF'}
        </button>
        <button
          onClick={() => setShowTidyView(true)}
          className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 bg-emerald-500 text-white shadow-lg hover:bg-emerald-600"
        >
          정렬 트리 보기
        </button>
      </div>

      <svg ref={svgRef} className="h-full w-full">
        <defs>
          <marker
            id="library-widget-arrow"
            viewBox="0 -5 10 10"
            refX={10}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="rgba(0, 0, 0, 0.6)" />
          </marker>
        </defs>

        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
          <AnimatePresence>
            {layoutLinks.map((link, index) => {
              const sourceNode = layoutNodes.find((node) => node.id === link.source);
              const targetNode = layoutNodes.find((node) => node.id === link.target);
              if (!sourceNode || !targetNode) return null;

              const sourceX = sourceNode.x;
              const sourceY = sourceNode.y + 50;
              const pathString = `M ${sourceX} ${sourceY} L ${targetNode.x} ${targetNode.y}`;

              return (
                <g key={link.key || `${link.source}->${link.target}`}>
                  {/* Neumorphism shadow for line */}
                  <motion.path
                    d={pathString}
                    stroke="#bebebe"
                    strokeOpacity={0.4}
                    strokeWidth={Math.sqrt(link.value || 1) * 1.5 + 2}
                    fill="none"
                    style={{
                      filter: 'blur(2px)',
                    }}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{
                      duration: 0.45,
                      ease: "easeInOut",
                      delay: index * 0.04,
                    }}
                  />
                  {/* Main neumorphism line */}
                  <motion.path
                    d={pathString}
                    stroke="#e0e0e0"
                    strokeOpacity={0.9}
                    strokeWidth={Math.sqrt(link.value || 1) * 1.5}
                    fill="none"
                    markerEnd="url(#library-widget-arrow)"
                    style={{
                      filter: 'drop-shadow(1px 1px 2px #bebebe) drop-shadow(-1px -1px 2px #ffffff)',
                    }}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{
                      duration: 0.45,
                      ease: "easeInOut",
                      delay: index * 0.04,
                    }}
                  />
                </g>
              );
            })}
          </AnimatePresence>

          {layoutNodes.map((node, index) => (
            <motion.g
              key={node.id}
              data-node-id={node.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.08, type: "spring", stiffness: 280, damping: 28 }}
            >
              <TreeNode
                node={node}
                position={{ x: node.x || 0, y: node.y || 0 }}
                color={colorScaleRef.current(node.depth || 0)}
                onDrag={null}
                onNodeClick={onNodeSelect ? () => {
                  // 먼저 노드를 중앙으로 이동
                  focusOnNode(node);
                  // 약간의 지연 후 채팅창 열기
                  setTimeout(() => onNodeSelect(node), 300);
                } : null}
                isExpanded={false}
                onSecondQuestion={undefined}
                onPlaceholderCreate={undefined}
                questionService={questionServiceRef.current}
                initialConversation={Array.isArray(node.conversation) ? node.conversation : []}
                onConversationChange={() => { }}
                onRequestAnswer={() => { }}
                onAnswerComplete={() => { }}
                onAnswerError={() => { }}
                onRemoveNode={onRemoveNode}
                hasChildren={childMap.has(node.id) && childMap.get(node.id).size > 0}
                isCollapsed={collapsedNodeIds.has(node.id)}
                onToggleCollapse={toggleCollapse}
                viewTransform={viewTransform}
                overlayElement={overlayRef.current}
              />
            </motion.g>
          ))}
        </g>
      </svg>

      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {showTidyView && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 p-6">
          <WidgetTidyTreeChart data={filteredData} onClose={() => setShowTidyView(false)} />
        </div>
      )}
    </div>
  );
};

export default WidgetTreeViewer;
