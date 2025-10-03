import { useEffect, useState } from 'react';
import { DEFAULT_NODE_SIZE_STATE } from '../utils/forceTreeUtils';

const useForceTreeGlobalHotkeys = ({
  selectedNodeId,
  setSelectedNodeId,
  nodeSizeState,
  setNodeSizeState,
}) => {
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (event.code === 'Space' && !isSpacePressed) {
        event.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  useEffect(() => {
    if (!selectedNodeId) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, setSelectedNodeId]);

  useEffect(() => {
    if (!nodeSizeState.isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setNodeSizeState({ ...DEFAULT_NODE_SIZE_STATE });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodeSizeState.isOpen, setNodeSizeState]);

  return { isSpacePressed };
};

export default useForceTreeGlobalHotkeys;
