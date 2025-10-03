import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ForceTreeContextMenu from './components/ForceTreeContextMenu';
import ForceTreeAssistantOverlay from './components/ForceTreeAssistantOverlay';
import useForceDirectedTreeController from './hooks/useForceDirectedTreeController';
import {
  NODE_SHAPES,
  getNodeDatum,
  getNodeId,
  extractNodeHoverText,
  computeHoverLines,
  computeTooltipDimensions,
  normalizeLinkEndpoint,
} from './utils/forceTreeUtils';

const ForceDirectedTree = (props) => {
  const { data, theme = 'dark' } = props;
  const controller = useForceDirectedTreeController(props);
  const {
    themeBackground,
    svgRef,
    containerRef,
    simulatedNodes,
    simulatedLinks,
    selectedNodeId,
    selectedNodeIds,
    isDraggingNode,
    draggedNodeId,
    hoveredNodeId,
    setHoveredNodeId,
    isSelectionBoxActive,
    setIsSelectionBoxActive,
    selectionBox,
    setSelectionBox,
    isSpacePressed,
    selectionBoxDidDragRef,
    isForceSimulationEnabled,
    setIsForceSimulationEnabled,
    connectionLinks,
    viewTransform,
    nodePositionMap,
    handleDragStart,
    handleBackgroundContextMenu,
    handleNodeClick,
    handleNodeContextMenu,
    handleBackgroundClick,
    dimensions,
  } = controller;

  if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
    return (
      <div
        className="relative h-full w-full"
        style={{
          background: themeBackground,
          overflow: 'hidden',
        }}
      />
    );
  }

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
            {/* Force Simulation 토글 버튼 */}
            <div className="absolute top-4 left-4 z-10">
                <button
                    onClick={() => setIsForceSimulationEnabled(!isForceSimulationEnabled)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${isForceSimulationEnabled
                        ? 'bg-blue-500 text-white shadow-lg hover:bg-blue-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    title={isForceSimulationEnabled ? '유기적 작용 끄기' : '유기적 작용 켜기'}
                >
                    {isForceSimulationEnabled ? '유기적 작용 ON' : '유기적 작용 OFF'}
                </button>
            </div>
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
                            const involvesMemo = sourceDatum?.nodeType === 'memo' || targetDatum?.nodeType === 'memo';

                            const strokeColor = theme === 'light'
                                ? (involvesMemo ? 'rgba(16, 185, 129, 0.75)' : 'rgba(59, 130, 246, 0.75)')
                                : (involvesMemo ? 'rgba(45, 212, 191, 0.82)' : 'rgba(147, 197, 253, 0.88)');

                            const strokeWidth = involvesMemo ? 0.8 : 1.1;

                            return (
                                <motion.line
                                    key={`connection-${sourceId}-${targetId}-${index}`}
                                    x1={sourceNode.x || 0}
                                    y1={sourceNode.y || 0}
                                    x2={targetNode.x || 0}
                                    y2={targetNode.y || 0}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
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

                            const depth = Number.isFinite(node.depth) ? node.depth : 0;
                            const isMemoNode = datum?.nodeType === 'memo';
                            const isRootNode = !isMemoNode && depth === 0;
                            const isMemoStyledNode = isMemoNode || isRootNode;
                            const isBeingDragged = draggedNodeId === nodeId;
                            const isSelected = selectedNodeId === nodeId;
                            const isMultiSelected = selectedNodeIds.has(nodeId);
                            const isHovered = hoveredNodeId === nodeId;
                            const isOtherNodeDragging = isDraggingNode && !isBeingDragged;

                            // 텍스트 레이블
                            const labelText = isMemoNode
                                ? (datum.memo?.title || datum.keyword || datum.name || datum.id || '')
                                : (datum.keyword || datum.name || datum.id || '');

                            // 노드 크기 (텍스트 길이에 맞춰 동적 조정)
                            const fontSize = isMemoStyledNode ? 10 : 9;
                            const charWidth = fontSize * 0.58; // 글자당 예상 너비
                            const padding = isMemoStyledNode ? 10 : 9; // 좌우 여백
                            const minWidth = isMemoStyledNode ? 28 : 22;
                            const maxWidth = 96;

                            const textWidth = labelText.length * charWidth + padding * 2;
                            const baseWidth = Math.max(minWidth, Math.min(maxWidth, textWidth));
                            const baseHeight = isMemoStyledNode ? 22 : 20;

                            // sizeValue 적용 (0-100을 0.1-2.0 스케일로 변환, 최소 0.1로 제한)
                            const sizeValue = datum?.sizeValue || 50;
                            const sizeScale = Math.max(0.1, sizeValue / 50); // 최소 0.1로 제한 (50이 기본값 1.0)
                            const scaledBaseWidth = baseWidth * sizeScale;
                            const scaledBaseHeight = baseHeight * sizeScale;
                            const scaledFontSize = fontSize * sizeScale; // 글자 크기도 스케일에 맞춰 조절

                            // 노드 모양에 따른 크기 조정
                            const nodeShape = datum?.nodeShape || NODE_SHAPES.RECTANGLE;
                            let nodeWidth, nodeHeight;

                            if (nodeShape === NODE_SHAPES.DOT) {
                                // 닷 모양: 작은 원형 닷 (크기 고정), 글자는 닷 위에 떠있음
                                const dotSize = 4; // 진짜 닷처럼 작게 (sizeScale 적용 안함)
                                nodeWidth = isSelected ? dotSize + 2 : isHovered ? dotSize + 1 : dotSize;
                                nodeHeight = nodeWidth; // 원형이므로 같음
                            } else if (nodeShape === NODE_SHAPES.ELLIPSE) {
                                // 타원 모양: 가로가 더 긴 타원
                                nodeWidth = isSelected
                                    ? scaledBaseWidth + 4
                                    : isHovered
                                        ? scaledBaseWidth + 2
                                        : scaledBaseWidth;
                                nodeHeight = isSelected
                                    ? scaledBaseHeight + 2
                                    : isHovered
                                        ? scaledBaseHeight + 1
                                        : scaledBaseHeight;
                            } else if (nodeShape === NODE_SHAPES.DIAMOND) {
                                // 마름모 모양: 정사각형 크기
                                const diamondSize = Math.max(scaledBaseWidth, scaledBaseHeight);
                                nodeWidth = isSelected ? diamondSize + 4 : isHovered ? diamondSize + 2 : diamondSize;
                                nodeHeight = nodeWidth; // 정사각형
                            } else {
                                // 사각형 모양 (기본)
                                nodeWidth = isSelected
                                    ? scaledBaseWidth + 4
                                    : isHovered
                                        ? scaledBaseWidth + 2
                                        : scaledBaseWidth;

                                nodeHeight = isSelected
                                    ? scaledBaseHeight + 2
                                    : isHovered
                                        ? scaledBaseHeight + 1
                                        : scaledBaseHeight;
                            }

                            // 색상 테마
                            const isEvenDepth = depth % 2 === 0;
                            const isLightMode = theme === 'light';

                            let fillColor, strokeColor, textColor;

                            if (nodeShape === NODE_SHAPES.DOT) {
                                // 닷 모양: 테두리와 안쪽 색상 같게 (진짜 닷처럼), 텍스트는 기존 로직 사용
                                if (isRootNode) {
                                    fillColor = isLightMode ? '#3B82F6' : '#60A5FA';
                                    strokeColor = isLightMode ? '#3B82F6' : '#60A5FA'; // 테두리와 안쪽 색상 같게
                                } else if (isMemoNode) {
                                    fillColor = isLightMode ? '#10B981' : '#34D399';
                                    strokeColor = isLightMode ? '#10B981' : '#34D399'; // 테두리와 안쪽 색상 같게
                                } else {
                                    fillColor = isLightMode ? '#6B7280' : '#9CA3AF';
                                    strokeColor = isLightMode ? '#6B7280' : '#9CA3AF'; // 테두리와 안쪽 색상 같게
                                }

                                // 텍스트 색상은 기존 로직 사용 (읽기 쉽게)
                                if (isRootNode) {
                                    textColor = isLightMode ? '#78350F' : '#FDE68A';
                                } else if (isMemoNode) {
                                    textColor = isLightMode ? '#111827' : '#E5E7EB';
                                } else if (isLightMode) {
                                    textColor = isEvenDepth ? '#FFFFFF' : '#1F2937';
                                } else {
                                    textColor = isEvenDepth ? '#000000' : '#FFFFFF';
                                }
                            } else {
                                // 다른 모양들: 기존 색상 로직
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
                            }

                            const opacity = isBeingDragged ? 1 : (isOtherNodeDragging ? 0.25 : 0.95);
                            const baseStrokeWidth = isRootNode ? 0.9 : 0.5;
                            const strokeWidth = isSelected ? baseStrokeWidth + 0.25 : baseStrokeWidth;

                            const hoverText = isHovered ? extractNodeHoverText(datum) : '';
                            const hoverLines = isHovered ? computeHoverLines(hoverText) : [];
                            const { width: tooltipWidth, height: tooltipHeight } = computeTooltipDimensions(hoverLines);
                            const scaledTooltipWidth = tooltipWidth * sizeScale;
                            const scaledTooltipHeight = tooltipHeight * sizeScale;
                            const tooltipTranslateX = -scaledTooltipWidth / 2;
                            const tooltipTranslateY = nodeShape === NODE_SHAPES.DOT
                                ? -(nodeHeight / 2 + scaledFontSize + scaledTooltipHeight + 8) // 닷 모양일 때는 글자 위에 툴팁 (거리 좁힘)
                                : -(nodeHeight / 2 + scaledTooltipHeight + 12); // 다른 모양일 때는 노드 위에 툴팁
                            const tooltipLineHeight = 18 * sizeScale;

                            return (
                                <g
                                    key={nodeId}
                                    transform={`translate(${node.x || 0}, ${node.y || 0})`}
                                    style={{
                                        cursor: isBeingDragged ? 'grabbing' : (isOtherNodeDragging ? 'default' : (nodeShape === NODE_SHAPES.DOT ? 'default' : 'grab')),
                                        pointerEvents: isOtherNodeDragging ? 'none' : (nodeShape === NODE_SHAPES.DOT ? 'none' : 'auto'),
                                    }}
                                    onPointerDown={nodeShape === NODE_SHAPES.DOT ? undefined : (event) => {
                                        if (isOtherNodeDragging) return;
                                        setHoveredNodeId(null);
                                        handleDragStart(event, node);
                                    }}
                                    onClick={nodeShape === NODE_SHAPES.DOT ? undefined : (event) => {
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
                                    {/* 노드 모양별 렌더링 */}
                                    {nodeShape === NODE_SHAPES.DOT ? (
                                        <motion.circle
                                            cx={0}
                                            cy={0}
                                            r={nodeWidth / 2}
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={strokeWidth}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: isBeingDragged ? 1.02 : 1, opacity }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                        />
                                    ) : nodeShape === NODE_SHAPES.ELLIPSE ? (
                                        <motion.ellipse
                                            cx={0}
                                            cy={0}
                                            rx={nodeWidth / 2}
                                            ry={nodeHeight / 2}
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={strokeWidth}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: isBeingDragged ? 1.02 : 1, opacity }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                        />
                                    ) : nodeShape === NODE_SHAPES.DIAMOND ? (
                                        <motion.polygon
                                            points={`0,${-nodeHeight / 2} ${nodeWidth / 2},0 0,${nodeHeight / 2} ${-nodeWidth / 2},0`}
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={strokeWidth}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: isBeingDragged ? 1.02 : 1, opacity }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                        />
                                    ) : (
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
                                    )}

                                    {/* 노드 내부에 이름 표시 */}
                                    {labelText && (
                                        <motion.text
                                            textAnchor="middle"
                                            dominantBaseline={nodeShape === NODE_SHAPES.DOT ? "auto" : "middle"}
                                            fill={textColor}
                                            fontSize={scaledFontSize}
                                            fontWeight={isRootNode ? 700 : 600}
                                            pointerEvents={nodeShape === NODE_SHAPES.DOT ? "auto" : "none"}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.2 }}
                                            style={{
                                                textShadow: 'none',
                                                textRendering: 'geometricPrecision',
                                                paintOrder: 'stroke fill',
                                                letterSpacing: isMemoStyledNode ? '0.25px' : '0.2px',
                                            }}
                                        >
                                            {labelText}
                                        </motion.text>
                                    )}

                                    {/* 선택 효과 - 단일 선택 */}
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
                                            strokeWidth={0.5}
                                            strokeOpacity={0.5}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                        />
                                    )}

                                    {/* 선택 효과 - 멀티 선택 (단일 선택 아닌 경우 표시) */}
                                    {!isSelected && isMultiSelected && (
                                        <motion.rect
                                            x={-(nodeWidth / 2 + 3)}
                                            y={-(nodeHeight / 2 + 3)}
                                            width={nodeWidth + 6}
                                            height={nodeHeight + 6}
                                            rx={4}
                                            ry={4}
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
            <ForceTreeContextMenu controller={controller} theme={theme} />
            <ForceTreeAssistantOverlay controller={controller} />
        </div>
    );
};

export default ForceDirectedTree;
