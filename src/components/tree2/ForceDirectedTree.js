import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import DataTransformService from '../../services/DataTransformService';
import ForceSimulationService from '../../services/ForceSimulationService';
import { fetchMemosForTree, upsertMemo, deleteMemo as deleteMemoFromDB } from '../../services/supabaseTrees';
import MemoBlock from './MemoBlock';
import MemoNoteBlock from './MemoNoteBlock';
import MemoCreationModal from './MemoCreationModal';
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
    treeId,
    userId,
}) => {
    const questionServiceRef = useRef(new QuestionService());
    const conversationStoreRef = useRef(new Map());
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const simulationServiceRef = useRef(null);
    const [simulatedNodes, setSimulatedNodes] = useState([]);
    const [simulatedLinks, setSimulatedLinks] = useState([]);
    const [simulatedMemos, setSimulatedMemos] = useState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const dragStartTimeRef = useRef(0);
    const shouldOpenNodeRef = useRef(false);

    // 메모 관련 상태
    const [memos, setMemos] = useState([]);
    const [isMemoModalVisible, setIsMemoModalVisible] = useState(false);
    const [memoModalNode, setMemoModalNode] = useState(null);

    // SVG 중심 위치 계산
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // 메모 로드 (treeId 변경 시)
    useEffect(() => {
        if (!treeId || !userId) {
            setMemos([]);
            return;
        }

        const loadMemos = async () => {
            try {
                const loadedMemos = await fetchMemosForTree({ treeId, userId });
                setMemos(loadedMemos);
            } catch (error) {
                console.error('메모 로드 실패:', error);
                setMemos([]);
            }
        };

        loadMemos();
    }, [treeId, userId]);

    // Simulation 초기화
    useEffect(() => {
        console.log('Simulation 초기화 - memos 개수:', memos.length);

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
        const handleTick = (nodes, links, memoNodes) => {
            console.log('Simulation tick - memoNodes 개수:', memoNodes.length);
            setSimulatedNodes([...nodes]);
            setSimulatedLinks([...links]);
            setSimulatedMemos([...memoNodes]);
        };

        console.log('createSimulation 호출 - memos:', memos);
        simulationServiceRef.current.createSimulation(
            hierarchyData,
            dimensions,
            handleTick,
            memos // 메모를 simulation에 전달
        );

        // Cleanup
        return () => {
            if (simulationServiceRef.current) {
                simulationServiceRef.current.cleanup();
            }
        };
    }, [data, dimensions, memos]);

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

    // 메모 관리 함수들
    const generateMemoId = useCallback(() => {
        return `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    const handleAddMemo = useCallback((node) => {
        setMemoModalNode(node);
        setIsMemoModalVisible(true);
    }, []);

    const handleSaveMemo = useCallback(async (content) => {
        if (!memoModalNode || !content.trim()) return;

        const newMemo = {
            id: generateMemoId(),
            nodeId: memoModalNode.data.id,
            content: content.trim(),
            // position은 simulation이 관리하므로 초기값만 설정
            position: {
                x: memoModalNode.x + (Math.random() - 0.5) * 60, // 노드 근처 랜덤 위치 (더 가깝게)
                y: memoModalNode.y + (Math.random() - 0.5) * 60,
            },
            createdAt: Date.now(),
        };

        console.log('메모 생성:', newMemo);

        // 로컬 상태 즉시 업데이트 (낙관적 업데이트)
        setMemos(prev => {
            const updated = [...prev, newMemo];
            console.log('메모 상태 업데이트:', updated);
            return updated;
        });
        setIsMemoModalVisible(false);
        setMemoModalNode(null);

        // Supabase에 저장 (비동기)
        if (treeId && userId) {
            try {
                await upsertMemo({ memo: newMemo, treeId, userId });
                console.log('메모 Supabase 저장 성공');
            } catch (error) {
                console.error('메모 저장 실패:', error);
                // 에러 발생 시 롤백
                setMemos(prev => prev.filter(m => m.id !== newMemo.id));
            }
        } else {
            console.warn('treeId 또는 userId 없음 - 로컬 전용 메모:', { treeId, userId });
        }
    }, [memoModalNode, generateMemoId, treeId, userId]);

    const handleEditMemo = useCallback(async (memoId, newContent) => {
        // 로컬 상태 즉시 업데이트
        const updatedMemo = memos.find(m => m.id === memoId);
        if (!updatedMemo) return;

        const newMemo = { ...updatedMemo, content: newContent, updatedAt: Date.now() };
        setMemos(prev => prev.map(memo =>
            memo.id === memoId ? newMemo : memo
        ));

        // Supabase에 저장 (비동기)
        if (treeId && userId) {
            try {
                await upsertMemo({ memo: newMemo, treeId, userId });
            } catch (error) {
                console.error('메모 수정 실패:', error);
                // 에러 발생 시 롤백
                setMemos(prev => prev.map(memo =>
                    memo.id === memoId ? updatedMemo : memo
                ));
            }
        }
    }, [memos, treeId, userId]);

    const handleDeleteMemo = useCallback(async (memoId) => {
        // 로컬 상태 즉시 업데이트
        const deletedMemo = memos.find(m => m.id === memoId);
        setMemos(prev => prev.filter(memo => memo.id !== memoId));

        // Supabase에서 삭제 (비동기)
        if (treeId && userId) {
            try {
                await deleteMemoFromDB({ memoId, userId });
            } catch (error) {
                console.error('메모 삭제 실패:', error);
                // 에러 발생 시 롤백
                if (deletedMemo) {
                    setMemos(prev => [...prev, deletedMemo]);
                }
            }
        }
    }, [memos, treeId, userId]);

    const handleMemoDragStart = useCallback((event, memo) => {
        event.preventDefault();
        event.stopPropagation();

        // 드래그 시작 시간 기록
        dragStartTimeRef.current = Date.now();
        shouldOpenNodeRef.current = false;

        setIsDraggingNode(true);
        setDraggedNodeId(memo.id);

        if (simulationServiceRef.current) {
            simulationServiceRef.current.handleDragStart(event, memo);
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

            simulationServiceRef.current.handleDrag(mockEvent, memo);
        };

        const handleGlobalPointerUp = async (e) => {
            // 드래그 시간 체크 (0.1초 이하면 클릭으로 처리)
            const dragDuration = Date.now() - dragStartTimeRef.current;
            if (dragDuration <= 100) {
                shouldOpenNodeRef.current = true;
            }

            // 메모 위치 저장 (드래그가 실제로 발생한 경우)
            if (dragDuration > 100 && treeId && userId && memo.x !== undefined && memo.y !== undefined) {
                try {
                    const updatedMemo = {
                        ...memo,
                        position: { x: memo.x, y: memo.y },
                        updatedAt: Date.now()
                    };
                    await upsertMemo({ memo: updatedMemo, treeId, userId });
                } catch (error) {
                    console.error('메모 위치 저장 실패:', error);
                }
            }

            // 드래그 종료 처리 (fx, fy 해제)
            if (simulationServiceRef.current) {
                simulationServiceRef.current.handleDragEnd(e, memo);
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
    }, [centerX, centerY, viewTransform, treeId, userId]);

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
                                    onAddMemo={handleAddMemo}
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

                    {/* 메모-노드 연결선 렌더링 */}
                    <g className="memo-links">
                        {simulatedLinks
                            .filter(link => link.isMemoLink)
                            .map((link) => (
                                <motion.line
                                    key={`memo-link-${link.target.id}`}
                                    x1={link.source.x || 0}
                                    y1={link.source.y || 0}
                                    x2={link.target.x || 0}
                                    y2={link.target.y || 0}
                                    stroke="rgba(255,255,255,0.2)" // 노드 연결선과 동일한 색상
                                    strokeWidth={2} // 노드 연결선과 동일한 두께
                                    markerEnd="url(#arrowhead-force)" // 노드 연결선과 동일한 화살표
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                />
                            ))}
                    </g>

                    {/* 메모 블럭 렌더링 */}
                    <g className="memos">
                        {simulatedMemos.map((memo) => (
                            <MemoNoteBlock
                                key={memo.id}
                                memo={memo}
                                position={{ x: memo.x || 0, y: memo.y || 0 }}
                                onDragStart={handleMemoDragStart}
                                onEdit={handleEditMemo}
                                onDelete={handleDeleteMemo}
                                scale={viewTransform.k}
                            />
                        ))}
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

            {/* 메모 생성 모달 */}
            <MemoCreationModal
                isVisible={isMemoModalVisible}
                nodePosition={memoModalNode ? { x: memoModalNode.x || 0, y: memoModalNode.y || 0 } : { x: 0, y: 0 }}
                nodeKeyword={memoModalNode?.data?.keyword || memoModalNode?.name || ''}
                onSave={handleSaveMemo}
                onCancel={() => {
                    setIsMemoModalVisible(false);
                    setMemoModalNode(null);
                }}
                viewTransform={viewTransform}
                containerDimensions={dimensions}
            />
        </div>
    );
};

export default ForceDirectedTree;

