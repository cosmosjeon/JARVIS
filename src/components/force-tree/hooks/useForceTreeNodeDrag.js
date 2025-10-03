import { useCallback } from 'react';
import { getNodeDatum, getNodeId } from '../utils/forceTreeUtils';

const useForceTreeNodeDrag = ({
  svgRef,
  viewTransform,
  simulationServiceRef,
  isForceSimulationEnabled,
  selectedNodeIds,
  simulatedNodes,
  setIsDraggingNode,
  setDraggedNodeId,
  resetContextMenu,
  setSimulatedNodes,
  previousPositionsRef,
  dragStartTimeRef,
  shouldOpenNodeRef,
  draggedMemoSnapshotRef,
}) => {
  const handleDragStart = useCallback((event, nodeData) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragStartTimeRef.current = Date.now();
    shouldOpenNodeRef.current = false;

    setIsDraggingNode(true);
    const datum = getNodeDatum(nodeData);
    const nodeId = getNodeId(nodeData);
    setDraggedNodeId(nodeId);
    resetContextMenu();

    const isDraggingSelectedNode = !isForceSimulationEnabled && selectedNodeIds.has(nodeId);
    const draggedNodesList = isDraggingSelectedNode
      ? Array.from(selectedNodeIds)
      : [nodeId];

    if (simulationServiceRef.current) {
      simulationServiceRef.current.handleDragStart(event, nodeData);
    }

    const simulation = simulationServiceRef.current?.getSimulation?.();
    if (simulation && isForceSimulationEnabled && datum?.nodeType !== 'memo') {
      const memoFollowers = simulation.nodes().filter((candidate) => (
        getNodeDatum(candidate)?.nodeType === 'memo'
        && getNodeDatum(candidate)?.memoParentId === nodeId
      ));

      draggedMemoSnapshotRef.current = memoFollowers.map((memoNode) => ({
        node: memoNode,
        offsetX: (memoNode.x || 0) - (nodeData.x || 0),
        offsetY: (memoNode.y || 0) - (nodeData.y || 0),
      }));
    } else {
      draggedMemoSnapshotRef.current = [];
    }

    const multiSelectOffsets = draggedNodesList.map((id) => {
      const node = simulatedNodes.find((n) => getNodeId(n) === id);
      if (!node) return null;
      return {
        id,
        node,
        offsetX: (node.x || 0) - (nodeData.x || 0),
        offsetY: (node.y || 0) - (nodeData.y || 0),
      };
    }).filter(Boolean);

    const handleGlobalPointerMove = (e) => {
      if (!simulationServiceRef.current) return;

      const svg = svgRef.current;
      if (!svg) return;

      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;

      const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

      const forceX = (svgPoint.x - viewTransform.x) / viewTransform.k;
      const forceY = (svgPoint.y - viewTransform.y) / viewTransform.k;

      const mockEvent = {
        x: forceX,
        y: forceY,
      };

      simulationServiceRef.current.handleDrag(mockEvent, nodeData);

      if (multiSelectOffsets.length > 1) {
        multiSelectOffsets.forEach(({ id, node, offsetX, offsetY }) => {
          if (!node || id === nodeId) return;

          const newX = forceX + offsetX;
          const newY = forceY + offsetY;

          if (simulationServiceRef.current.simulation) {
            node.fx = newX;
            node.fy = newY;
          } else {
            node.x = newX;
            node.y = newY;
            node.fx = newX;
            node.fy = newY;
          }

          if (!isForceSimulationEnabled) {
            previousPositionsRef.current.set(id, { x: newX, y: newY });
          }
        });
      }

      if (!isForceSimulationEnabled) {
        const currentNodeId = getNodeId(nodeData);
        if (currentNodeId) {
          previousPositionsRef.current.set(currentNodeId, { x: nodeData.x || 0, y: nodeData.y || 0 });
        }
        setSimulatedNodes((prev) => [...prev]);
      }

      if (isForceSimulationEnabled && draggedMemoSnapshotRef.current.length > 0) {
        draggedMemoSnapshotRef.current.forEach(({ node: memoNode, offsetX, offsetY }) => {
          if (!memoNode) return;
          memoNode.fx = forceX + offsetX;
          memoNode.fy = forceY + offsetY;
        });
      }
    };

    const handleGlobalPointerUp = (e) => {
      if (simulationServiceRef.current) {
        simulationServiceRef.current.handleDragEnd(e, nodeData);
      }

      if (multiSelectOffsets.length > 1) {
        multiSelectOffsets.forEach(({ id, node }) => {
          if (!node || id === nodeId) return;

          if (simulationServiceRef.current.simulation) {
            node.fx = null;
            node.fy = null;
          } else {
            node.fx = node.x;
            node.fy = node.y;
          }

          if (!isForceSimulationEnabled) {
            previousPositionsRef.current.set(id, { x: node.x || 0, y: node.y || 0 });
          }
        });
      }

      const dragDuration = Date.now() - dragStartTimeRef.current;
      if (dragDuration <= 120) {
        shouldOpenNodeRef.current = true;
      }

      setIsDraggingNode(false);
      setDraggedNodeId(null);

      if (isForceSimulationEnabled && draggedMemoSnapshotRef.current.length > 0) {
        draggedMemoSnapshotRef.current.forEach(({ node: memoNode }) => {
          if (!memoNode) return;
          memoNode.fx = null;
          memoNode.fy = null;
        });
      }
      draggedMemoSnapshotRef.current = [];

      if (!isForceSimulationEnabled) {
        const currentNodeId = getNodeId(nodeData);
        if (currentNodeId) {
          previousPositionsRef.current.set(currentNodeId, { x: nodeData.x || 0, y: nodeData.y || 0 });
        }
        setSimulatedNodes((prev) => [...prev]);
      }

      document.removeEventListener('pointermove', handleGlobalPointerMove);
      document.removeEventListener('pointerup', handleGlobalPointerUp);
      document.removeEventListener('pointercancel', handleGlobalPointerUp);
    };

    document.addEventListener('pointermove', handleGlobalPointerMove);
    document.addEventListener('pointerup', handleGlobalPointerUp);
    document.addEventListener('pointercancel', handleGlobalPointerUp);
  }, [
    dragStartTimeRef,
    setIsDraggingNode,
    shouldOpenNodeRef,
    setDraggedNodeId,
    resetContextMenu,
    isForceSimulationEnabled,
    selectedNodeIds,
    simulationServiceRef,
    draggedMemoSnapshotRef,
    simulatedNodes,
    svgRef,
    viewTransform.x,
    viewTransform.y,
    viewTransform.k,
    previousPositionsRef,
    setSimulatedNodes,
  ]);

  return { handleDragStart };
};

export default useForceTreeNodeDrag;
