import { useCallback, useEffect } from 'react';
import DataTransformService from '../../services/force-tree/DataTransformService';
import ForceSimulationService, { FORCE_SIMULATION_DEFAULTS } from '../../services/force-tree/ForceSimulationService';

const useForceTreeSimulation = ({
  data,
  dimensions,
  hierarchicalLinks,
  isForceSimulationEnabled,
  treeId,
  userId,
  viewportStateLoaded,
  setSimulatedNodes,
  setSimulatedLinks,
  previousPositionsRef,
  simulationServiceRef,
  saveViewportState,
  clearPendingViewportSave,
  getNodeDatum,
}) => {
  const assignFallbackPositions = useCallback((nodes = []) => {
    if (!Array.isArray(nodes)) {
      return [];
    }

    const clonedNodes = nodes.map((node) => ({ ...node }));
    const levelMap = new Map();

    clonedNodes.forEach((node) => {
      const level = Number.isFinite(node.level) ? node.level : 0;
      if (!levelMap.has(level)) {
        levelMap.set(level, []);
      }
      levelMap.get(level).push(node);
    });

    levelMap.forEach((levelNodes, level) => {
      const radius = 200 + level * 120;
      const sorted = [...levelNodes].sort((a, b) => {
        const aId = (a.id || '').toString();
        const bId = (b.id || '').toString();
        return aId.localeCompare(bId);
      });
      const count = sorted.length || 1;

      const angleOffset = Math.random() * Math.PI * 2;

      sorted.forEach((node, index) => {
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
          return;
        }
        const angle = angleOffset + (index / count) * Math.PI * 2;
        const jitterX = (Math.random() - 0.5) * 50;
        const jitterY = (Math.random() - 0.5) * 50;
        node.x = Math.cos(angle) * radius + jitterX;
        node.y = Math.sin(angle) * radius + jitterY;
      });
    });

    return clonedNodes;
  }, []);

  useEffect(() => {
    if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
      previousPositionsRef.current = new Map();
      setSimulatedNodes([]);
      setSimulatedLinks([]);
      return undefined;
    }

    if (treeId && userId && !viewportStateLoaded) {
      return undefined;
    }

    const preparedNodes = assignFallbackPositions(data.nodes);

    const hierarchyData = DataTransformService?.transformToHierarchy(
      preparedNodes,
      hierarchicalLinks,
    );

    if (!hierarchyData) {
      previousPositionsRef.current = new Map();
      setSimulatedNodes([]);
      setSimulatedLinks([]);
      return undefined;
    }

    if (!simulationServiceRef.current) {
      simulationServiceRef.current = new ForceSimulationService();
    }

    const previousPositions = previousPositionsRef.current || new Map();
    if (previousPositions.size === 0) {
      preparedNodes.forEach((node) => {
        if (node?.id && Number.isFinite(node.x) && Number.isFinite(node.y)) {
          previousPositions.set(node.id, { x: node.x, y: node.y });
        }
      });
    }

    const handleTick = (nodes, links) => {
      const nextMap = new Map(previousPositionsRef.current);
      nodes.forEach((node) => {
        const datum = getNodeDatum(node);
        if (datum?.id) {
          nextMap.set(datum.id, { x: node.x || 0, y: node.y || 0 });
        }
      });
      previousPositionsRef.current = nextMap;
      setSimulatedNodes([...nodes]);
      setSimulatedLinks([...links]);
    };

    const { nodes: nextNodes, links: nextLinks } = simulationServiceRef.current.createSimulation(
      hierarchyData,
      dimensions,
      handleTick,
      previousPositions,
      { enableForceSimulation: isForceSimulationEnabled },
    );

    if (Array.isArray(nextNodes)) {
      previousPositionsRef.current = new Map(
        nextNodes
          .map((node) => {
            const datum = getNodeDatum(node);
            return datum?.id ? [datum.id, { x: node.x || 0, y: node.y || 0 }] : null;
          })
          .filter(Boolean),
      );
      setSimulatedNodes([...nextNodes]);
    } else {
      previousPositionsRef.current = new Map();
      setSimulatedNodes([]);
    }

    setSimulatedLinks(Array.isArray(nextLinks) ? [...nextLinks] : []);

    return () => {
      if (simulationServiceRef.current) {
        simulationServiceRef.current.cleanup();
      }
      if (viewportStateLoaded) {
        saveViewportState();
      }
      clearPendingViewportSave();
    };
  }, [
    data,
    dimensions,
    hierarchicalLinks,
    isForceSimulationEnabled,
    treeId,
    userId,
    viewportStateLoaded,
    assignFallbackPositions,
    setSimulatedNodes,
    setSimulatedLinks,
    previousPositionsRef,
    simulationServiceRef,
    saveViewportState,
    clearPendingViewportSave,
    getNodeDatum,
  ]);
};

export default useForceTreeSimulation;
