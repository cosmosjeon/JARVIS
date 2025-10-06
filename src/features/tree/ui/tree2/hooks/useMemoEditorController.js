import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTheme } from 'shared/components/library/ThemeProvider';
import memoEditorTokens from '../editor/tokens';
import {
    BLOCK_TYPES,
    BLOCK_DEFINITIONS,
    SLASH_PALETTE_CATEGORIES,
    RECENT_SLASH_LIMIT,
} from '../editor/blockTypes';
import {
    createBlock,
    deserializeBlocks,
    findBlockById,
    getBlockAtPath,
    indentBlock,
    insertSiblingAfter,
    outdentBlock,
    removeBlockAtPath,
    serializeBlocks,
    setBlockAtPath,
    transformBlockType,
    updateBlockHtml,
    updateBlockProps,
} from '../editor/blockUtils';
import {
    sanitizeHtmlInput,
    stripHtml,
    decodeHtml,
    blocksToPlainText,
    findDeepestDescendantId,
    getPreviousBlockId,
    getNextBlockId,
} from 'domain/tree/memo/textTransforms';

const defaultSlashState = {
    open: false,
    blockPath: [],
    anchor: { top: 0, left: 0 },
    query: '',
    category: 'recent',
    activeIndex: 0,
};

const getThemePalette = (theme) => {
    if (theme === 'dark') {
        return {
            canvas: '#1c1d20',
            card: 'rgba(28, 29, 32, 0.92)',
            border: 'rgba(255, 255, 255, 0.06)',
            text: 'rgba(240, 242, 245, 0.95)',
            secondary: 'rgba(161, 167, 175, 0.85)',
            hint: 'rgba(120, 126, 135, 0.8)',
        };
    }
    return {
        canvas: '#f6f6f4',
        card: '#ffffff',
        border: 'rgba(17, 24, 39, 0.08)',
        text: memoEditorTokens.color.text.primary,
        secondary: memoEditorTokens.color.text.secondary,
        hint: memoEditorTokens.color.text.hint,
    };
};

const getCaretRect = () => {
    if (typeof window === 'undefined') return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0).cloneRange();
    if (range.getClientRects().length === 0) {
        const span = document.createElement('span');
        span.textContent = '\u200b';
        range.insertNode(span);
        const rect = span.getBoundingClientRect();
        span.parentNode?.removeChild(span);
        return rect;
    }
    return range.getBoundingClientRect();
};

const QUOTE_MARKERS = new Set(["'", '‘', '’']);

const MARKER_MAP = new Map([
    ['#', BLOCK_TYPES.HEADING_1],
    ['##', BLOCK_TYPES.HEADING_2],
    ['###', BLOCK_TYPES.HEADING_3],
    ['-', BLOCK_TYPES.BULLETED_LIST],
    ['1.', BLOCK_TYPES.NUMBERED_LIST],
    ['[]', BLOCK_TYPES.TODO],
    ['>', BLOCK_TYPES.TOGGLE],
]);

const LIST_TYPES = new Set([
    BLOCK_TYPES.BULLETED_LIST,
    BLOCK_TYPES.NUMBERED_LIST,
    BLOCK_TYPES.TODO,
]);

const isCaretAtBlockStart = (element) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
        return false;
    }
    const { anchorNode } = selection;
    if (!anchorNode || !element.contains(anchorNode)) {
        return false;
    }
    try {
        const range = selection.getRangeAt(0).cloneRange();
        const startRange = document.createRange();
        startRange.selectNodeContents(element);
        startRange.collapse(true);
        return (
            range.compareBoundaryPoints(Range.START_TO_START, startRange) === 0
            && range.compareBoundaryPoints(Range.END_TO_START, startRange) === 0
        );
    } catch (error) {
        return false;
    }
};

const toAlphaLabel = (index) => {
    let n = index;
    let result = '';
    while (n >= 0) {
        result = String.fromCharCode(97 + (n % 26)) + result;
        n = Math.floor(n / 26) - 1;
    }
    return `${result}.`;
};

const toRomanLabel = (index) => {
    const numerals = [
        ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
        ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
        ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
    ];
    let num = index + 1;
    let result = '';
    numerals.forEach(([symbol, value]) => {
        while (num >= value) {
            result += symbol;
            num -= value;
        }
    });
    return `${result.toLowerCase()}.`;
};

const getOrderedLabel = (index, depth) => {
    if (depth === 0) {
        return `${index + 1}.`;
    }
    if (depth === 1) {
        return toAlphaLabel(index);
    }
    if (depth === 2) {
        return toRomanLabel(index);
    }
    return `${index + 1}.`;
};

