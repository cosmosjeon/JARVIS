import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import NodeAssistantPanel from 'features/tree/ui/components/NodeAssistantPanel';
import MemoPanel from './MemoPanel';
import MemoEditor from './MemoEditor';
import { Maximize2, Minimize2, X } from 'lucide-react';
import QuestionService from 'features/tree/services/QuestionService';
import useForceDirectedTreeEngine from './hooks/useForceDirectedTreeEngine';

const NODE_COLOR_PALETTE = (d3.schemeTableau10 && d3.schemeTableau10.length ? d3.schemeTableau10 : d3.schemeCategory10);
const DEFAULT_CONTEXT_MENU_STATE = {
    open: false,
    x: 0,
    y: 0,
    nodeId: null,
    nodeType: null,
    sceneX: 0,
    sceneY: 0,
};

const DEFAULT_NODE_SIZE_STATE = {
    isOpen: false,
    nodeId: null,
    sizeValue: 50, // 0-100 범위, 기본값 50
};

const SPLIT_DEFAULT_RATIO = 0.38;
const SPLIT_MIN_RATIO = 0.25;
const SPLIT_MAX_RATIO = 0.7;

const MIN_NODE_SCALE = 0.1;
const MAX_NODE_SCALE = 4;
const LABEL_MAX_CHAR_PER_LINE = 22;
const LABEL_MAX_LINES = 2;
const LABEL_LINE_HEIGHT = 16;
const LABEL_GAP = 1;
const NODE_FILL_LIGHT_EVEN = '#FFFFFF';
const NODE_FILL_LIGHT_ODD = '#000000';
const NODE_FILL_DARK_EVEN = '#FFFFFF';
const NODE_FILL_DARK_ODD = '#000000';
const NODE_FILL_ROOT_LIGHT = '#FF6B6B';
const NODE_FILL_ROOT_DARK = '#DC2626';
const NODE_STROKE_LIGHT = '#CBD5F5';
const NODE_STROKE_DARK = '#94A3B8';
const NODE_STROKE_ROOT_LIGHT = '#F97316';
const NODE_STROKE_ROOT_DARK = '#FCA5A5';
const LABEL_COLOR_LIGHT_EVEN = '#111111';
const LABEL_COLOR_LIGHT_ODD = '#F9FAFB';
const LABEL_COLOR_LIGHT_ROOT = '#0F172A';
const LABEL_COLOR_DARK_EVEN = '#0F172A';
const LABEL_COLOR_DARK_ODD = '#F8FAFC';
const LABEL_COLOR_DARK_ROOT = '#FEF2F2';
const ARROW_HEAD_LENGTH = 8;
const ARROW_HEAD_SPREAD = 4;

const NODE_SHAPES = {
    RECTANGLE: 'rectangle',
    DOT: 'dot',
    ELLIPSE: 'ellipse',
    DIAMOND: 'diamond',
};

const getNodeDatum = (node) => {
    if (!node) {
        return {};
    }

    const hierarchyPayload = node.data || {};
    if (hierarchyPayload && typeof hierarchyPayload === 'object' && hierarchyPayload.data) {
        return hierarchyPayload.data || {};
    }

    return hierarchyPayload;
};

const getNodeId = (node) => {
    if (!node) return null;
    const hierarchyPayload = node.data || {};
    return hierarchyPayload.id || getNodeDatum(node).id || node.id || null;
};

const sanitizeText = (value) => {
    if (typeof value !== 'string') {
        if (value === null || value === undefined) return '';
        return String(value);
    }
    return value;
};

const extractNodeHoverText = (nodeData = {}) => {
    const memoTitle = sanitizeText(nodeData?.memo?.title).trim();
    if (memoTitle) {
        return memoTitle;
    }

    const memoContent = sanitizeText(nodeData?.memo?.content).trim();
    if (memoContent) {
        return memoContent;
    }

    const question = sanitizeText(nodeData?.questionData?.question).trim();
    if (question) {
        return question;
    }

    const keyword = sanitizeText(nodeData.keyword).trim();
    if (keyword) {
        return keyword;
    }

    const fullText = sanitizeText(nodeData.fullText).trim();
    if (fullText) {
        return fullText;
    }

    const name = sanitizeText(nodeData.name).trim();
    if (name) {
        return name;
    }

    const id = sanitizeText(nodeData.id).trim();
    if (id) {
        return id;
    }

    return '';
};

const computeHoverLines = (text, maxCharsPerLine = 28, maxLines = 3) => {
    const normalized = sanitizeText(text).replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return [];
    }

    const lines = [];
    let remaining = normalized;

    for (let i = 0; i < maxLines && remaining.length > 0; i += 1) {
        if (remaining.length <= maxCharsPerLine) {
            lines.push(remaining);
            remaining = '';
            break;
        }

        let sliceEnd = remaining.lastIndexOf(' ', maxCharsPerLine);
        if (sliceEnd <= 0) {
            sliceEnd = maxCharsPerLine;
        }

        const line = remaining.slice(0, sliceEnd).trim();
        if (line) {
            lines.push(line);
        }

        remaining = remaining.slice(sliceEnd).trim();
    }

    if (remaining.length > 0 && lines.length > 0) {
        const lastIndex = lines.length - 1;
        lines[lastIndex] = `${lines[lastIndex].replace(/[.…]*$/, '')}…`;
    }

    return lines;
};

const computeTooltipDimensions = (lines) => {
    if (!lines || lines.length === 0) {
        return { width: 0, height: 0 };
    }

    const horizontalPadding = 28;
    const verticalPadding = 18;
    const charWidthEstimate = 9;
    const lineHeight = 18;

    const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const rawWidth = longestLineLength * charWidthEstimate + horizontalPadding;
    const width = Math.min(280, Math.max(140, rawWidth));
    const height = lines.length * lineHeight + verticalPadding;

    return { width, height };
};

const normalizeLinkEndpoint = (endpoint) => {
    if (!endpoint) {
        return null;
    }

    if (typeof endpoint === 'string' || typeof endpoint === 'number') {
        return String(endpoint);
    }

    if (typeof endpoint === 'object') {
        if (endpoint.id) {
            return String(endpoint.id);
        }
        if (endpoint.data && endpoint.data.id) {
            return String(endpoint.data.id);
        }
    }

    return null;
};

const getLinkEndpoints = (link) => {
    if (!link?.source || !link?.target) {
        return null;
    }

    return {
        x1: Number.isFinite(link.source.x) ? link.source.x : 0,
        y1: Number.isFinite(link.source.y) ? link.source.y : 0,
        x2: Number.isFinite(link.target.x) ? link.target.x : 0,
        y2: Number.isFinite(link.target.y) ? link.target.y : 0,
    };
};

const resolveNodeScaleState = (node, datum) => {
    const depth = Number.isFinite(node?.depth) ? node.depth : 0;
    const isMemoNode = datum?.nodeType === 'memo';
    const isRootNode = !isMemoNode && depth === 0;
    const sizeValue = typeof datum?.sizeValue === 'number' ? datum.sizeValue : 50;
    const sliderScale = Math.max(MIN_NODE_SCALE, sizeValue / 50);
    const descendantScale = Number.isFinite(datum?.descendantSizeScale)
        ? Math.max(1, datum.descendantSizeScale)
        : 1;
    const sizeScale = Math.min(MAX_NODE_SCALE, sliderScale * descendantScale);
    const baseRadius = isRootNode ? 11 : isMemoNode ? 9 : 7.5;
    const circleRadius = Math.max(4, baseRadius * sizeScale);

    return {
        depth,
        isMemoNode,
        isRootNode,
        isMemoStyledNode: isMemoNode || isRootNode,
        sizeScale,
        circleRadius,
    };
};

/**
 * ForceDirectedTree Component
 * 
 * Presentation: Force-directed 레이아웃으로 트리 시각화
 */
