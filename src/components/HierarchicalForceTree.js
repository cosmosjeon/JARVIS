import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { treeData } from '../data/treeData';
import TreeNode from './TreeNode';
import TreeAnimationService from '../services/TreeAnimationService';
import QuestionService from '../services/QuestionService';

const HierarchicalForceTree = () => {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [data, setData] = useState(treeData);
  const simulationRef = useRef(null);
  const treeAnimationService = useRef(new TreeAnimationService());
  const animationRef = useRef(null);
  const questionService = useRef(new QuestionService());
  const conversationStoreRef = useRef(new Map());
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
      .scaleExtent([1, 1])
      .filter((event) => {
        if (event.type === 'wheel' || event.type === 'dblclick') return false;
        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('[data-node-id]')) return false;
        // Left button only
        return event.button === 0;
      })
      .on('zoom', (event) => {
        setViewTransform({ x: event.transform.x, y: event.transform.y });
      });

    svgSelection.call(zoomBehaviour).on('dblclick.zoom', null);

    return () => {
      svgSelection.on('.zoom', null);
    };
  }, []);

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
        setLinks(animatedLinks);
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

  // Drag behavior - 애니메이션 중에도 드래그 가능
  const handleDrag = (nodeId) => {
    return d3.drag()
      .on('start', (event) => {
        // 드래그 시작 시 애니메이션 일시 정지
        if (animationRef.current) {
          animationRef.current.stop();
        }
      })
      .on('drag', (event) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          // 직접 위치 업데이트
          node.x = event.x;
          node.y = event.y;
          setNodes([...nodes]);
        }
      })
      .on('end', (event) => {
        // 드래그 종료 시 tree layout으로 다시 정렬
        const animation = treeAnimationService.current.calculateTreeLayoutWithAnimation(
          nodes,
          visibleGraph.nodes,
          visibleGraph.links,
          dimensions,
          (animatedNodes, animatedLinks) => {
            setNodes(animatedNodes);
            setLinks(animatedLinks);
          }
        );
        animationRef.current = animation;
      });
  };

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    nodes.forEach(node => {
      const selection = svg.selectAll(`[data-node-id="${node.id}"]`);

      if (expandedNodeId) {
        selection.on('.drag', null);
        selection.style('cursor', 'default');
      } else {
        selection.call(handleDrag(node.id));
        selection.style('cursor', 'grab');
      }
    });
  }, [nodes, expandedNodeId]);

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
        <g transform={`translate(${viewTransform.x}, ${viewTransform.y})`}>
          <g className="links">
            <AnimatePresence>
              {links
                // TreeLayoutService에서 이미 정렬된 링크 사용
                .map((link, index) => {
                const sourceNode = nodes.find(n => n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target);

                if (!sourceNode || !targetNode) return null;

                // Tree layout에서는 직선 링크 사용 (더 깔끔함)
                const pathString = `M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`;

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
                    onDrag={handleDrag}
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
