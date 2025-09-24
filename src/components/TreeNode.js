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
  onConversationChange = () => {},
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

  // Calculate dimensions to fit text properly
  const keywordLength = (node.keyword || node.id).length;
  const baseWidth = Math.max(54, keywordLength * 9 + 20);
  const baseHeight = 30;
  const hoverWidth = baseWidth * 1.7;
  const hoverHeight = baseHeight * 1.15;
  const [chatSize, setChatSize] = useState(() => selectPanelSize(initialConversation));
  const borderRadius = 8; // Fixed border radius
  const lines = node.fullText ? wrapText(node.fullText, hoverWidth - 40) : [];

  // Determine current display mode
  const displayMode = isExpanded ? 'chat' : (isHovered && node.fullText ? 'hover' : 'normal');

  // Calculate current dimensions
  const currentWidth = displayMode === 'chat' ? chatSize.width : displayMode === 'hover' ? hoverWidth : baseWidth;
  const currentHeight = displayMode === 'chat' ? chatSize.height : displayMode === 'hover' ? hoverHeight : baseHeight;
  const rectFill = displayMode === 'chat'
    ? 'rgba(15, 23, 42, 0.55)'
    : 'rgba(148, 163, 184, 0.22)';
  const rectStroke = displayMode === 'chat'
    ? 'rgba(255, 255, 255, 0.32)'
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
          mixBlendMode: displayMode === 'chat' ? 'screen' : 'normal',
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
          {displayMode === 'hover' && lines.length
            ? lines.map((line, i) => (
              <tspan
                key={i}
                x={0}
                dy={i === 0 ? -(lines.length - 1) * 9 : 18}
              >
                {line}
              </tspan>
            ))
            : node.keyword || node.id}
        </motion.text>
      )}

      {isExpanded && typeof onRemoveNode === 'function' && (
        <g
          transform={`translate(${currentWidth / 2 - 12}, ${-currentHeight / 2 + 12})`}
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
