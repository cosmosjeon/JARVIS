import React, { useCallback, useMemo } from 'react';
import LibraryQAPanel from 'features/library/ui/components/LibraryQAPanel';
import { PANEL_SIZES, getScaledPanelSizes } from 'features/tree/hooks/useNodeAssistantPanelController';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const NodeAssistantPanel = ({
  node,
  treeId,
  treeTitle,
  treeNodes = [],
  treeLinks = [],
  onNodeUpdate,
  onNewNodeCreated,
  onNodeSelect,
  onCloseNode,
  onFullscreenToggle,
  isFullscreen = false,
  isLibraryIntroActive = false,
  onLibraryIntroComplete,
}) => {
  const selectedTree = useMemo(() => {
    const nodes = ensureArray(treeNodes);
    const links = ensureArray(treeLinks);
    const resolvedId = treeId || node?.treeId || 'tree-widget';
    const resolvedTitle = treeTitle || node?.treeTitle || node?.keyword || '지식 트리';

    return {
      id: resolvedId,
      title: resolvedTitle,
      treeData: {
        nodes,
        links,
      },
    };
  }, [treeId, treeTitle, treeNodes, treeLinks, node]);

  const handleNodeUpdate = useCallback((updatedNode) => {
    if (!updatedNode || !updatedNode.id) {
      return;
    }
    onNodeUpdate?.(updatedNode);
  }, [onNodeUpdate]);

  const handleNodeCreate = useCallback((createdNode, link, options) => {
    if (!createdNode || !createdNode.id) {
      return;
    }
    onNewNodeCreated?.(createdNode, link, options);
  }, [onNewNodeCreated]);

  const handleNodeSelect = useCallback((nextNode) => {
    onNodeSelect?.(nextNode || null);
  }, [onNodeSelect]);

  const handleClose = useCallback(() => {
    onCloseNode?.();
  }, [onCloseNode]);

  return (
    <LibraryQAPanel
      selectedNode={node}
      selectedTree={selectedTree}
      onNodeUpdate={handleNodeUpdate}
      onNewNodeCreated={handleNodeCreate}
      onNodeSelect={handleNodeSelect}
      onClose={handleClose}
      onFullscreenToggle={onFullscreenToggle}
      isFullscreen={isFullscreen}
      isLibraryIntroActive={isLibraryIntroActive}
      onLibraryIntroComplete={onLibraryIntroComplete}
    />
  );
};

export default NodeAssistantPanel;
export { PANEL_SIZES, getScaledPanelSizes };
