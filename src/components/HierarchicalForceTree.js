import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { treeData } from '../data/treeData';
import TreeNode from './TreeNode';
import TreeAnimationService from '../services/TreeAnimationService';
import QuestionService from '../services/QuestionService';
import { markNewLinks } from '../utils/linkAnimationUtils';

const HierarchicalForceTree = () => {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [data, setData] = useState(treeData);
  const simulationRef = useRef(null);
  const treeAnimationService = useRef(new TreeAnimationService());
  const animationRef = useRef(null);
  const questionService = useRef(new QuestionService());
  const conversationStoreRef = useRef(new Map());
  const linkKeysRef = useRef(new Set());
  const hasCleanedQ2Ref = useRef(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  // Color scheme for different levels
  const colorScheme = d3.scaleOrdinal(d3.schemeCategory10);

  // 현재 데이터에서 루트 노드 ID 계산 (부모 링크의 타겟이 아닌 노드)
  const getRootNodeId = () => {
    const targetIds = new Set(data.links.map(l => (l.target.id || l.target)));
    const rootNode = data.nodes.find(n => !targetIds.has(n.id));
    return rootNode ? rootNode.id : null;
  };

  // 노드 추가 함수
  const addNode = (parentId, nodeData) => {
    // 부모 ID 검증: 유효하지 않으면 루트로 대체
    const isValidParent = data.nodes.some(n => n.id === parentId);
    const resolvedParentId = isValidParent ? parentId : getRootNodeId();

    const newNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keyword: nodeData.keyword,
      fullText: nodeData.fullText,
      level: getNodeLevel(resolvedParentId) + 1,
      size: nodeData.size || 10,
    };

    // 새 노드를 데이터에 추가
    const newData = {
      ...data,
      nodes: [...data.nodes, newNode],
      links: [...data.links, { source: resolvedParentId, target: newNode.id, value: 1 }]
    };

    setData(newData);
    conversationStoreRef.current.set(newNode.id, []);
    console.log('Node added:', newNode);
  };

  // 노드 레벨 계산
  const getNodeLevel = (nodeId) => {
    const node = data.nodes.find(n => n.id === nodeId);
    return node ? node.level : 0;
  };

  // 2번째 질문 처리 함수
  const handleSecondQuestion = (parentNodeId, question) => {
    console.log('2번째 질문 감지:', { parentNodeId, question });

    // 부모 노드 정보 가져오기
    const parentNode = data.nodes.find(n => n.id === parentNodeId);
    if (!parentNode) {
      console.error('부모 노드를 찾을 수 없습니다:', parentNodeId);
      return;
    }

    // 실제 답변 생성
    const answer = `${parentNode.keyword || parentNode.id} 관련 질문 "${question}"에 대한 답변입니다. 이는 ${parentNode.fullText || '관련된 내용'}과 연관되어 있습니다.`;

    // QuestionService를 통해 새 노드 데이터 생성 (실제 답변 포함)
    const newNodeData = questionService.current.createSecondQuestionNode(parentNodeId, question, answer, data.nodes);

    const timestamp = Date.now();
    const initialConversation = [
      { id: `${timestamp}-user`, role: 'user', text: question },
      { id: `${timestamp}-assistant`, role: 'assistant', text: answer, status: 'complete' }
    ];
    conversationStoreRef.current.set(newNodeData.id, initialConversation);

    console.log('생성된 새 노드 데이터:', newNodeData);
    console.log('부모 노드 정보:', parentNode);

    // 새 노드를 데이터에 추가
    const newData = {
      ...data,
      nodes: [...data.nodes, newNodeData],
      links: [...data.links, { source: parentNodeId, target: newNodeData.id, value: 1 }]
    };

    console.log('업데이트된 데이터:', newData);
    setData(newData);
    questionService.current.setQuestionCount(parentNodeId, 1);

    // 새 노드로 즉시 이동
    setExpandedNodeId(newNodeData.id);
    setSelectedNodeId(newNodeData.id);
    console.log('새 노드로 이동:', newNodeData.id);

    // 입력 필드에 포커스 주기 (약간의 지연)
    setTimeout(() => {
      const input = document.querySelector('textarea[placeholder="Ask anything..."]');
      if (input) {
        input.focus();
        console.log('입력 필드에 포커스 설정됨');
      }
    }, 50); // 노드가 렌더링된 후 포커스

    console.log('새 노드 생성됨:', newNodeData);
  };

  // 부모 -> 자식 맵 계산 (원본 데이터 기준)
  const childrenByParent = React.useMemo(() => {
    const map = new Map();
    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    data.links.forEach((l) => {
      const sourceId = normalizeId(l.source);
      const targetId = normalizeId(l.target);
      if (!map.has(sourceId)) map.set(sourceId, []);
      map.get(sourceId).push(targetId);
    });
    return map;
  }, [data.links]);

  // 접힘 토글
  const toggleCollapse = (nodeId) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  };

  // 접힘 상태에 따른 보이는 노드/링크 계산
  const visibleGraph = React.useMemo(() => {
    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    const rootId = getRootNodeId();
    if (!rootId) {
      return { nodes: data.nodes.slice(), links: data.links.slice(), visibleSet: new Set(data.nodes.map(n => n.id)) };
    }

    const visible = new Set();
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (visible.has(current)) continue;
      visible.add(current);
      if (collapsedNodeIds.has(current)) continue; // 하위는 숨김
      const children = childrenByParent.get(current) || [];
      for (const child of children) stack.push(child);
    }

    const filteredNodes = data.nodes.filter((n) => visible.has(n.id));
    const filteredLinks = data.links.filter((l) => {
      const s = normalizeId(l.source);
      const t = normalizeId(l.target);
      return visible.has(s) && visible.has(t) && !collapsedNodeIds.has(s);
    });

    return { nodes: filteredNodes, links: filteredLinks, visibleSet: visible };
  }, [data, collapsedNodeIds, childrenByParent]);

  const getInitialConversationForNode = (nodeId) => {
    const stored = conversationStoreRef.current.get(nodeId);
    return stored ? stored.map((message) => ({ ...message })) : [];
  };

  const handleConversationChange = (nodeId, messages) => {
    conversationStoreRef.current.set(
      nodeId,
      Array.isArray(messages) ? messages.map((message) => ({ ...message })) : []
    );
  };

  const handlePlaceholderCreate = (parentNodeId, keywords) => {
    if (!Array.isArray(keywords) || keywords.length === 0) return;
    const parentExists = data.nodes.some((node) => node.id === parentNodeId);
    if (!parentExists) return;

    const parentLevel = getNodeLevel(parentNodeId);
    const timestamp = Date.now();

    const placeholderNodes = keywords.map((keyword, index) => {
      const id = `placeholder_${timestamp}_${index}_${Math.random().toString(36).slice(2, 8)}`;
      const label = keyword && keyword.trim().length > 0 ? keyword.trim() : `Placeholder ${index + 1}`;
      return {
        id,
        keyword: label,
        fullText: '',
        level: parentLevel + 1,
        size: 12,
        status: 'placeholder',
        placeholder: {
          parentNodeId,
          createdAt: timestamp,
        },
      };
    });

    const placeholderLinks = placeholderNodes.map((node) => ({
      source: parentNodeId,
      target: node.id,
      value: 1,
    }));

    const newData = {
      ...data,
      nodes: [...data.nodes, ...placeholderNodes],
      links: [...data.links, ...placeholderLinks],
    };

    setData(newData);
    placeholderNodes.forEach((node) => {
      conversationStoreRef.current.set(node.id, []);
    });

    setSelectedNodeId(parentNodeId);
    setExpandedNodeId(parentNodeId);
  };

  // 노드 및 하위 노드 제거 함수
  const removeNodeAndDescendants = (nodeId) => {
    if (!nodeId) return;

    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);

    const toRemove = new Set();
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (toRemove.has(current)) continue;
      toRemove.add(current);

      // 현재 노드의 자식 노드들을 스택에 추가
      data.links.forEach((link) => {
        const sourceId = normalizeId(link.source);
        const targetId = normalizeId(link.target);
        if (sourceId === current) {
          stack.push(targetId);
        }
      });
    }

    const newNodes = data.nodes.filter((n) => !toRemove.has(n.id));
    const newLinks = data.links.filter((l) => {
      const sourceId = normalizeId(l.source);
      const targetId = normalizeId(l.target);
      return !toRemove.has(sourceId) && !toRemove.has(targetId);
    });

    setData({ ...data, nodes: newNodes, links: newLinks });

    // 대화 상태 정리
    toRemove.forEach((id) => {
      conversationStoreRef.current.delete(id);
    });

    // 선택/확장 상태 초기화
    if (selectedNodeId && toRemove.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
    if (expandedNodeId && toRemove.has(expandedNodeId)) {
      setExpandedNodeId(null);
    }
  };

  // 노드 클릭 핸들러
  const handleNodeClick = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  useEffect(() => {
    data.nodes.forEach((node) => {
      if (!conversationStoreRef.current.has(node.id)) {
        conversationStoreRef.current.set(node.id, []);
      }
    });
  }, [data.nodes]);

  // 줌/팬 기능 제거 - 노드 영역만 드래그 가능하도록 수정
  // useEffect(() => {
  //   if (!svgRef.current) return undefined;

  //   const svgSelection = d3.select(svgRef.current);
  //   const zoomFactory = typeof d3.zoom === 'function' ? d3.zoom : null;
  //   if (!zoomFactory) {
  //     return undefined;
  //   }

  //   const zoomInstance = zoomFactory();
  //   if (!zoomInstance || typeof zoomInstance.scaleExtent !== 'function') {
  //     return undefined;
  //   }

  //   const zoomBehaviour = zoomInstance
  //     .scaleExtent([1, 1])
  //     .filter((event) => {
  //       if (event.type === 'wheel' || event.type === 'dblclick') return false;
  //       const target = event.target instanceof Element ? event.target : null;
  //       if (target && target.closest('[data-node-id]')) return false;
  //       // Left button only
  //       return event.button === 0;
  //     })
  //     .on('zoom', (event) => {
  //       setViewTransform({ x: event.transform.x, y: event.transform.y });
  //     });

  //   svgSelection.call(zoomBehaviour).on('dblclick.zoom', null);

  //   return () => {
  //     svgSelection.on('.zoom', null);
  //   };
  // }, []);

  // 과거 생성된 Q2 노드들(및 하위 노드) 정리 - 최초 1회만 수행
  useEffect(() => {
    if (hasCleanedQ2Ref.current) return;

    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    const isQ2Node = (node) => {
      const hasQ2Keyword = typeof node.keyword === 'string' && /^\s*Q2\s*:/.test(node.keyword);
      const hasQ2Flag = node.questionData && Number(node.questionData.questionNumber) === 2;
      return hasQ2Keyword || hasQ2Flag;
    };

    const q2Roots = data.nodes.filter(isQ2Node);
    if (q2Roots.length === 0) {
      hasCleanedQ2Ref.current = true;
      return;
    }

    const toRemove = new Set(q2Roots.map((n) => n.id));
    const stack = q2Roots.map((n) => n.id);

    while (stack.length > 0) {
      const current = stack.pop();
      data.links.forEach((link) => {
        const sourceId = normalizeId(link.source);
        const targetId = normalizeId(link.target);
        if (sourceId === current && !toRemove.has(targetId)) {
          toRemove.add(targetId);
          stack.push(targetId);
        }
      });
    }

    if (toRemove.size === 0) {
      hasCleanedQ2Ref.current = true;
      return;
    }

    const newNodes = data.nodes.filter((n) => !toRemove.has(n.id));
    const newLinks = data.links.filter((l) => {
      const sourceId = normalizeId(l.source);
      const targetId = normalizeId(l.target);
      return !toRemove.has(sourceId) && !toRemove.has(targetId);
    });

    setData({ ...data, nodes: newNodes, links: newLinks });
    toRemove.forEach((id) => conversationStoreRef.current.delete(id));
    if (selectedNodeId && toRemove.has(selectedNodeId)) setSelectedNodeId(null);
    if (expandedNodeId && toRemove.has(expandedNodeId)) setExpandedNodeId(null);

    hasCleanedQ2Ref.current = true;
  }, [data, selectedNodeId, expandedNodeId]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // 기존 애니메이션 정리
    if (animationRef.current) {
      animationRef.current.stop();
    }

    // Tree layout과 애니메이션을 사용하여 노드 위치 계산
    const animation = treeAnimationService.current.calculateTreeLayoutWithAnimation(
      nodes, // 현재 노드 위치
      visibleGraph.nodes,
      visibleGraph.links,
      dimensions,
      (animatedNodes, animatedLinks) => {
        setNodes(animatedNodes);
        const { annotatedLinks, nextKeys } = markNewLinks(linkKeysRef.current, animatedLinks);
        linkKeysRef.current = nextKeys;
        setLinks(annotatedLinks);
      }
    );

    animationRef.current = animation;

    // 기존 force simulation 정리
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [dimensions, data, visibleGraph.nodes, visibleGraph.links]);

  // Handle node click for assistant focus
  const handleNodeClickForAssistant = (payload) => {
    if (!payload) return;

    if (payload.type === 'dismiss') {
      setExpandedNodeId(null);
      return;
    }

    const node = payload;
    if (!node || !node.id) return;

    setExpandedNodeId(node.id);
    setSelectedNodeId(node.id);
  };

  // Handle background click to close expanded node
  const handleBackgroundClick = (event) => {
    // Check if the click is on the background (not on a node)
    if (event.target === event.currentTarget || event.target.tagName === 'svg') {
      setExpandedNodeId(null);
    }
  };

  // 노드들의 경계 영역 계산
  const getNodesBounds = () => {
    if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      const x = node.x || 0;
      const y = node.y || 0;
      const width = 200; // 노드의 대략적인 너비
      const height = 50; // 노드의 대략적인 높이

      minX = Math.min(minX, x - width / 2);
      maxX = Math.max(maxX, x + width / 2);
      minY = Math.min(minY, y - height / 2);
      maxY = Math.max(maxY, y + height / 2);
    });

    // 여백 추가
    const padding = 100;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };
  };

  // 줌 기능 구현
  useEffect(() => {
    if (!svgRef.current) return undefined;

    const svgSelection = d3.select(svgRef.current);
    const zoomFactory = typeof d3.zoom === 'function' ? d3.zoom : null;
    if (!zoomFactory) {
      return undefined;
    }

    const zoomInstance = zoomFactory();
    if (!zoomInstance || typeof zoomInstance.scaleExtent !== 'function') {
      return undefined;
    }

    const zoomBehaviour = zoomInstance
      .scaleExtent([1, 3]) // 최소 1배(리셋 화면), 최대 3배 확대
      .filter((event) => {
        // 노드가 확장된 상태에서는 줌 비활성화
        if (expandedNodeId && event.type === 'wheel') return false;

        // 마우스 휠은 노드가 닫혀있을 때만 허용
        if (event.type === 'wheel') return true;

        // 좌클릭 드래그는 노드가 아닌 빈 공간에서만 허용
        if (event.type === 'mousedown' && event.button === 0) {
          const target = event.target;
          // 노드나 노드 내부 요소가 아닌 경우만 팬 허용
          return !target.closest('[data-node-id]') && target.tagName !== 'text';
        }

        return false;
      })
      .on('zoom', (event) => {
        // 노드 영역 경계 내에서만 팬 허용
        const bounds = getNodesBounds();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // 현재 변환된 위치 계산
        const newX = event.transform.x;
        const newY = event.transform.y;
        const scale = event.transform.k;

        // 경계 체크
        let constrainedX = newX;
        let constrainedY = newY;

        // 1배 줌일 때는 좌우 영역을 더 넓게 허용
        const horizontalPadding = scale === 1 ? screenWidth * 0.3 : 0; // 1배 줌일 때 화면 너비의 30% 추가 여백
        const verticalPadding = scale === 1 ? screenHeight * 0.2 : 0; // 1배 줌일 때 화면 높이의 20% 추가 여백

        // 왼쪽 경계 체크
        if (newX > horizontalPadding) constrainedX = horizontalPadding;
        if (newX < screenWidth - (bounds.maxX - bounds.minX) * scale - horizontalPadding) {
          constrainedX = screenWidth - (bounds.maxX - bounds.minX) * scale - horizontalPadding;
        }

        // 위쪽 경계 체크
        if (newY > verticalPadding) constrainedY = verticalPadding;
        if (newY < screenHeight - (bounds.maxY - bounds.minY) * scale - verticalPadding) {
          constrainedY = screenHeight - (bounds.maxY - bounds.minY) * scale - verticalPadding;
        }

        setViewTransform({
          x: constrainedX,
          y: constrainedY,
          k: scale
        });
      });

    // 더블클릭 이벤트를 별도로 처리
    svgSelection.on('dblclick', (event) => {
      // 노드가 확장된 상태에서는 줌 리셋 비활성화
      if (expandedNodeId) return;

      // 노드 내부 요소가 아닌 경우에만 줌 리셋 허용
      const target = event.target;
      if (target.closest('[data-node-id]') || target.tagName === 'text') {
        return;
      }

      event.preventDefault();

      // React 상태 업데이트
      setViewTransform({ x: 0, y: 0, k: 1 });

      // D3 zoom behavior의 내부 transform도 리셋
      const resetTransform = d3.zoomIdentity.translate(0, 0).scale(1);
      svgSelection.call(zoomBehaviour.transform, resetTransform);
    });

    svgSelection.call(zoomBehaviour);

    return () => {
      svgSelection.on('.zoom', null);
      svgSelection.on('dblclick', null);
    };
  }, [expandedNodeId, nodes]);

  useEffect(() => {
    if (!expandedNodeId) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll(`[data-node-id="${expandedNodeId}"]`).raise();
  }, [expandedNodeId, nodes]);

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
      treeAnimationService.current.cleanup();
    };
  }, []);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-white">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ background: 'transparent' }}
        onClick={handleBackgroundClick}
      >
        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            viewBox="0 -5 10 10"
            refX={8}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="rgba(148,163,184,0.55)" />
          </marker>
        </defs>

        {/* Links */}
        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
          <g className="links">
            <AnimatePresence>
              {links
                // TreeLayoutService에서 이미 정렬된 링크 사용
                .map((link, index) => {
                  const sourceNode = nodes.find(n => n.id === link.source);
                  const targetNode = nodes.find(n => n.id === link.target);

                  if (!sourceNode || !targetNode) return null;

                  // Calculate source position from toggle icon bottom edge
                  const sourceX = sourceNode.x;
                  const sourceY = sourceNode.y + 14 + 10; // Toggle icon is 14px below node center + 10px (half of 20px icon height)

                  const shouldAnimate = link.isNew;
                  const pathString = `M ${sourceX} ${sourceY} L ${targetNode.x} ${targetNode.y}`;

                  return (
                    <motion.path
                      key={`${link.source}-${link.target}-${index}`}
                      d={pathString}
                      stroke="rgba(148, 163, 184, 0.55)"
                      strokeOpacity={0.8}
                      strokeWidth={Math.sqrt(link.value || 1) * 1.5}
                      fill="none"
                      markerEnd="url(#arrowhead)"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      exit={{ pathLength: 0, opacity: 0 }}
                      transition={{
                        duration: 0.45,
                        ease: "easeInOut",
                        delay: index * 0.06
                      }}
                      style={{
                        filter: 'drop-shadow(0px 12px 28px rgba(15,23,42,0.32))'
                      }}
                    />
                  );
                })}
            </AnimatePresence>
          </g>

          {/* Nodes */}
          <g className="nodes">
            {nodes.map((node, index) => {
              // Tree layout에서는 depth를 사용
              const nodeDepth = node.depth || 0;

              return (
                <motion.g
                  key={node.id}
                  data-node-id={node.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 300,
                    damping: 25
                  }}
                >
                  <TreeNode
                    node={node}
                    position={{ x: node.x || 0, y: node.y || 0 }}
                    color={colorScheme(nodeDepth)}
                    onNodeClick={handleNodeClickForAssistant}
                    isExpanded={expandedNodeId === node.id}
                    onSecondQuestion={handleSecondQuestion}
                    onPlaceholderCreate={handlePlaceholderCreate}
                    questionService={questionService.current}
                    initialConversation={getInitialConversationForNode(node.id)}
                    onConversationChange={(messages) => handleConversationChange(node.id, messages)}
                    onRemoveNode={removeNodeAndDescendants}
                    hasChildren={(childrenByParent.get(node.id) || []).length > 0}
                    isCollapsed={collapsedNodeIds.has(node.id)}
                    onToggleCollapse={toggleCollapse}
                  />
                </motion.g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* 디버그 패널 제거됨 */}
    </div>
  );
};

export default HierarchicalForceTree;
