import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from 'shared/ui/input';
import { Textarea } from 'shared/ui/textarea';
import { useTheme } from 'components/library/ThemeProvider';

const MemoPanel = ({ memo, onClose, onUpdate }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const debounceRef = useRef(null);
    const isHydratingRef = useRef(false);
    const { theme } = useTheme();

    useEffect(() => {
        const nextTitle = memo?.memo?.title || '';
        const nextContent = memo?.memo?.content || '';
        isHydratingRef.current = true;
        setTitle(nextTitle);
        setContent(nextContent);
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [memo?.id, memo?.memo?.title, memo?.memo?.content]);

    useEffect(() => {
        if (!memo || typeof onUpdate !== 'function') {
            return () => undefined;
        }

        if (isHydratingRef.current) {
            isHydratingRef.current = false;
            return () => undefined;
        }

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            onUpdate({
                title,
                content,
            });
        }, 240);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [title, content, memo, onUpdate]);

    const displayLabel = memo?.memo?.title || memo?.keyword || memo?.id || '메모';
    const linkedKeyword = memo?.keyword && memo?.keyword !== displayLabel ? memo.keyword : null;

    const panelStyles = useMemo(() => {
        switch (theme) {
            case 'light':
                return {
                    background: 'rgba(255, 255, 255, 0.9)',
                    borderColor: 'rgba(0, 0, 0, 0.2)',
                    textColor: 'rgba(17, 24, 39, 0.92)',
                    accentColor: 'rgba(17, 24, 39, 0.65)',
                };
            case 'dark':
                return {
                    background: 'rgba(0, 0, 0, 0.82)',
                    borderColor: 'rgba(255, 255, 255, 0.18)',
                    textColor: 'rgba(248, 250, 252, 0.92)',
                    accentColor: 'rgba(203, 213, 225, 0.65)',
                };
            default:
                return {
                    background: 'rgba(15, 23, 42, 0.45)',
                    borderColor: 'rgba(255, 255, 255, 0.26)',
                    textColor: 'rgba(248, 250, 252, 0.92)',
                    accentColor: 'rgba(191, 219, 254, 0.7)',
                };
        }
    }, [theme]);

    return (
        <div
            className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden rounded-2xl p-6 backdrop-blur-3xl"
            style={{
                fontFamily: 'inherit',
                pointerEvents: 'auto',
                WebkitAppRegion: 'no-drag',
                background: panelStyles.background,
                borderColor: panelStyles.borderColor,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: panelStyles.textColor,
            }}
            data-interactive-zone="true"
        >
            <div
                className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 pb-2"
                data-pan-handle="true"
                style={{ cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none' }}
            >
                <div className="min-w-0 flex-1">
                    <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: panelStyles.accentColor }}
                    >
                        Memo
                    </p>
                    <h2
                        className="mt-1 truncate text-xl font-semibold"
                        style={{ color: panelStyles.textColor }}
                    >
                        {displayLabel}
                    </h2>
                    {linkedKeyword && (
                        <p className="mt-1 text-sm" style={{ color: panelStyles.accentColor }}>
                            연결 노드: {linkedKeyword}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2" data-block-pan="true">
                    <div className="group relative">
                        <button
                            type="button"
                            className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300/20 bg-slate-100/10 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-100/20"
                        >
                            ?
                        </button>
                        <div className="absolute left-full top-full ml-2 mt-1 hidden w-64 transform group-hover:block z-50">
                            <div className="rounded-lg border border-slate-600/30 bg-slate-800/95 px-3 py-2 text-xs text-slate-100 shadow-lg backdrop-blur-sm">
                                <p className="mb-1">이 메모는 선택한 노드에 대한 보조 설명입니다.</p>
                                <p>입력 후 240ms 이내 자동 저장되며, Ctrl/⌘ + Enter로 줄바꿈이 가능합니다.</p>
                            </div>
                            <div className="absolute right-full top-2 h-0 w-0 transform border-t-4 border-b-4 border-r-4 border-transparent border-r-slate-600/30" />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onClose();
                        }}
                        className="rounded-full px-3 py-1 text-xs font-medium transition"
                        style={{
                            borderColor: panelStyles.borderColor,
                            backgroundColor: panelStyles.background,
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            color: panelStyles.textColor,
                        }}
                    >
                        닫기
                    </button>
                </div>
            </div>

            <div
                className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
            >
                <div className="flex h-full flex-col gap-4">
                    <div
                        className="glass-surface flex flex-col gap-2 rounded-xl border px-4 py-3"
                        style={{
                            backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(15, 23, 42, 0.35)',
                            borderColor: panelStyles.borderColor,
                        }}
                    >
                        <label
                            className="text-xs font-medium"
                            htmlFor="memo-title-input"
                            style={{ color: panelStyles.accentColor }}
                        >
                            제목
                        </label>
                        <Input
                            id="memo-title-input"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="메모 제목을 입력하세요"
                            className="h-11 border-0 bg-transparent px-0 text-base focus-visible:ring-0"
                            style={{ color: panelStyles.textColor }}
                        />
                    </div>

                    <div
                        className="glass-surface flex flex-1 flex-col gap-2 rounded-xl border px-4 py-3"
                        style={{
                            backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(15, 23, 42, 0.35)',
                            borderColor: panelStyles.borderColor,
                        }}
                    >
                        <label
                            className="text-xs font-medium"
                            htmlFor="memo-content-input"
                            style={{ color: panelStyles.accentColor }}
                        >
                            내용
                        </label>
                        <Textarea
                            id="memo-content-input"
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            placeholder="메모 내용을 입력하세요"
                            className="min-h-[220px] flex-1 resize-none border-0 bg-transparent px-0 py-0 text-sm focus-visible:ring-0"
                            style={{ color: panelStyles.textColor }}
                        />
                        <div className="flex items-center justify-between text-xs" style={{ color: panelStyles.accentColor }}>
                            <span>Ctrl/⌘ + Enter 로 줄바꿈</span>
                            <span>{content.length.toLocaleString()}자</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex -mb-2 flex-shrink-0 justify-between text-[11px] text-white/60" style={{ color: panelStyles.accentColor }}>
                <span>최근 변경 즉시 저장</span>
                <span>제목 {title.trim() ? '작성됨' : '미입력'}</span>
            </div>

            <div
                className="glass-surface flex flex-shrink-0 items-center justify-between rounded-xl border border-white/15 px-3 py-2 text-xs"
                style={{ color: panelStyles.accentColor }}
            >
                <span>메모 ID: {memo?.id || 'N/A'}</span>
                <span>자동 저장 지연: 240ms</span>
            </div>
        </div>
    );
};

export default MemoPanel;
