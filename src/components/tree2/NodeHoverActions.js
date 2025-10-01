import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * NodeHoverActions Component
 * 
 * Presentation: 노드 호버 시 나타나는 액션 버튼들
 * Business Logic: 각 버튼의 클릭 이벤트를 부모 컴포넌트로 전달
 */
const NodeHoverActions = ({
    isVisible = false,
    onAddMemo,
    onAddConnection,
    onToggleChildren,
    hasChildren = false,
    position = { x: 0, y: 0 },
    scale = 1,
    onHoverChange,
}) => {
    const [hoveredButton, setHoveredButton] = useState(null);

    const buttonSize = 20;
    const spacing = 6;

    // 버튼 위치 계산 (노드 우측에 수직으로 배치)
    const baseX = position.x + 52;
    const baseY = position.y - (buttonSize + spacing);

    const buttons = [
        {
            id: 'add-memo',
            icon: '+',
            onClick: onAddMemo,
        },
        {
            id: 'add-connection',
            icon: '⟷',
            onClick: onAddConnection,
        },
        {
            id: 'toggle-children',
            icon: hasChildren ? '−' : '+',
            onClick: onToggleChildren,
            disabled: !hasChildren,
        },
    ];

    if (!isVisible) return null;

    return (
        <g
            onMouseEnter={() => onHoverChange?.(true)}
            onMouseLeave={() => onHoverChange?.(false)}
        >
            {/* 노드와 버튼 사이 연결 영역 (보이지 않음, 호버만 감지) */}
            <rect
                x={position.x + 30}
                y={baseY - buttonSize / 2}
                width={25}
                height={(buttonSize + spacing) * 3}
                fill="transparent"
                style={{ pointerEvents: 'auto' }}
            />

            {buttons.map((button, index) => {
                const y = baseY + (buttonSize + spacing) * index;
                const isHovered = hoveredButton === button.id;

                return (
                    <g key={button.id}>
                        {/* 버튼 배경 (글래스모피즘) */}
                        <motion.rect
                            x={baseX - buttonSize / 2}
                            y={y - buttonSize / 2}
                            width={buttonSize}
                            height={buttonSize}
                            rx={4}
                            fill={button.disabled ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.4)'}
                            stroke={button.disabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}
                            strokeWidth={1}
                            className={button.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{
                                scale: 1,
                                opacity: 1,
                                fill: isHovered && !button.disabled
                                    ? 'rgba(255, 255, 255, 0.15)'
                                    : button.disabled
                                        ? 'rgba(0, 0, 0, 0.3)'
                                        : 'rgba(0, 0, 0, 0.4)',
                                stroke: isHovered && !button.disabled
                                    ? 'rgba(255, 255, 255, 0.4)'
                                    : button.disabled
                                        ? 'rgba(255, 255, 255, 0.1)'
                                        : 'rgba(255, 255, 255, 0.2)',
                            }}
                            transition={{
                                duration: 0.15,
                                delay: index * 0.03
                            }}
                            whileTap={!button.disabled ? { scale: 0.9 } : {}}
                            onMouseEnter={() => !button.disabled && setHoveredButton(button.id)}
                            onMouseLeave={() => setHoveredButton(null)}
                            onClick={(e) => {
                                if (button.disabled) return;
                                e.stopPropagation();
                                if (button.onClick) {
                                    button.onClick();
                                }
                            }}
                        />

                        {/* 아이콘 */}
                        <text
                            x={baseX}
                            y={y + 5}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="600"
                            className={button.disabled ? 'fill-white/30' : 'fill-white/90'}
                            style={{
                                pointerEvents: 'none',
                                userSelect: 'none',
                            }}
                        >
                            {button.icon}
                        </text>
                    </g>
                );
            })}
        </g>
    );
};

export default NodeHoverActions;