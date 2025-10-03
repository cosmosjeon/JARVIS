import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../library/ThemeProvider';

const BLOCK_TYPES = {
    HEADING1: 'heading1',
    HEADING2: 'heading2',
    HEADING3: 'heading3',
    BULLET: 'bullet',
    PARAGRAPH: 'paragraph',
};

const createBlock = (type = BLOCK_TYPES.PARAGRAPH, text = '') => ({
    id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `block-${Math.random().toString(36).slice(2, 10)}`,
    type,
    text,
});

const detectBlock = (rawLine) => {
    if (!rawLine || typeof rawLine !== 'string') {
        return { type: BLOCK_TYPES.PARAGRAPH, text: '' };
    }

    if (rawLine.startsWith('# ')) {
        return { type: BLOCK_TYPES.HEADING1, text: rawLine.slice(2) };
    }
    if (rawLine.startsWith('## ')) {
        return { type: BLOCK_TYPES.HEADING2, text: rawLine.slice(3) };
    }
    if (rawLine.startsWith('### ')) {
        return { type: BLOCK_TYPES.HEADING3, text: rawLine.slice(4) };
    }
    if (rawLine.startsWith('- ')) {
        return { type: BLOCK_TYPES.BULLET, text: rawLine.slice(2) };
    }

    return { type: BLOCK_TYPES.PARAGRAPH, text: rawLine };
};

const parseContent = (rawContent = '') => {
    if (!rawContent.trim()) {
        return [createBlock()];
    }

    return rawContent.split(/\r?\n/).map((line) => {
        const { type, text } = detectBlock(line);
        return createBlock(type, text);
    });
};

const serializeBlocks = (blocks) => {
    if (!Array.isArray(blocks) || blocks.length === 0) {
        return '';
    }

    return blocks
        .map((block) => {
            switch (block.type) {
                case BLOCK_TYPES.HEADING1:
                    return `# ${block.text}`;
                case BLOCK_TYPES.HEADING2:
                    return `## ${block.text}`;
                case BLOCK_TYPES.HEADING3:
                    return `### ${block.text}`;
                case BLOCK_TYPES.BULLET:
                    return `- ${block.text}`;
                default:
                    return block.text;
            }
        })
        .join('\n');
};

