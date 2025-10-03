import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../library/ThemeProvider';

/**
 * MemoEditor Component
 * 
 * 노션 스타일의 풀스크린 메모 에디터
 * - 제목과 내용을 분리하여 편집
 * - 화면 전체를 차지하는 모달 형태
 * - 테마별 색상 적용
 */
const MemoEditor = ({
    memo,
    isVisible = false,
    onClose,
    onUpdate,
    onDelete,
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const { theme } = useTheme();
    const titleRef = useRef(null);
    const contentRef = useRef(null);
    const debounceRef = useRef(null);

    // 메모 데이터 초기화
    useEffect(() => {
        if (memo && isVisible) {
            setTitle(memo.memo?.title || memo.keyword || '제목 없음');
            setContent(memo.memo?.content || '');
        }
    }, [memo, isVisible]);

    // 자동 저장 (디바운싱)
    useEffect(() => {
        if (!memo || !isVisible) return;

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            if (typeof onUpdate === 'function') {
                onUpdate({
                    id: memo.id,
                    memo: {
                        title: title.trim(),
                        content: content.trim(),
                    },
                });
            }
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [title, content, memo, isVisible, onUpdate]);

    // 키보드 단축키 처리
    useEffect(() => {
        if (!isVisible) return;

        const handleKeyDown = (event) => {
            // ESC: 에디터 닫기
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
            // Cmd/Ctrl + S: 저장 (기본 동작 차단)
            else if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault();
                // 자동 저장이므로 별도 처리 불필요
            }
            // Tab: 제목에서 내용으로 포커스 이동
            else if (event.key === 'Tab' && event.target === titleRef.current) {
                event.preventDefault();
                contentRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, onClose]);

    // 컴포넌트 언마운트 시 정리
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    // 테마별 스타일 설정
    const getThemeStyles = () => {
        switch (theme) {
            case 'light':
                return {
                    background: 'rgba(255, 255, 255, 0.98)',
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    textColor: 'rgba(0, 0, 0, 0.9)',
                    placeholderColor: 'rgba(0, 0, 0, 0.4)',
                    headerBg: 'rgba(248, 250, 252, 0.8)',
                };
            case 'dark':
                return {
                    background: 'rgba(15, 23, 42, 0.98)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    textColor: 'rgba(255, 255, 255, 0.9)',
                    placeholderColor: 'rgba(255, 255, 255, 0.4)',
                    headerBg: 'rgba(30, 41, 59, 0.8)',
                };
            default: // glass
                return {
                    background: 'rgba(255, 255, 255, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    textColor: 'rgba(15, 23, 42, 0.9)',
                    placeholderColor: 'rgba(15, 23, 42, 0.4)',
                    headerBg: 'rgba(248, 250, 252, 0.6)',
                };
        }
    };

    const themeStyles = getThemeStyles();

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex flex-col"
                style={{
                    background: themeStyles.background,
                    backdropFilter: 'blur(20px)',
                }}
            >
                {/* 헤더 */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b"
                    style={{
                        backgroundColor: themeStyles.headerBg,
                        borderColor: themeStyles.borderColor,
                    }}
                >
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold" style={{ color: themeStyles.textColor }}>
                            메모 편집
                        </h1>
                        <span className="text-sm opacity-60" style={{ color: themeStyles.textColor }}>
                            {memo?.keyword || memo?.id || '메모'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {typeof onDelete === 'function' && (
                            <button
                                onClick={onDelete}
                                className="px-3 py-1.5 text-sm rounded-lg transition-colors hover:bg-red-500/10 text-red-600 hover:text-red-700"
                            >
                                삭제
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm rounded-lg transition-colors hover:bg-gray-500/10"
                            style={{ color: themeStyles.textColor }}
                        >
                            닫기
                        </button>
                    </div>
                </div>

                {/* 메인 컨텐츠 */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* 제목 영역 */}
                    <div className="px-6 py-4 border-b" style={{ borderColor: themeStyles.borderColor }}>
                        <input
                            ref={titleRef}
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="제목을 입력하세요..."
                            className="w-full text-2xl font-bold bg-transparent outline-none resize-none"
                            style={{
                                color: themeStyles.textColor,
                            }}
                            onFocus={(e) => {
                                e.target.style.color = themeStyles.textColor;
                            }}
                        />
                        <style jsx>{`
                            input::placeholder {
                                color: ${themeStyles.placeholderColor};
                            }
                        `}</style>
                    </div>

                    {/* 내용 영역 */}
                    <div className="flex-1 px-6 py-4">
                        <textarea
                            ref={contentRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="내용을 입력하세요..."
                            className="w-full h-full bg-transparent outline-none resize-none text-base leading-relaxed"
                            style={{
                                color: themeStyles.textColor,
                            }}
                            onFocus={(e) => {
                                e.target.style.color = themeStyles.textColor;
                            }}
                        />
                        <style jsx>{`
                            textarea::placeholder {
                                color: ${themeStyles.placeholderColor};
                            }
                        `}</style>
                    </div>
                </div>

                {/* 하단 상태바 */}
                <div
                    className="px-6 py-2 border-t text-xs opacity-60"
                    style={{
                        backgroundColor: themeStyles.headerBg,
                        borderColor: themeStyles.borderColor,
                        color: themeStyles.textColor,
                    }}
                >
                    ESC로 닫기 • 자동 저장됨
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default MemoEditor;
