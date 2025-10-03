import { useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import useTreeViewOptions from '../../../hooks/force-tree/useTreeViewOptions';
import useHierarchicalTreeTheme from './useHierarchicalTreeTheme';
import useHierarchicalTreeSession from './useHierarchicalTreeSession';
import useHierarchicalTreeData from './useHierarchicalTreeData';
import useHierarchicalTreeInteractions from './useHierarchicalTreeInteractions';
import useHierarchicalTreeViewport from './useHierarchicalTreeViewport';
import useHierarchicalTreeAgents from './useHierarchicalTreeAgents';

const useHierarchicalTreeController = () => {
  const { user } = useSupabaseAuth();
  const session = useHierarchicalTreeSession();
  const themeControls = useHierarchicalTreeTheme();
  const viewOptions = useTreeViewOptions();

  const dataApi = useHierarchicalTreeData({ user, session });

  const interactions = useHierarchicalTreeInteractions({
    dataApi,
    hierarchicalLinks: dataApi.hierarchicalLinks,
    childrenByParent: dataApi.childrenByParent,
    getRootNodeId: dataApi.getRootNodeId,
  });

  const viewport = useHierarchicalTreeViewport({
    data: dataApi.data,
    visibleNodes: interactions.visibleGraph.nodes,
    visibleLinks: interactions.visibleGraph.links,
    layoutOrientation: viewOptions.layoutOrientation,
    viewMode: viewOptions.viewMode,
  });

  const agents = useHierarchicalTreeAgents({
    dataApi,
    interactionsApi: {
      selectNode: interactions.selectNode,
      expandNode: interactions.expandNode,
    },
    parentByChild: dataApi.parentByChild,
  });

  const colorScheme = useMemo(() => d3.scaleOrdinal(d3.schemeCategory10), []);

  const {
    nodes,
    links,
    nodeScaleFactor,
    viewTransform,
    svgRef,
    contentGroupRef,
    overlayContainerRef,
    overlayElement,
    forwardPanZoomGesture,
    focusNodeToCenter,
    dimensions,
    createNodeDragHandler,
    stopCurrentAnimation,
  } = viewport;

  const handleNodeClickForAssistant = useCallback((payload) => {
    if (!payload) {
      return;
    }

    if (payload.type === 'dismiss') {
      interactions.collapseAssistantPanel();
      return;
    }

    const targetId = payload.id;
    if (!targetId) {
      return;
    }

    const layoutNode = nodes.find((candidate) => candidate.id === targetId) || payload;
    interactions.handleNodeFocusRequest(targetId, () => focusNodeToCenter(layoutNode, { duration: 620 }));
  }, [focusNodeToCenter, interactions, nodes]);

  const handleDrag = useCallback((nodeId) => (
    createNodeDragHandler(nodeId, { onDragStart: stopCurrentAnimation })
  ), [createNodeDragHandler, stopCurrentAnimation]);

  return {
    // Theme
    ...themeControls,

    // Tree view options
    viewMode: viewOptions.viewMode,
    setViewMode: viewOptions.setViewMode,
    layoutOrientation: viewOptions.layoutOrientation,
    setLayoutOrientation: viewOptions.setLayoutOrientation,

    // Data & session state
    user,
    data: dataApi.data,
    setData: dataApi.setData,
    activeTreeId: dataApi.activeTreeId,
    initializingTree: dataApi.initializingTree,
    treeSyncError: dataApi.treeSyncError,
    isTreeSyncing: dataApi.isTreeSyncing,
    linkValidationError: dataApi.linkValidationError,
    showBootstrapChat: dataApi.showBootstrapChat,
    getInitialConversationForNode: dataApi.getInitialConversationForNode,

    // Graph structure
    nodes,
    links,
    nodeScaleFactor,
    viewTransform,
    colorScheme,
    childrenByParent: dataApi.childrenByParent,
    collapsedNodeIds: interactions.collapsedNodeIds,
    toggleCollapse: interactions.toggleCollapse,

    // Conversation & interactions
    handleConversationChange: interactions.handleConversationChange,
    handleCloseNode: interactions.handleCloseNode,
    handleNodeClickForAssistant,
    handlePlaceholderCreate: interactions.handlePlaceholderCreate,
    handleManualRootCreate: interactions.handleManualRootCreate,
    removeNodeAndDescendants: interactions.removeNodeAndDescendants,
    setWindowMousePassthrough: interactions.setWindowMousePassthrough,
    expandedNodeId: interactions.expandedNodeId,

    // Manual editing helpers
    handleManualNodeCreate: dataApi.handleManualNodeCreate,
    handleManualLinkCreate: dataApi.handleManualLinkCreate,
    handleMemoCreate: dataApi.handleMemoCreate,
    handleMemoUpdate: dataApi.handleMemoUpdate,
    handleNodeUpdate: dataApi.handleNodeUpdate,

    // AI interactions
    questionService: agents.questionService,
    handleRequestAnswer: agents.handleRequestAnswer,
    handleSecondQuestion: agents.handleSecondQuestion,
    handleAnswerComplete: agents.handleAnswerComplete,
    handleAnswerError: agents.handleAnswerError,
    handleBootstrapSubmit: agents.handleBootstrapSubmit,

    // Viewport controls
    svgRef,
    contentGroupRef,
    overlayContainerRef,
    overlayElement,
    forwardPanZoomGesture,
    handleDrag,
    dimensions,
  };
};

export default useHierarchicalTreeController;
