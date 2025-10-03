import { useEffect } from 'react';
import { getNodeId } from '../utils/forceTreeUtils';

const useForceTreeSelectionBox = ({
  isSelectionBoxActive,
  selectionBox,
  setSelectionBox,
  setIsSelectionBoxActive,
  selectionBoxDidDragRef,
  svgRef,
  viewTransform,
  isForceSimulationEnabled,
  simulatedNodes,
  setSelectedNodeIds,
}) => {
  useEffect(() => {
    if (!isSelectionBoxActive) return;

    const handlePointerMove = (e) => {
      const svg = svgRef.current;
      if (!svg) return;

      selectionBoxDidDragRef.current = true;

      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

      const forceX = (svgPoint.x - viewTransform.x) / viewTransform.k;
      const forceY = (svgPoint.y - viewTransform.y) / viewTransform.k;

      setSelectionBox((prev) => ({
        ...prev,
        endX: forceX,
        endY: forceY,
      }));

      if (!isForceSimulationEnabled) {
        const minX = Math.min(selectionBox.startX, forceX);
        const maxX = Math.max(selectionBox.startX, forceX);
        const minY = Math.min(selectionBox.startY, forceY);
        const maxY = Math.max(selectionBox.startY, forceY);

        const selectedIds = new Set();
        simulatedNodes.forEach((node) => {
          const nodeX = node.x || 0;
          const nodeY = node.y || 0;
          if (nodeX >= minX && nodeX <= maxX && nodeY >= minY && nodeY <= maxY) {
            const nodeId = getNodeId(node);
            if (nodeId) selectedIds.add(nodeId);
          }
        });

        setSelectedNodeIds(selectedIds);
      }
    };

    const handlePointerUp = () => {
      setIsSelectionBoxActive(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    isSelectionBoxActive,
    selectionBox.startX,
    selectionBox.startY,
    svgRef,
    viewTransform.x,
    viewTransform.y,
    viewTransform.k,
    isForceSimulationEnabled,
    simulatedNodes,
    selectionBoxDidDragRef,
    setSelectionBox,
    setIsSelectionBoxActive,
    setSelectedNodeIds,
  ]);
};

export default useForceTreeSelectionBox;
