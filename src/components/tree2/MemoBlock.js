import React, { useState } from 'react';
import { motion } from 'framer-motion';
import NodeHoverActions from './NodeHoverActions';

/**
 * MemoBlock Component
 * 
 * Presentation: Force-directed tree의 개별 노드를 메모 카드로 시각화
 */
const MemoBlock = ({
    node,
    position,
    isSelected = false,
    isLeaf = false,
    onDragStart,
    onClick,
    scale = 1,
    isDisabled = false,
    onAddMemo,
    onAddConnection,
    onToggleChildren,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    const nodeData = node.data || {};
    const keyword = nodeData.keyword || node.name || 'Node';
    const fullText = nodeData.fullText || '';
    const preview = fullText.slice(0, 50) + (fullText.length > 50 ? '...' : '');

    // 메모블럭 크기 (모든 노드 동일)
    const blockWidth = 60;
    const blockHeight = 45;

    // 모든 노드 동일한 크기
    const finalWidth = blockWidth;
    const finalHeight = blockHeight;

    const hasChildren = node.children && node.children.length > 0;

    return (
        <>
            <foreignObject
                x={position.x - finalWidth / 2}
                y={position.y - finalHeight / 2}
                width={finalWidth}
                height={finalHeight}
                style={{
                    overflow: 'visible',
                    pointerEvents: isDisabled ? 'none' : 'auto',
                    opacity: isDisabled ? 0.5 : 1,
                }}
            >
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`relative h-full w-full transition-all duration-200 ${isDisabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                        }`}
                    onPointerDown={(e) => {
                        if (isDisabled) return;
                        e.stopPropagation();
                        if (onDragStart) {
                            onDragStart(e, node);
                        }
                    }}
                    onClick={(e) => {
                        if (isDisabled) return;
                        e.stopPropagation();
                        if (onClick) {
                            onClick(node);
                        }
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* 메모 카드 */}
                    <div
                        className={`
            h-full w-full rounded-lg border p-2 transition-all duration-200
            border-white/30 bg-black/50
            ${isSelected
                                ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-400/30'
                                : 'hover:border-white/40 hover:shadow-lg'
                            }
            backdrop-blur-sm
          `}
                        style={{
                            transform: `scale(${scale})`,
                            transformOrigin: 'center',
                        }}
                    >
                        {/* 키워드 */}
                        <div className="mb-0.5 text-[9px] font-bold text-white truncate">
                            {keyword}
                        </div>

                        {/* 미리보기 텍스트 */}
                        {preview && (
                            <div className="text-[7px] leading-tight text-white/60 line-clamp-1">
                                {preview}
                            </div>
                        )}

                        {/* 자식 노드 인디케이터 */}
                        {!isLeaf && (
                            <div className="absolute bottom-0 right-0">
                                <div className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-blue-500/30 text-[6px] text-blue-300">
                                    {node.children?.length || 0}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 선택 시 글로우 효과 */}
                    {isSelected && (
                        <div className="pointer-events-none absolute inset-0 rounded-lg bg-blue-400/10 blur-sm" />
                    )}
                </motion.div>
            </foreignObject>

            {/* 호버 시 액션 버튼들 */}
            <NodeHoverActions
                isVisible={(isHovered || isButtonHovered) && !isDisabled}
                onAddMemo={() => {
                    console.log('메모 추가 클릭:', node.data.id);
                    onAddMemo?.(node);
                }}
                onAddConnection={() => {
                    console.log('연결선 추가 클릭:', node.data.id);
                    onAddConnection?.(node);
                }}
                onToggleChildren={() => {
                    console.log('자식 노드 접기/펼치기 클릭:', node.data.id);
                    onToggleChildren?.(node);
                }}
                hasChildren={hasChildren}
                position={position}
                scale={scale}
                onHoverChange={setIsButtonHovered}
            />
        </>
    );
};

export default MemoBlock;