const getIndentStyle = (level) => ({ marginLeft: `${level * 22}px` });

export const useMemoEditorController = ({
    memo,
    isVisible = false,
    onClose = () => {},
    onUpdate,
    onDelete,
}) => {
    const { theme } = useTheme();
    const palette = useMemo(() => getThemePalette(theme), [theme]);
    const editorRef = useRef(null);
    const titleRef = useRef(null);
    const blockRefs = useRef(new Map());
    const autosaveRef = useRef(null);
    const pendingFocusRef = useRef(null);
    const [title, setTitle] = useState('');
    const [blocks, setBlocks] = useState(() => [createBlock(BLOCK_TYPES.TEXT)]);
    const [slashState, setSlashState] = useState(defaultSlashState);
    const [recentSlash, setRecentSlash] = useState([]);
    const [formatState, setFormatState] = useState({ visible: false, position: { top: 0, left: 0 }, active: {} });

    const handleTitleChange = useCallback((value) => {
        setTitle(value);
    }, []);

    useEffect(() => {
        if (!isVisible || !memo) {
            return;
        }
        const initialTitle = memo.memo?.title || memo.keyword || '제목 없음';
        const initialContent = memo.memo?.content || '';
        const normalizedBlocks = deserializeBlocks(initialContent);
        setTitle(initialTitle);
        setBlocks(normalizedBlocks.length ? normalizedBlocks : [createBlock(BLOCK_TYPES.TEXT)]);
        requestAnimationFrame(() => {
            if (titleRef.current) {
                titleRef.current.focus();
                titleRef.current.select();
            }
        });
    }, [memo, isVisible]);

    useEffect(() => {
        if (!memo || !isVisible || typeof onUpdate !== 'function') {
            return () => undefined;
        }
        if (autosaveRef.current) {
            clearTimeout(autosaveRef.current);
        }
        autosaveRef.current = setTimeout(() => {
            const payload = serializeBlocks(blocks);
            onUpdate({
                id: memo.id,
                memo: {
                    title: title.trim(),
                    content: payload,
                    plainText: blocksToPlainText(blocks),
                },
            });
        }, 420);

        return () => {
            if (autosaveRef.current) {
                clearTimeout(autosaveRef.current);
            }
        };
    }, [memo, isVisible, blocks, title, onUpdate]);

    useEffect(() => () => {
        if (autosaveRef.current) {
            clearTimeout(autosaveRef.current);
        }
    }, []);

    useEffect(() => {
        if (!isVisible) return () => undefined;
        const handleGlobalKey = (event) => {
            if (slashState.open) {
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
            }
        };
        window.addEventListener('keydown', handleGlobalKey);
        return () => window.removeEventListener('keydown', handleGlobalKey);
    }, [isVisible, onClose, slashState.open]);

    useEffect(() => {
        const syncBlockContent = (items) => {
            items.forEach((item) => {
                const node = blockRefs.current.get(item.id);
                if (node && node.innerHTML !== (item.html || '')) {
                    node.innerHTML = item.html || '';
                }
                if (item.children && item.children.length > 0) {
                    syncBlockContent(item.children);
                }
            });
        };
        syncBlockContent(blocks);
    }, [blocks]);

    const slashOptions = useMemo(() => {
        return Object.keys(BLOCK_DEFINITIONS).map((type) => {
            const definition = BLOCK_DEFINITIONS[type];
            return {
                id: type,
                type,
                label: definition.label,
                description: definition.description,
                icon: definition.icon,
                category: definition.category,
            };
        });
    }, []);

    const setBlockRef = useCallback((block) => (node) => {
        if (node) {
            blockRefs.current.set(block.id, node);
            if (node.innerHTML !== (block.html || '')) {
                node.innerHTML = block.html || '';
            }
        } else {
            blockRefs.current.delete(block.id);
        }
    }, []);

    const focusBlock = useCallback((blockId, position = 'end') => {
        const element = blockRefs.current.get(blockId);
        if (!element) return;
        element.focus();
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(position === 'start');
        selection.removeAllRanges();
        selection.addRange(range);
    }, []);

    const closeSlashPalette = useCallback(() => {
        setSlashState(defaultSlashState);
    }, []);

    const openSlashPalette = useCallback((blockPath) => {
        const caretRect = getCaretRect();
        const editorRect = editorRef.current?.getBoundingClientRect();
        if (!caretRect || !editorRect) {
            return;
        }
        setSlashState({
            open: true,
            blockPath,
            anchor: {
                top: caretRect.bottom - editorRect.top + memoEditorTokens.spacing.sm,
                left: caretRect.left - editorRect.left,
            },
            query: '',
            category: 'recent',
            activeIndex: 0,
        });
    }, []);

    const syncRangeBlockHtml = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }
        let anchorNode = selection.anchorNode;
        if (!anchorNode) return;
        if (anchorNode.nodeType === Node.TEXT_NODE) {
            anchorNode = anchorNode.parentElement;
        }
        if (!anchorNode) return;
        const blockRoot = anchorNode.closest('[data-block-id]');
        if (!blockRoot) return;
        const blockId = blockRoot.getAttribute('data-block-id');
        setBlocks((prev) => {
            const located = findBlockById(prev, blockId);
            if (!located) return prev;
            return updateBlockHtml(prev, located.path, sanitizeHtmlInput(blockRoot.innerHTML));
        });
    }, []);

    const handleInlineFormat = useCallback((command) => {
        if (typeof document === 'undefined') return;
        if (command === 'code') {
            document.execCommand('formatBlock', false, 'pre');
        } else {
            document.execCommand(command, false, null);
        }
        syncRangeBlockHtml();
    }, [syncRangeBlockHtml]);

    const handleLinkCreate = useCallback(() => {
        if (typeof document === 'undefined') return;
        const url = window.prompt('링크 주소를 입력하세요');
        if (!url) return;
        document.execCommand('createLink', false, url);
        syncRangeBlockHtml();
    }, [syncRangeBlockHtml]);

    const handleLinkRemove = useCallback(() => {
        if (typeof document === 'undefined') return;
        document.execCommand('unlink');
        syncRangeBlockHtml();
    }, [syncRangeBlockHtml]);

    const handleColor = useCallback((color) => {
        if (typeof document === 'undefined') return;
        document.execCommand('foreColor', false, color);
        syncRangeBlockHtml();
    }, [syncRangeBlockHtml]);

    const handleHighlight = useCallback((color) => {
        if (typeof document === 'undefined') return;
        document.execCommand('hiliteColor', false, color);
        syncRangeBlockHtml();
    }, [syncRangeBlockHtml]);

    useEffect(() => {
        if (!isVisible) return () => undefined;
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!editorRef.current || !selection || selection.rangeCount === 0) {
                setFormatState((prev) => ({ ...prev, visible: false }));
                return;
            }
            if (selection.isCollapsed) {
                setFormatState((prev) => ({ ...prev, visible: false }));
                return;
            }
            const anchorNode = selection.anchorNode;
            if (!anchorNode) {
                setFormatState((prev) => ({ ...prev, visible: false }));
                return;
            }
            const editorNode = editorRef.current;
            if (!editorNode.contains(anchorNode)) {
                setFormatState((prev) => ({ ...prev, visible: false }));
                return;
            }
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const editorRect = editorNode.getBoundingClientRect();
            const position = {
                top: rect.top - editorRect.top - 48,
                left: rect.left - editorRect.left + rect.width / 2 - 120,
            };
            const active = {
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                strike: document.queryCommandState('strikeThrough'),
                code: document.queryCommandState('formatBlock'),
                link: document.queryCommandState('createLink'),
            };
            setFormatState({ visible: true, position, active });
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [isVisible]);

    const ensureBlockCount = useCallback((nextBlocks) => {
        return nextBlocks.length ? nextBlocks : [createBlock(BLOCK_TYPES.TEXT)];
    }, []);

    const handleInsertBlockAfter = useCallback((path, type = BLOCK_TYPES.TEXT) => {
        const newBlock = createBlock(type);
        setBlocks((prev) => ensureBlockCount(insertSiblingAfter(prev, path, newBlock)));
        requestAnimationFrame(() => focusBlock(newBlock.id, 'start'));
    }, [ensureBlockCount, focusBlock]);

    const handleBlockInput = useCallback((path, html) => {
        setBlocks((prev) => updateBlockHtml(prev, path, sanitizeHtmlInput(html)));
    }, []);

    const handleDeleteBlock = useCallback((path, fallbackBlockId = null) => {
        const currentBlock = getBlockAtPath(blocks, path);
        const currentBlockId = currentBlock?.id;
        const previousId = getPreviousBlockId(blocks, path);
        const nextId = getNextBlockId(blocks, path);

        const isOnlyBlock = previousId === null && nextId === null;
        if (isOnlyBlock) {
            setBlocks((prev) => setBlockAtPath(prev, path, (current) => transformBlockType(current, BLOCK_TYPES.TEXT)));
            requestAnimationFrame(() => focusBlock(currentBlockId || blocks[0]?.id, 'start'));
            return;
        }

        let resolvedFocusId = fallbackBlockId || previousId || nextId;
        setBlocks((prev) => {
            const updated = ensureBlockCount(removeBlockAtPath(prev, path));
            if (!resolvedFocusId && updated.length > 0) {
                const targetIndex = Math.min(path[0], updated.length - 1);
                resolvedFocusId = updated[targetIndex].id;
            }
            pendingFocusRef.current = resolvedFocusId;
            return updated;
        });

        requestAnimationFrame(() => {
            if (pendingFocusRef.current) {
                focusBlock(pendingFocusRef.current, 'end');
                pendingFocusRef.current = null;
            }
        });
    }, [blocks, ensureBlockCount, focusBlock]);

    const handleToggleExpanded = useCallback((path, expanded) => {
        setBlocks((prev) => updateBlockProps(prev, path, { expanded }));
    }, []);

    const handleTodoCheck = useCallback((path, checked) => {
        setBlocks((prev) => updateBlockProps(prev, path, { checked }));
    }, []);

    const handleBlockKeyDown = useCallback((event, block, path) => {
        if (event.defaultPrevented) return;

        const element = blockRefs.current.get(block.id);

        if (event.key === ' ' && !event.metaKey && !event.ctrlKey && block.type === BLOCK_TYPES.TEXT) {
            const markerText = decodeHtml(stripHtml(block.html || '')).trim();
            const normalizedMarker = markerText.replace(/\s+/g, '');
            const targetType = MARKER_MAP.get(normalizedMarker) || (QUOTE_MARKERS.has(normalizedMarker) ? BLOCK_TYPES.QUOTE : null);

            if (targetType) {
                event.preventDefault();
                setBlocks((prev) => setBlockAtPath(prev, path, (current) => {
                    const transformed = transformBlockType(current, targetType);
                    return { ...transformed, html: '' };
                }));
                requestAnimationFrame(() => {
                    focusBlock(block.id, 'start');
                    const node = blockRefs.current.get(block.id);
                    if (node) {
                        node.textContent = '';
                    }
                });
                return;
            }
        }

        if (slashState.open && event.key === 'Escape') {
            event.preventDefault();
            closeSlashPalette();
            return;
        }

        if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            openSlashPalette(path);
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            setBlocks((prev) => ensureBlockCount(
                event.shiftKey ? outdentBlock(prev, path) : indentBlock(prev, path),
            ));
            return;
        }

        if (event.key === 'Backspace') {
            if (!element) return;
            if (block.type !== BLOCK_TYPES.TEXT && isCaretAtBlockStart(element)) {
                event.preventDefault();
                const restoredHtml = sanitizeHtmlInput(element.innerHTML);
                setBlocks((prev) => setBlockAtPath(prev, path, (current) => ({
                    ...transformBlockType(current, BLOCK_TYPES.TEXT),
                    html: restoredHtml,
                })));
                requestAnimationFrame(() => focusBlock(block.id, 'start'));
                return;
            }
            const text = stripHtml(element.innerHTML);
            if (!text) {
                event.preventDefault();
                const previousId = getPreviousBlockId(blocks, path);
                const nextId = getNextBlockId(blocks, path);
                const isOnlyBlock = previousId === null && nextId === null;

                if (isOnlyBlock) {
                    setBlocks((prev) => setBlockAtPath(prev, path, (current) => transformBlockType(current, BLOCK_TYPES.TEXT)));
                    requestAnimationFrame(() => focusBlock(block.id, 'start'));
                    return;
                }

                if (block.type !== BLOCK_TYPES.TEXT) {
                    setBlocks((prev) => setBlockAtPath(prev, path, (current) => transformBlockType(current, BLOCK_TYPES.TEXT)));
                    requestAnimationFrame(() => focusBlock(block.id, 'start'));
                } else {
                    handleDeleteBlock(path);
                }
                return;
            }
            if (LIST_TYPES.has(block.type) && isCaretAtBlockStart(element) && path.length > 0) {
                event.preventDefault();
                const currentId = block.id;
                setBlocks((prev) => {
                    const updated = ensureBlockCount(outdentBlock(prev, path));
                    pendingFocusRef.current = currentId;
                    return updated;
                });
                requestAnimationFrame(() => {
                    if (pendingFocusRef.current) {
                        focusBlock(pendingFocusRef.current, 'end');
                        pendingFocusRef.current = null;
                    }
                });
            }
            return;
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            if (block.type === BLOCK_TYPES.TEXT) {
                const marker = decodeHtml(stripHtml(block.html || '')).trim();
                if (marker === '---') {
                    event.preventDefault();
                    if (element) {
                        element.textContent = '';
                    }
                    setBlocks((prev) => setBlockAtPath(prev, path, (current) => transformBlockType(current, BLOCK_TYPES.DIVIDER)));
                    requestAnimationFrame(() => handleInsertBlockAfter(path));
                    return;
                }
            }
            event.preventDefault();
            const persistType = [
                BLOCK_TYPES.BULLETED_LIST,
                BLOCK_TYPES.NUMBERED_LIST,
                BLOCK_TYPES.TODO,
            ].includes(block.type) ? block.type : BLOCK_TYPES.TEXT;
            handleInsertBlockAfter(path, persistType);
            return;
        }
    }, [slashState.open, closeSlashPalette, openSlashPalette, setBlocks, ensureBlockCount, indentBlock, outdentBlock, blockRefs, blocks, focusBlock, handleInsertBlockAfter]);

    const handleSlashSelect = useCallback((option) => {
        if (!slashState.open) return;
        const { blockPath } = slashState;
        if (!Array.isArray(blockPath) || blockPath.length === 0) {
            closeSlashPalette();
            return;
        }

        let focusId = null;

        setBlocks((prev) => {
            const current = getBlockAtPath(prev, blockPath);
            if (!current) {
                return prev;
            }

            const definition = BLOCK_DEFINITIONS[option.type];
            if (definition?.isVoid) {
                const voidBlock = { ...transformBlockType(current, option.type), html: '' };
                const replaced = setBlockAtPath(prev, blockPath, () => voidBlock);
                const nextBlock = createBlock(BLOCK_TYPES.TEXT);
                focusId = nextBlock.id;
                return ensureBlockCount(insertSiblingAfter(replaced, blockPath, nextBlock));
            }

            const transformed = transformBlockType(current, option.type);
            focusId = transformed.id;
            return setBlockAtPath(prev, blockPath, () => transformed);
        });

        setRecentSlash((prev) => {
            const next = [option.id, ...prev.filter((id) => id !== option.id)];
            return next.slice(0, RECENT_SLASH_LIMIT);
        });

        closeSlashPalette();

        if (focusId) {
            requestAnimationFrame(() => focusBlock(focusId, 'end'));
        }
    }, [slashState, closeSlashPalette, setBlocks, ensureBlockCount, focusBlock]);

    const renderBlock = useCallback((block, path, level = 0) => {
        const definition = BLOCK_DEFINITIONS[block.type] || BLOCK_DEFINITIONS[BLOCK_TYPES.TEXT];
        const commonClass = 'outline-none focus-visible:outline-none text-[16px] leading-relaxed';
        const placeholder = definition.placeholder;
        const handleKeyDown = (event) => handleBlockKeyDown(event, block, path);
        const onInput = (event) => handleBlockInput(path, event.currentTarget.innerHTML);

        const createEditableProps = (className, extra = {}) => ({
            ref: setBlockRef(block),
            'data-block-id': block.id,
            contentEditable: true,
            suppressContentEditableWarning: true,
            'data-placeholder': placeholder,
            onInput,
            onKeyDown: handleKeyDown,
            className,
            ...extra,
        });

        const blockBody = (() => {
            switch (block.type) {
                case BLOCK_TYPES.HEADING_1:
                    return (
                        <div
                            {...createEditableProps(`${commonClass} text-[32px] leading-[1.25] font-semibold tracking-tight empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`)}
                        />
                    );
                case BLOCK_TYPES.HEADING_2:
                    return (
                        <div
                            {...createEditableProps(`${commonClass} text-[26px] leading-[1.3] font-semibold empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`)}
                        />
                    );
                case BLOCK_TYPES.HEADING_3:
                    return (
                        <div
                            {...createEditableProps(`${commonClass} text-[22px] leading-[1.35] font-semibold empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`)}
                        />
                    );
                case BLOCK_TYPES.TODO:
                    return (
                        <div className="flex items-start gap-3" style={getIndentStyle(level)}>
                            <input
                                type="checkbox"
                                checked={!!block.props?.checked}
                                onChange={(event) => handleTodoCheck(path, event.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-2 focus:ring-offset-0"
                            />
                            <div
                                {...createEditableProps(`${commonClass} empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] ${block.props?.checked ? 'text-slate-400 line-through' : ''}`)}
                            />
                        </div>
                    );
                case BLOCK_TYPES.BULLETED_LIST:
                    return (
                        <div className="flex items-start gap-3" style={getIndentStyle(level)}>
                            <span className="mt-2 h-2 w-2 rounded-full bg-slate-400"></span>
                            <div
                                {...createEditableProps(`${commonClass} empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`)}
                            />
                        </div>
                    );
                case BLOCK_TYPES.NUMBERED_LIST:
                    return (
                        <div className="flex items-start gap-3" style={getIndentStyle(level)}>
                            <span className="mt-1 min-w-[28px] text-right text-sm font-semibold text-slate-500">
                                {getOrderedLabel(path[path.length - 1], level)}
                            </span>
                            <div
                                {...createEditableProps(`${commonClass} empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`)}
                            />
                        </div>
                    );
                case BLOCK_TYPES.TOGGLE:
                    return (
                        <div className="flex flex-col gap-2" style={getIndentStyle(level)}>
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[16px] font-medium text-slate-600 hover:bg-slate-100/70"
                                onClick={() => handleToggleExpanded(path, !block.props?.expanded)}
                            >
                                <span className="text-sm text-slate-400 transition-transform" style={{ transform: block.props?.expanded === false ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                                    ▾
                                </span>
                                <div
                                    {...createEditableProps(`${commonClass} empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`)}
                                />
                            </button>
                            {block.props?.expanded !== false && block.children?.length > 0 && (
                                <div className="ml-6 border-l border-slate-200 pl-4">
                                    {block.children.map((child, index) => renderBlock(child, [...path, index], level + 1))}
                                </div>
                            )}
                        </div>
                    );
                case BLOCK_TYPES.QUOTE:
                    return (
                        <div className="border-l-4 border-slate-300/80 pl-4 text-slate-600">
                            <div
                                {...createEditableProps(`${commonClass} italic empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`)}
                            />
                        </div>
                    );
                case BLOCK_TYPES.DIVIDER:
                    return <div className="my-4 h-px w-full bg-slate-200" />;
                case BLOCK_TYPES.CALLOUT:
                    return (
                        <div
                            className="flex gap-3 rounded-xl border px-4 py-3 text-[15px]"
                            style={{
                                backgroundColor: memoEditorTokens.color.tint[block.props?.tint || 'blue'],
                                borderColor: palette.border,
                            }}
                        >
                            <button
                                type="button"
                                className="text-lg"
                                onClick={() => {
                                    const icon = window.prompt('아이콘을 입력하세요', block.props?.icon || '💡');
                                    if (!icon) return;
                                    setBlocks((prev) => updateBlockProps(prev, path, { icon }));
                                }}
                            >
                                {block.props?.icon || '💡'}
                            </button>
                            <div
                                {...createEditableProps(`${commonClass} empty:before:text-slate-500 empty:before:content-[attr(data-placeholder)]`)}
                            />
                        </div>
                    );
                case BLOCK_TYPES.CODE:
                    return (
                        <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-900/90 p-4 text-[13px] text-slate-100">
                            <code
                                ref={setBlockRef(block.id)}
                                data-block-id={block.id}
                                contentEditable
                                suppressContentEditableWarning
                                className="whitespace-pre"
                                onInput={onInput}
                                onKeyDown={(event) => {
                                    if (event.key === 'Tab') {
                                        event.preventDefault();
                                        document.execCommand('insertText', false, '    ');
                                    }
                                }}
                            >
                                {block.html}
                            </code>
                        </pre>
                    );
                case BLOCK_TYPES.IMAGE:
                    return (
                        <div className="flex flex-col items-center gap-2">
                            {block.props?.url ? (
                                <img
                                    src={block.props.url}
                                    alt={block.props?.caption || 'image'}
                                    className="max-h-80 w-full rounded-lg object-cover"
                                />
                            ) : (
                                <button
                                    type="button"
                                    className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-500"
                                    onClick={() => {
                                        const url = window.prompt('이미지 URL을 입력하세요');
                                        if (!url) return;
                                        setBlocks((prev) => updateBlockProps(prev, path, { url }));
                                    }}
                                >
                                    이미지를 추가하려면 클릭하세요
                                </button>
                            )}
                            <div
                                {...createEditableProps('w-full text-center text-sm text-slate-500', {
                                    'data-placeholder': '캡션을 입력하세요',
                                })}
                            />
                        </div>
                    );
                case BLOCK_TYPES.FILE:
                    return (
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-700">{block.props?.name || '파일 이름'}</span>
                                <span className="text-xs text-slate-400">{block.props?.size || '크기 정보 없음'}</span>
                            </div>
                            <button
                                type="button"
                                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600"
                                onClick={() => {
                                    const name = window.prompt('파일 이름', block.props?.name || '');
                                    const size = window.prompt('파일 크기', block.props?.size || '');
                                    const url = window.prompt('파일 URL(선택)', block.props?.url || '');
                                    setBlocks((prev) => updateBlockProps(prev, path, { name, size, url }));
                                }}
                            >
                                정보 수정
                            </button>
                        </div>
                    );
                case BLOCK_TYPES.BOOKMARK:
                    return (
                        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <input
                                type="url"
                                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
                                placeholder="링크 URL을 입력하세요"
                                value={block.props?.url || ''}
                                onChange={(event) => setBlocks((prev) => updateBlockProps(prev, path, { url: event.target.value }))}
                            />
                            <div
                                {...createEditableProps(`${commonClass} text-sm text-slate-600 empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`, {
                                    'data-placeholder': '설명을 입력하세요',
                                })}
                            />
                            {block.props?.url && (
                                <a
                                    href={block.props.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-slate-500 underline"
                                >
                                    {block.props.url}
                                </a>
                            )}
                        </div>
                    );
                case BLOCK_TYPES.TABLE:
                    return (
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed border-collapse rounded-lg border border-slate-200">
                                <tbody>
                                    {(block.props?.data || []).map((row, rowIndex) => (
                                        <tr key={`row-${rowIndex}`} className="border-b border-slate-200 last:border-none">
                                            {row.map((cell, cellIndex) => (
                                                <td key={`cell-${cellIndex}`} className="border-r border-slate-200 last:border-none">
                                                    <div
                                                        contentEditable
                                                        suppressContentEditableWarning
                                                        className="min-h-[40px] px-3 py-2 text-sm text-slate-600 focus:outline-none"
                                                        onInput={(event) => {
                                                            const value = event.currentTarget.textContent || '';
                                                            setBlocks((prev) => {
                                                                const next = [...prev];
                                                                const target = findBlockById(next, block.id);
                                                                if (!target) return prev;
                                                                const table = target.block;
                                                                const updated = table.props?.data?.map((r, ri) => r.map((c, ci) => ({
                                                                    ...c,
                                                                    value: ri === rowIndex && ci === cellIndex ? value : c.value,
                                                                })));
                                                                return updateBlockProps(prev, target.path, { data: updated });
                                                            });
                                                        }}
                                                    >
                                                        {cell.value}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                case BLOCK_TYPES.KANBAN:
                    return (
                        <div className="flex gap-4 overflow-x-auto">
                            {(block.props?.columns || []).map((column, columnIndex) => (
                                <div key={column.id} className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white/70 p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-slate-600">{column.title}</h4>
                                        <button
                                            type="button"
                                            className="text-xs text-slate-400"
                                            onClick={() => {
                                                const title = window.prompt('컬럼 이름', column.title);
                                                if (!title) return;
                                                setBlocks((prev) => {
                                                    const located = findBlockById(prev, block.id);
                                                    if (!located) return prev;
                                                    const nextColumns = located.block.props.columns.map((col, idx) => (
                                                        idx === columnIndex ? { ...col, title } : col
                                                    ));
                                                    return updateBlockProps(prev, located.path, { columns: nextColumns });
                                                });
                                            }}
                                        >
                                            이름 변경
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {(column.cards || []).map((card, cardIndex) => (
                                            <div key={card.id || cardIndex} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                                {card.title}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            className="rounded-lg border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500"
                                            onClick={() => {
                                                const title = window.prompt('카드 제목을 입력하세요');
                                                if (!title) return;
                                                setBlocks((prev) => {
                                                    const located = findBlockById(prev, block.id);
                                                    if (!located) return prev;
                                                    const nextColumns = located.block.props.columns.map((col, idx) => {
                                                        if (idx !== columnIndex) return col;
                                                        return {
                                                            ...col,
                                                            cards: [...(col.cards || []), { id: `${Date.now()}`, title }],
                                                        };
                                                    });
                                                    return updateBlockProps(prev, located.path, { columns: nextColumns });
                                                });
                                            }}
                                        >
                                            + 카드 추가
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                case BLOCK_TYPES.SNIPPET:
                    return (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-700">
                            <div
                                {...createEditableProps(`${commonClass} empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`)}
                            />
                            <div className="mt-3 flex gap-2 text-xs text-slate-400">
                                <button
                                    type="button"
                                    onClick={() => setBlocks((prev) => updateBlockProps(prev, path, { snippetId: `${Date.now()}` }))}
                                >
                                    스니펫 저장
                                </button>
                                {block.props?.snippetId && <span>#{block.props.snippetId}</span>}
                            </div>
                        </div>
                    );
                case BLOCK_TYPES.REMINDER:
                    return (
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                                onClick={() => {
                                    const date = window.prompt('YYYY-MM-DD 형식의 날짜를 입력하세요', block.props?.date || '');
                                    const time = window.prompt('HH:MM 형식의 시간을 입력하세요', block.props?.time || '');
                                    setBlocks((prev) => updateBlockProps(prev, path, { date, time }));
                                }}
                            >
                                {block.props?.date || '날짜'} {block.props?.time ? `· ${block.props.time}` : ''}
                            </button>
                            <label className="flex items-center gap-2 text-xs text-slate-500">
                                완료
                                <input
                                    type="checkbox"
                                    checked={!!block.props?.completed}
                                    onChange={(event) => setBlocks((prev) => updateBlockProps(prev, path, { completed: event.target.checked }))}
                                />
                            </label>
                        </div>
                    );
                default:
                    return (
                        <div
                            {...createEditableProps(`${commonClass} empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`, {
                                'data-placeholder': placeholder || '텍스트를 입력하세요',
                            })}
                        />
                    );
            }
        })();

        return (
            <div key={block.id} className="relative flex flex-col gap-2 px-6">
                <div className="flex-1" data-block-wrapper="true">
                    {blockBody}
                    {block.children && block.children.length > 0 && block.type !== BLOCK_TYPES.TOGGLE && (
                        <div className="mt-2 flex flex-col gap-2 border-l border-slate-100 pl-4">
                            {block.children.map((child, index) => renderBlock(child, [...path, index], level + 1))}
                        </div>
                    )}
                </div>
            </div>
        );
    }, [handleBlockInput, handleBlockKeyDown, handleTodoCheck, handleToggleExpanded, handleInsertBlockAfter, handleDeleteBlock, openSlashPalette, focusBlock, setBlockRef, ensureBlockCount]);

    const filteredOptions = useMemo(() => {
        let items = slashOptions;
        if (slashState.category && slashState.category !== 'recent') {
            items = items.filter((item) => item.category === slashState.category);
        }
        if (slashState.category === 'recent' && recentSlash.length > 0) {
            items = recentSlash
                .map((id) => slashOptions.find((option) => option.id === id))
                .filter(Boolean);
        }
        if (slashState.query) {
            const lowered = slashState.query.toLowerCase();
            items = items.filter((item) => (
                item.label.toLowerCase().includes(lowered)
                || item.description?.toLowerCase().includes(lowered)
            ));
        }
        return items.slice(0, 8);
    }, [slashOptions, slashState.category, slashState.query, recentSlash]);

    const handleSlashSearchChange = useCallback((value) => {
        setSlashState((prev) => ({ ...prev, query: value }));
    }, []);

    const handleSlashCategoryChange = useCallback((category) => {
        setSlashState((prev) => ({ ...prev, category }));
    }, []);

    const handleSlashHover = useCallback((index) => {
        setSlashState((prev) => ({ ...prev, activeIndex: index }));
    }, []);

    const handleSlashMove = useCallback((delta) => {
        setSlashState((prev) => {
            if (filteredOptions.length === 0) {
                return prev;
            }
            const nextIndex = Math.max(0, Math.min(filteredOptions.length - 1, prev.activeIndex + delta));
            if (nextIndex === prev.activeIndex) {
                return prev;
            }
            return { ...prev, activeIndex: nextIndex };
        });
    }, [filteredOptions]);

    const handleSlashConfirm = useCallback(() => {
        const option = filteredOptions[slashState.activeIndex];
        if (option) {
            handleSlashSelect(option);
        }
    }, [filteredOptions, slashState.activeIndex, handleSlashSelect]);

    useEffect(() => {
        if (!slashState.open) return;
        if (filteredOptions.length === 0) {
            if (slashState.activeIndex !== 0) {
                setSlashState((prev) => ({ ...prev, activeIndex: 0 }));
            }
            return;
        }
        if (slashState.activeIndex >= filteredOptions.length) {
            setSlashState((prev) => ({ ...prev, activeIndex: filteredOptions.length - 1 }));
        }
    }, [slashState.open, slashState.activeIndex, filteredOptions.length]);

    return {
        isVisible,
        memo,
        palette,
        editorRef,
        titleRef,
        title,
        handleTitleChange,
        onDelete,
        onClose,
        blocks,
        renderBlock,
        slashPalette: {
            state: slashState,
            options: slashOptions,
            recentOptionIds: recentSlash,
            onSearchChange: handleSlashSearchChange,
            onCategoryChange: handleSlashCategoryChange,
            onSelect: handleSlashSelect,
            onHover: handleSlashHover,
            onClose: closeSlashPalette,
            onMove: handleSlashMove,
            onConfirm: handleSlashConfirm,
        },
        formatToolbar: {
            state: formatState,
            onFormat: handleInlineFormat,
            onLink: handleLinkCreate,
            onRemoveLink: handleLinkRemove,
            onColor: handleColor,
            onHighlight: handleHighlight,
        },
    };
};
