import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * MemoNoteBlock Component
 * 
 * Presentation: 메모 전용 블럭 컴포넌트 (노드보다 작고 다른 색상)
 * Business Logic: 메모 편집, 삭제, 드래그 기능 제공
 */
const MemoNoteBlock = ({
    memo,
    position,
    isSelected = false,
    onDragStart,
    onClick,
    onEdit,
    onDelete,
    scale = 1,
    isDisabled = false,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(memo.content || '');

    // 메모 블럭 크기 (노드보다 20% 작게)
    const blockWidth = 48; // 60 * 0.8
    const blockHeight = 36; // 45 * 0.8

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        setIsEditing(true);
        setEditText(memo.content || '');
    };

    const handleSaveEdit = () => {
        if (onEdit && editText.trim()) {
            onEdit(memo.id, editText.trim());
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditText(memo.content || '');
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(memo.id);
        }
    };

    return (
        <>
            <foreignObject
                x={position.x - blockWidth / 2}
                y={position.y - blockHeight / 2}
                width={blockWidth}
                height={blockHeight}
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
                        if (isDisabled || isEditing) return;
                        e.stopPropagation();
                        if (onDragStart) {
                            onDragStart(e, memo);
                        }
                    }}
                    onClick={(e) => {
                        if (isDisabled) return;
                        e.stopPropagation();
                        if (onClick) {
                            onClick(memo);
                        }
                    }}
                    onDoubleClick={handleDoubleClick}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* 메모 카드 - 노란색 계열 */}
                    <div
                        className={`
                            h-full w-full rounded-lg border p-1.5 transition-all duration-200
                            border-yellow-400/40 bg-yellow-900/30
                            ${isSelected
                                ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/30'
                                : 'hover:border-yellow-400/60 hover:shadow-lg hover:bg-yellow-900/40'
                            }
                            backdrop-blur-sm
                        `}
                        style={{
                            transform: `scale(${scale})`,
                            transformOrigin: 'center',
                        }}
                    >
                        {isEditing ? (
                            /* 편집 모드 */
                            <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleSaveEdit}
                                className="w-full h-full resize-none bg-transparent text-white text-[8px] leading-tight outline-none placeholder-white/50"
                                placeholder="메모를 입력하세요..."
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            /* 표시 모드 */
                            <>
                                {/* 메모 내용 */}
                                <div className="text-[8px] leading-tight text-yellow-100 line-clamp-2">
                                    {memo.content || '메모'}
                                </div>

                                {/* 메모 아이콘 */}
                                <div className="absolute bottom-0.5 right-0.5">
                                    <div className="h-2 w-2 rounded-full bg-yellow-400/60 flex items-center justify-center">
                                        <div className="h-1 w-1 rounded-full bg-yellow-200"></div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 호버 시 삭제 버튼 */}
                    {isHovered && !isEditing && (
                        <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={handleDelete}
                            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white text-[10px] font-bold border border-red-400/50 shadow-lg"
                            style={{ pointerEvents: 'auto' }}
                        >
                            ×
                        </motion.button>
                    )}

                    {/* 선택 시 글로우 효과 */}
                    {isSelected && (
                        <div className="pointer-events-none absolute inset-0 rounded-lg bg-yellow-400/10 blur-sm" />
                    )}
                </motion.div>
            </foreignObject>
        </>
    );
};

export default MemoNoteBlock;
