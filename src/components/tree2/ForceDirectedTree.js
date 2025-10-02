import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import DataTransformService from '../../services/DataTransformService';
import ForceSimulationService from '../../services/ForceSimulationService';
import NodeAssistantPanel from '../NodeAssistantPanel';
import MemoPanel from './MemoPanel';
import QuestionService from '../../services/QuestionService';
import { saveTreeViewportState, loadTreeViewportState } from '../../services/supabaseTrees';

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
    onMemoCreate,
    onMemoUpdate,
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
}) => {
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
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [contextMenuState, setContextMenuState] = useState(() => ({ ...DEFAULT_CONTEXT_MENU_STATE }));
    const [linkCreationState, setLinkCreationState] = useState({ active: false, sourceId: null });
    const isLinking = linkCreationState.active;
    const linkingSourceId = linkCreationState.sourceId;
    const dragStartTimeRef = useRef(0);
    const shouldOpenNodeRef = useRef(false);
    const draggedMemoSnapshotRef = useRef([]);
    const pendingCenterNodeIdRef = useRef(null);
    const previousPositionsRef = useRef(new Map());

    // SVG 중심 위치 계산
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // viewTransform 초기값을 중심으로 설정
    const [viewTransform, setViewTransform] = useState({ x: centerX, y: centerY, k: 1 });

    // 뷰포트 상태 저장/복원 관련
    const [viewportStateLoaded, setViewportStateLoaded] = useState(false);
    const saveViewportStateTimeoutRef = useRef(null);

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

    // 뷰포트 상태 저장 함수
    const saveViewportState = useCallback(async () => {
        if (!treeId || !userId || !viewportStateLoaded) {
            return;
        }

        try {
            const nodePositions = {};

            // simulatedNodes에서 노드 위치 수집
            simulatedNodes.forEach(node => {
                const datum = getNodeDatum(node);
                const nodeId = datum?.id || node.id;
                if (nodeId && Number.isFinite(node.x) && Number.isFinite(node.y)) {
                    nodePositions[nodeId] = {
                        x: node.x,
                        y: node.y
                    };
                }
            });

            // previousPositionsRef에서도 노드 위치 수집 (fallback)
            if (Object.keys(nodePositions).length === 0 && previousPositionsRef.current.size > 0) {
                previousPositionsRef.current.forEach((position, nodeId) => {
                    if (Number.isFinite(position.x) && Number.isFinite(position.y)) {
                        nodePositions[nodeId] = {
                            x: position.x,
                            y: position.y
                        };
                    }
                });
            }

            const viewportData = {
                nodePositions
            };

            console.log('뷰포트 상태 저장:', {
                treeId,
                userId,
                nodeCount: Object.keys(nodePositions).length,
                simulatedNodesCount: simulatedNodes.length,
                previousPositionsCount: previousPositionsRef.current.size,
                viewportData
            });

            await saveTreeViewportState({
                treeId,
                userId,
                viewportData
            });

            console.log('뷰포트 상태 저장 완료');
        } catch (error) {
            console.warn('뷰포트 상태 저장 실패:', error);
        }
    }, [treeId, userId, viewTransform, simulatedNodes, viewportStateLoaded]);

    // 뷰포트 상태 복원 함수
    const loadViewportState = useCallback(async () => {
        if (!treeId || !userId || viewportStateLoaded) {
            return;
        }

        try {
            console.log('뷰포트 상태 복원 시작:', { treeId, userId });
            const savedState = await loadTreeViewportState({ treeId, userId });

            if (savedState) {
                console.log('저장된 뷰포트 상태:', savedState);

                // 뷰포트 변환은 복원하지 않음 (노드 위치만 복원)

                // 노드 위치 복원을 위한 플래그 설정
                if (savedState.nodePositions) {
                    const nodePositionsMap = new Map(Object.entries(savedState.nodePositions));
                    previousPositionsRef.current = nodePositionsMap;
                    console.log('노드 위치 복원:', nodePositionsMap.size, '개 노드');
                    console.log('복원된 노드 위치:', Object.fromEntries(nodePositionsMap));
                }
            } else {
                console.log('저장된 뷰포트 상태 없음');
            }
            setViewportStateLoaded(true);
        } catch (error) {
            console.warn('뷰포트 상태 복원 실패:', error);
            setViewportStateLoaded(true);
        }
    }, [treeId, userId, centerX, centerY, viewportStateLoaded]);

    // 뷰포트 상태 자동 저장 (디바운스)
    const debouncedSaveViewportState = useCallback(() => {
        if (saveViewportStateTimeoutRef.current) {
            clearTimeout(saveViewportStateTimeoutRef.current);
        }
        saveViewportStateTimeoutRef.current = setTimeout(() => {
            saveViewportState();
        }, 1000); // 1초 후 저장
    }, [saveViewportState]);

    // Simulation 초기화 (뷰포트 상태 로드 후)
    useEffect(() => {
        if (!data || !data.nodes || data.nodes.length === 0) {
            previousPositionsRef.current = new Map();
            setSimulatedNodes([]);
            setSimulatedLinks([]);
            return;
        }

        // 뷰포트 상태가 아직 로드되지 않았으면 대기
        if (treeId && userId && !viewportStateLoaded) {
            return;
        }

        const preparedNodes = assignFallbackPositions(data.nodes);

        const hierarchyData = DataTransformService?.transformToHierarchy(
            preparedNodes,
            data.links
        );

        if (!hierarchyData) {
            previousPositionsRef.current = new Map();
            setSimulatedNodes([]);
            setSimulatedLinks([]);
            return;
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
            previousPositions
        );

        if (Array.isArray(nextNodes)) {
            previousPositionsRef.current = new Map(
                nextNodes
                    .map((node) => {
                        const datum = getNodeDatum(node);
                        return datum?.id ? [datum.id, { x: node.x || 0, y: node.y || 0 }] : null;
                    })
                    .filter(Boolean)
            );
            setSimulatedNodes([...nextNodes]);
        } else {
            previousPositionsRef.current = new Map();
            setSimulatedNodes([]);
        }

        setSimulatedLinks(Array.isArray(nextLinks) ? [...nextLinks] : []);

        // Cleanup
        return () => {
            if (simulationServiceRef.current) {
                simulationServiceRef.current.cleanup();
            }
            // 컴포넌트 언마운트 시 뷰포트 상태 저장
            if (viewportStateLoaded) {
                saveViewportState();
            }
            // 타이머 정리
            if (saveViewportStateTimeoutRef.current) {
                clearTimeout(saveViewportStateTimeoutRef.current);
            }
        };
    }, [data, dimensions, assignFallbackPositions, viewportStateLoaded, treeId, userId]);

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
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);

        const zoom = d3.zoom()
            .scaleExtent([0.3, 8])
            .filter((event) => {
                // 노드 드래그 중에는 줌/팬 비활성화
                if (isDraggingNode) return false;

                // foreignObject나 노드 내부에서는 줌/팬 비활성화
                const target = event.target instanceof Element ? event.target : null;
                if (target && target.closest('foreignObject')) return false;

                // wheel 이벤트는 모두 허용 (트랙패드 줌/스크롤)
                if (event.type === 'wheel') return true;

                // 더블클릭은 비활성화
                if (event.type === 'dblclick') return false;

                // 모든 버튼 드래그 허용 (좌클릭, 우클릭, 휠 버튼)
                if (event.type === 'mousedown' || event.type === 'pointerdown') return true;
                if (event.type === 'mousemove' || event.type === 'pointermove') return true;
                if (event.type === 'mouseup' || event.type === 'pointerup') return true;

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
    }, [isDraggingNode, centerX, centerY]);

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

        if (simulationServiceRef.current) {
            simulationServiceRef.current.handleDragStart(event, nodeData);
        }

        const simulation = simulationServiceRef.current?.getSimulation?.();
        if (simulation && datum?.nodeType !== 'memo') {
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

            simulationServiceRef.current.handleDrag(mockEvent, nodeData);

            if (draggedMemoSnapshotRef.current.length > 0) {
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

            // 드래그 시간 체크 (0.2초 이하면 클릭으로 처리)
            const dragDuration = Date.now() - dragStartTimeRef.current;
            if (dragDuration <= 120) {
                shouldOpenNodeRef.current = true;
            }

            setIsDraggingNode(false);
            setDraggedNodeId(null);

            if (draggedMemoSnapshotRef.current.length > 0) {
                draggedMemoSnapshotRef.current.forEach(({ node: memoNode }) => {
                    if (!memoNode) return;
                    memoNode.fx = null;
                    memoNode.fy = null;
                });
                draggedMemoSnapshotRef.current = [];
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
    }, [centerX, centerY, viewTransform]);


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
                    pendingCenterNodeIdRef.current = nodeId;
                    setSelectedNodeId(nodeId);
                })
                .finally(() => {
                    cancelLinkCreation();
                });
            return;
        }

        centerNodeOnScreen(node);

        setSelectedNodeId(nodeId);
        if (onNodeClick) {
            onNodeClick({ id: nodeId });
        }
    }, [onNodeClick, isDraggingNode, draggedNodeId, centerNodeOnScreen, isLinking, linkingSourceId, cancelLinkCreation, onLinkCreate]);

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
        pendingCenterNodeIdRef.current = sourceId;
        setSelectedNodeId(sourceId);
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

    // 배경 클릭 핸들러 (선택 해제)
    const handleBackgroundClick = useCallback(() => {
        if (isLinking) {
            cancelLinkCreation();
            return;
        }
        setSelectedNodeId(null);
        setHoveredNodeId(null);
    }, [isLinking, cancelLinkCreation]);

    // Conversation 관리
    const getInitialConversationForNode = useCallback((nodeId) => {
        return getInitialConversation ? getInitialConversation(nodeId) : [];
    }, [getInitialConversation]);

    const handleConversationChange = useCallback((nodeId, messages) => {
        if (onConversationChange) {
            onConversationChange(nodeId, messages);
        }
    }, [onConversationChange]);

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

    return (
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
                    cursor: isDraggingNode ? 'grabbing' : 'default',
                }}
                onClick={(e) => {
                    // 배경 클릭 시 선택 해제
                    e.stopPropagation();
                    handleBackgroundClick();
                }}
            >
                <defs>
                    {/* 다크모드 - 링크 화살표 - 짝수 depth (흰색) */}
                    <marker
                        id="arrowhead-even"
                        viewBox="0 -5 10 10"
                        refX={15}
                        refY={0}
                        markerWidth={6}
                        markerHeight={6}
                        orient="auto"
                    >
                        <path d="M0,-5L10,0L0,5" fill="rgba(255,255,255,0.4)" />
                    </marker>

                    {/* 다크모드 - 링크 화살표 - 홀수 depth (검정) */}
                    <marker
                        id="arrowhead-odd"
                        viewBox="0 -5 10 10"
                        refX={15}
                        refY={0}
                        markerWidth={6}
                        markerHeight={6}
                        orient="auto"
                    >
                        <path d="M0,-5L10,0L0,5" fill="rgba(0,0,0,0.5)" />
                    </marker>

                    {/* 라이트모드 - 링크 화살표 - 짝수 depth (어두운 회색) */}
                    <marker
                        id="arrowhead-dark"
                        viewBox="0 -5 10 10"
                        refX={15}
                        refY={0}
                        markerWidth={6}
                        markerHeight={6}
                        orient="auto"
                    >
                        <path d="M0,-5L10,0L0,5" fill="rgba(31, 41, 55, 0.6)" />
                    </marker>

                    {/* 라이트모드 - 링크 화살표 - 홀수 depth (밝은 회색) */}
                    <marker
                        id="arrowhead-light"
                        viewBox="0 -5 10 10"
                        refX={15}
                        refY={0}
                        markerWidth={6}
                        markerHeight={6}
                        orient="auto"
                    >
                        <path d="M0,-5L10,0L0,5" fill="rgba(156, 163, 175, 0.5)" />
                    </marker>
                </defs>

                <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
                    {/* 링크 렌더링 */}
                    <g className="links">
                        {simulatedLinks.map((link, index) => {
                            const sourceX = link.source.x || 0;
                            const sourceY = link.source.y || 0;
                            const targetX = link.target.x || 0;
                            const targetY = link.target.y || 0;

                            const targetDatum = getNodeDatum(link.target);
                            const isMemoLink = targetDatum?.nodeType === 'memo';

                            // target depth로 색상 구분
                            const targetDepth = Number.isFinite(link.target.depth) ? link.target.depth : 0;
                            const isEvenDepth = targetDepth % 2 === 0;
                            const isLightMode = theme === 'light';

                            let linkStroke;

                            if (isMemoLink) {
                                // 메모 링크 - 중립적인 색상으로 완화
                                linkStroke = isLightMode
                                    ? 'rgba(209, 213, 219, 0.85)'
                                    : 'rgba(75, 85, 99, 0.8)';
                            } else if (isLightMode) {
                                // 라이트모드 - 일반 링크
                                linkStroke = isEvenDepth
                                    ? 'rgba(31, 41, 55, 0.6)'  // 짙은 회색
                                    : 'rgba(156, 163, 175, 0.5)'; // 밝은 회색
                            } else {
                                // 다크모드 - 일반 링크
                                linkStroke = isEvenDepth
                                    ? 'rgba(255, 255, 255, 0.4)' // 흰색
                                    : 'rgba(0, 0, 0, 0.5)'; // 검정
                            }

                            const linkWidth = isMemoLink ? 1.1 : 1.5;
                            const linkOpacity = isMemoLink ? 0.75 : 1;

                            return (
                                <motion.line
                                    key={`link-${index}`}
                                    x1={sourceX}
                                    y1={sourceY}
                                    x2={targetX}
                                    y2={targetY}
                                    stroke={linkStroke}
                                    strokeWidth={linkWidth}
                                    strokeDasharray={isMemoLink ? '2,3' : undefined}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: linkOpacity }}
                                    transition={{ duration: 0.3 }}
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

                            const depth = Number.isFinite(node.depth) ? node.depth : 0;
                            const isMemoNode = datum?.nodeType === 'memo';
                            const isRootNode = !isMemoNode && depth === 0;
                            const isMemoStyledNode = isMemoNode || isRootNode;
                            const isBeingDragged = draggedNodeId === nodeId;
                            const isSelected = selectedNodeId === nodeId;
                            const isHovered = hoveredNodeId === nodeId;
                            const isOtherNodeDragging = isDraggingNode && !isBeingDragged;

                            // 텍스트 레이블
                            const labelText = isMemoNode
                                ? (datum.memo?.title || datum.keyword || datum.name || datum.id || '')
                                : (datum.keyword || datum.name || datum.id || '');

                            // 노드 크기 (텍스트 길이에 맞춰 동적 조정)
                            const fontSize = 7;
                            const charWidth = fontSize * 0.6; // 글자당 예상 너비
                            const padding = isMemoStyledNode ? 9 : 8; // 좌우 여백
                            const minWidth = isMemoStyledNode ? 24 : 20;
                            const maxWidth = 80;

                            const textWidth = labelText.length * charWidth + padding * 2;
                            const baseWidth = Math.max(minWidth, Math.min(maxWidth, textWidth));
                            const baseHeight = 16;

                            const nodeWidth = isSelected
                                ? baseWidth + 4
                                : isHovered
                                    ? baseWidth + 2
                                    : baseWidth;

                            const nodeHeight = isSelected
                                ? baseHeight + 2
                                : isHovered
                                    ? baseHeight + 1
                                    : baseHeight;

                            // 색상 테마
                            const isEvenDepth = depth % 2 === 0;
                            const isLightMode = theme === 'light';

                            let fillColor, strokeColor, textColor;

                            if (isRootNode) {
                                // 최상위 노드 - 황금색 톤으로 강조
                                fillColor = isLightMode ? '#FDE68A' : '#92400E';
                                strokeColor = isLightMode ? '#F59E0B' : '#FCD34D';
                                textColor = isLightMode ? '#78350F' : '#FDE68A';
                            } else if (isMemoNode) {
                                // 메모 노드 - 중립적인 톤
                                fillColor = isLightMode ? '#FFFFFF' : '#1F2937';
                                strokeColor = isLightMode ? '#D1D5DB' : '#4B5563';
                                textColor = isLightMode ? '#111827' : '#E5E7EB';
                            } else if (isLightMode) {
                                // 라이트모드 - 일반 노드
                                fillColor = isEvenDepth ? '#1F2937' : '#F3F4F6';
                                strokeColor = isEvenDepth ? '#111827' : '#9CA3AF';
                                textColor = isEvenDepth ? '#FFFFFF' : '#1F2937';
                            } else {
                                // 다크모드 - 일반 노드
                                fillColor = isEvenDepth ? '#FFFFFF' : '#000000';
                                strokeColor = isEvenDepth ? '#000000' : '#FFFFFF';
                                textColor = isEvenDepth ? '#000000' : '#FFFFFF';
                            }

                            const opacity = isBeingDragged ? 1 : (isOtherNodeDragging ? 0.25 : 0.95);
                            const baseStrokeWidth = isRootNode ? 1.8 : 1;
                            const strokeWidth = isSelected ? baseStrokeWidth + 0.5 : baseStrokeWidth;

                            const hoverText = isHovered ? extractNodeHoverText(datum) : '';
                            const hoverLines = isHovered ? computeHoverLines(hoverText) : [];
                            const { width: tooltipWidth, height: tooltipHeight } = computeTooltipDimensions(hoverLines);
                            const tooltipTranslateX = -tooltipWidth / 2;
                            const tooltipTranslateY = -(nodeHeight / 2 + tooltipHeight + 12);
                            const tooltipLineHeight = 18;

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
                                    {/* 네모 노드 */}
                                    <motion.rect
                                        x={-nodeWidth / 2}
                                        y={-nodeHeight / 2}
                                        width={nodeWidth}
                                        height={nodeHeight}
                                        rx={3}
                                        ry={3}
                                        fill={fillColor}
                                        stroke={strokeColor}
                                        strokeWidth={strokeWidth}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: isBeingDragged ? 1.02 : 1, opacity }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                    />

                                    {/* 노드 내부에 이름 표시 */}
                                    {labelText && (
                                        <motion.text
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fill={textColor}
                                            fontSize={fontSize}
                                            fontWeight={isRootNode ? 700 : 600}
                                            pointerEvents="none"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.2 }}
                                            style={{
                                                textShadow: isRootNode
                                                    ? (isLightMode
                                                        ? '0 1px 2px rgba(0,0,0,0.35)'
                                                        : '0 1px 2px rgba(0,0,0,0.8)')
                                                    : isMemoNode
                                                        ? 'none'
                                                        : '0 1px 2px rgba(0,0,0,0.8)',
                                            }}
                                        >
                                            {labelText}
                                        </motion.text>
                                    )}

                                    {/* 선택 효과 */}
                                    {isSelected && (
                                        <motion.rect
                                            x={-(nodeWidth / 2 + 3)}
                                            y={-(nodeHeight / 2 + 3)}
                                            width={nodeWidth + 6}
                                            height={nodeHeight + 6}
                                            rx={4}
                                            ry={4}
                                            fill="none"
                                            stroke={strokeColor}
                                            strokeWidth={1}
                                            strokeOpacity={0.5}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        />
                                    )}

                                    <AnimatePresence>
                                        {isHovered && hoverLines.length > 0 && tooltipWidth > 0 && tooltipHeight > 0 && (
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
                                                    width={tooltipWidth}
                                                    height={tooltipHeight}
                                                    rx={10}
                                                    ry={10}
                                                    fill={theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.8)'}
                                                    stroke={theme === 'light' ? 'rgba(156, 163, 175, 0.5)' : 'rgba(255, 255, 255, 0.35)'}
                                                    strokeWidth={1}
                                                />
                                                {hoverLines.map((line, index) => (
                                                    <text
                                                        key={`${nodeId}-line-${index}`}
                                                        x={tooltipWidth / 2}
                                                        y={14 + index * tooltipLineHeight}
                                                        textAnchor="middle"
                                                        fill={theme === 'light' ? '#1F2937' : '#f5f5f5'}
                                                        fontSize={12}
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

            {/* AI 대화 패널 */}
            {selectedNodeId && (() => {
                const selectedNode = simulatedNodes.find((candidate) => getNodeId(candidate) === selectedNodeId);
                if (!selectedNode) return null;

                const selectedDatum = getNodeDatum(selectedNode);
                const isMemoSelection = selectedDatum?.nodeType === 'memo';
                const panelWidth = isMemoSelection
                    ? Math.min(Math.max(dimensions.width * 0.45, 360), 520)
                    : dimensions.width * 0.95;
                const panelHeight = isMemoSelection
                    ? Math.min(Math.max(dimensions.height * 0.45, 320), 520)
                    : dimensions.height * 0.95;

                return (
                    <div
                        className="pointer-events-none absolute"
                        style={{
                            left: '50%',
                            top: '52%',
                            transform: 'translate(-50%, -50%)',
                            width: panelWidth,
                            height: panelHeight,
                            zIndex: 1000,
                        }}
                        data-interactive-zone="true"
                    >
                        <div className="pointer-events-auto" style={{ width: '100%', height: '100%' }}>
                            {isMemoSelection ? (
                                <MemoPanel
                                    memo={selectedDatum}
                                    onClose={() => setSelectedNodeId(null)}
                                    onUpdate={(updates) => {
                                        if (!onMemoUpdate) return;
                                        onMemoUpdate(selectedDatum.id, updates);
                                    }}
                                />
                            ) : (
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
                                        bullets: []
                                    }}
                                    isRootNode={false}
                                    bootstrapMode={false}
                                    onBootstrapFirstSend={() => { }}
                                    onCloseNode={() => setSelectedNodeId(null)}
                                    onPanZoomGesture={() => { }}
                                    nodeScaleFactor={1}
                                />
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ForceDirectedTree;
