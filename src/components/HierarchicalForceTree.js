import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { treeData } from '../data/treeData';
import TreeNode from './TreeNode';
import AddNodeButton from './AddNodeButton';
import TreeAnimationService from '../services/TreeAnimationService';

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

  // Color scheme for different levels
  const colorScheme = d3.scaleOrdinal(d3.schemeCategory10);

  // 노드 추가 함수
  const addNode = (parentId, nodeData) => {
    const newNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keyword: nodeData.keyword,
      fullText: nodeData.fullText,
      level: getNodeLevel(parentId) + 1,
      size: nodeData.size || 10,
    };

    // 새 노드를 데이터에 추가
    const newData = {
      ...data,
      nodes: [...data.nodes, newNode],
      links: [...data.links, { source: parentId, target: newNode.id, value: 1 }]
    };

    setData(newData);
    console.log('Node added:', newNode);
  };

  // 노드 레벨 계산
  const getNodeLevel = (nodeId) => {
    const node = data.nodes.find(n => n.id === nodeId);
    return node ? node.level : 0;
  };

  // 노드 클릭 핸들러
  const handleNodeClick = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  useEffect(() => {
    if (!svgRef.current) return undefined;

    const svgSelection = d3.select(svgRef.current);

    const zoomBehaviour = d3.zoom()
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
      data.nodes,
      data.links,
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
  }, [dimensions, data]);

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
          data.nodes,
          data.links,
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
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 1.5,
                      ease: "easeInOut",
                      delay: index * 0.1
                    }}
                    style={{
                      filter: 'drop-shadow(0px 12px 28px rgba(15,23,42,0.32))'
                    }}
                  />
                );
              })}
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
                  />
                </motion.g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* 노드 추가 버튼 */}
      <AddNodeButton
        parentId={selectedNodeId}
        onAddNode={addNode}
        position={{ x: 20, y: 20 }}
        availableNodes={nodes}
      />

      {/* 디버그 정보 */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-lg z-10">
        <h3 className="font-bold">Debug Info</h3>
        <p>Nodes: {nodes.length}</p>
        <p>Links: {links.length}</p>
        <p>Selected Node: {selectedNodeId || 'None'}</p>
      </div>
    </div>
  );
};

export default HierarchicalForceTree;