const ForceDirectedTree = ({
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
    isForceSimulationEnabled = true,
    // 라이브러리에서 우측 패널 사용 시, 캔버스 위젯 어시스턴트 패널 숨김
    hideAssistantPanel = false,
}) => {
    const themeBackground = theme === 'light'
        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 240, 240, 0.95))'
        : 'linear-gradient(135deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.18))';
    const questionServiceRef = useRef(questionService || new QuestionService());
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const simulationServiceRef = useRef(null);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [contextMenuState, setContextMenuState] = useState(() => ({ ...DEFAULT_CONTEXT_MENU_STATE }));
    const [nodeSizeState, setNodeSizeState] = useState(() => ({ ...DEFAULT_NODE_SIZE_STATE }));
    const [isSelectionBoxActive, setIsSelectionBoxActive] = useState(false);
    const [selectionBox, setSelectionBox] = useState({ startX: 0, startY: 0, endX: 0, endY: 0 });
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const selectionBoxDidDragRef = useRef(false);
    const [linkCreationState, setLinkCreationState] = useState({ active: false, sourceId: null });
    const [memoEditorState, setMemoEditorState] = useState({ isOpen: false, memo: null });
    const layoutRef = useRef(null);
    const splitPanelDragStateRef = useRef({ isDragging: false, rect: null });
    const [splitPanelRatio, setSplitPanelRatio] = useState(SPLIT_DEFAULT_RATIO);
    const [lastNonMaximizedRatio, setLastNonMaximizedRatio] = useState(SPLIT_DEFAULT_RATIO);
    const [isSplitPanelMaximized, setIsSplitPanelMaximized] = useState(false);
    const [isSplitPanelResizing, setIsSplitPanelResizing] = useState(false);
    const clampPanelRatio = useCallback(
        (value) => Math.min(Math.max(value, SPLIT_MIN_RATIO), SPLIT_MAX_RATIO),
        [],
    );
    const isLinking = linkCreationState.active;
    const linkingSourceId = linkCreationState.sourceId;

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

    const {
        simulatedNodes,
        simulatedLinks,
        setSimulatedNodes,
        viewTransform,
        setViewTransform,
    } = useForceDirectedTreeEngine({
        data,
        dimensions,
        hierarchicalLinks,
        treeId,
        userId,
        isForceSimulationEnabled,
        getNodeDatum,
        previousPositionsRef,
        simulationServiceRef,
    });

    const selectedNode = useMemo(() => (
        selectedNodeId
            ? simulatedNodes.find((candidate) => getNodeId(candidate) === selectedNodeId)
            : null
    ), [selectedNodeId, simulatedNodes]);

    const selectedDatum = useMemo(
        () => (selectedNode ? getNodeDatum(selectedNode) : null),
        [selectedNode],
    );

    const isMemoSelection = selectedDatum?.nodeType === 'memo';
    const isAssistantHiddenByMode = hideAssistantPanel && !isMemoSelection;
    const isMemoEditorOpen = memoEditorState.isOpen && memoEditorState.memo;
    const isAssistantPanelVisible = Boolean(selectedNodeId && selectedNode && !isAssistantHiddenByMode);
    const activePanelMode = isMemoEditorOpen
        ? 'editor'
        : isAssistantPanelVisible
            ? (isMemoSelection ? 'memo' : 'assistant')
            : null;
    const isSplitPanelVisible = Boolean(activePanelMode);

    useEffect(() => {
        if (!isSplitPanelVisible) {
            setIsSplitPanelMaximized(false);
            document.body.style.cursor = '';
        }
    }, [isSplitPanelVisible]);

    const handleSplitPanelDragMove = useCallback((event) => {
        if (!splitPanelDragStateRef.current.isDragging) {
            return;
        }

        const { rect } = splitPanelDragStateRef.current;
        if (!rect) {
            return;
        }

        event.preventDefault();

        const relativeX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        const nextRatio = clampPanelRatio((rect.width - relativeX) / rect.width);

        setSplitPanelRatio(nextRatio);
        setLastNonMaximizedRatio(nextRatio);
    }, [clampPanelRatio]);

    const handleSplitPanelDragEnd = useCallback(() => {
        if (!splitPanelDragStateRef.current.isDragging) {
            return;
        }

        splitPanelDragStateRef.current = { isDragging: false, rect: null };
        setIsSplitPanelResizing(false);
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', handleSplitPanelDragMove);
        window.removeEventListener('pointerup', handleSplitPanelDragEnd);
    }, [handleSplitPanelDragMove]);

    const handleSplitPanelDragStart = useCallback((event) => {
        if (!isSplitPanelVisible || isSplitPanelMaximized) {
            return;
        }

        const layoutElement = layoutRef.current;
        if (!layoutElement) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const rect = layoutElement.getBoundingClientRect();
        splitPanelDragStateRef.current = {
            isDragging: true,
            rect,
        };

        setIsSplitPanelResizing(true);
        setIsSplitPanelMaximized(false);
        document.body.style.cursor = 'col-resize';
        window.addEventListener('pointermove', handleSplitPanelDragMove);
        window.addEventListener('pointerup', handleSplitPanelDragEnd);
    }, [handleSplitPanelDragEnd, handleSplitPanelDragMove, isSplitPanelMaximized, isSplitPanelVisible]);

    const handleSplitPanelToggleMaximize = useCallback(() => {
        if (!isSplitPanelVisible) {
            return;
        }

        setIsSplitPanelMaximized((current) => {
            if (current) {
                setSplitPanelRatio((prev) => clampPanelRatio(lastNonMaximizedRatio || prev));
                return false;
            }

            setLastNonMaximizedRatio((prev) => clampPanelRatio(splitPanelRatio || prev));
            document.body.style.cursor = '';
            return true;
        });
    }, [clampPanelRatio, isSplitPanelVisible, lastNonMaximizedRatio, splitPanelRatio]);

    const handlePanelClose = useCallback(() => {
        if (activePanelMode === 'editor') {
            handleMemoEditorClose();
            return;
        }

        setSelectedNodeId(null);
    }, [activePanelMode, handleMemoEditorClose]);

    useEffect(() => () => {
        window.removeEventListener('pointermove', handleSplitPanelDragMove);
        window.removeEventListener('pointerup', handleSplitPanelDragEnd);
        document.body.style.cursor = '';
    }, [handleSplitPanelDragEnd, handleSplitPanelDragMove]);

    // SVG 중심 위치 계산
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const hasRenderableNodes = (Array.isArray(data?.nodes) && data.nodes.length > 0)
        || (Array.isArray(simulatedNodes) && simulatedNodes.length > 0);

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
        if (!contextMenuState.open) {
            return;
        }

        const handlePointerDown = (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (target && target.closest('[data-force-tree-context-menu="true"]')) {
                return;
            }
            setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
            }
        };

        const handleScroll = () => {
            setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
        };

        window.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('keydown', handleEscape, true);
        window.addEventListener('wheel', handleScroll, true);

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('keydown', handleEscape, true);
            window.removeEventListener('wheel', handleScroll, true);
        };
    }, [contextMenuState.open]);

    // Zoom/Pan 설정
    const zoomBehaviorRef = useRef(null);

    useEffect(() => {
        if (!svgRef.current || !hasRenderableNodes) return;

        const svg = d3.select(svgRef.current);

        const zoom = d3.zoom()
            .scaleExtent([0.3, 8])
            .filter((event) => {
                // 노드 드래그 중이거나 선택 박스 드래그 중에는 줌/팬 비활성화
                if (isDraggingNode || isSelectionBoxActive) return false;

                // foreignObject나 노드 내부에서는 줌/팬 비활성화
                const target = event.target instanceof Element ? event.target : null;
                if (target && target.closest('foreignObject')) return false;

                // wheel 이벤트는 모두 허용 (트랙패드 줌/스크롤)
                if (event.type === 'wheel') return true;

                // 더블클릭은 비활성화
                if (event.type === 'dblclick') return false;

                // 유기적 작용이 ON일 때는 기존 방식 (모든 드래그로 패닝)
                if (isForceSimulationEnabled) {
                    if (event.type === 'mousedown' || event.type === 'pointerdown') return true;
                    if (event.type === 'mousemove' || event.type === 'pointermove') return true;
                    if (event.type === 'mouseup' || event.type === 'pointerup') return true;
                }

                // 유기적 작용이 OFF일 때는 Space 키가 눌린 상태에서만 패닝 허용
                if (!isForceSimulationEnabled && isSpacePressed) {
                    if (event.type === 'mousedown' || event.type === 'pointerdown') return true;
                    if (event.type === 'mousemove' || event.type === 'pointermove') return true;
                    if (event.type === 'mouseup' || event.type === 'pointerup') return true;
                }

                return false;
            })
            .on('zoom', (event) => {
                setViewTransform({
                    x: event.transform.x,
                    y: event.transform.y,
                    k: event.transform.k
                });
            });

        // 초기 transform을 현재 viewTransform으로 설정
        const initialTransform = d3.zoomIdentity.translate(viewTransform.x, viewTransform.y).scale(viewTransform.k);
        svg.call(zoom.transform, initialTransform);

        // wheelDelta 커스터마이즈하여 민감도 조절
        const defaultWheelDelta = zoom.wheelDelta();
        zoom.wheelDelta((event) => {
            // Ctrl/Cmd 키가 있으면 줌 (핀치 줌)
            if (event.ctrlKey || event.metaKey) {
                const base = typeof defaultWheelDelta === 'function'
                    ? defaultWheelDelta(event)
                    : (-event.deltaY * (event.deltaMode ? 120 : 1) / 500);
                return base * 0.3; // 줌 감도 낮춤 (1.0 → 0.3)
            }

            // Ctrl/Cmd 키가 없으면 패닝
            return 0;
        });

        zoomBehaviorRef.current = zoom;
        svg.call(zoom);

        // wheel 이벤트를 직접 처리하여 패닝 구현
        svg.on('wheel.treepan', (event) => {
            // Ctrl/Cmd 키가 있으면 핀치 줌 (zoom behavior가 처리)
            if (event.ctrlKey || event.metaKey) {
                return;
            }

            // Ctrl/Cmd 키가 없으면 패닝
            event.preventDefault();

            const deltaX = event.deltaX || 0;
            const deltaY = event.deltaY || 0;

            if (deltaX === 0 && deltaY === 0) {
                return;
            }

            const currentTransform = d3.zoomTransform(svg.node());
            const scale = Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1;
            const panX = -deltaX / scale;
            const panY = -deltaY / scale;
            zoom.translateBy(svg, panX, panY);
        });

        return () => {
            svg.on('.zoom', null);
            svg.on('.treepan', null);
        };

    }, [isDraggingNode, isSelectionBoxActive, isSpacePressed, isForceSimulationEnabled, centerX, centerY, hasRenderableNodes]);


    // 방향키로 캔버스 이동
    useEffect(() => {
        if (!containerRef.current || !svgRef.current) return;

        const handleKeyDown = (event) => {
            // 입력 필드에 포커스가 있으면 무시
            const target = event.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
            if (!arrowKeys.includes(event.key)) {
                return;
            }

            event.preventDefault();

            const svg = d3.select(svgRef.current);
            const zoom = zoomBehaviorRef.current;
            if (!zoom) return;

            // 이동 거리 (픽셀)
            const panDistance = 50;
            const currentTransform = d3.zoomTransform(svg.node());
            const scale = Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1;

            // 스케일에 맞게 이동 거리 조정
            const adjustedDistance = panDistance / scale;

            let panX = 0;
            let panY = 0;

            switch (event.key) {
                case 'ArrowUp':
                    panY = adjustedDistance;
                    break;
                case 'ArrowDown':
                    panY = -adjustedDistance;
                    break;
                case 'ArrowLeft':
                    panX = adjustedDistance;
                    break;
                case 'ArrowRight':
                    panX = -adjustedDistance;
                    break;
                default:
                    break;
            }

            zoom.translateBy(svg, panX, panY);
        };

        const container = containerRef.current;
        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // 노드 드래그 핸들러
    const handleDragStart = useCallback((event, nodeData) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        // 드래그 시작 시간 기록
        dragStartTimeRef.current = Date.now();
        shouldOpenNodeRef.current = false;

        setIsDraggingNode(true);
        const datum = getNodeDatum(nodeData);
        const nodeId = getNodeId(nodeData);
        setDraggedNodeId(nodeId);
        setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });

        // 유기적 작용이 OFF일 때만 다중 선택 드래그 활성화
        const isDraggingSelectedNode = !isForceSimulationEnabled && selectedNodeIds.has(nodeId);
        const draggedNodesList = isDraggingSelectedNode
            ? Array.from(selectedNodeIds)
            : [nodeId];

        if (simulationServiceRef.current) {
            simulationServiceRef.current.handleDragStart(event, nodeData);
        }

        const simulation = simulationServiceRef.current?.getSimulation?.();
        // Force simulation이 활성화되어 있고 메모가 아닌 노드일 때만 메모를 따라오게 함
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

        // 다중 선택된 노드들의 초기 오프셋 계산
        const multiSelectOffsets = draggedNodesList.map(id => {
            const node = simulatedNodes.find(n => getNodeId(n) === id);
            if (!node) return null;
            return {
                id,
                node,
                offsetX: (node.x || 0) - (nodeData.x || 0),
                offsetY: (node.y || 0) - (nodeData.y || 0),
            };
        }).filter(Boolean);

        // 전역 드래그 핸들러 (즉시 등록하여 노드 밖으로 나가도 드래그 계속됨)
        const handleGlobalPointerMove = (e) => {
            if (!simulationServiceRef.current) return;

            const svg = svgRef.current;
            if (!svg) return;

            const point = svg.createSVGPoint();
            point.x = e.clientX;
            point.y = e.clientY;

            const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

            // SVG viewBox 좌표 -> Force simulation 좌표로 변환
            const forceX = (svgPoint.x - viewTransform.x) / viewTransform.k;
            const forceY = (svgPoint.y - viewTransform.y) / viewTransform.k;

            const mockEvent = {
                x: forceX,
                y: forceY,
            };

            // 주 노드 드래그
            simulationServiceRef.current.handleDrag(mockEvent, nodeData);

            // 다중 선택된 노드들도 함께 드래그
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
                const nodeId = getNodeId(nodeData);
                if (nodeId) {
                    previousPositionsRef.current.set(nodeId, { x: nodeData.x || 0, y: nodeData.y || 0 });
                }
                setSimulatedNodes((prev) => [...prev]);
            }

            // Force simulation이 활성화되어 있을 때만 메모 노드를 따라오게 함
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

            // 다중 선택된 노드들의 고정 해제
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

            // 드래그 시간 체크 (0.2초 이하면 클릭으로 처리)
            const dragDuration = Date.now() - dragStartTimeRef.current;
            if (dragDuration <= 120) {
                shouldOpenNodeRef.current = true;
            }

            setIsDraggingNode(false);
            setDraggedNodeId(null);

            // Force simulation이 활성화되어 있을 때만 메모 노드 고정 해제
            if (isForceSimulationEnabled && draggedMemoSnapshotRef.current.length > 0) {
                draggedMemoSnapshotRef.current.forEach(({ node: memoNode }) => {
                    if (!memoNode) return;
                    memoNode.fx = null;
                    memoNode.fy = null;
                });
            }
            draggedMemoSnapshotRef.current = [];

            if (!isForceSimulationEnabled) {
                const nodeId = getNodeId(nodeData);
                if (nodeId) {
                    previousPositionsRef.current.set(nodeId, { x: nodeData.x || 0, y: nodeData.y || 0 });
                }
                setSimulatedNodes((prev) => [...prev]);
            }

            // 리스너 제거
            document.removeEventListener('pointermove', handleGlobalPointerMove);
            document.removeEventListener('pointerup', handleGlobalPointerUp);
            document.removeEventListener('pointercancel', handleGlobalPointerUp);
        };

        // 전역 리스너 등록 (즉시)
        document.addEventListener('pointermove', handleGlobalPointerMove);
        document.addEventListener('pointerup', handleGlobalPointerUp);
        document.addEventListener('pointercancel', handleGlobalPointerUp);
    }, [centerX, centerY, viewTransform, isForceSimulationEnabled, selectedNodeIds, simulatedNodes]);


    // 노드를 화면 중앙으로 이동
    const centerNodeOnScreen = useCallback((node) => {
        if (!node || !svgRef.current || !zoomBehaviorRef.current) return;

        const targetX = centerX - node.x * viewTransform.k;
        const targetY = centerY - node.y * viewTransform.k;

        const svg = d3.select(svgRef.current);
        const targetTransform = d3.zoomIdentity
            .translate(targetX, targetY)
            .scale(viewTransform.k);

        // D3 transition으로 부드럽게 이동하고 zoom behavior 업데이트
        svg.transition()
            .duration(500)
            .ease(d3.easeCubicInOut)
            .call(zoomBehaviorRef.current.transform, targetTransform);
    }, [viewTransform, centerX, centerY]);

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

    // 노드 클릭 핸들러
    const cancelLinkCreation = useCallback(() => {
        setLinkCreationState({ active: false, sourceId: null });
        pendingCenterNodeIdRef.current = null;
    }, []);

    const handleBackgroundContextMenu = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();

        if (isLinking) {
            return;
        }

        const container = containerRef.current;
        const rect = container ? container.getBoundingClientRect() : null;

        const x = rect ? event.clientX - rect.left : event.clientX;
        const y = rect ? event.clientY - rect.top : event.clientY;

        const sceneX = (x - viewTransform.x) / viewTransform.k;
        const sceneY = (y - viewTransform.y) / viewTransform.k;

        setContextMenuState({
            open: true,
            x,
            y,
            nodeId: null,
            nodeType: 'background',
            sceneX,
            sceneY,
        });
    }, [isLinking, viewTransform.x, viewTransform.y, viewTransform.k]);

    const handleNodeClick = useCallback((node) => {
        // 라이브러리 모드(hideAssistantPanel)에서는 즉시 선택만 수행하고 패널/컨텍스트 영향 제거
        if (hideAssistantPanel) {
            const nodeId = getNodeId(node);
            setSelectedNodeId(nodeId || null);
            if (typeof onNodeClick === 'function') onNodeClick(getNodeDatum(node));
            return;
        }

        if (isDraggingNode || draggedNodeId) {
            return;
        }

        if (!shouldOpenNodeRef.current) {
            shouldOpenNodeRef.current = false;
            return;
        }

        shouldOpenNodeRef.current = false;

        setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });

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

    const handleNodeContextMenu = useCallback((event, node) => {
        event.preventDefault();
        event.stopPropagation();

        if (isLinking) {
            return;
        }

        if (!node || isDraggingNode || draggedNodeId) {
            return;
        }

        const datum = getNodeDatum(node);
        if (!datum?.id) {
            return;
        }

        const container = containerRef.current;
        const rect = container ? container.getBoundingClientRect() : null;

        const x = rect ? event.clientX - rect.left : event.clientX;
        const y = rect ? event.clientY - rect.top : event.clientY;

        setContextMenuState({
            open: true,
            x,
            y,
            nodeId: datum.id,
            nodeType: datum.nodeType || 'node',
            sceneX: 0,
            sceneY: 0,
        });
    }, [draggedNodeId, isDraggingNode, isLinking]);

    const handleMenuAddConnection = useCallback(() => {
        const sourceId = contextMenuState.nodeId;
        if (!sourceId || typeof onLinkCreate !== 'function') {
            setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
            return;
        }

        setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
        setLinkCreationState({ active: true, sourceId });
        // 링크 시작 시 소스 노드로 화면만 이동 (패널은 열지 않음)
        pendingCenterNodeIdRef.current = sourceId;
    }, [contextMenuState.nodeId]);

    const handleMenuAddRoot = useCallback(() => {
        if (typeof onRootCreate !== 'function') {
            setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
            return;
        }

        const { sceneX = 0, sceneY = 0 } = contextMenuState;

        setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
        cancelLinkCreation();

        const result = onRootCreate({ position: { x: sceneX, y: sceneY } });

        Promise.resolve(result)
            .then((newNodeId) => {
                if (!newNodeId) {
                    return;
                }
                pendingCenterNodeIdRef.current = newNodeId;
                setSelectedNodeId(newNodeId);
                if (typeof onNodeClick === 'function') {
                    onNodeClick({ id: newNodeId });
                }
            })
            .catch(() => { });
    }, [onRootCreate, cancelLinkCreation, onNodeClick, contextMenuState]);

    const handleMenuAddMemo = useCallback(() => {
        if (!contextMenuState.nodeId || !onMemoCreate) {
            setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
            return;
        }

        const maybeId = onMemoCreate(contextMenuState.nodeId);
        setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });

        Promise.resolve(maybeId).then((newMemoId) => {
            if (!newMemoId) {
                return;
            }
            setSelectedNodeId(newMemoId);
            shouldOpenNodeRef.current = false;
        }).catch(() => {
            // ignore memo creation errors in UI layer
        });
    }, [contextMenuState.nodeId, onMemoCreate]);

    const handleMenuRemoveNode = useCallback(() => {
        if (contextMenuState.nodeId && onNodeRemove) {
            if (selectedNodeId === contextMenuState.nodeId) {
                setSelectedNodeId(null);
            }
            onNodeRemove(contextMenuState.nodeId);
        }

        setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
        cancelLinkCreation();
    }, [contextMenuState.nodeId, onNodeRemove, selectedNodeId, cancelLinkCreation]);


    // 노드 크기 조절 핸들러 (슬라이더)
    const handleSizeSliderChange = useCallback((event) => {
        const newValue = Math.max(5, parseInt(event.target.value)); // 최소값 5로 제한

        // 현재 컨텍스트 메뉴의 노드 ID 사용
        const currentNodeId = contextMenuState.nodeId;
        if (!currentNodeId) return;

        const scaleValue = Math.max(0.1, newValue / 50); // 0-100을 0.1-2.0 스케일로 변환 (50이 기본값 1.0)

        // 시뮬레이션 노드 업데이트
        setSimulatedNodes(prev => prev.map(node => {
            const nodeDatum = getNodeDatum(node);
            if (nodeDatum?.id === currentNodeId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        data: {
                            ...node.data?.data,
                            sizeValue: newValue,
                            sizeScale: scaleValue,
                        }
                    }
                };
            }
            return node;
        }));
    }, [contextMenuState.nodeId]);

    const handleSizeSliderComplete = useCallback(() => {
        // 최종 크기 조절 값을 부모 컴포넌트에 전달
        const currentNodeId = contextMenuState.nodeId;
        if (onNodeUpdate && currentNodeId) {
            const targetNode = simulatedNodes.find(node => getNodeId(node) === currentNodeId);
            const currentSizeValue = targetNode ? (getNodeDatum(targetNode)?.sizeValue || 50) : 50;

            onNodeUpdate(currentNodeId, {
                sizeValue: currentSizeValue,
                sizeScale: Math.max(0.1, currentSizeValue / 50)
            });
        }
    }, [contextMenuState.nodeId, simulatedNodes, onNodeUpdate]);

    // 노드 모양 변경 핸들러
    const handleNodeShapeChange = useCallback((shape) => {
        const currentNodeId = contextMenuState.nodeId;
        if (!currentNodeId) return;

        // 시뮬레이션 노드 업데이트
        setSimulatedNodes(prev => prev.map(node => {
            const nodeDatum = getNodeDatum(node);
            if (nodeDatum?.id === currentNodeId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        data: {
                            ...node.data?.data,
                            nodeShape: shape,
                        }
                    }
                };
            }
            return node;
        }));

        // 부모 컴포넌트에 변경사항 전달
        if (onNodeUpdate) {
            onNodeUpdate(currentNodeId, { nodeShape: shape });
        }
    }, [contextMenuState.nodeId, onNodeUpdate]);

    // 배경 클릭 핸들러 (선택 해제)
    const handleBackgroundClick = useCallback(() => {
        if (isLinking) {
            cancelLinkCreation();
            return;
        }

        if (selectionBoxDidDragRef.current) {
            selectionBoxDidDragRef.current = false;
            return;
        }

        // 크기 조절 모드일 때는 모드만 종료
        if (nodeSizeState.isOpen) {
            setNodeSizeState({ ...DEFAULT_NODE_SIZE_STATE });
            return;
        }

        setSelectedNodeId(null);
        setSelectedNodeIds(new Set());
        setHoveredNodeId(null);
    }, [isLinking, cancelLinkCreation, nodeSizeState.isOpen]);

    // Conversation 관리
    const getInitialConversationForNode = useCallback((nodeId) => {
        return getInitialConversation ? getInitialConversation(nodeId) : [];
    }, [getInitialConversation]);

    const handleConversationChange = useCallback((nodeId, messages) => {
        if (onConversationChange) {
            onConversationChange(nodeId, messages);
        }
    }, [onConversationChange]);

    // Space 키 처리
    useEffect(() => {
        const handleKeyDown = (event) => {
            // 입력 필드에 포커스가 있으면 무시
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
    }, [isSpacePressed, isForceSimulationEnabled]);

    // ESC 키로 패널 닫기
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
    }, [selectedNodeId]);

    // ESC 키로 크기 조절 모드 종료
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
    }, [nodeSizeState.isOpen]);


    useEffect(() => {
        if (!isLinking) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                cancelLinkCreation();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLinking, cancelLinkCreation]);

    // 선택 박스 드래그 처리
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

            // 선택 박스 내 노드 계산 (유기적 작용 OFF일 때만)
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
    }, [isSelectionBoxActive, selectionBox.startX, selectionBox.startY, simulatedNodes, viewTransform, isForceSimulationEnabled]);

    // 빈 데이터 처리 - bootstrap 패널이 상위에서 표시되므로 빈 배경만 렌더링
    if (!data || !data.nodes || data.nodes.length === 0) {
        return (
            <div
                className="relative h-full w-full"
                style={{
                    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.18))',
                    overflow: 'hidden',
                }}
            />
        );
    }

    const contextMenuCoordinates = contextMenuState.open
        ? {
            x: Math.min(
                Math.max(contextMenuState.x, 0),
                Math.max(0, (dimensions?.width || 0) - 176),
            ),
            y: Math.min(
                Math.max(contextMenuState.y, 0),
                Math.max(0, (dimensions?.height || 0) - 96),
            ),
        }
        : null;

    const isMemoContextTarget = contextMenuState.nodeType === 'memo';
    const canAddLink = typeof onLinkCreate === 'function';
    const canAddMemo = typeof onMemoCreate === 'function' && !isMemoContextTarget;
    const isBackgroundContext = !contextMenuState.nodeId;

    const treeCanvas = (
        <div
            ref={containerRef}
            className="relative h-full w-full"
            tabIndex={0}
            style={{
                background: themeBackground,
                overflow: 'hidden',
                outline: 'none',
            }}
            onContextMenu={handleBackgroundContextMenu}
        >
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                preserveAspectRatio="xMidYMid meet"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    cursor: (!isForceSimulationEnabled && isSpacePressed) ? 'grab' : (isDraggingNode ? 'grabbing' : 'default'),
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    WebkitTouchCallout: 'none', // iOS 터치 콜아웃 방지
                    WebkitTapHighlightColor: 'transparent', // 터치 하이라이트 제거
                }}
                onClick={(e) => {
                    // 배경 클릭 시 선택 해제
                    e.stopPropagation();
                    handleBackgroundClick();
                }}
                onPointerDown={(e) => {
                    // 유기적 작용이 OFF이고, Space 키가 눌려있지 않고, 노드 위가 아닌 배경에서 드래그 시작
                    if (!isForceSimulationEnabled && !isSpacePressed && e.button === 0) {
                        const svg = svgRef.current;
                        if (!svg) return;

                        selectionBoxDidDragRef.current = false;

                        const point = svg.createSVGPoint();
                        point.x = e.clientX;
                        point.y = e.clientY;
                        const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

                        const forceX = (svgPoint.x - viewTransform.x) / viewTransform.k;
                        const forceY = (svgPoint.y - viewTransform.y) / viewTransform.k;

                        setIsSelectionBoxActive(true);
                        setSelectionBox({
                            startX: forceX,
                            startY: forceY,
                            endX: forceX,
                            endY: forceY,
                        });
                    }
                }}
            >
                <defs>
                    {/* 다크모드 - 링크 화살표 */}
                    <marker
                        id="arrowhead-dark"
                        viewBox={`-${ARROW_HEAD_LENGTH} ${-ARROW_HEAD_SPREAD} ${ARROW_HEAD_LENGTH} ${ARROW_HEAD_SPREAD * 2}`}
                        refX={0}
                        refY={0}
                        markerWidth={ARROW_HEAD_LENGTH}
                        markerHeight={ARROW_HEAD_SPREAD * 2}
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                    >
                        <path d={`M0,0 L-${ARROW_HEAD_LENGTH},${ARROW_HEAD_SPREAD} L-${ARROW_HEAD_LENGTH},${-ARROW_HEAD_SPREAD} Z`} fill="rgba(31, 41, 55, 0.7)" />
                    </marker>

                    {/* 라이트모드 - 링크 화살표 */}
                    <marker
                        id="arrowhead-light"
                        viewBox={`-${ARROW_HEAD_LENGTH} ${-ARROW_HEAD_SPREAD} ${ARROW_HEAD_LENGTH} ${ARROW_HEAD_SPREAD * 2}`}
                        refX={0}
                        refY={0}
                        markerWidth={ARROW_HEAD_LENGTH}
                        markerHeight={ARROW_HEAD_SPREAD * 2}
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                    >
                        <path d={`M0,0 L-${ARROW_HEAD_LENGTH},${ARROW_HEAD_SPREAD} L-${ARROW_HEAD_LENGTH},${-ARROW_HEAD_SPREAD} Z`} fill="rgba(156, 163, 175, 0.6)" />
                    </marker>
                </defs>

                <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
                    {/* 링크 렌더링 */}
                    <g className="links">
                        {simulatedLinks.map((link, index) => {
                            const sourceDatum = getNodeDatum(link.source);
                            const targetDatum = getNodeDatum(link.target);
                            const sourceScaleState = resolveNodeScaleState(link.source, sourceDatum);
                            const targetScaleState = resolveNodeScaleState(link.target, targetDatum);
                            const isMemoLink = targetDatum?.nodeType === 'memo';

                            const isEvenDepth = targetScaleState.depth % 2 === 0;
                            const isLightMode = theme === 'light';

                            let linkStroke;

                            if (isMemoLink) {
                                linkStroke = isLightMode
                                    ? 'rgba(209, 213, 219, 0.85)'
                                    : 'rgba(75, 85, 99, 0.8)';
                            } else if (isLightMode) {
                                linkStroke = isEvenDepth
                                    ? 'rgba(31, 41, 55, 0.6)'
                                    : 'rgba(156, 163, 175, 0.5)';
                            } else {
                                linkStroke = isEvenDepth
                                    ? 'rgba(255, 255, 255, 0.4)'
                                    : 'rgba(0, 0, 0, 0.5)';
                            }

                            const linkWidth = isMemoLink ? 1.1 : 1.5;
                            const linkOpacity = isMemoLink ? 0.75 : 1;
                            const coordinates = getLinkEndpoints(link);

                            if (!coordinates) {
                                return null;
                            }

                            let { x1, y1, x2, y2 } = coordinates;
                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const distance = Math.hypot(dx, dy);

                            if (distance > 0) {
                                const unitX = dx / distance;
                                const unitY = dy / distance;
                                const targetRadius = Math.max(targetScaleState.circleRadius - 1.5, 0);
                                const sourceRadius = Math.max(sourceScaleState.circleRadius - 1.5, 0);
                                const sourceOffset = Math.min(sourceRadius, Math.max(0, distance - targetRadius - ARROW_HEAD_LENGTH));
                                x1 += unitX * sourceOffset;
                                y1 += unitY * sourceOffset;
                                x2 -= unitX * (targetRadius);
                                y2 -= unitY * (targetRadius);
                            }

                            const markerId = isLightMode ? 'arrowhead-light' : 'arrowhead-dark';

                            return (
                                <motion.line
                                    key={`link-${index}`}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke={linkStroke}
                                    strokeWidth={linkWidth}
                                    strokeDasharray={isMemoLink ? '2,3' : undefined}
                                    strokeLinecap="round"
                                    vectorEffect="non-scaling-stroke"
                                    markerEnd={`url(#${markerId})`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: linkOpacity }}
                                    transition={{ duration: 0.3 }}
                                />
                            );
                        })}
                        {connectionLinks.map((link, index) => {
                            const sourceId = normalizeLinkEndpoint(link.source);
                            const targetId = normalizeLinkEndpoint(link.target);

                            if (!sourceId || !targetId) {
                                return null;
                            }

                            const sourceNode = nodePositionMap.get(sourceId);
                            const targetNode = nodePositionMap.get(targetId);

                            if (!sourceNode || !targetNode) {
                                return null;
                            }

                            const sourceDatum = getNodeDatum(sourceNode);
                            const targetDatum = getNodeDatum(targetNode);
                            const sourceScaleState = resolveNodeScaleState(sourceNode, sourceDatum);
                            const targetScaleState = resolveNodeScaleState(targetNode, targetDatum);
                            const involvesMemo = sourceDatum?.nodeType === 'memo' || targetDatum?.nodeType === 'memo';

                            const strokeColor = theme === 'light'
                                ? (involvesMemo ? 'rgba(16, 185, 129, 0.75)' : 'rgba(59, 130, 246, 0.75)')
                                : (involvesMemo ? 'rgba(45, 212, 191, 0.82)' : 'rgba(147, 197, 253, 0.88)');

                            const strokeWidth = involvesMemo ? 0.8 : 1.1;
                            const coordinates = getLinkEndpoints({ source: sourceNode, target: targetNode });

                            if (!coordinates) {
                                return null;
                            }

                            let { x1, y1, x2, y2 } = coordinates;
                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const distance = Math.hypot(dx, dy);

                            if (distance > 0) {
                                const unitX = dx / distance;
                                const unitY = dy / distance;
                                const targetRadius = Math.max(targetScaleState.circleRadius - 1.5, 0);
                                const sourceRadius = Math.max(sourceScaleState.circleRadius - 1.5, 0);
                                const sourceOffset = Math.min(sourceRadius, Math.max(0, distance - targetRadius - ARROW_HEAD_LENGTH));
                                x1 += unitX * sourceOffset;
                                y1 += unitY * sourceOffset;
                                x2 -= unitX * (targetRadius);
                                y2 -= unitY * (targetRadius);
                            }

                            return (
                                <motion.line
                                    key={`connection-${sourceId}-${targetId}-${index}`}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    vectorEffect="non-scaling-stroke"
                                    style={{ pointerEvents: 'none' }}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 0.85 }}
                                    transition={{ duration: 0.25 }}
                                />
                            );
                        })}
                    </g>

                    {/* 노드 렌더링 */}
                    <g className="nodes">
                        {simulatedNodes.map((node) => {
                            const datum = getNodeDatum(node);
                            const nodeId = getNodeId(node);

                            if (!nodeId) {
                                return null;
                            }

                            const {
                                depth,
                                isMemoNode,
                                isRootNode,
                                isMemoStyledNode,
                                sizeScale,
                                circleRadius,
                            } = resolveNodeScaleState(node, datum);
                            const isBeingDragged = draggedNodeId === nodeId;
                            const isSelected = selectedNodeId === nodeId;
                            const isMultiSelected = selectedNodeIds.has(nodeId);
                            const isHovered = hoveredNodeId === nodeId;
                            const isOtherNodeDragging = isDraggingNode && !isBeingDragged;

                            // 텍스트 레이블
                            const labelText = isMemoNode
                                ? (datum.memo?.title || datum.keyword || datum.name || datum.id || '')
                                : (datum.keyword || datum.name || datum.id || '');

                            const labelFontSize = Math.max(10, (isMemoStyledNode ? 12 : 13) * sizeScale);
                            const labelLines = computeHoverLines(labelText, LABEL_MAX_CHAR_PER_LINE, LABEL_MAX_LINES);
                            const displayLines = labelLines.length > 0
                                ? labelLines
                                : (labelText ? [labelText] : []);
                            const labelLineHeight = LABEL_LINE_HEIGHT * sizeScale;
                            const labelGap = LABEL_GAP;
                            const labelBlockHeight = displayLines.length > 0 ? displayLines.length * labelLineHeight : 0;
                            const labelOffsetY = circleRadius + labelGap;
                            const charWidth = labelFontSize * 0.56;
                            const longestLabelLine = displayLines.reduce((max, line) => Math.max(max, line.length), 0);
                            const labelWidth = longestLabelLine > 0 ? longestLabelLine * charWidth : 0;
                            const nodeWidth = Math.max(circleRadius * 2, labelWidth);
                            const nodeHeight = circleRadius * 2 + labelGap + labelBlockHeight;

                            // 색상 테마 (Obsidian 스타일 참고)
                            const isLightMode = theme === 'light';
                            const isEvenDepth = depth % 2 === 0;
                            let fillColor;
                            let textColor;

                            if (isRootNode) {
                                fillColor = isLightMode ? NODE_FILL_ROOT_LIGHT : NODE_FILL_ROOT_DARK;
                                textColor = isLightMode ? LABEL_COLOR_LIGHT_ROOT : LABEL_COLOR_DARK_ROOT;
                            } else if (isLightMode) {
                                fillColor = isEvenDepth ? NODE_FILL_LIGHT_EVEN : NODE_FILL_LIGHT_ODD;
                                textColor = isEvenDepth ? LABEL_COLOR_LIGHT_EVEN : LABEL_COLOR_LIGHT_ODD;
                            } else {
                                fillColor = isEvenDepth ? NODE_FILL_DARK_EVEN : NODE_FILL_DARK_ODD;
                                textColor = isEvenDepth ? LABEL_COLOR_DARK_EVEN : LABEL_COLOR_DARK_ODD;
                            }

                            const strokeColor = isRootNode
                                ? (isLightMode ? NODE_STROKE_ROOT_LIGHT : NODE_STROKE_ROOT_DARK)
                                : (isLightMode ? NODE_STROKE_LIGHT : NODE_STROKE_DARK);

                            const opacity = isBeingDragged ? 1 : (isOtherNodeDragging ? 0.25 : 0.95);
                            const baseStrokeWidth = isRootNode ? 0.9 : 0.6;
                            const strokeWidth = isSelected ? baseStrokeWidth + 0.3 : baseStrokeWidth;

                            const hoverText = isHovered ? extractNodeHoverText(datum) : '';
                            const hoverLines = isHovered ? computeHoverLines(hoverText) : [];
                            const { width: tooltipWidth, height: tooltipHeight } = computeTooltipDimensions(hoverLines);
                            const scaledTooltipWidth = tooltipWidth * sizeScale;
                            const scaledTooltipHeight = tooltipHeight * sizeScale;
                            const tooltipTranslateX = -scaledTooltipWidth / 2;
                            const tooltipTranslateY = -(circleRadius + scaledTooltipHeight + 16 * sizeScale);
                            const tooltipLineHeight = 18 * sizeScale;

                            const highlightPadding = 6 * sizeScale;
                            const highlightWidth = Math.max(nodeWidth, circleRadius * 2) + highlightPadding * 2;
                            const highlightHeight = nodeHeight + highlightPadding * 2;
                            const highlightX = -highlightWidth / 2;
                            const highlightY = -circleRadius - highlightPadding;

                            return (
                                <g
                                    key={nodeId}
                                    transform={`translate(${node.x || 0}, ${node.y || 0})`}
                                    style={{
                                        cursor: isBeingDragged ? 'grabbing' : (isOtherNodeDragging ? 'default' : 'grab'),
                                        pointerEvents: isOtherNodeDragging ? 'none' : 'auto',
                                    }}
                                    onPointerDown={(event) => {
                                        if (isOtherNodeDragging) return;
                                        setHoveredNodeId(null);
                                        handleDragStart(event, node);
                                    }}
                                    onClick={(event) => {
                                        if (isOtherNodeDragging) return;
                                        event.stopPropagation();
                                        handleNodeClick(node);
                                    }}
                                    onContextMenu={(event) => handleNodeContextMenu(event, node)}
                                    onPointerEnter={() => {
                                        if (isOtherNodeDragging) return;
                                        setHoveredNodeId(nodeId);
                                    }}
                                    onPointerLeave={() => {
                                        setHoveredNodeId((current) => (current === nodeId ? null : current));
                                    }}
                                >
                                    <motion.circle
                                        cx={0}
                                        cy={0}
                                        r={circleRadius}
                                        fill={fillColor}
                                        stroke={strokeColor}
                                        strokeWidth={strokeWidth}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: isBeingDragged ? 1.03 : 1, opacity }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                    />

                                    {displayLines.map((line, index) => (
                                        <motion.text
                                            key={`${nodeId}-label-${index}`}
                                            x={0}
                                            y={labelOffsetY + index * labelLineHeight}
                                            textAnchor="middle"
                                            dominantBaseline="hanging"
                                            fill={textColor}
                                            fontSize={labelFontSize}
                                            fontWeight={isRootNode ? 600 : 500}
                                            pointerEvents="none"
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.2, delay: 0.04 * index }}
                                            style={{ textRendering: 'geometricPrecision', letterSpacing: '0.15px' }}
                                        >
                                            {line}
                                        </motion.text>
                                    ))}

                                    {/* 선택 효과 - 단일 선택 */}
                                    {isSelected && (
                                        <motion.rect
                                            x={highlightX}
                                            y={highlightY}
                                            width={highlightWidth}
                                            height={highlightHeight}
                                            rx={Math.max(6, highlightPadding * 1.2)}
                                            ry={Math.max(6, highlightPadding * 1.2)}
                                            fill="none"
                                            stroke={strokeColor}
                                            strokeWidth={0.7}
                                            strokeOpacity={0.55}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        />
                                    )}

                                    {/* 선택 효과 - 멀티 선택 (단일 선택 아닌 경우 표시) */}
                                    {!isSelected && isMultiSelected && (
                                        <motion.rect
                                            x={highlightX}
                                            y={highlightY}
                                            width={highlightWidth}
                                            height={highlightHeight}
                                            rx={Math.max(6, highlightPadding * 1.2)}
                                            ry={Math.max(6, highlightPadding * 1.2)}
                                            fill="none"
                                            stroke={theme === 'light' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(96, 165, 250, 0.9)'}
                                            strokeWidth={0.6}
                                            strokeDasharray="3,2"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        />
                                    )}


                                    <AnimatePresence>
                                        {isHovered && hoverLines.length > 0 && scaledTooltipWidth > 0 && scaledTooltipHeight > 0 && (
                                            <motion.g
                                                key={`tooltip-${nodeId}`}
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -4 }}
                                                transition={{ duration: 0.18 }}
                                                transform={`translate(${tooltipTranslateX}, ${tooltipTranslateY})`}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                <rect
                                                    width={scaledTooltipWidth}
                                                    height={scaledTooltipHeight}
                                                    rx={10 * sizeScale}
                                                    ry={10 * sizeScale}
                                                    fill={theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.8)'}
                                                    stroke={theme === 'light' ? 'rgba(156, 163, 175, 0.5)' : 'rgba(255, 255, 255, 0.35)'}
                                                    strokeWidth={0.5}
                                                />
                                                {hoverLines.map((line, index) => (
                                                    <text
                                                        key={`${nodeId}-line-${index}`}
                                                        x={scaledTooltipWidth / 2}
                                                        y={14 * sizeScale + index * tooltipLineHeight}
                                                        textAnchor="middle"
                                                        fill={theme === 'light' ? '#1F2937' : '#f5f5f5'}
                                                        fontSize={12 * sizeScale}
                                                        fontWeight={500}
                                                    >
                                                        {line}
                                                    </text>
                                                ))}
                                            </motion.g>
                                        )}
                                    </AnimatePresence>
                                </g>
                            );
                        })}
                    </g>

                    {/* 선택 박스 */}
                    {isSelectionBoxActive && (
                        <rect
                            x={Math.min(selectionBox.startX, selectionBox.endX)}
                            y={Math.min(selectionBox.startY, selectionBox.endY)}
                            width={Math.abs(selectionBox.endX - selectionBox.startX)}
                            height={Math.abs(selectionBox.endY - selectionBox.startY)}
                            fill="rgba(96, 165, 250, 0.1)"
                            stroke="#60A5FA"
                            strokeWidth={1.5}
                            strokeDasharray="4,2"
                            pointerEvents="none"
                        />
                    )}
                </g>
            </svg>

            {contextMenuState.open && contextMenuCoordinates && (
                <div
                    className={`pointer-events-auto absolute z-[1300] w-44 overflow-hidden rounded-lg shadow-2xl backdrop-blur-md ${theme === 'light'
                        ? 'bg-white/95 border border-gray-200'
                        : 'bg-black/85 border border-white/12'
                        }`}
                    style={{
                        left: contextMenuCoordinates.x,
                        top: contextMenuCoordinates.y,
                    }}
                    data-force-tree-context-menu="true"
                >
                    {isBackgroundContext ? (
                        <button
                            type="button"
                            className={`w-full px-3 py-2 text-left text-[13px] transition ${theme === 'light'
                                ? (typeof onRootCreate === 'function' ? 'text-gray-900 hover:bg-gray-100' : 'cursor-not-allowed text-gray-400')
                                : (typeof onRootCreate === 'function' ? 'text-white/90 hover:bg-white/10' : 'cursor-not-allowed text-white/35')
                                }`}
                            disabled={typeof onRootCreate !== 'function'}
                            onClick={() => {
                                if (typeof onRootCreate !== 'function') return;
                                handleMenuAddRoot();
                            }}
                        >
                            새 루트 노드 추가
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                className={`w-full px-3 py-2 text-left text-[13px] transition ${theme === 'light'
                                    ? (canAddLink ? 'text-gray-900 hover:bg-gray-100' : 'cursor-not-allowed text-gray-400')
                                    : (canAddLink ? 'text-white/90 hover:bg-white/10' : 'cursor-not-allowed text-white/35')
                                    }`}
                                disabled={!canAddLink}
                                onClick={() => {
                                    if (!canAddLink) return;
                                    handleMenuAddConnection();
                                }}
                            >
                                연결선 추가
                            </button>
                            <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
                            <button
                                type="button"
                                className={`w-full px-3 py-2 text-left text-[13px] transition ${theme === 'light'
                                    ? (canAddMemo ? 'text-gray-900 hover:bg-gray-100' : 'cursor-not-allowed text-gray-400')
                                    : (canAddMemo ? 'text-white/90 hover:bg-white/10' : 'cursor-not-allowed text-white/35')
                                    }`}
                                disabled={!canAddMemo}
                                onClick={() => {
                                    if (!canAddMemo) return;
                                    handleMenuAddMemo();
                                }}
                            >
                                메모 추가
                            </button>
                            <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
                            <div className="px-3 py-2">
                                <div className={`text-[13px] mb-2 font-medium ${theme === 'light' ? 'text-gray-700' : 'text-white/80'}`}>
                                    노드 모양
                                </div>
                                <div className="grid grid-cols-2 gap-1 mb-3">
                                    {[
                                        { key: NODE_SHAPES.RECTANGLE, label: '사각형', icon: '⬜' },
                                        { key: NODE_SHAPES.DOT, label: '닷', icon: '●' },
                                        { key: NODE_SHAPES.ELLIPSE, label: '타원', icon: '○' },
                                        { key: NODE_SHAPES.DIAMOND, label: '마름모', icon: '◆' },
                                    ].map(({ key, label, icon }) => {
                                        const currentNodeShape = contextMenuState.nodeId ?
                                            (simulatedNodes.find(node => getNodeId(node) === contextMenuState.nodeId) ?
                                                (getNodeDatum(simulatedNodes.find(node => getNodeId(node) === contextMenuState.nodeId))?.nodeShape || NODE_SHAPES.RECTANGLE) :
                                                NODE_SHAPES.RECTANGLE) :
                                            NODE_SHAPES.RECTANGLE;
                                        const isSelected = currentNodeShape === key;

                                        return (
                                            <button
                                                key={key}
                                                onClick={() => handleNodeShapeChange(key)}
                                                className={`flex items-center justify-center space-x-1 px-2 py-1.5 text-[11px] rounded transition ${isSelected
                                                    ? (theme === 'light'
                                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                        : 'bg-blue-500/20 text-blue-300 border border-blue-400/30')
                                                    : (theme === 'light'
                                                        ? 'text-gray-600 hover:bg-gray-100'
                                                        : 'text-white/70 hover:bg-white/10')
                                                    }`}
                                            >
                                                <span className="text-[10px]">{icon}</span>
                                                <span>{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
                            <div className="px-3 py-2">
                                <div className={`text-[13px] mb-2 font-medium ${theme === 'light' ? 'text-gray-700' : 'text-white/80'}`}>
                                    노드 크기 조절
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="range"
                                        min="5"
                                        max="100"
                                        value={contextMenuState.nodeId ? (simulatedNodes.find(node => getNodeId(node) === contextMenuState.nodeId) ? (getNodeDatum(simulatedNodes.find(node => getNodeId(node) === contextMenuState.nodeId))?.sizeValue || 50) : 50) : 50}
                                        onChange={handleSizeSliderChange}
                                        onMouseUp={handleSizeSliderComplete}
                                        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                                        style={{
                                            background: (() => {
                                                const currentValue = contextMenuState.nodeId ? (simulatedNodes.find(node => getNodeId(node) === contextMenuState.nodeId) ? (getNodeDatum(simulatedNodes.find(node => getNodeId(node) === contextMenuState.nodeId))?.sizeValue || 50) : 50) : 50;
                                                const normalizedValue = Math.max(5, Math.min(100, currentValue));
                                                return theme === 'light'
                                                    ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${normalizedValue}%, #e5e7eb ${normalizedValue}%, #e5e7eb 100%)`
                                                    : `linear-gradient(to right, #60a5fa 0%, #60a5fa ${normalizedValue}%, #374151 ${normalizedValue}%, #374151 100%)`;
                                            })(),
                                            outline: 'none',
                                            WebkitAppearance: 'none',
                                        }}
                                    />
                                    <span className={`text-[11px] font-mono ${theme === 'light' ? 'text-gray-500' : 'text-white/60'} min-w-[30px]`}>
                                        {contextMenuState.nodeId ? (simulatedNodes.find(node => getNodeId(node) === contextMenuState.nodeId) ? (getNodeDatum(simulatedNodes.find(node => getNodeId(node) === contextMenuState.nodeId))?.sizeValue || 50) : 50) : 50}
                                    </span>
                                </div>
                            </div>
                            <div className={`h-px w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
                            <button
                                type="button"
                                className={`w-full px-3 py-2 text-left text-[13px] transition ${theme === 'light'
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-red-300 hover:bg-red-500/20'
                                    }`}
                                onClick={handleMenuRemoveNode}
                            >
                                노드 삭제
                            </button>
                        </>
                    )}
                </div>
            )}

        </div>
    );

    const effectivePanelRatio = isSplitPanelMaximized ? 1 : splitPanelRatio;
    const panelWidthPercent = Math.round(effectivePanelRatio * 10000) / 100;
    const panelFlexStyle = {
        flex: isSplitPanelMaximized ? '1 1 100%' : `0 0 ${panelWidthPercent}%`,
        width: isSplitPanelMaximized ? '100%' : `${panelWidthPercent}%`,
        minWidth: isSplitPanelMaximized ? '100%' : '320px',
        maxWidth: '100%',
    };

    let panelContent = null;

    if (activePanelMode === 'memo' && selectedDatum) {
        panelContent = (
            <MemoPanel
                memo={selectedDatum}
                onClose={() => setSelectedNodeId(null)}
                onUpdate={(updates) => {
                    if (!onMemoUpdate) return;
                    onMemoUpdate(selectedDatum.id, updates);
                }}
                showHeaderControls={false}
            />
        );
    } else if (activePanelMode === 'assistant' && selectedDatum && selectedNodeId) {
        panelContent = (
            <NodeAssistantPanel
                node={selectedDatum}
                color={d3.schemeCategory10[0]}
                onSizeChange={() => { }}
                onSecondQuestion={onSecondQuestion || (() => { })}
                onPlaceholderCreate={onPlaceholderCreate || (() => { })}
                questionService={questionServiceRef.current}
                initialConversation={getInitialConversationForNode(selectedNodeId)}
                onConversationChange={(messages) => handleConversationChange(selectedNodeId, messages)}
                onRequestAnswer={onRequestAnswer || (() => { })}
                onAnswerComplete={onAnswerComplete || (() => { })}
                onAnswerError={onAnswerError || (() => { })}
                nodeSummary={{
                    label: selectedDatum.keyword || selectedDatum.id,
                    intro: selectedDatum.fullText || '',
                    bullets: [],
                }}
                isRootNode={false}
                bootstrapMode={false}
                onBootstrapFirstSend={() => { }}
                onCloseNode={() => setSelectedNodeId(null)}
                onPanZoomGesture={() => { }}
                nodeScaleFactor={1}
                treeNodes={data?.nodes || []}
                treeLinks={hierarchicalLinks}
                onNodeSelect={(targetNode) => {
                    const targetNodeId = targetNode?.id;
                    if (targetNodeId) {
                        setSelectedNodeId(targetNodeId);
                    }
                }}
                disableNavigation={isMemoSelection}
                showHeaderControls={false}
            />
        );
    } else if (activePanelMode === 'editor' && memoEditorState.memo) {
        panelContent = (
            <MemoEditor
                memo={memoEditorState.memo}
                isVisible={memoEditorState.isOpen}
                onClose={handleMemoEditorClose}
                onUpdate={handleMemoUpdate}
                onDelete={handleMemoDelete}
            />
        );
    }

    const splitControlButtonClassName = theme === 'light'
        ? 'rounded-full border border-slate-300/60 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-white'
        : 'rounded-full border border-white/15 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-100 shadow-lg transition hover:bg-slate-900';
    const maximizeLabel = isSplitPanelMaximized ? '원래 크기로' : '전체 화면';
    const controlIconColor = theme === 'light'
        ? 'rgba(30, 41, 59, 0.9)'
        : 'rgba(241, 245, 249, 0.92)';
    const maximizeIcon = isSplitPanelMaximized
        ? <Minimize2 className="h-4 w-4" style={{ color: controlIconColor }} aria-hidden="true" />
        : <Maximize2 className="h-4 w-4" style={{ color: controlIconColor }} aria-hidden="true" />;

    return (
        <div
            ref={layoutRef}
            className="flex h-full w-full overflow-hidden"
            style={{ background: themeBackground }}
        >
            <div
                className="relative flex-1 min-w-0"
                style={{ display: isSplitPanelVisible && isSplitPanelMaximized ? 'none' : undefined }}
            >
                {treeCanvas}
            </div>

            {isSplitPanelVisible && !isSplitPanelMaximized && (
                <div
                    role="separator"
                    aria-orientation="vertical"
                    onPointerDown={handleSplitPanelDragStart}
                    className={`relative z-[1500] h-full w-3 cursor-col-resize select-none transition ${isSplitPanelResizing ? 'bg-slate-500/40' : 'bg-transparent hover:bg-slate-500/20'}`}
                >
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200/80" />
                </div>
            )}

            {isSplitPanelVisible && panelContent && (
                <div
                    className="relative flex h-full"
                    style={panelFlexStyle}
                >
                    <div className="relative flex h-full w-full min-w-0">
                        <div className="absolute right-4 top-4 z-[2000] flex gap-2">
                            <button
                                type="button"
                                onClick={handleSplitPanelToggleMaximize}
                                className={splitControlButtonClassName}
                            >
                                {maximizeIcon}
                                <span className="sr-only">{maximizeLabel}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handlePanelClose}
                                className={splitControlButtonClassName}
                            >
                                <X className="h-4 w-4" style={{ color: controlIconColor }} aria-hidden="true" />
                                <span className="sr-only">닫기</span>
                            </button>
                        </div>
                        <div className="flex h-full w-full overflow-hidden">
                            {panelContent}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ForceDirectedTree;
