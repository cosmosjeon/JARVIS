import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * MemoCreationModal Component
 * 
 * Presentation: 메모 생성 모달 컴포넌트
 * Business Logic: 메모 텍스트 입력 및 저장 기능
 */
const MemoCreationModal = ({
    isVisible = false,
    nodePosition = { x: 0, y: 0 },
    nodeKeyword = '',
    onSave,
    onCancel,
    viewTransform = { x: 0, y: 0, k: 1 },
    containerDimensions = { width: 800, height: 600 },
}) => {
    const [memoText, setMemoText] = useState('');
    const textareaRef = useRef(null);
    const modalRef = useRef(null);

    // 모달이 열릴 때 포커스
    useEffect(() => {
        if (isVisible && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isVisible]);

    // ESC 키로 모달 닫기
    useEffect(() => {
        if (!isVisible) return;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, onCancel]);

    // 모달 위치 계산 (노드 근처, 화면 밖으로 나가지 않도록)
    const calculateModalPosition = () => {
        const modalWidth = 280;
        const modalHeight = 120;

        // 노드 위치를 화면 좌표로 변환
        const screenX = nodePosition.x * viewTransform.k + containerDimensions.width / 2 + viewTransform.x;
        const screenY = nodePosition.y * viewTransform.k + containerDimensions.height / 2 + viewTransform.y;

        // 모달 위치 계산 (노드 오른쪽, 화면 경계 고려)
        let modalX = screenX + 80;
        let modalY = screenY - modalHeight / 2;

        // 화면 경계 체크 및 조정
        if (modalX + modalWidth > containerDimensions.width) {
            modalX = screenX - modalWidth - 20; // 노드 왼쪽으로
        }
        if (modalY < 0) {
            modalY = 10;
        }
        if (modalY + modalHeight > containerDimensions.height) {
            modalY = containerDimensions.height - modalHeight - 10;
        }

        return { x: modalX, y: modalY };
    };

    const modalPosition = calculateModalPosition();

    const handleSave = () => {
        if (memoText.trim()) {
            onSave(memoText.trim());
            setMemoText('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSave();
        }
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                ref={modalRef}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed z-50 pointer-events-auto"
                style={{
                    left: modalPosition.x,
                    top: modalPosition.y,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 모달 배경 */}
                <div className="bg-black/80 backdrop-blur-sm border border-yellow-400/40 rounded-lg p-4 shadow-xl shadow-yellow-400/20">
                    {/* 헤더 */}
                    <div className="mb-3">
                        <h3 className="text-sm font-semibold text-yellow-200">
                            메모 추가
                        </h3>
                        <p className="text-xs text-yellow-300/70">
                            {nodeKeyword ? `노드: ${nodeKeyword}` : '새 메모'}
                        </p>
                    </div>

                    {/* 텍스트 입력 */}
                    <textarea
                        ref={textareaRef}
                        value={memoText}
                        onChange={(e) => setMemoText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메모 내용을 입력하세요..."
                        className="w-full h-16 bg-black/30 border border-yellow-400/30 rounded px-3 py-2 text-sm text-yellow-100 placeholder-yellow-300/50 resize-none outline-none focus:border-yellow-400/60 focus:ring-1 focus:ring-yellow-400/30"
                        maxLength={200}
                    />

                    {/* 글자 수 표시 */}
                    <div className="text-xs text-yellow-300/50 mt-1 text-right">
                        {memoText.length}/200
                    </div>

                    {/* 버튼들 */}
                    <div className="flex gap-2 mt-3 justify-end">
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 text-xs bg-gray-600/50 hover:bg-gray-600/70 text-gray-200 rounded border border-gray-500/50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!memoText.trim()}
                            className="px-3 py-1.5 text-xs bg-yellow-600/50 hover:bg-yellow-600/70 disabled:bg-gray-600/30 disabled:text-gray-400 text-yellow-100 rounded border border-yellow-500/50 transition-colors disabled:cursor-not-allowed"
                        >
                            저장 (Ctrl+Enter)
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default MemoCreationModal;
