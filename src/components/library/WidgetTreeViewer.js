import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { AnimatePresence, motion } from "framer-motion";
import TreeNode from "components/TreeNode";
import TreeAnimationService from "services/TreeAnimationService";
import QuestionService from "services/QuestionService";
import { markNewLinks } from "utils/linkAnimationUtils";

const DEFAULT_DIMENSIONS = { width: 800, height: 600 };

const normalizeTreeData = (treeData) => {
  if (!treeData) {
    return { nodes: [], links: [] };
  }

  const rawNodes = Array.isArray(treeData.nodes) ? treeData.nodes : [];
  const rawLinks = Array.isArray(treeData.links) ? treeData.links : [];

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
  })).filter((node) => typeof node.id === "string" && node.id.trim().length > 0);

  const links = rawLinks.map((link) => {
    const source = typeof link.source === "object" ? link.source?.id : link.source;
    const target = typeof link.target === "object" ? link.target?.id : link.target;
    return {
      source,
      target,
      value: link.value ?? 1,
    };
  }).filter((link) => link.source && link.target);

  return { nodes, links };
};

const WidgetTreeViewer = ({ treeData, onNodeSelect }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const overlayRef = useRef(null);
  const animationServiceRef = useRef(null);
  const questionServiceRef = useRef(null);
  const animationRef = useRef(null);
  const linkKeysRef = useRef(new Set());
  const currentNodesRef = useRef([]);
  const colorScaleRef = useRef(null);

  const [dimensions, setDimensions] = useState(DEFAULT_DIMENSIONS);
  const [layoutNodes, setLayoutNodes] = useState([]);
  const [layoutLinks, setLayoutLinks] = useState([]);

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

  useEffect(() => {
    currentNodesRef.current = layoutNodes;
  }, [layoutNodes]);

  useEffect(() => {
    if (!normalizedData.nodes.length) {
      setLayoutNodes([]);
      setLayoutLinks([]);
      return () => { };
    }

    if (animationRef.current) {
      animationRef.current.stop();
    }

    const animation = animationServiceRef.current.calculateTreeLayoutWithAnimation(
      currentNodesRef.current,
      normalizedData.nodes,
      normalizedData.links,
      dimensions,
      (nextNodes, nextLinks) => {
        setLayoutNodes(nextNodes);
        const { annotatedLinks, nextKeys } = markNewLinks(linkKeysRef.current, nextLinks);
        linkKeysRef.current = nextKeys;
        setLayoutLinks(annotatedLinks);
      }
    );

    animationRef.current = animation;

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [normalizedData, dimensions]);

  useEffect(() => () => {
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationServiceRef.current?.cleanup?.();
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
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
            <path d="M0,-5L10,0L0,5" fill="rgba(148, 163, 184, 0.6)" />
          </marker>
        </defs>

        <g>
          <AnimatePresence>
            {layoutLinks.map((link, index) => {
              const sourceNode = layoutNodes.find((node) => node.id === link.source);
              const targetNode = layoutNodes.find((node) => node.id === link.target);
              if (!sourceNode || !targetNode) return null;

              const sourceX = sourceNode.x;
              const sourceY = sourceNode.y + 14 + 10;
              const pathString = `M ${sourceX} ${sourceY} L ${targetNode.x} ${targetNode.y}`;

              return (
                <motion.path
                  key={link.key || `${link.source}->${link.target}`}
                  d={pathString}
                  stroke="rgba(148, 163, 184, 0.55)"
                  strokeOpacity={0.8}
                  strokeWidth={Math.sqrt(link.value || 1) * 1.5}
                  fill="none"
                  markerEnd="url(#library-widget-arrow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ pathLength: 0, opacity: 0 }}
                  transition={{
                    duration: 0.45,
                    ease: "easeInOut",
                    delay: index * 0.04,
                  }}
                />
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
                onNodeClick={onNodeSelect ? () => onNodeSelect(node) : null}
                isExpanded={false}
                onSecondQuestion={undefined}
                onPlaceholderCreate={undefined}
                questionService={questionServiceRef.current}
                initialConversation={Array.isArray(node.conversation) ? node.conversation : []}
                onConversationChange={() => { }}
                onRequestAnswer={() => { }}
                onAnswerComplete={() => { }}
                onAnswerError={() => { }}
                onRemoveNode={undefined}
                hasChildren={childMap.has(node.id) && childMap.get(node.id).size > 0}
                isCollapsed={false}
                onToggleCollapse={undefined}
                viewTransform={{ x: 0, y: 0, k: 1 }}
                overlayElement={overlayRef.current}
              />
            </motion.g>
          ))}
        </g>
      </svg>

      <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
    </div>
  );
};

export default WidgetTreeViewer;
