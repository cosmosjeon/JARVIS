import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export const useD3Force = (nodes, links, width, height) => {
  const simulationRef = useRef(null);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    if (!nodes.length || !links.length) return;

    // Calculate node levels for hierarchical positioning
    const levels = new Map();
    nodes.forEach(node => {
      levels.set(node.id, node.level || 0);
    });

    const maxLevel = Math.max(...levels.values());

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id(d => d.id)
          .distance(80)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide().radius(d => (d.size || 8) + 5)
      )
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force(
        'y',
        d3
          .forceY(d => {
            const level = levels.get(d.id) || 0;
            return 100 + (level * (height - 200)) / maxLevel;
          })
          .strength(0.8)
      );

    simulationRef.current = simulation;

    // Update positions on simulation tick
    simulation.on('tick', () => {
      setPositions([...nodes]);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, width, height]);

  const drag = (nodeId) => {
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

  return { positions, drag, simulation: simulationRef.current };
};