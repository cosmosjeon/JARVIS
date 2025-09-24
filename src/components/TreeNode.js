import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import NodeAssistantPanel, { PANEL_SIZES } from './NodeAssistantPanel';

const selectPanelSize = (conversation) => {
  if (!Array.isArray(conversation)) {
    return PANEL_SIZES.compact;
  }

  const hasAssistantReply = conversation.some((message) => message.role === 'assistant');
  return hasAssistantReply ? PANEL_SIZES.expanded : PANEL_SIZES.compact;
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
  onRemoveNode,
}) => {
  const [isHovered, setIsHovered] = useState(false);

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

  // Create concise hover summary (<= 4 words)
  const summarizeForHover = (currentNode) => {
    const limitWords = (text, maxWords = 4) =>
      (text || '')
        .toString()
        .trim()
        .split(/\s+/)
        .slice(0, maxWords)
        .join(' ');

    if (currentNode.keyword && currentNode.keyword.trim()) {
      return limitWords(currentNode.keyword, 4);
    }

    if (currentNode.fullText && currentNode.fullText.trim()) {
      const stopwords = new Set([
        'the','a','an','and','or','but','of','to','in','on','for','with','is','are','was','were','be','as','by','at','from','that','this','it'
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

  // Calculate dimensions to fit text properly
  const keywordLength = (node.keyword || node.id).length;
  const baseWidth = Math.max(54, keywordLength * 9 + 20);
  const baseHeight = 30;
  const hoverText = summarizeForHover(node);
  const charUnit = 9;
  const sidePadding = 24;
  const computedHoverWidth = Math.max(54, hoverText.length * charUnit + sidePadding);
  const hoverWidth = Math.max(baseWidth, computedHoverWidth);
  const hoverHeight = Math.max(baseHeight, 34);
  const [chatSize, setChatSize] = useState(() => selectPanelSize(initialConversation));
  const borderRadius = 8; // Fixed border radius

  // Determine current display mode
  const displayMode = isExpanded ? 'chat' : (isHovered ? 'hover' : 'normal');

  // Calculate current dimensions
  const currentWidth = displayMode === 'chat' ? chatSize.width : displayMode === 'hover' ? hoverWidth : baseWidth;
  const currentHeight = displayMode === 'chat' ? chatSize.height : displayMode === 'hover' ? hoverHeight : baseHeight;
  const rectFill = displayMode === 'chat'
    ? 'rgba(15, 23, 42, 0.85)' // 더 진한 색상으로 변경
    : 'rgba(148, 163, 184, 0.22)';
  const rectStroke = displayMode === 'chat'
    ? 'rgba(255, 255, 255, 0.6)' // 더 진한 테두리로 변경
    : 'rgba(255, 255, 255, 0.18)';
  const rectStrokeWidth = displayMode === 'chat' ? 2 : 1;

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
    const preferredSize = selectPanelSize(initialConversation);
    setChatSize((current) => (current === preferredSize ? current : preferredSize));
  }, [initialConversation, isExpanded]);

  const handlePanelSizeChange = useCallback((size) => {
    setChatSize(size);
  }, []);

  return (
    <g
      transform={`translate(${position.x || 0}, ${position.y || 0})`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        // 확장된 노드에서는 클릭 이벤트를 처리하지 않음 (NodeAssistantPanel이 처리)
        if (isExpanded) {
          return;
        }
        e.stopPropagation();
        onNodeClick && onNodeClick(node);
      }}
      style={{ cursor: isExpanded ? 'default' : 'pointer' }}
    >
      <motion.rect
        width={currentWidth}
        height={currentHeight}
        rx={borderRadius}
        ry={borderRadius}
        fill={rectFill}
        stroke={rectStroke}
        strokeWidth={rectStrokeWidth}
        style={{
          cursor: 'pointer',
          mixBlendMode: 'normal', // 모든 노드에 normal 적용
          filter: displayMode === 'chat'
            ? 'drop-shadow(0 18px 42px rgba(15, 23, 42, 0.48))'
            : 'drop-shadow(0 8px 24px rgba(15, 23, 42, 0.32))',
        }}
        animate={{
          x: -currentWidth / 2,
          y: -currentHeight / 2,
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

      {displayMode === 'chat' ? (
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
            />
          </div>
        </foreignObject>
      ) : (
        <motion.text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={displayMode === 'hover' ? 12 : 12}
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          fill="#fff"
          style={{ pointerEvents: 'none' }}
          transition={{ duration: 0.15 }}
        >
          {displayMode === 'hover' ? hoverText : (node.keyword || node.id)}
        </motion.text>
      )}

      {isHovered && !isExpanded && typeof onRemoveNode === 'function' && (
        <g
          transform={`translate(${currentWidth / 2 + 12}, 0)`}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveNode(node.id);
          }}
          style={{ cursor: 'pointer' }}
        >
          <circle
            r={10}
            fill="rgba(239, 68, 68, 0.95)"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth={1.5}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Arial, sans-serif"
            fontSize={12}
            fontWeight="bold"
            fill="#fff"
          >
            ×
          </text>
          <title>노드 제거</title>
        </g>
      )}
    </g>
  );
};

export default TreeNode;
