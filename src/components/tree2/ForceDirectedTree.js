import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import DataTransformService from '../../services/DataTransformService';
import ForceSimulationService from '../../services/ForceSimulationService';
import MemoBlock from './MemoBlock';
import NodeAssistantPanel from '../NodeAssistantPanel';
import QuestionService from '../../services/QuestionService';

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
}) => {
    const questionServiceRef = useRef(new QuestionService());
    const conversationStoreRef = useRef(new Map());
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const simulationServiceRef = useRef(null);
    const [simulatedNodes, setSimulatedNodes] = useState([]);
    const [simulatedLinks, setSimulatedLinks] = useState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const dragStartTimeRef = useRef(0);
    const shouldOpenNodeRef = useRef(false);

    // SVG 중심 위치 계산
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

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

                // 마우스 휠로 줌
                if (event.type === 'wheel') return true;

                // 우클릭 또는 휠 버튼으로 팬
                if (event.button === 2) return true;
                if (event.button === 1) return true; // 휠 버튼

                return false;
            })
            .on('zoom', (event) => {
                setViewTransform({
                    x: event.transform.x,
                    y: event.transform.y,
                    k: event.transform.k
                });
            });

        zoomBehaviorRef.current = zoom;
        svg.call(zoom);

        // 휠 버튼 드래그로 팬 기능 추가
        const handleWheelDown = (event) => {
            if (event.button === 1 && !isDraggingNode) { // 휠 버튼
                event.preventDefault();
                setIsPanning(true);
                setLastPanPoint({ x: event.clientX, y: event.clientY });
                svg.style.cursor = 'grabbing';
            }
        };

        const handleMouseMove = (event) => {
            if (isPanning && !isDraggingNode) {
                event.preventDefault();
                const deltaX = event.clientX - lastPanPoint.x;
                const deltaY = event.clientY - lastPanPoint.y;

                setViewTransform(prev => ({
                    x: prev.x + deltaX,
                    y: prev.y + deltaY,
                    k: prev.k
                }));

                setLastPanPoint({ x: event.clientX, y: event.clientY });
            }
        };

        const handleMouseUp = (event) => {
            if (event.button === 1 && isPanning) { // 휠 버튼
                event.preventDefault();
                setIsPanning(false);
                svg.style.cursor = 'default';
            }
        };

        // 이벤트 리스너 등록
        svg.on('mousedown', handleWheelDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            svg.on('.zoom', null);
            svg.on('mousedown', null);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingNode, isPanning, lastPanPoint]);

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
            const forceX = (svgPoint.x - centerX - viewTransform.x) / viewTransform.k;
            const forceY = (svgPoint.y - centerY - viewTransform.y) / viewTransform.k;

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

        const targetX = -node.x * viewTransform.k;
        const targetY = -node.y * viewTransform.k;

        const svg = d3.select(svgRef.current);
        const targetTransform = d3.zoomIdentity
            .translate(targetX, targetY)
            .scale(viewTransform.k);

        // D3 transition으로 부드럽게 이동하고 zoom behavior 업데이트
        svg.transition()
            .duration(500)
            .ease(d3.easeCubicInOut)
            .call(zoomBehaviorRef.current.transform, targetTransform);
    }, [viewTransform]);

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
    }, []);

    // Conversation 관리
    const getInitialConversationForNode = useCallback((nodeId) => {
        return conversationStoreRef.current.get(nodeId) || [];
    }, []);

    const handleConversationChange = useCallback((nodeId, messages) => {
        conversationStoreRef.current.set(nodeId, messages);
    }, []);

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

    // 빈 데이터 처리
    if (!data || !data.nodes || data.nodes.length === 0) {
        return (
            <div
                className="flex h-full w-full items-center justify-center"
                style={{
                    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.18))',
                }}
            >
                <div className="text-white/60">
                    트리 데이터가 없습니다
                </div>
            </div>
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
                    cursor: isDraggingNode ? 'grabbing' : isPanning ? 'grabbing' : 'default',
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

                <g transform={`translate(${centerX + viewTransform.x}, ${centerY + viewTransform.y}) scale(${viewTransform.k})`}>
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
                            const isLeaf = !node.children || node.children.length === 0;
                            const isBeingDragged = draggedNodeId === node.data.id;
                            const isOtherNodeDragging = isDraggingNode && !isBeingDragged;

                            return (
                                <MemoBlock
                                    key={node.data.id}
                                    node={node}
                                    position={{ x: node.x || 0, y: node.y || 0 }}
                                    isSelected={selectedNodeId === node.data.id}
                                    isLeaf={isLeaf}
                                    onDragStart={handleDragStart}
                                    onClick={handleNodeClick}
                                    scale={viewTransform.k}
                                    isDisabled={isOtherNodeDragging}
                                    onAddMemo={(node) => {
                                        console.log('ForceDirectedTree: 메모 추가', node.data.id);
                                    }}
                                    onAddConnection={(node) => {
                                        console.log('ForceDirectedTree: 연결선 추가', node.data.id);
                                    }}
                                    onToggleChildren={(node) => {
                                        console.log('ForceDirectedTree: 자식 노드 접기/펼치기', node.data.id);
                                    }}
                                />
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
                                onSecondQuestion={() => { }}
                                onPlaceholderCreate={() => { }}
                                questionService={questionServiceRef.current}
                                initialConversation={getInitialConversationForNode(selectedNodeId)}
                                onConversationChange={(messages) => handleConversationChange(selectedNodeId, messages)}
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

