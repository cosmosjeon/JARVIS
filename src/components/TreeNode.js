import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import NodeAssistantPanel, { PANEL_SIZES } from './NodeAssistantPanel';

const TreeNode = ({ node, position, color, onDrag, onNodeClick, isExpanded }) => {
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
  const [chatSize, setChatSize] = useState(PANEL_SIZES.compact);
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
    if (!isExpanded) return;
    setChatSize(PANEL_SIZES.compact);
  }, [isExpanded]);

  const handlePanelSizeChange = useCallback((size) => {
    setChatSize(size);
  }, []);

  return (
    <g
      transform={`translate(${position.x || 0}, ${position.y || 0})`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onNodeClick && onNodeClick(node);
      }}
      style={{ cursor: 'pointer' }}
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
          style={{ overflow: 'hidden', position: 'relative' }}
        >
          <NodeAssistantPanel node={node} color={color} onSizeChange={handlePanelSizeChange} />
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
    </g>
  );
};

export default TreeNode;
