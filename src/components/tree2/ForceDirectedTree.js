import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import DataTransformService from '../../services/DataTransformService';
import ForceSimulationService from '../../services/ForceSimulationService';
import NodeAssistantPanel from '../NodeAssistantPanel';
import QuestionService from '../../services/QuestionService';

const NODE_COLOR_PALETTE = (d3.schemeTableau10 && d3.schemeTableau10.length ? d3.schemeTableau10 : d3.schemeCategory10);

const sanitizeText = (value) => {
    if (typeof value !== 'string') {
        if (value === null || value === undefined) return '';
        return String(value);
    }
    return value;
};

const extractNodeHoverText = (nodeData = {}) => {
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
    questionService,
    getInitialConversation,
    onConversationChange,
    onRequestAnswer,
    onAnswerComplete,
    onAnswerError,
    onSecondQuestion,
    onPlaceholderCreate,
}) => {
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
    const dragStartTimeRef = useRef(0);
    const shouldOpenNodeRef = useRef(false);

    // SVG 중심 위치 계산
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // viewTransform 초기값을 중심으로 설정
    const [viewTransform, setViewTransform] = useState({ x: centerX, y: centerY, k: 1 });

    // Simulation 초기화
    useEffect(() => {
        if (!data || !data.nodes || data.nodes.length === 0) {
            setSimulatedNodes([]);
            setSimulatedLinks([]);
            return;
        }

        // 1. 데이터 변환
        const hierarchyData = DataTransformService.transformToHierarchy(
            data.nodes,
            data.links
        );

        if (!hierarchyData) {
            setSimulatedNodes([]);
            setSimulatedLinks([]);
            return;
        }

        // 2. Simulation 서비스 생성
        if (!simulationServiceRef.current) {
            simulationServiceRef.current = new ForceSimulationService();
        }

        // 3. Simulation 생성 및 tick 콜백
        const handleTick = (nodes, links) => {
            setSimulatedNodes([...nodes]);
            setSimulatedLinks([...links]);
        };

        simulationServiceRef.current.createSimulation(
            hierarchyData,
            dimensions,
            handleTick
        );

        // Cleanup
        return () => {
            if (simulationServiceRef.current) {
                simulationServiceRef.current.cleanup();
            }
        };
    }, [data, dimensions]);

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

    // Zoom/Pan 설정
    const zoomBehaviorRef = useRef(null);

    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);

        const zoom = d3.zoom()
            .scaleExtent([0.3, 3])
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
                return base * 1.0;
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

    // 노드 드래그 핸들러
    const handleDragStart = useCallback((event, nodeData) => {
        event.preventDefault();
        event.stopPropagation();

        // 드래그 시작 시간 기록
        dragStartTimeRef.current = Date.now();
        shouldOpenNodeRef.current = false;

        setIsDraggingNode(true);
        setDraggedNodeId(nodeData.data.id);

        if (simulationServiceRef.current) {
            simulationServiceRef.current.handleDragStart(event, nodeData);
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
        };

        const handleGlobalPointerUp = (e) => {
            if (simulationServiceRef.current) {
                simulationServiceRef.current.handleDragEnd(e, nodeData);
            }

            // 드래그 시간 체크 (0.1초 이하면 클릭으로 처리)
            const dragDuration = Date.now() - dragStartTimeRef.current;
            if (dragDuration <= 100) {
                shouldOpenNodeRef.current = true;
            }

            setIsDraggingNode(false);
            setDraggedNodeId(null);

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

    // 노드 클릭 핸들러
    const handleNodeClick = useCallback((node) => {
        // 드래그 중이거나 다른 노드가 드래그 중일 때는 클릭 무시
        if (isDraggingNode || draggedNodeId) {
            return;
        }

        // 드래그 시간이 0.2초 초과였으면 클릭 무시
        if (!shouldOpenNodeRef.current) {
            shouldOpenNodeRef.current = false;
            return;
        }

        // 플래그 리셋
        shouldOpenNodeRef.current = false;

        // 노드를 화면 중앙으로 이동
        centerNodeOnScreen(node);

        setSelectedNodeId(node.data.id);
        if (onNodeClick) {
            onNodeClick(node.data.id);
        }
    }, [onNodeClick, isDraggingNode, draggedNodeId, centerNodeOnScreen]);

    // 배경 클릭 핸들러 (선택 해제)
    const handleBackgroundClick = useCallback(() => {
        setSelectedNodeId(null);
        setHoveredNodeId(null);
    }, []);

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

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full"
            style={{
                background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.18))',
                overflow: 'hidden',
            }}
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
                    {/* 링크 화살표 */}
                    <marker
                        id="arrowhead-force"
                        viewBox="0 -5 10 10"
                        refX={15}
                        refY={0}
                        markerWidth={6}
                        markerHeight={6}
                        orient="auto"
                    >
                        <path d="M0,-5L10,0L0,5" fill="rgba(255,255,255,0.3)" />
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

                            return (
                                <motion.line
                                    key={`link-${index}`}
                                    x1={sourceX}
                                    y1={sourceY}
                                    x2={targetX}
                                    y2={targetY}
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth={2}
                                    markerEnd="url(#arrowhead-force)"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                />
                            );
                        })}
                    </g>

                    {/* 노드 렌더링 */}
                    <g className="nodes">
                        {simulatedNodes.map((node) => {
                            const nodeId = node?.data?.id;

                            if (!nodeId) {
                                return null;
                            }

                            const depth = Number.isFinite(node.depth) ? node.depth : 0;
                            const palette = NODE_COLOR_PALETTE && NODE_COLOR_PALETTE.length
                                ? NODE_COLOR_PALETTE
                                : d3.schemeCategory10;
                            const fillColor = palette[depth % palette.length];
                            const isBeingDragged = draggedNodeId === nodeId;
                            const isSelected = selectedNodeId === nodeId;
                            const isHovered = hoveredNodeId === nodeId;
                            const isOtherNodeDragging = isDraggingNode && !isBeingDragged;

                            const baseRadius = depth === 0 ? 8 : 5.5;
                            const radius = isSelected
                                ? baseRadius + 3
                                : isHovered
                                    ? baseRadius + 1.5
                                    : baseRadius;

                            const opacity = isBeingDragged ? 1 : (isOtherNodeDragging ? 0.25 : 0.9);

                            const hoverText = isHovered ? extractNodeHoverText(node.data) : '';
                            const hoverLines = isHovered ? computeHoverLines(hoverText) : [];
                            const { width: tooltipWidth, height: tooltipHeight } = computeTooltipDimensions(hoverLines);
                            const tooltipTranslateX = -tooltipWidth / 2;
                            const tooltipTranslateY = -(radius + tooltipHeight + 12);
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
                                    onPointerEnter={() => {
                                        if (isOtherNodeDragging) return;
                                        setHoveredNodeId(nodeId);
                                    }}
                                    onPointerLeave={() => {
                                        setHoveredNodeId((current) => (current === nodeId ? null : current));
                                    }}
                                >
                                    <motion.circle
                                        r={radius}
                                        fill={fillColor}
                                        stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.45)'}
                                        strokeWidth={isSelected ? 2.4 : 1.6}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: isBeingDragged ? 1.02 : 1, opacity }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                    />

                                    {isSelected && (
                                        <motion.circle
                                            r={radius + 6}
                                            fill="none"
                                            stroke={fillColor}
                                            strokeWidth={1.2}
                                            strokeOpacity={0.65}
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
                                                    fill="rgba(0, 0, 0, 0.8)"
                                                    stroke="rgba(255,255,255,0.35)"
                                                    strokeWidth={1}
                                                />
                                                {hoverLines.map((line, index) => (
                                                    <text
                                                        key={`${nodeId}-line-${index}`}
                                                        x={tooltipWidth / 2}
                                                        y={14 + index * tooltipLineHeight}
                                                        textAnchor="middle"
                                                        fill="#f5f5f5"
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

            {/* AI 대화 패널 */}
            {selectedNodeId && (() => {
                const selectedNode = simulatedNodes.find(n => n.data.id === selectedNodeId);
                if (!selectedNode) return null;

                // 화면 크기의 95% 사용
                const panelWidth = dimensions.width * 0.95;
                const panelHeight = dimensions.height * 0.95;

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
                            <NodeAssistantPanel
                                node={selectedNode.data}
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
                                    label: selectedNode.data.keyword || selectedNode.data.id,
                                    intro: selectedNode.data.fullText || '',
                                    bullets: []
                                }}
                                isRootNode={false}
                                bootstrapMode={false}
                                onBootstrapFirstSend={() => { }}
                                onPanZoomGesture={() => { }}
                                nodeScaleFactor={1}
                            />
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ForceDirectedTree;
