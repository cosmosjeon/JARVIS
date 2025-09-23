import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import NodeAssistantPanel from './NodeAssistantPanel';

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
  const chatWidth = 300;
  const chatHeight = 340;
  const borderRadius = 8; // Fixed border radius
  const lines = node.fullText ? wrapText(node.fullText, hoverWidth - 40) : [];

  // Determine current display mode
  const displayMode = isExpanded ? 'chat' : (isHovered && node.fullText ? 'hover' : 'normal');

  // Calculate current dimensions
  const currentWidth = displayMode === 'chat' ? chatWidth : displayMode === 'hover' ? hoverWidth : baseWidth;
  const currentHeight = displayMode === 'chat' ? chatHeight : displayMode === 'hover' ? hoverHeight : baseHeight;
  const fillColor = color;
  const rectFill = displayMode === 'chat' ? '#ffffff' : fillColor;
  const rectStroke = displayMode === 'chat' ? color : 'none';
  const rectStrokeWidth = displayMode === 'chat' ? 2 : 0;

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

  return (
    <g
      transform={`translate(${position.x || 0}, ${position.y || 0})`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onNodeClick && onNodeClick(node)}
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
        style={{ cursor: 'pointer' }}
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
          style={{ overflow: 'visible', position: 'relative' }}
        >
          <NodeAssistantPanel node={node} color={color} />
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
