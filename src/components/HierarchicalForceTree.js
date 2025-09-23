import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { treeData } from '../data/treeData';
import TreeNode from './TreeNode';

const HierarchicalForceTree = () => {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0 });
  const simulationRef = useRef(null);

  // Color scheme for different levels
  const colorScheme = d3.scaleOrdinal(d3.schemeCategory10);

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
    // Initialize data
    const nodesCopy = treeData.nodes.map(d => ({ ...d }));
    const linksCopy = treeData.links.map(d => ({ ...d }));

    setNodes(nodesCopy);
    setLinks(linksCopy);

    // Calculate levels for hierarchical positioning
    const levels = new Map();
    nodesCopy.forEach(node => {
      levels.set(node.id, node.level || 0);
    });

    const maxLevel = Math.max(...levels.values());

    // Precompute horizontal distribution per level to reduce overlap while keeping hierarchy readable
    const nodesByLevel = d3.group(nodesCopy, node => levels.get(node.id) || 0);
    const horizontalScales = new Map();

    nodesByLevel.forEach((nodesAtLevel, level) => {
      const domain = nodesAtLevel.map(node => node.id);
      if (!domain.length) return;

      const spread = Math.max(domain.length - 1, 1) * 160;
      const scale = d3
        .scalePoint()
        .domain(domain)
        .range([
          dimensions.width / 2 - spread,
          dimensions.width / 2 + spread,
        ]);

      horizontalScales.set(level, scale);
    });

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodesCopy)
      .force(
        'link',
        d3
          .forceLink(linksCopy)
          .id(d => d.id)
          .distance(80)
      )
      .force(
        'charge',
        d3
          .forceManyBody()
          .strength(-800)
          .distanceMin(40)
          .distanceMax(Math.max(dimensions.width, dimensions.height))
      )
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force(
        'collision',
        d3
          .forceCollide()
          .radius(d => (d.size || 8) + 24)
          .strength(1)
          .iterations(2)
      )
      .force(
        'x',
        d3.forceX(d => {
          const level = levels.get(d.id) || 0;
          const scale = horizontalScales.get(level);
          return scale ? scale(d.id) : dimensions.width / 2;
        }).strength(0.4)
      )
      .force(
        'y',
        d3
          .forceY(d => {
            const level = levels.get(d.id) || 0;
            return 100 + (level * (dimensions.height - 200)) / maxLevel;
          })
          .strength(0.8)
      );

    simulationRef.current = simulation;

    // Update positions on simulation tick
    simulation.on('tick', () => {
      setNodes([...nodesCopy]);
    });

    return () => {
      simulation.stop();
    };
  }, [dimensions]);

  // Handle node click for assistant focus
  const handleNodeClick = (payload) => {
    if (!payload) return;

    if (payload.type === 'dismiss') {
      setExpandedNodeId(null);
      return;
    }

    const node = payload;
    if (!node || !node.id) return;

    setExpandedNodeId(node.id);
  };

  // Drag behavior
  const handleDrag = (nodeId) => {
    return d3.drag()
      .on('start', (event) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          node.fx = node.x;
          node.fy = node.y;
        }
      })
      .on('drag', (event) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          node.fx = event.x;
          node.fy = event.y;
          setNodes([...nodes]);
          // Restart simulation with lower alpha for smoother movement
          simulationRef.current?.alphaTarget(0.1).restart();
        }
      })
      .on('end', (event) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          node.fx = null;
          node.fy = null;
        }
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

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-white">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ background: 'transparent' }}
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
            {links.map((link, index) => {
              const sourceNode = nodes.find(n => n.id === link.source.id || n.id === link.source);
              const targetNode = nodes.find(n => n.id === link.target.id || n.id === link.target);

              if (!sourceNode || !targetNode) return null;

            // Calculate smart curve to avoid line crossing
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const dr = Math.sqrt(dx * dx + dy * dy);

            // Determine curve direction based on node positions and index to spread links
            const sourceLevel = treeData.nodes.find(n => n.id === (sourceNode.id || sourceNode.source))?.level || 0;
            const targetLevel = treeData.nodes.find(n => n.id === (targetNode.id || targetNode.target))?.level || 0;

            // Create more pronounced curves for cross-level connections
            const levelDiff = Math.abs(targetLevel - sourceLevel);
            const baseCurvature = levelDiff > 1 ? 0.4 : 0.2;
            const indexOffset = (index % 3 - 1) * 0.15; // Spread multiple connections
            const curvature = baseCurvature + indexOffset;

            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;

            // Calculate perpendicular offset for curve - stronger for longer distances
            const normalizedDistance = Math.min(dr / 300, 1); // Normalize distance
            const perpX = -dy / dr * curvature * dr * (0.15 + normalizedDistance * 0.1);
            const perpY = dx / dr * curvature * dr * (0.15 + normalizedDistance * 0.1);

            // Use cubic bezier for smoother curves
            const controlX1 = sourceNode.x + perpX * 0.5;
            const controlY1 = sourceNode.y + perpY * 0.5;
            const controlX2 = targetNode.x + perpX * 0.5;
            const controlY2 = targetNode.y + perpY * 0.5;

            const pathString = `M ${sourceNode.x} ${sourceNode.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${targetNode.x} ${targetNode.y}`;

            return (
              <motion.path
                key={`${link.source.id || link.source}-${link.target.id || link.target}-${index}`}
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
              const levels = new Map();
              treeData.nodes.forEach(n => levels.set(n.id, n.level || 0));

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
                  color={colorScheme(levels.get(node.id) || 0)}
                  onDrag={handleDrag}
                  onNodeClick={handleNodeClick}
                  isExpanded={expandedNodeId === node.id}
                />
              </motion.g>
              );
            })}
          </g>
        </g>
      </svg>

    </div>
  );
};

export default HierarchicalForceTree;