/**
 * MemoEditor Component
 *
 * NodeAssistantPanel과 동일한 오버레이 스타일을 사용하는 메모 편집 패널.
 * - 제목/내용을 분리하여 편집
 * - 테마에 따른 글래스 효과 적용
 * - 자동 저장(디바운스) 및 단축키 지원
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
    const [blocks, setBlocks] = useState(() => parseContent(''));
    const { theme } = useTheme();
    const titleRef = useRef(null);
    const debounceRef = useRef(null);
    const blockRefs = useRef(new Map());
    const editorRef = useRef(null);
    const [slashMenu, setSlashMenu] = useState({ open: false, blockId: null, index: -1, anchor: { top: 0, left: 0 }, activeIndex: 0 });

    const focusBlock = useCallback((blockId, position = 'end') => {
        const node = blockRefs.current.get(blockId);
        if (!node) return;

        node.focus();

        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(position === 'start');
        selection.removeAllRanges();
        selection.addRange(range);
    }, []);

    // 메모 데이터 초기화
    useEffect(() => {
        if (memo && isVisible) {
            const initialTitle = memo.memo?.title || memo.keyword || '제목 없음';
            const initialContent = typeof memo.memo?.content === 'string' ? memo.memo.content : '';
            const initialBlocks = parseContent(initialContent);

            setTitle(initialTitle);
            setBlocks(initialBlocks);
            setContent(serializeBlocks(initialBlocks));
        }
    }, [memo, isVisible]);

    useEffect(() => {
        const serialized = serializeBlocks(blocks);
        setContent((prev) => (prev === serialized ? prev : serialized));
    }, [blocks]);

    const slashOptions = useMemo(() => ([
        {
            id: 'heading1',
            label: '제목 1',
            description: '큰 제목을 추가합니다',
            type: BLOCK_TYPES.HEADING1,
        },
        {
            id: 'heading2',
            label: '제목 2',
            description: '중간 크기의 제목',
            type: BLOCK_TYPES.HEADING2,
        },
        {
            id: 'heading3',
            label: '제목 3',
            description: '작은 제목',
            type: BLOCK_TYPES.HEADING3,
        },
        {
            id: 'bullet',
            label: '글머리 기호 목록',
            description: '항목 목록을 작성합니다',
            type: BLOCK_TYPES.BULLET,
        },
        {
            id: 'text',
            label: '텍스트',
            description: '기본 단락을 입력합니다',
            type: BLOCK_TYPES.PARAGRAPH,
        },
    ]), []);

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

    useEffect(() => () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
    }, []);

    const themeStyles = useMemo(() => {
        switch (theme) {
            case 'dark':
                return {
                    canvas: '#1f1f24',
                    card: 'rgba(255, 255, 255, 0.05)',
                    cardBorder: 'rgba(255, 255, 255, 0.06)',
                    text: 'rgba(248, 250, 252, 0.95)',
                    muted: 'rgba(148, 163, 184, 0.7)',
                    accent: '#38bdf8',
                    iconBg: 'rgba(255, 255, 255, 0.08)',
                    pillBg: 'rgba(148, 163, 184, 0.15)',
                    pillText: 'rgba(226, 232, 240, 0.85)',
                    divider: 'rgba(148, 163, 184, 0.25)',
                };
            case 'light':
            default:
                return {
                    canvas: '#f7f6f3',
                    card: '#ffffff',
                    cardBorder: 'rgba(15, 23, 42, 0.08)',
                    text: 'rgba(15, 23, 42, 0.92)',
                    muted: 'rgba(100, 116, 139, 0.9)',
                    accent: '#2563eb',
                    iconBg: '#ffffff',
                    pillBg: 'rgba(148, 163, 184, 0.16)',
                    pillText: 'rgba(71, 85, 105, 0.85)',
                    divider: 'rgba(148, 163, 184, 0.25)',
                };
        }
    }, [theme]);

    const openSlashMenu = useCallback((blockId, index) => {
        const node = blockRefs.current.get(blockId);
        if (!node || !editorRef.current || slashOptions.length === 0) {
            return;
        }

        const blockRect = node.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();

        setSlashMenu({
            open: true,
            blockId,
            index,
            anchor: {
                top: blockRect.bottom - editorRect.top + 8,
                left: blockRect.left - editorRect.left,
            },
            activeIndex: 0,
        });
    }, [slashOptions.length]);

    const closeSlashMenu = useCallback(() => {
        setSlashMenu({ open: false, blockId: null, index: -1, anchor: { top: 0, left: 0 }, activeIndex: 0 });
    }, []);



    useEffect(() => {
        blocks.forEach((block) => {
            const node = blockRefs.current.get(block.id);
            if (node && node.textContent !== block.text) {
                node.textContent = block.text || '';
            }
        });
    }, [blocks]);

    // 키보드 단축키 처리
    useEffect(() => {
        if (!isVisible) return;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            } else if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault();
            } else if (event.key === 'Tab' && event.target === titleRef.current) {
                event.preventDefault();
                const firstBlock = blocks[0];
                if (firstBlock) {
                    requestAnimationFrame(() => focusBlock(firstBlock.id, 'start'));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [blocks, focusBlock, isVisible, onClose]);

    const setBlockRef = useCallback((block) => (
        (node) => {
            if (node) {
                blockRefs.current.set(block.id, node);
                if (node.textContent !== (block.text || '')) {
                    node.textContent = block.text || '';
                }
            } else {
                blockRefs.current.delete(block.id);
            }
        }
    ), []);

    const getCaretOffset = (element) => {
        const selection = window.getSelection();
        if (!selection || !selection.anchorNode) {
            return (element.textContent || '').length;
        }

        if (!element.contains(selection.anchorNode)) {
            return (element.textContent || '').length;
        }

        return selection.anchorOffset ?? (element.textContent || '').length;
    };

    const updateBlockText = (blockId, index, nextText) => {
        const sanitized = nextText.replace(/\u00a0/g, ' ');
        setBlocks((prev) => {
            const draft = [...prev];
            const targetIndex = index < draft.length && draft[index].id === blockId
                ? index
                : draft.findIndex((item) => item.id === blockId);

            if (targetIndex === -1) {
                return prev;
            }

            draft[targetIndex] = {
                ...draft[targetIndex],
                text: sanitized,
            };
            return draft;
        });

        if (sanitized === '/' && slashOptions.length > 0) {
            requestAnimationFrame(() => openSlashMenu(blockId, index));
        } else if (slashMenu.open && slashMenu.blockId === blockId && sanitized !== '/') {
            closeSlashMenu();
        }
    };

    const convertBlockType = (index, block, nextType) => {
        setBlocks((prev) => {
            const draft = [...prev];
            const targetIndex = draft[index] && draft[index].id === block.id
                ? index
                : draft.findIndex((item) => item.id === block.id);
            if (targetIndex === -1) {
                return prev;
            }
            draft[targetIndex] = { ...draft[targetIndex], type: nextType, text: '' };
            return draft;
        });
        requestAnimationFrame(() => focusBlock(block.id, 'start'));
    };

    const selectSlashOption = useCallback((option, blockId, index) => {
        const target = blocks[index] && blocks[index].id === blockId
            ? blocks[index]
            : blocks.find((item) => item.id === blockId);
        if (!target) {
            closeSlashMenu();
            return;
        }

        switch (option.type) {
            case BLOCK_TYPES.HEADING1:
            case BLOCK_TYPES.HEADING2:
            case BLOCK_TYPES.HEADING3:
            case BLOCK_TYPES.BULLET:
            case BLOCK_TYPES.PARAGRAPH:
                convertBlockType(index, target, option.type);
                break;
            default:
                break;
        }
        closeSlashMenu();
    }, [blocks, closeSlashMenu, convertBlockType]);

    const handleBlockInput = (blockId, index, value) => {
        updateBlockText(blockId, index, value);
    };

    const handleBlockKeyDown = (event, index) => {
        const block = blocks[index];
        if (!block) return;

        const element = blockRefs.current.get(block.id);
        if (!element) return;

        const textContent = element.textContent || '';
        const caretOffset = getCaretOffset(element);

        if (slashMenu.open && slashMenu.blockId === block.id) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSlashMenu((prev) => ({
                    ...prev,
                    activeIndex: (prev.activeIndex + 1) % slashOptions.length,
                }));
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSlashMenu((prev) => ({
                    ...prev,
                    activeIndex: (prev.activeIndex - 1 + slashOptions.length) % slashOptions.length,
                }));
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                const option = slashOptions[slashMenu.activeIndex];
                if (option) {
                    selectSlashOption(option, block.id, index);
                }
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                closeSlashMenu();
                return;
            }
        } else if (slashMenu.open && slashMenu.blockId !== block.id) {
            closeSlashMenu();
        }

        if (event.key === ' ' && caretOffset === textContent.length) {
            if (textContent === '#' && block.type === BLOCK_TYPES.PARAGRAPH) {
                event.preventDefault();
                element.textContent = '';
                convertBlockType(index, block, BLOCK_TYPES.HEADING1);
                return;
            }
            if (textContent === '##' && block.type === BLOCK_TYPES.PARAGRAPH) {
                event.preventDefault();
                element.textContent = '';
                convertBlockType(index, block, BLOCK_TYPES.HEADING2);
                return;
            }
            if (textContent === '###' && block.type === BLOCK_TYPES.PARAGRAPH) {
                event.preventDefault();
                element.textContent = '';
                convertBlockType(index, block, BLOCK_TYPES.HEADING3);
                return;
            }
            if (textContent === '-' && block.type === BLOCK_TYPES.PARAGRAPH) {
                event.preventDefault();
                element.textContent = '';
                convertBlockType(index, block, BLOCK_TYPES.BULLET);
                return;
            }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            const trimmed = textContent.trim();

            if (block.type === BLOCK_TYPES.PARAGRAPH) {
                if (trimmed === '#') {
                    event.preventDefault();
                    element.textContent = '';
                    setBlocks((prev) => {
                        const draft = [...prev];
                        if (draft[index] && draft[index].id === block.id) {
                            draft[index] = { ...draft[index], type: BLOCK_TYPES.HEADING1, text: '' };
                        }
                        return draft;
                    });
                    requestAnimationFrame(() => focusBlock(block.id, 'start'));
                    return;
                }
                if (trimmed === '##') {
                    event.preventDefault();
                    element.textContent = '';
                    setBlocks((prev) => {
                        const draft = [...prev];
                        if (draft[index] && draft[index].id === block.id) {
                            draft[index] = { ...draft[index], type: BLOCK_TYPES.HEADING2, text: '' };
                        }
                        return draft;
                    });
                    requestAnimationFrame(() => focusBlock(block.id, 'start'));
                    return;
                }
                if (trimmed === '###') {
                    event.preventDefault();
                    element.textContent = '';
                    setBlocks((prev) => {
                        const draft = [...prev];
                        if (draft[index] && draft[index].id === block.id) {
                            draft[index] = { ...draft[index], type: BLOCK_TYPES.HEADING3, text: '' };
                        }
                        return draft;
                    });
                    requestAnimationFrame(() => focusBlock(block.id, 'start'));
                    return;
                }
                if (trimmed === '-') {
                    event.preventDefault();
                    element.textContent = '';
                    setBlocks((prev) => {
                        const draft = [...prev];
                        if (draft[index] && draft[index].id === block.id) {
                            draft[index] = { ...draft[index], type: BLOCK_TYPES.BULLET, text: '' };
                        }
                        return draft;
                    });
                    requestAnimationFrame(() => focusBlock(block.id, 'start'));
                    return;
                }
            }

            event.preventDefault();
            const before = textContent.slice(0, caretOffset);
            const after = textContent.slice(caretOffset);

            if (block.type === BLOCK_TYPES.BULLET && !before && !after) {
                setBlocks((prev) => {
                    const draft = [...prev];
                    const target = draft[index];
                    if (!target) {
                        return prev;
                    }
                    draft[index] = { ...target, type: BLOCK_TYPES.PARAGRAPH, text: '' };
                    return draft;
                });
                requestAnimationFrame(() => focusBlock(block.id, 'start'));
                return;
            }

            const newBlockType = block.type === BLOCK_TYPES.BULLET ? BLOCK_TYPES.BULLET : BLOCK_TYPES.PARAGRAPH;
            const newBlock = createBlock(newBlockType, after);

            setBlocks((prev) => {
                const draft = [...prev];
                const target = draft[index];
                if (!target) {
                    return prev;
                }

                draft[index] = { ...target, text: before };
                draft.splice(index + 1, 0, newBlock);
                return draft;
            });

            requestAnimationFrame(() => focusBlock(newBlock.id, 'start'));
            return;
        }

        if (event.key === 'Backspace' && caretOffset === 0) {
            if (!textContent && block.type !== BLOCK_TYPES.PARAGRAPH) {
                event.preventDefault();
                setBlocks((prev) => {
                    const draft = [...prev];
                    if (draft[index] && draft[index].id === block.id) {
                        draft[index] = { ...draft[index], type: BLOCK_TYPES.PARAGRAPH };
                    }
                    return draft;
                });
                requestAnimationFrame(() => focusBlock(block.id, 'start'));
                return;
            }

            if (!textContent && index > 0) {
                event.preventDefault();
                const prevBlock = blocks[index - 1];
                setBlocks((prev) => {
                    const draft = [...prev];
                    const removed = draft.splice(index, 1)[0];
                    const target = draft[index - 1];
                    if (target && removed) {
                        draft[index - 1] = { ...target, text: `${target.text}${removed.text}` };
                    }
                    return draft.length ? draft : [createBlock()];
                });
                if (prevBlock) {
                    requestAnimationFrame(() => focusBlock(prevBlock.id, 'end'));
                }
            }
        }
    };

    const blockStyles = {
        [BLOCK_TYPES.HEADING1]: 'text-3xl font-semibold tracking-tight my-2',
        [BLOCK_TYPES.HEADING2]: 'text-2xl font-semibold my-2',
        [BLOCK_TYPES.HEADING3]: 'text-xl font-semibold my-1',
        [BLOCK_TYPES.BULLET]: 'text-base my-1',
        [BLOCK_TYPES.PARAGRAPH]: 'text-base my-1',
    };

    const placeholders = {
        [BLOCK_TYPES.HEADING1]: '제목 1',
        [BLOCK_TYPES.HEADING2]: '제목 2',
        [BLOCK_TYPES.HEADING3]: '제목 3',
        [BLOCK_TYPES.BULLET]: '항목',
        [BLOCK_TYPES.PARAGRAPH]: '내용을 입력하세요',
    };

    const baseBlockClass = 'relative min-h-[1.75rem] whitespace-pre-wrap break-words outline-none empty:before:absolute empty:before:left-0 empty:before:top-0 empty:before:text-slate-400 empty:before:pointer-events-none empty:before:select-none empty:before:content-[attr(data-placeholder)]';

    const renderBlock = (block, index) => {
        const className = `${baseBlockClass} ${blockStyles[block.type] || blockStyles[BLOCK_TYPES.PARAGRAPH]}`;
        const placeholder = placeholders[block.type] || placeholders[BLOCK_TYPES.PARAGRAPH];
        const editableProps = {
            ref: setBlockRef(block),
            contentEditable: true,
            suppressContentEditableWarning: true,
            onInput: (event) => handleBlockInput(block.id, index, event.currentTarget.textContent || ''),
            onKeyDown: (event) => handleBlockKeyDown(event, index),
            'data-block-id': block.id,
            'data-placeholder': placeholder,
            className,
        };

        if (block.type === BLOCK_TYPES.BULLET) {
            return (
                <div key={block.id} className="flex items-start gap-3">
                    <span className="mt-1 text-base text-slate-400">•</span>
                    <div {...editableProps} />
                </div>
            );
        }

        return <div key={block.id} {...editableProps} />;
    };

    return (
        <AnimatePresence>
            {isVisible && memo && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl py-12"
                    style={{
                        background: themeStyles.canvas,
                        fontFamily: '"Inter", "Pretendard", sans-serif',
                        pointerEvents: 'auto',
                        WebkitAppRegion: 'no-drag',
                        color: themeStyles.text,
                    }}
                    data-interactive-zone="true"
                    ref={editorRef}
                >
                    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 overflow-y-auto px-8">
                        <div className="flex items-start justify-between gap-4">
                            <input
                                ref={titleRef}
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="제목 없는 페이지"
                                className="flex-1 border-none bg-transparent text-3xl font-semibold leading-tight tracking-tight outline-none placeholder:text-slate-400 focus:outline-none"
                                style={{ color: themeStyles.text }}
                            />
                            <div className="flex items-center gap-3" data-block-pan="true">
                                {typeof onDelete === 'function' && (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            onDelete();
                                        }}
                                        className="rounded-full border px-3 py-1 text-xs font-medium transition hover:bg-red-500/10"
                                        style={{
                                            borderColor: themeStyles.cardBorder,
                                            color: '#dc2626',
                                        }}
                                    >
                                        삭제
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.preventDefault();
                                        onClose();
                                    }}
                                    className="rounded-full border px-3 py-1 text-xs font-medium transition hover:bg-slate-200/50"
                                    style={{
                                        borderColor: themeStyles.cardBorder,
                                        color: themeStyles.text,
                                    }}
                                >
                                    닫기
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {blocks.map((block, index) => renderBlock(block, index))}
                        </div>

                        <div className="mt-auto border-t pt-3 text-xs" style={{ borderColor: themeStyles.divider, color: themeStyles.muted }}>
                            ESC로 닫기 · 변경 사항은 300ms 후 자동 저장됩니다.
                        </div>
                    </div>

                    {slashMenu.open && slashOptions.length > 0 && (
                        <div
                            className="pointer-events-auto absolute z-[1200] w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-xl"
                            style={{ top: slashMenu.anchor.top, left: slashMenu.anchor.left }}
                        >
                            <ul className="max-h-64 overflow-y-auto py-2 text-sm text-slate-100">
                                {slashOptions.map((option, optionIndex) => {
                                    const isActive = slashMenu.activeIndex === optionIndex;
                                    return (
                                        <li
                                            key={option.id}
                                            className={`cursor-pointer px-3 py-2 transition ${isActive ? 'bg-slate-700 text-white' : 'hover:bg-slate-800/80'}`}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                selectSlashOption(option, slashMenu.blockId, slashMenu.index);
                                            }}
                                            onMouseEnter={() => setSlashMenu((prev) => ({ ...prev, activeIndex: optionIndex }))}
                                        >
                                            <p className="mt-1 text-sm font-medium text-slate-100">{option.label}</p>
                                            {option.description && (
                                                <p className="text-[11px] text-slate-400">{option.description}</p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default MemoEditor;
