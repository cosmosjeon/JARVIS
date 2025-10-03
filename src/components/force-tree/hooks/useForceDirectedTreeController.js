import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QuestionService from '../../../services/force-tree/QuestionService';
import useTreeViewportPersistence from '../../../hooks/force-tree/useTreeViewportPersistence';
import useForceTreeSimulation from '../../../hooks/force-tree/useForceTreeSimulation';
import { getNodeDatum, getNodeId } from '../utils/forceTreeUtils';
import useForceTreeZoomPan from './useForceTreeZoomPan';
import useForceTreeSelectionBox from './useForceTreeSelectionBox';
import useForceTreeGlobalHotkeys from './useForceTreeGlobalHotkeys';
import useForceTreeNodeDrag from './useForceTreeNodeDrag';
import useForceTreeContextMenu from './useForceTreeContextMenu';

const useForceDirectedTreeController = (props) => {
  const {
    data,
    dimensions,
    onNodeClick,
    onNodeRemove,
    onNodeUpdate,
    onMemoCreate,
    onMemoUpdate,
    onMemoRemove,
    onNodeCreate,
    onLinkCreate,
    onRootCreate,
    questionService,
    getInitialConversation,
    onConversationChange,
    onRequestAnswer,
    onAnswerComplete,
    onAnswerError,
    onSecondQuestion,
    onPlaceholderCreate,
    theme = 'dark',
    treeId,
    userId,
  } = props;

    const themeBackground = theme === 'light'
        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 240, 240, 0.95))'
        : 'linear-gradient(135deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.18))';
    const questionServiceRef = useRef(questionService || new QuestionService());
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const simulationServiceRef = useRef(null);
    const [simulatedNodes, setSimulatedNodes] = useState([]);
    const [simulatedLinks, setSimulatedLinks] = useState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [isSelectionBoxActive, setIsSelectionBoxActive] = useState(false);
    const [selectionBox, setSelectionBox] = useState({ startX: 0, startY: 0, endX: 0, endY: 0 });
    const selectionBoxDidDragRef = useRef(false);
    const [memoEditorState, setMemoEditorState] = useState({ isOpen: false, memo: null });

    // 메모 클릭 핸들러
    const handleMemoClick = useCallback((memoData) => {
        setMemoEditorState({ isOpen: true, memo: memoData });
        setSelectedNodeId(null); // 기존 선택 해제
    }, []);

    // 메모 에디터 닫기
    const handleMemoEditorClose = useCallback(() => {
        setMemoEditorState({ isOpen: false, memo: null });
    }, []);

    // 메모 업데이트
    const handleMemoUpdate = useCallback((memoData) => {
        if (typeof onMemoUpdate === 'function') {
            onMemoUpdate(memoData.id, memoData.memo);
        }
    }, [onMemoUpdate]);

    // 메모 삭제
    const handleMemoDelete = useCallback(() => {
        if (typeof onMemoRemove === 'function' && memoEditorState.memo) {
            onMemoRemove(memoEditorState.memo.id);
            setMemoEditorState({ isOpen: false, memo: null });
        }
    }, [onMemoRemove, memoEditorState.memo]);
    const dragStartTimeRef = useRef(0);
    const shouldOpenNodeRef = useRef(false);
    const draggedMemoSnapshotRef = useRef([]);
    const pendingCenterNodeIdRef = useRef(null);
    const previousPositionsRef = useRef(new Map());
    const [isForceSimulationEnabled, setIsForceSimulationEnabled] = useState(true);

    const hierarchicalLinks = useMemo(() => (
        Array.isArray(data?.links)
            ? data.links.filter((link) => link?.relationship !== 'connection')
            : []
    ), [data?.links]);

    const connectionLinks = useMemo(() => (
        Array.isArray(data?.links)
            ? data.links.filter((link) => link?.relationship === 'connection')
            : []
    ), [data?.links]);

    // SVG 중심 위치 계산
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // viewTransform 초기값을 중심으로 설정
    const [viewTransform, setViewTransform] = useState({ x: centerX, y: centerY, k: 1 });

    const contextMenu = useForceTreeContextMenu({
        containerRef,
        viewTransform,
        simulatedNodes,
        setSimulatedNodes,
        onNodeUpdate,
        onNodeRemove,
        onMemoCreate,
        onLinkCreate,
        onRootCreate,
        onNodeClick,
        setSelectedNodeId,
        setSelectedNodeIds,
        setHoveredNodeId,
        selectionBoxDidDragRef,
        pendingCenterNodeIdRef,
        shouldOpenNodeRef,
        dimensions,
        isDraggingNode,
        draggedNodeId,
        selectedNodeId,
    });

    const {
        contextMenuState,
        nodeSizeState,
        setNodeSizeState,
        isLinking,
        linkingSourceId,
        cancelLinkCreation,
        handleBackgroundContextMenu,
        handleNodeContextMenu,
        handleMenuAddConnection,
        handleMenuAddRoot,
        handleMenuAddMemo,
        handleMenuRemoveNode,
        handleSizeSliderChange,
        handleSizeSliderComplete,
        handleNodeShapeChange,
        handleBackgroundClick,
        contextMenuCoordinates,
        canAddLink,
        canAddMemo,
        isBackgroundContext,
        resetContextMenu,
    } = contextMenu;

    const { isSpacePressed } = useForceTreeGlobalHotkeys({
        selectedNodeId,
        setSelectedNodeId,
        nodeSizeState,
        setNodeSizeState,
    });

    // Conversation 관리
    const getInitialConversationForNode = useCallback((nodeId) => {
        return getInitialConversation ? getInitialConversation(nodeId) : [];
    }, [getInitialConversation]);

    const handleConversationChange = useCallback((nodeId, messages) => {
        if (onConversationChange) {
            onConversationChange(nodeId, messages);
        }
    }, [onConversationChange]);

    const hasRenderableNodes = (Array.isArray(data?.nodes) && data.nodes.length > 0)
        || (Array.isArray(simulatedNodes) && simulatedNodes.length > 0);

    const { centerNodeOnScreen } = useForceTreeZoomPan({
        svgRef,
        containerRef,
        viewTransform,
        setViewTransform,
        centerX,
        centerY,
        isDraggingNode,
        isSelectionBoxActive,
        isSpacePressed,
        isForceSimulationEnabled,
        hasRenderableNodes,
    });

    const { handleDragStart } = useForceTreeNodeDrag({
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
    });

    useForceTreeSelectionBox({
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
    });

    const nodePositionMap = useMemo(() => {
        const map = new Map();
        simulatedNodes.forEach((node) => {
            const datum = getNodeDatum(node);
            if (datum?.id) {
                map.set(datum.id, node);
            }
        });
        return map;
    }, [simulatedNodes]);

    const {
        viewportStateLoaded,
        setViewportStateLoaded,
        saveViewportState,
        debouncedSaveViewportState,
        loadViewportState,
        clearPendingViewportSave,
    } = useTreeViewportPersistence({
        treeId,
        userId,
        simulatedNodes,
        previousPositionsRef,
        getNodeDatum,
    });

    useForceTreeSimulation({
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
    });

    // 뷰포트 상태 복원 (컴포넌트 마운트 시)
    useEffect(() => {
        if (treeId && userId && !viewportStateLoaded) {
            loadViewportState();
        }
    }, [treeId, userId, loadViewportState, viewportStateLoaded]);

    // 노드 위치 변경 시 자동 저장 (뷰포트 변경은 저장하지 않음)
    useEffect(() => {
        if (viewportStateLoaded) {
            debouncedSaveViewportState();
        }
    }, [simulatedNodes, debouncedSaveViewportState, viewportStateLoaded]);


    // dimensions가 변경될 때 viewTransform 업데이트 (비율 유지)
    const prevCenterRef = useRef({ x: centerX, y: centerY });
    useEffect(() => {
        const prevCenter = prevCenterRef.current;
        const deltaX = centerX - prevCenter.x;
        const deltaY = centerY - prevCenter.y;

        setViewTransform(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY,
            k: prev.k
        }));

        prevCenterRef.current = { x: centerX, y: centerY };
    }, [centerX, centerY]);

    useEffect(() => {
        if (!hoveredNodeId) {
            return;
        }

        const stillExists = simulatedNodes.some((node) => node?.data?.id === hoveredNodeId);
        if (!stillExists) {
            setHoveredNodeId(null);
        }
    }, [hoveredNodeId, simulatedNodes]);

    useEffect(() => {
        if (selectedNodeId) {
            setHoveredNodeId(null);
        }
    }, [selectedNodeId]);

    useEffect(() => {
        if (!selectedNodeId) {
            return;
        }

        const stillExists = simulatedNodes.some((node) => node?.data?.id === selectedNodeId);
        if (!stillExists) {
            setSelectedNodeId(null);
        }
    }, [selectedNodeId, simulatedNodes]);

    useEffect(() => {
        const pendingId = pendingCenterNodeIdRef.current;
        if (!pendingId) {
            return;
        }

        const focusTarget = simulatedNodes.find((candidate) => getNodeId(candidate) === pendingId);
        if (!focusTarget) {
            return;
        }

        centerNodeOnScreen(focusTarget);
        pendingCenterNodeIdRef.current = null;
    }, [simulatedNodes, centerNodeOnScreen]);

    const handleNodeClick = useCallback((node) => {
        // 드래그 중이거나 다른 노드가 드래그 중일 때는 클릭 무시
        if (isDraggingNode || draggedNodeId) {
            return;
        }

        // 드래그 시간이 0.1초 초과였으면 클릭 무시
        if (!shouldOpenNodeRef.current) {
            shouldOpenNodeRef.current = false;
            return;
        }

        // 플래그 리셋
        shouldOpenNodeRef.current = false;

        resetContextMenu();

        // 노드를 화면 중앙으로 이동
        const datum = getNodeDatum(node);
        const nodeId = getNodeId(node);

        if (isLinking) {
            const sourceId = linkingSourceId;
            if (!nodeId || nodeId === sourceId) {
                cancelLinkCreation();
                return;
            }

            const result = onLinkCreate ? onLinkCreate(sourceId, nodeId) : null;

            Promise.resolve(result)
                .then(() => {
                    // 링크 생성 후 대상 노드로 화면만 이동 (패널은 열지 않음)
                    pendingCenterNodeIdRef.current = nodeId;
                })
                .finally(() => {
                    cancelLinkCreation();
                });
            return;
        }

        centerNodeOnScreen(node);

        // 메모 노드인 경우 풀스크린 에디터 열기
        if (datum?.nodeType === 'memo') {
            handleMemoClick(datum);
            return;
        }

        setSelectedNodeId(nodeId);
        if (onNodeClick) {
            onNodeClick({ id: nodeId });
        }
    }, [onNodeClick, isDraggingNode, draggedNodeId, centerNodeOnScreen, isLinking, linkingSourceId, cancelLinkCreation, onLinkCreate, handleMemoClick]);
  return {
    themeBackground,
    questionServiceRef,
    svgRef,
    containerRef,
    simulatedNodes,
    simulatedLinks,
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeIds,
    isDraggingNode,
    draggedNodeId,
    hoveredNodeId,
    setHoveredNodeId,
    contextMenuState,
    isSelectionBoxActive,
    setIsSelectionBoxActive,
    selectionBox,
    setSelectionBox,
    isSpacePressed,
    selectionBoxDidDragRef,
    memoEditorState,
    handleMemoEditorClose,
    handleMemoUpdate,
    handleMemoDelete,
    isForceSimulationEnabled,
    setIsForceSimulationEnabled,
    hierarchicalLinks,
    connectionLinks,
    viewTransform,
    nodePositionMap,
    handleDragStart,
    handleBackgroundContextMenu,
    handleNodeClick,
    handleNodeContextMenu,
    handleMenuAddConnection,
    handleMenuAddRoot,
    handleMenuAddMemo,
    handleMenuRemoveNode,
    handleSizeSliderChange,
    handleSizeSliderComplete,
    handleNodeShapeChange,
    handleBackgroundClick,
    getInitialConversationForNode,
    handleConversationChange,
    contextMenuCoordinates,
    canAddLink,
    canAddMemo,
    isBackgroundContext,
    data,
    dimensions,
    theme,
    onNodeClick,
    onNodeRemove,
    onNodeUpdate,
    onMemoCreate,
    onMemoUpdate,
    onMemoRemove,
    onNodeCreate,
    onLinkCreate,
    onRootCreate,
    getInitialConversation,
    onConversationChange,
    onRequestAnswer,
    onAnswerComplete,
    onAnswerError,
    onSecondQuestion,
    onPlaceholderCreate,
  };
};

export default useForceDirectedTreeController;
