import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { cn } from "lib/utils";

const NODE_VERTICAL_SPACING = 80;
const NODE_HORIZONTAL_SPACING = 200;
const NODE_WIDTH = 140;
const NODE_HEIGHT = 48;

const LibraryTreeVisualization = ({ treeData, isEditMode, onTreeUpdate, onNodeSelect }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [layoutNodes, setLayoutNodes] = useState([]);
  const [layoutLinks, setLayoutLinks] = useState([]);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftFullText, setDraftFullText] = useState("");

  const nodes = treeData?.nodes ?? [];
  const links = treeData?.links ?? [];

  const rootId = useMemo(() => {
    if (!nodes.length) return null;
    const targetIds = new Set(links.map((link) => link.target));
    const rootNode = nodes.find((node) => !targetIds.has(node.id));
    return (rootNode ?? nodes[0])?.id ?? null;
  }, [nodes, links]);

  const selectedNode = useMemo(
    () => layoutNodes.find((node) => node.id === selectedNodeId),
    [layoutNodes, selectedNodeId]
  );

  useEffect(() => {
    if (typeof onNodeSelect !== "function") {
      return;
    }
    if (!selectedNodeId) {
      onNodeSelect(null);
      return;
    }
    const nextNode = nodes.find((node) => node.id === selectedNodeId) || null;
    onNodeSelect(nextNode ? { ...nextNode } : null);
  }, [nodes, onNodeSelect, selectedNodeId]);

  useEffect(() => {
    if (selectedNodeId || !rootId) {
      return;
    }
    setSelectedNodeId(rootId);
  }, [rootId, selectedNodeId]);

  const updateDraftFromNode = useCallback((node) => {
    if (!node) {
      setDraftKeyword("");
      setDraftFullText("");
      return;
    }
    setDraftKeyword(node.keyword || "");
    setDraftFullText(node.fullText || "");
  }, []);

  useEffect(() => {
    updateDraftFromNode(selectedNode);
  }, [selectedNode, updateDraftFromNode]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.current) {
          const { width, height } = entry.contentRect;
          setDimensions({
            width: Math.max(width, 320),
            height: Math.max(height, 320),
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const computeLayout = useCallback(() => {
    if (!nodes.length) {
      setLayoutNodes([]);
      setLayoutLinks([]);
      return;
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, { ...node }]));
    const childrenMap = new Map();
    links.forEach((link) => {
      if (!childrenMap.has(link.source)) {
        childrenMap.set(link.source, []);
      }
      childrenMap.get(link.source).push(link.target);
    });

    const buildHierarchy = (nodeId) => ({
      ...nodeMap.get(nodeId),
      children: (childrenMap.get(nodeId) || []).map(buildHierarchy),
    });

    const rootNode = rootId ? nodeMap.get(rootId) : nodes[0];
    if (!rootNode) {
      setLayoutNodes([]);
      setLayoutLinks([]);
      return;
    }

    const hierarchy = d3.hierarchy(buildHierarchy(rootNode.id));
    const tree = d3
      .tree()
      .nodeSize([NODE_VERTICAL_SPACING, NODE_HORIZONTAL_SPACING])
      .separation(() => 1.2);

    const treeLayout = tree(hierarchy);
    const treeNodes = treeLayout.descendants();
    const treeLinks = treeLayout.links();

    const xValues = treeNodes.map((node) => node.x);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const horizontalPadding = NODE_WIDTH;
    const verticalPadding = NODE_HEIGHT * 1.5;

    const xOffset = (dimensions.height - (maxX - minX)) / 2 - minX;
    const yOffset = NODE_HEIGHT + 40;

    const positionedNodes = treeNodes.map((node) => ({
      ...node.data,
      depth: node.depth,
      x: node.x + xOffset,
      y: node.y + yOffset,
    }));

    const positionedLinks = treeLinks.map(({ source, target }) => ({
      source: {
        x: source.x + xOffset,
        y: source.y + yOffset,
        id: source.data.id,
      },
      target: {
        x: target.x + xOffset,
        y: target.y + yOffset,
        id: target.data.id,
      },
    }));

    setLayoutNodes(positionedNodes);
    setLayoutLinks(positionedLinks);
  }, [nodes, links, rootId, dimensions]);

  useEffect(() => {
    computeLayout();
  }, [computeLayout]);

  useEffect(() => {
    if (!svgRef.current) return undefined;

    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.5, 2.5])
      .on("zoom", (event) => {
        setViewTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        });
      });

    const selection = d3.select(svgRef.current);
    selection.call(zoomBehavior);
    return () => selection.on(".zoom", null);
  }, []);

  const handleNodeSelect = useCallback(
    (nodeId) => {
      if (!isEditMode) {
        setSelectedNodeId(nodeId);
        return;
      }

      setSelectedNodeId((current) => (current === nodeId ? null : nodeId));
    },
    [isEditMode]
  );

  const handleSaveNode = () => {
    if (!selectedNodeId) return;
    const updatedNodes = nodes.map((node) =>
      node.id === selectedNodeId
        ? {
            ...node,
            keyword: draftKeyword,
            fullText: draftFullText,
          }
        : node
    );
    onTreeUpdate({ nodes: updatedNodes, links });
  };

  const handleAddChild = () => {
    if (!selectedNodeId) return;
    const newNodeId = `node_${Date.now()}`;
    const parentNode = nodes.find((node) => node.id === selectedNodeId);
    const newNode = {
      id: newNodeId,
      keyword: "새 노드",
      fullText: "",
      level: (parentNode?.level ?? 0) + 1,
      status: "draft",
      size: 12,
    };

    onTreeUpdate({
      nodes: [...nodes, newNode],
      links: [...links, { source: selectedNodeId, target: newNodeId, value: 1 }],
    });
    setSelectedNodeId(newNodeId);
  };

  const collectDescendants = useCallback(
    (nodeId) => {
      const descendants = new Set([nodeId]);
      const queue = [nodeId];
      while (queue.length) {
        const current = queue.shift();
        links
          .filter((link) => link.source === current)
          .forEach((link) => {
            if (!descendants.has(link.target)) {
              descendants.add(link.target);
              queue.push(link.target);
            }
          });
      }
      return descendants;
    },
    [links]
  );

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    if (selectedNodeId === rootId) {
      return;
    }

    const removeSet = collectDescendants(selectedNodeId);
    const updatedNodes = nodes.filter((node) => !removeSet.has(node.id));
    const updatedLinks = links.filter(
      (link) => !removeSet.has(link.source) && !removeSet.has(link.target)
    );

    onTreeUpdate({ nodes: updatedNodes, links: updatedLinks });
    setSelectedNodeId(null);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="h-full w-full">
        <defs>
          <marker
            id="library-arrow"
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
          <g className="links">
            <AnimatePresence>
              {layoutLinks.map((link) => {
                const path = `M ${link.source.x} ${link.source.y} L ${link.target.x} ${link.target.y - NODE_HEIGHT / 2}`;
                return (
                  <g key={`${link.source.id}-${link.target.id}`}>
                    {/* Neumorphism shadow for line */}
                    <motion.path
                      d={path}
                      stroke="#bebebe"
                      strokeOpacity={0.3}
                      strokeWidth={4}
                      fill="none"
                      style={{
                        filter: 'blur(2px)',
                      }}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      exit={{ pathLength: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    {/* Main neumorphism line */}
                    <motion.path
                      d={path}
                      stroke="#e0e0e0"
                      strokeOpacity={0.8}
                      strokeWidth={2}
                      fill="none"
                      markerEnd="url(#library-arrow)"
                      style={{
                        filter: 'drop-shadow(1px 1px 2px #bebebe) drop-shadow(-1px -1px 2px #ffffff)',
                      }}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      exit={{ pathLength: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </g>
                );
              })}
            </AnimatePresence>
          </g>

          <g className="nodes">
            <AnimatePresence>
              {layoutNodes.map((node) => (
                <motion.g
                  key={node.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <foreignObject
                    x={node.x - NODE_WIDTH / 2}
                    y={node.y - NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                  >
                    <button
                      type="button"
                      onClick={() => handleNodeSelect(node.id)}
                      className={cn(
                        "flex h-full w-full flex-col justify-center rounded-md border bg-card/90 px-3 text-left shadow-sm transition hover:border-primary hover:shadow",
                        selectedNodeId === node.id && "border-primary"
                      )}
                    >
                      <span className="text-sm font-semibold leading-tight">{node.keyword || node.id}</span>
                      {node.fullText ? (
                        <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {node.fullText}
                        </span>
                      ) : (
                        <span className="mt-1 text-xs text-muted-foreground">내용 없음</span>
                      )}
                    </button>
                  </foreignObject>
                </motion.g>
              ))}
            </AnimatePresence>
          </g>
        </g>
      </svg>

      {isEditMode && selectedNode && (
        <div className="absolute top-4 right-4 w-80 space-y-4 rounded-lg border border-border bg-popover p-4 shadow-lg">
          <div>
            <h3 className="text-base font-semibold">노드 편집</h3>
            <p className="text-xs text-muted-foreground">선택한 노드의 정보를 업데이트하세요.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">키워드</label>
            <Input value={draftKeyword} onChange={(event) => setDraftKeyword(event.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">설명</label>
            <textarea
              value={draftFullText}
              onChange={(event) => setDraftFullText(event.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="노드에 대한 설명을 입력하세요"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSaveNode}>
              변경 저장
            </Button>
            <Button size="sm" variant="secondary" onClick={handleAddChild}>
              자식 노드 추가
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDeleteNode} disabled={selectedNodeId === rootId}>
              노드 삭제
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryTreeVisualization;
