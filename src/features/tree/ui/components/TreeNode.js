import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import NodeAssistantPanel, { PANEL_SIZES } from './NodeAssistantPanel';
import { createTreeNodeSummary, isTreeRootNode } from 'features/tree/services/TreeSummaryService';
import { useSmartPositioning } from 'shared/hooks/useSmartPositioning';

const selectPanelSize = (conversation, scaleFactor = 1) => {
  const scaledSizes = {
    compact: {
      width: PANEL_SIZES.compact.width * scaleFactor,
      height: PANEL_SIZES.compact.height * scaleFactor
    },
    expanded: {
      width: PANEL_SIZES.expanded.width * scaleFactor,
      height: PANEL_SIZES.expanded.height * scaleFactor
    }
  };

  if (!Array.isArray(conversation)) {
    return scaledSizes.compact;
  }

  const hasAssistantReply = conversation.some((message) => message.role === 'assistant');
  return hasAssistantReply ? scaledSizes.expanded : scaledSizes.compact;
};

const TreeNode = ({
  node,
  position,
  color,
  onDrag,
  onNodeClick,
  isExpanded,
  onSecondQuestion,
  onPlaceholderCreate,
  questionService,
  initialConversation = [],
  onConversationChange = () => { },
  onRequestAnswer,
  onAnswerComplete,
  onAnswerError,
  onRemoveNode,
  hasChildren = false,
  isCollapsed = false,
  onToggleCollapse,
  viewTransform = { x: 0, y: 0, k: 1 },
  overlayElement = null,
  onCloseNode = () => { },
  onPanZoomGesture,
  nodeScaleFactor = 1,
  layoutOrientation = 'vertical',
  // 카드 UI를 최소 형태로 표시할지 여부
  isMinimalCard = false,
  // 노드 네비게이션을 위한 새로운 props
  treeNodes = [],
  treeLinks = [],
  onNodeSelect = () => { },
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Reset hover state when node is no longer expanded
  useEffect(() => {
    if (!isExpanded) {
      setIsHovered(false);
    }
  }, [isExpanded]);

  const wrapText = (text, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = [];
    let currentWidth = 0;

    words.forEach(word => {
      const wordWidth = word.length * 7; // Slightly larger for horizontal layout
      if (currentWidth + wordWidth < maxWidth && currentLine.length < 10) {
        currentLine.push(word);
        currentWidth += wordWidth + 7;
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' '));
          currentLine = [word];
          currentWidth = wordWidth;
        }
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    return lines.slice(0, 3); // Fewer lines for horizontal layout
  };

  // Create hover text: for question nodes, show full question; otherwise concise (<= 4 words)
  const summarizeForHover = (currentNode) => {
    const limitWords = (text, maxWords = 4) =>
      (text || '')
        .toString()
        .trim()
        .split(/\s+/)
        .slice(0, maxWords)
        .join(' ');

    // If node has questionData, prefer full question on hover
    if (currentNode.questionData && typeof currentNode.questionData.question === 'string') {
      const q = currentNode.questionData.question.trim();
      if (q) return q;
    }

    if (currentNode.keyword && currentNode.keyword.trim()) {
      return limitWords(currentNode.keyword, 4);
    }

    if (currentNode.fullText && currentNode.fullText.trim()) {
      const stopwords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'be', 'as', 'by', 'at', 'from', 'that', 'this', 'it'
      ]);
      const tokens = currentNode.fullText
        .replace(/[.,\/#!$%^&*;:{}=_`~()\[\]\-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      const pruned = tokens.filter((t) => !stopwords.has(t.toLowerCase()) && t.length > 1);
      const candidate = limitWords(pruned.join(' '), 4);
      return candidate || limitWords(tokens.join(' '), 4);
    }

    return limitWords(currentNode.id || '', 4);
  };

  // Calculate dimensions to fit text properly - apply nodeScaleFactor consistently
  const keywordText = node.keyword || node.id;
  const hoverText = summarizeForHover(node);

  // 텍스트 너비를 정확하게 계산하는 함수
  const calculateTextWidth = (text, fontSize) => {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      // 한글, 중문, 일문 등은 폰트 크기와 동일한 너비
      // 영문, 숫자, 기호는 폰트 크기의 약 50-60%
      if (/[\u3131-\u3163\uAC00-\uD7AF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(char)) {
        totalWidth += fontSize; // 한글, 중문, 일문
      } else {
        totalWidth += fontSize * 0.6; // 영문, 숫자, 기호
      }
    }
    return totalWidth;
  };

  // 폰트 크기와 문자 간격을 고려한 정확한 계산
  const fontSize = 14 * nodeScaleFactor;
  const basePadding = 20 * nodeScaleFactor; // 기본 패딩
  const hoverPadding = 24 * nodeScaleFactor; // 호버 상태 패딩
  const minWidth = 54 * nodeScaleFactor; // 최소 너비

  // 텍스트가 너무 길면 잘라내는 함수
  const truncateText = (text, maxWidth, fontSize) => {
    if (calculateTextWidth(text, fontSize) <= maxWidth) {
      return text;
    }

    // 최대 너비에서 "..." 3글자 분량을 뺀 공간에 맞춰 텍스트 자르기
    const ellipsisWidth = calculateTextWidth("...", fontSize);
    const availableWidth = maxWidth - ellipsisWidth;

    let truncated = '';
    for (let i = 0; i < text.length; i++) {
      const testText = truncated + text[i];
      if (calculateTextWidth(testText, fontSize) > availableWidth) {
        break;
      }
      truncated = testText;
    }
    return truncated + "...";
  };

  // 기본 노드 크기 계산 (최대 너비 제한)
  const maxBaseWidth = 200 * nodeScaleFactor; // 최대 기본 너비
  const maxHoverWidth = 300 * nodeScaleFactor; // 최대 호버 너비

  const keywordTextWidth = calculateTextWidth(keywordText, fontSize);
  const hoverTextWidth = calculateTextWidth(hoverText, fontSize);

  const idealBaseWidth = Math.max(minWidth, keywordTextWidth + basePadding);
  const idealHoverWidth = Math.max(minWidth, hoverTextWidth + hoverPadding);

  const baseWidth = Math.min(idealBaseWidth, maxBaseWidth);
  const baseHeight = 30 * nodeScaleFactor;
  const computedHoverWidth = Math.min(idealHoverWidth, maxHoverWidth);
  const hoverWidth = Math.max(Math.ceil(baseWidth * 1.35), computedHoverWidth);
  // Only expand horizontally on hover; keep height unchanged
  const hoverHeight = baseHeight;

  // 텍스트 크기에 맞춰 실제 표시할 텍스트 계산
  const maxKeywordWidth = baseWidth - basePadding;
  const maxHoverTextWidth = hoverWidth - hoverPadding;
  const displayKeywordText = truncateText(keywordText, maxKeywordWidth, fontSize);
  const displayHoverText = truncateText(hoverText, maxHoverTextWidth, fontSize);
  const [chatSize, setChatSize] = useState(() => selectPanelSize(initialConversation, nodeScaleFactor));
  const borderRadius = 8 * nodeScaleFactor; // Subtle rounded corners scaled by window size

  // Determine current display mode
  const displayMode = isExpanded ? 'chat' : (isHovered ? 'hover' : 'normal');

  // Calculate current dimensions
  const currentWidth = displayMode === 'chat' ? chatSize.width : displayMode === 'hover' ? hoverWidth : baseWidth;
  const currentHeight = displayMode === 'chat' ? chatSize.height : displayMode === 'hover' ? hoverHeight : baseHeight;
  const rectFill = displayMode === 'chat'
    ? 'rgba(0, 0, 0, 0.85)' // 더 진한 색상으로 변경
    : 'rgba(0, 0, 0, 0.22)';
  const rectStroke = displayMode === 'chat'
    ? 'rgba(255, 255, 255, 0.6)' // 더 진한 테두리로 변경
    : 'rgba(255, 255, 255, 0.18)';
  const rectStrokeWidth = displayMode === 'chat' ? 2 : 1;

  // Hover delete icon sizing (scaled to 80% and by nodeScaleFactor)
  const deleteIconScale = 0.8 * nodeScaleFactor;
  const deleteIconRadius = 10 * deleteIconScale;
  const deleteIconFontSize = 12 * deleteIconScale;
  const deleteIconStrokeWidth = 1.5 * deleteIconScale;

  // Prevent rapid double toggles to avoid race with layout animation
  const lastToggleTsRef = useRef(0);
  const handleTogglePointer = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    if (typeof onToggleCollapse !== 'function') return;
    const now = Date.now();
    if (now - lastToggleTsRef.current < 250) return; // debounce
    lastToggleTsRef.current = now;
    onToggleCollapse(node.id);
  }, [onToggleCollapse, node.id]);

  useEffect(() => {
    if (!isExpanded || !onNodeClick) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onNodeClick({ type: 'dismiss' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, onNodeClick]);

  useEffect(() => {
    const preferredSize = selectPanelSize(initialConversation, nodeScaleFactor);
    setChatSize((current) => (current === preferredSize ? current : preferredSize));
  }, [initialConversation, isExpanded, nodeScaleFactor]);

  const handlePanelSizeChange = useCallback((size) => {
    setChatSize(size);
  }, []);

  const memoizedSummary = useMemo(() => createTreeNodeSummary(node), [node]);
  const memoizedIsRoot = useMemo(() => isTreeRootNode(node), [node]);
  const nodePosition = position || { x: 0, y: 0 };

  const normalizedTransform = useMemo(() => {
    if (!viewTransform || typeof viewTransform !== 'object') {
      return { x: 0, y: 0, k: 1 };
    }
    const { x = 0, y = 0, k = 1 } = viewTransform;
    return { x, y, k: Number.isFinite(k) && k > 0 ? k : 1 };
  }, [viewTransform]);

  const shouldUsePortal = displayMode === 'chat' && overlayElement;

  const handleAssistantPanelClose = useCallback(() => {
    if (typeof onCloseNode === 'function') {
      onCloseNode();
    }
    if (typeof onNodeClick === 'function') {
      onNodeClick({ type: 'dismiss' });
    }
  }, [onCloseNode, onNodeClick]);

  // Use smart positioning for the panel
  const { position: smartPosition, adjustedSize, isPositioned } = useSmartPositioning(
    nodePosition,
    { width: currentWidth, height: currentHeight },
    normalizedTransform,
    overlayElement ? { current: overlayElement } : null
  );

  const portalContent = useMemo(() => {
    if (!shouldUsePortal || !isPositioned) return null;

    return createPortal(
      <motion.div
        initial={{ opacity: 0, scale: 0.1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex h-full w-full"
        style={{
          position: 'absolute',
          left: `${smartPosition.x}px`,
          top: `${smartPosition.y}px`,
          width: `${adjustedSize.width}px`,
          height: `${adjustedSize.height}px`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
          zIndex: 1010,
          willChange: 'transform',
        }}
        data-interactive-zone="true"
        data-node-id={node.id}
      >
        <div
          className="flex h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pointerEvents: 'auto',
            position: 'relative',
            zIndex: 1000,
          }}
          data-interactive-zone="true"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <NodeAssistantPanel
            node={node}
            color={color}
            onSizeChange={handlePanelSizeChange}
            onSecondQuestion={onSecondQuestion}
            onPlaceholderCreate={onPlaceholderCreate}
            questionService={questionService}
            initialConversation={initialConversation}
            onConversationChange={onConversationChange}
            nodeSummary={memoizedSummary}
            isRootNode={memoizedIsRoot}
            onRequestAnswer={onRequestAnswer}
            onAnswerComplete={onAnswerComplete}
            onAnswerError={onAnswerError}
            onCloseNode={handleAssistantPanelClose}
            onPanZoomGesture={onPanZoomGesture}
            nodeScaleFactor={nodeScaleFactor}
            treeNodes={treeNodes}
            treeLinks={treeLinks}
            onNodeSelect={onNodeSelect}
            disableNavigation={node?.nodeType === 'memo'}
          />
        </div>
      </motion.div>,
      overlayElement,
    );
  }, [shouldUsePortal, isPositioned, overlayElement, smartPosition, adjustedSize, node, color, handlePanelSizeChange, onSecondQuestion, onPlaceholderCreate, questionService, initialConversation, onConversationChange, memoizedSummary, memoizedIsRoot, onRequestAnswer, onAnswerComplete, onAnswerError, treeNodes, treeLinks, onNodeSelect]);

  return (
    <>
      <g
        transform={`translate(${nodePosition.x || 0}, ${nodePosition.y || 0})`}
        style={{
          cursor: isExpanded ? 'default' : 'pointer',
          pointerEvents: 'auto',
          zIndex: isExpanded ? 9999 : 1002, // 확장된 노드는 최상위
          isolation: 'isolate' // 새로운 stacking context 생성
        }}
        data-interactive-zone="true"
        data-node-id={node.id}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (isExpanded) {
            return;
          }
          onNodeClick && onNodeClick(node);
        }}
      >
        {/* Hide background rectangle when node is expanded (chat mode) */}
        {displayMode !== 'chat' && !isMinimalCard && (
          <g>
            {/* Neumorphism shadow effects - scaled for small nodes */}
            {/* Dark shadow (bottom right) */}
            <motion.rect
              width={currentWidth}
              height={currentHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="#bebebe"
              style={{
                filter: 'blur(3px)',
                opacity: 0.6,
              }}
              animate={{
                x: -currentWidth / 2 + 3,
                y: -currentHeight / 2 + 23,
                width: currentWidth,
                height: currentHeight,
              }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 24,
                duration: 0.25,
              }}
            />

            {/* Light shadow (top left) */}
            <motion.rect
              width={currentWidth}
              height={currentHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="#ffffff"
              style={{
                filter: 'blur(3px)',
                opacity: 0.8,
              }}
              animate={{
                x: -currentWidth / 2 - 3,
                y: -currentHeight / 2 + 17,
                width: currentWidth,
                height: currentHeight,
              }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 24,
                duration: 0.25,
              }}
            />

            {/* Main neumorphism card */}
            <motion.rect
              width={currentWidth}
              height={currentHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="#e0e0e0"
              style={{
                cursor: 'pointer',
                mixBlendMode: 'normal',
                pointerEvents: 'auto',
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (isExpanded) {
                  return;
                }
                onNodeClick && onNodeClick(node);
              }}
              animate={{
                x: -currentWidth / 2,
                y: -currentHeight / 2 + 20,
                width: currentWidth,
                height: currentHeight,
              }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 24,
                duration: 0.25,
              }}
            />
          </g>
        )}

        {isMinimalCard && displayMode !== 'chat' && (
          <motion.circle
            r={Math.max(18, 22 * nodeScaleFactor)}
            fill="rgba(0, 0, 0, 0)"
            stroke="rgba(0, 0, 0, 0)"
            style={{ pointerEvents: 'auto' }}
          />
        )}

        {displayMode === 'chat' ? (
          shouldUsePortal ? null : (
            <foreignObject
              x={-currentWidth / 2}
              y={-currentHeight / 2}
              width={currentWidth}
              height={currentHeight}
              style={{
                overflow: 'hidden',
                position: 'relative',
                pointerEvents: 'auto',
                zIndex: 1000
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'auto',
                  position: 'relative',
                  zIndex: 1000
                }}
                data-interactive-zone="true"
                onClick={(e) => {
                  // foreignObject 내부 클릭 이벤트가 제대로 전파되도록 함
                  e.stopPropagation();
                }}
              >
                <NodeAssistantPanel
                  node={node}
                  color={color}
                  onSizeChange={handlePanelSizeChange}
                  onSecondQuestion={onSecondQuestion}
                  onPlaceholderCreate={onPlaceholderCreate}
                  questionService={questionService}
                  initialConversation={initialConversation}
                  onConversationChange={onConversationChange}
                  nodeSummary={memoizedSummary}
                  isRootNode={memoizedIsRoot}
                  onRequestAnswer={onRequestAnswer}
                  onAnswerComplete={onAnswerComplete}
                  onAnswerError={onAnswerError}
                  onCloseNode={handleAssistantPanelClose}
                  onPanZoomGesture={onPanZoomGesture}
                  nodeScaleFactor={nodeScaleFactor}
                />
              </div>
            </foreignObject>
          )
        ) : (
          !isMinimalCard && (
            <motion.text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontFamily="Arial, sans-serif"
              fontWeight="bold"
              fill="#666666"
              style={{ pointerEvents: 'none' }}
              transition={{ duration: 0.15 }}
              y={20 * nodeScaleFactor}
            >
              {displayMode === 'hover' ? displayHoverText : displayKeywordText}
            </motion.text>
          )
        )}

        {isHovered && !isExpanded && typeof onRemoveNode === 'function' && (
          <g
            transform={`translate(${currentWidth / 2 - 12}, 0)`}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveNode(node.id);
            }}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <circle
              r={deleteIconRadius}
              fill="rgba(239, 68, 68, 0.95)"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth={deleteIconStrokeWidth}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="Arial, sans-serif"
              fontSize={deleteIconFontSize}
              fontWeight="bold"
              fill="#000"
            >
              ×
            </text>
            <title>노드 제거</title>
          </g>
        )}

        {/* Subtree collapse/expand toggle */}
        {hasChildren && !isExpanded && typeof onToggleCollapse === 'function' && (
          <g
            transform={
              layoutOrientation === 'horizontal'
                ? `translate(${currentWidth / 2 + 35 * nodeScaleFactor}, 0)`
                : `translate(0, ${currentHeight / 2 + 35 * nodeScaleFactor})`
            }
            onClick={handleTogglePointer}
            onMouseDown={handleTogglePointer}
            onPointerDown={handleTogglePointer}
            onTouchStart={handleTogglePointer}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            role="button"
            aria-label={isCollapsed ? '하위 노드 펼치기' : '하위 노드 접기'}
            data-node-toggle="true"
          >
            <rect
              x={-10 * nodeScaleFactor}
              y={-10 * nodeScaleFactor}
              width={20 * nodeScaleFactor}
              height={20 * nodeScaleFactor}
              rx={4 * nodeScaleFactor}
              ry={4 * nodeScaleFactor}
              fill="rgba(0, 0, 0, 0.3)"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={1 * nodeScaleFactor}
              data-node-toggle="true"
            />
            {/* Icon: horizontal 모드에서는 chevron을 오른쪽(>)으로, vertical에서는 아래(v)로 */}
            {layoutOrientation === 'horizontal' ? (
              // 오른쪽 모드: > 또는 < 모양
              isCollapsed ? (
                <path
                  d={`M ${-1 * nodeScaleFactor} ${-4 * nodeScaleFactor} L ${3 * nodeScaleFactor} 0 L ${-1 * nodeScaleFactor} ${4 * nodeScaleFactor}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2 * nodeScaleFactor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  data-node-toggle="true"
                />
              ) : (
                <path
                  d={`M ${1 * nodeScaleFactor} ${-4 * nodeScaleFactor} L ${-3 * nodeScaleFactor} 0 L ${1 * nodeScaleFactor} ${4 * nodeScaleFactor}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2 * nodeScaleFactor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  data-node-toggle="true"
                />
              )
            ) : (
              // 아래로 모드: v 또는 ^ 모양
              isCollapsed ? (
                <path
                  d={`M ${-4 * nodeScaleFactor} ${-1 * nodeScaleFactor} L 0 ${3 * nodeScaleFactor} L ${4 * nodeScaleFactor} ${-1 * nodeScaleFactor}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2 * nodeScaleFactor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  data-node-toggle="true"
                />
              ) : (
                <path
                  d={`M ${-4 * nodeScaleFactor} ${1 * nodeScaleFactor} L 0 ${-3 * nodeScaleFactor} L ${4 * nodeScaleFactor} ${1 * nodeScaleFactor}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2 * nodeScaleFactor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  data-node-toggle="true"
                />
              )
            )}
            <title>{isCollapsed ? "하위 노드 펼치기" : "하위 노드 접기"}</title>
          </g>
        )}
      </g>
      {portalContent}
    </>
  );
};

export default TreeNode;
